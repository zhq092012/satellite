import type { TaskArea } from '@/types/task/task'
import { getCircumCircle } from '@/utils/tools/functionTool'

/**
 * 由多边形顶点构建 `TaskArea`（外接球中心与半径写入 center / radius）。
 *
 * @param params 顶点、名称与 ID
 */
export function buildTaskAreaFromPolygon(params: {
  id: string | number
  name: string
  points: { lng: number; lat: number }[]
  enabled?: boolean
}): TaskArea | null {
  if (params.points.length < 3) return null
  const flat = params.points.flatMap((p) => [p.lng, p.lat])
  const circum = getCircumCircle(flat)

  let centerLng = params.points.reduce((s, p) => s + p.lng, 0) / params.points.length
  let centerLat = params.points.reduce((s, p) => s + p.lat, 0) / params.points.length
  let radiusKm = 0

  if (circum) {
    centerLng = circum.center[0]
    centerLat = circum.center[1]
    radiusKm = circum.radiusKm
  }

  return {
    id: params.id !== undefined && params.id !== '' ? String(params.id) : undefined,
    name: params.name,
    type: 'POLYGON',
    points: params.points.map((p) => ({ lng: p.lng, lat: p.lat })),
    center: { lng: centerLng, lat: centerLat },
    radius: radiusKm,
    enabled: params.enabled ?? true,
  }
}

/**
 * 由圆心与半径构建 `TaskArea`。
 *
 * @param params 圆心、半径、名称与 ID
 */
export function buildTaskAreaFromCircle(params: {
  id: string | number
  name: string
  centerLng: number
  centerLat: number
  radiusKm: number
  enabled?: boolean
}): TaskArea | null {
  if (!Number.isFinite(params.centerLng) || !Number.isFinite(params.centerLat)) return null
  if (!Number.isFinite(params.radiusKm) || params.radiusKm <= 0) return null

  return {
    id: params.id !== undefined && params.id !== '' ? String(params.id) : undefined,
    name: params.name,
    type: 'CIRCLE',
    points: [],
    center: { lng: params.centerLng, lat: params.centerLat },
    radius: params.radiusKm,
    enabled: params.enabled ?? true,
  }
}