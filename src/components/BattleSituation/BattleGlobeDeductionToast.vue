<template>
  <div v-if="lines.length" class="globe-deduction-toast">
    <p v-for="(line, lineIndex) in lines" :key="lineIndex" class="globe-deduction-toast-line">
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
</template>

<script setup lang="ts">
import type { DeductionToastLine } from '@/utils/buildSatelliteDeductionTimeline'

/**
 * 推演事件提示框：在时间轴上方展示带高亮的关键指标。
 */
defineProps<{
  /** 高亮结构化提示行 */
  lines: DeductionToastLine[]
}>()
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

.globe-deduction-toast-line {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #e2e8f0;
  text-align: center;

  & + & {
    margin-top: 4px;
  }
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
