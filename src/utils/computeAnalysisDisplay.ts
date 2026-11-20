import type { AlgorithmInfo, AlgorithmSelection, FactorScore } from '@/types/threat'

/**
 * 将 0~1 或一般数值格式化为展示文本。
 *
 * @param value 原始数值
 * @param fractionDigits 小数位
 */
export const formatComputeScore = (value: number | null | undefined, fractionDigits = 3): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toFixed(fractionDigits)
}

/**
 * 将 0~1 比率格式化为百分比文本。
 *
 * @param value 比率
 * @param fractionDigits 小数位
 */
export const formatComputeRatioPercent = (value: number | null | undefined, fractionDigits = 1): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${(value * 100).toFixed(fractionDigits)}%`
}

/**
 * 因子明细合并为单元格辅助说明（换行展示）。
 *
 * @param factors 因子列表
 */
export const formatFactorScoreHints = (factors: FactorScore[] | null | undefined): string => {
  if (!factors?.length) return ''
  return factors
    .map((item) => {
      const name = item.name?.trim() || item.code?.trim() || '因子'
      const valueText = formatComputeScore(item.value, 3)
      const detail = item.detail?.trim()
      return detail ? `${name} ${valueText}（${detail}）` : `${name} ${valueText}`
    })
    .join('\n')
}

/**
 * 将本次计算使用的算法编码格式化为可读说明。
 *
 * @param selection 算法选择
 * @param catalog 已注册算法目录（用于解析名称）
 */
export const formatAlgorithmSelectionText = (
  selection: AlgorithmSelection | null | undefined,
  catalog: AlgorithmInfo[],
): string => {
  if (!selection) return '--'
  const byCode = new Map(catalog.map((item) => [item.code, item]))
  const part = (code: string | undefined, fallbackLabel: string) => {
    if (!code?.trim()) return ''
    const hit = byCode.get(code)
    const name = hit?.name || code
    return `${fallbackLabel}：${name}（${code}）`
  }
  return [
    part(selection.staticThreat, '静态威胁度'),
    part(selection.dynamicThreat, '动态威胁度'),
    part(selection.aggregator, '综合聚合'),
    part(selection.strike, '打击度'),
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * 威胁/打击表按国家（作战对象优先）与主分数降序排序。
 */
export const sortComputeRowsByCountryAndScore = <T extends { country?: string; score: number }>(
  rows: T[],
  priorityCountries: string[],
): T[] => {
  const priority = new Set(priorityCountries.filter(Boolean))
  const countryRank = (country: string | undefined): number => {
    const c = country?.trim() || ''
    if (!c) return 2
    return priority.has(c) ? 0 : 1
  }
  return [...rows].sort((a, b) => {
    const rankDiff = countryRank(a.country) - countryRank(b.country)
    if (rankDiff !== 0) return rankDiff
    const countryDiff = (a.country || '').localeCompare(b.country || '', 'zh-CN')
    if (countryDiff !== 0) return countryDiff
    return b.score - a.score
  })
}

/** 首页威胁/打击表作战对象国家行样式 class */
export const computeAnalysisCountryRowClass = (country: string | undefined, priorityCountries: string[]): string => {
  const c = country?.trim()
  if (!c) return ''
  return priorityCountries.includes(c) ? 'compute-row--priority-country' : ''
}