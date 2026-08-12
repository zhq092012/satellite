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
              :showTimeLine="true"
              :showAnimation="true"
              :matrix-data="matrixData"
              :selected-norad="selectedNorad"
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
import { nextTick, onMounted, ref, watch } from 'vue'
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import { useLayoutStore } from '@/store/modules/layout'
import { getReconnaissanceAttackMatrix, type MatrixResult } from '@/api/electronic'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { getSatelliteDetail } from '@/api/dashboard'

/** [变量说明] 全局布局 Store */
const store = useLayoutStore()

/** [Hook 引入] 卫星档案弹窗 */
useSatelliteProfileDialog()

/** [变量说明] 3D Cesium Viewer 组件实例引用 */
const cesiumViewerRef = ref<InstanceType<typeof CesiumViewer> | null>(null)

/** [变量说明] 当前选中的敌方卫星 NORAD 编号 (未选中时为 null，代表静态展示) */
const selectedNorad = ref<number | null>(null)

/** [变量说明] 侦察/打击算法矩阵结果 */
const matrixData = ref<MatrixResult | null>(null)

/**
 * [函数说明]
 * 选择某颗敌方卫星并加载其专属数据传输矩阵与过境时间窗口
 * @param norad 选中的敌方卫星 NORAD 编号
 */
const handleSelectSatellite = async (norad: number | null) => {
  selectedNorad.value = norad
  const taskId = store.activedTask?.id

  // 1. 未选择卫星 (进入静态展示模式)
  if (!norad || !taskId) {
    if (cesiumViewerRef.value && (cesiumViewerRef.value as any).pauseClockAnimation) {
      ;(cesiumViewerRef.value as any).pauseClockAnimation()
    }
    return
  }

  // 2. 选择具体卫星，加载算法传输矩阵
  try {
    const res = await getReconnaissanceAttackMatrix({
      taskId,
      intensityLevel: '低烈度',
      series: store.selectedSatSeries || '',
    })
    if (res.code === 200 && res.data) {
      matrixData.value = res.data
      let windowStartTime: string | undefined

      const battleMatch = (res.data.battleMatrixList || []).find((b) => b.norad === norad)
      if (battleMatch?.windows?.length) {
        windowStartTime = battleMatch.windows[0].startTime
      } else {
        const initMatch = (res.data.initMatrixList || []).find((i) => i.norad === norad)
        if (initMatch?.initWindows?.length) {
          windowStartTime = initMatch.initWindows[0].peakWindow
        }
      }

      if (cesiumViewerRef.value && (cesiumViewerRef.value as any).jumpToTimeAndPlay) {
        ;(cesiumViewerRef.value as any).jumpToTimeAndPlay(windowStartTime)
      }
    }
  } catch (err) {
    console.error('获取卫星传输矩阵失败:', err)
  }
}

/**
 * [监听器说明]
 * 监听选中的卫星系列变更，当用户选择新系列且已有选中卫星时自动重新加载矩阵
 */
watch(
  () => store.selectedSatSeries,
  (newSeries) => {
    if (selectedNorad.value && store.activedTask?.id) {
      void handleSelectSatellite(selectedNorad.value)
    }
  }
)

/**
 * [监听器说明]
 * 监听 3D 地球中鼠标点击选中的卫星状态
 */
watch(
  () => store.selectedSatellite,
  (newSat) => {
    if (newSat) {
      const norad = Number(newSat.norad || (newSat as any).norad_id)
      if (Number.isFinite(norad) && selectedNorad.value !== norad) {
        void handleSelectSatellite(norad)
      }
    }
  }
)

/**
 * [函数说明]
 * 暂停 Cesium 时钟推演动画
 */
async function pauseClockAnimation() {
  if (!selectedNorad.value) {
    nextTick(() => {
      ;(cesiumViewerRef.value as any)?.pauseClockAnimation?.()
    })
  }
}

/**
 * [函数说明]
 * 渲染战场任务相关卫星轨迹与实体
 */
const loadSatelliteEntities = async () => {
  if (store.activedTask?.id) {
    await cesiumViewerRef.value?.renderSateliitePathWithEntity(store.activedTask?.id, undefined)
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
  nextTick(async () => {
    await loadSatelliteEntities()
    if (store.allSatelliteOfTask.length > 0) {
      const norad = Number(store.allSatelliteOfTask[0].norad_id)
      if (Number.isFinite(norad) && selectedNorad.value !== norad) {
        try {
          const res = await getSatelliteDetail({ norad: Number(norad) })
          if (res.code === 200 && res.data) {
            store.setSelectedSatellite(res.data)
            void handleSelectSatellite(norad)
          }
        } catch (error) {
          console.error('查询卫星详细信息失败:', error)
        }
      }
    }
    markBattleArea()
  })
  void pauseClockAnimation()
})

/**
 * [监听器说明]
 * 监听当前激活的任务 ID 改变。
 * 当任务选择发生变更或从未选中状态变更为激活状态时，
 * 自动暂停推演动画，并重新加载渲染对应任务的卫星实体轨迹与战场网格。
 */
watch(
  () => store.activedTask?.id,
  async (taskId, prevTaskId) => {
    if (!taskId || taskId === prevTaskId) return
    await pauseClockAnimation()
    await loadSatelliteEntities()
    markBattleArea()
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
