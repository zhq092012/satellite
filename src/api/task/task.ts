import type { AxiosResponseType } from '@/types/http'

import { requestAPI } from '@/utils/tools/request'
import type { Satellite } from '@/types/cesium/satellite'

interface SatelliteSeriesData {
    侦察: string[]
    通信: string[]
}

/** 任务装配资源项（卫星系列 + 地面站/数据中心 ID） */
export interface TaskResourceItem {
    /** 卫星系列名称 */
    series: string
    /** 接收站 ID 列表 */
    receiveIds: string[]
    /** 发射站/数据中心 ID 列表 */
    stationIds: string[]
}

/** 任务后台算法计算进度 */
export interface TaskAlgorithmProgressEntity {
    /** Mongo 文档 ID */
    _id: string
    /** 任务 ID */
    taskId: number
    /** 总体计算状态 */
    totalStatus: string
    /** 总体耗时（分钟） */
    totalMin: number | null
    /** 过境计算状态 */
    transitStatus: string
    /** 过境耗时（分钟） */
    transitMin: number | null
    /** 威胁与打击计算状态 */
    threatAndStrikeStatus: string
    /** 威胁与打击耗时（分钟） */
    threatAndStrikeMin: number | null
    /** 进度描述 */
    mes: string | null
}

/** 任务关联战场实体（列表接口嵌套返回） */
export interface TaskBattleEntity {
    /** 战场 ID */
    id: number
    /** 战场名称 */
    name: string
    /** 战场描述 */
    description: string
    /** 删除状态 */
    delStatus?: number
    /** 创建时间 */
    createTime?: number[]
    /** 更新时间 */
    updateTime?: number[]
    /** 纬度 */
    latitude?: number | null
    /** 经度 */
    longitude?: number | null
    /** 高度 */
    altitude?: number | null
    /** 战场开始时间 */
    beginDate?: string
    /** 战场结束时间 */
    endDate?: string
    /** 数据刷新频率 */
    dataRefreshRate?: string
    /** 区域 JSON */
    area?: string
    /** 创建区域模式 */
    createAreaMode?: string
    /** 圆形半径 */
    radius?: number | null
    /** 圆心 */
    center?: string | null
    /** 圆形名称 */
    circleName?: string | null
    /** 圆形 JSON */
    circleJSON?: string
}

/**
 * 任务表单（新增请求 / 列表查询返回）。
 * 提交时可附带 `meCountryShow`、`enemyCountryShow` 供前端展示，后端可忽略。
 */
export interface TaskFormNew {
    /** 任务 ID */
    id?: number
    /** 战场 ID */
    battleId: number
    /** 任务名称 */
    name: string
    /** 任务描述 */
    description: string
    /** 开始时间，格式 yyyy-MM-dd HH:mm */
    beginDate: string
    /** 结束时间，格式 yyyy-MM-dd HH:mm */
    endDate: string
    /** 卫星类型（侦察、通信），逗号分隔 */
    targetType: string
    /** 卫星类型新字段，与 targetType 一致 */
    targetTypeNew: string
    /** 覆盖率（0-100） */
    coverage: number
    /** 链路时延（分钟） */
    delayMin: number
    /** 武器 ID 列表 */
    weaponIds: string[]
    /** 红方国家，逗号分隔 */
    meCountry: string
    /** 蓝方国家，逗号分隔 */
    enemyCountry: string
    /** 红方国家多选（前端展示/提交） */
    meCountryShow?: string[]
    /** 蓝方国家多选（前端展示/提交） */
    enemyCountryShow?: string[]
    /** 装配资源列表 */
    resources: TaskResourceItem[]
    /** 创建时间（接口返回） */
    createTime?: string
    /** 更新时间（接口返回） */
    updateTime?: string
    /** 纬度（接口返回） */
    latitude?: number | null
    /** 经度（接口返回） */
    longitude?: number | null
    /** 高度（接口返回） */
    altitude?: number | null
    /** 前推小时（接口返回） */
    forwardH?: number | null
    /** 国家汇总字段（接口返回） */
    country?: string
    /** 作战步骤 JSON 字符串 */
    steps?: string
    /** 关注状态：0 未关注，1 已关注 */
    focusStatus?: number
    /** 算法计算进度（接口返回） */
    algorithmProgressEntity?: TaskAlgorithmProgressEntity
    /** 关联战场（接口返回） */
    battleEntity?: TaskBattleEntity
}


/**
 * 任务矩阵
 */
export interface SatelliteAnalysisData {
    //打击前首次通信链路时间 2026-09-17 09:28:09(starshield122->威尔克斯巴里站)
    beforeFirstFeedbackTime: string | null;
    //打击后首次通信链路时间 2026-09-17 09:29:44(starshield108->威尔克斯巴里站)， 也可能是'无'，null或'无'都表示没有通信链路
    afterFirstFeedbackTime: string | null;
    /** 打击前平均覆盖率（百分比） */
    beforeAvgCoverage?: number;
    afterAvgCoverage: number;//打击后平均覆盖率
    satNum: number;//卫星数量
    stationNum: number;//接收站数量
    stationList: string[];//接收站列表，可能为空数组[]
    levelSeriesEntities: LevelSeriesEntity[];//卫星系列对应实体列表
}

/**
 * 卫星系列对应的实体
 */
export interface LevelSeriesEntity {
    intensityLevel: string;//打击强度等级
    taskId: number;//任务ID
    initMatrixList: InitMatrix[];//打击前卫星矩阵列表
    //普通卫星与中继卫星的关系，可能为null，表示数据传输链路没有经过中继卫星，链路:普通卫星->接收站->数据中心
    relayRelation: RelayRelation | null;
    initRelationList: RelationList | null;//接收站->数据中心打击前关系列表，可能为null,因为通信卫星不计算过站，所以没有关系列表
    satelliteMatrixList: SatelliteMatrix[];//打击后卫星矩阵列表
    stationRelationList: RelationList;//接收站->数据中心打击后关系列表
    series: string;//卫星系列，比如STARLINK，Capella，等等
    sysType: string;//卫星系统类型，只有侦察，通信，2种
    attackPlanList: AttackPlan[];//打击方案列表
    threatSats: ThreatSatellite[];//卫星威胁度列表
    timeEffects: TimeEffect[];//卫星时延列表
}

/** 初始卫星矩阵 */
export interface InitMatrix {
    norad: number;//卫星NORAD号
    name: string;//卫星名称
    satType: string;//卫星类型
    line1: string;//TLE第一行
    line2: string;//TLE第二行
    orbitType: number;//轨道类型
    usage: string;//用途（军用、民用/商用）
    battleWindow: string;//卫星打击窗口
    height: number | null;//高度，可能为null，卫星的高度不应该为null,所以不要从这里取数据，应该从TLE推断卫星的高度
    initWindows: InitWindow[];//初始卫星-接收站窗口列表
    coverage: number;//打击前卫星覆盖率，82.35294117647058，保留2位小数，表示卫星覆盖率是82.35% 
}

/** 卫星与接收站的初始窗口 ,通信卫星不过站，所以可能为null */
export interface InitWindow {
    receiveId: string | null;//接收站ID，可能为null
    receiveName: string | null;//接收站名称，可能为null
    receiveLat: number | null;//接收站纬度，可能为null ,负的表示南纬，正的表示北纬
    receiveLon: number | null;//接收站经度，可能为null ,负的表示西经，正的表示东经
    receiveUsage: string | null;//接收站用途，可能为null
    peakWindow: string;//开始过境接收站窗口
    endWindow: string;//结束过境接收站窗口
    battleWindow: string;//接收站打击窗口
    height: number | null;//高度，可能为null，接收站的高度一般都是0，cesium中贴地显示，如果不为null,忽略数值，也按照0处理
}

/** 普通卫星与中继卫星的关系 */
export interface RelayRelation {
    relayList: number[];//中继卫星ID列表
    satelliteList: number[];//卫星ID列表
    relations: RelayRelationItem[];//中继关系列表
}
/** 普通卫星与中继卫星的关系项 包含普通卫星与中继卫星的可见窗口列表*/
export interface RelayRelationItem {
    from: string;//普通卫星ID
    to: string;//中继ID
    visibilityWindows: VisibilityWindow[];//普通卫星与中继卫星的可见窗口列表
}

/** 时间窗口 开始-结束 通用类型，格式：2026-09-17 09:28:09*/
export interface VisibilityWindow {
    beginWindow: string;//开始时间
    endWindow: string;//结束时间
}

/** 接收站->数据中心打击前关系列表 */
export interface RelationList {
    receiveObjList: ReceiveObject[];//接收站对象列表
    stationObjList: StationObject[];//数据中心对象列表
    relations: StationRelation[];//地面站关系列表
}

/** 接收站对象 */
export interface ReceiveObject {
    receiveId: string;//接收站ID
    receiveName: string;//接收站名称
    receiveUsage: string;//接收站用途，军用、民用/商用
    receiveLatLon: string;//接收站经纬度，格式：纬度,经度，如：39.90872,116.39749
    receiveStatus: number;//接收站状态 0:正常 1:异常 ，1代表被打击0代表未打击
}

/** 数据中心对象 */
export interface StationObject {
    stationId: string;//数据中心ID
    stationName: string;//数据中心名称
    stationLatLon: string;//数据中心经纬度
    stationStatus: number;//数据中心状态
}

/** 接收站->数据中心关系 */
export interface StationRelation {
    from: string;//接收站ID
    to: string;//数据中心ID
    visibilityWindows: VisibilityWindow[] | null;
}

/** 卫星矩阵 */
export interface SatelliteMatrix {
    norad: number;//卫星NORAD号
    name: string;//卫星名称
    satType: string;//卫星类型
    delayMin: number | null;//链路时延（分钟），可能为null，表示没有链路时延
    satelliteStatus: number;//卫星状态 0:正常 1:异常 ，1代表被打击0代表未打击
    orbitType: number;//轨道类型，0:未知 1:低轨 2:中轨 3:高轨 4:大椭圆
    usage: string;//卫星用途，军用、民用/商用
    battleWindow: string;//卫星打击窗口，只有一个打击时间，格式：2026-09-17 09:28:09
    weapons: Weapon[];//打击卫星的武器列表，注意和打击接收站的武器列表是不同的
    height: number | null;//卫星高度，可能为null，表示卫星的高度不应该为null,所以不要从这里取数据，应该从TLE推断卫星的高度
    stationWindows: StationWindow[];//卫星-接收站窗口列表
    coverage: number;//打击后卫星覆盖率，82.35294117647058，保留2位小数，表示卫星覆盖率是82.35%
}

/** 武器 */
export interface Weapon {
    id: string;//武器ID
    name: string;//武器名称
    country: string;//武器所属国家
    type: string;//武器类型，动能，定向能，电子干扰，地面武器，4种类型
    satellite_type: string;//打击卫星的类型，注意：这里的类型不是侦察、通信，而是真实的卫星类型，比如：低轨光学卫星
    interval: string;//武器间隔，单位：分钟，比如：10分钟，表示每隔10分钟打击一次
    latitude: string;//武器纬度，格式：纬度，如：39.90872
    longitude: string;//武器经度，格式：经度，如：116.39749
    range: string;//武器范围，单位：公里，比如：1000公里，表示武器的打击范围是1000公里
}

/** 卫星-地面站窗口 */
export interface StationWindow {
    receiveId: string;//接收站ID
    receiveName: string;//接收站名称
    receiveUsage: string;//接收站用途，军用、民用/商用
    peakWindow: string;//开始过境接收站窗口，格式：2026-09-17 09:28:09
    endWindow: string;//结束过境接收站窗口，格式：2026-09-17 09:28:09
    strikeStatus: number;//打击状态 0:正常 1:异常 ，1代表被打击0代表未打击
    chainStrikeStatus: number;//链路打击状态 0:正常 1:异常 ，1代表被打击0代表未打击
    duration: number;//链路时延（分钟），可能为null，表示没有链路时延
    weapons: Weapon[];//打击接收站的武器列表，注意和打击卫星的武器列表是不同的
}

/** 武器打击方案 */
export interface AttackPlan {
    weaponName: string;//武器名称
    weaponType: string;//武器类型，目前只有：定向能,动能，电子干扰，地面武器，4种类型
    beginTime: string;//打击开始时间 格式：2026-09-17 09:28:09
    endTime: string;//打击结束时间 格式：2026-09-17 09:28:09
    angle: number;//可打击仰角范围，单位：度，比如45度，表示可以打击45度仰角的卫星
    windows: AttackWindow[];//打击窗口列表
    target: string;//目标名称，可能是卫星名称，可能是接收站名称
    targetId: string;//目标ID，可能是卫星ID，可能是接收站ID
    targetType: string;//目标类型，可能是卫星，可能是接收站
}
/**
 * 打击窗口 开始-结束 通用类型，
 */
export interface AttackWindow {
    beginWindow: string;//开始时间，格式：2026-09-17 09:28:09
    endWindow: string;//结束时间，格式：2026-09-17 09:28:09
}

/** 卫星威胁度 */
export interface ThreatSatellite {
    norad: number;//卫星NORAD号
    name: string;//卫星名称
    satType: string;//卫星类型：注意这里是卫星真正的类型，比如：低轨光学卫星，侦察/军事，环境监测，等等
    threatScore: number;//打击前威胁得分，0.525，就是这个格式，保留3位小数
    afterThreatScore: number;//打击后威胁得分，0.525，就是这个格式，保留3位小数，可能为0.000，表示彻底打掉了，所以没有威胁
}

/** 卫星时延 */
export interface TimeEffect {
    norad: number;//卫星NORAD号
    name: string;//卫星名称
    satType: string;//卫星类型：注意这里是卫星真正的类型，比如：低轨光学卫星，侦察/军事，环境监测，等等
    beginTime: string;//开始时间，格式：2026-09-17 09:28:09
    endTime: string;//结束时间，格式：2026-09-17 09:28:09
    duration: number;//打击前时延（分钟），可能为null，格式：0.1，表示0.1分钟，超过1小时显示为：xx小时xx分钟
    afterDuration: number;//打击造成的时延增量（分钟），可能为null；打击后真实时延 = duration + afterDuration
    receiveName: string;//接收站名称
}


/**
 * 查询卫星系列
 */
export const getSatelliteSeries = (countryList: string[]) => {
    const url = `/api/algorithm/getSeries?enemyCountryList=${countryList.join(',')}`
    return requestAPI.get<AxiosResponseType<SatelliteSeriesData>>(url)
}

/**
 * 根据系列查询卫星
 */
export const getSatelliteBySeries = (series: string) => {
    const url = `/api/algorithm/querySatBySeries?series=${series}`
    return requestAPI.get<AxiosResponseType<Satellite[]>>(url)
}

/**
 * 获取任务矩阵
 */
export const getTaskMatrix = (data: { taskId: string }) => {
    const url = '/api/algorithm/taskMatrix'
    return requestAPI.post<AxiosResponseType<SatelliteAnalysisData>>(url, data)
}

/**
 * 新增任务
 */
export const addTask = (data: TaskFormNew) => {
    const url = '/api/battle/saveTask'
    return requestAPI.post<AxiosResponseType<any>>(url, data)
}
