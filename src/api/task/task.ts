import type { AxiosResponseType } from '@/types/http'

import { requestAPI } from '@/utils/tools/request'
import type { BattleTaskResourceResp, TaskForm } from '@/types/task/task'
import { isResourceApiSuccess } from '@/utils/resourceApi'
import { toCommandTaskWriteBody } from '@/utils/commandTaskApi'

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
 * 查询指定作战命令下的任务列表（OpenAPI `GET /command-task/list`）。
 *
 * @param commandId 所属作战命令 id（界面「场景」id）
 */
export const getTaskList = (commandId: string | number) => {
  return requestAPI.get<AxiosResponseType<TaskForm[]>>('/api/command-task/list', {
    commandId: String(commandId),
  })
}

/**
 * 按任务 ID 查询详情（OpenAPI `GET /command-task/{id}`）。
 *
 * @param taskId 任务 ID
 */
export const getTaskById = (taskId: string | number) => {
  return requestAPI.get<AxiosResponseType<TaskForm>>(`/api/command-task/${taskId}`)
}

/**
 * 新增任务（OpenAPI `POST /command-task`）。
 *
 * @param task 任务表单；成功时 `data` 一般为新任务 id
 */
export const createTask = (task: TaskForm) => {
  const body = toCommandTaskWriteBody(task)
  return requestAPI.post<AxiosResponseType<string>>('/api/command-task', body)
}

/**
 * 修改任务（OpenAPI `PUT /command-task`）。请求体须包含 `id`。
 *
 * @param task 任务表单
 */
export const updateTask = (task: TaskForm) => {
  const body = toCommandTaskWriteBody(task)
  return requestAPI.put<AxiosResponseType<unknown>>('/api/command-task', body)
}

/**
 * 删除任务（OpenAPI `DELETE /command-task/{id}`）。
 *
 * @param taskId 任务 ID
 */
export const deleteTask = (taskId: string | number) => {
  return requestAPI.delete<AxiosResponseType<unknown>>(`/api/command-task/${taskId}`)
}

/**
 * 获取指定任务下的所有挂载资源（卫星含 TLE、接收站含经纬度、武器清单）。
 * OpenAPI：`GET /command-task/{id}/resources`，operationId `getResources`。
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
    `/api/command-task/${id}/resources`,
  )
  if (!isResourceApiSuccess(res.code) || !res.data) {
    throw new Error(res.msg || '获取任务挂载资源失败')
  }
  return res.data
}