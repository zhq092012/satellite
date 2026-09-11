<template>
  <div class="battle-situation-container" :class="{ 'has-expanded-timeline': !!taskTimeRange && !isTimelineCollapsed }">
    <!-- 1. 全屏 Cesium 3D 地球底图视图 -->
    <div class="cesium-map-layer">
      <CesiumViewer ref="cesiumViewerRef" :matrix-data="matrixData" :selected-norad="selectedNorad"
        @clock-tick="handleClockTick" />
    </div>

    <!-- 2. 顶部中央悬浮 2D/3D 模式切换栏 -->
    <div class="floating-view-mode-bar">
      <button
        type="button"
        class="view-mode-btn"
        :class="{ 'is-active': currentViewMode === '3D' }"
        title="切换至 3D 球体视角"
        @click="handleSwitchViewMode('3D')"
      >
        <span class="mode-icon">🌐</span>
        <span class="mode-label">3D 视图</span>
      </button>
      <div class="view-mode-divider"></div>
      <button
        type="button"
        class="view-mode-btn"
        :class="{ 'is-active': currentViewMode === '2D' }"
        title="切换至 2D 平面地图"
        @click="handleSwitchViewMode('2D')"
      >
        <span class="mode-icon">🗺️</span>
        <span class="mode-label">2D 平面</span>
      </button>
    </div>

    <!-- 3. 悬浮左侧控制面板（支持折叠/展开） -->
    <div class="floating-panel floating-panel--left" :class="{ 'is-collapsed': isLeftCollapsed }">
      <div class="panel-inner">
        <C2LeftControlPanel :matrix-data="matrixData" :selected-norad="selectedNorad"
          @select-satellite="handleSelectSatellite" />
      </div>
      <!-- 折叠/展开控制按钮 -->
      <button type="button" class="toggle-btn toggle-btn--left"
        :title="isLeftCollapsed ? '展开左侧面板' : '收起左侧面板'"
        @click="isLeftCollapsed = !isLeftCollapsed">
        <el-icon class="toggle-icon">
          <DArrowLeft v-if="!isLeftCollapsed" />
          <DArrowRight v-else />
        </el-icon>
      </button>
    </div>

    <!-- 4. 悬浮右侧分析面板（支持折叠/展开） -->
    <div class="floating-panel floating-panel--right" :class="{ 'is-collapsed': isRightCollapsed }">
      <div class="panel-inner">
        <C2RightAnalysisPanel :matrix-data="matrixData" :selected-satellite-norad="selectedNorad"
          :selected-transmission-link-id="selectedTransmissionLinkId"
          @clear-satellite-selection="handleSelectSatellite(null)"
          @select-transmission-link="handleSelectTransmissionLink" />
      </div>
      <!-- 折叠/展开控制按钮 -->
      <button type="button" class="toggle-btn toggle-btn--right"
        :title="isRightCollapsed ? '展开右侧面板' : '收起右侧面板'"
        @click="isRightCollapsed = !isRightCollapsed">
        <el-icon class="toggle-icon">
          <DArrowRight v-if="!isRightCollapsed" />
          <DArrowLeft v-else />
        </el-icon>
      </button>
    </div>

    <!-- 5. 悬浮下方时间轴（两侧留距离、圆角、半透明、支持向下折叠/展开） -->
    <div class="floating-timeline-wrapper" :class="{ 'is-collapsed': isTimelineCollapsed }" v-if="taskTimeRange">
      <!-- 折叠/展开控制按钮 -->
      <button type="button" class="timeline-toggle-btn"
        :title="isTimelineCollapsed ? '展开时间轴' : '收起时间轴'"
        @click="isTimelineCollapsed = !isTimelineCollapsed">
        <el-icon class="toggle-icon">
          <ArrowUp v-if="isTimelineCollapsed" />
          <ArrowDown v-else />
        </el-icon>
        <span class="btn-text">{{ isTimelineCollapsed ? '展开时间轴' : '收起时间轴' }}</span>
      </button>

      <div class="timeline-inner">
        <BattleGlobeTimeline :task-start="taskTimeRange.start" :task-end="taskTimeRange.end"
          :matrix-data="matrixData" :selected-norad="selectedNorad" :force-task-mode="!!selectedTransmissionLinkId"
          :current-time-ms="currentClockMs" :is-playing="isClockPlaying" :playback-speed="orbitPlaybackSpeed"
          @time-change="handleTimelineTimeChange" @toggle-play="handleTogglePlay"
          @speed-change="handleSpeedChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleGlobeTimeline from '@/components/BattleSituation/BattleGlobeTimeline.vue'
import { useLayoutStore } from '@/store/modules/layout'
import type { MatrixResult } from '@/api/electronic'
import {
  collectSatelliteTransmissionLinks,
  resolveTaskEndMs,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'

/** [变量说明] 全局布局 Store */
const store = useLayoutStore()

/** [Hook 引入] 卫星档案弹窗 */
useSatelliteProfileDialog()

/** [变量说明] 左右面板及时间轴折叠状态 */
const isLeftCollapsed = ref(false)
const isRightCollapsed = ref(false)
const isTimelineCollapsed = ref(false)

/** [变量说明] 当前视图模式（3D 球体视图 / 2D 平面地图） */
const currentViewMode = ref<'3D' | '2D'>('3D')

/**
 * 切换 2D / 3D 视图模式
 */
const handleSwitchViewMode = (mode: '3D' | '2D') => {
  if (currentViewMode.value === mode) return
  currentViewMode.value = mode
  cesiumViewerRef.value?.setSceneMode(mode)
}

/** [变量说明] 3D Cesium Viewer 组件实例引用 */
const cesiumViewerRef = ref<InstanceType<typeof CesiumViewer> | null>(null)

/** [变量说明] 当前选中的敌方卫星 NORAD 编号 (默认未选中任何卫星为 null，代表静态视图定位战场) */
const selectedNorad = ref<number | null>(null)

/** 当前选中的传输链路 ID（右侧面板点击链路时高亮并绘制地图连线） */
const selectedTransmissionLinkId = ref<string | null>(null)
/** 当前手动选中的传输链路（仅点击右侧面板链路时在地图上绘制） */
const selectedTransmissionLink = ref<SatelliteTransmissionLink | null>(null)

/** 地球时钟当前时刻（毫秒），用于轨道仿真时间轴游标 */
const currentClockMs = ref<number>(0)

/** 地球时钟当前播放/暂停状态 */
const isClockPlaying = ref<boolean>(true)
/** TLE轨道仿真播放倍率，单位为仿真秒/现实秒。 */
const orbitPlaybackSpeed = ref(120)

/** [计算属性说明] 全局共享的侦察/打击算法矩阵结果 */
const matrixData = computed<MatrixResult | null>(() => store.matrixData)

/** 当前任务时间范围 */
const taskTimeRange = computed(() => {
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  return { start: task.beginDate, end: task.endDate }
})

const handleTimelineTimeChange = (ms: number) => {
  cesiumViewerRef.value?.setClockTime(ms)
  currentClockMs.value = ms
}

/**
 * 切换 Cesium 轨道仿真播放/暂停
 */
const handleTogglePlay = (playing?: boolean) => {
  const nextState = typeof playing === 'boolean' ? playing : !isClockPlaying.value
  isClockPlaying.value = nextState
  const viewer = cesiumViewerRef.value
  if (!viewer) return

  if (nextState && selectedTransmissionLink.value) {
    clearTransmissionLinkSelection()
  }

  if (nextState) {
    const endMs = taskTimeRange.value ? new Date(taskTimeRange.value.end.replace(/-/g, '/')).getTime() : 0
    const startMs = taskTimeRange.value ? new Date(taskTimeRange.value.start.replace(/-/g, '/')).getTime() : 0
    if (endMs && currentClockMs.value >= endMs - 1000 && startMs) {
      viewer.setClockTime(startMs)
      currentClockMs.value = startMs
    }
    viewer.setClockPlaying(true, orbitPlaybackSpeed.value)
  } else {
    viewer.setClockPlaying(false)
  }
}

/** 更新TLE轨道仿真播放倍率，并立即作用于当前时钟。 */
const handleSpeedChange = (speed: number) => {
  orbitPlaybackSpeed.value = speed
  cesiumViewerRef.value?.setClockPlaying(isClockPlaying.value, speed)
}

/**
 * 接收 Cesium 时钟 Tick，同步轨道仿真时间轴游标
 * @param ms 当前时钟毫秒时间戳
 */
const handleClockTick = (ms: number) => {
  if (!selectedNorad.value) {
    currentClockMs.value = ms
  }
}

/**
 * 根据是否选中卫星或传输链路，切换地球时钟模式：
 * - 均未选中：TLE 轨道仿真动画
 * - 已选中：暂停动画，使用任务时间标尺
 */
const syncGlobeTimeMode = () => {
  nextTick(() => {
    if (!cesiumViewerRef.value) return
    if (selectedNorad.value || selectedTransmissionLinkId.value) {
      cesiumViewerRef.value.pauseClockAnimation()
      isClockPlaying.value = false
      const clockMs = cesiumViewerRef.value.getClockTimeMs?.()
      if (clockMs) currentClockMs.value = clockMs
    } else {
      cesiumViewerRef.value.startTleOrbitAnimation?.()
      cesiumViewerRef.value.setClockPlaying?.(true, orbitPlaybackSpeed.value)
      isClockPlaying.value = true
      const clockMs = cesiumViewerRef.value.getClockTimeMs?.()
      if (clockMs) currentClockMs.value = clockMs
    }
  })
}

/**
 * 清除传输链路选中态，恢复地图连线、时间轴播放，并将相机飞回战场原始视角。
 */
const clearTransmissionLinkSelection = () => {
  selectedTransmissionLinkId.value = null
  selectedTransmissionLink.value = null
  cesiumViewerRef.value?.clearTransmissionLinkOverlay?.()
  cesiumViewerRef.value?.flyToBattleView?.()
  syncGlobeTimeMode()
}

/**
 * 选中/取消选中传输链路：在 Cesium 上绘制淡黄色虚线，时间轴跳转到链路起始时刻并暂停；
 * 取消选中时清除连线并恢复 TLE 轨道仿真播放。
 * @param link 选中的链路；传 null 表示取消选中
 */
const handleSelectTransmissionLink = (link: SatelliteTransmissionLink | null) => {
  if (!link) {
    clearTransmissionLinkSelection()
    return
  }

  selectedTransmissionLinkId.value = link.id
  selectedTransmissionLink.value = link
  isClockPlaying.value = false
  const viewer = cesiumViewerRef.value
  if (!viewer) return

  viewer.pauseClockAnimation()
  viewer.initTaskClock?.()
  viewer.setClockTime(link.transmitStartMs)
  currentClockMs.value = link.transmitStartMs

  nextTick(() => {
    viewer.showTransmissionLink?.(link)
    viewer.flyToLinkBoundingSphere?.(link)
  })
}

/**
 * 按当前系列筛选范围加载矩阵：有系列时加载单系列，无系列时合并全部系列。
 */
let matrixLoadToken = 0
/**
 * 这个函数在当前任务或选中系列发生变更时调用，重新加载算法矩阵数据。
 * - 若当前任务未选中，则清空矩阵数据与选中卫星。 
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
    selectedTransmissionLinkId.value = null
    selectedTransmissionLink.value = null

    nextTick(() => {
      if (loadToken !== matrixLoadToken) return
      cesiumViewerRef.value?.clearTransmissionLinkOverlay?.()
      markBattleArea()
      cesiumViewerRef.value?.refreshAfterActivate?.()
      syncGlobeTimeMode()
    })

    if (!data) {
      console.warn('当前系列矩阵加载失败，保留已有地图数据')
    }
  } catch (err) {
    console.error('获取算法传输矩阵失败:', err)
  }
}

/**
 * [函数说明]
 * 手动选择/取消选择某颗敌方卫星。
 * - 当在左侧面板或 3D 地球点击选择具体卫星时，相机视角定位该卫星并开启视角跟随。
 * - 当取消选择时，相机重新定位至战场中心。
 *
 * @param norad 选中的敌方卫星 NORAD 编号 (取消选择时为 null)
 */
const handleSelectSatellite = (norad: number | null) => {
  if (selectedTransmissionLinkId.value) {
    selectedTransmissionLinkId.value = null
    selectedTransmissionLink.value = null
    cesiumViewerRef.value?.clearTransmissionLinkOverlay?.()
  }

  selectedNorad.value = norad
  store.setSelectedAnalysisNorad(norad)
  const taskId = store.activedTask?.id

  // 1. 未选择卫星/取消选择 (相机定位战场，恢复 TLE 轨道仿真)
  if (!norad || !taskId) {
    if (cesiumViewerRef.value) {
      cesiumViewerRef.value.markBattle()
    }
    syncGlobeTimeMode()
    return
  }

  // 2. 选中具体卫星：先暂停轨道仿真并同步任务时刻，再飞赴定位（须在时间轴同步之后）
  syncGlobeTimeMode()
  scheduleFlyToSelectedSatellite(norad)
}

/**
 * 在任务时间轴完成时刻同步后，再执行卫星高亮与相机定位：
 * - 若右侧有传输链路：高亮卫星，相机定位到右侧第一个链路的包围球；
 * - 若右侧没有传输链路：只是高亮卫星，不做其他处理。
 * @param norad 目标卫星 NORAD
 */
const scheduleFlyToSelectedSatellite = (norad: number) => {
  nextTick(() => {
    const viewer = cesiumViewerRef.value
    if (!viewer) return

    const matrix = store.matrixData
    const links = collectSatelliteTransmissionLinks(matrix, norad, resolveTaskEndMs(store.activedTask?.endDate))

    if (links && links.length > 0) {
      viewer.highlightSatellite({ norad_id: String(norad) }, true)
      viewer.flyToLinkBoundingSphere?.(links[0])
    } else {
      viewer.highlightSatellite({ norad_id: String(norad) })
    }
  })
}

/**
 * [监听器说明]
 * 监听 3D 地球中鼠标点击选中的卫星状态，自动触发相机定位与跟随
 */
watch(
  () => store.selectedSatellite,
  (newSat) => {
    if (newSat) {
      const norad = Number(newSat.norad || (newSat as any).norad_id)
      if (Number.isFinite(norad) && selectedNorad.value !== norad) {
        void handleSelectSatellite(norad)
      }
    } else {
      handleSelectSatellite(null)
    }
  }
)

/**
 * [监听器说明]
 * 监听选中的卫星系列变更。
 * 选择系列后，重新查询对应的算法矩阵，并从已查询出的矩阵中加载地面站、数据中心及天基传输资产。
 */
watch(
  () => [store.selectedSatSeries, store.selectedSatType, store.activeZhchUsageType] as const,
  () => {
    void loadMatrixForCurrentScope()
  },
  { immediate: true }
)

/**
 * [函数说明]
 * 标记战场区域网格与交互实体
 */
function markBattleArea() {
  if (store.activedTask) {
    cesiumViewerRef.value?.markBattle()
  }
}

onMounted(() => {
  nextTick(() => {
    markBattleArea()
    syncGlobeTimeMode()
  })
})

onActivated(() => {
  nextTick(() => {
    markBattleArea()
    if (store.selectedAnalysisNorad) {
      if (selectedNorad.value !== store.selectedAnalysisNorad) {
        selectedNorad.value = store.selectedAnalysisNorad
      }
      scheduleFlyToSelectedSatellite(store.selectedAnalysisNorad)
    } else if (selectedNorad.value != null) {
      selectedNorad.value = null
      cesiumViewerRef.value?.markBattle()
      syncGlobeTimeMode()
    }
    cesiumViewerRef.value?.refreshAfterActivate?.()
    cesiumViewerRef.value?.setOurWeaponsVisible?.(true)
    if (store.matrixData) {
      if (selectedNorad.value) {
        scheduleFlyToSelectedSatellite(selectedNorad.value)
      } else {
        cesiumViewerRef.value?.markBattle()
      }
    } else {
      void loadMatrixForCurrentScope()
    }
    syncGlobeTimeMode()
  })
})

/**
 * [监听器说明]
 * 监听当前激活的任务 ID 改变。
 * 当任务选择发生变更时，自动重置视角与推演，并在有选中系列时加载对应矩阵资产。
 */
watch(
  () => store.activedTask?.id,
  async (taskId, prevTaskId) => {
    if (!taskId || taskId === prevTaskId) return
    syncGlobeTimeMode()
    markBattleArea()
    void loadMatrixForCurrentScope()
  }
)
</script>

<style lang="scss" scoped>
.battle-page-bg {
  background: var(--app-bg-gradient);
}

$bs-page-bg: var(--app-bg-gradient);
$bs-surface-bg: var(--surface-bg-color);
$bs-surface-bg-strong: var(--surface-bg-color-strong);
$bs-surface-bg-soft: var(--surface-bg-color-soft);
$bs-surface-bg-muted: var(--surface-hover-bg-color);
$bs-surface-border: var(--surface-border-color);
$bs-surface-border-strong: var(--surface-border-strong);
$bs-surface-shadow: rgba(0, 0, 0, 0.32);
$bs-text-main: var(--text-color-primary);
$bs-text-strong: var(--text-color-strong);
$bs-text-muted: var(--text-color-secondary);
$bs-text-soft: var(--text-color-secondary);
$bs-accent: var(--accent-color);
$bs-accent-hover: var(--accent-color-hover);
$bs-accent-active: var(--accent-color-active);
$bs-accent-warm: #8d6f63;
$bs-accent-cool: var(--accent-color);
$bs-accent-line: rgba(79, 147, 221, 0.35);

.battle-situation-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0b1528;

  /* 1. 全屏底图 Cesium 地球视图 */
  .cesium-map-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    overflow: hidden;
  }

  /* 2. 顶部中央悬浮 2D/3D 模式切换菜单栏 */
  .floating-view-mode-bar {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
    display: inline-flex;
    align-items: center;
    padding: 3px 4px;
    border-radius: 20px;
    background: rgba(6, 18, 32, 0.88);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 225, 255, 0.32);
    box-shadow:
      0 4px 20px rgba(0, 0, 0, 0.55),
      0 0 12px rgba(0, 225, 255, 0.15);
    pointer-events: auto;
    user-select: none;

    .view-mode-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 12px;
      border-radius: 16px;
      border: 1px solid transparent;
      background: transparent;
      color: #92b1d0;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.22s ease;
      outline: none;

      .mode-icon {
        font-size: 13px;
        line-height: 1;
      }

      .mode-label {
        letter-spacing: 0.5px;
      }

      &:hover {
        color: #d6eaff;
        background: rgba(0, 225, 255, 0.1);
      }

      &.is-active {
        color: #ffffff;
        font-weight: 700;
        background: linear-gradient(135deg, rgba(0, 200, 255, 0.35) 0%, rgba(0, 119, 255, 0.45) 100%);
        border-color: rgba(0, 225, 255, 0.6);
        box-shadow:
          0 0 10px rgba(0, 225, 255, 0.35),
          inset 0 0 6px rgba(0, 225, 255, 0.2);
        text-shadow: 0 0 6px rgba(0, 225, 255, 0.8);

        .mode-icon {
          filter: drop-shadow(0 0 4px #00e1ff);
        }
      }
    }

    .view-mode-divider {
      width: 1px;
      height: 14px;
      background: rgba(0, 225, 255, 0.2);
      margin: 0 2px;
    }
  }

  /* 3. 悬浮面板基础通用样式 */
  .floating-panel {
    position: absolute;
    top: 14px;
    bottom: 14px; // 默认无时间轴或时间轴收起时延伸至底部
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

    /* 折叠/展开控制按钮 */
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
        transition: transform 0.2s ease;
      }

      &:hover {
        background: rgba(0, 225, 255, 0.25);
        border-color: #00e1ff;
        color: #ffffff;
        box-shadow: 0 0 12px rgba(0, 225, 255, 0.5);
      }
    }

    /* 左侧面板定位与收起 */
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

    /* 右侧面板定位与收起 */
    &--right {
      right: 14px;
      width: 460px;

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

  /* 当时间轴处于展开状态时，左右面板下边界退至时间轴上方（留出 10px 间距，不遮挡/不超出时间轴） */
  &.has-expanded-timeline {
    .floating-panel {
      bottom: 98px;
    }
  }

  /* 3. 悬浮下方时间轴 */
  .floating-timeline-wrapper {
    position: absolute;
    left: 14px;
    right: 14px;
    bottom: 12px;
    z-index: 15;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    /* 折叠/展开控制按钮 */
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
      transition: all 0.25s ease;
      box-shadow: 0 -3px 8px rgba(0, 0, 0, 0.4);
      outline: none;
      z-index: 20;

      .toggle-icon {
        font-size: 11px;
      }

      &:hover {
        background: rgba(0, 225, 255, 0.22);
        color: #ffffff;
        border-color: #00e1ff;
        box-shadow: 0 0 12px rgba(0, 225, 255, 0.4);
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
