/**
 * 地面站启用状态。
 * - `1`：正常（启用）
 * - `0`：停用
 */
export type GroundStationStatus =
  /** 停用 */
  | 0
  /** 正常启用 */
  | 1

/**
 * 地面站实体（列表、详情接口返回）。
 */
export interface GroundStation {
  /** 地面站 ID */
  id: number
  /** 站点名称 */
  name: string
  /** 站号/编码，示例值 KS-01 */
  code: string
  /** 所属国家/地区 */
  country: string
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 高度（米） */
  altitude: number
  /** 启用状态：1 正常，0 停用 */
  status: GroundStationStatus
  /** 描述 */
  description: string
}

/**
 * 新建或修改地面站请求体。
 */
export interface GroundStationUpsertPayload {
  /** 修改时必填 */
  id?: number
  /** 站点名称 */
  name: string
  /** 站号/编码 */
  code: string
  /** 所属国家/地区 */
  country: string
  /** 经度 */
  longitude: number
  /** 纬度 */
  latitude: number
  /** 高度（米） */
  altitude: number
  /** 描述 */
  description: string
  /**
   * 启用状态；创建时可传，也可创建后单独调 status 接口。
   * 未传时由后端默认。
   */
  status?: GroundStationStatus
}

/**
 * 地面站列表查询参数（均为可选筛选）。
 */
export interface GroundStationListQuery {
  /** 关键字：同时匹配站点名称、站号/编码 */
  keyword?: string
  /** 仅查询指定状态；不传则返回全部 */
  status?: GroundStationStatus
}

/**
 * 启用/停用接口请求体。
 */
export interface GroundStationStatusPayload {
  /** 1 正常，0 停用 */
  status: GroundStationStatus
}