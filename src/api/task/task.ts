import type { AxiosResponseType } from '@/types/http'

import { requestAPI } from '@/utils/tools/request'
import type { MatrixResult } from '../electronic'
import type { Satellite } from '@/types/cesium/satellite'

interface SatelliteSeriesData {
    侦察: string[]
    通信: string[]
}

interface TaskFormNew {
    id?: number
    battleId: number //战场ID
    name: string //任务名称
    description: string //任务描述
    beginDate: string //开始时间
    endDate: string //结束时间
    targetType: string //卫星类型:侦察、通信
    coverage: number //覆盖率
    delayMin: number //链路时延(分钟)
    weaponIds: string[] //武器ID
    meCountry: string //己方国家 逗号分割
    enemyCountry: string //蓝方国家 逗号分割
    meCountryShow: string[] //己方国家展示 用于界面展示
    enemyCountryShow: string[] //蓝方国家展示 用于界面展示
    targetTypeNew: string //卫星类型:侦察、通信 逗号分隔
    resources: {
        series: string //卫星系列
        receiveIds: string[] //接收站ID
        stationIds: string[] //发射站ID
    }[]
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
    return requestAPI.post<AxiosResponseType<MatrixResult>>(url, data)
}

/**
 * 新增任务
 */
export const addTask = (data: TaskFormNew) => {
    const url = '/api/battle/saveTask'
    return requestAPI.post<AxiosResponseType<any>>(url, data)
}
