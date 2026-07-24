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
