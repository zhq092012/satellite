/**
 * 场景数据加载与 TLE 缓存管理
 * 负责加载卫星、武器数据，管理 TLE 轨道数据缓存，以及计算卫星位置
 */
import { ref } from 'vue'
import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import {
  getBattleSegmentSatellites,
  getSatelliteTLEData,
  getTaskWeapons,
} from '@/api/dashboard'
import {
  getGroundStationList,
  getMissileBaseListAll,
  type BaseStationInfo,
  type MissileBaseInfo,
} from '@/api/system/satellite-system-api'
import {
  getStrikePlanList,
  type StrikePlanV2Extended,
} from '@/api/strikePlan/satellite-strikeplan-api'
import { useLayoutStore } from '@/store/modules/layout'
import type { BlueSatelliteRecord } from '../types'
import type { Weapon } from '@/types/dashboard'

export function useSceneData() {
  const store = useLayoutStore()

  // ─── 响应式状态 ───
  const taskSatellites = ref<BlueSatelliteRecord[]>([])
  const taskWeapons = ref<Weapon[]>([])
  const missileBases = ref<MissileBaseInfo[]>([])
  const baseStations = ref<BaseStationInfo[]>([])
  const historicalPlans = ref<StrikePlanV2Extended[]>([])
  const preloadedHistoricalPlanTaskId = ref<number | null>(null)
  const loadingScene = ref(false)

  // ─── TLE 缓存（非响应式，性能优先） ───
  const satelliteTleCache = new Map<string, SatelliteTle>()
  const satelliteSatrecCache = new Map<string, ReturnType<typeof satellitejs.twoline2satrec>>()
  let cachedSatelliteTleTaskId: number | null = null

  const clearSatelliteTleCache = () => {
    satelliteTleCache.clear()
    satelliteSatrecCache.clear()
    cachedSatelliteTleTaskId = null
  }

  /**
   * 确保卫星 TLE 缓存已更新
   * 如果缓存中已有数据且任务 ID 匹配则复用，否则重新获取
   */
  const ensureSatelliteTleCache = async (taskId: number, satellites: BlueSatelliteRecord[]) => {
    if (cachedSatelliteTleTaskId === taskId && satelliteTleCache.size > 0) {
      return
    }

    satelliteTleCache.clear()
    satelliteSatrecCache.clear()

    const norads = Array.from(new Set(satellites.map((satellite) => Number(satellite.noradId)).filter(Number.isFinite)))
    if (norads.length === 0) {
      cachedSatelliteTleTaskId = taskId
      return
    }

    const tleDataRes = await getSatelliteTLEData({ norads })
    if (tleDataRes.code === 200 && Array.isArray(tleDataRes.data)) {
      tleDataRes.data.forEach((item) => {
        if (item?.satelliteTleResp?.line1 && item?.satelliteTleResp?.line2) {
          satelliteTleCache.set(String(item.noradId), item.satelliteTleResp)
        }
      })
      cachedSatelliteTleTaskId = taskId
    }
  }

  /** 获取或创建卫星记录（satrec），结果缓存 */
  const getSatelliteSatrec = (noradId: string, tleData: SatelliteTle) => {
    const cached = satelliteSatrecCache.get(noradId)
    if (cached) return cached
    const satrec = satellitejs.twoline2satrec(tleData.line1, tleData.line2)
    if (satrec) {
      satelliteSatrecCache.set(noradId, satrec)
    }
    return satrec
  }

  /** 获取卫星运行周期（分钟） */
  const getSatellitePeriodMinutes = (
    satrec: ReturnType<typeof satellitejs.twoline2satrec>,
    detail?: SatelliteDetail | null
  ): number => {
    const detailCycle = Number(detail?.cycle)
    if (Number.isFinite(detailCycle) && detailCycle > 0) {
      return detailCycle
    }

    const meanMotion = Number((satrec as { no?: number } | undefined)?.no ?? 0)
    if (Number.isFinite(meanMotion) && meanMotion > 0) {
      return (2 * Math.PI) / meanMotion
    }

    return 0
  }

  /** 根据 Date 对象计算卫星三维位置 */
  const getSatellitePositionAtDate = (satellite: BlueSatelliteRecord, currentDate?: Date): Cesium.Cartesian3 => {
    const fallback = Cesium.Cartesian3.fromDegrees(satellite.longitude, satellite.latitude, satellite.altitude)
    if (!currentDate || Number.isNaN(currentDate.getTime())) return fallback

    const tleData = satelliteTleCache.get(satellite.noradId)
    if (!tleData?.line1 || !tleData?.line2) return fallback

    const satrec = getSatelliteSatrec(satellite.noradId, tleData)
    if (!satrec) return fallback

    try {
      const positionAndVelocity = satellitejs.propagate(satrec, currentDate)
      if (!positionAndVelocity?.position) return fallback

      const gmst = satellitejs.gstime(currentDate)
      const positionEcf = satellitejs.eciToEcf(positionAndVelocity.position, gmst)
      if (!positionEcf) return fallback

      return new Cesium.Cartesian3(
        positionAndVelocity.position.x * 1000,
        positionAndVelocity.position.y * 1000,
        positionAndVelocity.position.z * 1000
      )
    } catch (error) {
      console.warn('calculate satellite position failed', satellite.noradId, error)
      return fallback
    }
  }

  /** 根据 JulianDate 计算卫星三维位置 */
  const getSatellitePositionAtTime = (satellite: BlueSatelliteRecord, currentTime?: Cesium.JulianDate): Cesium.Cartesian3 => {
    const fallback = Cesium.Cartesian3.fromDegrees(satellite.longitude, satellite.latitude, satellite.altitude)
    if (!currentTime) return fallback
    return getSatellitePositionAtDate(satellite, Cesium.JulianDate.toDate(currentTime))
  }

  /** 构建卫星一个轨道周期的轨迹点列表 */
  const buildSatelliteOrbitPositions = (
    satellite: BlueSatelliteRecord,
    currentTime: Cesium.JulianDate,
    detail?: SatelliteDetail | null
  ): Cesium.Cartesian3[] => {
    const tleData = satelliteTleCache.get(satellite.noradId)
    if (!tleData?.line1 || !tleData?.line2) return []

    const satrec = getSatelliteSatrec(satellite.noradId, tleData)
    if (!satrec) return []

    const periodMinutes = getSatellitePeriodMinutes(satrec, detail)
    if (!Number.isFinite(periodMinutes) || periodMinutes <= 0) return []

    const currentDate = Cesium.JulianDate.toDate(currentTime)
    const segmentCount = Math.max(120, Math.min(360, Math.ceil(periodMinutes * 6)))
    const positions: Cesium.Cartesian3[] = []

    for (let index = 0; index <= segmentCount; index += 1) {
      const ratio = index / segmentCount
      const sampleDate = new Date(currentDate.getTime() + periodMinutes * 60 * 1000 * ratio)
      positions.push(getSatellitePositionAtDate(satellite, sampleDate))
    }

    return positions
  }

  /**
   * 将任务步骤数据中的卫星扁平化处理
   * 提取每个卫星的基本信息和位置，按 NORAD ID 去重
   */
  const flattenStepSatellites = (items: StepSatellite[]): BlueSatelliteRecord[] => {
    const satellitesByNorad = new Map<string, BlueSatelliteRecord>()
    for (const step of items) {
      const stageName = step.taskStepResp?.name ?? '未知阶段'
      for (const structure of step.structureList ?? []) {
        for (const item of structure.gjList ?? []) {
          const position = item.geoCoordinates
          if (
            position &&
            Number.isFinite(position.longitude) &&
            Number.isFinite(position.latitude) &&
            Number.isFinite(position.altitude)
          ) {
            satellitesByNorad.set(String(item.norad_id), {
              noradId: String(item.norad_id),
              name: item.name_en,
              country: item.country,
              satType: item.sat_type,
              longitude: position.longitude,
              latitude: position.latitude,
              altitude: position.altitude,
              stageName,
            })
          }
        }
      }
    }
    return Array.from(satellitesByNorad.values())
  }

  /**
   * 预加载历史打击方案列表
   */
  const preloadHistoricalPlans = async (taskId?: number, forceReload = false) => {
    const targetTaskId = taskId ?? store.activedTask?.id
    if (!targetTaskId) {
      historicalPlans.value = []
      preloadedHistoricalPlanTaskId.value = null
      return
    }

    if (preloadedHistoricalPlanTaskId.value === targetTaskId && historicalPlans.value.length && !forceReload) return

    const res = await getStrikePlanList(targetTaskId)
    if (res.code === 200) {
      historicalPlans.value = res.data
      preloadedHistoricalPlanTaskId.value = targetTaskId
    } else {
      historicalPlans.value = []
      preloadedHistoricalPlanTaskId.value = null
    }
  }

  /**
   * 加载场景数据（卫星、武器、基站、导弹基地）
   * @param blueCountries 蓝方国家列表，用于筛选卫星
   * @param redCountries 红方国家列表，用于筛选武器
   * @param onDataLoaded 数据加载完成后的回调
   */
  const loadSceneData = async (
    blueCountries: string[],
    redCountries: string[],
    onDataLoaded: (resetEntities: boolean) => void,
    resetEntities = false
  ) => {
    const taskId = store.activedTask?.id
    if (!taskId) {
      clearSatelliteTleCache()
      taskSatellites.value = []
      taskWeapons.value = []
      baseStations.value = []
      missileBases.value = []
      onDataLoaded(true)
      return
    }

    loadingScene.value = true
    try {
      const [satelliteRes, weaponRes, groundStationRes, missileBaseRes] = await Promise.all([
        getBattleSegmentSatellites(
          taskId,
          undefined,
          blueCountries.length ? blueCountries : undefined
        ),
        getTaskWeapons(taskId, redCountries.length ? redCountries : undefined),
        getGroundStationList({ type: '', name: '', country: '' }),
        getMissileBaseListAll({ country: '', name: '' }),
      ])

      if (satelliteRes.code === 200 && satelliteRes.data) {
        taskSatellites.value = flattenStepSatellites(satelliteRes.data)
      } else {
        taskSatellites.value = []
      }

      await ensureSatelliteTleCache(taskId, taskSatellites.value)

      if (weaponRes.code === 200 && weaponRes.data?.weapons) {
        taskWeapons.value = weaponRes.data.weapons.filter(
          (weapon) => Number.isFinite(weapon.longitude) && Number.isFinite(weapon.latitude)
        )
      } else {
        taskWeapons.value = []
      }

      if (groundStationRes.code === 200 && groundStationRes.data) {
        baseStations.value = groundStationRes.data
      } else {
        baseStations.value = []
      }

      if (missileBaseRes.code === 200 && missileBaseRes.data) {
        missileBases.value = missileBaseRes.data
      } else {
        missileBases.value = []
      }

      onDataLoaded(resetEntities)
    } catch (error) {
      console.error(error)
      const { ElMessage } = await import('element-plus')
      ElMessage.error('仿真场景加载失败')
    } finally {
      loadingScene.value = false
    }
  }

  return {
    // 状态
    taskSatellites,
    taskWeapons,
    missileBases,
    baseStations,
    historicalPlans,
    preloadedHistoricalPlanTaskId,
    loadingScene,
    // TLE 缓存
    clearSatelliteTleCache,
    ensureSatelliteTleCache,
    // 位置计算
    getSatellitePositionAtDate,
    getSatellitePositionAtTime,
    buildSatelliteOrbitPositions,
    // 数据加载
    flattenStepSatellites,
    preloadHistoricalPlans,
    loadSceneData,
  }
}
