/**
 * 威胁度 / 攻击度分析页：按任务阶段国家优先排序。
 */

/**
 * 对国家列表排序：任务蓝方国家优先，其余按中文排序。
 *
 * @param countries 待排序国家
 * @param priorityCountries 任务阶段优先国家（通常为 enemyCountryShow）
 */
export function sortCountriesForTaskPhase(countries: string[], priorityCountries: string[]): string[] {
  const prioritySet = new Set(priorityCountries.filter(Boolean))
  const unique = [...new Set(countries.filter(Boolean))]
  const priority = priorityCountries.filter((c) => unique.includes(c))
  const rest = unique.filter((c) => !prioritySet.has(c)).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  return [...priority, ...rest]
}

/**
 * 任务阶段优先国家的行样式 class。
 *
 * @param country 国家名
 * @param priorityCountries 优先国家列表
 */
export function countryRowPriorityClass(country: string, priorityCountries: string[]): string {
  if (priorityCountries.includes(country)) return 'analysis-country-row--priority'
  return 'analysis-country-row--default'
}
