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
  /** 卫星用途（军用 / 商用等） */
  usage?: string | null
}

/** 系列实体中可提取卫星的最小结构 */
export interface BattleGlobeEntitySource {
  /** 系列名称 */
  series?: string
  /** 卫星系统类型（侦察 / 通信） */
  sysType?: string
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
  /** 卫星系统类型（侦察 / 通信） */
  sysType: string
  /** 卫星用途（军用 / 商用等） */
  usage: string
}

/** initMatrix / 分析结果中卫星条目必须齐全或有效的字段 */
export type BattleGlobeSatelliteApiField = 'norad' | 'name' | 'line1' | 'line2'

/**
 * 算法分析 / 矩阵 initMatrix 中卫星字段缺失或无效时抛出（不静默跳过、不伪造 TLE/名称）。
 */
export class BattleGlobeSatelliteFromApiError extends Error {
  /** 缺失或无效的接口字段 */
  readonly missingFields: BattleGlobeSatelliteApiField[]
  /** 卫星 NORAD */
  readonly norad?: number
  /** 卫星名称（接口原值，可能为空） */
  readonly satelliteName?: string
  /** 所属系列 */
  readonly series?: string

  /**
   * @param params 诊断信息
   */
  constructor(params: {
    norad?: number
    satelliteName?: string
    series?: string
    missingFields: BattleGlobeSatelliteApiField[]
  }) {
    const { norad, satelliteName, series, missingFields } = params
    const namePart = satelliteName?.trim() ? `「${satelliteName.trim()}」` : ''
    const seriesPart = series?.trim() ? `系列=${series.trim()}` : '系列=未知'
    super(
      `卫星${namePart}(norad=${norad ?? '?'}) ${seriesPart} 接口未返回或无效字段：${missingFields.join('、')}。请检查 getTaskMatrix / initMatrix 或 TLE 入库。`,
    )
    this.name = 'BattleGlobeSatelliteFromApiError'
    this.missingFields = missingFields
    this.norad = norad
    this.satelliteName = satelliteName
    this.series = series
  }
}

/** 从系列实体汇总卫星时的结果（含校验错误） */
export interface BattleGlobeSatellitesBuildResult {
  /** 字段齐全且 TLE 有效的卫星 */
  satellites: BattleGlobeSatellite[]
  /** 无法渲染的卫星条目错误 */
  errors: BattleGlobeSatelliteFromApiError[]
}

/**
 * 判断 TLE 两行根数是否有效。
 *
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 * @returns 是否可用于 SGP4 传播
 */
export const hasValidTle = (line1?: string | null, line2?: string | null): boolean => {
  if (!line1 || !line2) return false
  const trimmed1 = line1.trim()
  const trimmed2 = line2.trim()
  if (!trimmed1 || !trimmed2) return false
  return /^1\s+\d/.test(trimmed1) && /^2\s+\d/.test(trimmed2)
}

/**
 * 从 TLE 估算卫星轨道周期（秒），用于态势地球绘制一轨轨迹。
 *
 * @param sat 含 line1/line2 的卫星数据
 * @returns 轨道周期（秒）；TLE 无效或解析失败时 null（不默认 90 分钟）
 */
export const resolveBattleGlobeOrbitPeriodSec = (
  sat: Pick<BattleGlobeSatellite, 'line1' | 'line2'>,
): number | null => {
  if (!hasValidTle(sat.line1, sat.line2)) return null
  try {
    const satrec = satellitejs.twoline2satrec(sat.line1.trim(), sat.line2.trim())
    if (satrec?.no && satrec.no > 0) {
      return Math.max(300, ((2 * Math.PI) / satrec.no) * 60)
    }
  } catch {
    return null
  }
  return null
}

/**
 * 检测 initMatrix 单条卫星是否具备地球渲染所需字段。
 *
 * @param sat 初始卫星矩阵
 * @param series 系列名称（仅用于错误文案）
 * @returns 缺失字段列表；无缺失时空数组
 */
export const getMissingBattleGlobeSatelliteApiFields = (
  sat: BattleGlobeSatelliteSource,
  series?: string,
): BattleGlobeSatelliteApiField[] => {
  const missing: BattleGlobeSatelliteApiField[] = []
  if (!sat?.norad || !Number.isFinite(Number(sat.norad))) {
    missing.push('norad')
  }
  const name = sat?.name?.trim()
  if (!name) missing.push('name')
  const line1 = sat?.line1?.trim() ?? ''
  const line2 = sat?.line2?.trim() ?? ''
  if (!hasValidTle(line1, line2)) {
    missing.push('line1', 'line2')
  }
  void series
  return missing
}

/**
 * 将 initMatrix 转为地球渲染卫星；字段不齐时抛出 {@link BattleGlobeSatelliteFromApiError}。
 *
 * @param sat 初始卫星矩阵
 * @param series 系列名称
 * @param sysType 系统类型
 * @returns 地球渲染卫星
 * @throws {BattleGlobeSatelliteFromApiError} 必需字段缺失或 TLE 无效
 */
export const materializeBattleGlobeSatellite = (
  sat: BattleGlobeSatelliteSource,
  series: string,
  sysType: string,
): BattleGlobeSatellite => {
  const missingFields = getMissingBattleGlobeSatelliteApiFields(sat, series)
  if (missingFields.length) {
    throw new BattleGlobeSatelliteFromApiError({
      norad: sat?.norad,
      satelliteName: sat?.name,
      series,
      missingFields,
    })
  }
  const line1 = sat.line1!.trim()
  const line2 = sat.line2!.trim()
  return {
    norad: sat.norad,
    name: sat.name!.trim(),
    line1,
    line2,
    series: series.trim(),
    sysType: sysType.trim(),
    usage: sat.usage?.trim() ?? '',
  }
}

/**
 * 从系列实体列表汇总全部可渲染卫星，并收集无法渲染条目的错误。
 * 同一 NORAD 仅保留首次出现的数据。
 *
 * @param entities 系列实体列表
 * @returns 卫星列表与校验错误
 */
export const buildBattleGlobeSatellitesFromEntitiesResult = (
  entities: BattleGlobeEntitySource[] | null | undefined,
): BattleGlobeSatellitesBuildResult => {
  if (!entities?.length) {
    return { satellites: [], errors: [] }
  }

  const satelliteMap = new Map<number, BattleGlobeSatellite>()
  const errors: BattleGlobeSatelliteFromApiError[] = []

  entities.forEach((entity) => {
    const series = entity?.series?.trim() ?? ''
    const sysType = entity?.sysType?.trim() ?? ''
    ;(entity?.initMatrixList || []).forEach((sat) => {
      if (!sat) return
      if (satelliteMap.has(sat.norad)) return

      const missingFields = getMissingBattleGlobeSatelliteApiFields(sat, series)
      if (missingFields.length) {
        errors.push(
          new BattleGlobeSatelliteFromApiError({
            norad: sat.norad,
            satelliteName: sat.name,
            series,
            missingFields,
          }),
        )
        return
      }

      try {
        satelliteMap.set(sat.norad, materializeBattleGlobeSatellite(sat, series, sysType))
      } catch (err) {
        if (err instanceof BattleGlobeSatelliteFromApiError) {
          errors.push(err)
          return
        }
        throw err
      }
    })
  })

  return { satellites: Array.from(satelliteMap.values()), errors }
}

/**
 * 从系列实体列表汇总全部可渲染卫星（跳过无效条目，不附带错误列表）。
 *
 * @param entities 系列实体列表
 * @returns 带有效 TLE 的卫星列表
 * @deprecated 态势页请使用 {@link buildBattleGlobeSatellitesWithValidation} 并处理 errors
 */
export const buildBattleGlobeSatellitesFromEntities = (
  entities: BattleGlobeEntitySource[] | null | undefined,
): BattleGlobeSatellite[] => buildBattleGlobeSatellitesFromEntitiesResult(entities).satellites

/**
 * 从任务分析结果汇总卫星并附带校验错误。
 *
 * @param data 任务算法分析结果
 * @returns 卫星列表与错误
 */
export const buildBattleGlobeSatellitesWithValidation = (
  data: SatelliteAnalysisData | null | undefined,
): BattleGlobeSatellitesBuildResult =>
  buildBattleGlobeSatellitesFromEntitiesResult(data?.levelSeriesEntities)

/**
 * 从任务分析结果汇总全部可渲染卫星。
 *
 * @param data 任务算法分析结果
 * @returns 带有效 TLE 的卫星列表
 */
export const buildBattleGlobeSatellites = (
  data: SatelliteAnalysisData | null | undefined,
): BattleGlobeSatellite[] => buildBattleGlobeSatellitesWithValidation(data).satellites

/**
 * 从当前系列矩阵汇总可渲染卫星（仅用于矩阵预览等非态势主路径）。
 *
 * @param matrix 当前系列算法矩阵
 * @returns 带有效 TLE 的卫星列表与错误
 */
export const buildBattleGlobeSatellitesFromMatrixWithValidation = (
  matrix: BattleGlobeEntitySource | null | undefined,
): BattleGlobeSatellitesBuildResult => {
  if (!matrix) return { satellites: [], errors: [] }
  return buildBattleGlobeSatellitesFromEntitiesResult([
    { series: matrix.series, sysType: matrix.sysType, initMatrixList: matrix.initMatrixList },
  ])
}

/**
 * @deprecated 请使用 {@link buildBattleGlobeSatellitesFromMatrixWithValidation}
 */
export const buildBattleGlobeSatellitesFromMatrix = (
  matrix: BattleGlobeEntitySource | null | undefined,
): BattleGlobeSatellite[] =>
  buildBattleGlobeSatellitesFromMatrixWithValidation(matrix).satellites

/**
 * 将 TLE / 接口字段校验失败的卫星输出到控制台，便于对照 getTaskMatrix / initMatrix 数据。
 *
 * @param errors 校验错误列表
 */
export const logBattleGlobeSatelliteValidationErrorsToConsole = (
  errors: BattleGlobeSatelliteFromApiError[],
): void => {
  if (!errors.length) return
  console.warn(
    `[态势地球] 共 ${errors.length} 颗卫星 TLE 错误或接口未返回有效字段，已跳过渲染：`,
    errors.map((err) => ({
      norad: err.norad,
      name: err.satelliteName,
      series: err.series,
      missingFields: [...err.missingFields],
    })),
  )
  errors.forEach((err) => {
    console.warn('[态势地球]', err.message)
  })
}

/**
 * 弹出卫星 TLE/字段校验错误（每条卫星一条消息），并同步写入控制台。
 *
 * @param errors 校验错误列表
 * @param emit 消息回调，默认由调用方传入 ElMessage.error
 */
export const notifyBattleGlobeSatelliteValidationErrors = (
  errors: BattleGlobeSatelliteFromApiError[],
  emit: (message: string) => void,
): void => {
  logBattleGlobeSatelliteValidationErrorsToConsole(errors)
  errors.forEach((err) => emit(err.message))
}
