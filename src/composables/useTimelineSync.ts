import { ref } from 'vue'

/**
 * [功能]
 * 统一时间轴推演与多视图 (3D Cesium / 2D G6 拓扑 / 甘特图) 交互同步状态管理。
 *
 * [处理规则]
 * - 维护当前推演的统一 Date 时钟
 * - 维护选中的节点/卫星 NORAD 编号，触发 Cesium 视角相机飞赴 (flyTo)
 * - 维护高亮过境窗口
 *
 * [修改约束]
 * - 保持轻量全局状态或单例 Hook
 */

const currentSimulationTime = ref<Date>(new Date())
const activeNoradId = ref<number | null>(null)
const activeInfrastructureId = ref<string | null>(null)
const isTimelinePlaying = ref<boolean>(false)

export function useTimelineSync() {
  /**
   * 更新全局推演时间
   *
   * @param time 当前推演时刻 Date
   */
  const updateSimulationTime = (time: Date) => {
    currentSimulationTime.value = time
  }

  /**
   * 聚焦选中的卫星 NORAD
   *
   * @param norad 卫星 NORAD 编号
   */
  const focusSatellite = (norad: number | null) => {
    activeNoradId.value = norad
  }

  /**
   * 聚焦选中的地面设施
   *
   * @param id 设施 ID
   */
  const focusInfrastructure = (id: string | null) => {
    activeInfrastructureId.value = id
  }

  /**
   * 切换时间轴播放/暂停状态
   *
   * @param playing 是否正在播放
   */
  const setPlayingState = (playing: boolean) => {
    isTimelinePlaying.value = playing
  }

  return {
    currentSimulationTime,
    activeNoradId,
    activeInfrastructureId,
    isTimelinePlaying,
    updateSimulationTime,
    focusSatellite,
    focusInfrastructure,
    setPlayingState,
  }
}
