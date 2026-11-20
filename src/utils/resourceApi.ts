import type { ResourceImportResult } from '@/types/resource/import'

/**
 * 战场资源接口（OpenAPI）约定：业务成功时 `code` 为 0。
 */
export const RESOURCE_API_SUCCESS_CODE = 200

/**
 * 判断资源接口响应是否业务成功。
 *
 * @param code 响应体中的 code
 */
export function isResourceApiSuccess(code: number): boolean {
  return code === RESOURCE_API_SUCCESS_CODE
}

/**
 * 将资源批量导入结果格式化为展示文案。
 *
 * @param data 导入结果
 */
export function formatResourceImportSummary(data: ResourceImportResult): {
  title: string
  description: string
  type: 'success' | 'warning'
} {
  const warningText = data.warnings?.length ? ` 告警：${data.warnings.join('；')}` : ''
  return {
    title: '导入完成',
    description: `共 ${data.total} 条，新增 ${data.inserted}，更新 ${data.updated}，跳过 ${data.skipped}。${warningText}`.trim(),
    type: data.skipped > 0 || (data.warnings?.length ?? 0) > 0 ? 'warning' : 'success',
  }
}