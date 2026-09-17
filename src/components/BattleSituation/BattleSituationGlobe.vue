<template>
  <div ref="cesiumContainer" class="battle-globe-layer">
    <div ref="creditEl" class="credit"></div>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import { markBattleArea, resolveBattleSpaceLabelPosition } from '@/utils/tools/functionTool'
import { useLayoutStore } from '@/store/modules/layout'
import { useBattleGlobeSatellites } from '@/composables/useBattleGlobeSatellites'
import { useBattleGlobeWeapons } from '@/composables/useBattleGlobeWeapons'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import { mergeDeductionPassGroundTargets } from '@/utils/buildBattleGlobeGroundTargets'
import { useBattleGlobeGroundTargets } from '@/composables/useBattleGlobeGroundTargets'
import { useBattleGlobeDeductionEffects } from '@/composables/useBattleGlobeDeductionEffects'
import type { SatelliteDeductionVisualPlan } from '@/utils/buildSatelliteDeductionTimeline'
import { resolveDeductionVisualState } from '@/utils/buildSatelliteDeductionTimeline'
import { computed, onActivated, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

/** 地图瓦片服务地址 */
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL

const props = withDefaults(
  defineProps<{
    /** 任务分析卫星列表（含 TLE） */
    satellites?: BattleGlobeSatellite[]
    /** 当前推演时刻（毫秒） */
    currentTimeMs?: number
    /** 当前选中卫星 NORAD */
    selectedNorad?: number | null
    /** 武器列表 */
    weapons?: BattleGlobeWeapon[]
    /** 接收站/数据中心列表 */
    groundTargets?: BattleGlobeGroundTarget[]
    /** 当前选中武器 ID */
    selectedWeaponId?: string | null
    /** 当前选中地面目标键 */
    selectedGroundTargetKey?: string | null
    /** 任务开始时间（毫秒） */
    taskStartMs?: number
    /** 任务结束时间（毫秒） */
    taskEndMs?: number
    /** 选中卫星时是否自动飞行跟踪 */
    followSelectedSatellite?: boolean
    /** 是否正在推演播放 */
    isDeductionPlaying?: boolean
    /** 推演视觉计划 */
    deductionVisualPlan?: SatelliteDeductionVisualPlan | null
  }>(),
  {
    satellites: () => [],
    currentTimeMs: 0,
    selectedNorad: null,
    weapons: () => [],
    groundTargets: () => [],
    selectedWeaponId: null,
    selectedGroundTargetKey: null,
    taskStartMs: 0,
    taskEndMs: 0,
    followSelectedSatellite: true,
    isDeductionPlaying: false,
    deductionVisualPlan: null,
  }
)

/** 全局布局 Store */
const store = useLayoutStore()

/** Cesium 容器 */
const cesiumContainer = ref<HTMLElement | null>(null)
/** Cesium 版权信息容器 */
const creditEl = ref<HTMLElement | null>(null)

/** Cesium Viewer 实例 */
const viewerRef = shallowRef<Cesium.Viewer | null>(null)
/** 容器尺寸监听 */
let resizeObserver: ResizeObserver | null = null
/** 初始化互斥锁 */
let viewerInitializing = false

/** 推演地面站/卫星视觉状态 */
const deductionGlobeVisualState = computed(() => {
  if (!props.isDeductionPlaying || !props.deductionVisualPlan) {
    return {
      struckReceiveKeys: new Set<string>(),
      activePassReceiveKeys: new Set<string>(),
      passHighlightReceiveKeys: new Set<string>(),
      passHighlightPasses: [] as import('@/utils/buildSatelliteDeductionTimeline').DeductionStationPassWindow[],
      explosionNorad: null as number | null,
    }
  }
  const state = resolveDeductionVisualState(
    props.deductionVisualPlan,
    props.currentTimeMs || 0,
    true
  )
  return {
    struckReceiveKeys: state.struckReceiveKeys,
    activePassReceiveKeys: state.activePassReceiveKeys,
    passHighlightReceiveKeys: state.passHighlightReceiveKeys,
    passHighlightPasses: state.passHighlightPasses,
    explosionNorad:
      state.showExplosion && props.selectedNorad != null ? props.selectedNorad : null,
  }
})

/** 卫星渲染逻辑 */
useBattleGlobeSatellites(
  viewerRef,
  computed(() => props.satellites),
  computed(() => props.currentTimeMs),
  computed(() => props.selectedNorad),
  computed(() => props.followSelectedSatellite),
  computed(() => deductionGlobeVisualState.value.explosionNorad)
)

/** 武器渲染逻辑 */
useBattleGlobeWeapons(
  viewerRef,
  computed(() => props.weapons),
  computed(() => props.selectedWeaponId)
)

/** 推演地面站视觉状态（打击变红、过站高亮） */
const deductionStruckReceiveKeys = computed(
  () => deductionGlobeVisualState.value.struckReceiveKeys
)
const deductionPassHighlightReceiveKeys = computed(
  () => deductionGlobeVisualState.value.passHighlightReceiveKeys
)
const deductionPassHighlightPasses = computed(
  () => deductionGlobeVisualState.value.passHighlightPasses
)

/** 推演时补全过站接收站坐标，保证地球上有可高亮点位 */
const globeGroundTargetsForRender = computed((): BattleGlobeGroundTarget[] => {
  const base = props.groundTargets
  if (!props.isDeductionPlaying || !props.deductionVisualPlan?.stationPasses.length) {
    return base
  }
  return mergeDeductionPassGroundTargets(base, props.deductionVisualPlan.stationPasses)
})

/** 接收站/数据中心渲染逻辑 */
useBattleGlobeGroundTargets(
  viewerRef,
  globeGroundTargetsForRender,
  computed(() => props.selectedGroundTargetKey),
  deductionStruckReceiveKeys,
  deductionPassHighlightReceiveKeys,
  deductionPassHighlightPasses
)

/** 推演 Cesium 特效 */
useBattleGlobeDeductionEffects(
  viewerRef,
  computed(() => props.satellites),
  computed(() => props.currentTimeMs),
  computed(() => props.selectedNorad),
  computed(() => props.isDeductionPlaying),
  computed(() => props.deductionVisualPlan ?? null)
)

/**
 * 判断容器是否具备有效尺寸。
 *
 * @param el 容器元素
 * @returns 宽高均大于 0 时为 true
 */
const hasValidContainerSize = (el: HTMLElement | null): boolean => {
  if (!el) return false
  return (el.clientWidth || 0) > 0 && (el.clientHeight || 0) > 0
}

/**
 * 同步 Viewer 渲染循环与容器尺寸。
 */
const syncViewerRenderLoop = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !cesiumContainer.value) return
  const canRender = hasValidContainerSize(cesiumContainer.value)
  viewer.useDefaultRenderLoop = canRender
  if (canRender) {
    viewer.resize()
    viewer.scene.requestRender()
  }
}

/**
 * 同步 Cesium 时钟到任务时间范围与当前推演时刻。
 */
const syncViewerClock = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return

  const startMs = props.taskStartMs || 0
  const endMs = props.taskEndMs || 0
  if (!startMs || !endMs || endMs <= startMs) return

  const start = Cesium.JulianDate.fromDate(new Date(startMs))
  const stop = Cesium.JulianDate.fromDate(new Date(endMs))
  const current = Cesium.JulianDate.fromDate(new Date(props.currentTimeMs || startMs))

  viewer.clock.startTime = start.clone()
  viewer.clock.stopTime = stop.clone()
  viewer.clock.currentTime = current.clone()
  viewer.clock.clockRange = Cesium.ClockRange.CLAMPED
  viewer.clock.shouldAnimate = false
  viewer.clock.multiplier = 1
}

/**
 * 飞到默认地球视角（无场景区域或区域无效时使用）。
 */
const flyToDefaultEarthView = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(120, 24, 18000000),
    duration: 1.2,
  })
}

/**
 * 恢复战场初始俯视视角（清除卫星选中后使用）。
 */
const restoreOverviewView = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return

  viewer.camera.cancelFlight()
  const destination = store.battleCenterCartensian
  const orientation = store.battleCenterOritentation

  if (destination) {
    viewer.camera.flyTo({
      destination,
      orientation: orientation
        ? {
          heading: orientation.heading,
          pitch: orientation.pitch,
          roll: orientation.roll,
        }
        : {
          heading: 0,
          pitch: -Cesium.Math.toRadians(90),
          roll: 0,
        },
      duration: 1.2,
    })
    viewer.scene.requestRender()
    return
  }

  if (store.battle) {
    markBattleArea(viewer, store.battle, 24000000, { clampToGround: true })
    viewer.scene.requestRender()
    return
  }

  flyToDefaultEarthView()
}

defineExpose({
  restoreOverviewView,
})

/** 战场名称标签锚点（用于椭球遮挡判断） */
let battleLabelAnchor: Cesium.Cartesian3 | null = null

/**
 * 根据相机位置更新战场名称标签可见性，避免地球背面仍显示。
 */
const updateBattleLabelOcclusion = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !battleLabelAnchor) return

  const entity = viewer.entities.getById('battle-area-label')
  if (!entity) return

  const occluder = new Cesium.EllipsoidalOccluder(
    Cesium.Ellipsoid.WGS84,
    viewer.camera.positionWC
  )
  const visible = occluder.isPointVisible(battleLabelAnchor)
  if (entity.show !== visible) {
    entity.show = visible
    viewer.scene.requestRender()
  }
}

/**
 * 注册战场名称标签遮挡更新监听。
 */
const ensureBattleLabelOcclusionListener = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || battleLabelAnimRemover) return
  battleLabelAnimRemover = viewer.scene.postUpdate.addEventListener(updateBattleLabelOcclusion)
}

/**
 * 移除场景名称标注实体。
 */
const clearBattleLabel = () => {
  battleLabelAnimRemover?.()
  battleLabelAnimRemover = null
  battleLabelAnchor = null

  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return
  const labelEntity = viewer.entities.getById('battle-area-label')
  if (labelEntity) {
    viewer.entities.remove(labelEntity)
  }
}

/** 战场名称漂浮动画监听移除函数（保留清理钩子） */
let battleLabelAnimRemover: (() => void) | null = null

/**
 * 在战场区域北侧外部添加贴地名称标注（如「台湾战场2」）。
 */
const renderBattleLabel = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !store.battle?.name) return

  const labelPosition = resolveBattleSpaceLabelPosition(store.battle, store.battleCenterCartensian)
  if (!labelPosition) return

  const cartographic = Cesium.Cartographic.fromCartesian(labelPosition)
  if (
    !Number.isFinite(cartographic.longitude) ||
    !Number.isFinite(cartographic.latitude) ||
    !Number.isFinite(cartographic.height)
  ) {
    return
  }

  clearBattleLabel()
  battleLabelAnchor = Cesium.Cartesian3.clone(labelPosition)
  viewer.entities.add({
    id: 'battle-area-label',
    position: labelPosition,
    label: {
      text: store.battle.name,
      font: 'bold 14px "Microsoft YaHei", sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#ff3333'),
      outlineColor: Cesium.Color.fromCssColorString('#1a0000'),
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      // 参与地球深度检测；Infinity 会导致标签穿透地球背面
      disableDepthTestDistance: 0,
      pixelOffset: new Cesium.Cartesian2(0, -4),
    },
  })
  ensureBattleLabelOcclusionListener()
  updateBattleLabelOcclusion()
}

/**
 * 根据当前场景绘制区域并调整视角。
 */
const renderBattleArea = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return

  try {
    if (store.battle) {
      markBattleArea(viewer, store.battle, 24000000, { clampToGround: true })
      renderBattleLabel()
      if (!store.battleCenterCartensian && !resolveBattleSpaceLabelPosition(store.battle)) {
        flyToDefaultEarthView()
      }
    } else {
      clearBattleLabel()
      flyToDefaultEarthView()
    }
  } catch (error) {
    console.error('渲染战场区域失败:', error)
    flyToDefaultEarthView()
  }

  viewer.scene.requestRender()
}

/**
 * 初始化 Cesium Viewer（地球底图 + 场景区域 + 卫星 Point 渲染）。
 */
const initViewer = async () => {
  if ((viewerRef.value && !viewerRef.value.isDestroyed()) || viewerInitializing || !cesiumContainer.value) return
  if (!hasValidContainerSize(cesiumContainer.value)) return

  viewerInitializing = true
  try {
    const viewer = new Cesium.Viewer(cesiumContainer.value, {
      scene3DOnly: true,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      creditContainer: creditEl.value || undefined,
      fullscreenButton: false,
      baseLayerPicker: false,
      baseLayer: false,
      infoBox: false,
      selectionIndicator: false,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
    })

    viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: `${MATERIAL_URL}/{z}/{x}/{y}.png`,
        credit: 'credit',
      })
    )
    // 地球写入深度缓冲：背面轨道卫星参与深度检测后不再穿透地球
    viewer.scene.globe.depthTestAgainstTerrain = true
    viewer.scene.globe.showSkirts = false
    viewer.scene.fog.enabled = false

    viewerRef.value = viewer

    resizeObserver = new ResizeObserver(() => {
      syncViewerRenderLoop()
      if (!viewerRef.value && cesiumContainer.value && hasValidContainerSize(cesiumContainer.value)) {
        void initViewer()
      }
    })
    resizeObserver.observe(cesiumContainer.value)

    syncViewerRenderLoop()
    syncViewerClock()
    renderBattleArea()
  } finally {
    viewerInitializing = false
  }
}

/**
 * keep-alive 激活时恢复渲染并刷新场景标记。
 */
const refreshAfterActivate = () => {
  syncViewerRenderLoop()
  if (!viewerRef.value || viewerRef.value.isDestroyed()) {
    void initViewer()
    return
  }
  syncViewerClock()
  renderBattleArea()
}

onMounted(() => {
  void initViewer()
})

onActivated(() => {
  refreshAfterActivate()
})

watch(
  () => store.battle?.id,
  () => {
    renderBattleArea()
  }
)

watch(
  () => store.battle?.area,
  () => {
    renderBattleArea()
  }
)

watch(
  () => store.battle?.name,
  () => {
    renderBattleLabel()
  }
)

watch(
  () => store.battleCenterCartensian,
  () => {
    renderBattleLabel()
  }
)

watch(
  () => [props.currentTimeMs, props.taskStartMs, props.taskEndMs] as const,
  () => {
    syncViewerClock()
    viewerRef.value?.scene.requestRender()
  }
)

onBeforeUnmount(() => {
  clearBattleLabel()
  resizeObserver?.disconnect()
  resizeObserver = null
  if (viewerRef.value && !viewerRef.value.isDestroyed()) {
    viewerRef.value.destroy()
  }
  viewerRef.value = null
})
</script>

<style scoped lang="scss">
.battle-globe-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;

  .credit {
    display: none;
  }
}
</style>
