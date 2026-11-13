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

/**
 * 计算：将 props.align 映射为 CSS flex align-items 取值。
 * 返回：'flex-start' | 'center' | 'flex-end'；未传 align 时按 center。
 * 作用：单元格内容垂直对齐样式。
 */
const alignItems = computed(() => {
  const map = { start: 'flex-start', center: 'center', end: 'flex-end' } as const
  return map[props.align ?? 'center']
})

/**
 * 计算：将 props.align 映射为文本 text-align 取值。
 * 返回：'left' | 'center' | 'right'；未传 align 时按 center。
 * 作用：单元格主值与差值文本水平对齐。
 */
const textAlign = computed((): 'left' | 'center' | 'right' => {
  const map = { start: 'left', center: 'center', end: 'right' } as const
  return map[props.align ?? 'center']
})

/**
 * 计算：将 props.cell.value 按换行拆分为展示行，空值时为 ['--']。
 * 返回：string[]。
 * 作用：多行主值文本渲染。
 */
const cellLines = computed((): string[] => {
  const value = props.cell?.value
  if (!value) return ['--']
  return value.split('\n')
})

/**
 * 计算：在 applyValueTone 且 cell 含 valueTone 时将色调映射为样式类名。
 * 返回：string | undefined；不应用色调时为 undefined。
 * 作用：主数值涨跌/中性配色。
 */
const valueToneClass = computed((): string | undefined => {
  if (!props.applyValueTone || !props.cell?.valueTone) return undefined
  return toneToValueClass(props.cell.valueTone)
})

/**
 * 计算：根据 props.cell?.deltaTone 映射差值行样式类（缺省为 neutral）。
 * 返回：string。
 * 作用：差值文字颜色与语义样式。
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
