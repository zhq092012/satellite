<script setup lang="ts">
import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AiBarChartBlock, AiLineChartBlock, AiPieChartBlock } from '@/types/ai'

const props = defineProps<{
  /** 柱状图、折线图或饼图内容块 */
  block: AiBarChartBlock | AiLineChartBlock | AiPieChartBlock
}>()

/** 图表容器 */
const hostRef = ref<HTMLDivElement | null>(null)
/** 数据为空或 ECharts 抛错时显示的说明 */
const errorText = ref('')
/** ECharts 实例。销毁前必须 dispose，避免面板反复打开后残留 */
let chart: echarts.ECharts | null = null
/** 监听容器尺寸，面板展开或窗口变化时重绘 */
let observer: ResizeObserver | null = null

/**
 * 判断图表是否有可绘制的数据。空数组不初始化坐标系。
 *
 * @param block 图表内容块
 * @returns 是否有数据
 */
function hasChartData(block: AiBarChartBlock | AiLineChartBlock | AiPieChartBlock): boolean {
  if (block.chartType === 'pie') return block.data.items.length > 0
  return block.data.categories.length > 0 && block.data.series.some((series) => series.values.length > 0)
}

/**
 * 把内容块转成 ECharts 配置。柱状图和折线图共用类目轴。
 *
 * @param block 图表内容块
 * @returns ECharts 配置
 */
function buildOption(block: AiBarChartBlock | AiLineChartBlock | AiPieChartBlock): echarts.EChartsOption {
  if (block.chartType === 'pie') {
    return {
      backgroundColor: 'transparent',
      title: { text: block.title, left: 8, textStyle: { color: '#e2e8f0', fontSize: 14 } },
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: '62%',
          center: ['50%', '58%'],
          data: block.data.items.map((item) => ({ name: item.name, value: item.value })),
          label: { color: '#e2e8f0' },
        },
      ],
    }
  }

  block.data.series.forEach((series) => {
    if (series.values.length !== block.data.categories.length) {
      throw new Error(`图表「${block.title}」的序列「${series.name}」与类目数量不一致`)
    }
  })

  return {
    backgroundColor: 'transparent',
    title: { text: block.title, left: 8, textStyle: { color: '#e2e8f0', fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { top: 28, textStyle: { color: '#cbd5e1' } },
    grid: { left: 48, right: 16, top: 72, bottom: 56 },
    xAxis: {
      type: 'category',
      data: block.data.categories,
      axisLabel: { color: '#94a3b8', rotate: 30, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#94a3b8' },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.2)' } },
    },
    series: block.data.series.map((series) => ({
      name: series.name,
      type: block.chartType,
      data: series.values,
    })),
  }
}

/**
 * 按当前内容块绘制图表。容器还没挂上时直接返回，等 onMounted 再画。
 */
function renderChart() {
  const element = hostRef.value
  if (!element) return
  if (!hasChartData(props.block)) {
    errorText.value = '暂无图表数据'
    chart?.clear()
    return
  }
  try {
    if (!chart) chart = echarts.init(element)
    chart.setOption(buildOption(props.block), true)
    errorText.value = ''
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '图表渲染失败'
  }
}

onMounted(() => {
  renderChart()
  const element = hostRef.value
  if (!element) return
  observer = new ResizeObserver(() => {
    chart?.resize()
  })
  observer.observe(element)
})

/**
 * 监听图表内容块。deep 为 true，块内类目和序列变化也会触发。
 * 回调不返回清理函数。
 * 作用：内容块更新后重新渲染 ECharts。
 */
watch(
  () => props.block,
  () => {
    renderChart()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div class="ai-chart">
    <div ref="hostRef" class="ai-chart-host"></div>
    <div v-if="errorText" class="ai-chart-error">{{ errorText }}</div>
  </div>
</template>

<style scoped lang="scss">
.ai-chart {
  position: relative;
  width: 100%;
}

.ai-chart-host {
  width: 100%;
  height: 240px;
}

.ai-chart-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: #94a3b8;
  text-align: center;
  background: rgba(15, 23, 42, 0.72);
}
</style>
