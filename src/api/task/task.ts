import type { AxiosResponseType } from '@/types/http'

import { requestAPI } from '@/utils/tools/request'
import type { SatelliteAnalysisData, TaskForm } from '@/types/task/task'

export type {
  SatelliteAnalysisData,
  TaskForm,
  TaskArea,
  TaskCombatArea,
  TaskResourceItem,
  TaskRelationEndpointOption,
  TaskTargetRelation,
  TaskTargetRelationKind,
} from '@/types/task/task'

export type { SatelliteSeriesData } from '@/types/satellite/satellite'

/**
 * 获取任务矩阵
 */
export const getTaskMatrix = (data: { taskId: string }) => {
    const url = '/api/algorithm/taskMatrix'
    return requestAPI.post<AxiosResponseType<SatelliteAnalysisData>>(url, data)
}

/**
 * 按战场 ID 查询任务列表。
 * 列表只能按战场筛选，须传 `battleId`。
 *
 * @param battleId 战场 ID
 */
export const getTaskList = (battleId: number) => {
    return requestAPI.get<AxiosResponseType<TaskForm[]>>('/api/battle-task/list', { battleId })
}

/**
 * 按任务 ID 查询详情。
 *
 * @param taskId 任务 ID
 */
export const getTaskById = (taskId: number) => {
    return requestAPI.get<AxiosResponseType<TaskForm>>(`/api/battle-task/${taskId}`)
}

/**
 * 新增任务。
 *
 * @param task 任务表单；成功时 `data` 一般为新任务 ID
 */
export const createTask = (task: TaskForm) => {
    return requestAPI.post<AxiosResponseType<number>>('/api/battle-task', task)
}

/**
 * 修改任务。请求体须包含 `id`。
 *
 * @param task 任务表单
 */
export const updateTask = (task: TaskForm) => {
    return requestAPI.put<AxiosResponseType<unknown>>('/api/battle-task', task)
}

/**
 * 删除任务。
 *
 * @param taskId 任务 ID
 */
export const deleteTask = (taskId: number) => {
    return requestAPI.delete<AxiosResponseType<unknown>>(`/api/battle-task/${taskId}`)
}
