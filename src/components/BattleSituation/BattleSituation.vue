<template>
  <div class="container">
    <main class="main">
      <div class="tabs-bar">
        <div class="tabs">
          <div
            v-for="tab in visibleTabs"
            :key="tab.value"
            :class="{ active: store.activetab === tab.value }"
            @click="switchTab(tab.value)"
          >
            {{ tab.label }}
          </div>
        </div>
        <!-- 显示当前战场和任务名称（面包屑） -->
        <div class="filter filter-breadcrumb" v-if="store.activedTask">
          <span class="crumb">
            <i class="el-icon-s-platform"></i>
            <strong>{{ store.battle?.name || '未选择战场' }}</strong>
          </span>
          <span class="sep">/</span>
          <span class="crumb">
            <i class="el-icon-s-order"></i>
            {{ store.activedTask.name || '未选择任务' }}
          </span>
        </div>
      </div>
      <div v-if="store.activetab === '战场态势视图'" class="battle-grid">
        <!-- C2 敌方网络与资产拓扑左侧边栏 -->
        <div class="battle-grid__side battle-grid__side--left">
          <C2LeftControlPanel
            :matrix-data="matrixData"
            :selected-norad="selectedNorad"
            @select-satellite="handleSelectSatellite"
            @toggle-radar-frustum="handleToggleRadarFrustum"
            @toggle-orbit-trails="handleToggleOrbitTrails"
            @fly-to-view="handleFlyToView"
          />
        </div>
        <!-- 中间 3D Cesium 地球 -->
        <div class="battle-grid__center">
          <div class="battle-grid__earth">
            <component
              v-if="activeTabComponent"
              :is="activeTabComponent"
              :key="store.activetab"
              :ref="setRef"
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
      <div v-else class="map-box">
        <div class="tab-content">
          <keep-alive
            include="EvaluationReport,ThreatAnalysis,SatelliteAttackabilityView,KillChain,ElectronicWarfareG6"
          >
            <component
              v-if="activeTabComponent"
              :is="activeTabComponent"
              :key="store.activetab"
              :ref="setRef"
              @threatAnalysis="threatAnalysis"
              @changeEffectModel="handleChangeEffectModel"
            />
          </keep-alive>
        </div>
      </div>
    </main>
  </div>
</template>
<script setup lang="ts">
import CesiumViewer from '@/components/cesium/CesiumViewer.vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import SatelliteNetView from '@/components/cesium/SatelliteNetView.vue'
import SatelliteUnReal from '@/components/cesium/SatelliteUnReal.vue'
import SatelliteThreatView from '@/components/cesium/SatelliteThreatView.vue'
import SatelliteAttackabilityView from '@/components/cesium/SatelliteAttackabilityView.vue'
import EvaluationReport from '@/components/cesium/EvaluationReport.vue'
import KillChain from '@/components/cesium/KillChain.vue'
import ConfrontView from '@/components/cesium/ConfrontationAnalysis.vue'
import ElectronicWarfareG6 from '@/components/electronic/ElectronicWarfareG6.vue'
import SatelliteGantt from '@/components/electronic/SatelliteGantt.vue'
import { useLayoutStore } from '@/store/modules/layout'
import { useAuthStore } from '@/store/modules/auth'
import { getSatelliteList, getSituationDataOfTask, getStrikeSatellites, type SituationData } from '@/api/dashboard'
import { getMatrixList, getDefaultMatrixData, type MatrixResult } from '@/api/electronic'
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import type { SatelliteStrike } from '@/types/dashboard'
const store = useLayoutStore()
const authStore = useAuthStore()
useSatelliteProfileDialog()
const compMap = {
  CesiumViewer,
  SatelliteNetView,
  SatelliteUnReal,
  SatelliteThreatView,
  SatelliteAttackabilityView,
  EvaluationReport,
  KillChain,
  ConfrontView,
  ElectronicWarfareG6,
  SatelliteGantt,
}
/**
 * 定义tab对象数组
 */
const tabDefs = [
  { label: '战场态势视图', value: '战场态势视图', component: 'CesiumViewer', permissionCode: 'battle:situation' },
  { label: '卫星威胁分析', value: '卫星威胁分析', component: 'SatelliteThreatView', permissionCode: 'battle:threat' },
  {
    label: '可打击度分析',
    value: '可打击度分析',
    component: 'SatelliteAttackabilityView',
    permissionCode: 'battle:strike',
  },
  {
    label: '杀伤链方案',
    value: '杀伤链方案',
    component: 'KillChain',
    permissionCode: 'battle:killChain',
  },
  {
    label: '打击结果评估',
    value: '异常事件分析',
    component: 'EvaluationReport',
    permissionCode: 'battle:evaluation',
  },
  {
    label: '打击方案仿真',
    value: '打击方案仿真',
    component: 'SatelliteUnReal',
    permissionCode: 'battle:unreal',
  },
  // {
  //   label: '红蓝对抗分析',
  //   value: '红蓝对抗分析',
  //   component: 'ConfrontView',
  //   permissionCode: 'battle:confront',
  // },
  {
    label: '侦察卫星电磁对抗分析',
    value: '侦察卫星电磁对抗分析',
    component: 'ElectronicWarfareG6',
    permissionCode: 'battle:electronicWarfare',
  },
] as const

/**
 * 计算可见的tab
 */
const visibleTabs = computed(() => {
  // 如果是管理员，显示所有tab
  if (authStore.roles.includes('admin')) {
    return [...tabDefs]
  }
  // 根据权限过滤tab
  const permissionSet = new Set(authStore.permissions)
  const filtered = tabDefs.filter((tab) => permissionSet.has(tab.permissionCode))
  return filtered
})
/**
 * 获取组件实例类型
 */
type InstanceOf<T> = T extends new (...args: any[]) => infer R ? R : never
/**
 * 战场态势视图组件实例类型
 */
type CesiumViewerInst = InstanceOf<typeof CesiumViewer>
/**
 * 卫星网络视图组件实例类型
 */
type SatelliteNetViewInst = InstanceOf<typeof SatelliteNetView>
/**
 * 打击方案仿真组件实例类型
 */
type SatelliteUnRealInst = InstanceOf<typeof SatelliteUnReal>
/**
 * 卫星威胁分析组件实例类型
 */
type SatelliteThreatViewInst = InstanceOf<typeof SatelliteThreatView>
/**
 * 可打击度分析组件实例类型
 */
type SatelliteAttackabilityViewInst = InstanceOf<typeof SatelliteAttackabilityView>
/**
 * 打击结果评估组件实例类型
 */
type EvaluationReportInst = InstanceOf<typeof EvaluationReport>
/**
 * 红蓝对抗分析组件实例类型
 */
type ConfrontInst = InstanceOf<typeof ConfrontView>

/**
 * 当前激活组件的实例类型
 */
type ActiveInst =
  | CesiumViewerInst
  | SatelliteNetViewInst
  | SatelliteUnRealInst
  | SatelliteThreatViewInst
  | SatelliteAttackabilityViewInst
  | EvaluationReportInst
  | ConfrontInst

/**
 * 获取当前激活的组件
 */
const activeTabComponent = shallowRef()
/**
 * 当前激活组件的引用
 */
const activeRef = shallowRef<ActiveInst | null>(null)
/**
 * 战场态势视图组件的引用
 */
const cesiumViewerRef = shallowRef<CesiumViewerInst | null>()
/**
 * 卫星网络视图组件的引用
 */
const netViewerRef = shallowRef<SatelliteNetViewInst | null>()
/**
 * 打击方案仿真组件的引用
 */
const satelliteUnRealRef = shallowRef<SatelliteUnRealInst | null>()
/**
 * 红蓝对抗分析组件的引用
 */
const confrontRef = shallowRef<ConfrontInst | null>()

/**
 * 设置组件引用
 * @param el 组件实例
 */
function setRef(el: any) {
  activeRef.value = el as ActiveInst
  // 切换时清理上一个 tab 的引用，避免旧组件方法继续调用（如视图切换时）
  cesiumViewerRef.value = null
  netViewerRef.value = null
  satelliteUnRealRef.value = null
  confrontRef.value = null

  if (activeRef.value) {
    switch (store.activetab) {
      case '战场态势视图':
        cesiumViewerRef.value = activeRef.value as CesiumViewerInst
        break
      case '卫星网络视图':
        netViewerRef.value = activeRef.value as SatelliteNetViewInst
        break
      case '打击方案仿真':
        satelliteUnRealRef.value = activeRef.value as SatelliteUnRealInst
        break
      case '红蓝对抗分析':
        confrontRef.value = activeRef.value as ConfrontInst
        break
    }
  }
}
const threatAnalysis = () => {
  switchTab('卫星威胁分析')
}

const battleSituationData = ref<SituationData | null>(null)
const strikeSatelliteList = ref<SatelliteStrike[]>([])

// 当前选中的敌方卫星 NORAD (未选中时为 null，表示静态展示)
const selectedNorad = ref<number | null>(null)
const matrixData = ref<MatrixResult | null>(getDefaultMatrixData())

/**
 * [功能]
 * 选择某颗敌方卫星并加载其专属数据传输矩阵与过境时间窗口
 *
 * [处理规则]
 * - 如果 norad 为 null，进入全网静态展示模式：重置选择并暂停 Cesium 时钟推演
 * - 如果 norad 为有效数字：请求算法矩阵 getMatrixList({ norad, taskId })
 * - 获取该卫星最早/有效传输窗口，跳转 Cesium 时钟至窗口发生时刻，并开启动画连通展示
 *
 * @param norad 选中的敌方卫星 NORAD
 */
const handleSelectSatellite = async (norad: number | null) => {
  selectedNorad.value = norad
  const taskId = store.activedTask?.id

  // 1. 如果没有选择卫星 (静态展示模式)
  if (!norad || !taskId) {
    if (cesiumViewerRef.value && (cesiumViewerRef.value as any).pauseClockAnimation) {
      ;(cesiumViewerRef.value as any).pauseClockAnimation()
    }
    if (taskId) {
      await loadMatrixData(taskId)
    }
    return
  }

  // 2. 选择具体卫星，加载对应的算法传输矩阵
  try {
    const res = await getMatrixList({ norad, taskId, intensityLevel: '中度交战' })
    if (res.code === 200 && res.data) {
      // [业务目的] 保持全网资产拓扑不丢失：当针对特定卫星返回的矩阵未包含/清空全量资产列表时，合并保留原有/默认拓扑数据
      const defaultTopology = getDefaultMatrixData()
      const currentMatrix = matrixData.value || defaultTopology

      matrixData.value = {
        ...res.data,
        initMatrixList:
          res.data.initMatrixList?.length
            ? res.data.initMatrixList
            : (currentMatrix.initMatrixList?.length ? currentMatrix.initMatrixList : defaultTopology.initMatrixList),
        satelliteMatrixList:
          res.data.satelliteMatrixList?.length
            ? res.data.satelliteMatrixList
            : (currentMatrix.satelliteMatrixList?.length ? currentMatrix.satelliteMatrixList : defaultTopology.satelliteMatrixList),
        stationRelationList:
          res.data.stationRelationList?.receiveObjList?.length
            ? res.data.stationRelationList
            : (currentMatrix.stationRelationList?.receiveObjList?.length ? currentMatrix.stationRelationList : defaultTopology.stationRelationList),
        initRelationList:
          res.data.initRelationList?.receiveObjList?.length
            ? res.data.initRelationList
            : (currentMatrix.initRelationList?.receiveObjList?.length ? currentMatrix.initRelationList : defaultTopology.initRelationList),
        relayRelation:
          res.data.relayRelation?.relayList?.length
            ? res.data.relayRelation
            : (currentMatrix.relayRelation?.relayList?.length ? currentMatrix.relayRelation : defaultTopology.relayRelation),
      }

      // 寻找该卫星的最早/有效传输窗口
      let windowStartTime: string | undefined

      const battleMatch = (res.data.battleMatrixList || []).find((b) => b.norad === norad)
      if (battleMatch?.windows?.length) {
        windowStartTime = battleMatch.windows[0].startTime
      } else {
        // [业务目的] 当战场过境矩阵匹配不到时，兜底从初始过境时间窗口列表中读取过境开始时刻
        // [实现原因] InitMatrix 接口类型定义的过境窗口数组字段为 initWindows，单项时间窗口为 InitWindow (包含 peakWindow 字段)
        // [关键规则] 使用 initMatch.initWindows[0].peakWindow 提取初始窗口开始时间
        const initMatch = (res.data.initMatrixList || []).find((i) => i.norad === norad)
        if (initMatch?.initWindows?.length) {
          windowStartTime = initMatch.initWindows[0].peakWindow
        }
      }

      // 使用 Cesium 时钟推进到窗口发生时刻，并开启连线推演动画
      if (cesiumViewerRef.value && (cesiumViewerRef.value as any).jumpToTimeAndPlay) {
        ;(cesiumViewerRef.value as any).jumpToTimeAndPlay(windowStartTime)
      }
    }
  } catch (err) {
    console.error('获取卫星传输矩阵失败:', err)
  }
}

// 监听 3D 地球中鼠标点击卫星的选择状态
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

async function loadSituationData(taskId: number) {
  const res = await getSituationDataOfTask(taskId)
  if (res.code === 200 && res.data) {
    battleSituationData.value = res.data
  }
}

async function loadStrikeList(taskId: number) {
  const res = await getStrikeSatellites(taskId, 1, 10000)
  if (res.code === 200) {
    strikeSatelliteList.value = res.data.content ?? []
  }
}

/**
 * 加载初始算法矩阵 (未选择卫星时展示全量资产拓扑)
 * @param taskId 任务ID
 */
async function loadMatrixData(taskId: number) {
  try {
    const res = await getMatrixList({ norad: 60419, taskId, intensityLevel: '中度交战' })
    if (res.code === 200 && res.data && (res.data.initMatrixList?.length || res.data.satelliteMatrixList?.length)) {
      matrixData.value = res.data
    } else {
      matrixData.value = getDefaultMatrixData()
    }
  } catch (err) {
    console.error('加载算法矩阵失败，使用默认矩阵:', err)
    matrixData.value = getDefaultMatrixData()
  }
}

const handleToggleRadarFrustum = (show: boolean) => {
  if (cesiumViewerRef.value && (cesiumViewerRef.value as any).toggleRadarFrustums) {
    ;(cesiumViewerRef.value as any).toggleRadarFrustums(show)
  }
}

const handleToggleOrbitTrails = (show: boolean) => {
  if (cesiumViewerRef.value && (cesiumViewerRef.value as any).toggleOrbitTrails) {
    ;(cesiumViewerRef.value as any).toggleOrbitTrails(show)
  }
}

const handleFlyToView = (target: 'GLOBAL' | 'SPACE' | 'GROUND') => {
  if (cesiumViewerRef.value && (cesiumViewerRef.value as any).flyToView) {
    ;(cesiumViewerRef.value as any).flyToView(target)
  }
}

async function loadBattleSituationData(taskId: number) {
  await Promise.all([loadSituationData(taskId), loadStrikeList(taskId), loadMatrixData(taskId)])

  // 初始进入未选择具体卫星时，默认静态展示不演示动画
  if (!selectedNorad.value) {
    nextTick(() => {
      if (cesiumViewerRef.value && (cesiumViewerRef.value as any).pauseClockAnimation) {
        ;(cesiumViewerRef.value as any).pauseClockAnimation()
      }
    })
  }
}

/**
 * 切换tab页面
 * @param tab tab名称
 */
const switchTab = (tab: string) => {
  store.activetab = tab
  const current = tabDefs.find((item) => item.value === tab)
  if (!current) {
    activeTabComponent.value = undefined
    return
  }
  activeTabComponent.value = compMap[current.component]
}

watch(
  visibleTabs,
  (tabs) => {
    if (tabs.length === 0) {
      activeTabComponent.value = undefined
      return
    }

    const hasCurrent = tabs.some((item) => item.value === store.activetab)
    if (!hasCurrent) {
      switchTab(tabs[0].value)
    }
  },
  { immediate: true }
)

const satelliteList = ref<Satellite[]>([])
const satellite_total = ref(0)
const satellite_loadnum = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)

//卫星列表数据
const loadSatelliteList = async () => {
  const res = await getSatelliteList(pageNum.value, pageSize.value, undefined, store.activedTask?.id!)
  if (res.code === 200) {
    satelliteList.value = res.data.content
    satellite_total.value = res.data.totalElements
    satellite_loadnum.value = res.data.numberOfElements
  }
}
/**
 *
 */
const handleChangeEffectModel = () => {
  // 仅在战场态势视图时刷新 orbit 路径（其他 tab 组件不会使用该 viewer）
  if (store.activetab === '战场态势视图') {
    loadSatelliteEntities()
  }
}

/**
 * 渲染卫星轨迹和实体
 */
const loadSatelliteEntities = () => {
  if (store.activedTask?.id && store.activetab === '战场态势视图') {
    // 显示卫星轨迹（仅在战场态势视图激活时）
    cesiumViewerRef.value?.renderSateliitePathWithEntity(store.activedTask?.id, undefined)
  }
}

onMounted(() => {
  /**
   * 如果当前没有激活的页面，自动切换到第一个页面
   */
  if (visibleTabs.value.length > 0) {
    const hasCurrent = visibleTabs.value.some((item) => item.value === store.activetab)
    switchTab(hasCurrent ? store.activetab : visibleTabs.value[0].value)
  }

  nextTick(() => {
    loadSatelliteEntities()
  })
  // 卫星列表
  loadSatelliteList()
  if (store.activetab === '战场态势视图' && store.activedTask?.id) {
    void loadBattleSituationData(store.activedTask.id)
  }
})

watch(
  () => store.activetab,
  async (tab) => {
    if (tab === '战场态势视图') {
      nextTick(() => {
        loadSatelliteEntities()
      })
      loadSatelliteList()
      if (store.activedTask?.id) {
        await loadBattleSituationData(store.activedTask.id)
      }
    }
  }
)

watch(
  () => store.activedTask?.id,
  async (taskId, prevTaskId) => {
    if (!taskId || taskId === prevTaskId) return
    loadSatelliteList()
    if (store.activetab === '战场态势视图') {
      await loadBattleSituationData(taskId)
    }
  }
)
/**
 * 标记战场区域
 */
// function markBattleArea() {
//   if (store.activedTask) {
//     cesiumViewerRef.value?.markBattle()
//   }
// }
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
  .main {
    .nav-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: start;
      gap: 10px;
    }

    .tabs-bar {
      height: 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      background: $bs-page-bg;
      box-sizing: border-box;

      .tabs {
        display: flex;
        gap: 15px;
        font-size: 14px;

        div {
          background: $bs-surface-bg-muted;
          padding: 5px 10px;
          cursor: pointer;
          border-radius: 2px;
          color: $bs-text-main;
          border: 1px solid $bs-surface-border;

          &:hover {
            background: $bs-accent-hover;
            transition: all 0.3s ease-in-out;
          }
        }

        & > div.active {
          background: $bs-accent-active;
          color: $bs-text-strong;
        }
      }

      .filter {
        display: flex;
        align-items: center;
        gap: 10px;
        color: $bs-text-main;
        font-size: 13px;
        padding: 6px 10px;
        border-radius: 6px;
        background: rgba(12, 38, 64, 0.6);
        border: 1px solid $bs-surface-border;

        .crumb {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .sep {
          color: $bs-text-soft;
        }

        i {
          color: $bs-accent-active;
        }

        strong {
          color: $bs-text-strong;
          font-weight: 700;
        }

        &.active {
          background: rgba(79, 147, 221, 0.3);
          border-radius: 3px;
        }
      }
    }

    .map-box {
      position: relative;
      height: calc(100vh - 100px);

      .filter-panel {
        height: 100%;
        width: 100%;
        position: absolute;
        top: 0;
        left: 0;
        font-size: 12px;
        z-index: 999;

        .nav-bar-filter {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px;
          background: $bs-surface-bg-muted;
        }

        .filter-content {
          display: grid;
          grid-template-columns: 1fr 100px;
          background: $bs-surface-bg-soft;

          .filter-list {
            padding: 10px;

            .filter-item {
              display: flex;
              align-items: center;
              gap: 20px;
              padding-top: 10px;

              .filter-type {
                color: $bs-text-muted;
              }

              .filter-condition {
                display: flex;
                gap: 10px;

                span {
                  cursor: pointer;

                  &.active {
                    border-bottom: 2px solid $bs-accent-active;
                  }
                }
              }
            }
          }

          .show-all {
            color: $bs-accent-active;
            padding: 20px 10px 10px 10px;
            display: flex;
            gap: 2px;
            cursor: pointer;
          }
        }
      }

      .tab-content {
        height: 100%;
        // AI:
        // - 允许 Tab 页组件在内容超出容器高度时纵向滚动
        // - 保持横向溢出隐藏，避免出现底部横向滚动条
        overflow-y: auto;
        overflow-x: hidden;

        /* 自定义滚动条样式，使其与整体暗色暗青主题契合 */
        &::-webkit-scrollbar {
          width: 6px;
        }

        &::-webkit-scrollbar-thumb {
          background: rgba(79, 147, 221, 0.3);
          border-radius: 3px;

          &:hover {
            background: rgba(79, 147, 221, 0.6);
          }
        }

        &::-webkit-scrollbar-track {
          background: transparent;
        }
      }
    }

    .battle-grid {
      height: calc(100vh - 100px);
      display: grid;
      grid-template-columns: 380px minmax(0, 1fr) 380px;
      grid-template-rows: minmax(0, 1fr) 320px;
      box-sizing: border-box;
      position: relative;
      border: 1px solid $bs-surface-border;
      background:
        radial-gradient(circle at top left, rgba(79, 147, 221, 0.12), transparent 36%),
        radial-gradient(circle at bottom right, rgba(79, 147, 221, 0.08), transparent 30%), $bs-page-bg;
      box-shadow:
        0 22px 48px $bs-surface-shadow,
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 18%);
      }

      &::after {
        content: '';
        position: absolute;
        inset: 1px;
        pointer-events: none;
        border-radius: 19px;
        border: 1px solid rgba(255, 255, 255, 0.04);
      }
    }

    .battle-grid__side {
      height: 100%;
      max-height: 100%;
      min-height: 0;
      overflow: hidden;
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      padding: 6px;
      box-sizing: border-box;
    }

    .battle-grid__side--left {
      grid-column: 1;
      grid-row: 1 / span 2;
    }

    .battle-grid__side--right {
      grid-column: 3;
      grid-row: 1 / span 2;
    }

    .battle-grid__center {
      display: grid;
      grid-column: 2;
      grid-row: 1/-1;
      min-height: 0;
      position: relative;
      z-index: 1;
    }

    .battle-grid__earth {
      min-height: 0;
      overflow: hidden;
      background: $bs-surface-bg-strong;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    }

    .battle-grid__earth :deep(.cesium-container) {
      height: 100%;
    }

    .battle-grid__center .satellite-list-panel {
      position: static;
      height: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 12px;
      background: $bs-surface-bg;
      border: 1px solid $bs-surface-border;
    }

    .battle-grid__center .satellite-list {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }

    .satellite-list-panel {
      background: $bs-page-bg;
      width: 100%;
      position: absolute;
      bottom: 0;
      left: 0;
      z-index: 999;
      height: 320px;

      .tabs {
        div {
          width: 80px;
          font-size: 14px;
          padding: 3px;
        }
      }

      .satellite-list {
        .page-box {
          display: flex;
          justify-content: end;
        }

        :deep(.atlas-app-table) {
          --atlas-app-table-border-color: var(--surface-border-color);
          --atlas-app-table-header-bg-color: var(--surface-bg-color-strong);
          --atlas-app-table-tr-bg-color: var(--surface-bg-color);
          --atlas-app-table-row-hover-bg-color: var(--surface-hover-bg-color);
          --atlas-app-table-current-row-bg-color: var(--surface-hover-bg-color);
          --atlas-app-table-text-color: var(--text-color-primary);
          --atlas-app-table-header-text-color: var(--text-color-secondary);
          background: transparent;
          color: var(--text-color-primary);
        }

        :deep(.atlas-app-table__header-wrapper th) {
          background: var(--surface-bg-color-strong);
          color: var(--text-color-secondary);
          border-bottom: 1px solid var(--surface-border-color);
        }

        :deep(.atlas-app-table__body tr) {
          background: var(--surface-bg-color);
        }

        :deep(.atlas-app-table__body td) {
          background: var(--surface-bg-color);
          border-bottom: 1px solid var(--surface-border-color);
        }

        :deep(.atlas-app-table__body tr:hover > td) {
          background: var(--surface-hover-bg-color);
        }

        :deep(.atlas-app-pagination) {
          --atlas-app-text-color-primary: var(--text-color-primary);
          --atlas-app-fill-color-blank: var(--surface-bg-color);
        }
      }
    }

    .left-panel {
      background: $bs-surface-bg;
      position: absolute;
      left: 0;
      top: 50px;
      z-index: 999;
      width: 400px;

      .battle-box {
        .battle-count {
          display: flex;
          gap: 10px;
          padding: 5px;

          & > div {
            background: $bs-surface-bg-muted;
            flex: 1;
            padding: 5px;
            display: flex;
            flex-direction: column;
            align-items: center;

            & > span:first-child {
              font-size: 18px;
              font-weight: bold;
            }

            & > span:last-child {
              font-size: 14px;
              color: $bs-text-muted;
            }
          }
        }
      }

      .left-panel-scroll {
        padding-right: 10px;
        height: calc(100vh - 210px);

        .collapse-item {
          .title {
            display: flex;
            justify-content: space-between;
            padding: 10px;
            background: $bs-surface-bg-muted;
          }

          .task-item {
            background: $bs-surface-bg-muted;
            padding: 10px 5px 10px 10px;
            margin: 5px 0;
            display: grid;
            grid-template-columns: 1.5fr 1fr;

            .task-item__left {
              & > div {
                text-align: left;
              }
            }

            .task-item__right {
              justify-content: end;
              color: $bs-accent-active;
              cursor: pointer;
            }
          }
        }
      }
    }

    .right-panel {
      background: $bs-surface-bg;
      position: absolute;
      right: 0;
      top: 50px;
      z-index: 999;
      width: 400px;

      .right-panel-scroll {
        height: calc(100vh - 145px);
        padding-right: 10px;

        .focus-list {
          .focus-item {
            background: $bs-surface-bg-muted;
            margin: 5px 0;
            padding: 10px 0 10px 10px;
            font-size: 12px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 80px repeat(4, 30px);
            gap: 5px;

            .focus-item-1 {
              display: flex;
              flex-direction: column;
              align-items: start;
              justify-content: space-around;
            }

            .focus-item-flex {
              display: grid;
              grid-template-columns: 1.2fr 2fr;

              & > span:first-child {
                align-self: center;
                text-align: right;
                padding-right: 10px;
                color: $bs-text-muted;
              }

              & > span:last-child {
                text-align: left;
                align-self: center;
                white-space: normal;
                word-break: break-word;
                overflow-wrap: break-word;
              }
            }
          }
        }
      }
    }
  }
}
</style>
