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
} from '@/api/strike-plan/satellite-strike-plan-api'
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

/**
 * 仿真/电子战场景数据 Hook：加载任务卫星与武器、TLE 缓存、轨道传播与历史方案预取。
 *
 * @returns 场景 reactive 状态、TLE 缓存方法、位置计算与 `loadSceneData` 入口
 */
export function useSceneData() {
  /** 布局 Store，读取当前激活任务 */
  const store = useLayoutStore()

  // ─── 响应式状态 ───
  /** 当前任务蓝方卫星（含适配进同一集合的地面站） */
  const taskSatellites = ref<BlueSatelliteRecord[]>([])
  /** 当前任务红方武器 */
  const taskWeapons = ref<Weapon[]>([])
  /** 导弹基地列表，供场景设施图层使用 */
  const missileBases = ref<MissileBaseInfo[]>([])
  /** 地面站 / 数据中心列表 */
  const baseStations = ref<BaseStationInfo[]>([])
  /** 已预加载的历史打击方案 */
  const historicalPlans = ref<StrikePlanV2Extended[]>([])
  /** 历史方案缓存所属任务 ID；切换任务或强制刷新时失效 */
  const preloadedHistoricalPlanTaskId = ref<number | null>(null)
  /** 场景数据是否正在加载 */
  const loadingScene = ref(false)

  // ─── TLE 缓存（非响应式，性能优先） ───
  /** NORAD → TLE 两行根数 */
  const satelliteTleCache = new Map<string, SatelliteTle>()
  /** NORAD → 已解析的 satrec，避免重复 twoline2satrec */
  const satelliteSatrecCache = new Map<string, ReturnType<typeof satellitejs.twoline2satrec>>()
  /** 当前 TLE 缓存所属任务 ID；与请求任务不一致时整表重拉 */
  let cachedSatelliteTleTaskId: number | null = null

  /**
   * 清空 TLE 与 satrec 缓存，并作废任务归属标记。
   * 无激活任务或任务切换前调用。
   */
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
      /** 场景内去重后的 NORAD 列表 */
      const norads = Array.from(
        new Set(satellites.map((satellite) => String(satellite.noradId).trim()).filter(Boolean)),
      )
      /** 缓存缺失或两行根数无效的 NORAD */
      const missingFromCache = norads.filter((noradId) => {
        /** 该 NORAD 已缓存的 TLE */
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

    /** 去重后的 NORAD 字符串，保留原始键用于回写缓存 */
    const noradIds = Array.from(
      new Set(satellites.map((satellite) => String(satellite.noradId).trim()).filter(Boolean)),
    )
    /** 可转为数字的 NORAD，作为 TLE 接口查询参数 */
    const norads = noradIds.map((id) => Number(id)).filter(Number.isFinite)

    if (norads.length === 0) {
      cachedSatelliteTleTaskId = taskId
      return
    }

    /** TLE 批量查询响应 */
    const tleDataRes = await getSatelliteTLEData({ norads })
    const { ElMessage } = await import('element-plus')

    if (tleDataRes.code !== 200) {
      /** 带任务与状态码的失败说明，同时用于提示和抛错 */
      const message = tleDataRes.msg || `获取卫星 TLE 失败（taskId=${taskId}，code=${tleDataRes.code}）`
      ElMessage.error(message)
      throw new Error(message)
    }

    if (!Array.isArray(tleDataRes.data)) {
      /** 数据结构不符时的诊断信息，不把非法 data 当成空列表继续仿真 */
      const message = `卫星 TLE 接口返回 data 非数组（taskId=${taskId}）`
      ElMessage.error(message)
      throw new Error(message)
    }

    tleDataRes.data.forEach((item) => {
      /** 缓存键，与场景卫星 noradId 字符串对齐 */
      const noradKey = String(item?.noradId ?? '').trim()
      /** 该星两行根数；无效条目不写入缓存，稍后统一报缺失 */
      const tle = item?.satelliteTleResp
      if (!noradKey || !tle || !hasValidTle(tle.line1, tle.line2)) return
      satelliteTleCache.set(noradKey, tle)
    })

    cachedSatelliteTleTaskId = taskId

    /** 接口未返回或 line1/line2 无效的 NORAD */
    const missingNorads: string[] = []
    for (const noradId of noradIds) {
      /** 回写后的缓存条目 */
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
    /** 已解析的 satrec */
    const cached = satelliteSatrecCache.get(noradId)
    if (cached) return cached
    /** 由两行根数解析出的轨道记录 */
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
    /** 档案中的轨道周期（分钟）；有效时优先于 TLE 平均运动 */
    const detailCycle = Number(detail?.cycle)
    if (Number.isFinite(detailCycle) && detailCycle > 0) {
      return detailCycle
    }

    /** satrec 平均运动（弧度/分钟），用于反推周期 */
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
    /** 错误信息与缓存键使用的 NORAD 字符串 */
    const noradId = String(satellite.noradId)
    if (!currentDate || Number.isNaN(currentDate.getTime())) {
      throw new SatelliteScenePositionError(noradId, '缺少有效仿真时刻')
    }

    /** 该星已缓存的 TLE；缺失时禁止回退到静态经纬度 */
    const tleData = satelliteTleCache.get(noradId)
    if (!tleData || !hasValidTle(tleData.line1, tleData.line2)) {
      throw new SatelliteScenePositionError(noradId, '缺少有效 TLE，请先成功执行 ensureSatelliteTleCache')
    }

    /** 传播用 satrec */
    const satrec = getSatelliteSatrec(noradId, tleData)
    if (!satrec) {
      throw new SatelliteScenePositionError(noradId, 'TLE 无法解析为 satrec')
    }

    try {
      /** SGP4 传播得到的位置与速度（千米） */
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
      /** 非业务异常的原始信息，附在位置错误上便于定位 */
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
    /** 轨道采样使用的 NORAD 与 TLE */
    const noradId = String(satellite.noradId)
    const tleData = satelliteTleCache.get(noradId)
    if (!tleData || !hasValidTle(tleData.line1, tleData.line2)) {
      throw new SatelliteScenePositionError(noradId, '缺少有效 TLE，无法绘制轨道')
    }

    /** 轨道传播记录 */
    const satrec = getSatelliteSatrec(noradId, tleData)
    if (!satrec) {
      throw new SatelliteScenePositionError(noradId, 'TLE 无法解析为 satrec')
    }

    /** 一圈轨道的周期（分钟） */
    const periodMinutes = getSatellitePeriodMinutes(satrec, detail)
    if (!Number.isFinite(periodMinutes) || periodMinutes <= 0) {
      throw new SatelliteScenePositionError(noradId, '无法计算轨道周期')
    }

    /** 采样起点，沿轨道向前推一个周期 */
    const currentDate = Cesium.JulianDate.toDate(currentTime)
    /** 采样份数：每分钟约 6 点，限制在 120–360 之间 */
    const segmentCount = Math.max(120, Math.min(360, Math.ceil(periodMinutes * 6)))
    /** 一圈轨道的世界坐标折线点 */
    const positions: Cesium.Cartesian3[] = []

    for (let index = 0; index <= segmentCount; index += 1) {
      /** 当前采样在周期中的比例，0 到 1 */
      const ratio = index / segmentCount
      /** 对应的绝对时刻 */
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
    /** NORAD → 卫星记录，同星多阶段时后者覆盖前者 */
    const satellitesByNorad = new Map<string, BlueSatelliteRecord>()
    /** 缺少 NORAD 或有效坐标、不能进入场景的条目 */
    const skipped: StepSatelliteGeoSkip[] = []

    for (const step of items) {
      /** 阶段名，缺省时标为「未知阶段」便于错误提示定位 */
      const stageName = step.taskStepResp?.name?.trim() || '未知阶段'
      for (const structure of step.structureList ?? []) {
        for (const item of structure.gjList ?? []) {
          /** 卫星 NORAD；空值记入 skipped 而不是丢弃 */
          const noradId = String(item.norad_id ?? '').trim()
          if (!noradId) {
            skipped.push({ noradId: '?', name: item.name_en, stageName })
            continue
          }

          /** 接口给出的经纬高；任一轴非有限数则视为无效坐标 */
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
    /** 显式任务优先，否则使用当前激活任务 */
    const targetTaskId = taskId ?? store.activedTask?.id
    if (!targetTaskId) {
      historicalPlans.value = []
      preloadedHistoricalPlanTaskId.value = null
      return
    }

    if (preloadedHistoricalPlanTaskId.value === targetTaskId && historicalPlans.value.length && !forceReload) return

    /** 历史方案列表响应 */
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
    /** 当前任务；缺失时清空场景并通知调用方重置实体 */
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
        /** 卫星步骤加载失败说明 */
        const message =
          satelliteRes.msg || `加载任务卫星步骤失败（taskId=${taskId}，code=${satelliteRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }

      /** 扁平化后的有效卫星与缺坐标条目 */
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
        /** 武器列表加载失败说明 */
        const message = weaponRes.msg || `加载任务武器失败（taskId=${taskId}，code=${weaponRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }
      /** 经纬度不是有限数的武器，不能进入地图 */
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
        /** 地面站列表加载失败说明 */
        const message =
          groundStationRes.msg || `加载地面站列表失败（code=${groundStationRes.code}）`
        ElMessage.error(message)
        throw new Error(message)
      }
      baseStations.value = groundStationRes.data

      if (missileBaseRes.code !== 200 || !missileBaseRes.data) {
        missileBases.value = []
        /** 导弹基地列表加载失败说明 */
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
