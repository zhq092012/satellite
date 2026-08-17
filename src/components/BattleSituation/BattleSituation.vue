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
            />
            <BattleMissionTimeline
              v-if="taskTimeRange"
              :task-start="taskTimeRange.start"
              :task-end="taskTimeRange.end"
              :matrix-data="matrixData"
              :selected-norad="selectedNorad"
              @time-change="handleTimelineTimeChange"
            />
          </div>
        </div>

        <!-- C2 敌方数据传输与链路效能右侧边栏 -->
        <div class="battle-grid__side battle-grid__side--right">
          <C2RightAnalysisPanel
            :matrix-data="matrixData"
            :selected-satellite-norad="selectedNorad"
            @clear-satellite-selection="handleSelectSatellite(null)"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleMissionTimeline from '@/components/BattleSituation/BattleMissionTimeline.vue'
import { useLayoutStore } from '@/store/modules/layout'
import type { MatrixResult } from '@/api/electronic'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'

/** [变量说明] 全局布局 Store */
const store = useLayoutStore()

/** [Hook 引入] 卫星档案弹窗 */
useSatelliteProfileDialog()

/** [变量说明] 3D Cesium Viewer 组件实例引用 */
const cesiumViewerRef = ref<InstanceType<typeof CesiumViewer> | null>(null)

/** [变量说明] 当前选中的敌方卫星 NORAD 编号 (默认未选中任何卫星为 null，代表静态视图定位战场) */
const selectedNorad = ref<number | null>(null)

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
}

/**
 * [函数说明]
 * 根据选择的卫星系列，在第一个 Tab (GIS态势) 触发全局算法矩阵查询，并从矩阵中加载相关资产。
 * 默认不自动选择任何卫星或地面站节点，地图定位战场包围框。
 *
 * @param series 选中的卫星系列名称
 */
const fetchMatrixDataBySeries = async (series: string) => {
  const taskId = store.activedTask?.id
  if (!taskId || !series) {
    store.clearMatrixData()
    selectedNorad.value = null
    return
  }

  try {
    const data = await store.fetchReconnaissanceAttackMatrix({
      taskId,
      series,
      intensityLevel: store.intensityLevel || '低烈度',
    })
    if (data) {
      // 默认保持不选择任何卫星 (selectedNorad 为 null)，相机视角直接定位战场
      selectedNorad.value = null
      nextTick(() => {
        markBattleArea()
      })
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
  selectedNorad.value = norad
  const taskId = store.activedTask?.id

  // 1. 未选择卫星/取消选择 (相机定位战场)
  if (!norad || !taskId) {
    if (cesiumViewerRef.value) {
      cesiumViewerRef.value.pauseClockAnimation()
      cesiumViewerRef.value.markBattle()
    }
    return
  }

  // 2. 选中具体卫星，高亮该实体并使 3D 相机视角平滑飞赴定位（不触发时间轴调整）
  if (cesiumViewerRef.value) {
    cesiumViewerRef.value.highlightSatellite({ norad_id: String(norad) })
  }
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
  () => store.selectedSatSeries,
  (newSeries) => {
    if (newSeries) {
      void fetchMatrixDataBySeries(newSeries)
    } else {
      store.clearMatrixData()
      selectedNorad.value = null
      void pauseClockAnimation()
    }
  },
  { immediate: true }
)

/**
 * [函数说明]
 * 暂停 Cesium 时钟推演动画
 */
async function pauseClockAnimation() {
  if (!selectedNorad.value) {
    nextTick(() => {
      cesiumViewerRef.value?.pauseClockAnimation()
    })
  }
}

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
    // 组件开始加载时仅标记战场边界网格，不全量加载全库卫星资产，保持地图洁净
    markBattleArea()
    if (store.selectedSatSeries) {
      void fetchMatrixDataBySeries(store.selectedSatSeries)
    }
  })
  void pauseClockAnimation()
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
    await pauseClockAnimation()
    markBattleArea()
    if (store.selectedSatSeries) {
      await fetchMatrixDataBySeries(store.selectedSatSeries)
    }
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
