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

/**
 * 从回传时间文本中解析时间戳（毫秒）
 *
 * @param timeText 包含时间格式的文本（如 "2026-07-28 16:05:02"）
 * @returns 毫秒时间戳，解析失败时返回 null
 */
export function parseFeedbackTimestamp(timeText?: string | null): number | null {
  if (!timeText) return null
  const match = timeText.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s]\d{1,2}:\d{1,2}(?::\d{1,2})?)?)/)
  if (match) {
    const parsed = new Date(match[1].replace(/-/g, '/')).getTime()
    if (!Number.isNaN(parsed)) return parsed
  }
  const direct = Date.parse(timeText)
  return Number.isNaN(direct) ? null : direct
}

/**
 * 计算打击前后最早回传时间造成的延迟时长（打击后 - 打击前）
 * 格式为 xx时xx分xx秒
 *
 * @param beforeTime 打击前最早回传时间
 * @param afterTime 打击后最早回传时间
 * @returns 格式化后的延迟文本（如 "31时54分0秒"、"15分10秒"、"0秒" 或 "--"）
 */
export function formatInterferenceDelay(beforeTime?: string | null, afterTime?: string | null): string {
  if (!beforeTime || !afterTime) return '--'
  const beforeMs = parseFeedbackTimestamp(beforeTime)
  const afterMs = parseFeedbackTimestamp(afterTime)
  if (beforeMs === null || afterMs === null) return '--'

  const diffSec = Math.floor((afterMs - beforeMs) / 1000)
  if (diffSec < 0) return '0秒'

  const h = Math.floor(diffSec / 3600)
  const m = Math.floor((diffSec % 3600) / 60)
  const s = diffSec % 60

  if (h > 0) {
    return `${h}时${m}分${s}秒`
  }
  if (m > 0) {
    return `${m}分${s}秒`
  }
  return `${s}秒`
}
