<template>
  <div class="cema-g6-dashboard dark-theme">
    <!-- 顶部导航与控制栏 Header -->
    <div class="cema-header">
      <div class="header-left">
        <span class="header-title glow-text">三层节点拓扑毁伤分析</span>
      </div>

      <!-- 视图模式与系列筛选 -->
      <div class="header-center">
        <div class="selection-status">
          <span class="status-item">
            <span class="label-text">当前系列</span>
            <strong class="status-val">{{ currentSeriesText }}</strong>
          </span>
          <span class="status-item">
            <span class="label-text">当前卫星</span>
            <strong class="status-val">{{ currentSatelliteText }}</strong>
          </span>
        </div>

        <div class="v-divider"></div>

        <!-- 卫星系列筛选 -->
        <div class="series-filter-group">
          <span class="label-text">卫星系列</span>
          <el-select v-model="selectedSeries" class="series-select" size="small" placeholder="选择系列"
            :disabled="seriesOptions.length === 0" @change="handleSeriesChange">
            <el-option v-for="series in seriesOptions" :key="series" :label="series" :value="series" />
          </el-select>
        </div>

        <div class="v-divider"></div>
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
          <TopoLeftPanel
            :matrix-data="matrixData"
            :selected-norad="selectedNorad"
            :selected-link-id="selectedLinkId"
            @select-link="handleSelectLink"
          />
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
                :selected-marker-ms="selectedTimelinePoint?.ms ?? null"
                :selected-marker-type="selectedTimelinePoint?.type ?? null"
                :selected-marker-label="selectedTimelinePoint?.label ?? null"
                :selected-marker-receive-id="selectedTimelinePoint?.receiveId ?? selectedReceiveId"
                @time-change="handleTimelineTimeChange"
                @marker-click="handleTimelineMarkerClick" />
            </div>
          </div>
        </div>

        <div class="topo-side topo-side--right">
          <TopoRightPanel
            :matrix-data="matrixData"
            :selected-norad="selectedNorad"
            :selected-link-id="selectedLinkId"
            :selected-node-id="selectedPanelNodeId"
            :selected-node-layer="selectedPanelNodeLayer"
          />
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
import TopoLeftPanel from '@/components/electronic/TopoLeftPanel.vue'
import TopoRightPanel from '@/components/electronic/TopoRightPanel.vue'
import BattleMissionTimeline from '@/components/BattleSituation/BattleMissionTimeline.vue'
import { type TimelineChainMarkerType, collectSatelliteTransmissionLinks, collectSeriesTransmissionLinks, listNormalSatelliteNorads, type ChainNode, type SatelliteTransmissionLink } from '@/utils/satelliteFullChainAnalysis'

defineOptions({
  name: 'ElectronicWarfareG6',
})
const store = useLayoutStore()

const selectedNorad = ref<number | null>(null)
const selectedLinkId = ref<string | null>(null)
const selectedReceiveId = ref<string | null>(null)
const selectedPanelNodeId = ref<string | null>(null)
const selectedPanelNodeLayer = ref<'sat' | 'receive' | 'station' | null>(null)
const selectedTimelinePoint = ref<{
  ms: number
  type: TimelineChainMarkerType
  label: string
  receiveId?: string
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

const resolveSatName = (norad: number | null): string => {
  if (norad == null) return '未选择'
  const data = matrixData.value
  const satObj =
    (data?.satelliteMatrixList || []).find((s) => s.norad === norad) ||
    (data?.initMatrixList || []).find((s) => s.norad === norad)
  return satObj?.name || `Sat-${norad}`
}

const currentSeriesText = computed(() => store.selectedSatSeries || '未选择')
const currentSatelliteText = computed(() => {
  if (selectedNorad.value != null) return resolveSatName(selectedNorad.value)
  const data = matrixData.value
  if (!data) return '未选择'
  const count = listNormalSatelliteNorads(data).length
  return count > 0 ? `系列全部 (${count}颗)` : '未选择'
})

const handleTopoNodeSelect = (
  payload: { id: string; layer: 'sat' | 'receive' | 'station'; norad?: number } | null
) => {
  if (!payload) {
    selectedPanelNodeId.value = null
    selectedPanelNodeLayer.value = null
    return
  }
  selectedPanelNodeId.value = payload.id
  selectedPanelNodeLayer.value = payload.layer
}

const handleSelectLink = (linkId: string | null) => {
  selectedLinkId.value = linkId
  updateGraphHighlightState()
}

const handleSelectSatellite = (norad: number | null) => {
  selectedNorad.value = norad
  store.setSelectedAnalysisNorad(norad)
  selectedLinkId.value = null
  selectedReceiveId.value = null
  selectedTimelinePoint.value = null
  if (norad) {
    selectedPanelNodeId.value = `sat-${norad}`
    selectedPanelNodeLayer.value = 'sat'
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
    selectedPanelNodeId.value = null
    selectedPanelNodeLayer.value = null
    selectedNodeInfo.value = null
  }
  updateGraphHighlightState()
  refreshGraphForTime()
}

const isStationNodeId = (nodeId: string): boolean => {
  const data = matrixData.value
  if (!data) return false
  return (
    (data.stationRelationList?.stationObjList || []).some((st) => st.stationId === nodeId) ||
    (data.initRelationList?.stationObjList || []).some((st) => st.stationId === nodeId)
  )
}

const syncTimelineForReceive = (receiveId: string) => {
  const norad = selectedNorad.value
  const data = matrixData.value
  if (!norad || !data) return
  const link = collectSatelliteTransmissionLinks(data, norad).find((item) => item.receiveId === receiveId)
  if (!link) return
  selectedTimelinePoint.value = {
    ms: link.transmitStartMs,
    type: link.struck ? 'jam' : 'first_transmit',
    label: link.receiveName,
    receiveId: link.receiveId,
  }
}

const handleSelectReceiveStation = (receiveId: string, model: any) => {
  selectedLinkId.value = null

  if (!selectedNorad.value) {
    parseAndSelectNode(model)
    updateGraphHighlightState()
    return
  }
  if (selectedReceiveId.value === receiveId) {
    selectedReceiveId.value = null
    selectedTimelinePoint.value = null
    const norad = selectedNorad.value
    const data = matrixData.value
    const satObj =
      (data?.satelliteMatrixList || []).find((s) => s.norad === norad) ||
      (data?.initMatrixList || []).find((s) => s.norad === norad)
    selectedPanelNodeId.value = `sat-${norad}`
    selectedPanelNodeLayer.value = 'sat'
    selectedNodeInfo.value = {
      id: `sat-${norad}`,
      name: satObj?.name || `Sat-${norad}`,
      type: 'sat',
      norad,
    }
    updateGraphHighlightState()
    return
  }

  selectedReceiveId.value = receiveId
  parseAndSelectNode(model)
  syncTimelineForReceive(receiveId)
  updateGraphHighlightState()
}

const handleTimelineTimeChange = (ms: number) => {
  setCurrentTimestamp(ms)
}

const handleTimelineMarkerClick = (payload: {
  ms: number
  type: TimelineChainMarkerType
  label: string
  receiveId?: string
}) => {
  selectedLinkId.value = null
  selectedTimelinePoint.value = payload
  if (payload.receiveId) {
    selectedReceiveId.value = payload.receiveId
    selectedPanelNodeId.value = payload.receiveId
    selectedPanelNodeLayer.value = 'receive'
    const data = matrixData.value
    const recObj =
      (data?.stationRelationList?.receiveObjList || []).find((r) => r.receiveId === payload.receiveId) ||
      (data?.initRelationList?.receiveObjList || []).find((r) => r.receiveId === payload.receiveId)
    selectedNodeInfo.value = {
      id: payload.receiveId,
      name: recObj?.receiveName || payload.label,
      type: 'receive',
      receiveId: payload.receiveId,
    }
  } else {
    selectedReceiveId.value = null
  }
  setCurrentTimestamp(payload.ms)
  updateGraphHighlightState()
}

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
  store.setSelectedAnalysisNorad(null)
  selectedNorad.value = null
  selectedPanelNodeId.value = null
  selectedPanelNodeLayer.value = null
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
  if (!norad) {
    selectedTimelinePoint.value = null
    selectedReceiveId.value = null
    selectedLinkId.value = null
  }
  refreshGraphForTime()
})

watch(selectedLinkId, () => {
  updateGraphHighlightState()
})

/**
 * 从整体态势共享状态同步当前分析卫星
 */
const syncTopoSelectionFromStore = () => {
  const focusNorad = store.consumeTopoFocusNorad()
  const norad = focusNorad ?? store.selectedAnalysisNorad
  if (norad != null && selectedNorad.value !== norad) {
    handleSelectSatellite(norad)
    return
  }
  if (norad != null && selectedNorad.value === norad && graph) {
    refreshGraphForTime()
  }
}

watch(selectedTimelinePoint, () => {
  updateGraphHighlightState()
})

watch(seriesOptions, (options) => {
  if (!options.length) return
  if (!options.includes(store.selectedSatSeries)) {
    const nextSeries = options[0]
    store.setSelectedSatSeries(nextSeries)
    void fetchMatrixData(true)
  }
})

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
  `${store.selectedSatSeries}|${matrixData.value?.series ?? ''}|${selectedNorad.value ?? ''}|${selectedLinkId.value ?? ''}|${g6Container.value?.clientWidth ?? 0}|${g6Container.value?.clientHeight ?? 0}`

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
      graph.updateItem(edge, { style: model.style })
    } else {
      graph.removeItem(edge)
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

/**
 * 格式化地面站节点下方显示的延时副标题
 * @param delayMin 延时分钟数
 * @returns 有延时时返回如 "+2672.9 分钟"，否则 undefined
 */
const formatReceiveDelaySubLabel = (delayMin: number): string | undefined => {
  if (delayMin > 0) return `+${delayMin} 分钟`
  return undefined
}

const buildTopoNode = (opts: {
  id: string
  name: string
  kind: TopoNodeKind
  x: number
  layer: number
  struck?: boolean
  /** 是否在节点下方显示名称 */
  showLabel?: boolean
  /** 名称下方的副标题（如造成的延时） */
  subLabel?: string
}) => {
  const struck = !!opts.struck
  const showLabel = opts.showLabel !== false
  const hasSubLabel = showLabel && !!opts.subLabel
  const labelText = showLabel
    ? hasSubLabel
      ? `${opts.name}\n${opts.subLabel}`
      : opts.name
    : ''
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
    label: labelText,
    nodeName: opts.name,
    kind: opts.kind,
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
 * 根据 Store 中共享的卫星选择恢复拓扑页选中状态
 */
const applySharedSatelliteSelection = () => {
  const norad = store.selectedAnalysisNorad
  const data = matrixData.value
  if (norad && data) {
    selectedNorad.value = norad
    selectedPanelNodeId.value = `sat-${norad}`
    selectedPanelNodeLayer.value = 'sat'
    const satObj =
      (data.satelliteMatrixList || []).find((s) => s.norad === norad) ||
      (data.initMatrixList || []).find((s) => s.norad === norad)
    const isRelay = (data.relayRelation?.relayList || []).includes(norad)
    selectedNodeInfo.value = {
      id: `sat-${norad}`,
      name: satObj?.name || `Sat-${norad}`,
      type: isRelay ? 'relay' : 'sat',
      norad,
    }
    return
  }
  selectedNorad.value = null
  selectedPanelNodeId.value = null
  selectedPanelNodeLayer.value = null
  selectedNodeInfo.value = null
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
      },
      force
    )

    if (data) {
      matrixData.value = data
      applySharedSatelliteSelection()
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
 * 监听 store 中共享的矩阵数据、卫星系列、激活任务改变，自动同步矩阵数据并更新图谱
 */
watch(
  [() => store.matrixData, () => store.selectedSatSeries, () => store.activedTask?.id],
  ([newStoreMatrix]) => {
    if (newStoreMatrix) {
      matrixData.value = newStoreMatrix
      applySharedSatelliteSelection()
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
      selectedPanelNodeId.value = null
      selectedPanelNodeLayer.value = null
      selectedNodeInfo.value = null
      void fetchMatrixData(true)
    }
  }
)

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
const currentTs = () => currentTimestamp.value

/** 正常链路颜色（青色实线） */
const LINK_COLOR_NORMAL = '#00e1ff'
/** 被打击链路颜色（灰色虚线） */
const LINK_COLOR_STRUCK = '#94a3b8'

/**
 * 将链路节点映射为 G6 图节点 ID
 * @param node 链路节点
 * @returns G6 节点 ID
 */
const resolveChainNodeGraphId = (node: ChainNode): string => {
  if (node.layer === 'SAT' || node.layer === 'RELAY') return `sat-${node.id}`
  return node.id
}

/**
 * 构建链路边的视觉样式
 * @param struck 是否被打击
 * @param highlighted 是否高亮选中
 * @returns G6 边样式对象
 */
const buildLinkEdgeStyle = (struck: boolean, highlighted: boolean) => {
  const dimmed = selectedLinkId.value && !highlighted
  return {
    stroke: struck ? LINK_COLOR_STRUCK : LINK_COLOR_NORMAL,
    lineWidth: highlighted ? 3.5 : struck ? 2 : 2.5,
    lineDash: struck ? [6, 4] : undefined,
    opacity: dimmed ? 0.22 : 1,
    shadowColor: highlighted ? LINK_COLOR_NORMAL : undefined,
    shadowBlur: highlighted ? 12 : 0,
  }
}

/**
 * 根据链路集合构建侦察系列拓扑图（支持单星或全系列）
 * @param norads 参与布局的卫星 NORAD 列表
 * @param links 传输链路集合
 * @returns G6 图数据
 */
const buildReconGraphFromLinks = (norads: number[], links: SatelliteTransmissionLink[]) => {
  const data = matrixData.value!
  const nodes: any[] = []
  const edges: any[] = []
  const nodeSet = new Set<string>()

  const containerW = g6Container.value ? g6Container.value.clientWidth : 0
  if (containerW <= 0) return { nodes: [], edges: [] }
  const startX = 140
  const availableW = Math.max(containerW - startX - 30, 400)

  const satOrderMap = new Map<number, { norad: number; name: string; earliestMs: number; struck: boolean }>()
  norads.forEach((norad) => {
    const initSat = data.initMatrixList?.find((s) => s.norad === norad)
    const postSat = data.satelliteMatrixList?.find((s) => s.norad === norad)
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
  const stationMap = new Map<string, { id: string; name: string; receiveId: string }>()

  links.forEach((link) => {
    const satNode = link.nodes.find((n) => n.layer === 'SAT')
    if (satNode) {
      const norad = Number(satNode.id)
      const existingSat = satOrderMap.get(norad)
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
            delayMin: link.delayMin || existing?.delayMin || 0,
          })
        } else {
          if (link.receiveStruck) existing.receiveStruck = true
          if (link.delayMin > existing.delayMin) existing.delayMin = link.delayMin
        }
      }
      if (n.layer === 'RELAY') {
        relayMap.set(n.id, { id: n.id, name: n.name })
      }
      if (n.layer === 'STATION') {
        const receiveNode = link.nodes.find((x) => x.layer === 'RECEIVE')
        stationMap.set(n.id, { id: n.id, name: n.name, receiveId: receiveNode?.id || '' })
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
  const relayList = Array.from(relayMap.values())

  satNodeCount.value = sortedSats.length
  receiveNodeCount.value = sortedReceives.length
  stationNodeCount.value = stationMap.size

  sortedSats.forEach((sat, i) => {
    const satId = `sat-${sat.norad}`
    const x =
      sortedSats.length === 1 ? containerW / 2 : startX + (availableW / (sortedSats.length + 1)) * (i + 1)
    nodes.push(
      buildTopoNode({
        id: satId,
        name: sat.name,
        kind: 'sat',
        x,
        layer: 1,
        struck: sat.struck,
        showLabel: true,
      })
    )
    nodeSet.add(satId)
  })

  relayList.forEach((relay, i) => {
    const id = `sat-${relay.id}`
    const x =
      relayList.length === 1 ? containerW / 2 : startX + (availableW / (relayList.length + 1)) * (i + 1)
    if (!nodeSet.has(id)) {
      nodes.push(buildTopoNode({ id, name: relay.name, kind: 'relay', x, layer: 2, showLabel: true }))
      nodeSet.add(id)
    }
  })

  const receiveXMap = new Map<string, number>()
  sortedReceives.forEach((rec, i) => {
    const x =
      sortedReceives.length === 1 ? containerW / 2 : startX + (availableW / (sortedReceives.length + 1)) * (i + 1)
    receiveXMap.set(rec.id, x)
    nodes.push(
      buildTopoNode({
        id: rec.id,
        name: rec.name,
        kind: 'receive',
        x,
        layer: 3,
        struck: rec.receiveStruck,
        showLabel: true,
        subLabel: formatReceiveDelaySubLabel(rec.delayMin),
      })
    )
    nodeSet.add(rec.id)
  })

  const stationPlaced = new Set<string>()
  stationMap.forEach((st) => {
    if (stationPlaced.has(st.id)) return
    const x = receiveXMap.get(st.receiveId) ?? containerW / 2
    nodes.push(
      buildTopoNode({
        id: st.id,
        name: st.name,
        kind: 'station',
        x,
        layer: 4,
        showLabel: true,
      })
    )
    nodeSet.add(st.id)
    stationPlaced.add(st.id)
  })

  links.forEach((link) => {
    const highlighted = selectedLinkId.value === link.id
    for (let i = 0; i < link.nodes.length - 1; i++) {
      const source = resolveChainNodeGraphId(link.nodes[i])
      const target = resolveChainNodeGraphId(link.nodes[i + 1])
      if (!nodeSet.has(source) || !nodeSet.has(target)) continue
      const edgeId = `edge-${link.id}-${i}`
      edges.push({
        id: edgeId,
        linkId: link.id,
        source,
        target,
        sourceAnchor: 1,
        targetAnchor: 0,
        type: 'cubic-vertical',
        linkStruck: link.struck,
        style: buildLinkEdgeStyle(link.struck, highlighted),
      })
    }
  })

  saveNodePositionsToCache(nodes)
  return { nodes, edges }
}

/**
 * 为选中卫星构建聚焦拓扑图（含全部传输链路与节点名称）
 * @param norad 卫星 NORAD 编号
 * @returns G6 图数据
 */
const buildFocusedSatelliteGraph = (norad: number) => {
  const data = matrixData.value!
  return buildReconGraphFromLinks([norad], collectSatelliteTransmissionLinks(data, norad))
}

/**
 * 构建当前系列全部卫星的侦察拓扑图
 * @returns G6 图数据
 */
const buildSeriesReconGraph = () => {
  const data = matrixData.value!
  const norads = listNormalSatelliteNorads(data)
  return buildReconGraphFromLinks(norads, collectSeriesTransmissionLinks(data))
}

/**
 * 通讯卫星聚焦拓扑：卫星 → 战场目标
 * @param norad 卫星 NORAD 编号
 * @returns G6 图数据
 */
const buildFocusedCommGraph = (norad: number) => {
  const data = matrixData.value!
  const nodes: any[] = []
  const edges: any[] = []
  const containerW = g6Container.value ? g6Container.value.clientWidth : 0
  if (containerW <= 0) return { nodes: [], edges: [] }

  const initSat = data.initMatrixList?.find((s) => s.norad === norad)
  const postSat = data.satelliteMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name || `Sat-${norad}`
  const struck = postSat?.satelliteStatus === 1
  const satId = `sat-${norad}`
  const targetNodeId = 'target-area'
  const targetName = store.battle?.name || '战场目标区域'

  satNodeCount.value = 1
  receiveNodeCount.value = 1
  stationNodeCount.value = 0

  nodes.push(
    buildTopoNode({
      id: satId,
      name: satName,
      kind: 'sat',
      x: containerW / 2,
      layer: 1,
      struck,
      showLabel: true,
    })
  )
  nodes.push(
    buildTopoNode({
      id: targetNodeId,
      name: targetName,
      kind: 'target',
      x: containerW / 2,
      layer: 2,
      showLabel: true,
    })
  )

  const highlighted = !selectedLinkId.value || selectedLinkId.value === `comm-${norad}`
  edges.push({
    id: `edge-comm-${norad}`,
    linkId: `comm-${norad}`,
    source: satId,
    target: targetNodeId,
    type: 'cubic-vertical',
    linkStruck: struck,
    style: buildLinkEdgeStyle(struck, highlighted),
  })

  saveNodePositionsToCache(nodes)
  return { nodes, edges }
}

/**
 * 构建当前系列全部通讯卫星的拓扑图：多颗卫星 → 战场目标
 * @returns G6 图数据
 */
const buildSeriesCommGraph = () => {
  const data = matrixData.value!
  const nodes: any[] = []
  const edges: any[] = []
  const containerW = g6Container.value ? g6Container.value.clientWidth : 0
  if (containerW <= 0) return { nodes: [], edges: [] }

  const startX = 140
  const availableW = Math.max(containerW - startX - 30, 400)
  const norads = listNormalSatelliteNorads(data)
  const targetNodeId = 'target-area'
  const targetName = store.battle?.name || '战场目标区域'

  satNodeCount.value = norads.length
  receiveNodeCount.value = 1
  stationNodeCount.value = 0

  norads.forEach((norad, i) => {
    const initSat = data.initMatrixList?.find((s) => s.norad === norad)
    const postSat = data.satelliteMatrixList?.find((s) => s.norad === norad)
    const satName = postSat?.name || initSat?.name || `Sat-${norad}`
    const struck = postSat?.satelliteStatus === 1
    const satId = `sat-${norad}`
    const x =
      norads.length === 1 ? containerW / 2 : startX + (availableW / (norads.length + 1)) * (i + 1)

    nodes.push(
      buildTopoNode({
        id: satId,
        name: satName,
        kind: 'sat',
        x,
        layer: 1,
        struck,
        showLabel: true,
      })
    )

    const linkId = `comm-${norad}`
    const highlighted = !selectedLinkId.value || selectedLinkId.value === linkId
    edges.push({
      id: `edge-comm-${norad}`,
      linkId,
      source: satId,
      target: targetNodeId,
      type: 'cubic-vertical',
      linkStruck: struck,
      style: buildLinkEdgeStyle(struck, highlighted),
    })
  })

  nodes.push(
    buildTopoNode({
      id: targetNodeId,
      name: targetName,
      kind: 'target',
      x: containerW / 2,
      layer: 2,
      showLabel: true,
    })
  )

  saveNodePositionsToCache(nodes)
  return { nodes, edges }
}

/**
 * 构建选中卫星的聚焦拓扑图数据
 */
const buildG6GraphData = () => {
  if (!matrixData.value) return { nodes: [], edges: [] }
  syncGraphStageHeight()

  if (!selectedNorad.value) {
    if (currentSatCategory.value === 'COMM') {
      return buildSeriesCommGraph()
    }
    return buildSeriesReconGraph()
  }

  if (currentSatCategory.value === 'COMM') {
    return buildFocusedCommGraph(selectedNorad.value)
  }
  return buildFocusedSatelliteGraph(selectedNorad.value)
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
        if (!Number.isFinite(norad)) return
        if (selectedNorad.value !== norad) {
          handleSelectSatellite(norad)
        } else {
          selectedLinkId.value = null
          selectedReceiveId.value = null
          selectedTimelinePoint.value = null
          selectedPanelNodeId.value = `sat-${norad}`
          selectedPanelNodeLayer.value = 'sat'
          parseAndSelectNode(model)
          updateGraphHighlightState()
        }
        return
      }

      if (model.kind === 'receive' || (!nodeId.startsWith('sat-') && !isStationNodeId(nodeId))) {
        handleSelectReceiveStation(nodeId, model)
        return
      }

      selectedLinkId.value = null
      selectedReceiveId.value = null
      selectedTimelinePoint.value = null
      parseAndSelectNode(model)
      updateGraphHighlightState()
    })

    graph.on('edge:click', (evt: any) => {
      const edgeItem = evt.item
      if (!edgeItem) return
      const linkId = String(edgeItem.getModel().linkId || '')
      if (!linkId) return
      handleSelectLink(selectedLinkId.value === linkId ? null : linkId)
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
    selectedPanelNodeId.value = id
    selectedPanelNodeLayer.value = 'sat'
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
      selectedPanelNodeId.value = id
      selectedPanelNodeLayer.value = 'station'
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
      selectedPanelNodeId.value = id
      selectedPanelNodeLayer.value = 'receive'
    }
  }
}

/**
 * 更新 G6 图节点与链路的选中/高亮样式
 */
const updateGraphHighlightState = () => {
  if (!graph || graph.get('destroyed')) return

  if (selectedLinkId.value) {
    graph.getNodes().forEach((node: any) => {
      graph.setItemState(node, 'selected', false)
      graph.setItemState(node, 'inactive', false)
      graph.setItemState(node, 'highlight', false)
      graph.setItemState(node, 'active', false)
    })
    graph.getEdges().forEach((edge: any) => {
      const model = edge.getModel()
      const linkId = String(model.linkId || '')
      const struck = !!model.linkStruck
      const highlighted = linkId === selectedLinkId.value
      graph.updateItem(edge, { style: buildLinkEdgeStyle(struck, highlighted) })
      graph.setItemState(edge, 'highlight', highlighted)
      graph.setItemState(edge, 'inactive', false)
      graph.setItemState(edge, 'active', false)
    })
    return
  }

  const receiveId = selectedReceiveId.value || selectedTimelinePoint.value?.receiveId || null
  const satId = selectedNorad.value != null ? `sat-${selectedNorad.value}` : null

  if (receiveId && satId) {
    graph.getNodes().forEach((node: any) => {
      const id = String(node.get('id'))
      const focus = id === receiveId || id === satId
      graph.setItemState(node, 'selected', focus)
      graph.setItemState(node, 'inactive', !focus)
      graph.setItemState(node, 'highlight', id === receiveId)
      graph.setItemState(node, 'active', false)
    })
    graph.getEdges().forEach((edge: any) => {
      const model = edge.getModel()
      const source = String(model.source)
      const target = String(model.target)
      const onReceivePath =
        (source === satId && target === receiveId) ||
        source === receiveId ||
        target === receiveId
      graph.updateItem(edge, { style: buildLinkEdgeStyle(!!model.linkStruck, onReceivePath) })
      graph.setItemState(edge, 'highlight', onReceivePath)
      graph.setItemState(edge, 'inactive', !onReceivePath)
      graph.setItemState(edge, 'active', false)
    })
    return
  }

  if (selectedTimelinePoint.value?.type === 'first_transmit' && satId && !receiveId) {
    graph.getNodes().forEach((node: any) => {
      const id = String(node.get('id'))
      graph.setItemState(node, 'selected', id === satId)
      graph.setItemState(node, 'inactive', id !== satId)
      graph.setItemState(node, 'highlight', false)
      graph.setItemState(node, 'active', false)
    })
    graph.getEdges().forEach((edge: any) => {
      graph.setItemState(edge, 'inactive', false)
      graph.setItemState(edge, 'active', false)
      graph.setItemState(edge, 'highlight', false)
    })
    return
  }

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
    const model = edge.getModel()
    graph.updateItem(edge, { style: buildLinkEdgeStyle(!!model.linkStruck, false) })
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
  syncTopoSelectionFromStore()
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
  syncTopoSelectionFromStore()
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

.all-links-btn {
  border: 1px solid rgba(0, 225, 255, 0.28);
  background: rgba(8, 14, 26, 0.7);
}

.selection-status {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.18);
  background: rgba(8, 14, 26, 0.7);

  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .label-text {
    font-size: 12px;
    color: #94a3b8;
  }

  .status-val {
    font-size: 13px;
    font-weight: 700;
    color: #67e8f9;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
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
