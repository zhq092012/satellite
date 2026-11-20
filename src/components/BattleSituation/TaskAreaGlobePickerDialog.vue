<template>
  <el-dialog v-model="dialogVisible" title="从地球选取任务区域" width="960px" align-center append-to-body destroy-on-close
    class="task-area-picker-dialog" @closed="handleDialogClosed">
    <div class="picker-form-row">
      <el-form inline label-width="88px">
        <el-form-item label="区域名称">
          <el-input v-model="areaName" maxlength="40" show-word-limit placeholder="如：作战区-A" style="width: 220px" />
        </el-form-item>
        <el-form-item label="几何类型">
          <el-radio-group v-model="drawMode" @change="handleDrawModeChange">
            <el-radio-button label="POLYGON">多边形</el-radio-button>
            <el-radio-button label="CIRCLE">圆形</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </div>

    <div ref="cesiumContainer" class="cesium-container">
      <div ref="creditEl" class="credit"></div>
      <div class="tool-bar">
        <el-button type="primary" round size="small" @click="startDraw">开始绘制</el-button>
        <el-button type="warning" round size="small" @click="stopDraw">停止绘制</el-button>
        <el-button type="danger" round size="small" @click="clearGlobe">清除图形</el-button>
        <span class="tool-hint">{{ drawHint }}</span>
      </div>
    </div>

    <div v-if="draftArea" class="picker-preview">
      <div class="picker-preview-title">预览（确认后写入任务）</div>
      <div class="picker-preview-body">
        <span>类型：{{ draftArea.type === 'POLYGON' ? '多边形' : '圆形' }}</span>
        <span v-if="draftArea.type === 'POLYGON'">顶点数：{{ draftArea.points.length }}</span>
        <span>中心：{{ draftArea.center.lng.toFixed(4) }}, {{ draftArea.center.lat.toFixed(4) }}</span>
        <span>半径：{{ draftArea.radius.toFixed(2) }} km</span>
      </div>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" :disabled="!draftArea" @click="confirmDraft">确认添加</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import * as Cesium from 'cesium'
import { ElMessage } from 'element-plus'
import type { TaskArea } from '@/types/task/task'
import { DrawClosedPolygon } from '@/utils/tools/drawTaskAreaPolygon'
import { DrawCircleByDrag } from '@/utils/tools/drawTaskAreaCircle'
import { buildTaskAreaFromCircle, buildTaskAreaFromPolygon } from '@/utils/taskAreaFromDraw'
import { setGlobeDrawCameraLocked } from '@/utils/tools/cameraTools'

/** 弹窗显隐 */
const props = defineProps<{
  modelValue: boolean
  /** 新区域临时 ID（由父组件分配） */
  tempAreaId: string | number
  /** 打开时默认区域名 */
  defaultName?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  /** 用户确认的区域 */
  confirm: [area: TaskArea]
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

/** 绘制模式 */
const drawMode = ref<'POLYGON' | 'CIRCLE'>('POLYGON')
const areaName = ref('')
const draftArea = ref<TaskArea | null>(null)

const cesiumContainer = ref<HTMLElement | null>(null)
const creditEl = ref<HTMLElement | null>(null)
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL

let viewer: Cesium.Viewer | null = null
let polygonDrawer: DrawClosedPolygon | null = null
let circleDrawer: DrawCircleByDrag | null = null

/**
 * 计算：当前绘制模式对应的操作提示。
 * 返回：说明文案字符串。
 * 作用：工具栏旁展示绘制方式。
 */
const drawHint = computed(() =>
  drawMode.value === 'POLYGON'
    ? '多边形：左键依次选点，右键闭合（至少 3 点）。'
    : '圆形：左键按下设圆心并拖动，松开结束。',
)

const initViewer = () => {
  if (viewer || !cesiumContainer.value) return

  viewer = new Cesium.Viewer(cesiumContainer.value, {
    scene3DOnly: false,
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
  })

  viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: `${MATERIAL_URL}/{z}/{x}/{y}.png`,
      credit: 'credit',
    }),
  )

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(104.0, 35.0, 5000000),
    orientation: {
      heading: 0.0,
      pitch: -Cesium.Math.PI_OVER_TWO,
      roll: 0.0,
    },
  })

  const resumeGlobeCamera = () => setCameraInteractive(true)

  polygonDrawer = new DrawClosedPolygon(viewer, {
    fillColor: Cesium.Color.RED.withAlpha(0.35),
    onDrawStopped: resumeGlobeCamera,
    onPolygonComplete: (points) => {
      const built = buildTaskAreaFromPolygon({
        id: props.tempAreaId,
        name: areaName.value.trim() || `区域${String(props.tempAreaId)}`,
        points,
      })
      if (!built) {
        ElMessage.warning('多边形无效，请至少选择三个点')
        return
      }
      draftArea.value = built
      ElMessage.success('多边形已生成，可点击确认添加')
    },
  })

  circleDrawer = new DrawCircleByDrag(viewer, {
    fillColor: Cesium.Color.CYAN.withAlpha(0.35),
    onDrawStopped: resumeGlobeCamera,
    onComplete: ({ centerLng, centerLat, radiusKm }) => {
      const built = buildTaskAreaFromCircle({
        id: props.tempAreaId,
        name: areaName.value.trim() || `区域${String(props.tempAreaId)}`,
        centerLng,
        centerLat,
        radiusKm,
      })
      if (!built) {
        ElMessage.warning('圆形无效，请重新绘制')
        return
      }
      draftArea.value = built
      ElMessage.success('圆形已生成，可点击确认添加')
    },
  })
}

const setCameraInteractive = (interactive: boolean) => {
  setGlobeDrawCameraLocked(viewer, !interactive)
}

const stopDraw = () => {
  polygonDrawer?.stop()
  circleDrawer?.stop()
}

const startDraw = () => {
  if (!viewer) return
  stopDraw()
  draftArea.value = null
  setCameraInteractive(false)
  if (drawMode.value === 'POLYGON') {
    polygonDrawer?.start()
    return
  }
  circleDrawer?.start()
}

const clearGlobe = () => {
  stopDraw()
  draftArea.value = null
  if (viewer && !viewer.isDestroyed()) {
    viewer.entities.removeAll()
  }
}

const handleDrawModeChange = () => {
  stopDraw()
}

const confirmDraft = () => {
  if (!draftArea.value) return
  const name = areaName.value.trim()
  const area: TaskArea = {
    ...draftArea.value,
    name: name || draftArea.value.name,
  }
  emit('confirm', area)
  dialogVisible.value = false
}

const handleDialogClosed = () => {
  stopDraw()
  setCameraInteractive(true)
  draftArea.value = null
  if (viewer && !viewer.isDestroyed()) {
    viewer.destroy()
    viewer = null
  }
  polygonDrawer = null
  circleDrawer = null
}

/**
 * 监听：弹窗打开。
 * 回调不返回清理函数。
 * 作用：初始化 Viewer 并恢复默认区域名。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    areaName.value = props.defaultName ?? ''
    draftArea.value = null
  },
)

/**
 * 监听：弹窗打开且在 DOM 中可见。
 * 回调不返回清理函数。
 * 作用：在容器挂载后创建 Cesium Viewer。
 */
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return
    await nextTick()
    initViewer()
  },
)

onBeforeUnmount(() => {
  handleDialogClosed()
})
</script>

<style lang="scss" scoped>
.cesium-container {
  height: 520px;
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 225, 255, 0.25);

  .credit {
    display: none;
  }

  .tool-bar {
    width: 100%;
    padding: 8px 10px;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 10;
    background: rgba(0, 0, 0, 0.55);
    flex-wrap: wrap;
  }

  .tool-hint {
    color: #fca5a5;
    font-size: 13px;
    line-height: 1.4;
  }
}

.picker-form-row {
  margin-bottom: 10px;
}

.picker-preview {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(8, 20, 36, 0.85);
  border: 1px solid rgba(0, 225, 255, 0.28);

  &-title {
    color: #7dd3fc;
    font-weight: 600;
    margin-bottom: 6px;
  }

  &-body {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    color: #e2efff;
    font-size: 14px;
  }
}
</style>