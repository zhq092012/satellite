import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
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

/** 推演一轨轨迹折线实体 ID 后缀 */
const DEDUCTION_ORBIT_PATH_SUFFIX = '-orbit-path'
/** 推演卫星实体 ID 前缀 */
const DEDUCTION_SAT_ENTITY_ID = 'battle-deduction-sat-'
/** 过站连线实体 ID */
const DEDUCTION_LINK_ENTITY_ID = 'battle-deduction-station-link'
/** 爆炸 billboard 实体 ID */
const DEDUCTION_EXPLOSION_ENTITY_ID = 'battle-deduction-explosion'

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
 */
export const useBattleGlobeDeductionEffects = (
  viewerRef: Ref<Cesium.Viewer | null>,
  satellitesRef: Ref<BattleGlobeSatellite[]> | ComputedRef<BattleGlobeSatellite[]>,
  currentTimeMsRef: Ref<number> | ComputedRef<number>,
  selectedNoradRef: Ref<number | null> | ComputedRef<number | null>,
  isDeductionPlayingRef: Ref<boolean> | ComputedRef<boolean>,
  visualPlanRef: Ref<SatelliteDeductionVisualPlan | null> | ComputedRef<SatelliteDeductionVisualPlan | null>
) => {
  const satrecCache = new Map<number, satellitejs.SatRec>()
  const scratchPosition = new Cesium.Cartesian3()

  /**
   * 获取卫星 satrec。
   *
   * @param norad NORAD
   * @returns satrec 或 null
   */
  const getSatrec = (norad: number): satellitejs.SatRec | null => {
    if (satrecCache.has(norad)) return satrecCache.get(norad) ?? null
    const sat = satellitesRef.value.find((item) => item.norad === norad)
    if (!sat) return null
    try {
      const satrec = satellitejs.twoline2satrec(sat.line1, sat.line2)
      if (satrec) {
        satrecCache.set(norad, satrec)
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
    const satrec = getSatrec(norad)
    if (!satrec) return null
    try {
      const posVel = satellitejs.propagate(satrec, date)
      if (!posVel?.position) return null
      const gmst = satellitejs.gstime(date)
      const posEcf = satellitejs.eciToEcf(posVel.position, gmst)
      if (!posEcf) return null
      const cartesian = Cesium.Cartesian3.fromElements(
        posEcf.x * 1000,
        posEcf.y * 1000,
        posEcf.z * 1000,
        scratchPosition
      )
      return clone ? Cesium.Cartesian3.clone(cartesian) : cartesian
    } catch {
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
    const periodMs = orbitPeriodSec * 1000
    const steps = Math.max(48, Math.min(240, Math.ceil(orbitPeriodSec / 20)))
    const positions: Cesium.Cartesian3[] = []
    for (let i = 0; i <= steps; i += 1) {
      const sampleMs = centerMs + (periodMs * i) / steps
      const pos = propagatePosition(norad, new Date(sampleMs), true)
      if (pos) positions.push(pos)
    }
    return positions
  }

  /**
   * 移除推演相关实体。
   *
   * @param viewer Viewer
   */
  const clearDeductionEntities = (viewer: Cesium.Viewer) => {
    ;[DEDUCTION_LINK_ENTITY_ID, DEDUCTION_EXPLOSION_ENTITY_ID].forEach((id) => {
      const entity = viewer.entities.getById(id)
      if (entity) viewer.entities.remove(entity)
    })
    const norad = selectedNoradRef.value
    if (norad) {
      const orbitId = `${DEDUCTION_SAT_ENTITY_ID}${norad}${DEDUCTION_ORBIT_PATH_SUFFIX}`
      const orbitEntity = viewer.entities.getById(orbitId)
      if (orbitEntity) viewer.entities.remove(orbitEntity)
    }
    viewer.scene.requestRender()
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
    const entityId = `${DEDUCTION_SAT_ENTITY_ID}${norad}${DEDUCTION_ORBIT_PATH_SUFFIX}`
    const existing = viewer.entities.getById(entityId)

    if (!showPath) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    const centerMs = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    const positions = buildOneOrbitPolylinePositions(norad, centerMs, orbitPeriodSec)
    if (positions.length < 2) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    if (!existing) {
      viewer.entities.add({
        id: entityId,
        polyline: {
          positions: new Cesium.ConstantProperty(positions),
          width: BATTLE_GLOBE_ORBIT_PATH_WIDTH,
          material: createBattleGlobeOrbitGlowMaterial(),
          arcType: Cesium.ArcType.NONE,
        },
      })
      return
    }

    if (existing.polyline) {
      existing.polyline.positions = new Cesium.ConstantProperty(positions)
      existing.show = true
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
    const existing = viewer.entities.getById(DEDUCTION_LINK_ENTITY_ID)
    if (!pass) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    const ms = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    const satPos = propagatePosition(norad, new Date(ms), true)
    const groundPos = Cesium.Cartesian3.fromDegrees(pass.longitude, pass.latitude, 0)
    if (!satPos) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    const linePositions = [satPos, groundPos]

    if (existing?.polyline) {
      existing.polyline.positions = new Cesium.ConstantProperty(linePositions)
      existing.show = true
      return
    }

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
    const existing = viewer.entities.getById(DEDUCTION_EXPLOSION_ENTITY_ID)
    if (!show) {
      if (existing) viewer.entities.remove(existing)
      return
    }

    if (!octStarDataUrl) {
      octStarDataUrl = createOctagonStarExplosionDataUrl(80)
    }

    const currentMs = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now()
    const position =
      propagatePosition(norad, new Date(currentMs), true) ??
      Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO)
    const scale = 0.85 + Math.sin(performance.now() / 180) * 0.15

    if (existing) {
      existing.position = new Cesium.ConstantPositionProperty(position)
      if (existing.billboard) {
        existing.billboard.scale = new Cesium.ConstantProperty(scale)
      }
      existing.show = true
      return
    }

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

    const playing = isDeductionPlayingRef.value
    const plan = visualPlanRef.value
    const norad = selectedNoradRef.value
    const currentMs = currentTimeMsRef.value

    if (!playing || !plan || !norad || plan.norad !== norad) {
      clearDeductionEntities(viewer)
      return
    }

    const state = resolveDeductionVisualState(plan, currentMs, true)
    syncDeductionOrbitPath(viewer, norad, plan.orbitPeriodSec, state.showOrbitPath)
    syncStationLink(viewer, norad, state.activePass)
    syncExplosion(viewer, norad, state.showExplosion)
    viewer.scene.requestRender()
  }

  /**
   * 每帧刷新爆炸位置与脉动（与卫星 TLE 传播时刻一致）。
   */
  const updateExplosionOnPostUpdate = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !isDeductionPlayingRef.value) return

    const plan = visualPlanRef.value
    const norad = selectedNoradRef.value
    const currentMs = currentTimeMsRef.value
    if (!plan || !norad || plan.norad !== norad) return

    const state = resolveDeductionVisualState(plan, currentMs, true)
    syncExplosion(viewer, norad, state.showExplosion)
  }

  let effectsPostUpdateRemover: (() => void) | null = null

  /**
   * 注册 postUpdate，使爆炸随推演时钟与卫星同步移动。
   */
  const ensureEffectsPostUpdateListener = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || effectsPostUpdateRemover) return
    effectsPostUpdateRemover = viewer.scene.postUpdate.addEventListener(() => {
      updateExplosionOnPostUpdate()
    })
  }

  /**
   * 移除 postUpdate 监听。
   */
  const removeEffectsPostUpdateListener = () => {
    effectsPostUpdateRemover?.()
    effectsPostUpdateRemover = null
  }

  watch(
    () => viewerRef.value,
    (viewer) => {
      removeEffectsPostUpdateListener()
      if (!viewer || viewer.isDestroyed()) return
      ensureEffectsPostUpdateListener()
    },
    { immediate: true }
  )

  watch(
    [isDeductionPlayingRef, visualPlanRef, selectedNoradRef, currentTimeMsRef],
    () => syncDeductionEffects(),
    { deep: true }
  )

  watch(
    () => isDeductionPlayingRef.value,
    (playing) => {
      const viewer = viewerRef.value
      if (!playing && viewer && !viewer.isDestroyed()) {
        clearDeductionEntities(viewer)
      }
    }
  )

  onBeforeUnmount(() => {
    removeEffectsPostUpdateListener()
    const viewer = viewerRef.value
    if (viewer && !viewer.isDestroyed()) {
      clearDeductionEntities(viewer)
    }
  })

  return { syncDeductionEffects }
}
