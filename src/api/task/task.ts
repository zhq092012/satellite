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
    beforeFirstFeedbackTime: string;
    afterFirstFeedbackTime: string;
    beforeAvgCoverage: number;
    afterAvgCoverage: number;
    satNum: number;
    stationNum: number;
    stationList: string[];

    levelSeriesEntities: LevelSeriesEntity[];
}

export interface LevelSeriesEntity {
    intensityLevel: string;
    taskId: number;

    initMatrixList: InitMatrix[];
    relayRelation: RelayRelation;
    initRelationList: RelationList;

    satelliteMatrixList: SatelliteMatrix[];
    stationRelationList: RelationList;

    series: string;
    sysType: string;

    attackPlanList: AttackPlan[];
    threatSats: ThreatSatellite[];
    timeEffects: TimeEffect[];
}

/** 初始卫星矩阵 */
export interface InitMatrix {
    norad: number;
    name: string;
    satType: string;

    line1: string;
    line2: string;

    orbitType: number;
    usage: string;

    battleWindow: string;
    height: number;

    initWindows: InitWindow[];

    coverage: number;
}

/** 卫星与接收站的初始窗口 */
export interface InitWindow {
    receiveId: string;
    receiveName: string;
    receiveLat: number;
    receiveLon: number;
    receiveUsage: string;

    peakWindow: string;
    endWindow: string;
    battleWindow: string;

    height: number;
}

/** 中继关系 */
export interface RelayRelation {
    relayList: number[];
    satelliteList: number[];
    relations: RelayRelationItem[];
}

export interface RelayRelationItem {
    from: string;
    to: string;
    visibilityWindows: VisibilityWindow[];
}

/** 卫星可见窗口 */
export interface VisibilityWindow {
    beginWindow: string;
    endWindow: string;
}

/** 卫星/地面站关系 */
export interface RelationList {
    receiveObjList: ReceiveObject[];
    stationObjList: StationObject[];
    relations: StationRelation[];
}

/** 接收对象 */
export interface ReceiveObject {
    receiveId: string;
    receiveName: string;
    receiveUsage: string;
    receiveLatLon: string;
    receiveStatus: number;
}

/** 地面站对象 */
export interface StationObject {
    stationId: string;
    stationName: string;
    stationLatLon: string;
    stationStatus: number;
}

/** 地面站关系 */
export interface StationRelation {
    from: string;
    to: string;
    visibilityWindows: VisibilityWindow[] | null;
}

/** 卫星矩阵 */
export interface SatelliteMatrix {
    norad: number;
    name: string;
    satType: string;

    delayMin: number | null;

    satelliteStatus: number;
    orbitType: number;
    usage: string;

    battleWindow: string;

    weapons: Weapon[];

    height: number;

    stationWindows: StationWindow[];

    coverage: number;
}

/** 武器 */
export interface Weapon {
    id: string;
    name: string;
    country: string;
    type: string;
    satellite_type: string;
    interval: string;
    latitude: string;
    longitude: string;
    range: string;
}

/** 卫星-地面站窗口 */
export interface StationWindow {
    receiveId: string;
    receiveName: string;
    receiveUsage: string;

    peakWindow: string;
    endWindow: string;

    strikeStatus: number;
    chainStrikeStatus: number;

    duration: number;

    weapons: Weapon[];
}

/** 打击方案 */
export interface AttackPlan {
    weaponName: string;
    weaponType: string;

    beginTime: string;
    endTime: string;

    angle: number;

    windows: AttackWindow[];

    target: string;
    targetId: string;
    targetType: string;
}

export interface AttackWindow {
    beginWindow: string;
    endWindow: string;
}

/** 威胁卫星 */
export interface ThreatSatellite {
    norad: number;//卫星NORAD号
    name: string;//卫星名称
    satType: string;//卫星类型
    threatScore: number;//威胁得分
}

/** 时间影响 */
export interface TimeEffect {
    norad: number;//卫星NORAD号
    name: string;//卫星名称
    satType: string;//卫星类型

    beginTime: string;//开始时间
    endTime: string;//结束时间

    duration: number;//链路时延（分钟）

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
