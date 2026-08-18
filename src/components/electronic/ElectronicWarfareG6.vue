<template>
  <div class="cema-g6-dashboard dark-theme">
    <!-- 顶部导航与控制栏 Header -->
    <div class="cema-header">
      <div class="header-left">
        <span class="header-title glow-text">三层链路拓扑毁伤分析</span>
      </div>

      <!-- 烈度与视图模式切换选项 -->
      <div class="header-center">
        <!-- 卫星系列筛选 -->
        <div class="series-filter-group">
          <span class="label-text">卫星系列</span>
          <el-select v-model="selectedSeries" class="series-select" size="small" placeholder="选择系列"
            :disabled="seriesOptions.length === 0" @change="handleSeriesChange">
            <el-option v-for="series in seriesOptions" :key="series" :label="series" :value="series" />
          </el-select>
        </div>

        <div class="v-divider"></div>

        <!-- 1. 交战烈度切换按钮组 -->
        <div class="intensity-group">
          <button v-for="level in intensityOptions" :key="level" class="nav-tab-btn"
            :class="{ active: currentIntensity === level }" @click="handleIntensityChange(level)">
            {{ level }}
          </button>
        </div>
      </div>

      <!-- 右侧信息栏 -->
      <div class="header-right">
        <div class="header-right-item">
          <span class="label-text">当前任务:</span>
          <span class="digital-font time-value glow-text-cyan">{{ store.activedTask?.name || '实时推演场景' }}</span>
        </div>
      </div>
    </div>

    <!-- 中间主视图与拓扑画布区域 -->
    <div class="cema-workspace">
      <div class="topo-main-body">
        <div class="topo-side topo-side--left">
          <C2LeftControlPanel :matrix-data="matrixData" :selected-norad="selectedNorad"
            @select-satellite="handleSelectSatellite" />
        </div>

        <div class="topo-center-column">
          <div class="topo-summary-bar">
            <div class="stat-badge">
              <span class="stat-dot dot-sat"></span>
              <span>卫星节点: <strong>{{ satNodeCount }}</strong> 颗</span>
            </div>
            <div class="stat-badge" v-if="currentSatCategory === 'RECON'">
              <span class="stat-dot dot-rec"></span>
              <span>地面站节点: <strong>{{ receiveNodeCount }}</strong> 个</span>
            </div>
            <div class="stat-badge" v-if="currentSatCategory === 'RECON'">
              <span class="stat-dot dot-station"></span>
              <span>数据中心: <strong>{{ stationNodeCount }}</strong> 个</span>
            </div>
            <div class="stat-badge" v-else>
              <span class="stat-dot dot-rec"></span>
              <span>通信目标: <strong>{{ store.battle?.name || '战场目标区域' }}</strong></span>
            </div>
            <div class="stat-badge">
              <span class="stat-dot dot-normal-link"></span>
              <span>正常: <strong>{{ normalLinkCount }}</strong> 条</span>
            </div>
            <div class="stat-badge alert-stat">
              <span class="stat-dot dot-striking-link"></span>
              <span>正在干扰: <strong>{{ strikingLinkCount }}</strong> 条</span>
            </div>
            <div class="stat-badge">
              <span class="stat-dot dot-severed-link"></span>
              <span>已干扰: <strong>{{ severedLinkCount }}</strong> 条</span>
            </div>
          </div>

          <div class="topo-chain-banner" v-if="selectedNorad && timelineChainDisplay">
            <div class="chain-banner-head">
              <span class="chain-banner-title">{{ timelineChainDisplay.label }}</span>
              <span class="chain-banner-time">{{ timelineChainDisplay.timeText }}</span>
            </div>
            <template v-if="!timelineChainDisplay.chain.blocked">
              <div class="chain-banner-flow">
                <template v-for="(node, idx) in timelineChainDisplay.chain.nodes" :key="node.layer + node.id">
                  <div class="chain-banner-step">
                    <span class="step-icon">{{ node.icon }}</span>
                    <span class="step-name" :title="node.name">{{ node.name }}</span>
                    <span class="step-sub">{{ chainLayerLabel(node.layer) }}</span>
                  </div>
                  <span v-if="idx < timelineChainDisplay.chain.nodes.length - 1" class="chain-banner-arrow">→</span>
                </template>
              </div>
            </template>
            <div v-else class="chain-banner-blocked">{{ timelineChainDisplay.chain.blockedReason }}</div>
          </div>

          <div class="topo-graph-stack">
            <div class="graph-stage">
              <div class="graph-layer-labels">
                <div v-for="item in layerLabelItems" :key="item.key" class="graph-layer-label" :class="item.className"
                  :style="{ top: item.top }">
                  <span class="layer-icon">{{ item.icon }}</span>
                  <div class="layer-text">
                    <span class="layer-title">{{ item.title }}</span>
                  </div>
                </div>
              </div>
              <div ref="g6Container" class="g6-chart-container" v-loading="loading"></div>
            </div>

            <div class="graph-time-toolbar">
              <span class="toolbar-label">当前时刻</span>
              <span class="time-value">{{ currentTimeText }}</span>
              <span class="service-duration-badge pre-strike-badge" v-if="currentSatCategory === 'COMM'">
                <span class="badge-label">打击前服务时长:</span>
                <strong class="glow-text-cyan badge-val">{{ formattedPreServiceDuration }}</strong>
              </span>
              <span class="service-duration-badge post-strike-badge" v-if="currentSatCategory === 'COMM'">
                <span class="badge-label">打击后服务时长:</span>
                <strong class="glow-text-orange badge-val">{{ formattedPostServiceDuration }}</strong>
              </span>
            </div>

            <div class="mission-timeline-wrap">
              <BattleMissionTimeline v-if="taskTimeRange" :task-start="taskTimeRange.start"
                :task-end="taskTimeRange.end" :matrix-data="matrixData" :selected-norad="selectedNorad"
                @time-change="handleTimelineTimeChange" @marker-click="handleTimelineMarkerClick" />
            </div>
          </div>
        </div>

        <div class="topo-side topo-side--right">
          <C2RightAnalysisPanel :matrix-data="matrixData" :selected-satellite-norad="selectedNorad"
            :timeline-point-ms="selectedTimelinePoint?.ms ?? null"
            :timeline-marker-type="selectedTimelinePoint?.type ?? null"
            :timeline-marker-label="selectedTimelinePoint?.label ?? null"
            @clear-satellite-selection="handleSelectSatellite(null)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, watch, nextTick } from 'vue'
import G6 from '@antv/g6'
import { useLayoutStore } from '@/store/modules/layout'
import { getSatelliteTypeSerials, type MatrixResult, type Weapon } from '@/api/electronic'
import type { FuncType } from '@/types/electronic'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleMissionTimeline from '@/components/BattleSituation/BattleMissionTimeline.vue'
import {
  analyzeSatelliteFullChain,
  chainToEdgeIds,
  collectJamStrikeEdgeIdsAtTime,
  collectPostStrikePrimaryEdgeIds,
  getSatelliteRelatedEdgeIds,
  resolveChainForTimelineMarker,
  type ChainNode,
  type TimelineChainMarkerType,
} from '@/utils/satelliteFullChainAnalysis'

defineOptions({
  name: 'ElectronicWarfareG6',
})
const store = useLayoutStore()

const selectedNorad = ref<number | null>(null)
const selectedTimelinePoint = ref<{
  ms: number
  type: TimelineChainMarkerType
  label: string
} | null>(null)

const taskTimeRange = computed(() => {
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  return { start: task.beginDate, end: task.endDate }
})

// G6 画布容器 DOM ref
const g6Container = ref<HTMLDivElement | null>(null)

const graphStageHeight = ref(480)

const RECON_LAYER_Y_RATIOS = [0.14, 0.33, 0.54, 0.75] as const
const COMM_LAYER_Y_RATIOS = [0.2, 0.72] as const

const syncGraphStageHeight = () => {
  const height = g6Container.value?.clientHeight ?? 0
  if (height > 0) graphStageHeight.value = height
}

const getLayerYRatio = (layer: number): number => {
  const ratios = currentSatCategory.value === 'COMM' ? COMM_LAYER_Y_RATIOS : RECON_LAYER_Y_RATIOS
  return ratios[layer - 1] ?? 0.5
}

const getLayerY = (layer: number): number => getLayerYRatio(layer) * graphStageHeight.value

const formatLayerTop = (layer: number): string => `${getLayerY(layer)}px`

const layerLabelItems = computed(() => {
  if (currentSatCategory.value === 'COMM') {
    return [
      { key: 'comm-1', icon: '🛰️', title: '通讯卫星', top: formatLayerTop(1), className: 'layer-1-item' },
      { key: 'comm-2', icon: '🎯', title: `第二层：${store.battle?.name || '战场目标区域'}`, top: formatLayerTop(2), className: 'layer-2-item' },
    ]
  }
  return [
    { key: 'recon-1', icon: '🛰️', title: '侦察卫星', top: formatLayerTop(1), className: 'layer-1-item' },
    { key: 'recon-2', icon: '🛰️', title: '中继卫星', top: formatLayerTop(2), className: 'layer-2-item' },
    { key: 'recon-3', icon: '📡', title: '地面接收站', top: formatLayerTop(3), className: 'layer-3-item' },
    { key: 'recon-4', icon: '🏢', title: '数据中心', top: formatLayerTop(4), className: 'layer-4-item' },
  ]
})

const handleSelectSatellite = (norad: number | null) => {
  selectedNorad.value = norad
  selectedTimelinePoint.value = null
  if (norad) {
    const data = matrixData.value
    const satObj =
      (data?.satelliteMatrixList || []).find((s) => s.norad === norad) ||
      (data?.initMatrixList || []).find((s) => s.norad === norad)
    const isRelay = (data?.relayRelation?.relayList || []).includes(norad)
    selectedNodeInfo.value = {
      id: `sat-${norad}`,
      name: satObj?.name || `Sat-${norad}`,
      type: isRelay ? 'relay' : 'sat',
      norad,
    }
  } else {
    selectedNodeInfo.value = null
  }
  updateGraphHighlightState()
  refreshGraphForTime()
}

const handleTimelineTimeChange = (ms: number) => {
  setCurrentTimestamp(ms)
}

const handleTimelineMarkerClick = (payload: {
  ms: number
  type: TimelineChainMarkerType
  label: string
}) => {
  selectedTimelinePoint.value = payload
  setCurrentTimestamp(payload.ms)
  refreshGraphForTime()
}

const chainLayerLabel = (layer: ChainNode['layer']): string => {
  const map: Record<ChainNode['layer'], string> = {
    SAT: '卫星',
    RELAY: '中继',
    RECEIVE: '地面站',
    STATION: '数据中心',
  }
  return map[layer]
}

const timelineChainDisplay = computed(() => {
  if (!selectedNorad.value || !selectedTimelinePoint.value || !matrixData.value) return null
  const chain = resolveChainForTimelineMarker(
    matrixData.value,
    selectedNorad.value,
    selectedTimelinePoint.value.type,
    selectedTimelinePoint.value.ms
  )
  return {
    label: selectedTimelinePoint.value.label,
    timeText: formatTimeStr(selectedTimelinePoint.value.ms),
    chain,
  }
})

// 卫星类型与系列映射
const typeSerialsMap = ref<Record<string, string[]>>({})

const seriesOptions = computed<string[]>(() => {
  const type = store.selectedSatType
  if (type && typeSerialsMap.value[type]?.length) {
    return typeSerialsMap.value[type]
  }
  const allSeries = Object.values(typeSerialsMap.value).flat()
  return Array.from(new Set(allSeries))
})

const selectedSeries = computed({
  get: () => store.selectedSatSeries,
  set: (val: string) => store.setSelectedSatSeries(val),
})

const fetchTypeSerials = async (taskId?: number) => {
  if (!taskId) {
    typeSerialsMap.value = {}
    return
  }
  try {
    const res = await getSatelliteTypeSerials(taskId)
    if (res.code === 200 && res.data) {
      typeSerialsMap.value = res.data
    }
  } catch (err) {
    console.error('获取卫星类型与系列映射失败:', err)
  }
}

/**
 * 切换卫星系列，同步 Store 并重新查询矩阵数据
 */
const handleSeriesChange = (series: string) => {
  if (!series) return
  store.setSelectedSatSeries(series)
  selectedNorad.value = null
  selectedNodeInfo.value = null
  void fetchMatrixData(true)
}

watch(
  () => store.activedTask?.id,
  (taskId) => {
    void fetchTypeSerials(taskId)
  },
  { immediate: true }
)

watch(selectedNorad, (norad) => {
  if (!norad) selectedTimelinePoint.value = null
})

watch(selectedTimelinePoint, () => {
  refreshGraphForTime()
})

watch(seriesOptions, (options) => {
  if (!options.length) return
  if (!options.includes(store.selectedSatSeries)) {
    const nextSeries = options[0]
    store.setSelectedSatSeries(nextSeries)
    void fetchMatrixData(true)
  }
})

// [类型用途]
// 交战烈度选项类型定义
type IntensityLevelType = '高烈度' | '中烈度' | '低烈度'
const intensityOptions: IntensityLevelType[] = ['低烈度', '中烈度', '高烈度']

// [变量用途]
// 当前选中的交战烈度 (与全局 Store 中的 intensityLevel 同步)
const currentIntensity = ref<IntensityLevelType>((store.intensityLevel as IntensityLevelType) || '低烈度')

// [变量用途]
// 后端算法接口返回的矩阵数据对象
const matrixData = ref<MatrixResult | null>(null)

/**
 * [功能说明]
 * 根据算法矩阵数据或当前选中的卫星系列，自动推导出卫星分类类别 ('COMM' | 'RECON')。
 *
 * [处理规则]
 * 1. 优先提取 matrixData 中携带的 satCategory / category / func_type 属性。
 * 2. 检查 initMatrixList 中首个卫星节点的 satType 是否包含 "通信"/"通讯"/"COMM"。
 * 3. 检查 store.selectedSatSeries 系列名称中是否包含 "通信"/"通讯"/"COMM"。
 * 4. 若以上条件均不满足，默认判定为侦察卫星 'RECON'。
 *
 * @returns FuncType 对应的分类标识 ('COMM' | 'RECON')
 */
const currentSatCategory = computed<FuncType>(() => {
  const data = matrixData.value as
    | (MatrixResult & { satCategory?: string; category?: string; func_type?: string })
    | null
  if (data) {
    if (data.satCategory) return data.satCategory as FuncType
    if (data.category) return data.category as FuncType
    if (data.func_type) return data.func_type as FuncType

    if (Array.isArray(data.initMatrixList) && data.initMatrixList.length > 0) {
      const firstSat = data.initMatrixList[0]
      const satType = firstSat?.satType || ''
      if (satType.includes('通信') || satType.includes('通讯') || satType.toUpperCase().includes('COMM')) {
        return 'COMM'
      }
    }
  }

  const series = store.selectedSatSeries || ''
  if (series.includes('通信') || series.includes('通讯') || series.toUpperCase().includes('COMM')) {
    return 'COMM'
  }

  return 'RECON'
})

// [变量用途]
// 数据加载状态标记
const loading = ref(false)

// [变量用途]
// AntV G6 Graph 实例引用
let graph: any = null

/**
 * [类型用途]
 * 拓扑图中点击选中的节点数据描述 (支持普通卫星、中继卫星、地面接收站、中心云数据中心)
 */
interface SelectedNodeMeta {
  id: string
  name: string
  type: 'sat' | 'relay' | 'receive' | 'station'
  norad?: number
  receiveId?: string
  stationId?: string
}

// [变量用途]
// 当前点击选中的拓扑节点
const selectedNodeInfo = ref<SelectedNodeMeta | null>(null)

// ==================== 时间轴相关变量定义 ====================

// [类型用途]
// 时间轴过境/打击/中继窗口统一包装结构
interface WindowItemWrapper {
  id: string
  satName: string
  satNorad: number
  receiveName: string
  receiveId: string
  startTime: string
  endTime: string
  startTimeShort: string
  endTimeShort: string
  startTimestamp: number
  endTimestamp: number
  strikeStatus: number
  delayMin?: number
  weapons?: Weapon[] | null
  /** 是否为星间中继过境时间窗口 */
  isRelayWindow?: boolean
  /** 星间中继目标中继卫星 NORAD */
  relayNorad?: number
}

// [变量用途]
// 选中的时间窗口 ID
const currentTimestamp = ref<number>(0)

const ensureCurrentTimestampValid = () => {
  const min = minTimestamp.value
  const max = maxTimestamp.value
  if (!currentTimestamp.value || currentTimestamp.value < min || currentTimestamp.value > max) {
    currentTimestamp.value = min
  }
}

const nodeLayoutCache = new Map<string, number>()
let graphTopologyKey = ''

const getGraphTopologyKey = () =>
  `${store.selectedSatSeries}|${currentIntensity.value}|${matrixData.value?.series ?? ''}|${selectedNorad.value ?? ''}|${g6Container.value?.clientWidth ?? 0}|${g6Container.value?.clientHeight ?? 0}`

const applyCachedNodePositions = (nodes: any[]) => {
  nodes.forEach((node) => {
    const cachedX = nodeLayoutCache.get(String(node.id))
    if (cachedX !== undefined) node.x = cachedX
    if (node.layer) node.y = getLayerY(node.layer)
  })
}

const saveNodePositionsToCache = (nodes: any[]) => {
  nodes.forEach((node) => nodeLayoutCache.set(String(node.id), node.x))
}

const resetGraphViewport = () => {
  if (!graph || graph.get('destroyed')) return
  const group = graph.getGroup()
  if (group && typeof group.resetMatrix === 'function') {
    group.resetMatrix()
  }
}

const refreshGraphForTime = () => {
  if (!g6Container.value) return
  syncGraphStageHeight()
  ensureCurrentTimestampValid()
  const width = g6Container.value.clientWidth
  const height = g6Container.value.clientHeight
  if (!width || !height || width <= 0 || height <= 0) return

  registerCustomG6Edge()
  const topoKey = getGraphTopologyKey()
  const structureChanged = topoKey !== graphTopologyKey
  const graphData = buildG6GraphData()
  applyCachedNodePositions(graphData.nodes)

  if (!graph || graph.get('destroyed')) {
    graphTopologyKey = topoKey
    saveNodePositionsToCache(graphData.nodes)
    initOrUpdateGraph()
    return
  }

  graph.changeSize(width, height)
  resetGraphViewport()

  if (structureChanged) {
    graphTopologyKey = topoKey
    saveNodePositionsToCache(graphData.nodes)
    graph.changeData(graphData)
    resetGraphViewport()
    updateGraphHighlightState()
    return
  }

  const nodeModelMap = new Map(graphData.nodes.map((n) => [String(n.id), n]))
  const edgeModelMap = new Map(graphData.edges.map((e) => [String(e.id), e]))

  graph.getNodes().forEach((node: any) => {
    const id = String(node.get('id'))
    const model = nodeModelMap.get(id)
    if (model) {
      graph.showItem(node)
      graph.updateItem(node, { x: model.x, y: model.y, style: model.style })
    } else {
      graph.hideItem(node)
    }
  })

  graphData.nodes.forEach((n) => {
    if (!graph.findById(n.id)) graph.addItem('node', n)
  })

  graph.getEdges().forEach((edge: any) => {
    const id = String(edge.get('id'))
    const model = edgeModelMap.get(id)
    if (model) {
      graph.showItem(edge)
      graph.updateItem(edge, { label: model.label, labelCfg: model.labelCfg, style: model.style })
    } else {
      graph.hideItem(edge)
    }
  })

  graphData.edges.forEach((e) => {
    if (!graph.findById(e.id)) graph.addItem('edge', e)
  })

  updateGraphHighlightState()
}

const setCurrentTimestamp = (ts: number, refreshGraph = true) => {
  const clamped = Math.min(Math.max(ts, minTimestamp.value), maxTimestamp.value)
  currentTimestamp.value = clamped
  if (!refreshGraph) return
  refreshGraphForTime()
  highlightActiveElements()
}

/**
 * [功能说明]
 * 注册 AntV G6 自定义边 `struck-cubic`
 *
 * [处理规则]
 * - 绘制 Layer 1 -> Layer 2 -> Layer 3 的平滑三层连接曲线。
 * - 链路仅使用三种视觉：绿色实线（未受干扰）、红色实线（正在干扰）、灰色虚线（已经干扰）。
 */
const registerCustomG6Edge = () => {
  try {
    G6.registerEdge(
      'struck-cubic',
      {
        draw(cfg: any, group: any) {
          const startPoint = cfg.startPoint
          const endPoint = cfg.endPoint
          const hgap = Math.abs(endPoint.y - startPoint.y) * 0.5
          const path = [
            ['M', startPoint.x, startPoint.y],
            ['C', startPoint.x, startPoint.y + hgap, endPoint.x, endPoint.y - hgap, endPoint.x, endPoint.y],
          ]

          const stroke = cfg.style?.stroke || LINK_COLORS.normal
          const lineDash = cfg.style?.lineDash

          const shape = group.addShape('path', {
            attrs: {
              path,
              stroke,
              lineWidth: cfg.style?.lineWidth || 2,
              lineDash,
              endArrow: cfg.style?.endArrow,
            },
            name: 'path-shape',
          })

          return shape
        },
      },
      'cubic-vertical'
    )
  } catch (err) {
    // 允许重复注册场景吃掉注册警告
  }
}

/**
 * [功能说明]
 * 格式化并去重卫星类型描述字符串
 *
 * [处理规则]
 * 按斜杠 / 拆分字符串，去除两端空白，使用 Set 进行去重，再重新用斜杠拼接。
 * 例: "地球观测/雷达/地球观测" -> "地球观测/雷达"
 *
 * @param typeStr 原始类型字符串
 * @returns 去重后的类型描述字符串
 */
const formatSatType = (typeStr?: string): string => {
  if (!typeStr) return ''
  const parts = typeStr
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  const uniqueParts = Array.from(new Set(parts))
  return uniqueParts.join('/')
}

type TopoNodeKind = 'sat' | 'relay' | 'receive' | 'station' | 'target'

const TOPO_NODE_SHAPE: Record<TopoNodeKind, string> = {
  sat: 'circle',
  relay: 'diamond',
  receive: 'triangle',
  station: 'rect',
  target: 'rect',
}

const TOPO_NODE_SIZE: Record<TopoNodeKind, number | [number, number]> = {
  sat: 16,
  relay: [18, 18],
  receive: 12,
  station: 18,
  target: 22,
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
    case 'target':
      return { fill: '#0f2742', stroke: '#1890ff', shadow: 'rgba(24, 144, 255, 0.4)' }
  }
}

const buildTopoNode = (opts: {
  id: string
  name: string
  kind: TopoNodeKind
  x: number
  layer: number
  struck?: boolean
}) => {
  const struck = !!opts.struck
  const colors = getTopoNodeColors(opts.kind, struck)
  const style = {
    fill: colors.fill,
    stroke: colors.stroke,
    lineWidth: struck ? 2.5 : 2,
    shadowColor: colors.shadow,
    shadowBlur: 12,
  }
  const stateStyle = {
    fill: colors.fill,
    stroke: colors.stroke,
    lineWidth: 3,
    shadowColor: colors.stroke,
    shadowBlur: 18,
  }
  return {
    id: opts.id,
    label: '',
    nodeName: opts.name,
    layer: opts.layer,
    x: opts.x,
    y: getLayerY(opts.layer),
    type: TOPO_NODE_SHAPE[opts.kind],
    size: TOPO_NODE_SIZE[opts.kind],
    anchorPoints: [
      [0.5, 0],
      [0.5, 1],
    ],
    style,
    labelCfg: { style: { opacity: 0 } },
    stateStyles: {
      active: stateStyle,
      highlight: { ...stateStyle, shadowBlur: 22 },
      hover: { ...stateStyle, lineWidth: 2.5 },
      selected: { ...stateStyle, shadowBlur: 24 },
      inactive: { ...style, opacity: 0.55 },
    },
  }
}

let topoTooltipEl: HTMLDivElement | null = null

const setupGraphTooltip = (g: any) => {
  if (!g6Container.value) return
  if (!topoTooltipEl) {
    topoTooltipEl = document.createElement('div')
    topoTooltipEl.className = 'g6-node-tooltip'
    g6Container.value.appendChild(topoTooltipEl)
  }

  const hideTooltip = () => {
    if (topoTooltipEl) topoTooltipEl.style.display = 'none'
  }

  const showTooltip = (name: string, clientX: number, clientY: number) => {
    if (!topoTooltipEl || !g6Container.value) return
    const rect = g6Container.value.getBoundingClientRect()
    topoTooltipEl.textContent = name
    topoTooltipEl.style.display = 'block'
    topoTooltipEl.style.left = `${clientX - rect.left + 12}px`
    topoTooltipEl.style.top = `${clientY - rect.top + 12}px`
  }

  g.off('node:mouseenter')
  g.off('node:mousemove')
  g.off('node:mouseleave')
  g.on('node:mouseenter', (evt: any) => {
    const name = String(evt.item?.getModel()?.nodeName || '')
    if (name) showTooltip(name, evt.clientX, evt.clientY)
  })
  g.on('node:mousemove', (evt: any) => {
    const name = String(evt.item?.getModel()?.nodeName || '')
    if (name) showTooltip(name, evt.clientX, evt.clientY)
  })
  g.on('node:mouseleave', hideTooltip)
  g.on('canvas:mouseleave', hideTooltip)
}

/**
 * [功能说明]
 * 调用后端 API 获取算法矩阵数据并更新 store (按 store 中的 selectedSatSeries 检索)
 * @param force 是否强制重新向 API 查询数据
 */
const fetchMatrixData = async (force = false) => {
  loading.value = true
  try {
    const data = await store.fetchReconnaissanceAttackMatrix(
      {
        taskId: store.activedTask?.id || 0,
        series: store.selectedSatSeries || '',
        intensityLevel: currentIntensity.value,
      },
      force
    )

    if (data) {
      matrixData.value = data
      selectedNorad.value = null
      selectedNodeInfo.value = null
    }
  } catch (err: any) {
    console.warn('调用后端算法矩阵接口提示:', err)
  } finally {
    loading.value = false
    nextTick(() => {
      graphTopologyKey = ''
      nodeLayoutCache.clear()
      initTimelineBounds()
      ensureCurrentTimestampValid()
      refreshGraphForTime()
    })
  }
}

/**
 * [监听器说明]
 * 监听 store 中共享的矩阵数据、卫星系列、激活任务和烈度改变，自动同步矩阵数据并更新图谱
 */
watch(
  [() => store.matrixData, () => store.selectedSatSeries, () => store.activedTask?.id],
  ([newStoreMatrix]) => {
    if (newStoreMatrix) {
      matrixData.value = newStoreMatrix
      selectedNorad.value = null
      selectedNodeInfo.value = null
      nextTick(() => {
        graphTopologyKey = ''
        nodeLayoutCache.clear()
        initTimelineBounds()
        ensureCurrentTimestampValid()
        refreshGraphForTime()
      })
    } else {
      void fetchMatrixData()
    }
  },
  { immediate: true }
)

watch(
  () => store.selectedSatSeries,
  (series, prev) => {
    if (series && series !== prev) {
      selectedNorad.value = null
      selectedNodeInfo.value = null
      void fetchMatrixData(true)
    }
  }
)

/**
 * [监听器说明]
 * 监听全局 Store 中的 intensityLevel 变动，保持组件内部选中烈度同步
 */
watch(
  () => store.intensityLevel,
  (newLevel) => {
    if (newLevel && newLevel !== currentIntensity.value) {
      currentIntensity.value = newLevel as IntensityLevelType
    }
  }
)

/**
 * [功能说明]
 * 切换交战烈度，重新向后端查询最新计算矩阵，并实时更新全局 Store 状态
 * @param level 目标烈度名称 ('低烈度' | '中烈度' | '高烈度')
 */
const handleIntensityChange = (level: IntensityLevelType) => {
  if (currentIntensity.value === level) return
  currentIntensity.value = level
  store.setIntensityLevel(level)
  void fetchMatrixData(true)
}

// ==================== 时间轴算法与转换函数 ====================

/**
 * 解析时间字符串为 Unix 毫秒时间戳
 */
const parseToTimestamp = (timeStr: string): number => {
  if (!timeStr) return Date.now()
  const d = new Date(timeStr.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? Date.now() : d.getTime()
}

/**
 * 格式化时间戳为 YY-MM-DD HH:mm:ss
 */
const formatTimeStr = (ts: number): string => {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const getWindowStartStr = (win: any): string => win.peakWindow || win.startWindow || win.beginWindow || ''
const getWindowEndStr = (win: any): string => win.endWindow || ''

const getVisibleTransitWindows = (windows: any[]): any[] => windows || []

/** 融合打击前 initWindows 与打击后 stationWindows */
const getSatTransitWindowsMerged = (data: any, norad: number): any[] => {
  const initSat = (data.initMatrixList || []).find((s: any) => s.norad === norad)
  const postSat = (data.satelliteMatrixList || []).find((s: any) => s.norad === norad)
  const merged = [...(initSat?.initWindows || []), ...(postSat?.stationWindows || [])]
  const map = new Map<string, any>()
  merged.forEach((win) => {
    const key = `${win.receiveId || ''}-${getWindowStartStr(win)}-${getWindowEndStr(win)}`
    const existing = map.get(key)
    if (!existing || (win.strikeStatus === 1 && existing.strikeStatus !== 1)) {
      map.set(key, win)
    }
  })
  return Array.from(map.values())
}

type LinkPhase = 'normal' | 'striking' | 'severed'

const LINK_COLORS: Record<LinkPhase, string> = {
  normal: '#52c41a',
  striking: '#ff4d4f',
  severed: '#94a3b8',
}

/** 根据当前推演时刻解析星地链路的打击阶段 */
const resolveTransitLinkPhase = (visibleWins: any[], currentTs: number): { phase: LinkPhase; delayMin: number } => {
  let phase: LinkPhase = 'normal'
  let delayMin = 0

  for (const win of visibleWins) {
    const startTs = parseToTimestamp(getWindowStartStr(win))
    const endTs = parseToTimestamp(getWindowEndStr(win))
    const struck = win.strikeStatus === 1
    const delay = Number(win.delayMin) || 0

    if (!struck) continue

    if (currentTs >= startTs && currentTs <= endTs) {
      return { phase: 'striking', delayMin: Math.max(delayMin, delay) }
    }
    if (currentTs > endTs) {
      phase = 'severed'
      delayMin = Math.max(delayMin, delay)
    }
  }
  return { phase, delayMin }
}

/** 解析星间中继链路阶段，规则与星地链路一致：绿实线 / 红实线 / 灰虚线 */
const resolveRelayLinkPhase = (
  rel: { from: string | number; to: string | number; visibilityWindows?: any[] },
  satMap: Map<number, { status: number }>,
  currentTs: number
): { phase: LinkPhase; delayMin: number } => {
  const fromSat = satMap.get(Number(rel.from))
  const toSat = satMap.get(Number(rel.to))
  const linkStruck = fromSat?.status === 1 || toSat?.status === 1
  const visibleWins = getVisibleTransitWindows(rel.visibilityWindows || []).map((win) => ({
    ...win,
    strikeStatus: linkStruck ? 1 : Number(win.strikeStatus) || 0,
    delayMin: Number(win.delayMin) || 0,
  }))
  let { phase, delayMin } = resolveTransitLinkPhase(visibleWins, currentTs)
  if (phase === 'normal' && linkStruck) phase = 'severed'
  return { phase, delayMin }
}

/** 解析地面站-数据中心链路阶段（融合打击前后通断） */
const resolveGroundLinkPhase = (
  rel: { from: string; to: string },
  postRelSet: Set<string>,
  receiveWins: any[],
  currentTs: number
): { phase: LinkPhase; delayMin: number } => {
  const visibleWins = getVisibleTransitWindows(receiveWins)
  const transitPhase = resolveTransitLinkPhase(visibleWins, currentTs)
  if (transitPhase.phase === 'striking') return transitPhase

  const inPost = postRelSet.has(`${rel.from}::${rel.to}`)
  if (!inPost) {
    const delayMin = Math.max(0, ...visibleWins.filter((w) => w.strikeStatus === 1).map((w) => Number(w.delayMin) || 0))
    return { phase: 'severed', delayMin }
  }
  return transitPhase
}

const buildEdgeVisual = (
  phase: LinkPhase,
  delayMin = 0,
  extraStyle: Record<string, unknown> = {}
): { style: Record<string, unknown>; label: string; labelCfg?: Record<string, unknown> } => {
  const style: Record<string, unknown> = {
    stroke: LINK_COLORS[phase],
    lineWidth: phase === 'striking' ? 2.5 : 2,
    lineDash: phase === 'severed' ? [6, 4] : undefined,
    ...extraStyle,
  }
  const label = phase === 'severed' && delayMin > 0 ? `+${delayMin}m` : ''
  const labelCfg = label
    ? { autoRotate: true, refY: -6, style: { fill: '#94a3b8', fontSize: 10, fontWeight: 600 } }
    : undefined
  return { style, label, labelCfg }
}

const countLinkPhase = (counts: { normal: number; striking: number; severed: number }, phase: LinkPhase) => {
  if (phase === 'striking') counts.striking++
  else if (phase === 'severed') counts.severed++
  else counts.normal++
}

const isGreenTimelineMarker = (type: TimelineChainMarkerType): boolean =>
  type === 'first_transmit' || type === 'post_chain_finish'

const isRedTimelineMarker = (type: TimelineChainMarkerType): boolean => type === 'jam'

const paintEdgePhase = (
  edge: any,
  phase: LinkPhase
): any => {
  const extraStyle: Record<string, unknown> = {}
  if (edge.style?.endArrow) {
    extraStyle.endArrow = {
      ...(edge.style.endArrow as object),
      fill: LINK_COLORS[phase],
    }
  }
  const edgeVisual = buildEdgeVisual(phase, 0, extraStyle)
  return {
    ...edge,
    label: edgeVisual.label,
    labelCfg: edgeVisual.labelCfg,
    style: { ...edge.style, ...edgeVisual.style },
  }
}

/** 统一链路着色：未选中 / 选中卫星 / 时间轴关键点 */
const applyGraphLinkPolicy = (
  data: MatrixResult,
  nodes: any[],
  edges: any[]
): { nodes: any[]; edges: any[]; linkCounts: { normal: number; striking: number; severed: number } } => {
  const norad = selectedNorad.value
  const timeline = selectedTimelinePoint.value
  const linkCounts = { normal: 0, striking: 0, severed: 0 }

  let visibleEdges = edges
  let displayEdgeIds = new Set<string>()

  if (timeline && norad) {
    const chain = resolveChainForTimelineMarker(data, norad, timeline.type, timeline.ms)
    if (chain.blocked && isRedTimelineMarker(timeline.type)) {
      displayEdgeIds = collectJamStrikeEdgeIdsAtTime(data, norad, timeline.ms)
    } else if (!chain.blocked) {
      displayEdgeIds = chainToEdgeIds(chain)
    }
    const allowed = getSatelliteRelatedEdgeIds(data, norad)
    visibleEdges = edges.filter(
      (e) => displayEdgeIds.has(String(e.id)) && allowed.has(String(e.id))
    )
  } else if (norad) {
    const allowed = getSatelliteRelatedEdgeIds(data, norad)
    const postChain = analyzeSatelliteFullChain(data, norad, true)
    displayEdgeIds = postChain.blocked ? new Set<string>() : chainToEdgeIds(postChain)
    visibleEdges = edges.filter((e) => allowed.has(String(e.id)))
  } else {
    displayEdgeIds = collectPostStrikePrimaryEdgeIds(data)
  }

  const paintedEdges = visibleEdges.map((edge) => {
    const edgeId = String(edge.id)
    let phase: LinkPhase = 'severed'

    if (timeline && norad) {
      if (!displayEdgeIds.has(edgeId)) {
        phase = 'severed'
      } else if (isRedTimelineMarker(timeline.type)) {
        phase = 'striking'
      } else if (isGreenTimelineMarker(timeline.type)) {
        phase = 'normal'
      } else {
        phase = 'normal'
      }
    } else {
      phase = displayEdgeIds.has(edgeId) ? 'normal' : 'severed'
    }

    const painted = paintEdgePhase(edge, phase)
    countLinkPhase(linkCounts, phase)
    return painted
  })

  const visibleNodeIds = new Set<string>()
  paintedEdges.forEach((e) => {
    visibleNodeIds.add(e.source)
    visibleNodeIds.add(e.target)
  })

  const filteredNodes =
    norad || (timeline && norad)
      ? nodes.filter((n) => visibleNodeIds.has(n.id))
      : nodes

  return { nodes: filteredNodes, edges: paintedEdges, linkCounts }
}

const currentTimeText = computed(() => formatTimeStr(currentTimestamp.value))

const formatDelayMinutes = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '0 分钟'
  const rounded = Number.isInteger(minutes) ? minutes : Number(minutes.toFixed(1))
  return `${rounded} 分钟`
}

/**
 * [功能]
 * 计算打击前服务时长（字段为 serviceDuration）。
 *
 * [处理规则]
 * - 优先从后端 initMatrixList 提取选中节点或整体卫星矩阵的 serviceDuration 字段。
 * - 如果单个节点选中且存在 serviceDuration，直接使用该数值。
 * - 若无直接数值，从 initWindows 计算窗口时间差作为兜底。
 * - 若未选中单节点，累加 initMatrixList 中所有卫星的 serviceDuration。
 *
 * [副作用]
 * 无
 *
 * [异常处理]
 * 当 matrixData 为空或字段不存在时返回 0。
 *
 * [修改约束]
 * 保持字段 serviceDuration 优先，防止逻辑覆盖。
 */
const preStrikeServiceDuration = computed<number | string>(() => {
  if (!matrixData.value) return 0
  const data: any = matrixData.value

  // 如果选中了具体卫星节点
  if (selectedNodeInfo.value?.norad) {
    const norad = selectedNodeInfo.value.norad
    const initSat = (data.initMatrixList || []).find((s: any) => s.norad === norad)
    if (initSat && typeof initSat.serviceDuration !== 'undefined' && initSat.serviceDuration !== null) {
      return initSat.serviceDuration
    }
    if (initSat?.initWindows && Array.isArray(initSat.initWindows) && initSat.initWindows.length > 0) {
      const totalMs = initSat.initWindows.reduce((acc: number, win: any) => {
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return acc + Math.max(0, end - start)
      }, 0)
      return Math.round(totalMs / (1000 * 60))
    }
    return 0
  }

  // 未选中具体节点时，优先读取根节点 preStrikeServiceDuration 或 serviceDuration
  if (typeof data.preStrikeServiceDuration !== 'undefined' && data.preStrikeServiceDuration !== null) {
    return data.preStrikeServiceDuration
  }

  const initList = data.initMatrixList || []
  if (initList.length > 0) {
    let hasField = false
    const totalField = initList.reduce((acc: number, sat: any) => {
      if (typeof sat.serviceDuration !== 'undefined' && sat.serviceDuration !== null) {
        hasField = true
        return acc + Number(sat.serviceDuration)
      }
      return acc
    }, 0)
    if (hasField) return totalField

    const totalMs = initList.reduce((accSat: number, sat: any) => {
      const windows = sat.initWindows || []
      const satMs = windows.reduce((accWin: number, win: any) => {
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return accWin + Math.max(0, end - start)
      }, 0)
      return accSat + satMs
    }, 0)
    return Math.round(totalMs / (1000 * 60))
  }

  return 0
})

/**
 * [功能]
 * 计算打击后服务时长（字段为 serviceDuration）。
 *
 * [处理规则]
 * - 优先从后端 satelliteMatrixList 提取选中节点或整体卫星矩阵的 serviceDuration 字段。
 * - 如果单个节点选中且存在 serviceDuration，直接使用该数值。
 * - 若无直接数值，从 stationWindows 计算非毁伤窗口时间差作为兜底。
 * - 若未选中单节点，累加 satelliteMatrixList 中所有卫星的 serviceDuration。
 *
 * [副作用]
 * 无
 *
 * [异常处理]
 * 当 matrixData 为空或字段不存在时返回 0。
 *
 * [修改约束]
 * 保持字段 serviceDuration 优先。
 */
const postStrikeServiceDuration = computed<number | string>(() => {
  if (!matrixData.value) return 0
  const data: any = matrixData.value

  // 如果选中了具体卫星节点
  if (selectedNodeInfo.value?.norad) {
    const norad = selectedNodeInfo.value.norad
    const sat = (data.satelliteMatrixList || []).find((s: any) => s.norad === norad)
    if (sat && typeof sat.serviceDuration !== 'undefined' && sat.serviceDuration !== null) {
      return sat.serviceDuration
    }
    if (sat?.stationWindows && Array.isArray(sat.stationWindows) && sat.stationWindows.length > 0) {
      const totalMs = sat.stationWindows.reduce((acc: number, win: any) => {
        if (win.strikeStatus === 1) return acc
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return acc + Math.max(0, end - start)
      }, 0)
      return Math.round(totalMs / (1000 * 60))
    }
    return 0
  }

  // 未选中具体节点时，优先读取根节点 postStrikeServiceDuration
  if (typeof data.postStrikeServiceDuration !== 'undefined' && data.postStrikeServiceDuration !== null) {
    return data.postStrikeServiceDuration
  }

  const satList = data.satelliteMatrixList || []
  if (satList.length > 0) {
    let hasField = false
    const totalField = satList.reduce((acc: number, sat: any) => {
      if (typeof sat.serviceDuration !== 'undefined' && sat.serviceDuration !== null) {
        hasField = true
        return acc + Number(sat.serviceDuration)
      }
      return acc
    }, 0)
    if (hasField) return totalField

    const totalMs = satList.reduce((accSat: number, sat: any) => {
      const windows = sat.stationWindows || sat.initWindows || []
      const satMs = windows.reduce((accWin: number, win: any) => {
        if (win.strikeStatus === 1) return accWin
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return accWin + Math.max(0, end - start)
      }, 0)
      return accSat + satMs
    }, 0)
    return Math.round(totalMs / (1000 * 60))
  }

  return 0
})

/**
 * [功能]
 * 格式化服务时长数字展示 (追加 "分钟" 单位)
 *
 * @param val 原始时长数值或字符串
 * @returns 格式化后的字符串，如 "120 分钟"
 */
const formatServiceDurationText = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0 分钟'
  const num = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(num)) return '0 分钟'
  const formattedNum = Number.isInteger(num) ? num.toString() : num.toFixed(1)
  return `${formattedNum} 分钟`
}

const formattedPreServiceDuration = computed(() => formatServiceDurationText(preStrikeServiceDuration.value))
const formattedPostServiceDuration = computed(() => formatServiceDurationText(postStrikeServiceDuration.value))

/**
 * [功能说明]
 * 提取所有过境/打击窗口，按照开始时间由早到晚升序排列。
 *
 * 需求 6：时间轴的开始和结束时间分别是 第一个卫星过境地面站的开始时间 ---》最后一个卫星过境地面站结束时间。
 */
const allWindowsList = computed<WindowItemWrapper[]>(() => {
  if (!matrixData.value) return []
  const data: any = matrixData.value
  const list: WindowItemWrapper[] = []
  const satMap = new Map<number, string>()
  const defaultTargetName = store.battle?.name || '战场目标区域'

    ; (data.initMatrixList || []).forEach((s: any) => satMap.set(s.norad, s.name))
    ; (data.satelliteMatrixList || []).forEach((s: any) => satMap.set(s.norad, s.name))

  // 1. 从 satelliteMatrixList 提取 (包含打击状态 strikeStatus)
  const satMatrixList = data.satelliteMatrixList || []
  satMatrixList.forEach((sat: any) => {
    const windows = sat.stationWindows || sat.initWindows || []
    windows.forEach((win: any, index: number) => {
      const startStr = win.peakWindow || win.startWindow || win.beginWindow || ''
      const endStr = win.endWindow || ''
      const startTs = parseToTimestamp(startStr)
      const endTs = parseToTimestamp(endStr)
      const recName = win.receiveName || defaultTargetName
      const recId = win.receiveId || 'target-area'
      const strikeVal = typeof win.strikeStatus === 'number' ? win.strikeStatus : sat.satelliteStatus === 1 ? 1 : 0

      list.push({
        id: `win-sat-${sat.norad}-${recId}-${index}`,
        satName: sat.name || satMap.get(sat.norad) || `Sat-${sat.norad}`,
        satNorad: sat.norad,
        receiveName: recName,
        receiveId: recId,
        startTime: startStr,
        endTime: endStr,
        startTimeShort: startStr ? startStr.split(' ')[1] || startStr : '',
        endTimeShort: endStr ? endStr.split(' ')[1] || endStr : '',
        startTimestamp: startTs,
        endTimestamp: endTs,
        strikeStatus: strikeVal,
        delayMin: win.delayMin || sat.delayMin,
        weapons: win.weapons || sat.weapons,
      })
    })
  })

  // 2. 补充 initMatrixList 中独有的过境窗口
  const initMatrixList = data.initMatrixList || []
  initMatrixList.forEach((sat: any) => {
    const windows = sat.initWindows || []
    windows.forEach((win: any, index: number) => {
      const startStr = win.peakWindow || win.startWindow || win.beginWindow || ''
      const endStr = win.endWindow || ''
      const recName = win.receiveName || defaultTargetName
      const recId = win.receiveId || 'target-area'
      const winId = `win-init-${sat.norad}-${recId}-${index}`

      const exists = list.some(
        (item) => item.satNorad === sat.norad && item.receiveId === recId && item.startTime === startStr
      )
      if (!exists) {
        const startTs = parseToTimestamp(startStr)
        const endTs = parseToTimestamp(endStr)
        list.push({
          id: winId,
          satName: sat.name,
          satNorad: sat.norad,
          receiveName: recName,
          receiveId: recId,
          startTime: startStr,
          endTime: endStr,
          startTimeShort: startStr ? startStr.split(' ')[1] || startStr : '',
          endTimeShort: endStr ? endStr.split(' ')[1] || endStr : '',
          startTimestamp: startTs,
          endTimestamp: endTs,
          strikeStatus: 0,
        })
      }
    })
  })

  // 3. 提取 relayRelation.relations 中的星间中继过境时间窗口 (visibilityWindows)
  const relayRels = data.relayRelation?.relations || []
  relayRels.forEach((rel) => {
    const fromNorad = Number(rel.from)
    const toNorad = Number(rel.to)
    const fromSatName = satMap.get(fromNorad) || `Sat-${fromNorad}`
    const toSatName = satMap.get(toNorad) || `TDRS-${toNorad}`

    const windows = rel.visibilityWindows || []
    windows.forEach((win, index) => {
      const startTs = parseToTimestamp(win.beginWindow)
      const endTs = parseToTimestamp(win.endWindow)
      list.push({
        id: `win-relay-${rel.from}-${rel.to}-${index}`,
        satName: fromSatName,
        satNorad: fromNorad,
        receiveName: toSatName,
        receiveId: `sat-${rel.to}`,
        startTime: win.beginWindow,
        endTime: win.endWindow,
        startTimeShort: win.beginWindow ? win.beginWindow.split(' ')[1] || win.beginWindow : '',
        endTimeShort: win.endWindow ? win.endWindow.split(' ')[1] || win.endWindow : '',
        startTimestamp: startTs,
        endTimestamp: endTs,
        strikeStatus: 0,
        isRelayWindow: true,
        relayNorad: toNorad,
      })
    })
  })

  // 按过境开始时间从早到晚进行升序排序
  list.sort((a, b) => a.startTimestamp - b.startTimestamp)
  return list
})

const minTimestamp = computed(() => {
  const task = store.activedTask
  if (task?.beginDate) return parseToTimestamp(task.beginDate)
  if (allWindowsList.value.length === 0) return Date.now()
  return Math.min(...allWindowsList.value.map((w) => w.startTimestamp))
})

const maxTimestamp = computed(() => {
  const task = store.activedTask
  if (task?.endDate) return parseToTimestamp(task.endDate)
  if (allWindowsList.value.length === 0) return Date.now() + 3600 * 1000
  return Math.max(...allWindowsList.value.map((w) => w.endTimestamp))
})

const initTimelineBounds = () => {
  currentTimestamp.value = minTimestamp.value
}

const isWindowActiveAtCurrentTime = (win: WindowItemWrapper) => {
  return currentTimestamp.value >= win.startTimestamp && currentTimestamp.value <= win.endTimestamp
}

const highlightActiveElements = () => {
  if (!graph) return
  const activeWins = allWindowsList.value.filter((w) => isWindowActiveAtCurrentTime(w))
  const activeNodeIds = new Set<string>()

  activeWins.forEach((w) => {
    const satId = `sat-${w.satNorad}`
    activeNodeIds.add(satId)
    activeNodeIds.add(w.receiveId)
  })

  // 当前过境卫星对应的中继卫星节点同步保持活跃，但链路颜色仍只由绿/红/灰三种状态决定
  const relayRels = matrixData.value?.relayRelation?.relations || []
  relayRels.forEach((rel) => {
    const fromId = `sat-${rel.from}`
    const toId = `sat-${rel.to}`
    if (activeNodeIds.has(fromId)) {
      activeNodeIds.add(toId)
    }
  })

  graph.getEdges().forEach((edge: any) => {
    graph.setItemState(edge, 'active', false)
    graph.setItemState(edge, 'highlight', false)
  })

  graph.getNodes().forEach((node: any) => {
    const id = node.get('id')
    if (activeNodeIds.has(id)) {
      graph.setItemState(node, 'active', true)
    } else {
      graph.setItemState(node, 'active', false)
    }
  })
}

// ==================== G6 拓扑构建与布局算法 ====================

// 统计看板计算属性
const satNodeCount = ref(0)
const receiveNodeCount = ref(0)
const stationNodeCount = ref(0)
const normalLinkCount = ref(0)
const strikingLinkCount = ref(0)
const severedLinkCount = ref(0)
const currentTs = () => currentTimestamp.value

/**
 * 构建 3 层 AntV G6 图数据 (Layer 1 卫星 -> Layer 2 地面站 -> Layer 3 数据中心)
 */
const buildG6GraphData = () => {
  if (!matrixData.value) return { nodes: [], edges: [] }
  syncGraphStageHeight()
  const data: any = matrixData.value

  // ==================== 通讯卫星模式两层拓扑构建 ====================
  if (currentSatCategory.value === 'COMM') {
    const nodes: any[] = []
    const edges: any[] = []
    const satMap = new Map<number, { norad: number; name: string; satType: string; status: number }>()

      ; (data.initMatrixList || []).forEach((s: any) => {
        satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType || '通讯卫星', status: 0 })
      })
      ; (data.satelliteMatrixList || []).forEach((s: any) => {
        satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType || '通讯卫星', status: s.satelliteStatus || 0 })
      })

    const satList = Array.from(satMap.values())
    satNodeCount.value = satList.length
    receiveNodeCount.value = 1
    stationNodeCount.value = 0

    const containerW = g6Container.value ? g6Container.value.clientWidth : 0
    if (containerW <= 0) return { nodes: [], edges: [] }
    const startX = 140
    const availableW = Math.max(containerW - startX - 30, 400)

    // 1. 排布第一层 通讯卫星
    satList.forEach((sat, i) => {
      const id = `sat-${sat.norad}`
      const x = startX + (availableW / (satList.length + 1)) * (i + 1)
      nodes.push(
        buildTopoNode({
          id,
          name: sat.name,
          kind: 'sat',
          x,
          layer: 1,
          struck: sat.status === 1,
        })
      )
    })

    const targetNodeId = 'target-area'
    const targetName = store.battle?.name || '战场目标区域'
    nodes.push(
      buildTopoNode({
        id: targetNodeId,
        name: targetName,
        kind: 'target',
        x: containerW / 2,
        layer: 2,
      })
    )

    let linkCounts = { normal: 0, striking: 0, severed: 0 }

    satList.forEach((sat) => {
      const satId = `sat-${sat.norad}`
      const visibleWins = getVisibleTransitWindows(getSatTransitWindowsMerged(data, sat.norad))
      if (visibleWins.length === 0) return

      let { phase, delayMin } = resolveTransitLinkPhase(visibleWins, currentTs())
      if (phase === 'normal' && sat.status === 1) phase = 'severed'

      const edgeVisual = buildEdgeVisual(phase, delayMin, {
        endArrow: { path: G6.Arrow.triangle(6, 8, 0), fill: LINK_COLORS[phase] },
      })
      countLinkPhase(linkCounts, phase)

      edges.push({
        id: `edge-${satId}-${targetNodeId}`,
        source: satId,
        target: targetNodeId,
        type: 'struck-cubic',
        label: edgeVisual.label,
        labelCfg: edgeVisual.labelCfg,
        style: edgeVisual.style,
      })
    })

    const applied = applyGraphLinkPolicy(data, nodes, edges)
    normalLinkCount.value = applied.linkCounts.normal
    strikingLinkCount.value = applied.linkCounts.striking
    severedLinkCount.value = applied.linkCounts.severed
    satNodeCount.value = applied.nodes.filter((node) => String(node.id).startsWith('sat-')).length

    return { nodes: applied.nodes, edges: applied.edges }
  }

  // ==================== 侦察卫星模式三层拓扑构建 ====================
  const nodes: any[] = []
  const edges: any[] = []
  const nodeSet = new Set<string>()

  // 1. 提取普通卫星 (Layer 1) 与 中继卫星 (Layer 2)
  // [变量用途] 保存节点 NORAD 到卫星详细信息及打击状态的映射
  const satMap = new Map<number, { norad: number; name: string; satType: string; status: number }>()
    ; (data.initMatrixList || []).forEach((s) => {
      satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: 0 })
    })

    // 判断是否有卫星/中继卫星被打击
    ; (data.satelliteMatrixList || []).forEach((s) => {
      satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: s.satelliteStatus || 0 })
    })
  // [逻辑说明] 提取星间中继拓扑关系中的中继卫星节点
  if (data.relayRelation) {
    ; (data.relayRelation.relayList || []).forEach((norad) => {
      if (!satMap.has(norad)) {
        satMap.set(norad, { norad, name: `TDRS-${norad}`, satType: '通信/数据中继', status: 0 })
      }
    })
  }

  const satList = Array.from(satMap.values())
  satNodeCount.value = satList.length

  // 判断是否为中继卫星 (satType 包含 "中继" 或在 relayRelation.relayList 中)
  const isRelaySat = (s: { satType?: string; norad: number }) => {
    const isRelayType = (s.satType || '').includes('中继')
    const inRelayList = (data.relayRelation?.relayList || []).includes(s.norad)
    return isRelayType || inRelayList
  }

  const normalSatList = satList.filter((s) => !isRelaySat(s))
  const relaySatList = satList.filter((s) => isRelaySat(s))

  // 2. Layer 3: 地面接收站 (Ground Stations)
  const receiveMap = new Map<string, { receiveId: string; receiveName: string; status: number }>()
  const relLists = [data.stationRelationList, data.initRelationList].filter(Boolean)

  relLists.forEach((rl) => {
    ; (rl.receiveObjList || []).forEach((rec) => {
      const recStatus = rec.receiveStatus || 0
      if (!receiveMap.has(rec.receiveId)) {
        receiveMap.set(rec.receiveId, {
          receiveId: rec.receiveId,
          receiveName: rec.receiveName || rec.receiveId,
          status: recStatus,
        })
      } else {
        const existing = receiveMap.get(rec.receiveId)!
        if (recStatus === 1) {
          existing.status = 1
        }
      }
    })
  })
  const receiveList = Array.from(receiveMap.values())
  receiveNodeCount.value = receiveList.length

  // 3. Layer 3: 中心云数据中心 (Data Centers)
  const stationMap = new Map<string, { stationId: string; stationName: string; status: number }>()
  relLists.forEach((rl) => {
    ; (rl.stationObjList || []).forEach((st) => {
      const stStatus = st.stationStatus || 0
      if (!stationMap.has(st.stationId)) {
        stationMap.set(st.stationId, {
          stationId: st.stationId,
          stationName: st.stationName || st.stationId,
          status: stStatus,
        })
      } else {
        const existing = stationMap.get(st.stationId)!
        if (stStatus === 1) {
          existing.status = 1
        }
      }
    })
  })
  const stationList = Array.from(stationMap.values())
  stationNodeCount.value = stationList.length

  // 四层布局：按容器高度比例分配 Y 坐标
  const containerW = g6Container.value ? g6Container.value.clientWidth : 0
  if (containerW <= 0) return { nodes: [], edges: [] }
  const startX = 140
  const availableW = Math.max(containerW - startX - 30, 400)

  normalSatList.forEach((sat, i) => {
    const id = `sat-${sat.norad}`
    nodeSet.add(id)
    const x = startX + (availableW / (normalSatList.length + 1)) * (i + 1)
    nodes.push(
      buildTopoNode({
        id,
        name: sat.name,
        kind: 'sat',
        x,
        layer: 1,
        struck: sat.status === 1,
      })
    )
  })

  relaySatList.forEach((sat, i) => {
    const id = `sat-${sat.norad}`
    nodeSet.add(id)
    const x = startX + (availableW / (relaySatList.length + 1)) * (i + 1)
    nodes.push(
      buildTopoNode({
        id,
        name: sat.name,
        kind: 'relay',
        x,
        layer: 2,
        struck: sat.status === 1,
      })
    )
  })

  receiveList.forEach((rec, i) => {
    nodeSet.add(rec.receiveId)
    const x = startX + (availableW / (receiveList.length + 1)) * (i + 1)
    nodes.push(
      buildTopoNode({
        id: rec.receiveId,
        name: rec.receiveName,
        kind: 'receive',
        x,
        layer: 3,
        struck: rec.status === 1,
      })
    )
  })

  stationList.forEach((st, i) => {
    nodeSet.add(st.stationId)
    const x = startX + (availableW / (stationList.length + 1)) * (i + 1)
    nodes.push(
      buildTopoNode({
        id: st.stationId,
        name: st.stationName,
        kind: 'station',
        x,
        layer: 4,
        struck: st.status === 1,
      })
    )
  })

  // ==================== 构建边 Edges (Layer 1->2 & Layer 2->3) ====================
  const edgeSet = new Set<string>()
  const linkCounts = { normal: 0, striking: 0, severed: 0 }

  // 保存全部节点坐标，避免时间刷新时布局抖动
  saveNodePositionsToCache(nodes)

  // 1. Layer 1 -> Layer 2 边 (卫星 -> 地面站)，融合打击前/打击后窗口
  satList.forEach((sat) => {
    const satId = `sat-${sat.norad}`
    if (!nodeSet.has(satId)) return
    const windows = getSatTransitWindowsMerged(data, sat.norad)
    const receiveWindowsMap = new Map<string, any[]>()

    windows.forEach((win: any) => {
      const recId = win.receiveId
      if (!recId || !nodeSet.has(recId)) return
      if (!receiveWindowsMap.has(recId)) receiveWindowsMap.set(recId, [])
      receiveWindowsMap.get(recId)!.push(win)
    })

    receiveWindowsMap.forEach((recWins, recId) => {
      const visibleWins = getVisibleTransitWindows(recWins)
      if (visibleWins.length === 0) return

      const edgeId = `edge-${satId}-${recId}`
      if (edgeSet.has(edgeId)) return
      edgeSet.add(edgeId)

      const { phase, delayMin } = resolveTransitLinkPhase(visibleWins, currentTs())
      const edgeVisual = buildEdgeVisual(phase, delayMin)
      countLinkPhase(linkCounts, phase)

      edges.push({
        id: edgeId,
        source: satId,
        target: recId,
        sourceAnchor: 1,
        targetAnchor: 0,
        type: 'struck-cubic',
        label: edgeVisual.label,
        labelCfg: edgeVisual.labelCfg,
        style: edgeVisual.style,
      })
    })
  })

  // 2. 地面站 -> 数据中心
  const initRels = data.initRelationList?.relations || []
  const postRels = data.stationRelationList?.relations || []
  const postRelSet = new Set(postRels.map((r) => `${r.from}::${r.to}`))

  initRels.forEach((rel) => {
    const edgeId = `edge-${rel.from}-${rel.to}`
    if (!edgeSet.has(edgeId) && nodeSet.has(rel.from) && nodeSet.has(rel.to)) {
      edgeSet.add(edgeId)

      const allReceiveWins: any[] = []
      satList.forEach((sat) => {
        getSatTransitWindowsMerged(data, sat.norad)
          .filter((w) => w.receiveId === rel.from)
          .forEach((w) => allReceiveWins.push(w))
      })

      const { phase, delayMin } = resolveGroundLinkPhase(rel, postRelSet as Set<string>, allReceiveWins, currentTs())
      const edgeVisual = buildEdgeVisual(phase, delayMin)
      countLinkPhase(linkCounts, phase)

      edges.push({
        id: edgeId,
        source: rel.from,
        target: rel.to,
        sourceAnchor: 1,
        targetAnchor: 0,
        type: 'struck-cubic',
        label: edgeVisual.label,
        labelCfg: edgeVisual.labelCfg,
        style: edgeVisual.style,
      })
    }
  })

  // 3. Layer 1 -> Layer 2 边 (星间数据中继拓扑关系: 普通卫星 -> 数据中继卫星)
  const relayRels = data.relayRelation?.relations || []
  relayRels.forEach((rel) => {
    const sourceSatId = `sat-${rel.from}`
    const targetSatId = `sat-${rel.to}`
    const edgeId = `edge-relay-${rel.from}-${rel.to}`

    if (!edgeSet.has(edgeId) && nodeSet.has(sourceSatId) && nodeSet.has(targetSatId)) {
      edgeSet.add(edgeId)
      const { phase, delayMin } = resolveRelayLinkPhase(rel, satMap, currentTs())
      const edgeVisual = buildEdgeVisual(phase, delayMin)
      countLinkPhase(linkCounts, phase)

      edges.push({
        id: edgeId,
        source: sourceSatId,
        target: targetSatId,
        sourceAnchor: 1,
        targetAnchor: 0,
        type: 'struck-cubic',
        label: edgeVisual.label,
        labelCfg: edgeVisual.labelCfg,
        style: edgeVisual.style,
      })
    }
  })

  const applied = applyGraphLinkPolicy(data, nodes, edges)
  normalLinkCount.value = applied.linkCounts.normal
  strikingLinkCount.value = applied.linkCounts.striking
  severedLinkCount.value = applied.linkCounts.severed
  satNodeCount.value = applied.nodes.filter((node) => String(node.id).startsWith('sat-')).length

  return { nodes: applied.nodes, edges: applied.edges }
}

/**
 * [功能说明]
 * 初始化或更新 AntV G6 画布
 *
 * [处理规则]
 * - 当视图切回可见状态时，在 nextTick 后准确获取 DOM 容器宽高度 (clientWidth / clientHeight)。
 * - 若 graph 尚未创建或已销毁，则新建 G6.Graph 实例并 render。
 * - 若 graph 已存在，则调用 changeSize 动态调整画布尺寸并重新装载数据 (changeData)。
 */
const initOrUpdateGraph = () => {
  if (!g6Container.value) return

  syncGraphStageHeight()
  ensureCurrentTimestampValid()

  // 准确获取 DOM 容器宽高度 (clientWidth / clientHeight)
  const width = g6Container.value.clientWidth
  const height = g6Container.value.clientHeight

  // 容器处于 display: none 或尚未渲染（尺寸为 0）时直接返回，避免画布尺寸坍塌
  if (!width || !height || width <= 0 || height <= 0) return

  // 自定义边
  registerCustomG6Edge()

  const data = buildG6GraphData()
  applyCachedNodePositions(data.nodes)
  saveNodePositionsToCache(data.nodes)
  graphTopologyKey = getGraphTopologyKey()

  if (!graph || graph.get('destroyed')) {
    graph = new G6.Graph({
      container: g6Container.value,
      width,
      height,
      fitView: false,
      modes: {
        default: [],
      },
      defaultNode: {
        type: 'circle',
      },
      defaultEdge: {
        type: 'struck-cubic',
        labelCfg: {
          autoRotate: true,
          refY: -6,
          style: {
            fill: '#94a3b8',
            fontSize: 10,
            fontWeight: 600,
          },
        },
      },
      nodeStateStyles: {
        active: {
          lineWidth: 3,
          shadowBlur: 15,
        },
        highlight: {
          lineWidth: 3,
          shadowBlur: 18,
        },
        hover: {
          lineWidth: 2.5,
        },
        selected: {
          lineWidth: 3,
          shadowBlur: 20,
        },
        inactive: {
          opacity: 0.75,
        },
      },
      edgeStateStyles: {
        active: {
          lineWidth: 2.5,
        },
        highlight: {
          lineWidth: 2.5,
        },
        inactive: {
          opacity: 0.45,
        },
      },
    })
    graph.data(data)
    graph.render()
    resetGraphViewport()
    setupGraphTooltip(graph)

    graph.on('node:click', (evt: any) => {
      const nodeItem = evt.item
      if (!nodeItem) return
      const model = nodeItem.getModel()
      const nodeId = String(model.id)

      if (nodeId.startsWith('sat-')) {
        const norad = Number(nodeId.replace('sat-', ''))
        if (selectedNorad.value === norad) {
          handleSelectSatellite(null)
        } else {
          handleSelectSatellite(norad)
        }
        return
      }

      selectedNorad.value = null
      if (selectedNodeInfo.value?.id === nodeId) {
        selectedNodeInfo.value = null
      } else {
        parseAndSelectNode(model)
      }
      updateGraphHighlightState()
    })

    graph.on('canvas:click', () => {
      handleSelectSatellite(null)
    })
  } else {
    // 拓扑图已有实例：重新计算画布大小并替换渲染数据
    graph.changeSize(width, height)
    graph.changeData(data)
    resetGraphViewport()
    updateGraphHighlightState()
  }
}

/**
 * [功能说明]
 * 解析 G6 节点 model 并存入 selectedNodeInfo 选中对象
 */
const parseAndSelectNode = (model: any) => {
  const id = String(model.id)
  const data = matrixData.value

  if (id.startsWith('sat-')) {
    const norad = Number(id.replace('sat-', ''))
    const isRelay = (data?.relayRelation?.relayList || []).includes(norad)
    const satObj =
      (data?.satelliteMatrixList || []).find((s) => s.norad === norad) ||
      (data?.initMatrixList || []).find((s) => s.norad === norad)
    const name = satObj?.name || model.nodeName || (model.label ? String(model.label).split('\n')[0] : `Sat-${norad}`)

    selectedNodeInfo.value = {
      id,
      name,
      type: isRelay ? 'relay' : 'sat',
      norad,
    }
  } else {
    // 判断节点是中心云数据中心还是地面接收站
    const isStation =
      (data?.stationRelationList?.stationObjList || []).some((st) => st.stationId === id) ||
      (data?.initRelationList?.stationObjList || []).some((st) => st.stationId === id)

    if (isStation) {
      const stObj =
        (data?.stationRelationList?.stationObjList || []).find((st) => st.stationId === id) ||
        (data?.initRelationList?.stationObjList || []).find((st) => st.stationId === id)
      selectedNodeInfo.value = {
        id,
        name: stObj?.stationName || model.nodeName || model.label || id,
        type: 'station',
        stationId: id,
      }
    } else {
      const recObj =
        (data?.stationRelationList?.receiveObjList || []).find((r) => r.receiveId === id) ||
        (data?.initRelationList?.receiveObjList || []).find((r) => r.receiveId === id)
      selectedNodeInfo.value = {
        id,
        name: recObj?.receiveName || model.nodeName || model.label || id,
        type: 'receive',
        receiveId: id,
      }
    }
  }
}

/**
 * [功能说明]
 * 更新 G6 图节点的选中样式：仅高亮当前节点，不联动高亮相连链路
 */
const updateGraphHighlightState = () => {
  if (!graph || graph.get('destroyed')) return

  if (!selectedNodeInfo.value) {
    highlightActiveElements()
    return
  }

  const selId = selectedNodeInfo.value.id

  graph.getNodes().forEach((node: any) => {
    const id = node.get('id')
    if (id === selId) {
      graph.setItemState(node, 'selected', true)
      graph.setItemState(node, 'inactive', false)
      graph.setItemState(node, 'highlight', false)
      graph.setItemState(node, 'active', false)
    } else {
      graph.setItemState(node, 'selected', false)
      graph.setItemState(node, 'highlight', false)
      graph.setItemState(node, 'inactive', true)
      graph.setItemState(node, 'active', false)
    }
  })

  graph.getEdges().forEach((edge: any) => {
    graph.setItemState(edge, 'highlight', false)
    graph.setItemState(edge, 'inactive', false)
    graph.setItemState(edge, 'active', false)
  })
}

// [变量用途]
// 容器尺寸观察器与防抖定时器
let resizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null

/**
 * [函数说明]
 * 监听容器尺寸变化并防抖更新 G6 画布尺寸与布局
 */
const handleResize = () => {
  if (resizeTimer) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    initOrUpdateGraph()
  }, 60)
}

onMounted(() => {
  fetchMatrixData()
  window.addEventListener('resize', handleResize)

  if (g6Container.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        handleResize()
      }
    })
    resizeObserver.observe(g6Container.value)
  }
})

/**
 * [Hook 说明]
 * KeepAlive 缓存组件切回激活状态时重新计算 DOM 尺寸并绘制拓扑
 */
onActivated(() => {
  nextTick(() => {
    setTimeout(() => {
      initOrUpdateGraph()
    }, 50)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) {
    window.clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (graph) {
    graph.destroy()
    graph = null
  }
})
</script>

<style lang="scss" scoped>
@use '../styles/theme.scss';

.cema-g6-dashboard {
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 45px);
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.cema-header {
  height: 52px;
  background: rgba(10, 18, 34, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;

  .header-title {
    font-size: 17px;
    font-weight: 700;
    color: #00e1ff;
    letter-spacing: 1px;
  }
}

.header-center {
  display: flex;
  align-items: center;
  gap: 15px;
}

.series-filter-group {
  display: flex;
  align-items: center;
  gap: 8px;

  .label-text {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
  }

  .series-select {
    width: 150px;
  }
}

.intensity-group,
.matrix-tab-group {
  display: flex;
  align-items: center;
  background: rgba(8, 14, 26, 0.7);
  padding: 3px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.18);
}

.nav-tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 5px 13px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.25s ease;

  &:hover {
    color: #00e1ff;
  }

  &.active {
    background: linear-gradient(135deg, rgba(0, 225, 255, 0.35), rgba(0, 102, 255, 0.45));
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 0 8px rgba(0, 225, 255, 0.3);
  }

  &.tab-matrix.active {
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.35), rgba(255, 120, 117, 0.45));
    box-shadow: 0 0 8px rgba(255, 77, 79, 0.3);
  }
}

.v-divider {
  width: 1px;
  height: 22px;
  background: rgba(0, 225, 255, 0.2);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #94a3b8;

  .label-text {
    margin-right: 5px;
  }

  .time-value {
    color: #00e1ff;
    font-weight: 600;
  }
}

.cema-workspace {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, #0a1326 0%, #050811 100%);
}

.topo-summary-bar {
  height: 36px;
  background: rgba(13, 22, 40, 0.6);
  border-bottom: 1px solid rgba(0, 225, 255, 0.1);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 20px;
  font-size: 12px;
  color: #cbd5e1;

  .stat-badge {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot-sat {
    background: #00e1ff;
    box-shadow: 0 0 6px #00e1ff;
  }

  .dot-rec {
    background: #00f2fe;
  }

  .dot-station {
    background: #3b82f6;
  }

  .dot-normal-link {
    background: #52c41a;
  }

  .dot-striking-link {
    background: #ff4d4f;
    box-shadow: 0 0 6px #ff4d4f;
  }

  .dot-severed-link {
    background: #94a3b8;
  }

  .dot-struck-link {
    background: #ff4d4f;
    box-shadow: 0 0 6px #ff4d4f;
  }

  .alert-stat {
    color: #ff7875;
  }
}

.topo-main-body {
  flex: 1;
  width: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.topo-side {
  height: 100%;
  min-height: 0;
  overflow: hidden;

  &--left {
    width: 460px;
    min-width: 460px;
    border-right: 1px solid rgba(0, 225, 255, 0.18);
  }

  &--right {
    width: 480px;
    min-width: 480px;
    border-left: 1px solid rgba(0, 225, 255, 0.18);
  }

  :deep(.c2-panel) {
    height: 100%;
  }
}

.topo-chain-banner {
  margin: 0;
  padding: 8px 16px 10px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  background: linear-gradient(180deg, rgba(8, 20, 40, 0.95) 0%, rgba(6, 14, 28, 0.85) 100%);

  .chain-banner-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .chain-banner-title {
    font-size: 12px;
    font-weight: 700;
    color: #7dd3fc;
  }

  .chain-banner-time {
    font-size: 11px;
    font-family: monospace;
    color: #67e8f9;
  }

  .chain-banner-flow {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px 8px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid rgba(56, 189, 248, 0.25);
    background: rgba(10, 18, 34, 0.85);
  }

  .chain-banner-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 72px;
    max-width: 120px;

    .step-icon {
      font-size: 14px;
    }

    .step-name {
      font-size: 11px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }

    .step-sub {
      font-size: 9px;
      color: #64748b;
    }
  }

  .chain-banner-arrow {
    color: #38bdf8;
    font-weight: 700;
    font-size: 14px;
  }

  .chain-banner-blocked {
    font-size: 11px;
    color: #fca5a5;
    padding: 6px 10px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }
}

.topo-center-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.topo-graph-stack {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.graph-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.graph-layer-labels {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 132px;
  z-index: 5;
  pointer-events: none;
}

.graph-layer-label {
  position: absolute;
  left: 6px;
  right: 4px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(13, 24, 46, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.25);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);

  .layer-icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .layer-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .layer-title {
    font-size: 11px;
    font-weight: 700;
    color: #00e1ff;
    line-height: 1.3;
  }

  .layer-sub {
    font-size: 9px;
    color: #64748b;
    line-height: 1.2;
  }

  &.layer-2-item {
    border-color: rgba(0, 242, 254, 0.3);

    .layer-title {
      color: #00f2fe;
    }
  }

  &.layer-3-item {
    border-color: rgba(0, 242, 254, 0.3);

    .layer-title {
      color: #00f2fe;
    }
  }

  &.layer-4-item {
    border-color: rgba(59, 130, 246, 0.3);

    .layer-title {
      color: #60a5fa;
    }
  }
}

.graph-time-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 12px;
  border-top: 1px solid rgba(0, 225, 255, 0.12);
  background: rgba(9, 16, 30, 0.85);
  font-size: 12px;

  .toolbar-label {
    color: #94a3b8;
  }

  .time-value {
    color: #00e1ff;
    font-weight: 600;
    font-family: Consolas, monospace;
  }

  .toolbar-divider {
    width: 1px;
    height: 14px;
    background: rgba(148, 163, 184, 0.35);
  }

  .time-window-select {
    width: 100px;
  }

  .service-duration-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 4px;
    padding: 2px 10px;
    font-size: 12px;

    .badge-label {
      color: #94a3b8;
    }

    .badge-val {
      font-size: 13px;
      font-weight: 700;
    }

    &.pre-strike-badge {
      border: 1px solid rgba(0, 225, 255, 0.35);
      background: rgba(0, 225, 255, 0.08);

      .badge-val {
        color: #00e1ff;
      }
    }

    &.post-strike-badge {
      border: 1px solid rgba(255, 120, 117, 0.35);
      background: rgba(255, 77, 79, 0.08);

      .badge-val {
        color: #ff7875;
      }
    }
  }
}

.mission-timeline-wrap {
  flex-shrink: 0;
  position: relative;
  padding: 0 8px 8px;

  :deep(.battle-mission-timeline) {
    position: relative;
    left: 0;
    right: 0;
    bottom: 0;
    margin: 0;
  }
}

.g6-chart-container {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;

  :deep(canvas) {
    display: block;
  }

  :deep(.g6-node-tooltip) {
    position: absolute;
    z-index: 20;
    display: none;
    pointer-events: none;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: #e2efff;
    background: rgba(8, 14, 28, 0.95);
    border: 1px solid rgba(0, 225, 255, 0.35);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
    white-space: nowrap;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
