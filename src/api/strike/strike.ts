import type { AxiosResponseType } from '@/types/http'
import type { StrikeAnalysisQuery, StrikeResp } from '@/types/strike'
import { requestAPI } from '@/utils/tools/request'

const BASE = '/api/compute'

/**
 * 打击度分析。
 *
 * @param taskId 任务 id
 * @param query 可选打击度算法编码
 */
export const getStrikeAnalysis = (taskId: string, query: StrikeAnalysisQuery = {}) => {
  const id = taskId.trim()
  if (!id) {
    return Promise.reject(new Error('打击度分析 taskId 不能为空'))
  }
  return requestAPI.get<AxiosResponseType<StrikeResp>>(`${BASE}/strike/${encodeURIComponent(id)}`, query)
}