import { ref } from 'vue'

const satelliteProfileVisible = ref(false)
const satelliteProfileNorad = ref<number | null>(null)
/**
 * 卫星详细信息弹窗
 * @returns {
 *   satelliteProfileVisible: 卫星详细信息弹窗是否可见
 *   satelliteProfileNorad: 卫星NORAD编号
 *   closeSatelliteProfile: 关闭卫星详细信息弹窗
 *   openSatelliteProfile: 打开卫星详细信息弹窗
 * }
 */
export function useSatelliteProfileDialog() {
  /**
   * 打开卫星详细信息弹窗
   * @param norad 卫星NORAD编号
   */
  const openSatelliteProfile = (norad: number) => {
    // 将卫星NORAD编号转换为数字
    const normalizedNorad = Number(norad)
    // 如果卫星NORAD编号不是数字或者小于等于0，则返回
    if (!Number.isFinite(normalizedNorad) || normalizedNorad <= 0) return

    // 设置卫星NORAD编号
    satelliteProfileNorad.value = normalizedNorad
    // 设置卫星详细信息弹窗是否可见
    satelliteProfileVisible.value = true
  }

  /**
   * 关闭卫星详细信息弹窗
   */
  const closeSatelliteProfile = () => {
    // 设置卫星详细信息弹窗是否可见为false
    satelliteProfileVisible.value = false
    // 设置卫星NORAD编号为null
    satelliteProfileNorad.value = null
  }

  return {
    // 卫星详细信息弹窗是否可见
    satelliteProfileVisible,
    // 卫星NORAD编号
    satelliteProfileNorad,
    // 关闭卫星详细信息弹窗
    closeSatelliteProfile,
    // 打开卫星详细信息弹窗
    openSatelliteProfile,
  }
}
