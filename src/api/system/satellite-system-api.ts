import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/http/request'
// 基站信息接口
export interface BaseStationInfo {
  _id?: string
  name: string
  type: string
  country: string
  latLon: string
  location: string
  function: string
  introduction: string
}

// 导弹信息接口
export interface MissileInfo {
  _id?: string
  id?: string
  url?: string
  missileName?: string
  country?: string
  originatedFrom?: string
  possessedBy?: string
  clazz?: string
  basing?: string
  length?: string
  diameter?: string
  launchWeight?: string
  payload?: string
  warhead?: string
  propulsion?: string
  range?: string
  speed?: string
  status?: string
  inService?: string
  alternateName?: string
  guidance?: string
  firstTested?: string
  width?: string
  caliber?: string
  wingspan?: string
  weight?: string
  homingSeeker?: string
  operators?: string
  variants?: string
  tableClass?: string
  tableRange?: string
  tableStatus?: string
  sections?: {
    hwasong19Development?: string
    hwasong19Specifications?: string
  }
  alternateNameShahed131?: string
  rangeShahed131?: string
  lengthShahed131?: string
  wingspanShahed131?: string
  payloadShahed131?: string
  weightShahed131?: string
  inServiceShahed131?: string
  alternateNameShahed136?: string
  rangeShahed136?: string
  lengthShahed136?: string
  wingspanShahed136?: string
  payloadShahed136?: string
  weightShahed136?: string
  inServiceShahed136?: string
  parseTime?: string
  parser?: string
  parserVersion?: string
  nationCategory?: number
  crawlerTime?: string
  netUrl?: string
  netName?: string
  netNameZh?: string
  netNation?: string
  netLanguage?: string
  channelName?: string
  channelUrl?: string
  channelDesc?: string
  dataSource?: string
  dataSourceIp?: string
  dataSourceHostname?: string
  dataSourceJdSpider?: number
  ziHost?: number
  ziZone?: number
  createTime?: string
  updateTime?: string
  dataChangeType?: string
}

//导弹基地信息接口
export interface MissileBaseInfo {
  _id?: string
  name: string
  latLon: string
  country: string
  deployMissiles: {
    missileName: string
    _id: string
  }[]
}
//  查询基站列表
export const getBaseStationList = (data: { pageNum: number; pageSize: number; type: string; name: string }) => {
  const url = `/api/satellite/station/pageQuery`
  return requestAPI.post<AxiosResponsePage<BaseStationInfo[]>>(url, data)
}

// 保存或更新基站信息
export const saveOrUpdateBaseStation = (data: BaseStationInfo) => {
  const url = `/api/satellite/station/save`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}

// 批量删除基站信息
export const deleteBaseStations = (ids: string[]) => {
  const url = `/api/satellite/station/del`
  return requestAPI.post<AxiosResponseType<any>>(url, ids)
}

// 查询导弹列表
export const getMissileList = (data: { pageNum: number; pageSize: number; country: string; missileName?: string }) => {
  const url = `/api/satellite/missile/pageQuery`
  return requestAPI.post<AxiosResponsePage<MissileInfo[]>>(url, data)
}

// 保存或更新导弹信息
export const saveOrUpdateMissile = (data: MissileInfo) => {
  const url = `/api/satellite/missile/save`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}

// 批量删除导弹信息
export const deleteMissiles = (ids: string[]) => {
  const url = `/api/satellite/missile/del`
  return requestAPI.post<AxiosResponseType<any>>(url, ids)
}

// 查询导弹基地
export const getMissileBaseList = (data: { pageNum: number; pageSize: number; country: string; name: string }) => {
  const url = `/api/satellite/missileBase/pageQuery`
  return requestAPI.post<AxiosResponsePage<MissileBaseInfo[]>>(url, data)
}

// 保存或更新导弹基地信息
export const saveOrUpdateMissileBase = (data: MissileBaseInfo) => {
  const url = `/api/satellite/missileBase/save`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}

//批量删除导弹信息
export const deleteMissileBases = (ids: string[]) => {
  const url = `/api/satellite/missileBase/del`
  return requestAPI.post<AxiosResponseType<any>>(url, ids)
}

// 查询卫星地面站列表
export const getGroundStationList = (data: { type: string; name: string; country: string }) => {
  const url = `/api/satellite/station/Query`
  return requestAPI.post<AxiosResponseType<BaseStationInfo[]>>(url, data)
}

//查询导弹基地列表
export const getMissileBaseListAll = (data: { country: string; name: string }) => {
  const url = `/api/satellite/missileBase/Query`
  return requestAPI.post<AxiosResponseType<MissileBaseInfo[]>>(url, data)
}
