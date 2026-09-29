<template>
  <div class="zhch-metric-cell" :style="{ alignItems: alignItems }">
    <div
      class="zhch-metric-cell__value"
      :class="valueToneClass"
      :style="{ textAlign: textAlign }"
    >
      <span
        v-for="(line, lineIdx) in cellLines"
        :key="lineIdx"
        class="zhch-metric-cell__value-line"
      >
        {{ line }}
      </span>
    </div>
    <span
      v-if="showDelta && cell?.delta"
      class="zhch-metric-cell__delta"
      :class="deltaToneClass"
      :style="{ textAlign: textAlign, width: '100%' }"
    >
      {{ cell.delta }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanMetricCell, ZhchPlanMetricDeltaTone } from '@/utils/buildZhchPlanMetricsCompareTable'

const props = defineProps<{
  /** 单元格数据 */
  cell?: ZhchPlanMetricCell
  /** 是否对主值应用 valueTone 着色 */
  applyValueTone?: boolean
  /** 是否展示差值行 */
  showDelta?: boolean
  /** 内容水平对齐（与表头列对齐） */
  align?: 'start' | 'center' | 'end'
}>()

const alignItems = computed(() => {
  const map = { start: 'flex-start', center: 'center', end: 'flex-end' } as const
  return map[props.align ?? 'center']
})

const textAlign = computed((): 'left' | 'center' | 'right' => {
  const map = { start: 'left', center: 'center', end: 'right' } as const
  return map[props.align ?? 'center']
})

const cellLines = computed((): string[] => {
  const value = props.cell?.value
  if (!value) return ['--']
  return value.split('\n')
})

/**
 * 主值 tone 样式类。
 */
const valueToneClass = computed((): string | undefined => {
  if (!props.applyValueTone || !props.cell?.valueTone) return undefined
  return toneToValueClass(props.cell.valueTone)
})

/**
 * 差值 tone 样式类。
 */
const deltaToneClass = computed((): string => {
  return toneToDeltaClass(props.cell?.deltaTone)
})

const toneToValueClass = (tone: ZhchPlanMetricDeltaTone): string => {
  if (tone === 'neutral') return ''
  return `zhch-metric-cell__value--${tone}`
}

const toneToDeltaClass = (tone?: ZhchPlanMetricDeltaTone): string => {
  if (!tone || tone === 'neutral') return 'zhch-metric-cell__delta--neutral'
  return `zhch-metric-cell__delta--${tone}`
}
</script>

<style lang="scss" scoped>
.zhch-metric-cell {
  display: flex;
  flex-direction: column;
  align-items: inherit;
  gap: 3px;
  min-width: 0;
  width: 100%;
}

.zhch-metric-cell__value {
  display: flex;
  flex-direction: column;
  gap: 2px;
  word-break: break-word;
  text-align: inherit;
  width: 100%;
  max-width: 100%;
}

.zhch-metric-cell__value-line {
  display: block;
  width: 100%;
}

.zhch-metric-cell__value--favorable {
  color: #4ade80;
  font-weight: 700;
}

.zhch-metric-cell__value--adverse {
  color: #f87171;
  font-weight: 700;
}

.zhch-metric-cell__value--warning {
  color: #fbbf24;
  font-weight: 700;
}

.zhch-metric-cell__delta {
  display: block;
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  word-break: break-word;
  white-space: normal;

  &--neutral {
    color: #94a3b8;
  }

  &--favorable {
    color: #4ade80;
  }

  &--adverse {
    color: #f87171;
  }

  &--warning {
    color: #fbbf24;
  }
}
</style>
