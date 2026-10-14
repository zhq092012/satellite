<template>
  <el-dialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="920px"
    append-to-body
    destroy-on-close
    align-center
    class="battle-sat-chart-dialog battle-sat-link-dialog"
    modal-class="battle-sat-chart-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)"
    @opened="handleDialogOpened">
    <p v-if="subtitle" class="battle-sat-chart-subtitle">{{ subtitle }}</p>
    <el-table
      v-if="threatTableRows.length"
      :data="threatTableRows"
      size="small"
      class="battle-sat-threat-table"
      empty-text="暂无威胁度数据">
      <el-table-column label="卫星名称" prop="name" min-width="140" show-overflow-tooltip />
      <el-table-column label="动态威胁度" min-width="110" align="right">
        <template #default="{ row }">
          {{ formatThreatScore(row.dynamicThreat) }}
        </template>
      </el-table-column>
      <el-table-column label="链路闭环耗时" min-width="120" align="right">
        <template #default="{ row }">
          {{ formatClosedLoopTime(row.linkClosedLoopTime) }}
        </template>
      </el-table-column>
      <el-table-column label="覆盖率" min-width="100" align="right">
        <template #default="{ row }">
          {{ formatCoverage(row.coverPercent) }}
        </template>
      </el-table-column>
    </el-table>
    <p v-if="threatTableRows.length" class="battle-sat-link-graph-title">三层链路图谱</p>
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
import { formatSatelliteThreat } from '@/utils/buildSatelliteAnalysisTable'
import { formatCoveragePercent } from '@/utils/zhchPlanDisplay'
import {
  RECON_LAYER_LABEL_ITEMS,
  RECON_TOPO_GRAPH_DEFAULT_EDGE,
  buildFocusedReconGraphData,
  formatReconLayerTop,
} from '@/utils/battleSatelliteCharts/reconTopologyG6'

/**
 * 弹窗顶部指标表的一行，字段来自 `getTargetsThreatLevel`。
 */
export interface LinkDelayThreatMetrics {
  /** 卫星名称 */
  name: string
  /** 动态威胁度 */
  dynamicThreat: number
  /** 链路闭环耗时（接口原值） */
  linkClosedLoopTime: number
  /** 覆盖率 */
  coverPercent: number
}

const props = withDefaults(
  defineProps<{
    /** 弹窗是否可见 */
    modelValue: boolean
    /** 系列矩阵，用于绘制该星三层链路 */
    matrix?: MatrixResult | null
    /** 目标卫星 NORAD */
    norad?: number | null
    /** 任务结束时间字符串 */
    taskEnd?: string
    /** 副标题 */
    subtitle?: string
    /** 弹窗标题 */
    dialogTitle?: string
    /** 当前卫星的威胁度指标；有值时在链路图上方展示表格 */
    threatMetrics?: LinkDelayThreatMetrics | null
  }>(),
  {
    matrix: null,
    norad: null,
    taskEnd: '',
    subtitle: '',
    dialogTitle: '链路延迟',
    threatMetrics: null,
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

/** 指标表数据：仅当前点击的卫星一行 */
const threatTableRows = computed(() => (props.threatMetrics ? [props.threatMetrics] : []))

/** 动态威胁度展示，与右侧列表同一格式 */
const formatThreatScore = formatSatelliteThreat

/** 覆盖率展示 */
const formatCoverage = formatCoveragePercent

/**
 * 链路闭环耗时按接口原值展示。字段未声明单位，不换算、不补单位。
 *
 * @param value 接口 `linkClosedLoopTime`
 * @returns 数值文本；非有限数时返回 `--`
 */
const formatClosedLoopTime = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return String(value)
}

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
  if (!g6ContainerRef.value) return false
  if (!props.matrix || props.norad == null) {
    emptyHint.value = '暂无该卫星的传输链路数据'
    destroyGraph()
    return true
  }
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

.battle-sat-link-graph-title {
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: #7dd3fc;
}

.battle-sat-threat-table {
  width: 100%;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.08);
  --atlas-app-text-color-regular: #cbd5e1;
  --atlas-app-text-color-primary: #e2efff;
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
  }

  :deep(td.atlas-app-table__cell) {
    font-size: 12px;
    color: #e2efff;
    background: transparent !important;
  }
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
