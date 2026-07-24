import { ref } from 'vue'

const satelliteProfileVisible = ref(false)
const satelliteProfileNorad = ref<number | null>(null)

export function useSatelliteProfileDialog() {
  const openSatelliteProfile = (norad: number) => {
    const normalizedNorad = Number(norad)
    if (!Number.isFinite(normalizedNorad) || normalizedNorad <= 0) return

    satelliteProfileNorad.value = normalizedNorad
    satelliteProfileVisible.value = true
  }

  const closeSatelliteProfile = () => {
    satelliteProfileVisible.value = false
    satelliteProfileNorad.value = null
  }

  return {
    satelliteProfileVisible,
    satelliteProfileNorad,
    closeSatelliteProfile,
    openSatelliteProfile,
  }
}
