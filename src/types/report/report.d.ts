/** 作战方案报告：按任务生成默认选星方案（OpenAPI `ReportGenerateResp`） */

/** 接口统一包裹内的报告生成结果 */
export interface ReportGenerateResp {
  /** 任务 id */
  taskId?: string
  /** 任务名称 */
  taskName?: string
  /** 该任务下全部默认方案列表 */
  schemes?: SchemeResult[]
}

/**
 * 单套作战选星方案（OpenAPI `SchemeResult`）。
 * 与历史「用途类型」方案并列展示时以 `code` / `name` 区分。
 */
export interface SchemeResult {
  /** 方案编码 */
  code?: string
  /** 方案名称 */
  name?: string
  /** 作战目标描述 */
  objective?: string
  /** 作战规模（如小/中/大） */
  scale?: string
  /** 选星数量目标 */
  targetSize?: number
  /** 入选卫星列表 */
  selected?: ReportCandidateSatellite[]
  /** 入选卫星评分，key 一般为 NORAD 或 satelliteId */
  selectedScores?: Record<string, number>
  /** 入选原因，key 与 `selectedScores` 对齐 */
  selectedReasons?: Record<string, string>
  /** 未入选原因说明，key 为 satelliteId / NORAD */
  unselectedReasons?: Record<string, string>
}

/**
 * 选星候选卫星（OpenAPI `CandidateSatellite`）。
 */
export interface ReportCandidateSatellite {
  /** 资源库卫星 id */
  satelliteId?: string
  /** NORAD 编号 */
  noradId?: string
  /** 卫星名称 */
  name?: string
  /** 所属国家 */
  country?: string
  /** 阵营 */
  camp?: string
  /** 体系 侦察/通信/中继 */
  system?: string
  /** 系列 */
  series?: string
  /** 威胁度 */
  threat?: number
  /** 覆盖率收益 */
  coverGain?: number
  /** 过境收益 */
  transitGain?: number
  /** 中继杠杆收益 */
  relayLeverage?: number
  /** 时间窗口起点 */
  timeWindowStart?: string
  /** 时间窗口终点 */
  timeWindowEnd?: string
  /** 当前是否在可用时间窗内 */
  inTimeWindow?: boolean
}