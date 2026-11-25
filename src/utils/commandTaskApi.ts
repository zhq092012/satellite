import type { TaskForm, TaskResourceItem, TaskResourceSatelliteItem } from '@/types/task/task'

/**
 * 写入 `POST|PUT /api/command-task` 的请求体（OpenAPI `CommandTaskReq`）。
 */
export interface CommandTaskWriteBody {
  /** 任务 id（编辑必填） */
  id?: string
  /** 所属作战命令 id */
  commandId: string
  /** 任务名称 */
  name: string
  /** 描述 */
  description: string
  /** 开始日期 yyyy-MM-dd HH:mm */
  beginDate: string
  /** 结束日期 yyyy-MM-dd HH:mm */
  endDate: string
  /** 任务区域 */
  areas: TaskForm['areas']
  /** 挂载卫星 NORAD 列表 */
  noradId: string[]
  /** 接收站 id 列表 */
  receiveStationIdList: string[]
  /** 武器代号列表 */
  weaponCodeList: string[]
}

/**
 * 从挂载卫星项解析 NORAD（优先数字型 resourceId / noradId / code）。
 *
 * @param item 任务卫星挂载项
 * @returns NORAD 字符串；无法解析时为 null
 */
export const resolveNoradIdFromTaskSatellite = (item: TaskResourceItem): string | null => {
  const noradField = (item as TaskResourceSatelliteItem).noradId
  const candidates = [noradField, item.resourceId, item.code]
  for (const raw of candidates) {
    const value = String(raw ?? '').trim()
    if (!value) continue
    if (/^\d+$/.test(value)) return value
  }
  const fallback = String(item.resourceId ?? item.code ?? '').trim()
  return fallback || null
}

/**
 * 将前端任务表单转为作战命令任务写入体。
 *
 * @param task 任务表单（须含 `commandId`）
 * @throws 缺少 commandId / 卫星 NORAD 无法解析时抛出
 */
export const toCommandTaskWriteBody = (task: TaskForm): CommandTaskWriteBody => {
  const commandId = String(task.commandId ?? '').trim()
  if (!commandId) {
    throw new Error('toCommandTaskWriteBody: 缺少所属作战命令 id（commandId）')
  }

  const noradId: string[] = []
  for (const satellite of task.satellites ?? []) {
    const resolved = resolveNoradIdFromTaskSatellite(satellite)
    if (!resolved) {
      throw new Error(
        `toCommandTaskWriteBody: 卫星「${satellite.name || satellite.resourceId}」无法解析 NORAD`,
      )
    }
    noradId.push(resolved)
  }

  const receiveStationIdList = (task.receiveStations ?? [])
    .map((item) => String(item.resourceId ?? '').trim())
    .filter(Boolean)

  const weaponCodeList = (task.weapons ?? [])
    .map((item) => String(item.code || item.resourceId || '').trim())
    .filter(Boolean)

  const body: CommandTaskWriteBody = {
    commandId,
    name: task.name,
    description: task.description ?? '',
    beginDate: task.beginDate,
    endDate: task.endDate,
    areas: task.areas ?? [],
    noradId,
    receiveStationIdList,
    weaponCodeList,
  }

  if (task.id != null && String(task.id).trim()) {
    body.id = String(task.id).trim()
  }

  return body
}