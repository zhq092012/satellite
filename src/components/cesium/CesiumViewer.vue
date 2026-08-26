<template>
  <div ref="cesiumContainer" class="cesium-container">
    <div ref="creditEl" class="credit"></div>
    <div v-if="satelliteRenderBusy" class="render-loading">
      <div class="render-loading__panel">
        <div class="render-loading__spinner"></div>
        <div class="render-loading__text">正在加载数据...</div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { getAllWeapons, getSatelliteDetail, getSatelliteTLEData, getTLEDataByTaskId } from '@/api/dashboard'
import type { MatrixResult } from '@/api/electronic'
import type { ChainNode, SatelliteTransmissionLink } from '@/utils/satelliteFullChainAnalysis'
import { useElectronicCesiumBridge, type InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'
import { useLayoutStore } from '@/store/modules/layout'
import type { SatelliteData, Weapon } from '@/types/dashboard'
import { markBattleArea } from '@/utils/tools/functionTool'
import * as Cesium from 'cesium'
import { CallbackProperty } from 'cesium'
import * as satellitejs from 'satellite.js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, useTemplateRef, watch } from 'vue'

// 全局布局状态管理 store
const store = useLayoutStore()

// 地图瓦片服务地址（来自环境变量）
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL
// Cesium 容器 DOM 引用
const cesiumContainer = useTemplateRef('cesiumContainer')
// Cesium credit 容器 DOM 引用（避免多个 Viewer 实例抢占同一 id）
const creditEl = ref<HTMLElement | null>(null)

/**
 * 组件 Props 定义
 */
const props = defineProps<{
  /** 算法矩阵数据（包含地面站、中继卫星、过境窗口与打压状态） */
  matrixData?: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

/** 向父组件通知时钟推进（用于轨道仿真时间轴游标） */
const emit = defineEmits<{
  (e: 'clock-tick', ms: number): void
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
    ; (viewer as any).resize?.()
  flushPendingInfrastructureRender()
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
        animation: false,
        timeline: false,
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

      // 禁止相机跑到地面以下
      viewer.scene.globe.depthTestAgainstTerrain = false

      initTaskClock()
      syncOrbitAnimationMode()

      // 绑定自定义的相机监听（用于显示相机位置/角度等）
      // listenCameraLocaion(viewer)
      // 监控鼠标点击事件
      handleViewerClickEvent()

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
  viewer.entities.removeAll()

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
/** 态势分析选中的传输链路边实体 ID 集合 */
const transmissionLinkEntityIds = new Set<string>()
/** 当前选中的传输链路包含的节点匹配 Key（用于高亮该链路上的天基/地面实体） */
const selectedTransmissionLinkNodeKeys = ref<Set<string>>(new Set())
/** 传输链路高亮线颜色：淡黄色虚线 */
const TRANSMISSION_LINK_LINE_COLOR = Cesium.Color.fromCssColorString('#F5E6A3').withAlpha(0.92)

const infraShapeImageCache = new Map<string, string>()

const getInfraShapeImage = (shape: 'triangle' | 'square'): string => {
  const cached = infraShapeImageCache.get(shape)
  if (cached) return cached

  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'

  if (shape === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(size / 2, 4)
    ctx.lineTo(size - 4, size - 4)
    ctx.lineTo(4, size - 4)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.rect(6, 6, size - 12, size - 12)
    ctx.fill()
    ctx.stroke()
  }

  const dataUrl = canvas.toDataURL('image/png')
  infraShapeImageCache.set(shape, dataUrl)
  return dataUrl
}

/**
 * 生成我方武器倒立三角形 Billboard 贴图（锥尖朝下）
 *
 * @returns 倒立三角形 PNG Data URL
 */
const getOurWeaponShapeImage = (): string => {
  const cacheKey = 'inverted-triangle'
  const cached = infraShapeImageCache.get(cacheKey)
  if (cached) return cached

  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(size / 2, size - 4)
  ctx.lineTo(4, 4)
  ctx.lineTo(size - 4, 4)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  const dataUrl = canvas.toDataURL('image/png')
  infraShapeImageCache.set(cacheKey, dataUrl)
  return dataUrl
}
/**
 * 判断地面基础设施节点是否被选中
 * @param node 地面基础设施节点
 * @returns boolean
 */
const isInfrastructureSelected = (node: InfrastructureLocation): boolean => {
  const selected = store.selectedInfrastructureNode
  return !!selected && selected.id === node.id && selected.type === node.type
}

// 电子信息战录 composable：解析地面站、中继卡号集和过境窗口判断工具
const { infrastructureNodes } = useElectronicCesiumBridge(toRef(props, 'matrixData'))
// Cesium 时钟 onTick 监听器的移除函数（组件销毁时必须调用）
let clockTickRemoveListener: Cesium.Event.RemoveCallback | null = null

/**
 * [功能]
 * 视角平滑直达敌方地面基础设施节点 (地面接收站 / 中心云数据中心) 上空
 *
 * @param node 选中的 InfrastructureLocation 对象
 */
const flyToInfrastructureNode = (node: InfrastructureLocation) => {
  if (!viewer || !node) return

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

  // 2. 适当抬高视角高度（从 300 km 提高至 2500 km / 2,500,000 米），俯视角 -50°，100% 居中瞄准地面站的同时能清晰兼顾并查看到周边其他地面站节点
  const offset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0), Cesium.Math.toRadians(-50), 2500000)

  viewer.camera.flyToBoundingSphere(boundingSphere, {
    duration: 1.5,
    offset,
  })
}

/**
 * 视角平滑定位到我方武器节点上空
 *
 * @param weapon 武器对象（含经纬度与射程）
 */
const flyToOurWeapon = (weapon: { id?: string; name: string; latitude: number; longitude: number; range?: number }) => {
  if (!viewer || !Number.isFinite(weapon.latitude) || !Number.isFinite(weapon.longitude)) return

  const weaponPos =
    findOurWeaponEntity(weapon)?.position?.getValue(Cesium.JulianDate.now()) ??
    Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 0)
  const boundingSphere = new Cesium.BoundingSphere(weaponPos, 0)
  const rangeKm = Math.max(10, Number(weapon.range ?? 500))
  const cameraHeight = Math.min(Math.max(rangeKm * 3000, 800000), 3000000)
  const offset = new Cesium.HeadingPitchRange(Cesium.Math.toRadians(0), Cesium.Math.toRadians(-50), cameraHeight)

  const entity = findOurWeaponEntity(weapon)

  if (entity) {
    viewer.flyTo(entity, {
      duration: 1.5,
      offset,
    })
  } else {
    viewer.camera.flyToBoundingSphere(boundingSphere, {
      duration: 1.5,
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

/**
 * [功能]
 * 清理上一任务或系列在 Cesium Viewer 中渲染的所有敌方电子信息网络 3D 实体（包含地面接收站、中心云数据中心及其地表波纹圆环、天基过境与中继卫星实体节点）
 */
const clearElectronicInfrastructureNodes = () => {
  if (!viewer || viewer.isDestroyed()) return

  clearTransmissionLinkOverlay()

  // 1. 根据保存的电子节点 Entity ID 集合逐个移除 Cesium 实体
  electronicNodeEntityIds.forEach((entityId) => {
    const entity = viewer.entities.getById(entityId)
    if (entity) {
      viewer.entities.remove(entity)
    }
  })
  electronicNodeEntityIds.clear()

  // 2. 兜底扫描并清理所有以 infra-node- 和 sat-node- 开头的残留 3D 实体节点
  const leftoverEntities = viewer.entities.values.filter((entity: Cesium.Entity) => {
    const idStr = String(entity.id ?? '')
    return idStr.startsWith('infra-node-') || idStr.startsWith('sat-node-')
  })
  leftoverEntities.forEach((entity) => {
    viewer.entities.remove(entity)
  })

  // 3. 同时重置卫星高亮状态
  resetHighlightSatellites()
}



/**
 * [功能]
 * 生成敌方卫星在 Cesium 地图上展示的统一中文标签文案
 *
 * @param noradId 卫星 NORAD 编号
 * @param fallbackName 矩阵数据缺失时的兜底名称
 * @returns 形如 `[敌方过境卫星]\nLEGION-1` 的标签文本
 */
const buildSatelliteLabelText = (noradId: number, fallbackName?: string) => {
  const matrixSats = props.matrixData?.initMatrixList || []
  const satInfo = matrixSats.find((s) => s.norad === noradId)
  const isRelay = noradId === 22314 || (satInfo?.satType || '').includes('中继')
  const name = satInfo?.name || fallbackName || `NORAD: ${noradId}`
  return `[敌方${isRelay ? '数据中继卫星' : '过境卫星'}]\n${name}`
}



/**
 * [功能]
 * 渲染敌方地面接收站、中心云数据中心与天基过境/中继卫星集群 3D 实体
 *
 * [处理规则]
 * - 渲染新矩阵前，务必先调用 clearElectronicInfrastructureNodes 彻底清空旧任务/旧系列的实体残留，防止跨任务/跨系列切换时残留节点叠加
 */
const renderElectronicInfrastructureNodes = () => {
  if (!viewer || viewer.isDestroyed()) return

  // 1. 每次重新渲染前，必须先彻底清理上一任务/系列的渲染残留
  clearElectronicInfrastructureNodes()

  // 2. 渲染敌方地面接收站与数据中心
  if (infrastructureNodes.value.length) {
    infrastructureNodes.value.forEach((node) => {
      const entityId = `infra-node-${node.type}-${node.id}`
      const position = Cesium.Cartesian3.fromDegrees(node.longitude, node.latitude, node.altitude)
      const isReceive = node.type === 'RECEIVE'
      const baseColor = isReceive ? Cesium.Color.CYAN : Cesium.Color.DODGERBLUE
      const highlightColor = Cesium.Color.YELLOW
      const labelText = `[敌方${isReceive ? '地面接收站' : '数据中心'}]\n${node.name}`
      const isNodeHighlighted = () => {
        if (isInfrastructureSelected(node)) return true
        const keys = selectedTransmissionLinkNodeKeys.value
        return (
          keys.has(`${node.type}-${node.id}`) ||
          keys.has(`${node.type}-${node.name}`) ||
          keys.has(String(node.id)) ||
          keys.has(node.name)
        )
      }
      const resolveColor = () => (isNodeHighlighted() ? highlightColor : baseColor)


      viewer.entities.add({
        id: entityId,
        position,
        billboard: {
          image: getInfraShapeImage(isReceive ? 'triangle' : 'square'),
          color: new Cesium.CallbackProperty(() => resolveColor(), false) as unknown as Cesium.Property,
          width: isReceive ? 22 : 20,
          height: isReceive ? 22 : 20,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: 0,
          heightReference: Cesium.HeightReference.NONE,
        },
        label: {
          text: labelText,
          font: 'bold 13px sans-serif',
          fillColor: new Cesium.CallbackProperty(() => resolveColor(), false) as unknown as Cesium.Property,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.3),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -28),
          heightReference: Cesium.HeightReference.NONE,
        },
      })
      electronicNodeEntityIds.add(entityId)
    })
  }

  // 3. 渲染敌方天基过境与中继卫星集群 3D 实体
  const matrixSats = props.matrixData?.initMatrixList || []
  matrixSats.forEach((sat) => {
    if (!sat || !sat.satType) return
    const satEntityId = `sat-node-${sat.norad}`

    const initialPos = getSatellitePositionInCesium(sat.norad)
    if (!initialPos) return

    const isRelay = sat.satType.includes('中继')
    const satColor = isRelay ? Cesium.Color.PURPLE : Cesium.Color.CYAN

    const resolveSatPosition = () => getSatellitePositionInCesium(sat.norad) || initialPos
    const isSatHighlighted = () => {
      const keys = selectedTransmissionLinkNodeKeys.value
      return (
        keys.has(`SAT-${sat.norad}`) ||
        keys.has(`RELAY-${sat.norad}`) ||
        keys.has(String(sat.norad)) ||
        keys.has(sat.name)
      )
    }
    const resolveSatPointColor = () => (isSatHighlighted() ? Cesium.Color.GOLD : satColor)
    const resolveSatOutlineColor = () =>
      isSatHighlighted() ? Cesium.Color.YELLOW : isRelay ? Cesium.Color.GOLD : Cesium.Color.WHITE
    const resolveSatOutlineWidth = () => (isSatHighlighted() ? 4 : 2.5)
    const resolveSatPixelSize = () => (isSatHighlighted() ? 18 : isRelay ? 16 : 13)
    const resolveSatLabelColor = () => (isSatHighlighted() ? Cesium.Color.YELLOW : satColor)

    viewer.entities.add({
      id: satEntityId,
      position: new Cesium.CallbackProperty(resolveSatPosition, false) as unknown as Cesium.PositionProperty,
      point: {
        pixelSize: new Cesium.CallbackProperty(resolveSatPixelSize, false) as unknown as Cesium.Property,
        color: new Cesium.CallbackProperty(resolveSatPointColor, false) as unknown as Cesium.Property,
        outlineColor: new Cesium.CallbackProperty(resolveSatOutlineColor, false) as unknown as Cesium.Property,
        outlineWidth: new Cesium.CallbackProperty(resolveSatOutlineWidth, false) as unknown as Cesium.Property,
        disableDepthTestDistance: 0,
      },
      label: {
        text: buildSatelliteLabelText(sat.norad, sat.name),
        font: 'bold 12px sans-serif',
        fillColor: new Cesium.CallbackProperty(resolveSatLabelColor, false) as unknown as Cesium.Property,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.3),
        pixelOffset: new Cesium.Cartesian2(0, -28),
      },
    })
    electronicNodeEntityIds.add(satEntityId)
  })

}

/**
 * 清除态势分析选中的传输链路连线及节点高亮。
 */
const clearTransmissionLinkOverlay = () => {
  selectedTransmissionLinkNodeKeys.value.clear()
  if (!viewer || viewer.isDestroyed()) return
  transmissionLinkEntityIds.forEach((entityId) => {
    const entity = viewer.entities.getById(entityId)
    if (entity) viewer.entities.remove(entity)
  })
  transmissionLinkEntityIds.clear()
}

/**
 * 解析传输链路节点在 Cesium 中的三维坐标。
 * @param node 链路节点
 * @returns 三维坐标，无法解析时返回 null
 */
const resolveChainNodePosition = (node: ChainNode, time?: Cesium.JulianDate): Cesium.Cartesian3 | null => {
  if (node.layer === 'SAT' || node.layer === 'RELAY') {
    const norad = Number(node.id)
    if (!Number.isFinite(norad)) return null
    return getSatellitePositionInCesium(norad, time)
  }

  if (node.layer === 'RECEIVE') {
    const matched = infrastructureNodes.value.find(
      (item) => item.type === 'RECEIVE' && (item.id === node.id || item.name === node.name)
    )
    if (matched) {
      return Cesium.Cartesian3.fromDegrees(matched.longitude, matched.latitude, matched.altitude)
    }
  }

  if (node.layer === 'STATION') {
    const matched = infrastructureNodes.value.find(
      (item) => item.type === 'STATION' && (item.id === node.id || item.name === node.name)
    )
    if (matched) {
      return Cesium.Cartesian3.fromDegrees(matched.longitude, matched.latitude, matched.altitude)
    }
  }

  return null
}

/**
 * 在地图上绘制选中传输链路的淡黄色虚线连接并高亮其沿途实体。
 * @param link 传输链路；传 null 时清除连线与高亮
 */
const showTransmissionLink = (link: SatelliteTransmissionLink | null) => {
  clearTransmissionLinkOverlay()
  if (!link || !viewer || viewer.isDestroyed()) return

  // 1. 记录链路节点标识，触发 CallbackProperty 高亮相应实体
  const nextKeys = new Set<string>()
  link.nodes.forEach((node) => {
    nextKeys.add(`${node.layer}-${node.id}`)
    nextKeys.add(`${node.layer}-${node.name}`)
    nextKeys.add(String(node.id))
    nextKeys.add(node.name)
    if (node.layer === 'RECEIVE' || node.layer === 'STATION') {
      const matched = infrastructureNodes.value.find(
        (item) => item.type === node.layer && (item.id === node.id || item.name === node.name)
      )
      if (matched) {
        nextKeys.add(`${matched.type}-${matched.id}`)
        nextKeys.add(`${matched.type}-${matched.name}`)
      }
    }
  })
  selectedTransmissionLinkNodeKeys.value = nextKeys

  // 2. 在地图上绘制虚线连接，卫星端点通过 CallbackProperty 随时间实时更新
  for (let i = 0; i < link.nodes.length - 1; i++) {
    const startNode = link.nodes[i]
    const endNode = link.nodes[i + 1]
    const initialStart = resolveChainNodePosition(startNode)
    const initialEnd = resolveChainNodePosition(endNode)
    if (!initialStart || !initialEnd) continue

    const entityId = `transmission-link-${link.id}-${i}`
    viewer.entities.add({
      id: entityId,
      polyline: {
        positions: new Cesium.CallbackProperty((time) => {
          const start = resolveChainNodePosition(startNode, time)
          const end = resolveChainNodePosition(endNode, time)
          return start && end ? [start, end] : []
        }, false),
        width: 3,
        material: new Cesium.PolylineDashMaterialProperty({
          color: TRANSMISSION_LINK_LINE_COLOR,
          dashLength: 18,
        }),
        arcType: Cesium.ArcType.GEODESIC,
      },
    })
    transmissionLinkEntityIds.add(entityId)
  }

}

// [变量用途]
// 保存通过 getAllWeapons 查询得到的全量我方武器数据。
const redWeaponDataList = ref<Weapon[]>([])

// [变量用途]
// 保存创建在 Cesium Viewer 中的我方武器实体引用列表。
const redWeaponEntities = shallowRef<Cesium.Entity[]>([])

/** 我方武器实体默认样式缓存（用于高亮后恢复） */
interface OurWeaponEntityStyle {
  /** Billboard 着色 */
  billboardColor: Cesium.Color
  /** 标签文字颜色 */
  labelFillColor: Cesium.Color
  /** 射程圈填充色 */
  ellipseMaterial: Cesium.Color
  /** 射程圈描边色 */
  ellipseOutlineColor: Cesium.Color
}

const ourWeaponStyleCache = new Map<string, OurWeaponEntityStyle>()
const OUR_WEAPON_HIGHLIGHT_COLOR = Cesium.Color.YELLOW
const OUR_WEAPON_DEFAULT_COLOR = Cesium.Color.fromCssColorString('#ef6b73')
const OUR_WEAPON_DEFAULT_LABEL_COLOR = Cesium.Color.fromCssColorString('#ff9e9e')
/** 与敌方地面站图标一致的 Billboard 尺寸（像素） */
const OUR_WEAPON_BILLBOARD_SIZE = 22
/** 武器标签最大可见距离（米），超过后不再显示 */
const OUR_WEAPON_LABEL_MAX_DISTANCE = 60000000

const updateOurWeaponsVisibility = (visible = true) => {
  redWeaponEntities.value.forEach((entity) => {
    entity.show = visible
  })
  viewer?.scene.requestRender()
}

/**
 * 兼容旧调用：我方武器图层始终显示，忽略关闭请求。
 * @param visible 是否显示我方武器（仅 true 生效）
 */
const handleOurWeaponsToggle = (visible: boolean | string | number) => {
  const show = Boolean(visible)
  if (!show) return
  store.setShowOurWeapons(true)
  updateOurWeaponsVisibility(true)
  if (store.selectedOurWeapon) {
    highlightOurWeaponOnMap(store.selectedOurWeapon)
  }
}

/**
 * 根据武器信息查找地图上对应的 Cesium 实体
 *
 * @param weapon 武器对象
 * @returns 匹配的 Entity 或 undefined
 */
const findOurWeaponEntity = (weapon: {
  id?: string
  name: string
  latitude: number
  longitude: number
}): Cesium.Entity | undefined => {
  if (!viewer) return undefined
  if (weapon.id) {
    const byId = viewer.entities.getById(`our-weapon-${weapon.id}`)
    if (byId) return byId
  }
  const byName = redWeaponEntities.value.find((entity) => entity.name === weapon.name)
  if (byName) return byName
  return redWeaponEntities.value.find((entity) => {
    const pos = entity.position?.getValue(Cesium.JulianDate.now())
    if (!pos) return false
    const carto = Cesium.Cartographic.fromCartesian(pos)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    return Math.abs(lat - weapon.latitude) < 0.02 && Math.abs(lon - weapon.longitude) < 0.02
  })
}

/**
 * 恢复所有我方武器实体至默认样式，并移除高亮环
 */
const resetOurWeaponHighlight = () => {
  if (!viewer || viewer.isDestroyed()) return

  redWeaponEntities.value.forEach((entity) => {
    const entityId = String(entity.id ?? '')
    const cached = ourWeaponStyleCache.get(entityId)
    if (!cached) return

    const highlightRing = viewer.entities.getById(`${entityId}-highlight-ring`)
    if (highlightRing) {
      viewer.entities.remove(highlightRing)
    }

    if (entity.billboard) {
      entity.billboard.color = new Cesium.ConstantProperty(cached.billboardColor)
    }
    if (entity.label) {
      entity.label.fillColor = new Cesium.ConstantProperty(cached.labelFillColor)
    }
    if (entity.ellipse) {
      entity.ellipse.material = new Cesium.ColorMaterialProperty(cached.ellipseMaterial)
      entity.ellipse.outlineColor = new Cesium.ConstantProperty(cached.ellipseOutlineColor)
    }
  })
}

/**
 * 将指定我方武器在地图上以黄色高亮显示
 *
 * @param weapon 武器对象
 */
const highlightOurWeaponOnMap = (weapon: {
  id?: string
  name: string
  latitude: number
  longitude: number
  range?: number
}) => {
  if (!viewer || viewer.isDestroyed()) return

  resetOurWeaponHighlight()

  const entity = findOurWeaponEntity(weapon)
  if (!entity) return

  const entityId = String(entity.id ?? '')
  const rangeMeters = Math.max(10000, Number(weapon.range ?? 0) * 1000)
  const ringRadius = Math.min(Math.max(rangeMeters * 0.08, 30000), 120000)

  if (entity.billboard) {
    entity.billboard.color = new Cesium.ConstantProperty(OUR_WEAPON_HIGHLIGHT_COLOR)
  }
  if (entity.label) {
    entity.label.fillColor = new Cesium.ConstantProperty(OUR_WEAPON_HIGHLIGHT_COLOR)
  }
  if (entity.ellipse) {
    entity.ellipse.material = new Cesium.ColorMaterialProperty(OUR_WEAPON_HIGHLIGHT_COLOR.withAlpha(0.22))
    entity.ellipse.outlineColor = new Cesium.ConstantProperty(OUR_WEAPON_HIGHLIGHT_COLOR)
  }

  viewer.entities.add({
    id: `${entityId}-highlight-ring`,
    position: entity.position,
    ellipse: {
      semiMajorAxis: ringRadius,
      semiMinorAxis: ringRadius,
      material: OUR_WEAPON_HIGHLIGHT_COLOR.withAlpha(0.35),
      outline: true,
      outlineColor: OUR_WEAPON_HIGHLIGHT_COLOR,
      outlineWidth: 3,
      height: 0,
    },
  })
}



/**
 * [功能]
 * 查询我方所有武器资源列表并将其绘制到 Cesium 地球球面上
 *
 * [数据来源]
 * 调用 getAllWeapons API 接口获取全量武器数据模型
 *
 * [处理规则]
 * - 使用倒立三角形 Billboard 标记武器部署位置，尺寸与敌方地面站图标一致
 * - 在实体上绑定 Label 与 Ellipse（武器作用半径/防线）
 * - 标签在相机距离过远时自动隐藏
 * - 我方武器图层始终显示
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
    const entityId = String(entity.id ?? '')
    const highlightRing = viewer?.entities.getById(`${entityId}-highlight-ring`)
    if (highlightRing) {
      viewer?.entities.remove(highlightRing)
    }
  })
  redWeaponEntities.value = []
  ourWeaponStyleCache.clear()

  const weapons = redWeaponDataList.value
  const newEntities: Cesium.Entity[] = []

  weapons.forEach((weapon, index) => {
    if (!Number.isFinite(weapon.longitude) || !Number.isFinite(weapon.latitude)) return

    const weaponId = `our-weapon-${weapon.id ?? index}`
    const position = Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 0)
    const weaponColor = OUR_WEAPON_DEFAULT_COLOR
    const rangeMeters = Math.max(10000, Number(weapon.range ?? 0) * 1000)

    const entity = viewer.entities.add({
      id: weaponId,
      name: weapon.name,
      position: new Cesium.ConstantPositionProperty(position),
      show: true,
      billboard: {
        image: getOurWeaponShapeImage(),
        color: weaponColor,
        width: OUR_WEAPON_BILLBOARD_SIZE,
        height: OUR_WEAPON_BILLBOARD_SIZE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: 0,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: `${weapon.name} (${weapon.type || '武器'})`,
        font: 'bold 13px sans-serif',
        fillColor: OUR_WEAPON_DEFAULT_LABEL_COLOR,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.3),
        pixelOffset: new Cesium.Cartesian2(0, -28),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, OUR_WEAPON_LABEL_MAX_DISTANCE),
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

    ourWeaponStyleCache.set(weaponId, {
      billboardColor: weaponColor,
      labelFillColor: OUR_WEAPON_DEFAULT_LABEL_COLOR,
      ellipseMaterial: OUR_WEAPON_DEFAULT_COLOR.withAlpha(0.1),
      ellipseOutlineColor: OUR_WEAPON_DEFAULT_COLOR.withAlpha(0.5),
    })
  })

  redWeaponEntities.value = newEntities
  updateOurWeaponsVisibility(true)
  if (store.selectedOurWeapon) {
    highlightOurWeaponOnMap(store.selectedOurWeapon)
  }
}

// [变量用途]
// 防重入防死循环集合：避免 CallbackProperty 计算 position 时触发递归调用导致栈溢出
const positionCalculatingSet = new Set<number>()

/**
 * [功能说明]
 * 根据 NORAD 唯一编号获取卫星在 Cesium 场景中的 3D 笛卡尔坐标 Cartesian3。
 *
 * [处理规则]
 * 1. 检查防重入集合，若当前 NORAD 已在计算栈中则直接返回 null，防止递归死循环。
 * 2. 优先从 satellitePointPrimitives 图元集合获取当前位置。
 * 3. 兜底通过 TLE 轨道根数（line1, line2）结合当前 Cesium 时钟时间使用 satellitejs 实时推算 3D 坐标。
 *
 * @param norad 卫星 NORAD 编号
 * @returns Cesium.Cartesian3 坐标对象或 null
 */
const getSatellitePositionInCesium = (
  norad: number,
  time?: Cesium.JulianDate
): Cesium.Cartesian3 | null => {
  if (!norad || positionCalculatingSet.has(norad)) {
    return null
  }

  positionCalculatingSet.add(norad)

  try {
    // 2. 尝试从 TLE 两行数据中推算当前时刻 3D 位置
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
          const now = time || viewer.clock.currentTime
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
        // ignore parse error
      }
    }
  } finally {
    positionCalculatingSet.delete(norad)
  }

  return null
}

let pendingInfrastructureRender = false

const flushPendingInfrastructureRender = () => {
  if (!pendingInfrastructureRender || !viewer || viewer.isDestroyed()) return
  if (!props.matrixData || !hasValidContainerSize(cesiumContainer.value || null)) return
  pendingInfrastructureRender = false
  renderElectronicInfrastructureNodes()
}

const scheduleInfrastructureRender = () => {
  if (!viewer || viewer.isDestroyed()) return
  if (!props.matrixData) {
    pendingInfrastructureRender = false
    clearElectronicInfrastructureNodes()
    return
  }
  if (!hasValidContainerSize(cesiumContainer.value || null)) {
    pendingInfrastructureRender = true
    return
  }
  pendingInfrastructureRender = false
  renderElectronicInfrastructureNodes()
}

/**
 * [功能]
 * 监听矩阵数据变化，触发 3D 电子信息网络与连线更新
 */
watch(
  () => props.matrixData,
  () => {
    scheduleInfrastructureRender()
  },
  { deep: true, immediate: true }
)

// 卫星渲染导忙状态，为 true 时显示 Loading 蒙层
const satelliteRenderBusy = ref(false)
// 渲染任务版本号，每次启动新渲染时自增，旧任务检测到 token 不匹配时主动中止
let satelliteRenderToken = 0
// 时间轴回放速度（倍速），默认 1.0 倍
const playbackSpeed = ref(1.0)
/** 未选中卫星时 TLE 轨道仿真的时钟倍速 */
const ORBIT_PLAYBACK_MULTIPLIER = 120

/**
 * 注册时钟 Tick 监听：动画模式下驱动 requestRender 并上报当前时刻
 */
const ensureClockTickListener = () => {
  if (!viewer || viewer.isDestroyed() || clockTickRemoveListener) return
  clockTickRemoveListener = viewer.clock.onTick.addEventListener((clock: Cesium.Clock) => {
    if (!viewer || viewer.isDestroyed()) return
    if (clock.shouldAnimate) {
      emit('clock-tick', Cesium.JulianDate.toDate(clock.currentTime).getTime())
    }
  })
}

/**
 * 根据是否选中卫星，切换轨道仿真动画 / 任务时间定格模式
 */
const syncOrbitAnimationMode = () => {
  if (!viewer || viewer.isDestroyed()) return
  ensureClockTickListener()
  if (props.selectedNorad) {
    viewer.clock.clockRange = Cesium.ClockRange.CLAMPED
    setClockPlaying(false)
    return
  }
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  setClockPlaying(true, ORBIT_PLAYBACK_MULTIPLIER)
}

/**
 * 获取当前 Cesium 时钟时刻（毫秒时间戳）
 * @returns 当前时钟毫秒值
 */
const getClockTimeMs = (): number => {
  if (!viewer || viewer.isDestroyed()) return 0
  return Cesium.JulianDate.toDate(viewer.clock.currentTime).getTime()
}

/**
 * 启动 TLE 轨道仿真（未选中卫星时由父组件调用）
 */
const startTleOrbitAnimation = () => {
  syncOrbitAnimationMode()
}

/**
 * 根据当前任务初始化 Cesium 时钟范围（不启用默认 UI 时间轴）
 */
const initTaskClock = () => {
  if (!viewer || viewer.isDestroyed() || !store.activedTask) return
  const beginTime = new Date(store.activedTask.beginDate.replace(/-/g, '/'))
  const endTime = new Date(store.activedTask.endDate.replace(/-/g, '/'))
  if (Number.isNaN(beginTime.getTime()) || Number.isNaN(endTime.getTime())) return

  const startTime = Cesium.JulianDate.fromDate(beginTime)
  const stopTime = Cesium.JulianDate.fromDate(endTime)
  viewer.clock.startTime = startTime.clone()
  viewer.clock.stopTime = stopTime.clone()
  viewer.clock.currentTime = startTime.clone()
  viewer.clock.clockRange = Cesium.ClockRange.CLAMPED
  viewer.clock.multiplier = playbackSpeed.value
  viewer.clock.shouldAnimate = false
}

/**
 * 设置 Cesium 时钟到指定时刻（毫秒时间戳）
 */
const setClockTime = (ms: number) => {
  if (!viewer || viewer.isDestroyed()) return
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(date)
}

/**
 * 控制 Cesium 时钟播放/暂停
 */
const setClockPlaying = (playing: boolean, multiplier?: number) => {
  if (!viewer || viewer.isDestroyed()) return
  const mult = multiplier ?? playbackSpeed.value ?? (props.selectedNorad ? 1 : ORBIT_PLAYBACK_MULTIPLIER)
  playbackSpeed.value = mult
  viewer.clock.multiplier = mult
  viewer.clock.shouldAnimate = playing

}

watch(
  () => [store.activedTask?.id, store.activedTask?.beginDate, store.activedTask?.endDate],
  () => {
    if (viewer && !viewer.isDestroyed()) {
      initTaskClock()
      syncOrbitAnimationMode()
    }
  }
)

let cameraMoveEndListener: Cesium.Event.RemoveCallback | null = null

/**
 *  监听鼠标左键点击事件并处理实体选择
 */
function handleViewerClickEvent() {
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  viewer.screenSpaceEventHandler.setInputAction(async function (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
    const picked = viewer.scene.pick(event.position)
    if (!Cesium.defined(picked)) {
      store.setSelectedSatellite(null) // 清空选择的卫星
      store.setSelectedInfrastructureNode(null) // 清空选中的地面基础设施节点
      resetHighlightSatellites() // 取消高亮
      markBattle() // 点击空白处，相机平滑复原到战场视角
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
    }

    const primitiveNorad = Number((pickedId as { norad?: number }).norad)
    const entityId = rawEntityId
    const noradMatch = entityId.match(/satellite-(\d+)/) || entityId.match(/sat-node-(\d+)/)
    const norad = Number.isFinite(primitiveNorad) ? primitiveNorad : noradMatch ? Number(noradMatch[1]) : null
    if (!Number.isFinite(norad)) return

    highlightSatellite({ norad_id: String(norad) })

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

  let tleData = satelliteTleCache.get(norad)
  if ((!tleData || !tleData.line1 || !tleData.line2) && satel?.line1 && satel?.line2) {
    tleData = { line1: satel.line1, line2: satel.line2 }
    satelliteTleCache.set(norad, tleData)
  }

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
/**
 * 根据任务Id查询所有过境卫星的tle数据，并在cesium视图上渲染
 * @param taskId
 * @param namespace
 */
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
  }

  if (!cachedSatelliteList) return
  const enemyCountrySet = computed(() => new Set(normalizeCountryList(store.activedTask?.enemyCountry)))
  // 过滤条件应用
  let satelliteList = cachedSatelliteList.filter((s) => enemyCountrySet.value.has(s.country))
  // 保存任务相关的所有卫星，网络安全使用
  store.saveTaskSatellite(satelliteList)
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

        point: {
          pixelSize: 8,
          color: Cesium.Color.BLUE,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.NONE,

        },
        label: {
          text: buildSatelliteLabelText(noradId, satel.name_en),
          font: 'bold 12px sans-serif',
          fillColor: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -28),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.45),
        },
        path: {
          show: false,
          leadTime: satel.orbit_type === 1 ? 90 * 60 : satel.orbit_type === 2 ? 12 * 3600 : 24 * 3600,
          trailTime: 0,
          width: 1,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.2,
            color: Cesium.Color.YELLOW,
          }),
        },
      })
      satelliteEntities.set(noradId, entity)
    }

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
 * 清除所有卫星的高亮样式与 3D 轨迹，将其点样式、边框颜色、边框宽度与标签颜色精准还原至加载时的初始状态
 */
const resetHighlightSatellites = () => {
  if (!viewer || viewer.isDestroyed()) return

  // 1. 移除发光轨迹线
  const trailEntity = viewer.entities.getById(HIGHLIGHT_TRAIL_ENTITY_ID)
  if (trailEntity) {
    viewer.entities.remove(trailEntity)
  }

  // 2. 复原 Entity 模式敌方卫星高亮样式（精准还原加载时的初始颜色、边框与大小）
  const satellites = viewer.entities.values.filter(
    (s: Cesium.Entity) => String(s.id ?? '').startsWith('satellite-') || String(s.id ?? '').startsWith('sat-node-')
  )
  if (satellites && satellites.length) {
    const matrixSats = props.matrixData?.initMatrixList || []

    satellites.forEach((entity: Cesium.Entity) => {
      const entityIdStr = String(entity.id ?? '')
      const noradMatch = entityIdStr.match(/satellite-(\d+)/) || entityIdStr.match(/sat-node-(\d+)/)
      const norad = noradMatch ? Number(noradMatch[1]) : null

      const satInfo = norad ? matrixSats.find((s) => s.norad === norad) : null
      const isRelay = norad === 22314 || (satInfo?.satType || '').includes('中继')

      const satColor = isRelay ? Cesium.Color.PURPLE : Cesium.Color.CYAN
      const outlineColor = isRelay ? Cesium.Color.GOLD : Cesium.Color.WHITE
      const pixelSize = isRelay ? 16 : 13
      const outlineWidth = 2.5

      if (entity && entity.point) {
        entity.point.color = new Cesium.ConstantProperty(satColor)
        entity.point.outlineColor = new Cesium.ConstantProperty(outlineColor)
        entity.point.outlineWidth = new Cesium.ConstantProperty(outlineWidth)
        entity.point.pixelSize = new Cesium.ConstantProperty(pixelSize)
      }

      if (entity && entity.label) {
        entity.label.fillColor = new Cesium.ConstantProperty(satColor)
        const isMatrixNode = entityIdStr.startsWith('sat-node-')
        const satNodeEnt = norad ? viewer.entities.getById(`sat-node-${norad}`) : null
        const fallbackName =
          satInfo?.name || cachedSatelliteList?.find((s) => Number(s.norad_id) === norad)?.name_en

        if (isMatrixNode && norad) {
          // 矩阵卫星节点是主标签载体，取消高亮后必须恢复显示
          entity.label.text = new Cesium.ConstantProperty(buildSatelliteLabelText(norad, fallbackName))
          entity.label.show = new Cesium.ConstantProperty(true)
        } else if (satNodeEnt) {
          // 同 NORAD 的 TLE 备用实体仅隐藏重复标签
          entity.label.show = new Cesium.ConstantProperty(false)
        } else if (norad) {
          entity.label.text = new Cesium.ConstantProperty(buildSatelliteLabelText(norad, fallbackName))
          entity.label.show = new Cesium.ConstantProperty(true)
        }
      }
    })
  }
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

  // 1. 查找对应的 3D Entity 节点，若不存在则直接返回
  const entityId = `sat-node-${norad}`
  const entity = viewer.entities.getById(entityId) || viewer.entities.getById(`satellite-${sate.norad_id}`)
  if (!entity) return

  // 避免重叠标签产生双重颜色重影：若 sat-node-${norad} 与 satellite-${norad} 同时存在，隐藏备用实体的标签
  const satNodeEnt = viewer.entities.getById(`sat-node-${norad}`)
  const satelliteEnt = viewer.entities.getById(`satellite-${sate.norad_id}`)
  if (satNodeEnt && satelliteEnt && satNodeEnt !== satelliteEnt) {
    if (satelliteEnt.label) {
      satelliteEnt.label.show = new Cesium.ConstantProperty(false)
    }
  }

  // 2. Entity 模式节点高亮
  viewer.selectedEntity = entity
  if (entity.point) {
    entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.YELLOW)
    entity.point.outlineWidth = new Cesium.ConstantProperty(4)
    entity.point.pixelSize = new Cesium.ConstantProperty(18)
    entity.point.color = new Cesium.ConstantProperty(Cesium.Color.GOLD)
  }


  // 针对矩阵卫星，确保解析轨道采样数据
  const satInfo = (props.matrixData?.initMatrixList || []).find((s) => s.norad === norad)
  if (satInfo) {
    const posProp = ensureOrbitData(norad, satInfo)
    if (posProp) {
      entity.position = posProp
    }
  }

  if (entity.path) {
    entity.path.show = new CallbackProperty(() => false, false)
  }

  // 3. 相机视角平滑飞赴定位至目标卫星
  viewer.flyTo(entity, {
    duration: 1.5,
  })
}



// 监听 selectedNorad 属性，联动更新时钟模式（相机飞赴由父组件在时间轴同步后触发）
watch(
  () => props.selectedNorad,
  (newNorad) => {
    if (!viewer || viewer.isDestroyed()) return
    syncOrbitAnimationMode()
    if (!newNorad) {
      resetHighlightSatellites()
    }
  },
  { immediate: true }
)

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
    store.setShowOurWeapons(true)
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

  clearElectronicInfrastructureNodes()
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
 * [功能]
 * 暂停时钟推演动画 (选中卫星后进入任务时间分析模式)
 */
const pauseClockAnimation = () => {
  setClockPlaying(false)
}

/**
 * 推进 Cesium 时钟至指定时间点
 */
const jumpToTimeAndPlay = (timeStr?: string) => {
  if (!viewer || viewer.isDestroyed()) return
  if (timeStr) {
    try {
      const date = new Date(timeStr.replace(/-/g, '/'))
      if (!isNaN(date.getTime())) {
        setClockTime(date.getTime())
      }
    } catch (err) {
      console.warn('时间跳转解析失败:', timeStr, err)
    }
  }
  setClockPlaying(true, playbackSpeed.value)
}

const refreshAfterActivate = () => {
  syncViewerRenderLoopWithContainer()
  if (props.matrixData) {
    pendingInfrastructureRender = false
    renderElectronicInfrastructureNodes()
  }
  viewer?.scene.requestRender()
}

defineExpose({
  clearViewer,
  clearElectronicInfrastructureNodes,
  renderSateliitePathWithEntity,
  markBattle,
  highlightSatellite,
  pauseClockAnimation,
  startTleOrbitAnimation,
  jumpToTimeAndPlay,
  initTaskClock,
  setClockTime,
  setClockPlaying,
  getClockTimeMs,
  refreshAfterActivate,
  setOurWeaponsVisible: (visible: boolean) => handleOurWeaponsToggle(visible),
  flyToOurWeapon,
  showTransmissionLink,
  clearTransmissionLinkOverlay,
})
</script>
<style lang="scss" scoped>
.cesium-container {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;

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
      margin: 8px;
      /* 每个 p 独立一行并有间距 */
      padding: 5px;
      width: 95%;
      box-sizing: border-box;
      justify-items: start;
      color: #ccc;
      background: var(--nav-bar-background);
      border-radius: 2px;
      cursor: pointer;

      >* {
        // 每个 grid-item
        min-width: 0; // 1. 允许收缩
        overflow-wrap: break-word;
        /* 2. 超长单词换行 */
        align-self: start; // 3. 内容不足时靠上对齐
        text-align: left; // 4. 左对齐（默认，可省） */
      }

      .full-row {
        grid-column: 1 / -1;
        /* 从第 1 列开始，到最后一列结束 */
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

      &>div {
        text-align: left;
        color: #dfdfdf;
        padding: 2px;
      }

      &>div:first-child {
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
