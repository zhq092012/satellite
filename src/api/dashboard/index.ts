import type { Satellite, SatelliteDetail, SatelliteInfo, SatelliteTle, StepSatellite } from '@/types/cesium/satellite'
import type { BattleForm, SatelliteNode, SatelliteRelation, SatelliteStrike, SatelliteThreat, SceneConfig, TaskForm, TLEDataResponse, Weapon } from '@/types/dashboard'
import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import type { Strike, StrikeV2 } from '@/types/strike'
import type { ThreatTaskWeightsResponse } from '@/types/threat'
import {
  normalizeTaskListFromApi,
  prepareTaskForBattleApi,
  type TaskListItemFromApiError,
} from '@/utils/c2TaskPanelEditor'
import { requestAPI } from '@/utils/tools/httpClient'

/**
 * 获取首页所有卫星轨道数据
 * @returns
 */
export const getHomeSatellite = (pageNum: number, pageSize: number) => {
  let url = `/api/satellite/home/page?pageNum=${pageNum}&pageSize=${pageSize}`

  return requestAPI.get<AxiosResponsePage<SatelliteInfo[]>>(url)
}
/** 星座资料中的时间，按年、月、日、时、分、秒及可选的后续分量排列 */
type SatelliteConstellationTimestamp = [number, number, number, number, number, number, ...number[]]

/** 星座资料，含轨道配置、运营方和爬虫来源。 */
export interface SatelliteConstellation {
  /** 文档 ID */
  _id: string
  /** 星座业务 ID */
  id: string
  /** 星座资料来源地址 */
  url: string
  /** 星座名称 */
  name: string
  /** 星座类型 */
  type: string
  /** 星座描述 */
  description: string
  /** 中文名称 */
  chineseName: string
  /** 英文名称 */
  englishName: string
  /** 星座构型 */
  constellationConfig: string
  /** 星座功能 */
  constellationFunction: string
  /** 轨道类型 */
  orbitType: string
  /** 运营方 */
  operator: string
  /** 建设状态 */
  constructionStatus: string
  /** 国家或地区 */
  country: string
  /** 技术能力 */
  technicalCapability: string
  /** 相似星座 */
  similarConstellations: string[]
  /** 经济社会价值 */
  economicSocialValue: string
  /** 星座包含的卫星 NORAD 编号 */
  noradIds: number[]
  /** 解析时间，按年、月、日、时、分、秒及可选分量排列 */
  parseTime: SatelliteConstellationTimestamp
  /** 解析器名称 */
  parser: string
  /** 解析器版本 */
  parserVersion: string
  /** 国家分类编码 */
  nationCategory: number
  /** 爬取时间，按年、月、日、时、分、秒及可选分量排列 */
  crawlerTime: SatelliteConstellationTimestamp
  /** 来源网页地址 */
  netUrl: string
  /** 来源站点名称 */
  netName: string
  /** 来源站点中文名 */
  netNameZh: string
  /** 来源站点国家 */
  netNation: string
  /** 来源站点语言 */
  netLanguage: string
  /** 来源频道名称 */
  channelName: string
  /** 来源频道地址 */
  channelUrl: string
  /** 来源频道描述 */
  channelDesc: string
  /** 数据来源标识 */
  dataSource: string
  /** 数据源 IP */
  dataSourceIp: string
  /** 数据源主机名 */
  dataSourceHostname: string
  /** 原始描述文本 */
  descriptionOrigin: string
  /** 采集蜘蛛标记 */
  dataSourceJdSpider: number
  /** 主机分区编号 */
  ziHost: number
  /** 区域分区编号 */
  ziZone: number
  /** 记录创建时间，按年、月、日、时、分、秒及可选分量排列 */
  createTime: SatelliteConstellationTimestamp
  /** 记录更新时间，按年、月、日、时、分、秒及可选分量排列 */
  updateTime: SatelliteConstellationTimestamp
  /** 数据变更类型 */
  dataChangeType: string
  /** 更新次数 */
  updateCounts: number
  /** 同步状态 */
  synStatus: null
}
/** 查询所有星座 */
export const getSatelliteConstellations = () => {
  const url = `/api/satellite/constellation/query`
  return requestAPI.post<AxiosResponseType<SatelliteConstellation[]>>(url)
}

/**
 * 获取首页所有卫星列表数据
 * @returns
 */
export const getSatelliteList = (
  pageNum: number,
  pageSize: number,
  norad?: number,
  taskId?: number,
  name_en?: string,
  country?: string,
  orbit_status?: number,
  orbit_type?: number,
  payload_status?: number,
  sat_type?: string,
  orderField?: string,
  order?: 'asc' | 'desc'
) => {
  let url = `/api/satellite/list/page?pageNum=${pageNum}&pageSize=${pageSize}`

  if (norad !== undefined) {
    url += `&norad=${norad}`
  }

  if (taskId !== undefined) {
    url += `&taskId=${taskId}`
  }
  if (name_en !== undefined) {
    url += `&name_en=${name_en}`
  }
  if (country !== undefined) {
    url += `&country=${country}`
  }
  if (orbit_status !== undefined) {
    url += `&orbit_status=${orbit_status}`
  }
  if (orbit_type !== undefined) {
    url += `&orbit_type=${orbit_type}`
  }
  if (payload_status !== undefined) {
    url += `&payload_status=${payload_status}`
  }
  if (sat_type !== undefined) {
    url += `&sat_type=${sat_type}`
  }
  if (orderField !== undefined) {
    url += `&orderField=${orderField}`
  }
  if (order !== undefined) {
    url += `&order=${order}`
  }
  return requestAPI.get<AxiosResponsePage<Satellite[]>>(url)
}
/**
 * 获取卫星详情数据
 * @returns
 */
export const getSatelliteDetail = (data: { norad: number }) => {
  const url = `/api/satellite/satellite/param`
  return requestAPI.post<AxiosResponseType<SatelliteDetail>>(url, data)
}

/**
 * 新增战场
 * @param battle
 */
export const saveBattle = (battle: BattleForm) => {
  const url = `/api/battle/save`
  return requestAPI.post<AxiosResponseType<any>>(url, battle)
}
/**
 * 更新战场
 * @param battle
 */
export const updateBattle = (battle: BattleForm) => {
  const url = `/api/battle/update`
  return requestAPI.put<AxiosResponseType<any>>(url, battle)
}
/**
 * 删除战场
 * @param battle
 */
export const deleteBattle = (battleId: number) => {
  const url = `/api/battle/del/${battleId}`
  return requestAPI.delete<AxiosResponseType<any>>(url)
}
/**
 * 新增任务
 * @param battle
 */
export const createTask = (task: TaskForm) => {
  const url = `/api/battle/saveTask`
  return requestAPI.post<AxiosResponseType<any>>(url, prepareTaskForBattleApi(task))
}

/**
 * 查询当前任务后台计算进度（HTTP 快照，进度实时推送已改用 WebSocket）。
 * @param taskId 任务 ID
 */
export const queryTaskProgress = (taskId: number) => {
  const url = `/api/battle/algorithmStatus?taskId=${taskId}`
  return requestAPI.get<
    AxiosResponseType<{
      get_id: string
      taskId: number
      totalStatus: string
      transitStatus: string
      threatAndStrikeStatus: string
      mes: string
    }>
  >(url)
}
/**
 * 更新任务
 * @param battle
 */
export const updateTask = (task: TaskForm) => {
  const url = `/api/battle/updateTask`
  return requestAPI.put<AxiosResponseType<any>>(url, prepareTaskForBattleApi(task))
}
/**
 * 删除任务
 * @param battle
 */
export const deleteTask = (taskId: number) => {
  const url = `/api/battle/delTask/${taskId}`
  return requestAPI.delete<AxiosResponseType<any>>(url)
}
/**
 * 战场列表
 * @param battle
 */
export const getBattleList = () => {
  const url = `/api/battle/list`
  return requestAPI.get<AxiosResponseType<BattleForm[]>>(url)
}
/** getTaskList 附加：接口字段校验失败列表（不会写入默认数据） */
export type TaskListApiResponse = AxiosResponseType<TaskForm[]> & {
  /** 任务列表字段校验失败项。出现时表示对应任务数据不合法，不会写入默认值 */
  taskListValidationErrors?: TaskListItemFromApiError[]
  /** @deprecated 使用 taskListValidationErrors */
  combatAreaErrors?: TaskListItemFromApiError[]
}

/**
 * 查询战场下的任务列表，并校验接口返回的任务字段。
 * @param battleId 战场 ID
 * @returns 任务列表。字段不合法时附带 taskListValidationErrors，不会用默认值补齐
 */
export const getTaskList = async (battleId: number): Promise<TaskListApiResponse> => {
  const url = `/api/battle/taskList?battleId=${battleId}`
  const res = await requestAPI.get<TaskListApiResponse>(url)
  if (res.code === 200 && Array.isArray(res.data)) {
    const { tasks, errors } = normalizeTaskListFromApi(res.data)
    res.data = tasks
    if (errors.length) {
      res.taskListValidationErrors = errors
      res.combatAreaErrors = errors
    }
  }
  return res
}
/**
 * 根据任务Id获取TLE数据
 * @returns
 */
export const getTLEDataByTaskId = (taskId: number) => {
  const url = `/api/battle/tleByTaskId?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<TLEDataResponse>>(url)
}
/**
 * 获取卫星统计数据
 * @returns
 */
export const getSatelliteCount = () => {
  const url = `/api/battle/count`
  return requestAPI.get<AxiosResponseType<{ count: number; days: number; healthScore: number }>>(url)
}
/**
 * 获取卫星TLE数据
 * @param data
 * @returns
 */
export const getSatelliteTLEData = (data: { norads: string | number[] }) => {
  const url = `/api/satellite/satellite/tle`
  return requestAPI.post<AxiosResponseType<{ noradId: number; satelliteTleResp: SatelliteTle }[]>>(url, data)
}
/**
 * 获取任务相关的卫星之间的关系
 * @param taskId
 * @returns
 */
export const getSatelliteRelations = (taskId: number) => {
  let url = `/api/battle/netView?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<{ nodes: SatelliteNode[]; relationships: SatelliteRelation[] }>>(url)
}
/**
 * 获取任务相关的卫星之间的关系（单颗卫星）
 * @param taskId
 * @returns
 */
export const getSatelliteRelationsBySatellite = (noradId: number, taskId?: number) => {
  let url = `/api/battle/netView/norad?noradId=${noradId}`
  if (taskId) {
    url += `&taskId=${taskId}`
  }
  return requestAPI.get<AxiosResponseType<{ nodes: SatelliteNode[]; relationships: SatelliteRelation[] }>>(url)
}
/**
 * 查询任务威胁权重
 * @param taskId
 * @returns
 */
export const queryTaskThreatWeight = (taskId: number, stage?: string | null) => {
  let url = `/api/battle/queryTaskThreatWeight?taskId=${taskId}`
  if (stage) {
    url += `&stage=${stage}`
  }
  return requestAPI.get<AxiosResponseType<string>>(url, undefined, undefined, { hasLoading: true })
}
/**
 * 保存任务威胁权重
 * @param data
 * @returns
 */
export const saveTaskThreatWeight = (data: {
  scene_id: string
  weights: Record<string, any>
  stage?: string
  scope?: string
}) => {
  const url = `/api/battle/saveTaskThreatWeight`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}
/**
 * 获取卫星关系下拉框
 * @returns
 */
export const getSatelliteRelationTypes = () => {
  const url = `/api/battle/netViewSelect`
  return requestAPI.get<AxiosResponseType<string[]>>(url)
}

/**
 * 威胁卫星数量统计
 * @param taskId
 * @returns
 */
export const threatStatisticsCount = (taskId: number) => {
  const url = `/api/battle/threatStatistics?taskId=${taskId}`
  return requestAPI.get<
    AxiosResponseType<{
      days: number
      unitCount: number
      highThreatCount: number
      avgScore: number
    }>
  >(url)
}
/**
 * 卫星威胁等级分布
 * @param taskId
 * @returns
 */
export const threatLevelAnalysis = (taskId: number, noradId?: number, country?: string) => {
  let url = `/api/battle/threatLevel?taskId=${taskId}`
  if (noradId) {
    url += `&noradId=${noradId}`
  }
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponseType<Record<string, number>>>(url)
}
/**
 * 高威胁卫星数量变化
 * @param taskId
 * @returns
 */
export const highThreatAnalysis = (taskId: number, noradId?: number, country?: string) => {
  let url = `/api/battle/highThreat?taskId=${taskId}`
  if (noradId) {
    url += `&noradId=${noradId}`
  }
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponseType<{ date: string; count: number }[]>>(url)
}
/**
 * 卫星平均威胁趋势
 * @param taskId
 * @returns
 */
export const avgThreatAnalysis = (taskId: number, noradId?: number, country?: string) => {
  let url = `/api/battle/avgThreat?taskId=${taskId}`
  if (noradId) {
    url += `&noradId=${noradId}`
  }
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponseType<{ date: string; avgThreatScore: number }[]>>(url)
}
/**
 * 卫星威胁波动性
 * @param taskId
 * @returns
 */
export const variationThreatAnalysis = (taskId: number, country?: string) => {
  let url = `/api/battle/variationThreat?taskId=${taskId}`
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponseType<{ date: string; variation: number }[]>>(url)
}
/**
 * 计算威胁度(自定义时间段)
 * @param taskId
 * @param beginDate
 * @param endData
 * @returns
 */
export const calThreatAnalysis = (taskId: number, beginDate: string, endData: string) => {
  const url = `/api/battle/calThreat?taskId=${taskId}&beginDate=${beginDate}&endDate=${endData}`
  return requestAPI.get<AxiosResponseType<any>>(url)
}
/**
 *  计算威胁度(整个任务生命周期内)
 * @param taskId
 * @returns
 */
export const calThreatAnalysisOfTask = (taskId: number) => {
  const url = `/api/battle/rank?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<any>>(url)
}
/**
 * 计算威胁度(任务某个阶段)
 * @param taskId
 * @param startTime
 * @param endTime
 * @param label
 * @returns
 */
export const calThreatAnalysisOfTaskStep = (taskId: number, startTime: string, endTime: string, label?: string) => {
  let url = `/api/battle/rankStep?taskId=${taskId}&startTime=${startTime}&endTime=${endTime}`
  if (label) {
    url += `&label=${label}`
  }
  return requestAPI.get<AxiosResponseType<any>>(url)
}
/**
 * 获取卫星威胁度列表
 * @param taskId
 * @param pageNum
 * @param pageSize
 * @param systemName
 * @param orbitType
 * @param noradId
 * @returns
 */
export const getAllThreatList = (
  taskId: number,
  pageNum: number,
  pageSize: number,
  systemName?: string,
  orbitType?: string,
  noradId?: number
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
 *  获取当前威胁卫星列表
 * @param taskId
 * @param stepName
 * @param systemName
 * @param orbitType
 * @param noradId
 * @param pageNum
 * @param pageSize
 * @returns
 */
export const getCurrentThreatList = (
  taskId: number,
  stepName: string,
  systemName: string,
  orbitType: string,
  noradId: number | undefined,
  pageNum: number,
  pageSize: number
) => {
  let url = `/api/battle/threatTaskStepList?taskId=${taskId}&stepName=${stepName}&systemName=${systemName}&orbitType=${orbitType}`
  if (orbitType === '全部') {
    url = `/api/battle/threatTaskStepList?taskId=${taskId}&stepName=${stepName}&systemName=${systemName}`
  }
  if (noradId) {
    url += `&noradId=${noradId}`
  }

  url += `&pageNum=${pageNum}&pageSize=${pageSize}`
  return requestAPI.get<AxiosResponsePage<ThreatTaskWeightsResponse[]>>(url)
}
/**
 * 重置所有威胁权重
 * @param taskId
 * @param sysName
 * @returns
 */
export const resetAllThreatWeights = (taskId: number, stage?: string) => {
  let url = `/api/battle/resetAllTaskThreatWeight?taskId=${taskId}`
  if (stage) {
    url += `&stage=${stage}`
  }
  return requestAPI.get<AxiosResponseType<any>>(url)
}
/**
 *  重置当前威胁权重
 * @param taskId
 * @param sysName
 * @returns
 */
export const resetCurrentThreatWeights = (taskId: number, sysName: string, stage?: string) => {
  let url = `/api/battle/resetSysTaskThreatWeight?taskId=${taskId}&sysName=${encodeURIComponent(sysName)}`
  if (stage) {
    url += `&stage=${stage}`
  }
  return requestAPI.get<AxiosResponseType<any>>(url)
}
/**
 * 建议
 * @param taskId
 * @returns
 */
export const getSuggestionOfTask = (taskId: number) => {
  const url = `/api/battle/threatSuggestion?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<string>>(url)
}
/**
 * 可打击度分析
 * @param taskId
 * @returns
 */
export const gettargetStrike = (taskId: number) => {
  const url = `/api/battle/targetStrike?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<{ strikeDegree: number; threatDegree: number; days: number }>>(url)
}
/**
 * 保存配置
 * @param data
 * @returns
 */
export const saveSceneConfig = (data: SceneConfig) => {
  const url = `/api/battle/saveSceneConfig`
  return requestAPI.post<AxiosResponseType<unknown>>(url, data)
}
/**
 * 获取配置
 * @param taskId
 * @returns
 */
export const getSceneConfig = (taskId: number) => {
  const url = `/api/battle/sceneConfigById?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<SceneConfig>>(url)
}
/**
 * 获取武器列表
 * @returns
 */
export const getWeapons = () => {
  const url = `/api/battle/weaponList`
  return requestAPI.get<AxiosResponseType<Weapon[]>>(url)
}
/**
 * 卫星可打击度列表
 * @param taskId
 * @param pageNum
 * @param pageSize
 * @returns
 */
export const getStrikeSatellites = (taskId: number, pageNum: number, pageSize: number, weaponName?: string) => {
  let url = `/api/battle/strikeList?taskId=${taskId}&pageNum=${pageNum}&pageSize=${pageSize}`
  if (weaponName) {
    url += `&weaponName=${weaponName}`
  }
  return requestAPI.get<AxiosResponsePage<SatelliteStrike[]>>(url)
}
/**
 * 获取所有卫星可打击度列表
 * @param pageNum
 * @param pageSize
 * @returns
 */
export const getAllStrikeSatellites = (pageNum: number, pageSize: number) => {
  let url = `/api/battle/strikeBatchList?pageNum=${pageNum}&pageSize=${pageSize}`
  return requestAPI.get<AxiosResponsePage<SatelliteStrike[]>>(url)
}
/**
 * 卫星威胁度列表
 * @param taskId
 * @param pageNum
 * @param pageSize
 * @param noradId
 * @param country
 * @returns
 */
export const getSatelliteThreatList = (
  taskId: number,
  pageNum: number,
  pageSize: number,
  noradId?: number,
  country?: string
) => {
  let url = `/api/battle/threatList?taskId=${taskId}&pageNum=${pageNum}&pageSize=${pageSize}`
  if (noradId) {
    url += `&noradId=${noradId}`
  }
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponsePage<SatelliteThreat[]>>(url)
}
/**
 * 获取所有的武器列表
 * @returns
 */
export const getAllWeapons = () => {
  const url = `/api/battle/weaponList/v2`
  return requestAPI.get<AxiosResponseType<{ weapons: Weapon[] }>>(url)
}
/**
 * 获取所有的武器列表
 * @returns
 */
export const getAllWeaponsWithName = () => {
  const url = `/api/battle/weaponNames`
  return requestAPI.get<AxiosResponseType<{ weapons: { id: string; name: string }[] }>>(url)
}
/**
 * 获取任务下的武器列表
 * @returns
 */
export const getTaskWeapons = (taskId: number, country?: string[]) => {
  let url = `/api/battle/taskWeaponList?taskId=${taskId}`
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponseType<{ scenario_id: string; scenario_name: string; weapons: Weapon[] }>>(
    url,
    undefined,
    undefined,
    {
      hasLoading: true,
    }
  )
}
/**
 * 获取武器场景列表
 * @returns
 */
export const getWeaponsWeight = () => {
  const url = `/api/battle/queryWeights`
  return requestAPI.get<AxiosResponseType<string>>(url)
}
/**
 * 获取武器场景列表
 * @returns
 */
export const setWeaponsWeight = (data: { W_VIS: number; W_INFO: number; W_WEAPON: number }) => {
  const url = `/api/battle/setWeights`
  return requestAPI.post<AxiosResponseType<unknown>>(url, data)
}
/**
 * 删除武器
 * @param id
 * @returns
 */
export const deleteWeapon = (id: string) => {
  const url = `/api/battle/weapon/${id}`
  return requestAPI.delete<AxiosResponseType<any>>(url)
}
/**
 * 新增武器
 * @param weapon
 * @returns
 */
export const createWeapon = (weapon: Weapon) => {
  const url = `/api/battle/addWeapon`
  return requestAPI.post<AxiosResponseType<any>>(url, weapon)
}

/**
 * 更新武器
 * @param weapon
 * @returns
 */
export const updateWeapon = (weapon: Weapon) => {
  const url = `/api/battle/addWeapon`
  return requestAPI.post<AxiosResponseType<any>>(url, weapon)
}
/**
 * 设置武器权重
 */
export const setWeaponWeight = (data: { id: number | undefined; weights: Record<string, number> }) => {
  const url = `/api/battle/configWeaponSceneWeight`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}
/**
 * 获取任务下的武器权重
 * @param taskId
 * @returns
 */
export const getWeaponWeightOfTask = (taskId: number | undefined) => {
  const url = `/api/battle/weaponWeightByScene?taskId=${taskId}`
  return requestAPI.get<
    AxiosResponseType<{
      id: string
      name: string
      location: string
      latitude: number
      longitude: number
      weights: Record<string, number>
      task_time: [
        {
          start: string
          end: string
        },
      ]
    }>
  >(url)
}
/**
 * 更新可打击度
 * @param taskId
 * @returns
 */
export const updateStrikeOfTask = (
  taskId: number | undefined,
  weaponNames: string,
  startTime: string,
  endTime: string
) => {
  let url = `/api/battle/updateStrike?taskId=${taskId}`
  if (weaponNames) {
    url += `&weaponNames=${weaponNames}`
  }
  if (startTime) {
    url += `&startTime=${startTime}`
  }
  if (endTime) {
    url += `&endTime=${endTime}`
  }
  return requestAPI.get<AxiosResponseType<Strike[]>>(url)
}
/**
 * 更新可打击度
 * @param taskId
 * @returns
 */
export const updateStrikeOfTaskV2 = (taskId: number | undefined, norad?: number) => {
  let url = `/api/battle/updateStrike/v2?taskId=${taskId}`
  if (norad) {
    url += `&norad=${norad}`
  }
  return requestAPI.get<AxiosResponseType<StrikeV2>>(url)
}
/**
 * 战场所有卫星类型
 * @returns
 */
export const getBattleSateTypes = () => {
  const url = `/api/battle/satType`
  return requestAPI.get<AxiosResponseType<string[]>>(url)
}
/**
 * 战场所有国家
 * @returns
 */
export const getBattleCountrys = () => {
  const url = `/api/battle/country`
  return requestAPI.get<AxiosResponseType<string[]>>(url)
}

/**
 * 任务下推荐的卫星和国家
 * @param taskName
 * @param battleId
 * @returns
 */
export const getSuggestionSateAndCountry = (taskName: string | undefined, battleId: number | undefined) => {
  const url = `/api/battle/suggestType?taskName=${taskName}&battleId=${battleId}`
  return requestAPI.get<
    AxiosResponseType<{
      analysis: {
        filters: {
          satelliteTypes: string[]
          countries: string[]
        }
      }
    }>
  >(url)
}

/**
 * 作战阶段过境卫星
 */
export const getBattleSegmentSatellites = (taskId: number | undefined, stepName?: string, country?: string[]) => {
  let url = `/api/battle/gjSteps?taskId=${taskId}`
  if (stepName) {
    url += `&stepName=${stepName}`
  }
  if (country) {
    url += `&country=${country}`
  }
  return requestAPI.get<AxiosResponseType<StepSatellite[]>>(url)
}

// 获取卫星的tle数据（画像展示）
export const getSatelliteTlePages = (data: { norads: number[]; pageNum: number; pageSize: number }) => {
  const url = `/api/satellite/satellite/tle/page`
  return requestAPI.post<AxiosResponsePage<SatelliteTle[]>>(url, data)
}

/** 卫星按五大类型、国家、轨道、在轨状态和载荷状态的分布统计。 */
export type SatelliteDistribution = {
  /** 按五大卫星类型统计的数量 */
  typeMap: {
    /** 侦察类卫星数量 */
    侦察: number
    /** 导航类卫星数量 */
    导航: number
    /** 通信类卫星数量 */
    通信: number
    /** 导弹预警类卫星数量 */
    导弹预警: number
    /** 太空目标监视与攻防类卫星数量 */
    太空目标监视与攻防: number
  }
  /** 按国家统计的卫星数量 */
  countryList: {
    /** 分组键：国家名称。空值表示未标注国家 */
    _id: string | null
    /** 该分组的卫星数量 */
    count: number
  }[]
  /** 按轨道类型统计的卫星数量 */
  orbitTypeList: {
    /** 分组键：轨道类型。空值表示未标注 */
    _id: string | null
    /** 该分组的卫星数量 */
    count: number
  }[]
  /** 按在轨状态统计的卫星数量 */
  orbitStatusList: {
    /** 分组键：在轨状态。空值表示未标注 */
    _id: string | null
    /** 该分组的卫星数量 */
    count: number
  }[]
  /** 按载荷状态统计的卫星数量 */
  payloadStatusList: {
    /** 分组键：载荷状态。空值表示未标注 */
    _id: string | null
    /** 该分组的卫星数量 */
    count: number
  }[]
}

// 查询卫星按照国家 五大类 和轨道类型的分布情况
export const getSatelliteDistribution = () => {
  const url = `/api/satellite/situation`
  return requestAPI.get<AxiosResponseType<SatelliteDistribution>>(url)
}
/** 卫星打击窗口。键为窗口标识，值为该窗口的时间字符串列表 */
export type StrikeWindow = Record<string, string[]>
// 获取卫星的打击窗口
export const getStrikeWindowOfSatellite = (taskId: number, noradId: number) => {
  const url = `/api/battle/strikeWindow/norad?taskId=${taskId}&noradId=${noradId}`
  return requestAPI.get<AxiosResponseType<StrikeWindow>>(url)
}
// 查询是否有默认的战场和任务
export const checkDefaultBattleAndTask = () => {
  const url = `/api/battle/focusBattle`
  return requestAPI.get<
    AxiosResponseType<{ battleId: number; taskId: number; battleEntity: BattleForm; battleTaskEntity: TaskForm }>
  >(url)
}
// 态势数据
export type SituationData = {
  /** 红方态势：过境卫星、时长和武器阵地 */
  红方: {
    /** 任务时段内红方过境的卫星数量 */
    红方过境卫星总数: number
    /** 红方卫星过境时长合计 */
    红方卫星过境总时长: number
    /** 红方武器阵地 */
    红方武器阵地列表: {
      /** 阵地 ID */
      id: string
      /** 阵地名称 */
      name: string
      /** 阵地所属国家 */
      country: string
      /** 阵地类型 */
      type: string
      /** 纬度 */
      latitude: number
      /** 经度 */
      longitude: number
      /** 覆盖半径 */
      range: number
      /** 该阵地可作用的卫星类型 */
      satellite_type?: string
    }[]
    /** 按地区统计的红方过境卫星数量 */
    红方各地区过境卫星数量: Record<string, number>
    /** 按卫星类型统计的红方过境卫星数量 */
    红方过境卫星分类数量: Record<string, number>
  }
  /** 蓝方态势：过境卫星、时长和武器阵地 */
  蓝方: {
    /** 任务时段内蓝方过境的卫星数量 */
    蓝方过境卫星总数: number
    /** 蓝方卫星过境时长合计 */
    蓝方卫星过境总时长: number
    /** 蓝方武器阵地 */
    蓝方武器阵地列表: {
      /** 阵地 ID */
      id: string
      /** 阵地名称 */
      name: string
      /** 阵地所属国家 */
      country: string
      /** 阵地类型 */
      type: string
      /** 纬度 */
      latitude: number
      /** 经度 */
      longitude: number
      /** 覆盖半径 */
      range: number
      /** 该阵地可作用的卫星类型 */
      satellite_type?: string
    }[]
    /** 按地区统计的蓝方过境卫星数量 */
    蓝方各地区过境卫星数量: Record<string, number>
    /** 按卫星类型统计的蓝方过境卫星数量 */
    蓝方过境卫星分类数量: Record<string, number>
  }
}

// 获取任务的战场态势数据（比如卫星类型分布、国家分布等）
export const getSituationDataOfTask = (taskId: number) => {
  const url = `/api/battle/taskSituation?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<SituationData>>(url)
}
/** 红蓝对抗统计：武器、卫星数量和平均威胁度。 */
export type RedBlueStatistics = {
  /** 武器数量 */
  weaponNum: number
  /** 按武器类型统计的数量 */
  weaponTypeMap: Record<string, number>
  /** 按地区统计的武器数量 */
  weaponAreaMap: Record<string, number>
  /** 卫星数量 */
  satelliteNum: number
  /** 卫星类型数量 */
  satelliteTypeNum: number
  /** 平均威胁度 */
  avgThreat: number
}
// 查询红蓝对抗统计数据
export const getRedBlueStatistics = (data: { model: string; taskId: number }) => {
  const url = `/api/battle/sideCount`
  return requestAPI.post<AxiosResponseType<RedBlueStatistics>>(url, data)
}
// 乘积模型威胁度
export type ProductThreatModelRow = {
  /** 在全部目标中的排名 */
  全局排名: number
  /** 轨道类型 */
  orbit_type: string
  /** 卫星 NORAD 编号 */
  norad: string
  /** 内部编号 */
  int_id: string
  /** 卫星英文名称 */
  name_en: string
  /** 目标类型 */
  target_type: string
  /** 在轨状态 */
  orbit_status: string
  /** 载荷状态 */
  payload_status: string
  /** 卫星载荷类型 */
  sat_type: string
  /** 国家或地区 */
  country: string
  /** 国别对威胁分的影响因子 */
  国别因子: number
  /** 过境频次 */
  'Pass frequency': number
  /** 星下点经度（度）。无数据时为空 */
  'Subpoint longitude (deg)': number | null
  /** 可见性对威胁分的影响因子 */
  可见性因子: number
  /** 卫星发射年份 */
  发射年份: number
  /** 发射时间对威胁分的影响因子 */
  发射时间因子: number
  /** 综合威胁分数 */
  综合威胁分数: number
  /** 威胁指数，范围 0 到 100 */
  '威胁指数(0-100)': number
  /** 威胁等级 */
  威胁等级: string
}

/** 某一卫星类型下的乘积模型威胁度结果。 */
export type ProductThreatModelDataset = {
  /** 数量 */
  count: number
  /** 威胁度明细 */
  rows: ProductThreatModelRow[]
}

/** 乘积模型威胁度排名的完整响应。 */
export type ProductThreatModelResponse = {
  /** 威胁模型名称 */
  model: string
  /** 计算使用的当前年份 */
  current_year: number
  /** 目标经度（度） */
  target_longitude_deg: number
  /** 重点国家 */
  key_countries: string[]
  /** 重点国家因子 */
  key_country_factor: number
  /** 其他国家因子 */
  other_country_factor: number
  /** 按卫星类型分组的威胁度结果 */
  results: {
    /** 导航类威胁数据集 */
    navigation: ProductThreatModelDataset
    /** 通信类威胁数据集 */
    communication: ProductThreatModelDataset
    /** 导弹预警类威胁数据集 */
    missile_early_warning: ProductThreatModelDataset
    /** 侦察类威胁数据集 */
    reconnaissance: ProductThreatModelDataset
  }
  /** 警告信息 */
  warnings: string[]
}

/**
 * 按乘积模型计算卫星威胁度排名。
 * @param data 任务、重点国家及因子、目标经度
 * @returns 按导航、通信、导弹预警、侦察分类的威胁度排名
 */
export const getThreatByProductModel = (data: {
  taskId: number
  key_countries: string[]
  key_country_factor: number
  other_country_factor: number
  target_longitude_deg: number
}) => {
  const url = `/api/battle/rankProduct`
  return requestAPI.post<AxiosResponseType<ProductThreatModelResponse>>(url, data)
}


//1、任务阶段目标下拉框接口
export const getTaskStageTargetOptions = () => {
  const url = `/api/algorithm/phaseTargetList`
  return requestAPI.get<AxiosResponseType<string[]>>(url)
}

/** 作战阶段及其对应的方案烈度。 */
export interface PhaseIntensity {
  /** 作战阶段名称 */
  stepName: string
  /** 阶段目标 */
  stepTarget: string
  /** 阶段开始时间 */
  startTime: string
  /** 阶段结束时间 */
  endTime: string
  /** 打击烈度 */
  intensityLevel: string
}

//2、查询阶段对应的方案烈度（作用：展示哪些烈度）
export const getTaskStageIntensityOptions = (taskId: number) => {
  const url = `/api/algorithm/queryStepPlanLevel?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<PhaseIntensity[]>>(url)
}