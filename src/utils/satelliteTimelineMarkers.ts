import type { MatrixResult } from '@/api/electronic'
import {
  analyzeSatelliteFullChain,
  collectSatelliteTransmissionLinks,
} from '@/utils/satelliteFullChainAnalysis'
import { pad2 } from '@/utils/tools/dateFormat'

export type TimelineMarkerType =
  | 'task_start'
  | 'first_transmit'
  | 'jam'
  | 'post_chain_finish'
  | 'all_blocked'
  | 'task_end'

export interface TimelineMarker {
  type: TimelineMarkerType
  ms: number
  label: string
  detail?: string
  receiveId?: string
  /** 与拓扑图链路一致的排序序号（同时间戳时保证从左到右顺序） */
  orderIndex?: number
}

export interface TimelineJamSegment {
  startMs: number
  endMs: number
  label: string
  weaponName?: string
}

export interface SatelliteTimelineModel {
  taskStartMs: number
  taskEndMs: number
  markers: TimelineMarker[]
  jamSegments: TimelineJamSegment[]
  firstTransmitMs: number | null
  postChainFinishMs: number | null
  allBlocked: boolean
}

/**
 * 把毫秒夹到任务时间轴范围内，避免标记画出时间条两端。
 *
 * @param ms 待夹紧的时刻
 * @param min 任务开始毫秒
 * @param max 任务结束毫秒
 * @returns 落在 `[min, max]` 内的时刻
 */
const clampMs = (ms: number, min: number, max: number): number => Math.min(max, Math.max(min, ms))

/**
 * 从传输链路列表构建时间轴干扰/打击色段
 *
 * @param links 按过站时间排序的传输链路
 * @param taskStartMs 任务开始时间戳
 * @param taskEndMs 任务结束时间戳
 * @returns 时间轴色段列表
 */
const collectJamSegmentsFromLinks = (
  links: ReturnType<typeof collectSatelliteTransmissionLinks>,
  taskStartMs: number,
  taskEndMs: number
): TimelineJamSegment[] =>
  links
    .filter((link) => link.struck)
    .map((link) => ({
      startMs: clampMs(link.transmitStartMs, taskStartMs, taskEndMs),
      endMs: clampMs(link.transmitEndMs || link.transmitStartMs, taskStartMs, taskEndMs),
      label: link.receiveName,
      weaponName: link.weaponNames?.split('、')[0],
    }))
    .sort((a, b) => a.startMs - b.startMs || a.label.localeCompare(b.label, 'zh-CN'))

/**
 * 构建选中卫星的任务时间轴模型，标记与拓扑图链路一一对应
 *
 * @param matrix 算法矩阵数据
 * @param norad 卫星 NORAD 编号
 * @param taskStartMs 任务开始时间戳
 * @param taskEndMs 任务结束时间戳
 * @returns 时间轴模型
 */
export const buildSatelliteTimelineModel = (
  matrix: MatrixResult | null,
  norad: number | null,
  taskStartMs: number,
  taskEndMs: number
): SatelliteTimelineModel | null => {
  if (!taskStartMs || !taskEndMs || taskEndMs <= taskStartMs) return null

  const markers: TimelineMarker[] = [
    {
      type: 'task_start',
      ms: taskStartMs,
      label: '任务开始',
      orderIndex: -2,
    },
    {
      type: 'task_end',
      ms: taskEndMs,
      label: '任务结束',
      orderIndex: Number.MAX_SAFE_INTEGER,
    },
  ]

  const emptyModel: SatelliteTimelineModel = {
    taskStartMs,
    taskEndMs,
    markers,
    jamSegments: [],
    firstTransmitMs: null,
    postChainFinishMs: null,
    allBlocked: false,
  }

  if (!matrix || !norad) return emptyModel

  const links = collectSatelliteTransmissionLinks(matrix, norad, taskEndMs)
  let firstTransmitMs: number | null = null

  links.forEach((link, orderIndex) => {
    const ms = clampMs(link.transmitStartMs, taskStartMs, taskEndMs)
    if (firstTransmitMs == null || ms < firstTransmitMs) firstTransmitMs = ms

    const detailParts: string[] = []
    if (link.struck) {
      detailParts.push(`打击目标：${link.strikeTargetLabel}`)
      if (link.weaponNames && link.weaponNames !== '未打击') detailParts.push(link.weaponNames)
      if (link.delayMin > 0) detailParts.push(`延迟 +${link.delayMin} 分钟`)
    } else {
      detailParts.push(`过境 ${link.receiveName}`)
    }

    markers.push({
      type: link.struck ? 'jam' : 'first_transmit',
      ms,
      label: link.receiveName,
      detail: detailParts.join(' · '),
      receiveId: link.receiveId,
      orderIndex,
    })
  })

  const jamSegments = collectJamSegmentsFromLinks(links, taskStartMs, taskEndMs)
  const postChain = analyzeSatelliteFullChain(matrix, norad, true)
  const allBlocked = postChain.blocked
  const postChainFinishMs =
    !allBlocked && postChain.finishTimestamp
      ? clampMs(postChain.finishTimestamp, taskStartMs, taskEndMs)
      : null

  markers.sort((a, b) => {
    if (a.ms !== b.ms) return a.ms - b.ms
    return (a.orderIndex ?? 0) - (b.orderIndex ?? 0)
  })

  return {
    taskStartMs,
    taskEndMs,
    markers,
    jamSegments,
    firstTransmitMs,
    postChainFinishMs,
    allBlocked,
  }
}

/**
 * 把绝对时刻换成时间轴上的 0~1 比例，供标记定位。
 *
 * @param ms 标记时刻
 * @param startMs 时间轴起点
 * @param endMs 时间轴终点
 * @returns 比例；时长非正时为 0，超出两端时夹到 0 或 1
 */
export const msToRatio = (ms: number, startMs: number, endMs: number): number => {
  const span = endMs - startMs
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (ms - startMs) / span))
}

/** 时间轴标尺两端预留的百分比，避免首尾刻度贴边被裁切。 */
export const TIMELINE_RULER_EDGE_INSET = 2.8

/** 时间轴标记或刻度的水平对齐方式。 */
export type TimelineMarkerAlign = 'start' | 'center' | 'end'

/** 时间轴小时刻度。 */
export interface TimelineRulerTick {
  /** 相对轨道的百分比位置 */
  percent: number
  /** 刻度文案，形如 `MM/DD HH:00` */
  label: string
  /** 是否为主刻度 */
  major: boolean
  /** 标签水平对齐，避免贴边溢出 */
  align: TimelineMarkerAlign
}

/**
 * 把 0~1 的时间比例映射成带两端留白的百分比位置。
 *
 * @param ratio 0~1 比例
 * @param inset 两端预留百分比，默认 {@link TIMELINE_RULER_EDGE_INSET}
 * @returns 百分比位置
 */
export const mapTimelinePositionPercent = (ratio: number, inset = TIMELINE_RULER_EDGE_INSET): number =>
  inset + ratio * (100 - inset * 2)

/**
 * 根据百分比判断标签对齐，避免贴在轨道两端时溢出。
 *
 * @param percent 百分比位置
 * @param inset 两端预留百分比，默认 {@link TIMELINE_RULER_EDGE_INSET}
 * @returns 水平对齐方式
 */
export const getTimelineMarkerAlign = (
  percent: number,
  inset = TIMELINE_RULER_EDGE_INSET
): TimelineMarkerAlign => {
  if (percent <= inset + 1) return 'start'
  if (percent >= 100 - inset - 1) return 'end'
  return 'center'
}

/**
 * 按任务跨度生成小时刻度。跨度超过 12 小时改为 3 小时一步，超过 36 小时改为 6 小时一步。
 *
 * @param startMs 时间轴起点
 * @param endMs 时间轴终点
 * @param toPercent 把绝对时刻换成百分比位置
 * @returns 刻度列表；时长非正时为空数组
 */
export const buildTimelineHourRulerTicks = (
  startMs: number,
  endMs: number,
  toPercent: (ms: number) => number
): TimelineRulerTick[] => {
  const ticks: TimelineRulerTick[] = []
  const span = endMs - startMs
  if (span <= 0) return ticks

  const hourMs = 3600 * 1000
  const step = span > 36 * hourMs ? 6 * hourMs : span > 12 * hourMs ? 3 * hourMs : hourMs

  for (let timestamp = startMs; timestamp <= endMs; timestamp += step) {
    const date = new Date(timestamp)
    const label = `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:00`
    const percent = toPercent(timestamp)
    ticks.push({ percent, label, major: true, align: getTimelineMarkerAlign(percent) })
  }

  return ticks
}
