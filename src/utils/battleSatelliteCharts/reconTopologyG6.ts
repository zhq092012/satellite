import { type GraphData, type NodeConfig } from '@antv/g6'
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

/**
 * 拓扑节点类型，与四个层级一一对应。
 * - `sat`：第 1 层侦察卫星（链路起点）
 * - `relay`：第 2 层中继卫星（可选，星间转发）
 * - `receive`：第 3 层地面接收站
 * - `station`：第 4 层数据中心（链路终点）
 */
type TopoNodeKind = 'sat' | 'relay' | 'receive' | 'station'

/** 正常链路配色（青色实线） */
const LINK_COLOR_NORMAL = '#00e1ff'
/** 被打击链路配色（灰色虚线） */
const LINK_COLOR_STRUCK = '#94a3b8'

/** 侦察拓扑 G6 边类型：直线连接各层节点 */
export const RECON_TOPO_EDGE_TYPE = 'line'

/** G6 Graph 实例默认边：直线（无箭头） */
export const RECON_TOPO_GRAPH_DEFAULT_EDGE = {
  type: RECON_TOPO_EDGE_TYPE,
  style: {
    stroke: LINK_COLOR_NORMAL,
    lineWidth: 2.5,
    opacity: 1,
  },
}

/** 各类节点对应的 G6 内置图形，用形状区分层级 */
const TOPO_NODE_SHAPE: Record<TopoNodeKind, string> = {
  sat: 'circle',
  relay: 'diamond',
  receive: 'triangle',
  station: 'rect',
}

/** 各类节点尺寸；菱形与矩形需要宽高二元组，圆形与三角形取单值半径/边长 */
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

/** 可绘区左边界，留出 140px 给左侧的层标签栏 */
const RECON_LAYOUT_PAD_LEFT = 140
/** 可绘区右边界留白，避免最右侧节点标签被裁切 */
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

/**
 * 解析节点配色。被打击节点统一用红色告警配色覆盖层级本身的颜色，
 * 未被打击时按层级返回各自的填充/描边/辉光色。
 *
 * @param kind 节点类型
 * @param struck 是否已被打击
 * @returns 填充色、描边色与阴影辉光色
 */
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
 * 节点坐标为手工布局：X 由调用方按同层对称分布算好，Y 默认由层号推导，
 * 因此使用该数据的 Graph 不应再叠加自动布局算法。
 *
 * @param opts 节点参数
 * @param stageHeight 舞台高度（像素），用于按层比例换算 Y
 * @returns G6 节点模型
 */
const buildTopoNode = (
  opts: {
    /** 节点唯一 ID；卫星与中继统一带 `sat-` 前缀 */
    id: string
    /** 节点显示名称 */
    name: string
    /** 节点类型，决定形状、尺寸与配色 */
    kind: TopoNodeKind
    /** 节点中心 X（像素） */
    x: number
    /** 所在层号 1–4 */
    layer: number
    /** 自定义 Y（像素）；省略时按层号推导 */
    y?: number
    /** 是否已被打击（走红色告警配色） */
    struck?: boolean
    /** 是否显示标签；为 false 时标签透明隐藏 */
    showLabel?: boolean
    /** 标签第二行副标题，如接收站的过站延时 */
    subLabel?: string
  },
  stageHeight: number
): NodeConfig => {
  const struck = !!opts.struck
  // 未显式传 false 即视为显示标签
  const showLabel = opts.showLabel !== false
  const hasSubLabel = showLabel && !!opts.subLabel
  /** 标签文案；有副标题时换行拼接为两行 */
  const labelText = showLabel ? (hasSubLabel ? `${opts.name}\n${opts.subLabel}` : opts.name) : ''
  const colors = getTopoNodeColors(opts.kind, struck)
  /** 节点图形样式：打击态描边更粗，并带同色辉光 */
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
    // nodeName / kind / layer / customPosition 为业务自定义字段，供交互与调试回读
    nodeName: opts.name,
    kind: opts.kind,
    layer: opts.layer,
    x: opts.x,
    y: opts.y ?? getReconLayerY(opts.layer, stageHeight),
    customPosition: opts.y != null,
    type: TOPO_NODE_SHAPE[opts.kind],
    size: TOPO_NODE_SIZE[opts.kind],
    // 只开放上下两个锚点，保证层间连线始终垂直进出
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
          textAlign: 'center' as const,
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
 * 整体分三步：
 * 1. 遍历链路，把出现过的卫星/中继/接收站/数据中心归集成四张表，
 *    并记录每个节点最早出现的传输时刻与打击状态；
 * 2. 按最早传输时刻排序后逐层生成节点，X 坐标在可绘区内对称分布，
 *    数据中心额外按其关联接收站的均值 X 居中；
 * 3. 把每条链路拆成相邻节点对生成边，同一对节点只保留首次出现的边。
 *
 * @param matrix 系列矩阵
 * @param norads 参与布局的卫星 NORAD
 * @param links 传输链路
 * @param containerWidth 画布宽
 * @param stageHeight 画布高
 * @returns G6 图数据；画布宽度非法时返回空图
 */
const buildReconGraphFromLinks = (
  matrix: MatrixResult,
  norads: number[],
  links: SatelliteTransmissionLink[],
  containerWidth: number,
  stageHeight: number
): ReconTopologyGraphData => {
  /** 输出节点列表 */
  const nodes: NonNullable<GraphData['nodes']> = []
  /** 输出边列表 */
  const edges: NonNullable<GraphData['edges']> = []
  /** 已生成的节点 ID，用于生成边时过滤悬空端点 */
  const nodeSet = new Set<string>()

  // 容器尚未完成测量时不做布局，避免算出无意义的坐标
  if (containerWidth <= 0) return { nodes, edges }
  /** 可绘区左边界 X */
  const layoutMinX = RECON_LAYOUT_PAD_LEFT
  /** 可绘区右边界 X；至少保证 200px 宽度，防止窄容器把节点挤成一列 */
  const layoutMaxX = Math.max(containerWidth - RECON_LAYOUT_PAD_RIGHT, layoutMinX + 200)
  /** 可绘区中心 X，用作单节点或无关联时的兜底位置 */
  const layoutCenterX = (layoutMinX + layoutMaxX) / 2

  /** 第 1 层侦察卫星：NORAD → 名称、最早传输时刻、打击状态 */
  const satOrderMap = new Map<number, { norad: number; name: string; earliestMs: number; struck: boolean }>()
  norads.forEach((norad) => {
    // 中继星由第 2 层单独渲染，不占用侦察卫星层
    if (isRelaySatellite(matrix, norad)) return
    const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
    const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
    satOrderMap.set(norad, {
      norad,
      name: postSat?.name || initSat?.name || `Sat-${norad}`,
      // 先占位为最大值，稍后遍历链路时取真实的最早传输时刻
      earliestMs: Number.MAX_SAFE_INTEGER,
      struck: postSat?.satelliteStatus === 1,
    })
  })

  /** 第 3 层接收站：ID → 名称、最早过站时刻、打击状态、过站延时 */
  const receiveOrderMap = new Map<
    string,
    { id: string; name: string; earliestMs: number; receiveStruck: boolean; delayMin: number }
  >()
  /** 第 2 层中继卫星：ID → 名称 */
  const relayMap = new Map<string, { id: string; name: string }>()
  /** 第 4 层数据中心：ID → 名称、代表接收站、打击状态 */
  const stationMap = new Map<string, { id: string; name: string; receiveId: string; stationStruck: boolean }>()
  /** 每个数据中心关联的接收站（用于多链路汇入时的居中 X） */
  const stationReceiveIds = new Map<string, Set<string>>()

  /**
   * 查询数据中心是否被打击。优先读打击后的关系表，缺失时回落到初始关系表。
   *
   * @param stationId 数据中心 ID
   * @returns 状态为 1 时表示已被打击
   */
  const resolveStationStruck = (stationId: string): boolean => {
    const stObj =
      matrix.stationRelationList?.stationObjList?.find((st) => st.stationId === stationId) ||
      matrix.initRelationList?.stationObjList?.find((st) => st.stationId === stationId)
    return stObj?.stationStatus === 1
  }

  // ── 第 1 步：遍历链路，归集各层节点并记录最早传输时刻与打击状态 ──
  links.forEach((link) => {
    // 用链路的传输起始时刻刷新源卫星的最早时刻，决定其在第 1 层的左右次序
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
        // 同一接收站可能出现在多条链路中，保留最早的一条并继承已有的打击标记
        if (!existing || link.transmitStartMs < existing.earliestMs) {
          receiveOrderMap.set(n.id, {
            id: n.id,
            name: n.name,
            earliestMs: link.transmitStartMs,
            receiveStruck: link.receiveStruck || existing?.receiveStruck || false,
            delayMin: link.delayMin,
          })
        } else if (link.receiveStruck) {
          // 本条链路更晚但带打击标记，仅把打击状态并入已有记录
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
        // 累积该数据中心的全部上游接收站，用于后续求均值 X
        if (receiveNode?.id) {
          if (!stationReceiveIds.has(n.id)) stationReceiveIds.set(n.id, new Set())
          stationReceiveIds.get(n.id)!.add(receiveNode.id)
        }
        stationMap.set(n.id, {
          id: n.id,
          name: n.name,
          receiveId: receiveNode?.id || existingStation?.receiveId || '',
          // 打击状态只累加不回退，任一链路标记打击即视为已打击
          stationStruck: stationStruck || existingStation?.stationStruck || false,
        })
      }
    })
  })

  /** 侦察卫星排序：先按最早传输时刻，时刻相同再按名称；从未出现在链路中的排到最后 */
  const sortedSats = Array.from(satOrderMap.values()).sort((a, b) => {
    const aMs = a.earliestMs === Number.MAX_SAFE_INTEGER ? Infinity : a.earliestMs
    const bMs = b.earliestMs === Number.MAX_SAFE_INTEGER ? Infinity : b.earliestMs
    if (aMs !== bMs) return aMs - bMs
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  /** 接收站排序：按最早过站时刻从左到右，时刻相同再按名称 */
  const sortedReceives = Array.from(receiveOrderMap.values()).sort(
    (a, b) => a.earliestMs - b.earliestMs || a.name.localeCompare(b.name, 'zh-CN')
  )

  // 补齐仅在中继关系表里出现、但没有任何链路经过的中继星，保证第 2 层结构完整
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

  /** 第 2 层中继星列表（保持插入顺序） */
  const relayList = Array.from(relayMap.values())

  // ── 第 2 步：逐层生成节点，X 在可绘区内对称分布 ──

  // 第 1 层：侦察卫星
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

  // 第 2 层：中继卫星；与侦察星共用 `sat-` 前缀，已在第 1 层出现过的直接跳过
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

  // 第 3 层：接收站；同时记录 X 供第 4 层数据中心求均值居中
  /** 接收站 ID → 节点中心 X */
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

  // 第 4 层：数据中心；X 取其全部上游接收站的均值，视觉上位于汇入链路正下方
  /** 已放置的数据中心 ID，避免重复生成节点 */
  const stationPlaced = new Set<string>()
  stationMap.forEach((st) => {
    if (stationPlaced.has(st.id)) return
    /** 上游接收站 ID 列表；无累积记录时回落到代表接收站 */
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

  // ── 第 3 步：把每条链路拆成相邻节点对生成边 ──
  /** 已生成的边，按 `source->target` 去重，避免多条链路重复连同一对节点 */
  const renderedEdges = new Map<string, NonNullable<GraphData['edges']>[number]>()
  links.forEach((link) => {
    for (let i = 0; i < link.nodes.length - 1; i++) {
      const source = resolveChainNodeGraphId(link.nodes[i])
      const target = resolveChainNodeGraphId(link.nodes[i + 1])
      // 端点未生成节点（如被过滤掉的中继星）时跳过，防止出现悬空边
      if (!nodeSet.has(source) || !nodeSet.has(target)) continue
      const edgePairKey = `${source}->${target}`
      if (renderedEdges.has(edgePairKey)) continue
      const edge = {
        id: `edge-${link.id}-${i}`,
        linkId: link.id,
        source,
        target,
        // 固定从上游节点底部锚点连到下游节点顶部锚点
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
 * 按聚焦对象分两种口径：
 * - 聚焦中继星：展示所有经它转发的源卫星，第 1 层为这些源星而非中继星本身；
 * - 聚焦普通侦察星：第 1 层只有该星，展示它自己的全部过站链路。
 *
 * @param ctx 构建上下文
 * @returns G6 图数据
 */
export const buildFocusedReconGraphData = (ctx: BuildFocusedReconGraphContext): ReconTopologyGraphData => {
  const { matrix, norad, containerWidth, stageHeight, taskEndMs } = ctx
  if (isRelaySatellite(matrix, norad)) {
    const links = collectRelaySatelliteTransmissionLinks(matrix, norad, taskEndMs)
    /** 从链路中反解出的上游源卫星 NORAD（排除中继星自身） */
    const sourceNoradsFromLinks = Array.from(
      new Set(
        links
          .map((link) => link.nodes.find((node) => node.layer === 'SAT')?.id)
          .filter((id): id is string => !!id)
          .map((id) => Number(id))
          .filter((sourceNorad) => Number.isFinite(sourceNorad) && sourceNorad !== norad)
      )
    )
    // 链路为空（如全时段无过站）时退回关系表，保证第 1 层仍有源星可展示
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
