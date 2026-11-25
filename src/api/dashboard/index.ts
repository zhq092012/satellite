import type { SatelliteDetail, SatelliteTle } from '@/types/satellite/satellite'
import type { SatelliteNode, SatelliteRelation, Weapon } from '@/types/dashboard'
import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import type { StrikeV2 } from '@/types/strike'
import type { ThreatTaskWeightsResponse } from '@/types/threat'
import { requestAPI } from '@/utils/tools/request'

/**
 * 获取卫星详情（卫星档案弹窗）。
 *
 * @param data NORAD 编号
 */
export const getSatelliteDetail = (data: { norad: number }) => {
  const url = `/api/satellite/satellite/param`
  return requestAPI.post<AxiosResponseType<SatelliteDetail>>(url, data)
}

/**
 * 获取任务威胁度列表（卫星档案内嵌威胁表）。
 */
export const getAllThreatList = (
  taskId: number,
  pageNum: number,
  pageSize: number,
  systemName?: string,
  orbitType?: string,
  noradId?: number,
) => {
  let url = `/api/battle/threatTaskList?taskId=${taskId}&pageNum=${pageNum}&pageSize=${pageSize}`
  if (systemName) {
    url += `&systemName=${systemName}`
  }
  if (orbitType) {
    url += `&orbitType=${orbitType === '全部' ? '' : orbitType}`
  }
  if (noradId) {
    url += `&noradId=${noradId}`
  }
  return requestAPI.get<AxiosResponsePage<ThreatTaskWeightsResponse[]>>(url)
}

/**
 * 单颗卫星关系网视图（卫星档案拓扑图）。
 *
 * @param noradId NORAD
 * @param taskId 可选任务 ID
 */
export const getSatelliteRelationsBySatellite = (noradId: number, taskId?: number) => {
  let url = `/api/battle/netView/norad?noradId=${noradId}`
  if (taskId) {
    url += `&taskId=${taskId}`
  }
  return requestAPI.get<AxiosResponseType<{ nodes: SatelliteNode[]; relationships: SatelliteRelation[] }>>(url)
}

/**
 * 分页查询卫星 TLE（卫星档案轨道历史）。
 */
export const getSatelliteTlePages = (data: { norads: number[]; pageNum: number; pageSize: number }) => {
  const url = `/api/satellite/satellite/tle/page`
  return requestAPI.post<AxiosResponsePage<SatelliteTle[]>>(url, data)
}

/**
 * 重新计算单星可打击度（卫星档案）。
 */
export const updateStrikeOfTaskV2 = (taskId: number | undefined, norad?: number) => {
  let url = `/api/battle/updateStrike/v2?taskId=${taskId}`
  if (norad) {
    url += `&norad=${norad}`
  }
  return requestAPI.get<AxiosResponseType<StrikeV2>>(url)
}

/** 删除武器（数据管理 / 任务装配） */
export const deleteWeapon = (id: string) => {
  const url = `/api/battle/weapon/${id}`
  return requestAPI.delete<AxiosResponseType<unknown>>(url)
}

/** 新增武器 */
export const createWeapon = (weapon: Weapon) => {
  const url = `/api/battle/addWeapon`
  return requestAPI.post<AxiosResponseType<unknown>>(url, weapon)
}

/** 更新武器 */
export const updateWeapon = (weapon: Weapon) => {
  const url = `/api/battle/addWeapon`
  return requestAPI.post<AxiosResponseType<unknown>>(url, weapon)
}