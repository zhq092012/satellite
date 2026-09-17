import type { MatrixResult } from '@/api/electronic'

/** 覆盖率从高到低划分为 25 个等级，每档 4%。 */
export const STARLINK_COVERAGE_BRACKETS = Array.from({ length: 25 }, (_, index) => {
  const high = 100 - index * 4
  const low = Math.max(0, high - 3)
  return `${low}%~${high}%`
})

/** 单星覆盖率热力单元格 */
export interface SingleSatCoverageHeatCell {
  /** 横轴时间片标签 */
  timeLabel: string
  /** 覆盖率梯队文案 */
  bracket: string
  /** 该格是否有点（单星恒为 1） */
  weight: number
}

/** 单星覆盖率热力图数据模型 */
export interface SingleSatCoverageHeatModel {
  /** 热力单元格 */
  cells: SingleSatCoverageHeatCell[]
  /** 横轴时间片标签，从早到晚 */
  timeLabels: string[]
  /** 打击前后切换时间片；无法判定时为 null */
  strikeSplitLabel: string | null
  /** 卫星名称 */
  satelliteName: string
  /** 卫星 NORAD */
  norad: number
  /** 打击前覆盖率 */
  beforeCoverage: number | null
  /** 打击后覆盖率 */
  afterCoverage: number | null
}

/**
 * 解析时间字符串为 Unix 毫秒时间戳。
 *
 * @param timeStr 后端时间字符串
 * @returns 毫秒时间戳；无效时返回 0
 */
export const parseTimeToMs = (timeStr: string): number => {
  if (!timeStr) return 0
  const d = new Date(timeStr.replace(/-/g, '/'))
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

/**
 * 根据覆盖率数值映射到热力图 Y 轴梯队。
 *
 * @param coverage 覆盖率 0–100
 * @returns 梯队标签
 */
export const getCoverageBracket = (coverage: number): string => {
  const normalized = Math.min(100, Math.max(0, coverage))
  const index = Math.min(24, Math.floor((100 - normalized) / 4))
  return STARLINK_COVERAGE_BRACKETS[index]
}

/**
 * 格式化热力图横轴时间片标签。
 *
 * @param timestamp 毫秒时间戳
 * @returns `MM/DD HH:mm`
 */
export const formatHeatmapTimeLabel = (timestamp: number): string => {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 将覆盖率格式化为保留三位小数的百分比文案。
 *
 * @param value 覆盖率原始值
 * @returns 如 `77.778%`；无效值返回 `--`
 */
export const formatHeatmapCoverage = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${value.toFixed(3)}%`
}

/**
 * 构建单颗通信卫星在任务时间片内的覆盖率热力图数据（与 ElectronicWarfareG6 STARLINK 口径一致，仅保留当前星）。
 *
 * @param matrix 系列矩阵
 * @param norad 目标 NORAD
 * @param taskStartMs 任务开始毫秒
 * @param taskEndMs 任务结束毫秒
 * @returns 热力图模型；无覆盖率数据时 cells 为空
 */
export const buildSingleSatelliteCoverageHeatModel = (
  matrix: MatrixResult,
  norad: number,
  taskStartMs: number,
  taskEndMs: number
): SingleSatCoverageHeatModel => {
  const emptyBase = {
    cells: [] as SingleSatCoverageHeatCell[],
    timeLabels: [] as string[],
    strikeSplitLabel: null as string | null,
    satelliteName: `Sat-${norad}`,
    norad,
    beforeCoverage: null as number | null,
    afterCoverage: null as number | null,
  }

  const taskStart = taskStartMs > 0 ? taskStartMs : Date.now()
  const taskEnd = Math.max(taskEndMs > 0 ? taskEndMs : taskStart, taskStart + 30 * 60 * 1000)
  const intervalMs = taskEnd - taskStart <= 24 * 60 * 60 * 1000 ? 30 * 60 * 1000 : 60 * 60 * 1000
  const sliceCount = Math.min(48, Math.max(1, Math.ceil((taskEnd - taskStart) / intervalMs)))
  const timeLabels = Array.from({ length: sliceCount }, (_, index) =>
    formatHeatmapTimeLabel(taskStart + index * intervalMs)
  )

  const initMatrixByNorad = new Map((matrix.initMatrixList || []).map((satellite) => [satellite.norad, satellite]))
  const postSat = (matrix.satelliteMatrixList || []).find((satellite) => satellite.norad === norad)
  const initialSatellite = initMatrixByNorad.get(norad)
  if (!postSat && !initialSatellite) {
    return { ...emptyBase, timeLabels }
  }

  const beforeCoverage = Number.isFinite(initialSatellite?.coverage) ? initialSatellite!.coverage! : null
  const afterCoverage = Number.isFinite(postSat?.coverage) ? postSat!.coverage! : null
  const satelliteName = postSat?.name || initialSatellite?.name || `Sat-${norad}`

  if (beforeCoverage == null && afterCoverage == null) {
    return { ...emptyBase, timeLabels, satelliteName, beforeCoverage, afterCoverage }
  }

  const strikeWindows = (postSat?.stationWindows || []).filter(
    (window) => window.strikeStatus === 1 || window.chainStrikeStatus === 1
  )
  const windowPool = strikeWindows.length ? strikeWindows : postSat?.stationWindows || []
  const transitionTimes = windowPool
    .map((window) => parseTimeToMs(window.peakWindow))
    .filter((timestamp) => timestamp > 0)
  /** 无打击窗口时不切换，全程按打击前覆盖率展示 */
  const hasStrikeTransition = transitionTimes.length > 0
  const transitionTime = hasStrikeTransition ? Math.min(...transitionTimes) : Number.POSITIVE_INFINITY

  /**
   * 打击前/后覆盖率切换的时间片下标（[0, splitIndex) 为打击前）。
   * 切换时刻落在某时间片起点时，该时间片仍视为打击前。
   */
  const resolveStrikeSplitIndex = (): number => {
    if (!hasStrikeTransition || !Number.isFinite(transitionTime)) {
      return timeLabels.length
    }
    if (transitionTime <= taskStart) {
      return Math.min(1, timeLabels.length)
    }
    return Math.min(
      timeLabels.length,
      Math.max(1, Math.ceil((transitionTime - taskStart) / intervalMs))
    )
  }
  const strikeSplitIndex = resolveStrikeSplitIndex()

  const cells: SingleSatCoverageHeatCell[] = []
  timeLabels.forEach((timeLabel, timeIndex) => {
    const useBeforeCoverage = timeIndex < strikeSplitIndex
    const coverage = useBeforeCoverage
      ? beforeCoverage ?? afterCoverage!
      : afterCoverage ?? beforeCoverage!
    if (coverage == null || !Number.isFinite(coverage)) return
    cells.push({
      timeLabel,
      bracket: getCoverageBracket(coverage),
      weight: 1,
    })
  })

  let strikeSplitLabel: string | null = null
  if (
    beforeCoverage != null &&
    afterCoverage != null &&
    Math.abs(beforeCoverage - afterCoverage) > 0.01 &&
    hasStrikeTransition &&
    strikeSplitIndex < timeLabels.length
  ) {
    strikeSplitLabel = timeLabels[strikeSplitIndex] ?? null
  }

  return {
    cells,
    timeLabels,
    strikeSplitLabel,
    satelliteName,
    norad,
    beforeCoverage,
    afterCoverage,
  }
}
