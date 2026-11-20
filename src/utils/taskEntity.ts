import type { TaskAssembleRow } from '@/components/BattleSituation/TaskAssembleTab.vue'
import {
  COMMAND_SOURCE_OPTIONS,
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  type CombatScenarioSelection,
} from '@/config/combatScenarioOptions'
import { MISSION_SYS_TYPES } from '@/constants/missionSatellite'
import type { TaskForm, TaskResourceItem } from '@/types/task/task'

/** 新建任务默认红方国家 */
export const DEFAULT_TASK_OWN_COUNTRIES = ['中国'] as const

/**
 * 将任务国家字段规范为字符串数组（接口契约为数组；兼容历史逗号分隔字符串）。
 *
 * @param value 接口返回或前端残留的国家字段
 */
export const normalizeTaskCountryList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))]
  }
  if (typeof value === 'string') {
    return [...new Set(value.split(/[,，、|]/).map((item) => item.trim()).filter(Boolean))]
  }
  return []
}

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
  [...new Set((items ?? []).map((item) => (item.code || item.name || item.resourceId).trim()).filter(Boolean))]

/**
 * 从任务解析蓝方国家列表。
 *
 * @param task 任务
 */
export const resolveEnemyCountriesFromTask = (task: TaskForm | null | undefined): string[] =>
  normalizeTaskCountryList(task?.enemyCountry)

/**
 * C2 / 系列筛选用卫星类型（接口无该字段时默认四分类全选）。
 */
export const DEFAULT_TASK_CATALOG_TARGET_TYPES = [...MISSION_SYS_TYPES] as string[]

/**
 * 将作战场景 UI 选择写入任务实体字段（提交前调用）。
 *
 * @param selection 作战场景选择
 * @param target 任务对象子集
 * @param ownCountries 红方国家
 */
export const applyCombatScenarioSelectionToTaskFields = (
  selection: CombatScenarioSelection,
  target: Pick<
    TaskForm,
    'taskSource' | 'background' | 'expectation' | 'expectationCases' | 'ownCountry' | 'enemyCountry'
  >,
  ownCountries: string[] = [...DEFAULT_TASK_OWN_COUNTRIES],
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
  target.ownCountry = [...ownCountries]
  target.enemyCountry = phase ? [...phase.enemyCountries] : []
}

/**
 * 从任务实体字段反推作战场景 UI 选项 id（编辑回显）。
 *
 * @param task 任务
 */
export const resolveCombatScenarioSelectionFromTask = (task: TaskForm): CombatScenarioSelection => {
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
  const enemyCountries = normalizeTaskCountryList(task.enemyCountry)
  const enemyKey = enemyCountries.join('|')
  const combatPhaseId =
    COMBAT_PHASE_OPTIONS.find(
      (item) =>
        item.enemyCountries.join('|') === enemyKey ||
        enemyCountries.some((c) => item.enemyCountries.includes(c)),
    )?.id ?? COMBAT_PHASE_OPTIONS[0]?.id ?? ''
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
export const buildStrikePlanDisplayNameFromTask = (task: Pick<TaskForm, 'enemyCountry' | 'expectation'>): string => {
  const enemyCountries = normalizeTaskCountryList(task.enemyCountry)
  const phase =
    COMBAT_PHASE_OPTIONS.find((item) =>
      item.enemyCountries.some((country) => enemyCountries.includes(country)),
    )?.label ?? ''
  const expectation = task.expectation?.trim() ?? ''
  if (!phase && !expectation) return '--'
  if (!expectation) return phase
  if (!phase) return expectation
  return `${phase}-${expectation}`
}