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
  receiveId?: string
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

const getStationPassWindows = (matrix: MatrixResult, norad: number) => {
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  if (postSat?.stationWindows?.length) return postSat.stationWindows
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  return initSat?.initWindows || []
}

const collectJamSegments = (matrix: MatrixResult, norad: number, taskStartMs: number, taskEndMs: number): TimelineJamSegment[] => {
  const segments: TimelineJamSegment[] = []
  const dedupe = new Set<string>()

  getStationPassWindows(matrix, norad).forEach((win) => {
    if (Number((win as { strikeStatus?: number }).strikeStatus) !== 1) return
    const startMs = parseTimeToMs(getWindowStartStr(win as Record<string, string>))
    const endMs = parseTimeToMs(win.endWindow || '')
    if (!startMs) return
    const end = endMs || startMs
    const key = `${win.receiveId || win.receiveName}-${startMs}`
    if (dedupe.has(key)) return
    dedupe.add(key)
    segments.push({
      startMs: clampMs(startMs, taskStartMs, taskEndMs),
      endMs: clampMs(end, taskStartMs, taskEndMs),
      label: win.receiveName || win.receiveId,
      weaponName: (win as { weapons?: { name?: string }[] }).weapons?.[0]?.name,
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

  const passSeen = new Set<string>()
  let firstTransmitMs: number | null = null
  getStationPassWindows(matrix, norad).forEach((win) => {
    const startMs = parseTimeToMs(getWindowStartStr(win as Record<string, string>))
    if (!startMs) return
    const receiveId = win.receiveId || win.receiveName || ''
    const passKey = `${receiveId}-${startMs}`
    if (passSeen.has(passKey)) return
    passSeen.add(passKey)

    const ms = clampMs(startMs, taskStartMs, taskEndMs)
    if (firstTransmitMs == null || ms < firstTransmitMs) firstTransmitMs = ms

    const struck = Number((win as { strikeStatus?: number }).strikeStatus) === 1
    const stationName = win.receiveName || receiveId || '地面站'
    const weaponName = (win as { weapons?: { name?: string }[] }).weapons?.[0]?.name
    markers.push({
      type: struck ? 'jam' : 'first_transmit',
      ms,
      label: stationName,
      detail: struck
        ? weaponName
          ? `${weaponName} → ${stationName}`
          : stationName
        : `过境 ${stationName}`,
      receiveId: win.receiveId,
    })
  })

  const jamSegments = collectJamSegments(matrix, norad, taskStartMs, taskEndMs)
  const postChain = analyzeSatelliteFullChain(matrix, norad, true)
  const allBlocked = postChain.blocked
  const postChainFinishMs =
    !allBlocked && postChain.finishTimestamp
      ? clampMs(postChain.finishTimestamp, taskStartMs, taskEndMs)
      : null

  markers.sort((a, b) => a.ms - b.ms)

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
