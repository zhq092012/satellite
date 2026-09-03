<template>
  <div ref="viewportRef" class="virtual-scroll-list" @scroll.passive="handleScroll">
    <div class="virtual-scroll-list__spacer" :style="{ height: `${totalHeight}px` }">
      <div class="virtual-scroll-list__window" :style="{ transform: `translateY(${offsetY}px)` }">
        <div
          v-for="entry in visibleEntries"
          :key="entry.key"
          class="virtual-scroll-list__item"
          :style="{ height: `${entry.height}px` }"
        >
          <slot :item="entry.item" :index="entry.index" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
/**
 * 虚拟列表。默认固定行高；传入 `getItemHeight` 后按条目动态行高计算偏移。
 *
 * 父级必须是 `position: relative` 且具有明确高度（通常 `flex: 1; min-height: 0`），
 * 本组件会绝对填充该视口，避免被内部 spacer 撑开后无法滚动。
 */
import { computed, nextTick, onActivated, onMounted, onBeforeUnmount, ref, watch } from 'vue'

/**
 * 虚拟列表可视窗口中的单条渲染数据。
 */
export interface VirtualScrollEntry<T> {
  /** 原始数据 */
  item: T
  /** 在完整列表中的下标 */
  index: number
  /** 稳定渲染 key */
  key: string | number
  /** 本条占用高度（含间距），单位 px */
  height: number
}

const props = withDefaults(
  defineProps<{
    /** 完整数据源 */
    items: T[]
    /** 默认单行占用高度（含间距），单位 px；未提供 getItemHeight 时使用 */
    itemHeight: number
    /** 按条目返回行高；用于 TOP 推荐卡与普通卡混排 */
    getItemHeight?: (item: T, index: number) => number
    /** 从 item 上读取 key 的字段名；不传则使用下标 */
    itemKey?: string
    /** 视口上下额外渲染的行数 */
    overscan?: number
  }>(),
  {
    itemKey: '',
    overscan: 6,
  }
)

defineSlots<{
  default(props: { item: T; index: number }): unknown
}>()

const viewportRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

/**
 * 解析单条高度。
 *
 * @param item 列表项
 * @param index 下标
 * @returns 行高（至少 1px）
 */
const resolveItemHeight = (item: T, index: number): number => {
  const custom = props.getItemHeight?.(item, index)
  if (custom != null && Number.isFinite(custom) && custom > 0) return custom
  return Math.max(1, props.itemHeight)
}

/**
 * 前缀高度表：offsets[i] 为前 i 条的累计高度，长度为 n+1。
 * 固定行高时不构建完整表，仅在取值函数中按乘法计算。
 */
const itemOffsets = computed(() => {
  if (!props.getItemHeight) return null
  const items = props.items
  const offsets = new Array<number>(items.length + 1)
  offsets[0] = 0
  for (let i = 0; i < items.length; i += 1) {
    offsets[i + 1] = offsets[i] + resolveItemHeight(items[i], i)
  }
  return offsets
})

/**
 * 读取第 index 条顶部相对列表的偏移。
 *
 * @param index 条目下标
 * @returns 顶部偏移 px
 */
const getOffsetTop = (index: number): number => {
  const offsets = itemOffsets.value
  if (offsets) return offsets[Math.max(0, Math.min(index, offsets.length - 1))] || 0
  return Math.max(0, index) * Math.max(1, props.itemHeight)
}

/** 列表总高度，撑开滚动条。 */
const totalHeight = computed(() => {
  const offsets = itemOffsets.value
  if (offsets) return offsets[offsets.length - 1] || 0
  return Math.max(props.items.length * props.itemHeight, 0)
})

/**
 * 读取列表项的稳定 key。
 *
 * @param item 列表项
 * @param index 下标
 * @returns 渲染 key
 */
const resolveItemKey = (item: T, index: number): string | number => {
  if (props.itemKey && item && typeof item === 'object') {
    const value = (item as Record<string, unknown>)[props.itemKey]
    if (value != null && value !== '') return String(value)
  }
  return index
}

/**
 * 在前缀和中查找第一个尚未完全滚出视口顶部的条目。
 *
 * @param offsets 前缀高度表
 * @param top 当前 scrollTop
 * @returns 起始下标
 */
const findStartIndex = (offsets: number[], top: number): number => {
  let low = 0
  let high = Math.max(0, offsets.length - 2)
  while (low < high) {
    const mid = (low + high) >> 1
    if (offsets[mid + 1] <= top) low = mid + 1
    else high = mid
  }
  return low
}

/** 当前需要挂载的可视窗口条目。 */
const visibleEntries = computed<VirtualScrollEntry<T>[]>(() => {
  const count = props.items.length
  if (!count) return []

  const offsets = itemOffsets.value
  let start: number
  let end: number

  if (offsets) {
    start = Math.max(0, findStartIndex(offsets, scrollTop.value) - props.overscan)
    const viewBottom = scrollTop.value + Math.max(viewportHeight.value, 1)
    end = start
    while (end < count && offsets[end] < viewBottom) end += 1
    end = Math.min(count, end + props.overscan)
  } else {
    const itemHeight = Math.max(1, props.itemHeight)
    start = Math.max(0, Math.floor(scrollTop.value / itemHeight) - props.overscan)
    const visibleCount = Math.ceil(viewportHeight.value / itemHeight) + props.overscan * 2
    end = Math.min(count, start + Math.max(visibleCount, 1))
  }

  const entries: VirtualScrollEntry<T>[] = []
  for (let index = start; index < end; index += 1) {
    const item = props.items[index]
    entries.push({
      item,
      index,
      key: resolveItemKey(item, index),
      height: resolveItemHeight(item, index),
    })
  }
  return entries
})

/** 可视窗口相对列表顶部的偏移。 */
const offsetY = computed(() => {
  if (!visibleEntries.value.length) return 0
  return getOffsetTop(visibleEntries.value[0].index)
})

/** 同步视口高度，供可视窗口计算使用。 */
const syncViewportHeight = () => {
  viewportHeight.value = viewportRef.value?.clientHeight || 0
}

/** 记录滚动位置。 */
const handleScroll = () => {
  scrollTop.value = viewportRef.value?.scrollTop || 0
}

/**
 * 将指定 key 的条目滚入可视区。
 *
 * @param key 目标条目 key
 */
const scrollToKey = (key: string | number | null | undefined) => {
  if (key == null || key === '') return
  const index = props.items.findIndex(
    (item, itemIndex) => resolveItemKey(item, itemIndex) === String(key) || resolveItemKey(item, itemIndex) === key
  )
  if (index < 0 || !viewportRef.value) return
  const top = getOffsetTop(index)
  const height = resolveItemHeight(props.items[index], index)
  const viewBottom = viewportRef.value.scrollTop + viewportRef.value.clientHeight
  if (top < viewportRef.value.scrollTop || top + height > viewBottom) {
    viewportRef.value.scrollTo({ top, behavior: 'smooth' })
  }
}

let resizeObserver: ResizeObserver | null = null

watch(
  () => props.items.length,
  () => {
    nextTick(() => {
      syncViewportHeight()
      if (viewportRef.value && viewportRef.value.scrollTop > totalHeight.value) {
        viewportRef.value.scrollTop = 0
        scrollTop.value = 0
      }
    })
  }
)

onMounted(() => {
  syncViewportHeight()
  requestAnimationFrame(syncViewportHeight)
  if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
    resizeObserver = new ResizeObserver(() => syncViewportHeight())
    resizeObserver.observe(viewportRef.value)
  }
})

onActivated(() => {
  nextTick(syncViewportHeight)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({
  scrollToKey,
})
</script>

<style scoped>
.virtual-scroll-list {
  /* 由父级 position:relative + 明确高度约束视口，避免被 spacer 撑开后无法滚动 */
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 189, 248, 0.65) rgba(8, 20, 40, 0.9);
}

.virtual-scroll-list::-webkit-scrollbar {
  width: 8px;
}

.virtual-scroll-list::-webkit-scrollbar-thumb {
  background: rgba(56, 189, 248, 0.55);
  border-radius: 4px;
}

.virtual-scroll-list::-webkit-scrollbar-track {
  background: rgba(8, 20, 40, 0.85);
}

.virtual-scroll-list__spacer {
  position: relative;
  width: 100%;
}

.virtual-scroll-list__window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.virtual-scroll-list__item {
  box-sizing: border-box;
  overflow: visible;
}
</style>
