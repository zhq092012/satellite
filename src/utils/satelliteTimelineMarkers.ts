import type { MatrixResult } from '@/api/electronic'
import {
  analyzeSatelliteFullChain,
  collectSatelliteTransmissionLinks,
} from '@/utils/satelliteFullChainAnalysis'

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

  const links = collectSatelliteTransmissionLinks(matrix, norad)
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

export const msToRatio = (ms: number, startMs: number, endMs: number): number => {
  const span = endMs - startMs
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (ms - startMs) / span))
}

export const formatTimelineTime = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
