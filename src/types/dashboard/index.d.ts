

interface TaskForm {
  id?: number
  battleId: number
  name: string
  description: string
  beginDate: string
  endDate: string
  targetType: string
  steps: string //作战步骤
  targetTypeShow: string[]
  meCountry: string
  enemyCountry: string
  meCountryShow: string[]
  enemyCountryShow: string[]
  focusStatus: number
  algorithmProgressEntity?: {
    _id: string
    taskId: number
    totalStatus: '进行中' | '完成'
    totalMin: number | null
    transitStatus: '进行中' | '完成'
    transitMin: number | null
    threatAndStrikeStatus: '进行中' | '完成'
    threatAndStrikeMin: number | null
    mes: string | null
  }
}
interface BattleForm {
  id?: number
  name: string
  description: string
  createAreaMode: string
  beginDate: string
  endDate: string
  dataRefreshRate: string
  tasks: TaskForm[] | null
  circleJSON?: string
  area?: string
}
interface TLEDataResponse {
  taskId: number
  battleId: number
  beginDate: string
  endDate: string
  processing_time: number
  status: string
  results: SatelliteData[]
  summary: {
    error_count: number
    total_geometric_passes: number
    total_satellites: number
    total_sites: number
    total_visible_passes: number
  }
}
interface SatelliteData {
  norad_id: string
  name_en: string
  geoCoordinates: {
    latitude: number
    longitude: number
    altitude: number
  }
  country: string
  orbit_status: number
  orbit_type: number
  payload_status: number
  sat_type: string
  sites: Site
  strikeListResp: SatelliteStrike
}
type Site = Record<string, SiteDetail>
interface SiteDetail {
  geometric_passes: {
    azimuth: number
    elevation: number
    max_elevation: number
    max_time: string
    rise_time: string
    set_time: string
    visible: boolean
  }[]
  total_geometric: number
  total_visible: number
  visible_passes: {
    azimuth: number
    elevation: number
    max_elevation: number
    max_time: string
    rise_time: string
    set_time: string
    visible: boolean
    satellite_illuminated: boolean
    sun_altitude: number
  }[]
}
interface SatelliteNode {
  norad: number
  name_en: string
  country: string
  launch_place: string
  rocket: string
  contractors: string
  sat_type: string
  operator: string
  side?: string
}
interface SatelliteRelation {
  id: number
  source: number
  target: number
  relation: string
  timestamp: string
  min_distance_km: number
}
interface SceneConfig {
  taskId: number
  description?: string
  name?: string
  scene?: string
  weights: {
    static: number
    persistent: number
    instant: number
  }
  persistent_weights: {
    orbit_similarity: number
    orbital_coplanarity: number
    phase_stability: number
  }
  static_weights: {
    country: number
    orbit_type: number
    sat_type: number
  }
  country_scores: {
    美国: number
    日本: number
    英国: number
    法国: number
    印度: number
    俄罗斯: number
    其他: number
  }
  orbit_scores: {
    低轨: number
    大椭圆: number
    中轨: number
    高轨: number
    未知: number
  }
  sat_type_scores: {
    侦察: number
    导弹预警: number
    导航: number
    空间域感知: number
    通信: number
    其他: number
    科研教育类: number
  }
  persistent_scoring_rules: {
    orbit_similarity: {
      delta_sma_bins: number[] | string
      delta_sma_scores: number[] | string
      delta_inc_bins: number[] | string
      delta_inc_scores: number[] | string
      delta_ecc_bins: number[] | string
      delta_ecc_scores: number[] | string
    }
    orbital_coplanarity: {
      plane_distance_bins: number[] | string
      plane_distance_scores: number[] | string
    }
    phase_stability: {
      delta_u_bins: number[] | string
      delta_u_scores: number[] | string
    }
  }
  instant_scoring_rules: {
    close_encounter: {
      distance_bins_km: number[] | string
      distance_scores: number[] | string
    }
  }
  user_overrides?: SceneConfig & { updated_at: string }
}
interface Weapon {
  id?: string
  name: string
  country: string
  type: string
  latitude: number
  longitude: number
  range: number
}
interface SatelliteStrike {
  comprehensive_strike_score: number
  threat_score: number
  norad_id: string
  img: string
  int_id: string
  name_en: string
  country: string
  sat_type: string
  overallScore?: number
  optimal_time_window: string
  information_score: number
  kedaji_score: number
  orbit_type: number
  sort: number
  visibility_score: number
  weapon_score: number
  weapons_window: WeaponWindow[]
}
interface WeaponWindow {
  id: number
  name: string
  strike_window: string
}
interface SatelliteThreat {
  rank: number
  satellite_id: number
  country: string
  orbit_type: string
  sat_type: string
  threat_score: number
  threat_level: string
  name_en: string
  preDate: string
}

interface WeaponWeight {
  W_VIS: number
  W_INFO: number
  W_WEAPON: number
}
interface PointData {
  id: string
  name: string
  img: any
  longitude?: number
  latitude?: number
  height?: number
  type: string
  paths?: Position[] | Record<string, Position[]>
  modelPath?: string
}
