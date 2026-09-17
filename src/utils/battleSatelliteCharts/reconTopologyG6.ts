import G6, { type GraphData } from '@antv/g6'
import type { MatrixResult } from '@/api/electronic'
import {
  collectRelaySatelliteTransmissionLinks,
  collectSatelliteTransmissionLinks,
  isRelaySatellite,
  listSourceSatelliteNoradsForRelay,
  type ChainNode,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

/** 侦察拓扑四层纵坐标比例（与 ElectronicWarfareG6 一致） */
export const RECON_LAYER_Y_RATIOS = [0.14, 0.33, 0.54, 0.75] as const

/** G6 图数据；nodes/edges 始终为数组（可为空），且可传入 Graph.data / changeData */
export type ReconTopologyGraphData = Required<Pick<GraphData, 'nodes' | 'edges'>>

/** 构建单星侦察拓扑图的上下文 */
export interface BuildFocusedReconGraphContext {
  /** 系列矩阵 */
  matrix: MatrixResult
  /** 聚焦卫星 NORAD */
  norad: number
  /** 画布宽度（像素） */
  containerWidth: number
  /** 画布高度（像素） */
  stageHeight: number
  /** 任务结束毫秒（过站延迟口径）；未解析成功时可省略 */
  taskEndMs?: number | null
}

type TopoNodeKind = 'sat' | 'relay' | 'receive' | 'station'

const LINK_COLOR_NORMAL = '#00e1ff'
const LINK_COLOR_STRUCK = '#94a3b8'

/** 侦察拓扑 G6 边类型：直线连接各层节点 */
export const RECON_TOPO_EDGE_TYPE = 'line'

/**
 * 链路边终点箭头（与边描边同色）。
 *
 * @param stroke 边颜色
 * @returns G6 endArrow 配置
 */
const buildReconEdgeEndArrow = (stroke: string) => ({
  path: G6.Arrow.triangle(8, 10, 0),
  fill: stroke,
  d: 0,
})

/** G6 Graph 实例默认边：直线 + 箭头 */
export const RECON_TOPO_GRAPH_DEFAULT_EDGE = {
  type: RECON_TOPO_EDGE_TYPE,
  style: {
    stroke: LINK_COLOR_NORMAL,
    lineWidth: 2.5,
    opacity: 1,
    endArrow: buildReconEdgeEndArrow(LINK_COLOR_NORMAL),
  },
}

const TOPO_NODE_SHAPE: Record<TopoNodeKind, string> = {
  sat: 'circle',
  relay: 'diamond',
  receive: 'triangle',
  station: 'rect',
}

const TOPO_NODE_SIZE: Record<TopoNodeKind, number | [number, number]> = {
  sat: 16,
  relay: [18, 18],
  receive: 12,
  station: 18,
}

/**
 * 根据层号计算节点纵坐标。
 *
 * @param layer 层 1–4
 * @param stageHeight 舞台高度
 * @returns Y 像素
 */
export const getReconLayerY = (layer: number, stageHeight: number): number => {
  const ratio = RECON_LAYER_Y_RATIOS[layer - 1] ?? 0.5
  return ratio * stageHeight
}

/**
 * 层标签 CSS top 值。
 *
 * @param layer 层 1–4
 * @param stageHeight 舞台高度
 * @returns 如 `120px`
 */
export const formatReconLayerTop = (layer: number, stageHeight: number): string =>
  `${getReconLayerY(layer, stageHeight)}px`

/** 拓扑水平布局：左侧留给层标签，右侧留边距 */
const RECON_LAYOUT_PAD_LEFT = 140
const RECON_LAYOUT_PAD_RIGHT = 30

/**
 * 某一节点层在可绘区内沿中心轴对称分布的水平坐标。
 * 多个节点时首尾落在可绘区边界，单个节点落在可绘区正中。
 *
 * @param index 当前节点序号（从 0 起）
 * @param count 该层节点总数
 * @param layoutMinX 可绘区左边界 X
 * @param layoutMaxX 可绘区右边界 X
 * @returns 节点中心 X（像素）
 */
export const resolveSymmetricRowX = (
  index: number,
  count: number,
  layoutMinX: number,
  layoutMaxX: number
): number => {
  const centerX = (layoutMinX + layoutMaxX) / 2
  if (count <= 1) return centerX
  const span = Math.max(layoutMaxX - layoutMinX, 0)
  const step = span / (count - 1)
  return layoutMinX + step * index
}

/**
 * 根据关联接收站的 X 计算数据中心位置（多站汇入时取均值，保持视觉居中）。
 *
 * @param receiveIds 关联的接收站 ID 列表
 * @param receiveXMap 接收站 ID → X 映射
 * @param layoutCenterX 无关联时的 fallback 中心 X
 * @returns 数据中心 X
 */
const resolveStationCenterX = (
  receiveIds: string[],
  receiveXMap: Map<string, number>,
  layoutCenterX: number
): number => {
  const xs = receiveIds.map((id) => receiveXMap.get(id)).filter((x): x is number => x != null)
  if (!xs.length) return layoutCenterX
  if (xs.length === 1) return xs[0]
  return xs.reduce((sum, x) => sum + x, 0) / xs.length
}

const getTopoNodeColors = (kind: TopoNodeKind, struck: boolean) => {
  if (struck) {
    return { fill: '#2d1215', stroke: '#ff4d4f', shadow: 'rgba(255, 77, 79, 0.45)' }
  }
  switch (kind) {
    case 'sat':
      return { fill: '#092638', stroke: '#00e1ff', shadow: 'rgba(0, 225, 255, 0.35)' }
    case 'relay':
      return { fill: '#1e112a', stroke: '#a855f7', shadow: 'rgba(168, 85, 247, 0.4)' }
    case 'receive':
      return { fill: '#0a2e2b', stroke: '#00f2fe', shadow: 'rgba(0, 242, 254, 0.35)' }
    case 'station':
      return { fill: '#10244c', stroke: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.35)' }
  }
}

/**
 * 格式化接收站节点下方延时副标题。
 *
 * @param delayMin 延时分钟
 * @returns 文案或 undefined
 */
const formatReceiveDelaySubLabel = (delayMin: number): string | undefined => {
  if (delayMin > 0) return `+${delayMin} 分钟`
  return undefined
}

/**
 * 构建 G6 拓扑节点配置。
 *
 * @param opts 节点参数
 * @param stageHeight 舞台高度
 * @returns G6 节点模型
 */
const buildTopoNode = (
  opts: {
    id: string
    name: string
    kind: TopoNodeKind
    x: number
    layer: number
    y?: number
    struck?: boolean
    showLabel?: boolean
    subLabel?: string
  },
  stageHeight: number
) => {
  const struck = !!opts.struck
  const showLabel = opts.showLabel !== false
  const hasSubLabel = showLabel && !!opts.subLabel
  const labelText = showLabel ? (hasSubLabel ? `${opts.name}\n${opts.subLabel}` : opts.name) : ''
  const colors = getTopoNodeColors(opts.kind, struck)
  const style = {
    fill: colors.fill,
    stroke: colors.stroke,
    lineWidth: struck ? 2.5 : 2,
    shadowColor: colors.shadow,
    shadowBlur: 12,
  }
  return {
    id: opts.id,
    label: labelText,
    nodeName: opts.name,
    kind: opts.kind,
    layer: opts.layer,
    x: opts.x,
    y: opts.y ?? getReconLayerY(opts.layer, stageHeight),
    customPosition: opts.y != null,
    type: TOPO_NODE_SHAPE[opts.kind],
    size: TOPO_NODE_SIZE[opts.kind],
    anchorPoints: [
      [0.5, 0],
      [0.5, 1],
    ],
    style,
    labelCfg: showLabel
      ? {
          position: 'bottom',
          offset: hasSubLabel ? 14 : 8,
          style: {
            fill: '#e2efff',
            fontSize: hasSubLabel ? 9 : 10,
            fontWeight: 500,
            lineHeight: 14,
            textAlign: 'center',
          },
        }
      : { style: { opacity: 0 } },
  }
}

/**
 * 构建链路边的视觉样式（无选中态，全量展示）。
 *
 * @param struck 是否被打击
 * @returns G6 边样式
 */
const buildLinkEdgeStyle = (struck: boolean) => {
  const stroke = struck ? LINK_COLOR_STRUCK : LINK_COLOR_NORMAL
  return {
    stroke,
    lineWidth: struck ? 2 : 2.5,
    lineDash: struck ? [6, 4] : [],
    opacity: 1,
    endArrow: buildReconEdgeEndArrow(stroke),
  }
}

/**
 * 将链路节点映射为 G6 图节点 ID。
 *
 * @param node 链路节点
 * @returns G6 节点 ID
 */
const resolveChainNodeGraphId = (node: ChainNode): string => {
  if (node.layer === 'SAT' || node.layer === 'RELAY') return `sat-${node.id}`
  return node.id
}

/**
 * 根据链路集合构建侦察拓扑（单星或少量源星 + 全部过站链路）。
 *
 * @param matrix 系列矩阵
 * @param norads 参与布局的卫星 NORAD
 * @param links 传输链路
 * @param containerWidth 画布宽
 * @param stageHeight 画布高
 * @returns G6 图数据
 */
const buildReconGraphFromLinks = (
  matrix: MatrixResult,
  norads: number[],
  links: SatelliteTransmissionLink[],
  containerWidth: number,
  stageHeight: number
): ReconTopologyGraphData => {
  const nodes: NonNullable<GraphData['nodes']> = []
  const edges: NonNullable<GraphData['edges']> = []
  const nodeSet = new Set<string>()

  if (containerWidth <= 0) return { nodes, edges }
  const layoutMinX = RECON_LAYOUT_PAD_LEFT
  const layoutMaxX = Math.max(containerWidth - RECON_LAYOUT_PAD_RIGHT, layoutMinX + 200)
  const layoutCenterX = (layoutMinX + layoutMaxX) / 2

  const satOrderMap = new Map<number, { norad: number; name: string; earliestMs: number; struck: boolean }>()
  norads.forEach((norad) => {
    if (isRelaySatellite(matrix, norad)) return
    const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
    const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
    satOrderMap.set(norad, {
      norad,
      name: postSat?.name || initSat?.name || `Sat-${norad}`,
      earliestMs: Number.MAX_SAFE_INTEGER,
      struck: postSat?.satelliteStatus === 1,
    })
  })

  const receiveOrderMap = new Map<
    string,
    { id: string; name: string; earliestMs: number; receiveStruck: boolean; delayMin: number }
  >()
  const relayMap = new Map<string, { id: string; name: string }>()
  const stationMap = new Map<string, { id: string; name: string; receiveId: string; stationStruck: boolean }>()
  /** 每个数据中心关联的接收站（用于多链路汇入时的居中 X） */
  const stationReceiveIds = new Map<string, Set<string>>()

  const resolveStationStruck = (stationId: string): boolean => {
    const stObj =
      matrix.stationRelationList?.stationObjList?.find((st) => st.stationId === stationId) ||
      matrix.initRelationList?.stationObjList?.find((st) => st.stationId === stationId)
    return stObj?.stationStatus === 1
  }

  links.forEach((link) => {
    const satNode = link.nodes.find((n) => n.layer === 'SAT')
    if (satNode) {
      const linkNorad = Number(satNode.id)
      const existingSat = satOrderMap.get(linkNorad)
      if (existingSat && link.transmitStartMs < existingSat.earliestMs) {
        existingSat.earliestMs = link.transmitStartMs
      }
    }

    link.nodes.forEach((n) => {
      if (n.layer === 'RECEIVE') {
        const existing = receiveOrderMap.get(n.id)
        if (!existing || link.transmitStartMs < existing.earliestMs) {
          receiveOrderMap.set(n.id, {
            id: n.id,
            name: n.name,
            earliestMs: link.transmitStartMs,
            receiveStruck: link.receiveStruck || existing?.receiveStruck || false,
            delayMin: link.delayMin,
          })
        } else if (link.receiveStruck) {
          existing.receiveStruck = true
        }
      }
      if (n.layer === 'RELAY') {
        relayMap.set(n.id, { id: n.id, name: n.name })
      }
      if (n.layer === 'STATION') {
        const receiveNode = link.nodes.find((x) => x.layer === 'RECEIVE')
        const stationStruck = resolveStationStruck(n.id)
        const existingStation = stationMap.get(n.id)
        if (receiveNode?.id) {
          if (!stationReceiveIds.has(n.id)) stationReceiveIds.set(n.id, new Set())
          stationReceiveIds.get(n.id)!.add(receiveNode.id)
        }
        stationMap.set(n.id, {
          id: n.id,
          name: n.name,
          receiveId: receiveNode?.id || existingStation?.receiveId || '',
          stationStruck: stationStruck || existingStation?.stationStruck || false,
        })
      }
    })
  })

  const sortedSats = Array.from(satOrderMap.values()).sort((a, b) => {
    const aMs = a.earliestMs === Number.MAX_SAFE_INTEGER ? Infinity : a.earliestMs
    const bMs = b.earliestMs === Number.MAX_SAFE_INTEGER ? Infinity : b.earliestMs
    if (aMs !== bMs) return aMs - bMs
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  const sortedReceives = Array.from(receiveOrderMap.values()).sort(
    (a, b) => a.earliestMs - b.earliestMs || a.name.localeCompare(b.name, 'zh-CN')
  )

  norads.forEach((norad) => {
    const relayRel = matrix.relayRelation?.relations?.find(
      (r) => Number(r.from) === norad || String(r.from) === String(norad)
    )
    if (!relayRel) return
    const relayId = String(Number(relayRel.to))
    if (relayMap.has(relayId)) return
    const initSat = matrix.initMatrixList?.find((s) => s.norad === Number(relayId))
    const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === Number(relayId))
    relayMap.set(relayId, {
      id: relayId,
      name: postSat?.name || initSat?.name || `TDRS-${relayId}`,
    })
  })

  const relayList = Array.from(relayMap.values())

  sortedSats.forEach((sat, i) => {
    const satId = `sat-${sat.norad}`
    const x = resolveSymmetricRowX(i, sortedSats.length, layoutMinX, layoutMaxX)
    nodes.push(
      buildTopoNode(
        {
          id: satId,
          name: sat.name,
          kind: 'sat',
          x,
          layer: 1,
          struck: sat.struck,
          showLabel: true,
        },
        stageHeight
      )
    )
    nodeSet.add(satId)
  })

  relayList.forEach((relay, i) => {
    const id = `sat-${relay.id}`
    const x = resolveSymmetricRowX(i, relayList.length, layoutMinX, layoutMaxX)
    if (!nodeSet.has(id)) {
      const relayPostSat = matrix.satelliteMatrixList?.find((s) => s.norad === Number(relay.id))
      nodes.push(
        buildTopoNode(
          {
            id,
            name: relay.name,
            kind: 'relay',
            x,
            layer: 2,
            struck: relayPostSat?.satelliteStatus === 1,
            showLabel: true,
          },
          stageHeight
        )
      )
      nodeSet.add(id)
    }
  })

  const receiveXMap = new Map<string, number>()
  sortedReceives.forEach((rec, i) => {
    const x = resolveSymmetricRowX(i, sortedReceives.length, layoutMinX, layoutMaxX)
    receiveXMap.set(rec.id, x)
    nodes.push(
      buildTopoNode(
        {
          id: rec.id,
          name: rec.name,
          kind: 'receive',
          x,
          layer: 3,
          struck: rec.receiveStruck,
          showLabel: true,
          subLabel: formatReceiveDelaySubLabel(rec.delayMin),
        },
        stageHeight
      )
    )
    nodeSet.add(rec.id)
  })

  const stationPlaced = new Set<string>()
  stationMap.forEach((st) => {
    if (stationPlaced.has(st.id)) return
    const linkedReceiveIds = stationReceiveIds.has(st.id)
      ? [...stationReceiveIds.get(st.id)!]
      : st.receiveId
        ? [st.receiveId]
        : []
    const x = resolveStationCenterX(linkedReceiveIds, receiveXMap, layoutCenterX)
    nodes.push(
      buildTopoNode(
        {
          id: st.id,
          name: st.name,
          kind: 'station',
          x,
          layer: 4,
          struck: st.stationStruck,
          showLabel: true,
        },
        stageHeight
      )
    )
    nodeSet.add(st.id)
    stationPlaced.add(st.id)
  })

  const renderedEdges = new Map<string, NonNullable<GraphData['edges']>[number]>()
  links.forEach((link) => {
    for (let i = 0; i < link.nodes.length - 1; i++) {
      const source = resolveChainNodeGraphId(link.nodes[i])
      const target = resolveChainNodeGraphId(link.nodes[i + 1])
      if (!nodeSet.has(source) || !nodeSet.has(target)) continue
      const edgePairKey = `${source}->${target}`
      if (renderedEdges.has(edgePairKey)) continue
      const edge = {
        id: `edge-${link.id}-${i}`,
        linkId: link.id,
        source,
        target,
        sourceAnchor: 1,
        targetAnchor: 0,
        type: RECON_TOPO_EDGE_TYPE,
        linkStruck: link.struck,
        style: buildLinkEdgeStyle(link.struck),
      }
      renderedEdges.set(edgePairKey, edge)
      edges.push(edge)
    }
  })

  return { nodes, edges }
}

/**
 * 为指定卫星构建聚焦侦察拓扑（含中继、接收站按过站时间从左到右、数据中心）。
 *
 * @param ctx 构建上下文
 * @returns G6 图数据
 */
export const buildFocusedReconGraphData = (ctx: BuildFocusedReconGraphContext): ReconTopologyGraphData => {
  const { matrix, norad, containerWidth, stageHeight, taskEndMs } = ctx
  if (isRelaySatellite(matrix, norad)) {
    const links = collectRelaySatelliteTransmissionLinks(matrix, norad, taskEndMs)
    const sourceNoradsFromLinks = Array.from(
      new Set(
        links
          .map((link) => link.nodes.find((node) => node.layer === 'SAT')?.id)
          .filter((id): id is string => !!id)
          .map((id) => Number(id))
          .filter((sourceNorad) => Number.isFinite(sourceNorad) && sourceNorad !== norad)
      )
    )
    const sourceNorads = sourceNoradsFromLinks.length
      ? sourceNoradsFromLinks
      : listSourceSatelliteNoradsForRelay(matrix, norad)
    return buildReconGraphFromLinks(matrix, sourceNorads, links, containerWidth, stageHeight)
  }
  const links = collectSatelliteTransmissionLinks(matrix, norad, taskEndMs)
  return buildReconGraphFromLinks(matrix, [norad], links, containerWidth, stageHeight)
}

/** 侦察拓扑左侧层标签（与 ElectronicWarfareG6 文案一致） */
export const RECON_LAYER_LABEL_ITEMS = [
  { key: 'recon-1', icon: '🛰️', title: '侦察卫星', layer: 1, className: 'layer-1-item' },
  { key: 'recon-2', icon: '🛰️', title: '中继卫星', layer: 2, className: 'layer-2-item' },
  { key: 'recon-3', icon: '📡', title: '地面接收站', layer: 3, className: 'layer-3-item' },
  { key: 'recon-4', icon: '🏢', title: '数据中心', layer: 4, className: 'layer-4-item' },
] as const
