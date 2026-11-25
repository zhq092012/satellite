
import { normalizeSatelliteUsageLabel, TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import type { BattleTaskResourceResp, TaskResourceItem, TaskResourceSatelliteItem } from '@/types/task/task'
import type {
  SatelliteAssembleTreeNode,
  SatelliteSeriesData,
  SatelliteTreeCountryNode,
  SatelliteTreeSatelliteLeaf,
} from '@/types/satellite/satellite'
import {
  buildSatelliteAssembleTreeNodesToSeries,
  type AssembleSeriesCheckStateEntry,
} from '@/utils/satelliteResourceTree'

/** C2 左侧面板资源树固定展示的国家/地区（与作战对象三项一致） */
export const C2_PANEL_TREE_COUNTRIES: readonly string[] = TASK_ENEMY_COUNTRY_OPTIONS

/** 左侧资源树节点层级 */
export type C2ResourceTreeNodeKind =
  /** 国家或地区 */
  | 'country'
  /** 任务系统类型，例如侦察、通信 */
  | 'sysType'
  /** 卫星用途，例如军用、民用 */
  | 'usage'
  /** 卫星系列。树展示到这一层，不展示 NORAD。 */
  | 'series'
  /** 资源树体系节点（国家 → 体系 → 系列 → 卫星） */
  | 'system'
  /** 资源树卫星叶子 */
  | 'satellite'

/**
 * C2 资源树节点（el-tree；系列预览模式到系列层；任务资源模式展示至卫星叶子）。
 */
export interface C2ResourceTreeNode {
  /** 节点唯一键 */
  id: string
  /** 展示标签 */
  label: string
  /** 节点层级类型 */
  kind: C2ResourceTreeNodeKind
  /** 系列名（仅 kind=series 时有值） */
  seriesName?: string
  /** 国家（系列节点 search 用） */
  country?: string
  /** 体系 / 任务系统类型（系列节点 search 用） */
  system?: string
  /** 资源主键（kind=satellite 时与任务 satellites.resourceId 对应） */
  resourceId?: string
  /** 子节点 */
  children?: C2ResourceTreeNode[]
}

/**
 * C2 扁卫星资源行（左表 / 右表过滤数据源）。
 */
export interface C2ResourceSatelliteRow {
  /** 行唯一键 */
  rowKey: string
  /** NORAD */
  norad: number
  /** 卫星名称 */
  name: string
  /** 国家/地区 */
  country: string
  /** 任务系统类型 */
  sysType: string
  /** 用途展示文案 */
  usage: string
  /** 系列名 */
  series: string
  /** 资源主键（任务资源树模式） */
  resourceId?: string
  /** catalog 卫星类型 / InitMatrix.satType */
  sat_type: string
  /** 国际编号；catalog 未接入时为 `--` */
  int_id: string
  /** 发射时间；catalog 未接入时为 `--` */
  launch_date: string
}

/** 扁平行缺失占位 */
export const C2_RESOURCE_EMPTY_FIELD = '--'

/** querySatBySeries 预览项（与 TaskAssembleTab 一致，不修改 API 类型） */
export interface C2SeriesPreviewSatellite {
  norad: number
  name_en?: string
  name_cn?: string | null
  series?: string
  sat_type?: string
  country?: string
}

/**
 * 构建扁平行唯一键。
 *
 * @param series 系列
 * @param sysType 系统类型
 * @param norad NORAD
 */
export function buildC2ResourceRowKey(series: string, sysType: string, norad: number): string {
  return `${series}|${sysType}|${norad}`
}

/**
 * 从 getSeries + querySatBySeries 预览数据拼装扁平行（算法未完成时）。
 *
 * @param previews 按系列拉取的卫星预览
 * @param sysTypeBySeries 系列 → 任务系统类型
 * @param defaultCountries 蓝方国家列表
 */
export function buildC2SatelliteFlatRowsFromSeriesFallback(
  previews: Array<{ series: string; sysType: string; satellites: C2SeriesPreviewSatellite[] }>,
  defaultCountries: string[],
): C2ResourceSatelliteRow[] {
  const fallbackCountry =
    defaultCountries.length === 1 ? defaultCountries[0] : C2_RESOURCE_EMPTY_FIELD
  const rows: C2ResourceSatelliteRow[] = []
  previews.forEach(({ series, sysType, satellites }) => {
    satellites.forEach((sat) => {
      if (!Number.isFinite(sat.norad)) return
      const country = sat.country?.trim() || fallbackCountry
      rows.push({
        rowKey: buildC2ResourceRowKey(series, sysType, sat.norad),
        norad: sat.norad,
        name: sat.name_en || sat.name_cn || String(sat.norad),
        country,
        sysType: sysType || '未分类',
        usage: C2_RESOURCE_EMPTY_FIELD,
        series,
        sat_type: sat.sat_type?.trim() || C2_RESOURCE_EMPTY_FIELD,
        int_id: C2_RESOURCE_EMPTY_FIELD,
        launch_date: C2_RESOURCE_EMPTY_FIELD,
      })
    })
  })
  return dedupeC2ResourceRows(rows)
}

/**
 * 扁平行业务去重键：优先 resourceId，其次 NORAD，最后回退 rowKey（骨架行等）。
 *
 * @param row C2 扁平行
 */
const c2SatelliteRowIdentityKey = (row: C2ResourceSatelliteRow): string => {
  const resourceId = row.resourceId?.trim()
  if (resourceId) return `id:${resourceId}`
  if (row.norad > 0) return `norad:${row.norad}`
  return `key:${row.rowKey}`
}

/**
 * 合并两条同一卫星的扁平行，保留元数据更完整的一行。
 *
 * @param primary 候选主行
 * @param secondary 另一行
 */
const mergeC2ResourceRowPair = (
  primary: C2ResourceSatelliteRow,
  secondary: C2ResourceSatelliteRow,
): C2ResourceSatelliteRow => {
  const richness = (row: C2ResourceSatelliteRow): number => {
    let score = 0
    if (row.norad > 0) score += 8
    if (row.resourceId?.trim()) score += 4
    if (row.series?.trim() && row.series !== C2_RESOURCE_EMPTY_FIELD) score += 2
    if (row.country?.trim() && row.country !== C2_RESOURCE_EMPTY_FIELD) score += 2
    if (row.usage?.trim() && row.usage !== C2_RESOURCE_EMPTY_FIELD) score += 1
    if (row.sat_type?.trim() && row.sat_type !== C2_RESOURCE_EMPTY_FIELD) score += 1
    return score
  }
  const richer = richness(secondary) > richness(primary) ? secondary : primary
  const other = richer === secondary ? primary : secondary
  return {
    ...richer,
    norad: richer.norad > 0 ? richer.norad : other.norad,
    resourceId: richer.resourceId?.trim() ? richer.resourceId : other.resourceId,
    name: richer.name?.trim() ? richer.name : other.name,
    country:
      richer.country?.trim() && richer.country !== C2_RESOURCE_EMPTY_FIELD
        ? richer.country
        : other.country,
    sysType: richer.sysType?.trim() ? richer.sysType : other.sysType,
    series:
      richer.series?.trim() && richer.series !== C2_RESOURCE_EMPTY_FIELD
        ? richer.series
        : other.series,
    usage:
      richer.usage?.trim() && richer.usage !== C2_RESOURCE_EMPTY_FIELD
        ? richer.usage
        : other.usage,
    sat_type:
      richer.sat_type?.trim() && richer.sat_type !== C2_RESOURCE_EMPTY_FIELD
        ? richer.sat_type
        : other.sat_type,
  }
}

/**
 * 去重扁平行（同一 resourceId / NORAD 仅保留一行，避免 `res|*` 与 `系列|类型|norad` 重复）。
 *
 * @param rows 原始行
 */
function dedupeC2ResourceRows(rows: C2ResourceSatelliteRow[]): C2ResourceSatelliteRow[] {
  const map = new Map<string, C2ResourceSatelliteRow>()
  rows.forEach((row) => {
    const identity = c2SatelliteRowIdentityKey(row)
    const prev = map.get(identity)
    map.set(identity, prev ? mergeC2ResourceRowPair(prev, row) : row)
  })
  return [...map.values()]
}

/**
 * 从 catalog 中取出当前任务挂载的卫星行（按 resourceId / NORAD 匹配，去重）。
 *
 * @param rows Store 中 C2 扁平行全集
 * @param taskSatellites 任务 `satellites` 挂载列表
 */
export function resolveTaskSatelliteRowsFromCatalog(
  rows: C2ResourceSatelliteRow[],
  taskSatellites: TaskResourceItem[] | undefined,
): C2ResourceSatelliteRow[] {
  const mounts = taskSatellites ?? []
  if (!mounts.length) return []

  const resourceIds = new Set<string>()
  const norads = new Set<number>()
  mounts.forEach((item) => {
    const rid = item.resourceId?.trim()
    if (rid) resourceIds.add(rid)
    const norad = Number(String(item.code ?? '').trim())
    if (Number.isFinite(norad) && norad > 0) norads.add(norad)
  })

  const matched = rows.filter((row) => {
    const rid = row.resourceId?.trim()
    if (rid && resourceIds.has(rid)) return true
    if (row.norad > 0 && norads.has(row.norad)) return true
    return false
  })

  if (matched.length) {
    return dedupeC2ResourceRows(matched)
  }

  return dedupeC2ResourceRows(
    mounts.map((item) =>
      mapTaskResourceItemToC2Row(item, {
        country: C2_RESOURCE_EMPTY_FIELD,
        system: C2_RESOURCE_EMPTY_FIELD,
        series: C2_RESOURCE_EMPTY_FIELD,
      }),
    ),
  )
}

/**
 * 由扁平行构建四级树（国家 → 系统类型 → 用途 → 系列）。
 *
 * @param rows 扁平行
 */
export function buildC2ResourceTreeNodes(rows: C2ResourceSatelliteRow[]): C2ResourceTreeNode[] {
  type CountryMap = Map<
    string,
    Map<string, Map<string, Set<string>>>
  >
  const root: CountryMap = new Map()
  rows.forEach((row) => {
    const country = row.country || C2_RESOURCE_EMPTY_FIELD
    const sysType = row.sysType || '未分类'
    const usage = row.usage || C2_RESOURCE_EMPTY_FIELD
    if (!root.has(country)) root.set(country, new Map())
    const sysMap = root.get(country)!
    if (!sysMap.has(sysType)) sysMap.set(sysType, new Map())
    const usageMap = sysMap.get(sysType)!
    if (!usageMap.has(usage)) usageMap.set(usage, new Set())
    usageMap.get(usage)!.add(row.series)
  })

  const countryNodes: C2ResourceTreeNode[] = []
  const sortedCountries = [...root.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  sortedCountries.forEach((country) => {
    const sysMap = root.get(country)!
    const sysTypeNodes: C2ResourceTreeNode[] = []
      ;[...sysMap.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN')).forEach((sysType) => {
        const usageMap = sysMap.get(sysType)!
        const usageNodes: C2ResourceTreeNode[] = []
          ;[...usageMap.keys()].sort((a, b) => a.localeCompare(b, 'zh-CN')).forEach((usage) => {
            const seriesSet = usageMap.get(usage)!
            const seriesNodes: C2ResourceTreeNode[] = [...seriesSet]
              .sort((a, b) => a.localeCompare(b, 'zh-CN'))
              .map((seriesName) => ({
                id: buildSeriesNodeId(country, sysType, usage, seriesName),
                label: seriesName,
                kind: 'series' as const,
                seriesName,
                country,
                system: sysType,
              }))
            usageNodes.push({
              id: `usage|${encodePart(country)}|${encodePart(sysType)}|${encodePart(usage)}`,
              label: usage,
              kind: 'usage',
              children: seriesNodes,
            })
          })
        sysTypeNodes.push({
          id: `sysType|${encodePart(country)}|${encodePart(sysType)}`,
          label: sysType,
          kind: 'sysType',
          children: usageNodes,
        })
      })
    countryNodes.push({
      id: `country|${encodePart(country)}`,
      label: country,
      kind: 'country',
      children: sysTypeNodes,
    })
  })
  return countryNodes
}

/**
 * 仅保留面板允许的国家/地区的扁平行。
 *
 * @param rows 原始扁平行
 */
export function filterC2ResourceRowsToPanelCountries(rows: C2ResourceSatelliteRow[]): C2ResourceSatelliteRow[] {
  const allowed = new Set<string>(C2_PANEL_TREE_COUNTRIES)
  return rows.filter((row) => allowed.has(row.country))
}

/**
 * 按作战对象点击顺序排列 C2 面板树国家根节点（仅排序，不增删国家）。
 *
 * @param priorityCountry 当前聚焦的国家；无效时保持 {@link C2_PANEL_TREE_COUNTRIES} 默认顺序
 */
export function orderC2PanelTreeCountries(priorityCountry: string | null | undefined): string[] {
  const base = [...C2_PANEL_TREE_COUNTRIES]
  if (!priorityCountry) return base
  const index = base.indexOf(priorityCountry)
  if (index <= 0) return base
  return [priorityCountry, ...base.filter((country) => country !== priorityCountry)]
}

/**
 * 构建 C2 左侧面板资源树：固定展示「中国台湾 / 日本 / 美国」三国根节点。
 *
 * @param rows 扁平行（会先按国家过滤）
 * @param priorityCountry 将该国根节点排在树最上方（仅改变顺序）
 */
export function buildC2ResourceTreeNodesForPanel(
  rows: C2ResourceSatelliteRow[],
  priorityCountry?: string | null,
): C2ResourceTreeNode[] {
  const filtered = filterC2ResourceRowsToPanelCountries(rows)
  const built = buildC2ResourceTreeNodes(filtered)
  const byLabel = new Map(built.map((node) => [node.label, node]))
  const countryOrder = orderC2PanelTreeCountries(priorityCountry ?? null)
  return countryOrder.map((country) => {
    const existing = byLabel.get(country)
    if (existing) return existing
    return {
      id: `country|${encodePart(country)}`,
      label: country,
      kind: 'country' as const,
      children: [],
    }
  })
}

/**
 * URL 安全编码树路径片段。
 *
 * @param part 路径段
 */
function encodePart(part: string): string {
  return encodeURIComponent(part)
}

/**
 * 构建系列节点 ID。
 */
export function buildSeriesNodeId(
  country: string,
  sysType: string,
  usage: string,
  seriesName: string,
): string {
  return `series|${encodePart(country)}|${encodePart(sysType)}|${encodePart(usage)}|${encodePart(seriesName)}`
}

/** C2 面板树国家节点 id（与装配页 `country::` 一致） */
export function buildC2PanelCountryNodeId(country: string): string {
  return `country::${country.trim()}`
}

/** C2 面板树体系节点 id */
export function buildC2PanelSystemNodeId(country: string, system: string): string {
  return `system::${country.trim()}::${system.trim()}`
}

/** C2 面板树系列节点 id */
export function buildC2PanelSeriesNodeId(country: string, system: string, series: string): string {
  return `series::${country.trim()}::${system.trim()}::${series.trim()}`
}

/**
 * 解析 `series::国家::体系::系列` 形式的节点 id。
 *
 * @param nodeId el-tree node-key
 */
export function parseC2PanelSeriesNodeId(
  nodeId: string,
): { country: string; system: string; series: string } | null {
  if (!nodeId.startsWith('series::')) return null
  const parts = nodeId.split('::')
  if (parts.length < 4) return null
  const country = parts[1]?.trim()
  const system = parts[2]?.trim()
  const series = parts.slice(3).join('::').trim()
  if (!country || !system || !series) return null
  return { country, system, series }
}

/**
 * 由 Worker / 树缓存计算的系列勾选态，生成右侧列表过滤用 node-key（含 country/system 父节点）。
 *
 * @param seriesStates 各系列节点勾选态
 * @param treeNodes C2 面板资源树根
 */
export function buildC2PanelFilterKeysFromSeriesCheckStates(
  seriesStates: AssembleSeriesCheckStateEntry[],
  treeNodes: C2ResourceTreeNode[],
): string[] {
  const stateById = new Map(seriesStates.map((item) => [item.id, item.state]))
  const keys = new Set<string>()
  const pushKey = (nodeId: string) => {
    const trimmed = nodeId.trim()
    if (trimmed) keys.add(trimmed)
  }
  for (const item of seriesStates) {
    if (item.state === 'none') continue
    pushKey(item.id)
    const node = findC2ResourceTreeNodeById(treeNodes, item.id)
    const country = node?.country?.trim()
    const system = node?.system?.trim()
    if (country) pushKey(buildC2PanelCountryNodeId(country))
    if (country && system) pushKey(buildC2PanelSystemNodeId(country, system))
  }
  const walk = (nodes: C2ResourceTreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'country' || node.kind === 'system') {
        const seriesIds = collectC2ResourceTreeSeriesIdsUnderNode(nodes, node.id)
        if (seriesIds.some((id) => (stateById.get(id) ?? 'none') !== 'none')) {
          pushKey(node.id)
        }
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(treeNodes)
  return [...keys]
}

/**
 * 从树勾选 keys 展开为应包含的系列名集合。
 *
 * @param checkedKeys el-tree 勾选 keys（含 country / system / series 面板 id）
 * @param rows 全量扁平行
 */
export function expandCheckedKeysToSeriesNames(
  checkedKeys: string[],
  rows: C2ResourceSatelliteRow[],
): Set<string> {
  const seriesNames = new Set<string>()
  const checked = new Set(checkedKeys)
  for (const key of checkedKeys) {
    const parsed = parseC2PanelSeriesNodeId(key)
    if (parsed) seriesNames.add(parsed.series)
  }
  rows.forEach((row) => {
    const seriesId = buildSeriesNodeId(row.country, row.sysType, row.usage, row.series)
    const countryId = `country|${encodePart(row.country)}`
    const sysTypeId = `sysType|${encodePart(row.country)}|${encodePart(row.sysType)}`
    const usageId = `usage|${encodePart(row.country)}|${encodePart(row.sysType)}|${encodePart(row.usage)}`
    const taskSeriesId = buildC2TaskSeriesNodeId(row.country, row.sysType, row.series)
    const taskSystemId = buildC2TaskSystemNodeId(row.country, row.sysType)
    const panelCountryId = buildC2PanelCountryNodeId(row.country)
    const panelSystemId = buildC2PanelSystemNodeId(row.country, row.sysType)
    const panelSeriesId = buildC2PanelSeriesNodeId(row.country, row.sysType, row.series)
    const taskSatelliteId = row.resourceId
      ? buildC2TaskSatelliteNodeId(row.country, row.sysType, row.series, row.resourceId)
      : ''
    if (
      checked.has(seriesId) ||
      checked.has(usageId) ||
      checked.has(sysTypeId) ||
      checked.has(countryId) ||
      checked.has(taskSeriesId) ||
      checked.has(taskSystemId) ||
      checked.has(panelCountryId) ||
      checked.has(panelSystemId) ||
      checked.has(panelSeriesId) ||
      (taskSatelliteId && checked.has(taskSatelliteId))
    ) {
      seriesNames.add(row.series)
    }
  })
  return seriesNames
}

/**
 * 按树勾选过滤扁平行（用于右侧列表）。
 *
 * @param rows 全量行
 * @param checkedKeys 勾选 keys；空数组时返回空列表
 */
/**
 * 收集 C2 树中的系列叶子节点。
 *
 * @param nodes 树根
 */
export function collectC2ResourceTreeSeriesNodes(nodes: C2ResourceTreeNode[]): C2ResourceTreeNode[] {
  const list: C2ResourceTreeNode[] = []
  const walk = (children: C2ResourceTreeNode[]) => {
    children.forEach((node) => {
      if (node.kind === 'series') list.push(node)
      if (node.children?.length) walk(node.children)
    })
  }
  walk(nodes)
  return list
}

/**
 * 在 C2 面板树数据中按 node id 查找节点。
 *
 * @param nodes 树根列表
 * @param nodeId el-tree node-key
 */
export function findC2ResourceTreeNodeById(
  nodes: C2ResourceTreeNode[],
  nodeId: string,
): C2ResourceTreeNode | undefined {
  let found: C2ResourceTreeNode | undefined
  const walk = (list: C2ResourceTreeNode[]) => {
    for (const node of list) {
      if (node.id === nodeId) {
        found = node
        return
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return found
}

/**
 * 收集某 country / system 节点下全部系列节点的 id。
 *
 * @param nodes 面板树根
 * @param nodeId 国家或体系节点 id
 */
export function collectC2ResourceTreeSeriesIdsUnderNode(nodes: C2ResourceTreeNode[], nodeId: string): string[] {
  const root = findC2ResourceTreeNodeById(nodes, nodeId)
  if (!root) return []
  return collectC2ResourceTreeSeriesNodes([root]).map((node) => node.id)
}

/**
 * 解析 C2 系列树节点的 search 作用域。
 *
 * @param node 系列节点
 */
export const resolveC2SeriesScopeFromNode = (
  node: C2ResourceTreeNode,
): { country: string; system: string; series: string } | null => {
  if (node.kind !== 'series') return null
  const country = node.country?.trim()
  const system = node.system?.trim()
  const series = node.seriesName?.trim() || node.label.trim()
  if (!country || !system || !series) return null
  return { country, system, series }
}

/**
 * 检索接口卫星转 C2 扁平行。
 *
 * @param item 检索结果
 * @param scope 国家 / 体系 / 系列
 */
/**
 * 任务挂载项转 C2 扁平行（search 懒加载勾选后，与 `mapSatelliteResourceToC2Row` 字段对齐的精简映射）。
 *
 * @param item 任务 `satellites` 项
 * @param scope 国家 / 体系 / 系列
 */
/**
 * 将 `GET /command-task/{id}/resources` 中的卫星项转为 C2 右侧面板扁平行（与地图同源）。
 *
 * @param item 任务资源接口卫星元素
 */
export function mapTaskResourceSatelliteItemToC2Row(item: TaskResourceSatelliteItem): C2ResourceSatelliteRow {
  const resourceId = String(item.resourceId ?? '').trim()
  const norad = Number(String(item.noradId ?? item.code ?? '').trim())
  const name = (item.name ?? item.code ?? resourceId).trim() || resourceId
  return {
    rowKey: resourceId ? `res|${resourceId}` : buildC2ResourceRowKey('--', '--', Number.isFinite(norad) ? norad : -1),
    norad: Number.isFinite(norad) && norad > 0 ? norad : -1,
    name,
    country: C2_RESOURCE_EMPTY_FIELD,
    sysType: C2_RESOURCE_EMPTY_FIELD,
    usage: C2_RESOURCE_EMPTY_FIELD,
    series: C2_RESOURCE_EMPTY_FIELD,
    resourceId,
    sat_type: C2_RESOURCE_EMPTY_FIELD,
    int_id: C2_RESOURCE_EMPTY_FIELD,
    launch_date: C2_RESOURCE_EMPTY_FIELD,
  }
}

/**
 * 由任务资源接口响应构建 C2 卫星表行（与地球渲染使用同一接口数据）。
 *
 * @param data `BattleTaskResourceResp`
 */
export function buildC2RowsFromTaskResources(data: BattleTaskResourceResp): C2ResourceSatelliteRow[] {
  const rows = (data.satellites ?? [])
    .map(mapTaskResourceSatelliteItemToC2Row)
    .filter((row) => row.norad > 0 || Boolean(row.resourceId?.trim()))
  return dedupeC2ResourceRows(rows)
}

export function mapTaskResourceItemToC2Row(
  item: TaskResourceItem,
  scope: { country: string; system: string; series: string },
): C2ResourceSatelliteRow {
  const resourceId = String(item.resourceId ?? '').trim()
  const norad = Number(String(item.code ?? '').trim())
  const name = (item.name ?? resourceId).trim() || resourceId
  return {
    rowKey: resourceId
      ? `res|${resourceId}`
      : buildC2ResourceRowKey(scope.series, scope.system, Number.isFinite(norad) ? norad : -1),
    norad: Number.isFinite(norad) ? norad : -1,
    name,
    country: scope.country,
    sysType: scope.system,
    usage: C2_RESOURCE_EMPTY_FIELD,
    series: scope.series,
    resourceId,
    sat_type: scope.system,
    int_id: C2_RESOURCE_EMPTY_FIELD,
    launch_date: C2_RESOURCE_EMPTY_FIELD,
  }
}

export function mapSatelliteResourceToC2Row(
  item: import('@/types/satellite/satellite').SatelliteResource,
  scope: { country: string; system: string; series: string },
): C2ResourceSatelliteRow {
  const noradRaw = String(item.noradId ?? '').trim()
  const norad = Number(noradRaw)
  const resourceId = String(item.id ?? noradRaw).trim() || noradRaw
  const name = (item.nameCn ?? item.nameEn ?? resourceId).trim() || resourceId
  return {
    rowKey: resourceId ? `res|${resourceId}` : buildC2ResourceRowKey(scope.series, scope.system, Number.isFinite(norad) ? norad : -1),
    norad: Number.isFinite(norad) ? norad : -1,
    name,
    country: scope.country,
    sysType: scope.system,
    usage: item.usage?.trim() || C2_RESOURCE_EMPTY_FIELD,
    series: scope.series,
    resourceId,
    sat_type: item.system?.trim() || scope.system,
    int_id: item.intlDesignator?.trim() || C2_RESOURCE_EMPTY_FIELD,
    launch_date: item.launchDate?.trim() || C2_RESOURCE_EMPTY_FIELD,
  }
}

/**
 * 合并已加载的 C2 卫星扁平行（按 `rowKey` 去重）。
 *
 * @param base 现有行
 * @param incoming 新加载行
 */
export function mergeC2ResourceSatelliteRows(
  base: C2ResourceSatelliteRow[],
  incoming: C2ResourceSatelliteRow[],
): C2ResourceSatelliteRow[] {
  return dedupeC2ResourceRows([...base, ...incoming])
}

export function filterC2SatellitesByTreeSelection(
  rows: C2ResourceSatelliteRow[],
  checkedKeys: string[],
): C2ResourceSatelliteRow[] {
  if (!checkedKeys.length) return []
  const loaded = rows.filter((row) => row.norad > 0 || Boolean(row.resourceId))
  const checked = new Set(checkedKeys)
  const seriesSet = expandCheckedKeysToSeriesNames(checkedKeys, rows)
  return loaded.filter((row) => {
    if (seriesSet.has(row.series)) return true
    if (!row.resourceId) return false
    const satNodeId = buildC2TaskSatelliteNodeId(row.country, row.sysType, row.series, row.resourceId)
    if (checked.has(satNodeId)) return true
    const seriesNodeId = buildC2TaskSeriesNodeId(row.country, row.sysType, row.series)
    const systemNodeId = buildC2TaskSystemNodeId(row.country, row.sysType)
    const countryNodeId = `country|${encodePart(row.country)}`
    const panelSeriesId = buildC2PanelSeriesNodeId(row.country, row.sysType, row.series)
    const panelSystemId = buildC2PanelSystemNodeId(row.country, row.sysType)
    const panelCountryId = buildC2PanelCountryNodeId(row.country)
    if (
      checked.has(seriesNodeId) ||
      checked.has(systemNodeId) ||
      checked.has(countryNodeId) ||
      checked.has(panelSeriesId) ||
      checked.has(panelSystemId) ||
      checked.has(panelCountryId)
    ) {
      return true
    }
    return false
  })
}

/**
 * 解析资源树叶子 NORAD。
 *
 * @param leaf API 卫星叶子
 */
const parseNoradFromTreeLeaf = (leaf: SatelliteTreeSatelliteLeaf): number | null => {
  const raw = leaf.noradId ?? leaf.norad ?? ''
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

/**
 * 由裁剪后的资源树生成 C2 扁平行。
 *
 * @param roots 裁剪后的国家根节点
 */
export function buildC2FlatRowsFromSatelliteResourceTree(
  roots: SatelliteTreeCountryNode[],
): C2ResourceSatelliteRow[] {
  const rows: C2ResourceSatelliteRow[] = []
  roots.forEach((countryNode) => {
    const country = countryNode.country?.trim() || C2_RESOURCE_EMPTY_FIELD
    countryNode.systems?.forEach((systemNode) => {
      const sysType = systemNode.system?.trim() || '未分类'
      systemNode.series?.forEach((seriesNode) => {
        const series = seriesNode.series?.trim() || C2_RESOURCE_EMPTY_FIELD
        seriesNode.satellites?.forEach((leaf) => {
          const norad = parseNoradFromTreeLeaf(leaf)
          if (norad == null) return
          const resourceId = String(leaf.resourceId ?? leaf.id ?? norad).trim()
          const name = leaf.name?.trim() || resourceId
          rows.push({
            rowKey: buildC2ResourceRowKey(series, sysType, norad),
            norad,
            name,
            country,
            sysType,
            usage: C2_RESOURCE_EMPTY_FIELD,
            series,
            resourceId,
            sat_type: C2_RESOURCE_EMPTY_FIELD,
            int_id: C2_RESOURCE_EMPTY_FIELD,
            launch_date: C2_RESOURCE_EMPTY_FIELD,
          })
        })
      })
    })
  })
  return dedupeC2ResourceRows(rows)
}

/** 任务资源树：体系节点 ID */
export function buildC2TaskSystemNodeId(country: string, system: string): string {
  return `task-system|${encodePart(country)}|${encodePart(system)}`
}

/** 任务资源树：系列节点 ID */
export function buildC2TaskSeriesNodeId(country: string, system: string, series: string): string {
  return `task-series|${encodePart(country)}|${encodePart(system)}|${encodePart(series)}`
}

/** 任务资源树：卫星叶子节点 ID */
export function buildC2TaskSatelliteNodeId(
  country: string,
  system: string,
  series: string,
  resourceId: string,
): string {
  return `task-satellite|${encodePart(country)}|${encodePart(system)}|${encodePart(series)}|${encodePart(resourceId)}`
}

/** 装配页树节点 → C2 左树节点（节点 id 与任务装配 el-tree 一致） */
const mapAssembleTreeNodeToC2ResourceTree = (node: SatelliteAssembleTreeNode): C2ResourceTreeNode => {
  const kindByNodeType: Record<
    Exclude<SatelliteAssembleTreeNode['nodeType'], 'satellite'>,
    Exclude<C2ResourceTreeNodeKind, 'satellite' | 'sysType' | 'usage'>
  > = {
    country: 'country',
    system: 'system',
    series: 'series',
  }
  const mapped: C2ResourceTreeNode = {
    id: node.id,
    label: node.label,
    kind: kindByNodeType[node.nodeType as keyof typeof kindByNodeType] ?? 'series',
  }
  if (node.country) mapped.country = node.country
  if (node.system) mapped.system = node.system
  if (node.series) mapped.seriesName = node.series
  if (node.children?.length) {
    mapped.children = node.children.map(mapAssembleTreeNodeToC2ResourceTree)
  }
  return mapped
}

/**
 * 由 Store / `GET /resource/satellite/tree` 根节点构建 C2 左树（国家 → 体系 → 系列）。
 * 与任务装配页共用 {@link buildSatelliteAssembleTreeNodesToSeries}，节点 id 一致。
 *
 * @param roots API 国家根列表（通常为三国全量缓存）
 * @param allowedSystems 任务系统类型过滤（侦察/通信等）；空则不过滤
 * @param priorityCountry 国家根排序优先项
 */
export function buildC2PanelResourceTreeFromApiRoots(
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
  priorityCountry?: string | null,
): C2ResourceTreeNode[] {
  const assembleRoots = buildSatelliteAssembleTreeNodesToSeries(roots, allowedSystems)
  const built = assembleRoots.map(mapAssembleTreeNodeToC2ResourceTree)
  const byLabel = new Map(built.map((node) => [node.label, node]))
  const countryOrder = orderC2PanelTreeCountries(priorityCountry ?? null)
  return countryOrder.map((country) => {
    const existing = byLabel.get(country)
    if (existing) return existing
    return {
      id: `country::${country}`,
      label: country,
      kind: 'country' as const,
      children: [],
    }
  })
}

/**
 * @deprecated 请使用 {@link buildC2PanelResourceTreeFromApiRoots}，与装配页树结构一致。
 */
export function buildC2ResourceTreeFromSatelliteResourceTree(
  roots: SatelliteTreeCountryNode[],
  priorityCountry?: string | null,
  allowedSystems: string[] = [],
): C2ResourceTreeNode[] {
  return buildC2PanelResourceTreeFromApiRoots(roots, allowedSystems, priorityCountry)
}

/**
 * 收集任务资源树全部卫星叶子节点 ID（用于回显勾选）。
 *
 * @param nodes 树根
 */
export function collectC2TaskSatelliteTreeLeafIds(nodes: C2ResourceTreeNode[]): string[] {
  const ids: string[] = []
  const walk = (list: C2ResourceTreeNode[]) => {
    list.forEach((node) => {
      if (node.kind === 'satellite') ids.push(node.id)
      if (node.children?.length) walk(node.children)
    })
  }
  walk(nodes)
  return ids
}

/**
 * 将系列名列表转为树 series 节点 keys（用于回显 editorDraft.selectedSeries）。
 *
 * @param selectedSeries 已选系列名
 * @param rows 扁平行
 */
export function seriesNamesToTreeCheckedKeys(
  selectedSeries: string[],
  rows: C2ResourceSatelliteRow[],
): string[] {
  const wanted = new Set(selectedSeries)
  const keys: string[] = []
  rows.forEach((row) => {
    if (wanted.has(row.series)) {
      keys.push(buildSeriesNodeId(row.country, row.sysType, row.usage, row.series))
    }
  })
  return [...new Set(keys)]
}

/**
 * 解析 getSeries API 返回结构，得到 系统类型 → 系列名[]。
 *
 * @param data API data
 * @param allowedTypes 任务已选系统类型
 */
export function parseSeriesApiBuckets(
  data: SatelliteSeriesData | null | undefined,
  allowedTypes: string[],
): Array<{ sysType: string; series: string }> {
  if (!data) return []
  const result: Array<{ sysType: string; series: string }> = []
  allowedTypes.forEach((sysType) => {
    const list =
      sysType === '侦察' ? data.侦察 : sysType === '通信' ? data.通信 : undefined
    if (!Array.isArray(list)) return
    list.forEach((series) => {
      if (series?.trim()) result.push({ sysType, series: series.trim() })
    })
  })
  return result
}
