/**
 * 卫星打击推荐列表行（接口未就绪前的占位结构，与后端建议字段对齐）。
 */
export interface SatelliteStrikeRecommendItem {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称（展示用） */
  name: string
  /** 综合威胁度（排序主键，降序） */
  compositeThreat: number
  /** 静态威胁度 */
  staticThreat: number
  /** 动态威胁度 */
  dynamicThreat: number
}

/**
 * 占位假数据：按综合威胁度降序预排序。
 * 接入接口后删除或改为仅在无 API 数据时使用。
 */
export const MOCK_SATELLITE_STRIKE_RECOMMENDATIONS: SatelliteStrikeRecommendItem[] = [
  { norad: 44713, name: 'USA-281', compositeThreat: 0.912, staticThreat: 0.845, dynamicThreat: 0.978 },
  { norad: 41866, name: 'YAOGAN-30D', compositeThreat: 0.887, staticThreat: 0.802, dynamicThreat: 0.931 },
  { norad: 43226, name: 'COSMOS 2524', compositeThreat: 0.854, staticThreat: 0.791, dynamicThreat: 0.896 },
  { norad: 40118, name: 'NOAA-19', compositeThreat: 0.821, staticThreat: 0.768, dynamicThreat: 0.862 },
  { norad: 25544, name: 'ISS (ZARYA)', compositeThreat: 0.796, staticThreat: 0.712, dynamicThreat: 0.841 },
  { norad: 43013, name: 'STARLINK-1007', compositeThreat: 0.773, staticThreat: 0.698, dynamicThreat: 0.815 },
  { norad: 40931, name: 'GAOFEN-1', compositeThreat: 0.741, staticThreat: 0.685, dynamicThreat: 0.792 },
  { norad: 37820, name: 'TIANGONG-1', compositeThreat: 0.708, staticThreat: 0.652, dynamicThreat: 0.761 },
]

/**
 * 返回按综合威胁度降序排列的推荐列表副本。
 *
 * @param items 原始推荐项
 * @returns 排序后的新数组
 */
/** 含综合威胁度的推荐行（卫星/接收站等共用排序） */
export interface StrikeRecommendThreatRow {
  /** 综合威胁度（排序主键，降序） */
  compositeThreat: number
}

/**
 * 返回按综合威胁度降序排列的推荐列表副本。
 *
 * @param items 原始推荐项
 * @returns 排序后的新数组
 */
export const sortStrikeRecommendByCompositeThreat = <T extends StrikeRecommendThreatRow>(
  items: T[]
): T[] => {
  return [...items].sort((a, b) => b.compositeThreat - a.compositeThreat)
}
