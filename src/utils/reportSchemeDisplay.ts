import type { ReportCandidateSatellite, SchemeResult } from '@/types/report/report'

/** 报告选星明细表一行（仅含接口有值的展示字段） */
export interface ReportSchemeSelectedRow {
  /** 卫星名称（优先接口 name） */
  name: string
  /** NORAD；无则不在表头展示该列 */
  noradId?: string
  /** 国家 */
  country?: string
  /** 体系 */
  system?: string
  /** 系列 */
  series?: string
  /** 威胁度展示 */
  threatText?: string
  /** 综合得分 */
  scoreText?: string
  /** 入选原因 */
  reasonText?: string
  /** 可用时间窗 */
  windowText?: string
  /** 是否在时间窗内 */
  inTimeWindow?: boolean
}

/**
 * 按卫星字段依次尝试匹配 `selectedScores` / `selectedReasons` 的 map 键。
 * 后端常以 `satelliteId` 为 key，展示层统一用 `name`。
 *
 * @param sat 候选卫星
 * @param map 评分或原因 map
 */
export const lookupReportSchemeMapValue = (
  sat: ReportCandidateSatellite,
  map: Record<string, string | number> | undefined,
): string | number | undefined => {
  if (!map) return undefined
  const keys = [sat.satelliteId?.trim(), sat.noradId?.trim(), sat.name?.trim()].filter(
    Boolean,
  ) as string[]
  for (const key of keys) {
    if (key in map) return map[key]
  }
  return undefined
}

/**
 * 将接口 `SchemeResult.selected` 转为表格行（不填充占位符列）。
 *
 * @param scheme 方案
 */
export const buildReportSchemeSelectedRows = (scheme: SchemeResult): ReportSchemeSelectedRow[] => {
  const list = scheme.selected ?? []
  const rows: ReportSchemeSelectedRow[] = []
  for (const sat of list) {
    const name = sat.name?.trim()
    if (!name) continue

    const scoreRaw = lookupReportSchemeMapValue(sat, scheme.selectedScores)
    const reasonRaw = lookupReportSchemeMapValue(sat, scheme.selectedReasons)
    const score =
      typeof scoreRaw === 'number'
        ? scoreRaw
        : scoreRaw != null
          ? Number(scoreRaw)
          : Number.NaN
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : ''

    const row: ReportSchemeSelectedRow = { name }

    const norad = sat.noradId?.trim()
    if (norad) row.noradId = norad

    const country = sat.country?.trim()
    if (country) row.country = country

    const system = sat.system?.trim()
    if (system) row.system = system

    const series = sat.series?.trim()
    if (series) row.series = series

    if (sat.threat != null && Number.isFinite(sat.threat)) {
      row.threatText = sat.threat.toFixed(3)
    }

    if (Number.isFinite(score)) {
      row.scoreText = score.toFixed(4)
    }

    if (reason) {
      row.reasonText = reason
    }

    if (sat.timeWindowStart?.trim() && sat.timeWindowEnd?.trim()) {
      row.windowText = `${sat.timeWindowStart.trim()} ~ ${sat.timeWindowEnd.trim()}`
    }

    if (sat.inTimeWindow != null) {
      row.inTimeWindow = sat.inTimeWindow
    }

    rows.push(row)
  }
  return rows
}

/**
 * 方案概要卡片字段（仅非空）。
 *
 * @param scheme 方案
 * @param taskName 任务名称
 */
export const buildReportSchemeSummaryFields = (
  scheme: SchemeResult,
  taskName?: string,
): Array<{ label: string; value: string }> => {
  const items: Array<{ label: string; value: string }> = []
  const push = (label: string, value?: string) => {
    const text = value?.trim()
    if (text) items.push({ label, value: text })
  }

  push('任务', taskName)
  push('方案名称', scheme.name)
  push('作战目标', scheme.objective)
  push('作战规模', scheme.scale)
  if (scheme.targetSize != null && Number.isFinite(scheme.targetSize)) {
    items.push({ label: '选星数量', value: String(scheme.targetSize) })
  }
  return items
}

/**
 * 判断某列在选星表中是否应展示（至少一行有值）。
 *
 * @param rows 选星行
 * @param pick 取值函数
 */
export const reportTableColumnVisible = (
  rows: ReportSchemeSelectedRow[],
  pick: (row: ReportSchemeSelectedRow) => string | boolean | undefined,
): boolean => rows.some((row) => {
  const v = pick(row)
  if (typeof v === 'boolean') return true
  return Boolean(v?.trim())
})