<template>
  <div ref="cesiumContainer" class="battle-globe-layer">
    <div ref="creditEl" class="credit"></div>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import { markBattleArea } from '@/utils/tools/functionTool'
import { useLayoutStore } from '@/store/modules/layout'
import { onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** 地图瓦片服务地址 */
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL

/** 全局布局 Store */
const store = useLayoutStore()

/** Cesium 容器 */
const cesiumContainer = ref<HTMLElement | null>(null)
/** Cesium 版权信息容器 */
const creditEl = ref<HTMLElement | null>(null)

/** Cesium Viewer 实例 */
let viewer: Cesium.Viewer | null = null
/** 容器尺寸监听 */
let resizeObserver: ResizeObserver | null = null
/** 初始化互斥锁 */
let viewerInitializing = false

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
  if (!viewer || viewer.isDestroyed() || !cesiumContainer.value) return
  const canRender = hasValidContainerSize(cesiumContainer.value)
  viewer.useDefaultRenderLoop = canRender
  if (canRender) {
    viewer.resize()
    viewer.scene.requestRender()
  }
}

/**
 * 飞到默认地球视角（无场景区域或区域无效时使用）。
 */
const flyToDefaultEarthView = () => {
  if (!viewer || viewer.isDestroyed()) return
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(120, 24, 18000000),
    duration: 1.2,
  })
}

/**
 * 移除场景名称标注实体。
 */
const clearBattleLabel = () => {
  if (!viewer || viewer.isDestroyed()) return
  const labelEntity = viewer.entities.getById('battle-area-label')
  if (labelEntity) {
    viewer.entities.remove(labelEntity)
  }
}

/**
 * 在场景区域中心添加名称标注。
 */
const renderBattleLabel = () => {
  if (!viewer || viewer.isDestroyed() || !store.battle?.name) return
  const center = store.battleCenterCartensian
  if (!center) return

  clearBattleLabel()
  viewer.entities.add({
    id: 'battle-area-label',
    position: center,
    label: {
      text: store.battle.name,
      font: '14px sans-serif',
      fillColor: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -12),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
}

/**
 * 根据当前场景绘制区域并调整视角。
 */
const renderBattleArea = () => {
  if (!viewer || viewer.isDestroyed()) return

  clearBattleLabel()

  if (store.battle) {
    markBattleArea(viewer, store.battle)
    if (store.battleCenterCartensian) {
      renderBattleLabel()
    } else {
      flyToDefaultEarthView()
    }
  } else {
    flyToDefaultEarthView()
  }

  viewer.scene.requestRender()
}

/**
 * 初始化 Cesium Viewer（仅地球底图 + 场景区域标记，不加载卫星业务）。
 */
const initViewer = async () => {
  if ((viewer && !viewer.isDestroyed()) || viewerInitializing || !cesiumContainer.value) return
  if (!hasValidContainerSize(cesiumContainer.value)) return

  viewerInitializing = true
  try {
    viewer = new Cesium.Viewer(cesiumContainer.value, {
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
    viewer.scene.globe.depthTestAgainstTerrain = false

    resizeObserver = new ResizeObserver(() => {
      syncViewerRenderLoop()
      if (!viewer && cesiumContainer.value && hasValidContainerSize(cesiumContainer.value)) {
        void initViewer()
      }
    })
    resizeObserver.observe(cesiumContainer.value)

    syncViewerRenderLoop()
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
  if (!viewer || viewer.isDestroyed()) {
    void initViewer()
    return
  }
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

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy()
  }
  viewer = null
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
