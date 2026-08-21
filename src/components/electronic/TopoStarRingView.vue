<template>
  <div ref="containerRef" class="star-ring-view" :class="[`mode-${viewMode}`]">
    <!-- 顶部提示 -->
    <div class="ring-hint">
      <template v-if="viewMode === 'planar'">
        最内虚线环为阵地，点击节点查看链路，默认只标关键量
      </template>
      <template v-else>
        上三层为星地网络，底面圆盘为阵地，拖拽旋转 / 滚轮缩放
      </template>
    </div>

    <!-- 平面星环 -->
    <svg
      v-if="viewMode === 'planar' && layoutReady"
      class="ring-svg ring-svg--planar"
      :viewBox="`0 0 ${stageWidth} ${stageHeight}`"
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- 环层 -->
      <g class="rings-group">
        <circle
          v-for="ring in layout.rings"
          :key="ring.key"
          :cx="layout.cx"
          :cy="layout.cy"
          :r="ring.radius"
          fill="none"
          :stroke="ring.stroke"
          :stroke-width="ring.dashed ? 1.2 : 1.5"
          :stroke-dasharray="ring.dashed ? '6 5' : undefined"
          opacity="0.85"
        />
      </g>

      <!-- 链路 -->
      <g class="edges-group">
        <line
          v-for="edge in visibleEdges"
          :key="edge.id"
          :x1="edge.x1"
          :y1="edge.y1"
          :x2="edge.x2"
          :y2="edge.y2"
          :stroke="edge.stroke"
          :stroke-width="edge.width"
          :stroke-dasharray="edge.dash"
          :opacity="edge.opacity"
          class="ring-edge"
          @click.stop="emit('edge-click', edge.linkId)"
        />
      </g>

      <!-- 阵地标签 -->
      <g class="position-labels">
        <text
          v-for="(pos, idx) in layout.positions"
          :key="`pos-${idx}`"
          :x="pos.x"
          :y="pos.y"
          class="position-label"
          text-anchor="middle"
          dominant-baseline="middle"
        >
          {{ pos.name }}
        </text>
      </g>

      <!-- 节点 -->
      <g class="nodes-group">
        <g
          v-for="node in layout.layoutNodes"
          :key="node.id"
          class="ring-node"
          :class="nodeClass(node)"
          @click.stop="emit('node-click', node)"
          @mouseenter="hoveredNodeId = node.id"
          @mouseleave="hoveredNodeId = null"
        >
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="nodeRadius(node)"
            :fill="nodeFill(node)"
            :stroke="nodeStroke(node)"
            :stroke-width="nodeStrokeWidth(node)"
            :filter="nodeActive(node) ? 'url(#glow)' : undefined"
          />
          <text
            v-if="showNodeLabel(node)"
            :x="node.x"
            :y="node.y + nodeRadius(node) + 14"
            class="node-label"
            text-anchor="middle"
          >
            {{ node.label }}
          </text>
        </g>
      </g>

      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>

    <!-- 立体星环 (Three.js) -->
    <TopoStereoRingThree
      v-else-if="viewMode === 'stereo'"
      :nodes="nodes"
      :edges="edges"
      :is-comm="isComm"
      :position-labels="positionLabels"
      :selected-node-id="selectedNodeId"
      :selected-link-id="selectedLinkId"
      :selected-receive-id="selectedReceiveId"
      :selected-sat-id="selectedSatId"
      :active-node-ids="activeNodeIds"
      @node-click="emit('node-click', $event)"
      @edge-click="emit('edge-click', $event)"
    />

    <!-- 环层图例 -->
    <div class="ring-legend">
      <div class="ring-legend__title">环层图例</div>
      <div class="ring-legend__preview">
        <div class="legend-rings-icon">
          <span class="lr lr--outer" />
          <span class="lr lr--mid" />
          <span class="lr lr--inner" />
        </div>
      </div>
      <div v-for="(item, idx) in legendItems" :key="idx" class="ring-legend__item">
        <span class="legend-dot" :class="`legend-dot--${item.shape}`" :style="{ borderColor: item.color, background: item.shape === 'circle' ? item.color : 'transparent' }" />
        <span>{{ item.label }}</span>
      </div>
    </div>

    <!-- 节点悬浮提示 -->
    <div v-if="hoveredNode" class="node-tooltip" :style="tooltipStyle">
      {{ hoveredNode.label }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import TopoStereoRingThree from '@/components/electronic/TopoStereoRingThree.vue'
import {
  buildStarRingLayout,
  buildStarRingLegend,
  type StarRingNodeLayout,
  type TopoGraphEdge,
  type TopoGraphNode,
} from '@/utils/topoStarRingLayout'

/** 视图模式：平面星环 / 立体星环 */
export type StarRingViewMode = 'planar' | 'stereo'

const props = withDefaults(
  defineProps<{
    /** 视图模式 */
    viewMode: StarRingViewMode
    /** G6 节点数据 */
    nodes: TopoGraphNode[]
    /** G6 边数据 */
    edges: TopoGraphEdge[]
    /** 是否为通讯系列 */
    isComm?: boolean
    /** 阵地名称列表（最内虚线环） */
    positionLabels?: string[]
    /** 当前选中的节点 ID */
    selectedNodeId?: string | null
    /** 当前选中的链路 ID */
    selectedLinkId?: string | null
    /** 当前选中的接收站 ID */
    selectedReceiveId?: string | null
    /** 当前选中卫星 ID (sat-{norad}) */
    selectedSatId?: string | null
    /** 当前时刻活跃的节点 ID 集合 */
    activeNodeIds?: Set<string>
  }>(),
  {
    isComm: false,
    positionLabels: () => [],
    selectedNodeId: null,
    selectedLinkId: null,
    selectedReceiveId: null,
    selectedSatId: null,
    activeNodeIds: () => new Set(),
  }
)

const emit = defineEmits<{
  (e: 'node-click', node: TopoGraphNode): void
  (e: 'edge-click', linkId: string): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const stageWidth = ref(800)
const stageHeight = ref(600)
const layoutReady = ref(false)
const hoveredNodeId = ref<string | null>(null)

const legendItems = computed(() => buildStarRingLegend(props.isComm))

const layout = computed(() =>
  buildStarRingLayout(props.nodes, stageWidth.value, stageHeight.value, props.isComm, props.positionLabels)
)

const nodeMap = computed(() => new Map(layout.value.layoutNodes.map((n) => [n.id, n])))

const hoveredNode = computed(() => {
  if (!hoveredNodeId.value) return null
  return layout.value.layoutNodes.find((n) => n.id === hoveredNodeId.value) || null
})

const tooltipStyle = computed(() => {
  if (!hoveredNode.value) return {}
  return {
    left: `${(hoveredNode.value.x / stageWidth.value) * 100}%`,
    top: `${(hoveredNode.value.y / stageHeight.value) * 100}%`,
  }
})

/**
 * 判断节点是否处于选中/高亮状态
 * @param node 节点
 */
const isNodeFocused = (node: StarRingNodeLayout): boolean => {
  if (props.selectedLinkId) return false
  if (props.selectedReceiveId && props.selectedSatId) {
    return node.id === props.selectedReceiveId || node.id === props.selectedSatId
  }
  if (props.selectedNodeId) return node.id === props.selectedNodeId
  return false
}

/**
 * 判断节点是否处于当前时刻活跃状态
 * @param node 节点
 */
const isNodeActive = (node: StarRingNodeLayout): boolean => props.activeNodeIds?.has(node.id) ?? false

const nodeClass = (node: StarRingNodeLayout) => ({
  'ring-node--struck': !!node.struck,
  'ring-node--selected': isNodeFocused(node),
  'ring-node--active': isNodeActive(node),
  'ring-node--dimmed': shouldDimNode(node),
})

const shouldDimNode = (node: StarRingNodeLayout): boolean => {
  if (props.selectedLinkId) return true
  if (props.selectedReceiveId && props.selectedSatId) {
    return node.id !== props.selectedReceiveId && node.id !== props.selectedSatId
  }
  if (props.selectedNodeId) return node.id !== props.selectedNodeId
  return false
}

const nodeRadius = (node: StarRingNodeLayout) => {
  if (isNodeFocused(node) || isNodeActive(node)) return 7
  if (node.ringKey === 'sat') return 5.5
  return 5
}

const nodeFill = (node: StarRingNodeLayout) => {
  if (node.struck) return '#ff4d4f'
  if (isNodeActive(node)) return '#fb923c'
  switch (node.ringKey) {
    case 'relay':
      return '#facc15'
    case 'receive':
      return '#fb923c'
    case 'station':
      return '#3b82f6'
    case 'target':
      return '#1890ff'
    default:
      return '#ffffff'
  }
}

const nodeStroke = (node: StarRingNodeLayout) => {
  if (node.struck) return '#ff7875'
  if (isNodeFocused(node)) return '#00e1ff'
  return 'rgba(0, 225, 255, 0.5)'
}

const nodeStrokeWidth = (node: StarRingNodeLayout) => (isNodeFocused(node) ? 2.5 : 1.5)

const nodeActive = (node: StarRingNodeLayout) => isNodeActive(node) || isNodeFocused(node)

/** 可见链路及其坐标（平面星环） */
const visibleEdges = computed(() => {
  const map = nodeMap.value
  return props.edges
    .map((edge) => {
      const source = map.get(String(edge.source))
      const target = map.get(String(edge.target))
      if (!source || !target) return null
      const linkId = String(edge.linkId || '')
      const struck = !!edge.linkStruck
      const highlighted = props.selectedLinkId ? linkId === props.selectedLinkId : false
      const onPath =
        !props.selectedLinkId &&
        props.selectedReceiveId &&
        props.selectedSatId &&
        ((String(edge.source) === props.selectedSatId && String(edge.target) === props.selectedReceiveId) ||
          String(edge.source) === props.selectedReceiveId ||
          String(edge.target) === props.selectedReceiveId)
      const dimmed = props.selectedLinkId ? !highlighted : props.selectedReceiveId ? !onPath : false
      return {
        id: edge.id,
        linkId,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
        stroke: struck ? '#94a3b8' : highlighted || onPath ? '#00e1ff' : 'rgba(0, 225, 255, 0.45)',
        width: highlighted || onPath ? 2.5 : 1.5,
        dash: struck ? '5 4' : undefined,
        opacity: dimmed ? 0.2 : 1,
      }
    })
    .filter(Boolean) as Array<{
    id: string
    linkId: string
    x1: number
    y1: number
    x2: number
    y2: number
    stroke: string
    width: number
    dash?: string
    opacity: number
  }>
})

const showNodeLabel = (node: StarRingNodeLayout) =>
  isNodeFocused(node) || isNodeActive(node) || node.ringKey === 'sat' || node.ringKey === 'target'

/**
 * 同步容器尺寸（平面星环）
 */
const syncStageSize = () => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    stageWidth.value = rect.width
    stageHeight.value = rect.height
    layoutReady.value = true
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  syncStageSize()
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncStageSize())
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(
  () => [props.nodes, props.edges, props.viewMode],
  () => syncStageSize(),
  { deep: true }
)
</script>

<style lang="scss" scoped>
.star-ring-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 45%, #0d1a30 0%, #050811 70%);

  /* 立体模式下与 WebGL 画布的深海军蓝底色保持一致，避免切换时闪底 */
  &.mode-stereo {
    background: #13223c;
  }
}

.ring-hint {
  position: absolute;
  top: 10px;
  right: 200px;
  z-index: 5;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.85);
  pointer-events: none;
}

.ring-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.ring-edge {
  cursor: pointer;
  transition: opacity 0.2s;
}

.ring-node {
  cursor: pointer;

  &--dimmed {
    opacity: 0.35;
  }

  &--selected .node-label,
  &--active .node-label {
    fill: #00e1ff;
    font-weight: 600;
  }
}

.node-label {
  fill: #facc15;
  font-size: 10px;
  font-weight: 500;
  pointer-events: none;
}

.position-label {
  fill: #facc15;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* 图例 */
.ring-legend {
  position: absolute;
  top: 50%;
  right: 16px;
  transform: translateY(-50%);
  width: 168px;
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(8, 14, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.2);
  backdrop-filter: blur(6px);
  z-index: 10;

  &__title {
    font-size: 13px;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 10px;
  }

  &__preview {
    display: flex;
    justify-content: center;
    margin-bottom: 10px;
  }

  &__item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 6px;
    line-height: 1.3;
  }
}

.legend-rings-icon {
  position: relative;
  width: 48px;
  height: 48px;

  .lr {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(0, 225, 255, 0.35);
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);

    &--outer {
      width: 44px;
      height: 44px;
    }
    &--mid {
      width: 28px;
      height: 28px;
    }
    &--inner {
      width: 14px;
      height: 14px;
      border-style: dashed;
      border-color: rgba(250, 204, 21, 0.5);
    }
  }
}

.legend-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &--dashed-ring {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px dashed;
    background: transparent !important;
  }
}

.node-tooltip {
  position: absolute;
  transform: translate(-50%, -120%);
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(8, 14, 26, 0.92);
  border: 1px solid rgba(0, 225, 255, 0.3);
  color: #e2e8f0;
  font-size: 11px;
  pointer-events: none;
  z-index: 20;
}
</style>
