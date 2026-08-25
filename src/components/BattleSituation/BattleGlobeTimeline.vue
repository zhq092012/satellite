<template>
  <div class="battle-globe-timeline" v-if="taskStartMs && taskEndMs > taskStartMs">
    <div class="timeline-header">
      <div class="header-left">
        <span class="header-title">{{ isSatelliteSelected ? '任务时间标尺' : 'TLE 轨道仿真时间尺' }}</span>
        <!-- 播放/暂停控制按钮（专属于态势地球场景） -->
        <button
          v-if="!isSatelliteSelected"
          type="button"
          class="play-pause-btn"
          :class="{ 'is-paused': !currentIsPlaying }"
          :title="currentIsPlaying ? '暂停地球轨道仿真' : '播放地球轨道仿真'"
          @click="togglePlayPause"
        >
          <span class="btn-icon">
            <svg v-if="currentIsPlaying" viewBox="0 0 24 24" class="svg-icon">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" fill="currentColor" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="svg-icon">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          </span>
          <span class="btn-text">{{ currentIsPlaying ? '暂停' : '播放' }}</span>
        </button>
      </div>

      <!-- 当前时钟或选中时刻 -->
      <span v-if="currentTimeMs" class="current-time-tag">
        {{ formatTimelineTime(currentTimeMs) }}
      </span>

      <!-- 选中卫星时的态势图例：全部为过境通信（绿色） -->
      <div class="legend-row" v-if="isSatelliteSelected">
        <span class="legend-chip chip-normal">过境通信</span>
      </div>
    </div>

    <div class="ruler-panel" ref="trackRef" @click="handleTrackClick">
      <!-- 标尺刻度 -->
      <div class="ruler-scale">
        <div
          v-for="tick in rulerTicks"
          :key="tick.label"
          class="ruler-tick"
          :class="{ major: tick.major, ['align-' + tick.align]: true }"
          :style="{ left: tick.percent + '%' }"
        >
          <span class="tick-line"></span>
          <span v-if="tick.major" class="tick-label">{{ tick.label }}</span>
        </div>
      </div>

      <!-- 轨道/过境色段 -->
      <!-- 选中卫星时：展示该卫星的所有过境通信窗口（全部为绿色） -->
      <div v-if="isSatelliteSelected" class="timeline-track timeline-track--satellite">
        <div class="track-base"></div>
        <div
          v-for="(seg, idx) in passSegments"
          :key="'pass-' + idx"
          class="track-segment segment-normal"
          :style="segmentStyle(seg.startMs, seg.endMs)"
        ></div>
      </div>
      <!-- 选中传输链路但未选卫星时 -->
      <div v-else-if="forceTaskMode" class="timeline-track timeline-track--task-focus">
        <div class="track-base"></div>
      </div>
      <!-- 默认 TLE 轨道仿真模式 -->
      <div v-else class="timeline-track timeline-track--orbit">
        <div class="track-base"></div>
      </div>

      <!-- 轨道仿真游标（未选卫星时跟随时钟连续推进） -->
      <div
        v-if="!isSatelliteSelected && playheadPercent != null"
        class="orbit-playhead"
        :style="{ left: playheadPercent + '%' }"
      >
        <span class="orbit-playhead-line"></span>
        <span class="orbit-playhead-dot"></span>
      </div>

      <!-- 选中单颗卫星或传输链路时的当前时刻游标 -->
      <div
        v-if="isSatelliteSelected && playheadPercent != null"
        class="task-playhead"
        :style="{ left: playheadPercent + '%' }"
      >
        <span class="task-playhead-line"></span>
        <span class="task-playhead-dot"></span>
      </div>

      <!-- 选中卫星时的过境站点节点标记（全绿色） -->
      <div v-if="isSatelliteSelected" class="ruler-markers">
        <el-tooltip
          v-for="item in passMarkers"
          :key="item.key"
          placement="top"
          :show-after="120"
          popper-class="globe-timeline-tooltip"
        >
          <template #content>
            <div class="tooltip-card">
              <div class="tooltip-header">
                <span class="tooltip-icon">🛰️</span>
                <span class="tooltip-title">{{ item.label }}</span>
              </div>
              <div class="tooltip-time">{{ item.timeText }}</div>
              <div class="tooltip-desc">
                <span>过境窗口：{{ item.durationText }}</span>
              </div>
            </div>
          </template>
          <button
            type="button"
            class="ruler-tick-btn tick-normal"
            :class="['align-' + item.align, { 'is-selected': isMarkerSelected(item) }]"
            :style="{ left: item.percent + '%', bottom: item.lane * 10 + 'px' }"
            @click.stop="handleMarkerClick(item)"
          >
            <span class="tick-square"></span>
          </button>
        </el-tooltip>
      </div>

      <!-- 底部起止时间标签 -->
      <div class="timeline-scale">
        <span>{{ formatTimelineTime(taskStartMs) }}</span>
        <span>{{ formatTimelineTime(taskEndMs) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MatrixResult } from '@/api/electronic'
import { collectSatelliteTransmissionLinks } from '@/utils/satelliteFullChainAnalysis'
import { formatTimelineTime, msToRatio } from '@/utils/satelliteTimelineMarkers'

/** 整体态势时间轴输入属性 */
const props = defineProps<{
  /** 任务开始时间字符串 */
  taskStart: string
  /** 任务结束时间字符串 */
  taskEnd: string
  /** 当前算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD 编号 */
  selectedNorad?: number | null
  /** 未选卫星时强制使用任务时间标尺（如选中传输链路） */
  forceTaskMode?: boolean
  /** 当前时钟时刻（毫秒） */
  currentTimeMs?: number | null
  /** 当前播放状态（专用于整体态势地球） */
  isPlaying?: boolean
}>()

/** 时间轴向父组件触发的事件 */
const emit = defineEmits<{
  /** 通知父组件切换当前时间 */
  (e: 'time-change', ms: number): void
  /** 通知父组件切换播放/暂停状态 */
  (e: 'toggle-play', playing: boolean): void
  /** 通知父组件点击了过境标记 */
  (e: 'marker-click', payload: { ms: number; label: string; receiveId?: string }): void
}>()

/** 时间轴轨道 DOM 引用 */
const trackRef = ref<HTMLElement | null>(null)

/** 内部维护的播放状态 */
const internalPlaying = ref(true)
const currentIsPlaying = computed(() => (props.isPlaying !== undefined ? props.isPlaying : internalPlaying.value))

const togglePlayPause = () => {
  const next = !currentIsPlaying.value
  internalPlaying.value = next
  emit('toggle-play', next)
}

/** 将任务时间字符串解析为毫秒时间戳 */
const parseTaskTime = (value: string): number => {
  if (!value) return 0
  const normalizedValue = value.replace(/-/g, '/')
  const ts = new Date(normalizedValue).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

/** 任务开始时间毫秒值 */
const taskStartMs = computed(() => parseTaskTime(props.taskStart))
/** 任务结束时间毫秒值 */
const taskEndMs = computed(() => parseTaskTime(props.taskEnd))

/** 是否选中了卫星 */
const isSatelliteSelected = computed(() => !!props.selectedNorad)

/** 标尺两端预留的百分比空间 */
const RULER_EDGE_INSET = 2.8

/** 将时间轴相对比例映射为百分比位置 */
const mapPositionPercent = (ratio: number): number =>
  RULER_EDGE_INSET + ratio * (100 - RULER_EDGE_INSET * 2)

/** 将毫秒时间戳转换为时间轴上的百分比位置 */
const msToPercent = (ms: number): number =>
  mapPositionPercent(msToRatio(ms, taskStartMs.value, taskEndMs.value))

/** 根据百分比位置计算对齐方式 */
const getMarkerAlign = (percent: number): 'start' | 'center' | 'end' => {
  if (percent <= RULER_EDGE_INSET + 1) return 'start'
  if (percent >= 100 - RULER_EDGE_INSET - 1) return 'end'
  return 'center'
}

/** 当前游标在时间轴上的百分比位置 */
const playheadPercent = computed<number | null>(() => {
  if (!props.currentTimeMs || !taskStartMs.value || !taskEndMs.value) return null
  return msToPercent(props.currentTimeMs)
})

/** 工具函数：限制毫秒在任务区间内 */
const clampMs = (ms: number, min: number, max: number): number => Math.min(max, Math.max(min, ms))

/** 格式化过境时长描述 */
const formatDuration = (startMs: number, endMs: number): string => {
  const diffSec = Math.max(0, Math.round((endMs - startMs) / 1000))
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60
  if (minutes > 0) {
    return `${minutes} 分 ${seconds} 秒`
  }
  return `${seconds} 秒`
}

/** 选中卫星的过境通信时间段（全部为正常绿色） */
interface GlobePassSegment {
  startMs: number
  endMs: number
  label: string
  receiveId?: string
}

const passSegments = computed<GlobePassSegment[]>(() => {
  if (!props.matrixData || !props.selectedNorad || !taskStartMs.value || !taskEndMs.value) return []
  const links = collectSatelliteTransmissionLinks(props.matrixData, props.selectedNorad)
  return links
    .map((link) => ({
      startMs: clampMs(link.transmitStartMs, taskStartMs.value, taskEndMs.value),
      endMs: clampMs(link.transmitEndMs || link.transmitStartMs, taskStartMs.value, taskEndMs.value),
      label: link.receiveName,
      receiveId: link.receiveId,
    }))
    .sort((a, b) => a.startMs - b.startMs)
})

/** 选中卫星的过境站点标记项（全绿色） */
interface GlobePassMarker {
  key: string
  ms: number
  percent: number
  align: 'start' | 'center' | 'end'
  lane: number
  label: string
  timeText: string
  durationText: string
  receiveId?: string
  orderIndex: number
}

const passMarkers = computed<GlobePassMarker[]>(() => {
  if (!props.matrixData || !props.selectedNorad || !taskStartMs.value || !taskEndMs.value) return []
  const links = collectSatelliteTransmissionLinks(props.matrixData, props.selectedNorad)
  const usedLanes = new Map<number, number>()

  const allocLane = (percent: number): number => {
    const bucket = Math.round(percent * 10)
    const lane = usedLanes.get(bucket) ?? 0
    usedLanes.set(bucket, lane + 1)
    return lane % 3
  }

  return links
    .map((link, orderIndex) => {
      const startMs = clampMs(link.transmitStartMs, taskStartMs.value, taskEndMs.value)
      const endMs = clampMs(link.transmitEndMs || link.transmitStartMs, taskStartMs.value, taskEndMs.value)
      const percent = msToPercent(startMs)
      return {
        key: `pass-${link.receiveId || link.receiveName}-${orderIndex}`,
        ms: startMs,
        percent,
        align: getMarkerAlign(percent),
        lane: allocLane(percent),
        label: link.receiveName,
        timeText: formatTimelineTime(startMs),
        durationText: `${formatTimelineTime(startMs).slice(11)} ~ ${formatTimelineTime(endMs).slice(11)} (${formatDuration(startMs, endMs)})`,
        receiveId: link.receiveId,
        orderIndex,
      }
    })
    .sort((a, b) => a.ms - b.ms)
})

/** 生成色段定位样式 */
const segmentStyle = (startMs: number, endMs: number) => {
  const left = msToPercent(startMs)
  const width = Math.max(msToPercent(endMs) - left, 0.6)
  return { left: `${left}%`, width: `${width}%` }
}

/** 生成时间标尺刻度 */
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

/** 点击过境节点标记 */
const handleMarkerClick = (item: GlobePassMarker) => {
  emit('time-change', item.ms)
  emit('marker-click', { ms: item.ms, label: item.label, receiveId: item.receiveId })
}

/** 标记是否处于当前选中时刻 */
const isMarkerSelected = (item: GlobePassMarker): boolean =>
  props.currentTimeMs != null && Math.abs(item.ms - props.currentTimeMs) < 1000

/** 点击时间轴轨道/标尺任意位置快速跳转 */
const handleTrackClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (target.closest('.ruler-tick-btn') || target.closest('.legend-row') || target.closest('.play-pause-btn')) {
    return
  }
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

/** 选中卫星时自动定位到最早过境窗口 */
const syncSelectedSatelliteTime = () => {
  if (!taskStartMs.value || !props.selectedNorad) return
  if (passMarkers.value.length > 0) {
    const firstPass = passMarkers.value[0]
    emit('time-change', firstPass.ms)
    emit('marker-click', { ms: firstPass.ms, label: firstPass.label, receiveId: firstPass.receiveId })
    return
  }
  emit('time-change', taskStartMs.value)
}

watch(
  () => props.selectedNorad,
  (norad) => {
    if (norad) syncSelectedSatelliteTime()
  }
)

defineExpose({ syncTaskStart: syncSelectedSatelliteTime })
</script>

<style scoped lang="scss">
.battle-globe-timeline {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  z-index: 100;
  padding: 10px 16px 12px 18px;
  border-radius: 10px;
  background: rgba(8, 14, 28, 0.94);
  border: 1px solid rgba(0, 225, 255, 0.28);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.timeline-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  gap: 8px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: #40f2ff;
    letter-spacing: 0.3px;
  }

  .play-pause-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 10px;
    height: 22px;
    font-size: 11px;
    font-weight: 600;
    color: #67e8f9;
    background: rgba(0, 225, 255, 0.1);
    border: 1px solid rgba(0, 225, 255, 0.35);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;
    box-shadow: 0 0 6px rgba(0, 225, 255, 0.15);

    .btn-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;

      .svg-icon {
        width: 12px;
        height: 12px;
      }
    }

    .btn-text {
      letter-spacing: 0.5px;
    }

    &:hover {
      color: #ffffff;
      background: rgba(0, 225, 255, 0.22);
      border-color: rgba(0, 225, 255, 0.65);
      box-shadow: 0 0 10px rgba(0, 225, 255, 0.45);
      transform: translateY(-1px);
    }

    &:active {
      transform: translateY(0);
      background: rgba(0, 225, 255, 0.3);
    }

    &.is-paused {
      color: #fde047;
      background: rgba(234, 179, 8, 0.12);
      border-color: rgba(234, 179, 8, 0.45);
      box-shadow: 0 0 6px rgba(234, 179, 8, 0.2);

      &:hover {
        color: #ffffff;
        background: rgba(234, 179, 8, 0.25);
        border-color: rgba(234, 179, 8, 0.75);
        box-shadow: 0 0 10px rgba(234, 179, 8, 0.5);
      }
    }
  }

  .current-time-tag {
    margin-left: auto;
    font-size: 11px;
    font-family: monospace;
    color: #67e8f9;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.1);
    border: 1px solid rgba(0, 225, 255, 0.25);
  }

  .legend-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .legend-chip {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid transparent;

    &.chip-normal {
      color: #86efac;
      background: rgba(34, 197, 94, 0.15);
      border-color: rgba(74, 222, 128, 0.4);
    }
  }
}

.ruler-panel {
  position: relative;
  padding: 4px 4px 0;
  overflow: visible;
  cursor: pointer;
}

.ruler-scale {
  position: relative;
  height: 28px;
  margin-bottom: 2px;

  .ruler-tick {
    position: absolute;
    bottom: 0;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;

    &.align-start {
      transform: translateX(0);
      align-items: flex-start;
    }

    &.align-end {
      transform: translateX(-100%);
      align-items: flex-end;
    }

    .tick-line {
      width: 1px;
      height: 6px;
      background: rgba(148, 163, 184, 0.45);
    }

    &.major .tick-line {
      height: 10px;
      background: rgba(148, 163, 184, 0.7);
    }

    .tick-label {
      font-size: 9px;
      color: #64748b;
      margin-top: 2px;
      white-space: nowrap;
      font-family: Consolas, monospace;
    }
  }
}

.timeline-track {
  position: relative;
  height: 10px;
  border-radius: 2px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 0 10px rgba(0, 225, 255, 0.4);
  }

  &--orbit .track-base {
    background: linear-gradient(90deg, rgba(30, 58, 95, 0.9), rgba(14, 116, 144, 0.35));
    border-color: rgba(56, 189, 248, 0.35);
  }

  &--satellite .track-base {
    background: #1e293b;
    border-color: rgba(71, 85, 105, 0.6);
  }
}

.orbit-playhead {
  position: absolute;
  top: 30px;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 6;
  pointer-events: none;

  .orbit-playhead-line {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: linear-gradient(180deg, rgba(34, 211, 238, 0.2), #22d3ee);
    box-shadow: 0 0 8px rgba(34, 211, 238, 0.65);
  }

  .orbit-playhead-dot {
    position: absolute;
    left: 50%;
    top: -2px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background: #22d3ee;
    border: 2px solid #e0f2fe;
    box-shadow: 0 0 10px rgba(34, 211, 238, 0.8);
  }
}

.task-playhead {
  position: absolute;
  top: 30px;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 6;
  pointer-events: none;

  .task-playhead-line {
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: linear-gradient(180deg, rgba(34, 197, 94, 0.2), #22c55e);
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.65);
  }

  .task-playhead-dot {
    position: absolute;
    left: 50%;
    top: -2px;
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid #dcfce7;
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.8);
  }
}

.track-base {
  position: absolute;
  inset: 0;
  background: #1e293b;
  border: 1px solid rgba(71, 85, 105, 0.6);
}

.track-segment {
  position: absolute;
  top: 0;
  height: 100%;
  pointer-events: none;

  &.segment-normal {
    background: rgba(34, 197, 94, 0.6);
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
    z-index: 2;
  }
}

.ruler-markers {
  position: relative;
  height: 36px;
  margin-top: 4px;
}

.ruler-tick-btn {
  position: absolute;
  transform: translateX(-50%);
  padding: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 5;

  &.align-start {
    transform: translateX(0);
  }

  &.align-end {
    transform: translateX(-100%);
  }

  .tick-square {
    display: block;
    width: 9px;
    height: 15px;
    border-radius: 2px;
    background: #22c55e;
    border: 2px solid rgba(220, 252, 231, 0.95);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  &:hover .tick-square {
    transform: scale(1.2);
    box-shadow: 0 0 10px rgba(74, 222, 128, 0.7);
  }

  &.is-selected .tick-square {
    transform: scale(1.25);
    box-shadow: 0 0 0 2px #86efac, 0 0 14px rgba(74, 222, 128, 0.85);
    border-color: #86efac;
  }
}

.timeline-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 10px;
  color: #64748b;
  font-family: Consolas, monospace;
}
</style>

<style lang="scss">
.globe-timeline-tooltip {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;

  .tooltip-card {
    min-width: 190px;
    max-width: 260px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(10, 18, 32, 0.96);
    border: 1px solid rgba(34, 197, 94, 0.35);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);

    .tooltip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);

      .tooltip-icon {
        font-size: 14px;
      }

      .tooltip-title {
        font-size: 13px;
        font-weight: 700;
        color: #86efac;
      }
    }

    .tooltip-time {
      font-size: 12px;
      font-family: Consolas, monospace;
      color: #40f2ff;
      margin-bottom: 4px;
    }

    .tooltip-desc {
      font-size: 11px;
      color: #cbd5e1;
      line-height: 1.5;
    }
  }
}
</style>
