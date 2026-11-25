import type { CommandForm, CommandUpsertPayload } from '@/types/command/command'
import type { AxiosResponseType } from '@/types/http'
import { serializeCommandUpsertPayload } from '@/utils/commandUpsertForm'
import { requestAPI } from '@/utils/tools/request'

/**
 * 查询作战命令列表（OpenAPI `GET /command/list`）。
 */
export const getCommandList = () => {
  return requestAPI.get<AxiosResponseType<CommandForm[]>>('/api/command/list')
}

/**
 * 根据 ID 查询单个作战命令（OpenAPI `GET /command/{id}`）。
 *
 * @param id 作战命令 id
 */
export const getCommandById = (id: string | number) => {
  return requestAPI.get<AxiosResponseType<CommandForm>>(`/api/command/${id}`)
}

/**
 * 新增作战命令（OpenAPI `POST /command`）。
 *
 * @param command 命令表单；成功时 `data` 为新命令 id（字符串）
 */
export const createCommand = (command: CommandUpsertPayload) => {
  const body = serializeCommandUpsertPayload(command)
  return requestAPI.post<AxiosResponseType<string>>('/api/command', {
    ...body,
    id: body.id ?? '',
  })
}

/**
 * 更新作战命令（OpenAPI `PUT /command`）。
 *
 * @param command 须包含 `id`
 */
export const updateCommand = (command: CommandUpsertPayload) => {
  const body = serializeCommandUpsertPayload(command)
  if (!body.id) {
    throw new Error('updateCommand: 编辑作战命令缺少 id')
  }
  return requestAPI.put<AxiosResponseType<unknown>>('/api/command', body)
}

/**
 * 删除作战命令（OpenAPI `DELETE /command/{id}`，级联软删其下任务）。
 *
 * @param commandId 作战命令 id
 */
export const deleteCommand = (commandId: string | number) => {
  return requestAPI.delete<AxiosResponseType<unknown>>(`/api/command/${commandId}`)
}