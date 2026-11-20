import type { AxiosResponseType } from '@/types/http'
import type { AlgorithmInfo, ThreatAnalysisQuery, ThreatResp } from '@/types/threat'
import { requestAPI } from '@/utils/tools/request'

const BASE = '/api/compute'

/**
 * 已注册的威胁度/打击度相关算法列表（含当前默认生效项）。
 */
export const listRegisteredComputeAlgorithms = () => {
  return requestAPI.get<AxiosResponseType<AlgorithmInfo[]>>(`${BASE}/algorithms`)
}

/**
 * 威胁度分析：静态威胁度 × 动态威胁度 = 综合威胁度。
 *
 * @param taskId 任务 id
 * @param query 可选算法编码覆盖
 */
export const getThreatAnalysis = (taskId: string, query: ThreatAnalysisQuery = {}) => {
  const id = taskId.trim()
  if (!id) {
    return Promise.reject(new Error('威胁度分析 taskId 不能为空'))
  }
  return requestAPI.get<AxiosResponseType<ThreatResp>>(`${BASE}/threat/${encodeURIComponent(id)}`, query)
}