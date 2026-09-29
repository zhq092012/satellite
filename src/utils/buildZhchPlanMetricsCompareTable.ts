import type { ZhchPlanResp } from '@/api/electronic'
import {
  formatCoveragePercent,
  formatInterferenceDelay,
  parseFeedbackTimeAndLink,
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
