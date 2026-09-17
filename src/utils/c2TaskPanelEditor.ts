import type { TaskForm, TaskResourceItem } from '@/types/dashboard'

/** 标签候选项（系列名或资源 ID + 展示名） */
export interface TaskPanelTagOption {
  /** 唯一键（系列名或资源 ID） */
  id: string
  /** 展示文案 */
  label: string
}

/** 左侧面板内联编辑草稿 */
export interface C2TaskEditorDraft {
  /** 任务 ID */
  taskId: number
  /** 开始时间 */
  beginDate: string
  /** 结束时间 */
  endDate: string
  /** 已选卫星系列 */
  selectedSeries: string[]
  /** 已选武器 ID */
  selectedWeaponIds: string[]
  /** 已选地面接收站 ID */
  selectedReceiveIds: string[]
  /** 已选数据中心 ID */
  stationIds: string[]
  /** 链路时延（分钟） */
  delayMin: number
  /** 覆盖率（0–100） */
  coverage: number
  /** 卫星类型（侦察 / 通信） */
  targetTypeShow: string[]
}

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

/** 任务卫星类型可选项（与任务编辑弹窗一致） */
export const TASK_PANEL_SATELLITE_TYPES = ['侦察', '通信'] as const

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
 * 从任务字段解析卫星类型多选列表。
 *
 * @param task 任务
 * @returns 类型数组
 */
const resolveTaskTargetTypesFromForm = (task: TaskForm): string[] => {
  if (task.targetTypeShow?.length) return [...task.targetTypeShow]
  return (task.targetTypeNew || task.targetType || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * 按任务时长（小时）更新草稿结束时间。
 *
 * @param draft 编辑草稿
 * @param hours 时长（小时）
 */
export const applyDurationHoursToDraft = (draft: C2TaskEditorDraft, hours: number): void => {
  const beginMs = parseTaskPanelTimeMs(draft.beginDate)
  if (!beginMs) return
  const safeHours = Math.max(1, Math.round(hours))
  draft.endDate = formatDateToTaskPanelTime(new Date(beginMs + safeHours * 3600000))
}

/**
 * 从任务对象构建左侧面板编辑草稿。
 *
 * @param task 任务
 * @returns 草稿；无 ID 时返回 null
 */
export const createDraftFromTask = (task: TaskForm | null | undefined): C2TaskEditorDraft | null => {
  if (!task?.id) return null
  const resources = task.resources ?? []
  const selectedSeries = resources.map((item) => item.series).filter(Boolean)
  const selectedReceiveIds = [...new Set(resources.flatMap((item) => item.receiveIds ?? []))]
  const stationIds = [...new Set(resources.flatMap((item) => item.stationIds ?? []))]
  return {
    taskId: task.id,
    beginDate: normalizeTaskDateTime(task.beginDate),
    endDate: normalizeTaskDateTime(task.endDate),
    selectedSeries,
    selectedWeaponIds: [...(task.weaponIds ?? [])],
    selectedReceiveIds,
    stationIds,
    delayMin: Number.isFinite(task.delayMin) ? Number(task.delayMin) : 60,
    coverage: Number.isFinite(task.coverage) ? Number(task.coverage) : 50,
    targetTypeShow: resolveTaskTargetTypesFromForm(task),
  }
}

/**
 * 构建 updateTask 所需的 resources 列表（各系列共享同一组地面站/数据中心）。
 *
 * @param draft 编辑草稿
 * @returns resources 数组
 */
export const buildTaskResourcesFromDraft = (draft: C2TaskEditorDraft): TaskResourceItem[] =>
  draft.selectedSeries.map((series) => ({
    series,
    receiveIds: [...draft.selectedReceiveIds],
    stationIds: [...draft.stationIds],
  }))

/**
 * 将草稿合并回完整任务对象，供 updateTask 提交。
 *
 * @param base 原任务
 * @param draft 编辑草稿
 * @returns 更新后的任务表单
 */
export const mergeTaskFormWithDraft = (base: TaskForm, draft: C2TaskEditorDraft): TaskForm => {
  const targetTypeValue = draft.targetTypeShow.join(',')
  return {
    ...base,
    beginDate: normalizeTaskDateTime(draft.beginDate),
    endDate: normalizeTaskDateTime(draft.endDate),
    weaponIds: [...draft.selectedWeaponIds],
    resources: buildTaskResourcesFromDraft(draft),
    delayMin: draft.delayMin,
    coverage: draft.coverage,
    targetType: targetTypeValue,
    targetTypeNew: targetTypeValue,
    targetTypeShow: [...draft.targetTypeShow],
  }
}

/**
 * 按任务卫星类型从系列接口 data 中提取可选系列名。
 *
 * @param data 系列接口 data
 * @param targetTypes 任务卫星类型（侦察/通信）
 * @returns 系列名列表
 */
export const buildSeriesOptionsFromApiData = (
  data: { 侦察?: string[]; 通信?: string[] },
  targetTypes: string[]
): string[] => {
  const merged: string[] = []
  if (targetTypes.includes('侦察')) merged.push(...(data.侦察 || []))
  if (targetTypes.includes('通信')) merged.push(...(data.通信 || []))
  return Array.from(new Set(merged.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/**
 * 判断基站类型是否属于数据中心（与 TaskAssembleTab 一致）。
 *
 * @param type 基站类型文案
 * @returns 是否为数据中心
 */
export const isDataCenterStationType = (type: string): boolean => {
  const value = type || ''
  return value.includes('中心') || value.includes('数据') || value.includes('云')
}
