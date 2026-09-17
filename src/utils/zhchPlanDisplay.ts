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

/** 日期时间拆分展示结构 */
export interface DateTimeDisplayParts {
  /** 年月日部分，如 2026-09-16 */
  date: string
  /** 时分秒部分，如 08:00:02 */
  time: string
}

/**
 * 将日期时间字符串拆分为日期与时间两部分，用于表格换行展示。
 *
 * @param timeText 原始时间文本（如 "2026-09-16 08:00:02"）
 * @returns 日期与时间部分；无效时返回 `--` 与空字符串
 */
export function splitDateTimeDisplay(timeText?: string | null): DateTimeDisplayParts {
  if (!timeText || timeText.trim() === '--') {
    return { date: '--', time: '' }
  }

  const trimmed = timeText.trim()
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)$/)
  if (match) {
    return { date: match[1], time: match[2] }
  }

  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex > 0) {
    return {
      date: trimmed.slice(0, spaceIndex),
      time: trimmed.slice(spaceIndex + 1),
    }
  }

  return { date: trimmed, time: '' }
}

/**
 * 计算打击前后最早回传时间造成的延迟时长（打击后 - 打击前）
 * 格式为 xx时xx分xx秒
 *
 * @param beforeTime 打击前最早回传时间
 * @param afterTime 打击后最早回传时间
 * @returns 格式化后的延迟文本（如 "31时54分0秒"、"15分10秒"、"0秒" 或 "--"）
 */
/**
 * 从回传时间字段中解析展示用时间与链路描述。
 * 示例：`2026-09-17 09:28:09(starshield122->威尔克斯巴里站)`
 *
 * @param raw 接口返回的原始文本；`null`、`无` 表示无链路
 * @returns 时间与链路展示对象
 */
export function parseFeedbackTimeAndLink(raw?: string | null): { time: string; link: string } {
  if (!raw || raw.trim() === '无') {
    return { time: '无', link: '无' }
  }
  const match = raw.match(/^(.+?)\((.+)\)$/)
  if (match) {
    return { time: match[1].trim(), link: match[2].trim() }
  }
  return { time: raw.trim(), link: '--' }
}

/**
 * 判断打击后首次回传是否缺失（null、空串或「无」）。
 *
 * @param afterTime 打击后首次回传原始字段
 * @returns 无有效打击后回传时为 true
 */
function isAfterFeedbackMissing(afterTime?: string | null): boolean {
  if (afterTime == null) return true
  const trimmed = afterTime.trim()
  return trimmed === '' || trimmed === '无'
}

/**
 * 将毫秒差格式化为延迟展示文案（不超过 1 小时为「xx分钟」，否则「xx小时xx分钟」）。
 *
 * @param diffMs 非负时间差（毫秒）
 * @returns 格式化后的延迟文本
 */
function formatDelayDurationFromMs(diffMs: number): string {
  const totalMinutes = Math.round(Math.max(0, diffMs) / 60000)
  if (totalMinutes <= 60) {
    return `${totalMinutes}分钟`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`
}

/**
 * 计算打击造成的回传延迟（打击后 - 打击前）。
 * 打击后无回传时，使用任务结束时间 - 打击前首次回传时间。
 * 不超过 1 小时显示「xx分钟」，超过 1 小时显示「xx小时xx分钟」。
 *
 * @param beforeTime 打击前首次回传时间
 * @param afterTime 打击后首次回传时间
 * @param taskEndTime 任务结束时间；打击后缺失时用于计算延迟
 * @returns 格式化后的延迟文本
 */
export function formatStrikeDelayDuration(
  beforeTime?: string | null,
  afterTime?: string | null,
  taskEndTime?: string | null
): string {
  if (!beforeTime || beforeTime.trim() === '无') {
    return '--'
  }
  const beforeMs = parseFeedbackTimestamp(beforeTime)
  if (beforeMs === null) return '--'

  let endMs: number | null
  if (isAfterFeedbackMissing(afterTime)) {
    if (!taskEndTime || taskEndTime.trim() === '') return '--'
    endMs = parseFeedbackTimestamp(taskEndTime)
  } else {
    endMs = parseFeedbackTimestamp(afterTime)
  }

  if (endMs === null) return '--'

  return formatDelayDurationFromMs(endMs - beforeMs)
}

/**
 * 将覆盖率格式化为百分比展示。
 *
 * @param coverage 覆盖率数值
 * @returns 百分比文本
 */
export function formatCoveragePercent(coverage?: number | null): string {
  if (coverage == null || !Number.isFinite(coverage)) return '--'
  return `${Number(coverage.toFixed(2))}%`
}

/**
 * 计算打击造成的覆盖率减少量（打击前 - 打击后）。
 *
 * @param beforeCoverage 打击前平均覆盖率
 * @param afterCoverage 打击后平均覆盖率
 * @returns 减少量百分比文本
 */
export function formatCoverageReduction(beforeCoverage?: number | null, afterCoverage?: number | null): string {
  if (!Number.isFinite(beforeCoverage) || !Number.isFinite(afterCoverage)) return '--'
  const reduction = Number(beforeCoverage) - Number(afterCoverage)
  return `${reduction.toFixed(2)}%`
}

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
