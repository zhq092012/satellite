import { getSatelliteResourceTree } from '@/api/satellite/satellite'
import { TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import type { SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import { useLayoutStore } from '@/store/modules/layout'
import { isResourceApiSuccess } from '@/utils/resourceApi'
import {
  buildSatelliteSeriesScopeKey,
  filterSatelliteTreeRootsByCountries,
  getSeriesSatellitesFromApiTreeRoots,
} from '@/utils/satelliteResourceTree'
import type { TaskResourceItem } from '@/types/task/task'
import type { SatelliteSeriesScope } from '@/utils/taskSatelliteTreeBridge'

/** 由 Store 树派生的系列 → 卫星清单（随 `satelliteAssembleTreeCachedAt` 失效） */
let panelSeriesInventoryMemoAt: string | null = null
let panelSeriesInventoryMemo: Record<string, TaskResourceItem[]> = {}

/**
 * 清空系列清单派生缓存（树缓存更新后调用）。
 */
export const clearPanelSeriesInventoryMemo = (): void => {
  panelSeriesInventoryMemoAt = null
  panelSeriesInventoryMemo = {}
}

/**
 * 返回已构建的全量系列清单缓存；未构建时返回空对象，不在此处同步扫全树。
 */
export const getPanelSeriesSatelliteInventory = (): Record<string, TaskResourceItem[]> => {
  const store = useLayoutStore()
  if (!store.satelliteAssembleTreeRootsCache?.length) return {}
  if (panelSeriesInventoryMemoAt === store.satelliteAssembleTreeCachedAt) {
    return panelSeriesInventoryMemo
  }
  return {}
}

/**
 * 后台构建全量系列清单（任务装配等确需全量 inventory 时调用）。
 */
export const ensurePanelSeriesSatelliteInventoryBuilt = async (): Promise<Record<string, TaskResourceItem[]>> => {
  const store = useLayoutStore()
  if (!store.satelliteAssembleTreeRootsCache?.length) return {}
  if (panelSeriesInventoryMemoAt === store.satelliteAssembleTreeCachedAt) {
    return panelSeriesInventoryMemo
  }
  const { buildSatelliteAssembleTreeInBackground } = await import('@/utils/satelliteAssembleTreeWorkerClient')
  const result = await buildSatelliteAssembleTreeInBackground(store.satelliteAssembleTreeRootsCache, [], [])
  panelSeriesInventoryMemo = result.seriesInventory
  panelSeriesInventoryMemoAt = store.satelliteAssembleTreeCachedAt
  return panelSeriesInventoryMemo
}

/**
 * 读取某系列在 tree 缓存中的全部卫星（勾选态计算、取消勾选移除，均不走 search）。
 *
 * @param scope 国家 / 体系 / 系列
 */
export const getSeriesTaskSatellitesFromPanelTreeCache = (scope: SatelliteSeriesScope): TaskResourceItem[] => {
  const store = useLayoutStore()
  const roots = store.satelliteAssembleTreeRootsCache
  if (!roots?.length) return []
  const key = buildSatelliteSeriesScopeKey(scope.country, scope.system, scope.series)
  const memoList = getPanelSeriesSatelliteInventory()[key]
  if (memoList?.length) {
    return memoList.map((item) => ({ ...item }))
  }
  return getSeriesSatellitesFromApiTreeRoots(roots, scope.country, scope.system, scope.series)
}

/** 面板固定三国卫星树国家（与作战对象选项一致，缓存全量一次） */
export const PANEL_SATELLITE_TREE_COUNTRIES = [...TASK_ENEMY_COUNTRY_OPTIONS] as string[]

/** 拉取全量树并写入 Store 的 in-flight 去重 */
let panelTreeStoreFetchInflight: Promise<void> | null = null

/**
 * 从 Store 读取或拉取三国全量卫星资源树；按需过滤国家子集。
 * 全量树缓存在 layout Store（会话内存），进入面板时按需请求。
 *
 * @param filterCountries 任务作战对象子集；空则返回三国全量
 * @param options.forceRefresh 为 true 时忽略缓存并重新请求后台
 */
export const loadSatelliteResourceTreeRootsForPanel = async (
  filterCountries?: string[],
  options?: { forceRefresh?: boolean },
): Promise<SatelliteTreeCountryNode[]> => {
  const store = useLayoutStore()
  if (options?.forceRefresh) {
    store.clearSatelliteAssembleTreeRootsCache()
    clearPanelSeriesInventoryMemo()
  }

  if (!store.satelliteAssembleTreeRootsCache?.length) {
    if (!panelTreeStoreFetchInflight) {
      panelTreeStoreFetchInflight = (async () => {
        const res = await getSatelliteResourceTree(PANEL_SATELLITE_TREE_COUNTRIES)
        if (!isResourceApiSuccess(res.code) || !Array.isArray(res.data)) {
          throw new Error(res.msg || '加载卫星资源树失败')
        }
        store.setSatelliteAssembleTreeRootsCache(res.data)
        clearPanelSeriesInventoryMemo()
      })().finally(() => {
        panelTreeStoreFetchInflight = null
      })
    }
    await panelTreeStoreFetchInflight
  }

  const want = filterCountries?.map((item) => item.trim()).filter(Boolean).length
    ? filterCountries.map((item) => item.trim()).filter(Boolean)
    : PANEL_SATELLITE_TREE_COUNTRIES
  return filterSatelliteTreeRootsByCountries(store.satelliteAssembleTreeRootsCache, want)
}