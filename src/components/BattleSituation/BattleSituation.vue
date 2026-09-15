<template>
  <div class="battle-situation-container" :class="{ 'has-expanded-timeline': !!taskTimeRange && !isTimelineCollapsed }">
    <!-- 1. 地图占位层（已移除 Cesium 业务逻辑） -->
    <div class="map-placeholder-layer">
      <div class="map-placeholder-content">
        <span class="map-placeholder-icon">🌐</span>
        <p class="map-placeholder-title">态势地图区域</p>
        <p class="map-placeholder-desc">地图业务已下线，保留左右面板与时间轴展示</p>
      </div>
    </div>

    <!-- 2. 悬浮左侧控制面板 -->
    <div class="floating-panel floating-panel--left" :class="{ 'is-collapsed': isLeftCollapsed }">
      <div class="panel-inner">
        <C2LeftControlPanel :matrix-data="matrixData" :selected-norad="selectedNorad"
          @select-satellite="handleSelectSatellite" />
      </div>
      <button type="button" class="toggle-btn toggle-btn--left" :title="isLeftCollapsed ? '展开左侧面板' : '收起左侧面板'"
        @click="isLeftCollapsed = !isLeftCollapsed">
        <el-icon class="toggle-icon">
          <DArrowLeft v-if="!isLeftCollapsed" />
          <DArrowRight v-else />
        </el-icon>
      </button>
    </div>

    <!-- 3. 悬浮右侧分析面板 -->
    <div class="floating-panel floating-panel--right" :class="{ 'is-collapsed': isRightCollapsed }">
      <div class="panel-inner">
        <C2RightAnalysisPanel :matrix-data="matrixData" :selected-satellite-norad="selectedNorad"
          @clear-satellite-selection="handleSelectSatellite(null)" @select-satellite="handleSelectSatellite" />
      </div>
      <button type="button" class="toggle-btn toggle-btn--right" :title="isRightCollapsed ? '展开右侧面板' : '收起右侧面板'"
        @click="isRightCollapsed = !isRightCollapsed">
        <el-icon class="toggle-icon">
          <DArrowRight v-if="!isRightCollapsed" />
          <DArrowLeft v-else />
        </el-icon>
      </button>
    </div>

    <!-- 4. 任务时间轴（纯展示，无播放） -->
    <div class="floating-timeline-wrapper" :class="{ 'is-collapsed': isTimelineCollapsed }" v-if="taskTimeRange">
      <button type="button" class="timeline-toggle-btn" :title="isTimelineCollapsed ? '展开时间轴' : '收起时间轴'"
        @click="isTimelineCollapsed = !isTimelineCollapsed">
        <el-icon class="toggle-icon">
          <ArrowUp v-if="isTimelineCollapsed" />
          <ArrowDown v-else />
        </el-icon>
        <span class="btn-text">{{ isTimelineCollapsed ? '展开时间轴' : '收起时间轴' }}</span>
      </button>

      <div class="timeline-inner">
        <BattleGlobeTimeline :task-start="taskTimeRange.start" :task-end="taskTimeRange.end"
          :current-time-ms="currentTimeMs" @time-change="handleTimelineTimeChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleGlobeTimeline from '@/components/BattleSituation/BattleGlobeTimeline.vue'
import { useLayoutStore } from '@/store/modules/layout'
import type { MatrixResult } from '@/api/electronic'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'

/** 全局布局 Store */
const store = useLayoutStore()

/** 卫星档案弹窗 */
useSatelliteProfileDialog()

/** 左右面板及时间轴折叠状态 */
const isLeftCollapsed = ref(false)
const isRightCollapsed = ref(false)
const isTimelineCollapsed = ref(false)

/** 当前选中的卫星 NORAD（仅用于右侧面板高亮） */
const selectedNorad = ref<number | null>(null)

/** 时间轴当前时刻（毫秒） */
const currentTimeMs = ref(0)

/** 算法矩阵数据 */
const matrixData = computed<MatrixResult | null>(() => store.matrixData)

/** 当前任务时间范围 */
const taskTimeRange = computed(() => {
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  return { start: task.beginDate, end: task.endDate }
})

/**
 * 解析任务时间为毫秒。
 *
 * @param value 时间字符串
 * @returns 毫秒时间戳
 */
const parseTaskTimeMs = (value?: string): number => {
  if (!value) return 0
  const ts = new Date(value.replace(/-/g, '/')).getTime()
  return Number.isFinite(ts) ? ts : 0
}

/**
 * 时间轴点击跳转：仅更新游标，不联动地图播放。
 *
 * @param ms 目标时刻
 */
const handleTimelineTimeChange = (ms: number) => {
  currentTimeMs.value = ms
}

/**
 * 选中/取消选中卫星（仅同步面板状态）。
 *
 * @param norad 卫星 NORAD；null 表示取消
 */
const handleSelectSatellite = (norad: number | null) => {
  selectedNorad.value = norad
  store.setSelectedAnalysisNorad(norad)
}

/** 矩阵加载序号，用于丢弃过期响应 */
let matrixLoadToken = 0

/**
 * 按当前系列筛选范围加载矩阵数据。
 */
const loadMatrixForCurrentScope = async () => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    store.clearMatrixData()
    selectedNorad.value = null
    store.setSelectedAnalysisNorad(null)
    return
  }

  const loadToken = ++matrixLoadToken
  try {
    const data = await store.fetchMatrixForCurrentScope()
    if (loadToken !== matrixLoadToken) return
    selectedNorad.value = null
    store.setSelectedAnalysisNorad(null)
    if (!data) {
      console.warn('当前系列矩阵加载失败')
    }
  } catch (err) {
    console.error('获取算法传输矩阵失败:', err)
  }
}

/** 任务时间变化时，游标重置到任务开始 */
watch(
  taskTimeRange,
  (range) => {
    currentTimeMs.value = range ? parseTaskTimeMs(range.start) : 0
  },
  { immediate: true }
)

/** 系列/任务变化时重新加载矩阵 */
watch(
  () => [store.selectedSatSeries, store.selectedSatType, store.activeZhchUsageType] as const,
  () => {
    void loadMatrixForCurrentScope()
  },
  { immediate: true }
)

watch(
  () => store.activedTask?.id,
  (taskId, prevTaskId) => {
    if (!taskId || taskId === prevTaskId) return
    void loadMatrixForCurrentScope()
  }
)

onActivated(() => {
  if (store.selectedAnalysisNorad && selectedNorad.value !== store.selectedAnalysisNorad) {
    selectedNorad.value = store.selectedAnalysisNorad
  }
  if (!store.matrixData) {
    void loadMatrixForCurrentScope()
  }
})
</script>

<style lang="scss" scoped>
.battle-situation-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0b1528;

  .map-placeholder-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(ellipse at 50% 40%, rgba(0, 225, 255, 0.08) 0%, transparent 55%),
      linear-gradient(180deg, #0a1628 0%, #060d18 100%);
    border: 1px solid rgba(0, 225, 255, 0.08);
  }

  .map-placeholder-content {
    text-align: center;
    color: #64748b;
    pointer-events: none;
  }

  .map-placeholder-icon {
    font-size: 48px;
    opacity: 0.35;
  }

  .map-placeholder-title {
    margin: 8px 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: #7dd3fc;
  }

  .map-placeholder-desc {
    margin: 0;
    font-size: 12px;
    color: #475569;
  }

  .floating-panel {
    position: absolute;
    top: 14px;
    bottom: 14px;
    z-index: 10;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    .panel-inner {
      height: 100%;
      overflow: hidden;
      border-radius: 8px;
      backdrop-filter: blur(16px);
      background: rgba(8, 20, 36, 0.88);
      border: 1px solid rgba(0, 225, 255, 0.28);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 16px rgba(0, 225, 255, 0.1);
    }

    .toggle-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(10, 28, 52, 0.92);
      border: 1px solid rgba(0, 225, 255, 0.35);
      color: #00e1ff;
      cursor: pointer;
      z-index: 20;
      transition: all 0.25s ease;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      outline: none;

      .toggle-icon {
        font-size: 13px;
      }

      &:hover {
        background: rgba(0, 225, 255, 0.25);
        border-color: #00e1ff;
        color: #ffffff;
      }
    }

    &--left {
      left: 14px;
      width: 440px;

      .toggle-btn--left {
        right: -21px;
        border-left: none;
        border-radius: 0 6px 6px 0;
      }

      &.is-collapsed {
        transform: translateX(calc(-100% - 14px));
      }
    }

    &--right {
      right: 14px;
      width: 450px;

      .toggle-btn--right {
        left: -21px;
        border-right: none;
        border-radius: 6px 0 0 6px;
      }

      &.is-collapsed {
        transform: translateX(calc(100% + 14px));
      }
    }
  }

  &.has-expanded-timeline {
    .floating-panel {
      bottom: 98px;
    }
  }

  .floating-timeline-wrapper {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 12px;
    z-index: 15;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    .timeline-toggle-btn {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      height: 20px;
      padding: 0 10px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(10, 28, 52, 0.92);
      border: 1px solid rgba(0, 225, 255, 0.35);
      border-bottom: none;
      border-radius: 5px 5px 0 0;
      color: #00e1ff;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      z-index: 20;

      &:hover {
        background: rgba(0, 225, 255, 0.22);
        color: #ffffff;
      }
    }

    .timeline-inner {
      border-radius: 8px;
      overflow: hidden;
      backdrop-filter: blur(14px);
      background: rgba(8, 20, 36, 0.85);
      border: 1px solid rgba(0, 225, 255, 0.28);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 16px rgba(0, 225, 255, 0.1);
    }

    &.is-collapsed {
      transform: translateY(calc(100% + 14px));
    }
  }
}
</style>
