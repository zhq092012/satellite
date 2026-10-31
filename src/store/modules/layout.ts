import { defineStore } from 'pinia'
import * as Cesium from 'cesium'
import {
  getReconnaissanceAttackMatrix,
  getSatelliteThreatInfoByType,
  type MatrixResult,
  type ZhchPlanResp,
} from '@/api/electronic'
import { prefetchSeriesTransmissionLinks } from '@/utils/prefetchTransmissionLinks'
import { getTaskMatrix, type SatelliteAnalysisData } from '@/api/task/task'
import { isTaskProgressComplete, taskProgressMap } from '@/composables/useTaskProgressPolling'
import type { BattleForm, SatelliteData, TaskCombatArea, TaskForm } from '@/types/dashboard'
import type {
  BattleCircleArea,
  BattlePolygonArea,
  FocusedStrikeLinkSnapshot,
  SelectedOurWeapon,
} from '@/types/layout'
import type { InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'
import type { SatelliteDetail } from '@/types/cesium/satellite'

/**
 * 把旧版布局 store 的持久化字段名换成当前字段名。
 * 只在新字段还不存在时搬迁，避免覆盖已经写过的新数据。
 */
const migrateLayoutStoreFieldNames = () => {
  if (typeof localStorage === 'undefined') return
  const storageKey = 'layout-store'
  const raw = localStorage.getItem(storageKey)
  if (!raw) return
  const saved = JSON.parse(raw) as Record<string, unknown>
  const renames: Array<[string, string]> = [
    ['activedTask', 'activeTask'],
    ['allSatelliteOfTask', 'taskSatellites'],
  ]
  let changed = false
  for (const [previousName, currentName] of renames) {
    if (previousName in saved && !(currentName in saved)) {
      saved[currentName] = saved[previousName]
      delete saved[previousName]
      changed = true
    }
  }
  if (changed) localStorage.setItem(storageKey, JSON.stringify(saved))
}

migrateLayoutStoreFieldNames()

/** 布局 Store 的全部状态。 */
interface State {
  /** 当前激活的态势子 Tab */
  activeSceneTab: string
  /** 侧栏是否收起 */
  isCollapse: boolean
  /** 当前激活任务；未选择时为 null */
  activeTask: TaskForm | null
  /** 当前战场；未选择时为 null */
  battle: BattleForm | null
  /** 战场圆形区域：序号 → 名称、圆心和半径 */
  battleCircleMap: Map<number, BattleCircleArea>
  /** 当前正在编辑的圆形区域序号 */
  currentCircleIdx: number
  /** 战场多边形区域：序号 → 名称和顶点 */
  battlePolygonMap: Map<number, BattlePolygonArea>
  /** 当前正在编辑的多边形区域序号 */
  currentPolygonIdx: number
  /** 是否显示卫星列表面板 */
  showSatelliteList: boolean
  /** 是否显示分析面板；与卫星列表互斥 */
  showAnalysisPanel: boolean
  /** 是否显示卫星信息弹层 */
  showSatelliteMsgBox: boolean
  /** 当前选中卫星的档案详情 */
  selectedSatellite: SatelliteDetail | null

  /** 当前选中的 3D 敌方地面基础设施节点 (地面接收站 / 中心云数据中心) */
  selectedInfrastructureNode: InfrastructureLocation | null
  /** 当前任务下所有过境卫星数据 */
  taskSatellites: SatelliteData[]
  /** 当前选中的卫星类型 */
  selectedSatType: string
  /** 当前选中的卫星系列 */
  selectedSatSeries: string
  /** 是否使用惯性参考系展示 */
  effectModel: boolean
  /** 是否显示网络拓扑视图 */
  showNetView: boolean

  /** 战场中心位置（笛卡尔坐标），用于恢复俯视相机 */
  battleCenterCartesian: Cesium.Cartesian3 | null
  /** 战场中心朝向（航向、俯仰、滚转） */
  battleCenterOrientation: Cesium.HeadingPitchRoll | null
  /** 卫星总数 */
  satelliteTotal: number

  /** [全局共享] 四个 Tab 页共用的算法侦察/打击矩阵查询结果 */
  matrixData: MatrixResult | null
  /** 当前任务算法分析结果（getTaskMatrix） */
  taskAnalysisData: SatelliteAnalysisData | null
  /** 左侧面板编辑的任务作战区域（用于地图展示，与 activeTask.combatArea 同步） */
  taskCombatArea: TaskCombatArea | null
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
  /** 生成打击方案时选中的卫星系统类型（侦察 / 通信）；不选为 null */
  selectedZhchSysType: string | null
  /** 最近一次拉取方案时使用的卫星系统类型（用于缓存失效） */
  zhchPlanFetchSysType: string | null
  /** 整体态势地图上是否显示我方武器图层 */
  showOurWeapons: boolean
  /** 右侧面板选中的我方武器（用于地图定位） */
  selectedOurWeapon: SelectedOurWeapon | null
  /**
   * 从整体态势链路跳转到打击窗口分析时携带的当前链路快照。
   * 为空表示未聚焦具体链路，打击窗口页展示全部窗口卡片。
   */
  focusedStrikeLink: FocusedStrikeLinkSnapshot | null
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
 * 获取综合打击方案用途类型的展示名称。
 *
 * @param type 用途类型（军用 / 民用 / 军用民用）
 * @returns 对应中文标签；未知类型原样返回
 */
export function getZhchUsageTypeLabel(type: string): string {
  return ZHCH_USAGE_TYPE_LABELS[type as (typeof ZHCH_USAGE_TYPE_OPTIONS)[number]] ?? type
}

/** 生成打击方案可选卫星系统类型（侦察 / 通信，单选或不选） */
export const ZHCH_SYS_TYPE_OPTIONS = ['侦察', '通信'] as const

/**
 * 判断字符串是否为可选的卫星系统类型。
 *
 * @param type 待校验文案
 * @returns 是「侦察」或「通信」时为 true，并收窄类型
 */
export function isZhchSysTypeOption(type: string): type is (typeof ZHCH_SYS_TYPE_OPTIONS)[number] {
  return (ZHCH_SYS_TYPE_OPTIONS as readonly string[]).includes(type)
}

/** 同一查询条件正在进行的矩阵请求；并发调用复用这个 Promise */
let matrixScopeInflight: Promise<MatrixResult | null> | null = null
/** 与 `matrixScopeInflight` 对应的查询键；条件变化后不再复用旧请求 */
let matrixScopeInflightKey = ''

export const useLayoutStore = defineStore('layout-store', {
  state: (): State => {
    return {
      activeSceneTab: '战场态势视图',
      isCollapse: false,
      activeTask: null,
      battle: null,
      battleCircleMap: new Map<number, BattleCircleArea>(),
      battlePolygonMap: new Map<number, BattlePolygonArea>(),
      currentCircleIdx: 0,
      currentPolygonIdx: 0,
      showSatelliteList: false,
      showSatelliteMsgBox: false,
      showAnalysisPanel: true,
      selectedSatellite: null,
      selectedInfrastructureNode: null,
      selectedSatType: '',
      selectedSatSeries: '',

      taskSatellites: [],
      effectModel: true,
      showNetView: false,
      battleCenterCartesian: null,
      battleCenterOrientation: null,
      satelliteTotal: 0,

      matrixData: null,
      taskAnalysisData: null,
      taskCombatArea: null,
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
      selectedZhchSysType: null,
      zhchPlanFetchSysType: null,
      showOurWeapons: true,
      selectedOurWeapon: null,
      focusedStrikeLink: null,
    }
  },
  getters: {
    /** 当前激活用途类型对应的综合打击方案 */
    activeZhchPlan(state): ZhchPlanResp | null {
      /** 当前激活用途在缓存中的方案；尚未拉取时为 null */
      return state.zhchPlanMap[state.activeZhchUsageType] ?? null
    },
    /** 可选卫星系列：优先生成页缓存的方案系列，否则回退当前矩阵系列 */
    zhchPlanSeriesList(state): string[] {
      /** 当前方案里的系列名；没有方案时再回退矩阵系列 */
      const fromPlan = (state.zhchPlanMap[state.activeZhchUsageType]?.levelSeriesEntities || []).map(
        (entity) => entity.series
      )
      if (fromPlan.length) return fromPlan
      if (state.matrixData?.series) return [state.matrixData.series]
      return []
    },
    /**
     * 当前任务已装配的卫星系列（来自 task.resources，去重并保持接口顺序）。
     * 态势拓扑 / 甘特图系列下拉与整体态势左侧面板共用此列表。
     */
    taskSelectedSeriesList(state): string[] {
      /** 任务已装配资源；从中提取系列并去重 */
      const resources = state.activeTask?.resources ?? []
      /** 已写入结果的系列，用于保持接口顺序下去重 */
      const seen = new Set<string>()
      const result: string[] = []
      for (const item of resources) {
        /** 去掉空白后的系列名；非字符串或空串不进入下拉 */
        const series = typeof item.series === 'string' ? item.series.trim() : ''
        if (!series || seen.has(series)) continue
        seen.add(series)
        result.push(series)
      }
      return result
    },
    // 从 battle.area 中解析 lonlats 并计算战场区域边界包围盒
    battleAreaBounds(state): {
      /** 区域最南纬度（度） */
      min_lat: number
      /** 区域最北纬度（度） */
      max_lat: number
      /** 区域最西经度（度） */
      min_lng: number
      /** 区域最东经度（度） */
      max_lng: number
      /** 解析后的多边形顶点 */
      lonlats: { lon: number; lat: number }[]
    } | null {
      if (!state.battle?.area) return null
      try {
        /** 接口可能给 JSON 字符串或对象；统一成区域数组 */
        let areaData = typeof state.battle.area === 'string' ? JSON.parse(state.battle.area) : state.battle.area
        if (!Array.isArray(areaData)) areaData = [areaData]

        /** 全部区域顶点，用于计算包围盒 */
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

        /** 顶点经度、纬度，分别取最小最大得到包围盒 */
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
    /**
     * 设置侧栏收起状态。
     *
     * @param isCollapse 为 true 时收起
     */
    toggleCollapse(isCollapse: boolean) {
      this.isCollapse = isCollapse
    },
    /**
     * 设置当前激活任务。
     *
     * @param activeTask 任务对象；传 null 表示取消选择
     */
    setActiveTask(activeTask: TaskForm | null) {
      this.activeTask = activeTask
    },
    /**
     * 更新当前任务作战区域预览（左侧面板编辑 → 地图渲染）。
     * @param area 区域配置；null 表示清除
     */
    setTaskCombatArea(area: TaskCombatArea | null) {
      this.taskCombatArea = area ? { ...area } : null
    },
    /**
     * 设置当前战场。
     *
     * @param battle 战场对象
     */
    setActiveBattle(battle: BattleForm) {
      this.battle = battle
    },

    /**
     * 切换是否使用惯性参考系。
     *
     * @param show 为 true 时启用惯性参考系
     */
    toggleEffectModel(show: boolean) {
      this.effectModel = show
    },
    /**
     * 显示或隐藏卫星列表面板，并关闭分析面板。
     *
     * @param show 是否显示卫星列表
     */
    toggleShowSatelliteList(show: boolean) {
      this.showSatelliteList = show
      this.showAnalysisPanel = !show
    },
    /**
     * 显示或隐藏分析面板，并关闭卫星列表。
     *
     * @param show 是否显示分析面板
     */
    toggleShowAnalysisList(show: boolean) {
      this.showAnalysisPanel = show
      this.showSatelliteList = !show
    },
    /**
     * 设置当前选中卫星档案。
     *
     * @param satellite 卫星详情；传 null 表示取消
     */
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
    /** 关闭卫星信息弹层和卫星列表面板。 */
    closeSatPanel() {
      this.showSatelliteMsgBox = false
      this.showSatelliteList = false
    },
    /**
     * 保存当前任务下的过境卫星列表。
     *
     * @param satellites 过境卫星数据
     */
    saveTaskSatellite(satellites: SatelliteData[]) {
      this.taskSatellites = satellites
    },
    /**
     * 写入一个战场圆形区域。地图为空时忽略传入序号，从 0 开始。
     *
     * @param idx 圆形序号
     * @param circle 名称、圆心和半径
     */
    setCircle(idx: number, circle: { name: string; center: [number, number]; radiusKm: number }) {
      if (this.battleCircleMap.size === 0) {
        this.currentCircleIdx = 0
        this.battleCircleMap.set(this.currentCircleIdx, circle)
      } else {
        this.currentCircleIdx = idx
        this.battleCircleMap.set(this.currentCircleIdx, circle)
      }
    },
    /**
     * 写入一个战场多边形区域。地图为空时忽略传入序号，从 0 开始。
     *
     * @param idx 多边形序号
     * @param polygon 名称和顶点
     */
    setPolygon(idx: number, polygon: { name: string; lonlats: { lon: number; lat: number }[] }) {
      if (this.battlePolygonMap.size === 0) {
        this.currentPolygonIdx = 0
        this.battlePolygonMap.set(this.currentPolygonIdx, polygon)
      } else {
        this.currentCircleIdx = idx
        this.battlePolygonMap.set(this.currentCircleIdx, polygon)
      }
    },
    /**
     * 删除指定序号的圆形区域。
     *
     * @param idx 圆形序号
     */
    removeCircle(idx: number) {
      this.battleCircleMap.delete(idx)
    },
    /**
     * 删除指定序号的多边形区域。
     *
     * @param idx 多边形序号
     */
    removePolygon(idx: number) {
      this.battlePolygonMap.delete(idx)
    },
    /**
     * 记录战场中心的相机位置和朝向，供态势地球恢复俯视。
     *
     * @param cartesian 战场中心笛卡尔坐标
     * @param orientation 航向、俯仰、滚转
     */
    setBattleCenter(cartesian: Cesium.Cartesian3, orientation: Cesium.HeadingPitchRoll) {
      this.battleCenterCartesian = cartesian
      this.battleCenterOrientation = orientation
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
     * 在任务已装配系列范围内校正当前分析系列：无选中或选中不在列表中时默认第一项。
     *
     * @param options 可选系列名列表；默认使用 taskSelectedSeriesList
     */
    resolveSelectedSatSeriesForTaskOptions(options?: string[]) {
      /** 调用方传入的系列优先，否则用任务已装配系列 */
      const list = options ?? this.taskSelectedSeriesList
      if (!list.length) {
        if (this.selectedSatSeries) {
          this.setSelectedSatSeries('')
        }
        return
      }
      if (!this.selectedSatSeries || !list.includes(this.selectedSatSeries)) {
        this.setSelectedSatSeries(list[0])
      }
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
      /** 内存进度快照优先，否则用任务上自带的算法进度 */
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
      /** 当前任务；没有 ID 或算法未完成时清空分析缓存 */
      const task = this.activeTask
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
        /** 任务矩阵分析结果；非 200 或没有 data 时清空缓存并提示 */
        const res = await getTaskMatrix({ taskId: String(taskId) })
        if (res.code === 200 && res.data) {
          this.taskAnalysisData = res.data
          this.taskAnalysisTaskId = taskId
          return res.data
        }
        this.clearTaskAnalysisData()
        const { ElMessage } = await import('element-plus')
        ElMessage.error(
          res.msg || `获取任务算法分析结果失败（taskId=${taskId}，code=${res.code ?? '未知'}）`,
        )
        return null
      } catch (err) {
        console.error('获取任务算法分析结果失败:', err)
        this.clearTaskAnalysisData()
        const { ElMessage } = await import('element-plus')
        ElMessage.error('获取任务算法分析结果请求异常，请检查网络或 getTaskMatrix 接口')
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
      /** 显式任务优先，否则用当前激活任务；都没有时返回空键 */
      const id = taskId ?? this.activeTask?.id ?? 0
      if (!id) return ''
      /** 当前激活用途，系列变化和用途变化都要让缓存失效 */
      const usage = this.activeZhchUsageType
      if (this.selectedSatSeries) return `${id}::${usage}::series::${this.selectedSatSeries}`
      return `${id}::${usage}::all`
    },
    /**
     * 开始一次矩阵拉取，返回用于校验响应是否仍有效的上下文
     */
    beginMatrixFetch(): {
      /** 本次请求代际，返回时用于丢弃过期响应 */
      token: number
      /** 任务、用途和系列组成的范围键 */
      scopeKey: string
      /** 写入缓存时使用的查询键 */
      queryKey: string
      /** 发起请求时的任务 ID */
      taskId: number
    } {
      /** 发起请求时的任务；没有任务时 ID 为 0 */
      const taskId = this.activeTask?.id ?? 0
      /** 自增后的请求代际 */
      const token = ++this.matrixFetchToken
      /** 当前范围键，供调用方校验响应是否仍匹配 */
      const scopeKey = this.buildMatrixScopeKey(taskId)
      /** 激活用途类型 */
      const usageType = this.activeZhchUsageType
      /** 有系列时按系列缓存，否则标记为全部系列 */
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
      /** 当前任务；没有任务时清空矩阵 */
      const taskId = this.activeTask?.id ?? 0
      if (!taskId) {
        this.clearMatrixData()
        return null
      }

      /** 当前分析系列；未选系列时不发请求，保留已有矩阵 */
      const series = this.selectedSatSeries
      if (!series) {
        return this.matrixData
      }

      /** 任务、用途和系列组成的缓存键 */
      const usageType = this.activeZhchUsageType
      const queryKey = `${taskId}_${usageType}_${series}`

      if (!force && this.matrixQueryKey === queryKey && this.matrixData) {
        return this.matrixData
      }

      /** 进行中的请求键；相同键复用同一个 Promise */
      const inflightKey = queryKey
      if (matrixScopeInflight && matrixScopeInflightKey === inflightKey) {
        return matrixScopeInflight
      }

      matrixScopeInflightKey = inflightKey
      matrixScopeInflight = (async () => {
        try {
          /** 本次请求代际和查询键；系列在等待期间被换掉后不再写入 */
          const { token, scopeKey, queryKey: activeQueryKey, taskId: activeTaskId } = this.beginMatrixFetch()
          try {
            if (!this.isMatrixFetchCurrent(token)) {
              return this.matrixData
            }

            /** 侦察/打击矩阵响应；非 200 不覆盖已有矩阵 */
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
        this.taskSelectedSeriesList.length &&
        !this.taskSelectedSeriesList.includes(this.selectedSatSeries)
      ) {
        this.setSelectedSatSeries('')
        this.resolveSelectedSatSeriesForTaskOptions()
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
      /** 待聚焦 NORAD，读出后立即清空，避免页面重复飞相机 */
      const norad = this.topoFocusNorad
      this.topoFocusNorad = null
      return norad
    },
    /**
     * 过滤掉旧版用途类型（如「军用」），仅保留当前 UI 支持的选项
     */
    sanitizeZhchUsageTypes() {
      /** 当前 UI 仍支持的用途类型 */
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
      /** 已选项下标；存在则取消，且至少保留一项 */
      const idx = this.selectedZhchUsageTypes.indexOf(type)
      if (idx >= 0) {
        if (this.selectedZhchUsageTypes.length <= 1) return
        this.selectedZhchUsageTypes.splice(idx, 1)
      } else {
        this.selectedZhchUsageTypes.push(type)
      }
    },
    /**
     * 切换生成打击方案的卫星系统类型（侦察 / 通信，单选或不选）。
     *
     * @param type 侦察或通信
     */
    toggleZhchSysType(type: string) {
      if (!isZhchSysTypeOption(type)) return
      this.selectedZhchSysType = this.selectedZhchSysType === type ? null : type
    },
    /**
     * 清空综合打击方案缓存
     */
    clearZhchPlans() {
      this.zhchPlanMap = {}
      this.zhchPlanTaskId = null
      this.zhchPlanFetchSysType = null
      this.clearMatrixData()
    },
    /**
     * 手动生成并缓存指定用途类型的综合打击方案（仅打击方案页触发，不自动预查）。
     * @param types 用途类型列表
     * @param force 是否强制重新请求
     */
    async fetchZhchPlans(types?: string[], force = false): Promise<boolean> {
      /** 当前任务；没有任务时清空方案缓存 */
      const taskId = this.activeTask?.id
      if (!taskId) {
        this.clearZhchPlans()
        return false
      }

      /** 显式用途优先，否则用当前多选 */
      const targetTypes = types?.length ? types : [...this.selectedZhchUsageTypes]
      if (!targetTypes.length) return false

      this.sanitizeZhchUsageTypes()
      /** 去掉 UI 不支持的旧用途类型 */
      const validTypes = targetTypes.filter((t) => (ZHCH_USAGE_TYPE_OPTIONS as readonly string[]).includes(t))
      if (!validTypes.length) return false

      if (this.zhchPlanTaskId !== taskId) {
        this.clearZhchPlans()
      }

      /** 本次请求的卫星系统类型；与上次不同则整表重拉 */
      const sysType = this.selectedZhchSysType
      if (this.zhchPlanFetchSysType !== (sysType ?? null)) {
        this.zhchPlanMap = {}
        this.zhchPlanFetchSysType = sysType ?? null
        force = true
      }

      this.zhchPlanLoading = true
      try {
        /** 各用途的方案结果；已缓存且非强制时直接复用 */
        const results = await Promise.all(
          validTypes.map(async (type) => {
            if (!force && this.zhchPlanMap[type]) {
              return { type, data: this.zhchPlanMap[type] }
            }
            /** 该用途的综合打击方案响应 */
            const res = await getSatelliteThreatInfoByType({
              type,
              taskId,
              sysType: sysType ?? null,
            })
            if (res.code !== 200) {
              const { ElMessage } = await import('element-plus')
              ElMessage.error(
                res.msg || `获取「${getZhchUsageTypeLabel(type)}」综合打击方案失败（code=${res.code}）`,
              )
              return { type, data: null }
            }
            if (!res.data) {
              const { ElMessage } = await import('element-plus')
              ElMessage.warning(`「${getZhchUsageTypeLabel(type)}」综合打击方案接口返回空数据`)
            }
            return { type, data: res.data ?? null }
          })
        )

        /** 是否至少写入了一份方案 */
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
  /** 刷新后仍保留任务、战场、系列和激活用途，其余状态按默认值重建 */
  persist: {
    storage: localStorage,
    pick: [
      'activeTask',
      'battle',
      'showBattleList',
      'taskSatellites',
      'satelliteTotal',
      'selectedSatType',
      'selectedSatSeries',
      'activeZhchUsageType',
    ],
  },
})
