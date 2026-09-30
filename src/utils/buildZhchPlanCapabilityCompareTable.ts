import type { ZhchPlanResp } from '@/api/electronic'
import type {
  ZhchPlanMetricCell,
  ZhchPlanMetricCompareRow,
  ZhchPlanMetricDeltaTone,
  ZhchPlanMetricsCompareTableModel,
  ZhchPlanMetricColumnDef,
} from '@/utils/buildZhchPlanMetricsCompareTable'
import { formatCoveragePercent, parseFeedbackTimestamp } from '@/utils/zhchPlanDisplay'
import {
  buildMockZhchPlanCapabilityMetrics,
  type CommCapabilityMetricValues,
  type ReconCapabilityMetricValues,
} from '@/utils/mockZhchPlanCapabilityMetrics'

/** 数值差值着色策略（相对打击效果） */
type CapabilityNumericDeltaPolicy = 'neutral' | 'lower-favorable' | 'higher-favorable'

/**
 * 从带百分号的展示串解析数值。
 *
 * @param text 如 78.4%
 * @returns 数值或 null
 */
const parsePercentDisplay = (text: string): number | null => {
  const match = text.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*%?$/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * 从「x.x小时」解析小时数。
 *
 * @param text 展示串
 * @returns 小时或 null
 */
const parseHoursDisplay = (text: string): number | null => {
  const match = text.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*小时$/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * 从 Gbps 展示串解析数值。
 *
 * @param text 如 2.6Gbps
 * @returns Gbps 或 null
 */
const parseGbpsDisplay = (text: string): number | null => {
  const match = text.trim().match(/^([+-]?\d+(?:\.\d+)?)\s*Gbps$/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * 解析 0–1 小数展示。
 *
 * @param text 如 0.91
 * @returns 数值或 null
 */
const parseUnitlessDecimalDisplay = (text: string): number | null => {
  const trimmed = text.trim()
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

/**
 * 将毫秒差格式化为带正负号的时长文案（用于括号内差值）。
 *
 * @param diffMs after - before（毫秒）
 * @returns 如 (+20分15秒) 或 (-5分0秒)
 */
const formatSignedDurationDelta = (diffMs: number): string => {
  if (diffMs === 0) return '(+0秒)'
  const sign = diffMs > 0 ? '+' : '-'
  const absSec = Math.abs(Math.round(diffMs / 1000))
  const h = Math.floor(absSec / 3600)
  const m = Math.floor((absSec % 3600) / 60)
  const s = absSec % 60
  let body: string
  if (h > 0) {
    body = `${h}时${m}分${s}秒`
  } else if (m > 0) {
    body = `${m}分${s}秒`
  } else {
    body = `${s}秒`
  }
  return `(${sign}${body})`
}

/**
 * 时刻推后/提前的差值 tone。
 *
 * @param beforeMs 打击前时刻
 * @param afterMs 打击后时刻
 * @returns tone
 */
const timeDeltaTone = (beforeMs: number, afterMs: number): ZhchPlanMetricDeltaTone => {
  if (beforeMs === afterMs) return 'neutral'
  return afterMs > beforeMs ? 'adverse' : 'favorable'
}

/**
 * 构建打击后时刻单元格（括号内为时间差）。
 *
 * @param afterDisplay 打击后展示
 * @param beforeTime 打击前时刻
 * @param afterTime 打击后时刻
 * @returns 单元格
 */
const buildAfterTimeCell = (
  afterDisplay: string,
  beforeTime: string,
  afterTime: string
): ZhchPlanMetricCell => {
  const beforeMs = parseFeedbackTimestamp(beforeTime)
  const afterMs = parseFeedbackTimestamp(afterTime)
  if (beforeMs == null || afterMs == null) {
    return { value: afterDisplay }
  }
  const diffMs = afterMs - beforeMs
  return {
    value: afterDisplay,
    delta: formatSignedDurationDelta(diffMs),
    deltaTone: timeDeltaTone(beforeMs, afterMs),
  }
}

/**
 * 格式化带单位的数值差值。
 *
 * @param before 打击前
 * @param after 打击后
 * @param unit 单位
 * @returns 差值文案
 */
const formatSignedUnitDelta = (
  before: number,
  after: number,
  unit: string
): string | null => {
  const diff = after - before
  if (diff === 0) return unit ? `(+0${unit})` : '(+0)'
  const sign = diff > 0 ? '+' : ''
  const magnitude = Number.isInteger(diff) ? String(diff) : diff.toFixed(2)
  return `(${sign}${magnitude}${unit})`
}

/**
 * 百分比差值（after - before）。
 *
 * @param before 打击前
 * @param after 打击后
 * @returns 差值文案
 */
const formatSignedPercentPointDelta = (before: number, after: number): string | null => {
  const diff = after - before
  const sign = diff > 0 ? '+' : ''
  return `(${sign}${diff.toFixed(2)}%)`
}

/**
 * 根据策略解析差值 tone。
 *
 * @param before 打击前数值
 * @param after 打击后数值
 * @param policy 策略
 * @returns tone
 */
const numericDeltaTone = (
  before: number,
  after: number,
  policy: CapabilityNumericDeltaPolicy
): ZhchPlanMetricDeltaTone => {
  if (policy === 'neutral' || before === after) return 'neutral'
  const diff = after - before
  if (policy === 'lower-favorable') return diff < 0 ? 'favorable' : 'adverse'
  return diff > 0 ? 'favorable' : 'adverse'
}

/**
 * 构建打击后单元格（含可选数值差值）。
 *
 * @param afterDisplay 打击后展示
 * @param beforeNum 打击前数值
 * @param afterNum 打击后数值
 * @param unit 单位
 * @param policy 差值策略
 * @returns 单元格
 */
const buildAfterCell = (
  afterDisplay: string,
  beforeNum: number | undefined,
  afterNum: number | undefined,
  unit: string,
  policy: CapabilityNumericDeltaPolicy
): ZhchPlanMetricCell => {
  if (beforeNum == null || afterNum == null || !Number.isFinite(beforeNum) || !Number.isFinite(afterNum)) {
    return { value: afterDisplay }
  }
  const delta =
    unit === '%'
      ? formatSignedPercentPointDelta(beforeNum, afterNum)
      : formatSignedUnitDelta(beforeNum, afterNum, unit)
  return {
    value: afterDisplay,
    delta,
    deltaTone: numericDeltaTone(beforeNum, afterNum, policy),
  }
}

/**
 * 从展示串解析数值并构建打击后单元格（百分比/Gbps/小时/小数等）。
 *
 * @param afterDisplay 打击后展示
 * @param beforeDisplay 打击前展示
 * @param parse 解析函数
 * @param unit 差值单位后缀（'' 表示无单位小数）
 * @param policy 差值策略
 * @returns 单元格
 */
const buildAfterCellFromDisplay = (
  afterDisplay: string,
  beforeDisplay: string,
  parse: (text: string) => number | null,
  unit: string,
  policy: CapabilityNumericDeltaPolicy
): ZhchPlanMetricCell => {
  const beforeNum = parse(beforeDisplay)
  const afterNum = parse(afterDisplay)
  return buildAfterCell(afterDisplay, beforeNum ?? undefined, afterNum ?? undefined, unit, policy)
}

/**
 * 由侦察能力 mock 构建打击前/后对比表。
 *
 * @param before 打击前
 * @param after 打击后
 * @returns 表格模型
 */
const buildReconCapabilityTable = (
  before: ReconCapabilityMetricValues,
  after: ReconCapabilityMetricValues
): ZhchPlanMetricsCompareTableModel => {
  const columns: ZhchPlanMetricColumnDef[] = [
    { key: 'transitCount', label: '侦察卫星过境数量', minWidth: 120 },
    { key: 'earliestTransit', label: '侦察卫星最早过境时间', minWidth: 140 },
    { key: 'earliestReturn', label: '最早数据回传时间', minWidth: 140 },
    { key: 'coverageTimePercent', label: '侦察卫星覆盖时段百分比', minWidth: 140 },
  ]

  const beforeCells: Record<string, ZhchPlanMetricCell> = {
    transitCount: { value: `${before.transitCount}个` },
    earliestTransit: { value: before.earliestTransitTime },
    earliestReturn: { value: before.earliestDataReturnTime },
    coverageTimePercent: { value: formatCoveragePercent(before.coverageTimePercent) },
  }

  const afterCells: Record<string, ZhchPlanMetricCell> = {
    transitCount: buildAfterCell(
      `${after.transitCount}个`,
      before.transitCount,
      after.transitCount,
      '个',
      'lower-favorable'
    ),
    earliestTransit: buildAfterTimeCell(
      after.earliestTransitTime,
      before.earliestTransitTime,
      after.earliestTransitTime
    ),
    earliestReturn: buildAfterTimeCell(
      after.earliestDataReturnTime,
      before.earliestDataReturnTime,
      after.earliestDataReturnTime
    ),
    coverageTimePercent: buildAfterCell(
      formatCoveragePercent(after.coverageTimePercent),
      before.coverageTimePercent,
      after.coverageTimePercent,
      '%',
      'lower-favorable'
    ),
  }

  const rows: ZhchPlanMetricCompareRow[] = [
    { phase: 'before', phaseLabel: '打击前', cells: beforeCells },
    { phase: 'after', phaseLabel: '打击后', cells: afterCells },
  ]

  return { columns, rows }
}

/**
 * 由通信保障 mock 构建打击前/后对比表。
 *
 * @param before 打击前
 * @param after 打击后
 * @returns 表格模型
 */
const buildCommCapabilityTable = (
  before: CommCapabilityMetricValues,
  after: CommCapabilityMetricValues
): ZhchPlanMetricsCompareTableModel => {
  const columns: ZhchPlanMetricColumnDef[] = [
    { key: 'coverageRange', label: '覆盖范围', minWidth: 88 },
    { key: 'revisitTime', label: '重访时间', minWidth: 88 },
    { key: 'processingDelay', label: '处理时延', minWidth: 88 },
    { key: 'linkQuality', label: '链路质量', minWidth: 88 },
    { key: 'commCapacity', label: '通信容量', minWidth: 88 },
  ]

  const beforeCells: Record<string, ZhchPlanMetricCell> = {
    coverageRange: { value: before.coverageRange },
    revisitTime: { value: before.revisitTime },
    processingDelay: { value: `${before.processingDelayMin}分钟` },
    linkQuality: { value: before.linkQuality },
    commCapacity: { value: before.commCapacity },
  }

  const afterCells: Record<string, ZhchPlanMetricCell> = {
    coverageRange: buildAfterCellFromDisplay(
      after.coverageRange,
      before.coverageRange,
      parsePercentDisplay,
      '%',
      'lower-favorable'
    ),
    revisitTime: buildAfterCellFromDisplay(
      after.revisitTime,
      before.revisitTime,
      parseHoursDisplay,
      '小时',
      'higher-favorable'
    ),
    processingDelay: buildAfterCell(
      `${after.processingDelayMin}分钟`,
      before.processingDelayMin,
      after.processingDelayMin,
      '分钟',
      'higher-favorable'
    ),
    linkQuality: buildAfterCellFromDisplay(
      after.linkQuality,
      before.linkQuality,
      parseUnitlessDecimalDisplay,
      '',
      'lower-favorable'
    ),
    commCapacity: buildAfterCellFromDisplay(
      after.commCapacity,
      before.commCapacity,
      parseGbpsDisplay,
      'Gbps',
      'lower-favorable'
    ),
  }

  const rows: ZhchPlanMetricCompareRow[] = [
    { phase: 'before', phaseLabel: '打击前', cells: beforeCells },
    { phase: 'after', phaseLabel: '打击后', cells: afterCells },
  ]

  return { columns, rows }
}

/**
 * 天基侦察能力打击前后对比表（当前为 mock；接入 `plan.reconCapability` 后替换数据源）。
 *
 * @param plan 综合打击方案
 * @returns 表格模型
 */
export const buildReconCapabilityCompareTable = (
  plan: ZhchPlanResp
): ZhchPlanMetricsCompareTableModel => {
  const mock = buildMockZhchPlanCapabilityMetrics(plan)
  return buildReconCapabilityTable(mock.reconBefore, mock.reconAfter)
}

/**
 * 通信保障能力打击前后对比表（当前为 mock；接入 `plan.commCapability` 后替换数据源）。
 *
 * @param plan 综合打击方案
 * @returns 表格模型
 */
export const buildCommCapabilityCompareTable = (
  plan: ZhchPlanResp
): ZhchPlanMetricsCompareTableModel => {
  const mock = buildMockZhchPlanCapabilityMetrics(plan)
  return buildCommCapabilityTable(mock.commBefore, mock.commAfter)
}
