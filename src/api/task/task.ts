import type { AxiosResponseType } from '@/types/http'

import { requestAPI } from '@/utils/tools/request'
import type { BattleTaskResourceResp, TaskForm } from '@/types/task/task'
import { isResourceApiSuccess } from '@/utils/resourceApi'

export type {
  BattleTaskResourceResp,
  TaskForm,
  TaskArea,
  TaskCombatArea,
  TaskResourceItem,
  TaskResourceSatelliteItem,
  TaskResourceStationItem,
  TaskRelationEndpointOption,
  TaskTargetRelation,
  TaskTargetRelationKind,
} from '@/types/task/task'

export type { SatelliteSeriesData } from '@/types/satellite/satellite'

/**
 * 按战场 ID 查询任务列表。
 * 列表只能按战场筛选，须传 `battleId`。
 *
 * @param battleId 战场 ID
 */
export const getTaskList = (battleId: string | number) => {
    return requestAPI.get<AxiosResponseType<TaskForm[]>>('/api/battle-task/list', {
        battleId: String(battleId),
    })
}

/**
 * 按任务 ID 查询详情。
 *
 * @param taskId 任务 ID
 */
export const getTaskById = (taskId: string | number) => {
    return requestAPI.get<AxiosResponseType<TaskForm>>(`/api/battle-task/${taskId}`)
}

/**
 * 新增任务。
 *
 * @param task 任务表单；成功时 `data` 一般为新任务 ID
 */
export const createTask = (task: TaskForm) => {
    return requestAPI.post<AxiosResponseType<string>>('/api/battle-task', task)
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
export const deleteTask = (taskId: string | number) => {
    return requestAPI.delete<AxiosResponseType<unknown>>(`/api/battle-task/${taskId}`)
}

/**
 * 获取指定任务下的所有挂载资源（卫星含 TLE、接收站含经纬度、武器清单）。
 * OpenAPI：`GET /battle-task/{id}/resources`，operationId `getResources`。
 *
 * @param taskId 任务 ID
 * @throws 业务失败或响应体无 `data` 时抛出错误
 */
export const getTaskResources = async (taskId: string | number): Promise<BattleTaskResourceResp> => {
    const id = String(taskId).trim()
    if (!id) {
        throw new Error('getTaskResources: taskId 不能为空')
    }
    const res = await requestAPI.get<AxiosResponseType<BattleTaskResourceResp>>(
        `/api/battle-task/${id}/resources`,
    )
    if (!isResourceApiSuccess(res.code) || !res.data) {
        throw new Error(res.msg || '获取任务挂载资源失败')
    }
    return res.data
}
