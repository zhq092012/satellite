import type {
  ReportCommComparison,
  ReportReconComparison,
  StruckSatellite,
  StrikePlan,
} from '@/types/report/report'

/** 打击方案对比展示块 */
export interface StrikePlanCompareBlock {
  /** 块标题 */
  title: string
  /** 前后对照行 */
  rows: Array<{ label: string; before: string; after: string; delta: string }>
}

/** 方案概要键值（顶部展示区） */
export interface StrikePlanMetaField {
  /** 字段标签 */
  label: string
  /** 展示值 */
  value: string
}

const fmtInt = (v: number | undefined | null): string =>
  v != null && Number.isFinite(v) ? String(Math.round(v)) : '—'

const fmtNum = (v: number | undefined | null, digits = 3): string =>
  v != null && Number.isFinite(v) ? v.toFixed(digits) : '—'

const fmtPercent = (v: number | undefined | null): string =>
  v != null && Number.isFinite(v) ? `${v.toFixed(2)}%` : '—'

const fmtSignedInt = (delta: number | undefined | null): string => {
  if (delta == null || !Number.isFinite(delta)) return '—'
  if (delta === 0) return '0'
  return delta > 0 ? `+${fmtInt(delta)}` : fmtInt(delta)
}

const fmtSignedPercent = (delta: number | undefined | null): string => {
  if (delta == null || !Number.isFinite(delta)) return '—'
  if (delta === 0) return '0.00 pp'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(2)} pp`
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
 * 构建方案顶部概要字段（与 `StrikePlan` 84–97 对齐）。
 *
 * @param plan 打击方案
 */
export const buildStrikePlanMetaFields = (plan: StrikePlan): StrikePlanMetaField[] => {
  const tierLabel = plan.tierIndex != null ? `规模${plan.tierIndex}` : undefined
  const items: Array<{ label: string; value?: string }> = [
    { label: '方案编码', value: plan.code?.trim() },
    { label: '方案名称', value: plan.name?.trim() },
    { label: '阶段编码', value: plan.stageCode?.trim() },
    { label: '阶段名称', value: plan.stageName?.trim() },
    { label: '作战对象', value: plan.country?.trim() },
    { label: '规模方案', value: tierLabel },
    {
      label: '打击目标',
      value: plan.targetSize != null && Number.isFinite(plan.targetSize) ? String(plan.targetSize) : undefined,
    },
  ]
  return items
    .filter((item): item is StrikePlanMetaField => Boolean(item.value?.trim()))
    .map((item) => ({ label: item.label, value: item.value.trim() }))
}

/**
 * 由侦察比对构建展示块。
 *
 * @param recon 侦察打击前后比对
 */
const buildReconCompareBlock = (recon: ReportReconComparison | undefined): StrikePlanCompareBlock | null => {
  if (!recon) return null
  const rows: StrikePlanCompareBlock['rows'] = []
  const count = recon.satelliteCount
  if (count) {
    rows.push({
      label: '卫星总数',
      before: fmtInt(count.beforeTotal),
      after: fmtInt(count.afterTotal),
      delta: fmtSignedInt(count.deltaTotal),
    })
  }
  const transit = recon.transitWindows
  if (transit) {
    rows.push(
      {
        label: '过境窗口数',
        before: fmtInt(transit.beforeWindows),
        after: fmtInt(transit.afterWindows),
        delta: fmtSignedInt(transit.deltaWindows),
      },
      {
        label: '最早过境时间',
        before: transit.beforeFirstTransit?.trim() || '—',
        after: transit.afterFirstTransit?.trim() || '—',
        delta:
          transit.delayMinutes != null && Number.isFinite(transit.delayMinutes)
            ? `推迟 ${fmtInt(transit.delayMinutes)} 分钟`
            : '—',
      },
    )
  }
  if (!rows.length) return null
  return { title: '侦察卫星打击前后对比', rows }
}

/**
 * 由通信比对构建展示块。
 *
 * @param comm 通信打击前后比对
 */
const buildCommCompareBlock = (comm: ReportCommComparison | undefined): StrikePlanCompareBlock | null => {
  if (!comm) return null
  const rows: StrikePlanCompareBlock['rows'] = []
  const count = comm.satelliteCount
  if (count) {
    rows.push({
      label: '卫星总数',
      before: fmtInt(count.beforeTotal),
      after: fmtInt(count.afterTotal),
      delta: fmtSignedInt(count.deltaTotal),
    })
  }
  const coverage = comm.coverage
  if (coverage) {
    rows.push({
      label: '区域覆盖占比',
      before: fmtPercent(coverage.beforeCoverage),
      after: fmtPercent(coverage.afterCoverage),
      delta: fmtSignedPercent(coverage.deltaCoverage),
    })
  }
  if (!rows.length) return null
  return { title: '通信卫星打击前后对比', rows }
}

/**
 * 将方案上的 recon / comm 比对拆成 UI 块。
 *
 * @param plan 打击方案（含 `reconComparison`、`commComparison`）
 */
export const buildStrikePlanCompareBlocks = (plan: StrikePlan): StrikePlanCompareBlock[] => {
  const blocks: StrikePlanCompareBlock[] = []
  const recon = buildReconCompareBlock(plan.reconComparison)
  if (recon) blocks.push(recon)
  const comm = buildCommCompareBlock(plan.commComparison)
  if (comm) blocks.push(comm)
  return blocks
}

/**
 * 由被打击数与打击前总数估算达成度（无数据时不返回）。
 *
 * @param plan 打击方案
 */
export const deriveStrikePlanAttainment = (plan: StrikePlan): number | undefined => {
  const before = plan.reconComparison?.satelliteCount?.beforeTotal
  if (before == null || before <= 0) return undefined
  if (plan.targetSize == null || !Number.isFinite(plan.targetSize)) return undefined
  const ratio = plan.targetSize / before
  return Number.isFinite(ratio) ? ratio : undefined
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
})