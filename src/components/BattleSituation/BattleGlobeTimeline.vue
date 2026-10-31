<template>
  <div class="battle-globe-timeline" v-if="taskStartMs && taskEndMs > taskStartMs">
    <div class="timeline-header">
      <div class="header-left">
        <span class="header-title">时间轴</span>
        <div class="timeline-controls">
          <button type="button" class="control-btn" :title="isPlaying ? '暂停' : '播放'" @click="emit('toggle-play')">
            <span class="control-btn-icon">{{ isPlaying ? '⏸' : '▶' }}</span>
            <span>{{ isPlaying ? '暂停' : '播放' }}</span>
          </button>
          <div class="speed-group">
            <span class="speed-label">速度</span>
            <button v-for="option in speedOptions" :key="option" type="button" class="speed-btn"
              :class="{ 'is-active': playbackSpeed === option }" @click="emit('speed-change', option)">
              {{ option }}x
            </button>
          </div>
        </div>
      </div>
      <span v-if="displayTimeMs" class="current-time-tag">
        {{ formatLocalDateTime(displayTimeMs) }}
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
        <span>{{ formatLocalDateTime(taskStartMs) }}</span>
        <span>{{ formatLocalDateTime(taskEndMs) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { msToRatio, TIMELINE_RULER_EDGE_INSET, buildTimelineHourRulerTicks, mapTimelinePositionPercent } from '@/utils/satelliteTimelineMarkers'
import { formatLocalDateTime, parseTimeToMs } from '@/utils/tools/dateFormat'

/**
 * 整体态势任务时间轴（纯展示组件，无播放与矩阵业务逻辑）。
 */
const props = withDefaults(
  defineProps<{
    /** 任务开始时间字符串 */
    taskStart: string
    /** 任务结束时间字符串 */
    taskEnd: string
    /** 当前时刻（毫秒），用于游标展示 */
    currentTimeMs?: number | null
    /** 是否正在播放 */
    isPlaying?: boolean
    /** 播放倍速 */
    playbackSpeed?: number
  }>(),
  {
    isPlaying: false,
    playbackSpeed: 1,
  }
)

/** 可选播放倍速 */
const speedOptions = [1, 2, 5, 10]

/** 点击时间轴时通知父组件更新当前时刻 */
const emit = defineEmits<{
  (e: 'time-change', ms: number): void
  (e: 'toggle-play'): void
  (e: 'speed-change', speed: number): void
}>()

/** 时间轴轨道 DOM 引用 */
const trackRef = ref<HTMLElement | null>(null)

/** 任务开始时间（毫秒） */
const taskStartMs = computed(() => parseTimeToMs(props.taskStart))
/** 任务结束时间（毫秒） */
const taskEndMs = computed(() => parseTimeToMs(props.taskEnd))

/** 展示用当前时刻，默认落在任务开始 */
const displayTimeMs = computed(() => {
  if (props.currentTimeMs != null && props.currentTimeMs > 0) return props.currentTimeMs
  return taskStartMs.value
})

/**
 * 毫秒转时间轴百分比。
 *
 * @param ms 毫秒时间戳
 * @returns 百分比
 */
const msToPercent = (ms: number): number =>
  mapTimelinePositionPercent(msToRatio(ms, taskStartMs.value, taskEndMs.value))

/** 游标百分比位置 */
const playheadPercent = computed<number | null>(() => {
  if (!displayTimeMs.value || !taskStartMs.value || !taskEndMs.value) return null
  return msToPercent(displayTimeMs.value)
})

/** 时间标尺刻度 */
const rulerTicks = computed(() =>
  buildTimelineHourRulerTicks(taskStartMs.value, taskEndMs.value, msToPercent)
)

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
  const leftInset = (TIMELINE_RULER_EDGE_INSET / 100) * rect.width
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
  padding: 5px 24px 4px 24px;
  background: transparent;
  box-sizing: border-box;
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
  gap: 8px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .header-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--accent-cyan-hover);
    letter-spacing: 0.3px;
    line-height: 18px;
    white-space: nowrap;
  }

  .timeline-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .control-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.35);
    background: rgba(var(--accent-cyan-rgb), 0.08);
    color: var(--color-info-soft);
    font-size: var(--font-size-xs);
    cursor: pointer;

    &:hover {
      background: rgba(var(--accent-cyan-rgb), 0.18);
      color: var(--color-white);
    }
  }

  .control-btn-icon {
    font-size: var(--font-size-caption);
    line-height: 1;
  }

  .speed-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .speed-label {
    font-size: var(--font-size-caption);
    color: var(--text-color-subtle);
    white-space: nowrap;
  }

  .speed-btn {
    min-width: 30px;
    height: 22px;
    padding: 0 6px;
    border-radius: 4px;
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.2);
    background: var(--swatch-rgba-8-20-36-0_6);
    color: var(--text-color-muted);
    font-size: var(--font-size-caption);
    cursor: pointer;

    &.is-active {
      color: var(--accent-cyan-hover);
      border-color: var(--swatch-rgba-64-242-255-0_65);
      background: rgba(var(--accent-cyan-rgb), 0.16);
    }

    &:hover {
      color: var(--color-white);
      border-color: var(--swatch-rgba-64-242-255-0_45);
    }
  }

  .current-time-tag {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-semibold);
    color: var(--color-info-soft);
    font-family: var(--font-family-mono);
  }
}

/** 中间轨道距顶部的偏移 */
$track-top: 28px;
/** 中间轨道高度 */
$track-height: 8px;
/** 日期时间与轨道之间的间距 */
$label-track-gap: 8px;

.ruler-panel {
  position: relative;
  height: 58px;
  cursor: pointer;
  user-select: none;
}

.ruler-scale {
  position: absolute;
  left: 0;
  right: 0;
  top: $track-top;
  height: $track-height;
  pointer-events: none;
  z-index: 2;
}

.ruler-tick {
  position: absolute;
  top: 0;
  height: 100%;
  transform: translateX(-50%);

  &.align-start {
    transform: translateX(0);
  }

  &.align-end {
    transform: translateX(-100%);
  }

  .tick-line {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    width: 1px;
    height: 100%;
    background: var(--swatch-rgba-125-211-252-0_55);
  }

  &.major .tick-line {
    width: 2px;
    background: var(--swatch-rgba-64-242-255-0_9);
  }

  .tick-label {
    position: absolute;
    left: 50%;
    bottom: calc(100% + #{$label-track-gap});
    transform: translateX(-50%);
    font-size: var(--font-size-caption);
    color: var(--text-color-subtle);
    white-space: nowrap;
    line-height: 1.2;
  }

  &.align-start .tick-label {
    left: 0;
    transform: translateX(0);
  }

  &.align-end .tick-label {
    left: auto;
    right: 0;
    transform: translateX(0);
  }
}

.timeline-track {
  position: absolute;
  left: 0;
  right: 0;
  top: $track-top;
  height: $track-height;

  .track-base {
    width: 100%;
    height: 100%;
    border-radius: 4px;
    background: linear-gradient(90deg, rgba(var(--accent-cyan-rgb), 0.08), rgba(var(--accent-cyan-rgb), 0.22));
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.25);
  }
}

.orbit-playhead {
  position: absolute;
  top: calc(#{$track-top} - 4px);
  transform: translateX(-50%);
  z-index: 3;
  pointer-events: none;

  .orbit-playhead-line {
    display: block;
    width: 2px;
    height: calc(#{$track-height} + 8px);
    margin: 0 auto;
    background: var(--color-warning);
    box-shadow: 0 0 6px var(--swatch-rgba-251-191-36-0_65);
  }

  .orbit-playhead-dot {
    display: block;
    width: 8px;
    height: 8px;
    margin: -2px auto 0;
    border-radius: 50%;
    background: var(--color-warning);
    box-shadow: 0 0 8px var(--swatch-rgba-251-191-36-0_8);
  }
}

.timeline-scale {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-caption);
  color: var(--text-color-subtle);
  font-family: var(--font-family-mono);
}
</style>
