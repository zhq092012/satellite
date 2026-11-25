
import { TASK_PANEL_SATELLITE_TYPES as MISSION_TASK_TYPES } from '@/constants/missionSatellite'
import type { TaskCombatArea, TaskForm, TaskResourceItem } from '@/types/task/task'
import {
  DEFAULT_TASK_CATALOG_TARGET_TYPES,
} from '@/utils/taskEntity'

/** 标签候选项（系列名或资源 ID + 展示名） */
export interface TaskPanelTagOption {
  /** 唯一键（系列名或资源 ID） */
  id: string
  /** 展示文案 */
  label: string
}

/** 任务未配置作战区域时的占位（不在地图展示） */
const TASK_COMBAT_AREA_EMPTY: TaskCombatArea = {
  centerLon: 0,
  centerLat: 0,
  radiusKm: 1,
  enabled: false,
}

/**
 * 从任务 `areas` 中解析首个启用圆形区域为 C2 草稿。
 *
 * @param task 任务
 */
const resolveTaskCombatAreaFromAreas = (task: TaskForm | null | undefined): TaskCombatArea => {
  const circle = task?.areas?.find((area) => area.enabled && area.type === 'CIRCLE')
  if (circle?.center && Number.isFinite(circle.center.lng) && Number.isFinite(circle.center.lat)) {
    return {
      centerLon: Number(circle.center.lng),
      centerLat: Number(circle.center.lat),
      radiusKm: Math.max(1, Number(circle.radius) || 1),
      enabled: true,
    }
  }
  return { ...TASK_COMBAT_AREA_EMPTY }
}

/**
 * 将 time / areas 等字段导出为对外仍使用的 `resolveTaskCombatAreaFromTask`。
 *
 * @param task 任务
 */
export const resolveTaskCombatAreaFromTask = (task: TaskForm | null | undefined): TaskCombatArea =>
  resolveTaskCombatAreaFromAreas(task)

/**
 * 规范化时间字符串为任务提交格式（不含秒）。
 *
 * @param value 原始时间
 * @returns `YYYY-MM-DD HH:mm` 或空串
 */
export const normalizeTaskDateTime = (value?: string): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 16)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [datePart, timePart] = trimmed.replace('T', ' ').split(' ')
    return `${datePart} ${timePart.slice(0, 5)}`
  }
  const ts = new Date(trimmed.replace(/-/g, '/')).getTime()
  if (!Number.isFinite(ts) || Number.isNaN(ts)) return trimmed
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 将任务时间转为 datetime-local 所需的 `YYYY-MM-DDTHH:mm`。
 *
 * @param value 任务时间字符串
 * @returns 原生 datetime-local 值
 */
export const toTaskDatetimeLocalValue = (value?: string): string => {
  const normalized = normalizeTaskDateTime(value)
  return normalized ? normalized.replace(' ', 'T') : ''
}

/**
 * 将 datetime-local 值转回任务时间格式。
 *
 * @param value 原生时间输入值
 * @returns `YYYY-MM-DD HH:mm`
 */
export const fromTaskDatetimeLocalValue = (value?: string): string => {
  if (!value) return ''
  return normalizeTaskDateTime(value.replace('T', ' '))
}

/**
 * 解析任务时间为毫秒。
 *
 * @param value 任务时间
 * @returns 毫秒时间戳；无效时为 0
 */
export const parseTaskPanelTimeMs = (value?: string): number => {
  const normalized = normalizeTaskDateTime(value)
  if (!normalized) return 0
  const ts = new Date(normalized.replace(/-/g, '/')).getTime()
  return Number.isFinite(ts) ? ts : 0
}

/** 任务卫星类型可选项（与 missionSatellite 常量一致） */
export const TASK_PANEL_SATELLITE_TYPES = MISSION_TASK_TYPES

/**
 * 将 Date 格式化为任务时间字符串。
 *
 * @param date 日期对象
 * @returns `YYYY-MM-DD HH:mm`
 */
export const formatDateToTaskPanelTime = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 根据起止时间计算任务时长（小时，至少 1）。
 *
 * @param beginDate 开始时间
 * @param endDate 结束时间
 * @returns 小时数
 */
export const calcTaskDurationHours = (beginDate: string, endDate: string): number => {
  const beginMs = parseTaskPanelTimeMs(beginDate)
  const endMs = parseTaskPanelTimeMs(endDate)
  if (!beginMs || !endMs || endMs <= beginMs) return 1
  return Math.max(1, Math.round((endMs - beginMs) / 3600000))
}

/**
 * 按任务时长（小时）更新任务编辑态结束时间。
 *
 * @param task 任务编辑副本
 * @param hours 时长（小时）
 */
export const applyDurationHoursToTask = (task: TaskForm, hours: number): void => {
  const beginMs = parseTaskPanelTimeMs(task.beginDate)
  if (!beginMs) return
  const safeHours = Math.max(1, Math.round(hours))
  task.endDate = formatDateToTaskPanelTime(new Date(beginMs + safeHours * 3600000))
}

/**
 * 读取任务武器资源 ID 列表（去重）。
 *
 * @param task 任务
 */
export const readTaskWeaponResourceIds = (task: TaskForm): string[] =>
  [...new Set((task.weapons ?? []).map((item) => item.resourceId).filter(Boolean))]

/**
 * 将武器资源 ID 写回任务编辑副本。
 *
 * @param task 任务编辑副本
 * @param ids 武器资源 ID
 */
export const writeTaskWeaponResourceIds = (task: TaskForm, ids: string[]): void => {
  task.weapons = ids.map((resourceId) => ({
    resourceId,
    name: resourceId,
    code: '',
  }))
}

/**
 * 从任务对象构建 C2 左侧面板本地编辑副本（`TaskForm`）。
 *
 * @param task 任务
 * @returns 编辑副本；无 ID 时返回 null
 */
export const createDraftFromTask = (task: TaskForm | null | undefined): TaskForm | null => {
  if (!task?.id) return null
  const satellites = (task.satellites ?? []).map((item) => ({
    resourceId: item.resourceId,
    name: item.name,
    code: item.code,
  }))
  const receiveStations = (task.receiveStations ?? []).map((item) => ({
    resourceId: item.resourceId,
    name: item.name,
    code: item.code,
  }))
  const weapons = (task.weapons ?? []).map((item) => ({
    resourceId: item.resourceId,
    name: item.name,
    code: item.code,
  }))
  return {
    ...task,
    beginDate: normalizeTaskDateTime(task.beginDate),
    endDate: normalizeTaskDateTime(task.endDate),
    delayMin: Number.isFinite(task.delayMin) ? Number(task.delayMin) : 60,
    coverage: Number.isFinite(task.coverage) ? Number(task.coverage) : 50,
    satellites,
    receiveStations,
    weapons,
    areas: [...(task.areas ?? [])],
    targetTypeShow: [...DEFAULT_TASK_CATALOG_TARGET_TYPES],
  }
}

/**
 * 将 C2 编辑副本合并回完整任务对象，供 `updateTask` 提交。
 *
 * @param base 原任务
 * @param editor 编辑副本
 * @returns 更新后的任务表单
 */
export const mergeTaskFormWithDraft = (base: TaskForm, editor: TaskForm): TaskForm => {
  return {
    ...base,
    beginDate: normalizeTaskDateTime(editor.beginDate),
    endDate: normalizeTaskDateTime(editor.endDate),
    delayMin: editor.delayMin,
    coverage: editor.coverage,
    areas: editor.areas ?? base.areas ?? [],
    satellites: editor.satellites.map((item) => ({
      resourceId: item.resourceId,
      name: item.name,
      code: item.code,
    })),
    receiveStations: (editor.receiveStations ?? []).map((item) => ({
      resourceId: item.resourceId,
      name: item.name,
      code: item.code,
    })),
    weapons: editor.weapons.map((item: TaskResourceItem) => ({
      resourceId: item.resourceId,
      name: item.name,
      code: item.code,
    })),
  }
}

