import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import * as Cesium from 'cesium'
import { isTaskProgressComplete, taskProgressMap } from '@/composables/useTaskProgressPolling'
import type { BattleForm } from '@/types/battle/battle'
import type { SatelliteData } from '@/types/dashboard'
import type { SatelliteDetail, SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import type { C2ResourceSatelliteRow } from '@/utils/buildC2ResourceCatalog'
import type { TaskForm } from '@/types/task/task'
import {
  normalizeTaskExpectationCases,
  resolveTaskCountryFieldFromEntity,
} from '@/utils/taskEntity'
import { collectTaskAreaGeoCoords } from '@/utils/taskAreaGeo'
interface State {
  isCollapse: boolean
  activedTask: TaskForm | null
  battle: BattleForm | null
  battleCircleMap: Map<number, { name: string; center: [number, number]; radiusKm: number }>
  currentCircleIdx: number
  battlePolygonMap: Map<number, { name: string; lonlats: { lon: number; lat: number }[] }>
  currentPolygonIdx: number
  selectedSatellite: SatelliteDetail | null

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

  /** 顶层功能 Tab 当前激活项 */
  mainActiveTab: string
  /** 整体态势 / 拓扑分析共享的当前分析卫星 NORAD */
  selectedAnalysisNorad: number | null
  /** 整体态势地图上是否显示我方武器图层 */
  showOurWeapons: boolean
  /** 右侧面板选中的我方武器（用于地图定位） */
  selectedOurWeapon: { id?: string; name: string; latitude: number; longitude: number; range?: number } | null
  /** C2 左侧面板扁卫星资源行 */
  c2ResourceSatelliteRows: C2ResourceSatelliteRow[]
  /** C2 资源树勾选 keys */
  c2TreeCheckedKeys: string[]
  /**
   * 三国全量卫星资源树 API 快照（`中国台湾` / `日本` / `美国`）。
   * 仅会话内存缓存，由面板按需拉取。
   */
  satelliteAssembleTreeRootsCache: SatelliteTreeCountryNode[]
  /** 卫星资源树缓存写入时间（ISO 字符串，便于诊断） */
  satelliteAssembleTreeCachedAt: string | null
}

export const useLayoutStore = defineStore('layout-store', {
  state: (): State => {
    return {
      isCollapse: false,
      activedTask: null,
      battle: null,
      battleCircleMap: new Map<number, { name: string; center: [number, number]; radiusKm: number }>(),
      battlePolygonMap: new Map<number, { name: string; lonlats: { lon: number; lat: number }[] }>(),
      currentCircleIdx: 0,
      currentPolygonIdx: 0,
      selectedSatellite: null,
      selectedSatType: '',
      selectedSatSeries: '',

      allSatelliteOfTask: [],
      effectModel: true,
      showNetView: false,
      battleCenterCartensian: null,
      battleCenterOritentation: null,
      satelliteTotal: 0,

      mainActiveTab: '整体态势分析',
      selectedAnalysisNorad: null,
      showOurWeapons: true,
      selectedOurWeapon: null,
      c2ResourceSatelliteRows: [],
      c2TreeCheckedKeys: [],
      satelliteAssembleTreeRootsCache: [],
      satelliteAssembleTreeCachedAt: null,
    }
  },
  getters: {
    /**
     * 从当前任务 `TaskForm.areas` 计算区域边界包围盒。
     * 返回经纬度极值与全部顶点；无启用区域时返回 null。
     */
    taskAreaBounds(state): {
      min_lat: number
      max_lat: number
      min_lng: number
      max_lng: number
      lonlats: { lon: number; lat: number }[]
    } | null {
      const lonlats = collectTaskAreaGeoCoords(state.activedTask?.areas)
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
    },
  },
  actions: {
    toggleCollapse(isCollapse: boolean) {
      this.isCollapse = isCollapse
    },
    setActivedTask(activedTask: TaskForm | null) {
      if (!activedTask) {
        this.activedTask = null
        return
      }
      this.activedTask = {
        ...activedTask,
        country: resolveTaskCountryFieldFromEntity(activedTask),
        expectationCases: normalizeTaskExpectationCases(activedTask.expectationCases),
      }
    },
    setActivedBattle(battle: BattleForm | null) {
      this.battle = battle
    },

    toggleEffectModel(show: boolean) {
      this.effectModel = show
    },
    setSelectedSatellite(satellite: SatelliteDetail | null) {
      this.selectedSatellite = satellite
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
     * 判断指定任务的算法进度是否已全部完成。
     * @param task 任务对象
     */
    isTaskAlgorithmComplete(task?: TaskForm | null): boolean {
      if (!task?.id) return false
      const progress = taskProgressMap[task.id]
      return isTaskProgressComplete(progress as Parameters<typeof isTaskProgressComplete>[0])
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
    /** 更新 C2 资源扁平行 */
    setC2ResourceSatelliteRows(rows: C2ResourceSatelliteRow[]) {
      this.c2ResourceSatelliteRows = rows
    },
    /** 更新 C2 资源树勾选 */
    setC2TreeCheckedKeys(keys: string[]) {
      this.c2TreeCheckedKeys = [...keys]
    },
    /** 清空 C2 资源选择状态 */
    clearC2ResourceSelection() {
      this.c2ResourceSatelliteRows = []
      this.c2TreeCheckedKeys = []
    },
    /**
     * 写入三国卫星资源树缓存。
     *
     * @param roots `GET /resource/satellite/tree` 国家根列表
     */
    setSatelliteAssembleTreeRootsCache(roots: SatelliteTreeCountryNode[]) {
      /** 大树不做深度响应式，减轻主线程与交互卡顿 */
      this.satelliteAssembleTreeRootsCache = markRaw(roots) as SatelliteTreeCountryNode[]
      this.satelliteAssembleTreeCachedAt = new Date().toISOString()
    },
    /** 清空卫星资源树缓存（需强制与后台对齐时调用） */
    clearSatelliteAssembleTreeRootsCache() {
      this.satelliteAssembleTreeRootsCache = []
      this.satelliteAssembleTreeCachedAt = null
    },
  },
  persist: {
    key: 'layout-store-v3',
    storage: localStorage,
    pick: [
      'activedTask',
      'battle',
      'allSatelliteOfTask',
      'satelliteTotal',
      'selectedSatType',
      'selectedSatSeries',
    ],
  },
})
