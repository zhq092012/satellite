import type {
  AttackPlan,
  InitMatrix,
  InitWindow,
  LevelSeriesEntity,
  SatelliteAnalysisData,
  SatelliteMatrix,
  TimeEffect,
} from '@/api/task/task'
import type { MatrixResult } from '@/api/electronic'
import {
  formatSatelliteCoverage,
  formatSatelliteCoverageReduce,
  formatSatelliteDelayIncrease,
  formatSatelliteDelayMinutes,
  formatSatelliteThreat,
  resolveTrueDelayAfter,
} from '@/utils/buildSatelliteAnalysisTable'
import { parseFeedbackTimestamp, splitDateTimeDisplay } from '@/utils/zhchPlanDisplay'
import * as satellitejs from 'satellite.js'

/** 推演事件类型（用于同刻排序） */
export type SatelliteDeductionEventKind =
  | 'battlePass'
  | 'stationPass'
  | 'satelliteStrike'
  | 'receiveStrike'
  | 'metricChange'

/** 推演提示高亮类型 */
export type DeductionHighlightKind =
  | 'satellite'
  | 'event'
  | 'threat'
  | 'delay'
  | 'coverage'
  | 'time'
  | 'weapon'
  | 'station'
  | 'default'

/** 推演提示片段（单段可高亮） */
export interface DeductionToastSegment {
  /** 展示文本 */
  text: string
  /** 高亮样式类型 */
  kind: DeductionHighlightKind
}

/** 推演提示一行（由多段组成） */
export interface DeductionToastLine {
  /** 按顺序拼接的文本片段 */
  segments: DeductionToastSegment[]
}

/** 合并后的推演事件（播放轴上的一个停顿点） */
export interface SatelliteDeductionEvent {
  /** 事件时刻（毫秒） */
  atMs: number
  /** 提示框展示的多行纯文本（兼容） */
  lines: string[]
  /** 带高亮结构的提示行 */
  highlightLines: DeductionToastLine[]
}

/** 单条待合并的推演事件 */
interface RawDeductionEvent {
  /** 事件类型 */
  kind: SatelliteDeductionEventKind
  /** 事件时刻（毫秒） */
  atMs: number
  /** 展示文案行 */
  line: string
  /** 高亮提示行 */
  highlightLine: DeductionToastLine
}

/**
 * 构造提示文本片段。
 *
 * @param text 文本
 * @param kind 高亮类型
 * @returns 片段对象
 */
const seg = (text: string, kind: DeductionHighlightKind = 'default'): DeductionToastSegment => ({
  text,
  kind,
})

/**
 * 为合并后的事件补充威胁度与链路时延摘要行（若矩阵中有数据）。
 *
 * @param event 合并事件
 * @param entity 系列实体
 * @param norad 卫星 NORAD
 */
const appendThreatAndDelaySummary = (
  event: SatelliteDeductionEvent,
  entity: LevelSeriesEntity,
  norad: number
): void => {
  const hasThreatLine = event.highlightLines.some((line) =>
    line.segments.some((part) => part.text.includes('威胁度'))
  )
  const hasDelayLine = event.highlightLines.some((line) =>
    line.segments.some((part) => part.text.includes('链路时延') || part.text.includes('覆盖率'))
  )

  const threatSat = entity.threatSats?.find((item) => item.norad === norad)
  if (!hasThreatLine && threatSat) {
    event.highlightLines.push({
      segments: [
        seg('威胁度 ', 'default'),
        seg(formatSatelliteThreat(threatSat.threatScore), 'threat'),
        seg(' → ', 'default'),
        seg(formatSatelliteThreat(threatSat.afterThreatScore), 'threat'),
      ],
    })
  }

  const timeEffect = findTimeEffectForNorad(entity.timeEffects, norad)
  if (!hasDelayLine && timeEffect && Number.isFinite(timeEffect.duration)) {
    const afterDelay = resolveTrueDelayAfter(timeEffect.duration, timeEffect.afterDuration)
    const segments: DeductionToastSegment[] = [
      seg('链路时延 ', 'default'),
      seg(formatSatelliteDelayMinutes(timeEffect.duration), 'delay'),
    ]
    if (afterDelay != null) {
      segments.push(seg(' → ', 'default'), seg(formatSatelliteDelayMinutes(afterDelay), 'delay'))
      if (Number.isFinite(timeEffect.afterDuration) && Math.abs(Number(timeEffect.afterDuration)) > 1e-9) {
        segments.push(seg('（', 'default'), seg(formatSatelliteDelayIncrease(timeEffect.afterDuration), 'delay'), seg('）', 'default'))
      }
    }
    event.highlightLines.push({ segments })
  }
}

/**
 * 构建覆盖率变化高亮行。
 *
 * @param initSat 打击前矩阵
 * @param postCoverage 打击后覆盖率
 * @returns 高亮行或 null
 */
const buildCoverageHighlightLine = (
  initSat: InitMatrix,
  postCoverage: number | null | undefined
): DeductionToastLine | null => {
  const beforeCov = initSat.coverage
  const afterCov = postCoverage
  if (
    !Number.isFinite(beforeCov) ||
    !Number.isFinite(afterCov) ||
    Math.abs(Number(beforeCov) - Number(afterCov)) <= 1e-6
  ) {
    return null
  }
  return {
    segments: [
      seg('覆盖率 ', 'default'),
      seg(formatSatelliteCoverage(beforeCov), 'coverage'),
      seg(' → ', 'default'),
      seg(formatSatelliteCoverage(afterCov), 'coverage'),
      seg(`（${formatSatelliteCoverageReduce(beforeCov, afterCov)}）`, 'coverage'),
    ],
  }
}

/** 同刻事件稳定排序权重（越小越靠前） */
const KIND_ORDER: Record<SatelliteDeductionEventKind, number> = {
  battlePass: 0,
  stationPass: 1,
  satelliteStrike: 2,
  receiveStrike: 3,
  metricChange: 4,
}

/**
 * 将时间文本格式化为「xx时xx分」展示。
 *
 * @param timeText 原始时间字符串
 * @returns 中文时分文案；无效时返回 `--`
 */
export const formatDeductionHmLabel = (timeText?: string | null): string => {
  if (!timeText?.trim()) return '--'
  const { time } = splitDateTimeDisplay(timeText.trim())
  const segment = time || timeText.trim()
  const match = segment.match(/^(\d{1,2}):(\d{2})/)
  if (match) {
    return `${Number(match[1])}时${match[2]}分`
  }
  const ms = parseFeedbackTimestamp(timeText)
  if (ms == null) return '--'
  const date = new Date(ms)
  return `${date.getHours()}时${String(date.getMinutes()).padStart(2, '0')}分`
}

/**
 * 解析矩阵时间字段为毫秒时间戳。
 *
 * @param value 时间字符串
 * @returns 毫秒时间戳；无效时返回 null
 */
const parseMatrixTimeMs = (value?: string | null): number | null => {
  if (!value?.trim() || value.trim() === '无' || value.trim() === '--') return null
  const trimmed = value.trim()
  const fromFeedback = parseFeedbackTimestamp(trimmed)
  if (fromFeedback != null) return fromFeedback
  const normalized = new Date(trimmed.replace(/-/g, '/'))
  if (!Number.isNaN(normalized.getTime())) return normalized.getTime()
  return null
}

/**
 * 规范化卫星名称以便打击方案匹配（忽略空格与大小写）。
 *
 * @param name 卫星名称
 * @returns 规范化字符串
 */
const normalizeSatelliteNameKey = (name: string): string => {
  return name.replace(/\s+/g, '').replace(/-+/g, '-').toLowerCase()
}

/**
 * 判断 attackPlan 目标类型是否为卫星（含普通/中继表述）。
 *
 * @param targetType 接口 targetType
 * @returns 是否为卫星类目标
 */
const isSatelliteTargetType = (targetType?: string): boolean => {
  const t = (targetType || '').trim()
  if (!t) return true
  if (t.includes('接收') || t.includes('地面') || t.includes('中心') || t.includes('数据')) return false
  return t.includes('卫星') || t.toUpperCase() === 'SAT' || t.toUpperCase() === 'RELAY'
}

/**
 * 判断 attackPlan 目标类型是否为接收站。
 *
 * @param targetType 接口 targetType
 * @returns 是否为接收站目标
 */
const isReceiveTargetType = (targetType?: string): boolean => {
  const t = (targetType || '').trim()
  if (!t) return false
  return t.includes('接收') || t.includes('地面')
}

/**
 * 收集该星 initWindows 关联的接收站 ID / 名称集合。
 *
 * @param windows 初始过站窗口列表
 * @returns ID 与名称集合
 */
const collectReceiveKeysFromWindows = (
  windows: InitWindow[]
): { receiveIds: Set<string>; receiveNames: Set<string> } => {
  const receiveIds = new Set<string>()
  const receiveNames = new Set<string>()
  windows.forEach((win) => {
    if (win.receiveId?.trim()) receiveIds.add(win.receiveId.trim())
    if (win.receiveName?.trim()) receiveNames.add(win.receiveName.trim())
  })
  return { receiveIds, receiveNames }
}

/**
 * 解析接收站展示名称。
 *
 * @param win 过站窗口
 * @returns 接收站名称
 */
const resolveReceiveDisplayName = (win: InitWindow): string => {
  return win.receiveName?.trim() || win.receiveId?.trim() || '--'
}

/**
 * 判断打击方案是否命中指定卫星。
 *
 * @param plan 打击方案
 * @param norad 卫星 NORAD
 * @param satName 卫星名称
 * @returns 是否命中
 */
const matchSatelliteAttackPlan = (plan: AttackPlan, norad: number, satName: string): boolean => {
  if (!isSatelliteTargetType(plan.targetType)) return false
  const targetId = plan.targetId?.trim()
  const idMatch =
    targetId === String(norad) || (targetId != null && Number(targetId) === norad)
  const targetName = plan.target?.trim() || ''
  const nameKey = normalizeSatelliteNameKey(satName)
  const targetKey = normalizeSatelliteNameKey(targetName)
  const nameMatch =
    Boolean(nameKey && targetKey) &&
    (nameKey === targetKey || nameKey.includes(targetKey) || targetKey.includes(nameKey))
  return idMatch || nameMatch
}

/**
 * 判断打击方案是否命中该星链路中的接收站。
 *
 * @param plan 打击方案
 * @param receiveIds 接收站 ID 集合
 * @param receiveNames 接收站名称集合
 * @returns 是否命中
 */
const matchReceiveAttackPlan = (
  plan: AttackPlan,
  receiveIds: Set<string>,
  receiveNames: Set<string>
): boolean => {
  if (!isReceiveTargetType(plan.targetType)) return false
  const id = plan.targetId?.trim()
  const name = plan.target?.trim()
  if (id && receiveIds.has(id)) return true
  if (name && receiveNames.has(name)) return true
  if (name) {
    const targetKey = normalizeSatelliteNameKey(name)
    for (const receiveName of receiveNames) {
      if (normalizeSatelliteNameKey(receiveName) === targetKey) return true
    }
  }
  return false
}

/**
 * 取该 NORAD 在 timeEffects 中的时延记录（首条）。
 *
 * @param effects 时延列表
 * @param norad 卫星 NORAD
 * @returns 时延记录或 null
 */
const findTimeEffectForNorad = (effects: TimeEffect[] | undefined, norad: number): TimeEffect | null => {
  if (!effects?.length) return null
  return effects.find((item) => item.norad === norad) ?? null
}

/**
 * 构建指标变化文案行（覆盖率、链路时延）。
 *
 * @param initSat 打击前矩阵
 * @param postCoverage 打击后覆盖率
 * @param timeEffect 时延记录
 * @returns 文案行列表
 */
const buildMetricChangeHighlightLines = (
  initSat: InitMatrix,
  postCoverage: number | null | undefined,
  timeEffect: TimeEffect | null
): Array<{ line: string; highlightLine: DeductionToastLine }> => {
  const result: Array<{ line: string; highlightLine: DeductionToastLine }> = []
  const coverageLine = buildCoverageHighlightLine(initSat, postCoverage)
  if (coverageLine) {
    result.push({
      line: coverageLine.segments.map((part) => part.text).join(''),
      highlightLine: coverageLine,
    })
  }

  const delayBefore = timeEffect?.duration
  const delayIncrease = timeEffect?.afterDuration
  const delayAfter = resolveTrueDelayAfter(delayBefore, delayIncrease)
  const hasDelayChange =
    Number.isFinite(delayIncrease) && Math.abs(Number(delayIncrease)) > 1e-9
  if (hasDelayChange && Number.isFinite(delayBefore) && delayAfter != null) {
    const highlightLine: DeductionToastLine = {
      segments: [
        seg('链路时延 ', 'default'),
        seg(formatSatelliteDelayMinutes(delayBefore), 'delay'),
        seg(' → ', 'default'),
        seg(formatSatelliteDelayMinutes(delayAfter), 'delay'),
        seg('（', 'default'),
        seg(formatSatelliteDelayIncrease(delayIncrease), 'delay'),
        seg('）', 'default'),
      ],
    }
    result.push({
      line: highlightLine.segments.map((part) => part.text).join(''),
      highlightLine,
    })
  }

  return result
}

/**
 * 在 levelSeriesEntities 中定位包含指定 NORAD 的系列实体。
 *
 * @param data 任务分析数据
 * @param norad 卫星 NORAD
 * @returns 系列实体；未找到时 null
 */
export const findLevelSeriesEntityForNorad = (
  data: SatelliteAnalysisData | null | undefined,
  norad: number
): LevelSeriesEntity | null => {
  if (!data?.levelSeriesEntities?.length || !norad) return null
  for (const entity of data.levelSeriesEntities) {
    const inInit = entity.initMatrixList?.some((sat) => sat.norad === norad)
    const inPost = entity.satelliteMatrixList?.some((sat) => sat.norad === norad)
    if (inInit || inPost) return entity
  }
  return null
}

/**
 * 解析推演用的系列实体：优先任务全量分析，兜底当前系列矩阵。
 *
 * @param norad 卫星 NORAD
 * @param analysisData 任务分析数据
 * @param matrixFallback 当前选中系列矩阵
 * @returns 系列实体；未找到时 null
 */
export const resolveLevelSeriesEntityForNorad = (
  norad: number,
  analysisData?: SatelliteAnalysisData | null,
  matrixFallback?: MatrixResult | null
): LevelSeriesEntity | null => {
  if (!norad) return null
  const fromAnalysis = findLevelSeriesEntityForNorad(analysisData, norad)
  if (fromAnalysis) return fromAnalysis

  const matrix = matrixFallback
  if (!matrix) return null
  const inInit = matrix.initMatrixList?.some((sat) => sat.norad === norad)
  const inPost = matrix.satelliteMatrixList?.some((sat) => sat.norad === norad)
  if (inInit || inPost) {
    return matrix as unknown as LevelSeriesEntity
  }
  return null
}

/**
 * 将打击后过站窗口转为 initWindows 结构（用于无 initWindows 时兜底）。
 *
 * @param postSat 打击后卫星矩阵
 * @returns 与 InitWindow 兼容的窗口列表
 */
const mapPostStationWindowsToInit = (postSat: SatelliteMatrix): InitWindow[] => {
  return (postSat.stationWindows || []).map((win) => ({
    receiveId: win.receiveId,
    receiveName: win.receiveName,
    receiveLat: null,
    receiveLon: null,
    receiveUsage: win.receiveUsage ?? null,
    peakWindow: win.peakWindow,
    endWindow: win.endWindow,
    battleWindow: '',
    height: null,
  }))
}

/**
 * 合并 init / post 过站窗口并按 peakWindow 去重排序。
 *
 * @param initWindows 打击前窗口
 * @param postWindows 打击后窗口映射
 * @returns 合并后的窗口列表
 */
const mergePassWindows = (initWindows: InitWindow[], postWindows: InitWindow[]): InitWindow[] => {
  const map = new Map<string, InitWindow>()
  const put = (win: InitWindow) => {
    const key = `${win.receiveId || ''}|${win.receiveName || ''}|${win.peakWindow || ''}`
    if (!win.peakWindow?.trim()) return
    if (!map.has(key)) map.set(key, win)
  }
  initWindows.forEach(put)
  postWindows.forEach(put)
  return [...map.values()].sort((a, b) => {
    const aMs = parseMatrixTimeMs(a.peakWindow) ?? Number.MAX_SAFE_INTEGER
    const bMs = parseMatrixTimeMs(b.peakWindow) ?? Number.MAX_SAFE_INTEGER
    return aMs - bMs
  })
}

/** 过站窗口（推演连线用） */
export interface DeductionStationPassWindow {
  /** 接收站 ID */
  receiveId: string
  /** 接收站名称 */
  receiveName: string
  /** 纬度 */
  latitude: number
  /** 经度 */
  longitude: number
  /** 过站开始（peakWindow）毫秒 */
  startMs: number
  /** 过站结束（endWindow）毫秒 */
  endMs: number
}

/** 推演 Cesium 视觉计划 */
export interface SatelliteDeductionVisualPlan {
  /** 卫星 NORAD */
  norad: number
  /** 一轨周期（秒） */
  orbitPeriodSec: number
  /** 过站时间窗列表 */
  stationPasses: DeductionStationPassWindow[]
  /** 卫星被打击时刻（毫秒）；无则 null */
  satelliteStrikeMs: number | null
  /** 接收站被打击记录 */
  receiveStrikes: Array<{ receiveId: string; receiveName: string; atMs: number }>
}

/** 推演事件与视觉计划打包结果 */
export interface SatelliteDeductionBundle {
  /** 事件时间轴 */
  events: SatelliteDeductionEvent[]
  /** 地图视觉效果计划 */
  visualPlan: SatelliteDeductionVisualPlan
}

/** buildVisualPlanFromContext 入参 */
interface VisualPlanContext {
  norad: number
  initSat: InitMatrix
  postSat: SatelliteMatrix | undefined
  windows: InitWindow[]
  satelliteStrikeMs: number | null
  raw: RawDeductionEvent[]
}

/**
 * 从 TLE 估算轨道周期（秒）。
 *
 * @param initSat 打击前卫星
 * @returns 周期秒数
 */
const resolveOrbitPeriodSec = (initSat: InitMatrix): number => {
  try {
    const satrec = satellitejs.twoline2satrec(initSat.line1, initSat.line2)
    if (satrec?.no && satrec.no > 0) {
      return Math.max(300, (2 * Math.PI) / satrec.no * 60)
    }
  } catch {
    /* fallback below */
  }
  const orbitType = initSat.orbitType ?? postSatOrbitFallback(initSat)
  if (orbitType === 1) return 90 * 60
  if (orbitType === 2) return 12 * 3600
  return 24 * 3600
}

/**
 * @param initSat 卫星矩阵
 * @returns 轨道类型
 */
const postSatOrbitFallback = (initSat: InitMatrix): number => initSat.orbitType ?? 1

/**
 * 构建推演视觉计划。
 *
 * @param ctx 上下文
 * @returns 视觉计划
 */
const buildVisualPlanFromContext = (ctx: VisualPlanContext): SatelliteDeductionVisualPlan => {
  const stationPasses: DeductionStationPassWindow[] = ctx.windows
    .map((win) => {
      const startMs = parseMatrixTimeMs(win.peakWindow)
      if (startMs == null) return null
      const endMs = parseMatrixTimeMs(win.endWindow) ?? startMs
      const lat = win.receiveLat
      const lon = win.receiveLon
      if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
      return {
        receiveId: win.receiveId?.trim() || '',
        receiveName: win.receiveName?.trim() || '',
        latitude: lat,
        longitude: lon,
        startMs,
        endMs: Math.max(endMs, startMs),
      }
    })
    .filter((item): item is DeductionStationPassWindow => item != null)

  const receiveStrikes: SatelliteDeductionVisualPlan['receiveStrikes'] = []
  ctx.raw.forEach((item) => {
    if (item.kind !== 'receiveStrike') return
    const nameMatch = item.line.match(/^(.+?)接收站被打击/)
    const receiveName = nameMatch?.[1]?.trim() || ''
    const matched =
      stationPasses.find((pass) => pass.receiveName === receiveName || pass.receiveId === receiveName) ??
      stationPasses.find((pass) => receiveName && item.line.includes(pass.receiveName))
    receiveStrikes.push({
      receiveId: matched?.receiveId || '',
      receiveName: matched?.receiveName || receiveName,
      atMs: item.atMs,
    })
  })

  let strikeMs = ctx.satelliteStrikeMs
  if (strikeMs == null) {
    const strikeEvent = ctx.raw.find((item) => item.kind === 'satelliteStrike')
    strikeMs = strikeEvent?.atMs ?? null
  }

  return {
    norad: ctx.norad,
    orbitPeriodSec: resolveOrbitPeriodSec(ctx.initSat),
    stationPasses,
    satelliteStrikeMs: strikeMs,
    receiveStrikes,
  }
}

/**
 * 内部构建：返回事件与 visualPlan。
 */
const buildSatelliteDeductionTimelineInternal = (
  entity: LevelSeriesEntity,
  norad: number
): { events: SatelliteDeductionEvent[]; visualPlan: SatelliteDeductionVisualPlan } | null => {
  let initSat = entity.initMatrixList?.find((sat) => sat.norad === norad)
  const postSat = entity.satelliteMatrixList?.find((sat) => sat.norad === norad)

  if (!initSat && postSat) {
    initSat = {
      norad: postSat.norad,
      name: postSat.name,
      satType: postSat.satType,
      line1: '',
      line2: '',
      orbitType: postSat.orbitType,
      usage: postSat.usage,
      battleWindow: postSat.battleWindow,
      height: postSat.height,
      initWindows: mapPostStationWindowsToInit(postSat),
      coverage: postSat.coverage,
    }
  }

  if (!initSat) return null

  const satName = initSat.name?.trim() || postSat?.name?.trim() || `NORAD-${norad}`
  const postMappedWindows = postSat ? mapPostStationWindowsToInit(postSat) : []
  const windows = mergePassWindows(initSat.initWindows || [], postMappedWindows)
  const { receiveIds, receiveNames } = collectReceiveKeysFromWindows(windows)
  const timeEffect = findTimeEffectForNorad(entity.timeEffects, norad)
  const metricHighlightEntries = buildMetricChangeHighlightLines(initSat, postSat?.coverage, timeEffect)

  const raw: RawDeductionEvent[] = []

  const battleWindowText = initSat.battleWindow?.trim() || postSat?.battleWindow?.trim() || ''
  const battleMs = parseMatrixTimeMs(battleWindowText)
  if (battleMs != null) {
    const timeHm = formatDeductionHmLabel(battleWindowText)
    raw.push({
      kind: 'battlePass',
      atMs: battleMs,
      line: `卫星${satName}经过战场，时间：${timeHm}`,
      highlightLine: {
        segments: [
          seg('卫星', 'default'),
          seg(satName, 'satellite'),
          seg(' ', 'default'),
          seg('经过战场', 'event'),
          seg('，时间：', 'default'),
          seg(timeHm, 'time'),
        ],
      },
    })
  }

  windows.forEach((win) => {
    const atMs = parseMatrixTimeMs(win.peakWindow)
    if (atMs == null) return
    const stationName = resolveReceiveDisplayName(win)
    const timeHm = formatDeductionHmLabel(win.peakWindow)
    raw.push({
      kind: 'stationPass',
      atMs,
      line: `卫星${satName}过${stationName}接收站，时间：${timeHm}`,
      highlightLine: {
        segments: [
          seg('卫星', 'default'),
          seg(satName, 'satellite'),
          seg(' ', 'default'),
          seg(`过${stationName}接收站`, 'event'),
          seg('，时间：', 'default'),
          seg(timeHm, 'time'),
        ],
      },
    })
  })

  let satelliteStrikeMs: number | null = null
  ;(entity.attackPlanList || []).forEach((plan) => {
    if (matchSatelliteAttackPlan(plan, norad, satName)) {
      const atMs = parseMatrixTimeMs(plan.beginTime)
      if (atMs == null) return
      if (satelliteStrikeMs == null || atMs < satelliteStrikeMs) satelliteStrikeMs = atMs
      const weaponName = plan.weaponName || '--'
      const timeHm = formatDeductionHmLabel(plan.beginTime)
      raw.push({
        kind: 'satelliteStrike',
        atMs,
        line: `卫星${satName}被打击，武器${weaponName}；时间：${timeHm}`,
        highlightLine: {
          segments: [
            seg('卫星', 'default'),
            seg(satName, 'satellite'),
            seg(' ', 'default'),
            seg('被打击，武器', 'event'),
            seg(weaponName, 'weapon'),
            seg('；时间：', 'default'),
            seg(timeHm, 'time'),
          ],
        },
      })
    } else if (matchReceiveAttackPlan(plan, receiveIds, receiveNames)) {
      const atMs = parseMatrixTimeMs(plan.beginTime)
      if (atMs == null) return
      const stationLabel = plan.target?.trim() || plan.targetId?.trim() || '--'
      const timeHm = formatDeductionHmLabel(plan.beginTime)
      raw.push({
        kind: 'receiveStrike',
        atMs,
        line: `${stationLabel}接收站被打击，时间：${timeHm}`,
        highlightLine: {
          segments: [
            seg(stationLabel, 'station'),
            seg('接收站', 'default'),
            seg('被打击', 'event'),
            seg('，时间：', 'default'),
            seg(timeHm, 'time'),
          ],
        },
      })
    }
  })

  windows.forEach((win) => {
    const atMs = parseMatrixTimeMs(win.battleWindow)
    if (atMs == null) return
    const stationName = resolveReceiveDisplayName(win)
    const timeHm = formatDeductionHmLabel(win.battleWindow)
    raw.push({
      kind: 'receiveStrike',
      atMs,
      line: `${stationName}接收站被打击，时间：${timeHm}`,
      highlightLine: {
        segments: [
          seg(stationName, 'station'),
          seg('接收站被打击', 'event'),
          seg('，时间：', 'default'),
          seg(timeHm, 'time'),
        ],
      },
    })
  })

  const hasSatelliteStrikeEvent = raw.some((item) => item.kind === 'satelliteStrike')
  if (!hasSatelliteStrikeEvent && postSat?.satelliteStatus === 1) {
    const atMs = parseMatrixTimeMs(postSat.battleWindow)
    if (atMs != null) {
      if (satelliteStrikeMs == null || atMs < satelliteStrikeMs) satelliteStrikeMs = atMs
      const weapons = postSat.weapons?.length ? postSat.weapons : [{ name: '--' }]
      weapons.forEach((weapon) => {
        const weaponName = weapon.name || '--'
        const timeHm = formatDeductionHmLabel(postSat.battleWindow)
        raw.push({
          kind: 'satelliteStrike',
          atMs,
          line: `卫星${satName}被打击，武器${weaponName}；时间：${timeHm}`,
          highlightLine: {
            segments: [
              seg('卫星', 'default'),
              seg(satName, 'satellite'),
              seg(' ', 'default'),
              seg('被打击，武器', 'event'),
              seg(weaponName, 'weapon'),
              seg('；时间：', 'default'),
              seg(timeHm, 'time'),
            ],
          },
        })
      })
    }
  }

  if (metricHighlightEntries.length) {
    const attachMs =
      satelliteStrikeMs ??
      raw.find((item) => item.kind === 'satelliteStrike')?.atMs ??
      null
    if (attachMs != null) {
      metricHighlightEntries.forEach((entry) => {
        raw.push({
          kind: 'metricChange',
          atMs: attachMs,
          line: entry.line,
          highlightLine: entry.highlightLine,
        })
      })
    }
  }

  raw.sort((a, b) => {
    if (a.atMs !== b.atMs) return a.atMs - b.atMs
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  })

  const merged: SatelliteDeductionEvent[] = []
  raw.forEach((item) => {
    const last = merged[merged.length - 1]
    if (last && last.atMs === item.atMs) {
      if (!last.lines.includes(item.line)) last.lines.push(item.line)
      last.highlightLines.push(item.highlightLine)
      return
    }
    merged.push({
      atMs: item.atMs,
      lines: [item.line],
      highlightLines: [item.highlightLine],
    })
  })

  merged.forEach((event) => appendThreatAndDelaySummary(event, entity, norad))

  const visualPlan = buildVisualPlanFromContext({
    norad,
    initSat,
    postSat,
    windows,
    satelliteStrikeMs,
    raw,
  })

  return { events: merged, visualPlan }
}

/**
 * 构建推演事件与视觉计划。
 *
 * @param entity 系列实体
 * @param norad 卫星 NORAD
 * @returns 事件与视觉计划；无 init 卫星时 null
 */
export const buildSatelliteDeductionBundle = (
  entity: LevelSeriesEntity,
  norad: number
): SatelliteDeductionBundle | null => {
  const internal = buildSatelliteDeductionTimelineInternal(entity, norad)
  if (!internal || !internal.events.length) return null
  return { events: internal.events, visualPlan: internal.visualPlan }
}

/**
 * 对外兼容：仅返回事件列表。
 *
 * @param entity 系列实体
 * @param norad 卫星 NORAD
 * @returns 合并排序后的事件列表
 */
export const buildSatelliteDeductionTimeline = (
  entity: LevelSeriesEntity,
  norad: number
): SatelliteDeductionEvent[] => buildSatelliteDeductionBundle(entity, norad)?.events ?? []

/**
 * 根据当前推演时刻解析 Cesium 视觉状态。
 *
 * @param plan 视觉计划
 * @param currentMs 当前时刻
 * @param isPlaying 是否推演播放中
 * @returns 视觉状态
 */
export const resolveDeductionVisualState = (
  plan: SatelliteDeductionVisualPlan | null,
  currentMs: number,
  isPlaying: boolean
): {
  showOrbitPath: boolean
  activePass: DeductionStationPassWindow | null
  showExplosion: boolean
  struckReceiveKeys: Set<string>
} => {
  const empty = {
    showOrbitPath: false,
    activePass: null as DeductionStationPassWindow | null,
    showExplosion: false,
    struckReceiveKeys: new Set<string>(),
  }
  if (!plan || !isPlaying) return empty

  const activePass =
    plan.stationPasses.find((pass) => currentMs >= pass.startMs && currentMs <= pass.endMs) ?? null

  const showExplosion =
    plan.satelliteStrikeMs != null &&
    currentMs >= plan.satelliteStrikeMs &&
    currentMs <= plan.satelliteStrikeMs + 6000

  const struckReceiveKeys = new Set<string>()
  plan.receiveStrikes.forEach((strike) => {
    if (currentMs >= strike.atMs) {
      if (strike.receiveId) struckReceiveKeys.add(strike.receiveId)
      if (strike.receiveName) struckReceiveKeys.add(strike.receiveName)
    }
  })

  return {
    showOrbitPath: true,
    activePass,
    showExplosion,
    struckReceiveKeys,
  }
}
