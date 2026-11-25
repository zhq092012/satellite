import type {
  ReportCandidateSatellite,
  ReportGenerateResp,
  ReportStageResult,
  ReportStrikeComparison,
  ReportTierResult,
  SchemeResult,
  StrikePlan,
  StruckSatellite,
} from '@/types/report/report'
const parseStageCodeFromSchemeCode = (gridCode?: string): string | undefined => {
  const code = gridCode?.trim()
  if (!code) return undefined
  const dash = code.indexOf('-')
  if (dash <= 0) return code
  return code.slice(0, dash).trim() || undefined
}

/**
 * 从打击前后「卫星数量」变化推导展示用达成度（被打击数 / 打击前总数）。
 * 仅当接口提供 beforeTotal 与 struckTotal 时返回数值；无依据时不捏造默认值。
 *
 * @param comparison 打击方案比对块
 */
export const deriveStrikePlanAttainment = (
  comparison: ReportStrikeComparison | undefined,
): number | undefined => {
  const change = comparison?.satelliteCount
  if (!change || change.beforeTotal == null || change.beforeTotal <= 0) return undefined
  if (change.struckTotal == null || !Number.isFinite(change.struckTotal)) return undefined
  const ratio = change.struckTotal / change.beforeTotal
  return Number.isFinite(ratio) ? ratio : undefined
}

/**
 * 将接口 `StruckSatellite` 转为选星表兼容的 `ReportCandidateSatellite`。
 *
 * @param sat 被打击卫星
 */
const struckSatelliteToCandidate = (sat: StruckSatellite): ReportCandidateSatellite => ({
  noradId: sat.noradId,
  name: sat.name,
  country: sat.country,
  system: sat.system,
  series: sat.series,
  threat: sat.threat,
  quotaRole: sat.quotaRole,
})

/**
 * 将 `StrikePlan` 映射为页面仍使用的 `SchemeResult` 视图（入选明细来自被打击清单）。
 *
 * @param plan 打击方案
 */
export const strikePlanToSchemeResult = (plan: StrikePlan): SchemeResult => {
  const code = plan.code?.trim() ?? ''
  const tierIndex = plan.tierIndex
  return {
    code,
    name: plan.name,
    stageCode: plan.stageCode,
    stageName: plan.stageName,
    country: plan.country,
    tierIndex,
    targetSize: plan.targetSize,
    scale: tierIndex != null ? `规模${tierIndex}` : undefined,
    selectedTruncated: plan.satellitesTruncated,
    selected: (plan.satellites ?? []).map(struckSatelliteToCandidate),
    attainment: deriveStrikePlanAttainment(plan.comparison),
  }
}

/**
 * 按同阶段全部打击方案合成三档对比用的 `ReportStageResult`（无 legacy `stages` 时）。
 *
 * @param stageCode 阶段编码
 * @param plans 该阶段下全部打击方案
 */
export const buildSyntheticStageFromStrikePlans = (
  stageCode: string,
  plans: StrikePlan[],
): ReportStageResult => {
  const sorted = [...plans].sort((a, b) => (a.tierIndex ?? 0) - (b.tierIndex ?? 0))
  const head = sorted[0]
  const tiers: ReportTierResult[] = sorted.map((plan) => ({
    index: plan.tierIndex,
    name: plan.name?.trim() || (plan.tierIndex != null ? `规模${plan.tierIndex}` : undefined),
    targetSize: plan.targetSize,
    attainment: deriveStrikePlanAttainment(plan.comparison),
  }))
  return {
    code: stageCode,
    name: head?.stageName,
    country: head?.country,
    tiers,
  }
}

/**
 * 收集报告中全部方案格子 code：优先 legacy `schemes`，否则 `strikePlans`。
 *
 * @param report 报告响应
 */
export const listReportSchemeCodes = (report: ReportGenerateResp | null): string[] => {
  const codes: string[] = []
  const schemes = report?.schemes ?? []
  if (schemes.length) {
    for (const scheme of schemes) {
      const code = scheme.code?.trim()
      if (code) codes.push(code)
    }
  } else {
    for (const plan of report?.strikePlans ?? []) {
      const code = plan.code?.trim()
      if (code) codes.push(code)
    }
  }
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
}

/**
 * 构建 code → `SchemeResult` 映射：legacy `schemes` 优先；仅打击方案时由 `StrikePlan` 映射。
 *
 * @param report 报告响应
 */
export const buildSchemeByCodeMap = (report: ReportGenerateResp | null): Map<string, SchemeResult> => {
  const map = new Map<string, SchemeResult>()
  for (const scheme of report?.schemes ?? []) {
    const code = scheme.code?.trim()
    if (!code) continue
    map.set(code, scheme)
  }
  if (map.size === 0) {
    for (const plan of report?.strikePlans ?? []) {
      const code = plan.code?.trim()
      if (!code) continue
      map.set(code, strikePlanToSchemeResult(plan))
    }
  }
  return map
}

/**
 * 按阶段编码聚合打击方案（用于合成三档对比）。
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