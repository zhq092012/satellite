<template>
  <div class="battle-globe-timeline" v-if="taskStartMs && taskEndMs > taskStartMs">
    <div class="timeline-header">
      <span class="header-title">任务时间标尺</span>
      <span v-if="displayTimeMs" class="current-time-tag">
        {{ formatTimelineTime(displayTimeMs) }}
      </span>
    </div>

    <div class="ruler-panel" ref="trackRef" @click="handleTrackClick">
      <div class="ruler-scale">
        <div v-for="tick in rulerTicks" :key="tick.label" class="ruler-tick"
          :class="{ major: tick.major, ['align-' + tick.align]: true }" :style="{ left: tick.percent + '%' }">
          <span class="tick-line"></span>
          <span v-if="tick.major" class="tick-label">{{ tick.label }}</span>
        </div>
      </div>

      <div class="timeline-track">
        <div class="track-base"></div>
      </div>

      <div v-if="playheadPercent != null" class="orbit-playhead" :style="{ left: playheadPercent + '%' }">
        <span class="orbit-playhead-line"></span>
        <span class="orbit-playhead-dot"></span>
      </div>

      <div class="timeline-scale">
        <span>{{ formatTimelineTime(taskStartMs) }}</span>
        <span>{{ formatTimelineTime(taskEndMs) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTimelineTime, msToRatio } from '@/utils/satelliteTimelineMarkers'

/**
 * 整体态势任务时间轴（纯展示组件，无播放与矩阵业务逻辑）。
 */
const props = defineProps<{
  /** 任务开始时间字符串 */
  taskStart: string
  /** 任务结束时间字符串 */
  taskEnd: string
  /** 当前时刻（毫秒），用于游标展示 */
  currentTimeMs?: number | null
}>()

/** 点击时间轴时通知父组件更新当前时刻 */
const emit = defineEmits<{
  (e: 'time-change', ms: number): void
}>()

/** 时间轴轨道 DOM 引用 */
const trackRef = ref<HTMLElement | null>(null)

/**
 * 将任务时间字符串解析为毫秒时间戳。
 *
 * @param value 时间字符串
 * @returns 毫秒时间戳
 */
const parseTaskTime = (value: string): number => {
  if (!value) return 0
  const ts = new Date(value.replace(/-/g, '/')).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

/** 任务开始时间（毫秒） */
const taskStartMs = computed(() => parseTaskTime(props.taskStart))
/** 任务结束时间（毫秒） */
const taskEndMs = computed(() => parseTaskTime(props.taskEnd))

/** 展示用当前时刻，默认落在任务开始 */
const displayTimeMs = computed(() => {
  if (props.currentTimeMs != null && props.currentTimeMs > 0) return props.currentTimeMs
  return taskStartMs.value
})

/** 标尺两端预留百分比 */
const RULER_EDGE_INSET = 2.8

/**
 * 将相对比例映射为百分比位置。
 *
 * @param ratio 0-1 比例
 * @returns 百分比
 */
const mapPositionPercent = (ratio: number): number =>
  RULER_EDGE_INSET + ratio * (100 - RULER_EDGE_INSET * 2)

/**
 * 毫秒转时间轴百分比。
 *
 * @param ms 毫秒时间戳
 * @returns 百分比
 */
const msToPercent = (ms: number): number =>
  mapPositionPercent(msToRatio(ms, taskStartMs.value, taskEndMs.value))

/**
 * 根据百分比计算标记对齐方式。
 *
 * @param percent 百分比位置
 */
const getMarkerAlign = (percent: number): 'start' | 'center' | 'end' => {
  if (percent <= RULER_EDGE_INSET + 1) return 'start'
  if (percent >= 100 - RULER_EDGE_INSET - 1) return 'end'
  return 'center'
}

/** 游标百分比位置 */
const playheadPercent = computed<number | null>(() => {
  if (!displayTimeMs.value || !taskStartMs.value || !taskEndMs.value) return null
  return msToPercent(displayTimeMs.value)
})

/** 时间标尺刻度 */
const rulerTicks = computed(() => {
  const ticks: { percent: number; label: string; major: boolean; align: 'start' | 'center' | 'end' }[] = []
  const start = taskStartMs.value
  const end = taskEndMs.value
  const span = end - start
  if (span <= 0) return ticks

  const hourMs = 3600 * 1000
  const step = span > 36 * hourMs ? 6 * hourMs : span > 12 * hourMs ? 3 * hourMs : hourMs

  for (let t = start; t <= end; t += step) {
    const d = new Date(t)
    const pad = (n: number) => String(n).padStart(2, '0')
    const label = `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:00`
    const percent = msToPercent(t)
    ticks.push({ percent, label, major: true, align: getMarkerAlign(percent) })
  }

  return ticks
})

/**
 * 点击轨道跳转时刻（仅更新游标，不触发播放）。
 *
 * @param event 鼠标事件
 */
const handleTrackClick = (event: MouseEvent) => {
  if (!trackRef.value || !taskStartMs.value || !taskEndMs.value) return
  const rect = trackRef.value.getBoundingClientRect()
  if (rect.width <= 0) return
  const clickX = event.clientX - rect.left
  const leftInset = (RULER_EDGE_INSET / 100) * rect.width
  const usableWidth = rect.width - 2 * leftInset
  const ratio = Math.max(0, Math.min(1, (clickX - leftInset) / usableWidth))
  const targetMs = Math.round(taskStartMs.value + ratio * (taskEndMs.value - taskStartMs.value))
  emit('time-change', targetMs)
}
</script>

<style scoped lang="scss">
.battle-globe-timeline {
  position: relative;
  width: 100%;
  padding: 5px 14px 4px 14px;
  background: transparent;
  box-sizing: border-box;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
  gap: 8px;

  .header-title {
    font-size: 12px;
    font-weight: 600;
    color: #40f2ff;
    letter-spacing: 0.3px;
    line-height: 18px;
  }

  .current-time-tag {
    font-size: 11px;
    font-weight: 600;
    color: #7dd3fc;
    font-family: Consolas, 'Courier New', monospace;
  }
}

.ruler-panel {
  position: relative;
  height: 52px;
  cursor: pointer;
  user-select: none;
}

.ruler-scale {
  position: absolute;
  inset: 0 0 18px;
  pointer-events: none;
}

.ruler-tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;

  &.align-start {
    transform: translateX(0);
  }

  &.align-end {
    transform: translateX(-100%);
  }

  .tick-line {
    width: 1px;
    height: 8px;
    background: rgba(125, 211, 252, 0.45);
  }

  &.major .tick-line {
    height: 12px;
    background: rgba(64, 242, 255, 0.75);
  }

  .tick-label {
    margin-top: 2px;
    font-size: 9px;
    color: #64748b;
    white-space: nowrap;
  }
}

.timeline-track {
  position: absolute;
  left: 0;
  right: 0;
  top: 22px;
  height: 8px;

  .track-base {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, rgba(0, 225, 255, 0.08), rgba(0, 225, 255, 0.22));
    border: 1px solid rgba(0, 225, 255, 0.25);
  }
}

.orbit-playhead {
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;

  .orbit-playhead-line {
    display: block;
    width: 2px;
    height: 24px;
    margin: 0 auto;
    background: #fbbf24;
    box-shadow: 0 0 6px rgba(251, 191, 36, 0.65);
  }

  .orbit-playhead-dot {
    display: block;
    width: 8px;
    height: 8px;
    margin: -2px auto 0;
    border-radius: 50%;
    background: #fbbf24;
    box-shadow: 0 0 8px rgba(251, 191, 36, 0.8);
  }
}

.timeline-scale {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #64748b;
  font-family: Consolas, 'Courier New', monospace;
}
</style>
