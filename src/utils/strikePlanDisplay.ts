import type {
  ReportCoverageChange,
  ReportFirstTransitChange,
  ReportSatelliteCountChange,
  ReportStrikeComparison,
  ReportStrikeSystemSplit,
  ReportTransitWindowChange,
  StruckSatellite,
  StrikePlan,
} from '@/types/report/report'

/** 打击方案对比展示块 */
export interface StrikePlanCompareBlock {
  /** 块标题 */
  title: string
  /** 前后对照行 */
  rows: Array<{ label: string; before: string; after: string; delta: string }>
  /** 接口结论文本 */
  summary?: string
}

const fmtInt = (v: number | undefined | null): string =>
  v != null && Number.isFinite(v) ? String(Math.round(v)) : '—'

const fmtNum = (v: number | undefined | null, digits = 3): string =>
  v != null && Number.isFinite(v) ? v.toFixed(digits) : '—'

const fmtPercent = (v: number | undefined | null): string =>
  v != null && Number.isFinite(v) ? `${v.toFixed(2)}%` : '—'

/**
 * 格式化体系拆分为一行文案。
 *
 * @param split 体系统计
 */
export const formatStrikeSystemSplitLine = (split: ReportStrikeSystemSplit | undefined): string => {
  if (!split) return '—'
  const parts: string[] = []
  if (split.reconCount != null) parts.push(`侦察 ${split.reconCount}`)
  if (split.commCount != null) parts.push(`通信 ${split.commCount}`)
  if (split.relayCount != null) parts.push(`中继 ${split.relayCount}`)
  if (!parts.length && split.total != null) return `合计 ${split.total}`
  const total = split.total != null ? `（共 ${split.total}）` : ''
  return parts.length ? `${parts.join(' · ')}${total}` : '—'
}

/**
 * 由 `ReportGenerateResp.strikePlans` 构建 code → 打击方案映射。
 *
 * @param strikePlans 接口打击方案列表
 */
export const buildStrikePlanMapByCode = (strikePlans: StrikePlan[] | undefined): Map<string, StrikePlan> => {
  const map = new Map<string, StrikePlan>()
  for (const plan of strikePlans ?? []) {
    const code = plan.code?.trim()
    if (!code) continue
    map.set(code, plan)
  }
  return map
}

/**
 * 在已选 scheme code 中筛选存在打击方案的 code（严格 code 相等）。
 *
 * @param schemeCodes 勾选方案 code
 * @param strikeMap 打击方案映射
 */
export const filterSchemeCodesWithStrikePlan = (
  schemeCodes: string[],
  strikeMap: Map<string, StrikePlan>,
): string[] => schemeCodes.filter((code) => strikeMap.has(code.trim()))

/**
 * 将比对对象拆成 UI 块。
 *
 * @param comparison 打击前后比对
 */
export const buildStrikePlanCompareBlocks = (
  comparison: ReportStrikeComparison | undefined,
): StrikePlanCompareBlock[] => {
  if (!comparison) return []
  const blocks: StrikePlanCompareBlock[] = []

  const pushCount = (title: string, change: ReportSatelliteCountChange | undefined) => {
    if (!change) return
    blocks.push({
      title,
      summary: change.text?.trim(),
      rows: [
        {
          label: '目标总数',
          before: fmtInt(change.beforeTotal),
          after: fmtInt(change.afterTotal),
          delta: change.struckTotal != null ? `−${fmtInt(change.struckTotal)}` : '—',
        },
        {
          label: '体系拆分',
          before: formatStrikeSystemSplitLine(change.before),
          after: formatStrikeSystemSplitLine(change.after),
          delta: '—',
        },
      ],
    })
  }

  const pushTransit = (change: ReportTransitWindowChange | undefined) => {
    if (!change) return
    blocks.push({
      title: '侦察过境窗口',
      summary: change.text?.trim(),
      rows: [
        {
          label: '过境窗口总数',
          before: fmtInt(change.beforeWindows),
          after: fmtInt(change.afterWindows),
          delta:
            change.deltaWindows != null
              ? `${change.deltaWindows >= 0 ? '−' : '+'}${fmtInt(Math.abs(change.deltaWindows))}`
              : '—',
        },
        {
          label: '消减比例',
          before: '—',
          after: '—',
          delta:
            change.reductionPercent != null && Number.isFinite(change.reductionPercent)
              ? fmtPercent(change.reductionPercent)
              : '—',
        },
        {
          label: '侦察星（有/无过境数据）',
          before: fmtInt(change.reconTargets),
          after: `${fmtInt(change.reconTargetsWithData)} / ${fmtInt(change.reconTargetsWithoutData)}`,
          delta: '—',
        },
      ],
    })
  }

  const pushFirstTransit = (change: ReportFirstTransitChange | undefined) => {
    if (!change) return
    blocks.push({
      title: '最早过境',
      summary: change.text?.trim(),
      rows: [
        {
          label: '最早时间',
          before: change.before?.trim() || '—',
          after: change.after?.trim() || '—',
          delta:
            change.delayMinutes != null
              ? `推迟 ${fmtInt(change.delayMinutes)} 分钟`
              : '—',
        },
        {
          label: '对应卫星',
          before: change.beforeSatellite?.trim() || '—',
          after: change.afterSatellite?.trim() || '—',
          delta: '—',
        },
      ],
    })
  }

  const pushCoverage = (change: ReportCoverageChange | undefined) => {
    if (!change) return
    blocks.push({
      title: '通信区域覆盖',
      summary: change.text?.trim(),
      rows: [
        {
          label: '覆盖占比',
          before: fmtPercent(change.beforePercent),
          after: fmtPercent(change.afterPercent),
          delta:
            change.lostPercent != null && Number.isFinite(change.lostPercent)
              ? `−${change.lostPercent.toFixed(2)} pp`
              : '—',
        },
        {
          label: '通信星（有/无覆盖数据）',
          before: fmtInt(change.commTargets),
          after: `${fmtInt(change.commTargetsWithData)} / ${fmtInt(change.commTargetsWithoutData)}`,
          delta: '—',
        },
      ],
    })
  }

  pushCount('卫星数量', comparison.satelliteCount)
  pushTransit(comparison.reconTransitWindows)
  pushFirstTransit(comparison.reconFirstTransit)
  pushCoverage(comparison.commCoverage)

  return blocks
}

/**
 * 被打击卫星表行（展示用）。
 *
 * @param sat 接口卫星项
 */
export const formatStruckSatelliteRow = (sat: StruckSatellite) => ({
  noradId: sat.noradId?.trim() || '—',
  name: sat.name?.trim() || sat.noradId?.trim() || '—',
  system: sat.system?.trim() || '—',
  series: sat.series?.trim() || '—',
  country: sat.country?.trim() || '—',
  threatText: fmtNum(sat.threat, 3),
  quotaRole: sat.quotaRole?.trim() || '—',
})