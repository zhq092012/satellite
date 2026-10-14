import type { BaseStationInfo } from '@/api/system/satellite-system-api'
import { getSatelliteSeries } from '@/api/task/task'
import type { Weapon } from '@/types/dashboard'
import { buildSeriesOptionsFromApiData, normalizeTaskDateTime } from '@/utils/c2TaskPanelEditor'

/** querySatBySeries 返回项（展示用，与装配页一致） */
export interface C2LeftPanelSatellitePreviewItem {
  /** Mongo 文档 ID */
  _id?: string
  /** NORAD 编号 */
  norad: number
  /** 英文名称 */
  name_en?: string
  /** 中文名称 */
  name_cn?: string | null
  /** 所属系列 */
  series?: string
  /** 卫星类型（侦察 / 通信等） */
  sat_type?: string
  /** 国家 */
  country?: string
  /** 轨道类型编码 */
  orbit_type?: number
}

/** 左侧面板卫星表格行 */
export interface C2LeftPanelSatelliteTableRow {
  /** 行唯一键（系列 + NORAD） */
  key: string
  /** NORAD 编号 */
  norad: number
  /** 展示名称 */
  name: string
  /** 卫星类型 */
  satType: string
  /** 所属系列 */
  series: string
}

/** 左侧面板地面站/数据中心表格行 */
export interface C2LeftPanelGroundStationTableRow {
  /** 资源 ID（定位与选中） */
  id: string
  /** 基站名称 */
  name: string
  /** 所属国家/地区 */
  country: string
  /** 地理位置 */
  location: string
  /** 基站类型 */
  stationType: string
}

/**
 * 左侧面板武器表格行（只读展示，不参与勾选）。
 */
export interface C2LeftPanelWeaponTableRow {
  /** 武器 ID（行键，点击定位用） */
  id: string
  /** 武器名称 */
  name: string
  /** 所属国家/地区 */
  country: string
  /** 武器类型 */
  type: string
  /** 适用卫星类型 */
  satelliteType: string
  /** 纬度 */
  latitude: string
  /** 经度 */
  longitude: string
  /** 打击高度（km） */
  strikeHeightKm: string
  /** 打击间隔（分钟） */
  strikeIntervalMinutes: string
}

/** 按国家分组的地面站/数据中心表格 */
export interface C2LeftPanelCountryGroundGroup {
  /** 国家/组织名称（分组标题） */
  country: string
  /** 该国下的表格行 */
  rows: C2LeftPanelGroundStationTableRow[]
}

/**
 * 格式化为左侧面板只读任务时间行：「开始 — 结束」。
 *
 * @param beginDate 任务开始时间
 * @param endDate 任务结束时间
 * @returns 展示文案
 */
export const formatC2LeftPanelTaskTimeRange = (beginDate?: string, endDate?: string): string => {
  const begin = normalizeTaskDateTime(beginDate ?? '')
  const end = normalizeTaskDateTime(endDate ?? '')
  if (!begin.trim() || !end.trim()) return '--'
  return `${begin} — ${end}`
}

/**
 * 将 querySatBySeries 结果映射为表格行。
 *
 * @param satellites 接口卫星列表
 * @param seriesName 查询时使用的系列名（接口未返回 series 时的回退）
 * @returns 表格行
 */
export const mapSatellitePreviewToTableRows = (
  satellites: C2LeftPanelSatellitePreviewItem[],
  seriesName: string,
): C2LeftPanelSatelliteTableRow[] =>
  satellites.map((satellite) => {
    const series = satellite.series || seriesName || '--'
    const name = satellite.name_en || satellite.name_cn || String(satellite.norad)
    return {
      key: `${series}-${satellite.norad}`,
      norad: satellite.norad,
      name,
      satType: satellite.sat_type || '--',
      series,
    }
  })

/**
 * 解析卫星展示名称。
 *
 * @param satellite 卫星预览项
 * @returns 名称
 */
export const resolveSatellitePreviewName = (satellite: C2LeftPanelSatellitePreviewItem): string =>
  satellite.name_en || satellite.name_cn || String(satellite.norad)

/**
 * 按国家并行拉取卫星系列名列表（每国单独调用 getSatelliteSeries，避免猜测国家归属）。
 *
 * @param countries 敌方国家列表
 * @param targetTypes 任务卫星类型（侦察 / 通信）
 * @returns 国家 → 系列名列表
 * @throws 任一国家接口非 200 且无 data 时抛出，含国家与 msg
 */
export const fetchSeriesNamesByCountry = async (
  countries: string[],
  targetTypes: string[],
): Promise<Map<string, string[]>> => {
  const map = new Map<string, string[]>()
  if (!countries.length) return map

  const results = await Promise.all(
    countries.map(async (country) => {
      const res = await getSatelliteSeries([country])
      if (res.code !== 200 || !res.data) {
        throw new Error(
          res.msg || `getSatelliteSeries 失败（国家：${country}，code=${String(res.code)}）`,
        )
      }
      const names = targetTypes.length
        ? buildSeriesOptionsFromApiData(res.data, targetTypes)
        : buildSeriesOptionsFromApiData(res.data, ['侦察', '通信'])
      return { country, names }
    }),
  )

  for (const { country, names } of results) {
    const deduped = [...new Set(names)].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    map.set(country, deduped)
  }
  return map
}

/**
 * 将候选项与基站库记录合并为左侧面板表格行。
 *
 * @param item 候选项（id + label）
 * @param recordById 资源 ID → 接口记录
 * @returns 表格行
 */
export const buildGroundStationTableRow = (
  item: { id: string; label: string },
  recordById: Map<string, BaseStationInfo>,
): C2LeftPanelGroundStationTableRow => {
  const record = recordById.get(item.id)
  const name = (record?.name ?? item.label ?? item.id).trim()
  const country = (record?.country ?? '').trim()
  const location = (record?.location ?? '').trim()
  const stationType = (record?.type ?? '').trim()
  return {
    id: item.id,
    name: name || item.id,
    country: country || '--',
    location: location || '--',
    stationType: stationType || '--',
  }
}

/**
 * 将地面站/数据中心候选项按国家分组为表格行。
 * `countries` 中的国家保持原顺序；候选项所属国家不在该列表中时仍单独成组，避免任务已选资源被丢掉。
 *
 * @param options 候选项（id + label），调用方应只传入任务已选资源
 * @param recordById 资源 ID → 接口记录
 * @param countries 敌方国家顺序
 * @returns 分组列表
 */
export const groupGroundStationRowsByCountry = (
  options: { id: string; label: string }[],
  recordById: Map<string, BaseStationInfo>,
  countries: string[],
): C2LeftPanelCountryGroundGroup[] => {
  const bucket = new Map<string, C2LeftPanelGroundStationTableRow[]>()
  for (const country of countries) {
    bucket.set(country, [])
  }
  const extraCountries: string[] = []

  for (const item of options) {
    const row = buildGroundStationTableRow(item, recordById)
    const country = row.country === '--' ? '' : row.country
    if (!bucket.has(country)) {
      bucket.set(country, [])
      extraCountries.push(country)
    }
    bucket.get(country)!.push(row)
  }

  return [...countries, ...extraCountries].map((country) => ({
    country,
    rows: bucket.get(country) ?? [],
  }))
}

/**
 * 将武器字段格式化为表格单元格。接口未返回该字段时显示「--」，与地面站表空值展示一致。
 *
 * @param value 原始字段
 * @returns 单元格文案
 */
const formatWeaponTableCell = (value: string | number | undefined | null): string => {
  if (value == null) return '--'
  const text = String(value).trim()
  return text || '--'
}

/**
 * 将武器候选项与武器库记录合并为左侧面板只读表格行。
 *
 * @param item 候选项（id + label）
 * @param recordById 武器 ID → 接口记录
 * @returns 表格行
 */
export const buildWeaponTableRow = (
  item: { id: string; label: string },
  recordById: Map<string, Weapon>,
): C2LeftPanelWeaponTableRow => {
  const record = recordById.get(item.id)
  return {
    id: item.id,
    name: formatWeaponTableCell(record?.name || item.label || item.id),
    country: formatWeaponTableCell(record?.country),
    type: formatWeaponTableCell(record?.type),
    satelliteType: formatWeaponTableCell(record?.satellite_type),
    latitude: formatWeaponTableCell(record?.latitude),
    longitude: formatWeaponTableCell(record?.longitude),
    strikeHeightKm: formatWeaponTableCell(record?.range),
    strikeIntervalMinutes: formatWeaponTableCell(record?.interval),
  }
}

/**
 * 合并各国系列名并去重（同名系列只保留一个键，展示时仍可在多国下出现）。
 *
 * @param seriesByCountry 国家 → 系列列表
 * @returns 去重后的全部系列名
 */
export const collectUniqueSeriesNames = (seriesByCountry: Map<string, string[]>): string[] => {
  const set = new Set<string>()
  for (const list of seriesByCountry.values()) {
    for (const name of list) set.add(name)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}
