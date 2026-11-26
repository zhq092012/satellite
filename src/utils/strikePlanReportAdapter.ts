import type { ReportGenerateResp, StrikePlan } from '@/types/report/report'
import { deriveStrikePlanAttainment } from '@/utils/strikePlanDisplay'

const parseStageCodeFromSchemeCode = (gridCode?: string): string | undefined => {
  const code = gridCode?.trim()
  if (!code) return undefined
  const dash = code.indexOf('-')
  if (dash <= 0) return code
  return code.slice(0, dash).trim() || undefined
}

export { deriveStrikePlanAttainment }

/**
 * 收集报告中全部方案 code（`strikePlans`）。
 *
 * @param report 报告响应
 */
export const listReportSchemeCodes = (report: ReportGenerateResp | null): string[] => {
  const codes: string[] = []
  for (const plan of report?.strikePlans ?? []) {
    const code = plan.code?.trim()
    if (code) codes.push(code)
  }
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
}

/**
 * 按阶段编码聚合打击方案（用于跨阶段汇总等）。
 *
 * @param strikePlans 全部打击方案
 */
export const groupStrikePlansByStageCode = (
  strikePlans: StrikePlan[] | undefined,
): Map<string, StrikePlan[]> => {
  const groupMap = new Map<string, StrikePlan[]>()
  for (const plan of strikePlans ?? []) {
    const gridCode = plan.code?.trim()
    if (!gridCode) continue
    const stageCode = plan.stageCode?.trim() || parseStageCodeFromSchemeCode(gridCode) || '未分组'
    const list = groupMap.get(stageCode) ?? []
    list.push(plan)
    groupMap.set(stageCode, list)
  }
  return groupMap
}