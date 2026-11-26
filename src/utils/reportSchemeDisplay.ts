import type { ReportGenerateResp, StrikePlan } from '@/types/report/report'
import { deriveStrikePlanAttainment } from '@/utils/strikePlanDisplay'

/** 跨方案对比行（多选方案时汇总表，可选） */
export interface ReportSchemeCompareRow {
  /** 格子 code */
  code: string
  /** 方案名称 */
  name: string
  /** 阶段展示文案 */
  stageText?: string
  /** 规模档位 */
  tierText?: string
  /** 被打击目标数 */
  targetSize?: number
  /** 达成度（由打击前总数与 targetSize 推导） */
  attainmentText: string
}

/**
 * 将有限数值格式化为固定小数位；非法则返回 undefined。
 *
 * @param value 数值
 * @param digits 小数位
 */
export const formatReportNumber = (value: number | undefined, digits = 4): string | undefined => {
  if (value == null || !Number.isFinite(value)) return undefined
  return value.toFixed(digits)
}

/**
 * 从格子编码解析阶段 code（`P1-T2` → `P1`）。
 *
 * @param gridCode 方案格子 code
 */
export const parseReportStageCodeFromSchemeCode = (gridCode?: string): string | undefined => {
  const code = gridCode?.trim()
  if (!code) return undefined
  const dash = code.indexOf('-')
  if (dash <= 0) return code
  return code.slice(0, dash).trim() || undefined
}

/**
 * 由打击方案列表构建跨方案对比行。
 *
 * @param plans `ReportGenerateResp.strikePlans`
 */
export const buildReportStrikePlansCompareRows = (plans: StrikePlan[]): ReportSchemeCompareRow[] =>
  plans
    .map((plan): ReportSchemeCompareRow | null => {
      const code = plan.code?.trim()
      if (!code) return null
      const stageCode = plan.stageCode?.trim() || parseReportStageCodeFromSchemeCode(code)
      const stageName = plan.stageName?.trim()
      const stageText =
        stageName && stageCode ? `${stageName}（${stageCode}）` : stageName || stageCode
      const attainment = deriveStrikePlanAttainment(plan)
      const row: ReportSchemeCompareRow = {
        code,
        name: plan.name?.trim() || code,
        attainmentText: formatReportNumber(attainment, 3) ?? '—',
      }
      if (stageText) row.stageText = stageText
      if (plan.tierIndex != null) row.tierText = `规模${plan.tierIndex}`
      if (plan.targetSize != null) row.targetSize = plan.targetSize
      return row
    })
    .filter((row): row is ReportSchemeCompareRow => row !== null)

/**
 * 由报告响应构建跨方案对比行（仅 `strikePlans`）。
 *
 * @param report 报告响应
 */
export const buildReportCompareRowsFromReport = (
  report: ReportGenerateResp | null,
): ReportSchemeCompareRow[] => buildReportStrikePlansCompareRows(report?.strikePlans ?? [])