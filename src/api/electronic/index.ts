import { requestAPI } from '@/utils/http/request'

import type { AxiosResponseType } from '@/types/http'

/**
 * 通过calSeriesChain算法获取过境、过基站、延迟、打击四个矩阵的数据
 */
// 初始接收时间窗类型
export interface InitWindow {
  receiveId: string;
  receiveName: string;
  receiveLat: number;
  receiveLon: number;
  receiveUsage: string;
  peakWindow: string;
}

// 初始矩阵卫星项类型
export interface InitMatrixItem {
  norad: number;
  name: string;
  satType: string;
  initWindows: InitWindow[];
}

// 接收站与云集群关联关系类型（用于 initRelationList 和 stationRelationList）
export interface RelationItem {
  receiveId: string;
  receiveName: string;
  receiveUsage: string;
  stationId: string;
  stationName: string;
}

// 站点时间窗（打击/干扰状态）类型
export interface StationWindow {
  receiveId: string;
  receiveName: string;
  receiveUsage: string;
  peakWindow: string;
  strikeStatus: number;
  weaponNames: string[];
}

// 卫星矩阵项类型
export interface SatelliteMatrixItem {
  norad: number;
  name: string;
  satType: string;
  delayMin: number;
  stationWindows: StationWindow[];
}

// 顶层 data 对象的类型定义
export interface MatrixResult {
  initMatrixList: InitMatrixItem[];
  initRelationList: RelationItem[];
  satelliteMatrixList: SatelliteMatrixItem[];
  stationRelationList: RelationItem[];
}
/**
 * 获取过境、过基站、延迟、打击四个矩阵的数据
 * @returns
 */
export const getMatrixList = (data: { norad: number, taskId: string }) => {
  let url = `/api/algorithm/calSeriesChain`
  return requestAPI.post<AxiosResponseType<MatrixResult>>(url, data)
}

