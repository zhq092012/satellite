/**
 * 资源库 TLE 记录（`SatelliteTleResp`）。
 */
export interface TleResource {
  /** 记录 id */
  id?: string
  /** NORAD 编号 */
  noradId: string
  /** TLE 第 1 行 */
  line1: string
  /** TLE 第 2 行 */
  line2: string
  /** 创建时间 */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
}

/**
 * TLE 列表查询（`GET /resource/tle/list`）。
 * 仅支持 NORAD 或名称模糊过滤。
 */
export interface TleResourceListQuery {
  /** NORAD 或名称关键字 */
  keyword?: string
}

/**
 * 按 NORAD 查询/删除 TLE 的路径参数（`GET|DELETE /resource/tle/{noradId}`）。
 */
export interface TleResourceNoradIdPath {
  /** 路径参数：NORAD 编号 */
  noradId: string
}

/** TLE txt 批量导入结果（与 OpenAPI `TleImportResult` 一致） */
export type { ResourceImportResult as TleImportResult } from '@/types/resource/import'