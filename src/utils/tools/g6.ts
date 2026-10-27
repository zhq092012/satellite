import G6, { type EdgeConfig } from '@antv/g6'
/**
 * 把平行边、自环边改成可区分的曲线，避免多条边叠在同一条直线上。
 * 直接改传入的边配置，供 G6 布局前调用。
 *
 * @param edges G6 边配置，会被就地写入 type 与 curveOffset
 */
export function processParallelEdges(edges: EdgeConfig[]) {
  const offsetDiff = 30
  const multiEdgeType = 'quadratic'
  const singleEdgeType = 'line'
  const loopEdgeType = 'loop'
  G6.Util.processParallelEdges(edges, offsetDiff, multiEdgeType, singleEdgeType, loopEdgeType)
}
const colors = [
  'hsla(221, 73.40%, 63.10%, 0.80)',
  'hsla(175, 63.30%, 52.00%, 0.80)',
  'hsla(45, 93.30%, 53.10%, 0.80)',
  'hsla(246, 97.50%, 69.00%, 0.80)',
  'hsla(197, 88.80%, 72.00%, 0.80)',
  'hsla(275, 40.20%, 56.10%, 0.80)',
  'hsla(27, 91.20%, 60.00%, 0.80)',
  'hsla(180, 90.00%, 26.10%, 0.80)',
  'hsla(336, 77.30%, 74.10%, 0.80)',
  'hsla(1, 90.00%, 72.90%, 0.80)',
  'hsla(79, 94.60%, 36.10%, 0.80)',
  'hsla(267, 67.60%, 60.00%, 0.80)',
]
/**
 * 从预设色板里随机取一种半透明颜色，用于区分图上的系列或分组。
 *
 * @returns `hsla(...)` 颜色字符串
 */
export function getRandomColors() {
  const index = Math.floor(Math.random() * colors.length)
  return colors[index]
}
/**
 * 按序号循环取色板中的颜色，同一序号始终得到同一颜色。
 *
 * @param index 从 0 开始的序号，超出色板长度后取模
 * @returns `hsla(...)` 颜色字符串
 */
export function getColors(index: number): string {
  const color = colors[index % colors.length]
  return color
}

/**
 * 按布局名返回 G6 布局配置。
 * 支持力导向（force / gForce / force2 / fruchterman）、环形、网格、同心圆、辐射和 MDS。
 *
 * @param layout 布局类型名
 * @returns G6 layout 配置对象；未知类型时为 undefined，调用方应回退默认布局
 */
export function getG6Layout(layout: string) {
  switch (layout) {
    case 'force':
      return {
        type: 'force',
        gpuEnabled: true,
        preventOverlap: true,
        linkDistance: 300,
      }
    case 'gForce':
      return {
        type: 'gForce',
        linkDistance: 150,
        nodeSize: 30,
        gpuEnabled: true,
        maxIteration: 1000,
        gravity: 5,
      }
    case 'force2':
      return {
        type: 'force2',
        animate: true,
        preventOverlap: true, //开启避免节点重叠
        linkDistance: 100,
        nodeStrength: 1000,
        edgeStrength: 200,
        nodeSize: 20,
        nodeSpacing: 0,
        minMovement: 0.5,
        distanceThresholdMode: 'mean',
        maxIteration: 1000,
        damping: 0.9,
        interval: 0.02,
        factor: 1,
        maxSpeed: 1000,
        coulombDisScale: 0.005,
        gravity: 10,
        clusterNodeStrength: 20,
      }
    case 'fruchterman':
      return {
        type: 'fruchterman',
        gravity: 1.5,
        gpuEnabled: true,
      }
    case 'circular':
      return {
        type: 'circular',
        radius: 500,
        nodeSize: 30,
      }
    case 'grid':
      return {
        preventOverlap: true,
        preventOverlapPadding: 10,
        nodeSize: 30,
        type: 'grid',
      }

    case 'concentric':
      return {
        type: 'concentric',
        preventOverlap: true,
        nodeSpacing: 40,
        nodeSize: 30,
      }
    case 'radial':
      return {
        type: 'radial',
        nodeSize: 30,
        lineDistance: 10,
        unitRadius: 100,
        preventOverlap: true,
        nodeSpacing: 10,
      }
    case 'MDS':
      return {
        type: 'mds',
      }
    default:
      return
  }
}

/* ================== 1. 极简节点注册 ================== */
// G6.registerNode('dot', {
//   draw: () => ({
//     type: 'circle',
//     size: 6,
//     style: { fill: '#1890ff', stroke: '#fff' },
//   }),
// })

/**
 * 判断节点包围盒是否与当前画布视口相交。
 *
 * @param nodeBBox 节点包围盒，需含 minX/maxX/minY/maxY
 * @param viewBBox 画布视口包围盒，字段同上
 * @returns 相交（含贴边）时为 true
 */
function isInViewport(nodeBBox: any, viewBBox: any) {
  return !(
    nodeBBox.minX > viewBBox.maxX ||
    nodeBBox.maxX < viewBBox.minX ||
    nodeBBox.minY > viewBBox.maxY ||
    nodeBBox.maxY < viewBBox.minY
  )
}
/**
 * 按当前画布视口隐藏看不见的节点，并同步隐藏两端都不可见的边。
 * 大图拖拽、缩放时调用，减少离屏绘制。
 *
 * @param graph G6 Graph 实例
 */
export function viewportCulling(graph: any) {
  const viewBBox = graph.getGroup().getCanvasBBox()
  graph.getNodes().forEach((node: any) => {
    node.set('visible', isInViewport(node.getBBox(), viewBBox))
  })
  graph.getEdges().forEach((edge: any) => {
    const srcVis = edge.getSource().get('visible')
    const tgtVis = edge.getTarget().get('visible')
    edge.set('visible', srcVis && tgtVis)
  })
}

/**
 * 分帧把节点和边加入图中，避免一次 add 阻塞主线程。
 * 节点与边按下标对齐，每帧各取 `batch` 条；节点耗尽后停止，剩余边不再加入。
 *
 * @param graph G6 Graph 实例
 * @param nodes 待添加节点
 * @param edges 与节点下标对齐的边
 * @param batch 每帧添加的数量，默认 500
 */
export function loadInBatches(graph: any, nodes: any[], edges: any[], batch = 500) {
  let i = 0
  /**
   * 取下一批节点和边加入图中。节点还没加完时用 `requestAnimationFrame` 预约下一次。
   */
  const next = () => {
    const nodeSlice = nodes.slice(i, i + batch)
    const edgeSlice = edges.slice(i, i + batch)
    graph.add('node', nodeSlice)
    graph.add('edge', edgeSlice)
    i += batch
    if (i < nodes.length) requestAnimationFrame(next)
  }
  next()
}

/* ================== 4. 工厂函数 ================== */
// export function createLargeGraph(container: string | HTMLElement) {
//   const graph = new G6.Graph({
//     container,
//     width: (container as HTMLElement).clientWidth,
//     height: (container as HTMLElement).clientHeight,
//     renderer: 'webgl', // GPU 并行
//     fitView: true,
//     modes: {
//       default: [
//         { type: 'drag-canvas', enableOptimize: true },
//         { type: 'zoom-canvas', enableOptimize: true },
//         { type: 'optimize-viewport-transform', delay: 300 },
//       ],
//     },
//     node: () => ({ type: 'dot' }),
//     edge: () => ({ type: 'line', style: { stroke: '#ccc' } }),
//     layout: { type: 'gForce', gpuEnabled: true, maxIteration: 100 },
//   })

//   /* 5. 视口裁剪 & 窗口自适应 */
//   graph.on('viewportchange', () => viewportCulling(graph))
//   window.addEventListener('resize', () => {
//     graph.changeSize((container as HTMLElement).clientWidth, (container as HTMLElement).clientHeight)
//     graph.fitCenter()
//   })

//   return graph
// }
