<template>
  <section class="camp-panel" :class="themeClass">
    <div class="camp-panel__header">
      <span class="camp-panel__name">{{ title }}</span>
      <span class="camp-panel__badge">{{ totalLabel }}</span>
      <span class="camp-panel__badge">总时长：{{ durationText }}分钟</span>
    </div>

    <div class="camp-panel__summary">
      <div class="camp-ring" :style="ringStyle">
        <div class="camp-ring__inner">
          <span class="camp-ring__label">总计</span>
          <span class="camp-ring__value">{{ total }}</span>
        </div>
      </div>
      <div class="camp-stats">
        <div v-for="item in summaryRows" :key="item.name" class="camp-stats__item">
          <span class="camp-stats__label">{{ item.name }}</span>
          <span class="camp-stats__value">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <div class="camp-tabs">
      <button class="camp-tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">统计数据</button>
      <button
        class="camp-tab"
        :class="{ active: activeTab === 'focus' }"
        @click="activeTab = 'focus'"
        v-show="campKey === 'red'"
      >
        关注卫星
      </button>
    </div>

    <div class="camp-tab-content" v-show="activeTab === 'stats'">
      <div class="camp-summary-area">
        <div ref="satelliteChartRef" class="chart-box chart-box--bar"></div>
        <div ref="weaponChartRef" class="chart-box chart-box--pie"></div>
      </div>
    </div>
    <div class="camp-tab-content" v-show="activeTab === 'focus'">
      <div class="focus-list">
        <div v-if="focusList.length === 0" class="empty-text">暂无数据</div>
        <div
          v-for="(sat, index) in focusList"
          :key="`${sat.norad_id}-${index}`"
          class="satellite-details"
          @click="$emit('focus-satellite', { norad_id: sat.norad_id })"
        >
          <span class="full-row sat-name">
            <strong>{{ sat.name_en }}</strong>
          </span>
          <span class="full-row">
            <span class="mark-label"><strong>综合评分（威胁度 * 可打击度）</strong></span>
            <span class="score">{{ sat.overallScore }}</span>
          </span>
          <span>
            <img
              :src="getImgServerPath(sat.img)"
              alt=""
              class="satellite-image"
              @error="
                (e) => {
                  const t = e.target as any
                  if (t && t['src'] !== satelliteFallback) t['src'] = satelliteFallback
                }
              "
            />
          </span>
          <span>
            <div>
              <strong>编号：</strong> <span>{{ sat.norad_id }}</span>
            </div>
            <div>
              <strong>国家：</strong> <span>{{ sat.country }}</span>
            </div>
            <div>
              <strong>类型：</strong> <span>{{ sat.sat_type }}</span>
            </div>
            <!-- <div>
              <strong>武器评分: </strong> <span>{{ sat.weapon_score }}</span>
            </div>
            <div>
              <strong>信息评分: </strong> <span>{{ sat.information_score }}</span>
            </div> -->
            <div>
              <strong>威胁度：</strong> <span>{{ sat.threat_score.toFixed(3) }}</span>
            </div>
            <div>
              <strong>可打击度：</strong> <span>{{ sat.kedaji_score.toFixed(3) }}</span>
            </div>
          </span>
          <span class="score-row"> </span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { getImgServerPath } from '@/utils/func/funcs'
import satelliteFallback from '@/assets/img/satellite.png'
import type { SatelliteStrike } from '@/types/dashboard'

type SummaryRow = {
  name: string
  value: string
}

type FocusSatellite = SatelliteStrike

const props = defineProps<{
  campKey: 'red' | 'blue'
  title: string
  theme: 'is-red' | 'is-blue'
  total: number
  totalLabel: string
  durationText: string
  summaryRows: SummaryRow[]
  ringStyle: Record<string, string>
  focusList: FocusSatellite[]
  satelliteRows: Array<{ name: string; value: number }>
  weaponRows: Array<{ name: string; value: number }>
}>()

defineEmits<{
  (e: 'focus-satellite', payload: { norad_id: string }): void
}>()

const activeTab = ref<'stats' | 'focus'>('stats')
const themeClass = computed(() => props.theme)

const satelliteChartRef = ref<HTMLDivElement | null>(null)
const weaponChartRef = ref<HTMLDivElement | null>(null)

let satelliteChart: echarts.ECharts | null = null
let weaponChart: echarts.ECharts | null = null

const disposeChart = (chart: echarts.ECharts | null) => {
  if (chart && !chart.isDisposed()) {
    chart.dispose()
  }
}

const renderCharts = async () => {
  await nextTick()
  if (!satelliteChartRef.value || !weaponChartRef.value) return

  disposeChart(satelliteChart)
  disposeChart(weaponChart)

  satelliteChart = echarts.init(satelliteChartRef.value)
  satelliteChart.setOption({
    title: {
      text: '卫星统计',
      left: 'center',
      top: 8,
      textStyle: { color: '#ffffff', fontSize: 14, fontWeight: 700 },
    },
    /* leave extra top space so title won't overlap chart area */
    grid: { left: 22, right: 10, top: 60, bottom: 24, containLabel: true },
    xAxis: {
      type: 'category',
      data: props.satelliteRows.map((item) => item.name),
      axisLabel: { color: '#cbd5e6', interval: 0, rotate: 18 },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.18)' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#cbd5e6' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
    },
    series: [
      {
        type: 'bar',
        data: props.satelliteRows.map((item) => item.value),
        barWidth: '42%',
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: props.theme === 'is-red' ? '#ff8f8f' : '#75c3ff' },
            { offset: 1, color: props.theme === 'is-red' ? '#ff4d4f' : '#2ca6ff' },
          ]),
        },
      },
    ],
  })

  weaponChart = echarts.init(weaponChartRef.value)
  weaponChart.setOption({
    title: {
      text: '武器评分分布',
      left: 'center',
      top: 8,
      textStyle: { color: '#ffffff', fontSize: 14, fontWeight: 700 },
    },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        /* move pie a bit down and slightly reduce size so title doesn't overlap */
        radius: ['32%', '60%'],
        center: ['50%', '58%'],
        avoidLabelOverlap: true,
        label: { color: '#e4ebf5', formatter: '{b}\n{d}%' },
        labelLine: { lineStyle: { color: 'rgba(255,255,255,0.35)' } },
        data: props.weaponRows.map((item) => ({ name: item.name, value: item.value })),
        color:
          props.theme === 'is-red'
            ? ['#ff5a5f', '#ff8f8f', '#ffb0b0', '#ffd2d2', '#ffe8e8']
            : ['#2ca6ff', '#5fb8ff', '#8dccff', '#b7ddff', '#d9edff'],
      },
    ],
  })
}

watch(
  () => [props.satelliteRows, props.weaponRows],
  () => {
    void renderCharts()
  },
  { deep: true }
)

onMounted(() => {
  void renderCharts()
})

onBeforeUnmount(() => {
  disposeChart(satelliteChart)
  disposeChart(weaponChart)
})
</script>

<style scoped lang="scss">
.camp-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  height: 100%;
  max-height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(10, 16, 24, 0.94) 0%, rgba(8, 14, 22, 0.88) 100%);
  box-shadow: 0 16px 30px rgba(0, 0, 0, 0.35);
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable;

  &.is-red {
    .camp-panel__header,
    .camp-collapse__title,
    .camp-stats__value {
      color: #ffb0b0;
    }

    .camp-panel__badge {
      background: rgba(255, 77, 79, 0.18);
      color: #ffd1d1;
    }
  }

  &.is-blue {
    .camp-panel__header,
    .camp-collapse__title,
    .camp-stats__value {
      color: #b2dcff;
    }

    .camp-panel__badge {
      background: rgba(42, 166, 255, 0.18);
      color: #d1ebff;
    }
  }
}

.camp-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
}

.camp-panel__name {
  flex: 1;
  text-align: left;
}

.camp-panel__badge {
  min-width: 62px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  text-align: center;
}

.camp-panel__summary {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 10px;
  align-items: center;
}

.camp-ring {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  padding: 8px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
}

.camp-ring__inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: rgba(8, 12, 18, 0.98);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-align: center;
  color: #fff;
}

.camp-ring__label {
  font-size: 12px;
  color: #c9d6e9;
}

.camp-ring__value {
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
}

.camp-stats {
  display: grid;
  gap: 6px;
}

.camp-stats__item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.camp-stats__label {
  color: #aeb6c2;
  font-size: 12px;
}

.camp-stats__value {
  font-size: 14px;
  font-weight: 700;
}

.camp-collapse {
  border: 0;
  flex: 1;
  min-height: 0;
}

.camp-collapse__title {
  font-size: 13px;
  font-weight: 700;
}

.chart-box {
  width: 100%;
  min-height: 250px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
}

.chart-box--pie {
  min-height: 250px;
}

.focus-list {
  padding-right: 4px;
}

.satellite-details {
  display: grid;
  grid-template-columns: 0.8fr 1fr;
  gap: 6px;
  margin: 8px 0;
  padding: 8px;
  width: 100%;
  box-sizing: border-box;
  justify-items: start;
  color: #ccc;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  cursor: pointer;

  > * {
    min-width: 0;
    overflow-wrap: break-word;
    align-self: start;
    text-align: left;
  }
}

.full-row {
  grid-column: 1 / -1;
  display: flex;
  color: cyan;
  .mark-label {
    color: #7f8996;
  }

  .score {
    color: yellow;
    font-size: 14px;
    font-weight: bold;
  }
}

.satellite-image {
  height: 120px;
  width: 120px;
  object-fit: cover;
  border-radius: 6px;
}

/* Custom 3D Tabs */
.camp-tabs {
  display: inline-flex;
  gap: 8px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 12px;
  align-items: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 10px 30px rgba(0, 0, 0, 0.45);
}

.camp-tab {
  position: relative;
  border: 0;
  padding: 8px 14px;
  background: linear-gradient(180deg, #585858, #a7a7a7);
  color: #ececec;
  border-radius: 9px;
  cursor: pointer;
  font-weight: 700;
  box-shadow:
    0 6px 10px rgba(0, 0, 0, 0.45),
    0 1px 0 rgba(255, 255, 255, 0.02) inset;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
  transform: translateY(0);
  min-width: 84px;
  text-align: center;
}

.camp-tab::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  opacity: 0.06;
  pointer-events: none;
}

.camp-tab::after {
  content: '';
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: -6px;
  height: 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.5);
  filter: blur(6px);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.camp-tab:hover {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.5);
}

.camp-tab.active {
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.6);
  color: #fff;
}

.camp-panel.is-red .camp-tab.active {
  background: linear-gradient(180deg, #ff7f87, #ff6d70);
  border-color: rgba(255, 77, 79, 0.18);
}

.camp-panel.is-blue .camp-tab.active {
  background: linear-gradient(180deg, #7fcfff, #56b9ff);
  border-color: rgba(42, 166, 255, 0.18);
}

.camp-tab.active::after {
  opacity: 1;
}

.camp-tab.active::before {
  opacity: 0.12;
}

.empty-text {
  color: #7f8996;
  font-size: 12px;
  padding: 6px 2px;
}
</style>
