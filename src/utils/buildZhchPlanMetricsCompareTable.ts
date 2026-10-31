import type { ZhchPlanResp } from '@/api/electronic'
import {
  formatCoveragePercent,
  formatInterferenceDelay,
  parseFeedbackTimeAndLink,
  parseFeedbackTimestamp,
} from '@/utils/zhchPlanDisplay'

/** 指标差值颜色语义（相对打击效果） */
export type ZhchPlanMetricDeltaTone = 'neutral' | 'favorable' | 'adverse' | 'warning'

/** 单个单元格展示 */
export interface ZhchPlanMetricCell {
  /** 主展示值 */
  value: string
  /** 打击后行附加差值（含 +/-），打击前行无此项 */
  delta?: string | null
  /** 差值颜色语义 */
  deltaTone?: ZhchPlanMetricDeltaTone
  /** 主值颜色语义（如回传延迟列） */
  valueTone?: ZhchPlanMetricDeltaTone
}

/** 对比表一行（打击前 / 打击后） */
export interface ZhchPlanMetricCompareRow {
  /** 行标识 */
  phase: 'before' | 'after'
  /** 行标题 */
  phaseLabel: string
  /** 按列 key 索引的单元格 */
  cells: Record<string, ZhchPlanMetricCell>
}

/** 对比表列定义 */
export interface ZhchPlanMetricColumnDef {
  /** 列 key */
  key: string
  /** 表头指标名称 */
  label: string
  /** 列最小宽度（px，供表格布局） */
  minWidth?: number
}

/** 对比表完整结构 */
export interface ZhchPlanMetricsCompareTableModel {
  columns: ZhchPlanMetricColumnDef[]
  rows: ZhchPlanMetricCompareRow[]
}

/** 方案概要单行指标表 */
export interface ZhchPlanSummaryMetricsTableModel {
  columns: ZhchPlanMetricColumnDef[]
  /** 唯一数据行单元格 */
  cells: Record<string, ZhchPlanMetricCell>
}

/** 通用指标表行（供 UI 渲染） */
export interface ZhchPlanMetricsTableRowView {
  /** 行 key */
  rowKey: string
  /** 首列标签（可选） */
  rowLabel?: string
  /** 行样式：打击前 / 打击后 / 概要 */
  rowVariant?: 'before' | 'after' | 'summary'
  /** 是否展示单元格差值子行 */
  showDelta?: boolean
  cells: Record<string, ZhchPlanMetricCell>
}

/**
 * 格式化整数差值（after - before），带正负号。
 *
 * @param before 打击前数值
 * @param after 打击后数值
 * @param unit 单位后缀
 * @returns 差值文案；无法计算时返回 null
 */
const formatSignedCountDelta = (
  before: number | null | undefined,
  after: number | null | undefined,
  unit = ''
): string | null => {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  const diff = Number(after) - Number(before)
  if (diff === 0) return `(+0${unit})`
  const sign = diff > 0 ? '+' : ''
  return `(${sign}${diff}${unit})`
}

/**
 * 格式化覆盖率差值（after - before），带正负号与百分比。
 *
 * @param before 打击前覆盖率
 * @param after 打击后覆盖率
 * @returns 差值文案
 */
const formatSignedCoverageDelta = (
  before: number | null | undefined,
  after: number | null | undefined
): string | null => {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  const diff = Number(after) - Number(before)
  const sign = diff > 0 ? '+' : ''
  return `(${sign}${diff.toFixed(2)}%)`
}

/**
 * 覆盖率下降（对打击方有利）时使用 favorable，上升为 adverse。
 *
 * @param before 打击前
 * @param after 打击后
 * @returns 语义 tone
 */
const coverageDeltaTone = (
  before: number | null | undefined,
  after: number | null | undefined
): ZhchPlanMetricDeltaTone => {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 'neutral'
  const diff = Number(after) - Number(before)
  if (diff === 0) return 'neutral'
  return diff < 0 ? 'favorable' : 'adverse'
}

/**
 * 压制窗口、延迟等「上升表示打击生效」类指标 tone。
 *
 * @param before 打击前
 * @param after 打击后
 * @returns 语义 tone
 */
const increaseIsFavorableTone = (
  before: number | null | undefined,
  after: number | null | undefined
): ZhchPlanMetricDeltaTone => {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return 'neutral'
  const diff = Number(after) - Number(before)
  if (diff === 0) return 'neutral'
  return diff > 0 ? 'favorable' : 'adverse'
}

/**
 * 最早回传时间单元格（时间 + 链路描述）。
 *
 * @param raw 接口原始字段
 * @returns 单元格
 */
const buildFeedbackTimeCell = (raw?: string | null): ZhchPlanMetricCell => {
  const { time, link } = parseFeedbackTimeAndLink(raw)
  if (time === '无') {
    return { value: '无' }
  }
  const value = link && link !== '--' ? `${time}\n${link}` : time
  return { value }
}

/**
 * 由综合打击方案顶层字段构建「打击前 / 打击后」指标对比表。
 *
 * @param plan 综合打击方案
 * @returns 列定义与两行数据
 */
export const buildZhchPlanMetricsCompareTable = (
  plan: ZhchPlanResp
): ZhchPlanMetricsCompareTableModel => {
  const columns: ZhchPlanMetricColumnDef[] = [
    { key: 'satNum', label: '卫星数量', minWidth: 72 },
    { key: 'stationNum', label: '地面站', minWidth: 64 },
    { key: 'visibleWindowNum', label: '可见过境窗口', minWidth: 96 },
    { key: 'feedbackWindowNum', label: '数据回传窗口', minWidth: 96 },
    { key: 'visibleWindowStrikeNum', label: '压制窗口', minWidth: 80 },
    { key: 'avgCoverage', label: '平均覆盖率', minWidth: 88 },
    { key: 'firstFeedback', label: '最早回传时间', minWidth: 140 },
    { key: 'feedbackDelay', label: '回传延迟', minWidth: 88 },
  ]

  const beforeStrikeWindows = 0
  const afterStrikeWindows = plan.visibleWindowStrikeNum ?? 0

  const beforeCoverage = plan.beforeAvgCoverage
  const afterCoverage = plan.afterAvgCoverage

  const delayText = formatInterferenceDelay(plan.beforeFirstFeedbackTime, plan.afterFirstFeedbackTime)

  const beforeCells: Record<string, ZhchPlanMetricCell> = {
    satNum: { value: `${plan.satNum ?? '--'}颗` },
    stationNum: { value: `${plan.stationNum ?? '--'}座` },
    visibleWindowNum: { value: `${plan.visibleWindowNum ?? '--'}个` },
    feedbackWindowNum: { value: `${plan.feedbackWindowNum ?? '--'}个` },
    visibleWindowStrikeNum: { value: `${beforeStrikeWindows}个` },
    avgCoverage: { value: formatCoveragePercent(beforeCoverage) },
    firstFeedback: buildFeedbackTimeCell(plan.beforeFirstFeedbackTime),
    feedbackDelay: { value: '--' },
  }

  const afterCells: Record<string, ZhchPlanMetricCell> = {
    satNum: {
      value: `${plan.satNum ?? '--'}颗`,
      delta: formatSignedCountDelta(plan.satNum, plan.satNum, '颗'),
      deltaTone: 'neutral',
    },
    stationNum: {
      value: `${plan.stationNum ?? '--'}座`,
      delta: formatSignedCountDelta(plan.stationNum, plan.stationNum, '座'),
      deltaTone: 'neutral',
    },
    visibleWindowNum: {
      value: `${plan.visibleWindowNum ?? '--'}个`,
      delta: formatSignedCountDelta(plan.visibleWindowNum, plan.visibleWindowNum, '个'),
      deltaTone: 'neutral',
    },
    feedbackWindowNum: {
      value: `${plan.feedbackWindowNum ?? '--'}个`,
      delta: formatSignedCountDelta(plan.feedbackWindowNum, plan.feedbackWindowNum, '个'),
      deltaTone: 'neutral',
    },
    visibleWindowStrikeNum: {
      value: `${afterStrikeWindows}个`,
      delta: formatSignedCountDelta(beforeStrikeWindows, afterStrikeWindows, '个'),
      deltaTone: increaseIsFavorableTone(beforeStrikeWindows, afterStrikeWindows),
    },
    avgCoverage: {
      value: formatCoveragePercent(afterCoverage),
      delta: formatSignedCoverageDelta(beforeCoverage, afterCoverage),
      deltaTone: coverageDeltaTone(beforeCoverage, afterCoverage),
    },
    firstFeedback: buildFeedbackTimeCell(plan.afterFirstFeedbackTime),
    feedbackDelay: {
      value: delayText,
      valueTone:
        delayText !== '--' && delayText !== '0秒' ? 'adverse' : 'neutral',
    },
  }

  const rows: ZhchPlanMetricCompareRow[] = [
    { phase: 'before', phaseLabel: '打击前', cells: beforeCells },
    { phase: 'after', phaseLabel: '打击后', cells: afterCells },
  ]

  return { columns, rows }
}

/**
 * 由综合打击方案顶层字段构建方案概要单行指标表（表头为指标名，一行汇总值）。
 *
 * @param plan 综合打击方案
 * @returns 列定义与单元格
 */
export const buildZhchPlanSummaryMetricsTable = (
  plan: ZhchPlanResp
): ZhchPlanSummaryMetricsTableModel => {
  const columns: ZhchPlanMetricColumnDef[] = [
    { key: 'satNum', label: '卫星数量', minWidth: 72 },
    { key: 'stationNum', label: '地面站', minWidth: 64 },
    { key: 'visibleWindowNum', label: '可见过境窗口', minWidth: 96 },
    { key: 'feedbackWindowNum', label: '数据回传窗口', minWidth: 96 },
    { key: 'visibleWindowStrikeNum', label: '压制窗口', minWidth: 80 },
    { key: 'beforeCoverage', label: '打击前覆盖率', minWidth: 96 },
    { key: 'afterCoverage', label: '打击后覆盖率', minWidth: 96 },
    { key: 'coverageChange', label: '覆盖率变化', minWidth: 88 },
    { key: 'beforeFeedback', label: '打击前最早回传', minWidth: 132 },
    { key: 'afterFeedback', label: '打击后最早回传', minWidth: 132 },
    { key: 'feedbackDelay', label: '回传延迟', minWidth: 88 },
  ]

  const beforeCoverage = plan.beforeAvgCoverage
  const afterCoverage = plan.afterAvgCoverage
  const coverageDelta = formatSignedCoverageDelta(beforeCoverage, afterCoverage)
  const delayText = formatInterferenceDelay(plan.beforeFirstFeedbackTime, plan.afterFirstFeedbackTime)

  const cells: Record<string, ZhchPlanMetricCell> = {
    satNum: { value: `${plan.satNum ?? '--'}颗` },
    stationNum: { value: `${plan.stationNum ?? '--'}座` },
    visibleWindowNum: { value: `${plan.visibleWindowNum ?? '--'}个` },
    feedbackWindowNum: { value: `${plan.feedbackWindowNum ?? '--'}个` },
    visibleWindowStrikeNum: {
      value: `${plan.visibleWindowStrikeNum ?? 0}个`,
      valueTone:
        (plan.visibleWindowStrikeNum ?? 0) > 0 ? 'favorable' : 'neutral',
    },
    beforeCoverage: { value: formatCoveragePercent(beforeCoverage) },
    afterCoverage: { value: formatCoveragePercent(afterCoverage) },
    coverageChange: {
      value: coverageDelta?.replace(/^\(|\)$/g, '') ?? '--',
      valueTone: coverageDeltaTone(beforeCoverage, afterCoverage),
    },
    beforeFeedback: buildFeedbackTimeCell(plan.beforeFirstFeedbackTime),
    afterFeedback: buildFeedbackTimeCell(plan.afterFirstFeedbackTime),
    feedbackDelay: {
      value: delayText,
      valueTone: delayText !== '--' && delayText !== '0秒' ? 'adverse' : 'neutral',
    },
  }

  return { columns, cells }
}

/**
 * 打击前后对比表 → 通用表行视图。
 *
 * @param model 对比表模型
 * @returns 表格行
 */
export const toZhchPlanMetricsTableRowsFromCompare = (
  model: ZhchPlanMetricsCompareTableModel
): ZhchPlanMetricsTableRowView[] =>
  model.rows.map((row) => ({
    rowKey: row.phase,
    rowLabel: row.phaseLabel,
    rowVariant: row.phase,
    showDelta: row.phase === 'after',
    cells: row.cells,
  }))

/**
 * 方案概要表 → 通用表行视图（单行）。
 *
 * @param model 概要表模型
 * @returns 表格行
 */
export const toZhchPlanMetricsTableRowsFromSummary = (
  model: ZhchPlanSummaryMetricsTableModel
): ZhchPlanMetricsTableRowView[] => [
  {
    rowKey: 'summary',
    rowVariant: 'summary',
    showDelta: false,
    cells: model.cells,
  },
]

/**
 * 天基侦察能力单指标打击前/后取值（与后端 `ReconCapabilityMetrics` 对齐）。
 */
export interface ReconCapabilityMetricValues {
  /** 侦察卫星过境数量 */
  transitCount: number
  /** 侦察卫星最早过境时间（展示字符串） */
  earliestTransitTime: string
  /** 最早数据回传时间（展示字符串） */
  earliestDataReturnTime: string
  /** 侦察卫星覆盖时段百分比（0–100） */
  coverageTimePercent: number
}

/**
 * 通信保障能力单指标打击前/后取值（与后端 `CommCapabilityMetrics` 对齐）。
 */
export interface CommCapabilityMetricValues {
  /** 覆盖范围（如 78% 或 560km，展示字符串） */
  coverageRange: string
  /** 重访时间（展示字符串，如 4.2小时） */
  revisitTime: string
  /** 处理时延（分钟，用于差值计算） */
  processingDelayMin: number
  /** 链路质量（0–1 或等级，展示字符串） */
  linkQuality: string
  /** 通信容量（展示字符串，如 1.2Gbps） */
  commCapacity: string
}

/**
 * 能力指标打击前/后快照（接口未就绪前的占位结构）。
 */
export interface ZhchPlanCapabilityMetricsMock {
  /** 天基侦察：打击前 */
  reconBefore: ReconCapabilityMetricValues
  /** 天基侦察：打击后 */
  reconAfter: ReconCapabilityMetricValues
  /** 通信保障：打击前 */
  commBefore: CommCapabilityMetricValues
  /** 通信保障：打击后 */
  commAfter: CommCapabilityMetricValues
}

/**
 * 根据方案规模生成略有差异的假数据（接入 API 后替换为 `plan.reconCapability` 等字段）。
 *
 * @param plan 综合打击方案
 * @returns 能力指标 mock
 */
export const buildMockZhchPlanCapabilityMetrics = (
  plan: ZhchPlanResp
): ZhchPlanCapabilityMetricsMock => {
  const scale = Math.min(1.2, Math.max(0.85, (plan.visibleWindowNum || 100) / 200))
  const covBefore = plan.beforeAvgCoverage ?? 48
  const covAfter = plan.afterAvgCoverage ?? 17

  return {
    reconBefore: {
      transitCount: Math.round(186 * scale),
      earliestTransitTime: '2026-09-16 07:42:11',
      earliestDataReturnTime: plan.beforeFirstFeedbackTime?.split('(')[0]?.trim() || '2026-09-16 08:07:19',
      coverageTimePercent: Number((covBefore * 1.05).toFixed(2)),
    },
    reconAfter: {
      transitCount: Math.round(112 * scale),
      earliestTransitTime: '2026-09-16 08:05:33',
      earliestDataReturnTime: plan.afterFirstFeedbackTime?.split('(')[0]?.trim() || '2026-09-16 08:27:34',
      coverageTimePercent: Number((covAfter * 0.95).toFixed(2)),
    },
    commBefore: {
      coverageRange: `${Math.min(99, covBefore + 30).toFixed(1)}%`,
      revisitTime: `${(4.2 * scale).toFixed(1)}小时`,
      processingDelayMin: Number((12.5 * scale).toFixed(1)),
      linkQuality: '0.91',
      commCapacity: `${(2.4 * scale).toFixed(1)}Gbps`,
    },
    commAfter: {
      coverageRange: `${Math.max(8, covAfter + 5).toFixed(1)}%`,
      revisitTime: `${(6.8 * scale).toFixed(1)}小时`,
      processingDelayMin: Number((28.3 * scale).toFixed(1)),
      linkQuality: '0.62',
      commCapacity: `${(1.1 * scale).toFixed(1)}Gbps`,
    },
  }
}

/**
 * 数值差值着色策略（相对打击效果）。
 */
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
