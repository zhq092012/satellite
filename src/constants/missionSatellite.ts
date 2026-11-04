/**
 * 任务级卫星系统类型（侦察 / 通信 / 导航 / 导弹预警）。
 * 与 catalog `sat_type`（载荷描述）区分。
 */
export const MISSION_SYS_TYPES = ['侦察', '通信', '导航', '导弹预警'] as const

/** 任务系统类型联合类型 */
export type MissionSysType = (typeof MISSION_SYS_TYPES)[number]

/**
 * 卫星用途（军用 / 民用 / 商用）。
 * 与 matrix `InitMatrix.usage` 及综合打击方案用途语义一致。
 */
export const SATELLITE_USAGE_TYPES = ['军用', '民用', '商用'] as const

/** 卫星用途联合类型 */
export type SatelliteUsageType = (typeof SATELLITE_USAGE_TYPES)[number]

/** 添加任务时蓝方（作战对象）固定可选项（界面展示顺序：中国台湾、日本、美国） */
export const TASK_ENEMY_COUNTRY_OPTIONS = ['中国台湾', '日本', '美国'] as const

/** 蓝方可选国家联合类型 */
export type TaskEnemyCountryOption = (typeof TASK_ENEMY_COUNTRY_OPTIONS)[number]

/** 左侧面板 / 任务编辑共用的系统类型列表（可变数组副本） */
export const TASK_PANEL_SATELLITE_TYPES: readonly string[] = MISSION_SYS_TYPES

/**
 * 判断字符串是否为合法任务系统类型。
 *
 * @param value 待校验类型名
 */
export function isMissionSysType(value: string): value is MissionSysType {
  return (MISSION_SYS_TYPES as readonly string[]).includes(value)
}

/**
 * 将 matrix / 接口返回的用途文案规范为展示用用途；无法识别时返回原文或「未标注用途」。
 *
 * @param raw 原始用途字段
 */
export function normalizeSatelliteUsageLabel(raw: string | undefined | null): string {
  if (!raw || !String(raw).trim()) return '未标注用途'
  const text = String(raw).trim()
  if (text.includes('军用') && text.includes('民')) return '军用民用'
  if (text.includes('军用')) return '军用'
  if (text.includes('商用') || text.includes('民用')) return '民用'
  if ((SATELLITE_USAGE_TYPES as readonly string[]).includes(text)) return text
  return text
}
