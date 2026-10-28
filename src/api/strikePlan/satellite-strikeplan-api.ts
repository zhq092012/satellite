import type { StrikePlan } from '@/types/strike'
import type { AxiosResponseType } from '@/types/http'
import { requestAPI } from '@/utils/tools/request'
import type { Weapon } from '@/types/dashboard'
/** 生成打击方案 v2 的请求参数，包含任务、烈度、武器和地面目标。 */
export type GenerateStrikePlanV2Param = {
  /** 任务 ID */
  taskId: number
  /** 打击烈度 */
  intensityLevel: string
  /** 参与计算的卫星或目标类型 */
  types: string[]
  /** 参与计算的武器名称 */
  weaponNames: string[]
  /** 武器类型 */
  weaponType?: string
  /** 参与计算的地面站或数据中心 ID */
  stationIds?: string[]
  /** 电子对抗武器名称 */
  elacWeaponNames?: string[]
  /** 参与计算的雷达 ID */
  radarIds?: string[]
  /** 参与计算的导弹基地 ID */
  missileBaseIds?: string[]
  /** 定向能武器名称 */
  directedWeaponNames?: string[]
}
/** 查询地面站打击方案时使用的任务参数。 */
export type StationStrikePlanParam = {
  /** 任务 ID */
  taskId: number
}

/** 打击方案概览：输入规模、目标数、资产数和平均威胁、可打击度。 */
export type StrikePlanV2SummaryOverview = {
  /** 输入目标数量 */
  input_count: number
  /** 目标数量 */
  targets_count: number
  /** 可用资产数量 */
  assets_count: number
  /** 平均威胁度 */
  avg_threat: number
  /** 平均可打击度 */
  avg_strike: number
}

/** 方案中的单个打击目标及其威胁度。 */
export type StrikePlanV2TargetAnalysisItem = {
  /** 序号 */
  index: number
  /** 目标卫星 NORAD 编号 */
  norad_id: number
  /** 目标卫星类型 */
  satellite_type: string
  /** 目标卫星所属国家 */
  satellite_country: string
  /** 轨道类型 */
  orbit_type: string
  /** 威胁度 */
  threat: number
}

/** 方案选用的武器资产。 */
export type StrikePlanV2AssetConfigItem = {
  /** 武器 ID */
  weapon_id: string
  /** 武器名称 */
  weapon_name: string
  /** 武器类型 */
  weapon_type: string
}
/**
 * 导弹打击卫星时间窗口
 */
export type StrikePlanV2MissionWindowItem = {
  /** 序号 */
  index: number
  /** 武器 ID */
  weapon_id: string
  /** 武器名称 */
  weapon_name: string
  /** 窗口开始时间 */
  window_start: string
  /** 窗口结束时间 */
  window_end: string
  /** 目标卫星 NORAD 编号 */
  satellite_id: number
  /** 目标卫星类型 */
  satellite_type: string
  /** 目标卫星所属国家 */
  satellite_country: string
  /** 轨道类型 */
  orbit_type: string
  /** 威胁度 */
  threat: number
}

/** 方案整体时间窗口。 */
export type StrikePlanV2TimeWindow = {
  /** 窗口开始时间 */
  start: string
  /** 窗口结束时间 */
  end: string
  /** 时间窗口跨度 */
  range: string
}

/** 方案生成时采用的策略提示。 */
export type StrikePlanV2Strategy = {
  /** 方案类型提示 */
  plan_type_hint: string
  /** 烈度策略提示 */
  intensity_hint: string
}

/** 单个方案的摘要，含目标、资产、窗口和策略。 */
export type StrikePlanV2PlanSummary = {
  /** 方案规模概览 */
  overview: StrikePlanV2SummaryOverview
  /** 目标分析 */
  target_analysis: StrikePlanV2TargetAnalysisItem[]
  /** 选用的武器资产 */
  asset_config: StrikePlanV2AssetConfigItem[]
  /** 武器对卫星的打击时间窗口 */
  mission_windows: StrikePlanV2MissionWindowItem[]
  /** 方案整体时间窗口 */
  time_window: StrikePlanV2TimeWindow
  /** 方案策略提示 */
  strategy: StrikePlanV2Strategy
  /** 方案生成时间 */
  generated_at: string
}

/** 方案评分：总分、压低的威胁、目标数和武器分布。 */
export type StrikePlanV2Metrics = {
  /** 方案总分 */
  total_score: number
  /** 压低的威胁总量 */
  total_threat_reduced: number
  /** 目标数量 */
  targets_count: number
  /** 按武器类型统计的使用数量 */
  weapon_type_distribution: Record<string, Record<string, number>>
  /** 方案时间范围 */
  time_range: string
}

/** 某一烈度、某一策略下的完整方案。 */
export type StrikePlanV2PlanDetail = {
  /** 方案名称 */
  plan_name: string
  /** 打击烈度 */
  intensity: string
  /** 方案摘要 */
  plan_summary: StrikePlanV2PlanSummary
  /** 方案评分 */
  metrics: StrikePlanV2Metrics
}

/** 同一烈度下的两套策略：威胁优先、数量优先。 */
export type StrikePlanV2IntensityPlans = {
  /** 威胁优先策略下的方案 */
  threat_first: StrikePlanV2PlanDetail
  /** 数量优先策略下的方案 */
  max_targets: StrikePlanV2PlanDetail
}

/** 打击方案 v2。plans 按烈度分组，每组含 threat_first 与 max_targets。 */
export type StrikePlanV2 = {
  /** 可行方案数量 */
  feasible_count: number
  /** 最大窗口时长（分钟） */
  max_window_duration_min: number
  /** 方案覆盖的烈度 */
  intensity_levels: string[]
  /** 按烈度分组的方案。每组含威胁优先和数量优先 */
  plans: Record<string, StrikePlanV2IntensityPlans>

  /** 作战阶段名称 */
  stepName: string
  /** 阶段目标 */
  stepTarget: string
  /** 方案摘要文本 */
  planSummary: string
}

/** 已保存的打击方案 v2，在方案结果上附加任务和版本信息。 */
export type StrikePlanV2Extended = StrikePlanV2 & {
  /** 文档 ID */
  _id: string
  /** 战场 ID */
  battleId: number
  /** 任务 ID */
  taskId: number
  /** 已保存方案名称 */
  name: string
  /** 参与计算的卫星或目标类型 */
  types: string[]
  /** 创建该方案的用户 ID */
  userId: number
  /** 方案版本号 */
  version: string
  /** 参与计算的武器名称 */
  weaponNames: string[]
  /** 打击烈度 */
  intensityLevel: string
}
/** 定向能武器打击卫星的时间窗口。 */
export interface DirectdWindow {
  /** 序号 */
  index: number
  /** 武器 ID */
  weapon_id: string
  /** 武器名称 */
  weapon_name: string
  /** 窗口开始时间 */
  window_start: string
  /** 窗口结束时间 */
  window_end: string
  /** 目标卫星 NORAD 编号 */
  satellite_id: number
  /** 目标卫星类型 */
  satellite_type: string
  /** 目标卫星所属国家 */
  satellite_country: string
  /** 轨道类型 */
  orbit_type: string
  /** 威胁度 */
  threat: number
}
/** 导弹打击地面站方案，含基地、弹种、站点和打击明细。 */
export type StationStrikePlanResp = {
  /** 方案类型。中烈度为饱和式打击、成本最低或突防最强 */
  planType: string
  /** 计划覆盖的地面站数 */
  targetStationNum: number
  /** 实际纳入方案的地面站数 */
  actualStationNum: number
  /** 平均可打击度 */
  avgStrike: number
  /** 最大可打击度 */
  maxStrike: number
  /** 方案总价格 */
  totalPrice: number
  /** 方案使用的导弹基地 */
  missileBases: MissileBase[]
  /** 按类型分组的可用导弹 */
  missileTypes: Record<string, Miss[]>
  /** 方案涉及的地面站 */
  stationDetails: StationDetail[]
  /** 打击明细 */
  strikeList: MissileStrike[]
  /** 方案窗口开始时间 */
  planWindowStart: string
  /** 方案窗口结束时间 */
  planWindowEnd: string
  /** 定向能武器打击卫星的时间窗口 */
  directedWindows: DirectdWindow[]

  /** 作战阶段名称 */
  stepName: string
  /** 阶段目标 */
  stepTarget: string
  /** 方案摘要，按条目给出说明 */
  planSummary: Record<string, string>
}
/** 任务附近的地面站及其与任务区域的距离。 */
export type StationDistanceResp = {
  /** 地面站 ID */
  stationId: string
  /** 地面站名称 */
  stationName: string
  /** 地面站所属国家 */
  stationCountry: string
  /** 地面站类型 */
  stationType: string
  /** 地面站纬度 */
  stationLat: number
  /** 地面站经度 */
  stationLon: number
  /** 到目标的距离 */
  distance: number
}
/** 导弹基地及其部署的导弹。 */
export type MissileBaseEntity = {
  /** 文档 ID */
  _id: string
  /** 导弹基地名称 */
  name: string
  /** 经纬度，格式为纬度,经度 */
  latLon: string
  /** 国家或地区 */
  country: string
  /** 该基地部署的导弹 */
  deployMissiles: Missile[]
}
/** 电子对抗打击地面链路的方案。 */
export type ElacStrikePlanResp = {
  /** 计划覆盖的地面站数 */
  targetStationNum: number
  /** 实际纳入方案的地面站数 */
  actualStationNum: number
  /** 实际形成的打击链路数 */
  actualChainNum: number
  /** 实际覆盖的卫星数 */
  actualSatelliteNum: number
  /** 使用的电子对抗武器 */
  elecWeapons: Weapon[]
  /** 打击明细 */
  strikeList: Strike[]
  /** 方案窗口开始时间 */
  planWindowStart: string
  /** 方案窗口结束时间 */
  planWindowEnd: string
  /** 方案涉及的地面站 */
  stationDetails: StationDetail[]

  /** 作战阶段名称 */
  stepName: string
  /** 阶段目标 */
  stepTarget: string
  /** 方案摘要，按条目给出说明 */
  planSummary: Record<string, string>
}
/** 电子对抗对单个地面站和卫星链路的打击窗口。 */
export type Strike = {
  /** 地面站 ID */
  stationId: string
  /** 地面站名称 */
  stationName: string

  /** 武器 ID */
  weaponId: string
  /** 武器名称 */
  weaponName: string

  strike: string //可打击度 例: "0.643"
  /** 被打击卫星的 NORAD 编号 */
  norad: number
  /** 可打击时间窗口 */
  windows: WindowObj[]
  /** 全部窗口中的开始时间 */
  totalWindowStart: string
  /** 全部窗口中的结束时间 */
  totalWindowEnd: string
}
/** 方案中的导弹基地及部署导弹。 */
export type MissileBase = {
  /** 导弹基地 ID */
  missileBaseId: string
  /** 导弹基地名称 */
  missileBaseName: string
  latLon: string //Tip:  "24.6780,121.0920"
  /** 国家或地区 */
  country: string
  /** 该基地部署的导弹 */
  deployMissiles: Missile[]
}
/** 基地上部署的导弹名称和文档 ID。 */
export type Missile = {
  /** 导弹名称 */
  missileName: string
  /** 文档 ID */
  _id: string
}
/** 可用导弹型号，含射程、部署方式和价格。 */
export type Miss = {
  /** 导弹 ID */
  missileId: string
  /** 导弹名称 */
  missileName: string
  /** 国家或地区 */
  country: string
  /** 射程 */
  range: string
  /** 部署方式 */
  basing: string
  /** 价格 */
  price: number
}
/** 方案涉及的地面站。 */
export type StationDetail = {
  /** 地面站 ID */
  stationId: string
  /** 地面站名称 */
  stationName: string
  /** 地面站类型 */
  type: string
  /** 国家或地区 */
  country: string
  /** 位置描述 */
  location: string
  latLon: string //Tip:  "24.6780,121.0920"
}
/** 导弹基地对地面站的一次打击，含距离、可打击度和时间窗口。 */
export type MissileStrike = {
  /** 打击记录 ID */
  id: string
  /** 导弹基地 ID */
  missileBaseId: string
  /** 导弹基地名称 */
  missileBaseName: string
  /** 导弹基地所属国家 */
  missileBaseCountry: string
  /** 该基地部署的导弹 */
  deployMissiles: Missile[]
  /** 导弹 ID */
  missileId: string
  /** 导弹名称 */
  missileName: string
  /** 导弹类型 */
  missileType: string
  /** 导弹价格 */
  missilePrice: number
  /** 地面站 ID */
  stationId: string
  /** 地面站名称 */
  stationName: string
  /** 地面站类型 */
  stationType: string
  /** 地面站所属国家 */
  stationCountry: string
  /** 地面站位置描述 */
  stationLocation: string
  /** 到目标的距离 */
  distance: number
  /** 导弹射程 */
  range: string
  /** 可打击度 */
  strike: number
  /** 可打击时间窗口 */
  windows: WindowObj[]
  /** 全部窗口中的开始时间 */
  totalWindowStart: string
  /** 全部窗口中的结束时间 */
  totalWindowEnd: string
}
/** 一段连续的可打击时间。 */
export type WindowObj = {
  /** 窗口开始时间 */
  windowStart: string
  /** 窗口结束时间 */
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

/** 保存打击方案 v2 时，在生成参数上附加方案名、版本和所属方。 */
export type SaveStrikePlanParam = GenerateStrikePlanV2Param & {
  /** 方案名称 */
  planName: string
  /** 方案版本 */
  planVersion: string
  /** 方案所属方 */
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
/** 打击评估 schema 的版本摘要。 */
export type Schema = {
  /** 评估 schema 版本号 */
  version: string
  /** schema 说明 */
  description: string
  /** 创建时间 */
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
/** 评估 schema 中的一个作战阶段。 */
type CombatStage = {
  /** 作战阶段中文名 */
  name: string
  /** 作战阶段英文名，可为空 */
  name_en: string | null
  /** 作战阶段说明，可为空 */
  description: string | null
  /** 阶段时长（小时） */
  duration_hours: number
}

// 任务配置
export type StageConfig = {
  /** 各作战阶段权重，五项之和应为 1 */
  weights: {
    //各个阶段的权重系数 和必须为1
    /** 导弹预警卫星的阶段权重，五项之和应为 1 */
    missile_warning: number
    /** 导航卫星的阶段权重，五项之和应为 1 */
    navigation: number
    /** 通信卫星的阶段权重，五项之和应为 1 */
    communication: number
    /** 侦察卫星的阶段权重，五项之和应为 1 */
    reconnaissance: number
    /** 太空监视卫星的阶段权重，五项之和应为 1 */
    space_monitor: number
  }
  /** 各类卫星的抑制度需求阈值 */
  requirements: {
    //各个卫星的抑制度需求阈值
    /** 导弹预警卫星的抑制度需求阈值 */
    missile_warning: number
    /** 导航卫星的抑制度需求阈值 */
    navigation: number
    /** 通信卫星的抑制度需求阈值 */
    communication: number
    /** 侦察卫星的抑制度需求阈值 */
    reconnaissance: number
    /** 太空监视卫星的抑制度需求阈值 */
    space_monitor: number
  }
}

/** 评估 schema 详情：卫星类型、武器类型、作战阶段和校验规则。 */
export type SchemaDetail = {
  /** 评估 schema 版本号 */
  version: string
  /** schema 说明 */
  description: string
  /** 参与评估的卫星类型定义 */
  satellite_types: {
    /** 通信卫星的卫星类型定义 */
    communication: {
      /** 通信卫星类型的中文名称 */
      name: string
      /** 通信卫星类型的英文名称 */
      name_en: string | null
      /** 通信卫星的典型轨道 */
      orbit: string | null
      /** 通信卫星类型说明 */
      description: string | null
    }
    /** 导弹预警卫星的卫星类型定义 */
    missile_warning: {
      /** 导弹预警卫星类型的中文名称 */
      name: string
      /** 导弹预警卫星类型的英文名称 */
      name_en: string | null
      /** 导弹预警卫星的典型轨道 */
      orbit: string | null
      /** 导弹预警卫星类型说明 */
      description: string | null
    }
    /** 导航卫星的卫星类型定义 */
    navigation: {
      /** 导航卫星类型的中文名称 */
      name: string
      /** 导航卫星类型的英文名称 */
      name_en: string | null
      /** 导航卫星的典型轨道 */
      orbit: string | null
      /** 导航卫星类型说明 */
      description: string | null
    }
    /** 侦察卫星的卫星类型定义 */
    reconnaissance: {
      /** 侦察卫星类型的中文名称 */
      name: string
      /** 侦察卫星类型的英文名称 */
      name_en: string | null
      /** 侦察卫星的典型轨道 */
      orbit: string | null
      /** 侦察卫星类型说明 */
      description: string | null
    }
    /** 太空监视卫星的卫星类型定义 */
    space_monitor: {
      /** 太空监视卫星类型的中文名称 */
      name: string
      /** 太空监视卫星类型的英文名称 */
      name_en: string | null
      /** 太空监视卫星的典型轨道 */
      orbit: string | null
      /** 太空监视卫星类型说明 */
      description: string | null
    }
  }
  /** 评估使用的武器类型定义 */
  weapon_types: {
    /** 定向能武器类型定义 */
    directed: {
      /** 武器类型中文名 */
      name: string
      /** 武器类型英文名 */
      name_en: string
      /** 武器类型说明 */
      description: string
      /** 计量单位 */
      unit: string
      /** 数量约束 */
      constraints: {
        /** 数量是否只允许整数 */
        integer_only: boolean
      }
    }
    /** 动能武器类型定义 */
    kinetic: {
      /** 武器类型中文名 */
      name: string
      /** 武器类型英文名 */
      name_en: string
      /** 武器类型说明 */
      description: string
      /** 计量单位 */
      unit: string
      /** 数量约束 */
      constraints: {
        /** 数量是否只允许整数 */
        integer_only: boolean
        /** 单个目标允许使用的最大数量 */
        max_per_target: number
      }
    }
    /** 干扰武器类型定义 */
    jammer: {
      /** 武器类型中文名 */
      name: string
      /** 武器类型英文名 */
      name_en: string
      /** 武器类型说明 */
      description: string
      /** 计量单位 */
      unit: string
      /** 数量约束 */
      constraints: {
        /** 数量是否只允许整数 */
        integer_only: boolean
      }
    }
  }
  /** 作战阶段定义，键为阶段标识 */
  combat_stages: Record<string, CombatStage>
  /** schema 校验规则 */
  validation_rules: {
    /** 各阶段权重之和应达到的值 */
    stage_weights_sum: number
    /** 阶段权重之和允许的误差 */
    stage_weights_tolerance: number
    /** 毁伤取值允许的上下限 */
    damage_range: {
      /** 毁伤取值上限 */
      max: number
      /** 毁伤取值下限 */
      min: number
    }
    /** 成本是否必须为正数 */
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
/** 打击方案评估参数：武器成本、典型毁伤、压制时长和阶段配置。 */
export type EvaluationParameters = {
  schemaVersion: string //使用的schema版本
  /** 各类武器的成本 */
  weapon_costs: {
    //武器成本
    kinetic: number //动能武器数量
    directed: number //定向能武器数量
    jammer: number //干扰器数量
    space_based: number // 天基武器压制时长
  }
  /** 各类卫星在不同武器下的典型毁伤 */
  typical_damage: {
    //典型伤害程度
    /** 导弹预警卫星的典型毁伤，按武器类型分项 */
    missile_warning: {
      //导弹预警
      /** 动能武器对导弹预警卫星的典型毁伤程度 */
      kinetic: number
      /** 定向能武器对导弹预警卫星的典型毁伤程度 */
      directed: number
      /** 干扰武器对导弹预警卫星的典型毁伤程度 */
      jammer: number
      /** 天基武器对导弹预警卫星的典型毁伤程度 */
      space_based: number
    }
    /** 导航卫星的典型毁伤，按武器类型分项 */
    navigation: {
      //导航
      /** 动能武器对导航卫星的典型毁伤程度 */
      kinetic: number
      /** 定向能武器对导航卫星的典型毁伤程度 */
      directed: number
      /** 干扰武器对导航卫星的典型毁伤程度 */
      jammer: number
      /** 天基武器对导航卫星的典型毁伤程度 */
      space_based: number
    }
    /** 通信卫星的典型毁伤，按武器类型分项 */
    communication: {
      //通信
      /** 动能武器对通信卫星的典型毁伤程度 */
      kinetic: number
      /** 定向能武器对通信卫星的典型毁伤程度 */
      directed: number
      /** 干扰武器对通信卫星的典型毁伤程度 */
      jammer: number
      /** 天基武器对通信卫星的典型毁伤程度 */
      space_based: number
    }
    /** 侦察卫星的典型毁伤，按武器类型分项 */
    reconnaissance: {
      //侦察
      /** 动能武器对侦察卫星的典型毁伤程度 */
      kinetic: number
      /** 定向能武器对侦察卫星的典型毁伤程度 */
      directed: number
      /** 干扰武器对侦察卫星的典型毁伤程度 */
      jammer: number
      /** 天基武器对侦察卫星的典型毁伤程度 */
      space_based: number
    }
    /** 太空监视卫星的典型毁伤，按武器类型分项 */
    space_monitor: {
      //空间监测
      kinetic: number //动能武器对空间监测卫星的典型伤害程度
      directed: number //定向能武器对空间监测卫星的典型伤害程度
      jammer: number //干扰器对空间监测卫星的典型伤害程度
      space_based: number // 天基武器压制时长
    }
  }
  /** 各类武器的压制时长 */
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
/** 发起一次打击方案评估的请求参数。 */
type EvaluationParam = {
  /** 任务 ID */
  taskId: number
  /** 打击烈度 */
  intensityLevel: string
  /** 参与计算的武器名称 */
  weaponNames: string[]
  /** 使用的评估 schema 版本 */
  schemaVersion: string
}

/**
 * 获取配置信息
 */
export const getEvaluationConfig = (version: string) => {
  const url = `/api/battle/getEvaluationConfig?version=${version}`
  return requestAPI.get<AxiosResponseType<EvaluationParameters>>(url)
}

/** 一次评估的汇总指标、分项毁伤与时间值、校验和分析建议。 */
export type EvaluationResultData = {
  /** 评估汇总指标，含 MSI、DPI、MCI、RER、总成本和是否可行 */
  summary: {
    /** 评估汇总指标 MSI */
    MSI: number
    /** 评估汇总指标 DPI */
    DPI: number
    /** 评估汇总指标 MCI */
    MCI: number
    /** 评估汇总指标 RER */
    RER: number
    /** 方案总成本 */
    total_cost: number
    /** 方案是否可行 */
    is_feasible: boolean
  }
  /** 分卫星类型的毁伤指标 D 和时间指标 T */
  details: {
    /** 各类卫星的毁伤指标 D */
    D_values: {
      /** 通信卫星的毁伤指标 D */
      communication: number
      /** 太空监视卫星的毁伤指标 D */
      space_monitor: number
      /** 导航卫星的毁伤指标 D */
      navigation: number
      /** 侦察卫星的毁伤指标 D */
      reconnaissance: number
      /** 导弹预警卫星的毁伤指标 D */
      missile_warning: number
    }
    /** 各类卫星的时间指标 T */
    T_values: {
      /** 通信卫星的时间指标 T */
      communication: number
      /** 太空监视卫星的时间指标 T */
      space_monitor: number
      /** 导航卫星的时间指标 T */
      navigation: number
      /** 侦察卫星的时间指标 T */
      reconnaissance: number
      /** 导弹预警卫星的时间指标 T */
      missile_warning: number
    }
  }
  /** 校验结果 */
  validation: {
    /** 是否通过校验 */
    is_valid: boolean
    /** 校验错误 */
    errors: string[]
    /** 校验警告 */
    warnings: string[]
  }
  /** 评估分析，含结论、状态、建议和风险 */
  analysis: {
    /** 分析结论 */
    summary: string
    /** 总体评估状态 */
    overall_status: string
    /** 分析明细 */
    details: string[]
    /** 改进建议 */
    suggestions: string[]
    /** 风险说明 */
    risks: string[]
  }
}

/** 按方案键返回的单条评估结果。 */
export type EvaluationResultItem = {
  /** 评估是否成功。成功时为 true */
  success: true
  /** 评估请求 ID */
  request_id: string
  /** 评估完成时间 */
  timestamp: string
  /** 本次评估使用的 schema 版本 */
  schema_version: string
  /** 评估明细数据 */
  data: EvaluationResultData
}

/** 评估结果字典。键为方案标识，值为对应的评估条目。 */
export type EvaluationResult = Record<string, EvaluationResultItem>

/**
 * 打击方案评估
 */
export const evaluateStrikePlan = (data: EvaluationParam) => {
  const url = `/api/battle/evaluation`
  return requestAPI.post<AxiosResponseType<EvaluationResult>>(url, data)
}
/** 保存杀伤链方案的请求参数，覆盖低、中、高烈度所用的武器和地面目标。 */
export interface SaveKillChainStrikePlanParam {
  /** 任务 ID */
  taskId: number
  /** 打击烈度 */
  intensityLevel: string
  /** 参与计算的武器名称 */
  weaponNames: string[]
  /** 参与计算的卫星或目标类型 */
  types: string[]
  /** 方案所属方 */
  side: string
  /** 武器类型 */
  weaponTypes?: string[]
  /** 参与计算的导弹基地 ID */
  missileBaseIds: string[]
  /** 参与计算的地面站或数据中心 ID */
  stationIds: string[]
  /** 定向能武器名称 */
  directedWeaponNames: string[]
  /** 电子对抗武器名称 */
  elacWeaponNames: string[]
  /** 参与计算的雷达 ID */
  radarIds: string[]
  /** 方案名称 */
  planName: string
  /** 方案版本 */
  planVersion: string
}
/** 杀伤链方案中的地面站。 */
export interface Station {
  /** 国家或地区 */
  country: string
  /** 经纬度，格式为纬度,经度 */
  latLon: string
  /** 位置描述 */
  location: string
  /** 地面站 ID */
  stationId: string
  /** 地面站名称 */
  stationName: string
  /** 地面站类型 */
  type: string
}

/** 低烈度杀伤链方案。plan 为电子对抗链路打击结果列表。 */
export interface RespKillChainPlanLow {
  /** 文档 ID */
  _id: string
  /** 杀伤链方案名称 */
  name: string
  /** 方案版本号 */
  version: string
  /** 打击烈度 */
  intensityLevel: string
  /** 参与计算的卫星或目标类型 */
  types: null | string[]
  /** 参与计算的武器名称 */
  weaponNames: null | string[]
  /** 参与计算的导弹基地 ID */
  missileBaseIds: null | string[]
  /** 参与计算的地面站或数据中心 ID */
  stationIds: null | string[]
  /** 电子对抗武器名称 */
  elacWeaponNames: string[]
  /** 参与计算的雷达 ID */
  radarIds: string[]
  /** 任务 ID */
  taskId: number
  /** 战场 ID */
  battleId: number
  /** 创建该方案的用户 ID */
  userId: number
  /** 该烈度下的方案明细列表 */
  plan: {
    /** 实际形成的打击链路数 */
    actualChainNum: number
    /** 实际覆盖的卫星数 */
    actualSatelliteNum: number
    /** 实际纳入方案的地面站数 */
    actualStationNum: number
    /** 使用的电子对抗武器 */
    elecWeapons: Weapon[]
    /** 方案窗口结束时间 */
    planWindowEnd: string
    /** 方案窗口开始时间 */
    planWindowStart: string
    /** 方案涉及的地面站 */
    stationDetails: StationDetail[]
    /** 打击明细 */
    strikeList: Strike[]
    /** 计划覆盖的地面站数 */
    targetStationNum: number
  }[]
  /** 作战阶段名称 */
  stepName: string
  /** 阶段目标 */
  stepTarget: string
  /** 方案摘要文本 */
  planSummary: string
}

/** 中烈度方案里导弹对地面站的打击明细。 */
export interface Strike2 {
  /** 该基地部署的导弹 */
  deployMissiles: {
    /** 导弹文档 ID */
    _id: string
    /** 导弹名称 */
    missileName: string
  }[]
  /** 到目标的距离 */
  distance: string
  /** 打击记录 ID */
  id: string
  /** 导弹基地所属国家 */
  missileBaseCountry: string
  /** 导弹基地 ID */
  missileBaseId: string
  /** 导弹基地经纬度，格式为纬度,经度 */
  missileBaseLatLon: string
  /** 导弹基地名称 */
  missileBaseName: string
  /** 导弹部署方式 */
  missileBasing: string
  /** 导弹所属国家 */
  missileCountry: string
  /** 导弹 ID */
  missileId: string
  /** 导弹名称 */
  missileName: string
  /** 导弹价格 */
  missilePrice: string
  /** 导弹射程 */
  missileRange: string
  /** 导弹类型 */
  missileType: string
  /** 导弹射程 */
  range: string
  /** 地面站所属国家 */
  stationCountry: string
  /** 地面站 ID */
  stationId: string
  /** 地面站经纬度，格式为纬度,经度 */
  stationLatLon: string
  /** 地面站位置描述 */
  stationLocation: string
  /** 地面站名称 */
  stationName: string
  /** 地面站类型 */
  stationType: string
  /** 可打击度 */
  strike: string
  /** 全部窗口中的结束时间 */
  totalWindowEnd: string
  /** 全部窗口中的开始时间 */
  totalWindowStart: string
  /** 可打击时间窗口 */
  windows: {
    /** 窗口结束时间 */
    windowEnd: string
    /** 窗口开始时间 */
    windowStart: string
  }[]
}
/** 中烈度方案类型：饱和式打击、成本最低或突防最强。 */
export type middlePlanType = '饱和式打击' | '成本最低' | '突防最强'
/** 中烈度杀伤链方案。plan 含导弹、定向能窗口和地面站打击明细。 */
export interface RespKillChainPlanMiddle {
  /** 文档 ID */
  _id: string
  /** 杀伤链方案名称 */
  name: string
  /** 方案版本号 */
  version: string
  /** 打击烈度 */
  intensityLevel: string | null
  /** 参与计算的卫星或目标类型 */
  types: string[] | null
  /** 参与计算的武器名称 */
  weaponNames: string[] | null
  /** 参与计算的导弹基地 ID */
  missileBaseIds: string[]
  /** 参与计算的地面站或数据中心 ID */
  stationIds: string[]
  /** 电子对抗武器名称 */
  elacWeaponNames: string[] | null
  /** 参与计算的雷达 ID */
  radarIds: string[] | null
  /** 任务 ID */
  taskId: number
  /** 战场 ID */
  battleId: number
  /** 创建该方案的用户 ID */
  userId: number
  /** 该烈度下的方案明细列表 */
  plan: {
    /** 实际纳入方案的地面站数 */
    actualStationNum: number
    /** 平均可打击度 */
    avgStrike: string
    directedWindows: StrikePlanV2MissionWindowItem[]//中烈度特有的定向能武器针对卫星的打击时间窗口
    /** 最大可打击度 */
    maxStrike: string
    /** 方案使用的导弹基地 */
    missileBases: MissileBase[]
    /** 按类型分组的可用导弹 */
    missileTypes: Record<string, Miss[]>
    /** 方案类型。中烈度为饱和式打击、成本最低或突防最强 */
    planType: middlePlanType
    /** 方案窗口结束时间 */
    planWindowEnd: string
    /** 方案窗口开始时间 */
    planWindowStart: string
    /** 方案涉及的地面站 */
    stationDetails: Station[]
    /** 打击明细 */
    strikeList: Strike2[]
    /** 计划覆盖的地面站数 */
    targetStationNum: number
    /** 方案总价格 */
    totalPrice: number
    /** 方案摘要 */
    planSummary: Record<string, string>
    /** 作战阶段名称 */
    stepName: string
    /** 阶段目标 */
    stepTarget: string
  }[]
}
/** 高烈度杀伤链方案中的 plans，结构与打击方案 v2 的 plans 相同。 */
export type KillChainHighPlans = StrikePlanV2['plans']

/** 高烈度杀伤链方案。plan 为按烈度和策略组织的卫星打击方案。 */
export interface RespKillChainPlanHigh {
  /** 文档 ID */
  _id: string
  /** 杀伤链方案名称 */
  name: string
  /** 方案版本号 */
  version: string
  /** 打击烈度 */
  intensityLevel: string
  /** 参与计算的卫星或目标类型 */
  types: string[]
  /** 参与计算的武器名称 */
  weaponNames: string[]
  /** 参与计算的导弹基地 ID */
  missileBaseIds: null | string[]
  /** 参与计算的地面站或数据中心 ID */
  stationIds: null | string[]
  /** 电子对抗武器名称 */
  elacWeaponNames: null | string[]
  /** 参与计算的雷达 ID */
  radarIds: null | string[]
  /** 任务 ID */
  taskId: number
  /** 战场 ID */
  battleId: number
  /** 创建该方案的用户 ID */
  userId: number
  /** 该烈度下的方案明细列表 */
  plan: {
    /** 可行方案数量 */
    feasible_count: number
    /** 方案覆盖的烈度 */
    intensity_levels: string[]
    max_window_duration_min: string //Tips:"505.17"
    /** 按烈度分组的方案。每组含威胁优先和数量优先 */
    plans: KillChainHighPlans
  }[]
  /** 作战阶段名称 */
  stepName: string
  /** 阶段目标 */
  stepTarget: string
  /** 方案摘要文本 */
  planSummary: string

}

/** 杀伤链方案列表元素，低、中、高烈度三种结构之一。 */
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
