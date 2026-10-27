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

/** 多视图共享的当前推演时刻 */
const currentSimulationTime = ref<Date>(new Date())
/** 当前聚焦的卫星 NORAD；null 表示未选中，会触发 Cesium 相机飞赴 */
const activeNoradId = ref<number | null>(null)
/** 当前聚焦的地面设施 ID；null 表示未选中 */
const activeInfrastructureId = ref<string | null>(null)
/** 时间轴是否处于播放中 */
const isTimelinePlaying = ref<boolean>(false)

/**
 * 统一时间轴与 3D / 拓扑 / 甘特图的时钟、选中项和播放状态。
 * 状态为模块级单例，各页面调用得到同一组 ref。
 *
 * @returns 共享时钟、选中项及更新方法
 */
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
