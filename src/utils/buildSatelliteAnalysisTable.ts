import type { SatelliteAnalysisData } from '@/api/task/task'

/** 卫星指标表格行（展示用） */
export interface SatelliteMetricTableRow {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 打击前覆盖率展示 */
  coverageBeforeText: string
  /** 打击后覆盖率展示 */
  coverageAfterText: string
  /** 覆盖率减少展示（如 -10%） */
  coverageReduceText: string
  /** 打击前链路时延展示 */
  delayBeforeText: string
  /** 打击后链路时延展示 */
  delayAfterText: string
  /** 时延增加展示（如 +0.8s） */
  delayIncreaseText: string
  /** 打击前威胁度展示 */
  threatBeforeText: string
  /** 打击后威胁度展示 */
  threatAfterText: string
  /** 威胁度降低展示（如 -0.01） */
  threatReduceText: string
  /** 打击前覆盖率（排序用） */
  coverageBefore: number | null
  /** 打击前链路时延（分钟，排序用） */
  delayBefore: number | null
  /** 打击前威胁度（排序用） */
  threatBefore: number | null
}

/** 卫星指标合并过程中的内部行结构 */
interface SatelliteMetricAccumulator {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 打击前覆盖率 */
  coverageBefore: number | null
  /** 打击后覆盖率 */
  coverageAfter: number | null
  /** 打击前链路时延（分钟） */
  delayBefore: number | null
  /** 打击造成的时延增量（分钟，对应接口 afterDuration） */
  delayIncrease: number | null
  /** 打击前威胁度 */
  threatBefore: number | null
  /** 打击后威胁度 */
  threatAfter: number | null
}

const EMPTY_TEXT = '--'

/**
 * 将接口返回的 NORAD 规范为数字。
 *
 * @param value 原始 NORAD
 * @returns 有效 NORAD；无效时返回 null
 */
const normalizeNorad = (value: unknown): number | null => {
  const norad = Number(value)
  return Number.isFinite(norad) ? norad : null
}

/**
 * 判断数值是否可用于展示与计算。
 *
 * @param value 原始数值
 * @returns 是否为有效有限数值
 */
const isValidNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/**
 * 将覆盖率格式化为百分比文本。
 *
 * @param value 覆盖率数值
 * @returns 百分比文本；无效时返回 `--`
 */
export const formatSatelliteCoverage = (value: number | null | undefined): string => {
  if (!isValidNumber(value)) return EMPTY_TEXT
  return `${Number(value.toFixed(2))}%`
}

/**
 * 格式化覆盖率减少量（打击前 - 打击后）。
 *
 * @param before 打击前覆盖率
 * @param after 打击后覆盖率
 * @returns 如 `-10%`；无法计算时返回 `--`
 */
export const formatSatelliteCoverageReduce = (
  before: number | null | undefined,
  after: number | null | undefined
): string => {
  if (!isValidNumber(before) || !isValidNumber(after)) return EMPTY_TEXT
  const diff = before - after
  if (Math.abs(diff) < 1e-9) return '0%'
  const sign = diff > 0 ? '-' : '+'
  return `${sign}${Math.abs(diff).toFixed(2)}%`
}

/**
 * 将分钟级时延绝对值格式化为展示文本。
 * 不足 1 小时显示「xx分钟」，超过 1 小时显示「xx小时xx分钟」。
 *
 * @param minutes 时延（分钟，取绝对值展示）
 * @returns 展示文本
 */
const formatSatelliteDelayMinutesAbs = (minutes: number): string => {
  const absMinutes = Math.abs(minutes)
  if (absMinutes < 60) {
    const display = Number.isInteger(absMinutes) ? String(absMinutes) : absMinutes.toFixed(1)
    return `${display}分钟`
  }
  const hours = Math.floor(absMinutes / 60)
  const remainMinutes = Math.round(absMinutes % 60)
  return remainMinutes > 0 ? `${hours}小时${remainMinutes}分钟` : `${hours}小时`
}

/**
 * 将分钟级时延格式化为展示文本。
 *
 * @param minutes 时延（分钟）
 * @returns 展示文本
 */
export const formatSatelliteDelayMinutes = (minutes: number | null | undefined): string => {
  if (!isValidNumber(minutes)) return EMPTY_TEXT
  if (Math.abs(minutes) < 1e-9) return '0分钟'
  const sign = minutes < 0 ? '-' : ''
  return `${sign}${formatSatelliteDelayMinutesAbs(minutes)}`
}

/**
 * 格式化时延增量（接口 afterDuration 字段）。
 *
 * @param increaseMinutes 时延增量（分钟）
 * @returns 如 `+41.3分钟`、`+1小时20分钟`；无法计算时返回 `--`
 */
export const formatSatelliteDelayIncrease = (increaseMinutes: number | null | undefined): string => {
  if (!isValidNumber(increaseMinutes)) return EMPTY_TEXT
  if (Math.abs(increaseMinutes) < 1e-9) return '0分钟'
  const sign = increaseMinutes > 0 ? '+' : '-'
  return `${sign}${formatSatelliteDelayMinutesAbs(increaseMinutes)}`
}

/**
 * 计算打击后真实链路时延（打击前 + 增量）。
 *
 * @param before 打击前时延（分钟）
 * @param increase 时延增量（分钟）
 * @returns 打击后真实时延；无法计算时返回 null
 */
export const resolveTrueDelayAfter = (
  before: number | null | undefined,
  increase: number | null | undefined
): number | null => {
  if (!isValidNumber(before) || !isValidNumber(increase)) return null
  return before + increase
}

/**
 * 格式化威胁度得分。
 *
 * @param value 威胁度原始值
 * @returns 保留 3 位小数的文本
 */
export const formatSatelliteThreat = (value: number | null | undefined): string => {
  if (!isValidNumber(value)) return EMPTY_TEXT
  return value.toFixed(3)
}

/**
 * 格式化威胁度降低量（打击前 - 打击后）。
 *
 * @param before 打击前威胁度
 * @param after 打击后威胁度
 * @returns 如 `-0.010`；无法计算时返回 `--`
 */
export const formatSatelliteThreatReduce = (
  before: number | null | undefined,
  after: number | null | undefined
): string => {
  if (!isValidNumber(before) || !isValidNumber(after)) return EMPTY_TEXT
  const diff = before - after
  if (Math.abs(diff) < 1e-9) return '0.000'
  const sign = diff > 0 ? '-' : '+'
  return `${sign}${Math.abs(diff).toFixed(3)}`
}

/**
 * 将合并后的内部行转为表格展示行。
 *
 * @param row 合并后的卫星指标
 * @returns 表格展示行
 */
const toDisplayRow = (row: SatelliteMetricAccumulator): SatelliteMetricTableRow => {
  const trueDelayAfter = resolveTrueDelayAfter(row.delayBefore, row.delayIncrease)

  return {
  norad: row.norad,
  name: row.name,
  coverageBeforeText: formatSatelliteCoverage(row.coverageBefore),
  coverageAfterText: formatSatelliteCoverage(row.coverageAfter),
  coverageReduceText: formatSatelliteCoverageReduce(row.coverageBefore, row.coverageAfter),
  delayBeforeText: formatSatelliteDelayMinutes(row.delayBefore),
  delayAfterText: formatSatelliteDelayMinutes(trueDelayAfter),
  delayIncreaseText: formatSatelliteDelayIncrease(row.delayIncrease),
  threatBeforeText: formatSatelliteThreat(row.threatBefore),
  threatAfterText: formatSatelliteThreat(row.threatAfter),
  threatReduceText: formatSatelliteThreatReduce(row.threatBefore, row.threatAfter),
  coverageBefore: row.coverageBefore,
  delayBefore: row.delayBefore,
  threatBefore: row.threatBefore,
  }
}

/**
 * 可排序指标比较：空值排在后面。
 *
 * @param a 左值
 * @param b 右值
 * @returns 排序差值
 */
export const compareNullableMetric = (
  a: number | null | undefined,
  b: number | null | undefined
): number => {
  const aEmpty = a == null || !Number.isFinite(a)
  const bEmpty = b == null || !Number.isFinite(b)
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  return (a as number) - (b as number)
}

/** 默认展示的卫星条数（综合排序前 N 条） */
export const SATELLITE_TABLE_TOP_COUNT = 10

/**
 * 计算单颗卫星打击前指标的综合得分（0-1，越高越靠前）。
 * 对覆盖率、链路时延、威胁度分别归一化后取可用项平均值。
 *
 * @param row 卫星指标行
 * @param norms 各指标归一化函数
 * @returns 综合得分；无可用指标时返回 -1
 */
const calcCompositeBeforeScore = (
  row: SatelliteMetricTableRow,
  norms: {
    coverage: ((value: number) => number) | null
    delay: ((value: number) => number) | null
    threat: ((value: number) => number) | null
  }
): number => {
  const parts: number[] = []
  if (row.coverageBefore != null && Number.isFinite(row.coverageBefore) && norms.coverage) {
    parts.push(norms.coverage(row.coverageBefore))
  }
  if (row.delayBefore != null && Number.isFinite(row.delayBefore) && norms.delay) {
    parts.push(norms.delay(row.delayBefore))
  }
  if (row.threatBefore != null && Number.isFinite(row.threatBefore) && norms.threat) {
    parts.push(norms.threat(row.threatBefore))
  }
  if (!parts.length) return -1
  return parts.reduce((sum, value) => sum + value, 0) / parts.length
}

/**
 * 构建指标归一化函数（值越大得分越高）。
 *
 * @param values 有效数值列表
 * @returns 归一化函数；无有效值时返回 null
 */
const buildNormalizeFn = (values: number[]): ((value: number) => number) | null => {
  if (!values.length) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) {
    return () => 1
  }
  return (value: number) => (value - min) / (max - min)
}

/**
 * 按打击前覆盖率、链路时延、威胁度综合排序卫星列表。
 *
 * @param rows 卫星指标行
 * @returns 综合得分从高到低排序后的列表
 */
export const rankSatellitesByCompositeBeforeMetrics = (
  rows: SatelliteMetricTableRow[]
): SatelliteMetricTableRow[] => {
  if (!rows.length) return []

  const coverageValues = rows
    .map((row) => row.coverageBefore)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const delayValues = rows
    .map((row) => row.delayBefore)
    .filter((value): value is number => value != null && Number.isFinite(value))
  const threatValues = rows
    .map((row) => row.threatBefore)
    .filter((value): value is number => value != null && Number.isFinite(value))

  const norms = {
    coverage: buildNormalizeFn(coverageValues),
    delay: buildNormalizeFn(delayValues),
    threat: buildNormalizeFn(threatValues),
  }

  return [...rows].sort((a, b) => {
    const scoreA = calcCompositeBeforeScore(a, norms)
    const scoreB = calcCompositeBeforeScore(b, norms)
    if (scoreA !== scoreB) return scoreB - scoreA
    return a.name.localeCompare(b.name, 'zh-CN')
  })
}

/**
 * 从任务分析结果中合并各系列卫星指标，构建表格行列表。
 * 以 NORAD 为键汇总 initMatrixList / satelliteMatrixList / timeEffects / threatSats。
 *
 * @param data 任务算法分析结果
 * @returns 按卫星名称排序的表格行
 */
export const buildSatelliteAnalysisTableRows = (
  data: SatelliteAnalysisData | null | undefined
): SatelliteMetricTableRow[] => {
  if (!data) return []

  const map = new Map<number, SatelliteMetricAccumulator>()

  /**
   * 合并单颗卫星的指标片段。
   *
   * @param norad 卫星 NORAD
   * @param patch 待合并字段
   */
  const upsert = (norad: number, patch: Partial<SatelliteMetricAccumulator> & { name?: string }) => {
    const exist =
      map.get(norad) ||
      ({
        norad,
        name: patch.name || `Sat-${norad}`,
        coverageBefore: null,
        coverageAfter: null,
        delayBefore: null,
        delayIncrease: null,
        threatBefore: null,
        threatAfter: null,
      } satisfies SatelliteMetricAccumulator)

    map.set(norad, {
      ...exist,
      name: patch.name || exist.name,
      coverageBefore: patch.coverageBefore ?? exist.coverageBefore,
      coverageAfter: patch.coverageAfter ?? exist.coverageAfter,
      delayBefore: patch.delayBefore ?? exist.delayBefore,
      delayIncrease: patch.delayIncrease ?? exist.delayIncrease,
      threatBefore: patch.threatBefore ?? exist.threatBefore,
      threatAfter: patch.threatAfter ?? exist.threatAfter,
    })
  }

  const entities = Array.isArray(data.levelSeriesEntities) ? data.levelSeriesEntities : []

  entities.forEach((entity) => {
    ;(entity?.initMatrixList || []).forEach((sat) => {
      const norad = normalizeNorad(sat?.norad)
      if (norad == null) return
      upsert(norad, {
        name: sat?.name,
        coverageBefore: isValidNumber(sat?.coverage) ? sat.coverage : null,
      })
    })

    ;(entity?.satelliteMatrixList || []).forEach((sat) => {
      const norad = normalizeNorad(sat?.norad)
      if (norad == null) return
      upsert(norad, {
        name: sat?.name,
        coverageAfter: isValidNumber(sat?.coverage) ? sat.coverage : null,
      })
    })

    ;(entity?.timeEffects || []).forEach((item) => {
      const norad = normalizeNorad(item?.norad)
      if (norad == null) return
      upsert(norad, {
        name: item?.name,
        delayBefore: isValidNumber(item?.duration) ? item.duration : null,
        delayIncrease: isValidNumber(item?.afterDuration) ? item.afterDuration : null,
      })
    })

    ;(entity?.threatSats || []).forEach((item) => {
      const norad = normalizeNorad(item?.norad)
      if (norad == null) return
      upsert(norad, {
        name: item?.name,
        threatBefore: isValidNumber(item?.threatScore) ? item.threatScore : null,
        threatAfter: isValidNumber(item?.afterThreatScore) ? item.afterThreatScore : null,
      })
    })
  })

  return Array.from(map.values())
    .map(toDisplayRow)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}
