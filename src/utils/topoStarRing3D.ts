/**
 * 立体星环拓扑：3D 环层布局、配色与 3d-force-graph 数据装配
 */
import * as THREE from 'three'
import {
  getNodeDisplayName,
  resolveRingKey,
  type StarRingLayerKey,
  type TopoGraphEdge,
  type TopoGraphNode,
} from '@/utils/topoStarRingLayout'

/** 环层半径 / 基础半径 的比例，由外到内逐层收拢形成漏斗形 */
export const RING_RADIUS_RATIO: Record<StarRingLayerKey, number> = {
  sat: 1,
  relay: 0.7,
  receive: 0.47,
  station: 0.28,
  target: 0.47,
  position: 0.16,
}

/** 环层高度 / 基础半径 的比例，越靠外的层越高 */
export const RING_HEIGHT_RATIO: Record<StarRingLayerKey, number> = {
  sat: 0.68,
  relay: 0.45,
  receive: 0.25,
  station: 0.1,
  target: 0.26,
  position: 0,
}

/**
 * 相邻环层的起始角偏移。
 * 若各层都从同一角度起排，俯视时上下层节点会完全重叠成一条竖线。
 */
const RING_ANGLE_OFFSET: Record<StarRingLayerKey, number> = {
  sat: 0,
  relay: Math.PI / 9,
  receive: Math.PI / 5,
  station: Math.PI / 3,
  target: Math.PI / 7,
  position: 0,
}

/** 环层描边颜色 */
export const RING_STROKE_COLOR: Record<StarRingLayerKey, string> = {
  sat: '#bcd8ff',
  relay: '#ffd24a',
  receive: '#ff8a3d',
  station: '#8ea9ff',
  target: '#4da3ff',
  position: '#ffd24a',
}

/** 各环层节点基础配色 */
const NODE_COLOR: Record<StarRingLayerKey, string> = {
  sat: '#ffffff',
  relay: '#ffd24a',
  receive: '#ff8a3d',
  station: '#8ea9ff',
  target: '#4da3ff',
  position: '#ffd24a',
}

/** 被打击节点配色 */
const COLOR_STRUCK = '#ff4d4f'
/** 当前时刻我方正在作用（活跃）节点配色 */
const COLOR_ACTIVE = '#ff6b3d'
/** 选中节点配色 */
const COLOR_SELECTED = '#22e6ff'
/** 正常链路配色 */
const LINK_COLOR_NORMAL = '#3fd0e8'
/** 高亮链路配色 */
const LINK_COLOR_HIGHLIGHT = '#66f0ff'
/** 被打击链路配色 */
const LINK_COLOR_STRUCK = '#7b8ba3'

/** 3D 布局后的节点 */
export interface StarRing3DNode extends TopoGraphNode {
  /** 所属环层 */
  ringKey: StarRingLayerKey
  /** 展示名称 */
  label: string
  /** 3D 世界坐标 */
  position: THREE.Vector3
}

/** 环层圆环渲染配置 */
export interface RingLayer3DSpec {
  /** 环层标识 */
  key: StarRingLayerKey
  /** 环半径（世界坐标） */
  radius: number
  /** 环所在高度（世界坐标 Y） */
  y: number
  /** 描边颜色 */
  color: string
}

/** 阵地标记（最内层地面圆盘上的点位） */
export interface GroundPositionSpec {
  /** 阵地名称 */
  name: string
  /** 3D 世界坐标 */
  position: THREE.Vector3
}

/** 3d-force-graph 节点数据（含渲染尺寸参数） */
export interface TopoForceNode {
  id: string
  /** 展示名称 */
  label: string
  /** 所属环层 */
  ringKey: StarRingLayerKey
  /** 原始拓扑节点，回传给父组件用于联动选中 */
  topoNode: TopoGraphNode
  /** 节点主体颜色 */
  color: string
  /** 实心球半径（世界坐标） */
  coreRadius: number
  /** 外发光光斑缩放（世界坐标） */
  haloScale: number
  /** 外发光不透明度 */
  haloOpacity: number
  /** 是否直接显示名称标签（未选中的普通节点靠悬浮提示） */
  showLabel: boolean
  x: number
  y: number
  z: number
  /** 固定坐标，禁用力导向位移 */
  fx: number
  fy: number
  fz: number
}

/** 3d-force-graph 链路数据（含粒子参数） */
export interface TopoForceLink {
  source: string
  target: string
  /** 业务链路 ID，用于与左侧链路列表联动 */
  linkId: string
  /**
   * 链路颜色，带 alpha 的 rgba 字符串。
   * three-forcegraph 会把颜色的 alpha 与全局 linkOpacity 相乘，
   * 因此逐条链路的淡入淡出必须写进颜色而不是 linkOpacity。
   */
  color: string
  /** 粒子颜色（不带 alpha，保持流光明亮） */
  particleColor: string
  /** 弧线弯曲度 */
  curvature: number
  /** 流动粒子数量 */
  particles: number
  /** 粒子速度（每帧移动的链路长度比例） */
  particleSpeed: number
  /** 粒子半径（世界坐标） */
  particleWidth: number
}

/**
 * 将十六进制颜色转为带透明度的 rgba 字符串
 * @param hex 形如 #rrggbb 的颜色
 * @param alpha 透明度 0~1
 * @returns rgba 字符串
 */
const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * 根据各环层节点数量推算基础环半径，保证同环相邻节点有足够弧长间距
 * @param grouped 按环层分组后的节点集合
 * @returns 基础环半径（世界坐标）
 */
const computeBaseRadius = (grouped: Map<StarRingLayerKey, TopoGraphNode[]>): number => {
  let maxSpacingNeed = 0
  grouped.forEach((list, key) => {
    if (!list.length) return
    const ratio = RING_RADIUS_RATIO[key] || 1
    // 该层需要的基础半径 = 节点数 * 单节点弧长 / (2π * 层半径比例)
    maxSpacingNeed = Math.max(maxSpacingNeed, (list.length * 4.2) / (2 * Math.PI * ratio))
  })
  return Math.min(60, Math.max(20, maxSpacingNeed))
}

/**
 * 将一组节点均匀分布到指定环层上
 * @param nodes 该层节点列表
 * @param ringKey 环层标识
 * @param baseRadius 基础环半径
 * @returns 带 3D 坐标的节点列表
 */
export const layoutNodesOnRing3D = (
  nodes: TopoGraphNode[],
  ringKey: StarRingLayerKey,
  baseRadius: number
): StarRing3DNode[] => {
  if (!nodes.length) return []
  const radius = baseRadius * RING_RADIUS_RATIO[ringKey]
  const y = baseRadius * RING_HEIGHT_RATIO[ringKey]
  const startAngle = -Math.PI / 2 + RING_ANGLE_OFFSET[ringKey]
  const step = (Math.PI * 2) / nodes.length

  return nodes.map((node, index) => {
    const angle = startAngle + step * index
    return {
      ...node,
      ringKey,
      label: getNodeDisplayName(node),
      position: new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle)),
    }
  })
}

/**
 * 构建立体星环的 3D 布局（节点坐标、环层圆环、地面阵地点位）
 * @param nodes 拓扑节点
 * @param isComm 是否为通讯卫星系列
 * @param positionLabels 地面阵地名称列表
 * @returns 布局结果，含基础半径与堆叠顶部高度（供相机定位）
 */
export const buildStarRing3DLayout = (
  nodes: TopoGraphNode[],
  isComm: boolean,
  positionLabels: string[] = []
) => {
  const layerKeys: StarRingLayerKey[] = isComm ? ['sat', 'target'] : ['sat', 'relay', 'receive', 'station']

  const grouped = new Map<StarRingLayerKey, TopoGraphNode[]>()
  nodes.forEach((node) => {
    const key = resolveRingKey(node.kind)
    const list = grouped.get(key) || []
    list.push(node)
    grouped.set(key, list)
  })

  const baseRadius = computeBaseRadius(grouped)

  const layoutNodes: StarRing3DNode[] = []
  layerKeys.forEach((key) => {
    // 同层按名称排序，保证数据刷新时节点位置稳定不跳动
    const layerNodes = [...(grouped.get(key) || [])].sort((a, b) =>
      getNodeDisplayName(a).localeCompare(getNodeDisplayName(b), 'zh-CN')
    )
    layoutNodes.push(...layoutNodesOnRing3D(layerNodes, key, baseRadius))
  })

  const rings: RingLayer3DSpec[] = layerKeys.map((key) => ({
    key,
    radius: baseRadius * RING_RADIUS_RATIO[key],
    y: baseRadius * RING_HEIGHT_RATIO[key],
    color: RING_STROKE_COLOR[key],
  }))

  const groundRadius = baseRadius * RING_RADIUS_RATIO.position
  const positions: GroundPositionSpec[] = positionLabels.map((name, index) => {
    const angle = -Math.PI / 2 + ((Math.PI * 2) / Math.max(positionLabels.length, 1)) * index
    const r = positionLabels.length > 1 ? groundRadius * 0.78 : 0
    return {
      name,
      position: new THREE.Vector3(r * Math.cos(angle), baseRadius * 0.015, r * Math.sin(angle)),
    }
  })

  return {
    layoutNodes,
    rings,
    positions,
    baseRadius,
    groundRadius,
    /** 最外层（卫星层）高度，用于相机对准堆叠中部 */
    stackTopY: baseRadius * RING_HEIGHT_RATIO.sat,
  }
}

/**
 * 解析节点最终配色
 * @param node 布局节点
 * @param active 是否为当前时刻活跃节点
 * @param selected 是否被选中
 * @returns CSS 颜色字符串
 */
const resolveNodeColor = (node: StarRing3DNode, active: boolean, selected: boolean): string => {
  if (node.struck) return COLOR_STRUCK
  if (selected) return COLOR_SELECTED
  if (active) return COLOR_ACTIVE
  return NODE_COLOR[node.ringKey] ?? '#ffffff'
}

/**
 * 将拓扑图数据装配为 3d-force-graph 所需结构（固定环层坐标 + 粒子链路参数）
 * @param nodes 拓扑节点
 * @param edges 拓扑边
 * @param isComm 是否为通讯卫星系列
 * @param options 选中与活跃状态
 * @returns force-graph 数据、环层与地面装饰信息
 */
export const buildForceGraphData = (
  nodes: TopoGraphNode[],
  edges: TopoGraphEdge[],
  isComm: boolean,
  options: {
    /** 地面阵地名称 */
    positionLabels?: string[]
    /** 当前选中节点 ID */
    selectedNodeId?: string | null
    /** 当前选中链路 ID */
    selectedLinkId?: string | null
    /** 当前选中接收站 ID */
    selectedReceiveId?: string | null
    /** 当前选中卫星节点 ID */
    selectedSatId?: string | null
    /** 当前时刻活跃节点 ID 集合 */
    activeNodeIds?: Set<string>
  }
) => {
  const layout = buildStarRing3DLayout(nodes, isComm, options.positionLabels ?? [])
  const { layoutNodes, baseRadius } = layout
  const nodeIds = new Set(layoutNodes.map((n) => n.id))

  const forceNodes: TopoForceNode[] = layoutNodes.map((node) => {
    const active = options.activeNodeIds?.has(node.id) ?? false
    const selected = options.selectedNodeId === node.id
    const emphasized = active || selected
    const dimmed = !!options.selectedLinkId || (!!options.selectedNodeId && !selected)

    const coreRadius = baseRadius * (emphasized ? 0.026 : node.ringKey === 'sat' ? 0.021 : 0.017)

    return {
      id: node.id,
      label: node.label,
      ringKey: node.ringKey,
      topoNode: node,
      color: resolveNodeColor(node, active, selected),
      coreRadius,
      haloScale: coreRadius * (emphasized ? 9 : 6.5),
      haloOpacity: dimmed ? 0.1 : emphasized ? 0.6 : 0.32,
      showLabel: emphasized,
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
      fx: node.position.x,
      fy: node.position.y,
      fz: node.position.z,
    }
  })

  const forceLinks: TopoForceLink[] = []
  edges.forEach((edge) => {
    const source = String(edge.source)
    const target = String(edge.target)
    if (!nodeIds.has(source) || !nodeIds.has(target)) return

    const linkId = String(edge.linkId || '')
    const struck = !!edge.linkStruck
    const highlighted = options.selectedLinkId ? linkId === options.selectedLinkId : false
    const onReceivePath =
      !options.selectedLinkId &&
      !!options.selectedReceiveId &&
      !!options.selectedSatId &&
      ((source === options.selectedSatId && target === options.selectedReceiveId) ||
        source === options.selectedReceiveId ||
        target === options.selectedReceiveId)
    const focused = highlighted || onReceivePath
    const dimmed = options.selectedLinkId ? !highlighted : options.selectedReceiveId ? !onReceivePath : false

    const baseColor = struck ? LINK_COLOR_STRUCK : focused ? LINK_COLOR_HIGHLIGHT : LINK_COLOR_NORMAL
    const alpha = dimmed ? 0.07 : struck ? 0.22 : focused ? 0.9 : 0.42

    forceLinks.push({
      source,
      target,
      linkId,
      color: withAlpha(baseColor, alpha),
      particleColor: baseColor,
      curvature: 0.18,
      particles: dimmed ? 0 : struck ? 1 : focused ? 5 : 3,
      particleSpeed: focused ? 0.005 : struck ? 0.0015 : 0.0032,
      particleWidth: baseRadius * (focused ? 0.015 : 0.01),
    })
  })

  return { nodes: forceNodes, links: forceLinks, ...layout }
}
