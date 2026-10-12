import { ref } from 'vue'
import { getAllWeapons } from '@/api/dashboard'
import { getGroundStationList, type BaseStationInfo } from '@/api/system/satellite-system-api'
import type { Weapon } from '@/types/dashboard'

/** 武器库记录索引（武器 ID → 接口记录） */
export type BattleGlobeWeaponRecordMap = Map<string, Weapon>

/** 地面站/数据中心库记录索引（资源 ID → 接口记录） */
export type BattleGlobeGroundStationRecordMap = Map<string, BaseStationInfo>

/**
 * 预加载武器与地面站库数据，供地图 Label 详情与左侧面板共用（右侧面板点击时补齐字段）。
 */
export const useBattleGlobeResourceRecords = () => {
  const weaponRecordById = ref<BattleGlobeWeaponRecordMap>(new Map())
  const groundStationRecordById = ref<BattleGlobeGroundStationRecordMap>(new Map())
  let loadPromise: Promise<void> | null = null

  /**
   * 从武器列表响应构建 ID 索引。
   *
   * @param list 武器列表
   * @returns 武器记录 Map
   */
  const buildWeaponRecordMap = (list: Weapon[]): BattleGlobeWeaponRecordMap => {
    const map = new Map<string, Weapon>()
    for (const weapon of list) {
      const id = String(weapon.id ?? '').trim()
      if (id) map.set(id, weapon)
    }
    return map
  }

  /**
   * 从基站列表响应合并进地面站记录索引。
   *
   * @param list 基站列表
   * @param target 待写入的 Map
   */
  const mergeGroundStationRecords = (list: BaseStationInfo[], target: BattleGlobeGroundStationRecordMap): void => {
    for (const item of list) {
      const id = (item._id || item.name || '').trim()
      if (id) target.set(id, item)
    }
  }

  /**
   * 拉取武器与地面站库（幂等，并发调用共享同一 Promise）。
   */
  const ensureResourceRecordsLoaded = (): Promise<void> => {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      const [weaponRes, groundRes] = await Promise.all([
        getAllWeapons(),
        getGroundStationList({ type: '', name: '', country: '' }),
      ])
      if (weaponRes.code === 200) {
        weaponRecordById.value = buildWeaponRecordMap(weaponRes.data?.weapons ?? [])
      }
      if (groundRes.code === 200) {
        const map = new Map(groundStationRecordById.value)
        mergeGroundStationRecords(groundRes.data ?? [], map)
        groundStationRecordById.value = map
      }
    })()
    return loadPromise
  }

  return {
    weaponRecordById,
    groundStationRecordById,
    ensureResourceRecordsLoaded,
  }
}
