import type { SatelliteAssembleTreeNode } from '@/types/satellite/satellite'
import type { SatelliteResource } from '@/types/satellite/satellite'
import type { TaskResourceItem } from '@/types/task/task'
import { isResourceApiSuccess } from '@/utils/resourceApi'
import {
  buildTaskSatelliteMatchKeys,
  type AssembleSeriesCheckStateEntry,
} from '@/utils/satelliteResourceTree'
import { getSeriesTaskSatellitesFromPanelTreeCache } from '@/utils/satelliteResourceTreeStoreCache'

/** 系列维度（国家 + 体系 + 系列），用于 search 与缓存键 */
export interface SatelliteSeriesScope {
  /** 国家 */
  country: string
  /** 体系 */
  system: string
  /** 系列 */
  series: string
}

/** 系列勾选相对任务已选卫星的状态 */
export type SeriesSatellitePickState = 'none' | 'partial' | 'all'

/** 任务卫星在资源树中的归属与列表展示字段 */
export interface TaskSatelliteTreeDisplayMeta extends SatelliteSeriesScope {
  /** 卫星展示名称 */
  name: string
  /** 代号或 NORAD */
  code: string
}

/** 缓存：系列 → 该系列下全部卫星挂载项 */
const seriesSatelliteCache = new Map<string, TaskResourceItem[]>()

/**
 * 生成系列作用域缓存键。
 *
 * @param scope 国家 / 体系 / 系列
 */
export const buildSeriesScopeCacheKey = (scope: SatelliteSeriesScope): string =>
  [scope.country, scope.system, scope.series].map((part) => part.trim()).join('::')

/**
 * 资源库卫星转为任务 `satellites` 挂载项。
 *
 * @param item 检索接口卫星
 */
export const mapSatelliteResourceToTaskResource = (item: SatelliteResource): TaskResourceItem => {
  const norad = String(item.noradId ?? '').trim()
  const resourceId = String(item.id ?? norad).trim()
  if (!resourceId) {
    throw new Error(`卫星资源缺少 id/NORAD：${JSON.stringify(item)}`)
  }
  const name = (item.nameCn ?? item.nameEn ?? resourceId).trim() || resourceId
  const code = (item.code?.trim() || norad || resourceId).trim() || resourceId
  const mapped: import('@/types/task/task').TaskResourceSatelliteItem = {
    resourceId,
    name,
    code,
    noradId: norad || code,
  }
  const country = item.country?.trim()
  if (country) mapped.country = country
  const satelliteType = item.system?.trim()
  if (satelliteType) mapped.satelliteType = satelliteType
  const series = item.series?.trim()
  if (series) mapped.series = series
  return mapped
}

/**
 * 从装配树节点解析系列作用域。
 *
 * @param node 系列或上级节点（仅 series 有效）
 */
export const resolveSeriesScopeFromAssembleNode = (
  node: SatelliteAssembleTreeNode,
): SatelliteSeriesScope | null => {
  if (node.nodeType !== 'series') return null
  const country = node.country?.trim()
  const system = node.system?.trim()
  const series = node.series?.trim() || node.label?.trim()
  if (!country || !system || !series) return null
  return { country, system, series }
}

/**
 * 遍历装配树，收集全部系列节点。
 *
 * @param nodes 树根
 */
export const collectSeriesNodesFromAssembleTree = (
  nodes: SatelliteAssembleTreeNode[],
): SatelliteAssembleTreeNode[] => {
  const list: SatelliteAssembleTreeNode[] = []
  const walk = (children: SatelliteAssembleTreeNode[]) => {
    for (const node of children) {
      if (node.nodeType === 'series') list.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return list
}

/**
 * 懒加载：用户勾选系列时调用 search 拉取该系列卫星（唯一允许的 search 入口）。
 *
 * @param scope 系列作用域
 */
export const fetchSeriesTaskSatellites = async (scope: SatelliteSeriesScope): Promise<TaskResourceItem[]> => {
  const cacheKey = buildSeriesScopeCacheKey(scope)
  const cached = seriesSatelliteCache.get(cacheKey)
  if (cached) return cached.map((item) => ({ ...item }))

  const { searchSatelliteResources } = await import('@/api/satellite/satellite')
  const res = await searchSatelliteResources({
    country: scope.country,
    system: scope.system,
    series: scope.series,
  })
  if (!isResourceApiSuccess(res.code) || !Array.isArray(res.data)) {
    throw new Error(res.msg || `查询系列卫星失败：${scope.series}`)
  }
  const items = res.data.map((row) => mapSatelliteResourceToTaskResource(row))
  seriesSatelliteCache.set(cacheKey, items.map((item) => ({ ...item })))
  return items
}

/**
 * 清空系列卫星缓存（任务 / 国家 / 类型切换时调用）。
 */
export const clearSeriesSatelliteCache = (): void => {
  seriesSatelliteCache.clear()
}

/**
 * 判断任务卫星是否落在系列全量列表中（按 resourceId/code/name 匹配）。
 *
 * @param taskSatellite 任务挂载项
 * @param seriesSatellites 系列下全部卫星
 */
const taskSatelliteInSeriesList = (
  taskSatellite: TaskResourceItem,
  seriesSatellites: TaskResourceItem[],
): boolean => {
  const keys = buildTaskSatelliteMatchKeys([taskSatellite])
  if (!keys.size) return false
  return seriesSatellites.some((candidate) => {
    const candidateKeys = buildTaskSatelliteMatchKeys([candidate])
    return [...keys].some((key) => candidateKeys.has(key))
  })
}

/**
 * 解析系列清单缓存键为作用域（`country::system::series`）。
 *
 * @param scopeKey 缓存键
 */
const parseInventoryScopeKey = (scopeKey: string): SatelliteSeriesScope | null => {
  const parts = scopeKey.split('::')
  if (parts.length < 3) return null
  const country = parts[0]?.trim()
  const system = parts[1]?.trim()
  const series = parts.slice(2).join('::').trim()
  if (!country || !system || !series) return null
  return { country, system, series }
}

/**
 * 用 tree 快照清单反查任务卫星所属国家 / 体系 / 系列（回显列表与树勾选，不调用 search）。
 *
 * @param taskSatellites 任务已选卫星
 * @param inventory 系列 → 卫星清单（Worker 或 Store 树缓存）
 */
export const buildTaskSatelliteDisplayMetaFromInventory = (
  taskSatellites: TaskResourceItem[],
  inventory: Record<string, TaskResourceItem[]>,
): Map<string, TaskSatelliteTreeDisplayMeta> => {
  const meta = new Map<string, TaskSatelliteTreeDisplayMeta>()
  if (!taskSatellites.length) return meta

  for (const picked of taskSatellites) {
    const sat = picked as import('@/types/task/task').TaskResourceSatelliteItem
    const resourceId = picked.resourceId?.trim() ?? sat.noradId?.trim()
    if (!resourceId || meta.has(resourceId)) continue

    const country = sat.country?.trim()
    const system = sat.satelliteType?.trim()
    const series = sat.series?.trim()
    if (country && system && series) {
      meta.set(resourceId, {
        country,
        system,
        series,
        name: picked.name?.trim() || resourceId,
        code: picked.code?.trim() || sat.noradId?.trim() || resourceId,
      })
      continue
    }

    for (const [scopeKey, seriesSatellites] of Object.entries(inventory)) {
      const scope = parseInventoryScopeKey(scopeKey)
      if (!scope || !seriesSatellites.length) continue
      const hit = seriesSatellites.find((candidate) => taskSatelliteInSeriesList(picked, [candidate]))
      if (!hit) continue
      meta.set(resourceId, {
        ...scope,
        name: picked.name?.trim() || hit.name,
        code: picked.code?.trim() || hit.code,
      })
      break
    }
  }
  return meta
}

/**
 * 计算任务已选对某一系列的覆盖状态。
 *
 * @param taskSatellites 任务已选卫星
 * @param seriesSatellites 系列全部卫星
 */
export const resolveSeriesSatellitePickState = (
  taskSatellites: TaskResourceItem[],
  seriesSatellites: TaskResourceItem[],
): SeriesSatellitePickState => {
  if (!seriesSatellites.length) return 'none'
  const matched = seriesSatellites.filter((item) =>
    taskSatellites.some((picked) => taskSatelliteInSeriesList(picked, [item])),
  )
  if (!matched.length) return 'none'
  if (matched.length >= seriesSatellites.length) return 'all'
  return 'partial'
}

/**
 * 从任务已选卫星中移除某一系列下的卫星。
 *
 * @param taskSatellites 当前任务已选
 * @param seriesSatellites 系列全量
 */
export const removeSeriesSatellitesFromTaskList = (
  taskSatellites: TaskResourceItem[],
  seriesSatellites: TaskResourceItem[],
): TaskResourceItem[] => {
  if (!seriesSatellites.length) return taskSatellites.map((item) => ({ ...item }))
  return taskSatellites.filter(
    (picked) => !seriesSatellites.some((candidate) => taskSatelliteInSeriesList(picked, [candidate])),
  )
}

/**
 * 合并系列全量卫星进任务已选（去重）。
 *
 * @param taskSatellites 当前任务已选
 * @param seriesSatellites 系列全量
 */
export const mergeSeriesSatellitesIntoTaskList = (
  taskSatellites: TaskResourceItem[],
  seriesSatellites: TaskResourceItem[],
): TaskResourceItem[] => {
  const next = taskSatellites.map((item) => ({ ...item }))
  const existingKeys = new Set<string>()
  next.forEach((item) => buildTaskSatelliteMatchKeys([item]).forEach((key) => existingKeys.add(key)))
  for (const item of seriesSatellites) {
    const keys = buildTaskSatelliteMatchKeys([item])
    const exists = [...keys].some((key) => existingKeys.has(key))
    if (exists) continue
    next.push({ ...item })
    keys.forEach((key) => existingKeys.add(key))
  }
  return next
}

/** Element Plus 树节点（同步勾选状态用） */
interface ElTreeStoreNodeLike {
  /** 是否勾选 */
  checked: boolean
  /** 是否半选 */
  indeterminate: boolean
  /** 设置勾选 */
  setChecked: (value: boolean, deep: boolean) => void
  /** 向上更新父节点 */
  updateParent?: () => void
}

/** Element Plus 树实例（同步勾选状态用） */
interface ElTreeInstanceLike {
  /** 按 node-key 取节点 */
  getNode: (id: string) => ElTreeStoreNodeLike | undefined
}

/**
 * 根据 tree 缓存中的系列卫星清单计算勾选态（不调用 search）。
 *
 * @param seriesEntries 系列节点 id + 作用域
 * @param taskSatellites 任务已选卫星
 * @param seriesInventory 可选 Worker/API 快照；缺省读 Store 树缓存
 */
export const computeElTreeSeriesCheckStates = (
  seriesEntries: Array<{ id: string; scope: SatelliteSeriesScope }>,
  taskSatellites: TaskResourceItem[],
  seriesInventory?: Record<string, TaskResourceItem[]>,
): AssembleSeriesCheckStateEntry[] =>
  seriesEntries.map((entry) => {
    const scopeKey = buildSeriesScopeCacheKey(entry.scope)
    const seriesSatellites =
      seriesInventory?.[scopeKey] ?? getSeriesTaskSatellitesFromPanelTreeCache(entry.scope)
    const state = resolveSeriesSatellitePickState(taskSatellites, seriesSatellites)
    return { id: entry.id, state }
  })

/**
 * 按 tree 缓存清单回写系列叶子的勾选 / 半选（不调用 search）。
 *
 * @param tree ElTree
 * @param seriesEntries 系列节点 id + 作用域
 * @param taskSatellites 任务已选卫星
 * @param seriesInventory 可选快照
 */
export const syncElTreeSeriesChecksFromTaskSatellites = (
  tree: ElTreeInstanceLike,
  seriesEntries: Array<{ id: string; scope: SatelliteSeriesScope }>,
  taskSatellites: TaskResourceItem[],
  seriesInventory?: Record<string, TaskResourceItem[]>,
): void => {
  const states = computeElTreeSeriesCheckStates(seriesEntries, taskSatellites, seriesInventory)
  applyElTreeSeriesCheckStates(tree, states)
}

/**
 * 将 Worker 计算的系列勾选态写入 ElTree（不发起 search）。
 *
 * @param tree ElTree 实例
 * @param states Worker 勾选结果
 * @returns 已写入的系列 node id
 */
export const applyElTreeSeriesCheckStates = (
  tree: ElTreeInstanceLike,
  states: AssembleSeriesCheckStateEntry[],
): string[] => {
  const applied: string[] = []
  for (const entry of states) {
    const storeNode = tree.getNode(entry.id)
    if (!storeNode) continue
    if (entry.state === 'all') {
      storeNode.setChecked(true, false)
      storeNode.indeterminate = false
    } else if (entry.state === 'partial') {
      storeNode.setChecked(false, false)
      storeNode.indeterminate = true
    } else {
      storeNode.setChecked(false, false)
      storeNode.indeterminate = false
    }
    storeNode.updateParent?.()
    applied.push(entry.id)
  }
  return applied
}