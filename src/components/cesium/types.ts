/**
 * 仿真场景组件的共享类型定义
 * 从 SatelliteUnReal.vue 中提取，集中管理以便各子模块引用
 */
import type * as Cesium from 'cesium'
import type {
  StrikePlanV2Extended,
  StrikePlanV2MissionWindowItem,
  StrikePlanV2PlanDetail,
} from '@/api/strikePlan/satellite-strikeplan-api'

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
