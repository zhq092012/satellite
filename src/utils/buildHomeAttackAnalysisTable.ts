import type { SatelliteAnalysisData } from '@/api/task/task'
import type { C2ResourceSatelliteRow } from '@/utils/buildC2ResourceCatalog'
import { buildC2SatelliteFlatRowsFromMatrix } from '@/utils/buildC2ResourceCatalog'
import { TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import { buildAttackPlanTableRows } from '@/utils/buildAttackPlanTable'
import { sortCountriesForTaskPhase } from '@/components/BattleSituation/analysis/countryAnalysisSort'
import {
  buildCombatScenarioCompositeKey,
  loadCombatScenarioForTask,
} from '@/config/combatScenarioOptions'

/** 目标攻击度分析表格行（展示用） */
export interface HomeAttackAnalysisTableRow {
  /** 行唯一键 */
  rowKey: string
  /** 所属国家 */
  country: string
  /** 卫星名称（目标） */
  satelliteName: string
  /** 卫星类型 */
  satelliteType: string
  /** 国家权重 */
  countryWeightText: string
  /** 武器名称 */
  weaponName: string
  /** 武器类型 */
  weaponType: string
  /** 攻击窗口展示 */
  attackWindowText: string
  /** 攻击度 */
  attackDegreeText: string
  /** 攻击度小字说明 */
  attackDegreeHint: string
  /** 背景加权 */
  backgroundWeightText: string
  /** 综合可攻击条件 */
  compositeAttackText: string
  /** 综合可攻击条件小字说明 */
  compositeAttackHint: string
  /** 综合可攻击条件（排序用） */
  compositeAttackSort: number | null
}

/** 攻击度分析表的数据来源 */
export type HomeAttackAnalysisDataSource =
  /** 当前任务分析矩阵 */
  | 'matrix'
  /** 矩阵为空时使用的演示行 */
  | 'mock'

const MOCK_COUNTRY_POOL = ['美国', '日本', '中国台湾'] as const

const MOCK_WEAPON_TYPES = ['动能', '定向能', '电子干扰', '地面武器'] as const

const MOCK_SAT_TYPES = ['低轨光学侦察', '低轨 SAR 侦察', '电子侦察', '通信中继'] as const

/**
 * 解析任务作战背景加权（演示；正式由 strikePlanV2 / evaluationConfig 计算）。
 *
 * @param taskId 任务 ID
 */
function resolveBackgroundWeightForTask(taskId: number): {
  weight: number
  weightText: string
  hint: string
} {
  const selection = loadCombatScenarioForTask(taskId)
  if (!selection) {
    return {
      weight: 0.75,
      weightText: '0.75',
      hint: '未配置作战场景，演示默认权重',
    }
  }
  const key = buildCombatScenarioCompositeKey(selection)
  const weight = 0.7 + (key.length % 6) * 0.05
  return {
    weight,
    weightText: weight.toFixed(2),
    hint: `场景组合键 ${key} 映射（待 strikePlanV2）`,
  }
}

/**
 * 按国家返回 tbody 行样式 class（与威胁度分析一致）。
 *
 * @param country 国家名
 */
export function homeAttackAnalysisCountryRowClass(country: string): string {
  if (country === '中国台湾') return 'attack-row--tw'
  if (country === '日本') return 'attack-row--jp'
  if (country === '美国') return 'attack-row--us'
  return 'attack-row--default'
}

function formatCountryWeight(country: string, priorityCountries: string[]): string {
  if (priorityCountries.includes(country)) return '1.00'
  return '0.60'
}

/**
 * 按国家优先与综合可攻击条件降序排序。
 *
 * @param rows 表格行
 * @param priorityCountries 作战对象国家
 */
export function sortHomeAttackAnalysisRows(
  rows: HomeAttackAnalysisTableRow[],
  priorityCountries: string[],
): HomeAttackAnalysisTableRow[] {
  const countriesInData = [...new Set(rows.map((r) => r.country).filter(Boolean))]
  const ordered = sortCountriesForTaskPhase(
    countriesInData.length ? countriesInData : [...TASK_ENEMY_COUNTRY_OPTIONS],
    priorityCountries,
  )
  const order = new Map(ordered.map((c, i) => [c, i]))

  return [...rows].sort((a, b) => {
    const ca = order.get(a.country) ?? 999
    const cb = order.get(b.country) ?? 999
    if (ca !== cb) return ca - cb
    const sa = a.compositeAttackSort ?? -1
    const sb = b.compositeAttackSort ?? -1
    if (sa !== sb) return sb - sa
    return a.satelliteName.localeCompare(b.satelliteName, 'zh-CN')
  })
}

/**
 * 从 matrix 打击计划构建攻击度分析行（攻击度待 attackability 接口，当前演示计算）。
 *
 * @param data 任务分析
 * @param taskId 任务 ID
 * @param enemyCountries 作战对象
 * @param catalogRows C2 catalog
 */
export function buildHomeAttackAnalysisRowsFromMatrix(
  data: SatelliteAnalysisData,
  taskId: number,
  enemyCountries: string[],
  catalogRows: C2ResourceSatelliteRow[] = [],
): HomeAttackAnalysisTableRow[] {
  const plans = buildAttackPlanTableRows(data)
  if (!plans.length) return []

  const catalogByName = new Map<string, C2ResourceSatelliteRow>()
  const matrixRows = buildC2SatelliteFlatRowsFromMatrix(data, enemyCountries)
  ;[...matrixRows, ...catalogRows].forEach((row) => {
    if (row.name) catalogByName.set(row.name.trim(), row)
  })

  const bg = resolveBackgroundWeightForTask(taskId)
  const fallbackCountry = enemyCountries.length === 1 ? enemyCountries[0] : '--'

  const rows: HomeAttackAnalysisTableRow[] = plans.map((plan, index) => {
    const catalog = catalogByName.get(plan.target.trim())
    const country = catalog?.country || fallbackCountry
    const attackDegree = 0.55 + (index % 7) * 0.06
    const composite = attackDegree * bg.weight

    return {
      rowKey: plan.id,
      country,
      satelliteName: plan.target,
      satelliteType: plan.targetType || catalog?.sat_type || '--',
      countryWeightText: formatCountryWeight(country, enemyCountries),
      weaponName: plan.weaponName,
      weaponType: plan.weaponType || '--',
      attackWindowText:
        plan.beginTime !== '--' && plan.endTime !== '--'
          ? `${plan.beginTime} ~ ${plan.endTime}`
          : plan.beginTime,
      attackDegreeText: attackDegree.toFixed(2),
      attackDegreeHint: '演示：attackPlanList 窗口内仰角/可达性得分（待 /algorithm/attackability）',
      backgroundWeightText: bg.weightText,
      compositeAttackText: composite.toFixed(4),
      compositeAttackHint: `综合可攻击条件 = ${attackDegree.toFixed(2)} × ${bg.weightText}；${bg.hint}`,
      compositeAttackSort: composite,
    }
  })

  return sortHomeAttackAnalysisRows(rows, enemyCountries)
}

function buildMockAttackRow(
  country: string,
  index: number,
  isPriority: boolean,
  bgWeight: number,
  bgHint: string,
): Omit<HomeAttackAnalysisTableRow, 'rowKey'> {
  const prefix =
    country === '美国' ? 'US' : country === '日本' ? 'JP' : country === '中国台湾' ? 'TW' : 'XX'
  const weaponType = MOCK_WEAPON_TYPES[index % MOCK_WEAPON_TYPES.length]
  const attackDegree = 0.82 - index * 0.045 + (isPriority ? 0.05 : 0)
  const composite = attackDegree * bgWeight
  const begin = `2026-09-17 ${String(8 + (index % 10)).padStart(2, '0')}:${String(10 + index).padStart(2, '0')}:00`
  const end = `2026-09-17 ${String(9 + (index % 10)).padStart(2, '0')}:${String(30 + index).padStart(2, '0')}:00`

  return {
    country,
    satelliteName: `DEMO-${prefix}-SAT-${String(index + 1).padStart(2, '0')}`,
    satelliteType: MOCK_SAT_TYPES[index % MOCK_SAT_TYPES.length],
    countryWeightText: isPriority ? '1.00' : '0.60',
    weaponName: `DEMO-${weaponType}-WP-${index + 1}`,
    weaponType,
    attackWindowText: `${begin} ~ ${end}`,
    attackDegreeText: attackDegree.toFixed(2),
    attackDegreeHint: '可打击度：窗口内最大仰角、链路断点与武器射程综合归一化（演示）',
    backgroundWeightText: bgWeight.toFixed(2),
    compositeAttackText: composite.toFixed(4),
    compositeAttackHint: `综合可攻击条件 = 攻击度 × 背景加权 = ${attackDegree.toFixed(2)} × ${bgWeight.toFixed(2)}；${bgHint}`,
    compositeAttackSort: composite,
  }
}

/**
 * Mock 攻击度分析数据（每国 8 条，按国家与综合条件排序）。
 *
 * @param priorityCountries 作战对象国家
 * @param taskId 任务 ID（背景加权）
 */
export function buildMockHomeAttackAnalysisRows(
  priorityCountries: string[],
  taskId?: number,
): HomeAttackAnalysisTableRow[] {
  const enemies = priorityCountries.length ? priorityCountries : ['美国']
  const bg = taskId ? resolveBackgroundWeightForTask(taskId) : { weight: 0.8, weightText: '0.80', hint: '演示默认背景加权' }
  const perCountry = 8
  const rows: HomeAttackAnalysisTableRow[] = []
  let global = 0

  MOCK_COUNTRY_POOL.forEach((country) => {
    const isPriority = enemies.includes(country)
    for (let i = 0; i < perCountry; i += 1) {
      const base = buildMockAttackRow(country, i, isPriority, bg.weight, bg.hint)
      rows.push({
        ...base,
        rowKey: `attack-mock-${global}-${base.satelliteName}`,
      })
      global += 1
    }
  })

  return sortHomeAttackAnalysisRows(rows, enemies)
}
