<template>
  <div class="container">
    <main class="main">
      <!-- GIS 战场态势视图核心三栏布局 -->
      <div class="battle-grid">
        <!-- C2 敌方网络与资产拓扑左侧边栏 -->
        <div class="battle-grid__side battle-grid__side--left">
          <C2LeftControlPanel
            :matrix-data="matrixData"
            :selected-norad="selectedNorad"
            @select-satellite="handleSelectSatellite"
          />
        </div>

        <!-- 中间 3D Cesium 地球 -->
        <div class="battle-grid__center">
          <div class="battle-grid__earth">
            <CesiumViewer
              ref="cesiumViewerRef"
              :matrix-data="matrixData"
              :selected-norad="selectedNorad"
              @clock-tick="handleClockTick"
            />
            <BattleGlobeTimeline
              v-if="taskTimeRange"
              :task-start="taskTimeRange.start"
              :task-end="taskTimeRange.end"
              :matrix-data="matrixData"
              :selected-norad="selectedNorad"
              :force-task-mode="!!selectedTransmissionLinkId"
              :current-time-ms="currentClockMs"
              :is-playing="isClockPlaying"
              @time-change="handleTimelineTimeChange"
              @toggle-play="handleTogglePlay"
            />
          </div>
        </div>

        <!-- C2 敌方数据传输与链路效能右侧边栏 -->
        <div class="battle-grid__side battle-grid__side--right">
          <C2RightAnalysisPanel
            :matrix-data="matrixData"
            :selected-satellite-norad="selectedNorad"
            :selected-transmission-link-id="selectedTransmissionLinkId"
            @clear-satellite-selection="handleSelectSatellite(null)"
            @select-transmission-link="handleSelectTransmissionLink"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, watch } from 'vue'
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleGlobeTimeline from '@/components/BattleSituation/BattleGlobeTimeline.vue'
import { useLayoutStore } from '@/store/modules/layout'
import type { MatrixResult } from '@/api/electronic'
import type { SatelliteTransmissionLink } from '@/utils/satelliteFullChainAnalysis'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'

/** [变量说明] 全局布局 Store */
const store = useLayoutStore()

/** [Hook 引入] 卫星档案弹窗 */
useSatelliteProfileDialog()

/** [变量说明] 3D Cesium Viewer 组件实例引用 */
const cesiumViewerRef = ref<InstanceType<typeof CesiumViewer> | null>(null)

/** [变量说明] 当前选中的敌方卫星 NORAD 编号 (默认未选中任何卫星为 null，代表静态视图定位战场) */
const selectedNorad = ref<number | null>(null)

/** 当前选中的传输链路 ID（右侧面板点击链路时高亮并绘制地图连线） */
const selectedTransmissionLinkId = ref<string | null>(null)

/** 地球时钟当前时刻（毫秒），用于轨道仿真时间轴游标 */
const currentClockMs = ref<number>(0)

/** 地球时钟当前播放/暂停状态 */
const isClockPlaying = ref<boolean>(true)

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

  if (nextState) {
    const endMs = taskTimeRange.value ? new Date(taskTimeRange.value.end.replace(/-/g, '/')).getTime() : 0
    const startMs = taskTimeRange.value ? new Date(taskTimeRange.value.start.replace(/-/g, '/')).getTime() : 0
    if (endMs && currentClockMs.value >= endMs - 1000 && startMs) {
      viewer.setClockTime(startMs)
      currentClockMs.value = startMs
    }
    viewer.setClockPlaying(true, 120)
  } else {
    viewer.setClockPlaying(false)
  }
}

/**
 * 接收 Cesium 时钟 Tick，同步轨道仿真时间轴游标
 * @param ms 当前时钟毫秒时间戳
 */
const handleClockTick = (ms: number) => {
  if (!selectedNorad.value && !selectedTransmissionLinkId.value) {
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
      isClockPlaying.value = true
      const clockMs = cesiumViewerRef.value.getClockTimeMs?.()
      if (clockMs) currentClockMs.value = clockMs
    }
  })
}

/**
 * 清除传输链路选中态，并恢复地图连线与时间轴播放。
 */
const clearTransmissionLinkSelection = () => {
  selectedTransmissionLinkId.value = null
  cesiumViewerRef.value?.clearTransmissionLinkOverlay?.()
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
  const viewer = cesiumViewerRef.value
  if (!viewer) return

  viewer.pauseClockAnimation()
  viewer.initTaskClock?.()
  viewer.setClockTime(link.transmitStartMs)
  currentClockMs.value = link.transmitStartMs

  nextTick(() => {
    viewer.showTransmissionLink?.(link)
  })
}

/**
 * 按当前系列筛选范围加载矩阵：有系列时加载单系列，无系列时合并全部系列。
 */
let matrixLoadToken = 0

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
 * 在任务时间轴完成时刻同步后，再执行卫星高亮与相机飞赴
 * @param norad 目标卫星 NORAD
 */
const scheduleFlyToSelectedSatellite = (norad: number) => {
  nextTick(() => {
    cesiumViewerRef.value?.highlightSatellite({ norad_id: String(norad) })
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
  () => [store.selectedSatSeries, store.selectedSatType] as const,
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

.container {
  width: 100%;
  height: 100%;

  .main {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;

    .tabs-bar {
      height: 36px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 0 15px;
      background: $bs-page-bg;
      box-sizing: border-box;

      .filter {
        display: flex;
        align-items: center;
        gap: 10px;
        color: $bs-text-main;
        font-size: 13px;
        padding: 4px 10px;
        border-radius: 6px;
        background: rgba(12, 38, 64, 0.6);
        border: 1px solid $bs-surface-border;

        .crumb {
          display: inline-flex;
          align-items: center;
          gap: 4px;

          strong {
            color: $bs-text-strong;
          }
        }

        .sep {
          color: $bs-text-muted;
        }
      }
    }

    .battle-grid {
      flex: 1;
      display: grid;
      grid-template-columns: 460px 1fr 480px;
      gap: 12px;
      padding: 12px;
      box-sizing: border-box;
      background: $bs-page-bg;
      overflow: hidden;

      .battle-grid__side {
        height: 100%;
        min-height: 0;
        overflow: hidden;
      }

      .battle-grid__center {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-width: 0;
        min-height: 0;
        overflow: hidden;

        .battle-grid__earth {
          flex: 1;
          height: 100%;
          min-height: 0;
          position: relative;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid $bs-surface-border;
          box-shadow: 0 4px 20px $bs-surface-shadow;
        }
      }
    }
  }
}
</style>
