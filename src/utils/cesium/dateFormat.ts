/**
 * 日期/时间格式化工具函数
 * 从 SatelliteUnReal.vue 提取的纯函数，不依赖任何 Vue 响应式状态
 */

/** 解析任务窗口的日期字符串，去除时区信息并转换为 Date 对象 */
export const parseMissionWindowDate = (value?: string): Date => {
  if (!value) return new Date('')
  const normalized = value.replace(/([zZ]|[+-]\d{2}:\d{2})$/, '')
  return new Date(normalized)
}

/** 格式化为 HH:mm 时钟格式 */
export const formatClock = (value?: string): string => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 格式化为 MM/DD HH:mm 短日期格式 */
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

/** 格式化为 YYYY-MM-DD HH:mm:ss 完整日期格式 */
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

/** 将逗号分隔的国家字符串标准化为数组 */
export const normalizeCountries = (raw?: string): string[] =>
  String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

/** 解析 "lat,lon" 格式的字符串为坐标对象 */
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
