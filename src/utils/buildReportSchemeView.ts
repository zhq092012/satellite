import type { SchemeResult } from '@/types/report/report'
import type { TaskForm } from '@/types/task/task'
import type { StrikePlanSchemeView } from '@/utils/buildStrikePlanSchemeView'
import { buildReportSchemeSelectedRows } from '@/utils/reportSchemeDisplay'

/**
 * 由报告接口方案构建页面视图（仅真实接口字段，无 mock / 打击计划占位）。
 *
 * @param schemeCode 方案 code
 * @param scheme 接口方案
 * @param task 当前任务（导出标题用）
 */
export const buildReportSchemeView = (
  schemeCode: string,
  scheme: SchemeResult,
  task: TaskForm,
): StrikePlanSchemeView => {
  const selectedRows = buildReportSchemeSelectedRows(scheme)

  return {
    usageType: schemeCode,
    reportScheme: scheme,
    meta: {
      planName: scheme.name?.trim() || schemeCode,
      combatBackground: '',
      commandSource: '',
      combatPhase: '',
      combatExpectation: '',
      analysisResult: '',
      planDescription: scheme.objective?.trim() || '',
    },
    satellites: selectedRows.map((row) => ({
      country: row.country || '',
      satelliteName: row.name,
      satelliteType: row.system || '',
      series: row.series || '',
    })),
    strikePlans: selectedRows.map((row) => ({
      country: row.country || '',
      satelliteName: row.name,
      satelliteType: row.system || '',
      series: row.series || '',
      weaponName: row.scoreText ? `综合得分 ${row.scoreText}` : '',
      weaponType: '',
      attackWindow: row.windowText || '',
    })),
  }
}