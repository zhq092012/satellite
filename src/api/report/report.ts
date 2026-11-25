import type { AxiosResponseType } from '@/types/http'
import type { ReportGenerateResp } from '@/types/report/report'
import { requestAPI } from '@/utils/tools/request'
import { isResourceApiSuccess } from '@/utils/resourceApi'

export type { ReportGenerateResp, SchemeResult, ReportCandidateSatellite } from '@/types/report/report'

/**
 * 按任务生成作战方案报告（报告-作战方案生成）。
 * OpenAPI：`GET /report/schemes/{taskId}`；当前 `data` 主要为 `strikePlans` + `taskName` + `generatedAt`。
 *
 * @param taskId 任务 id
 * @throws 业务失败或响应体无 `data` 时抛出错误
 */
export const getReportSchemes = async (taskId: string | number): Promise<ReportGenerateResp> => {
  const id = String(taskId).trim()
  if (!id) {
    throw new Error('getReportSchemes: taskId 不能为空')
  }
  const res = await requestAPI.get<AxiosResponseType<ReportGenerateResp>>(
    `/api/report/schemes/${encodeURIComponent(id)}`,
  )
  if (!isResourceApiSuccess(res.code) || res.data == null) {
    throw new Error(res.msg || '获取作战方案报告失败')
  }
  return res.data
}