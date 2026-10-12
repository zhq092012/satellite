/**
 * 态势地球资源详情 Label 文案：卫星/武器/地面站/系列格式化与左右面板统一入口 `resolveGlobeResourceDetailText`。
 */
import type { BaseStationInfo } from '@/api/system/satellite-system-api'
import type { Weapon } from '@/types/dashboard'
import { parseGroundTargetKey, type BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'
import { formatSatelliteMetaInline } from '@/utils/buildSatelliteAnalysisTable'
import type {
  BattleGlobeGroundStationRecordMap,
  BattleGlobeWeaponRecordMap,
} from '@/composables/useBattleGlobeResourceRecords'

/** 地图资产 Label 详情构建所需的地球与库记录上下文 */
export interface GlobeResourceDetailContext {
  /** 任务分析卫星（含 TLE） */
  satellites: BattleGlobeSatellite[]
  /** 地图武器 */
  weapons: BattleGlobeWeapon[]
  /** 地图地面目标 */
  groundTargets: BattleGlobeGroundTarget[]
  /** 武器库记录 */
  weaponRecords: BattleGlobeWeaponRecordMap
  /** 地面站/数据中心库记录 */
  groundRecords: BattleGlobeGroundStationRecordMap
}

/** 统一详情解析入参（左侧面板详情、右侧面板选中、地球定位共用） */
export type GlobeResourceDetailRequest =
  | { kind: 'satellite'; norad: number }
  | { kind: 'series'; series: string }
  | { kind: 'weapon'; weaponId: string; weaponFallback?: Weapon | null }
  | { kind: 'ground'; targetKey: string; groundFallback?: BaseStationInfo | null }

/**
 * 去除相邻重复行（完全一致的行只保留一条）。
 *
 * @param lines 原始行
 * @returns 去重后的行
 */
export const dedupeGlobeLabelDetailLines = (lines: string[]): string[] => {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || seen.has(line)) continue
    seen.add(line)
    result.push(line)
  }
  return result
}

/**
 * 将非空字符串行合并为地球 Label 多行文本（含行级去重）。
 *
 * @param lines 文本行
 * @returns 用换行符连接的文案
 */
export const joinGlobeLabelDetailLines = (lines: Array<string | null | undefined | false>): string =>
  dedupeGlobeLabelDetailLines(
    lines.map((line) => (line == null ? '' : String(line).trim())).filter(Boolean),
  ).join('\n')

/**
 * 卫星系列详情（定位到系列内首颗在轨卫星时使用）。
 *
 * @param series 系列名
 * @param satellites 该系列在任务分析中的卫星
 * @returns Label 详情文案
 */
export const formatSeriesGlobeDetailLines = (
  series: string,
  satellites: BattleGlobeSatellite[],
): string => {
  const preview = satellites.slice(0, 6).map((sat) => sat.name)
  return joinGlobeLabelDetailLines([
    `系列：${series}`,
    `任务内卫星数：${satellites.length}`,
    preview.length ? '成员：' : '',
    ...preview.map((line) => `· ${line}`),
    satellites.length > preview.length ? `…共 ${satellites.length} 颗` : '',
  ])
}

/**
 * 单颗卫星详情（地图上已有 TLE 的卫星）。
 *
 * @param sat 卫星
 * @returns Label 详情文案
 */
export const formatSatelliteGlobeDetailLines = (sat: BattleGlobeSatellite): string => {
  const meta = formatSatelliteMetaInline(sat.series, sat.sysType, sat.usage)
  return joinGlobeLabelDetailLines([sat.name, meta])
}

/**
 * 武器详情（优先地球渲染数据，否则用武器库接口记录）。
 *
 * @param globe 地图上武器
 * @param fallback 武器库接口记录
 * @returns Label 详情文案
 */
export const formatWeaponGlobeDetailLines = (
  globe?: BattleGlobeWeapon | null,
  fallback?: Weapon | null,
): string => {
  const name = globe?.name || fallback?.name
  const type = globe?.type || fallback?.type
  const country = globe?.country || fallback?.country
  const lon = globe?.longitude ?? fallback?.longitude
  const lat = globe?.latitude ?? fallback?.latitude
  const range = fallback?.range
  const interval = fallback?.interval
  const satelliteType = fallback?.satellite_type
  const coordLine =
    Number.isFinite(lon) && Number.isFinite(lat)
      ? `经度：${Number(lon).toFixed(4)}°  纬度：${Number(lat).toFixed(4)}°`
      : ''
  return joinGlobeLabelDetailLines([
    name || '',
    type ? `类型：${type}` : '',
    country ? `国家/地区：${country}` : '',
    coordLine,
    range != null && Number.isFinite(Number(range)) ? `射程/高度：${range} km` : '',
    interval ? `打击间隔：${interval} 分钟` : '',
    satelliteType ? `适用卫星：${satelliteType}` : '',
  ])
}

/**
 * 地面站 / 数据中心详情（优先任务分析中的坐标，否则用基站库记录）。
 *
 * @param kind 接收站或数据中心
 * @param globe 地图目标
 * @param fallback 基站库记录
 * @returns Label 详情文案
 */
export const formatGroundStationGlobeDetailLines = (
  kind: 'receive' | 'station',
  globe?: BattleGlobeGroundTarget | null,
  fallback?: BaseStationInfo | null,
): string => {
  const kindLabel = kind === 'station' ? '数据中心' : '地面接收站'
  const name = globe?.name || fallback?.name
  const usage = globe?.usage || fallback?.function
  const country = fallback?.country
  const type = fallback?.type
  const location = fallback?.location
  const latLon = fallback?.latLon
  const intro = fallback?.introduction
  const lon = globe?.longitude
  const lat = globe?.latitude
  const status =
    globe?.status === 1 ? '被打击' : globe?.status === 0 ? '正常' : undefined
  const hasGlobeCoords = Number.isFinite(lon) && Number.isFinite(lat)
  const coordLine = hasGlobeCoords
    ? `经度：${Number(lon).toFixed(4)}°  纬度：${Number(lat).toFixed(4)}°`
    : ''
  const typeLine = type && type.trim() !== kindLabel ? `类型：${type}` : ''
  return joinGlobeLabelDetailLines([
    name || kindLabel,
    `类别：${kindLabel}`,
    typeLine,
    country ? `国家/地区：${country}` : '',
    usage ? `用途：${usage}` : '',
    location ? `位置：${location}` : '',
    !hasGlobeCoords && latLon ? `坐标：${latLon}` : '',
    coordLine,
    status ? `状态：${status}` : '',
    intro ? `简介：${intro}` : '',
  ])
}

/**
 * 按选中来源统一生成地图 Label 详情（左右面板、系列详情共用）。
 *
 * @param request 资源类型与标识
 * @param ctx 地球数据与库记录
 * @returns 多行文案；无法解析时返回 null
 */
export const resolveGlobeResourceDetailText = (
  request: GlobeResourceDetailRequest,
  ctx: GlobeResourceDetailContext,
): string | null => {
  if (request.kind === 'satellite') {
    const sat = ctx.satellites.find((item) => item.norad === request.norad)
    return sat ? formatSatelliteGlobeDetailLines(sat) : null
  }

  if (request.kind === 'series') {
    const inSeries = ctx.satellites.filter((sat) => sat.series === request.series)
    if (!inSeries.length) return null
    return formatSeriesGlobeDetailLines(request.series, inSeries)
  }

  if (request.kind === 'weapon') {
    const fromGlobe = ctx.weapons.find((item) => item.id === request.weaponId)
    const fallback = request.weaponFallback ?? ctx.weaponRecords.get(request.weaponId) ?? null
    if (!fromGlobe && !fallback) return null
    const text = formatWeaponGlobeDetailLines(fromGlobe ?? null, fallback)
    return text || null
  }

  if (request.kind === 'ground') {
    const parsed = parseGroundTargetKey(request.targetKey)
    if (!parsed) return null
    const fromGlobe = ctx.groundTargets.find(
      (target) => target.kind === parsed.kind && target.id === parsed.id,
    )
    const fallback =
      request.groundFallback ?? ctx.groundRecords.get(parsed.id) ?? null
    if (!fromGlobe && !fallback) return null
    const text = formatGroundStationGlobeDetailLines(parsed.kind, fromGlobe ?? null, fallback)
    return text || null
  }

  return null
}
