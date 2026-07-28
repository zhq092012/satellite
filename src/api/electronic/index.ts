import { requestAPI } from '@/utils/http/request'

import type { AxiosResponseType } from '@/types/http'

/// ==================== 基础子模块 ====================

// 接收站基础信息（用于关系列表）
export interface ReceiveObj {
  receiveId: string;//接收站id
  receiveName: string;//接收站名称
  receiveLatLon: string;//接收站经纬度 格式为："68.350,133.500"
  receiveStatus: number;//接收站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

// 中心云站基础信息（用于关系列表）
export interface StationObj {
  stationId: string;//中心站id
  stationName: string;//中心站名称
  stationLatLon: string;//中心站经纬度  格式为:"68.350,133.500"
  stationStatus: number;//中心站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

// 站与站之间的拓扑关联映射
export interface RelationMap {
  from: string; // 发起方id，与 receiveId 或 stationId 对应 接收站Id
  to: string;   // 接收方id，与 receiveId 或 stationId 对应 中心云站id
}

// 武器 / 拦截系统配置
export interface Weapon {
  id: string; //武器Id
  name: string; //武器名称
  country: string;//武器所属国家
  type: string;//武器类型 ()
  latitude: number;//武器纬度
  longitude: number; //武器经度
  range: number;//武器射程（km）
}

// ==================== 业务主要结构 ====================

// 初始状态下的过境窗口
export interface InitWindow {
  receiveId: string;//地面接收站id
  receiveName: string;//地面接收站名称
  receiveLat: number;//地面接收站纬度
  receiveLon: number;//地面接收站经度
  peakWindow: string;//开始过境时间窗口
  endWindow: string;//结束过境时间窗口
}

// 初始状态下的卫星矩阵元素
export interface InitMatrix {
  norad: number;//卫星id
  name: string;//卫星名称
  satType: string;//卫星类型
  line1: string;//卫星tle轨道一
  line2: string;//卫星tle轨道二
  initWindows: InitWindow[];//卫星过境时间窗口
}

// 拓扑关系列表（统一适用于 initRelationList 和 stationRelationList）
export interface StationRelationList {
  receiveObjList: ReceiveObj[];// 接收站列表
  stationObjList: StationObj[];// 中心站列表
  relations: RelationMap[];// 站与站之间的拓扑关联映射
}

// 卫星矩阵中的地面站接收窗口
export interface StationWindow {
  receiveId: string;//接收站Id
  receiveName: string;//接收站名称
  peakWindow: string;//开始过境时间窗口
  endWindow: string;//结束过境时间窗口
  strikeStatus: number;//打击状态 0-未打击 1-被打击
  weapons: Weapon[]; // 兼容数据中可能出现的 null 值 武器/拦截系统配置
}

// 卫星矩阵元素（包含攻击/干扰及延迟信息）
export interface SatelliteMatrix {
  norad: number;//卫星id
  name: string;//卫星名称
  satType: string;//卫星类型
  delayMin: number;//过基站延迟
  satelliteStatus: number;//卫星状态 0-未打击 1-被打击
  weapons: Weapon[];//武器/拦截系统配置
  stationWindows: StationWindow[];
}

// ==================== 根数据结构 ====================

export interface MatrixResult {
  initMatrixList: InitMatrix[];//初始状态下的过境时间窗口
  initRelationList: StationRelationList;//初始状态下的站与站之间的拓扑关联映射
  satelliteMatrixList: SatelliteMatrix[];//卫星矩阵（包含攻击/干扰及延迟信息）
  stationRelationList: StationRelationList;//站与站之间的拓扑关联映射
  series: string;//时间序列
}


/**
 * 获取过境、过基站、延迟、打击四个矩阵的数据
 * @returns
 */
export const getMatrixList = (data: { norad: number, taskId: string }) => {
  let url = `/api/algorithm/calSeriesChain`
  return requestAPI.post<AxiosResponseType<MatrixResult>>(url, data)
}

