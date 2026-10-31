import type { ChainNode } from '@/utils/satelliteFullChainAnalysis'

/**
 * 战场圆形区域。序号由布局 store 的 Map 键保存。
 */
export interface BattleCircleArea {
  /** 圆形区域名称 */
  name: string
  /** 圆心，[经度, 纬度] */
  center: [number, number]
  /** 半径（千米） */
  radiusKm: number
}

/**
 * 战场多边形区域。序号由布局 store 的 Map 键保存。
 */
export interface BattlePolygonArea {
  /** 多边形区域名称 */
  name: string
  /** 顶点经纬度，按绘制顺序排列 */
  lonlats: { lon: number; lat: number }[]
}

/**
 * 右侧面板选中的我方武器，用于地图定位。
 * 只保留定位所需字段，不替代武器库里的完整武器记录。
 */
export interface SelectedOurWeapon {
  /** 武器 ID；旧数据可能缺失 */
  id?: string
  /** 武器名称 */
  name: string
  /** 纬度（度） */
  latitude: number
  /** 经度（度） */
  longitude: number
  /** 射程（千米） */
  range?: number
}

/**
 * 从整体态势跳到打击窗口分析时携带的当前链路。
 */
export interface FocusedStrikeLinkSnapshot {
  /** 链路唯一标识 */
  id: string
  /** 节点路径文案（卫星 → 中继 → 地面站 → 数据中心） */
  pathText: string
  /** 链路时长展示 */
  durationText: string
  /** 传输时间区间 */
  transmitTime: string
  /** 状态文案 */
  statusText: string
  /** 是否阻断 */
  blocked: boolean
  /** 打击武器名称（多个以顿号分隔） */
  weaponNames: string
  /** 链路节点序列，用于匹配相关打击窗口 */
  nodes: ChainNode[]
}
