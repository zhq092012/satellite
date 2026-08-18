<template>
  <div class="battle-mission-timeline" v-if="taskStartMs && taskEndMs > taskStartMs">
    <div class="timeline-header">
      <span class="header-title">任务时间标尺</span>
      <div class="legend-row" v-if="selectedNorad">
        <span class="legend-chip chip-normal">正常通信</span>
        <span class="legend-chip chip-jam">干扰窗口</span>
        <span class="legend-chip chip-post">打击后链路</span>
      </div>
    </div>

    <div class="ruler-panel" ref="trackRef">
      <!-- 标尺刻度 -->
      <div class="ruler-scale">
        <div v-for="tick in rulerTicks" :key="tick.label" class="ruler-tick"
          :class="{ major: tick.major, ['align-' + tick.align]: true }" :style="{ left: tick.percent + '%' }">
          <span class="tick-line"></span>
          <span v-if="tick.major" class="tick-label">{{ tick.label }}</span>
        </div>
      </div>

      <!-- 色段轨道 -->
      <div class="timeline-track">
        <div class="track-base"></div>
        <div v-if="timelineModel?.firstTransmitMs" class="track-segment segment-normal"
          :style="segmentStyle(taskStartMs, timelineModel.firstTransmitMs)"></div>
        <div v-for="(seg, idx) in timelineModel?.jamSegments || []" :key="'jam-' + idx"
          class="track-segment segment-jam" :style="segmentStyle(seg.startMs, seg.endMs)"></div>
        <div v-if="timelineModel?.postChainFinishMs && !timelineModel.allBlocked" class="track-segment segment-post"
          :style="segmentStyle(lastJamEndMs, timelineModel.postChainFinishMs)"></div>
      </div>

      <!-- 方形节点标尺 -->
      <div class="ruler-markers">
        <el-tooltip v-for="(item, idx) in displayMarkerItems" :key="item.key" placement="top" :show-after="120"
          popper-class="mission-timeline-tooltip">
          <template #content>
            <div class="tooltip-card">
              <div class="tooltip-header" :class="'type-' + item.type">
                <span class="tooltip-icon">{{ item.icon }}</span>
                <span class="tooltip-title">{{ item.title }}</span>
              </div>
              <div class="tooltip-time">{{ item.timeText }}</div>
              <div v-if="item.desc" class="tooltip-desc">{{ item.desc }}</div>
              <ul v-if="item.subItems?.length" class="tooltip-list">
                <li v-for="(sub, sIdx) in item.subItems" :key="sIdx">{{ sub }}</li>
              </ul>
            </div>
          </template>
          <button type="button" class="ruler-tick-btn" :class="[
            'tick-' + item.type,
            { 'is-jam': item.type === 'jam', 'is-major': item.isMajor, 'is-selected': isMarkerSelected(item) },
            'align-' + item.align,
          ]" :style="{ left: item.percent + '%', bottom: item.lane * 10 + 'px' }" @click="handleMarkerClick(item)">
            <span class="tick-square"></span>
          </button>
        </el-tooltip>
      </div>

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
import {
  buildSatelliteTimelineModel,
  formatTimelineTime,
  msToRatio,
  type SatelliteTimelineModel,
  type TimelineMarker,
  type TimelineMarkerType,
} from '@/utils/satelliteTimelineMarkers'

const props = defineProps<{
  taskStart: string
  taskEnd: string
  matrixData: MatrixResult | null
  selectedNorad?: number | null
  selectedMarkerMs?: number | null
  selectedMarkerType?: TimelineMarkerType | null
}>()

const emit = defineEmits<{
  (e: 'time-change', ms: number): void
  (e: 'marker-click', payload: { ms: number; type: TimelineMarkerType; label: string }): void
}>()

const trackRef = ref<HTMLElement | null>(null)

const parseTaskTime = (value: string): number => {
  if (!value) return 0
  const ts = new Date(value.replace(/-/g, '/')).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const taskStartMs = computed(() => parseTaskTime(props.taskStart))
const taskEndMs = computed(() => parseTaskTime(props.taskEnd))

const timelineModel = computed<SatelliteTimelineModel | null>(() =>
  buildSatelliteTimelineModel(props.matrixData, props.selectedNorad ?? null, taskStartMs.value, taskEndMs.value)
)

const lastJamEndMs = computed(() => {
  const segs = timelineModel.value?.jamSegments || []
  if (!segs.length) return timelineModel.value?.firstTransmitMs || taskStartMs.value
  return Math.max(...segs.map((s) => s.endMs))
})

const RULER_EDGE_INSET = 2.8

const mapPositionPercent = (ratio: number): number =>
  RULER_EDGE_INSET + ratio * (100 - RULER_EDGE_INSET * 2)

const msToPercent = (ms: number): number =>
  mapPositionPercent(msToRatio(ms, taskStartMs.value, taskEndMs.value))

const getMarkerAlign = (percent: number): 'start' | 'center' | 'end' => {
  if (percent <= RULER_EDGE_INSET + 1) return 'start'
  if (percent >= 100 - RULER_EDGE_INSET - 1) return 'end'
  return 'center'
}

const segmentStyle = (startMs: number, endMs: number) => {
  const left = msToPercent(startMs)
  const width = Math.max(msToPercent(endMs) - left, 0.4)
  return { left: `${left}%`, width: `${width}%` }
}

interface DisplayMarkerItem {
  key: string
  type: TimelineMarkerType
  ms: number
  percent: number
  align: 'start' | 'center' | 'end'
  lane: number
  isMajor: boolean
  icon: string
  title: string
  timeText: string
  desc?: string
  subItems?: string[]
}

const MARKER_META: Record<
  TimelineMarkerType,
  { icon: string; title: string; isMajor: boolean }
> = {
  task_start: { icon: '▶', title: '任务开始', isMajor: true },
  first_transmit: { icon: '📡', title: '最早开始传输', isMajor: true },
  jam: { icon: '⚡', title: '遭受干扰', isMajor: false },
  post_chain_finish: { icon: '✓', title: '打击后最早全链路完成', isMajor: true },
  all_blocked: { icon: '✕', title: '全部阻断', isMajor: true },
  task_end: { icon: '■', title: '任务结束', isMajor: true },
}

const rawMarkers = computed<TimelineMarker[]>(() => {
  if (!timelineModel.value || !props.selectedNorad) return []
  return timelineModel.value.markers.filter((m) => m.type !== 'task_start' && m.type !== 'task_end')
})

/** 合并过近的干扰节点，主节点独立展示 */
const displayMarkerItems = computed<DisplayMarkerItem[]>(() => {
  const span = taskEndMs.value - taskStartMs.value
  const clusterThreshold = span * 0.012
  const sorted = [...rawMarkers.value].sort((a, b) => a.ms - b.ms)

  const majors: TimelineMarker[] = []
  const jams: TimelineMarker[] = []
  sorted.forEach((m) => {
    if (m.type === 'jam') jams.push(m)
    else majors.push(m)
  })

  const items: DisplayMarkerItem[] = []
  const usedLanes = new Map<number, number>()

  const allocLane = (percent: number): number => {
    const bucket = Math.round(percent * 10)
    const lane = usedLanes.get(bucket) ?? 0
    usedLanes.set(bucket, lane + 1)
    return lane % 3
  }

  majors.forEach((marker, idx) => {
    const meta = MARKER_META[marker.type]
    const percent = msToPercent(marker.ms)
    items.push({
      key: `${marker.type}-${idx}`,
      type: marker.type,
      ms: marker.ms,
      percent,
      align: getMarkerAlign(percent),
      lane: allocLane(percent),
      isMajor: meta.isMajor,
      icon: meta.icon,
      title: meta.title,
      timeText: formatTimelineTime(marker.ms),
      desc: marker.detail || undefined,
    })
  })

  let jamGroup: TimelineMarker[] = []
  const flushJamGroup = () => {
    if (!jamGroup.length) return
    const first = jamGroup[0]
    const percent = msToPercent(first.ms)
    const meta = MARKER_META.jam
    items.push({
      key: `jam-group-${first.ms}-${jamGroup.length}`,
      type: 'jam',
      ms: first.ms,
      percent,
      align: getMarkerAlign(percent),
      lane: allocLane(percent),
      isMajor: false,
      icon: meta.icon,
      title: jamGroup.length > 1 ? `干扰 × ${jamGroup.length}` : meta.title,
      timeText: formatTimelineTime(first.ms),
      subItems: jamGroup.map((j) => j.detail || j.label),
    })
    jamGroup = []
  }

  jams.forEach((marker) => {
    if (!jamGroup.length) {
      jamGroup.push(marker)
      return
    }
    const last = jamGroup[jamGroup.length - 1]
    if (Math.abs(marker.ms - last.ms) <= clusterThreshold) {
      jamGroup.push(marker)
    } else {
      flushJamGroup()
      jamGroup.push(marker)
    }
  })
  flushJamGroup()

  return items.sort((a, b) => a.ms - b.ms)
})

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

const handleMarkerClick = (item: { ms: number; type: TimelineMarkerType; title: string }) => {
  emit('time-change', item.ms)
  emit('marker-click', { ms: item.ms, type: item.type, label: item.title })
}

const isMarkerSelected = (item: DisplayMarkerItem) =>
  props.selectedMarkerMs != null &&
  item.ms === props.selectedMarkerMs &&
  (!props.selectedMarkerType || item.type === props.selectedMarkerType)

const syncSelectedSatelliteTime = () => {
  if (!taskStartMs.value) return
  if (!props.selectedNorad) {
    emit('time-change', taskStartMs.value)
    return
  }
  const firstMs = timelineModel.value?.firstTransmitMs
  if (firstMs) {
    emit('time-change', firstMs)
    emit('marker-click', { ms: firstMs, type: 'first_transmit', label: '首次传输' })
    return
  }
  emit('time-change', taskStartMs.value)
}

watch([taskStartMs, taskEndMs], () => {
  if (taskStartMs.value) emit('time-change', taskStartMs.value)
}, { immediate: true })

watch(
  () => props.selectedNorad,
  () => syncSelectedSatelliteTime()
)

defineExpose({ syncTaskStart: syncSelectedSatelliteTime })
</script>

<style scoped lang="scss">
.battle-mission-timeline {
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

  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: #40f2ff;
    letter-spacing: 0.3px;
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
      background: rgba(34, 197, 94, 0.12);
      border-color: rgba(74, 222, 128, 0.3);
    }

    &.chip-jam {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(248, 113, 113, 0.3);
    }

    &.chip-post {
      color: #7dd3fc;
      background: rgba(56, 189, 248, 0.12);
      border-color: rgba(64, 242, 255, 0.3);
    }
  }
}

.ruler-panel {
  position: relative;
  padding: 4px 4px 0;
  overflow: visible;
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
    background: rgba(34, 197, 94, 0.5);
  }

  &.segment-jam {
    background: rgba(239, 68, 68, 0.6);
    z-index: 2;
  }

  &.segment-post {
    background: rgba(56, 189, 248, 0.45);
    z-index: 1;
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
    border-radius: 2px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  &.is-major .tick-square {
    width: 10px;
    height: 18px;
  }

  &.is-jam .tick-square {
    width: 7px;
    height: 10px;
  }

  &:not(.is-major):not(.is-jam) .tick-square {
    width: 9px;
    height: 14px;
  }

  &:hover .tick-square {
    transform: scale(1.15);
    box-shadow: 0 0 10px rgba(64, 242, 255, 0.5);
  }

  &.is-selected .tick-square {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px #67e8f9, 0 0 12px rgba(103, 232, 249, 0.7);
    border-color: #67e8f9;
  }

  &.tick-task_start .tick-square,
  &.tick-task_end .tick-square {
    background: #94a3b8;
  }

  &.tick-first_transmit .tick-square {
    background: #22c55e;
  }

  &.tick-jam .tick-square {
    background: #ef4444;
    border-color: #fecaca;
  }

  &.tick-post_chain_finish .tick-square {
    background: #0ea5e9;
  }

  &.tick-all_blocked .tick-square {
    background: #dc2626;
    box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
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
.mission-timeline-tooltip {
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;

  .tooltip-card {
    min-width: 200px;
    max-width: 280px;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(10, 18, 32, 0.96);
    border: 1px solid rgba(0, 225, 255, 0.25);
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
        color: #e2efff;
      }

      &.type-first_transmit .tooltip-title {
        color: #4ade80;
      }

      &.type-jam .tooltip-title {
        color: #fca5a5;
      }

      &.type-post_chain_finish .tooltip-title {
        color: #38bdf8;
      }

      &.type-all_blocked .tooltip-title {
        color: #f87171;
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
      color: #94a3b8;
      line-height: 1.5;
    }

    .tooltip-list {
      margin: 6px 0 0;
      padding-left: 16px;
      font-size: 11px;
      color: #cbd5e1;
      line-height: 1.45;

      li {
        margin-bottom: 2px;
      }
    }
  }
}
</style>
