import type { MatrixResult } from '@/api/electronic'
import type { ReceiveObject, RelationList, SatelliteAnalysisData, StationObject } from '@/api/task/task'

/** 地面目标类型：接收站 / 数据中心 */
export type BattleGlobeGroundTargetKind = 'receive' | 'station'

/** 整体态势地球渲染用地面站目标 */
export interface BattleGlobeGroundTarget {
  /** 目标类型 */
  kind: BattleGlobeGroundTargetKind
  /** 接收站 receiveId 或数据中心 stationId */
  id: string
  /** 展示名称 */
  name: string
  /** 纬度（度） */
  latitude: number
  /** 经度（度） */
  longitude: number
  /** 状态：0 正常，1 被打击 */
  status: number
  /** 接收站用途（数据中心无此字段） */
  usage?: string
}

/**
 * 生成地面目标唯一键（用于选中态与地图定位）。
 *
 * @param kind 目标类型
 * @param id 目标 ID
 * @returns 形如 receive:xxx / station:yyy
 */
export const buildGroundTargetKey = (kind: BattleGlobeGroundTargetKind, id: string): string =>
  `${kind}:${id}`

/**
 * 解析地面目标唯一键。
 *
 * @param key 选中键
 * @returns 类型与 ID；无效时返回 null
 */
export const parseGroundTargetKey = (
  key: string | null | undefined
): { kind: BattleGlobeGroundTargetKind; id: string } | null => {
  if (!key) return null
  const index = key.indexOf(':')
  if (index <= 0) return null
  const kind = key.slice(0, index) as BattleGlobeGroundTargetKind
  const id = key.slice(index + 1)
  if (!id || (kind !== 'receive' && kind !== 'station')) return null
  return { kind, id }
}

/**
 * 解析「纬度,经度」字符串。
 *
 * @param raw 接口返回的经纬度文本
 * @returns 经纬度或 null
 */
export const parseReceiveLatLonString = (
  raw?: string | null
): { latitude: number; longitude: number } | null => {
  if (!raw) return null
  const parts = raw.split(',').map((part) => part.trim())
  if (parts.length < 2) return null
  const latitude = Number(parts[0])
  const longitude = Number(parts[1])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
  return { latitude, longitude }
}

/**
 * 将接收站转为地球渲染目标。
 *
 * @param receive 接收站对象
 * @returns 渲染目标或 null
 */
const toReceiveGroundTarget = (receive: ReceiveObject): BattleGlobeGroundTarget | null => {
  if (!receive?.receiveId) return null
  const coords = parseReceiveLatLonString(receive.receiveLatLon)
  if (!coords) return null
  return {
    kind: 'receive',
    id: receive.receiveId,
    name: receive.receiveName || receive.receiveId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    status: receive.receiveStatus ?? 0,
    usage: receive.receiveUsage || '',
  }
}

/**
 * 将数据中心转为地球渲染目标。
 *
 * @param station 数据中心对象
 * @returns 渲染目标或 null
 */
const toStationGroundTarget = (station: StationObject): BattleGlobeGroundTarget | null => {
  if (!station?.stationId) return null
  const coords = parseReceiveLatLonString(station.stationLatLon)
  if (!coords) return null
  return {
    kind: 'station',
    id: station.stationId,
    name: station.stationName || station.stationId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    status: station.stationStatus ?? 0,
  }
}

/**
 * 从关系列表汇总接收站与数据中心（按 ID 去重）。
 *
 * @param relation 打击前关系列表
 * @returns 去重后的地面目标
 */
export const buildBattleGlobeGroundTargetsFromRelationList = (
  relation: RelationList | null | undefined
): BattleGlobeGroundTarget[] => {
  if (!relation) return []

  const targetMap = new Map<string, BattleGlobeGroundTarget>()

  ;(relation.receiveObjList || []).forEach((receive) => {
    const item = toReceiveGroundTarget(receive)
    if (!item) return
    const key = buildGroundTargetKey(item.kind, item.id)
    if (!targetMap.has(key)) targetMap.set(key, item)
  })

  ;(relation.stationObjList || []).forEach((station) => {
    const item = toStationGroundTarget(station)
    if (!item) return
    const key = buildGroundTargetKey(item.kind, item.id)
    if (!targetMap.has(key)) targetMap.set(key, item)
  })

  return Array.from(targetMap.values())
}

/**
 * 从任务分析结果汇总全部地面站目标。
 *
 * @param data 任务算法分析结果
 * @returns 去重后的地面目标列表
 */
export const buildBattleGlobeGroundTargets = (
  data: SatelliteAnalysisData | null | undefined
): BattleGlobeGroundTarget[] => {
  if (!data?.levelSeriesEntities?.length) return []

  const targetMap = new Map<string, BattleGlobeGroundTarget>()
  data.levelSeriesEntities.forEach((entity) => {
    buildBattleGlobeGroundTargetsFromRelationList(entity.initRelationList).forEach((item) => {
      const key = buildGroundTargetKey(item.kind, item.id)
      if (!targetMap.has(key)) targetMap.set(key, item)
    })
  })

  return Array.from(targetMap.values())
}

/**
 * 从当前系列矩阵汇总地面站目标（分析结果未返回时的兜底）。
 *
 * @param matrix 当前系列算法矩阵
 * @returns 去重后的地面目标列表
 */
export const buildBattleGlobeGroundTargetsFromMatrix = (
  matrix: MatrixResult | null | undefined
): BattleGlobeGroundTarget[] => {
  if (!matrix?.initRelationList) return []
  return buildBattleGlobeGroundTargetsFromRelationList(matrix.initRelationList as RelationList)
}
