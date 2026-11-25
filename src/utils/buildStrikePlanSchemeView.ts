import type { ReportStageResult, SchemeResult } from '@/types/report/report'

/** 方案概要字段（页面顶部依次展示；报告方案多数为空占位） */
export interface StrikePlanSchemeMeta {
  /** 方案名称（作战阶段-作战预期一级） */
  planName: string
  /** 作战背景 */
  combatBackground: string
  /** 命令来源 */
  commandSource: string
  /** 作战阶段 */
  combatPhase: string
  /** 作战预期（一级/二级） */
  combatExpectation: string
  /** 分析结果（打击计划叙述） */
  analysisResult: string
  /** 方案描述 */
  planDescription: string
}

/** 卫星清单行 */
export interface StrikePlanSatelliteRow {
  /** 所属国家 */
  country: string
  /** 卫星名称 */
  satelliteName: string
  /** 卫星类型 */
  satelliteType: string
  /** 卫星系列 */
  series: string
}

/** 打击计划行（导出与表格共用） */
export interface StrikePlanStrikeRow {
  /** 所属国家 */
  country: string
  /** 卫星名称 */
  satelliteName: string
  /** 卫星类型 */
  satelliteType: string
  /** 卫星系列 */
  series: string
  /** 武器名称 */
  weaponName: string
  /** 武器类型 */
  weaponType: string
  /** 打击窗口 */
  attackWindow: string
}

/** 单方案完整视图（作战方案管理 / 报告 API） */
export interface StrikePlanSchemeView {
  /** 列标识（报告接口 scheme.code） */
  usageType: string
  /** 概要字段 */
  meta: StrikePlanSchemeMeta
  /** 卫星列表 */
  satellites: StrikePlanSatelliteRow[]
  /** 打击计划列表（导出行） */
  strikePlans: StrikePlanStrikeRow[]
  /** 报告接口返回的选星方案 */
  reportScheme: SchemeResult
  /** 与方案格子匹配的 stage（scheme.code 前缀对应 stage.code） */
  reportStage?: ReportStageResult
}

/**
 * 合并多个方案的打击计划行（用于导出）。
 *
 * @param views 方案视图列表
 */
export function flattenStrikePlanRowsForExport(views: StrikePlanSchemeView[]): StrikePlanStrikeRow[] {
  return views.flatMap((view) => view.strikePlans.map((row) => ({ ...row })))
}