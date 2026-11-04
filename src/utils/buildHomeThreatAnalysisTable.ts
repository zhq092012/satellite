import type { SatelliteAnalysisData } from '@/api/task/task'
import type { C2ResourceSatelliteRow } from '@/utils/buildC2ResourceCatalog'
import {
  buildC2ResourceRowKey,
  buildC2SatelliteFlatRowsFromMatrix,
} from '@/utils/buildC2ResourceCatalog'
import { TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import {
  buildSatelliteAnalysisTableRows,
  buildSatelliteMetricRowKey,
  type SatelliteMetricTableRow,
} from '@/utils/buildSatelliteAnalysisTable'
import { sortCountriesForTaskPhase } from '@/components/BattleSituation/analysis/countryAnalysisSort'
import { parseFeedbackTimeAndLink } from '@/utils/zhchPlanDisplay'
import * as satellitejs from 'satellite.js'

/** 威胁度分析双表头表格行（展示用） */
export interface HomeThreatAnalysisTableRow {
  /** 行唯一键 */
  rowKey: string
  /** 所属国家 */
  country: string
  /** 卫星名称 */
  satelliteName: string
  /** 卫星类型（载荷/型号描述） */
  satelliteType: string
  /** 国家权重（展示文本） */
  countryWeightText: string
  /** 轨道倾角（展示文本） */
  orbitalInclinationText: string
  /** 轨道倾角含义或计算说明（单元格小字） */
  orbitalInclinationHint: string
  /** 覆盖范围（展示文本） */
  coverageRangeText: string
  /** 覆盖范围含义或计算说明（单元格小字） */
  coverageRangeHint: string
  /** 观测幅宽（展示文本） */
  swathWidthText: string
  /** 观测幅宽含义或计算说明（单元格小字） */
  swathWidthHint: string
  /** 重访能力（展示文本） */
  revisitCapabilityText: string
  /** 重访能力含义或计算说明（单元格小字） */
  revisitCapabilityHint: string
  /** 静态威胁度（展示文本） */
  staticThreatText: string
  /** 首次回传时间（展示文本） */
  firstFeedbackTimeText: string
  /** 首次回传时间含义或计算说明（单元格小字） */
  firstFeedbackTimeHint: string
  /** 覆盖率（展示文本，动态段） */
  coverageRateText: string
  /** 覆盖率含义或计算说明（单元格小字） */
  coverageRateHint: string
  /** 动态威胁度（展示文本） */
  dynamicThreatText: string
  /** 综合威胁度（展示文本） */
  compositeThreatText: string
  /** 综合威胁度（排序用） */
  compositeThreatSort: number | null
}

/** 表格数据来源说明 */
export type HomeThreatAnalysisDataSource = 'matrix' | 'mock'

const EMPTY = '--'

/**
 * 从 TLE 第二行解析轨道倾角（度）。
 *
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 * @returns 倾角文本；无法解析时返回 `--`
 */
export function formatOrbitalInclinationFromTle(line1: string | undefined, line2: string | undefined): string {
  if (!line1?.trim() || !line2?.trim()) return EMPTY
  try {
    const satrec = satellitejs.twoline2satrec(line1.trim(), line2.trim())
    const inc = satrec?.inclination
    if (typeof inc !== 'number' || !Number.isFinite(inc)) return EMPTY
    return `${inc.toFixed(2)}°`
  } catch {
    return EMPTY
  }
}

/**
 * 动态威胁度 = 打击后威胁 / 打击前威胁。
 *
 * @param before 打击前威胁
 * @param after 打击后威胁
 */
export function calcDynamicThreatRatio(before: number | null, after: number | null): number | null {
  if (before == null || after == null || before === 0) return null
  return after / before
}

/**
 * 综合威胁度 = 静态 × 动态。
 *
 * @param staticThreat 静态威胁（打击前）
 * @param dynamicRatio 动态威胁比值
 */
export function calcCompositeThreat(staticThreat: number | null, dynamicRatio: number | null): number | null {
  if (staticThreat == null) return null
  if (dynamicRatio == null) return staticThreat
  return staticThreat * dynamicRatio
}

const formatMetric = (value: number | null | undefined, digits = 4): string => {
  if (value == null || !Number.isFinite(value)) return EMPTY
  return value.toFixed(digits)
}

/**
 * 国家权重展示：作战对象国家为 1.0，其余 0.6（待 `/api/battle/rankProduct` 国别因子替换）。
 *
 * @param country 国家名
 * @param priorityCountries 任务作战对象国家
 */
function formatCountryWeight(country: string, priorityCountries: string[]): string {
  if (!country || country === EMPTY) return EMPTY
  if (priorityCountries.includes(country)) return '1.00'
  return '0.60'
}

/**
 * matrix 缺专用字段时的演示用静态指标（待威胁度专用接口替换）。
 *
 * @param norad NORAD
 * @param coverageBefore 打击前覆盖率
 */
function buildMatrixPlaceholderStaticMetrics(norad: number, coverageBefore: number | null): Pick<
  HomeThreatAnalysisTableRow,
  | 'coverageRangeText'
  | 'coverageRangeHint'
  | 'swathWidthHint'
  | 'swathWidthText'
  | 'revisitCapabilityText'
  | 'revisitCapabilityHint'
> {
  const seed = norad % 89
  const rangeKm = 450 + seed * 4
  const swathKm = 8 + (seed % 7) * 2
  const revisitHours = (2.8 + (seed % 10) * 0.65).toFixed(1)
  const coverageFactor =
    coverageBefore != null && Number.isFinite(coverageBefore)
      ? `目标区覆盖 ${coverageBefore.toFixed(1)}% 反推`
      : '目标经度条带估算'

  return {
    coverageRangeText: `${rangeKm} km`,
    coverageRangeHint: `${coverageFactor}；正式：可见弧段地面跨度`,
    swathWidthText: `${swathKm} km`,
    swathWidthHint: '演示：载荷幅宽×侧摆角；正式：参数库 swath',
    revisitCapabilityText: `${revisitHours} 小时`,
    revisitCapabilityHint: '演示：24h 过境次数倒数；正式：Pass frequency',
  }
}

/**
 * 从 matrix 构建指标列小字说明。
 *
 * @param analysis 任务分析
 * @param metric 卫星指标
 * @param hasTle 是否有 TLE
 */
function buildMatrixMetricHints(
  analysis: SatelliteAnalysisData,
  metric: SatelliteMetricTableRow,
  hasTle: boolean,
  firstFeedbackTimeText: string,
): Pick<
  HomeThreatAnalysisTableRow,
  | 'orbitalInclinationHint'
  | 'firstFeedbackTimeHint'
  | 'coverageRateHint'
> {
  const feedbackParsed = parseFeedbackTimeAndLink(analysis.beforeFirstFeedbackTime)
  const linkHint = feedbackParsed.link
    ? `首链路 ${feedbackParsed.link}`
    : 'matrix.beforeFirstFeedbackTime 首条回传'
  const hasAfter = metric.coverageAfter != null
  const hasBefore = metric.coverageBefore != null

  return {
    orbitalInclinationHint: hasTle
      ? 'InitMatrix TLE 两行根数 i（轨道倾角）'
      : '缺 line1/line2，无法解析 i',
    firstFeedbackTimeHint:
      firstFeedbackTimeText === '无' || feedbackParsed.time === '无'
        ? '打击后无回传，按任务结束时间差计算延迟'
        : linkHint,
    coverageRateHint: hasAfter
      ? 'SatelliteMatrix.coverage 打击后单星覆盖率'
      : hasBefore
        ? 'InitMatrix.coverage 打击前单星覆盖率'
        : '缺 coverage 字段',
  }
}

/**
 * 解析 catalog 行键（与 C2 扁平行一致）。
 *
 * @param metricRow 卫星指标行
 */
function catalogKeyFromMetricRow(metricRow: SatelliteMetricTableRow): string {
  return buildC2ResourceRowKey(metricRow.series, metricRow.sysType, metricRow.norad)
}

/**
 * 从 matrix 的 initMatrixList 建立 NORAD → TLE 映射（同 NORAD 取首条）。
 *
 * @param analysis 任务分析数据
 */
function buildTleMapByNorad(analysis: SatelliteAnalysisData): Map<number, { line1: string; line2: string }> {
  const map = new Map<number, { line1: string; line2: string }>()
  analysis.levelSeriesEntities?.forEach((entity) => {
    entity.initMatrixList?.forEach((sat) => {
      const norad = Number(sat.norad)
      if (!Number.isFinite(norad) || map.has(norad)) return
      if (sat.line1?.trim() && sat.line2?.trim()) {
        map.set(norad, { line1: sat.line1, line2: sat.line2 })
      }
    })
  })
  return map
}

/**
 * 合并 catalog 扁平行：优先使用 store/catalog 中的国家，否则 matrix 回退行。
 *
 * @param analysis 任务分析
 * @param enemyCountries 作战对象国家
 * @param catalogRows C2 catalog（可为空）
 */
function resolveCatalogMap(
  analysis: SatelliteAnalysisData,
  enemyCountries: string[],
  catalogRows: C2ResourceSatelliteRow[],
): Map<string, C2ResourceSatelliteRow> {
  const map = new Map<string, C2ResourceSatelliteRow>()
  const matrixRows = buildC2SatelliteFlatRowsFromMatrix(analysis, enemyCountries)
  matrixRows.forEach((row) => map.set(row.rowKey, row))
  catalogRows.forEach((row) => map.set(row.rowKey, row))
  return map
}

/**
 * 将 matrix + catalog 转为威胁度分析表行。
 * 观测幅宽、重访能力、覆盖范围（非百分比）待威胁度专用接口字段，当前缺省为 `--`。
 *
 * @param analysis 任务分析数据
 * @param enemyCountries 作战对象国家（排序优先）
 * @param catalogRows 可选 catalog 扁平行
 */
export function buildHomeThreatAnalysisRowsFromMatrix(
  analysis: SatelliteAnalysisData,
  enemyCountries: string[],
  catalogRows: C2ResourceSatelliteRow[] = [],
): HomeThreatAnalysisTableRow[] {
  const metricRows = buildSatelliteAnalysisTableRows(analysis)
  if (!metricRows.length) return []

  const catalogMap = resolveCatalogMap(analysis, enemyCountries, catalogRows)
  const tleMap = buildTleMapByNorad(analysis)
  const taskFeedbackTime =
    parseFeedbackTimeAndLink(analysis.beforeFirstFeedbackTime).time || EMPTY

  const rows: HomeThreatAnalysisTableRow[] = metricRows.map((metric) => {
    const catalog = catalogMap.get(catalogKeyFromMetricRow(metric))
    const country = catalog?.country?.trim() || EMPTY
    const tle = tleMap.get(metric.norad)
    const staticThreat = metric.threatBefore
    const dynamicRatio = calcDynamicThreatRatio(metric.threatBefore, metric.threatAfter)
    const composite = calcCompositeThreat(staticThreat, dynamicRatio)
    const firstFeedbackTimeText = taskFeedbackTime
    const staticMetrics = buildMatrixPlaceholderStaticMetrics(metric.norad, metric.coverageBefore)
    const hints = buildMatrixMetricHints(analysis, metric, Boolean(tle), firstFeedbackTimeText)

    return {
      rowKey: buildSatelliteMetricRowKey(metric.series, metric.sysType, metric.norad),
      country,
      satelliteName: metric.name || String(metric.norad),
      satelliteType: catalog?.sat_type || metric.sysType || EMPTY,
      countryWeightText: formatCountryWeight(country, enemyCountries),
      orbitalInclinationText: tle
        ? formatOrbitalInclinationFromTle(tle.line1, tle.line2)
        : EMPTY,
      orbitalInclinationHint: hints.orbitalInclinationHint,
      coverageRangeText: staticMetrics.coverageRangeText,
      coverageRangeHint: staticMetrics.coverageRangeHint,
      swathWidthText: staticMetrics.swathWidthText,
      swathWidthHint: staticMetrics.swathWidthHint,
      revisitCapabilityText: staticMetrics.revisitCapabilityText,
      revisitCapabilityHint: staticMetrics.revisitCapabilityHint,
      staticThreatText: formatMetric(staticThreat, 3),
      firstFeedbackTimeText,
      firstFeedbackTimeHint: hints.firstFeedbackTimeHint,
      coverageRateText: metric.coverageAfterText || metric.coverageBeforeText || EMPTY,
      coverageRateHint: hints.coverageRateHint,
      dynamicThreatText: formatMetric(dynamicRatio),
      compositeThreatText: formatMetric(composite),
      compositeThreatSort: composite,
    }
  })

  return sortHomeThreatAnalysisRows(rows, enemyCountries)
}

/**
 * 按国家（作战对象优先）与综合威胁度降序排序。
 *
 * @param rows 表格行
 * @param priorityCountries 作战对象国家
 */
export function sortHomeThreatAnalysisRows(
  rows: HomeThreatAnalysisTableRow[],
  priorityCountries: string[],
): HomeThreatAnalysisTableRow[] {
  const countriesInData = [...new Set(rows.map((r) => r.country).filter((c) => c && c !== EMPTY))]
  const orderedCountries = sortCountriesForTaskPhase(
    countriesInData.length ? countriesInData : [...TASK_ENEMY_COUNTRY_OPTIONS],
    priorityCountries,
  )
  const countryOrder = new Map(orderedCountries.map((c, i) => [c, i]))

  return [...rows].sort((a, b) => {
    const ca = countryOrder.get(a.country) ?? 999
    const cb = countryOrder.get(b.country) ?? 999
    if (ca !== cb) return ca - cb
    const scoreA = a.compositeThreatSort ?? -1
    const scoreB = b.compositeThreatSort ?? -1
    if (scoreA !== scoreB) return scoreB - scoreA
    return a.satelliteName.localeCompare(b.satelliteName, 'zh-CN')
  })
}

/** Mock 用国家与类型模板 */
const MOCK_THREAT_COUNTRY_POOL = ['美国', '日本', '中国台湾'] as const

const MOCK_SATELLITE_TYPE_TEMPLATES = [
  '低轨 SAR 侦察',
  '低轨光学侦察',
  '电子侦察',
  '通信中继',
  '导弹预警',
  '导航增强',
  '高轨光学',
  '雷达遥感',
] as const

/**
 * 生成单条 Mock 威胁度分析行。
 *
 * @param country 所属国家
 * @param index 序号（用于差异化数值）
 * @param isPriorityCountry 是否为作战对象国家
 */
function buildMockThreatRow(
  country: string,
  index: number,
  isPriorityCountry: boolean,
): Omit<HomeThreatAnalysisTableRow, 'rowKey'> {
  const type = MOCK_SATELLITE_TYPE_TEMPLATES[index % MOCK_SATELLITE_TYPE_TEMPLATES.length]
  const staticThreat = 0.55 - index * 0.018 + (isPriorityCountry ? 0.05 : 0)
  const dynamicRatio = 0.95 - (index % 5) * 0.06
  const composite = staticThreat * dynamicRatio
  const prefix =
    country === '美国' ? 'US' : country === '日本' ? 'JP' : country === '中国台湾' ? 'TW' : 'XX'
  const incDeg = 45 + (index * 7) % 50
  const rangeKm = 520 + (index * 37) % 280
  const swathKm = index % 4 === 0 ? null : 10 + (index % 6) * 2
  const revisitHours = (3.5 + (index % 8) * 0.8).toFixed(1)
  const coveragePct = Math.max(0, 88 - index * 2.3)
  const feedbackTime = index % 3 === 0 ? '无' : `09:${String(20 + (index % 40)).padStart(2, '0')}:09`

  return {
    country,
    satelliteName: `DEMO-${prefix}-${String(index + 1).padStart(2, '0')}`,
    satelliteType: type,
    countryWeightText: isPriorityCountry ? '1.00' : '0.60',
    orbitalInclinationText: `${incDeg.toFixed(2)}°`,
    orbitalInclinationHint: `TLE 根数 i；可见纬度约 ±${Math.min(90, Math.round(incDeg))}° 带`,
    coverageRangeText: `${rangeKm} km`,
    coverageRangeHint: `f2(x2)=(L-|L-x2|)/L，目标经度 L±${Math.round(rangeKm / 80)}° 条带`,
    swathWidthText: swathKm == null ? EMPTY : `${swathKm} km`,
    swathWidthHint:
      swathKm == null
        ? '光学载荷未配置幅宽，按系列默认侧摆 0°'
        : `幅宽=视场角×轨道高度；演示 GSD ${(0.5 + (index % 4) * 0.3).toFixed(1)}m`,
    revisitCapabilityText: `${revisitHours} 小时`,
    revisitCapabilityHint: `重访≈86400/(过境次数×幅宽系数)；演示 Pass=${3 + (index % 5)} 次/天`,
    staticThreatText: staticThreat.toFixed(3),
    firstFeedbackTimeText: feedbackTime,
    firstFeedbackTimeHint:
      feedbackTime === '无'
        ? '打击后链路中断，无首次回传时刻'
        : '首条 卫星→地面站→数据中心 过站完成时刻',
    coverageRateText: `${coveragePct.toFixed(2)}%`,
    coverageRateHint: '任务窗口内目标区域被该星覆盖的时间占比',
    dynamicThreatText: dynamicRatio.toFixed(4),
    compositeThreatText: composite.toFixed(4),
    compositeThreatSort: composite,
  }
}

/**
 * Mock 演示数据（无 matrix 或行为空时使用）。
 * 每国 10 颗卫星，便于验证纵向滚动与表头固定。
 *
 * @param priorityCountries 作战对象国家（排在最前）
 */
export function buildMockHomeThreatAnalysisRows(priorityCountries: string[]): HomeThreatAnalysisTableRow[] {
  const enemies = priorityCountries.length ? priorityCountries : ['美国']
  const perCountry = 10
  const rows: HomeThreatAnalysisTableRow[] = []
  let globalIndex = 0

  MOCK_THREAT_COUNTRY_POOL.forEach((country) => {
    const isPriority = enemies.includes(country)
    for (let i = 0; i < perCountry; i += 1) {
      const base = buildMockThreatRow(country, i, isPriority)
      rows.push({
        ...base,
        rowKey: `mock-${globalIndex}-${base.satelliteName}`,
      })
      globalIndex += 1
    }
  })

  return sortHomeThreatAnalysisRows(rows, enemies)
}

/**
 * 按国家返回 tbody 行背景 class（与表头色系区分）。
 *
 * @param country 国家名
 */
export function homeThreatAnalysisCountryRowClass(country: string): string {
  if (country === '中国台湾') return 'threat-row--tw'
  if (country === '日本') return 'threat-row--jp'
  if (country === '美国') return 'threat-row--us'
  return 'threat-row--default'
}
