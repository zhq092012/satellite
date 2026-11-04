import type { ZhchPlanResp } from '@/api/electronic'
import type { C2ResourceSatelliteRow } from '@/utils/buildC2ResourceCatalog'
import {
  buildStrikePlanDisplayName,
  loadCombatScenarioForTaskOrDefault,
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  COMMAND_SOURCE_OPTIONS,
} from '@/config/combatScenarioOptions'
import {
  formatCoverageReduction,
  formatStrikeDelayDuration,
} from '@/utils/zhchPlanDisplay'

/** 方案概要字段（页面顶部依次展示） */
export interface StrikePlanSchemeMeta {
  /** 方案名称（作战阶段-作战预期一级） */
  planName: string
  /** 作战背景 */
  combatBackground: string
  /** 命令来源 */
  commandSource: string
  /** 作战阶段 */
  combatPhase: string
  /** 作战预期（一级/二级） */
  combatExpectation: string
  /** 分析结果（打击计划叙述） */
  analysisResult: string
  /** 方案描述 */
  planDescription: string
}

/** 卫星清单行 */
export interface StrikePlanSatelliteRow {
  /** 所属国家 */
  country: string
  /** 卫星名称 */
  satelliteName: string
  /** 卫星类型 */
  satelliteType: string
  /** 卫星系列 */
  series: string
}

/** 打击计划行（导出与表格共用） */
export interface StrikePlanStrikeRow {
  /** 所属国家 */
  country: string
  /** 卫星名称 */
  satelliteName: string
  /** 卫星类型 */
  satelliteType: string
  /** 卫星系列 */
  series: string
  /** 武器名称 */
  weaponName: string
  /** 武器类型 */
  weaponType: string
  /** 打击窗口 */
  attackWindow: string
}

/** 单方案完整视图 */
export interface StrikePlanSchemeView {
  /** 用途类型键（军用/民用/军用民用） */
  usageType: string
  /** 概要字段 */
  meta: StrikePlanSchemeMeta
  /** 卫星列表 */
  satellites: StrikePlanSatelliteRow[]
  /** 打击计划列表 */
  strikePlans: StrikePlanStrikeRow[]
  /** 原始方案（能力对比表复用） */
  plan: ZhchPlanResp
}

const EMPTY = '--'

/**
 * 解析作战场景展示字段。
 *
 * @param taskId 任务 ID
 */
function resolveCombatScenarioLabels(taskId: number): Pick<
  StrikePlanSchemeMeta,
  'combatBackground' | 'commandSource' | 'combatPhase' | 'combatExpectation'
> {
  const selection = loadCombatScenarioForTaskOrDefault(taskId)
  const bg =
    COMBAT_BACKGROUND_OPTIONS.find((o) => o.id === selection.backgroundId)?.label ??
    selection.backgroundId
  const cmd =
    COMMAND_SOURCE_OPTIONS.find((o) => o.id === selection.commandSourceId)?.label ??
    selection.commandSourceId
  const phase =
    COMBAT_PHASE_OPTIONS.find((o) => o.id === selection.combatPhaseId)?.label ??
    selection.combatPhaseId
  const expPrimary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find(
    (o) => o.id === selection.expectationPrimaryId,
  )?.label
  const expSecondary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.flatMap((p) => p.children).find(
    (o) => o.id === selection.expectationSecondaryId,
  )?.label
  const expectationDisplay =
    expSecondary && expSecondary !== EMPTY
      ? expSecondary
      : expPrimary && expPrimary !== EMPTY
        ? expPrimary
        : EMPTY

  return {
    combatBackground: bg || EMPTY,
    commandSource: cmd || EMPTY,
    combatPhase: phase || EMPTY,
    combatExpectation: expectationDisplay,
  }
}

/**
 * 按卫星名称 / 系列从 catalog 解析国家。
 *
 * @param name 卫星名称
 * @param series 系列
 * @param catalog catalog 扁平行
 * @param fallbackCountry 回退国家
 */
function resolveCountryForSatellite(
  name: string,
  series: string,
  catalog: C2ResourceSatelliteRow[],
  fallbackCountry: string,
): string {
  const trimmed = name.trim()
  const hit = catalog.find(
    (row) =>
      row.name === trimmed ||
      row.series === series ||
      (trimmed && row.name.includes(trimmed)),
  )
  return hit?.country?.trim() || fallbackCountry || EMPTY
}

/**
 * 构建分析结果叙述文本。
 *
 * @param plan 综合打击方案
 * @param catalog catalog
 * @param enemyCountries 作战对象
 */
function buildAnalysisResultText(
  plan: ZhchPlanResp,
  catalog: C2ResourceSatelliteRow[],
  enemyCountries: string[],
): string {
  const fallbackCountry = enemyCountries.length === 1 ? enemyCountries[0] : EMPTY
  const grouped = new Map<string, Map<string, string[]>>()

  plan.levelSeriesEntities?.forEach((entity) => {
    const series = entity.series?.trim() || EMPTY
    const sysType = entity.sysType?.trim() || '未分类'
    entity.initMatrixList?.forEach((sat) => {
      const name = sat.name?.trim() || `NORAD-${sat.norad}`
      const country = resolveCountryForSatellite(name, series, catalog, fallbackCountry)
      if (!grouped.has(country)) grouped.set(country, new Map())
      const typeMap = grouped.get(country)!
      if (!typeMap.has(sysType)) typeMap.set(sysType, [])
      typeMap.get(sysType)!.push(name)
    })
  })

  const segments: string[] = []
  grouped.forEach((typeMap, country) => {
    typeMap.forEach((names, sysType) => {
      const unique = [...new Set(names)]
      segments.push(
        `${country} ${sysType}卫星${unique.length}颗 分别是 ${unique.join('，')}`,
      )
    })
  })

  const delayText = formatStrikeDelayDuration(
    plan.beforeFirstFeedbackTime,
    plan.afterFirstFeedbackTime,
  )
  const coverageReduce = formatCoverageReduction(plan.beforeAvgCoverage, plan.afterAvgCoverage)

  let threatReduce = EMPTY
  const threatDeltas: number[] = []
  plan.levelSeriesEntities?.forEach((entity) => {
    entity.threatSats?.forEach((item) => {
      if (item.afterThreatScore != null && Number.isFinite(item.threatScore)) {
        threatDeltas.push(item.threatScore - item.afterThreatScore)
      }
    })
  })
  if (threatDeltas.length) {
    const avg = threatDeltas.reduce((a, b) => a + b, 0) / threatDeltas.length
    threatReduce = avg.toFixed(3)
  }

  const effectLine = `打击后的效果是 延迟增加 ${delayText}，通信覆盖率减少 ${coverageReduce}，威胁度减少 ${threatReduce}`

  if (!segments.length) {
    return effectLine
  }

  return `${segments.join('；')}；${effectLine}`
}

/**
 * 汇总方案内全部卫星行。
 *
 * @param plan 方案
 * @param catalog catalog
 * @param enemyCountries 作战对象
 */
function buildSatelliteRows(
  plan: ZhchPlanResp,
  catalog: C2ResourceSatelliteRow[],
  enemyCountries: string[],
): StrikePlanSatelliteRow[] {
  const fallbackCountry = enemyCountries.length === 1 ? enemyCountries[0] : EMPTY
  const map = new Map<string, StrikePlanSatelliteRow>()

  plan.levelSeriesEntities?.forEach((entity) => {
    const series = entity.series?.trim() || EMPTY
    const sysType = entity.sysType?.trim() || EMPTY
    entity.initMatrixList?.forEach((sat) => {
      const name = sat.name?.trim() || String(sat.norad)
      const key = `${series}|${name}`
      if (map.has(key)) return
      map.set(key, {
        country: resolveCountryForSatellite(name, series, catalog, fallbackCountry),
        satelliteName: name,
        satelliteType: sat.satType?.trim() || sysType || EMPTY,
        series,
      })
    })
  })

  return [...map.values()].sort((a, b) => {
    const c = a.country.localeCompare(b.country, 'zh-CN')
    if (c !== 0) return c
    return a.satelliteName.localeCompare(b.satelliteName, 'zh-CN')
  })
}

/**
 * 汇总打击计划行。
 *
 * @param plan 方案
 * @param catalog catalog
 * @param enemyCountries 作战对象
 */
function buildStrikePlanRows(
  plan: ZhchPlanResp,
  catalog: C2ResourceSatelliteRow[],
  enemyCountries: string[],
): StrikePlanStrikeRow[] {
  const fallbackCountry = enemyCountries.length === 1 ? enemyCountries[0] : EMPTY
  const rows: StrikePlanStrikeRow[] = []

  plan.levelSeriesEntities?.forEach((entity) => {
    const series = entity.series?.trim() || EMPTY
    const sysType = entity.sysType?.trim() || EMPTY
    const satTypeByName = new Map<string, string>()
    entity.initMatrixList?.forEach((sat) => {
      if (sat.name) satTypeByName.set(sat.name.trim(), sat.satType?.trim() || sysType)
    })

    entity.attackPlanList?.forEach((attack) => {
      const target = attack.target?.trim() || EMPTY
      const windowText =
        attack.beginTime && attack.endTime
          ? `${attack.beginTime} ~ ${attack.endTime}`
          : attack.beginTime || EMPTY
      rows.push({
        country: resolveCountryForSatellite(target, series, catalog, fallbackCountry),
        satelliteName: target,
        satelliteType: satTypeByName.get(target) || attack.targetType || sysType || EMPTY,
        series,
        weaponName: attack.weaponName || EMPTY,
        weaponType: attack.weaponType || EMPTY,
        attackWindow: windowText,
      })
    })
  })

  if (rows.length) {
    return rows.sort((a, b) => {
      const c = a.country.localeCompare(b.country, 'zh-CN')
      if (c !== 0) return c
      return a.satelliteName.localeCompare(b.satelliteName, 'zh-CN')
    })
  }

  const satellites = buildSatelliteRows(plan, catalog, enemyCountries)
  if (!satellites.length) return []

  return satellites.slice(0, 5).map((sat, index) => ({
    country: sat.country,
    satelliteName: sat.satelliteName,
    satelliteType: sat.satelliteType,
    series: sat.series,
    weaponName: `DEMO-软杀伤-${index + 1}`,
    weaponType: index % 2 === 0 ? '电子干扰' : '定向能',
    attackWindow: `2026-09-17 09:${String(10 + index).padStart(2, '0')}:00 ~ 2026-09-17 09:${String(40 + index).padStart(2, '0')}:00`,
  }))
}

/**
 * 构建单用途类型方案的完整页面视图。
 *
 * @param usageType 军用 / 民用 / 军用民用
 * @param plan 接口方案
 * @param taskId 任务 ID
 * @param catalogRows catalog
 * @param enemyCountries 作战对象国家
 */
export function buildStrikePlanSchemeView(
  usageType: string,
  plan: ZhchPlanResp,
  taskId: number,
  catalogRows: C2ResourceSatelliteRow[],
  enemyCountries: string[],
): StrikePlanSchemeView {
  const scenario = resolveCombatScenarioLabels(taskId)
  const planName = buildStrikePlanDisplayName(taskId)
  const description =
    plan.summary?.trim() ||
    [plan.beforeResult, plan.afterResult].filter(Boolean).join(' ') ||
    EMPTY

  return {
    usageType,
    plan,
    meta: {
      planName,
      ...scenario,
      analysisResult: buildAnalysisResultText(plan, catalogRows, enemyCountries),
      planDescription: description,
    },
    satellites: buildSatelliteRows(plan, catalogRows, enemyCountries),
    strikePlans: buildStrikePlanRows(plan, catalogRows, enemyCountries),
  }
}

/**
 * 合并多个方案的打击计划行（用于导出）。
 *
 * @param views 方案视图列表
 */
export function flattenStrikePlanRowsForExport(views: StrikePlanSchemeView[]): StrikePlanStrikeRow[] {
  return views.flatMap((view) =>
    view.strikePlans.map((row) => ({ ...row })),
  )
}
