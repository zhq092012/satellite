import { requestAPI } from '@/utils/tools/request'

import type { AxiosResponseType } from '@/types/http'

/// ==================== 基础子模块 ====================

// 接收站基础信息（用于关系列表）
export interface ReceiveObj {
  receiveId: string //接收站id
  receiveName: string //接收站名称
  receiveLatLon: string //接收站经纬度 格式为："68.350,133.500"
  receiveStatus: number //接收站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

// 中心云站基础信息（用于关系列表）
export interface StationObj {
  stationId: string //中心站id
  stationName: string //中心站名称
  stationLatLon: string //中心站经纬度  格式为:"68.350,133.500"
  stationStatus: number //中心站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

// 站与站之间的拓扑关联映射
export interface RelationMap {
  from: string // 发起方id，与 receiveId 或 stationId 对应 接收站Id
  to: string // 接收方id，与 receiveId 或 stationId 对应 中心云站id
}

// 武器 / 拦截系统配置
export interface Weapon {
  id: string //武器Id
  name: string //武器名称
  country: string //武器所属国家
  type: string //武器类型 ()
  latitude: number //武器纬度
  longitude: number //武器经度
  range: number //武器射程（km）
}

// ==================== 业务主要结构 ====================

// 初始状态下的过境窗口
export interface InitWindow {
  receiveId: string //地面接收站id
  receiveName: string //地面接收站名称
  receiveLat: number //地面接收站纬度
  receiveLon: number //地面接收站经度
  peakWindow: string //开始过境时间窗口
  endWindow: string //结束过境时间窗口
}

// 初始状态下的卫星矩阵元素
export interface InitMatrix {
  norad: number //卫星id
  name: string //卫星名称
  satType: string //卫星类型
  line1: string //卫星tle轨道一
  line2: string //卫星tle轨道二
  initWindows: InitWindow[] //卫星过境时间窗口
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
  /** 中继卫星过境时间窗口列表 */
  visibilityWindows: SatelliteRelayWindow[]
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
  /** 开始过境时间窗口 */
  peakWindow: string
  /** 结束过境时间窗口 */
  endWindow: string
  /** 打击状态 0-未打击 1-被打击 */
  strikeStatus: number
  /** 单个接收窗口延时（分钟，可选） */
  delayMin?: number
  /** 兼容数据中可能出现的 null 值 武器/拦截系统配置 */
  weapons: Weapon[]
}

// 卫星矩阵元素（包含攻击/干扰及延迟信息）
export interface SatelliteMatrix {
  norad: number //卫星id
  name: string //卫星名称
  satType: string //卫星类型
  delayMin: number //过基站延迟
  satelliteStatus: number //卫星状态 0-未打击 1-被打击
  weapons: Weapon[] //武器/拦截系统配置
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
  beginWindow: string // 时间格式："YYYY-MM-DD HH:mm:ss"
  endWindow: string // 时间格式："YYYY-MM-DD HH:mm:ss"
}

export type SatelliteRelayWindow = WeaponWindow
// 主数据项接口定义
export interface WeaponAttackRecord {
  weaponName: string // 武器名称
  weaponType: string // 武器类型（如："网络病毒" | "电子干扰"）
  beginTime: string // 开始时间
  endTime: string // 结束时间
  angle: number // 角度
  windows: WeaponWindow[] // 时间窗口列表
  target: string // 目标名称
  targetType: string // 目标类型（如："接收站"）
}

/**
 * 威胁卫星单项信息
 */
export interface ThreatSatelliteItem {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型 */
  satType: string
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
   * 卫星类型
   */
  satType: string
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
   * 接收站名称
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
 * - battleMatrixList: 卫星过境战场矩阵列表
 * - initMatrixList: 初始状态下的过境时间窗口列表
 * - initRelationList: 初始状态下的站站拓扑映射
 * - satelliteMatrixList: 卫星矩阵（包含攻击/干扰及延迟信息）
 * - stationRelationList: 最终拓扑关联映射
 * - series: 卫星系列名称
 * - threatSats: 威胁卫星列表
 *
 * [使用约束]
 * 新增字段必须包含注释并明确类型。
 */
export interface MatrixResult {
  /** 攻击计划列表 */
  attackPlanList: WeaponAttackRecord[]
  /** 卫星过境战场矩阵 */
  battleMatrixList: BattleMatrixItem[]
  /** 初始状态下的过境时间窗口 */
  initMatrixList: InitMatrix[]
  /** 初始状态下的站与站之间的拓扑关联映射 */
  initRelationList: StationRelationList
  /** 卫星矩阵（包含攻击/干扰及延迟信息） */
  satelliteMatrixList: SatelliteMatrix[]
  /** 站与站之间的拓扑关联映射 */
  stationRelationList: StationRelationList
  /** 星间中继拓扑关系映射 (可选) */
  relayRelation?: RelayRelation
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
  const url = `/api/algorithm/calSeriesChain`
  return requestAPI.post<AxiosResponseType<MatrixResult>>(url, data)
}
// ==================== 通讯卫星过境打击计划 ====================
/**
 * 过境时间窗口
 */
export interface InitWindow {
  startWindow: string
  endWindow: string
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
  initWindows: InitWindow[]
  /**
   * 卫星过境服务时长（单位：分钟）
   */
  serviceDuration: number
  /**
   * 卫星高度（单位：公里）
   */
  height: number
}

/**
 * 武器装备类型
 */
export interface Weapon {
  id: string
  name: string
  country: string
  type: string
  /**
   * 可打击卫星类型
   */
  satellite_type: string | null
  /**
   * 武器坐标
   */
  latitude: number
  longitude: number
  /**
   * 武器作用距离
   */
  range: number
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
  initWindows: InitWindow[] | null
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
  windows: InitWindow[]
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
export const getCommunicationsAttackMatrix = (data: { taskId: number; norad?: number; series?: string }) => {
  const url = `/api/algorithm/calTxSeriesChain`
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
 * 接收站过境窗口信息
 *
 * 描述某颗卫星飞往对应接收站时的可见时间窗口，
 * 以及该窗口是否被红方武器打击/干扰。
 *
 * [字段规则]
 * - strikeStatus: 0 表示该窗口未被打击，1 表示已被打击/干扰
 * - weapons: 在该窗口上部署的针对接收站的武器列表，可能为空数组
 */
export interface ZhchPlanStationWindow {
  /** 接收站唯一标识 */
  receiveId: string
  /** 接收站名称 */
  receiveName: string
  /** 过境窗口峰值时间（格式如 "2025-06-09T12:00:00Z"） */
  peakWindow: string
  /** 打击状态：0-未打击 1-已打击 */
  strikeStatus: number
  /** 针对该接收站窗口部署的武器列表 */
  weapons: Weapon[]
}

/**
 * 卫星矩阵项——描述单颗侦察卫星的打击/干扰详情
 *
 * [字段规则]
 * - satelliteStatus: 0 表示该卫星未受打击/干扰，1 表示已被打击/干扰
 * - orbitType: 轨道类型枚举（1-低轨 2-中轨 3-高轨 等）
 * - delayMin: 阻断该卫星传输链路产生的延迟（分钟）
 * - weapons: 直接针对该卫星部署的武器列表
 * - stationWindows: 该卫星对应的所有接收站过境窗口
 */
export interface ZhchPlanSatelliteMatrix {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型（如"空间监视/军事"、"光学侦察"等） */
  satType: string
  /** 阻断该卫星传输链路的延迟时间（分钟） */
  delayMin: number
  /** 卫星打击状态：0-未打击 1-已打击 */
  satelliteStatus: number
  /** 轨道类型枚举值（1-低轨 2-中轨 3-高轨 等） */
  orbitType: number
  /** 用途类型（如"军用"、"民用"等） */
  usage: string
  /** 直接针对该卫星部署的武器列表 */
  weapons: Weapon[]
  /** 该卫星对应的接收站过境窗口列表 */
  stationWindows: ZhchPlanStationWindow[]
}

/**
 * 综合打击方案响应——基于军用/民用类型的卫星情报链路阻断方案
 *
 * 描述红方使用武器对蓝方侦察卫星与接收站进行干扰/打击的整体方案结果，
 * 包括方案概述、涉及的卫星/接收站/武器统计、以及每颗卫星的详细打击矩阵。
 *
 * [业务场景]
 * 蓝方侦察卫星侦察战场区域情报后，飞往对应接收站在可见窗口内传递数据。
 * 红方部署武器对卫星或接收站实施干扰/打击，延时或阻断蓝方情报传递链路。
 */
export interface ZhchPlanResp {
  /** 方案概述文字描述 */
  summary: string
  /** 涉及的侦察卫星数量 */
  satNum: number
  /** 涉及的接收站数量 */
  receiveNum: number
  /** 投入的武器总数量 */
  weaponNum: number
  /** 投入的武器种类名称列表（如 ["武器A", "武器B", "武器E"]） */
  weaponTypes: string[]
  /** 阻断卫星传输链路的平均时延（分钟） */
  avgDelayMin: number
  /** 卫星打击矩阵列表，每项描述一颗卫星的打击详情 */
  satelliteMatrixList: ZhchPlanSatelliteMatrix[]
}

/**
 * 基于军用/民用类型获取综合打击方案
 *
 * @param data.type - 卫星用途类型筛选条件（如"军用"、"民用"）
 * @param data.taskId - 作战任务 ID
 * @returns 包含综合打击方案数据的 Axios 响应 Promise
 */
export const getSatelliteThreatInfoByType = (data: { type: string; taskId: number }) => {
  const url = `/api/algorithm/zhchPlan`
  return requestAPI.post<AxiosResponseType<ZhchPlanResp>>(url, data)
}

