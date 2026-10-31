/**
 * 方案对比多视图管理
 * 负责创建/销毁/刷新对比视图中的多个 Cesium Viewer 实例
 */
import { nextTick, ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import type { BlueSatelliteRecord, HistoricalPlanCard } from '@/types/strike'
import { createSatelliteStrikeStarDataUri } from '@/utils/tools/cesiumEntityIcon'

// ─── 常量 ───
/** 对比视口默认俯视中国的经度（度） */
const CHINA_OVERVIEW_LON = 107.4
/** 对比视口默认俯视中国的纬度（度） */
const CHINA_OVERVIEW_LAT = 33.42
/** 对比视口默认相机高度（米），保证能看到全国范围 */
const CHINA_OVERVIEW_HEIGHT = 40000000

/**
 * 方案对比页多 Cesium 视口生命周期管理。
 *
 * @param _viewer 主视图 Viewer（预留联动）
 * @param blueSatellites 蓝方卫星列表
 * @param selectedComparePlanCards 参与对比的方案卡片
 * @param completedTargetSatelliteIds 已完成打击目标 NORAD 集合
 * @param activeLayerOption 当前图层选项
 * @param selectedHistoricalPlanDetail 选中方案详情
 * @returns 对比 Viewer 数组及创建/销毁/刷新方法
 */
export function useCompareViewers(
  _viewer: ShallowRef<Cesium.Viewer | null>,
  blueSatellites: { value: BlueSatelliteRecord[] },
  selectedComparePlanCards: { value: HistoricalPlanCard[] },
  completedTargetSatelliteIds: { value: Set<string> },
  activeLayerOption: { value: string },
  selectedHistoricalPlanDetail: { value: any | null }
) {
  /** 离线影像瓦片根地址；未配置时对比视口不叠加底图 */
  const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL as string | undefined

  /** 已创建的对比 Cesium Viewer，与方案卡片或打击前后两栏一一对应 */
  const compareViewers = ref<Cesium.Viewer[]>([])
  /** 各对比视口的 DOM 容器，由模板 ref 回调写入 */
  const compareViewerContainers = ref<(HTMLDivElement | null)[]>([])
  /** 各对比视口的 Cesium 版权容器，避免默认版权条撑开布局 */
  const compareViewerCredits = ref<(Element | null)[]>([])

  /**
   * 记录第 index 个对比视口的 DOM 容器。
   *
   * @param element 模板 ref 传入的元素，卸载时为 null
   * @param index 视口序号
   */
  const setCompareViewerContainer = (element: Element | null, index: number) => {
    compareViewerContainers.value[index] = element as HTMLDivElement | null
  }

  /**
   * 记录第 index 个对比视口的版权容器。
   *
   * @param element 版权 DOM，卸载时为 null
   * @param index 视口序号
   */
  const setCompareViewerCredit = (element: Element | null, index: number) => {
    compareViewerCredits.value[index] = element
  }

  /**
   * 容器是否已完成布局并具有非零尺寸。
   * Cesium 在宽高为 0 时创建 Viewer 会得到空白画布。
   *
   * @param element 待检查的容器
   * @returns 宽高均大于 0 时为 true
   */
  const hasValidContainerSize = (element: HTMLElement | null): boolean => {
    if (!element) return false
    return element.clientWidth > 0 && element.clientHeight > 0
  }

  /**
   * 销毁全部对比 Viewer 并清空实例列表。
   * 已销毁的实例跳过，避免重复 destroy 抛错。
   */
  const destroyCompareViewers = () => {
    compareViewers.value.forEach((compareViewer) => {
      if (!compareViewer.isDestroyed()) {
        compareViewer.destroy()
      }
    })
    compareViewers.value = []
  }

  /**
   * 等待前 expectedCount 个容器完成布局。
   *
   * @param expectedCount 需要就绪的容器数量
   * @param maxFrames 最多等待的动画帧数，默认 120
   * @returns 全部就绪为 true，超时为 false
   */
  const waitForCompareContainersReady = async (expectedCount: number, maxFrames = 120): Promise<boolean> => {
    for (let index = 0; index < maxFrames; index += 1) {
      /** 当前已具备非零尺寸的容器数量 */
      const readyCount = compareViewerContainers.value
        .slice(0, expectedCount)
        .filter((element) => hasValidContainerSize(element)).length
      if (readyCount === expectedCount) return true
      await nextTick()
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    }
    return false
  }

  /**
   * 创建一个精简控件的对比 Viewer，并在配置了影像地址时叠加瓦片底图。
   *
   * @param container 视口 DOM
   * @param creditContainer 版权容器；缺省时使用 Cesium 默认位置
   * @returns 已关闭动画与时间轴的 Viewer
   */
  const createCompareViewer = (container: HTMLDivElement, creditContainer?: Element | null): Cesium.Viewer => {
    /** 关闭地理编码、时间轴等默认控件，仅保留地球与实体图层 */
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

  /**
   * 在单个对比视口中绘制某方案的卫星：方案窗口内的目标用打击星标，其余用蓝点。
   *
   * @param compareViewer 目标视口
   * @param card 历史方案卡片（含任务窗口）
   */
  const renderCompareViewer = (compareViewer: Cesium.Viewer, card: HistoricalPlanCard) => {
    compareViewer.entities.removeAll()

    /** 该方案的打击任务窗口 */
    const missionWindows = card.detail.plan_summary.mission_windows ?? []
    /** 窗口内目标卫星 NORAD，用于区分已打击与未打击样式 */
    const targetIds = new Set(missionWindows.map((item) => String(item.satellite_id)))

    blueSatellites.value.forEach((satellite) => {
      /** 是否属于本方案的打击目标 */
      const isStruck = targetIds.has(satellite.noradId)
      /** 卫星静态地理坐标（对比视口不随时钟传播） */
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

  /**
   * 绘制打击前后对比：before 保留全部卫星，after 隐藏已完成打击的目标。
   *
   * @param compareViewer 目标视口
   * @param mode `before` 打击前，`after` 打击后
   */
  const renderStrikeCompareViewer = (compareViewer: Cesium.Viewer, mode: 'before' | 'after') => {
    compareViewer.entities.removeAll()

    blueSatellites.value.forEach((satellite) => {
      /** 该卫星是否已完成打击；after 模式不再绘制 */
      const isCompleted = completedTargetSatelliteIds.value.has(satellite.noradId)
      if (mode === 'after' && isCompleted) return

      /** 卫星静态地理坐标 */
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

  /**
   * 按当前图层重绘已有对比视口。
   * 「方案对比」按卡片逐个绘制；「对比视图」固定绘制打击前、打击后两栏。
   */
  const refreshCompareViewers = () => {
    if (activeLayerOption.value === '方案对比') {
      selectedComparePlanCards.value.forEach((card, index) => {
        /** 与卡片同序号的视口；容器尚未创建时跳过 */
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

  /**
   * 按当前图层重建对比视口。
   * 非对比图层直接返回；容器未就绪或缺少方案数据时不创建 Viewer。
   *
   * @throws 容器在就绪检查通过后仍缺失时抛出
   */
  const initCompareViewers = async () => {
    if (activeLayerOption.value !== '方案对比' && activeLayerOption.value !== '对比视图') return

    destroyCompareViewers()

    if (activeLayerOption.value === '对比视图') {
      if (!selectedHistoricalPlanDetail.value) return

      /** 打击前后两栏容器是否已完成布局 */
      const ready = await waitForCompareContainersReady(2)
      if (!ready) return

      compareViewers.value = [0, 1].map((index) => {
        /** 第 index 栏的 DOM；缺失视为模板未挂载，不能静默创建空白 Viewer */
        const container = compareViewerContainers.value[index]
        if (!container) {
          throw new Error('compare viewer container missing')
        }
        return createCompareViewer(container, compareViewerCredits.value[index])
      })

      refreshCompareViewers()
      return
    }

    /** 参与对比的方案卡片，每个卡片对应一个视口 */
    const planCards = selectedComparePlanCards.value
    if (!planCards.length) return

    /** 全部方案视口容器是否已完成布局 */
    const ready = await waitForCompareContainersReady(planCards.length)
    if (!ready) return

    compareViewers.value = planCards.map((card, index) => {
      /** 与卡片同序号的容器 */
      const container = compareViewerContainers.value[index]
      if (!container) {
        throw new Error('compare viewer container missing')
      }
      /** 新建视口并立即绘制该方案卫星 */
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
