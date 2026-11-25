import { ref, watch } from 'vue'
import { getTaskResources } from '@/api/task/task'
import { useLayoutStore } from '@/store/modules/layout'
import { buildBattleGlobeLayersFromTaskResources } from '@/utils/buildBattleGlobeFromTaskResources'
import { buildC2RowsFromTaskResources } from '@/utils/buildC2ResourceCatalog'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import type { BattleGlobeGroundTarget } from '@/utils/buildBattleGlobeGroundTargets'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'

/**
 * 按当前任务从 `GET /command-task/{id}/resources` 拉取卫星与地面站，供态势地球渲染。
 * 本 composable 仅负责任务挂载资源驱动的静态地球图层。
 */
export const useBattleTaskGlobeResources = () => {
  const store = useLayoutStore()
  const taskGlobeSatellites = ref<BattleGlobeSatellite[]>([])
  const taskGlobeGroundTargets = ref<BattleGlobeGroundTarget[]>([])
  const taskGlobeWeapons = ref<BattleGlobeWeapon[]>([])
  const taskResourcesLoading = ref(false)
  const taskResourcesTaskId = ref<string | null>(null)

  let loadToken = 0

  /**
   * 拉取并转换指定任务的地球渲染资源。
   *
   * @param taskId 任务 ID
   */
  const loadTaskGlobeResources = async (taskId: string | number | null | undefined) => {
    const id = taskId != null ? String(taskId).trim() : ''
    if (!id) {
      taskGlobeSatellites.value = []
      taskGlobeGroundTargets.value = []
      taskGlobeWeapons.value = []
      taskResourcesTaskId.value = null
      store.setC2TaskResourceSatelliteRows([])
      return
    }
    const token = (loadToken += 1)
    taskResourcesLoading.value = true
    try {
      const data = await getTaskResources(id)
      if (token !== loadToken) return
      const { satellites, groundTargets } = buildBattleGlobeLayersFromTaskResources(data)
      taskGlobeSatellites.value = satellites
      taskGlobeGroundTargets.value = groundTargets
      taskGlobeWeapons.value = []
      taskResourcesTaskId.value = id
      store.setC2TaskResourceSatelliteRows(buildC2RowsFromTaskResources(data))
    } catch (error) {
      if (token !== loadToken) return
      console.error('加载任务地球资源失败:', error)
      taskGlobeSatellites.value = []
      taskGlobeGroundTargets.value = []
      taskGlobeWeapons.value = []
      taskResourcesTaskId.value = null
      store.setC2TaskResourceSatelliteRows([])
    } finally {
      if (token === loadToken) {
        taskResourcesLoading.value = false
      }
    }
  }

  /**
   * 监听当前激活任务 ID。
   * 回调不返回清理函数。
   * 作用：任务切换后刷新地图上卫星与地面站的数据源。
   */
  watch(
    () => store.activedTask?.id,
    (taskId) => {
      void loadTaskGlobeResources(taskId)
    },
    { immediate: true },
  )

  return {
    taskGlobeSatellites,
    taskGlobeGroundTargets,
    taskGlobeWeapons,
    taskResourcesLoading,
    taskResourcesTaskId,
    loadTaskGlobeResources,
  }
}