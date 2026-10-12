import type { BaseStationInfo } from '@/api/system/satellite-system-api'
import type { Weapon } from '@/types/dashboard'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'
import { formatSatelliteMetaInline } from '@/utils/buildSatelliteAnalysisTable'

/**
 * 将非空字符串行合并为 Cesium Label 多行文本。
 *
 * @param lines 文本行
 * @returns 用换行符连接的文案
 */
export const joinGlobeLabelDetailLines = (lines: Array<string | null | undefined | false>): string =>
  lines
    .map((line) => (line == null ? '' : String(line).trim()))
    .filter(Boolean)
    .join('\n')

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
  const preview = satellites.slice(0, 6).map((sat) => `${sat.name} (${sat.norad})`)
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
  return joinGlobeLabelDetailLines([
    sat.name,
    meta,
    `NORAD：${sat.norad}`,
    sat.series ? `系列：${sat.series}` : '',
  ])
}

/**
 * 武器详情（优先地球渲染数据，否则用武器库接口记录）。
 *
 * @param globe 地图上武器
 * @param fallback 左侧面板武器库记录
 * @returns Label 详情文案
 */
export const formatWeaponGlobeDetailLines = (
  globe?: BattleGlobeWeapon | null,
  fallback?: Weapon | null,
): string => {
  const name = globe?.name || fallback?.name
  const type = globe?.type || fallback?.type
  const country = globe?.country || fallback?.country
  const id = globe?.id || fallback?.id
  const lon = globe?.longitude ?? fallback?.longitude
  const lat = globe?.latitude ?? fallback?.latitude
  const range = fallback?.range
  const interval = fallback?.interval
  const satelliteType = fallback?.satellite_type
  return joinGlobeLabelDetailLines([
    name ? `名称：${name}` : '',
    type ? `类型：${type}` : '',
    country ? `国家/地区：${country}` : '',
    Number.isFinite(lon) ? `经度：${Number(lon).toFixed(4)}°` : '',
    Number.isFinite(lat) ? `纬度：${Number(lat).toFixed(4)}°` : '',
    range != null && Number.isFinite(Number(range)) ? `射程/高度：${range} km` : '',
    interval ? `打击间隔：${interval} 分钟` : '',
    satelliteType ? `适用卫星：${satelliteType}` : '',
    id ? `ID：${id}` : '',
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
  const id = globe?.id || fallback?._id || fallback?.name
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
  return joinGlobeLabelDetailLines([
    `${kindLabel}${name ? `：${name}` : ''}`,
    type ? `类型：${type}` : '',
    country ? `国家/地区：${country}` : '',
    usage ? `用途：${usage}` : '',
    location ? `位置：${location}` : '',
    latLon && !Number.isFinite(lat) ? `坐标：${latLon}` : '',
    Number.isFinite(lon) && Number.isFinite(lat)
      ? `经度：${Number(lon).toFixed(4)}°  纬度：${Number(lat).toFixed(4)}°`
      : '',
    status ? `状态：${status}` : '',
    intro ? `简介：${intro}` : '',
    id ? `ID：${id}` : '',
  ])
}
