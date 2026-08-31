<template>
  <div class="series-link-timeline">
    <div class="timeline-head">
      <div class="timeline-title">系列链路通断时序</div>
      <div class="timeline-legend">
        <span class="legend-item"><i class="dot dot--ok" />未打击</span>
        <span class="legend-item"><i class="dot dot--struck" />已打击</span>
        <span class="legend-item"><i class="line line--link" />链路连接</span>
      </div>
    </div>

    <div v-if="!model.groups.length" class="timeline-empty">暂无链路通断数据</div>

    <div v-else class="timeline-scroll">
      <div class="timeline-canvas" :style="{ width: model.canvasWidth + labelWidth + 'px' }">
        <div class="time-axis" :style="{ paddingLeft: labelWidth + 'px' }">
          <div class="axis-track" :style="{ width: model.canvasWidth + 'px' }">
            <div
              v-for="(tick, idx) in ticks"
              :key="idx"
              class="axis-tick"
              :style="{ left: tick.leftPx + 'px' }"
            >
              <span class="tick-line" />
              <span class="tick-label">{{ tick.label }}</span>
            </div>
          </div>
        </div>

        <div v-for="group in model.groups" :key="group.series" class="series-group">
          <div class="series-group-head">{{ group.series }}</div>

          <div class="series-rows" :style="{ height: group.groupHeight + 'px' }">
            <div class="row row--top" :style="{ height: group.topTrackHeight + 'px' }">
              <div class="row-label" :style="{ width: labelWidth + 'px' }" :title="group.series">
                {{ group.series }}
              </div>
              <div class="row-track" :style="{ width: model.canvasWidth + 'px', height: group.topTrackHeight + 'px' }">
                <div
                  v-for="block in group.topBlocks"
                  :key="block.id"
                  class="time-block"
                  :class="block.struck ? 'is-struck' : 'is-ok'"
                  :style="blockStyle(block)"
                  @mouseenter="showTooltip($event, block)"
                  @mouseleave="hideTooltip"
                >
                  <span class="block-label">{{ block.label }}</span>
                </div>
              </div>
            </div>

            <svg
              class="link-svg"
              :width="model.canvasWidth"
              :height="group.groupHeight"
              :style="{ left: labelWidth + 'px' }"
            >
              <line
                v-for="conn in group.connections"
                :key="conn.id"
                :x1="conn.x1"
                :y1="conn.y1"
                :x2="conn.x2"
                :y2="conn.y2"
                class="link-line"
              />
            </svg>

            <div
              class="row row--bottom"
              :style="{ top: group.topTrackHeight + rowGap + 'px', height: group.bottomTrackHeight + 'px' }"
            >
              <div class="row-label" :style="{ width: labelWidth + 'px' }" :title="`${group.series}·通联`">
                {{ group.series }}·通联
              </div>
              <div
                class="row-track"
                :style="{ width: model.canvasWidth + 'px', height: group.bottomTrackHeight + 'px' }"
              >
                <div
                  v-for="block in group.bottomBlocks"
                  :key="block.id"
                  class="time-block"
                  :class="block.struck ? 'is-struck' : 'is-ok'"
                  :style="blockStyle(block)"
                  @mouseenter="showTooltip($event, block)"
                  @mouseleave="hideTooltip"
                >
                  <span class="block-label">{{ block.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="timeline-tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
      >
        <div class="tooltip-title">{{ tooltip.title }}</div>
        <div v-for="(line, idx) in tooltip.lines" :key="idx" class="tooltip-line">{{ line }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ZhchPlanResp } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
import {
  buildPlanLinkTimelineModel,
  buildTimelineTicks,
  type SeriesLinkTimelineBlock,
} from '@/utils/seriesLinkTimeline'

const props = defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
}>()

/** 上下两行间距（需与工具函数 ROW_GAP 一致） */
const rowGap = 28

const store = useLayoutStore()

/** 悬浮提示状态 */
const tooltip = ref({
  visible: false,
  x: 0,
  y: 0,
  title: '',
  lines: [] as string[],
})

/**
 * 方案通断时序模型（由 levelSeriesEntities 本地解析）
 */
const model = computed(() =>
  buildPlanLinkTimelineModel(
    props.plan,
    store.activedTask?.beginDate,
    store.activedTask?.endDate
  )
)

/** 左侧行标签列宽（像素，随系列名称长度自适应） */
const labelWidth = computed(() => {
  const labels = model.value.groups.flatMap((group) => [group.series, `${group.series}·通联`])
  const maxChars = Math.max(...labels.map((text) => text.length), 4)
  return Math.min(148, Math.max(88, maxChars * 11 + 20))
})

/** 顶部时间刻度 */
const ticks = computed(() => buildTimelineTicks(model.value.minMs, model.value.maxMs))

/**
 * 计算时间块样式（位置与尺寸）
 * @param block 已布局的时间块
 */
const blockStyle = (block: SeriesLinkTimelineBlock) => ({
  left: `${block.leftPx}px`,
  width: `${block.widthPx}px`,
  top: `${6 + block.lane * 26}px`,
})

/**
 * 显示悬浮提示
 * @param event 鼠标事件
 * @param block 当前时间块
 */
const showTooltip = (event: MouseEvent, block: SeriesLinkTimelineBlock) => {
  tooltip.value = {
    visible: true,
    x: event.clientX + 12,
    y: event.clientY + 12,
    title: block.tooltipTitle,
    lines: block.tooltipLines,
  }
}

/** 隐藏悬浮提示 */
const hideTooltip = () => {
  tooltip.value.visible = false
}
</script>

<style lang="scss" scoped>
.series-link-timeline {
  margin-top: 8px;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid rgba(0, 225, 255, 0.25);
  background: linear-gradient(180deg, rgba(8, 18, 32, 0.95) 0%, rgba(6, 12, 22, 0.98) 100%);
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.timeline-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.timeline-title {
  font-size: 18px;
  font-weight: 800;
  color: #40f2ff;
  text-shadow: 0 0 10px rgba(64, 242, 255, 0.35);
}

.timeline-legend {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #94a3b8;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;

  &--ok {
    background: #22c55e;
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.45);
  }

  &--struck {
    background: #64748b;
  }
}

.line {
  width: 18px;
  height: 0;
  border-top: 2px dashed #22d3ee;

  &--link {
    display: inline-block;
  }
}

.timeline-empty {
  padding: 28px 0;
  text-align: center;
  font-size: 15px;
  color: #64748b;
}

.timeline-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}

.timeline-canvas {
  width: max-content;
  min-width: 100%;
}

.time-axis {
  margin-bottom: 10px;
}

.axis-track {
  position: relative;
  height: 28px;
  border-bottom: 1px solid rgba(79, 147, 221, 0.25);
}

.axis-tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;

  .tick-line {
    width: 1px;
    height: 8px;
    background: rgba(125, 211, 252, 0.5);
  }

  .tick-label {
    margin-top: 2px;
    font-size: 11px;
    color: #7dd3fc;
    white-space: nowrap;
  }
}

.series-group {
  margin-bottom: 18px;
  padding: 10px 0 6px;
  border-top: 1px dashed rgba(79, 147, 221, 0.2);
}

.series-group-head {
  margin-bottom: 8px;
  font-size: 16px;
  font-weight: 800;
  color: #e2e8f0;
  letter-spacing: 1px;
}

.series-rows {
  position: relative;
  width: max-content;
  min-width: 100%;
}

.row {
  display: flex;
  align-items: stretch;
  position: absolute;
  left: 0;
  width: max-content;
  min-width: 100%;

  &--top {
    top: 0;
  }
}

.row-label {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  text-align: center;
  word-break: break-all;
  color: #7dd3fc;
  background: rgba(14, 28, 48, 0.65);
  border: 1px solid rgba(79, 147, 221, 0.2);
  border-radius: 4px;
  margin-right: 0;
  box-sizing: border-box;
}

.row-track {
  position: relative;
  margin-left: 0;
  background:
    repeating-linear-gradient(
      90deg,
      rgba(79, 147, 221, 0.06) 0,
      rgba(79, 147, 221, 0.06) 1px,
      transparent 1px,
      transparent 60px
    ),
    rgba(6, 12, 22, 0.55);
  border: 1px solid rgba(79, 147, 221, 0.18);
  border-radius: 4px;
  overflow: hidden;
}

.link-svg {
  position: absolute;
  top: 0;
  pointer-events: none;
  z-index: 2;
}

.link-line {
  stroke: #22d3ee;
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  opacity: 0.85;
}

.time-block {
  position: absolute;
  height: 18px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  cursor: default;
  z-index: 3;
  transition: filter 0.15s ease;
  overflow: hidden;

  &:hover {
    filter: brightness(1.15);
    z-index: 4;
  }

  &.is-ok {
    background: linear-gradient(180deg, #34d399 0%, #16a34a 100%);
    border: 1px solid rgba(134, 239, 172, 0.8);
    box-shadow: 0 0 8px rgba(34, 197, 94, 0.35);
  }

  &.is-struck {
    background: linear-gradient(180deg, #94a3b8 0%, #64748b 100%);
    border: 1px solid rgba(148, 163, 184, 0.7);
  }

  .block-label {
    font-size: 10px;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    max-width: 100%;
  }
}
</style>

<style lang="scss">
.timeline-tooltip {
  position: fixed;
  z-index: 9999;
  min-width: 220px;
  max-width: 320px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(34, 211, 238, 0.45);
  background: rgba(8, 20, 36, 0.96);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  pointer-events: none;

  .tooltip-title {
    font-size: 14px;
    font-weight: 800;
    color: #22d3ee;
    margin-bottom: 6px;
  }

  .tooltip-line {
    font-size: 12px;
    line-height: 1.6;
    color: #cbd5e1;
  }
}
</style>
