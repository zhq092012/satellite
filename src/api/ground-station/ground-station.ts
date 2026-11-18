import type { AxiosResponseType } from '@/types/http'
import type {
  GroundStation,
  GroundStationListQuery,
  GroundStationStatus,
  GroundStationUpsertPayload,
} from '@/types/ground-station/groundstation'
import { requestAPI } from '@/utils/tools/request'

export type {
  GroundStation,
  GroundStationListQuery,
  GroundStationStatus,
  GroundStationStatusPayload,
  GroundStationUpsertPayload,
} from '@/types/ground-station/groundstation'

const BASE = '/api/resource/ground-station'

/**
 * 查询地面站列表。
 */
export const getGroundStationList = (query: GroundStationListQuery = {}) => {
  return requestAPI.get<AxiosResponseType<GroundStation[]>>(`${BASE}/list`, query)
}

/**
 * 按 ID 查询地面站详情。
 *
 * @param id 地面站 ID
 */
export const getGroundStationById = (id: number) => {
  return requestAPI.get<AxiosResponseType<GroundStation>>(`${BASE}/${id}`)
}

/**
 * 新增地面站。
 */
export const createGroundStation = (payload: GroundStationUpsertPayload) => {
  return requestAPI.post<AxiosResponseType<number>>(BASE, payload)
}

/**
 * 修改地面站。请求体须包含 `id`。
 */
export const updateGroundStation = (payload: GroundStationUpsertPayload & { id: number }) => {
  return requestAPI.put<AxiosResponseType<unknown>>(BASE, payload)
}

/**
 * 删除地面站。
 *
 * @param id 地面站 ID
 */
export const deleteGroundStation = (id: number) => {
  return requestAPI.delete<AxiosResponseType<unknown>>(`${BASE}/${id}`)
}

/**
 * 启用或停用地面站。
 *
 * @param id 地面站 ID
 * @param status 1 正常，0 停用
 */
export const updateGroundStationStatus = (id: number, status: GroundStationStatus) => {
  return requestAPI.put<AxiosResponseType<unknown>>(`${BASE}/${id}/status`, { status })
}