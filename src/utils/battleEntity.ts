/**
 * 战场 ID 规范化（兼容历史上 number 与当前 MongoDB 字符串）。
 *
 * @param id 原始战场 ID
 */
export const normalizeBattleId = (id: unknown): string => {
  if (id == null || id === '') return ''
  return String(id).trim()
}

/**
 * 判断两个战场 ID 是否相等。
 *
 * @param left 战场 ID A
 * @param right 战场 ID B
 */
export const isSameBattleId = (left: unknown, right: unknown): boolean => {
  const a = normalizeBattleId(left)
  const b = normalizeBattleId(right)
  return a.length > 0 && a === b
}