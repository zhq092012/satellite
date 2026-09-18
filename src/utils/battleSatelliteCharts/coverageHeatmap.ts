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
 * 矩阵只提供「打击前」「打击后」两个覆盖率标量，没有逐时刻采样值，因此这里按如下方式还原时间序列：
 * 1. 把任务时间轴按固定间隔切成不超过 48 个时间片，作为热力图横轴；
 * 2. 以打击窗口中最早的峰值时刻作为打击前/后的切换点，换算成时间片下标；
 * 3. 切换点之前的时间片填打击前覆盖率，之后填打击后覆盖率，形成阶跃式的热力分布。
 *
 * 任一覆盖率缺失时用另一侧的值兜底；两者皆缺时返回空 cells，仅保留时间轴与卫星信息。
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
  /** 各条提前返回路径共用的空模型基底，再按已知信息逐项覆盖 */
  const emptyBase = {
    cells: [] as SingleSatCoverageHeatCell[],
    timeLabels: [] as string[],
    strikeSplitLabel: null as string | null,
    satelliteName: `Sat-${norad}`,
    norad,
    beforeCoverage: null as number | null,
    afterCoverage: null as number | null,
  }

  /** 任务开始时刻；未传入有效值时退化为当前时间，保证时间轴可用 */
  const taskStart = taskStartMs > 0 ? taskStartMs : Date.now()
  /** 任务结束时刻；至少保留 30 分钟跨度，避免起止相同导致只有一个时间片 */
  const taskEnd = Math.max(taskEndMs > 0 ? taskEndMs : taskStart, taskStart + 30 * 60 * 1000)
  /** 时间片间隔：任务一天以内用 30 分钟，超过一天改用 1 小时 */
  const intervalMs = taskEnd - taskStart <= 24 * 60 * 60 * 1000 ? 30 * 60 * 1000 : 60 * 60 * 1000
  /** 时间片数量；上限 48 片，防止长任务把横轴撑得过密 */
  const sliceCount = Math.min(48, Math.max(1, Math.ceil((taskEnd - taskStart) / intervalMs)))
  /** 热力图横轴标签，从早到晚 */
  const timeLabels = Array.from({ length: sliceCount }, (_, index) =>
    formatHeatmapTimeLabel(taskStart + index * intervalMs)
  )

  /** 打击前卫星矩阵按 NORAD 索引 */
  const initMatrixByNorad = new Map((matrix.initMatrixList || []).map((satellite) => [satellite.norad, satellite]))
  /** 打击后卫星矩阵项（同时提供打击窗口） */
  const postSat = (matrix.satelliteMatrixList || []).find((satellite) => satellite.norad === norad)
  /** 打击前卫星矩阵项 */
  const initialSatellite = initMatrixByNorad.get(norad)
  // 该 NORAD 不在本系列矩阵中，只能返回空模型
  if (!postSat && !initialSatellite) {
    return { ...emptyBase, timeLabels }
  }

  /** 打击前覆盖率；字段缺失或非数值时为 null */
  const beforeCoverage = Number.isFinite(initialSatellite?.coverage) ? initialSatellite!.coverage! : null
  /** 打击后覆盖率；字段缺失或非数值时为 null */
  const afterCoverage = Number.isFinite(postSat?.coverage) ? postSat!.coverage! : null
  /** 卫星名称，优先取打击后矩阵，最终回落为 `Sat-<norad>` */
  const satelliteName = postSat?.name || initialSatellite?.name || `Sat-${norad}`

  // 前后覆盖率都没有，无法映射任何梯队，保留时间轴与卫星信息即可
  if (beforeCoverage == null && afterCoverage == null) {
    return { ...emptyBase, timeLabels, satelliteName, beforeCoverage, afterCoverage }
  }

  /** 明确标记为已打击（直接打击或链路打击）的过站窗口 */
  const strikeWindows = (postSat?.stationWindows || []).filter(
    (window) => window.strikeStatus === 1 || window.chainStrikeStatus === 1
  )
  /** 用于推断切换时刻的窗口集合；无打击标记时退化为全部过站窗口 */
  const windowPool = strikeWindows.length ? strikeWindows : postSat?.stationWindows || []
  /** 候选切换时刻（各窗口峰值时间），已剔除解析失败项 */
  const transitionTimes = windowPool
    .map((window) => parseTimeToMs(window.peakWindow))
    .filter((timestamp) => timestamp > 0)
  /** 无打击窗口时不切换，全程按打击前覆盖率展示 */
  const hasStrikeTransition = transitionTimes.length > 0
  /** 实际切换时刻，取最早的候选峰值时间；不切换时为正无穷 */
  const transitionTime = hasStrikeTransition ? Math.min(...transitionTimes) : Number.POSITIVE_INFINITY

  /**
   * 打击前/后覆盖率切换的时间片下标（[0, splitIndex) 为打击前）。
   * 切换时刻落在某时间片起点时，该时间片仍视为打击前。
   *
   * @returns 切换下标；不切换时等于时间片总数（即全程打击前）
   */
  const resolveStrikeSplitIndex = (): number => {
    // 没有可用的切换时刻：整条时间轴都算打击前
    if (!hasStrikeTransition || !Number.isFinite(transitionTime)) {
      return timeLabels.length
    }
    // 打击发生在任务开始之前：至少保留首个时间片作为打击前，避免整图无对照
    if (transitionTime <= taskStart) {
      return Math.min(1, timeLabels.length)
    }
    // 向上取整落到切换时刻所在片，并夹取到 [1, 时间片总数]
    return Math.min(
      timeLabels.length,
      Math.max(1, Math.ceil((transitionTime - taskStart) / intervalMs))
    )
  }
  /** 打击前/后分界的时间片下标 */
  const strikeSplitIndex = resolveStrikeSplitIndex()

  /** 热力单元格：每个时间片取对应阶段的覆盖率并映射到梯队 */
  const cells: SingleSatCoverageHeatCell[] = []
  timeLabels.forEach((timeLabel, timeIndex) => {
    /** 当前时间片是否处于打击前区间 */
    const useBeforeCoverage = timeIndex < strikeSplitIndex
    // 所需阶段的覆盖率缺失时用另一侧兜底；前面已确保至少一侧有值
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

  /**
   * 分界线标签：仅在前后覆盖率确有差异（>0.01）、存在打击切换
   * 且切换点落在时间轴范围内时才标注，否则图上不画分界。
   */
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
