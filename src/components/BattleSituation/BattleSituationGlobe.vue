<template>
  <div ref="cesiumContainer" class="battle-globe-layer">
    <div ref="creditEl" class="credit"></div>
    <div v-if="showEntityDetailLabel && detailLabelScreen" class="globe-entity-detail-label"
      :class="{ 'globe-entity-detail-label--satellite-metrics': hasResourceGridLabel }"
      :style="{
      left: `${detailLabelScreen.left}px`,
      top: `${detailLabelScreen.top}px`,
    }">
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
      <div v-else-if="hasResourceGridPanel && resourceGridPanelView"
        class="globe-entity-detail-label__inner globe-entity-detail-label__inner--grid">
        <div class="globe-sat-detail__title">{{ resourceGridPanelView.name }}</div>
        <div class="globe-sat-detail__grid">
          <div v-for="(cell, index) in resourceGridPanelView.metricCells" :key="`grid-${cell.label}-${index}`"
            class="globe-sat-detail__cell">
            <span class="globe-sat-detail__cell-label">{{ cell.label }}</span>
            <span class="globe-sat-detail__cell-value">{{ cell.value }}</span>
          </div>
          <div v-for="(cell, index) in resourceGridPanelView.fullWidthCells"
            :key="`grid-full-${cell.label}-${index}`" class="globe-sat-detail__cell globe-sat-detail__cell--full">
            <span class="globe-sat-detail__cell-label">{{ cell.label }}</span>
            <span class="globe-sat-detail__cell-value">{{ cell.value }}</span>
          </div>
        </div>
      </div>
      <div v-else-if="plainDetailLabelText" class="globe-entity-detail-label__inner globe-entity-detail-label__inner--plain">
        {{ plainDetailLabelText }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { readThemeColor } from '@/styles/themeColor'
import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { markBattleArea, markTaskCombatArea, resolveBattleSpaceLabelPosition } from '@/utils/tools/cesiumBattleArea'
import { useLayoutStore } from '@/store/modules/layout'
import { useBattleGlobeSatellites } from '@/composables/useBattleGlobeSatellites'
import { useBattleGlobeWeapons } from '@/composables/useBattleGlobeWeapons'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import { mergeDeductionPassGroundTargets, parseGroundTargetKey } from '@/utils/buildBattleGlobeGroundTargets'
import type {
  GlobeGroundDetailLabelViewModel,
  GlobeResourceGridDetailViewModel,
  GlobeSatelliteDetailLabelViewModel,
  GlobeWeaponDetailLabelViewModel,
} from '@/utils/formatTaskPanelResourceDetail'
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
    /** 用户主动聚焦的卫星系列（该系列全部卫星黄色高亮，不显示 Label） */
    highlightedSeries?: string | null
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
    /** 选中地面站 / 数据中心时的 Grid Label 视图 */
    selectedGroundDetailView?: GlobeGroundDetailLabelViewModel | null
    /** 选中武器时的 Grid Label 视图 */
    selectedWeaponDetailView?: GlobeWeaponDetailLabelViewModel | null
  }>(),
  {
    satellites: () => [],
    currentTimeMs: 0,
    selectedNorad: null,
    highlightedSeries: null,
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
    selectedGroundDetailView: null,
    selectedWeaponDetailView: null,
  }
)

/** 选中目标 Label 详情（与选中态同步，由父组件在资源详情点击时写入） */
const selectedResourceDetailText = computed(() => props.selectedResourceDetailText ?? null)

/** 选中卫星 Grid 视图 */
const satelliteDetailView = computed(() => props.selectedSatelliteDetailView ?? null)

/** 选中地面目标 Grid 视图 */
const groundDetailView = computed(() => props.selectedGroundDetailView ?? null)

/** 选中武器 Grid 视图 */
const weaponDetailView = computed(() => props.selectedWeaponDetailView ?? null)

/** 是否使用卫星指标 Grid 浮层 */
const hasSatelliteGridLabel = computed(() => Boolean(satelliteDetailView.value?.metricCells.length))

/** 地面站 / 武器通用 Grid 面板（卫星单独模板） */
const resourceGridPanelView = computed((): GlobeResourceGridDetailViewModel | null => {
  /** 地面目标优先于武器；两者都没有格子时不使用通用面板 */
  const ground = groundDetailView.value
  if (ground?.metricCells.length) return ground
  const weapon = weaponDetailView.value
  if (weapon?.metricCells.length) return weapon
  return null
})

/** 地面站或武器是否已有可渲染的 Grid 面板 */
const hasResourceGridPanel = computed(() => resourceGridPanelView.value != null)

/** 卫星 / 地面 / 武器 Grid 浮层（加宽样式） */
const hasResourceGridLabel = computed(
  () => hasSatelliteGridLabel.value || hasResourceGridPanel.value,
)

/** 无 Grid 时的纯文本详情（系列等；完整展示、不截断） */
const plainDetailLabelText = computed(() => {
  if (hasResourceGridLabel.value) return null
  /** 去掉首尾空白后的多行文案；空串不显示纯文本浮层 */
  const full = selectedResourceDetailText.value?.trim()
  return full || null
})

/** 是否显示 HTML 详情浮层 */
const showEntityDetailLabel = computed(
  () => hasResourceGridLabel.value || Boolean(plainDetailLabelText.value),
)

/**
 * 详情 HTML Label 相对容器的屏幕坐标。
 * 每帧由世界坐标投影得到，目标在地球背面或投影失败时为 null。
 */
const detailLabelScreen = ref<{
  /** 相对容器左侧的像素 */
  left: number
  /** 相对容器顶部的像素 */
  top: number
} | null>(null)

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
    /** 由两行根数解析出的轨道记录 */
    const satrec = satellitejs.twoline2satrec(sat.line1, sat.line2)
    /** SGP4 传播得到的 ECI 位置与速度（千米） */
    const pv = satellitejs.propagate(satrec, new Date(timeMs))
    if (!pv?.position) return null
    /** 该时刻的格林尼治恒星时，用于 ECI 转 ECF */
    const gmst = satellitejs.gstime(new Date(timeMs))
    /** 地固坐标（千米），返回前乘 1000 转为米 */
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
    /** 选中武器的经纬度，贴地作为浮层锚点 */
    const weapon = props.weapons.find((item) => item.id === props.selectedWeaponId)
    if (weapon) return Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 0)
  }
  if (props.selectedGroundTargetKey) {
    /** receive: / station: 键解析出的类型与资源 ID */
    const parsed = parseGroundTargetKey(props.selectedGroundTargetKey)
    if (parsed) {
      /** 地球地面目标列表中的对应点 */
      const target = props.groundTargets.find(
        (item) => item.kind === parsed.kind && item.id === parsed.id,
      )
      if (target) return Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude, 0)
    }
  }
  if (props.selectedNorad) {
    /** 选中卫星；锚点随当前推演时刻传播，而不是用静态经纬度 */
    const sat = props.satellites.find((item) => item.norad === props.selectedNorad)
    if (sat) {
      /** 播放头毫秒；尚未写入时用当前墙钟 */
      const timeMs = props.currentTimeMs > 0 ? props.currentTimeMs : Date.now()
      return propagateSatelliteWorldPosition(sat, timeMs)
    }
  }
  return null
}

/** 将详情 Label 同步到屏幕坐标（地球旋转/缩放后跟随目标） */
const syncDetailLabelScreenPosition = () => {
  /** 当前 Viewer；未创建、已销毁或不显示浮层时清空屏幕坐标 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !showEntityDetailLabel.value) {
    detailLabelScreen.value = null
    return
  }
  /** 选中目标的世界坐标 */
  const world = resolveSelectedDetailWorldPosition()
  if (!world) {
    detailLabelScreen.value = null
    return
  }
  /** 投影到画布像素；目标在视锥外时为 undefined */
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
  /** 需要跟随的 Viewer；浮层关闭时不再注册 postRender */
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
  /** 当前时刻的推演视觉状态：被打击接收站、过站高亮和爆炸 */
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
    /** 爆炸阶段把当前选中星标成已打击；未爆炸时不改点颜色 */
    struckSatelliteNorad:
      state.showExplosion && props.selectedNorad != null ? props.selectedNorad : null,
  }
})

/** 卫星渲染逻辑 */
const { flyToSatelliteSeries } = useBattleGlobeSatellites(
  viewerRef,
  computed(() => props.satellites),
  computed(() => props.currentTimeMs),
  computed(() => props.selectedNorad),
  computed(() => props.followSelectedSatellite),
  computed(() => deductionGlobeVisualState.value.struckSatelliteNorad),
  computed(() => props.isTimelinePlaying),
  selectedResourceDetailText,
  computed(() => props.highlightedSeries ?? null)
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

/** 推演中已被打击的接收站 ID/名称，用于把点画成红色 */
const deductionStruckReceiveKeys = computed(
  () => deductionGlobeVisualState.value.struckReceiveKeys
)
/** 当前过站窗口内需要高亮的接收站 ID/名称 */
const deductionPassHighlightReceiveKeys = computed(
  () => deductionGlobeVisualState.value.passHighlightReceiveKeys
)
/** 当前高亮过站窗口，含坐标，供地面点补位和连线使用 */
const deductionPassHighlightPasses = computed(
  () => deductionGlobeVisualState.value.passHighlightPasses
)

/** 推演时补全过站接收站坐标，保证地球上有可高亮点位 */
const globeGroundTargetsForRender = computed((): BattleGlobeGroundTarget[] => {
  /** 父组件传入的地面目标；非推演时原样渲染 */
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
  /** 当前 Viewer；未就绪时不操作相机 */
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
  /** 当前 Viewer；销毁后不再改相机 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return

  viewer.camera.cancelFlight()
  /** 进入战场时记下的相机位置与姿态；有位置时优先飞回该俯视 */
  const destination = store.battleCenterCartesian
  const orientation = store.battleCenterOrientation

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
  /** 当前 Viewer；容器尚未挂载时不改渲染循环 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !cesiumContainer.value) return
  /** 容器宽高都大于 0 才恢复默认渲染循环，避免 0 尺寸画布空转 */
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
  /** 当前 Viewer；时钟由父组件的播放头驱动，不自行动画 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return

  /** 任务起止毫秒；区间无效时保持时钟原值 */
  const startMs = props.taskStartMs || 0
  const endMs = props.taskEndMs || 0
  if (!startMs || !endMs || endMs <= startMs) return

  /** 任务开始、结束和当前播放头对应的 JulianDate */
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

/** 暴露给父组件：恢复战场俯视、飞到某一卫星系列 */
defineExpose({
  restoreOverviewView,
  flyToSatelliteSeries,
})

/** 战场名称标签锚点（用于椭球遮挡判断） */
let battleLabelAnchor: Cesium.Cartesian3 | null = null

/**
 * 根据相机位置更新战场名称标签可见性，避免地球背面仍显示。
 */
const updateBattleLabelOcclusion = () => {
  /** 当前 Viewer；没有名称锚点时不判断遮挡 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !battleLabelAnchor) return

  /** 战场名称实体；尚未创建时跳过 */
  const entity = viewer.entities.getById('battle-area-label')
  if (!entity) return

  /** 以 WGS84 椭球和相机位置判断锚点是否在可见半球 */
  const occluder = new Cesium.EllipsoidalOccluder(
    Cesium.Ellipsoid.WGS84,
    viewer.camera.positionWC
  )
  /** 锚点未被地球挡住时显示名称 */
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
  /** 当前 Viewer；已注册 postUpdate 时不重复监听 */
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

  /** 当前 Viewer；销毁后实体已随场景释放 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return
  /** 战场名称实体 */
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
  /** 当前 Viewer；没有战场名称时不创建标签 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed() || !store.battle?.name) return

  // 解析战场区域名称标签经纬度锚点
  const labelPosition = resolveBattleSpaceLabelPosition(store.battle, store.battleCenterCartesian)
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
      fillColor: Cesium.Color.fromCssColorString(readThemeColor('--color-danger-strong')),
      outlineColor: Cesium.Color.fromCssColorString(readThemeColor('--swatch-1a0000')),
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
  /** 当前 Viewer；未就绪时不绘制区域 */
  const viewer = viewerRef.value
  if (!viewer || viewer.isDestroyed()) return

  try {
    if (store.battle) {
      /** 按战场多边形贴地标绘，并飞到约 2400 万米高度 */
      markBattleArea(viewer, store.battle, 24000000, { clampToGround: true })
      renderBattleLabel()
      if (!store.battleCenterCartesian && !resolveBattleSpaceLabelPosition(store.battle)) {
        flyToDefaultEarthView()
      }
    } else {
      clearBattleLabel()
      flyToDefaultEarthView()
    }
    markTaskCombatArea(viewer, store.taskCombatArea)
  } catch (error) {
    /** 区域数据非法时回退默认视角，并保留错误以便定位 */
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
    /** 只保留地球与实体图层，关闭地理编码、时间轴等默认控件 */
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

    /** 容器尺寸变化时恢复渲染；首次获得非零尺寸时补做初始化 */
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

/** 容器挂载后创建 Viewer */
onMounted(() => {
  void initViewer()
})

/** keep-alive 再次进入时恢复渲染循环和战场标记 */
onActivated(() => {
  refreshAfterActivate()
})

/** 切换战场后重绘区域和名称 */
watch(
  () => store.battle?.id,
  () => {
    renderBattleArea()
  }
)

/** 战场多边形变化后重绘区域 */
watch(
  () => store.battle?.area,
  () => {
    renderBattleArea()
  }
)

/** 战场名称变化后只更新名称标签 */
watch(
  () => store.battle?.name,
  () => {
    renderBattleLabel()
  }
)

/** 战场中心变化后重算名称锚点 */
watch(
  () => store.battleCenterCartesian,
  () => {
    renderBattleLabel()
  }
)

/** 任务作战区域变化后重绘作战区，不重置相机 */
watch(
  () => store.taskCombatArea,
  () => {
    /** 当前 Viewer；未就绪时等下次初始化再绘制 */
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return
    markTaskCombatArea(viewer, store.taskCombatArea)
    viewer.scene.requestRender()
  },
  { deep: true }
)

/** 播放头或任务时段变化后，把 Cesium 时钟对齐到父组件时刻 */
watch(
  () => [props.currentTimeMs, props.taskStartMs, props.taskEndMs] as const,
  () => {
    syncViewerClock()
    viewerRef.value?.scene.requestRender()
  }
)

/** 选中目标、详情文案或播放头变化后，重新挂上浮层跟随 */
watch(
  () =>
    [
      viewerRef.value,
      selectedResourceDetailText.value,
      props.selectedSatelliteDetailView,
      props.selectedGroundDetailView,
      props.selectedWeaponDetailView,
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

/** 卸载时移除浮层跟随、战场名称、尺寸监听，并销毁 Viewer */
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
  max-width: min(420px, 42vw);

  &--satellite-metrics {
    max-width: min(420px, 42vw);
  }
}

.globe-entity-detail-label__inner {
  box-sizing: border-box;
  padding: 6px 8px;
  text-align: left;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  line-height: 1.45;
  color: var(--color-warning);
  background: var(--swatch-rgba-0-0-0-0_58);
  border-radius: 4px;
  cursor: default;
}

.globe-entity-detail-label__inner--plain {
  max-width: min(420px, 42vw);
  white-space: pre-line;
  word-break: break-word;
  overflow: visible;
}

.globe-entity-detail-label__inner--grid {
  width: max-content;
  max-width: min(420px, 42vw);
  padding: 8px 10px;
  white-space: normal;
  word-break: normal;
  overflow: visible;
}

.globe-sat-detail__title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  line-height: 1.3;
  color: var(--color-warning);
  margin-bottom: 2px;
}

.globe-sat-detail__meta {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  line-height: 1.35;
  color: var(--swatch-rgba-250-204-21-0_82);
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
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1.2;
  color: var(--swatch-rgba-255-255-255-0_55);
}

.globe-sat-detail__cell-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  line-height: 1.35;
  color: var(--text-color-strong);
  word-break: break-word;
  overflow-wrap: anywhere;
  max-width: 100%;
}
</style>
