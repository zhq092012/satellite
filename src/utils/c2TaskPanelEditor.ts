import type { TaskCombatArea, TaskForm, TaskResourceItem } from '@/types/dashboard'

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
  /** 链路时延（分钟）；接口缺失时为 null */
  delayMin: number | null
  /** 覆盖率（0–100）；接口缺失时为 null */
  coverage: number | null
  /** 卫星类型（侦察 / 通信） */
  targetTypeShow: string[]
  /** 任务作战区域；接口未返回完整字段时为 null */
  combatArea: TaskCombatArea | null
  /** taskList 接口字段缺失或无效时的说明（禁止静默默认值） */
  taskApiError?: string
}

/**
 * 规范化任务武器 ID 列表：去掉 null/空串、转字符串并去重（避免接口脏数据残留到 updateTask）。
 *
 * @param ids 原始 weaponIds 或草稿中的 selectedWeaponIds
 * @returns 有效武器 ID 列表
 */
export const normalizeTaskWeaponIds = (ids: unknown[] | null | undefined): string[] => {
  if (!ids?.length) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of ids) {
    if (raw == null || raw === '') continue
    const id = String(raw).trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}


/**
 * 规范化作战区域数值，避免非法值进入请求体。
 *
 * @param area 原始区域
 * @returns 规范化后的区域
 */
export const normalizeTaskCombatArea = (area: TaskCombatArea): TaskCombatArea => ({
  centerLon: Number(area.centerLon),
  centerLat: Number(area.centerLat),
  radiusKm: Math.max(0, Number(area.radiusKm)),
  enabled: Boolean(area.enabled),
})

/** taskList 接口必须返回的作战区域扁平字段名 */
export type TaskCombatAreaApiField = 'longitude' | 'latitude' | 'radius' | 'areaEnable'

/** taskList 已有任务必须齐全或有效的接口字段 */
export type TaskListApiField =
  | TaskCombatAreaApiField
  | 'delayMin'
  | 'coverage'
  | 'beginDate'
  | 'endDate'

/**
 * taskList 单条任务接口字段缺失或无效时抛出（不静默兜底）。
 */
export class TaskListItemFromApiError extends Error {
  /** 缺失或无效的接口字段 */
  readonly missingFields: TaskListApiField[]
  /** 任务 ID */
  readonly taskId?: number
  /** 任务名称 */
  readonly taskName?: string

  /**
   * @param task 任务
   * @param missingFields 缺失字段列表
   */
  constructor(task: TaskForm, missingFields: TaskListApiField[]) {
    const namePart = task.name ? `「${task.name}」` : ''
    super(
      `任务${namePart}(id=${task.id ?? '?'}) 接口未返回或无效字段：${missingFields.join('、')}。请检查 taskList 或后端入库。`,
    )
    this.name = 'TaskListItemFromApiError'
    this.missingFields = missingFields
    this.taskId = task.id
    this.taskName = task.name
  }
}

/** @deprecated 使用 {@link TaskListItemFromApiError} */
export class TaskCombatAreaFromApiError extends TaskListItemFromApiError {
  constructor(task: TaskForm, missingFields: TaskCombatAreaApiField[]) {
    super(task, missingFields)
    this.name = 'TaskCombatAreaFromApiError'
  }
}

/** 任务列表接口可能附带的区域字段别名（与前端 combatArea 命名一致） */
type TaskWithAreaFieldAliases = TaskForm & {
  centerLon?: number | string | null
  centerLat?: number | string | null
  radiusKm?: number | string | null
}

/**
 * 将接口返回的 unknown 解析为有限数字。
 *
 * @param value 原始值
 * @returns 有限数字或 null
 */
const parseFiniteAreaNumber = (value: unknown): number | null => {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

/**
 * 读取任务上的作战区域扁平字段（含接口别名）。
 *
 * @param task 任务实体
 * @returns 经纬度、半径及是否存在任意接口区域字段
 */
const readTaskAreaScalarsFromApi = (
  task: TaskForm,
): { lon: number | null; lat: number | null; radius: number | null } => {
  const withAliases = task as TaskWithAreaFieldAliases
  const lon = parseFiniteAreaNumber(task.longitude ?? withAliases.centerLon)
  const lat = parseFiniteAreaNumber(task.latitude ?? withAliases.centerLat)
  const radius = parseFiniteAreaNumber(task.radius ?? withAliases.radiusKm)
  return { lon, lat, radius }
}

/**
 * 列出 taskList 任务实体上缺失的作战区域接口字段（四项必须齐全，缺一即报错）。
 *
 * @param task 接口任务
 * @returns 缺失字段名
 */
export const getMissingTaskCombatAreaApiFields = (task: TaskForm): TaskCombatAreaApiField[] => {
  const missing: TaskCombatAreaApiField[] = []
  const { lon, lat, radius } = readTaskAreaScalarsFromApi(task)
  if (lon == null) missing.push('longitude')
  if (lat == null) missing.push('latitude')
  if (radius == null) missing.push('radius')
  if (task.areaEnable == null || !Number.isFinite(Number(task.areaEnable))) {
    missing.push('areaEnable')
  }
  return missing
}

/**
 * 严格从 taskList 接口解析作战区域，缺字段则抛错（禁止默认「启用」或补全半径）。
 *
 * @param task 接口任务
 * @returns 作战区域
 * @throws {TaskCombatAreaFromApiError} 接口字段不完整
 */
export const parseTaskCombatAreaFromApiStrict = (task: TaskForm): TaskCombatArea => {
  const missing = getMissingTaskCombatAreaApiFields(task)
  if (missing.length) {
    throw new TaskListItemFromApiError(task, missing)
  }
  const { lon, lat, radius } = readTaskAreaScalarsFromApi(task)
  return normalizeTaskCombatArea({
    centerLon: lon!,
    centerLat: lat!,
    radiusKm: radius!,
    enabled: Number(task.areaEnable) === 1,
  })
}

/**
 * 从已加载任务解析作战区域：优先用户编辑中的 combatArea，否则严格读接口扁平字段。
 *
 * @param task 任务
 * @returns 作战区域配置
 * @throws {TaskListItemFromApiError} 已有任务但接口字段不完整
 */
export const resolveTaskCombatAreaFromTask = (task: TaskForm | null | undefined): TaskCombatArea => {
  if (!task) {
    return { centerLon: 0, centerLat: 0, radiusKm: 0, enabled: false }
  }

  const fromDraft = task.combatArea
  if (
    fromDraft &&
    Number.isFinite(Number(fromDraft.centerLon)) &&
    Number.isFinite(Number(fromDraft.centerLat)) &&
    Number.isFinite(Number(fromDraft.radiusKm))
  ) {
    return normalizeTaskCombatArea({
      centerLon: Number(fromDraft.centerLon),
      centerLat: Number(fromDraft.centerLat),
      radiusKm: Number(fromDraft.radiusKm),
      enabled: Boolean(fromDraft.enabled),
    })
  }

  if (task.id) {
    return parseTaskCombatAreaFromApiStrict(task)
  }

  return { centerLon: 0, centerLat: 0, radiusKm: 0, enabled: false }
}

/**
 * 作战区域 → 后端任务实体上的扁平字段（saveTask / updateTask 只认这一套）。
 *
 * @param area 前端编辑用的区域
 * @returns longitude、latitude、radius、areaEnable
 */
export const combatAreaToApiFields = (
  area: TaskCombatArea,
): Pick<TaskForm, 'longitude' | 'latitude' | 'radius' | 'areaEnable'> => {
  const normalized = normalizeTaskCombatArea(area)
  return {
    longitude: normalized.centerLon,
    latitude: normalized.centerLat,
    radius: normalized.radiusKm,
    areaEnable: normalized.enabled ? 1 : 0,
  }
}

/**
 * 列出 taskList 已有任务上缺失或无效的必填接口字段。
 *
 * @param task 接口任务
 * @returns 字段名列表
 */
export const getMissingTaskListApiFields = (task: TaskForm): TaskListApiField[] => {
  const missing: TaskListApiField[] = [...getMissingTaskCombatAreaApiFields(task)]
  if (task.delayMin == null || !Number.isFinite(Number(task.delayMin))) {
    missing.push('delayMin')
  }
  if (task.coverage == null || !Number.isFinite(Number(task.coverage))) {
    missing.push('coverage')
  }
  const beginNorm = normalizeTaskDateTime(task.beginDate)
  const endNorm = normalizeTaskDateTime(task.endDate)
  const beginMs = parseTaskPanelTimeMs(beginNorm)
  const endMs = parseTaskPanelTimeMs(endNorm)
  if (!String(task.beginDate ?? '').trim() || !beginMs) {
    missing.push('beginDate')
  }
  if (!String(task.endDate ?? '').trim() || !endMs) {
    missing.push('endDate')
  } else if (beginMs && endMs <= beginMs) {
    missing.push('endDate')
  }
  return Array.from(new Set(missing))
}

/**
 * 校验 taskList 单条任务接口字段；不通过则抛错。
 *
 * @param task 任务
 * @throws {TaskListItemFromApiError} 字段缺失或无效
 */
export const assertTaskListItemFromApi = (task: TaskForm): void => {
  const missing = getMissingTaskListApiFields(task)
  if (missing.length) {
    throw new TaskListItemFromApiError(task, missing)
  }
}

/**
 * 将 taskList 接口任务 materialize 为前端 TaskForm（仅当字段齐全时）。
 *
 * @param task 接口原始任务
 * @returns 含 combatArea 与规范化时间/指标的任务
 * @throws {TaskListItemFromApiError} 字段缺失或无效
 */
export const materializeTaskListItemFromApi = (task: TaskForm): TaskForm => {
  assertTaskListItemFromApi(task)
  const combatArea = parseTaskCombatAreaFromApiStrict(task)
  return {
    ...task,
    beginDate: normalizeTaskDateTime(task.beginDate),
    endDate: normalizeTaskDateTime(task.endDate),
    delayMin: Number(task.delayMin),
    coverage: Number(task.coverage),
    combatArea,
    ...combatAreaToApiFields(combatArea),
  }
}

/**
 * 将 taskList 接口返回的单条任务规范化为前端使用的 TaskForm。
 *
 * @param task 接口原始任务
 * @returns 规范化后的任务或校验错误
 */
export const normalizeTaskFormFromApi = (
  task: TaskForm,
): { task: TaskForm; error?: TaskListItemFromApiError } => {
  try {
    return { task: materializeTaskListItemFromApi(task) }
  } catch (err) {
    if (err instanceof TaskListItemFromApiError) {
      const { combatArea: _drop, ...rest } = task
      return { task: { ...rest, combatArea: undefined }, error: err }
    }
    throw err
  }
}

/** 任务列表规范化结果 */
export interface NormalizeTaskListFromApiResult {
  /** 字段不全的条目保持原样且不写入 combatArea */
  tasks: TaskForm[]
  /** 接口字段校验错误 */
  errors: TaskListItemFromApiError[]
}

/**
 * 批量规范化任务列表接口数据；字段不全的任务不会注入默认作战区域。
 *
 * @param tasks 接口任务数组
 * @returns 任务列表与错误集合
 */
export const normalizeTaskListFromApi = (tasks: TaskForm[]): NormalizeTaskListFromApiResult => {
  const errors: TaskListItemFromApiError[] = []
  const normalized = tasks.map((item) => {
    const { task, error } = normalizeTaskFormFromApi(item)
    if (error) errors.push(error)
    return task
  })
  return { tasks: normalized, errors }
}

/**
 * 弹出 taskList 字段校验错误（每条任务一条消息）。
 *
 * @param errors 校验错误列表
 * @param emit 消息回调，默认由调用方传入 ElMessage.error
 */
export const notifyTaskListValidationErrors = (
  errors: TaskListItemFromApiError[],
  emit: (message: string) => void,
): void => {
  errors.forEach((err) => emit(err.message))
}

/**
 * 提交战场任务接口前：去掉仅前端使用的 `combatArea`、不提交的 `focusStatus`，并保证扁平区域字段齐全。
 *
 * @param task 内存中的任务（可含 combatArea）
 * @returns 适合 POST/PUT 的请求体
 */
export const prepareTaskForBattleApi = <T extends TaskForm>(
  task: T,
): Omit<T, 'combatArea' | 'focusStatus'> => {
  if (!task.combatArea) {
    throw new Error('提交任务缺少作战区域，请先完善任务配置')
  }
  const area = normalizeTaskCombatArea(task.combatArea)
  const { combatArea: _omitCombatArea, focusStatus: _omitFocusStatus, ...rest } = task as T & {
    focusStatus?: number
  }
  const payload = {
    ...rest,
    weaponIds: normalizeTaskWeaponIds(rest.weaponIds as unknown[]),
    ...combatAreaToApiFields(area),
  } as TaskForm
  if (task.id) {
    assertTaskListItemFromApi(payload)
  } else if (
    !Number.isFinite(Number(payload.delayMin)) ||
    !Number.isFinite(Number(payload.coverage)) ||
    !parseTaskPanelTimeMs(payload.beginDate) ||
    !parseTaskPanelTimeMs(payload.endDate)
  ) {
    throw new Error('新建任务缺少时延、覆盖率或有效起止时间')
  }
  return payload as Omit<T, 'combatArea' | 'focusStatus'>
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
 * 根据起止时间计算任务时长（小时）；时间无效时不兜底为 1 小时。
 *
 * @param beginDate 开始时间
 * @param endDate 结束时间
 * @returns 小时数；无效时为 null
 */
export const calcTaskDurationHours = (beginDate: string, endDate: string): number | null => {
  const beginMs = parseTaskPanelTimeMs(beginDate)
  const endMs = parseTaskPanelTimeMs(endDate)
  if (!beginMs || !endMs || endMs <= beginMs) return null
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
  let combatArea: TaskCombatArea | null = null
  let delayMin: number | null = null
  let coverage: number | null = null
  let beginDate = normalizeTaskDateTime(task.beginDate)
  let endDate = normalizeTaskDateTime(task.endDate)
  let taskApiError: string | undefined
  try {
    const materialized = materializeTaskListItemFromApi(task)
    combatArea = materialized.combatArea ?? null
    delayMin = materialized.delayMin ?? null
    coverage = materialized.coverage ?? null
    beginDate = materialized.beginDate
    endDate = materialized.endDate
  } catch (err) {
    if (err instanceof TaskListItemFromApiError) {
      taskApiError = err.message
    } else {
      throw err
    }
  }
  return {
    taskId: task.id,
    beginDate,
    endDate,
    selectedSeries,
    selectedWeaponIds: normalizeTaskWeaponIds(task.weaponIds as unknown[]),
    selectedReceiveIds,
    stationIds,
    delayMin,
    coverage,
    targetTypeShow: resolveTaskTargetTypesFromForm(task),
    combatArea,
    taskApiError,
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
  if (draft.taskApiError || draft.combatArea == null || draft.delayMin == null || draft.coverage == null) {
    throw new Error(draft.taskApiError || '任务接口字段不完整，无法保存')
  }
  const targetTypeValue = draft.targetTypeShow.join(',')
  const combatArea = normalizeTaskCombatArea(draft.combatArea)
  return {
    ...base,
    beginDate: normalizeTaskDateTime(draft.beginDate),
    endDate: normalizeTaskDateTime(draft.endDate),
    weaponIds: normalizeTaskWeaponIds(draft.selectedWeaponIds),
    resources: buildTaskResourcesFromDraft(draft),
    delayMin: draft.delayMin,
    coverage: draft.coverage,
    targetType: targetTypeValue,
    targetTypeNew: targetTypeValue,
    targetTypeShow: [...draft.targetTypeShow],
    combatArea: { ...combatArea },
    ...combatAreaToApiFields(combatArea),
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
