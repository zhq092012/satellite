import type { ZhchPlanResp } from '@/api/electronic'

/**
 * 天基侦察能力单指标打击前/后取值（与后端 `ReconCapabilityMetrics` 对齐）。
 */
export interface ReconCapabilityMetricValues {
  /** 侦察卫星过境数量 */
  transitCount: number
  /** 侦察卫星最早过境时间（展示字符串） */
  earliestTransitTime: string
  /** 最早数据回传时间（展示字符串） */
  earliestDataReturnTime: string
  /** 侦察卫星覆盖时段百分比（0–100） */
  coverageTimePercent: number
}

/**
 * 通信保障能力单指标打击前/后取值（与后端 `CommCapabilityMetrics` 对齐）。
 */
export interface CommCapabilityMetricValues {
  /** 覆盖范围（如 78% 或 560km，展示字符串） */
  coverageRange: string
  /** 重访时间（展示字符串，如 4.2小时） */
  revisitTime: string
  /** 处理时延（分钟，用于差值计算） */
  processingDelayMin: number
  /** 链路质量（0–1 或等级，展示字符串） */
  linkQuality: string
  /** 通信容量（展示字符串，如 1.2Gbps） */
  commCapacity: string
}

/**
 * 能力指标打击前/后快照（接口未就绪前的占位结构）。
 */
export interface ZhchPlanCapabilityMetricsMock {
  /** 天基侦察：打击前 */
  reconBefore: ReconCapabilityMetricValues
  /** 天基侦察：打击后 */
  reconAfter: ReconCapabilityMetricValues
  /** 通信保障：打击前 */
  commBefore: CommCapabilityMetricValues
  /** 通信保障：打击后 */
  commAfter: CommCapabilityMetricValues
}

/**
 * 根据方案规模生成略有差异的假数据（接入 API 后替换为 `plan.reconCapability` 等字段）。
 *
 * @param plan 综合打击方案
 * @returns 能力指标 mock
 */
export const buildMockZhchPlanCapabilityMetrics = (
  plan: ZhchPlanResp
): ZhchPlanCapabilityMetricsMock => {
  const scale = Math.min(1.2, Math.max(0.85, (plan.visibleWindowNum || 100) / 200))
  const covBefore = plan.beforeAvgCoverage ?? 48
  const covAfter = plan.afterAvgCoverage ?? 17

  return {
    reconBefore: {
      transitCount: Math.round(186 * scale),
      earliestTransitTime: '2026-09-16 07:42:11',
      earliestDataReturnTime: plan.beforeFirstFeedbackTime?.split('(')[0]?.trim() || '2026-09-16 08:07:19',
      coverageTimePercent: Number((covBefore * 1.05).toFixed(2)),
    },
    reconAfter: {
      transitCount: Math.round(112 * scale),
      earliestTransitTime: '2026-09-16 08:05:33',
      earliestDataReturnTime: plan.afterFirstFeedbackTime?.split('(')[0]?.trim() || '2026-09-16 08:27:34',
      coverageTimePercent: Number((covAfter * 0.95).toFixed(2)),
    },
    commBefore: {
      coverageRange: `${Math.min(99, covBefore + 30).toFixed(1)}%`,
      revisitTime: `${(4.2 * scale).toFixed(1)}小时`,
      processingDelayMin: Number((12.5 * scale).toFixed(1)),
      linkQuality: '0.91',
      commCapacity: `${(2.4 * scale).toFixed(1)}Gbps`,
    },
    commAfter: {
      coverageRange: `${Math.max(8, covAfter + 5).toFixed(1)}%`,
      revisitTime: `${(6.8 * scale).toFixed(1)}小时`,
      processingDelayMin: Number((28.3 * scale).toFixed(1)),
      linkQuality: '0.62',
      commCapacity: `${(1.1 * scale).toFixed(1)}Gbps`,
    },
  }
}
