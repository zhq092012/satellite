import type {
  SatelliteAssembleTreeNode,
  SatelliteTreeCountryNode,
  SatelliteTreeSatelliteLeaf,
  SatelliteTreeSystemNode,
} from '@/types/satellite/satellite'
import type { TaskResourceItem } from '@/types/task/task'

/** 卫星装配树叶子节点的业务上下文 */
export interface SatelliteTreeLeafContext {
  /** 国家 */
  country: string
  /** 体系 */
  system: string
  /** 系列 */
  series: string
}

/**
 * 将树叶子转为任务 `satellites` 挂载项。
 *
 * @param leaf 接口叶子
 * @param ctx 国家 / 体系 / 系列
 */
export const mapTreeLeafToTaskResource = (
  leaf: SatelliteTreeSatelliteLeaf,
  ctx: SatelliteTreeLeafContext,
): TaskResourceItem => {
  const norad = String(leaf.noradId ?? leaf.norad ?? '').trim()
  const resourceId = String(leaf.resourceId ?? leaf.id ?? norad).trim()
  if (!resourceId) {
    throw new Error(`卫星树叶子缺少 resourceId/NORAD：${JSON.stringify(leaf)}`)
  }
  const name = leaf.name?.trim() || resourceId
  const code = (leaf.code?.trim() || leaf.norad || norad || ctx.series).trim()
  return { resourceId, name, code }
}

const buildNodeId = (
  nodeType: SatelliteAssembleTreeNode['nodeType'],
  parts: string[],
): string => [nodeType, ...parts].join('::')

/**
 * 将卫星资源树 API 数据转为装配页 `el-tree` 节点（仅到系列层，不含卫星叶子）。
 *
 * @param roots 国家根节点列表
 * @param allowedSystems 允许的体系（如任务勾选的侦察/通信）；空则不过滤
 */
export const buildSatelliteAssembleTreeNodesToSeries = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): SatelliteAssembleTreeNode[] => {
  const allow = new Set(allowedSystems.map((item) => item.trim()).filter(Boolean))
  const filterSystem = allow.size > 0

  return roots
    .map((countryNode) => {
      const country = countryNode.country?.trim() || '未知国家'
      const systemChildren: SatelliteAssembleTreeNode[] = []

      for (const systemNode of countryNode.systems ?? []) {
        const system = systemNode.system?.trim() || '--'
        if (filterSystem && !allow.has(system)) continue

        const seriesChildren: SatelliteAssembleTreeNode[] = []
        for (const seriesNode of systemNode.series ?? []) {
          const series = seriesNode.series?.trim()
          if (!series) continue

          seriesChildren.push({
            id: buildNodeId('series', [country, system, series]),
            label: series,
            nodeType: 'series',
            country,
            system,
            series,
          })
        }

        if (!seriesChildren.length) continue
        systemChildren.push({
          id: buildNodeId('system', [country, system]),
          label: system,
          nodeType: 'system',
          country,
          system,
          children: seriesChildren,
        })
      }

      if (!systemChildren.length) return null
      return {
        id: buildNodeId('country', [country]),
        label: country,
        nodeType: 'country',
        country,
        children: systemChildren,
      }
    })
    .filter(Boolean) as SatelliteAssembleTreeNode[]
}

/**
 * 按国家列表过滤 `GET /resource/satellite/tree` 返回的国家根节点。
 *
 * @param roots 全量树根
 * @param countries 需要保留的国家
 */
export const filterSatelliteTreeRootsByCountries = (
  roots: SatelliteTreeCountryNode[],
  countries: string[],
): SatelliteTreeCountryNode[] => {
  const allowed = new Set(countries.map((item) => item.trim()).filter(Boolean))
  if (!allowed.size) return []
  return roots.filter((node) => {
    const country = node.country?.trim()
    return Boolean(country && allowed.has(country))
  })
}

/** 系列勾选状态（Worker 计算后回传主线程） */
export type AssembleSeriesCheckState = 'none' | 'partial' | 'all'

/** 系列节点描述（用于 Worker 勾选计算） */
export interface AssembleSeriesNodeDescriptor {
  /** 系列 tree 节点 id */
  id: string
  /** 国家 */
  country: string
  /** 体系 */
  system: string
  /** 系列名 */
  series: string
}

/** Worker 返回的系列勾选条目 */
export interface AssembleSeriesCheckStateEntry {
  /** 系列 tree 节点 id */
  id: string
  /** 勾选状态 */
  state: AssembleSeriesCheckState
}

/**
 * 生成系列作用域键（与 taskSatelliteTreeBridge 一致）。
 */
export const buildSatelliteSeriesScopeKey = (country: string, system: string, series: string): string =>
  [country, system, series].map((part) => part.trim()).join('::')

/**
 * 从 API 原始树提取各系列卫星清单（仅用于勾选态计算，不在 UI 展示叶子）。
 *
 * @param roots 接口返回国家根
 * @param allowedSystems 允许的体系
 */
export const buildSeriesSatelliteInventoryFromApiRoots = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): Record<string, TaskResourceItem[]> => {
  const allow = new Set(allowedSystems.map((item) => item.trim()).filter(Boolean))
  const filterSystem = allow.size > 0
  const inventory: Record<string, TaskResourceItem[]> = {}

  for (const countryNode of roots) {
    const country = countryNode.country?.trim() || '未知国家'
    for (const systemNode of countryNode.systems ?? []) {
      const system = systemNode.system?.trim() || '--'
      if (filterSystem && !allow.has(system)) continue
      for (const seriesNode of systemNode.series ?? []) {
        const series = seriesNode.series?.trim()
        if (!series) continue
        const scopeKey = buildSatelliteSeriesScopeKey(country, system, series)
        const items: TaskResourceItem[] = []
        for (const leaf of seriesNode.satellites ?? []) {
          try {
            items.push(mapTreeLeafToTaskResource(leaf, { country, system, series }))
          } catch {
            // 跳过无效叶子
          }
        }
        inventory[scopeKey] = items
      }
    }
  }
  return inventory
}

/**
 * 从 API 树读取单个系列下的卫星清单（不全量展开三国树）。
 *
 * @param roots 接口国家根
 * @param country 国家
 * @param system 体系
 * @param series 系列
 */
export const getSeriesSatellitesFromApiTreeRoots = (
  roots: SatelliteTreeCountryNode[],
  country: string,
  system: string,
  series: string,
): TaskResourceItem[] => {
  const wantCountry = country.trim()
  const wantSystem = system.trim()
  const wantSeries = series.trim()
  if (!wantCountry || !wantSystem || !wantSeries) return []

  for (const countryNode of roots) {
    const nodeCountry = countryNode.country?.trim() || ''
    if (nodeCountry !== wantCountry) continue
    for (const systemNode of countryNode.systems ?? []) {
      const nodeSystem = systemNode.system?.trim() || ''
      if (nodeSystem !== wantSystem) continue
      for (const seriesNode of systemNode.series ?? []) {
        const nodeSeries = seriesNode.series?.trim() || ''
        if (nodeSeries !== wantSeries) continue
        const items: TaskResourceItem[] = []
        for (const leaf of seriesNode.satellites ?? []) {
          try {
            items.push(mapTreeLeafToTaskResource(leaf, {
              country: nodeCountry,
              system: nodeSystem,
              series: nodeSeries,
            }))
          } catch {
            // 跳过无效叶子
          }
        }
        return items
      }
    }
  }
  return []
}

/**
 * 仅为任务已选卫星所在系列构建清单（用于回显，避免全树 inventory 阻塞主线程）。
 *
 * @param roots API 国家根
 * @param taskSatellites 任务已选卫星
 */
export const buildTaskScopedInventoryFromApiTreeRoots = (
  roots: SatelliteTreeCountryNode[],
  taskSatellites: TaskResourceItem[],
): Record<string, TaskResourceItem[]> => {
  const inventory: Record<string, TaskResourceItem[]> = {}
  if (!roots.length || !taskSatellites.length) return inventory

  for (const countryNode of roots) {
    const country = countryNode.country?.trim() || '未知国家'
    for (const systemNode of countryNode.systems ?? []) {
      const system = systemNode.system?.trim() || '--'
      for (const seriesNode of systemNode.series ?? []) {
        const series = seriesNode.series?.trim()
        if (!series) continue
        const scopeKey = buildSatelliteSeriesScopeKey(country, system, series)
        const items: TaskResourceItem[] = []
        for (const leaf of seriesNode.satellites ?? []) {
          try {
            items.push(mapTreeLeafToTaskResource(leaf, { country, system, series }))
          } catch {
            // 跳过无效叶子
          }
        }
        if (!items.length) continue
        const matched = items.some((candidate) =>
          taskSatellites.some((picked) => {
            const left = buildTaskSatelliteMatchKeys([picked])
            const right = buildTaskSatelliteMatchKeys([candidate])
            return [...left].some((key) => right.has(key))
          }),
        )
        if (matched) {
          inventory[scopeKey] = items
        }
      }
    }
  }
  return inventory
}

/**
 * 收集装配树中的系列节点描述。
 *
 * @param nodes 系列树（仅到系列层）
 */
export const collectSeriesDescriptorsFromAssembleNodes = (
  nodes: SatelliteAssembleTreeNode[],
): AssembleSeriesNodeDescriptor[] => {
  const list: AssembleSeriesNodeDescriptor[] = []
  const walk = (children: SatelliteAssembleTreeNode[]) => {
    for (const node of children) {
      if (node.nodeType === 'series') {
        const country = node.country?.trim()
        const system = node.system?.trim()
        const series = node.series?.trim() || node.label?.trim()
        if (country && system && series) {
          list.push({ id: node.id, country, system, series })
        }
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return list
}

const taskSatelliteMatchesCandidate = (
  taskSatellite: TaskResourceItem,
  candidate: TaskResourceItem,
): boolean => {
  const left = buildTaskSatelliteMatchKeys([taskSatellite])
  const right = buildTaskSatelliteMatchKeys([candidate])
  return [...left].some((key) => right.has(key))
}

/**
 * 根据任务已选卫星与系列清单计算各系列勾选态（Worker / 主线程均可）。
 *
 * @param seriesNodes 系列描述
 * @param taskSatellites 任务已选
 * @param inventory 系列 → 卫星清单
 */
export const computeAssembleSeriesCheckStates = (
  seriesNodes: AssembleSeriesNodeDescriptor[],
  taskSatellites: TaskResourceItem[],
  inventory: Record<string, TaskResourceItem[]>,
): AssembleSeriesCheckStateEntry[] =>
  seriesNodes.map((entry) => {
    const scopeKey = buildSatelliteSeriesScopeKey(entry.country, entry.system, entry.series)
    const seriesSatellites = inventory[scopeKey] ?? []
    if (!seriesSatellites.length || !taskSatellites.length) {
      return { id: entry.id, state: 'none' as const }
    }
    const matched = seriesSatellites.filter((item) =>
      taskSatellites.some((picked) => taskSatelliteMatchesCandidate(picked, item)),
    )
    if (!matched.length) return { id: entry.id, state: 'none' as const }
    if (matched.length >= seriesSatellites.length) return { id: entry.id, state: 'all' as const }
    return { id: entry.id, state: 'partial' as const }
  })

/**
 * 将卫星资源树 API 数据转为装配页 `el-tree` 节点（含卫星叶子，仅供裁剪树等旧路径）。
 *
 * @param roots 国家根节点列表
 * @param allowedSystems 允许的体系（如任务勾选的侦察/通信）；空则不过滤
 */
export const buildSatelliteAssembleTreeNodes = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): SatelliteAssembleTreeNode[] => {
  const allow = new Set(allowedSystems.map((item) => item.trim()).filter(Boolean))
  const filterSystem = allow.size > 0

  return roots
    .map((countryNode) => {
      const country = countryNode.country?.trim() || '未知国家'
      const systemChildren: SatelliteAssembleTreeNode[] = []

      for (const systemNode of countryNode.systems ?? []) {
        const system = systemNode.system?.trim() || '--'
        if (filterSystem && !allow.has(system)) continue

        const seriesChildren: SatelliteAssembleTreeNode[] = []
        for (const seriesNode of systemNode.series ?? []) {
          const series = seriesNode.series?.trim()
          if (!series) continue

          const satelliteChildren = (seriesNode.satellites ?? [])
            .map((leaf) => {
              try {
                const resource = mapTreeLeafToTaskResource(leaf, { country, system, series })
                return {
                  id: buildNodeId('satellite', [country, system, series, resource.resourceId]),
                  label: resource.name,
                  nodeType: 'satellite' as const,
                  resource,
                  country,
                  system,
                  series,
                }
              } catch {
                return null
              }
            })
            .filter(Boolean) as SatelliteAssembleTreeNode[]

          if (!satelliteChildren.length) continue

          seriesChildren.push({
            id: buildNodeId('series', [country, system, series]),
            label: series,
            nodeType: 'series',
            country,
            system,
            series,
            children: satelliteChildren,
          })
        }

        if (!seriesChildren.length) continue
        systemChildren.push({
          id: buildNodeId('system', [country, system]),
          label: system,
          nodeType: 'system',
          country,
          system,
          children: seriesChildren,
        })
      }

      if (!systemChildren.length) return null
      return {
        id: buildNodeId('country', [country]),
        label: country,
        nodeType: 'country',
        country,
        children: systemChildren,
      }
    })
    .filter(Boolean) as SatelliteAssembleTreeNode[]
}

/**
 * 遍历树，按 resourceId 建立索引。
 *
 * @param nodes 树根
 */
/** 卫星树叶子在任务回显时附带的国家 / 体系 / 系列上下文 */
export interface SatelliteTreeResourceMeta {
  /** 任务挂载项 */
  resource: TaskResourceItem
  /** 国家 */
  country: string
  /** 体系（侦察 / 通信等） */
  system: string
  /** 系列名 */
  series: string
}

/**
 * 遍历树，按 resourceId 及别名建立索引。
 *
 * @param nodes 树根
 */
export const indexSatelliteTreeResources = (
  nodes: SatelliteAssembleTreeNode[],
): Map<string, SatelliteTreeResourceMeta> => {
  const map = new Map<string, SatelliteTreeResourceMeta>()

  const register = (key: string, meta: SatelliteTreeResourceMeta) => {
    const trimmed = key.trim()
    if (!trimmed || map.has(trimmed)) return
    map.set(trimmed, meta)
  }

  const walk = (list: SatelliteAssembleTreeNode[]) => {
    for (const node of list) {
      if (node.nodeType === 'satellite' && node.resource) {
        const meta: SatelliteTreeResourceMeta = {
          resource: node.resource,
          country: node.country ?? '',
          system: node.system ?? '',
          series: node.series ?? '',
        }
        register(node.resource.resourceId, meta)
        register(node.resource.code, meta)
        register(node.resource.name, meta)
        register(node.id, meta)
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return map
}

/**
 * 按任务挂载项在树索引中解析国家 / 体系 / 系列。
 *
 * @param index `indexSatelliteTreeResources` 结果
 * @param item 任务 `satellites` 元素
 */
export const resolveSatelliteTreeMetaForTaskResource = (
  index: Map<string, SatelliteTreeResourceMeta>,
  item: TaskResourceItem,
): SatelliteTreeResourceMeta | undefined => {
  const direct = index.get(item.resourceId?.trim() ?? '')
  if (direct) return direct

  const keys = buildTaskSatelliteMatchKeys([item])
  for (const [, meta] of index) {
    const candidateKeys = buildTaskSatelliteMatchKeys([meta.resource])
    if ([...keys].some((key) => candidateKeys.has(key))) return meta
  }
  return undefined
}

/**
 * 判断树卫星节点是否与任务挂载项对应（用于回显勾选）。
 *
 * @param node 树卫星叶子
 * @param item 任务挂载项
 */
export const satelliteTreeNodeMatchesTaskResource = (
  node: SatelliteAssembleTreeNode,
  item: TaskResourceItem,
): boolean => {
  if (node.nodeType !== 'satellite' || !node.resource) return false
  const left = buildTaskSatelliteMatchKeys([item])
  const right = buildTaskSatelliteMatchKeys([node.resource])
  return [...left].some((key) => right.has(key))
}

/**
 * 收集所有卫星叶子节点的 tree id。
 *
 * @param nodes 树根
 */
export const collectSatelliteTreeLeafIds = (nodes: SatelliteAssembleTreeNode[]): string[] => {
  const ids: string[] = []
  const walk = (list: SatelliteAssembleTreeNode[]) => {
    for (const node of list) {
      if (node.nodeType === 'satellite') ids.push(node.id)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return ids
}

/**
 * 任务挂载卫星的可匹配键集合（resourceId / code / name / NORAD）。
 *
 * @param items 任务 `satellites`
 */
export const buildTaskSatelliteMatchKeys = (items: TaskResourceItem[]): Set<string> => {
  const keys = new Set<string>()
  for (const item of items) {
    const resourceId = item.resourceId?.trim()
    const code = item.code?.trim()
    const name = item.name?.trim()
    const noradId = (item as import('@/types/task/task').TaskResourceSatelliteItem).noradId?.trim()
    if (resourceId) keys.add(resourceId)
    if (code) keys.add(code)
    if (name) keys.add(name)
    if (noradId) keys.add(noradId)
  }
  return keys
}

/**
 * 判断树叶子是否匹配任务挂载项之一。
 *
 * @param leaf API 卫星叶子
 * @param matchKeys 匹配键集合
 */
const satelliteLeafMatchesTaskKeys = (
  leaf: SatelliteTreeSatelliteLeaf,
  matchKeys: Set<string>,
): boolean => {
  if (!matchKeys.size) return false
  const candidates = [
    leaf.resourceId,
    leaf.id,
    leaf.code,
    leaf.name,
    leaf.norad,
    leaf.noradId,
  ]
    .map((item) => (item == null ? '' : String(item).trim()))
    .filter(Boolean)
  return candidates.some((key) => matchKeys.has(key))
}

/**
 * 按任务已选卫星裁剪资源树，仅保留仍挂载在任务中的卫星路径。
 *
 * @param roots 全量国家根节点
 * @param taskSatellites 任务 `satellites`
 */
export const pruneSatelliteResourceTreeByTaskSatellites = (
  roots: SatelliteTreeCountryNode[],
  taskSatellites: TaskResourceItem[],
): SatelliteTreeCountryNode[] => {
  const matchKeys = buildTaskSatelliteMatchKeys(taskSatellites)
  if (!matchKeys.size) return []

  const pruned: SatelliteTreeCountryNode[] = []
  for (const countryNode of roots) {
    const country = countryNode.country?.trim() || '未知国家'
    const systems: SatelliteTreeCountryNode['systems'] = []

    for (const systemNode of countryNode.systems ?? []) {
      const system = systemNode.system?.trim() || '--'
      const seriesList: SatelliteTreeSystemNode['series'] = []

      for (const seriesNode of systemNode.series ?? []) {
        const series = seriesNode.series?.trim()
        if (!series) continue
        const satellites = (seriesNode.satellites ?? []).filter((leaf) =>
          satelliteLeafMatchesTaskKeys(leaf, matchKeys),
        )
        if (!satellites.length) continue
        seriesList.push({ series, satellites })
      }

      if (!seriesList.length) continue
      systems.push({ system, series: seriesList })
    }

    if (!systems.length) continue
    pruned.push({ country, systems })
  }
  return pruned
}