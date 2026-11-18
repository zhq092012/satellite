import type { BattleForm, BattleUpsertPayload } from '@/types/battle/battle'
import type { AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/tools/request'

/**
 * 查询战场列表。
 * 走 `requestAPI`，请求头自动附带 `Authorization: Bearer <token>`。
 */
export const getBattleList = () => {
  return requestAPI.get<AxiosResponseType<BattleForm[]>>('/api/battle/list')
}

/**
 * 根据 ID 查询单个战场。
 *
 * @param id 战场 ID
 */
export const getBattleById = (id: number) => {
  return requestAPI.get<AxiosResponseType<BattleForm>>(`/api/battle/${id}`)
}

/**
 * 新增战场。
 *
 * @param battle 战场表单；成功时 `data` 一般为新战场 ID（number）
 */
export const createBattle = (battle: BattleUpsertPayload) => {
  return requestAPI.post<AxiosResponseType<number>>('/api/battle', battle)
}

/**
 * 更新战场。
 *
 * @param battle 须包含 `id`
 */
export const updateBattle = (battle: BattleUpsertPayload) => {
  return requestAPI.put<AxiosResponseType<unknown>>('/api/battle', battle)
}

/**
 * 删除战场。
 *
 * @param battleId 战场 ID
 */
export const deleteBattle = (battleId: number) => {
  return requestAPI.delete<AxiosResponseType<unknown>>(`/api/battle/${battleId}`)
}