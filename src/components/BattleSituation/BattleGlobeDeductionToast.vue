<template>
  <div v-if="lines.length" class="globe-deduction-toast">
    <div class="globe-deduction-toast-body">
      <div class="globe-deduction-toast-left">
        <p
          v-for="(line, lineIndex) in layout.narrativeLines"
          :key="lineIndex"
          class="globe-deduction-toast-line"
        >
          <span
            v-for="(segment, segmentIndex) in line.segments"
            :key="`${lineIndex}-${segmentIndex}-${segment.text}`"
            class="globe-deduction-segment"
            :class="`globe-deduction-segment--${segment.kind}`"
          >
            {{ segment.text }}
          </span>
        </p>
      </div>

      <div v-if="hasMetrics" class="globe-deduction-toast-right">
        <div v-if="layout.metrics.threat" class="globe-deduction-metric">
          <span class="globe-deduction-metric-label">威胁度：</span>
          <span class="globe-deduction-metric-value globe-deduction-metric-value--reduce">{{ layout.metrics.threat }}</span>
        </div>
        <div v-if="layout.metrics.delay" class="globe-deduction-metric">
          <span class="globe-deduction-metric-label">链路时延：</span>
          <span class="globe-deduction-metric-value globe-deduction-metric-value--delay">{{ layout.metrics.delay }}</span>
        </div>
        <div v-if="layout.metrics.coverage" class="globe-deduction-metric">
          <span class="globe-deduction-metric-label">覆盖率：</span>
          <span class="globe-deduction-metric-value globe-deduction-metric-value--reduce">{{ layout.metrics.coverage }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  layoutDeductionToastLines,
  type DeductionToastLine,
} from '@/utils/buildSatelliteDeductionTimeline'

/**
 * 推演事件提示框：时间轴上方左右分栏展示节点消息与指标变化量。
 */
const props = defineProps<{
  /** 高亮结构化提示行 */
  lines: DeductionToastLine[]
}>()

/** 左右分栏后的展示数据 */
const layout = computed(() => layoutDeductionToastLines(props.lines))

/** 右侧是否至少有一项指标可展示 */
const hasMetrics = computed(
  () =>
    Boolean(layout.value.metrics.threat) ||
    Boolean(layout.value.metrics.delay) ||
    Boolean(layout.value.metrics.coverage)
)
</script>

<style scoped lang="scss">
.globe-deduction-toast {
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(8, 20, 36, 0.92);
  border: 1px solid rgba(0, 225, 255, 0.28);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  pointer-events: none;
  box-sizing: border-box;
}

.globe-deduction-toast-body {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 20px;
}

.globe-deduction-toast-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.globe-deduction-toast-right {
  flex-shrink: 0;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  gap: 6px;
  padding-left: 16px;
  border-left: 1px solid rgba(0, 225, 255, 0.18);
}

.globe-deduction-toast-line {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #e2e8f0;
  text-align: left;

  & + & {
    margin-top: 4px;
  }
}

.globe-deduction-metric {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
}

.globe-deduction-metric-label {
  flex-shrink: 0;
  text-align: left;
  color: #94a3b8;
}

.globe-deduction-metric-value {
  flex-shrink: 0;
  text-align: right;
  font-weight: 700;
}

.globe-deduction-metric-value--reduce {
  color: #34d399;
}

.globe-deduction-metric-value--delay {
  color: #fbbf24;
}

.globe-deduction-segment--satellite {
  color: #fbbf24;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.45);
}

.globe-deduction-segment--event {
  color: #7dd3fc;
  font-weight: 700;
}

.globe-deduction-segment--threat {
  color: #f87171;
  font-weight: 700;
}

.globe-deduction-segment--delay {
  color: #a78bfa;
  font-weight: 700;
}

.globe-deduction-segment--coverage {
  color: #34d399;
  font-weight: 700;
}

.globe-deduction-segment--time {
  color: #fde047;
  font-weight: 600;
}

.globe-deduction-segment--weapon {
  color: #fb923c;
  font-weight: 700;
}

.globe-deduction-segment--station {
  color: #22d3ee;
  font-weight: 700;
}
</style>
