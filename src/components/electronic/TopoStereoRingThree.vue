<template>
  <div ref="hostRef" class="stereo-force-host" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ForceGraph3D from '3d-force-graph'
import type { ForceGraph3DInstance } from '3d-force-graph'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import SpriteText from 'three-spritetext'
import {
  buildForceGraphData,
  RING_STROKE_COLOR,
  type TopoForceLink,
  type TopoForceNode,
} from '@/utils/topoStarRing3D'
import { buildStarRingLegend, type TopoGraphEdge, type TopoGraphNode } from '@/utils/topoStarRingLayout'

const props = withDefaults(
  defineProps<{
    nodes: TopoGraphNode[]
    edges: TopoGraphEdge[]
    isComm?: boolean
    positionLabels?: string[]
    selectedNodeId?: string | null
    selectedLinkId?: string | null
    selectedReceiveId?: string | null
    selectedSatId?: string | null
    activeNodeIds?: Set<string>
  }>(),
  {
    isComm: false,
    positionLabels: () => [],
    selectedNodeId: null,
    selectedLinkId: null,
    selectedReceiveId: null,
    selectedSatId: null,
    activeNodeIds: () => new Set(),
  }
)

const emit = defineEmits<{
  (e: 'node-click', node: TopoGraphNode): void
  (e: 'edge-click', linkId: string): void
}>()

/** 画布宿主元素 */
const hostRef = ref<HTMLDivElement | null>(null)

/** 场景背景色，与设计稿的深海军蓝一致 */
const SCENE_BACKGROUND = '#13223c'

let graph: ForceGraph3DInstance<TopoForceNode, TopoForceLink> | null = null
let resizeObserver: ResizeObserver | null = null
/** 场景装饰组（环层圆环、地面圆盘、阵地标记），与 force-graph 管理的节点/链路分离 */
let decorGroup: THREE.Group | null = null
/** 上一次布局的基础半径，仅在尺度变化时重置相机，避免打断用户手动旋转 */
let lastBaseRadius = 0

/**
 * 生成径向渐变光斑贴图，用于节点外发光。
 * 相比 Bloom 全局泛光，Sprite 光斑可精确控制每个节点的光晕大小，不会糊成一片。
 * @returns 可复用的 Canvas 贴图
 */
const createGlowTexture = (): THREE.Texture => {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const half = size / 2
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.16, 'rgba(255,255,255,0.5)')
  gradient.addColorStop(0.42, 'rgba(255,255,255,0.12)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

/** 全局共享的光斑贴图 */
const glowTexture = createGlowTexture()

/**
 * 构建当前 props 对应的 force-graph 数据
 * @returns 节点、链路与环层装饰数据
 */
const buildGraphPayload = () =>
  buildForceGraphData(props.nodes, props.edges, props.isComm, {
    positionLabels: props.positionLabels,
    selectedNodeId: props.selectedNodeId,
    selectedLinkId: props.selectedLinkId,
    selectedReceiveId: props.selectedReceiveId,
    selectedSatId: props.selectedSatId,
    activeNodeIds: props.activeNodeIds,
  })

/**
 * 自定义节点渲染：小实心亮点 + 加色混合光斑，必要时附带文字标签
 * @param node force-graph 节点数据
 * @returns 用于渲染该节点的 Three.js 对象
 */
const buildNodeObject = (node: TopoForceNode): THREE.Object3D => {
  const group = new THREE.Group()
  const color = new THREE.Color(node.color)

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(node.coreRadius, 20, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: node.haloOpacity < 0.2 ? 0.35 : 1 })
  )
  group.add(core)

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      opacity: node.haloOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  halo.scale.setScalar(node.haloScale)
  group.add(halo)

  if (node.showLabel) {
    const label = new SpriteText(node.label)
    label.color = node.color
    label.textHeight = node.coreRadius * 2.4
    label.fontWeight = '600'
    label.position.set(0, node.coreRadius * 4.2, 0)
    group.add(label)
  }

  return group
}

/**
 * 重建场景装饰：细描边环层、地面阵地圆盘与阵地标记
 * @param scene Three.js 场景
 * @param payload 布局数据
 */
const rebuildSceneDecor = (scene: THREE.Scene, payload: ReturnType<typeof buildForceGraphData>) => {
  if (decorGroup) {
    scene.remove(decorGroup)
    decorGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
  }

  const { rings, positions, baseRadius, groundRadius } = payload
  decorGroup = new THREE.Group()

  /**
   * 生成一条水平圆环线
   * @param radius 半径
   * @param y 高度
   * @param color 颜色
   * @param opacity 不透明度
   * @param dashed 是否虚线
   */
  const addRingLine = (radius: number, y: number, color: string, opacity: number, dashed = false) => {
    const segments = 160
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2
      pts.push(new THREE.Vector3(radius * Math.cos(t), y, radius * Math.sin(t)))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts)
    const material = dashed
      ? new THREE.LineDashedMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity,
          dashSize: baseRadius * 0.03,
          gapSize: baseRadius * 0.022,
        })
      : new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity })
    const line = new THREE.Line(geometry, material)
    if (dashed) line.computeLineDistances()
    decorGroup!.add(line)
  }

  rings.forEach((ring) => {
    addRingLine(ring.radius, ring.y, ring.color, 0.55)
  })

  // 地面阵地圆盘：极淡填充 + 金色虚线描边
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(groundRadius, 72),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(RING_STROKE_COLOR.position),
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  )
  disc.rotation.x = -Math.PI / 2
  decorGroup.add(disc)
  addRingLine(groundRadius, 0, RING_STROKE_COLOR.position, 0.6, true)

  positions.forEach((pos) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius * 0.014, 16, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(RING_STROKE_COLOR.position) })
    )
    marker.position.copy(pos.position)
    decorGroup!.add(marker)

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color(RING_STROKE_COLOR.position),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    halo.scale.setScalar(baseRadius * 0.11)
    halo.position.copy(pos.position)
    decorGroup!.add(halo)

    const label = new SpriteText(pos.name)
    label.color = '#ffe08a'
    label.textHeight = baseRadius * 0.05
    label.fontWeight = '600'
    label.position.set(pos.position.x, pos.position.y + baseRadius * 0.055, pos.position.z)
    decorGroup!.add(label)
  })

  scene.add(decorGroup)
}

/**
 * 按布局尺度设置相机，取约 26° 俯角以呈现设计稿中的漏斗形透视
 * @param baseRadius 基础环半径
 * @param stackTopY 最外层高度
 * @param animate 是否使用过渡动画
 */
const focusCamera = (baseRadius: number, stackTopY: number, animate = false) => {
  if (!graph) return
  const distance = baseRadius * 2.5
  const elevation = THREE.MathUtils.degToRad(26)
  const centerY = stackTopY * 0.42
  const horizontal = distance * Math.cos(elevation)
  graph.cameraPosition(
    { x: horizontal * 0.42, y: centerY + distance * Math.sin(elevation), z: horizontal * 0.91 },
    { x: 0, y: centerY, z: 0 },
    animate ? 600 : 0
  )
}

/**
 * 初始化 3d-force-graph 实例
 */
const initGraph = () => {
  if (!hostRef.value) return
  const { clientWidth: w, clientHeight: h } = hostRef.value
  if (w <= 0 || h <= 0) return

  const payload = buildGraphPayload()

  graph = new ForceGraph3D(hostRef.value, {
    controlType: 'orbit',
    rendererConfig: { antialias: true, alpha: false, powerPreference: 'high-performance' },
  })
    .width(w)
    .height(h)
    .backgroundColor(SCENE_BACKGROUND)
    .showNavInfo(false)
    .graphData({ nodes: payload.nodes, links: payload.links })
    .nodeId('id')
    .nodeLabel((node) => node.label)
    .nodeThreeObject(buildNodeObject)
    .nodeThreeObjectExtend(false)
    .nodePositionUpdate((obj, { x, y, z }) => {
      obj.position.set(x, y, z)
      return true
    })
    .linkColor((link) => link.color)
    // 逐条链路的透明度写在 linkColor 的 alpha 里，这里保持 1 让其原样生效
    .linkOpacity(1)
    // 恒定 1px 细线，贴合设计稿的通透感；高亮靠颜色与粒子密度体现
    .linkWidth(0)
    .linkCurvature((link) => link.curvature)
    .linkCurveRotation(0.35)
    .linkDirectionalParticles((link) => link.particles)
    .linkDirectionalParticleSpeed((link) => link.particleSpeed)
    .linkDirectionalParticleWidth((link) => link.particleWidth)
    .linkDirectionalParticleColor((link) => link.particleColor)
    .linkDirectionalParticleResolution(6)
    .enableNodeDrag(false)
    // 环层坐标已固定，关闭全部力以免节点被拉向中心堆叠在一起
    .d3Force('charge', null)
    .d3Force('link', null)
    .d3Force('center', null)
    .warmupTicks(0)
    .cooldownTicks(0)
    .onNodeClick((node) => emit('node-click', node.topoNode))
    .onLinkClick((link) => {
      if (link.linkId) emit('edge-click', link.linkId)
    })

  const controls = graph.controls() as unknown as {
    enableDamping: boolean
    dampingFactor: number
    minDistance: number
    maxDistance: number
    maxPolarAngle: number
  }
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minDistance = payload.baseRadius * 0.9
  controls.maxDistance = payload.baseRadius * 8
  controls.maxPolarAngle = Math.PI * 0.49

  rebuildSceneDecor(graph.scene(), payload)
  focusCamera(payload.baseRadius, payload.stackTopY)
  lastBaseRadius = payload.baseRadius

  // 轻微泛光只负责提亮高光核心，光晕主要由 Sprite 光斑承担
  const composer = graph.postProcessingComposer()
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.9, 0.55))
}

/**
 * 刷新图数据与场景装饰
 */
const refreshGraph = () => {
  if (!graph || !hostRef.value) return
  const payload = buildGraphPayload()
  graph.graphData({ nodes: payload.nodes, links: payload.links })
  rebuildSceneDecor(graph.scene(), payload)
  if (Math.abs(payload.baseRadius - lastBaseRadius) > 0.5) {
    focusCamera(payload.baseRadius, payload.stackTopY, true)
    lastBaseRadius = payload.baseRadius
  }
}

/**
 * 同步画布尺寸
 */
const syncSize = () => {
  if (!graph || !hostRef.value) return
  const { clientWidth: w, clientHeight: h } = hostRef.value
  if (w <= 0 || h <= 0) return
  graph.width(w).height(h)
}

onMounted(() => {
  initGraph()
  if (hostRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      syncSize()
    })
    resizeObserver.observe(hostRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  graph?._destructor()
  graph = null
  decorGroup = null
})

watch(
  () => [
    props.nodes,
    props.edges,
    props.selectedNodeId,
    props.selectedLinkId,
    props.selectedReceiveId,
    props.selectedSatId,
    props.activeNodeIds,
    props.isComm,
    props.positionLabels,
  ],
  () => refreshGraph(),
  { deep: true }
)

defineExpose({ legendItems: () => buildStarRingLegend(props.isComm) })
</script>

<style lang="scss" scoped>
.stereo-force-host {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #13223c;

  :deep(canvas) {
    display: block;
    outline: none;
  }
}
</style>
