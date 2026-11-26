import type { TaskAssembleRow } from '@/components/BattleSituation/TaskAssembleTab.vue'
import {
  COMMAND_SOURCE_OPTIONS,
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  type CombatScenarioSelection,
} from '@/config/combatScenarioOptions'
import { MISSION_SYS_TYPES } from '@/constants/missionSatellite'
import type { CommandForm } from '@/types/command/command'
import type {
  TaskForm,
  TaskResourceItem,
  TaskResourceSatelliteItem,
  TaskResourceStationItem,
  TaskResourceWeaponItem,
} from '@/types/task/task'
import {
  parseCommandEnemyCountries,
  resolveCombatCountriesForContext,
  resolveCombatScenarioSelectionFromCommand,
} from '@/utils/commandEntity'
import { normalizeTaskAreaFromApi } from '@/utils/taskAreaGeo'

/** 新建任务默认作战对象（与默认作战阶段一致） */
export const DEFAULT_TASK_COMBAT_COUNTRY = '美国'

/**
 * 将国家输入规范为字符串数组（兼容逗号/顿号分隔字符串与历史数组字段）。
 *
 * @param value `country` 或历史接口残留
 */
export const parseTaskCombatCountries = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
  }
  if (typeof value === 'string') {
    return [...new Set(value.split(/[,，、|]/).map((item) => item.trim()).filter(Boolean))]
  }
  return []
}

/**
 * 将作战对象国家列表写入任务 `country` 字段。
 *
 * @param countries 国家列表
 */
export const formatTaskCountryField = (countries: string[]): string =>
  parseTaskCombatCountries(countries).join(',')

/**
 * 将作战预期情形规范为字符串数组。
 *
 * @param value 接口或表单中的 expectationCases
 */
export const normalizeTaskExpectationCases = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()]
  }
  return []
}

/**
 * 将 OpenAPI `SatelliteItem` 规范为前端任务卫星挂载项（保留国家/类型/系列）。
 *
 * @param raw 接口卫星元素
 */
export const mapSatelliteItemFromApi = (raw: unknown): TaskResourceSatelliteItem => {
  const item = raw as TaskResourceSatelliteItem & {
    /** 历史/列表接口体系字段（与 `satelliteType` 同义） */
    system?: string
  }
  const noradId = String(item.noradId ?? item.resourceId ?? item.code ?? '').trim()
  const name = String(item.name ?? noradId).trim() || noradId
  const code = noradId || String(item.code ?? '').trim() || name
  const resourceId = noradId || String(item.resourceId ?? '').trim() || code
  if (!resourceId) {
    throw new Error('mapSatelliteItemFromApi: 卫星项缺少 NORAD / resourceId')
  }
  const mapped: TaskResourceSatelliteItem = {
    resourceId,
    name,
    code,
    noradId: noradId || resourceId,
  }
  const country = item.country?.trim()
  if (country) mapped.country = country
  const satelliteType = item.satelliteType?.trim() || item.system?.trim()
  if (satelliteType) mapped.satelliteType = satelliteType
  const series = item.series?.trim()
  if (series) mapped.series = series
  const line1 = item.tleLine1?.trim()
  if (line1) mapped.tleLine1 = line1
  const line2 = item.tleLine2?.trim()
  if (line2) mapped.tleLine2 = line2
  return mapped
}

/**
 * 将 OpenAPI `StationItem` 规范为前端接收站挂载项。
 *
 * @param raw 接口接收站元素
 */
export const mapStationItemFromApi = (raw: unknown): TaskResourceStationItem => {
  const item = raw as TaskResourceStationItem & { id?: string }
  const id = String(item.id ?? item.resourceId ?? '').trim()
  if (!id) {
    throw new Error('mapStationItemFromApi: 接收站项缺少 id')
  }
  const name = String(item.name ?? id).trim() || id
  return {
    resourceId: id,
    name,
    code: id,
    longitude: item.longitude,
    latitude: item.latitude,
  }
}

/**
 * 将 OpenAPI `WeaponItem` 规范为前端武器挂载项。
 *
 * @param raw 接口武器元素
 */
export const mapWeaponItemFromApi = (raw: unknown): TaskResourceWeaponItem => {
  const item = raw as TaskResourceWeaponItem
  const code = String(item.code ?? item.resourceId ?? '').trim()
  if (!code) {
    throw new Error('mapWeaponItemFromApi: 武器项缺少 code')
  }
  const name = String(item.name ?? code).trim() || code
  const mapped: TaskResourceWeaponItem = {
    resourceId: code,
    name,
    code,
  }
  const weaponType = item.weaponType?.trim()
  if (weaponType) mapped.weaponType = weaponType
  const country = item.country?.trim()
  if (country) mapped.country = country
  return mapped
}

/**
 * 从任务卫星挂载项读取 C2/列表展示用国家、体系、系列（优先接口字段）。
 *
 * @param item 任务卫星项
 */
export const resolveTaskSatelliteDisplayScope = (
  item: TaskResourceItem,
): { country?: string; system?: string; series?: string } => {
  const sat = item as TaskResourceSatelliteItem & { system?: string }
  const country = sat.country?.trim()
  const system = sat.satelliteType?.trim() || sat.system?.trim()
  const series = sat.series?.trim()
  return { country, system, series }
}

/**
 * 将任务接收站挂载项转为地面站装配表行（编辑回显；不依赖候选池反查）。
 *
 * @param item 规范化后的 `TaskResourceStationItem`
 */
export const mapTaskStationItemToAssembleRow = (item: TaskResourceStationItem): TaskAssembleRow => {
  const formatCoord = (value?: number): string => {
    if (value == null || !Number.isFinite(value)) return '--'
    return value.toFixed(3)
  }
  return {
    id: item.resourceId,
    name: item.name?.trim() || item.resourceId,
    series: '',
    type: '--',
    country: '--',
    extra1: formatCoord(item.longitude),
    extra2: formatCoord(item.latitude),
  }
}

/**
 * 将装配行转为任务挂载资源项。
 *
 * @param row 装配行
 */
export const mapAssembleRowToTaskResource = (row: TaskAssembleRow): TaskResourceItem => ({
  resourceId: row.id,
  name: row.name || row.series || row.id,
  code: row.series || row.id,
})

/**
 * 将卫星系列名转为挂载项（系列未落库 id 时以系列名作 resourceId）。
 *
 * @param series 系列名称
 */
export const mapSeriesNameToTaskSatellite = (series: string): TaskResourceItem => ({
  resourceId: series,
  name: series,
  code: series,
})

/**
 * 从任务挂载列表还原卫星系列名（优先 code，其次 name）。
 *
 * @param items 卫星挂载项
 */
export const resolveSeriesNamesFromTaskSatellites = (items: TaskResourceItem[] | undefined): string[] =>
  [
    ...new Set(
      (items ?? [])
        .map((item) => {
          const sat = item as TaskResourceSatelliteItem
          return (sat.series || item.code || item.name || item.resourceId).trim()
        })
        .filter(Boolean),
    ),
  ]

/**
 * 从任务解析作战对象国家列表（由 `country` 拆分）。
 *
 * @param task 任务
 */
/**
 * 解析作战对象国家：优先当前作战命令 `enemyCountry`，不读任务自有字段。
 *
 * @param task 任务（仅在没有 command 时回退历史 `country`）
 * @param command 所属作战命令
 */
export const resolveCombatCountriesFromTask = (
  task: TaskForm | null | undefined,
  command?: CommandForm | null,
): string[] => resolveCombatCountriesForContext(command, task?.country)

/** @deprecated 使用 {@link resolveCombatCountriesFromTask} */
export const resolveEnemyCountriesFromTask = resolveCombatCountriesFromTask

/** @deprecated 使用 {@link parseTaskCombatCountries} */
export const normalizeTaskCountryList = parseTaskCombatCountries

/**
 * 从任务实体（含历史 `enemyCountry` 数组响应）解析 `country` 字符串。
 *
 * @param raw 接口任务对象
 */
export const resolveTaskCountryFieldFromEntity = (raw: TaskForm | (TaskForm & { enemyCountry?: unknown })): string => {
  const direct = typeof raw.country === 'string' ? raw.country.trim() : ''
  if (direct) return direct
  const legacyEnemy = parseTaskCombatCountries(
    (raw as { enemyCountry?: unknown }).enemyCountry,
  )
  if (legacyEnemy.length) return formatTaskCountryField(legacyEnemy)
  return ''
}

/**
 * 规范化单条任务接口数据（`CommandTaskResp` → `TaskForm`）。
 *
 * @param raw `GET /command-task/{id}` 或列表项
 */
export const normalizeTaskFromApi = (raw: TaskForm): TaskForm => {
  const commandId = String(raw.commandId ?? '').trim()
  const satellites = Array.isArray(raw.satellites)
    ? raw.satellites.map((item) => mapSatelliteItemFromApi(item))
    : []
  const receiveStations = Array.isArray(raw.receiveStations)
    ? raw.receiveStations.map((item) => mapStationItemFromApi(item))
    : []
  const weapons = Array.isArray(raw.weapons) ? raw.weapons.map((item) => mapWeaponItemFromApi(item)) : []
  return {
    ...raw,
    commandId,
    country: resolveTaskCountryFieldFromEntity(raw),
    expectationCases: normalizeTaskExpectationCases(raw.expectationCases),
    areas: Array.isArray(raw.areas) ? raw.areas.map((area) => normalizeTaskAreaFromApi(area)) : [],
    satellites,
    receiveStations,
    weapons,
  }
}

/**
 * 规范化战场任务列表接口数据（`country`、挂载资源、`SatelliteItem` 等）。
 *
 * @param list `GET /command-task/list` 返回的 `data`
 */
export const normalizeTaskListFromApi = (
  list: (TaskForm & { commandId?: string })[] | null | undefined,
): TaskForm[] => {
  if (!Array.isArray(list)) return []
  return list.map((item) => normalizeTaskFromApi(item))
}

/** C2 / 系列筛选用卫星类型（接口无该字段时默认四分类全选）。 */
export const DEFAULT_TASK_CATALOG_TARGET_TYPES = [...MISSION_SYS_TYPES] as string[]

/**
 * 将作战场景 UI 选择写入任务实体字段（提交前调用）。
 *
 * @param selection 作战场景选择
 * @param target 任务对象子集
 */
export const applyCombatScenarioSelectionToTaskFields = (
  selection: CombatScenarioSelection,
  target: Pick<TaskForm, 'taskSource' | 'background' | 'expectation' | 'expectationCases' | 'country'>,
): void => {
  target.taskSource =
    COMMAND_SOURCE_OPTIONS.find((item) => item.id === selection.commandSourceId)?.label ?? ''
  target.background =
    COMBAT_BACKGROUND_OPTIONS.find((item) => item.id === selection.backgroundId)?.label ?? ''
  target.expectation =
    COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.id === selection.expectationPrimaryId)?.label ?? ''
  const secondary =
    COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.id === selection.expectationPrimaryId)
      ?.children.find((item) => item.id === selection.expectationSecondaryId)?.label ?? ''
  target.expectationCases = secondary ? [secondary] : []
  const phase = COMBAT_PHASE_OPTIONS.find((item) => item.id === selection.combatPhaseId)
  target.country = phase?.enemyCountries.length ? formatTaskCountryField(phase.enemyCountries) : ''
}

/**
 * 从任务实体字段反推作战场景 UI 选项 id（编辑回显）。
 *
 * @param task 任务
 */
export const resolveCombatScenarioSelectionFromTask = (
  task: TaskForm,
  command?: CommandForm | null,
): CombatScenarioSelection => {
  const fromCommand = resolveCombatScenarioSelectionFromCommand(command)
  if (fromCommand) return fromCommand

  const commandSourceId =
    COMMAND_SOURCE_OPTIONS.find((item) => item.label === task.taskSource)?.id ??
    COMMAND_SOURCE_OPTIONS[0]?.id ??
    ''
  const backgroundId =
    COMBAT_BACKGROUND_OPTIONS.find((item) => item.label === task.background)?.id ??
    COMBAT_BACKGROUND_OPTIONS[0]?.id ??
    ''
  const expectationPrimaryId =
    COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.label === task.expectation)?.id ??
    COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.id ??
    ''
  const primary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.id === expectationPrimaryId)
  const expectationCases = normalizeTaskExpectationCases(task.expectationCases)
  const secondaryLabel = expectationCases[0] ?? ''
  const expectationSecondaryId =
    primary?.children.find((item) => item.label === secondaryLabel)?.id ?? primary?.children[0]?.id ?? ''
  const combatCountries = parseTaskCombatCountries(resolveTaskCountryFieldFromEntity(task))
  const combatKey = combatCountries.join('|')
  const exactPhase = COMBAT_PHASE_OPTIONS.find((item) => item.enemyCountries.join('|') === combatKey)
  const partialPhase =
    combatCountries.length === 1
      ? COMBAT_PHASE_OPTIONS.find((item) => item.enemyCountries.join('|') === combatCountries[0])
      : undefined
  const combatPhaseId =
    exactPhase?.id ??
    partialPhase?.id ??
    COMBAT_PHASE_OPTIONS.find((item) =>
      combatCountries.every((c) => item.enemyCountries.includes(c)),
    )?.id ??
    COMBAT_PHASE_OPTIONS[0]?.id ??
    ''
  return {
    backgroundId,
    commandSourceId,
    combatPhaseId,
    expectationPrimaryId,
    expectationSecondaryId,
  }
}

/**
 * 由任务字段生成打击方案展示名（阶段-预期）。
 *
 * @param task 任务
 */
export const buildStrikePlanDisplayNameFromTask = (
  task: Pick<TaskForm, 'country' | 'expectation'> | null | undefined,
  command?: CommandForm | null,
): string => {
  const stageFromCommand = command?.stage?.trim() ?? ''
  const expectationFromCommand = command?.expectation?.trim() ?? ''
  if (stageFromCommand || expectationFromCommand) {
    if (!stageFromCommand) return expectationFromCommand
    if (!expectationFromCommand) return stageFromCommand
    return `${stageFromCommand}-${expectationFromCommand}`
  }
  const combatCountries = parseCommandEnemyCountries(command).length
    ? parseCommandEnemyCountries(command)
    : parseTaskCombatCountries(task?.country)
  const phase =
    COMBAT_PHASE_OPTIONS.find((item) =>
      item.enemyCountries.some((country) => combatCountries.includes(country)),
    )?.label ?? ''
  const expectation = task?.expectation?.trim() ?? ''
  if (!phase && !expectation) return '--'
  if (!expectation) return phase
  if (!phase) return expectation
  return `${phase}-${expectation}`
}