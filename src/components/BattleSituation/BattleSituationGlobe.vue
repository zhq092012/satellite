<template>
  <div ref="cesiumContainer" class="battle-globe-layer">
    <div ref="creditEl" class="credit"></div>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import { markTaskAreas, resolveTaskSpaceLabelPosition } from '@/utils/tools/functionTool'
import { useLayoutStore } from '@/store/modules/layout'
import { useBattleGlobeSatellites } from '@/composables/useBattleGlobeSatellites'
import { useBattleGlobeWeapons } from '@/composables/useBattleGlobeWeapons'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import { useBattleGlobeGroundTargets } from '@/composables/useBattleGlobeGroundTargets'
import { useBattleGlobeTimelineSelectedOrbit } from '@/composables/useBattleGlobeTimelineSelectedOrbit'
import { computed, onActivated, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

/** 地图瓦片服务地址 */
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL

const props = withDefaults(
  defineProps<{
    /** 任务分析卫星列表（含 TLE） */
    satellites?: BattleGlobeSatellite[]
    /** 时间轴当前时刻（毫秒） */
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
    /** 选中卫星时是否自动飞行跟踪（列表/球面点选默认仅高亮） */
    followSelectedSatellite?: boolean
    /** 选中武器时是否自动飞行跟踪 */
    followSelectedWeapon?: boolean
    /** 选中地面目标时是否自动飞行跟踪 */
    followSelectedGroundTarget?: boolean
    /** 底部时间轴是否正在播放 */
    isTimelinePlaying?: boolean
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
    followSelectedSatellite: false,
    followSelectedWeapon: false,
    followSelectedGroundTarget: false,
    isTimelinePlaying: false,
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
   * 计算：底部任务时间轴是否正在播放。
   * 返回：`props.isTimelinePlaying`。
   * 作用：播放中调整卫星可视化策略。
   */
  computed(() => props.isTimelinePlaying)
)

/** 选中卫星 Entity.path 轨迹 */
useBattleGlobeTimelineSelectedOrbit(
  viewerRef,
  computed(() => props.satellites),
  computed(() => props.currentTimeMs),
  computed(() => props.selectedNorad),
  computed(() => props.taskStartMs),
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
  computed(() => props.selectedWeaponId),
  /**
   * 计算：选中武器时是否跟随相机。
   * 返回：`props.followSelectedWeapon`。
   * 作用：选中武器 ID 变化时是否 `flyTo`。
   */
  computed(() => props.followSelectedWeapon)
)

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
 * 恢复战场初始俯视视角。
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

  if (store.activedTask?.areas?.length) {
    markTaskAreas(viewer, store.activedTask.areas, 24000000, { clampToGround: true })
    viewer.scene.requestRender()
    return
  }

  flyToDefaultEarthView()
}

/** 接收站/数据中心渲染逻辑 */
useBattleGlobeGroundTargets(
  viewerRef,
  computed(() => props.groundTargets),
  computed(() => props.selectedGroundTargetKey),
  computed(() => props.followSelectedGroundTarget)
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
 * 同步 Cesium 时钟到任务时间范围与当前时刻。
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
  const labelPosition = resolveTaskSpaceLabelPosition(store.activedTask?.areas, store.battleCenterCartensian)
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
      markTaskAreas(viewer, store.activedTask?.areas ?? [], 24000000, { clampToGround: true })
      renderBattleLabel()
      if (!store.battleCenterCartensian && !resolveTaskSpaceLabelPosition(store.activedTask?.areas)) {
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
 * 监听：当前任务区域 `store.activedTask.areas`。
 * 返回：回调不返回清理函数。
 * 作用：任务区域变更时刷新多边形/圆与视角。
 */
watch(
  () => store.activedTask?.areas,
  () => {
    renderBattleArea()
  },
  { deep: true }
)

/**
 * 监听：当前任务 ID。
 * 返回：回调不返回清理函数。
 * 作用：切换任务时重绘任务区域。
 */
watch(
  () => store.activedTask?.id,
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
