/**
 * 方案对比多视图管理
 * 负责创建/销毁/刷新对比视图中的多个 Cesium Viewer 实例
 */
import { nextTick, ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import type { BlueSatelliteRecord, HistoricalPlanCard } from '../types'
import { createSatelliteStrikeStarDataUri } from '../helpers/svgIcons'

// ─── 常量 ───
const CHINA_OVERVIEW_LON = 107.4
const CHINA_OVERVIEW_LAT = 33.42
const CHINA_OVERVIEW_HEIGHT = 40000000

export function useCompareViewers(
  _viewer: ShallowRef<Cesium.Viewer | null>,
  blueSatellites: { value: BlueSatelliteRecord[] },
  selectedComparePlanCards: { value: HistoricalPlanCard[] },
  completedTargetSatelliteIds: { value: Set<string> },
  activeLayerOption: { value: string },
  selectedHistoricalPlanDetail: { value: any | null }
) {
  const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL as string | undefined

  const compareViewers = ref<Cesium.Viewer[]>([])
  const compareViewerContainers = ref<(HTMLDivElement | null)[]>([])
  const compareViewerCredits = ref<(Element | null)[]>([])

  const setCompareViewerContainer = (element: Element | null, index: number) => {
    compareViewerContainers.value[index] = element as HTMLDivElement | null
  }

  const setCompareViewerCredit = (element: Element | null, index: number) => {
    compareViewerCredits.value[index] = element
  }

  const hasValidContainerSize = (element: HTMLElement | null): boolean => {
    if (!element) return false
    return element.clientWidth > 0 && element.clientHeight > 0
  }

  const destroyCompareViewers = () => {
    compareViewers.value.forEach((compareViewer) => {
      if (!compareViewer.isDestroyed()) {
        compareViewer.destroy()
      }
    })
    compareViewers.value = []
  }

  const waitForCompareContainersReady = async (expectedCount: number, maxFrames = 120): Promise<boolean> => {
    for (let index = 0; index < maxFrames; index += 1) {
      const readyCount = compareViewerContainers.value
        .slice(0, expectedCount)
        .filter((element) => hasValidContainerSize(element)).length
      if (readyCount === expectedCount) return true
      await nextTick()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    return false
  }

  const createCompareViewer = (container: HTMLDivElement, creditContainer?: Element | null): Cesium.Viewer => {
    const compareViewer = new Cesium.Viewer(container, {
      scene3DOnly: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      baseLayer: false,
      baseLayerPicker: false,
      infoBox: false,
      selectionIndicator: false,
      creditContainer: creditContainer ?? undefined,
    })

    compareViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    compareViewer.scene.globe.depthTestAgainstTerrain = false
    compareViewer.scene.requestRenderMode = true
    compareViewer.scene.maximumRenderTimeChange = 0.1
    compareViewer.clock.shouldAnimate = false
    compareViewer.useDefaultRenderLoop = true

    if (MATERIAL_URL) {
      compareViewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `${MATERIAL_URL}/{z}/{x}/{y}.png`,
          credit: 'credit',
        })
      )
    }

    return compareViewer
  }

  const renderCompareViewer = (compareViewer: Cesium.Viewer, card: HistoricalPlanCard) => {
    compareViewer.entities.removeAll()

    const missionWindows = card.detail.plan_summary.mission_windows ?? []
    const targetIds = new Set(missionWindows.map((item) => String(item.satellite_id)))

    blueSatellites.value.forEach((satellite) => {
      const isStruck = targetIds.has(satellite.noradId)
      const position = Cesium.Cartesian3.fromDegrees(satellite.longitude, satellite.latitude, satellite.altitude)
      compareViewer.entities.add({
        id: `compare-satellite-${card.key}-${satellite.noradId}`,
        name: satellite.name,
        position,
        billboard: isStruck
          ? new Cesium.BillboardGraphics({
              image: createSatelliteStrikeStarDataUri(Cesium.Color.fromCssColorString('#ef6b73'), 0.88),
              scale: 0.88,
              width: 24.64,
              height: 24.64,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
            })
          : undefined,
        point: isStruck
          ? undefined
          : new Cesium.PointGraphics({
              pixelSize: 9,
              color: Cesium.Color.fromCssColorString('#4ea6ff'),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
            }),
        label: new Cesium.LabelGraphics({
          text: isStruck ? `${satellite.name}（已打击）` : satellite.name,
          font: '11px sans-serif',
          fillColor: isStruck ? Cesium.Color.fromCssColorString('#ef6b73') : Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.35),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000),
        }),
      })
    })

    compareViewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(CHINA_OVERVIEW_LON, CHINA_OVERVIEW_LAT, CHINA_OVERVIEW_HEIGHT),
      orientation: { heading: 0.0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0.0 },
    })
    compareViewer.scene.requestRender()
  }

  const renderStrikeCompareViewer = (compareViewer: Cesium.Viewer, mode: 'before' | 'after') => {
    compareViewer.entities.removeAll()

    blueSatellites.value.forEach((satellite) => {
      const isCompleted = completedTargetSatelliteIds.value.has(satellite.noradId)
      if (mode === 'after' && isCompleted) return

      const position = Cesium.Cartesian3.fromDegrees(satellite.longitude, satellite.latitude, satellite.altitude)
      compareViewer.entities.add({
        id: `strike-compare-${mode}-${satellite.noradId}`,
        name: satellite.name,
        position,
        point: new Cesium.PointGraphics({
          pixelSize: 9,
          color: Cesium.Color.fromCssColorString('#4ea6ff'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        }),
        label: new Cesium.LabelGraphics({
          text: satellite.name,
          font: '11px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -22),
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.35),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 50000000),
        }),
      })
    })

    compareViewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(CHINA_OVERVIEW_LON, CHINA_OVERVIEW_LAT, CHINA_OVERVIEW_HEIGHT),
      orientation: { heading: 0.0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0.0 },
    })
    compareViewer.scene.requestRender()
  }

  const refreshCompareViewers = () => {
    if (activeLayerOption.value === '方案对比') {
      selectedComparePlanCards.value.forEach((card, index) => {
        const compareViewer = compareViewers.value[index]
        if (compareViewer) {
          renderCompareViewer(compareViewer, card)
        }
      })
      return
    }

    if (activeLayerOption.value === '对比视图' && compareViewers.value.length >= 2) {
      renderStrikeCompareViewer(compareViewers.value[0], 'before')
      renderStrikeCompareViewer(compareViewers.value[1], 'after')
    }
  }

  const initCompareViewers = async () => {
    if (activeLayerOption.value !== '方案对比' && activeLayerOption.value !== '对比视图') return

    destroyCompareViewers()

    if (activeLayerOption.value === '对比视图') {
      if (!selectedHistoricalPlanDetail.value) return

      const ready = await waitForCompareContainersReady(2)
      if (!ready) return

      compareViewers.value = [0, 1].map((index) => {
        const container = compareViewerContainers.value[index]
        if (!container) {
          throw new Error('compare viewer container missing')
        }
        return createCompareViewer(container, compareViewerCredits.value[index])
      })

      refreshCompareViewers()
      return
    }

    const planCards = selectedComparePlanCards.value
    if (!planCards.length) return

    const ready = await waitForCompareContainersReady(planCards.length)
    if (!ready) return

    compareViewers.value = planCards.map((card, index) => {
      const container = compareViewerContainers.value[index]
      if (!container) {
        throw new Error('compare viewer container missing')
      }
      const compareViewer = createCompareViewer(container, compareViewerCredits.value[index])
      renderCompareViewer(compareViewer, card)
      return compareViewer
    })
  }

  return {
    compareViewers,
    compareViewerContainers,
    compareViewerCredits,
    setCompareViewerContainer,
    setCompareViewerCredit,
    destroyCompareViewers,
    refreshCompareViewers,
    initCompareViewers,
  }
}
