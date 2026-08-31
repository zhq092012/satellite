import { requestAPI } from '@/utils/tools/request'

import type { AxiosResponseType } from '@/types/http'

/// ==================== 基础子模块 ====================

// 接收站基础信息（用于关系列表）
export interface ReceiveObj {
  /** 接收站 id */
  receiveId: string
  /** 接收站名称 */
  receiveName: string
  /** 接收站用途（军用 / 民用 / 商用等） */
  receiveUsage?: string
  /** 接收站经纬度，格式为："68.350,133.500" */
  receiveLatLon: string
  /** 接收站状态：0-未打击（可用） 1-被打击（不可用）；为 1 时通常无 relations */
  receiveStatus: number
}

// 中心云站基础信息（用于关系列表）
export interface StationObj {
  stationId: string //中心站id
  stationName: string //中心站名称
  stationLatLon: string //中心站经纬度  格式为:"68.350,133.500"
  stationStatus: number //中心站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

/** 站间/星间可见时间窗口 */
export interface VisibilityWindow {
  /** 窗口开始时间，格式："YYYY-MM-DD HH:mm:ss" */
  beginWindow: string
  /** 窗口结束时间，格式："YYYY-MM-DD HH:mm:ss" */
  endWindow: string
}

// 站与站之间的拓扑关联映射
export interface RelationMap {
  /** 发起方 id，与 receiveId 或 stationId 对应 */
  from: string
  /** 接收方 id，与 receiveId 或 stationId 对应 */
  to: string
  /** 地面站-数据中心链路的可见窗口；无窗口约束时为 null */
  visibilityWindows?: VisibilityWindow[] | null
}

// 武器 / 拦截系统配置
export interface Weapon {
  /** 武器 Id */
  id: string
  /** 武器名称 */
  name: string
  /** 武器所属国家 */
  country: string
  /** 武器类型 */
  type: string
  /** 可打击的卫星类型 */
  satellite_type?: string | null
  /** 打击间隔时间（分钟） */
  interval?: string
  /** 武器纬度（接口可能返回 number 或 string） */
  latitude: number | string
  /** 武器经度（接口可能返回 number 或 string） */
  longitude: number | string
  /** 武器射程（km） */
  range: number | string
}

// ==================== 业务主要结构 ====================

// 初始状态下的过境窗口
export interface InitWindow {
  /** 地面接收站 id */
  receiveId: string
  /** 地面接收站名称 */
  receiveName: string
  /** 地面接收站纬度 */
  receiveLat: number
  /** 地面接收站经度 */
  receiveLon: number
  /** 接收站用途（军用 / 民用 / 商用等） */
  receiveUsage?: string
  /** 开始过境时间窗口 */
  peakWindow: string
  /** 结束过境时间窗口 */
  endWindow: string
  /** 战场过境时间；无对应窗口时为 null */
  battleWindow?: string | null
  /** 过境时卫星高度（km） */
  height?: number
}

// 初始状态下的卫星矩阵元素
export interface InitMatrix {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型；部分卫星可能为 null */
  satType: string
  /** 卫星 TLE 轨道第一行 */
  line1: string
  /** 卫星 TLE 轨道第二行 */
  line2: string
  /** 轨道类型：1-低轨 2-中轨 3-高轨 */
  orbitType?: number
  /** 用途：军用 / 商用 / 民用 等 */
  usage?: string
  /** 战场过境时间；无对应窗口时为 null */
  battleWindow?: string | null
  /** 卫星高度（km） */
  height?: number
  /** 卫星过境时间窗口列表 */
  initWindows: InitWindow[]
}

export interface StationRelationList {
  receiveObjList: ReceiveObj[] // 接收站列表
  stationObjList: StationObj[] // 中心站列表
  relations: RelationMap[] // 站与站之间的拓扑关联映射
}
/**
 * [类型用途]
 * 星间中继拓扑关联单项映射结构。
 *
 * [数据来源]
 * 后端算法矩阵接口返回数据中的 relayRelation.relations 元素。
 *
 * [字段规则]
 * - from: 发起卫星 ID / NORAD (如 "48643")
 * - to: 目标中继卫星 ID / NORAD (如 "22314")
 */
export interface RelayRelationMap {
  /** 发起方卫星 NORAD/Id 字符串 */
  from: string
  /** 接收方中继卫星 NORAD/Id 字符串 */
  to: string
  /** 星间中继可见时间窗口列表 */
  visibilityWindows: VisibilityWindow[]
}

/**
 * [类型用途]
 * 星间中继拓扑关系结构。
 *
 * [数据来源]
 * 后端算法矩阵接口返回数据中的 relayRelation 节点。
 *
 * [字段规则]
 * - relayList: 中继卫星 NORAD 编号列表 (如 [22314])
 * - satelliteList: 普通/观测卫星 NORAD 编号列表 (如 [48643, 57693, 58136])
 * - relations: 星间中继拓扑链路映射列表
 */
export interface RelayRelation {
  /** 中继卫星 NORAD 编号数组 */
  relayList: number[]
  /** 普通/观测卫星 NORAD 编号数组 */
  satelliteList: number[]
  /** 星间中继拓扑链路映射列表 */
  relations: RelayRelationMap[]
}

/**
 * 卫星矩阵中的地面站接收窗口数据结构。
 *
 * 数据来源：后端算法矩阵接口返回数据中的 satelliteMatrixList[].stationWindows 元素。
 *
 * 字段说明：
 * - receiveId: 接收站 ID
 * - receiveName: 接收站名称
 * - peakWindow: 开始过境时间窗口
 * - endWindow: 结束过境时间窗口
 * - strikeStatus: 打击状态（0-未打击，1-被打击）
 * - delayMin: 单个接收站过境/过基站延迟（分钟，可选）
 * - weapons: 针对该窗口的武器/拦截系统配置列表
 */
export interface StationWindow {
  /** 接收站 Id */
  receiveId: string
  /** 接收站名称 */
  receiveName: string
  /** 接收站用途（军用 / 民用 / 商用等） */
  receiveUsage?: string
  /** 开始过境时间窗口 */
  peakWindow: string
  /** 结束过境时间窗口 */
  endWindow: string
  /** 该接收窗口是否被直接打击：0-未打击 1-被打击 */
  strikeStatus: number
  /**
   * 整条传输链路是否因上游卫星/中继被打击而中断：0-正常 1-链路中断
   * （strikeStatus=0 且 chainStrikeStatus=1 表示地面站未直接打击但链路已断）
   */
  chainStrikeStatus?: number
  /** 该窗口对应的链路时长（分钟）；无有效链路时为 null */
  duration?: number | null
  /** 单个接收窗口延时（分钟，可选） */
  delayMin?: number
  /** 针对该窗口的武器/拦截系统配置 */
  weapons: Weapon[]
}

// 卫星矩阵元素（包含攻击/干扰及延迟信息）
export interface SatelliteMatrix {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型；部分卫星可能为 null */
  satType: string
  /** 过基站延迟（分钟） */
  delayMin: number
  /** 卫星状态：0-未打击 1-被打击 */
  satelliteStatus: number
  /** 轨道类型：1-低轨 2-中轨 3-高轨 */
  orbitType: number
  /** 用途：军用 / 商用 / 民用 等 */
  usage: string
  /** 战场过境时间；无对应窗口时为 null */
  battleWindow: string | null
  /** 武器/拦截系统配置 */
  weapons: Weapon[]
  /** 卫星高度（km） */
  height: number
  /** 打击后各接收站过境窗口列表 */
  stationWindows: StationWindow[]
}

/**
 * [类型用途]
 * 战场过境单个时间窗口数据结构。
 *
 * [数据来源]
 * 后端算法矩阵接口返回数据中的 battleMatrixList[].windows 元素。
 *
 * [字段规则]
 * - startTime: 开始过境时间字符串
 * - endTime: 结束过境时间字符串
 *
 * [使用约束]
 * 保持时间格式一致性。
 */
export interface BattleWindow {
  /** 开始过境时间 */
  startTime: string
  /** 结束过境时间 */
  endTime: string
}

/**
 * [类型用途]
 * 卫星过境战场矩阵（BattleMatrix）单项数据结构。
 *
 * [数据来源]
 * 后端算法接口 getMatrixList 返回的 battleMatrixList 节点。
 *
 * [字段规则]
 * - norad: 卫星 NORAD 唯一编号
 * - name: 卫星名称
 * - satType: 卫星类型
 * - gjNum: 过境/过基站次数
 * - windows: 战场过境时间窗口列表
 *
 * [使用约束]
 * 勿随意修改字段类型，以兼容 3D 拓扑图节点提取。
 */
export interface BattleMatrixItem {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型 */
  satType: string
  /** 过境次数 */
  gjNum: number
  /** 过境时间窗口列表 */
  windows: BattleWindow[]
}

// 针对 windows 数组项的接口定义
export interface WeaponWindow {
  /** 时间格式："YYYY-MM-DD HH:mm:ss" */
  beginWindow: string
  /** 时间格式："YYYY-MM-DD HH:mm:ss" */
  endWindow: string
}

/** @deprecated 请使用 VisibilityWindow，保留别名以兼容旧引用 */
export type SatelliteRelayWindow = VisibilityWindow

// 主数据项接口定义
export interface WeaponAttackRecord {
  /** 武器名称 */
  weaponName: string
  /** 武器类型（如："网络病毒" | "电子干扰" | "定向能"） */
  weaponType: string
  /** 打击开始时间 */
  beginTime: string
  /** 打击结束时间 */
  endTime: string
  /** 打击角度 */
  angle: number
  /** 时间窗口列表 */
  windows: WeaponWindow[]
  /** 目标名称 */
  target: string
  /** 目标 Id（卫星 NORAD 或接收站 id 等） */
  targetId?: string
  /** 目标类型（如："卫星" | "接收站"） */
  targetType: string
}

/**
 * 威胁卫星单项信息
 */
export interface ThreatSatelliteItem {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型；部分卫星可能为 null */
  satType: string | null
  /** 威胁度评分 */
  threatScore: number
}

/**
 * 卫星链路时长与过境窗口列表
 */
export interface TimeEffectsItem {
  /**
   * 卫星Id
   */
  norad: number
  /**
   * 系列名称
   */
  name: string
  /**
   * 卫星类型；部分卫星可能为 null
   */
  satType: string | null
  /**
   * 开始传输时间
   */

  beginTime: string
  /**
   * 结束传输时间
   */
  endTime: string
  /**
   * 链路时长
   */
  duration: number
  /**
   * 接收站名称；中继卫星或无地面站链路的卫星可能为 null
   */
  receiveName: string
}
// ==================== 根数据结构 ====================

/**
 * [类型用途]
 * 算法矩阵根接口返回数据结构。
 *
 * [数据来源]
 * /api/algorithm/calSeriesChain 接口返回 data 结构。
 *
 * [字段规则]
 * - attackPlanList: 攻击计划列表
 * - battleMatrixList: 卫星过境战场矩阵列表（部分版本不返回）
 * - initMatrixList: 初始状态下的过境时间窗口列表
 * - initRelationList: 初始状态下的站站拓扑映射
 * - satelliteMatrixList: 卫星矩阵（包含攻击/干扰及延迟信息）
 * - stationRelationList: 最终拓扑关联映射
 * - series: 卫星系列名称
 * - threatSats: 威胁卫星列表
 * - taskId / intensityLevel: 任务与烈度上下文（V2 接口返回）
 *
 * [使用约束]
 * 新增字段必须包含注释并明确类型。
 */
export interface MatrixResult {
  /** 任务 Id */
  taskId?: number
  /** 打击烈度等级（如："智能"） */
  intensityLevel?: string
  /** 攻击计划列表 */
  attackPlanList: WeaponAttackRecord[]
  /** 卫星过境战场矩阵（部分接口版本不返回） */
  battleMatrixList?: BattleMatrixItem[]
  /** 初始状态下的过境时间窗口 */
  initMatrixList: InitMatrix[]
  /** 初始状态下的站与站之间的拓扑关联映射 */
  initRelationList: StationRelationList
  /** 卫星矩阵（包含攻击/干扰及延迟信息） */
  satelliteMatrixList: SatelliteMatrix[]
  /** 站与站之间的拓扑关联映射 */
  stationRelationList: StationRelationList
  /** 星间中继拓扑关系映射；无中继链路时为 null 或省略 */
  relayRelation?: RelayRelation | null
  /** 卫星系列 */
  series: string
  /** 威胁卫星列表 */
  threatSats: ThreatSatelliteItem[]
  /** 卫星时延列表 */
  timeEffects: TimeEffectsItem[]
}

/**
 * 获取（侦察卫星）过境、过基站、延迟、打击以及战场矩阵的数据。
 * @param data 请求参数对象 (taskId, series)
 * @returns 包含 MatrixResult 的 Axios 响应 Promise
 */
export const getReconnaissanceAttackMatrix = (data: {
  taskId: number
  series: string
  stationIds?: string[]
  noradIds?: number[]
}) => {
  const url = `/api/algorithm/calSeriesChainV2`
  return requestAPI.post<AxiosResponseType<MatrixResult>>(url, data)
}
// ==================== 通讯卫星过境打击计划 ====================
/**
 * 通讯卫星过境时间窗口
 */
export interface CommInitWindow {
  /** 窗口开始时间 */
  startWindow: string
  /** 窗口结束时间 */
  endWindow: string
  /** 窗口时长（分钟） */
  duration: number
}

// initMatrixList 数组项类型
export interface InitMatrixItem {
  /**
   * 卫星 NORAD 编号
   */
  norad: number
  /**
   * 卫星名称
   */
  name: string
  /**
   * 卫星类型
   */
  satType: string
  /**
   * 卫星轨道 TLE 第一行
   */
  line1: string
  /**
   * 卫星轨道 TLE 第二行
   */
  line2: string
  /**
   * 初始时间窗口列表
   */
  initWindows: CommInitWindow[]
  /**
   * 卫星过境服务时长（单位：分钟）
   */
  serviceDuration: number
  /**
   * 卫星高度（单位：公里）
   */
  height: number
}

// satelliteMatrixList 数组项类型
export interface SatelliteMatrixItem {
  norad: number
  name: string
  satType: string
  /**
   * 服务时长(分钟)
   */
  serviceDuration: number
  /**
   * 卫星状态 0-未打击 1-被打击
   */
  satelliteStatus: number
  /**
   * 拦截系统配置
   */
  weapons: Weapon[]
  /**
   * 初始时间窗口
   */
  initWindows: CommInitWindow[] | null
}

// attackPlanList 数组项类型
export interface CommunicationAttackPlanItem {
  /**
   * 武器名称
   */
  weaponName: string
  /**
   * 武器类型
   */
  weaponType: string
  /**
   * 开始时间
   */
  beginTime: string | null
  /**
   * 结束时间
   */
  endTime: string | null
  /**
   * 角度
   */
  angle: number
  /**
   * 时间窗口列表
   */
  windows: CommInitWindow[]
  /**
   * 目标名称
   */
  target: string
  /**
   * 目标ID
   */
  targetId: string
  /**
   * 目标类型
   */
  targetType: string
}

/**
 * [类型用途]
 * 武器攻击计划统一单项数据结构类型（兼容侦察卫星打击记录 WeaponAttackRecord 与通讯卫星打击记录 CommunicationAttackPlanItem）。
 *
 * [数据来源]
 * MatrixResult.attackPlanList 或 CommucationMatrix.attackPlanList 元素。
 */
export type AttackPlanItem = WeaponAttackRecord | CommunicationAttackPlanItem

// 顶层 data 对象类型
export interface CommucationMatrix {
  /**
   * 初始时间窗口列表
   */
  initMatrixList: InitMatrixItem[]
  /**
   * 卫星矩阵（包含攻击/干扰及延迟信息）
   */
  satelliteMatrixList: SatelliteMatrixItem[]
  /**
   * 卫星系列
   */
  series: string
  /**
   * 攻击计划列表
   */
  attackPlanList: CommunicationAttackPlanItem[]
}

/**
 * 获取通讯卫星过境打击计划数据
 *  @param data 请求参数对象 (taskId, norad, series)
 *  @returns 包含 CommucationMatrix 的 Axios 响应 Promise
 */
export const getCommunicationsAttackMatrix = (data: {
  taskId: number
  norad?: number
  series?: string
  intensityLevel?: number
  noradIds?: number[]
}) => {
  const url = `/api/algorithm/calTxSeriesChainV2`
  return requestAPI.post<AxiosResponseType<CommucationMatrix>>(url, data)
}

/**
 * 获取卫星类型-卫星系列对应的关系
 */
export const getSatelliteTypeSerials = (taskId: number) => {
  const url = `/api/algorithm/getSysSeries?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<Record<string, string[]>>>(url)
}
/**
 * 卫星威胁度等相关信息数据结构
 */
export interface SatelliteThreatInfo {
  satelliteBaseModelResp: {
    /** 卫星 NORAD 编号 */
    norad: number
    /** 英文名称 */
    name_en: string
    /** 载荷类型 */
    sat_type: string
    /** 在轨状态 */
    orbitStatusIndicator: number
    /** 国别 */
    countryIndicator: number
    /** 用户属性 */
    usageIndicator: number
    /** 剩余工作寿命 */
    remainLifetimeIndicator: number
  }
  /** 成像分辨率 */
  zhchResolution: number
  /** 成像幅宽 */
  zhchSwathWidth: number
  /** 高轨卫星定点位置 */
  zhchFixedPosition: number | null
  /** 降交点地方时 */
  zhchLtdn: number
  /** 重访周期 */
  zhchCycle: number
  /** 威胁度 */
  threatScore: number
  /** 威胁度计算公式 */
  formula: string
}
/**
 * 根据卫星Norad编号、卫星类型、任务ID获取卫星威胁度等相关信息
 * @param data 请求参数对象 (norad, sysType, taskId)
 * @returns 包含卫星威胁度等相关信息的 Axios 响应 Promise
 */
export const getSatelliteThreatInfo = (data: { norad: number; series: string; taskId: number }) => {
  const url = `/api/algorithm/satelliteCapModel?sysType=${data.series}&taskId=${data.taskId}&norads=${data.norad}`
  return requestAPI.get<AxiosResponseType<SatelliteThreatInfo[]>>(url)
}

// ==================== 综合打击方案（军用/民用）响应类型 ====================

/**
 * 综合打击方案中按卫星系列划分的矩阵实体。
 *
 * 结构与 {@link MatrixResult} 一致，用于 `zhchPlanV2` 返回的 `levelSeriesEntities` 元素。
 * 无星间中继时 `relayRelation` 为 null。
 */
export interface ZhchPlanLevelSeriesEntity {
  /** 打击烈度等级（如："智能"） */
  intensityLevel: string
  /** 任务 Id */
  taskId: number
  /** 打击前初始过境时间窗口列表 */
  initMatrixList: InitMatrix[]
  /** 星间中继拓扑；该系列无中继时为 null */
  relayRelation: RelayRelation | null
  /** 打击前站间拓扑关联 */
  initRelationList: StationRelationList
  /** 打击后卫星矩阵（含延迟与武器部署） */
  satelliteMatrixList: SatelliteMatrix[]
  /** 打击后站间拓扑关联 */
  stationRelationList: StationRelationList
  /** 卫星系列名称（如 "SBSS"、"ICEYE"） */
  series: string
  /** 武器攻击计划列表 */
  attackPlanList: WeaponAttackRecord[]
  /** 威胁卫星列表 */
  threatSats: ThreatSatelliteItem[]
  /** 链路时延效果列表 */
  timeEffects: TimeEffectsItem[]
}

/**
 * 接收站过境窗口信息（综合打击方案场景）。
 * 与 {@link StationWindow} 结构一致。
 */
export type ZhchPlanStationWindow = StationWindow

/**
 * 卫星矩阵项（综合打击方案场景）。
 * 与 {@link SatelliteMatrix} 结构一致。
 */
export type ZhchPlanSatelliteMatrix = SatelliteMatrix

/**
 * 综合打击方案响应（zhchPlanV2）——基于军用/民用类型的卫星情报链路阻断方案。
 *
 * 顶层为全局统计与概述；各卫星系列的详细打击矩阵在 `levelSeriesEntities` 中，
 * 每项结构与 {@link MatrixResult} 一致。
 */
export interface ZhchPlanResp {
  /** 打击烈度等级；未指定时为 null */
  intensityLevel: string | null
  /** 方案概述文字描述 */
  summary: string
  /** 可见过境窗口总数 */
  visibleWindowNum: number
  /** 被打击压制的可见过境窗口数 */
  visibleWindowStrikeNum: number
  /** 数据回传窗口总数 */
  feedbackWindowNum: number
  /** 打击前最早回传窗口（含时间与卫星->接收站描述） */
  beforeFirstFeedbackTime: string
  /** 打击后最早回传窗口（含时间与卫星->接收站描述） */
  afterFirstFeedbackTime: string
  /** 涉及的侦察卫星数量 */
  satNum: number
  /** 涉及的可用地面站（接收站）数量 */
  stationNum: number
  /** 可用地面站名称列表 */
  stationList: string[]
  /** 打击前态势描述 */
  beforeResult: string
  /** 打击后态势描述 */
  afterResult: string
  /** 按卫星系列划分的打击矩阵列表 */
  levelSeriesEntities: ZhchPlanLevelSeriesEntity[]
}

/**
 * 基于军用/民用类型获取综合打击方案
 *
 * @param data.type - 卫星用途类型筛选条件（如"军用"、"民用"）
 * @param data.taskId - 作战任务 ID
 * @param data.intensityLevel -烈度
 * @returns 包含综合打击方案数据的 Axios 响应 Promise
 */
export const getSatelliteThreatInfoByType = (data: { type: string; taskId: number; intensityLevel?: number }) => {
  const url = `/api/algorithm/zhchPlanV2`
  return requestAPI.post<AxiosResponseType<ZhchPlanResp>>(url, data)
}

/**
 * 刷新打击方案生成缓存
 * @param data.taskId - 作战任务 ID
 * @returns 包含综合打击方案数据的 Axios 响应 Promise
 */
export const refreshZhchPlanCache = (taskId: number) => {
  const url = `/api/algorithm/delSeriesCache?taskId=${taskId}`
  return requestAPI.get<AxiosResponseType<string>>(url)
}
