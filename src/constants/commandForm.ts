/** 命令表单：命令来源可选项（与 OpenAPI `source` 字段取值一致） */
export const COMMAND_SOURCE_FORM_OPTIONS = [
  /** 太空作战联合指挥中心 */
  '太空作战联合指挥中心',
  /** 南部战区 */
  '南部战区',
  /** 东部战区 */
  '东部战区',
] as const

/** 命令表单：我方国家固定值 */
export const COMMAND_OWN_COUNTRY_FIXED = '中国' as const

/** 命令表单：作战对象（敌方）可选项 */
export const COMMAND_ENEMY_COUNTRY_OPTIONS = [
  /** 日本 */
  '日本',
  /** 美国 */
  '美国',
  /** 中国台湾 */
  '中国台湾',
] as const

export type CommandSourceFormOption = (typeof COMMAND_SOURCE_FORM_OPTIONS)[number]
export type CommandEnemyCountryOption = (typeof COMMAND_ENEMY_COUNTRY_OPTIONS)[number]

/**
 * 将作战对象规范为允许列表内的国家（去除非法项）。
 *
 * @param values 原始选择
 */
export const normalizeCommandEnemyCountries = (values: unknown): CommandEnemyCountryOption[] => {
  if (!Array.isArray(values)) return []
  const allowed = new Set<string>(COMMAND_ENEMY_COUNTRY_OPTIONS)
  return values
    .map((item) => String(item).trim())
    .filter((item): item is CommandEnemyCountryOption => allowed.has(item))
}