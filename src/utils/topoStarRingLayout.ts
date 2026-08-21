/**
 * 星环拓扑布局工具：将 G6 拓扑节点按层级映射到同心环坐标
 */

/** G6 拓扑节点最小字段集 */
export interface TopoGraphNode {
  id: string
  nodeName?: string
  label?: string
  kind?: string
  layer?: number
  struck?: boolean
}

/** G6 拓扑边最小字段集 */
export interface TopoGraphEdge {
  id: string
  source: string
  target: string
  linkId?: string
  linkStruck?: boolean
  style?: { stroke?: string; opacity?: number; lineDash?: number[] }
}

/** 星环层级标识 */
export type StarRingLayerKey = 'sat' | 'relay' | 'receive' | 'station' | 'target' | 'position'

/** 星环层级配置 */
export interface StarRingLayerConfig {
  key: StarRingLayerKey
  /** 环半径占画布短边的比例 */
  radiusRatio: number
  /** 是否虚线环 */
  dashed?: boolean
  /** 环描边颜色 */
  stroke: string
  /** 节点默认颜色 */
  nodeColor: string
  /** 节点发光颜色 */
  glowColor: string
}

/** 布局后的节点坐标 */
export interface StarRingNodeLayout extends TopoGraphNode {
  ringKey: StarRingLayerKey
  x: number
  y: number
  z?: number
  label: string
}

/** 环层图例项 */
export interface StarRingLegendItem {
  color: string
  label: string
  shape: 'circle' | 'dashed-ring' | 'disc'
}

/** 侦察系列默认环层配置（由内到外：阵地 → 数据中心 → 接收站 → 中继 → 过境卫星） */
export const RECON_RING_LAYERS: StarRingLayerConfig[] = [
  { key: 'position', radiusRatio: 0.12, dashed: true, stroke: 'rgba(250, 204, 21, 0.45)', nodeColor: '#facc15', glowColor: 'rgba(250, 204, 21, 0.6)' },
  { key: 'station', radiusRatio: 0.22, stroke: 'rgba(59, 130, 246, 0.35)', nodeColor: '#3b82f6', glowColor: 'rgba(59, 130, 246, 0.5)' },
  { key: 'receive', radiusRatio: 0.34, stroke: 'rgba(251, 146, 60, 0.35)', nodeColor: '#fb923c', glowColor: 'rgba(251, 146, 60, 0.55)' },
  { key: 'relay', radiusRatio: 0.48, stroke: 'rgba(250, 204, 21, 0.35)', nodeColor: '#facc15', glowColor: 'rgba(250, 204, 21, 0.55)' },
  { key: 'sat', radiusRatio: 0.62, stroke: 'rgba(255, 255, 255, 0.25)', nodeColor: '#ffffff', glowColor: 'rgba(0, 225, 255, 0.65)' },
]

/** 通讯系列环层配置 */
export const COMM_RING_LAYERS: StarRingLayerConfig[] = [
  { key: 'position', radiusRatio: 0.18, dashed: true, stroke: 'rgba(250, 204, 21, 0.45)', nodeColor: '#facc15', glowColor: 'rgba(250, 204, 21, 0.6)' },
  { key: 'target', radiusRatio: 0.38, stroke: 'rgba(24, 144, 255, 0.35)', nodeColor: '#1890ff', glowColor: 'rgba(24, 144, 255, 0.55)' },
  { key: 'sat', radiusRatio: 0.58, stroke: 'rgba(255, 255, 255, 0.25)', nodeColor: '#ffffff', glowColor: 'rgba(0, 225, 255, 0.65)' },
]

/**
 * 将 G6 节点 kind 映射为星环层级
 * @param kind 节点类型
 * @returns 星环层级 key
 */
export const resolveRingKey = (kind?: string): StarRingLayerKey => {
  switch (kind) {
    case 'relay':
      return 'relay'
    case 'receive':
      return 'receive'
    case 'station':
      return 'station'
    case 'target':
      return 'target'
    default:
      return 'sat'
  }
}

/**
 * 获取节点展示名称
 * @param node G6 节点
 * @returns 展示名称
 */
export const getNodeDisplayName = (node: TopoGraphNode): string => {
  if (node.nodeName) return node.nodeName
  if (node.label) return String(node.label).split('\n')[0]
  return node.id
}

/**
 * 在指定半径的环上均匀分布节点
 * @param nodes 节点列表
 * @param cx 圆心 X
 * @param cy 圆心 Y
 * @param radius 环半径
 * @param ringKey 环层级
 * @param startAngle 起始角度（弧度）
 * @returns 带坐标的节点列表
 */
export const layoutNodesOnRing = (
  nodes: TopoGraphNode[],
  cx: number,
  cy: number,
  radius: number,
  ringKey: StarRingLayerKey,
  startAngle = -Math.PI / 2
): StarRingNodeLayout[] => {
  if (!nodes.length) return []
  const step = (Math.PI * 2) / nodes.length
  return nodes.map((node, index) => {
    const angle = startAngle + step * index
    return {
      ...node,
      ringKey,
      label: getNodeDisplayName(node),
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  })
}

/**
 * 将 G6 图数据转换为星环布局坐标
 * @param nodes G6 节点列表
 * @param width 画布宽度
 * @param height 画布高度
 * @param isComm 是否为通讯系列
 * @param positionLabels 最内虚线环展示的阵地名称
 * @returns 布局后的节点与环配置
 */
export const buildStarRingLayout = (
  nodes: TopoGraphNode[],
  width: number,
  height: number,
  isComm: boolean,
  positionLabels: string[] = []
) => {
  const cx = width / 2
  const cy = height / 2
  const baseRadius = Math.min(width, height) * 0.42
  const ringLayers = isComm ? COMM_RING_LAYERS : RECON_RING_LAYERS

  const grouped = new Map<StarRingLayerKey, TopoGraphNode[]>()
  nodes.forEach((node) => {
    const key = resolveRingKey(node.kind)
    const list = grouped.get(key) || []
    list.push(node)
    grouped.set(key, list)
  })

  const layoutNodes: StarRingNodeLayout[] = []
  ringLayers.forEach((layer) => {
    if (layer.key === 'position') return
    const layerNodes = grouped.get(layer.key) || []
    const radius = baseRadius * layer.radiusRatio
    layoutNodes.push(...layoutNodesOnRing(layerNodes, cx, cy, radius, layer.key))
  })

  const rings = ringLayers.map((layer) => ({
    ...layer,
    radius: baseRadius * layer.radiusRatio,
    cx,
    cy,
  }))

  const positions = positionLabels.map((name, index) => {
    const angle = -Math.PI / 2 + ((Math.PI * 2) / Math.max(positionLabels.length, 1)) * index
    const radius = baseRadius * (ringLayers.find((l) => l.key === 'position')?.radiusRatio ?? 0.12)
    return {
      name,
      x: cx + radius * Math.cos(angle) * 0.85,
      y: cy + radius * Math.sin(angle) * 0.85,
    }
  })

  return { layoutNodes, rings, positions, cx, cy, baseRadius }
}

/**
 * 构建环层图例数据
 * @param isComm 是否为通讯系列
 * @returns 图例项列表
 */
export const buildStarRingLegend = (isComm: boolean): StarRingLegendItem[] => {
  if (isComm) {
    return [
      { color: '#ffffff', label: '外环 · 通讯卫星', shape: 'circle' },
      { color: '#1890ff', label: '中环 · 战场目标', shape: 'circle' },
      { color: '#facc15', label: '最内虚线环 · 阵地', shape: 'dashed-ring' },
      { color: '#fb923c', label: '橙/红 · 我方正在作用', shape: 'circle' },
    ]
  }
  return [
    { color: '#ffffff', label: '外环 · 过境卫星', shape: 'circle' },
    { color: '#facc15', label: '中环 · 中继卫星', shape: 'circle' },
    { color: '#fb923c', label: '内环 · 接收站 / 数据中心', shape: 'circle' },
    { color: '#facc15', label: '最内虚线环 · 阵地', shape: 'dashed-ring' },
    { color: '#fb923c', label: '橙/红 · 我方正在作用', shape: 'circle' },
  ]
}
