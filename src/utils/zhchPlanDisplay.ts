/**
 * 将描述文本中的数字与时间高亮为 HTML 片段（仅用于接口返回的展示文本）。
 *
 * @param text 原始描述文本
 * @returns 带高亮 span 的 HTML 字符串
 */
export function highlightResultText(text?: string | null): string {
  if (!text) return ''
  return text
    .replace(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g, '<span class="hl-time">$1</span>')
    .replace(/(\d+(?:\.\d+)?)/g, '<span class="hl-num">$1</span>')
}

/**
 * 轨道类型枚举转中文标签。
 *
 * @param orbitType 轨道类型枚举值
 * @returns 中文轨道类型
 */
export function orbitTypeLabel(orbitType?: number): string {
  const map: Record<number, string> = { 1: '低轨', 2: '中轨', 3: '高轨' }
  return orbitType ? map[orbitType] || `类型${orbitType}` : '--'
}

/**
 * 打击状态转中文。
 *
 * @param status 0-未打击 1-被打击
 */
export function strikeStatusLabel(status?: number): string {
  return status === 1 ? '已打击' : '未打击'
}

/**
 * 接收站/中心站状态转中文。
 *
 * @param status 0-可用 1-被打击
 */
export function stationStatusLabel(status?: number): string {
  return status === 1 ? '不可用' : '可用'
}
