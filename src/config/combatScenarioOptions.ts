/**
 * 作战场景选项（添加任务 UI；后端 saveTask 待扩展 combatScenario 字段后改为接口下发）。
 */

/** 作战背景选项 */
export interface CombatBackgroundOption {
  id: string
  label: string
}

/** 命令来源选项 */
export interface CommandSourceOption {
  id: string
  label: string
}

/** 作战阶段选项（含自动映射的作战对象/蓝方国家） */
export interface CombatPhaseOption {
  id: string
  label: string
  /** 选择该阶段后自动设置的 enemyCountryShow */
  enemyCountries: string[]
}

/** 作战预期二级选项 */
export interface CombatExpectationSecondaryOption {
  id: string
  label: string
}

/** 作战预期一级选项 */
export interface CombatExpectationPrimaryOption {
  id: string
  label: string
  children: CombatExpectationSecondaryOption[]
}

/** 作战背景可选项 */
export const COMBAT_BACKGROUND_OPTIONS: CombatBackgroundOption[] = [
  { id: 'crisis', label: '危机管控' },
  { id: 'limited', label: '有限冲突' },
  { id: 'high_intensity', label: '高烈度对抗' },
]

/** 命令来源 */
export const COMMAND_SOURCE_OPTIONS: CommandSourceOption[] = [
  { id: 'space_c2', label: '太空作战指挥中心' },
  { id: 'east_theater', label: '东部战区' },
  { id: 'north_theater', label: '北部战区' },
]

/** 作战阶段（单选） */
export const COMBAT_PHASE_OPTIONS: CombatPhaseOption[] = [
  { id: 'phase_japan', label: '对日作战阶段', enemyCountries: ['日本'] },
  { id: 'phase_taiwan', label: '对台作战阶段', enemyCountries: ['中国台湾'] },
  { id: 'phase_us_low', label: '对美低烈度作战阶段', enemyCountries: ['美国'] },
  { id: 'phase_us_high', label: '对美高烈度作战阶段', enemyCountries: ['美国'] },
]

/** 作战预期：一级 + 二级 */
export const COMBAT_EXPECTATION_PRIMARY_OPTIONS: CombatExpectationPrimaryOption[] = [
  {
    id: 'deterrence',
    label: '示威震慑',
    children: [
      { id: 'deterrence_hit_our_comm', label: '打击我方一颗通信卫星' },
      { id: 'deterrence_hit_enemy_comm', label: '打击敌方一颗通信卫星' },
    ],
  },
  {
    id: 'isolation',
    label: '信息孤困',
    children: [
      { id: 'isolation_leo_recon', label: '打击低轨侦察卫星' },
      { id: 'isolation_geo_comm', label: '打击高轨通信卫星' },
      { id: 'isolation_all_recon_comm', label: '打击所有侦察与通信卫星' },
    ],
  },
  {
    id: 'system_break',
    label: '体系突破',
    children: [
      { id: 'system_break_cov_30', label: '通信覆盖率减少30%' },
      { id: 'system_break_cov_60', label: '通信覆盖率减少60%' },
      { id: 'system_break_cov_90', label: '通信覆盖率减少90%' },
    ],
  },
]

/**
 * 前端本地保存的作战场景组合（待后端接入）。
 */
export interface CombatScenarioSelection {
  backgroundId: string
  commandSourceId: string
  combatPhaseId: string
  expectationPrimaryId: string
  expectationSecondaryId: string
}

/** localStorage 键前缀 */
const STORAGE_KEY_PREFIX = 'satellite.combatScenario.task.'

/**
 * 读取任务关联的作战场景选择。
 *
 * @param taskId 任务 ID
 */
export function loadCombatScenarioForTask(taskId: number): CombatScenarioSelection | null {
  if (!Number.isFinite(taskId)) return null
  const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${taskId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CombatScenarioSelection & Record<string, unknown>
    if (parsed.combatPhaseId) return parsed as CombatScenarioSelection
    return migrateLegacyCombatScenario(parsed)
  } catch {
    return null
  }
}

/**
 * 兼容旧版 localStorage 结构。
 */
function migrateLegacyCombatScenario(legacy: Record<string, unknown>): CombatScenarioSelection | null {
  const backgroundId = String(legacy.backgroundId ?? COMBAT_BACKGROUND_OPTIONS[0]?.id ?? '')
  return {
    backgroundId,
    commandSourceId: COMMAND_SOURCE_OPTIONS[0]?.id ?? '',
    combatPhaseId: COMBAT_PHASE_OPTIONS[0]?.id ?? '',
    expectationPrimaryId: COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.id ?? '',
    expectationSecondaryId: COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.children[0]?.id ?? '',
  }
}

/**
 * 保存任务作战场景选择（仅前端；待 POST /api/battle/saveTask 扩展字段）。
 */
export function saveCombatScenarioForTask(taskId: number, selection: CombatScenarioSelection): void {
  if (!Number.isFinite(taskId)) return
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${taskId}`, JSON.stringify(selection))
}

/**
 * 根据作战阶段 ID 解析蓝方国家列表。
 *
 * @param phaseId 作战阶段 ID
 */
export function resolveEnemyCountriesByCombatPhase(phaseId: string): string[] {
  const phase = COMBAT_PHASE_OPTIONS.find((item) => item.id === phaseId)
  return phase ? [...phase.enemyCountries] : []
}

/**
 * 生成方案用组合键。
 */
export function buildCombatScenarioCompositeKey(selection: CombatScenarioSelection | null): string {
  if (!selection) return ''
  return [
    selection.backgroundId,
    selection.commandSourceId,
    selection.combatPhaseId,
    selection.expectationPrimaryId,
    selection.expectationSecondaryId,
  ]
    .filter(Boolean)
    .join('|')
}

/** @deprecated 仅兼容旧引用，请使用 COMBAT_EXPECTATION_PRIMARY_OPTIONS */
export const COMBAT_EXPECTATION_GROUPS = COMBAT_EXPECTATION_PRIMARY_OPTIONS.map((p) => ({
  id: p.id,
  label: p.label,
  options: p.children,
}))

/** @deprecated 仅兼容旧引用 */
export const COMBAT_PHASE_GROUPS = [
  {
    id: 'legacy',
    label: '作战阶段',
    options: COMBAT_PHASE_OPTIONS.map((p) => ({ id: p.id, label: p.label })),
  },
]
