<template>
  <div class="battle-situation-container">
    <!-- 1. 地球底图 + 当前场景区域标记 -->
    <div class="map-globe-layer">
      <BattleSituationGlobe ref="globeRef" :satellites="globeSatellites" :weapons="globeWeapons"
        :ground-targets="globeGroundTargets" :current-time-ms="currentTimeMs" :selected-norad="selectedNorad"
        :selected-weapon-id="selectedWeaponId" :selected-ground-target-key="selectedGroundTargetKey"
        :task-start-ms="taskStartMs" :task-end-ms="taskEndMs" :follow-selected-satellite="false"
        :follow-selected-weapon="false" :follow-selected-ground-target="false"
        :is-timeline-playing="isTimelinePlaying" />


    </div>

    <!-- 2. 悬浮左侧控制面板 -->
    <div class="floating-panel floating-panel--left" :class="{ 'is-collapsed': isLeftCollapsed }">
      <div class="panel-inner">
        <C2LeftControlPanel :selected-norad="selectedNorad" @select-satellite="handleSelectSatellite"
          @task-recalculated="handleTaskRecalculated" />
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
        <C2RightSatelliteListPanel :selected-norad="selectedNorad" @select-satellite="handleSelectSatellite" />
      </div>
      <button type="button" class="toggle-btn toggle-btn--right" :title="isRightCollapsed ? '展开右侧面板' : '收起右侧面板'"
        @click="isRightCollapsed = !isRightCollapsed">
        <el-icon class="toggle-icon">
          <DArrowRight v-if="!isRightCollapsed" />
          <DArrowLeft v-else />
        </el-icon>
      </button>
    </div>

    <!-- 4. 任务时间轴 -->
    <div class="floating-timeline-wrapper" :class="{
      'is-collapsed': isTimelineCollapsed,
      'timeline--left-collapsed': isLeftCollapsed,
      'timeline--right-collapsed': isRightCollapsed,
    }" v-if="taskTimeRange">
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
          :current-time-ms="currentTimeMs" :is-playing="isTimelinePlaying" :playback-speed="playbackSpeed"
          @time-change="handleTimelineTimeChange" @toggle-play="handleToggleTimelinePlay"
          @speed-change="handlePlaybackSpeedChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightSatelliteListPanel from '@/components/BattleSituation/C2RightSatelliteListPanel.vue'
import BattleGlobeTimeline from '@/components/BattleSituation/BattleGlobeTimeline.vue'
import BattleSituationGlobe from '@/components/BattleSituation/BattleSituationGlobe.vue'
import { useLayoutStore } from '@/store/modules/layout'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { useBattleTaskGlobeResources } from '@/composables/useBattleTaskGlobeResources'

/** 全局布局 Store */
const store = useLayoutStore()

/** 任务挂载资源 → 地球卫星 / 地面站（`GET /battle-task/{id}/resources`） */
const { taskGlobeSatellites, taskGlobeGroundTargets, taskGlobeWeapons } = useBattleTaskGlobeResources()

/** 卫星档案弹窗 */
useSatelliteProfileDialog()

/** 左右面板及时间轴折叠状态 */
const isLeftCollapsed = ref(false)
const isRightCollapsed = ref(false)
const isTimelineCollapsed = ref(false)

/** 当前选中的卫星 NORAD（仅用于右侧面板高亮） */
const selectedNorad = ref<number | null>(null)

/** 当前选中的武器 ID */
const selectedWeaponId = ref<string | null>(null)

/** 当前选中的地面目标键（receive: / station:） */
const selectedGroundTargetKey = ref<string | null>(null)

/** 时间轴当前时刻（毫秒） */
const currentTimeMs = ref(0)


/** 时间轴是否正在播放 */
const isTimelinePlaying = ref(false)

/** 时间轴播放倍速 */
const playbackSpeed = ref(10)

/** 任务加载完成后自动播放使用的倍速 */
const AUTO_TIMELINE_PLAYBACK_SPEED = 10

/** 已对某任务触发过「加载完成自动播放」，避免重复启动 */
let autoTimelinePlaybackTaskId: string | null = null

/** 播放循环句柄 */
let playbackRafId: number | null = null

/** 上一帧播放时间戳 */
let lastPlaybackFrameMs = 0
/**
 * 计算：当前任务在界面可用的起止时间字符串。
 * 返回：`{ start, end }` 或 `null`（缺少 `beginDate`/`endDate` 时）。
 * 作用：驱动底部时间轴显隐与游标范围。
 */
const taskTimeRange = computed(() => {
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  return { start: task.beginDate, end: task.endDate }
})

/**
 * 计算：任务开始时刻的毫秒时间戳。
 * 返回：number（无效或缺失时为 0）。
 * 作用：传给地球与时间轴作为区间起点。
 */
const taskStartMs = computed(() => parseTaskTimeMs(taskTimeRange.value?.start))

/**
 * 计算：任务结束时刻的毫秒时间戳。
 * 返回：number（无效或缺失时为 0）。
 * 作用：传给地球与时间轴作为区间终点。
 */
const taskEndMs = computed(() => parseTaskTimeMs(taskTimeRange.value?.end))

/**
 * 计算：地球组件所需的卫星列表。
 * 返回：`BattleGlobeSatellite[]`（优先任务分析，否则当前矩阵）。
 * 作用：绑定 `BattleSituationGlobe` 的 `satellites`。
 */
const globeSatellites = computed(() => taskGlobeSatellites.value)

/**
 * 计算：地球组件所需的武器列表。
 * 返回：武器行数组（优先任务分析，否则当前矩阵）。
 * 作用：绑定 `BattleSituationGlobe` 的 `weapons`。
 */
const globeWeapons = computed(() => taskGlobeWeapons.value)

/**
 * 计算：地球组件所需的接收站与数据中心列表。
 * 返回：地面目标数组（优先任务分析，否则当前矩阵）。
 * 作用：绑定 `BattleSituationGlobe` 的 `ground-targets`。
 */
const globeGroundTargets = computed(() => taskGlobeGroundTargets.value)

/** 地球组件引用 */
const globeRef = ref<{ restoreOverviewView: () => void } | null>(null)



/**
 * 当前是否存在任意地图选中目标。
 *
 * @returns 是否已有选中项
 */
const hasGlobeSelection = (): boolean =>
  selectedNorad.value != null ||
  selectedWeaponId.value != null ||
  selectedGroundTargetKey.value != null

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
  stopTimelinePlayback()
  currentTimeMs.value = ms
}

/**
 * 停止时间轴播放循环。
 */
const stopTimelinePlayback = () => {
  isTimelinePlaying.value = false
  if (playbackRafId != null) {
    cancelAnimationFrame(playbackRafId)
    playbackRafId = null
  }
}

/**
 * 启动时间轴播放循环，并将地球相机恢复到战场初始俯视视角。
 */
const startTimelinePlayback = () => {
  const start = taskStartMs.value
  const end = taskEndMs.value
  if (!start || !end || end <= start) return

  if (currentTimeMs.value >= end) {
    currentTimeMs.value = start
  }

  globeRef.value?.restoreOverviewView()

  isTimelinePlaying.value = true
  lastPlaybackFrameMs = performance.now()

  const tick = (now: number) => {
    if (!isTimelinePlaying.value) return

    const delta = now - lastPlaybackFrameMs
    lastPlaybackFrameMs = now
    const next = currentTimeMs.value + delta * playbackSpeed.value

    if (next >= end) {
      currentTimeMs.value = end
      stopTimelinePlayback()
      return
    }

    currentTimeMs.value = next
    playbackRafId = requestAnimationFrame(tick)
  }

  playbackRafId = requestAnimationFrame(tick)
}

/**
 * 切换时间轴播放/暂停。
 */
const handleToggleTimelinePlay = () => {
  if (isTimelinePlaying.value) {
    stopTimelinePlayback()
    return
  }
  startTimelinePlayback()
}

/**
 * 更新时间轴播放倍速。
 *
 * @param speed 播放倍速
 */
const handlePlaybackSpeedChange = (speed: number) => {
  playbackSpeed.value = speed
}

/**
 * 当前任务具备有效时间范围后，以 10 倍速自动播放时间轴（每任务仅一次，重算或换任务后重置）。
 * 不等待算法分析完成；进入整体态势或任务就绪时应默认处于播放态。
 */
const tryStartAutoTimelinePlayback = () => {
  const taskId = store.activedTask?.id
  if (!taskId) return
  if (autoTimelinePlaybackTaskId === taskId) return
  if (hasGlobeSelection()) return

  const start = taskStartMs.value
  const end = taskEndMs.value
  if (!start || !end || end <= start) return

  autoTimelinePlaybackTaskId = taskId
  playbackSpeed.value = AUTO_TIMELINE_PLAYBACK_SPEED
  stopTimelinePlayback()
  currentTimeMs.value = start
  nextTick(() => startTimelinePlayback())
}

/**
 * 处理选中目标时的播放暂停逻辑。
 *
 * @param hadSelection 选中前是否已有卫星/武器选中
 * @param hasNewSelection 是否正在选中新目标
 */
const handleSelectionPlayback = (hadSelection: boolean, hasNewSelection: boolean) => {
  if (hasNewSelection && !hadSelection) {
    if (isTimelinePlaying.value) {
      stopTimelinePlayback()
    }
    return
  }
  if (hasNewSelection && isTimelinePlaying.value) {
    stopTimelinePlayback()
  }
}

/**
 * 选中/取消选中卫星（仅同步面板状态）。
 *
 * @param norad 卫星 NORAD；null 表示取消
 */
const handleSelectSatellite = async (norad: number | null) => {
  const previousNorad = selectedNorad.value
  const hadSelection = hasGlobeSelection()

  if (norad != null && previousNorad === norad) {
    selectedNorad.value = null
    store.setSelectedAnalysisNorad(null)
    await nextTick()
    selectedNorad.value = norad
    store.setSelectedAnalysisNorad(norad)
    return
  }

  if (norad != null) {
    handleSelectionPlayback(hadSelection, true)
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
  }

  selectedNorad.value = norad
  store.setSelectedAnalysisNorad(norad)
}



/**
 * 左侧面板保存并重算后：等待进度完成后由既有 watch 拉取任务分析。
 */
const handleTaskRecalculated = () => {
  autoTimelinePlaybackTaskId = null
  stopTimelinePlayback()
}

/**
 * 监听：`taskTimeRange`（任务起止时间字符串）。
 * 返回：回调不返回清理函数。
 * 作用：任务时间变更时停止播放、清空武器/地面选中并将游标置为任务开始。
 */
watch(
  taskTimeRange,
  (range) => {
    stopTimelinePlayback()
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    currentTimeMs.value = range ? parseTaskTimeMs(range.start) : 0
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopTimelinePlayback()
})

/**
 * 监听：当前激活任务 ID。
 * 返回：回调不返回清理函数。
 * 作用：换任务时重置自动播放标记、无任务时清空分析，否则重拉任务分析。
 */
watch(
  () => store.activedTask?.id,
  (taskId, prevTaskId) => {
    if (taskId !== prevTaskId) {
      autoTimelinePlaybackTaskId = null
    }
    if (!taskId) return
    if (taskId === prevTaskId) return
    selectedNorad.value = null
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    store.setSelectedAnalysisNorad(null)
  },
  { immediate: true }
)

/**
 * 监听：当前任务 ID 与任务起止时间是否可用。
 * 回调不返回清理函数。
 * 作用：进入整体态势或任务/时间范围就绪时调用 `tryStartAutoTimelinePlayback`（含 immediate 首次执行）。
 */
watch(
  () => [store.activedTask?.id, taskStartMs.value, taskEndMs.value] as const,
  () => {
    tryStartAutoTimelinePlayback()
  },
  { immediate: true },
)

onActivated(() => {
  if (store.selectedAnalysisNorad && selectedNorad.value !== store.selectedAnalysisNorad) {
    selectedNorad.value = store.selectedAnalysisNorad
  }
  tryStartAutoTimelinePlayback()
})
</script>

<style lang="scss" scoped>
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.battle-situation-container {
  --c2-left-panel-width: 440px;
  --c2-right-panel-width: 500px;
  --c2-timeline-side-gap: 24px;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0b1528;

  .map-globe-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    background: #020617;
  }

  .globe-selected-bar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(860px, calc(100% - 32px));
    flex-wrap: wrap;
    justify-content: center;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(8, 20, 36, 0.88);
    border: 1px solid rgba(0, 225, 255, 0.35);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
  }

  .globe-selected-label {
    font-size: battleUi.$battle-ui-font-base;
    color: #94a3b8;
    white-space: nowrap;
  }

  .globe-selected-name {
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 700;
    color: #fbbf24;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .globe-selected-bar--weapon {
    border-color: rgba(248, 113, 113, 0.45);
  }

  .globe-selected-bar--ground {
    border-color: rgba(34, 211, 238, 0.45);
  }

  .globe-selected-name--weapon {
    color: #f87171;
  }

  .globe-selected-name--ground {
    color: #22d3ee;
  }

  .globe-follow-check {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid rgba(0, 225, 255, 0.28);
    background: rgba(0, 225, 255, 0.08);
    color: #7dd3fc;
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;

    input {
      margin: 0;
      accent-color: #22d3ee;
      cursor: pointer;
    }
  }

  .globe-deduction-btn {
    flex-shrink: 0;
    height: 26px;
    padding: 0 10px;
    border-radius: 4px;
    border: 1px solid rgba(52, 211, 153, 0.45);
    background: rgba(52, 211, 153, 0.12);
    color: #6ee7b7;
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: rgba(52, 211, 153, 0.24);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &--pause {
      border-color: rgba(251, 191, 36, 0.45);
      background: rgba(251, 191, 36, 0.12);
      color: #fcd34d;

      &:hover:not(:disabled) {
        background: rgba(251, 191, 36, 0.24);
      }
    }
  }

  .globe-clear-btn {
    flex-shrink: 0;
    height: 26px;
    padding: 0 12px;
    border-radius: 4px;
    border: 1px solid rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(248, 113, 113, 0.24);
      color: #ffffff;
      border-color: #f87171;
    }
  }

  .floating-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 10;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    .panel-inner {
      height: 100%;
      overflow: hidden;
      border-radius: 0;
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
        font-size: battleUi.$battle-ui-font-base;
      }

      &:hover {
        background: rgba(0, 225, 255, 0.25);
        border-color: #00e1ff;
        color: #ffffff;
      }
    }

    &--left {
      left: 0;
      width: var(--c2-left-panel-width);

      .panel-inner {
        border-left: none;
        border-top: none;
        border-bottom: none;
      }

      .toggle-btn--left {
        right: -21px;
        border-left: none;
        border-radius: 0 6px 6px 0;
      }

      &.is-collapsed {
        transform: translateX(-100%);
      }
    }

    &--right {
      right: 0;
      width: var(--c2-right-panel-width);

      .panel-inner {
        border-right: none;
        border-top: none;
        border-bottom: none;
      }

      .toggle-btn--right {
        left: -21px;
        border-right: none;
        border-radius: 6px 0 0 6px;
      }

      &.is-collapsed {
        transform: translateX(100%);
      }
    }
  }

  .floating-timeline-wrapper {
    position: absolute;
    left: calc(var(--c2-left-panel-width) + var(--c2-timeline-side-gap));
    right: calc(var(--c2-right-panel-width) + var(--c2-timeline-side-gap));
    bottom: 12px;
    z-index: 15;
    max-width: calc(100% - var(--c2-left-panel-width) - var(--c2-right-panel-width) - 2 * var(--c2-timeline-side-gap));
    display: flex;
    flex-direction: column;
    align-items: stretch;
    transition:
      transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    &.timeline--left-collapsed {
      left: var(--c2-timeline-side-gap);
      max-width: calc(100% - var(--c2-right-panel-width) - 2 * var(--c2-timeline-side-gap));
    }

    &.timeline--right-collapsed {
      right: var(--c2-timeline-side-gap);
      max-width: calc(100% - var(--c2-left-panel-width) - 2 * var(--c2-timeline-side-gap));
    }

    &.timeline--left-collapsed.timeline--right-collapsed {
      left: var(--c2-timeline-side-gap);
      right: var(--c2-timeline-side-gap);
      max-width: calc(100% - 2 * var(--c2-timeline-side-gap));
    }

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
      font-size: 12px;
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
