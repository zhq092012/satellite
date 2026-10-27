/**
 * 日期/时间格式化工具函数
 * 从 SatelliteUnReal.vue 提取的纯函数，不依赖任何 Vue 响应式状态
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
 * 把时间格式化为当天的 `HH:mm`。
 *
 * @param value 可被 `Date` 解析的时间字符串
 * @returns 时钟文本；空值为 `--`，无法解析时原样返回
 */
export const formatClock = (value?: string): string => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
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
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
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

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/**
 * 把逗号分隔的国家字符串拆成去空白后的数组。
 *
 * @param raw 如 `中国,美国`；缺省当空串
 * @returns 非空国家名列表，无内容时为空数组
 */
export const normalizeCountries = (raw?: string): string[] =>
  String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

/**
 * 解析 `纬度,经度` 字符串。
 *
 * @param latLonStr 如 `31.23,121.47`
 * @returns 十进制度坐标；空串、分段不足或非数字时纬度和经度都为 0
 */
export const parseLatLonToCoords = (latLonStr: string): { latitude: number; longitude: number } => {
  if (!latLonStr) return { latitude: 0, longitude: 0 }
  const parts = latLonStr.split(',')
  if (parts.length === 2) {
    const lat = parseFloat(parts[0].trim())
    const lon = parseFloat(parts[1].trim())
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      return { latitude: lat, longitude: lon }
    }
  }
  return { latitude: 0, longitude: 0 }
}
