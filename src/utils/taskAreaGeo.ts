import type { TaskArea } from '@/types/task/task'

/**
 * 规范化任务区域几何类型。
 *
 * @param type 接口返回的 `TaskArea.type`
 */
export const normalizeTaskAreaKind = (type: string): 'POLYGON' | 'CIRCLE' | null => {
  const upper = type.trim().toUpperCase()
  if (upper === 'POLYGON' || upper === 'CIRCLE') return upper
  return null
}

/**
 * 仅保留启用中的任务区域（`enabled !== false`）。
 *
 * @param areas 任务区域列表
 */
export const filterEnabledTaskAreas = (areas: TaskArea[] | null | undefined): TaskArea[] => {
  if (!areas?.length) return []
  return areas.filter((area) => area.enabled !== false)
}

/**
 * 收集任务 `areas` 中全部用于包络计算的经纬度点。
 *
 * @param areas 当前任务的 `TaskForm.areas`
 */
export function collectTaskAreaGeoCoords(areas: TaskArea[] | null | undefined): { lon: number; lat: number }[] {
  const coords: { lon: number; lat: number }[] = []
  for (const area of filterEnabledTaskAreas(areas)) {
    const kind = normalizeTaskAreaKind(area.type)
    if (kind === 'POLYGON') {
      area.points?.forEach((pt) => {
        if (typeof pt.lng === 'number' && typeof pt.lat === 'number') {
          coords.push({ lon: pt.lng, lat: pt.lat })
        }
      })
      continue
    }
    if (kind === 'CIRCLE') {
      const centerLng = area.center?.lng
      const centerLat = area.center?.lat
      const radiusKm = typeof area.radius === 'number' ? area.radius : 0
      if (typeof centerLng !== 'number' || typeof centerLat !== 'number') continue
      if (radiusKm > 0) {
        const latOffset = radiusKm / 111
        const lonOffset = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180))
        coords.push({ lon: centerLng - lonOffset, lat: centerLat - latOffset })
        coords.push({ lon: centerLng + lonOffset, lat: centerLat + latOffset })
      } else {
        coords.push({ lon: centerLng, lat: centerLat })
      }
    }
  }
  return coords
}