import type { SatelliteAnalysisData } from '@/api/task/task'

/** 武器提取所需的最小武器字段（兼容 task / electronic 两套 Weapon） */
export interface BattleGlobeWeaponSource {
  /** 武器 ID */
  id?: string
  /** 武器名称 */
  name?: string
  /** 武器纬度 */
  latitude?: string | number
  /** 武器经度 */
  longitude?: string | number
  /** 武器类型 */
  type?: string
  /** 武器所属国家 */
  country?: string
}

/** 武器提取所需的最小卫星矩阵结构（兼容 task / electronic 两套类型） */
export interface BattleGlobeWeaponMatrixSource {
  /** 打击卫星的武器列表 */
  weapons?: BattleGlobeWeaponSource[] | null
  /** 卫星-接收站窗口列表 */
  stationWindows?: BattleGlobeWeaponStationWindowSource[] | null
}

/** 武器提取所需的最小接收站窗口结构 */
export interface BattleGlobeWeaponStationWindowSource {
  /** 打击接收站的武器列表 */
  weapons?: BattleGlobeWeaponSource[] | null
}

/** 整体态势地球渲染用武器数据 */
export interface BattleGlobeWeapon {
  /** 武器 ID */
  id: string
  /** 武器名称 */
  name: string
  /** 武器纬度（度） */
  latitude: number
  /** 武器经度（度） */
  longitude: number
  /** 武器类型 */
  type: string
  /** 武器所属国家 */
  country: string
}

/**
 * 解析武器经纬度字符串。
 *
 * @param value 纬度或经度字符串
 * @returns 数值；无效时返回 null
 */
const parseWeaponCoordinate = (value?: string | number | null): number | null => {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 将武器对象转为地球渲染数据；坐标无效时返回 null。
 *
 * @param weapon 武器对象
 * @returns 地球渲染武器或 null
 */
const toBattleGlobeWeapon = (weapon: BattleGlobeWeaponSource): BattleGlobeWeapon | null => {
  if (!weapon?.id) return null

  const latitude = parseWeaponCoordinate(weapon.latitude)
  const longitude = parseWeaponCoordinate(weapon.longitude)
  if (latitude == null || longitude == null) return null
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null

  return {
    id: weapon.id,
    name: weapon.name || weapon.id,
    latitude,
    longitude,
    type: weapon.type || '',
    country: weapon.country || '',
  }
}

/**
 * 从卫星矩阵列表汇总武器（含卫星武器与接收站窗口武器），按 ID 去重。
 *
 * @param matrices 卫星矩阵列表
 * @returns 去重后的武器列表
 */
export const buildBattleGlobeWeaponsFromSatelliteMatrices = (
  matrices: BattleGlobeWeaponMatrixSource[] | null | undefined
): BattleGlobeWeapon[] => {
  if (!matrices?.length) return []

  const weaponMap = new Map<string, BattleGlobeWeapon>()

  matrices.forEach((matrix) => {
    ;(matrix.weapons || []).forEach((weapon) => {
      const item = toBattleGlobeWeapon(weapon)
      if (item && !weaponMap.has(item.id)) {
        weaponMap.set(item.id, item)
      }
    })

    ;(matrix.stationWindows || []).forEach((window) => {
      ;(window.weapons || []).forEach((weapon) => {
        const item = toBattleGlobeWeapon(weapon)
        if (item && !weaponMap.has(item.id)) {
          weaponMap.set(item.id, item)
        }
      })
    })
  })

  return Array.from(weaponMap.values())
}

/**
 * 从任务分析结果汇总全部可渲染武器。
 *
 * @param data 任务算法分析结果
 * @returns 去重后的武器列表
 */
export const buildBattleGlobeWeapons = (
  data: SatelliteAnalysisData | null | undefined
): BattleGlobeWeapon[] => {
  if (!data?.levelSeriesEntities?.length) return []

  const matrices = data.levelSeriesEntities.flatMap((entity) => entity.satelliteMatrixList || [])
  return buildBattleGlobeWeaponsFromSatelliteMatrices(matrices)
}

/**
 * 从当前系列矩阵汇总可渲染武器（分析结果未返回时的兜底）。
 *
 * @param matrix 当前系列算法矩阵
 * @returns 去重后的武器列表
 */
export const buildBattleGlobeWeaponsFromMatrix = (
  matrix: { satelliteMatrixList?: BattleGlobeWeaponMatrixSource[] | null } | null | undefined
): BattleGlobeWeapon[] => buildBattleGlobeWeaponsFromSatelliteMatrices(matrix?.satelliteMatrixList)

/**
 * 按武器名称解析武器 ID（名称重复时返回首个匹配项）。
 *
 * @param weapons 武器列表
 * @param weaponName 武器名称
 * @returns 武器 ID 或 null
 */
export const resolveWeaponIdByName = (
  weapons: BattleGlobeWeapon[],
  weaponName?: string | null
): string | null => {
  if (!weaponName) return null
  const normalized = weaponName.trim()
  if (!normalized) return null
  const matched = weapons.find((weapon) => weapon.name === normalized)
  return matched?.id ?? null
}
