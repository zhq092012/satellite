import {
  hasValidTle,
  type BattleGlobeSatellite,
} from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import type {
  BattleTaskResourceResp,
  TaskResourceSatelliteItem,
  TaskResourceStationItem,
} from '@/types/task/task'

/**
 * 将任务资源接口中的卫星项转为地球渲染卫星。
 *
 * @param item OpenAPI `SatelliteItem`
 */
export const toBattleGlobeSatelliteFromTaskResource = (
  item: TaskResourceSatelliteItem,
): BattleGlobeSatellite | null => {
  const noradRaw = item.noradId?.trim() ?? ''
  const norad = Number(noradRaw)
  if (!Number.isFinite(norad) || norad <= 0) return null
  if (!hasValidTle(item.tleLine1, item.tleLine2)) return null
  const name = item.name?.trim() || item.code?.trim() || noradRaw || String(norad)
  return {
    norad,
    name,
    line1: item.tleLine1!.trim(),
    line2: item.tleLine2!.trim(),
    series: '',
  }
}

/**
 * 将任务资源接口中的接收站项转为地球地面目标。
 *
 * @param item OpenAPI `StationItem`
 */
export const toBattleGlobeGroundTargetFromTaskResource = (
  item: TaskResourceStationItem,
): BattleGlobeGroundTarget | null => {
  const id = item.resourceId?.trim()
  if (!id) return null
  const lat = item.latitude
  const lon = item.longitude
  if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return {
    kind: 'receive',
    id,
    name: item.name?.trim() || item.code?.trim() || id,
    latitude: lat,
    longitude: lon,
    status: 0,
  }
}

/**
 * 从 `GET /command-task/{id}/resources` 响应构建地球卫星与地面站列表。
 *
 * @param data 任务挂载资源
 */
export const buildBattleGlobeLayersFromTaskResources = (
  data: BattleTaskResourceResp,
): { satellites: BattleGlobeSatellite[]; groundTargets: BattleGlobeGroundTarget[] } => {
  const satellites: BattleGlobeSatellite[] = []
  const noradSeen = new Set<number>()
  for (const item of data.satellites ?? []) {
    const sat = toBattleGlobeSatelliteFromTaskResource(item)
    if (!sat || noradSeen.has(sat.norad)) continue
    noradSeen.add(sat.norad)
    satellites.push(sat)
  }

  const groundTargets: BattleGlobeGroundTarget[] = []
  const stationSeen = new Set<string>()
  for (const item of data.receiveStations ?? []) {
    const target = toBattleGlobeGroundTargetFromTaskResource(item)
    if (!target || stationSeen.has(target.id)) continue
    stationSeen.add(target.id)
    groundTargets.push(target)
  }

  return { satellites, groundTargets }
}