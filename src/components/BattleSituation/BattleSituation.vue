<template>
  <div class="battle-situation-container">
    <!-- 1. 地球底图 + 当前场景区域标记 -->
    <div class="map-globe-layer">
      <BattleSituationGlobe ref="globeRef" :satellites="globeSatellites" :weapons="globeWeapons"
        :ground-targets="globeGroundTargets" :current-time-ms="currentTimeMs" :selected-norad="selectedNorad"
        :selected-weapon-id="selectedWeaponId" :selected-ground-target-key="selectedGroundTargetKey"
        :task-start-ms="taskStartMs" :task-end-ms="taskEndMs" />

      <div v-if="selectedNorad" class="globe-selected-bar">
        <span class="globe-selected-label">选中卫星：</span>
        <span class="globe-selected-name">{{ selectedSatelliteName }}</span>
        <button type="button" class="globe-clear-btn" @click="handleClearSelectedSatellite">清除</button>
      </div>

      <div v-if="selectedWeaponId" class="globe-selected-bar globe-selected-bar--weapon">
        <span class="globe-selected-label">选中武器：</span>
        <span class="globe-selected-name globe-selected-name--weapon">{{ selectedWeaponName }}</span>
        <button type="button" class="globe-clear-btn" @click="handleClearSelectedWeapon">清除</button>
      </div>

      <div v-if="selectedGroundTargetKey" class="globe-selected-bar globe-selected-bar--ground">
        <span class="globe-selected-label">{{ selectedGroundTargetBarLabel }}：</span>
        <span class="globe-selected-name globe-selected-name--ground">{{ selectedGroundTargetName }}</span>
        <button type="button" class="globe-clear-btn" @click="handleClearSelectedGroundTarget">清除</button>
      </div>
    </div>

    <!-- 2. 悬浮左侧控制面板 -->
    <div class="floating-panel floating-panel--left" :class="{ 'is-collapsed': isLeftCollapsed }">
      <div class="panel-inner">
        <C2LeftControlPanel :matrix-data="matrixData" :selected-norad="selectedNorad"
          @select-satellite="handleSelectSatellite" @task-recalculated="handleTaskRecalculated" />
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
        <C2RightAnalysisPanel :analysis-data="taskAnalysisData" :algorithm-complete="algorithmComplete"
          :analysis-loading="taskAnalysisLoading" :selected-norad="selectedNorad"
          :selected-weapon-id="selectedWeaponId" :selected-ground-target-key="selectedGroundTargetKey"
          @select-satellite="handleSelectSatellite" @select-weapon="handleSelectWeapon"
          @select-ground-target="handleSelectGroundTarget" />
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
import {
  buildBattleGlobeSatellites,
  buildBattleGlobeSatellitesFromMatrix,
} from '@/utils/buildBattleGlobeSatellites'
import {
  buildBattleGlobeWeapons,
  buildBattleGlobeWeaponsFromMatrix,
} from '@/utils/buildBattleGlobeWeapons'
import {
  buildBattleGlobeGroundTargets,
  buildBattleGlobeGroundTargetsFromMatrix,
  parseGroundTargetKey,
} from '@/utils/buildBattleGlobeGroundTargets'
import { computed, nextTick, onActivated, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleGlobeTimeline from '@/components/BattleSituation/BattleGlobeTimeline.vue'
import BattleSituationGlobe from '@/components/BattleSituation/BattleSituationGlobe.vue'
import { taskProgressMap } from '@/composables/useTaskProgressPolling'
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

/** 当前选中的武器 ID */
const selectedWeaponId = ref<string | null>(null)

/** 当前选中的地面目标键（receive: / station:） */
const selectedGroundTargetKey = ref<string | null>(null)

/** 时间轴当前时刻（毫秒） */
const currentTimeMs = ref(0)

/** 时间轴是否正在播放 */
const isTimelinePlaying = ref(false)

/** 时间轴播放倍速 */
const playbackSpeed = ref(1)

/** 播放循环句柄 */
let playbackRafId: number | null = null

/** 上一帧播放时间戳 */
let lastPlaybackFrameMs = 0

/** 选中卫星前是否正在播放（清除后用于恢复） */
let wasPlayingBeforeSelection = false

/** 算法矩阵数据 */
const matrixData = computed<MatrixResult | null>(() => store.matrixData)

/** 任务算法分析结果 */
const taskAnalysisData = computed(() => store.taskAnalysisData)

/** 任务分析结果加载状态 */
const taskAnalysisLoading = computed(() => store.taskAnalysisLoading)

/** 当前任务算法是否已完成 */
const algorithmComplete = computed(() => store.isTaskAlgorithmComplete(store.activedTask))

/** 当前任务时间范围 */
const taskTimeRange = computed(() => {
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  return { start: task.beginDate, end: task.endDate }
})

/** 任务开始时间（毫秒） */
const taskStartMs = computed(() => parseTaskTimeMs(taskTimeRange.value?.start))

/** 任务结束时间（毫秒） */
const taskEndMs = computed(() => parseTaskTimeMs(taskTimeRange.value?.end))

/** 地球渲染卫星列表（优先任务分析全量数据，兜底当前系列矩阵） */
const globeSatellites = computed(() => {
  const fromAnalysis = buildBattleGlobeSatellites(taskAnalysisData.value)
  if (fromAnalysis.length) return fromAnalysis
  return buildBattleGlobeSatellitesFromMatrix(matrixData.value)
})

/** 地球渲染武器列表（优先任务分析全量数据，兜底当前系列矩阵） */
const globeWeapons = computed(() => {
  const fromAnalysis = buildBattleGlobeWeapons(taskAnalysisData.value)
  if (fromAnalysis.length) return fromAnalysis
  return buildBattleGlobeWeaponsFromMatrix(matrixData.value)
})

/** 地球渲染接收站/数据中心列表 */
const globeGroundTargets = computed(() => {
  const fromAnalysis = buildBattleGlobeGroundTargets(taskAnalysisData.value)
  if (fromAnalysis.length) return fromAnalysis
  return buildBattleGlobeGroundTargetsFromMatrix(matrixData.value)
})

/** 地球组件引用 */
const globeRef = ref<{ restoreOverviewView: () => void } | null>(null)

/** 当前选中卫星名称 */
const selectedSatelliteName = computed(() => {
  if (!selectedNorad.value) return ''
  const fromGlobe = globeSatellites.value.find((sat) => sat.norad === selectedNorad.value)
  if (fromGlobe?.name) return fromGlobe.name
  const fromMatrix = matrixData.value?.initMatrixList?.find((sat) => sat.norad === selectedNorad.value)
  return fromMatrix?.name || `Sat-${selectedNorad.value}`
})

/** 当前选中武器名称 */
const selectedWeaponName = computed(() => {
  if (!selectedWeaponId.value) return ''
  const fromGlobe = globeWeapons.value.find((weapon) => weapon.id === selectedWeaponId.value)
  return fromGlobe?.name || selectedWeaponId.value
})

/** 当前选中地面目标名称 */
const selectedGroundTargetName = computed(() => {
  if (!selectedGroundTargetKey.value) return ''
  const parsed = parseGroundTargetKey(selectedGroundTargetKey.value)
  if (!parsed) return selectedGroundTargetKey.value
  const fromGlobe = globeGroundTargets.value.find(
    (target) => target.kind === parsed.kind && target.id === parsed.id
  )
  return fromGlobe?.name || parsed.id
})

/** 地图顶部选中条标签（接收站/数据中心） */
const selectedGroundTargetBarLabel = computed(() => {
  const parsed = parseGroundTargetKey(selectedGroundTargetKey.value)
  if (parsed?.kind === 'station') return '选中数据中心'
  return '选中接收站'
})

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
 * 启动时间轴播放循环。
 */
const startTimelinePlayback = () => {
  const start = taskStartMs.value
  const end = taskEndMs.value
  if (!start || !end || end <= start) return

  if (currentTimeMs.value >= end) {
    currentTimeMs.value = start
  }

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
 * 处理选中目标时的播放暂停逻辑。
 *
 * @param hadSelection 选中前是否已有卫星/武器选中
 * @param hasNewSelection 是否正在选中新目标
 */
const handleSelectionPlayback = (hadSelection: boolean, hasNewSelection: boolean) => {
  if (hasNewSelection && !hadSelection) {
    wasPlayingBeforeSelection = isTimelinePlaying.value
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
 * 选中武器并定位地球。
 *
 * @param weaponId 武器 ID
 */
const handleSelectWeapon = (weaponId: string | null) => {
  if (!weaponId) return

  const hadSelection = hasGlobeSelection()
  if (selectedWeaponId.value === weaponId) return

  handleSelectionPlayback(hadSelection, true)
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  selectedGroundTargetKey.value = null
  selectedWeaponId.value = weaponId
}

/**
 * 选中接收站/数据中心并定位地球。
 *
 * @param targetKey 目标键 receive: / station:
 */
const handleSelectGroundTarget = (targetKey: string | null) => {
  if (!targetKey) return

  const hadSelection = hasGlobeSelection()
  if (selectedGroundTargetKey.value === targetKey) return

  handleSelectionPlayback(hadSelection, true)
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  selectedWeaponId.value = null
  selectedGroundTargetKey.value = targetKey
}

/**
 * 清除选中卫星并恢复战场初始俯视视角。
 */
const handleClearSelectedSatellite = () => {
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  globeRef.value?.restoreOverviewView()

  if (wasPlayingBeforeSelection) {
    wasPlayingBeforeSelection = false
    startTimelinePlayback()
  }
}

/**
 * 清除选中武器并恢复战场初始俯视视角。
 */
const handleClearSelectedWeapon = () => {
  selectedWeaponId.value = null
  globeRef.value?.restoreOverviewView()

  if (wasPlayingBeforeSelection) {
    wasPlayingBeforeSelection = false
    startTimelinePlayback()
  }
}

/**
 * 清除选中地面目标并恢复战场初始俯视视角。
 */
const handleClearSelectedGroundTarget = () => {
  selectedGroundTargetKey.value = null
  globeRef.value?.restoreOverviewView()

  if (wasPlayingBeforeSelection) {
    wasPlayingBeforeSelection = false
    startTimelinePlayback()
  }
}

/**
 * 左侧面板保存并重算后：清空矩阵缓存并等待进度完成后由既有 watch 拉取分析。
 */
const handleTaskRecalculated = () => {
  void loadMatrixForCurrentScope()
}

/** 矩阵加载序号，用于丢弃过期响应 */
let matrixLoadToken = 0

/** 任务分析加载序号，用于丢弃过期响应 */
let taskAnalysisLoadToken = 0

/**
 * 按当前任务算法进度拉取分析结果。
 */
const loadTaskAnalysis = async () => {
  const loadToken = ++taskAnalysisLoadToken
  try {
    await store.fetchTaskAnalysis()
    if (loadToken !== taskAnalysisLoadToken) return
  } catch (err) {
    console.error('获取任务算法分析结果失败:', err)
  }
}

/**
 * 按当前系列筛选范围加载矩阵数据。
 */
const loadMatrixForCurrentScope = async () => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    store.clearMatrixData()
    selectedNorad.value = null
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    store.setSelectedAnalysisNorad(null)
    return
  }

  const loadToken = ++matrixLoadToken
  try {
    const data = await store.fetchMatrixForCurrentScope()
    if (loadToken !== matrixLoadToken) return
    selectedNorad.value = null
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
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
    stopTimelinePlayback()
    wasPlayingBeforeSelection = false
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    currentTimeMs.value = range ? parseTaskTimeMs(range.start) : 0
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  stopTimelinePlayback()
})

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
    if (!taskId) {
      store.clearTaskAnalysisData()
      return
    }
    if (taskId === prevTaskId) return
    void loadMatrixForCurrentScope()
    void loadTaskAnalysis()
  },
  { immediate: true }
)

/** 算法进度完成后自动拉取分析结果 */
watch(
  () => {
    const taskId = store.activedTask?.id
    if (!taskId) return ''
    const progress = taskProgressMap[taskId] ?? store.activedTask?.algorithmProgressEntity
    return `${taskId}:${progress?.totalStatus}:${progress?.transitStatus}:${progress?.threatAndStrikeStatus}`
  },
  () => {
    if (!algorithmComplete.value) return
    void loadTaskAnalysis()
  }
)

onActivated(() => {
  if (store.selectedAnalysisNorad && selectedNorad.value !== store.selectedAnalysisNorad) {
    selectedNorad.value = store.selectedAnalysisNorad
  }
  if (!store.matrixData) {
    void loadMatrixForCurrentScope()
  }
  if (!store.taskAnalysisData && algorithmComplete.value) {
    void loadTaskAnalysis()
  }
})
</script>

<style lang="scss" scoped>
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
    gap: 10px;
    max-width: min(520px, calc(100% - 32px));
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(8, 20, 36, 0.88);
    border: 1px solid rgba(0, 225, 255, 0.35);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    pointer-events: auto;
  }

  .globe-selected-label {
    font-size: 13px;
    color: #94a3b8;
    white-space: nowrap;
  }

  .globe-selected-name {
    font-size: 13px;
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

  .globe-clear-btn {
    flex-shrink: 0;
    height: 26px;
    padding: 0 12px;
    border-radius: 4px;
    border: 1px solid rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
    font-size: 12px;
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
        font-size: 13px;
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
    max-width: calc(
      100% - var(--c2-left-panel-width) - var(--c2-right-panel-width) - 2 * var(--c2-timeline-side-gap)
    );
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
