import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { onBeforeUnmount, watch, type ComputedRef, type Ref, ref } from 'vue'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import { createOctagonStarExplosionDataUrl } from '@/utils/battleGlobeOctStar'
import {
  BATTLE_GLOBE_ORBIT_PATH_WIDTH,
  createBattleGlobeOrbitGlowMaterial,
} from '@/utils/battleGlobeOrbitPathStyle'
import {
  resolveDeductionVisualState,
  type SatelliteDeductionVisualPlan,
} from '@/utils/buildSatelliteDeductionTimeline'
//--------------------------------------------------------------------------------------------------------------------
//本函数主要用于推演播放期间的 Cesium 特效：一轨轨迹、过站虚线、星打击爆炸。
//不使用 Entity.path（与 CallbackProperty 及固定 clock 不兼容），以 Polyline 代替 path.show。
//--------------------------------------------------------------------------------------------------------------------
/** 推演一轨轨迹折线实体 ID 后缀 */
const DEDUCTION_ORBIT_PATH_SUFFIX = '-orbit-path'
/** 推演卫星实体 ID 前缀 */
const DEDUCTION_SAT_ENTITY_ID = 'battle-deduction-sat-'
/** 过站连线实体 ID */
const DEDUCTION_LINK_ENTITY_ID = 'battle-deduction-station-link'
/** 爆炸 billboard 实体 ID */
const DEDUCTION_EXPLOSION_ENTITY_ID = 'battle-deduction-explosion'
/** 推演相机相对卫星的距离（米），保证能看到地球与过站连线，不贴地 */
const DEDUCTION_CAMERA_RANGE = 12_000_000
/** 推演跟随相机俯仰角：正俯视（与战场初始俯视一致） */
const DEDUCTION_CAMERA_PITCH = Cesium.Math.toRadians(-90)

/** 八角星图标 Data URL（懒加载） */
let octStarDataUrl: string | null = null

/**
 * 推演播放期间的 Cesium 特效：一轨轨迹、过站虚线、星打击爆炸。
 * 不使用 Entity.path（与 CallbackProperty 及固定 clock 不兼容），以 Polyline 代替 path.show。
 *
 * @param viewerRef Viewer 引用
 * @param satellitesRef 卫星列表
 * @param currentTimeMsRef 当前时刻
 * @param selectedNoradRef 选中 NORAD
 * @param isDeductionPlayingRef 是否推演中
 * @param visualPlanRef 推演视觉计划
 * @param followCameraRef 推演时是否跟随卫星
 * @param restoreOverviewView 不跟随时恢复战场原始俯视视角
 */
export const useBattleGlobeDeductionEffects = (
  viewerRef: Ref<Cesium.Viewer | null>,
  satellitesRef: Ref<BattleGlobeSatellite[]> | ComputedRef<BattleGlobeSatellite[]>,
  currentTimeMsRef: Ref<number> | ComputedRef<number>,
  selectedNoradRef: Ref<number | null> | ComputedRef<number | null>,
  isDeductionPlayingRef: Ref<boolean> | ComputedRef<boolean>,
  visualPlanRef: Ref<SatelliteDeductionVisualPlan | null> | ComputedRef<SatelliteDeductionVisualPlan | null>,
  followCameraRef: Ref<boolean> | ComputedRef<boolean> = ref(true),
  restoreOverviewView?: () => void
) => {
  // 卫星轨道参数缓存
  const satrecCache = new Map<number, satellitejs.SatRec>()
  // 临时位置
  const scratchPosition = new Cesium.Cartesian3()
  /** 当前是否处于 lookAt 跟随，避免未跟随时每帧重置相机 */
  let cameraFollowing = false
  /** 本轮「不跟随」是否已恢复过原始视角，避免每帧重复 flyTo */
  let noFollowOverviewApplied = false

  /**
   * 获取卫星 satrec。
   *
   * @param norad NORAD
   * @returns satrec 或 null
   */
  const getSatrec = (norad: number): satellitejs.SatRec | null => {
    // 判断卫星轨道参数缓存是否包含卫星 NORAD
    if (satrecCache.has(norad)) return satrecCache.get(norad) ?? null
    // 获取卫星
    const sat = satellitesRef.value.find((item) => item.norad === norad)
    // 如果卫星不存在，则返回 null
    if (!sat) return null
    // 尝试获取卫星轨道参数
    try {
      const satrec = satellitejs.twoline2satrec(sat.line1, sat.line2)
      if (satrec) {
        // 设置卫星轨道参数缓存
        satrecCache.set(norad, satrec)
        // 返回卫星轨道参数
        return satrec
      }
    } catch {
      return null
    }
    return null
  }

  /**
   * 传播卫星位置（每次返回新克隆，避免共享 scratch）。
   *
   * @param norad NORAD
   * @param date 时刻
   * @param clone 是否克隆坐标
   * @returns 世界坐标或 null
   */
  const propagatePosition = (
    norad: number,
    date: Date,
    clone = false
  ): Cesium.Cartesian3 | null => {
    // 获取卫星轨道参数
    const satrec = getSatrec(norad)
    // 如果卫星轨道参数为空，则返回 null
    if (!satrec) return null
    try {
      // 传播卫星位置
      const posVel = satellitejs.propagate(satrec, date)
      // 如果传播位置为空，则返回 null
      if (!posVel?.position) return null
      // 获取格林尼治平恒星时
      const gmst = satellitejs.gstime(date)
      // 从地心惯性坐标系转换为地心地固坐标系
      const posEcf = satellitejs.eciToEcf(posVel.position, gmst)
      // 如果地心地固坐标系为空，则返回 null
      if (!posEcf) return null
      // 从地心地固坐标系转换为世界坐标系
      const cartesian = Cesium.Cartesian3.fromElements(
        posEcf.x * 1000,
        posEcf.y * 1000,
        posEcf.z * 1000,
        scratchPosition
      )
      // 如果需要克隆坐标，则克隆坐标
      return clone ? Cesium.Cartesian3.clone(cartesian) : cartesian
    } catch {
      // 如果获取格林尼治平恒星时失败，则返回 null
      return null
    }
  }

  /**
   * 构建当前时刻起一轨周期的折线点列。
   *
   * @param norad NORAD
   * @param centerMs 起点时刻（毫秒）
   * @param orbitPeriodSec 轨道周期（秒）
   * @returns 折线顶点
   */
  const buildOneOrbitPolylinePositions = (
    norad: number,
    centerMs: number,
    orbitPeriodSec: number
  ): Cesium.Cartesian3[] => {
    // 计算轨道周期毫秒
    const periodMs = orbitPeriodSec * 1000
    // 计算步数（至少 48 步，最多 240 步，按 20 秒间隔采样）
    const steps = Math.max(48, Math.min(240, Math.ceil(orbitPeriodSec / 20)))
    // 创建折线顶点数组
    const positions: Cesium.Cartesian3[] = []
    // 遍历步数
    for (let i = 0; i <= steps; i += 1) {
      // 计算采样时刻毫秒
      const sampleMs = centerMs + (periodMs * i) / steps
      // 传播卫星位置
      const pos = propagatePosition(norad, new Date(sampleMs), true)
      if (pos) positions.push(pos)
    }
    return positions
  }

  /**
   * 移除所有推演一轨折线（清除选中后 selectedNorad 可能已为 null，不能只按当前选中删）。
   *
   * @param viewer Viewer
   */
  const removeDeductionOrbitPathEntities = (viewer: Cesium.Viewer) => {
    const prefix = DEDUCTION_SAT_ENTITY_ID
    const suffix = DEDUCTION_ORBIT_PATH_SUFFIX
    viewer.entities.values
      .filter((entity) => {
        const id = String(entity.id ?? '')
        return id.startsWith(prefix) && id.endsWith(suffix)
      })
      .forEach((entity) => viewer.entities.remove(entity))
  }

  /**
   * 移除推演相关实体。
   *
   * @param viewer Viewer
   */
  const clearDeductionEntities = (viewer: Cesium.Viewer) => {
    // 移除过站虚线与爆炸特效
    [DEDUCTION_LINK_ENTITY_ID, DEDUCTION_EXPLOSION_ENTITY_ID].forEach((id) => {
      // 获取实体
      const entity = viewer.entities.getById(id)
      if (entity) viewer.entities.remove(entity)
    })
    removeDeductionOrbitPathEntities(viewer)
    releaseDeductionCamera(viewer)
    noFollowOverviewApplied = false
    // 请求渲染
    viewer.scene.requestRender()
  }

  /**
   * 推演期间相机跟随卫星：以卫星为锚点、正俯视、保持远距不贴地。
   *
   * @param viewer Viewer
   * @param norad NORAD
   */
  const followDeductionCamera = (viewer: Cesium.Viewer, norad: number) => {
    const ms = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    const satPos = propagatePosition(norad, new Date(ms), true)
    if (!satPos) return
    viewer.camera.lookAt(
      satPos,
      new Cesium.HeadingPitchRange(0, DEDUCTION_CAMERA_PITCH, DEDUCTION_CAMERA_RANGE)
    )
    cameraFollowing = true
  }

  /**
   * 解除 lookAt 锁定，避免推演结束后相机仍钉在卫星上。
   *
   * @param viewer Viewer
   */
  const releaseDeductionCamera = (viewer: Cesium.Viewer) => {
    if (!cameraFollowing) return
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    cameraFollowing = false
  }

  /**
   * 不跟随时切回战场原始俯视视角（与清除选中卫星时一致）。
   *
   * @param viewer Viewer
   */
  const applyNoFollowOverview = (viewer: Cesium.Viewer) => {
    releaseDeductionCamera(viewer)
    if (noFollowOverviewApplied) return
    restoreOverviewView?.()
    noFollowOverviewApplied = true
  }

  /**
   * 同步一轨轨迹折线（推演中等同 path.show = true）。
   *
   * @param viewer Viewer
   * @param norad NORAD
   * @param orbitPeriodSec 轨道周期秒
   * @param showPath 是否显示
   */
  const syncDeductionOrbitPath = (
    viewer: Cesium.Viewer,
    norad: number,
    orbitPeriodSec: number,
    showPath: boolean
  ) => {
    // 获取轨道轨迹实体 ID
    const entityId = `${DEDUCTION_SAT_ENTITY_ID}${norad}${DEDUCTION_ORBIT_PATH_SUFFIX}`
    // 判断轨道轨迹实体是否存在
    const existing = viewer.entities.getById(entityId)

    // 如果不需要显示轨道轨迹，则移除轨道轨迹实体
    if (!showPath) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    //
    // 计算中心时刻毫秒
    const centerMs = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    // 构建一轨周期的折线顶点
    const positions = buildOneOrbitPolylinePositions(norad, centerMs, orbitPeriodSec)
    // 如果折线顶点数量小于 2，则移除轨道轨迹实体
    if (positions.length < 2) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    // 如果轨道轨迹实体不存在，则添加轨道轨迹实体
    if (!existing) {
      viewer.entities.add({
        id: entityId,
        polyline: {
          positions: new Cesium.ConstantProperty(positions),
          width: BATTLE_GLOBE_ORBIT_PATH_WIDTH,
          material: createBattleGlobeOrbitGlowMaterial(),
          arcType: Cesium.ArcType.NONE,// 不进行弧线插值
        },
      })
      return
    }

    if (existing.polyline) {
      existing.polyline.positions = new Cesium.ConstantProperty(positions)// 设置折线顶点
      existing.show = true// 显示轨道轨迹
    }
  }

  /**
   * 同步过站黄色虚线。
   *
   * @param viewer Viewer
   * @param norad NORAD
   * @param pass 过站窗口；null 则移除连线
   */
  const syncStationLink = (
    viewer: Cesium.Viewer,
    norad: number,
    pass: { latitude: number; longitude: number } | null
  ) => {
    // 获取过站虚线实体
    const existing = viewer.entities.getById(DEDUCTION_LINK_ENTITY_ID)
    // 如果过站窗口为空，则移除过站虚线实体
    if (!pass) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    // 计算当前时刻毫秒
    const ms = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    // 传播卫星位置
    const satPos = propagatePosition(norad, new Date(ms), true)
    // 计算星下点位置
    const groundPos = Cesium.Cartesian3.fromDegrees(pass.longitude, pass.latitude, 0)
    // 如果卫星位置为空，则移除过站虚线实体
    if (!satPos) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    // 构建过站虚线顶点
    const linePositions = [satPos, groundPos]
    // 如果过站虚线实体存在，则设置过站虚线顶点
    if (existing?.polyline) {
      existing.polyline.positions = new Cesium.ConstantProperty(linePositions)// 设置过站虚线顶点
      existing.show = true// 显示过站虚线
      return
    }

    // 如果过站虚线实体不存在，则添加过站虚线实体
    viewer.entities.add({
      id: DEDUCTION_LINK_ENTITY_ID,
      polyline: {
        positions: new Cesium.ConstantProperty(linePositions),
        width: 2,
        material: new Cesium.PolylineDashMaterialProperty({
          color: Cesium.Color.fromCssColorString('#facc15'),
          dashLength: 16,
        }),
        arcType: Cesium.ArcType.NONE,
      },
    })
  }

  /**
   * 同步卫星打击八角星爆炸（随当前推演时刻的轨道位置移动，打击后至推演结束持续显示）。
   *
   * @param viewer Viewer
   * @param norad NORAD
   * @param show 是否显示
   */
  const syncExplosion = (viewer: Cesium.Viewer, norad: number, show: boolean) => {
    // 获取爆炸特效实体
    const existing = viewer.entities.getById(DEDUCTION_EXPLOSION_ENTITY_ID)
    // 如果不需要显示爆炸特效，则移除爆炸特效实体
    if (!show) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    // 如果八角星图标 Data URL 为空，则创建八角星图标 Data URL
    if (!octStarDataUrl) {
      octStarDataUrl = createOctagonStarExplosionDataUrl(80)
    }

    // 计算当前时刻毫秒
    const currentMs = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    // 传播卫星位置
    const position =
      propagatePosition(norad, new Date(currentMs), true) ??
      Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO)
    // 计算爆炸特效缩放
    const scale = 0.85 + Math.sin(performance.now() / 180) * 0.15
    // 如果爆炸特效实体存在，则设置爆炸特效位置与缩放
    if (existing) {
      existing.position = new Cesium.ConstantPositionProperty(position)// 设置爆炸特效位置
      if (existing.billboard) {
        existing.billboard.scale = new Cesium.ConstantProperty(scale)// 设置爆炸特效缩放
      }
      existing.show = true// 显示爆炸特效
      return
    }
    // 如果爆炸特效实体不存在，则添加爆炸特效实体
    viewer.entities.add({
      id: DEDUCTION_EXPLOSION_ENTITY_ID,
      position: new Cesium.ConstantPositionProperty(position),
      billboard: {
        image: octStarDataUrl,
        scale: new Cesium.ConstantProperty(scale),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  }

  /**
   * 根据推演状态刷新所有特效。
   */
  const syncDeductionEffects = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return
    // 获取推演状态
    const playing = isDeductionPlayingRef.value
    // 获取推演视觉计划
    const plan = visualPlanRef.value
    // 获取选中卫星 NORAD
    const norad = selectedNoradRef.value
    // 计算当前时刻毫秒
    const currentMs = currentTimeMsRef.value
    // 如果推演状态为空或推演视觉计划为空或选中卫星 NORAD 为空或推演视觉计划中的卫星 NORAD 与选中卫星 NORAD 不一致，则移除推演相关实体
    if (!playing || !plan || !norad || plan.norad !== norad) {
      clearDeductionEntities(viewer)
      return
    }
    // 获取推演状态
    const state = resolveDeductionVisualState(plan, currentMs, true)
    // 同步一轨轨迹折线
    syncDeductionOrbitPath(viewer, norad, plan.orbitPeriodSec, state.showOrbitPath)
    // 同步过站黄色虚线
    syncStationLink(viewer, norad, state.activePass)
    // 同步卫星打击八角星爆炸
    syncExplosion(viewer, norad, state.showExplosion)
    if (followCameraRef.value) {
      noFollowOverviewApplied = false
      followDeductionCamera(viewer, norad)
    } else {
      applyNoFollowOverview(viewer)
    }
    // 请求渲染
    viewer.scene.requestRender()
  }

  /**
   * 每帧刷新爆炸位置与脉动（与卫星 TLE 传播时刻一致）。
   */
  const updateExplosionOnPostUpdate = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !isDeductionPlayingRef.value) return
    // 获取推演视觉计划
    const plan = visualPlanRef.value
    // 获取选中卫星 NORAD
    const norad = selectedNoradRef.value
    // 计算当前时刻毫秒
    const currentMs = currentTimeMsRef.value
    // 如果推演视觉计划为空或选中卫星 NORAD 为空或推演视觉计划中的卫星 NORAD 与选中卫星 NORAD 不一致，则返回
    if (!plan || !norad || plan.norad !== norad) return
    // 获取推演状态
    const state = resolveDeductionVisualState(plan, currentMs, true)
    // 同步卫星打击八角星爆炸
    syncExplosion(viewer, norad, state.showExplosion)
  }

  // 爆炸特效 postUpdate 监听器
  let effectsPostUpdateRemover: (() => void) | null = null

  /**
   * 注册 postUpdate，使爆炸随推演时钟与卫星同步移动。
   */
  const ensureEffectsPostUpdateListener = () => {
    const viewer = viewerRef.value
    // 如果 viewer 为空或已销毁或爆炸特效 postUpdate 监听器已存在，则返回
    if (!viewer || viewer.isDestroyed() || effectsPostUpdateRemover) return
    // 注册爆炸特效 postUpdate 监听器
    effectsPostUpdateRemover = viewer.scene.postUpdate.addEventListener(() => {
      updateExplosionOnPostUpdate()// 每帧刷新爆炸位置与脉动
    })
  }

  /**
   * 移除 postUpdate 监听。
   */
  const removeEffectsPostUpdateListener = () => {
    effectsPostUpdateRemover?.()// 移除爆炸特效 postUpdate 监听器
    effectsPostUpdateRemover = null
  }

  watch(
    // 监听 viewer 变化
    () => viewerRef.value,
    (viewer) => {
      removeEffectsPostUpdateListener()// 移除爆炸特效 postUpdate 监听器
      if (!viewer || viewer.isDestroyed()) return
      ensureEffectsPostUpdateListener()// 注册爆炸特效 postUpdate 监听器
    },
    { immediate: true }
  )

  watch(
    // 监听推演状态、推演视觉计划、选中卫星 NORAD、当前时刻毫秒变化
    [isDeductionPlayingRef, visualPlanRef, selectedNoradRef, currentTimeMsRef, followCameraRef],
    () => syncDeductionEffects(),// 同步推演相关特效
    { deep: true }
  )

  watch(
    // 监听推演状态变化
    () => isDeductionPlayingRef.value,
    (playing) => {
      const viewer = viewerRef.value
      // 如果推演状态为 false 且 viewer 不为空且未销毁，则移除推演相关实体
      if (!playing && viewer && !viewer.isDestroyed()) {
        noFollowOverviewApplied = false
        clearDeductionEntities(viewer)
      }
    }
  )

  onBeforeUnmount(() => {
    removeEffectsPostUpdateListener()// 移除爆炸特效 postUpdate 监听器  
    const viewer = viewerRef.value
    if (viewer && !viewer.isDestroyed()) clearDeductionEntities(viewer)// 移除推演相关实体
  })

  // 返回同步推演相关特效函数
  return { syncDeductionEffects }
}
