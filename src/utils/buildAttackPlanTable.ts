import type { AttackPlan, SatelliteAnalysisData } from '@/api/task/task'
import { parseFeedbackTimestamp } from '@/utils/zhchPlanDisplay'

/** 打击计划默认展示条数 */
export const ATTACK_PLAN_TOP_COUNT = 10

/** 打击计划表格行 */
export interface AttackPlanTableRow {
  /** 行唯一标识 */
  id: string
  /** 目标名称（卫星或地面站） */
  target: string
  /** 目标类型 */
  targetType: string
  /** 武器名称 */
  weaponName: string
  /** 打击开始时间 */
  beginTime: string
  /** 打击结束时间 */
  endTime: string
  /** 开始时间毫秒（排序用） */
  beginTimeMs: number
  /** 结束时间毫秒（排序用） */
  endTimeMs: number
}

/**
 * 将打击计划转为表格行。
 *
 * @param plan 打击计划
 * @param index 序号（用于生成唯一 id）
 * @returns 表格行
 */
const toAttackPlanRow = (plan: AttackPlan, index: number): AttackPlanTableRow => {
  const beginTime = plan.beginTime || '--'
  const endTime = plan.endTime || '--'
  const parsedBeginMs = parseFeedbackTimestamp(plan.beginTime)
  const parsedEndMs = parseFeedbackTimestamp(plan.endTime)

  return {
    id: `${plan.targetId || plan.target || 'target'}-${plan.beginTime || index}-${plan.weaponName || 'weapon'}-${index}`,
    target: plan.target || '--',
    targetType: plan.targetType || '',
    weaponName: plan.weaponName || '--',
    beginTime,
    endTime,
    beginTimeMs: parsedBeginMs ?? Number.MAX_SAFE_INTEGER,
    endTimeMs: parsedEndMs ?? Number.MAX_SAFE_INTEGER,
  }
}

/**
 * 从任务分析结果汇总各系列打击计划，并按开始时间升序排序。
 *
 * @param data 任务算法分析结果
 * @returns 打击计划表格行
 */
export const buildAttackPlanTableRows = (
  data: SatelliteAnalysisData | null | undefined
): AttackPlanTableRow[] => {
  if (!data) return []

  const rows: AttackPlanTableRow[] = []
  let index = 0

  ;(data.levelSeriesEntities || []).forEach((entity) => {
    ;(entity?.attackPlanList || []).forEach((plan) => {
      rows.push(toAttackPlanRow(plan, index))
      index += 1
    })
  })

  return rows.sort((a, b) => {
    if (a.beginTimeMs !== b.beginTimeMs) return a.beginTimeMs - b.beginTimeMs
    return a.target.localeCompare(b.target, 'zh-CN')
  })
}
