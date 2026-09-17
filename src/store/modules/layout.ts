import { defineStore } from 'pinia'
import * as Cesium from 'cesium'
import {
  getReconnaissanceAttackMatrix,
  getSatelliteThreatInfoByType,
  type MatrixResult,
  type ZhchPlanResp,
} from '@/api/electronic'
import { type ChainNode } from '@/utils/satelliteFullChainAnalysis'
import { prefetchSeriesTransmissionLinks } from '@/utils/prefetchTransmissionLinks'
import { getTaskMatrix, type SatelliteAnalysisData } from '@/api/task/task'
import { isTaskProgressComplete, taskProgressMap } from '@/composables/useTaskProgressPolling'
import type { BattleForm, SatelliteData, TaskForm } from '@/types/dashboard'
import type { InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'
import type { SatelliteDetail } from '@/types/cesium/satellite'

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
  /** 当前任务算法分析结果（getTaskMatrix） */
  taskAnalysisData: SatelliteAnalysisData | null
  /** 任务算法分析结果加载状态 */
  taskAnalysisLoading: boolean
  /** 任务分析结果对应的任务 ID */
  taskAnalysisTaskId: number | null
  /** [全局共享] 算法矩阵加载状态 */
  matrixLoading: boolean
  /** [全局共享] 算法矩阵当前查询条件 Key 缓存 */
  matrixQueryKey: string
  /** 矩阵拉取序号，用于丢弃过期的异步响应 */
  matrixFetchToken: number
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
  /** 当前勾选的用途类型（多选，打击方案管理页对比用） */
  selectedZhchUsageTypes: string[]
  /** 当前激活的综合打击方案用途类型（整体态势矩阵数据源） */
  activeZhchUsageType: string
  /** 整体态势地图上是否显示我方武器图层 */
  showOurWeapons: boolean
  /** 右侧面板选中的我方武器（用于地图定位） */
  selectedOurWeapon: { id?: string; name: string; latitude: number; longitude: number; range?: number } | null
  /**
   * 从整体态势链路跳转到打击窗口分析时携带的当前链路快照。
   * 为空表示未聚焦具体链路，打击窗口页展示全部窗口卡片。
   */
  focusedStrikeLink: FocusedStrikeLinkSnapshot | null
}

/**
 * 打击窗口分析页顶部展示的当前链路快照。
 */
export interface FocusedStrikeLinkSnapshot {
  /** 链路唯一标识 */
  id: string
  /** 节点路径文案（卫星 → 中继 → 地面站 → 数据中心） */
  pathText: string
  /** 链路时长展示 */
  durationText: string
  /** 传输时间区间 */
  transmitTime: string
  /** 状态文案 */
  statusText: string
  /** 是否阻断 */
  blocked: boolean
  /** 打击武器名称（多个以顿号分隔） */
  weaponNames: string
  /** 链路节点序列，用于匹配相关打击窗口 */
  nodes: ChainNode[]
}

/** 综合打击方案可选用途类型（与 StrikePlanGenerator 选项一致） */
export const ZHCH_USAGE_TYPE_OPTIONS = ['军用', '民用', '军用民用'] as const

/** 综合打击方案用途类型展示名称 */
export const ZHCH_USAGE_TYPE_LABELS: Record<(typeof ZHCH_USAGE_TYPE_OPTIONS)[number], string> = {
  军用: '软杀伤打击军用',
  民用: '软杀伤打击民用',
  军用民用: '软杀伤打击军用民用',
}

/**
 * 获取综合打击方案用途类型的展示名称
 * @param type 用途类型（军用 / 民用 / 军用民用）
 */
export function getZhchUsageTypeLabel(type: string): string {
  return ZHCH_USAGE_TYPE_LABELS[type as (typeof ZHCH_USAGE_TYPE_OPTIONS)[number]] ?? type
}

/** 同一 scope 的矩阵拉取 in-flight 去重，避免多组件并发请求互相覆盖 */
let matrixScopeInflight: Promise<MatrixResult | null> | null = null
let matrixScopeInflightKey = ''

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
      taskAnalysisData: null,
      taskAnalysisLoading: false,
      taskAnalysisTaskId: null,
      matrixLoading: false,
      matrixQueryKey: '',
      matrixFetchToken: 0,
      mainActiveTab: '整体态势分析',
      topoFocusNorad: null,
      selectedAnalysisNorad: null,
      zhchPlanMap: {},
      zhchPlanTaskId: null,
      zhchPlanLoading: false,
      selectedZhchUsageTypes: ['军用'],
      activeZhchUsageType: '军用',
      showOurWeapons: true,
      selectedOurWeapon: null,
      focusedStrikeLink: null,
    }
  },
  getters: {
    /** 当前激活用途类型对应的综合打击方案 */
    activeZhchPlan(state): ZhchPlanResp | null {
      return state.zhchPlanMap[state.activeZhchUsageType] ?? null
    },
    /** 可选卫星系列：优先生成页缓存的方案系列，否则回退当前矩阵系列 */
    zhchPlanSeriesList(state): string[] {
      const fromPlan = (state.zhchPlanMap[state.activeZhchUsageType]?.levelSeriesEntities || []).map(
        (entity) => entity.series
      )
      if (fromPlan.length) return fromPlan
      if (state.matrixData?.series) return [state.matrixData.series]
      return []
    },
    // 从 battle.area 中解析 lonlats 并计算战场区域边界包围盒
    battleAreaBounds(state): {
      min_lat: number
      max_lat: number
      min_lng: number
      max_lng: number
      lonlats: { lon: number; lat: number }[]
    } | null {
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
      if (this.selectedSatType !== type) {
        this.matrixQueryKey = ''
      }
      this.selectedSatType = type
    },
    /**
     * [功能]
     * 设置当前选中的卫星系列并保存至全局 Store
     * @param series 卫星系列名称
     */
    setSelectedSatSeries(series: string) {
      if (this.selectedSatSeries !== series) {
        this.matrixQueryKey = ''
        this.matrixData = null
      }
      this.selectedSatSeries = series
    },
    /**
     * [功能说明]
     * 按当前系列筛选范围动态生成矩阵（calSeriesChainV2）
     * @param params 兼容旧调用：可指定 series
     * @param force 是否强制重新解析
     */
    async fetchReconnaissanceAttackMatrix(
      params?: { taskId?: number; series?: string },
      force = false
    ): Promise<MatrixResult | null> {
      if (params?.series !== undefined && params.series !== this.selectedSatSeries) {
        this.setSelectedSatSeries(params.series)
      }
      return this.fetchMatrixForCurrentScope(force)
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
     * 判断指定任务的算法进度是否已全部完成。
     * @param task 任务对象
     */
    isTaskAlgorithmComplete(task?: TaskForm | null): boolean {
      if (!task?.id) return false
      const progress = taskProgressMap[task.id] ?? task.algorithmProgressEntity
      return isTaskProgressComplete(progress as Parameters<typeof isTaskProgressComplete>[0])
    },
    /**
     * 清空当前任务算法分析结果缓存。
     */
    clearTaskAnalysisData() {
      this.taskAnalysisData = null
      this.taskAnalysisTaskId = null
    },
    /**
     * 按任务 ID 拉取算法分析结果（getTaskMatrix）。
     * 算法未完成时不会请求接口，并清空已有分析数据。
     * @param force 是否强制重新请求
     */
    async fetchTaskAnalysis(force = false): Promise<SatelliteAnalysisData | null> {
      const task = this.activedTask
      const taskId = task?.id
      if (!taskId) {
        this.clearTaskAnalysisData()
        return null
      }

      if (!this.isTaskAlgorithmComplete(task)) {
        this.clearTaskAnalysisData()
        return null
      }

      if (!force && this.taskAnalysisTaskId === taskId && this.taskAnalysisData) {
        return this.taskAnalysisData
      }

      this.taskAnalysisLoading = true
      try {
        const res = await getTaskMatrix({ taskId: String(taskId) })
        if (res.code === 200 && res.data) {
          this.taskAnalysisData = res.data
          this.taskAnalysisTaskId = taskId
          return res.data
        }
        this.clearTaskAnalysisData()
        return null
      } catch (err) {
        console.error('获取任务算法分析结果失败:', err)
        this.clearTaskAnalysisData()
        return null
      } finally {
        this.taskAnalysisLoading = false
      }
    },
    /**
     * 生成当前矩阵查询范围 Key（任务 + 类型 + 系列）
     * @param taskId 任务 ID
     */
    buildMatrixScopeKey(taskId?: number): string {
      const id = taskId ?? this.activedTask?.id ?? 0
      if (!id) return ''
      const usage = this.activeZhchUsageType
      if (this.selectedSatSeries) return `${id}::${usage}::series::${this.selectedSatSeries}`
      return `${id}::${usage}::all`
    },
    /**
     * 开始一次矩阵拉取，返回用于校验响应是否仍有效的上下文
     */
    beginMatrixFetch(): { token: number; scopeKey: string; queryKey: string; taskId: number } {
      const taskId = this.activedTask?.id ?? 0
      const token = ++this.matrixFetchToken
      const scopeKey = this.buildMatrixScopeKey(taskId)
      const usageType = this.activeZhchUsageType
      const queryKey = this.selectedSatSeries
        ? `${taskId}_${usageType}_${this.selectedSatSeries}`
        : `${taskId}_${usageType}__ALL_SERIES__`
      this.matrixLoading = true
      return { token, scopeKey, queryKey, taskId }
    },
    /**
     * 判断矩阵拉取序号是否仍为最新（仅校验 token，避免系列切换时 scope 比较误判）
     */
    isMatrixFetchCurrent(token: number): boolean {
      return token === this.matrixFetchToken
    },
    /**
     * 应用矩阵拉取结果；过期响应或空结果不会清空已有矩阵
     */
    applyMatrixResult(
      token: number,
      _scopeKey: string,
      _taskId: number,
      queryKey: string,
      data: MatrixResult | null
    ): MatrixResult | null {
      if (!this.isMatrixFetchCurrent(token)) {
        return this.matrixData
      }
      if (data) {
        this.matrixData = data
        this.matrixQueryKey = queryKey
        return data
      }
      return this.matrixData
    },
    /**
     * 结束矩阵拉取并关闭 loading（仅最新请求可关闭）
     */
    finishMatrixFetch(token: number) {
      if (token === this.matrixFetchToken) {
        this.matrixLoading = false
      }
    },
    /**
     * 按当前任务与选中系列动态生成矩阵（calSeriesChainV2），不再预查 zhchPlanV3。
     * @param force 是否强制重新请求
     */
    async fetchMatrixForCurrentScope(force = false): Promise<MatrixResult | null> {
      const taskId = this.activedTask?.id ?? 0
      if (!taskId) {
        this.clearMatrixData()
        return null
      }

      const series = this.selectedSatSeries
      if (!series) {
        return this.matrixData
      }

      const usageType = this.activeZhchUsageType
      const queryKey = `${taskId}_${usageType}_${series}`

      if (!force && this.matrixQueryKey === queryKey && this.matrixData) {
        return this.matrixData
      }

      const inflightKey = queryKey
      if (matrixScopeInflight && matrixScopeInflightKey === inflightKey) {
        return matrixScopeInflight
      }

      matrixScopeInflightKey = inflightKey
      matrixScopeInflight = (async () => {
        try {
          const { token, scopeKey, queryKey: activeQueryKey, taskId: activeTaskId } = this.beginMatrixFetch()
          try {
            if (!this.isMatrixFetchCurrent(token)) {
              return this.matrixData
            }

            const res = await getReconnaissanceAttackMatrix({ taskId, series })
            const matrix = res.code === 200 ? res.data : null
            if (matrix) {
              await prefetchSeriesTransmissionLinks(matrix)
            }
            if (!this.isMatrixFetchCurrent(token)) {
              return this.matrixData
            }
            return this.applyMatrixResult(token, scopeKey, activeTaskId, activeQueryKey, matrix)
          } finally {
            this.finishMatrixFetch(token)
          }
        } catch (err) {
          console.error('动态生成算法传输矩阵失败:', err)
          return this.matrixData
        } finally {
          if (matrixScopeInflightKey === inflightKey) {
            matrixScopeInflight = null
            matrixScopeInflightKey = ''
          }
        }
      })()

      return matrixScopeInflight
    },
    /**
     * 切换顶层功能 Tab
     * @param tab Tab 名称
     */
    setMainActiveTab(tab: string) {
      this.mainActiveTab = tab
    },
    /**
     * 切换当前激活的综合打击方案，并重新解析矩阵
     * @param type 用途类型（军用 / 民用 / 军用民用）
     */
    async setActiveZhchUsageType(type: string) {
      if (!(ZHCH_USAGE_TYPE_OPTIONS as readonly string[]).includes(type)) return
      if (this.activeZhchUsageType === type) return

      this.activeZhchUsageType = type
      this.matrixQueryKey = ''
      this.matrixData = null

      if (
        this.selectedSatSeries &&
        this.zhchPlanSeriesList.length &&
        !this.zhchPlanSeriesList.includes(this.selectedSatSeries)
      ) {
        this.selectedSatSeries = ''
      }

      await this.fetchMatrixForCurrentScope(true)
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
     * 写入从整体态势带入打击窗口分析的当前链路。
     * @param snapshot 链路快照；传 null 表示取消聚焦并展示全部窗口
     */
    setFocusedStrikeLink(snapshot: FocusedStrikeLinkSnapshot | null) {
      this.focusedStrikeLink = snapshot
    },
    /**
     * 从整体态势链路跳转到打击窗口分析，并先展示该链路、再展示相关窗口。
     * @param snapshot 当前选中的链路快照
     */
    navigateToWeaponWindows(snapshot: FocusedStrikeLinkSnapshot) {
      this.focusedStrikeLink = snapshot
      this.mainActiveTab = '打击窗口分析'
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
     * 过滤掉旧版用途类型（如「军用」），仅保留当前 UI 支持的选项
     */
    sanitizeZhchUsageTypes() {
      const valid = new Set<string>(ZHCH_USAGE_TYPE_OPTIONS)
      this.selectedZhchUsageTypes = this.selectedZhchUsageTypes.filter((t) => valid.has(t))
      if (!this.selectedZhchUsageTypes.length) {
        this.selectedZhchUsageTypes = ['军用']
      }
    },
    /**
     * 切换综合打击方案用途类型多选
     * @param type 用途类型（软杀伤打击军用 / 软杀伤打击民用 / 软杀伤打击军用民用）
     */
    toggleZhchUsageType(type: string) {
      this.sanitizeZhchUsageTypes()
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
      this.clearMatrixData()
    },
    /**
     * 手动生成并缓存指定用途类型的综合打击方案（仅打击方案页触发，不自动预查）。
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

      this.sanitizeZhchUsageTypes()
      const validTypes = targetTypes.filter((t) => (ZHCH_USAGE_TYPE_OPTIONS as readonly string[]).includes(t))
      if (!validTypes.length) return false

      if (this.zhchPlanTaskId !== taskId) {
        this.clearZhchPlans()
      }

      this.zhchPlanLoading = true
      try {
        const results = await Promise.all(
          validTypes.map(async (type) => {
            if (!force && this.zhchPlanMap[type]) {
              return { type, data: this.zhchPlanMap[type] }
            }
            const res = await getSatelliteThreatInfoByType({ type, taskId, sysType: null })
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
    pick: [
      'activedTask',
      'battle',
      'showBattleList',
      'allSatelliteOfTask',
      'satelliteTotal',
      'selectedSatType',
      'selectedSatSeries',
      'activeZhchUsageType',
    ],
  },
})
