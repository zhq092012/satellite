<template>
  <div ref="cesiumContainer" class="cesium-container">
    <div ref="creditEl" class="credit"></div>
    <div v-if="satelliteRenderBusy" class="render-loading">
      <div class="render-loading__panel">
        <div class="render-loading__spinner"></div>
        <div class="render-loading__text">正在加载数据...</div>
      </div>
    </div>
    <!-- 星座工具栏 -->
    <div v-if="selectedConstellation" class="constellation-toolbar">
      <span class="constellation-toolbar__badge">{{
        selectedConstellation.chineseName || selectedConstellation.name
      }}</span>
      <el-switch
        v-model="showConstellationLinks"
        active-action-icon="Connection"
        inactive-action-icon="Hide"
        active-text="星间链路"
        @change="handleConstellationLinkToggle"
      />
      <el-button size="small" text @click="clearConstellationSelection">清除星座选择</el-button>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { MatrixResult, StationWindow } from '@/api/electronic'
import { useElectronicCesiumBridge, type InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'
import { useTimelineSync } from '@/composables/useTimelineSync'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import * as Cesium from 'cesium'
import * as echarts from 'echarts'
import {
  getAllWeapons,
  getSatelliteConstellations,
  getSatelliteDetail,
  getSatelliteTLEData,
  getTLEDataByTaskId,
  type SatelliteConstellation,
} from '@/api/dashboard'
import { createWeaponIconDataUri, getWeaponIconScale } from '@/utils/tools/svgIcons'
import * as satellitejs from 'satellite.js'
import { useLayoutStore } from '@/store/modules/layout'
import { formatTimeLineAndAnimation, markBattleArea } from '@/utils/tools/functionTool'
import { bindInfoBoxButton, createInfoBoxActionButton, unbindInfoBoxButton } from '@/utils/tools/infoBox'
import { CallbackProperty } from 'cesium'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import type { SatelliteData, Weapon } from '@/types/dashboard'

// 全局布局状态管理 store
const store = useLayoutStore()
// 卫星详情弹窗 composable，用于打开卫星档案对话框
const { openSatelliteProfile } = useSatelliteProfileDialog()
// 是否显示卫星轨迹路径，默认关闭（避免大量实体导致性能下降）
const showPaths = ref(false)
// 地图瓦片服务地址（来自环境变量）
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL
// Cesium 容器 DOM 引用
const cesiumContainer = useTemplateRef('cesiumContainer')
// Cesium credit 容器 DOM 引用（避免多个 Viewer 实例抢占同一 id）
const creditEl = ref<HTMLElement | null>(null)

/**
 * 组件 Props 定义
 *
 * [字段说明]
 * - showTimeLine: 是否显示时间轴控件
 * - showAnimation: 是否显示动画控件
 * - matrixData: 算法矩阵数据（包含地面站、中继卫星、过境窗口与打压状态）
 */
const props = defineProps<{
  showTimeLine: boolean
  showAnimation: boolean
  /** 算法矩阵数据（包含地面站、中继卫星、过境窗口与打压状态） */
  matrixData?: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

// Cesium Viewer 实例（全局唯一），未初始化时为 undefined
let viewer: Cesium.Viewer
// 容器尺寸监听器，用于在容器尺寸变化时同步 Viewer 渲染
let resizeObserver: ResizeObserver | null = null
// 防止 initViewer 并发调用的互斥锁
let viewerInitializing = false
// Cesium 是否已完成首次初始化（用于外部判断是否可以操作 Viewer）
const cesiumInitialized = ref(false)
/**
 * 战场态势面板中四个 ECharts 图表实例缓存
 *
 * [说明]
 * - 使用对象集中管理，组件销毁时统一 dispose 防止内存泄漏
 * - key 含义：redSatelliteType（红方卫星类型柱状图）、blueSatelliteType（蓝方卫星类型柱状图）
 *           redWeaponType（红方武器分类饼图）、blueWeaponType（蓝方武器分类饼图）
 */
const chartInstances = {
  redSatelliteType: null as echarts.ECharts | null,
  blueSatelliteType: null as echarts.ECharts | null,
  redWeaponType: null as echarts.ECharts | null,
  blueWeaponType: null as echarts.ECharts | null,
}

/**
 * [功能]
 * 检查容器 DOM 元素是否具有有效尺寸（宽高均大于 0）
 *
 * [处理规则]
 * - 容器尺寸为 0 时 Cesium 会创建 0 宽高纹理导致 WebGL 报错，必须先检查
 *
 * @param el 容器 DOM 元素
 * @returns 是否具有有效尺寸
 */
const hasValidContainerSize = (el: HTMLElement | null) => {
  if (!el) return false
  return el.clientWidth > 0 && el.clientHeight > 0
}

/**
 * [功能]
 * 等待 Cesium 容器 DOM 具有有效尺寸（宽高大于 0）
 *
 * [处理规则]
 * - 每帧检查一次，最多等待 maxFrames 帧（默认 180 帧 ≈ 3 秒）
 * - 适用于容器可能因 Tab 切换、CSS display:none 等原因暂时无尺寸的场景
 *
 * [修改约束]
 * - 不要改为同步等待，requestAnimationFrame 保证与渲染帧同步
 *
 * @param maxFrames 最大等待帧数，默认 180
 * @returns 是否在超时前获得有效尺寸
 */
const waitForContainerReady = async (maxFrames = 180) => {
  for (let i = 0; i < maxFrames; i += 1) {
    if (hasValidContainerSize(cesiumContainer.value || null)) {
      return true
    }
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return false
}

/**
 * [功能]
 * 根据当前容器尺寸，同步 Cesium Viewer 的渲染循环开关
 *
 * [处理规则]
 * - 容器尺寸有效时开启渲染循环，并强制 resize + 请求渲染
 * - 容器尺寸为 0 时暂停渲染，避免 Cesium 创建 0×0 纹理导致 WebGL 报错
 *
 * [副作用]
 * - 修改 viewer.useDefaultRenderLoop
 * - 触发 viewer.scene.requestRender()
 */
const syncViewerRenderLoopWithContainer = () => {
  if (!viewer || viewer.isDestroyed() || !cesiumContainer.value) return
  const canRender = hasValidContainerSize(cesiumContainer.value)
  // 当容器尺寸为 0 时暂停渲染，避免 Cesium 在更新 framebuffer 时创建 0 宽高纹理。
  viewer.useDefaultRenderLoop = canRender
  if (!canRender) return
  ;(viewer as any).resize?.()
  if (!viewer.isDestroyed()) {
    viewer.scene.requestRender()
  }
}

/**
 * [功能]
 * 启动容器尺寸变化监听（ResizeObserver）
 *
 * [处理规则]
 * - 已存在监听器时直接返回，避免重复注册
 * - 容器尺寸从 0 变为有效值且 Viewer 尚未初始化（或已销毁）时，自动触发 initViewer
 * - 已初始化时同步渲染循环开关
 *
 * [修改约束]
 * - 必须与 stopContainerSizeObserver 配对调用，防止内存泄漏
 */
const startContainerSizeObserver = () => {
  if (!cesiumContainer.value || resizeObserver) return
  resizeObserver = new ResizeObserver(() => {
    if ((!viewer || viewer.isDestroyed()) && hasValidContainerSize(cesiumContainer.value)) {
      void initViewer()
      return
    }
    syncViewerRenderLoopWithContainer()
  })
  resizeObserver.observe(cesiumContainer.value)
}

/**
 * [功能]
 * 停止并销毁容器尺寸变化监听器
 *
 * [副作用]
 * - 断开 ResizeObserver 并置空引用
 */
const stopContainerSizeObserver = () => {
  if (!resizeObserver) return
  resizeObserver.disconnect()
  resizeObserver = null
}

const initViewer = async () => {
  if ((viewer && !viewer.isDestroyed()) || viewerInitializing) return
  viewerInitializing = true
  try {
    if (cesiumContainer.value) {
      const ready = await waitForContainerReady()
      if (!ready) {
        console.warn('Cesium container size is still 0 after waiting, skip viewer initialization for now.')
        return
      }

      // 创建 Cesium Viewer 实例并禁用不需要的默认控件
      viewer = new Cesium.Viewer(cesiumContainer.value, {
        scene3DOnly: false, // 启用 3D/2D 切换（这里允许 3D 模式）
        geocoder: false, // 关闭位置搜索控件
        homeButton: false, // 关闭回到默认视角按钮
        sceneModePicker: false, // 关闭视图模式切换器
        navigationHelpButton: false, // 关闭帮助按钮
        animation: props.showAnimation, // 关闭默认动画控件
        timeline: props.showTimeLine, // 关闭默认时间轴控件（我们使用自定义时间轴）
        creditContainer: creditEl.value || undefined, // 使用组件内的 credit 容器，避免多个实例使用相同 id
        fullscreenButton: false, // 关闭全屏按钮
        baseLayerPicker: false, // 关闭底图选择器
        baseLayer: false, // 不使用默认底图
        infoBox: false, // 打开消息框（点击实体时显示信息）
        selectionIndicator: false, // 关闭选中指示器（我们自定义点击事件）
      })
      // 关闭默认双击追踪（保持相机不动）
      viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
      // 添加切片影像图层（自定义瓦片服务器）
      viewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `${MATERIAL_URL}/{z}/{x}/{y}.png`, // 瓦片 URL 模板
          credit: 'credit', // 版权信息
        })
      )

      // [业务目的] 限制相机高度与俯仰角，防止将地球拖到屏幕下方
      // [实现原因] 用户向上拖拽鼠标时相机仰角过大，会导致地球球体被推到屏幕下方外框
      // [关键规则] 限制相机高度范围，并在 preRender 监听中动态约束俯仰角 (-90° ~ -20°) 及中心点 Y 坐标
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 100000
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 25000000

      // 禁止相机跑到地面以下
      viewer.scene.globe.depthTestAgainstTerrain = false

      // [动态几何约束] 绑定 preRender 监听，限制地球不能被拖移至屏幕下方边缘之外
      // 原因: 静态限制俯仰角(-20°)在高视角高度(如 20000km)下仍会导致视角偏离地心，将地球推到屏幕下方之外。
      // 解决: 根据相机高度计算地球视角半角 theta，高高度下自动将 Pitch 上限收紧至接近 -90°(直视地心)，确保地球始终居中在视野内。
      viewer.scene.preRender.addEventListener(() => {
        if (!viewer || viewer.isDestroyed()) return

        // [异常处理] 防止 preRender 的约束逻辑与 flyTo 动画或 trackedEntity 视角跟随发生冲突导致“来回摆动”
        if (currentTrackedNorad !== null || viewer.trackedEntity) return
        if ((viewer.scene as any).tweens && (viewer.scene as any).tweens.length > 0) return

        const cam = viewer.camera
        const carto = cam.positionCartographic
        if (!carto) return

        // [地心与视角几何计算] 地球平均半径约 6,371,000 米
        const EARTH_RADIUS = 6371000
        const distance = EARTH_RADIUS + Math.max(0, carto.height)
        // 计算当前高度下地球视盘的半角 (0 ~ PI/2)
        const sinTheta = Math.min(1.0, EARTH_RADIUS / distance)
        const theta = Math.asin(sinTheta)

        // [动态俯仰角限制]
        // -90° (-PI/2) 对应相机直视地心。
        // 高高度(如 25,000km)下 theta 仅约 14°，地心为 -90°。
        // 允许倾斜范围控制在 theta 的 0.65 动态比例以内，高高度时自动收紧至接近 -90°，低空允许 -20° 看地平线
        const dynamicMaxPitch = Math.min(Cesium.Math.toRadians(-20), -Math.PI / 2 + theta * 0.65)
        const minPitch = Cesium.Math.toRadians(-89)

        let targetPitch = cam.pitch
        let needUpdate = false

        // 1. 检查相机俯仰角是否超出当前高度下的允许范围
        if (cam.pitch > dynamicMaxPitch) {
          targetPitch = dynamicMaxPitch
          needUpdate = true
        } else if (cam.pitch < minPitch) {
          targetPitch = minPitch
          needUpdate = true
        }

        // 2. 检查地心 (0,0,0) 的二维屏幕坐标，防止拖拽导致地球超出屏幕中心下侧
        const centerPos = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, Cesium.Cartesian3.ZERO)
        const canvasHeight = viewer.canvas.clientHeight

        // 如果地心坐标无效(已被推到相机后方)或地心 Y 坐标被拖到屏幕下侧 60% 以下
        if (!centerPos || centerPos.y > canvasHeight * 0.6) {
          targetPitch = Math.min(targetPitch, dynamicMaxPitch - Cesium.Math.toRadians(5))
          needUpdate = true
        }

        if (needUpdate) {
          cam.setView({
            destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height),
            orientation: {
              heading: cam.heading,
              pitch: targetPitch,
              roll: 0,
            },
          })
        }
      })

      // 只在有变化时渲染，提高切换路由/隐藏时性能
      viewer.scene.requestRenderMode = true
      // 设置每帧最大渲染时间，避免单帧过长导致界面卡顿（根据实际情况调整，单位：秒）
      viewer.scene.maximumRenderTimeChange = 0.1

      // 设置时间系统
      if (props.showTimeLine) {
        if (store.activedTask) {
          const beginTime = new Date(store.activedTask.beginDate)
          const endTime = new Date(store.activedTask.endDate)

          const isoUTCStartTime = beginTime.toISOString() // 已经减 8 h 转成 UTC 字符串
          const startTime = Cesium.JulianDate.fromIso8601(isoUTCStartTime)
          const isoUTCStopTime = endTime.toISOString() // 已经减 8 h 转成 UTC 字符串
          const stopTime = Cesium.JulianDate.fromIso8601(isoUTCStopTime)

          // 设置时间轴的显示范围
          viewer.timeline.zoomTo(startTime, stopTime)
          viewer.clock.startTime = startTime.clone()
          viewer.clock.stopTime = stopTime.clone()
          viewer.clock.currentTime = startTime.clone()

          viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
          viewer.clock.multiplier = playbackSpeed.value
          //  确保动画默认启用
          viewer.clock.shouldAnimate = true
          //  动画控件格式
          formatTimeLineAndAnimation(viewer)
        }
      }

      // 绑定时钟 Tick 监听更新动态过境与中继连线
      if (!clockTickRemoveListener) {
        clockTickRemoveListener = viewer.clock.onTick.addEventListener(() => {
          updateElectronicDynamicLinks()
        })
      }

      // 绑定相机移动监听，实现高处视角聚合与低处视角具体 Label 的动态无缝切换
      let lastIsCloseView: boolean | null = null
      if (!cameraMoveEndListener) {
        viewer.camera.percentageChanged = 0.05
        cameraMoveEndListener = viewer.camera.changed.addEventListener(() => {
          if (selectedConstellation.value) {
            const currentCloseView = isConstellationCloseView()
            // 只有当高度临界状态改变（低处 ↔ 高处）时，才触发视觉显隐更新，且跳过 Polyline 图层重绘，避免拖动地球时线路闪烁
            if (lastIsCloseView === null || lastIsCloseView !== currentCloseView) {
              lastIsCloseView = currentCloseView
              applyConstellationVisualState(true)
            }
          }
        })
      }

      // 绑定自定义的相机监听（用于显示相机位置/角度等）
      // listenCameraLocaion(viewer)
      // 监控鼠标点击事件
      handleViewerClickEvent()
      // 绑定信息框按钮事件（使用事件委托方式，避免每个实体都绑定一次）
      bindInfoBoxButton(viewer, {
        handler: ({ button }) => {
          const norad = Number(button.dataset.norad)
          if (!Number.isFinite(norad)) return
          showDetail(norad)
        },
      })
      // 开始监听容器尺寸变化
      startContainerSizeObserver()
      // 同步渲染循环
      syncViewerRenderLoopWithContainer()
    }
  } finally {
    viewerInitializing = false
  }
}

/**
 * [功能]
 * 清空 Viewer 中所有实体、集合和状态，通常在任务切换时调用
 *
 * [副作用]
 * - 移除时钟 Tick 监听器
 * - 清理电子信息网络实体
 * - 清空所有 Cesium 实体和原语集合
 * - 重置内存中的映射表（不释放 viewer）
 * - 关闭卫星面板
 */
const clearViewer = () => {
  if (!viewer || viewer.isDestroyed()) return

  // 1. 暂停渲染循环，防止 _onTick 在清理过程中并发更新
  const prevRenderLoop = viewer.useDefaultRenderLoop
  const prevAnimate = viewer.clock.shouldAnimate
  viewer.useDefaultRenderLoop = false
  viewer.clock.shouldAnimate = false

  if (clockTickRemoveListener) {
    clockTickRemoveListener()
    clockTickRemoveListener = null
  }
  clearElectronicNetworkEntities()
  viewer.entities.removeAll()

  // 2. 只移除我们手动添加的 Primitive 集合（pointCollection、labelCollection），
  //    不要使用 viewer.scene.primitives.removeAll()！
  //    removeAll() 会同时销毁 Cesium DataSourceDisplay 内部维护的 PrimitiveCollection，
  //    导致后续 _onTick → GeometryVisualizer.update 访问已销毁的对象而抛出
  //    "This object was destroyed" 异常。
  if (pointCollection && !pointCollection.isDestroyed()) {
    viewer.scene.primitives.remove(pointCollection)
  }
  pointCollection = null
  if (labelCollection && !labelCollection.isDestroyed()) {
    viewer.scene.primitives.remove(labelCollection)
  }
  labelCollection = null

  satellitePointPrimitives.clear()
  satelliteLabelPrimitives.clear()
  satellitePrimitiveEntities.clear()
  renderedPrimitiveSatelliteMap.clear()
  clearConstellationOverlayEntities()
  selectedConstellation.value = null
  store.closeSatPanel()

  // 3. 恢复渲染循环和时钟动画（仅当 viewer 未被销毁时）
  if (!viewer.isDestroyed()) {
    viewer.useDefaultRenderLoop = prevRenderLoop
    viewer.clock.shouldAnimate = prevAnimate
  }
}

// 以 NORAD 编号为 key，存储当前渲染的所有卫星实体
let satelliteEntities = new Map<number, Cesium.Entity>()

/**
 * 每颗卫星的多周期轨道采样数据
 *
 * [数据来源]
 * 基于 TLE 两行数据，通过 satellite.js 计算得到的采样轨道
 *
 * [取值规则]
 * - key 为 NORAD 编号
 * - samples: 采样点数组，每个元素包含时间、位置、所属周期索引
 * - singleOrbitPeriod: 单圈周期（秒）
 * - totalPeriods: 总周期数
 * - startTime: 轨道计算开始时刻
 */
const satelliteOrbitData = new Map<
  number,
  {
    samples: Array<{ time: Cesium.JulianDate; position: Cesium.Cartesian3; period: number }>
    singleOrbitPeriod: number
    totalPeriods: number
    startTime: Cesium.JulianDate
  }
>()

/**
 * 每颗卫星的 SampledPositionProperty 缓存
 *
 * [说明]
 * 避免切换筛选条件时反复重建，显著减少内存分配和计算开销
 */
const satellitePositionPropertyCache = new Map<number, Cesium.SampledPositionProperty>()

/**
 * 每颗卫星的 TLE 数据缓存
 *
 * [说明]
 * - key 为 NORAD 编号
 * - 避免对同一卡号的卫星重复请求接口
 * - 任务切换时会主动清除，防止旧数据污染
 */
const satelliteTleCache = new Map<number, any>()

/**
 * 当前任务的卫星列表缓存
 *
 * [取值规则]
 * - 首次请求成功后填充，同一任务内不重复请求接口
 * - 任务切换时清空（cachedTaskId 不匹配时）
 */
let cachedSatelliteList: SatelliteData[] | null = null
// 当前缓存对应的任务 ID
let cachedTaskId: number | null = null

// 当前渲染任务的 taskId，用于切换任务时检测是否需要清理缓存
let currentRenderTaskId: number | null = null

// 存储电子信息网络基础设施实体 ID (地面站、中心云站)
const electronicNodeEntityIds = new Set<string>()
// 存储电子信息网络动态连线实体 ID (星地过境、星中中继、地地网)
const electronicDynamicLinkEntityIds = new Set<string>()

// 电子信息战录 composable：解析地面站、中继卡号集和过境窗口判断工具
const { infrastructureNodes, isTimeInWindow } = useElectronicCesiumBridge(toRef(props, 'matrixData'))
// 时间轴同步：将 Cesium 时钟时间同步到全局仿真时间状态
const { updateSimulationTime } = useTimelineSync()
// Cesium 时钟 onTick 监听器的移除函数（组件销毁时必须调用）
let clockTickRemoveListener: Cesium.Event.RemoveCallback | null = null

/**
 * [功能]
 * 清理电子信息网络相关的 3D 实体与连线
 */
const clearElectronicNetworkEntities = () => {
  if (!viewer) return
  electronicNodeEntityIds.forEach((id) => {
    const entity = viewer.entities.getById(id)
    if (entity) viewer.entities.remove(entity)
  })
  electronicNodeEntityIds.clear()

  electronicDynamicLinkEntityIds.forEach((id) => {
    const entity = viewer.entities.getById(id)
    if (entity) viewer.entities.remove(entity)
  })
  electronicDynamicLinkEntityIds.clear()
}

/**
 * [功能]
 * 平滑飞赴敌方信息网络集群区域
 */
const flyToEnemyNetwork = () => {
  if (!viewer || !infrastructureNodes.value.length) return

  let sumLon = 0
  let sumLat = 0
  infrastructureNodes.value.forEach((n) => {
    sumLon += n.longitude
    sumLat += n.latitude
  })
  const avgLon = sumLon / infrastructureNodes.value.length
  const avgLat = sumLat / infrastructureNodes.value.length

  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(avgLon, avgLat, 5000000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-60),
      roll: 0,
    },
    duration: 2.0,
  })
}

/**
 * [功能]
 * 视角平滑直达敌方地面基础设施节点 (地面接收站 / 中心云数据中心) 上空
 *
 * @param node 选中的 InfrastructureLocation 对象
 */
let currentTrackedNorad: number | null = null

/**
 * [功能]
 * 视角平滑直达敌方地面基础设施节点 (地面接收站 / 中心云数据中心) 上空
 *
 * @param node 选中的 InfrastructureLocation 对象
 */
const flyToInfrastructureNode = (node: InfrastructureLocation) => {
  if (!viewer || !node) return
  currentTrackedNorad = null
  viewer.trackedEntity = undefined

  // 如果节点缺少有效的经纬度，在 infrastructureNodes 数据源中匹配
  let targetLon = node.longitude
  let targetLat = node.latitude
  if (!targetLon && !targetLat) {
    const matched = infrastructureNodes.value.find((n) => n.id === node.id && n.type === node.type)
    if (matched) {
      targetLon = matched.longitude
      targetLat = matched.latitude
    }
  }

  // 1. 基于地面站经纬度生成包围球 Target 中心
  const stationPos = Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 0)
  const boundingSphere = new Cesium.BoundingSphere(stationPos, 0)

  // 2. 距离地面站中心 300,000 米，俯视角 -45°，100% 居中瞄准地面站
  const offset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0), Cesium.Math.toRadians(-45), 300000)

  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: 1.5,
    offset,
  })
}

/**
 * [功能]
 * 视角平滑锁定与远距离 (全地球视角) 定位跟随指定的卫星
 *
 * [处理规则]
 * - 避免对同一目标反复重置相机（若 currentTrackedNorad 已是目标且没有设置 force 标志，则直接跳过，防止 watch(store.selectedSatellite) 触发竞态二次飞行）
 * - 使用 HeadingPitchRange 将视角锁定在能看到整个地球的视角 (俯角 -90°，距离 22,000,000 米)，并持续跟随卫星
 * - 若 Entity 暂不存在，则动态创建并挂载 CallbackProperty 位置，确保 viewer.trackedEntity 总是有效，跟随的卫星始终在屏幕区域内
 *
 * @param norad 目标卫星 NORAD 编号
 * @param force 是否强制重置视角并重新飞行
 */
const trackSatelliteByNorad = (norad: number, force = false) => {
  if (!viewer || !norad) return

  // 避免对同一目标反复重置相机或被 watch(store.selectedSatellite) 触发二次飞行的竞态与切回抖动
  if (!force && currentTrackedNorad === norad) return

  currentTrackedNorad = norad

  let entity = viewer.entities.getById(`satellite-${norad}`) || viewer.entities.getById(`sat-node-${norad}`)
  const pos = getSatellitePositionInCesium(norad)

  // 全视角地球 offset：离卫星 22,000,000 米 (22,000km)，俯视角 -90° (直视地心/俯视全球)
  // 确保能查看到完整的地球球体，且被跟随的卫星保持在屏幕中央视野内
  const offset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0), Cesium.Math.toRadians(-90), 22000000)

  // 若实体暂不存在，但可计算得到位置，动态创建一个带 position 属性的实体以便锁定跟随
  if (!entity && pos) {
    entity = viewer.entities.add({
      id: `satellite-${norad}`,
      position: new Cesium.CallbackProperty(
        () => getSatellitePositionInCesium(norad) || pos,
        false
      ) as unknown as Cesium.PositionProperty,
    })
  }

  if (entity) {
    entity.viewFrom = undefined
    viewer
      .flyTo(entity, {
        duration: 1.2,
        offset,
      })
      .then((completed) => {
        if (completed && currentTrackedNorad === norad) {
          viewer.trackedEntity = entity
        }
      })
    return
  }

  if (pos) {
    const boundingSphere = new Cesium.BoundingSphere(pos, 0)
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 1.2,
      offset,
    })
  }
}

// 监听 store 中选中的地面基础设施节点，如果外部选择变更则定位相机
watch(
  () => store.selectedInfrastructureNode,
  (newNode) => {
    if (newNode) {
      flyToInfrastructureNode(newNode)
    }
  }
)

// 监听 store 中选中的卫星，如果外部选择变更且存在选中的卫星，则锁定相机视角跟随
watch(
  () => store.selectedSatellite,
  (newSat) => {
    if (newSat && newSat.norad) {
      trackSatelliteByNorad(Number(newSat.norad))
    } else if (!newSat) {
      currentTrackedNorad = null
    }
  }
)

/**
 * [功能]
 * 渲染敌方地面接收站与数据中心 3D 实体与地面圆环
 */
const renderElectronicInfrastructureNodes = () => {
  if (!viewer || !infrastructureNodes.value.length) return

  infrastructureNodes.value.forEach((node) => {
    const entityId = `infra-node-${node.type}-${node.id}`
    if (viewer.entities.getById(entityId)) return

    const position = Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, node.altitude)
    const isReceive = node.type === 'RECEIVE'

    const nodeColor = isReceive ? Cesium.Color.CYAN : Cesium.Color.DODGERBLUE

    const labelText = `[敌方${isReceive ? '地面接收站' : '数据中心'}]\n${node.name}`

    // 1. 地表高亮波纹圆环
    viewer.entities.add({
      id: `${entityId}-ring`,
      position,
      ellipse: {
        semiMinorAxis: isReceive ? 80000 : 120000,
        semiMajorAxis: isReceive ? 80000 : 120000,
        material: nodeColor.withAlpha(0.25),
        outline: true,
        outlineColor: nodeColor,
        height: 0,
      },
    })
    electronicNodeEntityIds.add(`${entityId}-ring`)

    // 2. 节点主体 3D 标示与标签
    viewer.entities.add({
      id: entityId,
      position,
      point: {
        pixelSize: isReceive ? 12 : 14,
        color: nodeColor,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.NONE,
      },
      label: {
        text: labelText,
        font: 'bold 13px sans-serif',
        fillColor: nodeColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
        pixelOffset: new Cesium.Cartesian2(0, -28),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20_000_000),
      },
    })
    electronicNodeEntityIds.add(entityId)

    // 3. 渲染 3D 地面站雷达包络视椎 (Radar Envelope Frustum Cone)
    if (isReceive) {
      const coneLength = 500000 // 500km 高度
      const coneCenterPos = Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, coneLength / 2)
      viewer.entities.add({
        id: `${entityId}-frustum`,
        position: coneCenterPos,
        cylinder: {
          length: coneLength,
          topRadius: 320000, // 320km 顶部辐射半径
          bottomRadius: 2000,
          material: new Cesium.Color(0, 0.88, 1, 0.12),
          outline: true,
          outlineColor: new Cesium.Color(0, 0.88, 1, 0.35),
          outlineWidth: 1.0,
        },
      })
      electronicNodeEntityIds.add(`${entityId}-frustum`)
    }
  })

  // 4. 渲染敌方天基过境与中继卫星集群 3D 实体
  const matrixSats = props.matrixData?.initMatrixList || []
  matrixSats.forEach((sat) => {
    const satEntityId = `sat-node-${sat.norad}`
    if (viewer.entities.getById(satEntityId)) return

    const initialPos = getSatellitePositionInCesium(sat.norad)
    if (!initialPos) return

    const isRelay = sat.norad === 22314 || (sat.satType || '').includes('中继')
    const satColor = isRelay ? Cesium.Color.PURPLE : Cesium.Color.CYAN

    viewer.entities.add({
      id: satEntityId,
      position: new Cesium.CallbackProperty(
        () => getSatellitePositionInCesium(sat.norad) || initialPos,
        false
      ) as unknown as Cesium.PositionProperty,
      point: {
        pixelSize: isRelay ? 16 : 13,
        color: satColor,
        outlineColor: isRelay ? Cesium.Color.GOLD : Cesium.Color.WHITE,
        outlineWidth: 2.5,
      },
      label: {
        text: `[敌方${isRelay ? '数据中继卫星' : '过境卫星'}]\n${sat.name}`,
        font: 'bold 12px sans-serif',
        fillColor: satColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.7),
        pixelOffset: new Cesium.Cartesian2(0, -28),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 30_000_000),
      },
    })
    electronicNodeEntityIds.add(satEntityId)
  })

  // 渲染完敌方节点后自动平滑飞赴
  flyToEnemyNetwork()
}

/**
 * [功能]
 * 视角快速定位
 */
const flyToView = (target: 'GLOBAL' | 'SPACE' | 'GROUND') => {
  if (!viewer) return
  if (target === 'GLOBAL') {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100, 30, 20000000),
      duration: 1.8,
    })
  } else if (target === 'SPACE') {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(100, 20, 10000000),
      duration: 1.8,
    })
  } else if (target === 'GROUND') {
    flyToEnemyNetwork()
  }
}

/**
 * [功能]
 * 控制 3D 雷达探测包络视椎显隐
 */
const toggleRadarFrustums = (show: boolean) => {
  if (!viewer) return
  electronicNodeEntityIds.forEach((id) => {
    if (id.endsWith('-frustum')) {
      const entity = viewer.entities.getById(id)
      if (entity) entity.show = show
    }
  })
}

const showRedSatellites = ref(false)

// [变量用途]
// 保存通过 getAllWeapons 查询得到的全量我方武器数据。
const redWeaponDataList = ref<Weapon[]>([])

// [变量用途]
// 保存创建在 Cesium Viewer 中的我方武器实体引用列表。
const redWeaponEntities = shallowRef<Cesium.Entity[]>([])

/**
 * [功能]
 * 查询我方所有武器资源列表并将其绘制到 Cesium 地球球面上
 *
 * [数据来源]
 * 调用 getAllWeapons API 接口获取全量武器数据模型
 *
 * [处理规则]
 * - 使用 createWeaponIconDataUri 根据武器类型 (如：导弹/干扰/定向能/天基/火炮) 动态生成特定 SVG 图标
 * - 在实体上绑定 Point, Billboard, Label 与 Ellipse (武器作用半径/防线)
 * - 初始显隐受 showRedSatellites.value 状态控制
 */
const loadAndRenderRedWeapons = async () => {
  if (!viewer) return
  try {
    const res = await getAllWeapons()
    if (res.code === 200 && res.data?.weapons) {
      redWeaponDataList.value = res.data.weapons
      renderRedWeaponsOnCesium()
    }
  } catch (err) {
    console.error('获取我方武器列表失败:', err)
  }
}

/**
 * [功能]
 * 在 Cesium Viewer 中构造并绘制我方武器 3D 节点与作用防线
 */
const renderRedWeaponsOnCesium = () => {
  if (!viewer) return

  // 清理旧的武器实体
  redWeaponEntities.value.forEach((entity) => {
    viewer?.entities.remove(entity)
  })
  redWeaponEntities.value = []

  const weapons = redWeaponDataList.value
  const newEntities: Cesium.Entity[] = []

  weapons.forEach((weapon, index) => {
    if (!Number.isFinite(weapon.longitude) || !Number.isFinite(weapon.latitude)) return

    const weaponId = `our-weapon-${weapon.id ?? index}`
    const position = Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 500)
    const iconScale = getWeaponIconScale(weapon.type)
    const weaponColor = Cesium.Color.fromCssColorString('#ef6b73')
    const iconUri = createWeaponIconDataUri(weapon.type, weaponColor, iconScale)
    const rangeMeters = Math.max(10000, Number(weapon.range ?? 0) * 1000)

    const entity = viewer.entities.add({
      id: weaponId,
      name: weapon.name,
      position: new Cesium.ConstantPositionProperty(position),
      show: showRedSatellites.value,
      billboard: {
        image: iconUri,
        scale: iconScale,
        width: 30 * iconScale,
        height: 30 * iconScale,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        heightReference: Cesium.HeightReference.NONE,
      },
      label: {
        text: `${weapon.name} (${weapon.type || '武器'})`,
        font: '12px sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#ff9e9e'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 22),
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.45),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 10000000),
      },
      ellipse: {
        semiMajorAxis: rangeMeters,
        semiMinorAxis: rangeMeters,
        material: Cesium.Color.fromCssColorString('#ef6b73').withAlpha(0.1),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#ef6b73').withAlpha(0.5),
        height: 0,
      },
      description: `<div style="padding: 12px; font-family: sans-serif; background-color: #1a2233; color: #e6f7ff; border-radius: 8px; border: 1px solid #ef6b73;">
        <h3 style="margin: 0 0 10px 0; color: #ef6b73; font-size: 16px;">🛩️ 我方武器资产</h3>
        <p style="margin: 4px 0;"><strong>武器名称:</strong> ${weapon.name}</p>
        <p style="margin: 4px 0;"><strong>所属国家/地区:</strong> ${weapon.country}</p>
        <p style="margin: 4px 0;"><strong>武器类型:</strong> ${weapon.type}</p>
        <p style="margin: 4px 0;"><strong>部署位置:</strong> 经度 ${weapon.longitude.toFixed(2)}°, 纬度 ${weapon.latitude.toFixed(2)}°</p>
        <p style="margin: 4px 0;"><strong>打击高度/射程:</strong> ${weapon.range} km</p>
        ${weapon.satellite_type ? `<p style="margin: 4px 0;"><strong>适用目标:</strong> ${weapon.satellite_type}</p>` : ''}
      </div>`,
    })

    newEntities.push(entity)
  })

  redWeaponEntities.value = newEntities
}

/**
 * [功能]
 * 控制我方武器与卡座显隐 (切换复选框时触发)
 */
const toggleRedSatellites = (show: boolean) => {
  showRedSatellites.value = show

  // 显隐我方武器实体
  redWeaponEntities.value.forEach((entity) => {
    entity.show = show
  })

  // 如果武器列表尚未拉取，且主动勾选显示，则补充加载一次
  if (show && redWeaponDataList.value.length === 0) {
    void loadAndRenderRedWeapons()
  }

  if (!pointCollection) return
  const matrixSats = props.matrixData?.initMatrixList || props.matrixData?.satelliteMatrixList || []
  const enemyNoradSet = new Set(matrixSats.map((s) => s.norad))

  for (let i = 0; i < pointCollection.length; i++) {
    const point = pointCollection.get(i)
    if (point) {
      const norad = (point as any).noradId
      if (!showRedSatellites.value && norad && !enemyNoradSet.has(Number(norad))) {
        point.show = false
      } else {
        point.show = true
      }
    }
  }
}

const satelliteCoordMap = new Map<number, [number, number, number]>([
  [60419, [-8.15, 53.3, 500000]],
  [48643, [-158.09, 21.33, 550000]],
  [59444, [-123.11, 45.21, 500000]],
  [58136, [15.65, 78.22, 550000]],
  [57693, [-121.42, 37.73, 500000]],
  [22314, [-45.1, 12.4, 35786000]],
])

const getSatellitePositionInCesium = (norad: number): Cesium.Cartesian3 | null => {
  const primitive = satellitePointPrimitives.get(norad)
  if (primitive && primitive.position) {
    return primitive.position
  }
  // 核心防止无限递归逻辑：切勿检索 sat-node-${norad} 实体本身，
  // 因为该实体的 position 使用了基于 getSatellitePositionInCesium 的 CallbackProperty，
  // 若再次读取其 position.getValue() 会触发死循环调用 (Maximum call stack size exceeded)。
  const entity = viewer?.entities?.getById(`satellite-${norad}`)
  if (entity && entity.position) {
    const pos = entity.position.getValue(viewer.clock.currentTime)
    if (pos) return pos
  }

  // 尝试从 TLE 两行数据中推算当前时刻 3D 位置
  const matrixSats = props.matrixData?.initMatrixList || []
  const initSat = matrixSats.find((s) => s.norad === norad)
  let line1 = initSat?.line1
  let line2 = initSat?.line2
  if (!line1 || !line2) {
    const tleCache = satelliteTleCache.get(norad)
    if (tleCache?.line1 && tleCache?.line2) {
      line1 = tleCache.line1
      line2 = tleCache.line2
    }
  }

  if (line1 && line2 && viewer) {
    try {
      const satrec = satellitejs.twoline2satrec(line1, line2)
      if (satrec) {
        const now = viewer.clock.currentTime
        const date = Cesium.JulianDate.toDate(now)
        const posVel = satellitejs.propagate(satrec, date)
        if (posVel && posVel.position) {
          const gmst = satellitejs.gstime(date)
          let posEcf = satellitejs.eciToEcf(posVel.position, gmst)
          if (store.effectModel) {
            posEcf = posVel.position
          }
          if (posEcf) {
            return new Cesium.Cartesian3(posEcf.x * 1000, posEcf.y * 1000, posEcf.z * 1000)
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const fallbackCoords = satelliteCoordMap.get(norad)
  if (fallbackCoords) {
    return Cesium.Cartesian3.fromDegrees(fallbackCoords[0], fallbackCoords[1], fallbackCoords[2])
  }
  return null
}

/**
 * [功能]
 * 根据当前 Cesium 时钟时间更新敌方星地过境连线、星中中继连线与地地光纤网
 */
const updateElectronicDynamicLinks = () => {
  if (!viewer || viewer.isDestroyed() || !props.matrixData) return

  const currentTime = Cesium.JulianDate.toDate(viewer.clock.currentTime)
  updateSimulationTime(currentTime)

  const activeLinkKeys = new Set<string>()

  // 1. 遍历敌方卫星矩阵解析星地过境窗口连线
  const satelliteMatrixList = props.matrixData.satelliteMatrixList || []
  satelliteMatrixList.forEach((satItem) => {
    const norad = satItem.norad
    const satPos = getSatellitePositionInCesium(norad)
    if (!satPos) return

    const stationWindows = satItem.stationWindows || []
    stationWindows.forEach((win: StationWindow) => {
      const active = isTimeInWindow(currentTime, win.peakWindow, win.endWindow)
      if (!active) return

      const infraNode = infrastructureNodes.value.find((n) => n.id === win.receiveId)
      if (!infraNode) return
      const recPos = Cesium.Cartesian3.fromDegrees(infraNode.longitude, infraNode.latitude, infraNode.altitude)

      const linkKey = `link-transit-${norad}-${win.receiveId}`
      activeLinkKeys.add(linkKey)

      const isStruck = win.strikeStatus === 1

      const existingEntity = viewer.entities.getById(linkKey)
      if (!existingEntity) {
        viewer.entities.add({
          id: linkKey,
          polyline: {
            positions: [satPos, recPos],
            width: isStruck ? 3.0 : 2.5,
            material: isStruck
              ? new Cesium.PolylineDashMaterialProperty({
                  color: Cesium.Color.YELLOW,
                  dashLength: 16.0,
                })
              : new Cesium.PolylineGlowMaterialProperty({
                  glowPower: 0.25,
                  taperPower: 0.6,
                  color: Cesium.Color.CYAN,
                }),
          },
        })
        electronicDynamicLinkEntityIds.add(linkKey)
      }
    })
  })

  // 2. 解析敌方星中中继链路 (Relay Satellites)
  const relayRelation = props.matrixData.relayRelation
  if (relayRelation && relayRelation.relations) {
    relayRelation.relations.forEach((rel) => {
      const fromNorad = Number(rel.from)
      const toNorad = Number(rel.to)
      const fromPos = getSatellitePositionInCesium(fromNorad)
      const toPos = getSatellitePositionInCesium(toNorad)

      if (fromPos && toPos) {
        const linkKey = `link-relay-${fromNorad}-${toNorad}`
        activeLinkKeys.add(linkKey)

        if (!viewer.entities.getById(linkKey)) {
          viewer.entities.add({
            id: linkKey,
            polyline: {
              positions: [fromPos, toPos],
              width: 2.2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: Cesium.Color.GOLD,
              }),
            },
          })
          electronicDynamicLinkEntityIds.add(linkKey)
        }
      }
    })
  }

  // 3. 解析地面站 -> 中心云站地地传输网 (Station Relations)
  const stationRelationList = props.matrixData.stationRelationList
  if (stationRelationList && stationRelationList.relations) {
    stationRelationList.relations.forEach((rel) => {
      const fromNode = infrastructureNodes.value.find((n) => n.id === rel.from)
      const toNode = infrastructureNodes.value.find((n) => n.id === rel.to)

      if (fromNode && toNode) {
        const linkKey = `link-ground-${rel.from}-${rel.to}`
        activeLinkKeys.add(linkKey)

        if (!viewer.entities.getById(linkKey)) {
          const fromPos = Cesium.Cartesian3.fromDegrees(fromNode.longitude, fromNode.latitude, fromNode.altitude)
          const toPos = Cesium.Cartesian3.fromDegrees(toNode.longitude, toNode.latitude, toNode.altitude)

          viewer.entities.add({
            id: linkKey,
            polyline: {
              positions: [fromPos, toPos],
              width: 2.0,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.15,
                color: Cesium.Color.MAGENTA,
              }),
            },
          })
          electronicDynamicLinkEntityIds.add(linkKey)
        }
      }
    })
  }

  // 清理非激活动态连线
  electronicDynamicLinkEntityIds.forEach((linkId) => {
    if (!activeLinkKeys.has(linkId)) {
      const entity = viewer.entities.getById(linkId)
      if (entity) viewer.entities.remove(entity)
      electronicDynamicLinkEntityIds.delete(linkId)
    }
  })
}

/**
 * [功能]
 * 监听矩阵数据变化，触发 3D 电子信息网络与连线更新
 */
watch(
  () => props.matrixData,
  (newData) => {
    if (!viewer) return
    clearElectronicNetworkEntities()
    if (newData) {
      renderElectronicInfrastructureNodes()
      updateElectronicDynamicLinks()
    }
  },
  { deep: true }
)

/**
 * 占点和标签原语集合（Primitive Collection）
 *
 * [说明]
 * - 大量卫星展示时使用 Primitive 替代 Entity，性能显著优于每颗单独创建 Entity
 * - pointCollection: 占点集合，复用旧实例避免重建
 * - labelCollection: 标签集合，远距离隱藏防止 2w+ 标签性能问题
 */
let pointCollection: Cesium.PointPrimitiveCollection | null = null
let labelCollection: Cesium.LabelCollection | null = null
// 以 NORAD 编号为 key，存储每颗卫星对应的 PointPrimitive
const satellitePointPrimitives = new Map<number, Cesium.PointPrimitive>()
// 以 NORAD 编号为 key，存储每颗卫星对应的 Label
const satelliteLabelPrimitives = new Map<number, Cesium.Label>()
// 以 NORAD 编号为 key，存储 Primitive 模式下附加的辅助 Entity
const satellitePrimitiveEntities = new Map<number, Cesium.Entity>()

// 卫星渲染导忙状态，为 true 时显示 Loading 蒙层
const satelliteRenderBusy = ref(false)
// 渲染任务版本号，每次启动新渲染时自增，旧任务检测到 token 不匹配时主动中止
let satelliteRenderToken = 0
// 时间轴回放速度（倍速），默认 20 倍
const playbackSpeed = ref(20.0)
// 当前选中的卡座（为 null 表示未选中）
const selectedConstellation = ref<SatelliteConstellation | null>(null)
// 是否显示卡座内部星间连线
const showConstellationLinks = ref(true)

const CONSTELLATION_CLOSE_VIEW_HEIGHT = 10_000_000
const CONSTELLATION_COLOR_PALETTE = ['#4ea6ff', '#58c9d1', '#7cd992', '#f0b35b', '#ef6b73', '#b15cff', '#8cc6ff']

const constellationNoradMap = new Map<number, SatelliteConstellation>()
const constellationColorMap = new Map<string, Cesium.Color>()
const constellationOverlayEntityIds = new Set<string>()
const renderedPrimitiveSatelliteMap = new Map<number, SatelliteInfo>()
let cameraMoveEndListener: Cesium.Event.RemoveCallback | null = null

// 卫星星座列表
const satelliteConstellations = ref<SatelliteConstellation[]>([])
// 获取卫星星座列表
/**
 * [功能]
 * 加载卡座列表并初始化 NORAD 和颜色映射表
 *
 * [处理规则]
 * - 已存在列表时直接返回，避免重复请求
 * - 成功后构建 constellationNoradMap 和 constellationColorMap
 *
 * [副作用]
 * - 修改 satelliteConstellations.value
 * - 修改 constellationNoradMap 和 constellationColorMap
 */
const loadSatelliteConstellations = async () => {
  if (satelliteConstellations.value.length) return
  const res = await getSatelliteConstellations()
  if (res.code === 200 && Array.isArray(res.data)) {
    satelliteConstellations.value = res.data
    constellationNoradMap.clear()
    constellationColorMap.clear()

    res.data.forEach((constellation, index) => {
      constellationColorMap.set(
        constellation.name,
        Cesium.Color.fromCssColorString(CONSTELLATION_COLOR_PALETTE[index % CONSTELLATION_COLOR_PALETTE.length])
      )
      constellation.noradIds.forEach((noradId) => {
        constellationNoradMap.set(Number(noradId), constellation)
      })
    })
  }
}

/**
 * [功能]
 * 根据 NORAD 编号查询卡座信息
 *
 * @param norad 卡座内卫星的 NORAD 编号
 * @returns 卡座对象，未找到时返回 null
 */
const getConstellationByNorad = (norad: number) => constellationNoradMap.get(Number(norad)) ?? null

/**
 * [功能]
 * 获取卫星的展示颜色
 *
 * [处理规则]
 * - 如果该卫星属于卡座，返回卡座对应的固定颜色
 * - 如果不属于任何卡座，按卡座类型返回默认颜色
 *
 * @param satellite 卫星信息对象
 * @param norad NORAD 编号
 * @returns Cesium 颜色
 */
const getConstellationColor = (satellite: SatelliteInfo, norad: number) => {
  const constellation = getConstellationByNorad(norad)
  if (constellation) {
    return Cesium.Color.clone(constellationColorMap.get(constellation.name) ?? Cesium.Color.CYAN, new Cesium.Color())
  }
  return Cesium.Color.clone(getSatelliteColorByType(satellite.sat_type), new Cesium.Color())
}

/**
 * [功能]
 * 判断当前相机是否处于卡座近视状态
 *
 * [说明]
 * 当相机高度小于阔值时，卡座内卫星标签和连线才会显示
 *
 * @returns 是否为近视模式
 */
const isConstellationCloseView = () => {
  if (!viewer) return false
  return viewer.camera.positionCartographic.height <= CONSTELLATION_CLOSE_VIEW_HEIGHT
}

/**
 * [功能]
 * 获取当前选中卡座所有 NORAD 编号的 Set
 *
 * @returns NORAD 编号的 Set，未选中时返回空 Set
 */
const getSelectedConstellationNoradSet = () =>
  new Set((selectedConstellation.value?.noradIds ?? []).map((noradId) => Number(noradId)))

/**
 * [功能]
 * 清除卡座叠加层实体（星间连线、包络线、中心标签）
 *
 * [副作用]
 * - 从 viewer.entities 中移除并清空 constellationOverlayEntityIds
 */
const clearConstellationOverlayEntities = () => {
  if (!viewer) return
  constellationOverlayEntityIds.forEach((entityId) => {
    const entity = viewer.entities.getById(entityId)
    if (entity) {
      viewer.entities.remove(entity)
    }
  })
  constellationOverlayEntityIds.clear()
}

/**
 * [功能]
 * 根据卡座内卫星的空间位置计算凸包络位置序列
 *
 * [业务目的]
 * 通过中心点投影到局部 ENU 坐标系，按极角排序得到顺时针的卡座包络多边形
 *
 * [关键规则]
 * - 位置数小于 2 时返回空数组
 * - 最后将第一个点加到末尾以闭合多边形
 *
 * @param positions 卡座内所有卫星的三维坐标点数组
 * @returns 按角度排序后的位置序列（闭合多边形）
 */
const buildConstellationEnvelopePositions = (positions: Cesium.Cartesian3[]) => {
  if (positions.length < 2) return [] as Cesium.Cartesian3[]

  const center = positions.reduce(
    (result, position) => Cesium.Cartesian3.add(result, position, result),
    new Cesium.Cartesian3()
  )
  Cesium.Cartesian3.divideByScalar(center, positions.length, center)

  const inverseTransform = Cesium.Matrix4.inverseTransformation(
    Cesium.Transforms.eastNorthUpToFixedFrame(center),
    new Cesium.Matrix4()
  )

  const sorted = positions
    .map((position) => {
      const local = Cesium.Matrix4.multiplyByPoint(inverseTransform, position, new Cesium.Cartesian3())
      return {
        position,
        angle: Math.atan2(local.y, local.x),
      }
    })
    .sort((left, right) => left.angle - right.angle)
    .map((item) => item.position)

  if (sorted.length > 2) {
    sorted.push(sorted[0])
  }

  return sorted
}

const updateConstellationOverlayEntities = () => {
  if (!viewer) return

  clearConstellationOverlayEntities()

  const constellation = selectedConstellation.value
  if (!constellation) {
    viewer.scene.requestRender()
    return
  }

  const selectedNorads = getSelectedConstellationNoradSet()
  const selectedSatellites = Array.from(renderedPrimitiveSatelliteMap.entries())
    .filter(([norad]) => selectedNorads.has(norad))
    .map(([norad, satellite]) => ({
      norad,
      satellite,
      position: Cesium.Cartesian3.fromDegrees(
        satellite.satellitePosition.longitude,
        satellite.satellitePosition.latitude,
        satellite.satellitePosition.altitude
      ),
    }))

  if (!selectedSatellites.length) {
    viewer.scene.requestRender()
    return
  }

  const color = Cesium.Color.clone(
    constellationColorMap.get(constellation.name) ?? Cesium.Color.CYAN,
    new Cesium.Color()
  )

  const hullPositions = buildConstellationEnvelopePositions(selectedSatellites.map((item) => item.position))
  if (hullPositions.length >= 2) {
    const hullId = `constellation-envelope-${constellation.name}`
    constellationOverlayEntityIds.add(hullId)
    viewer.entities.add({
      id: hullId,
      polyline: {
        positions: hullPositions,
        width: 2,
        material: color.withAlpha(0.72),
      },
    })
  }

  const center = selectedSatellites.reduce(
    (result, item) => Cesium.Cartesian3.add(result, item.position, result),
    new Cesium.Cartesian3()
  )
  Cesium.Cartesian3.divideByScalar(center, selectedSatellites.length, center)

  const labelId = `constellation-label-${constellation.name}`
  constellationOverlayEntityIds.add(labelId)
  viewer.entities.add({
    id: labelId,
    position: center,
    label: {
      text: `${constellation.chineseName || constellation.name}\n${selectedSatellites.length} 颗卫星`,
      font: '13px sans-serif',
      fillColor: color,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      showBackground: true,
      backgroundColor: new Cesium.Color(0, 0, 0, 0.45),
      pixelOffset: new Cesium.Cartesian2(0, -18),
    },
  })

  if (showConstellationLinks.value && selectedSatellites.length > 1) {
    const edgeKeys = new Set<string>()
    selectedSatellites.forEach((source) => {
      const nearestTargets = selectedSatellites
        .filter((target) => target.norad !== source.norad)
        .map((target) => ({
          target,
          distance: Cesium.Cartesian3.distance(source.position, target.position),
        }))
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 2)

      nearestTargets.forEach(({ target }) => {
        const edgeKey = [source.norad, target.norad].sort((left, right) => left - right).join('-')
        if (edgeKeys.has(edgeKey)) return
        edgeKeys.add(edgeKey)

        const edgeId = `constellation-link-${edgeKey}`
        constellationOverlayEntityIds.add(edgeId)
        viewer.entities.add({
          id: edgeId,
          polyline: {
            positions: [source.position, target.position],
            width: 1.2,
            material: color.withAlpha(0.32),
          },
        })
      })
    })
  }

  viewer.scene.requestRender()
}
/**
 * [功能]
 * 应用卡座的可视化状态：根据卡座选中状态和相机远近更新所有占点和标签的外观
 *
 * [业务目的]
 * - 卡座选中时：卡座内卫星亮度正常，卡座外变暗、变小
 * - 未选中时：所有卫星按类型/卡座颜色展示
 * - 近视时才显示标签，远视则隐藏
 *
 * [关键规则]
 * - 展示大小和透明度根据卡座选中状态和远近实时计算
 * - 不要删除所有 primitive 和 label 的更新逻辑
 */
/**
 * [功能]
 * 应用星座的可视化状态：根据星座选中状态及视角高度控制卫星点阵与 Label 标签的层级聚合显示
 *
 * [业务目的]
 * - 星座选中时：仅在 Cesium 地图上展示该星座相关的卫星，隐藏所有其他无关卫星；
 * - 聚合策略：高处视角只显示中心聚合 Tag 标签，隐藏极其密集的单颗具体 Label；拉近至低处时才展现具体卫星的 Label 名称。
 * - 未选中时：恢复全量卫星的展示
 */
const applyConstellationVisualState = (skipOverlayUpdate = false) => {
  if (!viewer) return

  const selectedNorads = getSelectedConstellationNoradSet()
  const hasSelectedConstellation = Boolean(selectedConstellation.value)
  const closeView = isConstellationCloseView()

  // 1. 更新卫星占点 (PointPrimitive)
  satellitePointPrimitives.forEach((pointPrimitive, norad) => {
    const satellite = renderedPrimitiveSatelliteMap.get(norad)
    if (!satellite) return

    const isSelected = selectedNorads.has(norad)
    if (hasSelectedConstellation) {
      // 选中星座时：仅渲染展示所属星座的卫星，隐藏其他无关卫星
      pointPrimitive.show = isSelected
      if (isSelected) {
        const baseColor = getConstellationColor(satellite, norad)
        pointPrimitive.color = baseColor
        pointPrimitive.outlineColor = Cesium.Color.WHITE
        pointPrimitive.pixelSize = closeView ? 8 : 6
      }
    } else {
      // 未选中星座时：全量恢复展示所有卫星
      pointPrimitive.show = true
      const baseColor = getConstellationColor(satellite, norad)
      pointPrimitive.color = baseColor
      pointPrimitive.outlineColor = Cesium.Color.WHITE
      pointPrimitive.pixelSize = closeView ? 5 : 4
    }
  })

  // 2. 更新卫星名称标签 (LabelPrimitive)
  satelliteLabelPrimitives.forEach((labelPrimitive, norad) => {
    const satellite = renderedPrimitiveSatelliteMap.get(norad)
    if (!satellite) return

    const isSelected = selectedNorads.has(norad)
    if (hasSelectedConstellation) {
      // 选中星座时：
      // - 高处 (closeView 为 false)：隐藏单颗卫星具体 Label，防止成百上千个文本挤在一团，改为在中心展示星座聚合标签
      // - 低处 (closeView 为 true)：拉近到低视角时展示每颗具体卫星的名称 Label
      labelPrimitive.show = isSelected && closeView
      if (isSelected && closeView) {
        labelPrimitive.text = satellite.name_en || String(norad)
        labelPrimitive.fillColor = Cesium.Color.WHITE
        labelPrimitive.outlineColor = Cesium.Color.BLACK
        labelPrimitive.outlineWidth = 2
        labelPrimitive.style = Cesium.LabelStyle.FILL_AND_OUTLINE
        labelPrimitive.showBackground = true
        labelPrimitive.backgroundColor = new Cesium.Color(0, 0, 0, 0.65)
        labelPrimitive.distanceDisplayCondition = undefined as any
      }
    } else {
      // 未选中星座时：恢复近距离控制模式
      labelPrimitive.show = closeView
      labelPrimitive.fillColor = Cesium.Color.WHITE
      labelPrimitive.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0, 6_000_000) as any
    }
  })

  // 拖拽/移动相机时跳过更新 Polyline 线路实体，避免重清重绘造成线路一闪一闪
  if (!skipOverlayUpdate) {
    updateConstellationOverlayEntities()
  }

  viewer.scene.requestRender()
}

/**
 * [功能]
 * 清除卡座选中状态，并重置所有卫星的视觉应用
 */
const clearConstellationSelection = () => {
  selectedConstellation.value = null
  applyConstellationVisualState()
}

/**
 * [功能]
 * 根据 NORAD 编号选择其所属卡座，并应用卡座视觉状态
 *
 * @param norad 点击的卫星 NORAD 编号
 */
const selectConstellationByNorad = (norad: number) => {
  const constellation = getConstellationByNorad(norad)
  if (!constellation) {
    clearConstellationSelection()
    return
  }
  selectedConstellation.value = constellation
  applyConstellationVisualState()
}

/**
 * [功能]
 * 外部接口：根据卡座名称聚焦到指定卡座，并自动调整视角飞行至星座中心
 *
 * @param constellationName 卡座名称（英文或中文）
 */
const focusConstellationByName = async (constellationName?: string | null) => {
  await loadSatelliteConstellations()

  const normalizedName = String(constellationName ?? '').trim()
  if (!normalizedName) {
    clearConstellationSelection()
    return
  }

  const constellation = satelliteConstellations.value.find(
    (item) => item.name === normalizedName || item.chineseName === normalizedName
  )
  if (!constellation) {
    clearConstellationSelection()
    return
  }

  selectedConstellation.value = constellation
  applyConstellationVisualState()

  // 视角平滑飞行到星座卫星簇的中心点
  const selectedNorads = getSelectedConstellationNoradSet()
  const selectedSatellitesPos = Array.from(renderedPrimitiveSatelliteMap.entries())
    .filter(([norad]) => selectedNorads.has(norad))
    .map(([, satellite]) =>
      Cesium.Cartesian3.fromDegrees(
        satellite.satellitePosition.longitude,
        satellite.satellitePosition.latitude,
        satellite.satellitePosition.altitude
      )
    )

  if (selectedSatellitesPos.length > 0 && viewer) {
    const center = selectedSatellitesPos.reduce(
      (result, pos) => Cesium.Cartesian3.add(result, pos, result),
      new Cesium.Cartesian3()
    )
    Cesium.Cartesian3.divideByScalar(center, selectedSatellitesPos.length, center)
    const cartographic = Cesium.Cartographic.fromCartesian(center)
    const targetLon = Cesium.Math.toDegrees(cartographic.longitude)
    const targetLat = Cesium.Math.toDegrees(cartographic.latitude)

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(targetLon, targetLat, 9_000_000),
      duration: 1.5,
    })
  }
}

/**
 * [功能]
 * 展卡座星间连线开关切换事件处理器
 */
const handleConstellationLinkToggle = () => {
  updateConstellationOverlayEntities()
}
/**
 * [功能]
 * 以 Primitive 方式渲染卡座/全局卫星，适用于大量卫星展示场景
 *
 * [处理规则]
 * - 每次调用先取消已排队的渲染帧，防止满足已销毁资源
 * - 使用 renderToken 实现并发安全，旧任务自动中止
 * - 每 400 颗卫星退让一个渲染帧，避免单帧进行大量计算巫卡 UI
 *
 * [副作用]
 * - 修改 pointCollection / labelCollection、satellitePointPrimitives 等映射表
 * - 修改 satelliteRenderBusy 状态
 *
 * @param satellites 需要渲染的卫星信息数组
 */
const renderSatellitePathWithPrimitive = async (satellites: SatelliteInfo[]) => {
  const currentToken = ++satelliteRenderToken
  satelliteRenderBusy.value = true

  // 加载卫星星座数据
  await loadSatelliteConstellations()

  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  try {
    // 如果组件已卸载、viewer 已销毁，直接跳过渲染
    if (!viewer || ((viewer as any).isDestroyed && (viewer as any).isDestroyed())) return
    if (!viewer.scene || ((viewer.scene as any).isDestroyed && (viewer.scene as any).isDestroyed())) return

    // 如果之前的 collection 已被销毁（可能在组件卸载或 viewer 重建时），重置引用
    if (pointCollection && pointCollection.isDestroyed()) {
      pointCollection = null
    }
    if (labelCollection && labelCollection.isDestroyed()) {
      labelCollection = null
    }

    // 复用已有的 point/label 集合，避免每次渲染都重新 new 出大量对象
    if (!pointCollection) {
      pointCollection = new Cesium.PointPrimitiveCollection()
      viewer.scene.primitives.add(pointCollection)
    }
    if (!labelCollection) {
      labelCollection = new Cesium.LabelCollection()
      viewer.scene.primitives.add(labelCollection)
    }

    // 清空已有点与标签（避免 destroy 后继续渲染）
    pointCollection.removeAll()
    labelCollection.removeAll()
    satellitePointPrimitives.clear()
    satelliteLabelPrimitives.clear()
    satellitePrimitiveEntities.clear()
    renderedPrimitiveSatelliteMap.clear()
    clearConstellationOverlayEntities()

    const chunkSize = 400
    for (let index = 0; index < satellites.length; index += 1) {
      if (currentToken !== satelliteRenderToken) return

      const s = satellites[index]
      if (
        s?.satellitePosition &&
        !isNaN(s.satellitePosition.longitude) &&
        !isNaN(s.satellitePosition.latitude) &&
        !isNaN(s.satellitePosition.altitude)
      ) {
        const norad = Number(s.norad)
        renderedPrimitiveSatelliteMap.set(norad, s)
        const cartesian = Cesium.Cartesian3.fromDegrees(
          s.satellitePosition.longitude,
          s.satellitePosition.latitude,
          s.satellitePosition.altitude
        )

        const constellation = getConstellationByNorad(norad)
        const primitiveMetadata = {
          id: `satellite-${norad}`,
          norad,
          constellationName: constellation?.name ?? '',
        }

        const pointPrimitive = pointCollection.add({
          position: cartesian,
          color: getConstellationColor(s, norad),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          pixelSize: 4,
          heightReference: Cesium.HeightReference.NONE,
          id: primitiveMetadata,
        })
        satellitePointPrimitives.set(norad, pointPrimitive)

        // 仅在较近距离显示标签（避免 2w+ 标签造成性能问题）
        const labelPrimitive = labelCollection.add({
          position: cartesian,
          text: s.name_en,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(-30, -20),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.3),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 6_000_000),
          show: false,
          id: primitiveMetadata,
        })
        satelliteLabelPrimitives.set(norad, labelPrimitive)
      }

      if ((index + 1) % chunkSize === 0) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      }
    }

    if (currentToken !== satelliteRenderToken) return

    viewer.clock.multiplier = 100
    // 开启动画
    viewer.clock.shouldAnimate = true

    applyConstellationVisualState()
    // 在 requestRenderMode 下显式触发渲染（不然会卡住）
    viewer.scene.requestRender()
  } finally {
    if (currentToken === satelliteRenderToken) {
      satelliteRenderBusy.value = false
    }
  }
}

// 监听鼠标左键点击事件并处理实体选择
function handleViewerClickEvent() {
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  viewer.screenSpaceEventHandler.setInputAction(async function (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
    const picked = viewer.scene.pick(event.position)
    if (!Cesium.defined(picked)) {
      currentTrackedNorad = null
      viewer.trackedEntity = undefined // 点击空白处解绑视角跟随
      store.closeSatPanel() // 点到空白也关闭
      store.setSelectedSatellite(null) // 清空选择的卫星
      store.setSelectedInfrastructureNode(null) // 清空选中的地面基础设施节点
      showPaths.value = false
      for (const element of satelliteEntities.values()) {
        if (element.path) element.path.show = new Cesium.CallbackProperty(() => false, false)
      }
      resetHighlightSatellites() // 取消高亮
      return
    }

    const pickedId = picked.id as { id?: string; norad?: number } | Cesium.Entity | undefined
    if (!pickedId) return
    const rawEntityId = String((pickedId as { id?: string }).id ?? '')

    // 检测是否点击了敌方地面接收站或数据中心 3D 实体
    if (rawEntityId.startsWith('infra-node-')) {
      const cleanId = rawEntityId.replace(/-(ring|frustum)$/, '')
      const infraMatch = infrastructureNodes.value.find((node) => `infra-node-${node.type}-${node.id}` === cleanId)
      if (infraMatch) {
        store.setSelectedInfrastructureNode(infraMatch)
        flyToInfrastructureNode(infraMatch)
        return
      }
    } else {
      // 点击其他 3D 实体时，重置基础设施选择状态
      store.setSelectedInfrastructureNode(null)
    }

    const primitiveNorad = Number((pickedId as { norad?: number }).norad)
    const entityId = rawEntityId
    const noradMatch = entityId.match(/satellite-(\d+)/) || entityId.match(/sat-node-(\d+)/)
    const norad = Number.isFinite(primitiveNorad) ? primitiveNorad : noradMatch ? Number(noradMatch[1]) : null
    if (!Number.isFinite(norad)) return

    selectConstellationByNorad(Number(norad))
    highlightSatellite({ norad_id: String(norad) })
    trackSatelliteByNorad(Number(norad)) // 点击卫星时，相机视角锁合并持续跟随该卫星

    // 调用 getSatelliteDetail 查询卫星详细信息并同步保存至全局 layout store，供右侧 C2 面板展示
    try {
      const res = await getSatelliteDetail({ norad: Number(norad) })
      if (res.code === 200 && res.data) {
        store.setSelectedSatellite(res.data)
      }
    } catch (error) {
      console.error('查询卫星详细信息接口失败:', error)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/**
 * [功能]
 * 根据卡座类型返回对应的 Cesium 颜色
 *
 * [处理规则]
 * - 匹配顺序从上到下，标屁属一种类型
 * - 未匹配时返回默认蛇蓝色
 *
 * @param type 卡座类型字符串（如"军事"、"通信"等）
 * @returns Cesium 颜色对象
 */
const getSatelliteColorByType = (type: string) => {
  if (type) {
    if (type.includes('军事')) {
      return Cesium.Color.CHARTREUSE
    }
    if (type.includes('气象')) {
      return Cesium.Color.BLUEVIOLET
    }
    if (type.includes('海洋')) {
      return Cesium.Color.BROWN
    }
    if (type.includes('测绘')) {
      return Cesium.Color.BURLYWOOD
    }
    if (type.includes('通信')) {
      return Cesium.Color.BLUE
    }
    if (type.includes('导航')) {
      return Cesium.Color.GREEN
    }
    if (type.includes('侦察')) {
      return Cesium.Color.RED
    }
    if (type.includes('探测')) {
      return Cesium.Color.CHOCOLATE
    }
    if (type.includes('科学')) {
      return Cesium.Color.PURPLE
    }
  }
  return Cesium.Color.ROYALBLUE
}

/**
 * [功能]
 * 根据卡座所属国家返回红/蓝/白颜色
 *
 * [处理规则]
 * - 属于假方（meCountry）返回 RED
 * - 属于敌方（enemyCountry）返回 BLUE
 * - 其他国家返回 WHITE
 *
 * @param country 卡座所属国家字符串
 * @returns Cesium 颜色对象
 */
function getSatelliteColor(country: string) {
  // 根据当前任务的我方/敌方国家列表判断属局颜色
  const ourCountries = store.activedTask?.meCountry.split(',')
  const enemyCountries = store.activedTask?.enemyCountry.split(',')
  const color = ourCountries?.includes(country)
    ? Cesium.Color.RED
    : enemyCountries?.includes(country)
      ? Cesium.Color.BLUE
      : Cesium.Color.WHITE
  return color
}

/**
 * [功能]
 * 将逗号分隔的国家字符串解析为国家名数组
 *
 * @param value 逗号分隔的国家字符串
 * @returns 去除空白后的国家名数组
 */
const normalizeCountryList = (value?: string) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

/**
 * [功能]
 * 确保并生成指定 NORAD 编号卫星的 SampledPositionProperty 轨道数据与点位插值。
 *
 * [处理规则]
 * - 检查缓存 satelliteOrbitData 和 satellitePositionPropertyCache，存在则直接返回。
 * - 从 satelliteTleCache 获取 TLE 轨道数据，基于 satellite.js 计算 ECF 坐标点序列。
 * - 若成功生成采样点，存入 satellitePositionPropertyCache 并返回 PositionProperty。
 *
 * [副作用]
 * - 更新 satelliteOrbitData、satellitePositionPropertyCache 映射表。
 * - 修改 cesiumInitialized 状态标识。
 *
 * [修改约束]
 * - 不要改变函数签名 (norad: number, satel: any)。
 * - 依赖顶层的 viewer 实例及 satelliteTleCache 数据。
 *
 * @param norad 卫星 NORAD 编号
 * @param satel 卫星元数据信息
 * @returns Cesium.SampledPositionProperty 或 null
 */
const ensureOrbitData = (norad: number, satel: any): Cesium.SampledPositionProperty | null => {
  if (!viewer || viewer.isDestroyed()) return null

  if (satelliteOrbitData.has(norad) && satellitePositionPropertyCache.has(norad)) {
    return satellitePositionPropertyCache.get(norad)!
  }

  const tleData = satelliteTleCache.get(norad)
  if (!tleData || !tleData.line1 || !tleData.line2) return null

  const satrec = satellitejs.twoline2satrec(tleData.line1, tleData.line2)
  if (!satrec) return null

  // 已加载完成
  cesiumInitialized.value = true

  const positionProperty = new Cesium.SampledPositionProperty()
  const orbitSamples: Array<{ time: Cesium.JulianDate; position: Cesium.Cartesian3; period: number }> = []
  const startTime = viewer.clock.currentTime

  // 2分钟步长（已减少采样点数量）
  const timeStep = 120
  // 低轨90分钟 中轨12小时 其他（高轨|大椭圆）24小时
  const singleOrbitPeriod = satel.orbit_type === 1 ? 90 * 60 : satel.orbit_type === 2 ? 12 * 3600 : 24 * 3600
  const totalPeriods = Math.max(2, Math.ceil((24 * 3600) / singleOrbitPeriod))

  for (let period = 0; period < totalPeriods; period++) {
    const periodStartTime = Cesium.JulianDate.addSeconds(startTime, period * singleOrbitPeriod, new Cesium.JulianDate())

    for (let i = 0; i <= singleOrbitPeriod; i += timeStep) {
      const time = Cesium.JulianDate.addSeconds(periodStartTime, i, new Cesium.JulianDate())
      try {
        const positionAndVelocity = satellitejs.propagate(satrec, Cesium.JulianDate.toDate(time))
        if (positionAndVelocity && positionAndVelocity.position) {
          const positionEci = positionAndVelocity.position
          const gmst = satellitejs.gstime(Cesium.JulianDate.toDate(time))
          let positionEcf = satellitejs.eciToEcf(positionEci, gmst)
          if (store.effectModel) {
            positionEcf = positionEci
          }
          if (positionEcf) {
            const cart = new Cesium.Cartesian3(positionEcf.x * 1000, positionEcf.y * 1000, positionEcf.z * 1000)
            orbitSamples.push({ time, position: cart, period })
            positionProperty.addSample(time, cart)
          }
        }
      } catch (error) {
        // ignore 单点计算失败
      }
    }
  }

  if (orbitSamples.length === 0) return null

  satelliteOrbitData.set(norad, {
    samples: orbitSamples,
    singleOrbitPeriod,
    totalPeriods,
    startTime,
  })
  satellitePositionPropertyCache.set(norad, positionProperty)
  return positionProperty
}

// 渲染卫星轨迹（路径实体方式，支持大量卫星）
const renderSateliitePathWithEntity = async (taskId: number, namespace?: string) => {
  if (!viewer) return
  const currentViewer = viewer

  const isViewerInvalid = () => {
    return !currentViewer || currentViewer !== viewer || (currentViewer as any).isDestroyed?.()
  }

  // 任务切换时清理缓存（避免重复计算 / 内存持续增长）
  if (currentRenderTaskId !== taskId) {
    currentRenderTaskId = taskId
    cachedTaskId = taskId
    cachedSatelliteList = null
    satelliteTleCache.clear()
    satelliteOrbitData.clear()
    satellitePositionPropertyCache.clear()
    satelliteEntities.clear()

    // 暂停渲染循环，防止 removeAll() 与 _onTick 并发访问已销毁的 Batch
    const prevLoop = viewer.useDefaultRenderLoop
    viewer.useDefaultRenderLoop = false
    viewer.entities.removeAll()
    if (!viewer.isDestroyed()) {
      viewer.useDefaultRenderLoop = prevLoop
    }
  }

  // 获取任务的卫星列表（只在第一次或任务切换时请求）
  if (!cachedSatelliteList || cachedTaskId !== taskId) {
    const res = await getTLEDataByTaskId(taskId)
    if (!(res.code === 200 && res.data)) return

    cachedSatelliteList = res.data.results || []
    cachedTaskId = taskId
    // 保存任务相关的所有卫星，网络安全使用
    store.saveTaskSatellite(cachedSatelliteList)
  }

  if (!cachedSatelliteList) return
  const enemyCountrySet = computed(() => new Set(normalizeCountryList(store.activedTask?.enemyCountry)))
  // 过滤条件应用
  let satelliteList = cachedSatelliteList.filter((s) => enemyCountrySet.value.has(s.country))

  // 需要渲染的卫星 ID 集合，用于隐藏未命中的实体
  const wantedNorads = new Set(satelliteList.map((s) => Number(s.norad_id)))

  // 隐藏不在当前过滤条件中的实体（保留缓存，避免重复创建）
  for (const [norad, entity] of satelliteEntities.entries()) {
    if (!wantedNorads.has(norad)) {
      entity.show = false
    }
  }

  // 如果该任务下没有任何卫星，则直接结束
  if (satelliteList.length === 0) {
    return
  }

  // 只请求尚未缓存的 TLE
  const needTleNorads = satelliteList.map((s) => Number(s.norad_id)).filter((norad) => !satelliteTleCache.has(norad))

  if (needTleNorads.length) {
    const tleDataRes = await getSatelliteTLEData({ norads: needTleNorads })
    if (isViewerInvalid()) return
    if (tleDataRes.code === 200 && Array.isArray(tleDataRes.data)) {
      for (const row of tleDataRes.data) {
        if (row && typeof row.noradId !== 'undefined') {
          satelliteTleCache.set(Number(row.noradId), row.satelliteTleResp)
        }
      }
    }
  }

  if (isViewerInvalid()) return

  const nsPrefix = namespace ? `${namespace}-` : ''

  for (const satel of satelliteList) {
    if (!satel) continue
    const noradId = Number(satel.norad_id)
    if (Number.isNaN(noradId)) continue

    const positionProperty = ensureOrbitData(noradId, satel)
    if (!positionProperty) continue

    const entityId = `${nsPrefix}satellite-${noradId}`
    let entity = viewer.entities.getById(entityId) as Cesium.Entity | undefined
    if (!entity) {
      entity = viewer.entities.add({
        id: entityId,
        name: satel.name_en,
        availability: new Cesium.TimeIntervalCollection([
          new Cesium.TimeInterval({ start: currentViewer.clock.startTime, stop: currentViewer.clock.stopTime }),
        ]),
        position: positionProperty,
        show: true,
        point: {
          pixelSize: 8,
          color: getSatelliteColor(satel.country),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,
          show: true,
        },
        label: {
          text: satel.name_en,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.3),
          show: true,
        },
        path: {
          show: new Cesium.CallbackProperty(() => showPaths.value, false),
          leadTime: satel.orbit_type === 1 ? 90 * 60 : satel.orbit_type === 2 ? 12 * 3600 : 24 * 3600,
          trailTime: 0,
          width: 1,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.YELLOW,
          }),
        },
        description: `<div style="padding: 10px; font-family: inherit;background-color:white; color:  rgba(0, 0, 0, 0.7); border-radius: 8px;">
      <h3 style="color: #1890ff; margin: 0 0 10px 0;display:flex; justify-content: space-between; align-items:center;"><span>🛰️ ${satel.name_en}</span> ${createInfoBoxActionButton('详情', { norad: satel.norad_id })}</h3>
      <p><strong>NORAD:</strong> ${satel.norad_id} </p>
      <p><strong>卫星类型:</strong> ${satel.sat_type}</p>
      <p><strong>所属国家:</strong> ${satel.country}</p>
      <p><strong>威胁度:</strong> ${satel.strikeListResp?.threat_score.toFixed(4)}</p>
      <p><strong>可打击度:</strong> ${satel.strikeListResp?.kedaji_score.toFixed(4)}</p>
      <p><strong>综合评分:</strong> ${satel.strikeListResp?.overallScore?.toFixed(4)}</p>

      </div>
     `,
      })
      satelliteEntities.set(noradId, entity)
    } else {
      entity.show = true
      // 过滤条件变化时可能需要更新颜色
      if (entity.point) {
        entity.point.color = new Cesium.ConstantProperty(getSatelliteColor(satel.country))
        entity.position = positionProperty
      }
    }

    // 在 requestRenderMode 下需要显式请求渲染
    currentViewer.scene.requestRender()
  }
}

/**
 * [功能]
 * 打开卡座详情对话框
 *
 * @param norad 卡座 NORAD 编号
 */
function showDetail(norad: number) {
  if (isFinite(norad)) {
    openSatelliteProfile(norad)
  }
}

/**
 * [功能]
 * 在 Cesium 地图上标记战场区域
 *
 * [副作用]
 * - 调用工具函数 markBattleArea 修改 viewer.entities
 */
function markBattle() {
  markBattleArea(viewer, store.battle)
}

// [常量] 选中卫星高亮 3D 轨迹 Entity ID
const HIGHLIGHT_TRAIL_ENTITY_ID = 'selected-sat-orbit-trail'

/**
 * [功能]
 * 清除所有卫星的高亮样式与 3D 轨迹
 */
const resetHighlightSatellites = () => {
  if (!viewer || viewer.isDestroyed()) return

  // 1. 移除发光轨迹线
  const trailEntity = viewer.entities.getById(HIGHLIGHT_TRAIL_ENTITY_ID)
  if (trailEntity) {
    viewer.entities.remove(trailEntity)
  }

  // 2. 复原 Entity 模式高亮样式与 path 路径线宽
  const satellites = viewer.entities.values.filter(
    (s: any) => String(s._id ?? '').startsWith('satellite-') || String(s._id ?? '').startsWith('sat-node-')
  )
  if (satellites && satellites.length) {
    satellites.forEach((entity: any) => {
      if (entity && entity.point) {
        entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE)
        entity.point.pixelSize = new Cesium.ConstantProperty(8)
      }
      if (entity && entity.path) {
        entity.path.show = new CallbackProperty(() => showPaths.value, false)
        entity.path.width = new Cesium.ConstantProperty(1)
      }
    })
  }

  // 3. 复原 Primitive 模式高亮样式
  satellitePointPrimitives.forEach((pointPrimitive, norad) => {
    const satellite = renderedPrimitiveSatelliteMap.get(norad)
    if (satellite) {
      pointPrimitive.pixelSize = 4
      pointPrimitive.color = getConstellationColor(satellite, norad)
      pointPrimitive.outlineColor = Cesium.Color.WHITE
    }
  })
  satelliteLabelPrimitives.forEach((labelPrimitive) => {
    labelPrimitive.fillColor = Cesium.Color.WHITE
  })

  applyConstellationVisualState()
}

/**
 * [功能]
 * 高亮指定 NORAD 编号的敌方卫星、加粗显示其 Entity 自带的 path 轨迹并自动平滑飞赴定位
 *
 * @param sate 包含 norad_id 的对象
 */
const highlightSatellite = (sate: { norad_id: string }) => {
  if (!viewer || viewer.isDestroyed()) return
  resetHighlightSatellites()

  const norad = Number(sate.norad_id)
  if (!Number.isFinite(norad)) return

  // 1. 确保该卫星在 viewer.entities 中有对应的 3D Entity 节点
  const entityId = `sat-node-${norad}`
  let entity = viewer.entities.getById(`satellite-${sate.norad_id}`) || viewer.entities.getById(entityId)
  const satPos = getSatellitePositionInCesium(norad)

  if (!entity && satPos) {
    const matrixSats = props.matrixData?.initMatrixList || []
    const satInfo = matrixSats.find((s) => s.norad === norad)
    const isRelay = norad === 22314 || (satInfo?.satType || '').includes('中继')
    const posProp = satellitePositionPropertyCache.get(norad) || (satInfo ? ensureOrbitData(norad, satInfo) : undefined)

    entity = viewer.entities.add({
      id: entityId,
      position: (posProp ||
        new Cesium.CallbackProperty(
          () => getSatellitePositionInCesium(norad) || satPos,
          false
        )) as unknown as Cesium.PositionProperty,
      point: {
        pixelSize: 18,
        color: Cesium.Color.GOLD,
        outlineColor: Cesium.Color.YELLOW,
        outlineWidth: 4,
      },
      label: {
        text: `[敌方${isRelay ? '数据中继卫星' : '过境卫星'}]\n${satInfo?.name || `NORAD: ${norad}`}`,
        font: 'bold 13px sans-serif',
        fillColor: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.75),
        pixelOffset: new Cesium.Cartesian2(0, -30),
      },
      path: {
        show: new Cesium.CallbackProperty(() => true, false),
        leadTime: 90 * 60,
        trailTime: 0,
        width: 4,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.2,
          color: Cesium.Color.YELLOW,
        }),
      },
    })
    electronicNodeEntityIds.add(entityId)
  }

  // 2. Entity 模式节点高亮与自带 path 加粗
  if (entity) {
    viewer.selectedEntity = entity
    if (entity.point) {
      entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.YELLOW)
      entity.point.outlineWidth = new Cesium.ConstantProperty(4)
      entity.point.pixelSize = new Cesium.ConstantProperty(18)
      entity.point.color = new Cesium.ConstantProperty(Cesium.Color.GOLD)
    }
    if (entity.label) {
      entity.label.show = new Cesium.ConstantProperty(true)
      entity.label.fillColor = new Cesium.ConstantProperty(Cesium.Color.YELLOW)
    }
    if (entity.path) {
      entity.path.show = new CallbackProperty(() => true, false)
      entity.path.width = new Cesium.ConstantProperty(4)
    }
  }

  // 3. Primitive 模式节点高亮 (PointPrimitive & LabelPrimitive)
  const pointPrimitive = satellitePointPrimitives.get(norad)
  if (pointPrimitive) {
    pointPrimitive.pixelSize = 18
    pointPrimitive.color = Cesium.Color.GOLD
    pointPrimitive.outlineColor = Cesium.Color.YELLOW
    pointPrimitive.show = true
  }
  const labelPrimitive = satelliteLabelPrimitives.get(norad)
  if (labelPrimitive) {
    labelPrimitive.show = true
    labelPrimitive.fillColor = Cesium.Color.YELLOW
  }

  // 4. 不再渲染单独插值的 Polyline 发光轨迹，仅保留并加粗 Entity 自带 Path

  viewer.scene.requestRender()
}

// 监听 selectedNorad 属性，联动更新高亮与轨迹
watch(
  () => props.selectedNorad,
  (newNorad) => {
    if (!viewer || viewer.isDestroyed()) return
    if (newNorad) {
      highlightSatellite({ norad_id: String(newNorad) })
      trackSatelliteByNorad(Number(newNorad))
    } else {
      resetHighlightSatellites()
    }
  },
  { immediate: true }
)

/**
 * 安全销毁 ECharts 实例，避免重复销毁报错
 *
 * @param chart ECharts 实例或 null
 */
const disposeChart = (chart: echarts.ECharts | null) => {
  if (chart && !chart.isDisposed()) {
    chart.dispose()
  }
}

/**
 * 组件挂载完成时初始化 Cesium Viewer 并绑定相机移动监听器
 *
 * [处理规刖]
 * - 等待 initViewer 完成后再绑定事件
 * - 相机移动结束时自动重新应用卡座视觉状态
 */
onMounted(async () => {
  await initViewer()
  if (viewer) {
    cameraMoveEndListener = () => {
      applyConstellationVisualState()
    }
    viewer.camera.moveEnd.addEventListener(cameraMoveEndListener)
    void loadAndRenderRedWeapons()
  }
  startContainerSizeObserver()
})

/**
 * 组件卸载前清理所有 Cesium 资源
 *
 * [关键规则]
 * - 必须先能的停止卡座动画，防止 GPU 线程在 destroy 后仍在违行
 * - 增加 renderToken 确保所有异步渲染任务应尽尽止
 * - 必须移除相机监听器和 InfoBox 事件委托
 * - 销毁全部 ECharts 实例防止内存泄漏
 * - 最后调用 viewer.destroy() 释放 GPU 资源
 *
 * [AI 修改约束]
 * - 不要改变资源释放顺序
 * - 不要删除 renderToken++ 逻辑
 */
onBeforeUnmount(() => {
  stopContainerSizeObserver()

  // 1. 先安全移除时钟 Tick 监听器，防止销毁过程中触发 onTick 更新
  if (clockTickRemoveListener) {
    try {
      clockTickRemoveListener()
    } catch (e) {
      console.warn('failed to remove clockTickRemoveListener on unmount', e)
    }
    clockTickRemoveListener = null
  }

  // 2. 移除相机变化监听器
  if (cameraMoveEndListener) {
    try {
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.changed.removeEventListener(cameraMoveEndListener)
      }
    } catch (e) {
      console.warn('failed to remove cameraMoveEndListener on unmount', e)
    }
    cameraMoveEndListener = null
  }

  satelliteRenderToken += 1
  satelliteRenderBusy.value = false
  pointCollection = null
  labelCollection = null
  satellitePointPrimitives.clear()
  satelliteLabelPrimitives.clear()
  satellitePrimitiveEntities.clear()
  renderedPrimitiveSatelliteMap.clear()
  clearConstellationOverlayEntities()
  selectedConstellation.value = null
  satelliteEntities.clear()
  satelliteOrbitData.clear()
  satellitePositionPropertyCache.clear()
  satelliteTleCache.clear()
  cachedSatelliteList = null
  cachedTaskId = null
  currentRenderTaskId = null

  if (viewer) {
    if (!viewer.isDestroyed()) {
      try {
        // 停止默认渲染循环，截断帧更新 (CesiumWidget._onTick)
        viewer.useDefaultRenderLoop = false
        viewer.clock.shouldAnimate = false
      } catch (e) {
        console.warn('failed to stop render loop on unmount', e)
      }

      try {
        unbindInfoBoxButton(viewer)
      } catch (e) {
        console.warn('unbindInfoBoxButton warning on unmount', e)
      }

      Object.values(chartInstances).forEach((chart) => disposeChart(chart))

      try {
        viewer.destroy()
      } catch (e) {
        console.warn('failed to destroy viewer on unmount', e)
      }
    }
    // 强制归零全局引用的 viewer，避免后续逻辑拦截并访问已销毁的实例
    viewer = null as any
  }
})
/**
 * 对外暴露的公共方法，供父组件调用
 *
 * [方法说明]
 * - renderSatellitePathWithPrimitive: Primitive 模式渲染卡座（全局卡座/复杂展示）
 * - clearViewer: 清空所有实体（任务切换时使用）
 * - focusConstellationByName: 按名称展示卡座
 * - renderSateliitePathWithEntity: Entity 模式渲染卡座（任务模式）
 * - markBattle: 标记战场区域
 * - highlightSatellite: 高亮指定卡座
 * - flyToView: 快速定位到指定视角
 * - toggleRadarFrustums: 显隐雷达探测包络视椒
 * - toggleRedSatellites: 显隐我方卡座
 */
/**
 * [功能]
 * 暂停时钟推演动画 (用于未选择单颗卫星时静态展示)
 */
const pauseClockAnimation = () => {
  if (viewer && !viewer.isDestroyed()) {
    viewer.clock.shouldAnimate = false
  }
}

/**
 * [功能]
 * 推进 Cesium 时钟至指定时间点并开启推演动画
 *
 * @param timeStr 时间格式字符串或 ISO 8601 字符串
 */
const jumpToTimeAndPlay = (timeStr?: string) => {
  if (!viewer || viewer.isDestroyed()) return
  if (timeStr) {
    try {
      const date = new Date(timeStr.replace(/-/g, '/'))
      if (!isNaN(date.getTime())) {
        const targetJulianDate = Cesium.JulianDate.fromDate(date)
        viewer.clock.currentTime = targetJulianDate
      }
    } catch (err) {
      console.warn('时间跳转解析失败:', timeStr, err)
    }
  }
  viewer.clock.shouldAnimate = true
  viewer.scene.requestRender()
}

defineExpose({
  renderSatellitePathWithPrimitive,
  clearViewer,
  focusConstellationByName,
  renderSateliitePathWithEntity,
  markBattle,
  highlightSatellite,
  flyToView,
  toggleRadarFrustums,
  toggleRedSatellites,
  pauseClockAnimation,
  jumpToTimeAndPlay,
})
</script>
<style lang="scss" scoped>
.cesium-container {
  position: relative;
  height: 100%;
  min-height: 600px;
  /* 1. 进入前：藏在左边 */
  .slide-enter-from {
    transform: translateX(-100%);
  }
  /* 2. 进入过程 & 离开过程：做动画 */
  .slide-enter-active,
  .slide-leave-active {
    transition: transform 0.5s ease-in-out;
  }
  /* 3. 离开后：再滑回去 */
  .slide-leave-to {
    transform: translateX(-100%);
  }
  .credit {
    display: none;
  }

  .render-loading {
    position: absolute;
    inset: 0;
    z-index: 3000;
    display: grid;
    place-items: center;
    background: rgba(2, 8, 16, 0.55);
    backdrop-filter: blur(2px);
    pointer-events: all;
  }

  .render-loading__panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 18px 22px;
    border-radius: 12px;
    background: rgba(8, 14, 22, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.45);
    color: #dbe8ff;
    min-width: 180px;
  }

  .render-loading__spinner {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.18);
    border-top-color: #55bbff;
    animation: render-spin 0.8s linear infinite;
  }

  .render-loading__text {
    font-size: 13px;
    letter-spacing: 0.5px;
  }

  @keyframes render-spin {
    to {
      transform: rotate(360deg);
    }
  }
  .legend {
    position: absolute;
    padding: 20px;
    right: 2px;
    bottom: 40px;
    z-index: 1;
    text-align: left;
  }
  .situation-panel {
    position: absolute;
    top: 5px;
    left: 5px;
    width: 660px;
    max-height: calc(100% - 56px);
    z-index: 998;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 5px;
    box-sizing: border-box;
    border: 1px solid rgba(66, 143, 220, 0.22);
    border-radius: 10px;
    background: linear-gradient(180deg, rgba(8, 14, 22, 0.94) 0%, rgba(8, 17, 30, 0.84) 100%);
    box-shadow: 0 16px 30px rgba(0, 0, 0, 0.36);
    backdrop-filter: blur(4px);
    pointer-events: auto;

    .situation-panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px 4px;
      border-bottom: 1px solid rgba(79, 140, 220, 0.18);

      .situation-panel__title {
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 1px;
        color: #dbe8ff;
      }

      .situation-panel__subtitle {
        font-size: 12px;
        color: #7aa7ff;
      }
    }

    .situation-panel__content {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      overflow-y: auto;
      padding-right: 2px;
    }

    .camp-card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px;
      border-radius: 10px;
      background: rgba(15, 22, 33, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.06);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);

      &.is-red {
        .camp-card__header,
        .section-title {
          color: #ff7f7f;
        }

        .camp-card__badge {
          background: rgba(255, 77, 79, 0.18);
          color: #ffb0b0;
        }

        .camp-stats__value,
        .weapon-row__value,
        .tag-item strong {
          color: #ffb0b0;
        }
      }

      &.is-blue {
        .camp-card__header,
        .section-title {
          color: #55bbff;
        }

        .camp-card__badge {
          background: rgba(42, 166, 255, 0.18);
          color: #b2dcff;
        }

        .camp-stats__value,
        .weapon-row__value,
        .tag-item strong {
          color: #b2dcff;
        }
      }
    }

    .camp-card__header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
    }

    .camp-card__name {
      flex: 1;
      text-align: left;
    }

    .camp-card__badge {
      min-width: 62px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      text-align: center;
    }

    .camp-card__summary {
      display: grid;
      grid-template-columns: 96px 1fr;
      gap: 10px;
      align-items: center;
      height: 150px;
      overflow: auto;
    }

    .camp-ring {
      width: 96px;
      height: 96px;
      border-radius: 50%;
      padding: 8px;
      box-sizing: border-box;
      display: grid;
      place-items: center;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;
    }

    .camp-ring__inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: rgba(8, 12, 18, 0.98);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-align: center;
      color: #fff;
    }

    .camp-ring__label {
      font-size: 12px;
      color: #c9d6e9;
    }

    .camp-ring__value {
      font-size: 22px;
      font-weight: 800;
      line-height: 1;
    }

    .camp-stats {
      display: grid;
      gap: 6px;
    }

    .camp-stats__item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      padding: 6px 8px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.03);
    }

    .camp-stats__label {
      color: #aeb6c2;
      font-size: 12px;
    }

    .camp-stats__value {
      font-size: 14px;
      font-weight: 700;
    }

    .camp-card__section,
    .mini-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 6px;
    }

    .section-title {
      position: relative;
      padding-left: 12px;
      font-size: 13px;
      font-weight: 700;
      text-align: left;
    }

    .chart-block {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .chart-box {
      width: 100%;
      min-height: 190px;
      height: 190px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.02);
    }

    .chart-box--pie {
      min-height: 205px;
      height: 205px;
    }

    .weapon-list {
      display: grid;
      gap: 6px;
      max-height: 160px;
      overflow: auto;
    }

    .weapon-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      border-left: 2px solid rgba(255, 255, 255, 0.12);
    }

    .weapon-row__name {
      color: #dfe7f3;
      font-size: 12px;
      line-height: 1.35;
    }

    .weapon-row__value {
      flex: 0 0 auto;
      font-size: 15px;
      font-weight: 800;
    }

    .camp-card__grid {
      display: grid;
      gap: 8px;
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .tag-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: #c6cfdb;
      font-size: 12px;

      strong {
        font-weight: 800;
      }
    }

    .empty-text {
      color: #7f8996;
      font-size: 12px;
      padding: 6px 2px;
    }
  }
  .our-scroll {
    position: absolute;
    right: 0;
    top: 0;
    height: 96%;
    z-index: 996;
    width: 400px;
    font-size: 14px;
    background: rgba($color: #000000, $alpha: 1);
    .legend-title {
      padding: 8px;
    }
    .satellite-details:first-of-type {
      margin: 0 8px 8px 8px;
    }
    .satellite-details {
      display: grid;
      grid-template-columns: 0.8fr 1fr;
      gap: 6px;
      margin: 8px; /* 每个 p 独立一行并有间距 */
      padding: 5px;
      width: 95%;
      box-sizing: border-box;
      justify-items: start;
      color: #ccc;
      background: var(--nav-bar-background);
      border-radius: 2px;
      cursor: pointer;
      > * {
        // 每个 grid-item
        min-width: 0; // 1. 允许收缩
        overflow-wrap: break-word; /* 2. 超长单词换行 */
        align-self: start; // 3. 内容不足时靠上对齐
        text-align: left; // 4. 左对齐（默认，可省） */
      }

      .full-row {
        grid-column: 1 / -1; /* 从第 1 列开始，到最后一列结束 */
        display: flex;
        strong {
          min-width: 150px;
        }
      }
      .sat-name {
        font-size: 18px;
      }
      .score-row {
        grid-column: 1/-1;
        display: flex;
        flex-direction: column;
        .mark-label {
          color: cyan;
        }
        .score {
          color: yellow;
          font-size: 16px;
          font-weight: bold;
        }
      }
    }
  }
  .toolbox {
    padding: 0 5px;
    z-index: 1;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 5px;
    width: 100%;
    flex-wrap: wrap;
  }
  .constellation-toolbar {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 998;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(4, 18, 30, 0.76);
    backdrop-filter: blur(8px);
    .constellation-toolbar__badge {
      color: #d8efff;
      font-size: 12px;
      white-space: nowrap;
    }
  }
  .timeline-panel {
    background: rgba($color: #000000, $alpha: 0.8);
    z-index: 1;
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translate(-50%, 0);
    padding: 10px;
    border-radius: 5px;
    .timeline-controls {
      display: flex;
      gap: 2px;
      justify-content: center;
    }
  }
  .speed-panel {
    display: none;
  }
  .sat-panel {
    position: absolute;
    top: 40px;
    left: 10px;
    background: rgba(19, 19, 19, 0.9);
    padding: 12px;
    border-radius: 4px;
    font-size: 14px;
    pointer-events: auto;
    z-index: 999;
    width: 320px;
    .close-btn {
      float: right;
      cursor: pointer;
      margin-left: 8px;
    }
    .sat-Content {
      padding: 10px;
      & > div {
        text-align: left;
        color: #dfdfdf;
        padding: 2px;
      }
      & > div:first-child {
        display: flex;
        justify-content: space-between;
      }
      .desc {
        font-size: 12px;
        line-height: 20px;
      }
    }
  }
}
</style>
