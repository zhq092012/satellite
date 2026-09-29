import type { ZhchPlanResp } from '@/api/electronic'
import type {
  ZhchPlanMetricCell,
  ZhchPlanMetricCompareRow,
  ZhchPlanMetricDeltaTone,
  ZhchPlanMetricsCompareTableModel,
  ZhchPlanMetricColumnDef,
} from '@/utils/buildZhchPlanMetricsCompareTable'
import { formatCoveragePercent } from '@/utils/zhchPlanDisplay'
import {
  buildMockZhchPlanCapabilityMetrics,
  type CommCapabilityMetricValues,
  type ReconCapabilityMetricValues,
} from '@/utils/mockZhchPlanCapabilityMetrics'

/** 数值差值着色策略（相对打击效果） */
type CapabilityNumericDeltaPolicy = 'neutral' | 'lower-favorable' | 'higher-favorable'

/**
 * 格式化带单位的整数差值。
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
  if (diff === 0) return `(+0${unit})`
  const sign = diff > 0 ? '+' : ''
  return `(${sign}${Number.isInteger(diff) ? diff : diff.toFixed(1)}${unit})`
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
    earliestTransit: { value: after.earliestTransitTime },
    earliestReturn: { value: after.earliestDataReturnTime },
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
    coverageRange: { value: after.coverageRange },
    revisitTime: { value: after.revisitTime },
    processingDelay: buildAfterCell(
      `${after.processingDelayMin}分钟`,
      before.processingDelayMin,
      after.processingDelayMin,
      '分钟',
      'higher-favorable'
    ),
    linkQuality: { value: after.linkQuality },
    commCapacity: { value: after.commCapacity },
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
