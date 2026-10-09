import type { TargetThreatLevel } from '@/api/task/task'

/**
 * 卫星打击推荐列表行（与 `/api/ThreatAnalysis/targetsThreatLevel` 展示字段对齐）。
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
 * 将接口返回的目标威胁度列表转为右侧面板推荐表行。
 *
 * @param items 接口 data 数组
 * @returns 推荐列表行
 */
export const mapTargetThreatLevelListToStrikeRecommend = (
  items: TargetThreatLevel[] | null | undefined,
): SatelliteStrikeRecommendItem[] => {
  if (!items?.length) return []
  return items
    .map((item) => {
      const norad = Number(item.norad)
      if (!Number.isFinite(norad)) return null
      return {
        norad,
        name: (item.name || String(norad)).trim(),
        compositeThreat: Number(item.compositeThreat),
        staticThreat: Number(item.staticThreat),
        dynamicThreat: Number(item.dynamicThreat),
      }
    })
    .filter((row): row is SatelliteStrikeRecommendItem => row != null)
}

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
