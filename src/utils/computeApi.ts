/**
 * 计算模块（`/api/compute`）OpenAPI 约定：业务成功时 `code` 为 200。
 */
export const COMPUTE_API_SUCCESS_CODE = 200

/**
 * 判断计算接口响应是否业务成功。
 *
 * @param code 响应体中的 code
 */
export function isComputeApiSuccess(code: number): boolean {
  return code === COMPUTE_API_SUCCESS_CODE
}