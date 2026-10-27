import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import { resolveBattleGlobeOrbitPeriodSec } from '@/utils/buildBattleGlobeSatellites'
import {
  BATTLE_GLOBE_ORBIT_PATH_WIDTH,
  createBattleGlobeOrbitGlowMaterial,
} from '@/utils/battleGlobeOrbitPathStyle'

/** 选中卫星 path 轨迹实体 ID 前缀 */
const SELECTED_ORBIT_ENTITY_PREFIX = 'battle-selected-sat-path-'

/**
 * 为当前选中卫星使用 Entity.path 绘制轨道（位置由 SampledPositionProperty + 时钟驱动）。
 * 单星推演期间由推演模块绘制轨迹，此处不重复显示。
 *
 * @param viewerRef Cesium Viewer 引用
 * @param satellitesRef 卫星列表
 * @param currentTimeMsRef 当前推演时刻（毫秒）
 * @param selectedNoradRef 选中 NORAD
 * @param isDeductionPlayingRef 是否处于单星推演
 * @param taskStartMsRef 任务开始时刻（毫秒）
 * @param taskEndMsRef 任务结束时刻（毫秒）
 */
export const useBattleGlobeTimelineSelectedOrbit = (
  viewerRef: Ref<Cesium.Viewer | null>,
  satellitesRef: Ref<BattleGlobeSatellite[]> | ComputedRef<BattleGlobeSatellite[]>,
  currentTimeMsRef: Ref<number> | ComputedRef<number>,
  selectedNoradRef: Ref<number | null> | ComputedRef<number | null>,
  isDeductionPlayingRef: Ref<boolean> | ComputedRef<boolean>,
  taskStartMsRef: Ref<number> | ComputedRef<number>,
  taskEndMsRef: Ref<number> | ComputedRef<number>
) => {
  /** NORAD → satrec，卫星列表变化时清空 */
  const satrecCache = new Map<number, satellitejs.SatRec>()
  /** 传播结果写入的临时坐标，clone 为 true 时再复制出去 */
  const scratchPosition = new Cesium.Cartesian3()
  /** 当前已绘制轨迹的 NORAD；相同选中星跳过重建 */
  let activePathNorad: number | null = null

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
   * 传播卫星位置。
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
      /** SGP4 传播得到的 ECI 位置与速度（千米） */
      const posVel = satellitejs.propagate(satrec, date)
      if (!posVel?.position) return null
      /** 该时刻的格林尼治恒星时，用于 ECI 转 ECF */
      const gmst = satellitejs.gstime(date)
      /** 地固坐标（千米） */
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
   * 在任务时间范围内为卫星构建 SampledPositionProperty。
   *
   * @param norad NORAD
   * @param start 任务开始 JulianDate
   * @param stop 任务结束 JulianDate
   * @param orbitPeriodSec 轨道周期（秒）
   * @returns 位置属性或 null
   */
  const buildTaskSampledPosition = (
    norad: number,
    start: Cesium.JulianDate,
    stop: Cesium.JulianDate,
    orbitPeriodSec: number
  ): Cesium.SampledPositionProperty | null => {
    /** 任务时段内的采样位置，供 Entity.path 随时钟插值 */
    const property = new Cesium.SampledPositionProperty()
    property.setInterpolationOptions({
      interpolationDegree: 2,
      interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
    })

    /** 采样步长：约每圈 48 点，限制在 30–180 秒 */
    const stepSec = Math.max(30, Math.min(180, Math.round(orbitPeriodSec / 48)))
    /** 成功写入的采样点数，少于 2 个无法插值 */
    let sampleCount = 0
    /** 当前采样时刻，从任务开始步进到结束 */
    let time = start.clone()

    while (Cesium.JulianDate.lessThanOrEquals(time, stop)) {
      const pos = propagatePosition(norad, Cesium.JulianDate.toDate(time), true)
      if (pos) {
        property.addSample(time, pos)
        sampleCount += 1
      }
      time = Cesium.JulianDate.addSeconds(time, stepSec, new Cesium.JulianDate())
    }

    return sampleCount >= 2 ? property : null
  }

  /**
   * 移除选中卫星 path 实体。
   *
   * @param viewer Viewer
   */
  const clearSelectedPathEntities = (viewer: Cesium.Viewer) => {
    /** 本模块创建的选中星轨迹实体 */
    const toRemove = viewer.entities.values.filter((entity) =>
      String(entity.id ?? '').startsWith(SELECTED_ORBIT_ENTITY_PREFIX)
    )
    toRemove.forEach((entity) => viewer.entities.remove(entity))
    activePathNorad = null
  }

  /**
   * 同步选中卫星 Entity.path 轨迹。
   */
  const syncSelectedSatelliteOrbit = () => {
    /** 当前 Viewer；销毁后不再改实体 */
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return

    /** 选中星、是否单星推演，以及任务起止；推演中由推演模块自行画轨迹 */
    const norad = selectedNoradRef.value
    const deductionPlaying = isDeductionPlayingRef.value
    const startMs = taskStartMsRef.value
    const endMs = taskEndMsRef.value

    if (!norad || deductionPlaying || !startMs || !endMs || endMs <= startMs) {
      clearSelectedPathEntities(viewer)
      viewer.scene.requestRender()
      return
    }

    if (activePathNorad === norad) {
      /** 已存在的轨迹实体，只恢复显示，不重新采样 */
      const entity = viewer.entities.getById(`${SELECTED_ORBIT_ENTITY_PREFIX}${norad}`)
      if (entity?.path) {
        entity.path.show = new Cesium.ConstantProperty(true)
        entity.show = true
      }
      viewer.scene.requestRender()
      return
    }

    clearSelectedPathEntities(viewer)

    /** 选中星数据，用于取 TLE 与轨道周期 */
    const sat = satellitesRef.value.find((item) => item.norad === norad)
    if (!sat) return

    /** 轨道周期（秒）；TLE 无效时无法绘制 path */
    const orbitPeriodSec = resolveBattleGlobeOrbitPeriodSec(sat)
    if (orbitPeriodSec == null) {
      void import('element-plus').then(({ ElMessage }) => {
        ElMessage.error(
          `卫星「${sat.name}」(norad=${norad}) TLE 无效，无法绘制轨道周期。请检查 initMatrix 或 TLE 数据。`,
        )
      })
      return
    }
    /** 任务起止的 JulianDate，同时作为实体 availability */
    const start = Cesium.JulianDate.fromDate(new Date(startMs))
    const stop = Cesium.JulianDate.fromDate(new Date(endMs))
    /** 任务时段采样位置，驱动 Entity.path */
    const positionProperty = buildTaskSampledPosition(norad, start, stop, orbitPeriodSec)
    if (!positionProperty) return

    /** 选中星轨迹实体 ID */
    const entityId = `${SELECTED_ORBIT_ENTITY_PREFIX}${norad}`
    viewer.entities.add({
      id: entityId,
      availability: new Cesium.TimeIntervalCollection([
        new Cesium.TimeInterval({ start, stop }),
      ]),
      position: positionProperty,
      point: {
        show: false,
        pixelSize: 1,
      },
      path: {
        show: true,
        leadTime: orbitPeriodSec,
        trailTime: orbitPeriodSec,
        width: BATTLE_GLOBE_ORBIT_PATH_WIDTH,
        resolution: 60,
        material: createBattleGlobeOrbitGlowMaterial(),
      },
    })

    activePathNorad = norad

    const currentMs = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : startMs
    viewer.clock.startTime = start.clone()
    viewer.clock.stopTime = stop.clone()
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(currentMs))
    viewer.scene.requestRender()
  }

  watch(
    () => viewerRef.value,
    (viewer) => {
      satrecCache.clear()
      activePathNorad = null
      if (!viewer || viewer.isDestroyed()) return
      syncSelectedSatelliteOrbit()
    },
    { immediate: true }
  )

  watch(
    () => selectedNoradRef.value,
    (norad) => {
      activePathNorad = null
      const viewer = viewerRef.value
      if ((!norad || isDeductionPlayingRef.value) && viewer && !viewer.isDestroyed()) {
        clearSelectedPathEntities(viewer)
      }
      syncSelectedSatelliteOrbit()
    }
  )

  watch(
    () => isDeductionPlayingRef.value,
    () => {
      activePathNorad = null
      syncSelectedSatelliteOrbit()
    }
  )

  watch(
    () => [taskStartMsRef.value, taskEndMsRef.value] as const,
    () => {
      activePathNorad = null
      syncSelectedSatelliteOrbit()
    }
  )

  watch(
    satellitesRef,
    () => {
      satrecCache.clear()
      activePathNorad = null
      syncSelectedSatelliteOrbit()
    },
    { deep: true }
  )

  watch(
    () => currentTimeMsRef.value,
    () => {
      const viewer = viewerRef.value
      if (!viewer || viewer.isDestroyed() || !activePathNorad) return
      const startMs = taskStartMsRef.value
      const currentMs = currentTimeMsRef.value > 0 ? currentTimeMsRef.value : startMs
      if (!currentMs) return
      viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(currentMs))
      viewer.scene.requestRender()
    }
  )

  onBeforeUnmount(() => {
    const viewer = viewerRef.value
    if (viewer && !viewer.isDestroyed()) {
      clearSelectedPathEntities(viewer)
    }
  })

  return { syncSelectedSatelliteOrbit }
}
