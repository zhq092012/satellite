/**
 * 仿真场景组件的共享类型定义
 * 从 SatelliteUnReal.vue 中提取，集中管理以便各子模块引用
 */
import type * as Cesium from 'cesium'
export interface Strike {
  norad_id: number
  name: string
  country: string
  sat_type: string
  orbit_altitude_km: number
  visibility_score: number
  information_score: number
  weapon_score: number
  kedaji_score: number
  weapons_window: {
    id: number
    name: string
    strike_window: string
  }[]
}
export type StrikeV2 = {
  strikeList: {
    norad_id: number
    name: string
    country: string
    sat_type: string
    orbit_type: string
    orbit_altitude_km: number
    x1: number
    x2: number
    x3: number
    x4: number
    x5: number
    x6: number
    x7: number
    strikeability_score: number
    x1_details: {
      method: string
      reference_time_utc: string | null
      reference_time_source: string | null
      subsatellite_latitude: number
      subsatellite_longitude: number
      subsatellite_longitude_east: number
      subsatellite_height_km: number
    }
    visibility_score: null
    information_score: null
    weapon_score: null
    weapons_window: {
      id: number
      name: string
      strike_window: string
    }[]
  }[]
  num: number
  maxStrikeScore: number
  minStrikeScore: number
  hightNum: number
  lowNum: number
}

export interface StrikePlan {
  feasible_count: number
  max_window_duration_min: number
  intensity_levels: string[]
  plans: {
    高: {
      threat_first: {
        plan_name: string
        intensity: string
        plan_type: string
        plan_summary: string
        planDoc?: string
        metrics: {
          total_score: number
          total_threat_reduced: number
          targets_count: number
          weapon_type_distribution: record<string, number>
          time_range: string
        }
        tuples: {
          weapon_id: string
          weapon_name: string
          weapon_type: string
          weapon_type_label: string
          weapon_country: string | null
          weapon_site: string | null
          satellite_id: number
          satellite_type: string
          orbit_type: string
          window_start: string
          window_end: string
          window_duration: number
          sat_threat: number
          sat_strike: number
          duration_norm: number
          window_quality: number
          weapon_pref_rank: number
          weapon_pref_bonus: number
          score_threat: number
          score_count: number
        }[]
      }
      max_targets: {
        plan_name: string
        intensity: string
        plan_type: string
        plan_summary: string
        planDoc?: string
        metrics: {
          total_score: number
          total_threat_reduced: number
          targets_count: number
          weapon_type_distribution: record<string, number>
          time_range: string
        }
        tuples: {
          weapon_id: string
          weapon_name: string
          weapon_type: string
          weapon_type_label: string
          weapon_country: string | null
          weapon_site: string | null
          satellite_id: number
          satellite_type: string
          orbit_type: string
          window_start: string
          window_end: string
          window_duration: number
          sat_threat: number
          sat_strike: number
          duration_norm: number
          window_quality: number
          weapon_pref_rank: number
          weapon_pref_bonus: number
          score_threat: number
          score_count: number
        }[]
      }
    }
    中: {
      threat_first: {
        plan_name: string
        intensity: string
        plan_type: string
        plan_summary: string
        planDoc?: string
        metrics: {
          total_score: number
          total_threat_reduced: number
          targets_count: number
          weapon_type_distribution: record<string, number>
          time_range: string
        }
        tuples: {
          weapon_id: string
          weapon_name: string
          weapon_type: string
          weapon_type_label: string
          weapon_country: string | null
          weapon_site: string | null
          satellite_id: number
          satellite_type: string
          orbit_type: string
          window_start: string
          window_end: string
          window_duration: number
          sat_threat: number
          sat_strike: number
          duration_norm: number
          window_quality: number
          weapon_pref_rank: number
          weapon_pref_bonus: number
          score_threat: number
          score_count: number
        }[]
      }
      max_targets: {
        plan_name: string
        intensity: string
        plan_type: string
        plan_summary: string
        planDoc?: string
        metrics: {
          total_score: number
          total_threat_reduced: number
          targets_count: number
          weapon_type_distribution: record<string, number>
          time_range: string
        }
        tuples: {
          weapon_id: string
          weapon_name: string
          weapon_type: string
          weapon_type_label: string
          weapon_country: string | null
          weapon_site: string | null
          satellite_id: number
          satellite_type: string
          orbit_type: string
          window_start: string
          window_end: string
          window_duration: number
          sat_threat: number
          sat_strike: number
          duration_norm: number
          window_quality: number
          weapon_pref_rank: number
          weapon_pref_bonus: number
          score_threat: number
          score_count: number
        }[]
      }
    }
    低: {
      threat_first: {
        plan_name: string
        intensity: string
        plan_type: string
        plan_summary: string
        planDoc?: string
        metrics: {
          total_score: number
          total_threat_reduced: number
          targets_count: number
          weapon_type_distribution: record<string, number>
          time_range: string
        }
        tuples: {
          weapon_id: string
          weapon_name: string
          weapon_type: string
          weapon_type_label: string
          weapon_country: string | null
          weapon_site: string | null
          satellite_id: number
          satellite_type: string
          orbit_type: string
          window_start: string
          window_end: string
          window_duration: number
          sat_threat: number
          sat_strike: number
          duration_norm: number
          window_quality: number
          weapon_pref_rank: number
          weapon_pref_bonus: number
          score_threat: number
          score_count: number
        }[]
      }
      max_targets: {
        plan_name: string
        intensity: string
        plan_type: string
        plan_summary: string
        planDoc?: string
        metrics: {
          total_score: number
          total_threat_reduced: number
          targets_count: number
          weapon_type_distribution: record<string, number>
          time_range: string
        }
        tuples: {
          weapon_id: string
          weapon_name: string
          weapon_type: string
          weapon_type_label: string
          weapon_country: string | null
          weapon_site: string | null
          satellite_id: number
          satellite_type: string
          orbit_type: string
          window_start: string
          window_end: string
          window_duration: number
          sat_threat: number
          sat_strike: number
          duration_norm: number
          window_quality: number
          weapon_pref_rank: number
          weapon_pref_bonus: number
          score_threat: number
          score_count: number
        }[]
      }
    }
  }
  calMap: {
    最大可利用打击窗口: 475
    '在轨目标-国家': '美国'
    '在轨目标-轨道类型': '低轨,中轨,高轨'
    '敌方高威胁目标-卫星类型': '导航'
    最高威胁值: 0.79
    '在轨目标-卫星类型': '侦察,导航,通信,导弹预警'
    输入目标集: 74
  }
}

import type {
  StrikePlanV2Extended,
  StrikePlanV2MissionWindowItem,
  StrikePlanV2PlanDetail,
} from '@/api/strikePlan/satellite-strikeplan-api'
import type { SatelliteRelation } from '@/types/dashboard'

// ─── 重新导出 API 类型，方便子模块统一从此处引入 ───
export type {
  StrikePlanV2Extended,
  StrikePlanV2MissionWindowItem,
  StrikePlanV2PlanDetail,
}

// ─── 蓝方卫星记录 ───
export interface BlueSatelliteRecord {
  noradId: string
  name: string
  country: string
  satType: string
  orbitType?: number
  longitude: number
  latitude: number
  altitude: number
  stageName: string
}

// ─── 指标卡片 ───
export interface MetricCard {
  label: string
  value: string
  percent: number
  hint: string
}

// ─── 阶段项 ───
export interface StageItem {
  name: string
  window: string
  startTime?: string
  endTime?: string
}

// ─── 历史方案卡片（方案 × 打击模式） ───
export interface HistoricalPlanCard {
  key: string
  plan: StrikePlanV2Extended
  mode: 'threat_first' | 'max_targets'
  detail: StrikePlanV2PlanDetail
}

// ─── 打击队列项 ───
export interface ActiveStrikeQueueItem {
  id: string
  summary: string
  timeWindow: string
}

// ─── 打击阶段 ───
export type StrikePhase = 'idle' | 'active' | 'fading' | 'done'

// ─── 卫星关系项 ───
export interface SatelliteRelationItem {
  satellite: BlueSatelliteRecord
  label: string
  distanceKm: number
  color: string
  priority: number
  relation: SatelliteRelation
}

// ─── 打击样式 ───
export interface StrikeTypeStyle {
  width: number
  material: Cesium.Color | Cesium.PolylineDashMaterialProperty | Cesium.PolylineGlowMaterialProperty | Cesium.PolylineArrowMaterialProperty
  pointColor: Cesium.Color
  ellipseColor: Cesium.Color
  ellipseOutlineColor: Cesium.Color
  satelliteColor: Cesium.Color
  effectColor: Cesium.Color
}
