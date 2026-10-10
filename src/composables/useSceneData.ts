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
import type { BlueSatelliteRecord } from '@/types/strike'
import type { Weapon } from '@/types/dashboard'
import type { SatelliteDetail, SatelliteTle, StepSatellite } from '@/types/cesium/satellite'
import { hasValidTle } from '@/utils/buildBattleGlobeSatellites'

/** 步骤卫星扁平化时因缺少坐标被跳过的条目 */
export interface StepSatelliteGeoSkip {
  /** NORAD 编号字符串 */
  noradId: string
  /** 卫星英文名（接口原值） */
  name?: string
  /** 所属阶段名 */
  stageName: string
}

/** flattenStepSatellites 返回结构 */
export interface FlattenStepSatellitesResult {
  /** 有效坐标的卫星 */
  satellites: BlueSatelliteRecord[]
  /** 缺少有效 geoCoordinates 的条目 */
  skipped: StepSatelliteGeoSkip[]
}

/**
 * 仿真场景中卫星位置计算失败（缺少 TLE 或传播失败），禁止回退到静态经纬度。
 */
export class SatelliteScenePositionError extends Error {
  /** NORAD 编号 */
  readonly noradId: string

  /**
   * @param noradId NORAD
   * @param reason 原因说明
   */
  constructor(noradId: string, reason: string) {
    super(`卫星 NORAD ${noradId} 位置计算失败：${reason}`)
    this.name = 'SatelliteScenePositionError'
    this.noradId = noradId
  }
}

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
   * 确保任务内全部卫星 TLE 已加载且有效；任一缺失或接口失败时抛出并提示。
   *
   * @param taskId 任务 ID
   * @param satellites 场景内卫星列表
   * @throws 接口失败或存在 NORAD 无有效 TLE
   */
  const ensureSatelliteTleCache = async (taskId: number, satellites: BlueSatelliteRecord[]) => {
    if (cachedSatelliteTleTaskId === taskId && satelliteTleCache.size > 0) {
      const norads = Array.from(
        new Set(satellites.map((satellite) => String(satellite.noradId).trim()).filter(Boolean)),
      )
      const missingFromCache = norads.filter((noradId) => {
        const tle = satelliteTleCache.get(noradId)
        return !tle || !hasValidTle(tle.line1, tle.line2)
      })
      if (missingFromCache.length) {
        throw new Error(`TLE 缓存不完整，缺少 NORAD：${missingFromCache.join('、')}`)
      }
      return
    }

    satelliteTleCache.clear()
    satelliteSatrecCache.clear()

    const noradIds = Array.from(
      new Set(satellites.map((satellite) => String(satellite.noradId).trim()).filter(Boolean)),
    )
    const norads = noradIds.map((id) => Number(id)).filter(Number.isFinite)

    if (norads.length === 0) {
      cachedSatelliteTleTaskId = taskId
      return
    }

    const tleDataRes = await getSatelliteTLEData({ norads })
    const { ElMessage } = await import('element-plus')

    if (tleDataRes.code !== 200) {
      const message = tleDataRes.msg || `获取卫星 TLE 失败（taskId=${taskId}，code=${tleDataRes.code}）`
      ElMessage.error(message)
      throw new Error(message)
    }

    if (!Array.isArray(tleDataRes.data)) {
      const message = `卫星 TLE 接口返回 data 非数组（taskId=${taskId}）`
      ElMessage.error(message)
      throw new Error(message)
    }

    tleDataRes.data.forEach((item) => {
      const noradKey = String(item?.noradId ?? '').trim()
      const tle = item?.satelliteTleResp
      if (!noradKey || !tle || !hasValidTle(tle.line1, tle.line2)) return
      satelliteTleCache.set(noradKey, tle)
    })

    cachedSatelliteTleTaskId = taskId

    const missingNorads: string[] = []
    for (const noradId of noradIds) {
      const tle = satelliteTleCache.get(noradId)
      if (!tle || !hasValidTle(tle.line1, tle.line2)) {
        missingNorads.push(noradId)
      }
    }

    if (missingNorads.length) {
      console.warn(
        `[场景仿真] TLE 接口未返回或 line1/line2 无效的卫星（taskId=${taskId}）：`,
        missingNorads,
      )
      missingNorads.forEach((noradId) => {
        console.warn(
          `[场景仿真] 卫星 NORAD ${noradId} 缺少有效 TLE，无法仿真定位。请检查 TLE 接口或入库数据。`,
        )
        ElMessage.error(`卫星 NORAD ${noradId} 缺少有效 TLE，无法仿真定位。请检查 TLE 接口或入库数据。`)
      })
      throw new Error(`缺少有效 TLE 的 NORAD：${missingNorads.join('、')}`)
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
    detail?: SatelliteDetail | null,
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

  /**
   * 根据 Date 对象计算卫星三维位置（必须已有有效 TLE 缓存）。
   *
   * @param satellite 卫星记录
   * @param currentDate 当前时刻
   * @returns ECI 米制坐标
   * @throws {SatelliteScenePositionError} 缺少时间、TLE 或 SGP4 失败
   */
  const getSatellitePositionAtDate = (satellite: BlueSatelliteRecord, currentDate?: Date): Cesium.Cartesian3 => {
    const noradId = String(satellite.noradId)
    if (!currentDate || Number.isNaN(currentDate.getTime())) {
      throw new SatelliteScenePositionError(noradId, '缺少有效仿真时刻')
    }

    const tleData = satelliteTleCache.get(noradId)
    if (!tleData || !hasValidTle(tleData.line1, tleData.line2)) {
      throw new SatelliteScenePositionError(noradId, '缺少有效 TLE，请先成功执行 ensureSatelliteTleCache')
    }

    const satrec = getSatelliteSatrec(noradId, tleData)
    if (!satrec) {
      throw new SatelliteScenePositionError(noradId, 'TLE 无法解析为 satrec')
    }

    try {
      const positionAndVelocity = satellitejs.propagate(satrec, currentDate)
      if (!positionAndVelocity?.position) {
        throw new SatelliteScenePositionError(noradId, 'SGP4 传播未返回位置')
      }

      return new Cesium.Cartesian3(
        positionAndVelocity.position.x * 1000,
        positionAndVelocity.position.y * 1000,
        positionAndVelocity.position.z * 1000,
      )
    } catch (error) {
      if (error instanceof SatelliteScenePositionError) throw error
      const detail = error instanceof Error ? error.message : String(error)
      throw new SatelliteScenePositionError(noradId, `SGP4 传播异常：${detail}`)
    }
  }

  /** 根据 JulianDate 计算卫星三维位置 */
  const getSatellitePositionAtTime = (satellite: BlueSatelliteRecord, currentTime?: Cesium.JulianDate): Cesium.Cartesian3 => {
    if (!currentTime) {
      throw new SatelliteScenePositionError(String(satellite.noradId), '缺少 Cesium 时钟时刻')
    }
    return getSatellitePositionAtDate(satellite, Cesium.JulianDate.toDate(currentTime))
  }

  /** 构建卫星一个轨道周期的轨迹点列表 */
  const buildSatelliteOrbitPositions = (
    satellite: BlueSatelliteRecord,
    currentTime: Cesium.JulianDate,
    detail?: SatelliteDetail | null,
  ): Cesium.Cartesian3[] => {
    const noradId = String(satellite.noradId)
    const tleData = satelliteTleCache.get(noradId)
    if (!tleData || !hasValidTle(tleData.line1, tleData.line2)) {
      throw new SatelliteScenePositionError(noradId, '缺少有效 TLE，无法绘制轨道')
    }

    const satrec = getSatelliteSatrec(noradId, tleData)
    if (!satrec) {
      throw new SatelliteScenePositionError(noradId, 'TLE 无法解析为 satrec')
    }

    const periodMinutes = getSatellitePeriodMinutes(satrec, detail)
    if (!Number.isFinite(periodMinutes) || periodMinutes <= 0) {
      throw new SatelliteScenePositionError(noradId, '无法计算轨道周期')
    }

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
   * 将任务步骤数据中的卫星扁平化处理，并记录缺少 geoCoordinates 的条目（不静默跳过）。
   *
   * @param items 步骤卫星列表
   * @returns 有效卫星与跳过条目
   */
  const flattenStepSatellites = (items: StepSatellite[]): FlattenStepSatellitesResult => {
    const satellitesByNorad = new Map<string, BlueSatelliteRecord>()
    const skipped: StepSatelliteGeoSkip[] = []

    for (const step of items) {
      const stageName = step.taskStepResp?.name?.trim() || '未知阶段'
      for (const structure of step.structureList ?? []) {
        for (const item of structure.gjList ?? []) {
          const noradId = String(item.norad_id ?? '').trim()
          if (!noradId) {
            skipped.push({ noradId: '?', name: item.name_en, stageName })
            continue
          }

          const position = item.geoCoordinates
          if (
            position &&
            Number.isFinite(position.longitude) &&
            Number.isFinite(position.latitude) &&
            Number.isFinite(position.altitude)
          ) {
            satellitesByNorad.set(noradId, {
              noradId,
              name: item.name_en,
              country: item.country,
              satType: item.sat_type,
              longitude: position.longitude,
              latitude: position.latitude,
              altitude: position.altitude,
              stageName,
            })
          } else {
            skipped.push({ noradId, name: item.name_en, stageName })
          }
        }
      }
    }
    return { satellites: Array.from(satellitesByNorad.values()), skipped }
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
      historicalPlans.value = res.data ?? []
      preloadedHistoricalPlanTaskId.value = targetTaskId
      return
    }
    historicalPlans.value = []
    preloadedHistoricalPlanTaskId.value = null
    const { ElMessage } = await import('element-plus')
    ElMessage.error(res.msg || `加载历史打击方案失败（taskId=${targetTaskId}）`)
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
    resetEntities = false,
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
    const { ElMessage } = await import('element-plus')
    try {
      const [satelliteRes, weaponRes, groundStationRes, missileBaseRes] = await Promise.all([
        getBattleSegmentSatellites(
          taskId,
          undefined,
          blueCountries.length ? blueCountries : undefined,
        ),
        getTaskWeapons(taskId, redCountries.length ? redCountries : undefined),
        getGroundStationList({ type: '', name: '', country: '' }),
        getMissileBaseListAll({ country: '', name: '' }),
      ])

      if (satelliteRes.code !== 200 || !satelliteRes.data) {
        taskSatellites.value = []
        const message =
          satelliteRes.msg || `加载任务卫星步骤失败（taskId=${taskId}，code=${satelliteRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }

      const flattened = flattenStepSatellites(satelliteRes.data)
      if (flattened.skipped.length) {
        flattened.skipped.forEach((item) => {
          ElMessage.error(
            `卫星 NORAD ${item.noradId}${item.name ? `「${item.name}」` : ''} 在阶段「${item.stageName}」缺少有效 geoCoordinates，请检查 battleSegmentSatellites 接口。`,
          )
        })
        throw new Error(`共 ${flattened.skipped.length} 颗卫星缺少有效坐标`)
      }
      taskSatellites.value = flattened.satellites

      await ensureSatelliteTleCache(taskId, taskSatellites.value)

      if (weaponRes.code !== 200 || !weaponRes.data?.weapons) {
        taskWeapons.value = []
        const message = weaponRes.msg || `加载任务武器失败（taskId=${taskId}，code=${weaponRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }
      const invalidWeapons = weaponRes.data.weapons.filter(
        (weapon) => !Number.isFinite(weapon.longitude) || !Number.isFinite(weapon.latitude),
      )
      if (invalidWeapons.length) {
        invalidWeapons.forEach((weapon) => {
          ElMessage.error(`武器「${weapon.name ?? weapon.id ?? '?'}」缺少有效经纬度，请检查 getTaskWeapons 接口。`)
        })
        throw new Error(`共 ${invalidWeapons.length} 个武器缺少有效经纬度`)
      }
      taskWeapons.value = weaponRes.data.weapons

      if (groundStationRes.code !== 200 || !groundStationRes.data) {
        baseStations.value = []
        const message =
          groundStationRes.msg || `加载地面站列表失败（code=${groundStationRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }
      baseStations.value = groundStationRes.data

      if (missileBaseRes.code !== 200 || !missileBaseRes.data) {
        missileBases.value = []
        const message =
          missileBaseRes.msg || `加载导弹基地列表失败（code=${missileBaseRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }
      missileBases.value = missileBaseRes.data

      onDataLoaded(resetEntities)
    } catch (error) {
      console.error(error)
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
