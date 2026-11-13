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
import { useBattleGlobeTimelineSelectedOrbit } from '@/composables/useBattleGlobeTimelineSelectedOrbit'
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
    /** 推演播放时是否让相机跟随卫星 */
    followDeductionSatellite?: boolean
    /** 是否正在推演播放 */
    isDeductionPlaying?: boolean
    /** 底部时间轴是否正在播放 */
    isTimelinePlaying?: boolean
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
    followDeductionSatellite: true,
    isDeductionPlaying: false,
    isTimelinePlaying: false,
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

/**
 * 计算：当前推演时刻下的地面站过站/打击与爆炸 NORAD 等视觉状态。
 * 返回：含 `struckReceiveKeys`、`passHighlightReceiveKeys`、`passHighlightPasses`、`explosionNorad` 等的对象；非推演时各集合为空且 `explosionNorad` 为 null。
 * 作用：供卫星隐藏点位、地面目标高亮及 composable 入参。
 */
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
  /**
   * 计算：父组件传入的卫星列表。
   * 返回：`props.satellites`。
   * 作用：作为 `useBattleGlobeSatellites` 的数据源 Ref。
   */
  computed(() => props.satellites),
  /**
   * 计算：时间轴/推演当前时刻（毫秒）。
   * 返回：`props.currentTimeMs`。
   * 作用：驱动卫星点位时刻位置更新。
   */
  computed(() => props.currentTimeMs),
  /**
   * 计算：当前选中的卫星 NORAD。
   * 返回：`props.selectedNorad`。
   * 作用：控制选中高亮与跟随飞行。
   */
  computed(() => props.selectedNorad),
  /**
   * 计算：非推演时选中卫星是否跟随相机。
   * 返回：`props.followSelectedSatellite`。
   * 作用：选中 NORAD 变化时是否 `flyTo` 卫星。
   */
  computed(() => props.followSelectedSatellite),
  /**
   * 计算：推演爆炸特效对应的 NORAD。
   * 返回：`deductionGlobeVisualState.explosionNorad`。
   * 作用：爆炸时刻隐藏该星点位。
   */
  computed(() => deductionGlobeVisualState.value.explosionNorad),
  /**
   * 计算：底部任务时间轴是否正在播放。
   * 返回：`props.isTimelinePlaying`。
   * 作用：播放中调整卫星可视化策略。
   */
  computed(() => props.isTimelinePlaying)
)

/** 选中卫星 Entity.path 轨迹（单星推演时由推演模块绘制） */
useBattleGlobeTimelineSelectedOrbit(
  viewerRef,
  /**
   * 计算：卫星列表（供轨道 TLE 查找）。
   * 返回：`props.satellites`。
   * 作用：选中星轨迹重建的数据源。
   */
  computed(() => props.satellites),
  /**
   * 计算：当前时刻毫秒。
   * 返回：`props.currentTimeMs`。
   * 作用：同步 Cesium 时钟与路径显示时刻。
   */
  computed(() => props.currentTimeMs),
  /**
   * 计算：选中 NORAD。
   * 返回：`props.selectedNorad`。
   * 作用：决定是否为该星绘制非推演轨道 path。
   */
  computed(() => props.selectedNorad),
  /**
   * 计算：单星推演是否播放中。
   * 返回：`props.isDeductionPlaying`。
   * 作用：推演播放时清理由本模块绘制的选中轨道。
   */
  computed(() => props.isDeductionPlaying),
  /**
   * 计算：任务开始毫秒。
   * 返回：`props.taskStartMs`。
   * 作用：轨道 path 时间窗口起点。
   */
  computed(() => props.taskStartMs),
  /**
   * 计算：任务结束毫秒。
   * 返回：`props.taskEndMs`。
   * 作用：轨道 path 时间窗口终点。
   */
  computed(() => props.taskEndMs)
)

/** 武器渲染逻辑 */
useBattleGlobeWeapons(
  viewerRef,
  /**
   * 计算：武器列表。
   * 返回：`props.weapons`。
   * 作用：地球武器点位数据源。
   */
  computed(() => props.weapons),
  /**
   * 计算：选中武器 ID。
   * 返回：`props.selectedWeaponId`。
   * 作用：高亮与 `flyTo` 选中武器。
   */
  computed(() => props.selectedWeaponId)
)

/**
 * 计算：推演中已被打击的接收站键集合。
 * 返回：`Set<string>`（来自 `deductionGlobeVisualState`）。
 * 作用：传给地面目标 composable 做打击着色。
 */
const deductionStruckReceiveKeys = computed(
  () => deductionGlobeVisualState.value.struckReceiveKeys
)
/**
 * 计算：推演中需过站高亮的接收站键集合。
 * 返回：`Set<string>`。
 * 作用：地面目标过站高亮样式。
 */
const deductionPassHighlightReceiveKeys = computed(
  () => deductionGlobeVisualState.value.passHighlightReceiveKeys
)
/**
 * 计算：推演过站高亮窗口列表（含坐标）。
 * 返回：`DeductionStationPassWindow[]`。
 * 作用：合并补全地面目标点位并绘制高亮。
 */
const deductionPassHighlightPasses = computed(
  () => deductionGlobeVisualState.value.passHighlightPasses
)

/**
 * 计算：传给地面目标模块的最终目标列表。
 * 返回：`BattleGlobeGroundTarget[]`（推演时合并过站补点，否则为 `props.groundTargets`）。
 * 作用：确保过站窗口在地球上有可渲染坐标。
 */
const globeGroundTargetsForRender = computed((): BattleGlobeGroundTarget[] => {
  const base = props.groundTargets
  if (!props.isDeductionPlaying || !props.deductionVisualPlan?.stationPasses.length) {
    return base
  }
  return mergeDeductionPassGroundTargets(base, props.deductionVisualPlan.stationPasses)
})

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
 * 恢复战场初始俯视视角（清除卫星选中、推演不跟随时使用）。
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

/** 接收站/数据中心渲染逻辑 */
useBattleGlobeGroundTargets(
  viewerRef,
  globeGroundTargetsForRender,
  /**
   * 计算：选中地面目标复合键。
   * 返回：`props.selectedGroundTargetKey`。
   * 作用：选中态飞行与高亮。
   */
  computed(() => props.selectedGroundTargetKey),
  deductionStruckReceiveKeys,
  deductionPassHighlightReceiveKeys,
  deductionPassHighlightPasses
)

/** 推演 Cesium 特效 */
useBattleGlobeDeductionEffects(
  viewerRef,
  /**
   * 计算：卫星列表。
   * 返回：`props.satellites`。
   * 作用：推演特效定位卫星与 TLE。
   */
  computed(() => props.satellites),
  /**
   * 计算：当前推演/时间轴时刻毫秒。
   * 返回：`props.currentTimeMs`。
   * 作用：驱动特效与爆炸时刻。
   */
  computed(() => props.currentTimeMs),
  /**
   * 计算：推演目标卫星 NORAD。
   * 返回：`props.selectedNorad`。
   * 作用：绑定单星推演实体与爆炸。
   */
  computed(() => props.selectedNorad),
  /**
   * 计算：单星推演播放开关。
   * 返回：`props.isDeductionPlaying`。
   * 作用：开启/清理推演实体与 postUpdate。
   */
  computed(() => props.isDeductionPlaying),
  /**
   * 计算：推演视觉计划。
   * 返回：`props.deductionVisualPlan`，缺省为 null。
   * 作用：过站、打击、爆炸时间线数据源。
   */
  computed(() => props.deductionVisualPlan ?? null),
  /**
   * 计算：推演时相机是否跟随卫星。
   * 返回：`props.followDeductionSatellite`。
   * 作用：控制推演相机跟随与恢复俯视。
   */
  computed(() => props.followDeductionSatellite),
  restoreOverviewView
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

  // 解析战场区域名称标签经纬度锚点
  const labelPosition = resolveBattleSpaceLabelPosition(store.battle, store.battleCenterCartensian)
  if (!labelPosition) return

  // 将标签经纬度锚点转换为 Cartographic 对象
  const cartographic = Cesium.Cartographic.fromCartesian(labelPosition)
  // 如果 Cartographic 对象的经度、纬度或高度不为有限数，则返回
  if (
    !Number.isFinite(cartographic.longitude) ||
    !Number.isFinite(cartographic.latitude) ||
    !Number.isFinite(cartographic.height)
  ) {
    return
  }

  // 清除战场区域名称标签
  clearBattleLabel()
  // 复制标签经纬度锚点
  battleLabelAnchor = Cesium.Cartesian3.clone(labelPosition)
  // 添加标签实体
  viewer.entities.add({
    // 标签实体 ID
    id: 'battle-area-label',
    position: labelPosition,
    label: {
      text: store.battle.name,
      font: 'bold 14px "Microsoft YaHei", sans-serif',
      fillColor: Cesium.Color.fromCssColorString('#ff3333'),
      outlineColor: Cesium.Color.fromCssColorString('#1a0000'),
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      // 水平居中对齐
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      // 垂直底部对齐
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      // 贴地高度参考
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      // 参与地球深度检测,小于 5000 米时不参与深度检测
      disableDepthTestDistance: 5000,
      // 像素偏移量，向下偏移 4 像素
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
    /**
     * 仅生产构建加载自定义地球影像瓦片。
     * 开发模式不请求 VITE_MATERIAL_URL，配合 baseLayer: false 使用无贴图地球，加快本地启动并避免代理未就绪时报错。
     */
    if (import.meta.env.PROD) {
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `${MATERIAL_URL}/{z}/{x}/{y}.png`,
          credit: 'credit',
        })
      )
    }
    // 不参与地球深度检测
    viewer.scene.globe.depthTestAgainstTerrain = false
    // 不显示地球边缘
    viewer.scene.globe.showSkirts = false
    // 禁用雾效
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

/**
 * 监听：当前场景（战场）ID。
 * 返回：回调不返回清理函数。
 * 作用：换场景时重绘战场区域与默认视角。
 */
watch(
  () => store.battle?.id,
  () => {
    renderBattleArea()
  }
)

/**
 * 监听：当前场景区域几何 `store.battle.area`。
 * 返回：回调不返回清理函数。
 * 作用：区域变更时刷新多边形与视角。
 */
watch(
  () => store.battle?.area,
  () => {
    renderBattleArea()
  }
)

/**
 * 监听：战场显示名称。
 * 返回：回调不返回清理函数。
 * 作用：名称变化时更新贴地标签文本。
 */
watch(
  () => store.battle?.name,
  () => {
    renderBattleLabel()
  }
)

/**
 * 监听：战场中心笛卡尔坐标。
 * 返回：回调不返回清理函数。
 * 作用：中心点变化时重新计算标签位置与遮挡。
 */
watch(
  () => store.battleCenterCartensian,
  () => {
    renderBattleLabel()
  }
)

/**
 * 监听：当前时刻与任务起止毫秒三元组。
 * 返回：回调不返回清理函数。
 * 作用：同步 Cesium Viewer 时钟并请求重绘。
 */
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
