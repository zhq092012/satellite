<template>
  <div ref="cesiumContainer" class="battle-globe-layer">
    <div ref="creditEl" class="credit"></div>
    <div v-if="showEntityDetailLabel && detailLabelScreen" class="globe-entity-detail-label"
      :class="{ 'globe-entity-detail-label--satellite-metrics': hasSatelliteGridLabel }"
      :style="{
      left: `${detailLabelScreen.left}px`,
      top: `${detailLabelScreen.top}px`,
    }">
      <el-tooltip :content="detailLabelTooltipText" placement="top" :show-after="200"
        popper-class="globe-entity-detail-label-tooltip">
        <div v-if="hasSatelliteGridLabel && satelliteDetailView"
          class="globe-entity-detail-label__inner globe-entity-detail-label__inner--grid">
          <div class="globe-sat-detail__title">{{ satelliteDetailView.name }}</div>
          <div v-if="satelliteDetailView.metaLine" class="globe-sat-detail__meta">{{ satelliteDetailView.metaLine }}
          </div>
          <div class="globe-sat-detail__grid">
            <div v-for="(cell, index) in satelliteDetailView.metricCells" :key="`${cell.label}-${index}`"
              class="globe-sat-detail__cell">
              <span class="globe-sat-detail__cell-label">{{ cell.label }}</span>
              <span class="globe-sat-detail__cell-value">{{ cell.value }}</span>
            </div>
            <div class="globe-sat-detail__cell globe-sat-detail__cell--full">
              <span class="globe-sat-detail__cell-label">{{ satelliteDetailView.nextTransit.label }}</span>
              <span class="globe-sat-detail__cell-value">{{ satelliteDetailView.nextTransit.value }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="detailLabelPresentation" class="globe-entity-detail-label__inner">
          {{ detailLabelPresentation.displayText }}
        </div>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { markBattleArea, markTaskCombatArea, resolveBattleSpaceLabelPosition } from '@/utils/tools/functionTool'
import { useLayoutStore } from '@/store/modules/layout'
import { useBattleGlobeSatellites } from '@/composables/useBattleGlobeSatellites'
import { useBattleGlobeWeapons } from '@/composables/useBattleGlobeWeapons'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import { mergeDeductionPassGroundTargets, parseGroundTargetKey } from '@/utils/buildBattleGlobeGroundTargets'
import {
  buildGlobeDetailLabelDisplay,
  GLOBE_DETAIL_LABEL_MAX_WIDTH_PX,
} from '@/utils/globeDetailLabelDisplay'
import type { GlobeSatelliteDetailLabelViewModel } from '@/utils/formatTaskPanelResourceDetail'
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
    /** 当前选中目标（卫星/武器/地面站）的 Label 详情文案（多行） */
    selectedResourceDetailText?: string | null
    /** 选中卫星时的 Grid Label 视图 */
    selectedSatelliteDetailView?: GlobeSatelliteDetailLabelViewModel | null
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
    selectedResourceDetailText: null,
    selectedSatelliteDetailView: null,
  }
)

/** 选中目标 Label 详情（与选中态同步，由父组件在资源详情点击时写入） */
const selectedResourceDetailText = computed(() => props.selectedResourceDetailText ?? null)

/** 选中卫星 Grid 视图 */
const satelliteDetailView = computed(() => props.selectedSatelliteDetailView ?? null)

/** 是否使用卫星指标 Grid 浮层 */
const hasSatelliteGridLabel = computed(() => Boolean(satelliteDetailView.value?.metricCells.length))

/** 详情 Label 展示（约 300px 宽、行内 …） */
const detailLabelPresentation = computed(() => {
  if (hasSatelliteGridLabel.value) return null
  const full = selectedResourceDetailText.value
  if (!full?.trim()) return null
  return buildGlobeDetailLabelDisplay(full, GLOBE_DETAIL_LABEL_MAX_WIDTH_PX)
})

/** 是否显示 HTML 详情浮层 */
const showEntityDetailLabel = computed(
  () => hasSatelliteGridLabel.value || Boolean(detailLabelPresentation.value),
)

/** Tooltip 全文 */
const detailLabelTooltipText = computed(() => {
  if (hasSatelliteGridLabel.value && satelliteDetailView.value) {
    return selectedResourceDetailText.value?.trim() || satelliteDetailView.value.name
  }
  return detailLabelPresentation.value?.fullText ?? ''
})

/** 详情 HTML Label 屏幕坐标（跟随选中目标） */
const detailLabelScreen = ref<{ left: number; top: number } | null>(null)

/** postRender：更新详情 Label 屏幕位置 */
let detailLabelPostRenderRemover: (() => void) | null = null

/**
 * 根据 TLE 计算卫星在指定时刻的 ECEF 坐标（米）。
 *
 * @param sat 卫星
 * @param timeMs 时刻（毫秒）
 * @returns 世界坐标；失败时 null
 */
const propagateSatelliteWorldPosition = (
  sat: BattleGlobeSatellite,
  timeMs: number,
): Cesium.Cartesian3 | null => {
  try {
    const satrec = satellitejs.twoline2satrec(sat.line1, sat.line2)
    const pv = satellitejs.propagate(satrec, new Date(timeMs))
    if (!pv?.position) return null
    const gmst = satellitejs.gstime(new Date(timeMs))
    const ecef = satellitejs.eciToEcf(pv.position, gmst)
    return new Cesium.Cartesian3(ecef.x * 1000, ecef.y * 1000, ecef.z * 1000)
  } catch {
    return null
  }
}

/**
 * 解析当前选中目标的世界坐标（用于详情 Label 锚点）。
 *
 * @returns 世界坐标；无选中或无坐标时 null
 */
const resolveSelectedDetailWorldPosition = (): Cesium.Cartesian3 | null => {
  if (props.selectedWeaponId) {
    const weapon = props.weapons.find((item) => item.id === props.selectedWeaponId)
    if (weapon) return Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 0)
  }
  if (props.selectedGroundTargetKey) {
    const parsed = parseGroundTargetKey(props.selectedGroundTargetKey)
    if (parsed) {
      const target = props.groundTargets.find(
        (item) => item.kind === parsed.kind && item.id === parsed.id,
      )
      if (target) return Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude, 0)
    }
  }
  if (props.selectedNorad) {
    const sat = props.satellites.find((item) => item.norad === props.selectedNorad)
    if (sat) {
      const timeMs = props.currentTimeMs > 0 ? props.currentTimeMs : Date.now()
      return propagateSatelliteWorldPosition(sat, timeMs)
    }
  }
  return null
}

/** 将详情 Label 同步到屏幕坐标（地球旋转/缩放后跟随目标） */
const syncDetailLabelScreenPosition = () => {
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !showEntityDetailLabel.value) {
    detailLabelScreen.value = null
    return
  }
  const world = resolveSelectedDetailWorldPosition()
  if (!world) {
    detailLabelScreen.value = null
    return
  }
  const windowPos = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, world)
  if (!windowPos) {
    detailLabelScreen.value = null
    return
  }
  detailLabelScreen.value = { left: windowPos.x, top: windowPos.y }
}

/** 注册/注销详情 Label 的 postRender 跟随 */
const syncDetailLabelPostRenderListener = () => {
  detailLabelPostRenderRemover?.()
  detailLabelPostRenderRemover = null
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !showEntityDetailLabel.value) {
    detailLabelScreen.value = null
    return
  }
  detailLabelPostRenderRemover = viewer.scene.postRender.addEventListener(() => {
    syncDetailLabelScreenPosition()
  })
  syncDetailLabelScreenPosition()
}

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
      struckSatelliteNorad: null as number | null,
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
    struckSatelliteNorad:
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
  computed(() => deductionGlobeVisualState.value.struckSatelliteNorad),
  computed(() => props.isTimelinePlaying),
  selectedResourceDetailText
)

/** 选中卫星 Entity.path 轨迹（单星推演时由推演模块绘制） */
useBattleGlobeTimelineSelectedOrbit(
  viewerRef,
  computed(() => props.satellites),
  computed(() => props.currentTimeMs),
  computed(() => props.selectedNorad),
  computed(() => props.isDeductionPlaying),
  computed(() => props.taskStartMs),
  computed(() => props.taskEndMs)
)

/** 武器渲染逻辑 */
useBattleGlobeWeapons(
  viewerRef,
  computed(() => props.weapons),
  computed(() => props.selectedWeaponId),
  selectedResourceDetailText
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
  computed(() => props.selectedGroundTargetKey),
  deductionStruckReceiveKeys,
  deductionPassHighlightReceiveKeys,
  deductionPassHighlightPasses,
  selectedResourceDetailText
)

/** 推演 Cesium 特效 */
useBattleGlobeDeductionEffects(
  viewerRef,
  computed(() => props.satellites),
  computed(() => props.currentTimeMs),
  computed(() => props.selectedNorad),
  computed(() => props.isDeductionPlaying),
  computed(() => props.deductionVisualPlan ?? null),
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
    markTaskCombatArea(viewer, store.taskCombatArea)
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
  () => store.taskCombatArea,
  () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return
    markTaskCombatArea(viewer, store.taskCombatArea)
    viewer.scene.requestRender()
  },
  { deep: true }
)

watch(
  () => [props.currentTimeMs, props.taskStartMs, props.taskEndMs] as const,
  () => {
    syncViewerClock()
    viewerRef.value?.scene.requestRender()
  }
)

watch(
  () =>
    [
      viewerRef.value,
      detailLabelPresentation.value?.fullText,
      props.selectedSatelliteDetailView,
      props.selectedNorad,
      props.selectedWeaponId,
      props.selectedGroundTargetKey,
      props.currentTimeMs,
    ] as const,
  () => {
    syncDetailLabelPostRenderListener()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  detailLabelPostRenderRemover?.()
  detailLabelPostRenderRemover = null
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

.globe-entity-detail-label {
  position: absolute;
  z-index: 6;
  pointer-events: auto;
  transform: translate(8px, calc(-100% - 16px));
  max-width: 300px;

  &--satellite-metrics {
    max-width: 380px;
  }
}

.globe-entity-detail-label__inner {
  box-sizing: border-box;
  max-width: 300px;
  padding: 6px 8px;
  text-align: left;
  white-space: pre-line;
  word-break: break-all;
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.45;
  color: #facc15;
  background: rgba(0, 0, 0, 0.58);
  border-radius: 4px;
  cursor: default;
}

.globe-entity-detail-label--satellite-metrics .globe-entity-detail-label__inner {
  max-width: 380px;
}

.globe-entity-detail-label__inner--grid {
  min-width: 320px;
  max-width: 380px;
  padding: 8px 10px;
  white-space: normal;
  word-break: normal;
}

.globe-sat-detail__title {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
  color: #facc15;
  margin-bottom: 2px;
}

.globe-sat-detail__meta {
  font-size: 11px;
  font-weight: 500;
  line-height: 1.35;
  color: rgba(250, 204, 21, 0.82);
  margin-bottom: 6px;
}

.globe-sat-detail__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 12px;
  row-gap: 8px;
  align-items: start;
  justify-items: start;
  text-align: left;
}

.globe-sat-detail__cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.globe-sat-detail__cell--full {
  grid-column: 1 / -1;
}

.globe-sat-detail__cell-label {
  font-size: 10px;
  font-weight: 500;
  line-height: 1.2;
  color: rgba(255, 255, 255, 0.55);
}

.globe-sat-detail__cell-value {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  color: #f8fafc;
  word-break: break-word;
}
</style>

<style lang="scss">
.globe-entity-detail-label-tooltip {
  max-width: 360px !important;
  white-space: pre-line !important;
  word-break: break-word;
  text-align: left;
  line-height: 1.45;
}
</style>
