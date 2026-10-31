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
