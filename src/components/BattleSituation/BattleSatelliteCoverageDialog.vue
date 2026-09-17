<template>
  <el-dialog
    :model-value="modelValue"
    title="覆盖率分析"
    width="920px"
    append-to-body
    destroy-on-close
    align-center
    class="battle-sat-chart-dialog battle-sat-coverage-dialog"
    modal-class="battle-sat-chart-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)"
    @opened="handleDialogOpened">
    <p v-if="subtitle" class="battle-sat-chart-subtitle">{{ subtitle }}</p>
    <div ref="heatmapRef" class="battle-sat-coverage-heatmap" />
    <p v-if="emptyHint" class="battle-sat-chart-empty">{{ emptyHint }}</p>
    <template #footer>
      <el-button class="battle-sat-chart-close-btn" @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { MatrixResult } from '@/api/electronic'
import {
  STARLINK_COVERAGE_BRACKETS,
  buildSingleSatelliteCoverageHeatModel,
  formatHeatmapCoverage,
  parseTimeToMs,
  type SingleSatCoverageHeatCell,
} from '@/utils/battleSatelliteCharts/coverageHeatmap'

const props = withDefaults(
  defineProps<{
    /** 弹窗是否可见 */
    modelValue: boolean
    /** 系列矩阵 */
    matrix?: MatrixResult | null
    /** 目标卫星 NORAD */
    norad?: number | null
    /** 任务开始时间字符串 */
    taskBegin?: string
    /** 任务结束时间字符串 */
    taskEnd?: string
    /** 副标题 */
    subtitle?: string
  }>(),
  {
    matrix: null,
    norad: null,
    taskBegin: '',
    taskEnd: '',
    subtitle: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const heatmapRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

/** 无热力数据时的提示 */
const emptyHint = ref('')

/** 当前热力图模型 */
const heatModel = computed(() => {
  const empty = {
    cells: [] as SingleSatCoverageHeatCell[],
    timeLabels: [] as string[],
    strikeSplitLabel: null as string | null,
    satelliteName: '',
    norad: 0,
    beforeCoverage: null as number | null,
    afterCoverage: null as number | null,
  }
  if (!props.matrix || props.norad == null) return empty
  const taskStartMs = parseTimeToMs(props.taskBegin)
  const taskEndMs = parseTimeToMs(props.taskEnd)
  return buildSingleSatelliteCoverageHeatModel(props.matrix, props.norad, taskStartMs, taskEndMs)
})

/**
 * 释放 ECharts 实例。
 */
const disposeChart = () => {
  if (chart) {
    chart.dispose()
    chart = null
  }
}

/**
 * 将热力图模型绘制到容器。
 *
 * @returns 是否成功绘制
 */
const renderHeatmap = (): boolean => {
  const container = heatmapRef.value
  if (!container?.clientWidth || !container?.clientHeight) return false

  const boundDom = chart?.getDom?.()
  if (chart && boundDom !== container) {
    disposeChart()
  }
  if (!chart) {
    chart = echarts.init(container)
  }

  const model = heatModel.value
  if (!model.cells.length) {
    emptyHint.value = '暂无该卫星的覆盖率时间片数据'
    chart.clear()
    return true
  }
  emptyHint.value = ''

  const heatmapData = model.cells.map((cell) => [cell.timeLabel, cell.bracket, cell.weight] as const)
  const lastTimeLabel = model.timeLabels[model.timeLabels.length - 1]
  const firstTimeLabel = model.timeLabels[0]
  const { satelliteName, norad, beforeCoverage, afterCoverage, strikeSplitLabel } = model

  chart.setOption(
    {
      title: {
        text: '',
        subtext: strikeSplitLabel
          ? '色块在过境/打击后从「打击前覆盖率」切到「打击后覆盖率」；橙虚线为主要切换时刻'
          : '色块表示该时间片内卫星所处覆盖率梯队；悬停可看打击前后覆盖率',
        left: 16,
        top: 4,
        subtextStyle: { color: '#94a3b8', fontSize: 10 },
      },
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: 'rgba(8, 15, 26, 0.96)',
        borderColor: 'rgba(234, 179, 8, 0.55)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: { data?: readonly [string, string, number] }) => {
          const point = params.data
          if (!point) return '暂无覆盖率数据'
          const [timeLabel, bracket] = point
          return [
            `时间片：${timeLabel}`,
            `覆盖率梯队：${bracket}`,
            `${satelliteName} (${norad})`,
            `打击前 ${formatHeatmapCoverage(beforeCoverage)} → 打击后 ${formatHeatmapCoverage(afterCoverage)}`,
          ].join('<br>')
        },
      },
      grid: { left: 58, right: 46, top: 52, bottom: 48, containLabel: false },
      xAxis: {
        type: 'category',
        data: model.timeLabels,
        axisLine: { lineStyle: { color: 'rgba(103, 232, 249, 0.35)' } },
        splitArea: { show: true, areaStyle: { color: ['rgba(14, 28, 48, 0.46)', 'rgba(8, 15, 26, 0.46)'] } },
      },
      yAxis: {
        type: 'category',
        data: STARLINK_COVERAGE_BRACKETS,
        axisLine: { lineStyle: { color: 'rgba(103, 232, 249, 0.35)' } },
        axisLabel: { color: '#94a3b8', fontSize: 9, interval: 0 },
        splitArea: { show: true, areaStyle: { color: ['rgba(14, 28, 48, 0.46)', 'rgba(8, 15, 26, 0.46)'] } },
      },
      visualMap: {
        show: true,
        type: 'continuous',
        min: 0,
        max: 1,
        dimension: 2,
        orient: 'vertical',
        right: 6,
        top: 'middle',
        itemWidth: 8,
        itemHeight: 88,
        text: ['有', '无'],
        textStyle: { color: '#94a3b8', fontSize: 10 },
        inRange: { color: ['#102a43', '#1890ff', '#52c41a', '#faad14', '#ff4d4f'] },
      },
      series: [
        {
          type: 'heatmap',
          data: heatmapData,
          label: { show: false },
          itemStyle: { borderColor: 'rgba(8, 15, 26, 0.9)', borderWidth: 1 },
          markLine: strikeSplitLabel
            ? {
                silent: true,
                symbol: 'none',
                animation: false,
                lineStyle: { color: '#fb923c', width: 2, type: 'dashed' },
                data: [{ xAxis: strikeSplitLabel }],
              }
            : undefined,
          markArea:
            strikeSplitLabel && firstTimeLabel && lastTimeLabel
              ? {
                  silent: true,
                  data: [
                    [
                      { xAxis: firstTimeLabel, itemStyle: { color: 'rgba(34, 197, 94, 0.08)' } },
                      { xAxis: strikeSplitLabel },
                    ],
                    [
                      { xAxis: strikeSplitLabel, itemStyle: { color: 'rgba(249, 115, 22, 0.10)' } },
                      { xAxis: lastTimeLabel },
                    ],
                  ],
                }
              : undefined,
        },
      ],
    },
    true
  )
  chart.resize()
  return true
}

/**
 * 弹窗打开后初始化图表（等待 DOM 布局）。
 */
const handleDialogOpened = () => {
  nextTick(() => {
    if (!renderHeatmap()) {
      window.setTimeout(() => renderHeatmap(), 80)
    }
  })
}

watch(
  () => [props.modelValue, props.norad, props.matrix] as const,
  ([visible]) => {
    if (!visible) {
      disposeChart()
      emptyHint.value = ''
    }
  }
)

onUnmounted(() => {
  disposeChart()
})
</script>

<style scoped lang="scss">
.battle-sat-chart-subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  color: #94a3b8;
}

.battle-sat-coverage-heatmap {
  width: 100%;
  height: 420px;
  min-height: 320px;
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
.battle-sat-chart-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.battle-sat-chart-dialog-modal {
  backdrop-filter: blur(4px);
}

.atlas-app-dialog.battle-sat-coverage-dialog,
.battle-sat-coverage-dialog .atlas-app-dialog {
  --el-dialog-bg-color: rgba(8, 15, 26, 0.96);
  border: 1px solid rgba(0, 225, 255, 0.25);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
}

.battle-sat-coverage-dialog .atlas-app-dialog__title {
  color: #e2e8f0;
  font-weight: 700;
}
</style>
