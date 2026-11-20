import type { AxiosResponseType } from '@/types/http'
import type { TleImportResult, TleResource, TleResourceListQuery } from '@/types/tle/tle'
import { requestAPI } from '@/utils/tools/request'

export type { TleImportResult, TleResource, TleResourceListQuery } from '@/types/tle/tle'

const BASE = '/api/resource/tle'

/**
 * TLE 列表（NORAD 或名称模糊过滤）。
 */
export const getTleResourceList = (query: TleResourceListQuery = {}) => {
  return requestAPI.get<AxiosResponseType<TleResource[]>>(`${BASE}/list`, query)
}

/**
 * 根据 NORAD 查询 TLE。
 *
 * @param noradId NORAD 编号
 */
export const getTleResourceByNoradId = (noradId: string) => {
  return requestAPI.get<AxiosResponseType<TleResource>>(`${BASE}/${noradId}`)
}

/**
 * 根据 NORAD 删除 TLE。
 *
 * @param noradId NORAD 编号
 */
export const deleteTleResourceByNoradId = (noradId: string) => {
  return requestAPI.delete<AxiosResponseType<unknown>>(`${BASE}/${noradId}`)
}

/**
 * 批量导入 TLE（txt，multipart file）。
 *
 * @param file 导入文件
 */
export const importTleResources = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return requestAPI.post<AxiosResponseType<TleImportResult>>(`${BASE}/import`, formData, {
    'Content-Type': 'multipart/form-data',
  })
}