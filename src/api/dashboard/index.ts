import type { BattleForm, SatelliteNode, SatelliteRelation, SatelliteStrike, SatelliteThreat, SceneConfig, TaskForm, TLEDataResponse, Weapon } from '@/types/dashboard'
import type { AxiosResponsePage, AxiosResponseType } from '@/types/http'
import type { Strike, StrikeV2 } from '@/types/strike'
import type { ThreatTaskWeightsResponse } from '@/types/threat'
import { requestAPI } from '@/utils/http/request'

/**
 * 获取首页所有卫星轨道数据
 * @returns
 */
export const getHomeSatellite = (pageNum: number, pageSize: number) => {
  let url = `/api/satellite/home/page?pageNum=${pageNum}&pageSize=${pageSize}`

  return requestAPI.get<AxiosResponsePage<SatelliteInfo[]>>(url)
}
// 星座数据
type SatelliteConstellationTimestamp = [number, number, number, number, number, number, ...number[]]

export interface SatelliteConstellation {
  _id: string
  id: string
  url: string
  name: string
  type: string
  description: string
  chineseName: string
  englishName: string
  constellationConfig: string
  constellationFunction: string
  orbitType: string
  operator: string
  constructionStatus: string
  country: string
  technicalCapability: string
  similarConstellations: string[]
  economicSocialValue: string
  noradIds: number[]
  parseTime: SatelliteConstellationTimestamp
  parser: string
  parserVersion: string
  nationCategory: number
  crawlerTime: SatelliteConstellationTimestamp
  netUrl: string
  netName: string
  netNameZh: string
  netNation: string
  netLanguage: string
  channelName: string
  channelUrl: string
  channelDesc: string
  dataSource: string
  dataSourceIp: string
  dataSourceHostname: string
  descriptionOrigin: string
  dataSourceJdSpider: number
  ziHost: number
  ziZone: number
  createTime: SatelliteConstellationTimestamp
  updateTime: SatelliteConstellationTimestamp
  dataChangeType: string
  updateCounts: number
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
  return requestAPI.post<AxiosResponseType<any>>(url, task)
}

/**
 * 查询当前任务后台计算进度
 * @param taskId
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
  return requestAPI.put<AxiosResponseType<any>>(url, task)
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
/**
 * 任务列表
 * @param battle
 */
export const getTaskList = (battleId: number) => {
  const url = `/api/battle/taskList?battleId=${battleId}`
  return requestAPI.get<AxiosResponseType<TaskForm[]>>(url)
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

export type SatelliteDistribution = {
  typeMap: {
    侦察: number
    导航: number
    通信: number
    导弹预警: number
    太空目标监视与攻防: number
  }
  countryList: {
    _id: string | null
    count: number
  }[]
  orbitTypeList: {
    _id: string | null
    count: number
  }[]
  orbitStatusList: {
    _id: string | null
    count: number
  }[]
  payloadStatusList: {
    _id: string | null
    count: number
  }[]
}

// 查询卫星按照国家 五大类 和轨道类型的分布情况
export const getSatelliteDistribution = () => {
  const url = `/api/satellite/situation`
  return requestAPI.get<AxiosResponseType<SatelliteDistribution>>(url)
}
/**
 * 获取卫星的打击窗口
 */
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
// 设置任务为关注任务
export const setDefaultTask = (focusStatus: number, taskId: number) => {
  const url = `/api/battle/setTaskFocus?focusStatus=${focusStatus}&taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<any>>(url)
}
// 态势数据
export type SituationData = {
  红方: {
    红方过境卫星总数: number
    红方卫星过境总时长: number
    红方武器阵地列表: {
      id: string
      name: string
      country: string
      type: string
      latitude: number
      longitude: number
      range: number
      satellite_type?: string
    }[]
    红方各地区过境卫星数量: Record<string, number>
    红方过境卫星分类数量: Record<string, number>
  }
  蓝方: {
    蓝方过境卫星总数: number
    蓝方卫星过境总时长: number
    蓝方武器阵地列表: {
      id: string
      name: string
      country: string
      type: string
      latitude: number
      longitude: number
      range: number
      satellite_type?: string
    }[]
    蓝方各地区过境卫星数量: Record<string, number>
    蓝方过境卫星分类数量: Record<string, number>
  }
}

// 获取任务的战场态势数据（比如卫星类型分布、国家分布等）
export const getSituationDataOfTask = (taskId: number) => {
  const url = `/api/battle/taskSituation?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<SituationData>>(url)
}
export type RedBlueStatistics = {
  weaponNum: number
  weaponTypeMap: Record<string, number>
  weaponAreaMap: Record<string, number>
  satelliteNum: number
  satelliteTypeNum: number
  avgThreat: number
}
// 查询红蓝对抗统计数据
export const getRedBlueStatistics = (data: { model: string; taskId: number }) => {
  const url = `/api/battle/sideCount`
  return requestAPI.post<AxiosResponseType<RedBlueStatistics>>(url, data)
}
// 乘积模型威胁度
export type ProductThreatModelRow = {
  全局排名: number
  orbit_type: string
  norad: string
  int_id: string
  name_en: string
  target_type: string
  orbit_status: string
  payload_status: string
  sat_type: string
  country: string
  国别因子: number
  'Pass frequency': number
  'Subpoint longitude (deg)': number | null
  可见性因子: number
  发射年份: number
  发射时间因子: number
  综合威胁分数: number
  '威胁指数(0-100)': number
  威胁等级: string
}

export type ProductThreatModelDataset = {
  count: number
  rows: ProductThreatModelRow[]
}

export type ProductThreatModelResponse = {
  model: string
  current_year: number
  target_longitude_deg: number
  key_countries: string[]
  key_country_factor: number
  other_country_factor: number
  results: {
    navigation: ProductThreatModelDataset
    communication: ProductThreatModelDataset
    missile_early_warning: ProductThreatModelDataset
    reconnaissance: ProductThreatModelDataset
  }
  warnings: string[]
}

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

export interface PhaseIntensity {
  stepName: string
  stepTarget: string
  startTime: string
  endTime: string
  intensityLevel: string
}

//2、查询阶段对应的方案烈度（作用：展示哪些烈度）
export const getTaskStageIntensityOptions = (taskId: number) => {
  const url = `/api/algorithm/queryStepPlanLevel?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<PhaseIntensity[]>>(url)
}