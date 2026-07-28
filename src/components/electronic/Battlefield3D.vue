<template>
  <div class="battlefield-3d-wrapper">
    <div ref="container" class="battlefield-3d-canvas"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue'
import ForceGraph3D from '3d-force-graph'
import type { ForceGraph3DInstance } from '3d-force-graph'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import SpriteText from 'three-spritetext'
import type { GraphLink } from '@/types/electronic'

const props = defineProps<{
  nodes: any[]
  links: any[]
  /** 高亮展示的节点 ID 集合 (例: 全链路路径 [Sat_ID, Station_ID, Cmd_ID]) */
  highlightNodeIds?: string[]
  /** 高亮展示的连线 ID 集合 */
  highlightLinkIds?: string[]
  battleAreaPolygon?: { x: number; y: number }[]
}>()

const emit = defineEmits<{
  (e: 'select-node', id: string, type: 'ASSET' | 'WEAPON'): void
}>()

const container = ref<HTMLDivElement | null>(null)
let Graph: ForceGraph3DInstance | null = null
let resizeObserver: ResizeObserver | null = null
let battleAreaGroup: THREE.Group | null = null

/**
 * 精确判定连线是否属于全链路中相邻节点构成的传输通路
 */
const isLinkHighlighted = (link: any): boolean => {
  if (!props.highlightNodeIds || props.highlightNodeIds.length < 2) return false
  const sId = typeof link.source === 'object' ? link.source.id : link.source
  const tId = typeof link.target === 'object' ? link.target.id : link.target
  if (!sId || !tId) return false

  const nodes = props.highlightNodeIds
  for (let i = 0; i < nodes.length - 1; i++) {
    if ((nodes[i] === sId && nodes[i + 1] === tId) || (nodes[i] === tId && nodes[i + 1] === sId)) {
      return true
    }
  }

  if (props.highlightLinkIds && props.highlightLinkIds.length > 0) {
    return props.highlightLinkIds.some((id) => id === `${sId}::${tId}` || id === `${tId}::${sId}` || id === link.id)
  }
  return false
}
/**
 * 构造与处理 3D 拓扑渲染的连线数据集 (支持全链路补全与无关/交战红线隐藏)
 */
const getProcessedLinks = () => {
  const isHighlightMode = props.highlightNodeIds && props.highlightNodeIds.length >= 2
  let baseLinks = JSON.parse(JSON.stringify(props.links || []))

  if (isHighlightMode) {
    // 1. 自动补全全链路路径中可能因推演时刻错开而未查出的单跳连线 (例如 Sat -> Station)
    const nodes = props.highlightNodeIds!
    for (let i = 0; i < nodes.length - 1; i++) {
      const sId = nodes[i]
      const tId = nodes[i + 1]

      const exists = baseLinks.some((l: any) => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source
        const targetId = typeof l.target === 'object' ? l.target.id : l.target
        return (sourceId === sId && targetId === tId) || (sourceId === tId && targetId === sId)
      })

      if (!exists) {
        baseLinks.push({
          id: `fullchain-link-${sId}::${tId}`,
          source: sId,
          target: tId,
          link_status: 'TRANSMITTING',
          window_start: 0,
          window_end: 9999999999,
          routing_converge_delay: 30,
        })
      }
    }

    // 2. 计时结束全链路展示时，隐藏所有武器打击交战红线 (ENGAGEMENT) 以及无关受干扰线路
    baseLinks = baseLinks.filter((l: any) => {
      if (l.link_status === 'ENGAGEMENT') return false
      return isLinkHighlighted(l)
    })
  }

  return baseLinks
}
/**
 * 在平面映射战场区域
 * @param scene THREE场景
 * @param points 战区多边形坐标
 */
function drawBattleAreaPolygons(scene: THREE.Scene, points?: { x: number; y: number }[]) {
  if (battleAreaGroup) {
    scene.remove(battleAreaGroup)
    battleAreaGroup = null
  }
  if (!points || points.length < 3) return

  battleAreaGroup = new THREE.Group()

  // 第二层 (z: 0, 链路层/地面接收站) 与 第三层 (z: -150, 终端层/指挥中心)
  const targetLayersZ = [0, -150]

  targetLayersZ.forEach((layerZ) => {
    // 1. 半透明战区多边形填充面
    const shape = new THREE.Shape()
    points.forEach((pt, i) => {
      if (i === 0) shape.moveTo(pt.x, pt.y)
      else shape.lineTo(pt.x, pt.y)
    })
    shape.closePath()

    const shapeGeo = new THREE.ShapeGeometry(shape)
    const shapeMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const shapeMesh = new THREE.Mesh(shapeGeo, shapeMat)
    shapeMesh.position.z = layerZ
    battleAreaGroup!.add(shapeMesh)

    // 2. 红色高亮警示边界闭合线
    const linePoints = points.map((pt) => new THREE.Vector3(pt.x, pt.y, layerZ))
    linePoints.push(new THREE.Vector3(points[0].x, points[0].y, layerZ))
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.85,
    })
    const lineMesh = new THREE.Line(lineGeo, lineMat)
    battleAreaGroup!.add(lineMesh)

    // 3. 多边形顶点 3D 说明标牌
    const layerTag = layerZ === 0 ? '第二层:链路层' : '第三层:终端层'
    const label = new SpriteText(`✦ 战场管控区域 [${layerTag}]`)
    label.color = '#ffaa00'
    label.textHeight = 6.5
    label.backgroundColor = 'rgba(24, 12, 0, 0.85)'
    label.borderColor = '#ffaa00'
    label.borderWidth = 0.8
    label.borderRadius = 3
    label.padding = [2, 5]
    label.position.set(points[0].x, points[0].y, layerZ + 5)
    battleAreaGroup!.add(label)
  })

  scene.add(battleAreaGroup)
}

onMounted(() => {
  if (!container.value) return

  // 临时修改默认向上向量为 Z 轴，确保内部相机和 OrbitControls 的 Up 轴一致，防止旋转冲突锁死
  const originalDefaultUp = THREE.Object3D.DEFAULT_UP.clone()
  THREE.Object3D.DEFAULT_UP.set(0, 0, 1)

  Graph = new ForceGraph3D(container.value, { controlType: 'orbit' })
    .graphData({
      nodes: JSON.parse(JSON.stringify(props.nodes)),
      links: getProcessedLinks(),
    })
    .backgroundColor('rgba(8, 12, 22, 0.0)')
    .showNavInfo(false)
    .linkLabel((link: any) => link.delayLabel || '')
    .nodeLabel(() => '') // We use SpriteText instead of native tooltip for always-on labels
    .linkColor((link: any) => {
      if (isLinkHighlighted(link)) return 'rgba(255, 204, 0, 0.95)' // 亮金流光色
      const l = link as GraphLink
      if (l.link_status === 'TRANSMITTING') return 'rgba(0, 102, 255, 0.6)'
      if (l.link_status === 'JAMMED') return 'rgba(156, 163, 175, 0.65)'
      if (l.link_status === 'DESTROYED') return 'rgba(107, 114, 128, 0.35)'
      if (l.link_status === 'ENGAGEMENT') return 'rgba(255, 42, 95, 0.85)'
      return 'rgba(107, 114, 128, 0.25)'
    })
    .linkWidth((link: any) => {
      if (isLinkHighlighted(link)) return 2.0 // 统一适中线条宽度，不再额外加粗
      const l = link as GraphLink
      if (l.link_status === 'TRANSMITTING') return 2.0
      if (l.link_status === 'JAMMED') return 1.5
      if (l.link_status === 'DESTROYED') return 0.8
      if (l.link_status === 'ENGAGEMENT') return 2.5
      return 0.5
    })
    .linkMaterial((link: any) => {
      if (isLinkHighlighted(link)) {
        return new THREE.LineBasicMaterial({
          color: 0xffea00,
          transparent: true,
          opacity: 0.9,
        })
      }
      const l = link as GraphLink
      if (l.link_status === 'JAMMED') {
        return new THREE.LineDashedMaterial({
          color: 0x9ca3af,
          dashSize: 5,
          gapSize: 3,
          transparent: true,
          opacity: 0.7,
        })
      } else if (l.link_status === 'DESTROYED') {
        return new THREE.LineDashedMaterial({
          color: 0x6b7280,
          dashSize: 3,
          gapSize: 4,
          transparent: true,
          opacity: 0.4,
        })
      } else if (l.link_status === 'ENGAGEMENT') {
        return new THREE.LineBasicMaterial({
          color: 0xff2a5f,
          transparent: true,
          opacity: 0.9,
        })
      }
      return false // Use default material
    })
    .linkThreeObjectExtend(true)
    .linkThreeObject((link: any) => {
      if (link.link_status === 'JAMMED') {
        const sprite = new SpriteText('✕')
        sprite.color = '#9ca3af'
        sprite.textHeight = 4.0
        sprite.backgroundColor = 'rgba(17, 24, 39, 0.75)'
        sprite.borderColor = '#6b7280'
        sprite.borderWidth = 0.5
        sprite.borderRadius = 3
        sprite.padding = 1.2
        return sprite
      } else if (link.link_status === 'DESTROYED') {
        const sprite = new SpriteText('✕')
        sprite.color = '#6b7280'
        sprite.textHeight = 3.2
        sprite.backgroundColor = 'rgba(17, 24, 39, 0.5)'
        sprite.borderRadius = 2
        sprite.padding = 1
        return sprite
      }
      return undefined as any
    })
    .linkPositionUpdate((sprite: any, { start, end }: any) => {
      if (sprite) {
        Object.assign(sprite.position, {
          x: start.x + (end.x - start.x) / 2,
          y: start.y + (end.y - start.y) / 2,
          z: start.z + (end.z - start.z) / 2,
        })
      }
    })
    .linkDirectionalParticles((link: any) => {
      if (isLinkHighlighted(link)) return 5
      const l = link as GraphLink
      if (l.link_status === 'TRANSMITTING') return 3
      if (l.link_status === 'JAMMED') return 1
      if (l.link_status === 'ENGAGEMENT') return 4
      return 0
    })
    .linkDirectionalParticleColor((link: any) => {
      if (isLinkHighlighted(link)) return '#ffffff' // 高亮白色炫光核心粒子
      const l = link as GraphLink
      if (l.link_status === 'TRANSMITTING') return '#00e1ff'
      if (l.link_status === 'JAMMED') return '#9ca3af'
      if (l.link_status === 'ENGAGEMENT') return '#ff2a5f'
      return '#2d3748'
    })
    .linkDirectionalParticleWidth((link: any) => {
      if (isLinkHighlighted(link)) return 2.5
      return 2.5
    })
    .linkDirectionalParticleSpeed((link: any) => {
      if (isLinkHighlighted(link)) return 0.018
      const l = link as GraphLink
      if (l.link_status === 'JAMMED') return 0.003
      if (l.link_status === 'ENGAGEMENT') return 0.016
      return 0.012
    })
    .onNodeClick((node: any) => {
      const type = node.id.startsWith('weapon-') ? 'WEAPON' : 'ASSET'
      emit('select-node', node.id, type)
    })

  // 恢复默认的向上向量为 Y 轴，避免污染其他组件
  THREE.Object3D.DEFAULT_UP.copy(originalDefaultUp)

  // Force Directed Layout & Bounding Box
  Graph!.onEngineTick(() => {
    if (!Graph) return
    const data = Graph.graphData()
    if (!data || !data.nodes) return
    data.nodes.forEach((node: any) => {
      if (node.fz !== undefined && node.fz !== null) {
        node.z = node.fz
      }
      if (node.fx !== undefined && node.fx !== null) {
        node.x = node.fx
      }
      if (node.fy !== undefined && node.fy !== null) {
        node.y = node.fy
      }
    })
  })

  const scene = Graph!.scene()

  // 三层平面网格及其边缘名称标注
  const gridConfigs = [
    {
      name: '信号源',
      enName: 'SOURCE',
      z: 150,
      color: '#00e1ff',
      opacity: 0.18,
      desc: '近地卫星',
    },
    {
      name: '链路层',
      enName: 'LINK LAYER',
      z: 0,
      color: '#10b981',
      opacity: 0.18,
      desc: '雷达接收站',
    },
    {
      name: '终端层',
      enName: 'TERMINAL LAYER',
      z: -150,
      color: '#3b82f6',
      opacity: 0.22,
      desc: '指挥中心',
    },
  ]

  const planeHalfSize = 250

  gridConfigs.forEach((config) => {
    // 1. 三层网格平面
    const grid = new THREE.GridHelper(planeHalfSize * 2, 30, config.color, config.color)
    grid.position.z = config.z
    grid.rotation.x = Math.PI / 2

    const mat = grid.material as any
    mat.transparent = true
    mat.opacity = config.opacity
    mat.depthWrite = false

    scene.add(grid)

    // 2. 平面边缘高亮轮廓外框线 (Boundary Line Box)
    const borderPoints = [
      new THREE.Vector3(-planeHalfSize, -planeHalfSize, config.z),
      new THREE.Vector3(planeHalfSize, -planeHalfSize, config.z),
      new THREE.Vector3(planeHalfSize, planeHalfSize, config.z),
      new THREE.Vector3(-planeHalfSize, planeHalfSize, config.z),
      new THREE.Vector3(-planeHalfSize, -planeHalfSize, config.z),
    ]
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPoints)
    const borderMat = new THREE.LineBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.7,
    })
    const borderLine = new THREE.Line(borderGeo, borderMat)
    scene.add(borderLine)

    // 3. 在每层平面边缘添加 3D 名称标注标牌 (SpriteText)
    // 左前边缘标注标牌 (-250, -250)
    const labelLeft = new SpriteText(
      // `✦ ${config.name} (${config.enName})\nZ: ${config.z > 0 ? '+' : ''}${config.z}m | ${config.desc}`
      `✦ ${config.name}`
    )
    labelLeft.color = config.color
    labelLeft.textHeight = 8.5
    labelLeft.backgroundColor = 'rgba(6, 12, 24, 0.88)'
    labelLeft.borderColor = config.color
    labelLeft.borderWidth = 1.0
    labelLeft.borderRadius = 4
    labelLeft.padding = [3, 6]
    labelLeft.position.set(-planeHalfSize - 15, -planeHalfSize - 15, config.z + 4)
    scene.add(labelLeft)

    // 右前边缘标注标牌 (250, -250)
    const labelRight = new SpriteText(`${config.desc}`)
    labelRight.color = config.color
    labelRight.textHeight = 7.0
    labelRight.backgroundColor = 'rgba(6, 12, 24, 0.82)'
    labelRight.borderColor = config.color
    labelRight.borderWidth = 0.8
    labelRight.borderRadius = 3
    labelRight.padding = [2, 5]
    labelRight.position.set(planeHalfSize + 15, -planeHalfSize - 15, config.z + 4)
    scene.add(labelRight)

    // 4. 四角垂直结构导轨线 (立体空间连接导轨)
    const corners = [
      { x: -planeHalfSize, y: -planeHalfSize },
      { x: planeHalfSize, y: -planeHalfSize },
      { x: planeHalfSize, y: planeHalfSize },
      { x: -planeHalfSize, y: planeHalfSize },
    ]
    corners.forEach((corner) => {
      if (config.z === -150) {
        const pillarGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(corner.x, corner.y, -150),
          new THREE.Vector3(corner.x, corner.y, 150),
        ])
        const pillarMat = new THREE.LineDashedMaterial({
          color: '#4b5563',
          dashSize: 8,
          gapSize: 6,
          transparent: true,
          opacity: 0.35,
        })
        const pillar = new THREE.Line(pillarGeo, pillarMat)
        pillar.computeLineDistances()
        scene.add(pillar)
      }
    })
  })

  // 绘制战场范围多边形在第二层 (z = 0) 和第三层 (z = -150)
  if (props.battleAreaPolygon) {
    drawBattleAreaPolygons(scene, props.battleAreaPolygon)
  }

  // Custom 3D Objects with Labels
  Graph!.nodeThreeObject((node: any) => {
    const isDestroyed =
      (node.anti_jam_level === 0 && node.base_priority === 0) || node.isDestroyed || node.link_status === 'DESTROYED'
    const isHighlighted = props.highlightNodeIds && props.highlightNodeIds.includes(node.id)
    let color = node.side === 'RED' ? '#ff2a5f' : '#00e1ff'
    if (isHighlighted) {
      color = '#ffcc00' // 金黄发光光色
    } else if (isDestroyed) {
      color = '#374151' // Destroyed goes dark
    }

    const material = new THREE.MeshLambertMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      emissive: isHighlighted ? 0xffaa00 : isDestroyed ? 0xff0000 : 0x000000,
      emissiveIntensity: isHighlighted ? 0.8 : isDestroyed ? 0.6 : 0,
    })

    const group = new THREE.Group()
    let mesh

    if (node.asset_class === 'SATELLITE') {
      const body = new THREE.Mesh(new THREE.SphereGeometry(isHighlighted ? 8 : 6, 12, 12), material)
      const wingMat = new THREE.MeshLambertMaterial({
        color: isHighlighted ? '#ffe066' : isDestroyed ? '#1f2937' : '#2d3748',
        transparent: true,
        opacity: 0.75,
      })
      const leftWing = new THREE.Mesh(new THREE.BoxGeometry(18, 3, 0.5), wingMat)
      body.add(leftWing)
      mesh = body
    } else if (node.asset_class === 'DRONE') {
      mesh = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 4), material)
      mesh.rotation.x = Math.PI / 2
    } else if (node.asset_class === 'STATION') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 8), material)
      mesh.rotation.x = Math.PI / 2
    } else if (node.asset_class === 'COMMAND_CENTER') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 8), material)
    } else if (node.asset_class === 'WEAPON' || node.id.startsWith('weapon-')) {
      mesh = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 4), material)
      mesh.rotation.x = -Math.PI / 2
    } else {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(5, 8, 8), material)
    }

    group.add(mesh)

    // SpriteText Label
    const usageStr = node.usage_type === 'MILITARY' ? '(军用)' : node.usage_type === 'CIVIL_COMMERCIAL' ? '(民用)' : ''
    const classStr = node.asset_class ? `[${node.asset_class}]` : ''
    const nameStr = node.name || node.id
    const highlightPrefix = isHighlighted ? '⚡[全链路关键节点] ' : ''
    const statusTag = isDestroyed ? ' [已摧毁]' : ''

    const label = new SpriteText(`${highlightPrefix}${nameStr}${statusTag}\n${classStr} ${usageStr}`)
    label.color = isHighlighted ? '#ffe066' : node.side === 'RED' ? '#ff87a3' : '#a5f3fc'
    label.textHeight = isHighlighted ? 4.5 : 3.5
    label.position.set(0, -12, 0)
    group.add(label)

    return group
  })

  const FIXED_VIEW_MODE = true
  const BEST_VIEW = {
    position: { x: -20.5, y: -814.25, z: 61.04 },
    target: { x: 0, y: 0, z: 0 },
  }

  const camera = Graph!.camera()
  const controls = Graph!.controls() as OrbitControls

  if (camera && controls) {
    camera.up.set(0, 0, 1)

    if (FIXED_VIEW_MODE) {
      controls.enableRotate = false
      controls.enablePan = false
      controls.enableZoom = true

      Graph.cameraPosition(BEST_VIEW.position, BEST_VIEW.target, 0)
    } else {
      controls.enablePan = true
      controls.enableRotate = true
      controls.enableZoom = true

      controls.minPolarAngle = Math.PI / 6
      controls.maxPolarAngle = Math.PI / 2.1

      controls.enableDamping = true
      controls.dampingFactor = 0.05

      Graph.cameraPosition(BEST_VIEW.position, BEST_VIEW.target, 1000)

      controls.addEventListener('change', () => {
        const polar = controls.getPolarAngle()
        const azimuthal = controls.getAzimuthalAngle()
        console.log(
          `[最佳视角调试器]\n` +
            `  - cameraPosition: { x: ${camera.position.x.toFixed(2)}, y: ${camera.position.y.toFixed(2)}, z: ${camera.position.z.toFixed(2)} }\n` +
            `  - target: { x: ${controls.target.x.toFixed(2)}, y: ${controls.target.y.toFixed(2)}, z: ${controls.target.z.toFixed(2)} }\n` +
            `  - 极角 (纬度 phi): ${((polar * 180) / Math.PI).toFixed(2)}° (${polar.toFixed(4)} rad)\n` +
            `  - 方位角 (经度 theta): ${((azimuthal * 180) / Math.PI).toFixed(2)}° (${azimuthal.toFixed(4)} rad)`
        )
      })
    }
    controls.update()
  }

  resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect
      if (Graph) {
        Graph.width(width)
        Graph.height(height)
      }
    }
  })
  resizeObserver.observe(container.value)
})

watch(
  () => [props.nodes, props.links],
  ([newNodes, newLinks]) => {
    if (Graph) {
      const clonedNodes = JSON.parse(JSON.stringify(newNodes))
      const clonedLinks = JSON.parse(JSON.stringify(newLinks))
      Graph.graphData({ nodes: clonedNodes, links: clonedLinks })
    }
  },
  { deep: true }
)

watch(
  () => props.battleAreaPolygon,
  (newPolygon) => {
    if (Graph) {
      drawBattleAreaPolygons(Graph.scene(), newPolygon)
    }
  },
  { deep: true }
)

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (Graph && container.value) {
    container.value.innerHTML = ''
    Graph = null
  }
})
</script>

<style scoped lang="scss">
.battlefield-3d-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;

  .battlefield-3d-canvas {
    outline: none;
    width: 100%;
    height: 100%;
    position: relative;
  }
}
</style>
