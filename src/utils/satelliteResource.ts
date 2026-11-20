import type { Satellite, SatelliteResource, SatelliteSeriesData } from '@/types/satellite/satellite'

/**
 * 将 NORAD 字符串转为数字，供 Profile / 地图等使用。
 *
 * @param noradId NORAD 字符串
 */
export const parseNoradIdNumber = (noradId: string): number => {
  const value = Number(String(noradId).trim())
  return Number.isFinite(value) ? value : 0
}

/**
 * 将检索结果按体系字段汇总为任务装配使用的系列分组结构。
 *
 * @param list 卫星资源列表
 */
export const buildSatelliteSeriesDataFromSearchResults = (
  list: SatelliteResource[],
): Pick<SatelliteSeriesData, '侦察' | '通信'> => {
  const 侦察: string[] = []
  const 通信: string[] = []
  const seen = new Set<string>()
  for (const item of list) {
    const series = item.series?.trim()
    if (!series) continue
    const key = `${item.system}:${series}`
    if (seen.has(key)) continue
    seen.add(key)
    if (item.system === '侦察') {
      侦察.push(series)
    } else if (item.system === '通信') {
      通信.push(series)
    }
  }
  return { 侦察, 通信 }
}

/**
 * 将资源库卫星映射为 Catalog `Satellite` 结构，供既有预览/装配逻辑复用。
 *
 * @param item 资源库实体
 */
export const mapSatelliteResourceToCatalog = (item: SatelliteResource): Satellite => {
  const norad = parseNoradIdNumber(item.noradId)
  return {
    get_id: item.id ?? item.noradId,
    norad,
    description: '',
    img: '',
    code_id: item.code ?? '',
    int_id: item.intlDesignator ?? '',
    name_en: item.nameEn ?? '',
    name_cn: item.nameCn ?? '',
    country: item.country ?? '',
    target_type: 0,
    orbit_status: 0,
    orbit_type: 0,
    orbit_class: 0,
    payload_status: 0,
    sat_type: '',
    epoch: '',
    a: 0,
    e: 0,
    i: 0,
    o: 0,
    w: 0,
    m: 0,
    prg: 0,
    apg: 0,
    cycle: 0,
    no: 0,
    bstar: 0,
    asc_longitude: 0,
    asc_hours: 0,
    rcs: 0,
    launch_date: item.launchDate ?? '',
    launch_place: '',
    rocket: '',
    fallen_date: '',
    contractors: '',
    operator: '',
    equipment: '',
    configuration: '',
    propulsion: '',
    power: '',
    lifetime: '',
    sat_series_id: item.series ?? '',
    series_name: item.series,
    usage: item.usage,
    mission_sys_type: item.system,
    create_time: item.createTime ?? '',
    update_time: item.updateTime ?? '',
    is_deleted: 0,
    mass: 0,
    shape: '',
    width: 0,
    height: 0,
    depth: 0,
    diameter: 0,
    span: 0,
    xsectmax: 0,
    xsectmin: 0,
    xsectavg: 0,
    name_all: item.nameEn ?? '',
  }
}