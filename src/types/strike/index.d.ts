import type { AlgorithmSelection, FactorScore } from '@/types/threat'

/** 计算模块：打击度分析表格行（OpenAPI `StrikeRow`） */
export interface StrikeRow {
  /** NORAD 编号 */
  noradId?: string
  /** 卫星名称 */
  satelliteName?: string
  /** 所属国家 */
  country?: string
  /** 卫星类型（体系/系列） */
  satelliteType?: string
  /** 打击度 */
  strike?: number
  /** 建议用弹编码 */
  weaponCode?: string
  /** 建议用弹类型 */
  weaponType?: string
  /** 可打击窗口（北京时间） */
  windows?: string[]
  /** 打击度因子明细 */
  factors?: FactorScore[]
}

/** 打击度分析行别名（页面与工具函数沿用命名） */
export type ComputeStrikeRow = StrikeRow

/** 计算模块：打击度分析响应 */
export interface StrikeResp {
  /** 任务 id */
  taskId?: string
  /** 任务名称 */
  taskName?: string
  /** 计算时间 */
  generatedAt?: string
  /** 本次使用的算法 */
  algorithms?: AlgorithmSelection
  /** 各卫星打击度 */
  rows?: StrikeRow[]
}

/** 打击度分析可选查询参数 */
export interface StrikeAnalysisQuery {
  /** 打击度算法编码 */
  strike?: string
}

/** 卫星档案 `/api/battle/updateStrike/v2` 单条目武器窗口 */
export interface StrikeV2WeaponWindow {
  /** 武器 id */
  id?: string | number
  /** 武器名称 */
  name?: string
  /** 打击窗口描述 */
  strike_window?: string
}

/** 卫星档案可打击度分析单星条目 */
export interface StrikeV2StrikeListItem {
  /** NORAD */
  norad_id?: number | string
  /** 卫星名称 */
  name?: string
  /** 国家 */
  country?: string
  /** 轨道类型 */
  orbit_type?: string
  /** 卫星类型 */
  sat_type?: string
  /** 轨道高度 km */
  orbit_altitude_km?: number
  /** 可打击度得分 */
  strikeability_score?: number
  /** 武器打击窗口列表 */
  weapons_window?: StrikeV2WeaponWindow[]
  /** 位置详情 */
  x1_details?: {
    /** 计算方法 */
    method?: string
    /** 星下点纬度 */
    subsatellite_latitude?: number
    /** 星下点经度 */
    subsatellite_longitude?: number
    /** 星下点高度 km */
    subsatellite_height_km?: number
  }
}

/** 卫星档案可打击度分析响应（legacy v2） */
export interface StrikeV2 {
  /** 目标总数 */
  num?: number
  /** 高可打击数量 */
  hightNum?: number
  /** 低可打击数量 */
  lowNum?: number
  /** 最高可打击度 */
  maxStrikeScore?: number
  /** 最低可打击度 */
  minStrikeScore?: number
  /** 可打击目标列表 */
  strikeList?: StrikeV2StrikeListItem[]
}