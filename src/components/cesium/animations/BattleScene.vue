<template>
  <div ref="container" class="battle-scene"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const phaseSequence = ['assemble', 'breach', 'assault', 'retreat'] as const
type PhaseName = (typeof phaseSequence)[number]

const props = defineProps<{ phase: string; speed?: number; durations?: Record<string, number> }>()
const emit = defineEmits<{
  (e: 'update:phase', phase: string): void
}>()

const container = ref<HTMLDivElement | null>(null)

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let frameId = 0
let _tick = 0
let controls: OrbitControls | null = null

// 士兵和飞机对象数组，以及士兵目标位置数组
const soldiers: THREE.Object3D[] = []
const planes: { mesh: THREE.Object3D; angle: number }[] = []
const soldierTargets: THREE.Vector3[] = []

// 动画混合器数组和士兵动画控制器数组，分别用于管理飞机和士兵的动画状态
let mixers: THREE.AnimationMixer[] = []

// 每个士兵的动画控制器包含当前动画混合器、可用动作列表和当前动作名称
const soldierControllers: Array<{
  mixer: THREE.AnimationMixer
  actions: Record<string, THREE.AnimationAction>
  currentActionName: string | null
}> = []

// 上一帧的时间戳，用于计算动画更新的时间增量
let lastFrameTime = 0

// 当前动画阶段的计时器和阶段名称
let phaseElapsed = 0

// 当前阶段名称，初始值为 props.phase 或 "assemble"
let currentPhase = (props.phase || 'assemble') as PhaseName

function makeSoldierPlaceholder() {
  const geo = new THREE.BoxGeometry(0.6, 1.6, 0.6)
  const mat = new THREE.MeshStandardMaterial({ color: 0x2b6cff })
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  return m
}

const planeCount = 6
const planeSpacing = 16
const planeZ = 0
const planeHeight = 16 // 飞机飞行高度
const soldierCount = 50
const soldierCols = 10
const soldierColSpacing = 8 // 士兵列间距
const soldierRowSpacing = 3.8 // 士兵行间距
const soldierStartZ = 0
/**
 * 计算一个物体应该旋转到什么角度才能面向目标方向
 * @param from 当前坐标
 * @param to 目标坐标
 * @returns 旋转角度（弧度）
 */
/**
 * 获取飞机应该旋转到什么角度才能面向前进方向
 * @param from 当前坐标
 * @param to 目标坐标
 * @returns 旋转角度（弧度）
 */
function getPlaneRotationY(from: THREE.Vector3, to: THREE.Vector3) {
  return Math.atan2(to.x - from.x, to.z - from.z)
}
/**
 * 获取一个物体应该旋转到什么角度才能面向摄像机
 * @param position 当前物体坐标
 * @returns 旋转角度（弧度）
 */
function getFaceCameraRotationY(position: THREE.Vector3) {
  return Math.atan2(camera.position.x - position.x, camera.position.z - position.z)
}
/**
 * 更新飞机在不同阶段的位置
 * @param phase 阶段名称
 * @param planeStartX 飞机初始位置的起始 X 坐标
 */
function updatePlanePhasePositions(phase: PhaseName, planeStartX: number) {
  if (phase === 'retreat') {
    return
  }

  planes.forEach((p, i) => {
    if (phase === 'assemble') {
      p.mesh.position.set(planeStartX + i * planeSpacing, planeHeight, planeZ)
      p.mesh.rotation.y = 0
      p.angle = (i / planeCount) * Math.PI * 2
      return
    }

    if (phase === 'breach') {
      p.mesh.position.set(planeStartX + i * planeSpacing, planeHeight, planeZ)
      p.mesh.rotation.y = 0
      p.angle = 0
      return
    }

    if (phase === 'assault') {
      const planeRadius = 20
      const angle = (i / planeCount) * Math.PI * 2
      p.angle = angle
      p.mesh.position.set(Math.cos(angle) * planeRadius, 11 + Math.sin(angle * 2) * 1.5, Math.sin(angle) * planeRadius)
      p.mesh.rotation.y = getPlaneRotationY(
        p.mesh.position,
        p.mesh.position.clone().add(new THREE.Vector3(-Math.sin(angle), 0, Math.cos(angle)))
      )
    }
  })
}

/**
 * 重置阶段状态，将士兵和飞机放置在当前阶段的初始位置
 * @param phase
 */
function setPhaseState(phase: PhaseName) {
  // 计算飞机初始位置的起始 X 坐标，使它们在 X 轴上居中分布
  const planeStartX = -((planeCount - 1) * planeSpacing) / 2
  // 集结阶段飞机排成一列在后方，士兵排成两行在前方
  if (phase === 'assemble') {
    soldiers.forEach((s, i) => {
      s.position.copy(getSoldierPhaseTarget(i, phase))
      s.rotation.y = Math.PI
    })

    updatePlanePhasePositions(phase, planeStartX)
    return
  }
  // 突破阶段飞机在前方不同位置盘旋，士兵排成一行在后方
  if (phase === 'breach') {
    soldiers.forEach((s, i) => {
      s.position.copy(getSoldierPhaseTarget(i, phase))
      s.rotation.y = Math.PI
    })

    updatePlanePhasePositions(phase, planeStartX)
    return
  }
  // 进攻阶段飞机分散在前方不同位置，士兵排成一列在后方
  if (phase === 'assault') {
    soldiers.forEach((s, i) => {
      s.position.copy(getSoldierPhaseTarget(i, phase))
      s.rotation.y = Math.PI
    })

    updatePlanePhasePositions(phase, planeStartX)
    return
  }
  // 撤退阶段飞机飞向远方，士兵分散在前方不同位置
  if (phase === 'retreat') {
    soldiers.forEach((s, i) => {
      s.position.copy(getSoldierPhaseTarget(i, phase))
      s.rotation.y = Math.PI
    })
  }
}

// 更新动画阶段
function setPhase(phase: PhaseName) {
  currentPhase = phase
  setPhaseState(phase)
  phaseElapsed = 0
  emit('update:phase', phase)
}
// 根据阶段和士兵索引计算士兵目标位置
function getSoldierPhaseTarget(i: number, phase: PhaseName) {
  // 集结
  if (phase === 'assemble') {
    const row = Math.floor(i / soldierCols) //当前士兵在第几行
    const col = i % soldierCols //当前士兵在当前行的列索引
    // 让士兵在集结阶段居中分布，列数为 soldierCols，行数根据总数自动计算
    // 把列索引平移到中心再缩放
    const x = (col - (soldierCols - 1) / 2) * soldierColSpacing
    const z = (1 + row) * soldierRowSpacing
    return new THREE.Vector3(x, 0.8, z)
  }
  // 突防阶段：根据总人数分成若干列，每列沿 XZ 平面的双曲线路线展开
  if (phase === 'breach') {
    const columns = soldierCols
    const groupIndex = i % columns
    const row = Math.floor(i / columns)
    const centerIndex = (columns - 1) / 2
    const baseX = (groupIndex - centerIndex) * 2.8
    const z = -2 + row * 2
    const curveSpread = Math.sqrt(z * z + 9) * 0.6
    const x = baseX + Math.sign(baseX) * curveSpread
    return new THREE.Vector3(x, 0.8, z)
  }
  // 进攻阶段：士兵由 10 列方阵排列，每列保持固定 X 位置
  if (phase === 'assault') {
    const row = Math.floor(i / soldierCols)
    const col = i % soldierCols
    const x = (col - (soldierCols - 1) / 2) * soldierColSpacing
    const z = (row - (Math.ceil(soldierCount / soldierCols) - 1) / 2) * soldierRowSpacing
    return new THREE.Vector3(x, 0.8, z)
  }
  // 撤退阶段：士兵分成10列，向Z轴负方向撤退，形成一个逐渐收缩的队形
  if (phase === 'retreat') {
    const row = Math.floor(i / soldierCols)
    const col = i % soldierCols
    const x = (col - (soldierCols - 1) / 2) * soldierColSpacing
    const z = -(1 + row) * soldierRowSpacing
    return new THREE.Vector3(x, 0.8, z)
  }
  return new THREE.Vector3(-50, 0.8, -50)
}

// 根据阶段获取士兵移动速度
function getSoldierPhaseSpeed(phase: PhaseName) {
  if (phase === 'assemble') return 1.8
  if (phase === 'breach') return 3.2
  if (phase === 'assault') return 2.8
  return 3.6
}
// 创建飞机占位单位
function makePlanePlaceholder() {
  const geo = new THREE.BoxGeometry(2.4, 0.4, 2.4)
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6b6b })
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  return m
}

/**
 * 初始化场景
 * @param width 画布宽度
 * @param height 画布高度
 */
function initScene(width: number, height: number) {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x000000)

  const aspect = width / height
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000)
  // 将相机设置为一个更高的位置，以获得更好的视角
  camera.position.set(0, 30, 50)
  camera.lookAt(0, 0, 0)
  // 添加环境光和方向光
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambient)
  // 半球光模拟天空和地面的反射光，增强整体照明效果
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 1.2)
  hemiLight.position.set(0, 200, 0)
  scene.add(hemiLight)
  // 方向光模拟太阳光，增强阴影效果
  const dirLight = new THREE.DirectionalLight(0xffffff, 3)
  dirLight.position.set(-30, 100, -100)
  dirLight.castShadow = true
  dirLight.shadow.camera.top = 2
  dirLight.shadow.camera.bottom = -2
  dirLight.shadow.camera.left = -2
  dirLight.shadow.camera.right = 2
  dirLight.shadow.camera.near = 0.1
  dirLight.shadow.camera.far = 40
  scene.add(dirLight)
  // 添加地面 使用高光材质让它更有质感 depthWrite=false 避免地面遮挡角色模型的阴影
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000),
    new THREE.MeshPhongMaterial({ color: 0x000000, depthWrite: false })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  scene.add(mesh)

  // 添加加粗坐标轴和网格辅助，显示 X/Y/Z 轴
  // const axisLength = 20
  // const axisGroup = new THREE.Group()
  // axisGroup.add(createBoldAxis(axisLength, 0xff0000, 'x'))
  // axisGroup.add(createBoldAxis(axisLength, 0x00ff00, 'y'))
  // axisGroup.add(createBoldAxis(axisLength, 0x0000ff, 'z'))
  // axisGroup.add(createAxisLabel('X', new THREE.Vector3(axisLength + 2, 0, 0)))
  // axisGroup.add(createAxisLabel('Y', new THREE.Vector3(0, axisLength + 2, 0)))
  // axisGroup.add(createAxisLabel('Z', new THREE.Vector3(0, 0, axisLength + 2)))
  // scene.add(axisGroup)

  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0x444444)
  gridHelper.position.y = 0.01
  scene.add(gridHelper)

  const planeStartX = -((planeCount - 1) * planeSpacing) / 2
  const soldierStartX = ((soldierCols - 1) * soldierColSpacing) / -2
  // 创建飞机占位单位
  for (let i = 0; i < planeCount; i++) {
    const p = makePlanePlaceholder()
    const x = planeStartX + i * planeSpacing
    const y = planeHeight
    const z = planeZ
    p.position.set(x, y, z)
    p.rotation.y = 0
    scene.add(p)
    const initialAngle = (i / planeCount) * Math.PI * 2
    planes.push({ mesh: p, angle: initialAngle })
  }

  // 创建士兵占位单位
  for (let i = 0; i < soldierCount; i++) {
    const s = makeSoldierPlaceholder()
    const row = Math.floor(i / soldierCols)
    const col = i % soldierCols
    const x = soldierStartX + col * soldierColSpacing
    const z = soldierStartZ - row * soldierRowSpacing
    s.position.set(x, 0.8, z)
    s.rotation.y = Math.PI
    scene.add(s)
    soldiers.push(s)
    soldierTargets.push(s.position.clone())
  }
  // 根据当前阶段设置初始状态
  setPhaseState(currentPhase)

  // 添加轨道控制器，允许用户旋转、缩放和平移视角
  if (renderer) {
    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    // 禁用旋转，只允许平移和缩放
    ;(controls as any).enableRotate = false
    controls.enablePan = true
    controls.enableZoom = true
    controls.minDistance = 10
    controls.maxDistance = 200
    controls.maxPolarAngle = Math.PI / 2.1
    controls.update()
  }

  // 加载士兵 GLTF 并替换占位单位
  const loader = new GLTFLoader()
  loader.load(
    '/models/gltf/Soldier.glb',
    (g) => {
      // console.log('GLTF loaded:', '/models/gltf/Soldier.glb')
      const model = g.scene
      const animations: THREE.AnimationClip[] = (g.animations || []) as THREE.AnimationClip[]
      // console.log(
      //   'available soldier animations:',
      //   animations.map((a: THREE.AnimationClip) => a.name)
      // )
      model.scale.setScalar(5)
      model.traverse((c: any) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true
      })

      for (let i = 0; i < soldiers.length; i++) {
        const s = soldiers[i]
        const clone = SkeletonUtils.clone(model) as THREE.Object3D
        clone.position.copy(s.position)
        clone.rotation.copy(s.rotation)
        clone.updateMatrixWorld(true)
        clone.name = `soldier-model-${i}`
        scene.add(clone)
        scene.remove(s)
        soldiers[i] = clone

        // 创建动画混合器和动作
        const mixer = new THREE.AnimationMixer(clone as THREE.Object3D)
        const actions: Record<string, THREE.AnimationAction> = {}
        for (let ai = 0; ai < animations.length; ai++) {
          const clip = animations[ai]
          const key = (clip.name || `anim${ai}`).toLowerCase().replace(/\s+/g, '_')
          const action = mixer.clipAction(clip)
          action.loop = THREE.LoopRepeat
          action.clampWhenFinished = false
          action.enabled = true
          actions[key] = action
        }

        // 确定默认动作，仅限于行走/奔跑
        let defaultName: string | null = null
        if ('walk' in actions) defaultName = 'walk'
        else if ('run' in actions) defaultName = 'run'
        if (defaultName && actions[defaultName]) {
          actions[defaultName].reset().play()
        }

        mixers.push(mixer)
        soldierControllers.push({ mixer, actions, currentActionName: defaultName })
      }
    },
    undefined,
    (err) => {
      console.error('Failed to load Soldier.glb:', err)
    }
  )

  // 加载飞机 GLTF 并替换占位单位
  loader.load(
    '/models/gltf/Cesium_Air.glb',
    (airplane) => {
      // console.log('GLTF loaded:', '/models/gltf/Cesium_Air.glb')
      const airModel = airplane.scene
      // 获取飞机的关键帧动画集合
      const animations: THREE.AnimationClip[] = (airplane.animations || []) as THREE.AnimationClip[]
      // console.log(
      //   'available plane animations:',
      //   animations.map((a) => a.name)
      // )
      // 对飞机模型开启阴影投射
      airModel.traverse((c: any) => {
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).castShadow = true
      })
      // 替换每个占位飞机为加载的飞机模型，并保持位置和旋转一致
      for (let i = 0; i < planes.length; i++) {
        const old = planes[i].mesh
        const clone = SkeletonUtils.clone(airModel) as THREE.Object3D
        clone.position.copy(old.position)
        clone.rotation.copy(old.rotation)
        clone.scale.setScalar(0.5)
        clone.rotation.y = getFaceCameraRotationY(clone.position) // 飞机朝向摄像机
        clone.updateMatrixWorld(true) // 将模型矩阵更新到世界坐标系，确保动画混合器正确计算动画

        // 播放飞机 glTF 中的默认动画（如果存在）
        if (animations.length) {
          // 为每个士兵或飞机创建一个动画混合器
          const mixer = new THREE.AnimationMixer(clone)
          for (let ai = 0; ai < animations.length; ai++) {
            const action = mixer.clipAction(animations[ai]) // 创建动画动作
            action.loop = THREE.LoopRepeat // 设置动画循环模式
            action.reset().play() // 从头开始播放动画
          }
          mixers.push(mixer) // 将飞机动画混合器添加到全局数组中，以便在动画循环中更新
        }

        scene.add(clone)
        scene.remove(old)
        planes[i].mesh = clone
      }
    },
    undefined,
    (err) => {
      console.warn('Cesium_Air load failed:', err)
    }
  )
}
// 处理窗口大小变化，调整渲染器和相机参数
function resize() {
  if (!container.value || !renderer) return
  const w = container.value.clientWidth
  const h = container.value.clientHeight
  renderer.setSize(w, h)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
/**
 * 处理阶段变化，切换士兵动画
 * @param _prev 上一个阶段
 * @param next 下一个阶段
 */
function handleSoldierAnimation(_prev: string | null, next: string) {
  // 定义每个阶段对应的优先动画列表，士兵会尝试切换到列表中第一个可用的动画
  const mapping: Record<PhaseName, string[]> = {
    assemble: ['walk'],
    breach: ['run'],
    assault: ['run'],
    retreat: ['walk'],
  } as const

  // 获取当前阶段对应的动画候选列表，如果没有定义则默认使用 "walk"
  const candidates = mapping[next as PhaseName] || ['walk']
  soldierControllers.forEach((ctrl) => {
    const avail = Object.keys(ctrl.actions || {})
    if (!avail.length) return
    let targetName: string | null = null
    for (const c of candidates)
      if (c in ctrl.actions) {
        targetName = c
        break
      }
    if (!targetName) targetName = avail[0]
    const fromName = ctrl.currentActionName
    const toAction = ctrl.actions[targetName!]
    if (!toAction) return
    if (fromName && fromName in ctrl.actions && fromName !== targetName) {
      const fromAction = ctrl.actions[fromName]
      fromAction.crossFadeTo(toAction, 0.5, false)
      toAction.reset().play()
    } else if (toAction) {
      toAction.reset().play()
    }
    ctrl.currentActionName = targetName
  })
}
/**
 * 动画循环，更新物体位置、动画状态，并渲染场景
 */
function animate() {
  frameId = requestAnimationFrame(animate)
  _tick++
  // if (_tick % 180 === 0 && soldiers.length) {
  //   const s0 = soldiers[0]
  //   if (s0) console.log('debug soldier[0] pos', s0.position.toArray(), 'name=', s0.name)
  // }
  controls?.update()

  const now = performance.now()
  const delta = lastFrameTime > 0 ? (now - lastFrameTime) / 1000 : 0
  lastFrameTime = now
  const phase = (props.phase || currentPhase) as PhaseName
  // 如果阶段发生变化，处理阶段切换
  if (phase !== currentPhase) {
    handleSoldierAnimation(currentPhase, phase)
    setPhase(phase)
  }
  /**
   * 这里处理每一帧的动画更新，根据当前阶段调整士兵和飞机的位置和旋转，使它们朝向正确的方向，并以适当的速度移动到目标位置
   *  集结-> 突破 -> 进攻 -> 撤退
   */

  if (phase === 'assemble') {
    soldiers.forEach((s, i) => {
      const target = getSoldierPhaseTarget(i, phase)
      const moveDir = target.clone().sub(s.position)
      const dist = moveDir.length()
      if (dist > 0.05) {
        moveDir.normalize()
        const step = Math.min(dist, getSoldierPhaseSpeed(phase) * delta)
        s.position.addScaledVector(moveDir, step)
        s.rotation.y = getPlaneRotationY(s.position, camera.position)
      }
    })
    planes.forEach((p, i) => {
      const lineStartX = -((planeCount - 1) * planeSpacing) / 2
      const target = new THREE.Vector3(lineStartX + i * planeSpacing, Math.max(10, planeHeight - 6), -12)
      const moveDir = target.clone().sub(p.mesh.position)
      const dist = moveDir.length()
      if (dist > 0.1) {
        moveDir.normalize()
        const step = Math.min(dist, 4 * delta)
        p.mesh.position.addScaledVector(moveDir, step)
      }
      p.mesh.rotation.y = 0
    })
  } else if (phase === 'breach') {
    soldiers.forEach((s, i) => {
      const target = getSoldierPhaseTarget(i, phase)
      const moveDir = target.clone().sub(s.position)
      const dist = moveDir.length()
      if (dist > 0.05) {
        moveDir.normalize()
        const step = Math.min(dist, getSoldierPhaseSpeed(phase) * delta)
        s.position.addScaledVector(moveDir, step)
      }
      s.rotation.y = Math.PI
    })
    planes.forEach((p, i) => {
      const originX = -((planeCount - 1) * planeSpacing) / 2 + i * planeSpacing
      p.angle += 0.03 + i * 0.0025
      const t = phaseElapsed * 1.2 + i * 0.8
      const swayX = Math.sin(t) * 10
      const swayY = Math.cos(t * 1.8) * 2.2
      const forwardZ = -6 - phaseElapsed * 0.15
      p.mesh.position.set(originX + swayX, planeHeight + swayY * 0.8, forwardZ + Math.sin(t * 0.5) * 2)
      p.mesh.rotation.y = 0
    })
  } else if (phase === 'assault') {
    const planeRadius = 20
    const planeSpeed = 0.8
    planes.forEach((p) => {
      const nextAngle = p.angle - planeSpeed * delta
      const currentPos = new THREE.Vector3(
        Math.cos(p.angle) * planeRadius,
        planeHeight + Math.sin(p.angle * 2) * 1.5,
        Math.sin(p.angle) * planeRadius
      )
      const nextPos = new THREE.Vector3(
        Math.cos(nextAngle) * planeRadius,
        planeHeight + Math.sin(nextAngle * 2) * 1.5,
        Math.sin(nextAngle) * planeRadius
      )
      const forwardDir = nextPos.clone().sub(currentPos).setY(planeHeight).normalize()
      p.mesh.position.copy(currentPos)
      if (forwardDir.lengthSq() > 0) {
        p.mesh.rotation.y = getPlaneRotationY(p.mesh.position, p.mesh.position.clone().add(forwardDir))
      }
      p.angle = nextAngle
    })

    const center = new THREE.Vector3(0, 0, 0)
    soldiers.forEach((s, i) => {
      const col = i % soldierCols
      const row = Math.floor(i / soldierCols)
      const baseX = (col - (soldierCols - 1) / 2) * soldierColSpacing
      const rowCount = Math.ceil(soldierCount / soldierCols)
      const baseZ = (row - (rowCount - 1) / 2) * soldierRowSpacing
      const orbitRadius = 6
      const orbitAngle = phaseElapsed * 0.8 + (col / soldierCols) * Math.PI * 2
      const target = new THREE.Vector3(
        baseX + Math.cos(orbitAngle) * orbitRadius,
        0.8,
        baseZ + Math.sin(orbitAngle) * orbitRadius
      )
      const moveDir = target.clone().sub(s.position)
      const dist = moveDir.length()
      if (dist > 0.05) {
        moveDir.normalize()
        const step = Math.min(dist, getSoldierPhaseSpeed(phase) * delta)
        s.position.addScaledVector(moveDir, step)
      }
      s.rotation.y = getPlaneRotationY(s.position, center)
    })
  } else if (phase === 'retreat') {
    soldiers.forEach((s, i) => {
      const target = getSoldierPhaseTarget(i, phase)
      const moveDir = target.clone().sub(s.position)
      const dist = moveDir.length()
      if (dist > 0.05) {
        moveDir.normalize()
        const step = Math.min(dist, getSoldierPhaseSpeed(phase) * delta)
        s.position.addScaledVector(moveDir, step)
      }
      s.rotation.y = getPlaneRotationY(s.position, camera.position)
    })
    planes.forEach((p, i) => {
      const target = new THREE.Vector3(0, planeHeight, -80 - i * 2)
      const moveDir = target.clone().sub(p.mesh.position)
      const dist = moveDir.length()
      if (dist > 0.1) {
        moveDir.normalize()
        const step = Math.min(dist, 7 * delta)
        p.mesh.position.addScaledVector(moveDir, step)
      }
      p.mesh.rotation.y = getPlaneRotationY(p.mesh.position, camera.position) + Math.PI
    })
  }

  // 阶段计时器，达到阶段持续时间后自动切换到下一个阶段
  phaseElapsed += delta
  // const currentPhaseDuration = Math.max(0.1, phaseDurations.value[phase])
  // if (phaseElapsed >= currentPhaseDuration) {
  //   const nextPhase = getNextPhase(currentPhase)
  //   handleSoldierAnimation(currentPhase, nextPhase)
  //   setPhase(nextPhase)
  // }

  // 更新动画混合器
  if (mixers.length) mixers.forEach((m) => m.update(delta))

  if (renderer && scene && camera) renderer.render(scene, camera)
}

onMounted(() => {
  if (!container.value) return
  const w = container.value.clientWidth || container.value.offsetWidth || 800
  const h = container.value.clientHeight || container.value.offsetHeight || 600
  // 创建 WebGL 渲染器并添加到 DOM
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)
  // 初始化场景、相机、光源和对象
  initScene(w, h)
  window.addEventListener('resize', resize)
  resize()
  lastFrameTime = performance.now()
  animate()
})

onBeforeUnmount(() => {
  if (frameId) cancelAnimationFrame(frameId)
  window.removeEventListener('resize', resize)
  if (renderer && renderer.domElement && container.value) {
    container.value.removeChild(renderer.domElement)
  }
})
</script>

<style scoped>
.battle-scene {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
