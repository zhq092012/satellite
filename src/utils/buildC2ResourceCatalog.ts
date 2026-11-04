import type { LevelSeriesEntity } from '@/api/task/task'
import type { SatelliteAnalysisData } from '@/api/task/task'
import type { SatelliteSeriesData } from '@/api/task/task'
import { normalizeSatelliteUsageLabel, TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'

/** C2 左侧面板资源树固定展示的国家/地区（与作战对象三项一致） */
export const C2_PANEL_TREE_COUNTRIES: readonly string[] = TASK_ENEMY_COUNTRY_OPTIONS

/** 左侧资源树节点类型 */
export type C2ResourceTreeNodeKind = 'country' | 'sysType' | 'usage' | 'series'

/**
 * C2 资源树节点（el-tree；界面展示至系列层，不在树中展示 NORAD 叶子）。
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
 * 从任务分析 matrix（levelSeriesEntities）生成扁卫星行。
 *
 * @param analysis 任务分析数据
 * @param defaultCountries 任务蓝方国家（matrix 无 country 时的回退）
 */
export function buildC2SatelliteFlatRowsFromMatrix(
  analysis: SatelliteAnalysisData | null | undefined,
  defaultCountries: string[],
): C2ResourceSatelliteRow[] {
  if (!analysis?.levelSeriesEntities?.length) return []
  const fallbackCountry =
    defaultCountries.length === 1 ? defaultCountries[0] : C2_RESOURCE_EMPTY_FIELD
  const rows: C2ResourceSatelliteRow[] = []
  analysis.levelSeriesEntities.forEach((entity) => {
    rows.push(...flatRowsFromLevelSeriesEntity(entity, fallbackCountry))
  })
  return dedupeC2ResourceRows(rows)
}

/**
 * 从单个 LevelSeriesEntity 展开扁平行。
 *
 * @param entity 系列实体
 * @param fallbackCountry 默认国家
 */
function flatRowsFromLevelSeriesEntity(
  entity: LevelSeriesEntity,
  fallbackCountry: string,
): C2ResourceSatelliteRow[] {
  const series = entity.series?.trim()
  if (!series) return []
  const sysType = entity.sysType?.trim() || '未分类'
  const list = entity.initMatrixList || []
  return list
    .filter((sat) => Number.isFinite(sat.norad))
    .map((sat) => ({
      rowKey: buildC2ResourceRowKey(series, sysType, sat.norad),
      norad: sat.norad,
      name: sat.name?.trim() || String(sat.norad),
      country: fallbackCountry,
      sysType,
      usage: normalizeSatelliteUsageLabel(sat.usage),
      series,
      sat_type: sat.satType?.trim() || C2_RESOURCE_EMPTY_FIELD,
      int_id: C2_RESOURCE_EMPTY_FIELD,
      launch_date: C2_RESOURCE_EMPTY_FIELD,
    }))
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
 * 去重扁平行（同 rowKey 保留首条）。
 *
 * @param rows 原始行
 */
function dedupeC2ResourceRows(rows: C2ResourceSatelliteRow[]): C2ResourceSatelliteRow[] {
  const map = new Map<string, C2ResourceSatelliteRow>()
  rows.forEach((row) => {
    if (!map.has(row.rowKey)) map.set(row.rowKey, row)
  })
  return [...map.values()]
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
 * 构建 C2 左侧面板资源树：固定展示「中国台湾 / 日本 / 美国」三国根节点。
 *
 * @param rows 扁平行（会先按国家过滤）
 */
export function buildC2ResourceTreeNodesForPanel(rows: C2ResourceSatelliteRow[]): C2ResourceTreeNode[] {
  const filtered = filterC2ResourceRowsToPanelCountries(rows)
  const built = buildC2ResourceTreeNodes(filtered)
  const byLabel = new Map(built.map((node) => [node.label, node]))
  return C2_PANEL_TREE_COUNTRIES.map((country) => {
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

/**
 * 将 matrix 扁平行合并进完整 catalog：仅覆盖 matrix 中出现的系列，其余系列保留。
 *
 * @param baseRows 完整系列 catalog（通常为系列预览接口）
 * @param matrixRows 任务分析 matrix 扁平行
 */
export function mergeMatrixCatalogIntoPanelCatalog(
  baseRows: C2ResourceSatelliteRow[],
  matrixRows: C2ResourceSatelliteRow[],
): C2ResourceSatelliteRow[] {
  if (!matrixRows.length) return baseRows
  if (!baseRows.length) return dedupeC2ResourceRows(matrixRows)
  const matrixSeries = new Set(matrixRows.map((row) => row.series))
  const kept = baseRows.filter((row) => !matrixSeries.has(row.series))
  return dedupeC2ResourceRows([...kept, ...matrixRows])
}

/**
 * 从树勾选 keys 展开为应包含的系列名集合。
 * 传入 keys 应为 el-tree `getCheckedKeys(true)` 的叶子节点；勿合并半选父节点 key。
 *
 * @param checkedKeys el-tree 勾选 keys
 * @param rows 全量扁平行
 */
export function expandCheckedKeysToSeriesNames(
  checkedKeys: string[],
  rows: C2ResourceSatelliteRow[],
): Set<string> {
  const seriesNames = new Set<string>()
  const checked = new Set(checkedKeys)
  rows.forEach((row) => {
    const seriesId = buildSeriesNodeId(row.country, row.sysType, row.usage, row.series)
    const countryId = `country|${encodePart(row.country)}`
    const sysTypeId = `sysType|${encodePart(row.country)}|${encodePart(row.sysType)}`
    const usageId = `usage|${encodePart(row.country)}|${encodePart(row.sysType)}|${encodePart(row.usage)}`
    if (
      checked.has(seriesId) ||
      checked.has(usageId) ||
      checked.has(sysTypeId) ||
      checked.has(countryId)
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
export function filterC2SatellitesByTreeSelection(
  rows: C2ResourceSatelliteRow[],
  checkedKeys: string[],
): C2ResourceSatelliteRow[] {
  if (!checkedKeys.length) return []
  const seriesSet = expandCheckedKeysToSeriesNames(checkedKeys, rows)
  if (!seriesSet.size) return []
  return rows.filter((row) => seriesSet.has(row.series))
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
