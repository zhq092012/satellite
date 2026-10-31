import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/tools/httpClient'
// 基站信息接口
export interface BaseStationInfo {
  /** 文档 ID */
  _id?: string
  /** 基站名称 */
  name: string
  /** 基站类型 */
  type: string
  /** 国家或地区 */
  country: string
  /** 经纬度，格式为纬度,经度 */
  latLon: string
  /** 位置描述 */
  location: string
  /** 基站功能 */
  function: string
  /** 基站简介 */
  introduction: string
}

// 导弹信息接口
export interface MissileInfo {
  /** 文档 ID */
  _id?: string
  /** 导弹业务 ID */
  id?: string
  /** 导弹资料来源地址 */
  url?: string
  /** 导弹名称 */
  missileName?: string
  /** 国家或地区 */
  country?: string
  /** 技术来源 */
  originatedFrom?: string
  /** 装备方 */
  possessedBy?: string
  /** 导弹类别。接口字段名为 clazz */
  clazz?: string
  /** 部署方式 */
  basing?: string
  /** 长度 */
  length?: string
  /** 直径 */
  diameter?: string
  /** 发射重量 */
  launchWeight?: string
  /** 载荷 */
  payload?: string
  /** 战斗部 */
  warhead?: string
  /** 动力方式 */
  propulsion?: string
  /** 射程 */
  range?: string
  /** 速度 */
  speed?: string
  /** 导弹研制或服役状态 */
  status?: string
  /** 服役情况 */
  inService?: string
  /** 别名 */
  alternateName?: string
  /** 制导方式 */
  guidance?: string
  /** 首次试验时间 */
  firstTested?: string
  /** 宽度 */
  width?: string
  /** 口径 */
  caliber?: string
  /** 翼展 */
  wingspan?: string
  /** 重量 */
  weight?: string
  /** 导引头 */
  homingSeeker?: string
  /** 使用方 */
  operators?: string
  /** 改型 */
  variants?: string
  /** 表格中的导弹类别 */
  tableClass?: string
  /** 表格中的射程 */
  tableRange?: string
  /** 表格中的状态 */
  tableStatus?: string
  /** 正文分节，含火星-19 的研制与性能说明 */
  sections?: {
    /** 火星-19 研制说明 */
    hwasong19Development?: string
    /** 火星-19 性能参数 */
    hwasong19Specifications?: string
  }
  /** 沙赫德-131 别名 */
  alternateNameShahed131?: string
  /** 沙赫德-131 射程 */
  rangeShahed131?: string
  /** 沙赫德-131 长度 */
  lengthShahed131?: string
  /** 沙赫德-131 翼展 */
  wingspanShahed131?: string
  /** 沙赫德-131 载荷 */
  payloadShahed131?: string
  /** 沙赫德-131 重量 */
  weightShahed131?: string
  /** 沙赫德-131 服役情况 */
  inServiceShahed131?: string
  /** 沙赫德-136 别名 */
  alternateNameShahed136?: string
  /** 沙赫德-136 射程 */
  rangeShahed136?: string
  /** 沙赫德-136 长度 */
  lengthShahed136?: string
  /** 沙赫德-136 翼展 */
  wingspanShahed136?: string
  /** 沙赫德-136 载荷 */
  payloadShahed136?: string
  /** 沙赫德-136 重量 */
  weightShahed136?: string
  /** 沙赫德-136 服役情况 */
  inServiceShahed136?: string
  /** 解析时间 */
  parseTime?: string
  /** 解析器名称 */
  parser?: string
  /** 解析器版本 */
  parserVersion?: string
  /** 国家分类编码 */
  nationCategory?: number
  /** 爬取时间 */
  crawlerTime?: string
  /** 来源网页地址 */
  netUrl?: string
  /** 来源站点名称 */
  netName?: string
  /** 来源站点中文名 */
  netNameZh?: string
  /** 来源站点国家 */
  netNation?: string
  /** 来源站点语言 */
  netLanguage?: string
  /** 来源频道名称 */
  channelName?: string
  /** 来源频道地址 */
  channelUrl?: string
  /** 来源频道描述 */
  channelDesc?: string
  /** 数据来源标识 */
  dataSource?: string
  /** 数据源 IP */
  dataSourceIp?: string
  /** 数据源主机名 */
  dataSourceHostname?: string
  /** 采集蜘蛛标记 */
  dataSourceJdSpider?: number
  /** 主机分区编号 */
  ziHost?: number
  /** 区域分区编号 */
  ziZone?: number
  /** 记录创建时间 */
  createTime?: string
  /** 记录更新时间 */
  updateTime?: string
  /** 数据变更类型 */
  dataChangeType?: string
}

//导弹基地信息接口
export interface MissileBaseInfo {
  /** 文档 ID */
  _id?: string
  /** 导弹基地名称 */
  name: string
  /** 经纬度，格式为纬度,经度 */
  latLon: string
  /** 国家或地区 */
  country: string
  /** 该基地部署的导弹 */
  deployMissiles: {
    /** 导弹名称 */
    missileName: string
    /** 导弹文档 ID */
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
