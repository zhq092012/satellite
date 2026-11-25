import {
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  COMMAND_SOURCE_OPTIONS,
  type CombatScenarioSelection,
} from '@/config/combatScenarioOptions'
import type { CommandForm } from '@/types/command/command'

/**
 * 作战命令 id 规范化（兼容历史上 number 与当前 MongoDB 字符串）。
 *
 * @param id 原始命令 id
 */
export const normalizeCommandId = (id: unknown): string => {
  if (id == null || id === '') return ''
  return String(id).trim()
}

/**
 * 判断两个作战命令 id 是否相等。
 *
 * @param left 命令 id A
 * @param right 命令 id B
 */
export const isSameCommandId = (
  left: string | number | null | undefined,
  right: string | number | null | undefined,
): boolean => {
  const a = normalizeCommandId(left)
  const b = normalizeCommandId(right)
  return a.length > 0 && a === b
}

/**
 * 历史任务 `country` 逗号分隔字符串 → 国家列表（无命令数据时兜底）。
 *
 * @param value 任务 `country`
 */
const parseLegacyTaskCountryField = (value: unknown): string[] => {
  if (typeof value !== 'string' || !value.trim()) return []
  return [...new Set(value.split(/[,，、|]/).map((item) => item.trim()).filter(Boolean))]
}

/**
 * 解析作战命令的敌方国家列表（OpenAPI `enemyCountry`）。
 *
 * @param command 作战命令
 */
export const parseCommandEnemyCountries = (command: CommandForm | null | undefined): string[] => {
  const raw = command?.enemyCountry
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))]
}

/**
 * 解析作战命令的我方国家列表（OpenAPI `ownCountry`）。
 *
 * @param command 作战命令
 */
export const parseCommandOwnCountries = (command: CommandForm | null | undefined): string[] => {
  const raw = command?.ownCountry
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map((item) => String(item).trim()).filter(Boolean))]
}

/**
 * 作战对象展示文案（命令敌方国家）。
 *
 * @param command 作战命令
 */
export const formatCommandEnemyCountryDisplay = (command: CommandForm | null | undefined): string => {
  const countries = parseCommandEnemyCountries(command)
  return countries.length ? countries.join('、') : '--'
}

/**
 * 从作战命令字段反推作战场景 UI 选项 id（C2 / 任务弹窗只读展示）。
 *
 * @param command 作战命令（`GET /command/list` 或详情）
 */
export const resolveCombatScenarioSelectionFromCommand = (
  command: CommandForm | null | undefined,
): CombatScenarioSelection | null => {
  if (!command) return null

  const commandSourceId =
    COMMAND_SOURCE_OPTIONS.find((item) => item.label === command.source?.trim())?.id ??
    COMMAND_SOURCE_OPTIONS[0]?.id ??
    ''

  const backgroundId =
    COMBAT_BACKGROUND_OPTIONS.find((item) => item.label === command.backGround?.trim())?.id ??
    COMBAT_BACKGROUND_OPTIONS[0]?.id ??
    ''

  const expectationPrimaryId =
    COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.label === command.expectation?.trim())?.id ??
    COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.id ??
    ''
  const primary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.id === expectationPrimaryId)
  const expectationOption = command.expectationOption?.trim() ?? ''
  const expectationSecondaryId =
    primary?.children.find((item) => item.label === expectationOption)?.id ??
    primary?.children[0]?.id ??
    ''

  const stageLabel = command.stage?.trim() ?? ''
  const byStage = stageLabel
    ? COMBAT_PHASE_OPTIONS.find((item) => item.label === stageLabel)
    : undefined

  const enemyCountries = parseCommandEnemyCountries(command)
  const combatKey = enemyCountries.join('|')
  const exactPhase = COMBAT_PHASE_OPTIONS.find((item) => item.enemyCountries.join('|') === combatKey)
  const partialPhase =
    enemyCountries.length === 1
      ? COMBAT_PHASE_OPTIONS.find((item) => item.enemyCountries.join('|') === enemyCountries[0])
      : undefined

  const combatPhaseId =
    byStage?.id ??
    exactPhase?.id ??
    partialPhase?.id ??
    COMBAT_PHASE_OPTIONS.find((item) =>
      enemyCountries.every((c) => item.enemyCountries.includes(c)),
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
 * 作战对象国家：优先命令 `enemyCountry`，不再读任务 `country`。
 *
 * @param command 当前作战命令
 * @param taskCountryLegacy 仅兼容历史任务实体上的 `country` 字符串
 */
export const resolveCombatCountriesForContext = (
  command: CommandForm | null | undefined,
  taskCountryLegacy?: string | null,
): string[] => {
  const fromCommand = parseCommandEnemyCountries(command)
  if (fromCommand.length) return fromCommand
  if (taskCountryLegacy != null) {
    return parseLegacyTaskCountryField(taskCountryLegacy)
  }
  return []
}