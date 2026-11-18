/**
 * 地面站「所属国家/地区」下拉选项（当前写死）。
 *
 * @remarks 后期需改为字典或统一接口下发，管理页与任务装配等引用处共用同一数据源。
 */
export const GROUND_STATION_COUNTRY_OPTIONS = ['日本', '美国', '中国台湾'] as const

/** 地面站国家选项元素类型。 */
export type GroundStationCountryOption = (typeof GROUND_STATION_COUNTRY_OPTIONS)[number]