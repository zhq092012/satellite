/**
 * 日期/时间格式化工具函数
 * 从 SatelliteUnreal.vue 提取的纯函数，不依赖任何 Vue 响应式状态
 */

/**
 * 解析任务窗口时间。先去掉末尾的 `Z` 或 `±HH:mm`，再按本地时间构造 Date，
 * 避免接口里的 UTC 标记把窗口整体偏移。
 *
 * @param value 任务窗口时间字符串；空串时返回 Invalid Date
 * @returns 解析后的 Date；无法解析时为 Invalid Date
 */
export const parseMissionWindowDate = (value?: string): Date => {
  if (!value) return new Date('')
  const normalized = value.replace(/([zZ]|[+-]\d{2}:\d{2})$/, '')
  return new Date(normalized)
}

/**
 * 把非负整数补成至少两位，用于月、日、时、分、秒。
 *
 * @param value 待补位的数字
 * @returns 至少两位的十进制字符串
 */
export const pad2 = (value: number): string => String(value).padStart(2, '0')

/**
 * 把 Date 格式化为 `MM/DD HH:mm`。
 *
 * @param date 本地时区日期
 * @returns 月日与时分
 */
export const formatMonthDayClock = (date: Date): string =>
  `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`

/**
 * 把 Date 格式化为 `YYYY-MM-DD HH:mm`（不含秒），与任务面板提交格式一致。
 *
 * @param date 本地时区日期
 * @returns 任务时间字符串
 */
export const formatTaskMinuteDateTime = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`

/**
 * 把毫秒时间戳格式化为本地时区的 `YYYY-MM-DD HH:mm:ss`。
 * 不把 0 或非法时间改成占位符，空值展示由调用方决定。
 *
 * @param ms 毫秒时间戳
 * @returns 完整日期时间
 */
export const formatLocalDateTime = (ms: number): string => {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

/**
 * 把矩阵或任务时间字符串解析为毫秒。横线日期会先换成斜线，以兼容部分浏览器对 `YYYY-MM-DD` 的解析。
 *
 * @param timeStr 时间字符串；空值视为无效
 * @returns 毫秒时间戳；空串或无法解析时为 0
 */
export const parseTimeToMs = (timeStr?: string | null): number => {
  if (!timeStr) return 0
  const normalized = timeStr.replace(/-/g, '/')
  const ts = new Date(normalized).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

/**
 * 把时间窗解析为秒级 Unix 时间戳。完整日期直接解析；只有 `HH:mm` 或 `HH:mm:ss` 时，日期取 `defaultTs` 当天。
 *
 * @param winStr 时间窗原文
 * @param defaultTs 解析失败或只有时分时使用的秒级时间戳
 * @returns 秒级时间戳
 */
export const parseWindowTimestamp = (winStr: string, defaultTs: number): number => {
  if (!winStr) return defaultTs
  const parsed = new Date(winStr)
  if (!Number.isNaN(parsed.getTime())) {
    return Math.floor(parsed.getTime() / 1000)
  }
  const parts = winStr.split(':').map(Number)
  if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    const baseDate = new Date(defaultTs * 1000)
    baseDate.setHours(parts[0], parts[1], parts[2] || 0, 0)
    return Math.floor(baseDate.getTime() / 1000)
  }
  return defaultTs
}

/**
 * 把过境窗口时间格式化为 `YYYY-MM-DD HH:mm:ss`。
 * 会去掉 `T` 和 `Z` 后再按本地时间解析。
 *
 * @param timeStr 原始时间；空值返回 `--`
 * @returns 格式化时间；无法解析时返回原文
 */
export const formatPassWindowTime = (timeStr?: string | null): string => {
  if (!timeStr) return '--'
  const normalized = timeStr.replace('T', ' ').replace('Z', '')
  const date = new Date(normalized.includes('-') ? normalized.replace(/-/g, '/') : normalized)
  if (Number.isNaN(date.getTime())) return timeStr
  return formatLocalDateTime(date.getTime())
}

/**
 * 把时间格式化为当天的 `HH:mm`。
 *
 * @param value 可被 `Date` 解析的时间字符串
 * @returns 时钟文本；空值为 `--`，无法解析时原样返回
 */
export const formatClock = (value?: string): string => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * 把时间格式化为 `MM/DD HH:mm`。
 *
 * @param value 可被 `Date` 解析的时间字符串
 * @returns 短日期文本；空值为 `--`，无法解析时原样返回
 */
export const formatDateTime = (value?: string): string => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return formatMonthDayClock(date)
}

/**
 * 把任务窗口时间格式化为 `YYYY-MM-DD HH:mm:ss`。时区处理与 {@link parseMissionWindowDate} 相同。
 *
 * @param value 任务窗口时间字符串
 * @returns 完整日期时间；空值为 `--`，无法解析时原样返回
 */
export const formatFullDateTime = (value?: string): string => {
  if (!value) return '--'
  const date = parseMissionWindowDate(value)
  if (Number.isNaN(date.getTime())) return value

  return formatLocalDateTime(date.getTime())
}

/**
 * 取若干天之前的日期。
 *
 * @param days 向前推的天数，默认 7
 * @param fromDate 起点，默认当前时间
 * @returns 起点减去对应毫秒后的日期
 */
export function getDaysAgo(days = 7, fromDate = new Date()) {
  return new Date(fromDate.getTime() - days * 24 * 60 * 60 * 1000)
}

/**
 * 将日期格式化为 `YYYY-MM-DD`。
 *
 * @param date 日期对象
 * @returns 本地时区的日期字符串
 */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}
