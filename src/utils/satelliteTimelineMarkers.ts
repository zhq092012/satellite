import type { MatrixResult } from '@/api/electronic'
import {
  analyzeSatelliteFullChain,
  parseTimeToMs,
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

const getWindowStartStr = (win: Record<string, string | undefined>): string =>
  win.peakWindow || win.startWindow || win.beginWindow || ''

const resolveFirstTransmitMs = (matrix: MatrixResult, norad: number): number | null => {
  const timeEffect = matrix.timeEffects?.find((item) => item.norad === norad)
  if (timeEffect?.beginTime) {
    const ts = parseTimeToMs(timeEffect.beginTime)
    if (ts) return ts
  }

  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  let earliest = Infinity
  ;(initSat?.initWindows || []).forEach((win) => {
    const ts = parseTimeToMs(getWindowStartStr(win as Record<string, string>))
    if (ts && ts < earliest) earliest = ts
  })
  return earliest === Infinity ? null : earliest
}

const collectJamSegments = (matrix: MatrixResult, norad: number, taskStartMs: number, taskEndMs: number): TimelineJamSegment[] => {
  const segments: TimelineJamSegment[] = []
  const dedupe = new Set<string>()

  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  ;(postSat?.stationWindows || []).forEach((win) => {
    if (win.strikeStatus !== 1) return
    const startMs = parseTimeToMs(getWindowStartStr(win as Record<string, string>))
    const endMs = parseTimeToMs(win.endWindow || '')
    if (!startMs) return
    const end = endMs || startMs
    const key = `${startMs}-${end}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    segments.push({
      startMs: clampMs(startMs, taskStartMs, taskEndMs),
      endMs: clampMs(end, taskStartMs, taskEndMs),
      label: win.receiveName || win.receiveId,
      weaponName: win.weapons?.[0]?.name,
    })
  })

  return segments.sort((a, b) => a.startMs - b.startMs)
}

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
    },
    {
      type: 'task_end',
      ms: taskEndMs,
      label: '任务结束',
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

  const firstTransmitMs = resolveFirstTransmitMs(matrix, norad)
  if (firstTransmitMs) {
    const ms = clampMs(firstTransmitMs, taskStartMs, taskEndMs)
    markers.push({
      type: 'first_transmit',
      ms,
      label: '首次传输',
      detail: '未被干扰前的最早传输时刻',
    })
  }

  const jamSegments = collectJamSegments(matrix, norad, taskStartMs, taskEndMs)
  jamSegments.forEach((seg, index) => {
    markers.push({
      type: 'jam',
      ms: seg.startMs,
      label: `干扰${index + 1}`,
      detail: seg.weaponName ? `${seg.weaponName} → ${seg.label}` : seg.label,
    })
  })

  const postChain = analyzeSatelliteFullChain(matrix, norad, true)
  let postChainFinishMs: number | null = null
  let allBlocked = false

  if (postChain.blocked) {
    allBlocked = true
    markers.push({
      type: 'all_blocked',
      ms: taskEndMs,
      label: '全部阻断',
      detail: postChain.blockedReason || '所有通信全部被干扰',
    })
  } else if (postChain.finishTimestamp) {
    postChainFinishMs = clampMs(postChain.finishTimestamp, taskStartMs, taskEndMs)
    markers.push({
      type: 'post_chain_finish',
      ms: postChainFinishMs,
      label: '打击后最早全链路完成',
      detail: postChain.finishTime || undefined,
    })
  }

  markers.sort((a, b) => a.ms - b.ms)

  return {
    taskStartMs,
    taskEndMs,
    markers,
    jamSegments,
    firstTransmitMs: firstTransmitMs ? clampMs(firstTransmitMs, taskStartMs, taskEndMs) : null,
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
