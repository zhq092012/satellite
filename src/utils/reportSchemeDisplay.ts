import type {
  ReportCandidateSatellite,
  ReportGenerateResp,
  ReportMetrics,
  ReportQuotaLine,
  ReportStageResult,
  ReportTierResult,
  SchemeResult,
  StrikePlan,
} from '@/types/report/report'
import {
  buildSyntheticStageFromStrikePlans,
  deriveStrikePlanAttainment,
  groupStrikePlansByStageCode,
} from '@/utils/strikePlanReportAdapter'

/** 按阶段分组的方案格子（同一 stage 只展示一次三档对比） */
export interface ReportStageSchemeGroup {
  /** 阶段编码 */
  stageCode: string
  /** 阶段标题（名称 + 编码） */
  title: string
  /** 匹配到的 stage 实体 */
  stage?: ReportStageResult
  /** 本阶段下的 scheme code 列表 */
  schemeCodes: string[]
}

/** 报告选星明细表一行（仅含接口有值的展示字段） */
export interface ReportSchemeSelectedRow {
  /** 卫星名称（优先接口 name） */
  name: string
  /** NORAD */
  noradId?: string
  /** 国家 */
  country?: string
  /** 体系 */
  system?: string
  /** 系列 */
  series?: string
  /** 用途 */
  usage?: string
  /** 配额角色展示文案 */
  quotaRoleText?: string
  /** 已受扰次数展示 */
  usedTimesText?: string
  /** 威胁度展示 */
  threatText?: string
  /** 综合得分 */
  scoreText?: string
  /** 入选原因 */
  reasonText?: string
  /** 可用时间窗 */
  windowText?: string
  /** 是否在时间窗内 */
  inTimeWindow?: boolean
}

/** 阶段三档对比表行 */
export interface ReportStageTierCompareRow {
  /** 档位序号 */
  index?: number
  /** 档位展示名 */
  label: string
  /** 目标总数 */
  targetSize?: number
  /** 达成度文案 */
  attainmentText: string
  /** 综合分文案 */
  scoreText: string
  /** 是否推荐档 */
  recommended: boolean
  /** 是否为当前方案所在档 */
  current: boolean
  /** 档位建议 */
  advice?: string
}

/** 跨方案对比行 */
export interface ReportSchemeCompareRow {
  /** 格子 code */
  code: string
  /** 方案名称 */
  name: string
  /** 阶段 */
  stageText?: string
  /** 档位 */
  tierText?: string
  /** 选星数 */
  targetSize?: number
  /** 达成度 */
  attainmentText: string
  /** 综合分 */
  scoreText: string
  /** 求解口径 */
  solverCaliber?: string
}

/** 配额表展示行 */
export interface ReportSchemeQuotaRow {
  /** 体系桶 */
  system: string
  /** 模式 */
  mode?: string
  /** 要求 / 实际 */
  countText: string
  /** 是否满足 */
  satisfied?: boolean
  /** 附加说明 */
  note?: string
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
 * 配额角色 → 展示文案。
 *
 * @param role 接口 quotaRole
 */
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
 * 为单个 scheme 匹配 stages 中的阶段实体。
 *
 * @param stages 报告阶段列表
 * @param scheme 扁平方案格子
 */
export const resolveReportStageForScheme = (
  stages: ReportStageResult[] | undefined,
  scheme: SchemeResult,
): ReportStageResult | undefined => {
  const list = stages ?? []
  if (!list.length) return undefined
  const stageCode =
    scheme.stageCode?.trim() || parseReportStageCodeFromSchemeCode(scheme.code) || undefined
  if (!stageCode) return undefined
  return list.find((s) => s.code?.trim() === stageCode)
}

/**
 * 构建阶段三档对比表（高亮推荐档与一个或多个当前档）。
 *
 * @param stage 阶段
 * @param currentTierIndexes 本阶段已展示格子的档位序号集合
 */
export const buildReportStageTierCompareRows = (
  stage: ReportStageResult,
  currentTierIndexes?: Iterable<number>,
): ReportStageTierCompareRow[] => {
  const recommended = stage.recommendedTier
  const currentSet = currentTierIndexes ? new Set(currentTierIndexes) : new Set<number>()
  return (stage.tiers ?? []).map((tier: ReportTierResult) => {
    const index = tier.index
    const label = tier.name?.trim() || (index != null ? `档${index}` : '—')
    return {
      index,
      label,
      targetSize: tier.targetSize,
      attainmentText: formatReportNumber(tier.attainment, 3) ?? '—',
      scoreText: formatReportNumber(tier.metrics?.score, 3) ?? '—',
      recommended: recommended != null && index === recommended,
      current: index != null && currentSet.has(index),
      advice: tier.advice?.trim(),
    }
  })
}

/**
 * 将入选卫星行拼成一行辅助说明（卡片模式用）。
 *
 * @param row 选星行
 */
export const formatReportSelectedRowMeta = (row: ReportSchemeSelectedRow): string => {
  const parts: string[] = []
  if (row.noradId) parts.push(row.noradId)
  if (row.system) parts.push(row.system)
  if (row.quotaRoleText) parts.push(row.quotaRoleText)
  if (row.scoreText) parts.push(`得分 ${row.scoreText}`)
  else if (row.threatText) parts.push(`威胁 ${row.threatText}`)
  return parts.join(' · ')
}

/**
 * 按 stage 分组全部 scheme code（保持 code 排序）。
 *
 * @param report 报告
 */
export const buildReportStageSchemeGroups = (report: ReportGenerateResp | null): ReportStageSchemeGroup[] => {
  const schemes = report?.schemes ?? []
  const strikePlans = report?.strikePlans ?? []
  const useLegacySchemes = schemes.length > 0

  const groupMap = new Map<string, string[]>()
  const sourceList = useLegacySchemes ? schemes : strikePlans
  for (const item of sourceList) {
    const gridCode = item.code?.trim()
    if (!gridCode) continue
    const stageCode =
      item.stageCode?.trim() || parseReportStageCodeFromSchemeCode(gridCode) || '未分组'
    const list = groupMap.get(stageCode) ?? []
    list.push(gridCode)
    groupMap.set(stageCode, list)
  }

  const stages = report?.stages ?? []
  const strikeByStage = useLegacySchemes ? null : groupStrikePlansByStageCode(strikePlans)
  const groups: ReportStageSchemeGroup[] = []

  for (const [stageCode, codes] of groupMap.entries()) {
    const sortedCodes = [...codes].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    const legacyStage = stages.find((s) => s.code?.trim() === stageCode)
    const syntheticStage =
      !legacyStage && strikeByStage
        ? buildSyntheticStageFromStrikePlans(stageCode, strikeByStage.get(stageCode) ?? [])
        : undefined
    const stage = legacyStage ?? syntheticStage
    const name = stage?.name?.trim()
    const title = name ? `${name}（${stageCode}）` : stageCode
    groups.push({ stageCode, title, stage, schemeCodes: sortedCodes })
  }
  return groups.sort((a, b) => a.stageCode.localeCompare(b.stageCode, 'zh-CN', { numeric: true }))
}

/**
 * 收集某阶段下全部格子的 tierIndex。
 *
 * @param schemes 扁平方案列表
 * @param schemeCodes 本组 code
 */
export const collectReportTierIndexesForCodes = (
  schemes: SchemeResult[] | undefined,
  schemeCodes: string[],
): number[] => {
  const codeSet = new Set(schemeCodes)
  const indexes: number[] = []
  for (const scheme of schemes ?? []) {
    const code = scheme.code?.trim()
    if (!code || !codeSet.has(code)) continue
    if (scheme.tierIndex != null && Number.isFinite(scheme.tierIndex)) {
      indexes.push(scheme.tierIndex)
    }
  }
  return indexes
}

/**
 * 多方案横向对比行（用于页底对比表）。
 *
 * @param schemes 全部扁平方案
 */
/**
 * 由打击方案列表构建跨方案对比行（新接口仅有 strikePlans 时使用）。
 *
 * @param plans 打击方案列表
 */
export const buildReportStrikePlansCompareRows = (plans: StrikePlan[]): ReportSchemeCompareRow[] =>
  plans
    .map((plan) => {
      const code = plan.code?.trim()
      if (!code) return null
      const stageCode = plan.stageCode?.trim() || parseReportStageCodeFromSchemeCode(code)
      const stageName = plan.stageName?.trim()
      const stageText =
        stageName && stageCode ? `${stageName}（${stageCode}）` : stageName || stageCode
      const attainment = deriveStrikePlanAttainment(plan.comparison)
      return {
        code,
        name: plan.name?.trim() || code,
        stageText,
        tierText: plan.tierIndex != null ? `规模${plan.tierIndex}` : undefined,
        targetSize: plan.targetSize,
        attainmentText: formatReportNumber(attainment, 3) ?? '—',
        scoreText: '—',
        solverCaliber: undefined,
      }
    })
    .filter((row): row is ReportSchemeCompareRow => row != null)

/**
 * 按报告响应选择对比行来源（legacy schemes 或 strikePlans）。
 *
 * @param report 报告响应
 */
export const buildReportCompareRowsFromReport = (
  report: ReportGenerateResp | null,
): ReportSchemeCompareRow[] => {
  const schemes = report?.schemes ?? []
  if (schemes.length) return buildReportSchemesCompareRows(schemes)
  return buildReportStrikePlansCompareRows(report?.strikePlans ?? [])
}

export const buildReportSchemesCompareRows = (schemes: SchemeResult[]): ReportSchemeCompareRow[] =>
  schemes
    .map((scheme) => {
      const code = scheme.code?.trim()
      if (!code) return null
      const stageCode = scheme.stageCode?.trim() || parseReportStageCodeFromSchemeCode(code)
      const stageName = scheme.stageName?.trim()
      const stageText =
        stageName && stageCode ? `${stageName}（${stageCode}）` : (stageName || stageCode)
      return {
        code,
        name: scheme.name?.trim() || code,
        stageText,
        tierText: scheme.scale?.trim() || (scheme.tierIndex != null ? `档${scheme.tierIndex}` : undefined),
        targetSize: scheme.targetSize,
        attainmentText: formatReportNumber(scheme.attainment, 3) ?? '—',
        scoreText: formatReportNumber(scheme.metrics?.score, 3) ?? '—',
        solverCaliber: scheme.solverCaliber?.trim(),
      }
    })
    .filter((row): row is ReportSchemeCompareRow => row != null)

export const formatReportQuotaRole = (role?: string): string | undefined => {
  const key = role?.trim()
  if (!key) return undefined
  switch (key) {
    case 'forced':
      return '强制'
    case 'chosen':
      return '选择胜出'
    case 'runner-up':
      return '替补'
    default:
      return key
  }
}

/**
 * 按卫星字段依次尝试匹配 map 键（satelliteId / noradId / name）。
 *
 * @param sat 候选卫星
 * @param map 评分或原因 map
 */
export const lookupReportSchemeMapValue = (
  sat: ReportCandidateSatellite,
  map: Record<string, string | number> | undefined,
): string | number | undefined => {
  if (!map) return undefined
  const keys = [sat.satelliteId?.trim(), sat.noradId?.trim(), sat.name?.trim()].filter(
    Boolean,
  ) as string[]
  for (const key of keys) {
    if (key in map) return map[key]
  }
  return undefined
}

/**
 * 将接口 `SchemeResult.selected` 转为表格行。
 *
 * @param scheme 方案
 */
export const buildReportSchemeSelectedRows = (scheme: SchemeResult): ReportSchemeSelectedRow[] => {
  const list = scheme.selected ?? []
  const rows: ReportSchemeSelectedRow[] = []
  for (const sat of list) {
    const name = sat.name?.trim()
    if (!name) continue

    const scoreRaw = lookupReportSchemeMapValue(sat, scheme.selectedScores)
    const reasonRaw = lookupReportSchemeMapValue(sat, scheme.selectedReasons)
    const score =
      typeof scoreRaw === 'number'
        ? scoreRaw
        : scoreRaw != null
          ? Number(scoreRaw)
          : Number.NaN
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : ''

    const row: ReportSchemeSelectedRow = { name }

    const norad = sat.noradId?.trim()
    if (norad) row.noradId = norad

    const country = sat.country?.trim()
    if (country) row.country = country

    const system = sat.system?.trim()
    if (system) row.system = system

    const series = sat.series?.trim()
    if (series) row.series = series

    const usage = sat.usage?.trim()
    if (usage) row.usage = usage

    const quotaRoleText = formatReportQuotaRole(sat.quotaRole)
    if (quotaRoleText) row.quotaRoleText = quotaRoleText

    if (sat.usedTimes != null && Number.isFinite(sat.usedTimes)) {
      row.usedTimesText = String(sat.usedTimes)
    }

    if (sat.threat != null && Number.isFinite(sat.threat)) {
      row.threatText = sat.threat.toFixed(3)
    }

    if (Number.isFinite(score)) {
      row.scoreText = score.toFixed(4)
    }

    if (reason) {
      row.reasonText = reason
    }

    if (sat.timeWindowStart?.trim() && sat.timeWindowEnd?.trim()) {
      row.windowText = `${sat.timeWindowStart.trim()} ~ ${sat.timeWindowEnd.trim()}`
    }

    if (sat.inTimeWindow != null) {
      row.inTimeWindow = sat.inTimeWindow
    }

    rows.push(row)
  }
  return rows
}

/**
 * 方案 metrics → 概要字段。
 *
 * @param metrics 收益指标
 */
export const buildReportMetricsSummaryFields = (
  metrics?: ReportMetrics,
  compact = false,
): Array<{ label: string; value: string }> => {
  if (!metrics) return []
  const items: Array<{ label: string; value: string }> = []
  const push = (label: string, shortLabel: string, value?: string) => {
    if (value) items.push({ label: compact ? shortLabel : label, value })
  }
  push('覆盖收益 B_cov', 'B_cov', formatReportNumber(metrics.benefitCover, 3))
  push('断链收益 B_pers', 'B_pers', formatReportNumber(metrics.benefitPersist, 3))
  push('体系收益 B_sos', 'B_sos', formatReportNumber(metrics.benefitSos, 3))
  push('综合收益 B', 'B', formatReportNumber(metrics.benefit, 3))
  push('风险 Risk', 'Risk', formatReportNumber(metrics.risk, 3))
  push('综合分 Score', 'Score', formatReportNumber(metrics.score, 3))
  return items
}

/**
 * 配额明细 → 表格行。
 *
 * @param quota 配额列表
 */
export const buildReportSchemeQuotaRows = (quota?: ReportQuotaLine[]): ReportSchemeQuotaRow[] => {
  if (!quota?.length) return []
  return quota
    .map((line) => {
      const system = line.system?.trim()
      if (!system) return null
      const required = line.required
      const selected = line.selected
      let countText = ''
      if (required != null && selected != null) {
        countText = `${selected} / ${required}`
      } else if (selected != null) {
        countText = String(selected)
      } else if (required != null) {
        countText = `需 ${required}`
      }
      const notes: string[] = []
      if (line.mode?.trim()) notes.push(line.mode.trim())
      if (line.forced) notes.push('强制集')
      if (line.satisfied === false) notes.push('未满足')
      return {
        system,
        mode: line.mode?.trim(),
        countText: countText || '—',
        satisfied: line.satisfied,
        note: notes.length ? notes.join(' · ') : undefined,
      }
    })
    .filter((row): row is ReportSchemeQuotaRow => row != null)
}

/**
 * 方案概要卡片字段（仅非空）。
 *
 * @param scheme 方案
 * @param taskName 任务名称
 */
export const buildReportSchemeSummaryFields = (
  scheme: SchemeResult,
  taskName?: string,
): Array<{ label: string; value: string }> => {
  const items: Array<{ label: string; value: string }> = []
  const push = (label: string, value?: string) => {
    const text = value?.trim()
    if (text) items.push({ label, value: text })
  }

  push('任务', taskName)
  push('方案名称', scheme.name)
  if (scheme.stageName?.trim() || scheme.stageCode?.trim()) {
    const stageCode = scheme.stageCode?.trim()
    const stageName = scheme.stageName?.trim()
    const stageText =
      stageName && stageCode ? `${stageName}（${stageCode}）` : (stageName || stageCode)
    if (stageText) items.push({ label: '阶段', value: stageText })
  }
  push('对手方', scheme.country)
  push('档位', scheme.scale)
  if (scheme.tierIndex != null && Number.isFinite(scheme.tierIndex)) {
    items.push({ label: '档位序号', value: String(scheme.tierIndex) })
  }
  push('作战目标', scheme.objective)
  if (scheme.targetSize != null && Number.isFinite(scheme.targetSize)) {
    items.push({ label: '选星数量', value: String(scheme.targetSize) })
  }
  if (scheme.forcedSize != null && Number.isFinite(scheme.forcedSize)) {
    items.push({ label: '强制集', value: String(scheme.forcedSize) })
  }
  if (scheme.chosenSize != null && Number.isFinite(scheme.chosenSize)) {
    items.push({ label: '选择集', value: String(scheme.chosenSize) })
  }
  const attainment = formatReportNumber(scheme.attainment, 3)
  if (attainment) {
    items.push({ label: '达成度', value: attainment })
  }
  push('求解口径', scheme.solverCaliber)
  if (scheme.selectedTruncated) {
    items.push({
      label: '明细截断',
      value: '入选列表已截断，完整逐星与系列归因见同阶段三档对比（stages）',
    })
  }
  return items
}

/**
 * 阶段级综合字段（匹配 stage 顶部展示）。
 *
 * @param stage 阶段
 */
export const buildReportStageSummaryFields = (
  stage: ReportStageResult,
): Array<{ label: string; value: string }> => {
  const items: Array<{ label: string; value: string }> = []
  const push = (label: string, value?: string) => {
    const text = value?.trim()
    if (text) items.push({ label, value: text })
  }
  const code = stage.code?.trim()
  const name = stage.name?.trim()
  if (name && code) push('阶段', `${name}（${code}）`)
  else push('阶段', name || code)
  push('对手方', stage.country)
  push('作战预期', stage.expectation)
  push('推荐结论', stage.recommendation)
  if (stage.poolSize != null && Number.isFinite(stage.poolSize)) {
    items.push({ label: '阶段池', value: String(stage.poolSize) })
  }
  const ceilingAtt = formatReportNumber(stage.ceilingAttainment, 3)
  if (ceilingAtt) items.push({ label: '池达成度', value: ceilingAtt })
  if (stage.recommendedTier != null) {
    items.push({ label: '推荐档位', value: `档${stage.recommendedTier}` })
  }
  if (stage.reusedTargets != null) {
    items.push({ label: '跨阶段复扰', value: String(stage.reusedTargets) })
  }
  return items
}

/**
 * 判断某列在选星表中是否应展示。
 *
 * @param rows 选星行
 * @param pick 取值函数
 */
export const reportTableColumnVisible = (
  rows: ReportSchemeSelectedRow[],
  pick: (row: ReportSchemeSelectedRow) => string | boolean | undefined,
): boolean =>
  rows.some((row) => {
    const v = pick(row)
    if (typeof v === 'boolean') return true
    return Boolean(v?.trim())
  })
