import type {
  AttackPlan,
  InitMatrix,
  InitWindow,
  LevelSeriesEntity,
  RelationList,
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
  formatSatelliteThreatReduce,
  resolveTrueDelayAfter,
} from '@/utils/buildSatelliteAnalysisTable'
import { parseReceiveLatLonString } from '@/utils/buildBattleGlobeGroundTargets'
import * as satellitejs from 'satellite.js'

//-----------------------------构建推演时间轴-----------------------------
// 本函数主要用于构建推演时间轴，将推演事件按照时间顺序排列，并构建推演提示文本。
//-----------------------------------------------------------------------

/** 推演事件类型（用于同刻排序） */
export type SatelliteDeductionEventKind =
  | 'battlePass'// 经过战场
  | 'stationPass'// 经过接收站
  | 'satelliteStrike'// 打击卫星
  | 'receiveStrike'// 打击接收站
  | 'metricChange'// 指标变化

/** 推演提示高亮类型 */
export type DeductionHighlightKind =
  | 'satellite'// 卫星
  | 'event'// 事件
  | 'threat'// 威胁度
  | 'delay'// 链路时延
  | 'coverage'// 覆盖率
  | 'time'// 时间
  | 'weapon'// 武器
  | 'station'// 接收站
  | 'default'// 默认

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
  // 判断是否已存在威胁度行
  const hasThreatLine = event.highlightLines.some((line) =>
    line.segments.some((part) => part.text.includes('威胁度'))
  )
  // 判断是否已存在链路时延行
  const hasDelayLine = event.highlightLines.some((line) =>
    line.segments.some((part) => part.text.includes('链路时延') || part.text.includes('覆盖率'))
  )
  // 获取卫星威胁度
  const threatSat = entity.threatSats?.find((item) => item.norad === norad)
  if (!hasThreatLine && threatSat) {
    // 添加威胁度行
    event.highlightLines.push({
      segments: [
        seg('威胁度 ', 'default'),
        seg(formatSatelliteThreat(threatSat.threatScore), 'threat'),
        seg(' → ', 'default'),
        seg(formatSatelliteThreat(threatSat.afterThreatScore), 'threat'),
      ],
    })
  }
  // 获取卫星链路时延
  const timeEffect = findTimeEffectForNorad(entity.timeEffects, norad)
  // 判断是否已存在链路时延行
  if (!hasDelayLine && timeEffect && Number.isFinite(timeEffect.duration)) {
    // 获取打击后链路时延
    const afterDelay = resolveTrueDelayAfter(timeEffect.duration, timeEffect.afterDuration)
    // 创建链路时延片段
    const segments: DeductionToastSegment[] = [
      seg('链路时延 ', 'default'),
      seg(formatSatelliteDelayMinutes(timeEffect.duration), 'delay'),
    ]
    // 判断打击后链路时延是否不为空
    if (afterDelay != null) {
      // 添加打击后链路时延片段
      segments.push(seg(' → ', 'default'), seg(formatSatelliteDelayMinutes(afterDelay), 'delay'))
      // 判断打击后链路时延是否为有效数字
      if (Number.isFinite(timeEffect.afterDuration) && Math.abs(Number(timeEffect.afterDuration)) > 1e-9) {
        // 添加打击后链路时延增量片段
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
  // 获取打击前覆盖率
  const beforeCov = initSat.coverage
  // 获取打击后覆盖率
  const afterCov = postCoverage
  // 判断打击前覆盖率和打击后覆盖率是否为有效数字
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

/** 推演提示右侧指标区展示数据 */
export interface DeductionToastMetricDisplay {
  /** 威胁度变化量，如 `-0.184` */
  threat?: string
  /** 链路时延变化量，如 `+34分钟` */
  delay?: string
  /** 覆盖率变化量，如 `-1.25%` */
  coverage?: string
}

/** 推演提示左右分栏布局 */
export interface DeductionToastDisplayLayout {
  /** 左侧叙事行（节点消息与时间） */
  narrativeLines: DeductionToastLine[]
  /** 右侧指标 */
  metrics: DeductionToastMetricDisplay
}

/**
 * 拼接提示行的完整文本。
 *
 * @param line 提示行
 * @returns 拼接后的字符串
 */
const joinToastLineText = (line: DeductionToastLine): string =>
  line.segments.map((part) => part.text).join('')

/**
 * 从括号片段中取出变化量文案（如 `+34分钟`、`-1.25%`）。
 *
 * @param text 整行文本
 * @returns 括号内内容；无匹配时返回 null
 */
const extractParenDeltaText = (text: string): string | null => {
  const match = text.match(/（([^）]+)）/)
  return match?.[1]?.trim() || null
}

/**
 * 从「打击前 → 打击后」数值对解析威胁度变化量。
 *
 * @param text 整行文本
 * @returns 变化量文案；无法解析时返回 null
 */
const parseThreatDeltaFromLine = (text: string): string | null => {
  const match = text.match(/威胁度\s*([\d.]+)\s*→\s*([\d.]+)/)
  // 判断匹配是否为空
  if (!match) return null
  // 获取威胁度变化量
  const before = Number(match[1])
  // 获取威胁度变化量
  const after = Number(match[2])
  // 判断威胁度变化量是否为有效数字
  if (!Number.isFinite(before) || !Number.isFinite(after)) return null
  // 获取威胁度变化量
  const delta = formatSatelliteThreatReduce(before, after)
  // 判断威胁度变化量是否为 '--'
  return delta === '--' ? null : delta
}

/**
 * 将推演提示行拆为「左侧叙事 + 右侧指标」布局。
 *
 * @param lines 当前事件的全部高亮行
 * @returns 分栏后的展示模型
 */
export const layoutDeductionToastLines = (lines: DeductionToastLine[]): DeductionToastDisplayLayout => {
  // 创建叙事行列表
  const narrativeLines: DeductionToastLine[] = []
  // 创建指标对象
  const metrics: DeductionToastMetricDisplay = {}

  // 遍历高亮行
  lines.forEach((line) => {
    // 获取文本
    const text = joinToastLineText(line)
    // 判断文本是否包含威胁度
    if (text.includes('威胁度')) {
      const delta = parseThreatDeltaFromLine(text)
      if (delta) metrics.threat = delta
      return
    }
    // 判断文本是否包含链路时延
    if (text.includes('链路时延')) {
      const parenDelta = extractParenDeltaText(text)
      // 判断括号内内容是否为空
      if (parenDelta) {
        // 如果括号内内容不为空，则设置链路时延
        metrics.delay = parenDelta
      } else {
        // 如果括号内内容为空，则获取链路时延变化量
        const increaseSeg = line.segments.find(
          (part) => part.kind === 'delay' && /^[+-]/.test(part.text.trim())
        )
        // 如果链路时延变化量不为空，则设置链路时延
        if (increaseSeg) metrics.delay = increaseSeg.text.trim()
      }
      return
    }
    // 判断文本是否包含覆盖率
    if (text.includes('覆盖率')) {
      const parenDelta = extractParenDeltaText(text)
      // 判断括号内内容是否为空
      if (parenDelta) metrics.coverage = parenDelta
      return
    }
    // 添加叙事行
    narrativeLines.push(line)
  })

  // 返回叙事行和指标
  return { narrativeLines, metrics }
}

/** 同刻事件稳定排序权重（越小越靠前） */
const KIND_ORDER: Record<SatelliteDeductionEventKind, number> = {
  // 经过战场
  battlePass: 0,
  // 经过接收站
  stationPass: 1,
  // 打击卫星
  satelliteStrike: 2,
  // 打击接收站
  receiveStrike: 3,
  // 指标变化
  metricChange: 4,
}

/**
 * 从接口时间字符串拆出本地墙上时钟，不经过 Date 时区换算。
 * 支持 `2026-09-16 15:24:52`、`2026-09-16T15:24:52`。
 *
 * @param timeText 原始时间文本
 * @returns 年月日时分秒；无法识别时返回 null
 */
const parseWallClockParts = (
  timeText?: string | null
): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null => {
  if (!timeText?.trim()) return null
  const match = timeText
    .trim()
    .match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  }
}

/**
 * 将时间文本格式化为「yyyy年MM月dd日 HH时mm分ss秒」。
 * 只取源字符串里的年月日时分秒，不用播放时钟、不用 Date.getHours。
 *
 * @param timeText 原始时间字符串
 * @returns 中文日期时间文案；无效时返回 `--`
 */
export const formatDeductionHmLabel = (timeText?: string | null): string => {
  const parts = parseWallClockParts(timeText)
  if (!parts) return '--'
  const month = String(parts.month).padStart(2, '0')
  const day = String(parts.day).padStart(2, '0')
  const hour = String(parts.hour).padStart(2, '0')
  const minute = String(parts.minute).padStart(2, '0')
  const second = String(parts.second).padStart(2, '0')
  return `${parts.year}年${month}月${day}日 ${hour}时${minute}分${second}秒`
}

/**
 * 将矩阵时间字段解析为本地毫秒时间戳（按墙上时钟，不做 UTC 换算）。
 *
 * @param value 时间字符串
 * @returns 毫秒时间戳；无效时返回 null
 */
const parseMatrixTimeMs = (value?: string | null): number | null => {
  if (!value?.trim() || value.trim() === '无' || value.trim() === '--') return null
  const parts = parseWallClockParts(value)
  if (!parts) return null
  const ms = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * 规范化卫星名称以便打击方案匹配（忽略空格与大小写）。
 *
 * @param name 卫星名称
 * @returns 规范化字符串
 */
const normalizeSatelliteNameKey = (name: string): string => {
  // 规范化卫星名称
  return name.replace(/\s+/g, '').replace(/-+/g, '-').toLowerCase()
}

/**
 * 判断地面目标 ID/名称是否命中推演过站高亮键（含模糊名称匹配）。
 *
 * @param targetId 目标 ID
 * @param targetName 展示名称
 * @param highlightKeys 过站 receiveId / receiveName 集合
 * @returns 是否应高亮
 */
export const matchesDeductionReceiveHighlight = (
  targetId: string,
  targetName: string,
  highlightKeys: Set<string>
): boolean => {
  // 判断高亮键集合是否为空
  if (!highlightKeys.size) return false
  // 获取目标 ID
  const id = targetId.trim()
  // 获取目标名称
  const name = targetName.trim()
  // 判断目标 ID 是否匹配
  if (id && highlightKeys.has(id)) return true
  // 判断目标名称是否匹配
  if (name && highlightKeys.has(name)) return true
  // 规范化目标名称
  const targetKey = normalizeSatelliteNameKey(name)
  // 遍历高亮键集合
  for (const key of highlightKeys) {
    // 获取高亮键
    const trimmed = key.trim()
    // 判断高亮键是否为空
    if (!trimmed) continue
    // 判断高亮键是否为目标 ID 或目标名称
    if (trimmed === id || trimmed === name) return true
    // 规范化高亮键
    const keyNorm = normalizeSatelliteNameKey(trimmed)
    // 判断高亮键是否为空
    if (!keyNorm || !targetKey) continue
    // 判断高亮键是否为目标名称
    if (keyNorm === targetKey || keyNorm.includes(targetKey) || targetKey.includes(keyNorm)) {
      // 如果高亮键为目标名称，则返回 true
      return true
    }
  }
  // 如果高亮键和目标名称都不匹配，则返回 false
  return false
}

/**
 * 判断 attackPlan 目标类型是否为卫星（含普通/中继表述）。
 *
 * @param targetType 接口 targetType
 * @returns 是否为卫星类目标
 */
const isSatelliteTargetType = (targetType?: string): boolean => {
  // 获取目标类型
  const t = (targetType || '').trim()
  // 判断目标类型是否为空
  if (!t) return true
  // 判断目标类型是否包含接收或地面或中心或数据
  if (t.includes('接收') || t.includes('地面') || t.includes('中心') || t.includes('数据')) return false
  // 判断目标类型是否包含卫星或SAT或RELAY
  return t.includes('卫星') || t.toUpperCase() === 'SAT' || t.toUpperCase() === 'RELAY'
}

/**
 * 判断 attackPlan 目标类型是否为接收站。
 *
 * @param targetType 接口 targetType
 * @returns 是否为接收站目标
 */
const isReceiveTargetType = (targetType?: string): boolean => {
  // 获取目标类型
  const t = (targetType || '').trim()
  // 判断目标类型是否为空
  if (!t) return false
  // 判断目标类型是否包含接收或地面
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
  // 创建接收站 ID 集合
  const receiveIds = new Set<string>()
  // 创建接收站名称集合
  const receiveNames = new Set<string>()
  // 遍历初始过站窗口列表
  windows.forEach((win) => {
    // 判断接收站 ID 是否为空
    if (win.receiveId?.trim()) receiveIds.add(win.receiveId.trim())
    // 判断接收站名称是否为空
    if (win.receiveName?.trim()) receiveNames.add(win.receiveName.trim())
  })
  // 返回接收站 ID 和名称集合
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
 * 取出打击方案的 beginTime 原文。只认字符串，不把 Date/播放时钟转回去。
 *
 * @param plan 打击方案
 * @returns beginTime 原文；没有则空串
 */
const resolvePlanBeginTimeText = (plan: AttackPlan): string => {
  const raw = plan.beginTime
  return typeof raw === 'string' ? raw.trim() : ''
}

/**
 * 推演打击方案列表：当前系列矩阵包含该星时，用矩阵的 `attackPlanList`（与你在接口里看到的 JSON 一致）；
 * 否则回退任务分析实体上的列表。
 *
 * @param entity 系列实体（任务分析或矩阵）
 * @param norad 当前卫星 NORAD
 * @param satName 当前卫星名称
 * @param matrixFallback 当前选中系列矩阵
 * @returns 用于生成打击事件的方案列表
 */
const resolveDeductionAttackPlans = (
  entity: LevelSeriesEntity,
  norad: number,
  _satName: string,
  matrixFallback?: MatrixResult | null
): AttackPlan[] => {
  const satInMatrix =
    Boolean(matrixFallback?.initMatrixList?.some((sat) => sat.norad === norad)) ||
    Boolean(matrixFallback?.satelliteMatrixList?.some((sat) => sat.norad === norad))
  if (satInMatrix && (matrixFallback?.attackPlanList?.length || 0) > 0) {
    return matrixFallback!.attackPlanList as AttackPlan[]
  }
  return entity.attackPlanList || []
}

/**
 * 判断打击方案是否命中指定卫星。有 targetId 时优先比 NORAD；名称只做全等，不做模糊包含。
 *
 * @param plan 打击方案
 * @param norad 卫星 NORAD
 * @param satName 卫星名称
 * @returns 是否命中
 */
const matchSatelliteAttackPlan = (plan: AttackPlan, norad: number, satName: string): boolean => {
  if (!isSatelliteTargetType(plan.targetType)) return false
  const targetId = plan.targetId?.trim()
  const idMatch = Boolean(targetId) && (targetId === String(norad) || Number(targetId) === norad)
  if (idMatch) return true
  const targetName = plan.target?.trim() || ''
  const nameKey = normalizeSatelliteNameKey(satName)
  const targetKey = normalizeSatelliteNameKey(targetName)
  return Boolean(nameKey && targetKey) && nameKey === targetKey
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
  const targetType = (plan.targetType || '').trim()
  if (targetType && isSatelliteTargetType(targetType) && !isReceiveTargetType(targetType)) {
    return false
  }
  const id = plan.targetId?.trim()
  const name = plan.target?.trim()
  if (id && receiveIds.has(id)) return true
  if (name && receiveNames.has(name)) return true
  // 判断目标名称是否匹配
  if (name) {
    // 规范化目标名称
    const targetKey = normalizeSatelliteNameKey(name)
    // 遍历接收站名称集合
    for (const receiveName of receiveNames) {
      // 判断接收站名称是否匹配
      if (normalizeSatelliteNameKey(receiveName) === targetKey) return true
    }
  }
  // 如果接收站名称和 ID 都不匹配，则返回 false
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
  // 如果时延列表为空，则返回 null
  if (!effects?.length) return null
  // 获取该 NORAD 的时延记录
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
  // 打击前矩阵
  initSat: InitMatrix,
  // 打击后覆盖率
  postCoverage: number | null | undefined,
  // 时延记录
  timeEffect: TimeEffect | null
  // 文案行列表
): Array<{ line: string; highlightLine: DeductionToastLine }> => {
  // 创建文案行列表
  const result: Array<{ line: string; highlightLine: DeductionToastLine }> = []
  // 构建覆盖率文案行
  const coverageLine = buildCoverageHighlightLine(initSat, postCoverage)
  // 如果覆盖率文案行不为空，则添加到文案行列表
  if (coverageLine) {
    // 添加覆盖率文案行到文案行列表
    result.push({
      line: coverageLine.segments.map((part) => part.text).join(''),
      highlightLine: coverageLine,
    })
  }

  // 获取时延记录
  const delayBefore = timeEffect?.duration
  // 获取时延增量
  const delayIncrease = timeEffect?.afterDuration
  // 计算真实时延
  const delayAfter = resolveTrueDelayAfter(delayBefore, delayIncrease)
  // 判断是否有时延变化
  const hasDelayChange =
    Number.isFinite(delayIncrease) && Math.abs(Number(delayIncrease)) > 1e-9
  // 如果时延变化不为空，则添加到文案行列表
  if (hasDelayChange && Number.isFinite(delayBefore) && delayAfter != null) {
    // 创建时延文案行
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
    // 添加时延文案行到文案行列表
    result.push({
      line: highlightLine.segments.map((part) => part.text).join(''),
      highlightLine,
    })
  }
  // 返回文案行列表
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
  // 任务分析数据
  data: SatelliteAnalysisData | null | undefined,
  // 卫星 NORAD
  norad: number
): LevelSeriesEntity | null => {
  // 如果任务分析数据为空，或者卫星 NORAD 为空，则返回 null
  if (!data?.levelSeriesEntities?.length || !norad) return null
  // 遍历任务分析数据中的系列实体
  for (const entity of data.levelSeriesEntities) {
    // 判断系列实体是否包含该卫星 NORAD
    const inInit = entity.initMatrixList?.some((sat) => sat.norad === norad)
    // 判断系列实体是否包含该卫星 NORAD
    const inPost = entity.satelliteMatrixList?.some((sat) => sat.norad === norad)
    // 如果系列实体包含该卫星 NORAD，则返回系列实体
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
  // 卫星 NORAD
  norad: number,
  // 任务分析数据
  analysisData?: SatelliteAnalysisData | null,
  // 当前选中系列矩阵
  matrixFallback?: MatrixResult | null
): LevelSeriesEntity | null => {
  // 如果卫星 NORAD 为空，则返回 null
  if (!norad) return null
  // 从任务分析数据中获取系列实体
  const fromAnalysis = findLevelSeriesEntityForNorad(analysisData, norad)
  // 如果从任务分析数据中获取系列实体不为空，则返回系列实体
  if (fromAnalysis) return fromAnalysis
  // 获取当前选中系列矩阵
  const matrix = matrixFallback
  // 如果当前选中系列矩阵为空，则返回 null
  if (!matrix) return null
  // 判断当前选中系列矩阵是否包含该卫星 NORAD
  const inInit = matrix.initMatrixList?.some((sat) => sat.norad === norad)
  // 判断当前选中系列矩阵是否包含该卫星 NORAD
  const inPost = matrix.satelliteMatrixList?.some((sat) => sat.norad === norad)
  // 如果当前选中系列矩阵包含该卫星 NORAD，则返回当前选中系列矩阵
  if (inInit || inPost) return matrix as unknown as LevelSeriesEntity
  // 如果当前选中系列矩阵不包含该卫星 NORAD，则返回 null
  return null
}

/**
 * 将 satelliteMatrixList.stationWindows 转为推演过站窗口。
 * 过站开始/结束取 peakWindow / endWindow；经纬度从 initWindows 按接收站补全。
 *
 * @param postSat 打击后卫星矩阵
 * @param initWindows 打击前窗口（仅补坐标，不作为过站时间来源）
 * @returns 过站窗口列表
 */
const mapStationWindowsForDeduction = (
  postSat: SatelliteMatrix | undefined,
  initWindows: InitWindow[]
): InitWindow[] => {
  return (postSat?.stationWindows || [])
    .map((win) => {
      const receiveId = win.receiveId?.trim()
      const receiveName = win.receiveName?.trim()
      const initMatch =
        (receiveId
          ? initWindows.find((item) => item.receiveId?.trim() === receiveId)
          : undefined) ||
        (receiveName
          ? initWindows.find((item) => item.receiveName?.trim() === receiveName)
          : undefined)
      return {
        receiveId: win.receiveId,
        receiveName: win.receiveName,
        receiveLat: initMatch?.receiveLat ?? null,
        receiveLon: initMatch?.receiveLon ?? null,
        receiveUsage: win.receiveUsage ?? initMatch?.receiveUsage ?? null,
        peakWindow: win.peakWindow,
        endWindow: win.endWindow,
        battleWindow: '',
        height: initMatch?.height ?? null,
      }
    })
    .filter((win) => Boolean(win.peakWindow?.trim()))
    .sort((a, b) => (parseMatrixTimeMs(a.peakWindow) ?? 0) - (parseMatrixTimeMs(b.peakWindow) ?? 0))
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
  // 卫星 NORAD
  norad: number
  // 打击前卫星
  initSat: InitMatrix
  // 打击后卫星
  postSat: SatelliteMatrix | undefined
  // 过站窗口
  windows: InitWindow[]
  /** 打击前关系列表，用于补全过站经纬度 */
  initRelationList: RelationList | null | undefined
  // 卫星打击时间戳
  satelliteStrikeMs: number | null
  // 推演事件
  raw: RawDeductionEvent[]
}

/**
 * 解析过站窗口对应接收站经纬度（窗口字段缺失时从关系列表补全）。
 *
 * @param win 过站窗口
 * @param relation 接收站关系列表
 * @returns 经纬度或 null
 */
const resolveReceiveCoordsForWindow = (
  win: InitWindow,
  relation: RelationList | null | undefined
): { latitude: number; longitude: number } | null => {
  // 获取接收站纬度
  const lat = win.receiveLat
  // 获取接收站经度
  const lon = win.receiveLon
  // 如果接收站纬度和经度不为空，并且为有限数，则返回接收站经纬度
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    return { latitude: lat, longitude: lon }
  }
  // 获取接收站 ID
  const winId = win.receiveId?.trim()
  // 获取接收站名称
  const winName = win.receiveName?.trim()
  // 遍历接收站关系列表
  for (const receive of relation?.receiveObjList || []) {
    // 获取接收站 ID
    const receiveId = receive.receiveId?.trim()
    // 获取接收站名称
    const receiveName = receive.receiveName?.trim()
    // 如果接收站 ID 和名称不为空，并且接收站 ID 和名称匹配，则返回接收站经纬度
    const idMatch = Boolean(winId && receiveId && winId === receiveId)
    // 如果接收站名称不为空，并且接收站名称匹配，则返回接收站经纬度
    const nameMatch = Boolean(winName && receiveName) && (winName === receiveName || normalizeSatelliteNameKey(winName!) === normalizeSatelliteNameKey(receiveName!))
    // 如果接收站 ID 和名称不匹配，则继续遍历
    if (!idMatch && !nameMatch) continue
    // 解析接收站经纬度
    const coords = parseReceiveLatLonString(receive.receiveLatLon)
    // 如果接收站经纬度不为空，并且为有限数，则返回接收站经纬度
    if (coords) return coords
  }
  // 如果接收站经纬度为空，则返回 null
  return null
}

/**
 * 从 TLE 估算轨道周期（秒）。
 *
 * @param initSat 打击前卫星
 * @returns 周期秒数
 */
const resolveOrbitPeriodSec = (initSat: InitMatrix): number => {
  try {
    // 解析卫星轨道周期
    const satrec = satellitejs.twoline2satrec(initSat.line1, initSat.line2)
    // 如果卫星轨道周期大于0，则返回卫星轨道周期
    if (satrec?.no && satrec.no > 0) {
      // 返回卫星轨道周期
      return Math.max(300, (2 * Math.PI) / satrec.no * 60)
    }
  } catch {
    /* fallback below */
  }
  // 获取卫星轨道类型
  const orbitType = initSat.orbitType ?? postSatOrbitFallback(initSat)
  // 如果卫星轨道类型为1，则返回90分钟
  if (orbitType === 1) return 90 * 60
  // 如果卫星轨道类型为2，则返回12小时
  if (orbitType === 2) return 12 * 3600
  // 如果卫星轨道类型为3，则返回24小时
  return 24 * 3600
}

/**
 * @param initSat 卫星矩阵
 * @returns 轨道类型 默认1:低轨
 */
const postSatOrbitFallback = (initSat: InitMatrix): number => initSat.orbitType ?? 1 // 默认1:低轨

/**
 * 构建推演视觉计划。
 *
 * @param ctx 上下文
 * @returns 视觉计划
 */
const buildVisualPlanFromContext = (ctx: VisualPlanContext): SatelliteDeductionVisualPlan => {
  // 构建过站窗口
  const stationPasses: DeductionStationPassWindow[] = ctx.windows
    // 遍历过站窗口
    .map((win) => {
      // 解析过站开始时间戳
      const startMs = parseMatrixTimeMs(win.peakWindow)
      // 如果过站开始时间戳为空，则返回 null
      if (startMs == null) return null
      // 解析过站结束时间戳
      const endMs = parseMatrixTimeMs(win.endWindow) ?? startMs
      // 获取接收站经纬度
      const coords = resolveReceiveCoordsForWindow(win, ctx.initRelationList)
      // 如果接收站经纬度为空，则返回 null
      if (!coords) return null
      // 构建过站窗口
      return {
        // 获取接收站 ID  
        receiveId: win.receiveId?.trim() || '',
        // 获取接收站名称
        receiveName: win.receiveName?.trim() || '',
        // 获取接收站经纬度
        latitude: coords.latitude,
        // 获取接收站经纬度
        longitude: coords.longitude,
        // 设置过站开始时间戳
        startMs,
        // 设置过站结束时间戳
        endMs: Math.max(endMs, startMs),
      }
    })
    .filter((item): item is DeductionStationPassWindow => item != null)

  // 构建接收站打击记录
  const receiveStrikes: SatelliteDeductionVisualPlan['receiveStrikes'] = []
  // 遍历推演事件
  ctx.raw.forEach((item) => {
    if (item.kind !== 'receiveStrike') return
    // 获取接收站名称
    const nameMatch = item.line.match(/^(.+?)接收站被打击/)
    // 获取接收站名称
    const receiveName = nameMatch?.[1]?.trim() || ''
    // 获取匹配的过站窗口
    const matched =
      stationPasses.find((pass) => pass.receiveName === receiveName || pass.receiveId === receiveName) ??
      stationPasses.find((pass) => receiveName && item.line.includes(pass.receiveName))
    // 添加接收站打击记录
    receiveStrikes.push({
      // 获取接收站 ID
      receiveId: matched?.receiveId || '',
      // 获取接收站名称
      receiveName: matched?.receiveName || receiveName,
      // 设置接收站打击时间戳
      atMs: item.atMs,
    })
  })

  // 获取卫星打击时间戳
  let strikeMs = ctx.satelliteStrikeMs
  // 如果卫星打击时间戳为空，则获取推演事件中的卫星打击事件时间戳
  if (strikeMs == null) {
    const strikeEvent = ctx.raw.find((item) => item.kind === 'satelliteStrike')
    // 设置卫星打击时间戳
    strikeMs = strikeEvent?.atMs ?? null
  }

  return {
    // 获取卫星 NORAD
    norad: ctx.norad,
    // 获取轨道周期
    orbitPeriodSec: resolveOrbitPeriodSec(ctx.initSat),
    // 获取过站窗口
    stationPasses,
    // 获取卫星打击时间戳
    satelliteStrikeMs: strikeMs,
    // 获取接收站打击记录
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
  // 获取打击前卫星
  let initSat = entity.initMatrixList?.find((sat) => sat.norad === norad)
  // 获取打击后卫星
  const postSat = entity.satelliteMatrixList?.find((sat) => sat.norad === norad)

  // 如果打击前卫星不存在，则使用打击后卫星
  if (!initSat && postSat) {
    // 构建打击前卫星
    initSat = {
      // 设置卫星 NORAD
      norad: postSat.norad,
      // 设置卫星名称
      name: postSat.name,
      // 设置卫星类型
      satType: postSat.satType,
      // 设置卫星轨道线1
      line1: '',
      // 设置卫星轨道线2
      line2: '',
      // 设置卫星轨道类型
      orbitType: postSat.orbitType,
      // 设置卫星用途
      usage: postSat.usage,
      // 设置战场窗口
      battleWindow: postSat.battleWindow,
      height: postSat.height,
      initWindows: mapStationWindowsForDeduction(postSat, []),
      coverage: postSat.coverage,
    }
  }

  // 如果打击前卫星不存在，则返回 null
  if (!initSat) return null
  // 获取卫星名称
  const satName = initSat.name?.trim() || postSat?.name?.trim() || `NORAD-${norad}`
  // 过站时间只取 satelliteMatrixList.stationWindows（peakWindow / endWindow）
  const windows = mapStationWindowsForDeduction(postSat, initSat.initWindows || [])
  // 打击方案匹配接收站时，同时参考打击前窗口，避免漏掉仅出现在 initWindows 的站
  const { receiveIds, receiveNames } = collectReceiveKeysFromWindows([
    ...windows,
    ...(initSat.initWindows || []),
  ])
  // 查找卫星时间效果
  const timeEffect = findTimeEffectForNorad(entity.timeEffects, norad)
  // 构建指标变化高亮行
  const metricHighlightEntries = buildMetricChangeHighlightLines(initSat, postSat?.coverage, timeEffect)

  // 构建推演事件
  const raw: RawDeductionEvent[] = []
  // 获取经过战场窗口文本
  const battleWindowText = initSat.battleWindow?.trim() || postSat?.battleWindow?.trim() || ''
  // 解析战场窗口时间戳
  const battleMs = parseMatrixTimeMs(battleWindowText)
  // 如果战场窗口时间戳不为空，则添加经过战场事件
  if (battleMs != null) {
    const timeHm = formatDeductionHmLabel(battleWindowText)
    raw.push({
      // 设置事件类型
      kind: 'battlePass',
      // 设置事件时间戳
      atMs: battleMs,
      // 设置事件文本
      line: `卫星${satName}经过战场，时间：${timeHm}`,
      // 设置事件高亮行
      highlightLine: {
        segments: [
          // 设置卫星名称
          seg('卫星', 'default'),
          // 设置卫星名称
          seg(satName, 'satellite'),
          seg(' ', 'default'),
          // 设置经过战场事件
          seg('经过战场', 'event'),
          seg('，时间：', 'default'),
          seg(timeHm, 'time'),
        ],
      },
    })
  }
  // 遍历过站窗口
  windows.forEach((win) => {
    // 解析过站窗口时间戳
    const atMs = parseMatrixTimeMs(win.peakWindow)
    // 如果过站窗口时间戳为空，则返回
    if (atMs == null) return
    // 获取接收站名称
    const stationName = resolveReceiveDisplayName(win)
    // 格式化过站时间
    const timeHm = formatDeductionHmLabel(win.peakWindow)
    raw.push({
      // 设置事件类型
      kind: 'stationPass',
      // 设置事件时间戳
      atMs,
      // 设置事件文本
      line: `卫星${satName}过${stationName}接收站，时间：${timeHm}`,
      // 设置事件高亮行
      highlightLine: {
        segments: [
          // 设置卫星名称
          seg('卫星', 'default'),
          // 设置卫星名称
          seg(satName, 'satellite'),
          seg(' ', 'default'),
          // 设置过站接收站事件
          seg(`过${stationName}接收站`, 'event'),
          seg('，时间：', 'default'),
          seg(timeHm, 'time'),
        ],
      },
    })
  })

  // 获取卫星打击事件
  let satelliteStrikeMs: number | null = null
    // 遍历卫星打击方案
    ; (entity.attackPlanList || []).forEach((plan) => {
      if (matchReceiveAttackPlan(plan, receiveIds, receiveNames)) {
        const beginTimeText = resolvePlanBeginTimeText(plan)
        const atMs = parseMatrixTimeMs(beginTimeText)
        if (atMs == null) return
        const stationLabel = plan.target?.trim() || plan.targetId?.trim() || '--'
        const timeHm = formatDeductionHmLabel(beginTimeText)
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
        return
      }
      if (matchSatelliteAttackPlan(plan, norad, satName)) {
        const beginTimeText = resolvePlanBeginTimeText(plan)
        const atMs = parseMatrixTimeMs(beginTimeText)
        if (atMs == null) return
        if (satelliteStrikeMs == null || atMs < satelliteStrikeMs) satelliteStrikeMs = atMs
        const weaponName = plan.weaponName || '--'
        const timeHm = formatDeductionHmLabel(beginTimeText)
        raw.push({
          kind: 'satelliteStrike',
          atMs,
          line: `卫星：${satName}，被打击，武器：${weaponName}，时间：${timeHm}`,
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
      }
    })

  // 如果指标变化高亮行不为空，则添加指标变化事件
  if (metricHighlightEntries.length) {
    // 获取指标变化事件时间戳
    const attachMs =
      satelliteStrikeMs ??
      raw.find((item) => item.kind === 'satelliteStrike')?.atMs ??
      null
    // 如果指标变化事件时间戳不为空，则添加指标变化事件
    if (attachMs != null) {
      // 遍历指标变化高亮行
      metricHighlightEntries.forEach((entry) => {
        // 添加指标变化事件
        raw.push({
          // 设置事件类型
          kind: 'metricChange',
          // 设置事件时间戳
          atMs: attachMs,
          // 设置事件文本
          line: entry.line,
          // 设置事件高亮行
          highlightLine: entry.highlightLine,
        })
      })
    }
  }

  // 排序推演事件
  raw.sort((a, b) => {
    // 如果事件时间戳不相等，则按时间戳排序
    if (a.atMs !== b.atMs) return a.atMs - b.atMs
    // 如果事件时间戳相等，则按事件类型排序
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  })

  // 合并推演事件
  const merged: SatelliteDeductionEvent[] = []
  // 遍历推演事件
  raw.forEach((item) => {
    const last = merged[merged.length - 1]
    // 如果事件时间戳相等，则合并事件
    if (last && last.atMs === item.atMs) {
      // 如果事件文本不包含，则添加事件文本
      if (!last.lines.includes(item.line)) last.lines.push(item.line)
      // 添加事件高亮行
      last.highlightLines.push(item.highlightLine)
      return
    }
    // 添加事件
    merged.push({
      // 设置事件时间戳
      atMs: item.atMs,
      // 设置事件文本
      lines: [item.line],
      // 设置事件高亮行
      highlightLines: [item.highlightLine],
    })
  })

  // 添加威胁度和时延摘要
  merged.forEach((event) => appendThreatAndDelaySummary(event, entity, norad))
  // 构建视觉计划
  const visualPlan = buildVisualPlanFromContext({
    // 获取卫星 NORAD
    norad,
    // 获取初始卫星
    initSat,
    // 获取后卫星
    postSat,
    // 获取战场窗口
    windows,
    // 获取初始关系列表
    initRelationList: entity.initRelationList,
    // 获取卫星打击时间戳
    satelliteStrikeMs,
    // 获取推演事件
    raw,
  })

  return { events: merged, visualPlan }
}

/**
 * 构建推演事件与视觉计划。
 *
 * @param entity 系列实体
 * @param norad 卫星 NORAD
 * @param matrixFallback 当前选中系列矩阵；有该星时打击时间以矩阵 attackPlanList.beginTime 为准
 * @returns 事件与视觉计划；无 init 卫星时 null
 */
export const buildSatelliteDeductionBundle = (
  entity: LevelSeriesEntity,
  norad: number,
  matrixFallback?: MatrixResult | null
): SatelliteDeductionBundle | null => {
  const satName =
    entity.initMatrixList?.find((sat) => sat.norad === norad)?.name?.trim() ||
    entity.satelliteMatrixList?.find((sat) => sat.norad === norad)?.name?.trim() ||
    ''
  const attackPlanList = resolveDeductionAttackPlans(entity, norad, satName, matrixFallback)
  const entityForTimeline =
    attackPlanList === entity.attackPlanList ? entity : { ...entity, attackPlanList }
  const internal = buildSatelliteDeductionTimelineInternal(entityForTimeline, norad)
  // 如果内部推演事件与视觉计划为空，则返回空
  if (!internal || !internal.events.length) return null
  // 返回推演事件与视觉计划
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
  /** 是否显示轨道路径 */
  showOrbitPath: boolean
  /** 当前过站窗口（重叠时取开始最晚的一站，与 toast 一致） */
  activePass: DeductionStationPassWindow | null
  /** 当前过站窗口内接收站 ID/名称（过站连线等） */
  activePassReceiveKeys: Set<string>
  /** 当前连线对应的接收站 ID/名称（地球高亮与标签） */
  passHighlightReceiveKeys: Set<string>
  /** 当前时刻应高亮的过站窗口（含坐标，用于地图匹配） */
  passHighlightPasses: DeductionStationPassWindow[]
  /** 是否显示爆炸效果 */
  showExplosion: boolean
  /** 被打击的接收站 ID/名称 */
  struckReceiveKeys: Set<string>
} => {
  const empty = {
    // 是否显示轨道路径
    showOrbitPath: false,
    // 当前过站窗口
    activePass: null as DeductionStationPassWindow | null,
    // 当前过站窗口内接收站 ID/名称（过站连线等）
    activePassReceiveKeys: new Set<string>(),
    // 推演已开始过站的接收站 ID/名称（用于地球高亮与标签）
    passHighlightReceiveKeys: new Set<string>(),
    // 当前时刻应高亮的过站窗口（含坐标，用于地图匹配）
    passHighlightPasses: [] as DeductionStationPassWindow[],
    // 是否显示爆炸效果
    showExplosion: false,
    // 被打击的接收站 ID/名称
    struckReceiveKeys: new Set<string>(),
  }
  // 如果视觉计划为空，或推演未开始，则返回空对象
  if (!plan || !isPlaying) return empty

  // 当前时刻可能落在多个过站窗口内（上一站尚未结束、下一站已开始）。
  // 连线必须跟 toast 一致：取「已经开始且开始最晚」的窗口，而不是数组里的第一个。
  const overlappingPasses = plan.stationPasses.filter(
    (pass) => currentMs >= pass.startMs && currentMs <= pass.endMs
  )
  const activePass =
    overlappingPasses.reduce<DeductionStationPassWindow | null>((latest, pass) => {
      if (!latest) return pass
      if (pass.startMs > latest.startMs) return pass
      if (pass.startMs === latest.startMs && pass.endMs < latest.endMs) return pass
      return latest
    }, null)

  // 是否显示爆炸效果
  const showExplosion =
    plan.satelliteStrikeMs != null && currentMs >= plan.satelliteStrikeMs

  // 被打击的接收站 ID/名称 
  const struckReceiveKeys = new Set<string>()
  // 遍历接收站打击记录
  plan.receiveStrikes.forEach((strike) => {
    // 如果接收站打击时间戳小于当前时刻，则添加接收站 ID/名称
    if (currentMs >= strike.atMs) {
      // 添加接收站 ID/名称
      if (strike.receiveId) struckReceiveKeys.add(strike.receiveId)
      // 添加接收站名称
      if (strike.receiveName) struckReceiveKeys.add(strike.receiveName)
    }
  })

  // 当前过站窗口内接收站 ID/名称（过站连线等）
  const activePassReceiveKeys = new Set<string>()
  // 如果当前过站窗口不为空，则添加接收站 ID/名称
  if (activePass) {
    // 添加接收站 ID/名称
    if (activePass.receiveId) activePassReceiveKeys.add(activePass.receiveId)
    // 添加接收站名称
    if (activePass.receiveName) activePassReceiveKeys.add(activePass.receiveName)
  }

  // 推演已开始过站的接收站 ID/名称（用于地球高亮与标签）
  const passHighlightReceiveKeys = new Set<string>()
  // 当前时刻应高亮的过站窗口（含坐标，用于地图匹配）
  const passHighlightPasses: DeductionStationPassWindow[] = []
  // 标签和高亮只跟当前连线那一站，避免上一站（如三泽）还亮着、文案已经是下一站（横田）
  if (activePass) {
    if (activePass.receiveId) passHighlightReceiveKeys.add(activePass.receiveId)
    if (activePass.receiveName) passHighlightReceiveKeys.add(activePass.receiveName)
    passHighlightPasses.push(activePass)
  }

  return {
    // 是否显示轨道路径
    showOrbitPath: true,
    // 当前过站窗口
    activePass,
    // 当前过站窗口内接收站 ID/名称（过站连线等）
    activePassReceiveKeys,
    // 推演已开始过站的接收站 ID/名称（用于地球高亮与标签）
    passHighlightReceiveKeys,
    // 当前时刻应高亮的过站窗口（含坐标，用于地图匹配）
    passHighlightPasses,
    // 是否显示爆炸效果
    showExplosion,
    // 被打击的接收站 ID/名称
    struckReceiveKeys,
  }
}
