<template>
  <el-dialog
    :model-value="modelValue"
    title="链路延迟"
    width="920px"
    append-to-body
    destroy-on-close
    align-center
    class="battle-sat-chart-dialog battle-sat-link-dialog"
    modal-class="battle-sat-chart-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)"
    @opened="handleDialogOpened">
    <p v-if="subtitle" class="battle-sat-chart-subtitle">{{ subtitle }}</p>
    <div ref="stageRef" class="battle-sat-link-stage">
      <div class="battle-sat-link-layer-labels">
        <div
          v-for="item in layerLabels"
          :key="item.key"
          class="battle-sat-link-layer-label"
          :class="item.className"
          :style="{ top: item.top }">
          <span class="layer-icon">{{ item.icon }}</span>
          <span class="layer-title">{{ item.title }}</span>
        </div>
      </div>
      <div ref="g6ContainerRef" class="battle-sat-link-g6" />
    </div>
    <p v-if="emptyHint" class="battle-sat-chart-empty">{{ emptyHint }}</p>
    <template #footer>
      <el-button class="battle-sat-chart-close-btn" @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import G6, { type Graph } from '@antv/g6'
import type { MatrixResult } from '@/api/electronic'
import { resolveTaskEndMs } from '@/utils/satelliteFullChainAnalysis'
import {
  RECON_LAYER_LABEL_ITEMS,
  RECON_TOPO_GRAPH_DEFAULT_EDGE,
  buildFocusedReconGraphData,
  formatReconLayerTop,
} from '@/utils/battleSatelliteCharts/reconTopologyG6'


const props = withDefaults(
  defineProps<{
    /** 弹窗是否可见 */
    modelValue: boolean
    /** 系列矩阵 */
    matrix?: MatrixResult | null
    /** 目标卫星 NORAD */
    norad?: number | null
    /** 任务结束时间字符串 */
    taskEnd?: string
    /** 副标题 */
    subtitle?: string
  }>(),
  {
    matrix: null,
    norad: null,
    taskEnd: '',
    subtitle: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const stageRef = ref<HTMLDivElement | null>(null)
const g6ContainerRef = ref<HTMLDivElement | null>(null)
const stageHeight = ref(400)
const emptyHint = ref('')

let graph: Graph | null = null

/** 任务结束毫秒 */
const taskEndMs = computed(() => resolveTaskEndMs(props.taskEnd))

/** 左侧层标签（随舞台高度更新 top） */
const layerLabels = computed(() =>
  RECON_LAYER_LABEL_ITEMS.map((item) => ({
    ...item,
    top: formatReconLayerTop(item.layer, stageHeight.value),
  }))
)

/**
 * 读取舞台尺寸。
 */
const readStageSize = () => {
  const el = stageRef.value || g6ContainerRef.value
  return {
    width: el?.clientWidth ?? 0,
    height: el?.clientHeight ?? 0,
  }
}

/**
 * 销毁 G6 实例。
 */
const destroyGraph = () => {
  if (graph && !graph.get('destroyed')) {
    graph.destroy()
  }
  graph = null
}

/**
 * 初始化或刷新 G6 拓扑。
 *
 * @returns 是否成功
 */
const initOrUpdateGraph = (): boolean => {
  if (!g6ContainerRef.value || !props.matrix || props.norad == null) return false
  const { width, height } = readStageSize()
  if (width <= 0 || height <= 0) return false
  if (height > 0) stageHeight.value = height

  const data = buildFocusedReconGraphData({
    matrix: props.matrix,
    norad: props.norad,
    containerWidth: width,
    stageHeight: stageHeight.value,
    taskEndMs: taskEndMs.value,
  })

  if (!data.nodes.length) {
    emptyHint.value = '暂无该卫星的传输链路数据'
    destroyGraph()
    return true
  }
  emptyHint.value = ''

  if (!graph || graph.get('destroyed')) {
    graph = new G6.Graph({
      container: g6ContainerRef.value,
      width,
      height,
      fitView: false,
      modes: { default: [] },
      defaultNode: {
        type: 'circle',
        style: { fill: '#092638', stroke: '#00e1ff', lineWidth: 2 },
      },
      defaultEdge: RECON_TOPO_GRAPH_DEFAULT_EDGE,
    })
    graph.data(data)
    graph.render()
  } else {
    graph.changeSize(width, height)
    graph.changeData(data)
    graph.render()
  }
  return true
}

/**
 * 弹窗打开后渲染拓扑。
 */
const handleDialogOpened = () => {
  nextTick(() => {
    if (!initOrUpdateGraph()) {
      window.setTimeout(() => initOrUpdateGraph(), 80)
    }
  })
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      destroyGraph()
      emptyHint.value = ''
    }
  }
)

onUnmounted(() => {
  destroyGraph()
})
</script>

<style scoped lang="scss">
.battle-sat-chart-subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  color: #94a3b8;
}

.battle-sat-link-stage {
  position: relative;
  width: 100%;
  height: 420px;
  min-height: 320px;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(6, 12, 22, 0.65);
  border: 1px solid rgba(103, 232, 249, 0.12);
}

.battle-sat-link-layer-labels {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 120px;
  z-index: 5;
  pointer-events: none;
}

.battle-sat-link-layer-label {
  position: absolute;
  left: 6px;
  right: 4px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #94a3b8;
}

.layer-icon {
  flex-shrink: 0;
}

.layer-title {
  line-height: 1.3;
  text-align: left;
}

.battle-sat-link-g6 {
  position: absolute;
  inset: 0;
}

.battle-sat-chart-empty {
  margin: 8px 0 0;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.battle-sat-chart-close-btn {
  min-width: 88px;
}
</style>

<style lang="scss">
.atlas-app-dialog.battle-sat-link-dialog,
.battle-sat-link-dialog .atlas-app-dialog {
  --el-dialog-bg-color: rgba(8, 15, 26, 0.96);
  border: 1px solid rgba(0, 225, 255, 0.25);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
}

.battle-sat-link-dialog .atlas-app-dialog__title {
  color: #e2e8f0;
  font-weight: 700;
}
</style>
