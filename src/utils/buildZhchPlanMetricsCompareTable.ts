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
