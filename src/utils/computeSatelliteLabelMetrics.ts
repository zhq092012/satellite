import type { InitMatrix, LevelSeriesEntity, SatelliteMatrix } from '@/api/task/task'
import {
  buildSatelliteDeductionTimeline,
  findLevelSeriesEntityForNorad,
  parseMatrixTimeMs,
} from '@/utils/buildSatelliteDeductionTimeline'
import { hasValidTle } from '@/utils/buildBattleGlobeSatellites'
import * as satellitejs from 'satellite.js'

/** 关键节点预计算的轨道指标样本（不含「下次过境」，该字段随播放头在主线程解析）。 */
export interface SatelliteGlobeLabelMetricSample {
  /** 样本时刻（毫秒） */
  atMs: number
  /** 轨道高度（km，WGS84 海拔） */
  altitudeKm: number
  /** 轨道倾角（度） */
  inclinationDeg: number
  /** 地心距离（km，ECI 位置矢量模长） */
  geocentricDistanceKm: number
  /** 运行速度（km/s，ECI 速度矢量模长） */
  speedKmS: number
  /** 纬度（度，北纬为正） */
  latitudeDeg: number
  /** 经度（度，东经为正） */
  longitudeDeg: number
}

/** 地球 Label 展示用的指标（含下次过境文案）。 */
export interface SatelliteGlobeLabelDisplayMetrics {
  /** 轨道高度（km） */
  altitudeKm: number
  /** 轨道倾角（度） */
  inclinationDeg: number
  /** 地心距离（km） */
  geocentricDistanceKm: number
  /** 运行速度（km/s） */
  speedKmS: number
  /** 纬度（度） */
  latitudeDeg: number
  /** 经度（度） */
  longitudeDeg: number
  /** 预计下次过境时间展示文案；无窗口时为 null */
  nextTransitLabel: string | null
}

/** 单颗卫星关键节点数量上限，避免 Worker 任务过大。 */
export const SATELLITE_LABEL_METRIC_MAX_NODES = 256

const RAD_TO_DEG = 180 / Math.PI

/**
 * 从 TLE 在指定时刻推算轨道指标。
 *
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 * @param atMs 时刻（毫秒）
 * @returns 指标样本；传播失败时 null
 */
export const computeSatelliteLabelMetricSampleFromTle = (
  line1: string,
  line2: string,
  atMs: number,
): SatelliteGlobeLabelMetricSample | null => {
  const satrec = satellitejs.twoline2satrec(line1, line2)
  const date = new Date(atMs)
  const pv = satellitejs.propagate(satrec, date)
  const position = pv?.position
  const velocity = pv?.velocity
  if (!position || typeof position === 'boolean' || !velocity || typeof velocity === 'boolean') {
    return null
  }
  const gmst = satellitejs.gstime(date)
  const geodetic = satellitejs.eciToGeodetic(position, gmst)
  const altitudeKm = geodetic.height
  const latitudeDeg = satellitejs.radiansToDegrees(geodetic.latitude)
  const longitudeDeg = satellitejs.radiansToDegrees(geodetic.longitude)
  const geocentricDistanceKm = Math.hypot(position.x, position.y, position.z)
  const speedKmS = Math.hypot(velocity.x, velocity.y, velocity.z)
  /** satellite.js SatRec 倾角字段为 `inclo`（弧度） */
  const inclinationDeg = satrec.inclo * RAD_TO_DEG

  if (
    !Number.isFinite(altitudeKm) ||
    !Number.isFinite(latitudeDeg) ||
    !Number.isFinite(longitudeDeg) ||
    !Number.isFinite(geocentricDistanceKm) ||
    !Number.isFinite(speedKmS) ||
    !Number.isFinite(inclinationDeg)
  ) {
    return null
  }

  return {
    atMs,
    altitudeKm,
    inclinationDeg,
    geocentricDistanceKm,
    speedKmS,
    latitudeDeg,
    longitudeDeg,
  }
}

/**
 * 批量从 TLE 推算关键节点指标，并按矩阵过站高度覆盖海拔（仅 peak 时刻）。
 *
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 * @param timestamps 升序时刻列表（毫秒）
 * @param altitudeKmByAtMs 矩阵在过站 peak 返回的卫星高度（km）
 * @returns 与 timestamps 等长的样本列表（失败节点省略）
 */
export const computeSatelliteLabelMetricTimelineFromTle = (
  line1: string,
  line2: string,
  timestamps: number[],
  altitudeKmByAtMs: ReadonlyMap<number, number> = new Map(),
): SatelliteGlobeLabelMetricSample[] => {
  const samples: SatelliteGlobeLabelMetricSample[] = []
  for (const atMs of timestamps) {
    const base = computeSatelliteLabelMetricSampleFromTle(line1, line2, atMs)
    if (!base) continue
    const overrideAlt = altitudeKmByAtMs.get(atMs)
    if (overrideAlt != null && Number.isFinite(overrideAlt)) {
      samples.push({ ...base, altitudeKm: overrideAlt })
    } else {
      samples.push(base)
    }
  }
  return samples
}

/**
 * 在系列实体中定位打击前/后矩阵条目。
 *
 * @param entity 系列实体
 * @param norad 卫星 NORAD
 */
export const findSatelliteMatrixRowsForNorad = (
  entity: LevelSeriesEntity | null | undefined,
  norad: number,
): { initSat: InitMatrix | null; postSat: SatelliteMatrix | null } => {
  if (!entity) return { initSat: null, postSat: null }
  const initSat = entity.initMatrixList?.find((item) => item.norad === norad) ?? null
  const postSat = entity.satelliteMatrixList?.find((item) => item.norad === norad) ?? null
  return { initSat, postSat }
}

/**
 * 收集需要预计算轨道指标的关键时刻（推演事件、过站窗口、任务起止、当前播放头）。
 *
 * @param params 输入
 * @returns 升序去重后的毫秒时间戳
 */
export const collectSatelliteLabelMetricTimestamps = (params: {
  /** 卫星 NORAD */
  norad: number
  /** 所属系列实体 */
  entity: LevelSeriesEntity | null
  /** 任务开始时刻 */
  taskStartMs: number
  /** 任务结束时刻 */
  taskEndMs: number
  /** 当前播放头（选中时锚点） */
  anchorMs: number
}): number[] => {
  const { norad, entity, taskStartMs, taskEndMs, anchorMs } = params
  const bucket = new Set<number>()

  const add = (ms: number | null | undefined) => {
    if (ms == null || !Number.isFinite(ms) || ms <= 0) return
    bucket.add(Math.round(ms))
  }

  add(taskStartMs)
  add(taskEndMs)
  add(anchorMs)

  if (entity) {
    const { initSat, postSat } = findSatelliteMatrixRowsForNorad(entity, norad)
    const pushWindowTimes = (peak?: string | null, end?: string | null) => {
      add(parseMatrixTimeMs(peak))
      add(parseMatrixTimeMs(end))
    }

    initSat?.initWindows?.forEach((win) => pushWindowTimes(win.peakWindow, win.endWindow))
    postSat?.stationWindows?.forEach((win) => pushWindowTimes(win.peakWindow, win.endWindow))
    add(parseMatrixTimeMs(initSat?.battleWindow))
    add(parseMatrixTimeMs(postSat?.battleWindow))

    for (const event of buildSatelliteDeductionTimeline(entity, norad)) {
      add(event.atMs)
    }
  }

  const sorted = [...bucket].sort((a, b) => a - b)
  if (sorted.length <= SATELLITE_LABEL_METRIC_MAX_NODES) return sorted
  return sorted.slice(0, SATELLITE_LABEL_METRIC_MAX_NODES)
}

/**
 * 从矩阵过站窗口提取 peak 时刻的卫星高度（接口在 peak 返回 height 时使用）。
 *
 * @param initSat 打击前矩阵
 * @returns peak 毫秒 → 高度 km
 */
export const buildMatrixPeakAltitudeOverrides = (
  initSat: InitMatrix | null,
): Map<number, number> => {
  const map = new Map<number, number>()
  if (!initSat?.initWindows?.length) return map
  for (const win of initSat.initWindows) {
    const atMs = parseMatrixTimeMs(win.peakWindow)
    const height = win.height
    if (atMs == null || height == null || !Number.isFinite(height)) continue
    map.set(atMs, height)
  }
  return map
}

/**
 * 在预计算时间轴上选取播放头对应的样本（取不超过播放头的最后一个节点）。
 *
 * @param samples 升序样本
 * @param playheadMs 当前时刻
 * @returns 匹配样本；无样本时 null
 */
export const pickSatelliteLabelMetricSampleForPlayhead = (
  samples: readonly SatelliteGlobeLabelMetricSample[],
  playheadMs: number,
): SatelliteGlobeLabelMetricSample | null => {
  if (!samples.length || !Number.isFinite(playheadMs)) return null
  let chosen: SatelliteGlobeLabelMetricSample | null = null
  for (const sample of samples) {
    if (sample.atMs <= playheadMs) chosen = sample
    else break
  }
  return chosen ?? samples[0] ?? null
}

interface TransitCandidate {
  /** 过境开始（peak）毫秒 */
  atMs: number
  /** 展示用时间原文 */
  timeText: string
  /** 接收站名称（可为空） */
  stationName: string | null
}

/**
 * 解析预计下次过站时间（取所有 init / 打击后窗口中晚于参考时刻的最早 peak）。
 *
 * @param entity 系列实体
 * @param norad 卫星 NORAD
 * @param afterMs 参考时刻（通常为当前播放头）
 * @returns 展示文案；无未来窗口时 null
 */
export const resolveNextStationTransitLabel = (
  entity: LevelSeriesEntity | null | undefined,
  norad: number,
  afterMs: number,
): string | null => {
  if (!entity || !Number.isFinite(afterMs)) return null
  const { initSat, postSat } = findSatelliteMatrixRowsForNorad(entity, norad)
  const candidates: TransitCandidate[] = []

  const push = (peak?: string | null, stationName?: string | null) => {
    const atMs = parseMatrixTimeMs(peak)
    const timeText = peak?.trim()
    if (atMs == null || !timeText) return
    candidates.push({
      atMs,
      timeText,
      stationName: stationName?.trim() || null,
    })
  }

  initSat?.initWindows?.forEach((win) => push(win.peakWindow, win.receiveName))
  postSat?.stationWindows?.forEach((win) => push(win.peakWindow, win.receiveName))

  const next = candidates
    .filter((item) => item.atMs > afterMs)
    .sort((a, b) => a.atMs - b.atMs)[0]

  if (!next) return null
  if (next.stationName) {
    return `${next.timeText}（${next.stationName}）`
  }
  return next.timeText
}

/**
 * 合并样本与下次过境文案，供 Label 格式化。
 *
 * @param sample 播放头对应样本
 * @param nextTransitLabel 下次过境文案
 */
export const toSatelliteGlobeLabelDisplayMetrics = (
  sample: SatelliteGlobeLabelMetricSample,
  nextTransitLabel: string | null,
): SatelliteGlobeLabelDisplayMetrics => ({
  altitudeKm: sample.altitudeKm,
  inclinationDeg: sample.inclinationDeg,
  geocentricDistanceKm: sample.geocentricDistanceKm,
  speedKmS: sample.speedKmS,
  latitudeDeg: sample.latitudeDeg,
  longitudeDeg: sample.longitudeDeg,
  nextTransitLabel,
})

/**
 * 校验卫星是否具备预计算所需 TLE。
 *
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 */
export const canPrecomputeSatelliteLabelMetrics = (line1?: string | null, line2?: string | null): boolean =>
  hasValidTle(line1, line2)

/**
 * 从任务分析中定位系列实体（供父组件调度预计算）。
 *
 * @param data 任务分析
 * @param norad NORAD
 */
export const findEntityForSatelliteLabelMetrics = findLevelSeriesEntityForNorad
