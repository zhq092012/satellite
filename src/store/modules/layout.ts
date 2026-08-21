import { defineStore } from 'pinia'
import * as Cesium from 'cesium'
import { getReconnaissanceAttackMatrix, getSatelliteThreatInfoByType, type MatrixResult, type ZhchPlanResp } from '@/api/electronic'
import type { BattleForm, SatelliteData, TaskForm } from '@/types/dashboard'
import type { InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'

interface State {
  activetab: string //当前激活的Tab页
  isCollapse: boolean
  activedTask: TaskForm | null
  battle: BattleForm | null
  battleCircleMap: Map<number, { name: string; center: [number, number]; radiusKm: number }>
  currentCircleIdx: number
  battlePolygonMap: Map<number, { name: string; lonlats: { lon: number; lat: number }[] }>
  currentPolygonIdx: number
  showSatelliteList: boolean //卫星列表面板
  showAnalysisPanel: boolean //分析面板
  showSatelliteMsgBox: boolean
  selectedSatellite: SatelliteDetail | null

  /** 当前选中的 3D 敌方地面基础设施节点 (地面接收站 / 中心云数据中心) */
  selectedInfrastructureNode: InfrastructureLocation | null
  /** 当前任务下所有过境卫星数据*/
  allSatelliteOfTask: SatelliteData[]
  /** 当前选中的卫星类型 */
  selectedSatType: string
  /** 当前选中的卫星系列 */
  selectedSatSeries: string
  effectModel: boolean // 是否惯性参考系
  showNetView: boolean

  // 地球自转相关状态
  battleCenterCartensian: Cesium.Cartesian3 | null // 战场中心位置（笛卡尔坐标）
  battleCenterOritentation: Cesium.HeadingPitchRoll | null // 战场中心朝向（航向、俯仰、滚转）
  satelliteTotal: number // 卫星总数

  /** [全局共享] 四个 Tab 页共用的算法侦察/打击矩阵查询结果 */
  matrixData: MatrixResult | null
  /** [全局共享] 算法矩阵加载状态 */
  matrixLoading: boolean
  /** [全局共享] 算法矩阵当前查询条件 Key 缓存 */
  matrixQueryKey: string
  /** 顶层功能 Tab 当前激活项 */
  mainActiveTab: string
  /** 从整体态势跳转拓扑分析时待聚焦的卫星 NORAD */
  topoFocusNorad: number | null
  /** 整体态势 / 拓扑分析共享的当前分析卫星 NORAD */
  selectedAnalysisNorad: number | null
  /** 综合打击方案：按用途类型缓存的查询结果（军用 / 民用 / 军民混用） */
  zhchPlanMap: Record<string, ZhchPlanResp>
  /** 综合打击方案缓存对应的任务 ID */
  zhchPlanTaskId: number | null
  /** 综合打击方案加载状态 */
  zhchPlanLoading: boolean
  /** 当前勾选的用途类型（多选） */
  selectedZhchUsageTypes: string[]
  /** 整体态势地图上是否显示我方武器图层 */
  showOurWeapons: boolean
  /** 右侧面板选中的我方武器（用于地图定位） */
  selectedOurWeapon: { id?: string; name: string; latitude: number; longitude: number; range?: number } | null
}
export const useLayoutStore = defineStore('layout-store', {
  state: (): State => {
    return {
      activetab: '战场态势视图',
      isCollapse: false,
      activedTask: null,
      battle: null,
      battleCircleMap: new Map<number, { name: string; center: [number, number]; radiusKm: number }>(),
      battlePolygonMap: new Map<number, { name: string; lonlats: { lon: number; lat: number }[] }>(),
      currentCircleIdx: 0,
      currentPolygonIdx: 0,
      showSatelliteList: false,
      showSatelliteMsgBox: false,
      showAnalysisPanel: true,
      selectedSatellite: null,
      selectedInfrastructureNode: null,
      selectedSatType: '',
      selectedSatSeries: '',

      allSatelliteOfTask: [],
      effectModel: true,
      showNetView: false,
      battleCenterCartensian: null,
      battleCenterOritentation: null,
      satelliteTotal: 0,

      matrixData: null,
      matrixLoading: false,
      matrixQueryKey: '',
      mainActiveTab: '整体态势分析',
      topoFocusNorad: null,
      selectedAnalysisNorad: null,
      zhchPlanMap: {},
      zhchPlanTaskId: null,
      zhchPlanLoading: false,
      selectedZhchUsageTypes: ['军用'],
      showOurWeapons: false,
      selectedOurWeapon: null,
    }
  },
  getters: {
    // 从 battle.area 中解析 lonlats 并计算战场区域边界包围盒
    battleAreaBounds(state): { min_lat: number; max_lat: number; min_lng: number; max_lng: number; lonlats: { lon: number; lat: number }[] } | null {
      if (!state.battle?.area) return null
      try {
        let areaData = typeof state.battle.area === 'string' ? JSON.parse(state.battle.area) : state.battle.area
        if (!Array.isArray(areaData)) areaData = [areaData]

        const lonlats: { lon: number; lat: number }[] = []
        areaData.forEach((item: any) => {
          const raw = item?.lonlats
          if (Array.isArray(raw)) {
            raw.forEach((pt: any) => {
              if (Array.isArray(pt) && pt.length >= 2) {
                lonlats.push({ lon: Number(pt[0]), lat: Number(pt[1]) })
              } else if (pt && typeof pt === 'object') {
                const lon = typeof pt.lon === 'number' ? pt.lon : pt.lng
                const lat = pt.lat
                if (typeof lon === 'number' && typeof lat === 'number') {
                  lonlats.push({ lon, lat })
                }
              }
            })
          }
        })

        if (lonlats.length === 0) return null

        const lons = lonlats.map((p) => p.lon)
        const lats = lonlats.map((p) => p.lat)

        return {
          min_lng: Math.min(...lons),
          max_lng: Math.max(...lons),
          min_lat: Math.min(...lats),
          max_lat: Math.max(...lats),
          lonlats,
        }
      } catch (e) {
        console.error('解析战场区域失败:', e)
        return null
      }
    },
  },
  actions: {
    toggleCollapse(isCollapse: boolean) {
      this.isCollapse = isCollapse
    },
    setActivedTask(activedTask: TaskForm | null) {
      this.activedTask = activedTask
    },
    setActivedBattle(battle: BattleForm) {
      this.battle = battle
    },

    toggleEffectModel(show: boolean) {
      this.effectModel = show
    },
    toggleShowSatelliteList(show: boolean) {
      this.showSatelliteList = show
      this.showAnalysisPanel = !show
    },
    toggleShowAnalysisList(show: boolean) {
      this.showAnalysisPanel = show
      this.showSatelliteList = !show
    },
    setSelectedSatellite(satellite: SatelliteDetail | null) {
      this.selectedSatellite = satellite
    },
    /**
     * [功能]
     * 设置当前选中的敌方地面基础设施节点 (地面接收站 / 中心云数据中心)
     *
     * @param node 选中的 InfrastructureLocation 对象或 null
     */
    setSelectedInfrastructureNode(node: InfrastructureLocation | null) {
      this.selectedInfrastructureNode = node
    },
    /* 关闭面板 */
    closeSatPanel() {
      this.showSatelliteMsgBox = false
      this.showSatelliteList = false
    },
    // 保存任务下的所有卫星
    saveTaskSatellite(satellites: SatelliteData[]) {
      this.allSatelliteOfTask = satellites
    },
    setCircle(idx: number, circle: { name: string; center: [number, number]; radiusKm: number }) {
      if (this.battleCircleMap.size === 0) {
        this.currentCircleIdx = 0
        this.battleCircleMap.set(this.currentCircleIdx, circle)
      } else {
        this.currentCircleIdx = idx
        this.battleCircleMap.set(this.currentCircleIdx, circle)
      }
    },
    setPolygon(idx: number, polygon: { name: string; lonlats: { lon: number; lat: number }[] }) {
      if (this.battlePolygonMap.size === 0) {
        this.currentPolygonIdx = 0
        this.battlePolygonMap.set(this.currentPolygonIdx, polygon)
      } else {
        this.currentCircleIdx = idx
        this.battlePolygonMap.set(this.currentCircleIdx, polygon)
      }
    },
    removeCircle(idx: number) {
      this.battleCircleMap.delete(idx)
    },
    removePolygon(idx: number) {
      this.battlePolygonMap.delete(idx)
    },
    // 设置战场中心位置和朝向
    setBattleCenter(cartesian: Cesium.Cartesian3, orientation: Cesium.HeadingPitchRoll) {
      this.battleCenterCartensian = cartesian
      this.battleCenterOritentation = orientation
    },
    /**
     * [功能]
     * 设置当前选中的卫星类型并保存至全局 Store
     * @param type 卫星类型名称
     */
    setSelectedSatType(type: string) {
      this.selectedSatType = type
    },
    /**
     * [功能]
     * 设置当前选中的卫星系列并保存至全局 Store
     * @param series 卫星系列名称
     */
    setSelectedSatSeries(series: string) {
      this.selectedSatSeries = series
    },
    /**
     * [功能说明]
     * 统一在 Store 中执行算法侦察打击矩阵查询并全局持久共享
     * @param params 查询参数 (taskId, series)
     * @param force 是否强制重新请求
     */
    async fetchReconnaissanceAttackMatrix(
      params?: { taskId?: number; series?: string },
      force = false
    ): Promise<MatrixResult | null> {
      const taskId = params?.taskId ?? this.activedTask?.id ?? 0
      const series = params?.series ?? this.selectedSatSeries ?? ''

      if (!taskId) {
        this.matrixData = null
        this.matrixQueryKey = ''
        return null
      }

      const queryKey = `${taskId}_${series}`
      // 若已有缓存且非强制刷新，直接返回 store 中的 matrixData
      if (!force && this.matrixQueryKey === queryKey && this.matrixData) {
        return this.matrixData
      }

      this.matrixLoading = true
      try {
        const res = await getReconnaissanceAttackMatrix({
          taskId,
          series,
        })
        if (res && res.code === 200 && res.data) {
          this.matrixData = res.data
          this.matrixQueryKey = queryKey
          return res.data
        }
      } catch (err) {
        console.error('全局 Store 获取算法侦察打击矩阵失败:', err)
      } finally {
        this.matrixLoading = false
      }
      return this.matrixData
    },
    /**
     * [功能说明]
     * 清空 Store 中共享的矩阵缓存数据
     */
    clearMatrixData() {
      this.matrixData = null
      this.matrixQueryKey = ''
    },
    /**
     * 切换顶层功能 Tab
     * @param tab Tab 名称
     */
    setMainActiveTab(tab: string) {
      this.mainActiveTab = tab
    },
    /**
     * 设置当前分析选中的卫星 NORAD（整体态势与拓扑分析共享）
     * @param norad 卫星 NORAD 编号，取消选择时传 null
     */
    setSelectedAnalysisNorad(norad: number | null) {
      this.selectedAnalysisNorad = norad
    },
    /**
     * 从整体态势跳转到拓扑分析并聚焦指定卫星
     * @param norad 卫星 NORAD 编号
     */
    navigateToTopoAnalysis(norad: number) {
      this.selectedAnalysisNorad = norad
      this.topoFocusNorad = norad
      this.mainActiveTab = '态势拓扑分析'
    },
    /**
     * 从打击窗口分析跳转到整体态势，并默认开启我方武器图层
     */
    navigateToOurSituation() {
      this.showOurWeapons = true
      this.mainActiveTab = '整体态势分析'
    },
    /**
     * 切换整体态势地图上我方武器图层的显隐
     * @param show 是否显示我方武器
     */
    setShowOurWeapons(show: boolean) {
      this.showOurWeapons = show
      if (!show) {
        this.selectedOurWeapon = null
      }
    },
    /**
     * 设置右侧面板选中的我方武器，并触发地图定位
     * @param weapon 选中的武器对象或 null（取消选择）
     */
    setSelectedOurWeapon(
      weapon: { id?: string; name: string; latitude: number; longitude: number; range?: number } | null
    ) {
      this.selectedOurWeapon = weapon
    },
    /**
     * 读取并清除待聚焦的拓扑卫星 NORAD（避免重复触发）
     * @returns 待聚焦 NORAD 或 null
     */
    consumeTopoFocusNorad(): number | null {
      const norad = this.topoFocusNorad
      this.topoFocusNorad = null
      return norad
    },
    /**
     * 切换综合打击方案用途类型多选
     * @param type 用途类型（军用 / 民用 / 军民混用）
     */
    toggleZhchUsageType(type: string) {
      const idx = this.selectedZhchUsageTypes.indexOf(type)
      if (idx >= 0) {
        if (this.selectedZhchUsageTypes.length <= 1) return
        this.selectedZhchUsageTypes.splice(idx, 1)
      } else {
        this.selectedZhchUsageTypes.push(type)
      }
    },
    /**
     * 清空综合打击方案缓存
     */
    clearZhchPlans() {
      this.zhchPlanMap = {}
      this.zhchPlanTaskId = null
    },
    /**
     * 拉取并缓存指定用途类型的综合打击方案
     * @param types 用途类型列表
     * @param force 是否强制重新请求
     */
    async fetchZhchPlans(types?: string[], force = false): Promise<boolean> {
      const taskId = this.activedTask?.id
      if (!taskId) {
        this.clearZhchPlans()
        return false
      }

      const targetTypes = types?.length ? types : [...this.selectedZhchUsageTypes]
      if (!targetTypes.length) return false

      if (this.zhchPlanTaskId !== taskId) {
        this.clearZhchPlans()
      }

      this.zhchPlanLoading = true
      try {
        const results = await Promise.all(
          targetTypes.map(async (type) => {
            if (!force && this.zhchPlanMap[type]) {
              return { type, data: this.zhchPlanMap[type] }
            }
            const res = await getSatelliteThreatInfoByType({ type, taskId })
            return { type, data: res.code === 200 ? res.data : null }
          })
        )

        let hasData = false
        results.forEach(({ type, data }) => {
          if (data) {
            this.zhchPlanMap[type] = data
            hasData = true
          }
        })
        this.zhchPlanTaskId = taskId
        return hasData
      } catch (err) {
        console.error('获取综合打击方案失败:', err)
        return false
      } finally {
        this.zhchPlanLoading = false
      }
    },
  },
  persist: {
    storage: localStorage,
    pick: ['activedTask', 'battle', 'showBattleList', 'allSatelliteOfTask', 'satelliteTotal', 'selectedSatType', 'selectedSatSeries'],
  },
})
