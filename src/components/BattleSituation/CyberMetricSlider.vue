<template>
  <div
    ref="rootRef"
    class="cyber-metric-slider"
    :class="`is-${variant}`"
    role="slider"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="modelValue"
    :aria-label="ariaLabel"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div ref="trackRef" class="slider-track" @pointerdown="handlePointerDown">
      <span class="slider-fill" :style="{ width: `${percent}%` }" />
      <span class="slider-glow" :style="{ width: `${percent}%` }" />
      <span class="slider-thumb" :style="{ left: `${percent}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

/** 滑条配色主题。 */
export type CyberMetricSliderVariant = 'threat' | 'delay' | 'coverage'

const props = withDefaults(
  defineProps<{
    /** 当前值。 */
    modelValue: number
    /** 最小值。 */
    min?: number
    /** 最大值。 */
    max?: number
    /** 步进。 */
    step?: number
    /** 配色主题。 */
    variant?: CyberMetricSliderVariant
    /** 无障碍名称。 */
    ariaLabel?: string
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    variant: 'delay',
    ariaLabel: '指标筛选',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

/** 轨道根节点，用于把指针位置换算成百分比。 */
const trackRef = ref<HTMLElement | null>(null)
/** 组件根节点。 */
const rootRef = ref<HTMLElement | null>(null)
/** 是否正在拖拽。 */
const dragging = ref(false)

/**
 * 当前值在轨道上的百分比（0–100）。
 */
const percent = computed(() => {
  const span = props.max - props.min
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((props.modelValue - props.min) / span) * 100))
})

/**
 * 把数值按步进对齐，并限制在 min/max 内。
 *
 * @param raw 原始数值
 * @returns 对齐后的整数或步进倍数
 */
const snapValue = (raw: number): number => {
  const stepped = Math.round(raw / props.step) * props.step
  const clamped = Math.min(props.max, Math.max(props.min, stepped))
  const precision = props.step % 1 === 0 ? 0 : String(props.step).split('.')[1]?.length || 0
  return Number(clamped.toFixed(precision))
}

/**
 * 根据指针在轨道上的 X 坐标更新值。
 *
 * @param clientX 指针横坐标
 */
const updateFromClientX = (clientX: number) => {
  const track = trackRef.value
  if (!track) return
  const rect = track.getBoundingClientRect()
  const ratio = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width
  const next = snapValue(props.min + ratio * (props.max - props.min))
  if (next !== props.modelValue) {
    emit('update:modelValue', next)
  }
}

/**
 * 结束拖拽并释放指针捕获。
 *
 * @param event 指针事件
 */
const stopDragging = (event: PointerEvent) => {
  dragging.value = false
  const target = event.currentTarget as HTMLElement | null
  if (target?.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  window.removeEventListener('pointermove', handleWindowMove)
  window.removeEventListener('pointerup', handleWindowUp)
}

/**
 * 窗口级拖拽移动（防止指针移出轨道后丢失）。
 *
 * @param event 指针移动事件
 */
const handleWindowMove = (event: PointerEvent) => {
  if (!dragging.value) return
  updateFromClientX(event.clientX)
}

/**
 * 窗口级松开结束拖拽。
 *
 * @param event 指针抬起事件
 */
const handleWindowUp = (event: PointerEvent) => {
  stopDragging(event)
}

/**
 * 在轨道上按下：跳转到点击位置并开始拖拽。
 *
 * @param event 指针按下事件
 */
const handlePointerDown = (event: PointerEvent) => {
  event.preventDefault()
  dragging.value = true
  rootRef.value?.focus()
  updateFromClientX(event.clientX)
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
  window.addEventListener('pointermove', handleWindowMove)
  window.addEventListener('pointerup', handleWindowUp)
}

/**
 * 左右方向键微调数值。
 *
 * @param event 键盘事件
 */
const handleKeydown = (event: KeyboardEvent) => {
  let next = props.modelValue
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    next = snapValue(props.modelValue - props.step)
  } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    next = snapValue(props.modelValue + props.step)
  } else if (event.key === 'Home') {
    next = props.min
  } else if (event.key === 'End') {
    next = props.max
  } else {
    return
  }
  event.preventDefault()
  emit('update:modelValue', next)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', handleWindowMove)
  window.removeEventListener('pointerup', handleWindowUp)
})
</script>

<style scoped lang="scss">
.cyber-metric-slider {
  --slider-accent: #00e1ff;
  --slider-accent-soft: rgba(0, 225, 255, 0.28);
  width: 100%;
  outline: none;
  padding: 10px 8px 12px 2px;
  box-sizing: border-box;
  cursor: pointer;
  user-select: none;
  touch-action: none;

  &.is-threat {
    --slider-accent: #f87171;
    --slider-accent-soft: rgba(248, 113, 113, 0.32);
  }

  &.is-delay {
    --slider-accent: #00e1ff;
    --slider-accent-soft: rgba(0, 225, 255, 0.32);
  }

  &.is-coverage {
    --slider-accent: #fbbf24;
    --slider-accent-soft: rgba(251, 191, 36, 0.32);
  }

  &:focus-visible .slider-thumb {
    box-shadow:
      0 0 0 3px rgba(8, 15, 26, 0.9),
      0 0 12px var(--slider-accent);
  }
}

.slider-track {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(18, 36, 62, 0.95), rgba(8, 20, 36, 0.95));
  box-shadow:
    inset 0 0 0 1px rgba(0, 225, 255, 0.18),
    inset 0 1px 4px rgba(0, 0, 0, 0.45);
}

.slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--slider-accent) 45%, #08202c), var(--slider-accent));
  pointer-events: none;
}

.slider-glow {
  position: absolute;
  left: 0;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  border-radius: 999px;
  background: var(--slider-accent);
  box-shadow: 0 0 10px var(--slider-accent);
  opacity: 0.85;
  pointer-events: none;
}

.slider-thumb {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 12px;
  margin-left: -4px;
  transform: translateY(-50%);
  border-radius: 2px;
  background: #f8fbff;
  border: 1px solid var(--slider-accent);
  box-shadow:
    0 0 0 1px var(--slider-accent-soft),
    0 0 6px var(--slider-accent);
  pointer-events: none;
}
</style>
