/**
 * 杀伤链方案 → 历史方案数据适配器
 * 将低/中/高烈度杀伤链方案统一转换为 StrikePlanV2Extended 格式，
 * 使得不同来源的方案可以复用同一套打击视图渲染逻辑
 */
import type {
  RespKillChainPlanHigh,
  RespKillChainPlanLow,
  RespKillChainPlanMiddle,
  StrikePlanV2Extended,
  StrikePlanV2MissionWindowItem,
  StrikePlanV2PlanDetail,
} from '@/api/strikePlan/satellite-strikeplan-api'

/**
 * 将任意烈度的杀伤链方案转换为历史方案格式
 * 返回 null 表示转换失败（不支持的烈度类型）
 */
export const buildHistoricalPlanFromKillChainPlan = (
  plan: RespKillChainPlanLow | RespKillChainPlanMiddle | RespKillChainPlanHigh
): StrikePlanV2Extended | null => {
  const createPlanDetail = (
    planName: string,
    intensity: string,
    overview: StrikePlanV2PlanDetail['plan_summary']['overview'],
    assetConfig: StrikePlanV2PlanDetail['plan_summary']['asset_config'],
    missionWindows: StrikePlanV2MissionWindowItem[],
    timeWindow: StrikePlanV2PlanDetail['plan_summary']['time_window']
  ): StrikePlanV2PlanDetail => ({
    plan_name: planName,
    intensity,
    plan_summary: {
      overview,
      target_analysis: [],
      asset_config: assetConfig,
      mission_windows: missionWindows,
      time_window: timeWindow,
      strategy: { plan_type_hint: '', intensity_hint: '' },
      generated_at: '',
    },
    metrics: {
      total_score: 0,
      total_threat_reduced: 0,
      targets_count: overview.targets_count,
      weapon_type_distribution: {},
      time_range: '',
    },
  })

  switch (plan.intensityLevel) {
    case '低烈度': {
      const planLow = plan as RespKillChainPlanLow
      const plans = Array.isArray(planLow.plan) ? planLow.plan : [planLow.plan]
      const targetPlan = plans[0]
      const missionWindows: StrikePlanV2MissionWindowItem[] = []
      let windowIndex = 0

      if (targetPlan) {
        const stationTypeById = new Map((targetPlan.stationDetails || []).map((item) => [item.stationId, item.type]))
        for (const strike of targetPlan.strikeList || []) {
          const satelliteType = stationTypeById.get(strike.stationId) || '雷达站'
          for (const window of strike.windows || []) {
            missionWindows.push({
              index: windowIndex++,
              weapon_id: strike.weaponId,
              weapon_name: strike.weaponName,
              window_start: window.windowStart,
              window_end: window.windowEnd,
              satellite_id: strike.stationId as any,
              satellite_type: satelliteType,
              satellite_country: '',
              orbit_type: '',
              threat: 0,
            })
          }
        }
      }

      const assetConfig = ((targetPlan?.elecWeapons) || []).map((weapon) => ({
        weapon_id: weapon.id || '',
        weapon_name: weapon.name,
        weapon_type: weapon.type,
      }))

      const overview = {
        input_count: targetPlan?.targetStationNum || targetPlan?.actualStationNum || 0,
        targets_count: targetPlan?.actualStationNum || 0,
        assets_count: targetPlan?.elecWeapons?.length || 0,
        avg_threat: 0,
        avg_strike: 0,
      }
      const timeWindow = {
        start: targetPlan?.planWindowStart || '',
        end: targetPlan?.planWindowEnd || '',
        range: '',
      }

      return {
        _id: planLow._id,
        name: planLow.name,
        version: planLow.version,
        intensityLevel: '低烈度',
        types: planLow.types || [],
        weaponNames: planLow.weaponNames || [],
        taskId: planLow.taskId,
        battleId: planLow.battleId,
        userId: planLow.userId,
        feasible_count: targetPlan?.actualChainNum || 0,
        max_window_duration_min: 0,
        intensity_levels: ['低烈度'],
        plans: {
          ['低烈度']: {
            threat_first: createPlanDetail(planLow.name, '低烈度', overview, assetConfig, missionWindows, timeWindow),
            max_targets: createPlanDetail(planLow.name, '低烈度', overview, assetConfig, missionWindows, timeWindow),
          },
        } as any,
        stepName: planLow.stepName,
        stepTarget: planLow.stepTarget,
        planSummary: planLow.planSummary,
      }
    }
    case '中烈度': {
      const planMiddle = plan as RespKillChainPlanMiddle
      const missionWindows: StrikePlanV2MissionWindowItem[] = []
      let windowIndex = 0
      const plans = Array.isArray(planMiddle.plan) ? planMiddle.plan : [planMiddle.plan]
      const targetPlan = plans[0]

      if (targetPlan) {
        // 1. 地面打击窗口
        for (const strike of targetPlan.strikeList || []) {
          for (const window of strike.windows || []) {
            missionWindows.push({
              index: windowIndex++,
              weapon_id: strike.missileBaseId,
              weapon_name: strike.missileBaseName,
              window_start: window.windowStart,
              window_end: window.windowEnd,
              satellite_id: strike.stationId as any,
              satellite_type: strike.stationType || '基站',
              satellite_country: strike.stationCountry || '',
              orbit_type: '',
              threat: 0,
            })
          }
        }
        // 2. 卫星打击窗口 (定向能武器打击卫星)
        for (const dw of targetPlan.directedWindows || []) {
          missionWindows.push({
            ...dw,
            index: windowIndex++,
          })
        }
      }

      const uniqueAssetsMap = new Map<string, { weapon_id: string; weapon_name: string; weapon_type: string }>()
      if (targetPlan) {
        for (const base of targetPlan.missileBases || []) {
          uniqueAssetsMap.set(base.missileBaseId, {
            weapon_id: base.missileBaseId || '',
            weapon_name: base.missileBaseName,
            weapon_type: '导弹基地',
          })
        }
        for (const dw of targetPlan.directedWindows || []) {
          uniqueAssetsMap.set(dw.weapon_id, {
            weapon_id: dw.weapon_id || '',
            weapon_name: dw.weapon_name,
            weapon_type: '定向能',
          })
        }
      }
      const assetConfig = Array.from(uniqueAssetsMap.values())

      const overview = {
        input_count: targetPlan?.targetStationNum || targetPlan?.actualStationNum || 0,
        targets_count: (targetPlan?.actualStationNum || 0) + (targetPlan?.directedWindows?.length || 0),
        assets_count: assetConfig.length,
        avg_threat: 0,
        avg_strike: 0,
      }
      const timeWindow = {
        start: targetPlan?.planWindowStart || '',
        end: targetPlan?.planWindowEnd || '',
        range: '',
      }

      return {
        _id: planMiddle._id,
        name: planMiddle.name,
        version: planMiddle.version,
        intensityLevel: '中烈度',
        types: planMiddle.types || [],
        weaponNames: planMiddle.weaponNames || [],
        taskId: planMiddle.taskId,
        battleId: planMiddle.battleId,
        userId: planMiddle.userId,
        feasible_count: 0,
        max_window_duration_min: 0,
        intensity_levels: ['中烈度'],
        plans: {
          ['中烈度']: {
            threat_first: createPlanDetail(planMiddle.name, '中烈度', overview, assetConfig, missionWindows, timeWindow),
            max_targets: createPlanDetail(planMiddle.name, '中烈度', overview, assetConfig, missionWindows, timeWindow),
          },
        } as any,
        stepName: targetPlan?.stepName || '',
        stepTarget: targetPlan?.stepTarget || '',
        planSummary: targetPlan?.planSummary
          ? (typeof targetPlan.planSummary === 'string'
            ? targetPlan.planSummary
            : Object.values(targetPlan.planSummary).join('; '))
          : '',
      }
    }
    case '高烈度': {
      const planHigh = plan as RespKillChainPlanHigh
      const plans = Array.isArray(planHigh.plan) ? planHigh.plan : [planHigh.plan]
      const targetPlan = plans[0]
      return {
        _id: planHigh._id,
        name: planHigh.name,
        version: planHigh.version,
        intensityLevel: planHigh.intensityLevel,
        types: planHigh.types || [],
        weaponNames: planHigh.weaponNames || [],
        taskId: planHigh.taskId,
        battleId: planHigh.battleId,
        userId: planHigh.userId,
        feasible_count: Number(targetPlan?.feasible_count || 0),
        max_window_duration_min: Number(targetPlan?.max_window_duration_min || 0),
        intensity_levels: targetPlan?.intensity_levels || [],
        plans: targetPlan?.plans as any,
        stepName: planHigh.stepName,
        stepTarget: planHigh.stepTarget,
        planSummary: planHigh.planSummary,
      }
    }
    default:
      return null
  }
}
