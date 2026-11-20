/**
 * 资源库卫星实体（`SatelliteResp`）。
 */
export interface SatelliteResource {
  /** 记录 id */
  id?: string
  /** NORAD 编号（关联 TLE） */
  noradId: string
  /** 卫星代号 */
  code?: string
  /** 国际编号 */
  intlDesignator?: string
  /** 中文名称 */
  nameCn?: string
  /** 英文名称 */
  nameEn?: string
  /** 国家/地区 */
  country?: string
  /** 发射日期 yyyy-MM-dd */
  launchDate?: string
  /** 体系：侦察 / 通信 / 中继 */
  system?: string
  /** 系列 */
  series?: string
  /** 用途：军用 / 商用 等 */
  usage?: string
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
}

/**
 * 新建或修改卫星资源请求体（`SatelliteReq`）。
 */
export interface SatelliteResourceUpsertPayload {
  /** 记录 id（编辑时必填） */
  id?: string
  /** NORAD 编号 */
  noradId: string
  /** 卫星代号 */
  code?: string
  /** 国际编号 */
  intlDesignator?: string
  /** 中文名称 */
  nameCn?: string
  /** 英文名称 */
  nameEn?: string
  /** 国家 */
  country?: string
  /** 发射日期 */
  launchDate?: string
  /** 体系 */
  system?: string
  /** 系列 */
  series?: string
  /** 用途 */
  usage?: string
}

/**
 * 卫星列表查询（`GET /resource/satellite/list`）。
 * 仅支持关键字模糊：NORAD / 代号 / 名称；不含国家、体系、系列条件。
 */
export interface SatelliteResourceListQuery {
  /** NORAD、代号或名称关键字 */
  keyword?: string
}

/**
 * 卫星资源检索（`GET /resource/satellite/search`）。
 * 仅支持 country / system / series；不含 keyword。
 */
export interface SatelliteResourceSearchQuery {
  /** 国家 */
  country?: string
  /** 体系 侦察/通信/中继 */
  system?: string
  /** 系列 */
  series?: string
}

/**
 * 按国家查询系列名称（`GET /resource/satellite/series`，OpenAPI `listSeriesByCountry`）。
 */
export interface SatelliteSeriesByCountryQuery {
  /** 国家（必填 query） */
  country: string
}

/**
 * `listSeriesByCountry` 业务数据：该国去重后的系列名称列表。
 */
export type SatelliteSeriesNameList = string[]

/**
 * 系列接口 data：按任务系统类型分组的系列名列表（任务装配、C2 等资源树复用）。
 */
export interface SatelliteSeriesData {
  /** 侦察体系列名 */
  侦察: string[]
  /** 通信体系列名 */
  通信: string[]
}

/** 卫星 Excel 批量导入结果（与 OpenAPI `SatelliteImportResult` 一致） */
export type { ResourceImportResult as SatelliteImportResult } from '@/types/resource/import'

/** 态势/仿真用卫星概要（地图点位等） */
export interface SatelliteInfo {
  /** 文档 ID */
  _id: string
  /** NORAD */
  norad: number
  /** 英文名称 */
  name_en: string
  /** 国际编号 */
  int_id: string
  /** 载荷类型 */
  sat_type: string
  /** 当前位置 */
  satellitePosition: {
    /** 纬度 */
    latitude: number
    /** 经度 */
    longitude: number
    /** 高度 */
    altitude: number
  }
}

/** Catalog 卫星（历史 Mongo 字段，态势与详情仍大量使用） */
export interface Satellite {
  /** 内部 ID */
  get_id: string
  /** NORAD */
  norad: number
  /** 描述 */
  description: string
  /** 图片 */
  img: string
  /** 编码 ID */
  code_id: string
  /** 国际编号 */
  int_id: string
  /** 英文名称 */
  name_en: string
  /** 中文名称 */
  name_cn: string
  /** 国家 */
  country: string
  /** 目标类型 */
  target_type: number
  /** 轨道状态 */
  orbit_status: number
  /** 轨道类型 */
  orbit_type: number
  /** 轨道分类 */
  orbit_class: number
  /** 载荷状态 */
  payload_status: number
  /** 载荷类型 */
  sat_type: string
  /** 历元 */
  epoch: string
  a: number
  e: number
  i: number
  o: number
  w: number
  m: number
  prg: number
  apg: number
  cycle: number
  no: number
  bstar: number
  asc_longitude: number
  asc_hours: number
  rcs: number
  /** 发射日期 */
  launch_date: string
  launch_place: string
  rocket: string
  fallen_date: string
  contractors: string
  operator: string
  equipment: string
  configuration: string
  propulsion: string
  power: string
  lifetime: string
  sat_series_id: string
  /** 系列展示名（catalog 扩展，可选） */
  series_name?: string
  /** 卫星用途（catalog 扩展，可选） */
  usage?: string
  /** 任务系统类型（catalog 扩展，可选） */
  mission_sys_type?: string
  create_time: string
  update_time: string
  is_deleted: number
  mass: number
  shape: string
  width: number
  height: number
  depth: number
  diameter: number
  span: number
  xsectmax: number
  xsectmin: number
  xsectavg: number
  name_all: string
}

/** 卫星详情（Profile 等） */
export interface SatelliteDetail {
  _id: string
  norad: number
  description: string
  img: string
  code_id: null | string | number
  int_id: string
  name_en: string
  name_cn: null | string | number
  country: string
  target_type: number
  orbit_status: number
  orbit_type: number
  orbit_class: number
  payload_status: number
  sat_type: string
  epoch: null | string | number
  a: number
  e: number
  i: number
  o: null | string | number
  w: null | string | number
  m: null | string | number
  prg: number
  apg: number
  cycle: number
  no: number
  bstar: null | string | number
  asc_longitude: null | string | number
  asc_hours: null | string | number
  rcs: null | string | number
  launch_date: string
  launch_place: string
  rocket: string
  fallen_date: number[]
  contractors: string
  operator: null | string | number
  equipment: string
  configuration: string
  propulsion: string
  power: string
  lifetime: string
  sat_series_id: string
  create_time: string
  update_time: string
  is_deleted: number
  mass: number
  shape: string
  width: number
  height: number
  depth: number
  diameter: null | string | number
  span: number
  xsectmax: number
  xsectmin: number
  xsectavg: number
  name_all: string
}

/** 卫星 TLE 数据 */
export interface SatelliteTle {
  _id: string
  /** 全球唯一 ID（NORAD） */
  norad_id: number
  line1: string
  line2: string
  /** TLE 历元时刻 */
  epoch: string
  /** 轨道倾角（°） */
  inclination: number
  /** 升交点赤经（°） */
  raan: number
  /** 偏心率 */
  eccentricity: number
  /** 近地点幅角（°） */
  arg_perigee: number
  /** 平近点角（°） */
  mean_anomaly: number
  /** 半长轴（km） */
  semi_major_axis: number
  retrieval_time: string
  name: null | string
  country: null | string
  target_type: null | string
  orbit_type: null | string
}

/** 任务步骤 */
export interface TaskSteps {
  id: number
  name: string
  startTime: string
  endTime: string
  sateTypeShow: string[]
  sateType: string
  /** 作战目标 */
  target: string
}

/** 分步态势中的卫星结构 */
export interface StepSatellite {
  taskStepResp: {
    id: number
    name: string
    startTime: string
    endTime: string
    sateType: string
    target: string
  }
  structureList: {
    name: string
    gjList: {
      norad_id: string
      satellite: string | null
      geoCoordinates: {
        latitude: number
        longitude: number
        altitude: number
      }
      country: string
      orbit_status: number
      orbit_type: number
      payload_status: number
      sat_type: string
      int_id: string
      name_en: string
      contractors: string
      launch_place: string
      rocket: string
      operator: string
      threat_level: string
      gjMap: {
        地区: string
        过境持续时间_分: string
        norad_id: number
        过境_峰值仰角: string
        过境_开始时间: string
        过境_结束时间: string
        过境_方位角: string
        过境_峰值时间: string
      }
    }[]
  }[]
}