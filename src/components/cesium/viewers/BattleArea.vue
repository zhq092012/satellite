<template>
  <div ref="cesiumContainer" class="cesium-container">
    <div ref="creditEl" class="credit"></div>
    <div class="tool-bar">
      <el-button type="primary" round size="small" icon="Plus" @click="drawStart">开始创建区域</el-button>
      <el-button type="danger" round size="small" icon="Delete" @click="clearAll">清除区域</el-button>
      <span style="padding-left: 10px; color: red; font-weight: bold">
        ① 点击开始创建区域按钮,依次点击鼠标左键，需要完成创建时点击鼠标右键。②点击清除区域将会清除已经创建的区域。
        ③至少应该选择三个坐标点</span
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import { DrawClosedPolygon } from '@/utils/cesium/cesiumPolygon'
let viewer: Cesium.Viewer
const cesiumContainer = ref<HTMLElement | null>()
const creditEl = ref<HTMLElement | null>()
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL
let draw: DrawClosedPolygon
const initViewer = () => {
  if (viewer) return
  if (cesiumContainer.value) {
    // 创建 Cesium Viewer 实例并禁用不需要的默认控件
    viewer = new Cesium.Viewer(cesiumContainer.value, {
      scene3DOnly: false, // 启用 3D/2D 切换（这里允许 3D 模式）
      geocoder: false, // 关闭位置搜索控件
      homeButton: false, // 关闭回到默认视角按钮
      sceneModePicker: false, // 关闭视图模式切换器
      navigationHelpButton: false, // 关闭帮助按钮
      animation: false, // 关闭默认动画控件
      timeline: false, // 关闭默认时间轴控件（我们使用自定义时间轴）
      creditContainer: creditEl.value || undefined, // 使用组件内的 credit 容器，避免多个实例使用相同 id
      fullscreenButton: false, // 关闭全屏按钮
      baseLayerPicker: false, // 关闭底图选择器
      baseLayer: false, // 不使用默认底图
      infoBox: false, // 关掉默认 InfoBox
      selectionIndicator: false, // 绿色选中框消失
    })

    // 添加切片影像图层（自定义瓦片服务器）
    viewer.imageryLayers.addImageryProvider(
      new Cesium.UrlTemplateImageryProvider({
        url: `${MATERIAL_URL}/{z}/{x}/{y}.png`, // 瓦片 URL 模板
        credit: 'credit', // 版权信息
      })
    )
    // 设置相机
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(104.0, 35.0, 5000000), // 经度、纬度、高度（单位：米）
      orientation: {
        heading: 0.0, // 方向
        pitch: -Cesium.Math.PI_OVER_TWO, // 俯仰角
        roll: 0.0, // 横滚角
      },
    })

    // 点选创建多边形
    draw = new DrawClosedPolygon(viewer, { fillColor: Cesium.Color.RED.withAlpha(0.3) })
  }
}
function drawStart() {
  draw && draw.start()
}
function clearAll() {
  draw && draw._clear()
  viewer.entities.removeAll()
}
defineExpose({
  clearAll,
})
onMounted(() => {
  initViewer()
})
</script>
<style lang="scss" scoped>
.cesium-container {
  height: 600px;
  position: relative;
  .credit {
    display: none;
  }
  .tool-bar {
    width: 100%;
    padding: 5px;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    z-index: 996;
    height: 30px;
    background: rgba($color: #000000, $alpha: 0.5);
  }
}
</style>
