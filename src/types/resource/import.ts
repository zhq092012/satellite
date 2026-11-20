/**
 * 卫星 / TLE 等资源批量导入的通用结果结构（与 OpenAPI 一致）。
 */
export interface ResourceImportResult {
  /** 解析到的数据条数 */
  total: number
  /** 新增条数 */
  inserted: number
  /** 更新条数 */
  updated: number
  /** 跳过条数 */
  skipped: number
  /** 异常或告警信息 */
  warnings?: string[]
}