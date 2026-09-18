import * as satellitejs from 'satellite.js'
import type { SatelliteAnalysisData } from '@/api/task/task'

/** 地球渲染所需的最小卫星字段（兼容 task / electronic 两套 InitMatrix） */
export interface BattleGlobeSatelliteSource {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name?: string
  /** TLE 第一行 */
  line1?: string | null
  /** TLE 第二行 */
  line2?: string | null
}

/** 系列实体中可提取卫星的最小结构 */
export interface BattleGlobeEntitySource {
  /** 系列名称 */
  series?: string
  /** 初始卫星矩阵列表 */
  initMatrixList?: BattleGlobeSatelliteSource[] | null
}

/** 整体态势地球渲染用卫星数据 */
export interface BattleGlobeSatellite {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** TLE 第一行 */
  line1: string
  /** TLE 第二行 */
  line2: string
  /** 所属系列 */
  series: string
}

/**
 * 判断 TLE 两行根数是否有效。
 *
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 * @returns 是否可用于 SGP4 传播
 */
/**
 * 从 TLE 估算卫星轨道周期（秒），用于态势地球绘制一轨轨迹。
 *
 * @param sat 含 line1/line2 的卫星数据
 * @returns 轨道周期（秒）；解析失败时默认 90 分钟
 */
export const resolveBattleGlobeOrbitPeriodSec = (
  sat: Pick<BattleGlobeSatellite, 'line1' | 'line2'>
): number => {
  try {
    const satrec = satellitejs.twoline2satrec(sat.line1, sat.line2)
    if (satrec?.no && satrec.no > 0) {
      return Math.max(300, ((2 * Math.PI) / satrec.no) * 60)
    }
  } catch {
    /* fallback below */
  }
  return 90 * 60
}

export const hasValidTle = (line1?: string | null, line2?: string | null): boolean => {
  if (!line1 || !line2) return false
  const trimmed1 = line1.trim()
  const trimmed2 = line2.trim()
  if (!trimmed1 || !trimmed2) return false
  return /^1\s+\d/.test(trimmed1) && /^2\s+\d/.test(trimmed2)
}

/**
 * 将 initMatrix 转为地球渲染卫星；无有效 TLE 时返回 null。
 *
 * @param sat 初始卫星矩阵
 * @param series 系列名称
 * @returns 地球渲染卫星或 null
 */
const toBattleGlobeSatellite = (
  sat: BattleGlobeSatelliteSource,
  series: string
): BattleGlobeSatellite | null => {
  const line1 = sat.line1?.trim() ?? ''
  const line2 = sat.line2?.trim() ?? ''
  if (!hasValidTle(line1, line2)) return null
  return {
    norad: sat.norad,
    name: sat.name || `Sat-${sat.norad}`,
    line1,
    line2,
    series,
  }
}

/**
 * 从系列实体列表汇总全部可渲染卫星。
 * 同一 NORAD 仅保留首次出现的数据。
 *
 * @param entities 系列实体列表
 * @returns 带有效 TLE 的卫星列表
 */
export const buildBattleGlobeSatellitesFromEntities = (
  entities: BattleGlobeEntitySource[] | null | undefined
): BattleGlobeSatellite[] => {
  if (!entities?.length) return []

  const satelliteMap = new Map<number, BattleGlobeSatellite>()

  entities.forEach((entity) => {
    const series = entity?.series || ''
    ;(entity?.initMatrixList || []).forEach((sat) => {
      if (!sat?.norad || satelliteMap.has(sat.norad)) return
      const item = toBattleGlobeSatellite(sat, series)
      if (item) satelliteMap.set(sat.norad, item)
    })
  })

  return Array.from(satelliteMap.values())
}

/**
 * 从任务分析结果汇总全部可渲染卫星。
 *
 * @param data 任务算法分析结果
 * @returns 带有效 TLE 的卫星列表
 */
export const buildBattleGlobeSatellites = (
  data: SatelliteAnalysisData | null | undefined
): BattleGlobeSatellite[] => buildBattleGlobeSatellitesFromEntities(data?.levelSeriesEntities)

/**
 * 从当前系列矩阵汇总可渲染卫星（分析结果未返回时的兜底）。
 *
 * @param matrix 当前系列算法矩阵
 * @returns 带有效 TLE 的卫星列表
 */
export const buildBattleGlobeSatellitesFromMatrix = (
  matrix: BattleGlobeEntitySource | null | undefined
): BattleGlobeSatellite[] => {
  if (!matrix) return []
  return buildBattleGlobeSatellitesFromEntities([
    { series: matrix.series, initMatrixList: matrix.initMatrixList },
  ])
}
