
/**
 * 解析 `纬度,经度` 字符串。
 *
 * @param latLonStr 如 `68.350,133.500`；空串或格式不对时纬度和经度都为 0
 * @returns 十进制度坐标
 */
export const parseLatLon = (latLonStr?: string): { lat: number; lng: number } => {
  if (!latLonStr) return { lat: 0, lng: 0 };
  const parts = latLonStr.split(',');
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    return {
      lat: isNaN(lat) ? 0 : lat,
      lng: isNaN(lng) ? 0 : lng
    };
  }
  return { lat: 0, lng: 0 };
};

/**
 * 把时间窗解析为秒级 Unix 时间戳。完整日期直接解析；只有 `HH:mm` 或 `HH:mm:ss` 时，日期取 `defaultTs` 当天。
 *
 * @param winStr 时间窗原文
 * @param defaultTs 解析失败或只有时分时使用的秒级时间戳
 * @returns 秒级时间戳
 */
export const parseWindowTimestamp = (winStr: string, defaultTs: number): number => {
  if (!winStr) return defaultTs;
  // 1. 尝试直接作为完整 Date 解析
  const d = new Date(winStr);
  if (!isNaN(d.getTime())) {
    return Math.floor(d.getTime() / 1000);
  }
  // 2. 尝试作为 HH:mm:ss 或 HH:mm 时分秒解析
  const parts = winStr.split(':').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const baseDate = new Date(defaultTs * 1000);
    baseDate.setHours(parts[0], parts[1], parts[2] || 0, 0);
    return Math.floor(baseDate.getTime() / 1000);
  }
  return defaultTs;
};

