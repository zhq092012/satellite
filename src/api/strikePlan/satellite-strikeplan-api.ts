import type { StrikePlan } from '@/types/strike'
import type { AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/tools/request'
import type { Weapon } from '@/types/dashboard'
export type GenerateStrikePlanV2Param = {
  taskId: number
  intensityLevel: string
  types: string[]
  weaponNames: string[]
  weaponType?: string
  stationIds?: string[]
  elacWeaponNames?: string[]
  radarIds?: string[]
  missileBaseIds?: string[]
  directedWeaponNames?: string[]
}
export type StationStrikePlanParam = {
  taskId: number
}

export type StrikePlanV2SummaryOverview = {
  input_count: number
  targets_count: number
  assets_count: number
  avg_threat: number
  avg_strike: number
}

export type StrikePlanV2TargetAnalysisItem = {
  index: number
  norad_id: number
  satellite_type: string
  satellite_country: string
  orbit_type: string
  threat: number
}

export type StrikePlanV2AssetConfigItem = {
  weapon_id: string
  weapon_name: string
  weapon_type: string
}
/**
 * 导弹打击卫星时间窗口
 */
export type StrikePlanV2MissionWindowItem = {
  index: number
  weapon_id: string
  weapon_name: string
  window_start: string
  window_end: string
  satellite_id: number
  satellite_type: string
  satellite_country: string
  orbit_type: string
  threat: number
}

export type StrikePlanV2TimeWindow = {
  start: string
  end: string
  range: string
}

export type StrikePlanV2Strategy = {
  plan_type_hint: string
  intensity_hint: string
}

export type StrikePlanV2PlanSummary = {
  overview: StrikePlanV2SummaryOverview
  target_analysis: StrikePlanV2TargetAnalysisItem[]
  asset_config: StrikePlanV2AssetConfigItem[]
  mission_windows: StrikePlanV2MissionWindowItem[]
  time_window: StrikePlanV2TimeWindow
  strategy: StrikePlanV2Strategy
  generated_at: string
}

export type StrikePlanV2Metrics = {
  total_score: number
  total_threat_reduced: number
  targets_count: number
  weapon_type_distribution: Record<string, Record<string, number>>
  time_range: string
}

export type StrikePlanV2PlanDetail = {
  plan_name: string
  intensity: string
  plan_summary: StrikePlanV2PlanSummary
  metrics: StrikePlanV2Metrics
}

export type StrikePlanV2IntensityPlans = {
  threat_first: StrikePlanV2PlanDetail
  max_targets: StrikePlanV2PlanDetail
}

export type StrikePlanV2 = {
  feasible_count: number
  max_window_duration_min: number
  intensity_levels: string[]
  plans: Record<string, StrikePlanV2IntensityPlans>

  stepName: string
  stepTarget: string
  planSummary: string
}

export type StrikePlanV2Extended = StrikePlanV2 & {
  _id: string
  battleId: number
  taskId: number
  name: string
  types: string[]
  userId: number
  version: string
  weaponNames: string[]
  intensityLevel: string
}
export interface DirectdWindow {
  index: number
  weapon_id: string
  weapon_name: string
  window_start: string
  window_end: string
  satellite_id: number
  satellite_type: string
  satellite_country: string
  orbit_type: string
  threat: number
}
export type StationStrikePlanResp = {
  planType: string
  targetStationNum: number
  actualStationNum: number
  avgStrike: number
  maxStrike: number
  totalPrice: number
  missileBases: MissileBase[]
  missileTypes: Record<string, Miss[]>
  stationDetails: StationDetail[]
  strikeList: MissileStrike[]
  planWindowStart: string
  planWindowEnd: string
  directedWindows: DirectdWindow[]

  stepName: string
  stepTarget: string
  planSummary: Record<string, string>
}
export type StationDistanceResp = {
  stationId: string
  stationName: string
  stationCountry: string
  stationType: string
  stationLat: number
  stationLon: number
  distance: number
}
export type MissileBaseEntity = {
  _id: string
  name: string
  latLon: string
  country: string
  deployMissiles: Missile[]
}
export type ElacStrikePlanResp = {
  targetStationNum: number
  actualStationNum: number
  actualChainNum: number
  actualSatelliteNum: number
  elecWeapons: Weapon[]
  strikeList: Strike[]
  planWindowStart: string
  planWindowEnd: string
  stationDetails: StationDetail[]

  stepName: string
  stepTarget: string
  planSummary: Record<string, string>
}
export type Strike = {
  stationId: string
  stationName: string

  weaponId: string
  weaponName: string

  strike: string //可打击度 例: "0.643"
  norad: number
  windows: WindowObj[]
  totalWindowStart: string
  totalWindowEnd: string
}
export type MissileBase = {
  missileBaseId: string
  missileBaseName: string
  latLon: string //Tip:  "24.6780,121.0920"
  country: string
  deployMissiles: Missile[]
}
export type Missile = {
  missileName: string
  _id: string
}
export type Miss = {
  missileId: string
  missileName: string
  country: string
  range: string
  basing: string
  price: number
}
export type StationDetail = {
  stationId: string
  stationName: string
  type: string
  country: string
  location: string
  latLon: string //Tip:  "24.6780,121.0920"
}
export type MissileStrike = {
  id: string
  missileBaseId: string
  missileBaseName: string
  missileBaseCountry: string
  deployMissiles: Missile[]
  missileId: string
  missileName: string
  missileType: string
  missilePrice: number
  stationId: string
  stationName: string
  stationType: string
  stationCountry: string
  stationLocation: string
  distance: number
  range: string
  strike: number
  windows: WindowObj[]
  totalWindowStart: string
  totalWindowEnd: string
}
export type WindowObj = {
  windowStart: string
  windowEnd: string
}
/**
 * 生成打击方案（新结构）
 */
export const generateStrikePlanV2 = (data: GenerateStrikePlanV2Param) => {
  const url = `/api/battle/strikePlanV2`
  return requestAPI.post<AxiosResponseType<StrikePlanV2Extended>>(url, data)
}
/**
 * 生成导弹打击地面站打击方案
 */
export const stationStrikePlan = (data: GenerateStrikePlanV2Param) => {
  const url = `/api/algorithm/stationStrikePlan`
  return requestAPI.post<AxiosResponseType<StationStrikePlanResp[]>>(url, data)
}
/**
 * 战场任务附近3000KM内的蓝方军事基地目标
 */
export const stationQuery = (taskId: number) => {
  const url = `/api/algorithm/stationQuery?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<StationDistanceResp[]>>(url)
}
/**
 * 查询战场任务下的导弹基地列表
 */
export const missileBaseQuery = (taskId: Number) => {
  const url = `/api/algorithm/missileBaseQuery?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<MissileBaseEntity[]>>(url)
}
/**
 * 生成打击方案
 */
export const generateStrikePlan = (data: {
  taskId: number | undefined
  intensityLevel: string
  types: string[]
  weaponNames: string[]
  side: string
}) => {
  let url = `/api/battle/strikePlan`
  return requestAPI.post<AxiosResponseType<StrikePlan>>(url, data)
}

/**
 * 删除打击方案
 */
export const deleteStrikePlanByName = (planNames: string[]) => {
  const url = `/api/battle/delStrikePlan`
  return requestAPI.post<AxiosResponseType<any>>(url, planNames)
}

export type SaveStrikePlanParam = GenerateStrikePlanV2Param & {
  planName: string
  planVersion: string
  side: string
}

/**
 * 保存打击方案
 */
export const saveStrikePlan = (data: SaveStrikePlanParam) => {
  const url = `/api/battle/saveStrikePlan`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}

/**
 * 查询打击方案列表
 */
export const getStrikePlanList = (taskId: number, planName?: string, planVersion?: string) => {
  const url = `/api/battle/queryStrikePlan`
  return requestAPI.post<AxiosResponseType<StrikePlanV2Extended[]>>(url, { taskId, planName, planVersion })
}

/**
 * 根据打击方案名称/版本评估
 */
export const evaluateStrikePlanByName = (
  taskId: number,
  planName: string,
  planVersion: string,
  schemaVersion: string
) => {
  const url = `/api/battle/evaluationPlan?taskId=${taskId}&planName=${encodeURIComponent(planName)}&planVersion=${encodeURIComponent(planVersion)}&schemaVersion=${encodeURIComponent(schemaVersion)}`
  return requestAPI.get<AxiosResponseType<any>>(url)
}
/*==================================打击方案评估相关接口========================================*/
/**
 * 上传schema
 */
export const uploadSchema = (data: { taskId: number; version: string }) => {
  const url = `/api/battle/uploadSchema`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}
export type Schema = {
  version: string
  description: string
  created_at: string
}
/**
 * 列出所有schema
 */
export const listSchemas = () => {
  const url = `/api/battle/schemas`
  return requestAPI.get<
    AxiosResponseType<{
      total: number
      items: Schema[]
    }>
  >(url)
}
type CombatStage = {
  name: string
  name_en: string | null
  description: string | null
  duration_hours: number
}

// 任务配置
export type StageConfig = {
  weights: {
    //各个阶段的权重系数 和必须为1
    missile_warning: number
    navigation: number
    communication: number
    reconnaissance: number
    space_monitor: number
  }
  requirements: {
    //各个卫星的抑制度需求阈值
    missile_warning: number
    navigation: number
    communication: number
    reconnaissance: number
    space_monitor: number
  }
}

export type SchemaDetail = {
  version: string
  description: string
  satellite_types: {
    communication: {
      name: string
      name_en: string | null
      orbit: string | null
      description: string | null
    }
    missile_warning: {
      name: string
      name_en: string | null
      orbit: string | null
      description: string | null
    }
    navigation: {
      name: string
      name_en: string | null
      orbit: string | null
      description: string | null
    }
    reconnaissance: {
      name: string
      name_en: string | null
      orbit: string | null
      description: string | null
    }
    space_monitor: {
      name: string
      name_en: string | null
      orbit: string | null
      description: string | null
    }
  }
  weapon_types: {
    directed: {
      name: string
      name_en: string
      description: string
      unit: string
      constraints: {
        integer_only: boolean
      }
    }
    kinetic: {
      name: string
      name_en: string
      description: string
      unit: string
      constraints: {
        integer_only: boolean
        max_per_target: number
      }
    }
    jammer: {
      name: string
      name_en: string
      description: string
      unit: string
      constraints: {
        integer_only: boolean
      }
    }
  }
  combat_stages: Record<string, CombatStage>
  validation_rules: {
    stage_weights_sum: number
    stage_weights_tolerance: number
    damage_range: {
      max: number
      min: number
    }
    cost_positive: boolean
  }
}
/**
 * 获取指定版本的schema详情
 */
export const getSchemaDetail = (version: string) => {
  const url = `/api/battle/schemaDetail?version=${version}`
  return requestAPI.get<AxiosResponseType<SchemaDetail>>(url)
}
export type EvaluationParameters = {
  schemaVersion: string //使用的schema版本
  weapon_costs: {
    //武器成本
    kinetic: number //动能武器数量
    directed: number //定向能武器数量
    jammer: number //干扰器数量
    space_based: number // 天基武器压制时长
  }
  typical_damage: {
    //典型伤害程度
    missile_warning: {
      //导弹预警
      kinetic: number
      directed: number
      jammer: number
      space_based: number
    }
    navigation: {
      //导航
      kinetic: number
      directed: number
      jammer: number
      space_based: number
    }
    communication: {
      //通信
      kinetic: number
      directed: number
      jammer: number
      space_based: number
    }
    reconnaissance: {
      //侦察
      kinetic: number
      directed: number
      jammer: number
      space_based: number
    }
    space_monitor: {
      //空间监测
      kinetic: number //动能武器对空间监测卫星的典型伤害程度
      directed: number //定向能武器对空间监测卫星的典型伤害程度
      jammer: number //干扰器对空间监测卫星的典型伤害程度
      space_based: number // 天基武器压制时长
    }
  }
  duration_rules: {
    kinetic: number //动能武器压制时长
    jammer: number //干扰武器压制时长
    directed: number //定向能武器对低轨卫星的压制时长
    space_based: number // 天基武器压制时长
  }

  task_config: StageConfig | undefined //作战阶段配置
}
/**
 * 设置打击方案评估参数
 */
export const setEvaluationParameters = (data: EvaluationParameters) => {
  const url = `/api/battle/evaluationConfig`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}
type EvaluationParam = {
  taskId: number
  intensityLevel: string
  weaponNames: string[]
  schemaVersion: string
}

/**
 * 获取配置信息
 */
export const getEvaluationConfig = (version: string) => {
  const url = `/api/battle/getEvaluationConfig?version=${version}`
  return requestAPI.get<AxiosResponseType<EvaluationParameters>>(url)
}

export type EvaluationResultData = {
  summary: {
    MSI: number
    DPI: number
    MCI: number
    RER: number
    total_cost: number
    is_feasible: boolean
  }
  details: {
    D_values: {
      communication: number
      space_monitor: number
      navigation: number
      reconnaissance: number
      missile_warning: number
    }
    T_values: {
      communication: number
      space_monitor: number
      navigation: number
      reconnaissance: number
      missile_warning: number
    }
  }
  validation: {
    is_valid: boolean
    errors: string[]
    warnings: string[]
  }
  analysis: {
    summary: string
    overall_status: string
    details: string[]
    suggestions: string[]
    risks: string[]
  }
}

export type EvaluationResultItem = {
  success: true
  request_id: string
  timestamp: string
  schema_version: string
  data: EvaluationResultData
}

export type EvaluationResult = Record<string, EvaluationResultItem>

/**
 * 打击方案评估
 */
export const evaluateStrikePlan = (data: EvaluationParam) => {
  const url = `/api/battle/evaluation`
  return requestAPI.post<AxiosResponseType<EvaluationResult>>(url, data)
}
export interface SaveKillChainStrikePlanParam {
  taskId: number
  intensityLevel: string
  weaponNames: string[]
  types: string[]
  side: string
  weaponTypes?: string[]
  missileBaseIds: string[]
  stationIds: string[]
  directedWeaponNames: string[]
  elacWeaponNames: string[]
  radarIds: string[]
  planName: string
  planVersion: string
}
export interface Station {
  country: string
  latLon: string
  location: string
  stationId: string
  stationName: string
  type: string
}

export interface RespKillChainPlanLow {
  _id: string
  name: string
  version: string
  intensityLevel: string
  types: null | string[]
  weaponNames: null | string[]
  missileBaseIds: null | string[]
  stationIds: null | string[]
  elacWeaponNames: string[]
  radarIds: string[]
  taskId: number
  battleId: number
  userId: number
  plan: {
    actualChainNum: number
    actualSatelliteNum: number
    actualStationNum: number
    elecWeapons: Weapon[]
    planWindowEnd: string
    planWindowStart: string
    stationDetails: StationDetail[]
    strikeList: Strike[]
    targetStationNum: number
  }[]
  stepName: string
  stepTarget: string
  planSummary: string
}

export interface Strike2 {
  deployMissiles: {
    _id: string
    missileName: string
  }[]
  distance: string
  id: string
  missileBaseCountry: string
  missileBaseId: string
  missileBaseLatLon: string
  missileBaseName: string
  missileBasing: string
  missileCountry: string
  missileId: string
  missileName: string
  missilePrice: string
  missileRange: string
  missileType: string
  range: string
  stationCountry: string
  stationId: string
  stationLatLon: string
  stationLocation: string
  stationName: string
  stationType: string
  strike: string
  totalWindowEnd: string
  totalWindowStart: string
  windows: {
    windowEnd: string
    windowStart: string
  }[]
}
export type middlePlanType = '饱和式打击' | '成本最低' | '突防最强'
export interface RespKillChainPlanMiddle {
  _id: string
  name: string
  version: string
  intensityLevel: string | null
  types: string[] | null
  weaponNames: string[] | null
  missileBaseIds: string[]
  stationIds: string[]
  elacWeaponNames: string[] | null
  radarIds: string[] | null
  taskId: number
  battleId: number
  userId: number
  plan: {
    actualStationNum: number
    avgStrike: string
    directedWindows: StrikePlanV2MissionWindowItem[]//中烈度特有的定向能武器针对卫星的打击时间窗口
    maxStrike: string
    missileBases: MissileBase[]
    missileTypes: Record<string, Miss[]>
    planType: middlePlanType
    planWindowEnd: string
    planWindowStart: string
    stationDetails: Station[]
    strikeList: Strike2[]
    targetStationNum: number
    totalPrice: number
    planSummary: Record<string, string>
    stepName: string
    stepTarget: string
  }[]
}
export type KillChainHighPlans = StrikePlanV2['plans']

export interface RespKillChainPlanHigh {
  _id: string
  name: string
  version: string
  intensityLevel: string
  types: string[]
  weaponNames: string[]
  missileBaseIds: null | string[]
  stationIds: null | string[]
  elacWeaponNames: null | string[]
  radarIds: null | string[]
  taskId: number
  battleId: number
  userId: number
  plan: {
    feasible_count: number
    intensity_levels: string[]
    max_window_duration_min: string //Tips:"505.17"
    plans: KillChainHighPlans
  }[]
  stepName: string
  stepTarget: string
  planSummary: string

}

export type KillChainPlanListResp = RespKillChainPlanLow | RespKillChainPlanMiddle | RespKillChainPlanHigh
/**
 * 保存杀伤链打击方案
 */
export const saveKillChainStrikePlan = (data: SaveKillChainStrikePlanParam) => {
  const url = `/api/algorithm/saveKillChainPlan`
  return requestAPI.post<AxiosResponseType<any>>(url, data)
}

/**
 * 查询杀伤链打击方案列表
 */
export const getKillChainStrikePlanList = (taskId: number, planName?: string, planVersion?: string) => {
  const url = `/api/algorithm/queryKillChainPlan`
  return requestAPI.post<AxiosResponseType<KillChainPlanListResp[]>>(url, {
    taskId,
    planName,
    planVersion,
  })
}
