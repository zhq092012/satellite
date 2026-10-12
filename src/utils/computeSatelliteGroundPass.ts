import type { InitMatrix, LevelSeriesEntity } from '@/api/task/task'
import { parseReceiveLatLonString } from '@/utils/buildBattleGlobeGroundTargets'
import { formatTimelineMs } from '@/utils/seriesLinkTimeline'
import * as satellitejs from 'satellite.js'

/**
 * 地面站可见性最低仰角默认值（度）。
 * 与 `sqlite.worker` 通信窗口推算中 `terrain_mask_angle || 10` 保持一致。
 */
export const DEFAULT_GROUND_STATION_MIN_ELEVATION_DEG = 10

/** 过境搜索时间步长（秒） */
export const GROUND_PASS_SCAN_STEP_SEC = 30

/** 任务窗口外继续搜索过境的最长时长（毫秒），用于覆盖播放头接近任务结束的情况 */
export const GROUND_PASS_SCAN_EXTRA_HORIZON_MS = 7 * 24 * 60 * 60 * 1000

/** 单颗卫星预计算的过境开始事件数量上限 */
export const GROUND_PASS_START_MAX_COUNT = 512

/** 地面观测站（接收站） */
export interface GroundObserverSite {
  /** 接收站 ID */
  id: string
  /** 展示名称 */
  name: string
  /** 纬度（度） */
  latitudeDeg: number
  /** 经度（度） */
  longitudeDeg: number
  /** 海拔（km） */
  heightKm: number
  /** 可见性最低仰角（度）；缺省使用 {@link DEFAULT_GROUND_STATION_MIN_ELEVATION_DEG} */
  minElevationDeg?: number
}

/** TLE 推算得到的过境开始（仰角由低于门限变为不低于门限） */
export interface SatelliteGroundPassStart {
  /** 过境开始时刻（毫秒） */
  atMs: number
  /** 接收站 ID */
  stationId: string
  /** 接收站名称 */
  stationName: string
}

/** 过境扫描参数 */
export interface SatelliteGroundPassScanParams {
  /** TLE 第一行 */
  line1: string
  /** TLE 第二行 */
  line2: string
  /** 扫描起始（毫秒，含） */
  startMs: number
  /** 扫描结束（毫秒，含） */
  endMs: number
  /** 步长（秒） */
  stepSec: number
  /** 默认最低仰角（度） */
  minElevationDeg: number
  /** 观测站列表 */
  observers: GroundObserverSite[]
}

/**
 * 从任务系列实体与 init 矩阵收集接收站坐标（用于 TLE 过境推算）。
 *
 * @param entity 系列实体
 * @param initSat 打击前卫星矩阵（补全 initWindows 中的站址）
 * @returns 去重后的观测站列表
 */
export const collectGroundObserversForSatellitePass = (
  entity: LevelSeriesEntity | null | undefined,
  initSat: InitMatrix | null | undefined,
): GroundObserverSite[] => {
  const byId = new Map<string, GroundObserverSite>()

  const upsert = (site: GroundObserverSite) => {
    if (!site.id.trim()) return
    if (!byId.has(site.id)) {
      byId.set(site.id, site)
    }
  }

  entity?.initRelationList?.receiveObjList?.forEach((receive) => {
    if (!receive.receiveId) return
    const coords = parseReceiveLatLonString(receive.receiveLatLon)
    if (!coords) return
    upsert({
      id: receive.receiveId,
      name: receive.receiveName?.trim() || receive.receiveId,
      latitudeDeg: coords.latitude,
      longitudeDeg: coords.longitude,
      heightKm: 0,
    })
  })

  initSat?.initWindows?.forEach((win) => {
    const id = win.receiveId
    if (id == null || !String(id).trim()) return
    const lat = win.receiveLat
    const lon = win.receiveLon
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return
    upsert({
      id: String(id),
      name: win.receiveName?.trim() || String(id),
      latitudeDeg: lat,
      longitudeDeg: lon,
      heightKm: 0,
    })
  })

  return [...byId.values()]
}

/**
 * 计算指定时刻卫星相对地面站的仰角（度）。
 *
 * @param satrec 已解析 TLE
 * @param atMs 时刻（毫秒）
 * @param observer 地面站
 * @returns 仰角（度）；传播失败时 null
 */
export const computeSatelliteElevationDegAtMs = (
  satrec: satellitejs.SatRec,
  atMs: number,
  observer: GroundObserverSite,
): number | null => {
  const date = new Date(atMs)
  const pv = satellitejs.propagate(satrec, date)
  const position = pv?.position
  if (!position || typeof position === 'boolean') return null

  const gmst = satellitejs.gstime(date)
  const posEcf = satellitejs.eciToEcf(position, gmst)
  const observerGeodetic = {
    latitude: satellitejs.degreesToRadians(observer.latitudeDeg),
    longitude: satellitejs.degreesToRadians(observer.longitudeDeg),
    height: observer.heightKm,
  }
  const look = satellitejs.ecfToLookAngles(observerGeodetic, posEcf)
  const elevationDeg = satellitejs.radiansToDegrees(look.elevation)
  return Number.isFinite(elevationDeg) ? elevationDeg : null
}

/**
 * 判断仰角是否满足地面站可见性门限。
 *
 * @param elevationDeg 仰角（度）
 * @param observer 地面站（可带独立门限）
 * @param defaultMinElevationDeg 默认门限
 */
const isElevationVisible = (
  elevationDeg: number,
  observer: GroundObserverSite,
  defaultMinElevationDeg: number,
): boolean => {
  const threshold =
    observer.minElevationDeg != null && Number.isFinite(observer.minElevationDeg)
      ? observer.minElevationDeg
      : defaultMinElevationDeg
  return elevationDeg >= threshold
}

/**
 * 在任务时间范围内扫描 TLE，得到所有接收站的过境开始时刻（Worker / 主线程共用）。
 *
 * @param params 扫描参数
 * @returns 按时间升序的过境开始列表
 */
export const computeGroundPassStartsFromTle = (
  params: SatelliteGroundPassScanParams,
): SatelliteGroundPassStart[] => {
  const { line1, line2, startMs, endMs, stepSec, minElevationDeg, observers } = params
  if (!observers.length || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return []
  }
  if (stepSec <= 0) {
    throw new Error(`GROUND_PASS_SCAN_STEP_SEC 必须为正数，当前为 ${stepSec}`)
  }

  const satrec = satellitejs.twoline2satrec(line1, line2)
  const stepMs = stepSec * 1000
  const passStarts: SatelliteGroundPassStart[] = []

  for (const observer of observers) {
    let wasVisible = false
    const initialElevation = computeSatelliteElevationDegAtMs(satrec, startMs, observer)
    if (initialElevation != null) {
      wasVisible = isElevationVisible(initialElevation, observer, minElevationDeg)
    }

    for (let t = startMs + stepMs; t <= endMs; t += stepMs) {
      const elevation = computeSatelliteElevationDegAtMs(satrec, t, observer)
      if (elevation == null) continue
      const visible = isElevationVisible(elevation, observer, minElevationDeg)
      if (visible && !wasVisible) {
        passStarts.push({
          atMs: t,
          stationId: observer.id,
          stationName: observer.name,
        })
        if (passStarts.length >= GROUND_PASS_START_MAX_COUNT) {
          return passStarts.sort((a, b) => a.atMs - b.atMs)
        }
      }
      wasVisible = visible
    }
  }

  return passStarts.sort((a, b) => a.atMs - b.atMs)
}

/**
 * 解析过境扫描时间范围（任务起止 + 额外前瞻）。
 *
 * @param taskStartMs 任务开始
 * @param taskEndMs 任务结束
 * @returns 扫描起止毫秒
 */
export const resolveGroundPassScanRangeMs = (
  taskStartMs: number,
  taskEndMs: number,
): { startMs: number; endMs: number } => {
  const startMs = Number.isFinite(taskStartMs) && taskStartMs > 0 ? taskStartMs : Date.now()
  let endMs = Number.isFinite(taskEndMs) && taskEndMs > startMs ? taskEndMs : startMs + GROUND_PASS_SCAN_EXTRA_HORIZON_MS
  endMs = Math.max(endMs, startMs + GROUND_PASS_SCAN_EXTRA_HORIZON_MS)
  return { startMs, endMs }
}

/**
 * 在预计算的过境列表中取参考时刻之后最早的一次过境，并格式化为 Label 文案。
 *
 * @param passStarts 升序过境开始列表
 * @param afterMs 参考时刻（通常为播放头）
 * @returns 展示文案；无未来过境时 null
 */
export const formatNextGroundPassLabelAfterMs = (
  passStarts: readonly SatelliteGroundPassStart[],
  afterMs: number,
): string | null => {
  if (!passStarts.length || !Number.isFinite(afterMs)) return null
  const next = passStarts.find((item) => item.atMs > afterMs)
  if (!next) return null
  const timeText = formatTimelineMs(next.atMs)
  return next.stationName ? `${timeText}（${next.stationName}）` : timeText
}
