import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { onBeforeUnmount, watch, type ComputedRef, type Ref, ref } from 'vue'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import { formatSatelliteMetaInline } from '@/utils/buildSatelliteAnalysisTable'

/** 近距离 LOD 阈值（米） */
const LOD_NEAR_DISTANCE = 2_000_000
/** 中距离 LOD 阈值（米） */
const LOD_MID_DISTANCE = 8_000_000
/** 远距离 LOD 阈值（米）；超出后仍显示最小点 */
const LOD_FAR_DISTANCE = 50_000_000
/** 视锥体剔除包围球半径（米） */
const FRUSTUM_BOUNDING_RADIUS = 50_000
/** 卫星点统一颜色（各 LOD 层级一致） */
const SATELLITE_POINT_COLOR = Cesium.Color.fromCssColorString('#40f2ff')
/** 推演中卫星被打击后的点/标签颜色 */
const STRUCK_SATELLITE_COLOR = Cesium.Color.fromCssColorString('#ef4444')
/** 选中卫星相机距离（米） */
const SELECTED_CAMERA_RANGE = 900_000

/** 卫星 Point + Label 可视化对象 */
interface SatellitePointVisual {
  /** 卫星 NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 所属系列 */
  series: string
  /** 系统类型（侦察 / 通信） */
  sysType: string
  /** 用途（军用 / 商用等） */
  usage: string
  /** Point 图元 */
  point: Cesium.PointPrimitive
  /** 名称标签（最近 LOD 层显示） */
  label: Cesium.Label
  /** 当前世界坐标 */
  position: Cesium.Cartesian3
}

/**
 * 整体态势地球卫星渲染：TLE 传播 + Point + 背面剔除 + 视锥剔除 + LOD。
 *
 * @param viewerRef Cesium Viewer 引用
 * @param satellitesRef 卫星列表
 * @param currentTimeMsRef 当前推演时刻（毫秒）
 * @param selectedNoradRef 当前选中 NORAD
 * @param followSelectedRef 选中卫星时是否自动飞行定位
 * @param struckSatelliteNoradRef 推演中已被打击的卫星 NORAD（显示为红色）
 * @param timelinePlaybackActiveRef 时间轴播放中（选中星持续高亮并始终显示名称）
 */
export const useBattleGlobeSatellites = (
  viewerRef: Ref<Cesium.Viewer | null>,
  satellitesRef: Ref<BattleGlobeSatellite[]> | ComputedRef<BattleGlobeSatellite[]>,
  currentTimeMsRef: Ref<number> | ComputedRef<number>,
  selectedNoradRef: Ref<number | null> | ComputedRef<number | null>,
  followSelectedRef: Ref<boolean> | ComputedRef<boolean> = ref(true),
  struckSatelliteNoradRef: Ref<number | null> | ComputedRef<number | null> = ref(null),
  timelinePlaybackActiveRef: Ref<boolean> | ComputedRef<boolean> = ref(false)
) => {
  const satrecCache = new Map<number, satellitejs.SatRec>()
  const visualMap = new Map<number, SatellitePointVisual>()
  let pointCollection: Cesium.PointPrimitiveCollection | null = null
  let labelCollection: Cesium.LabelCollection | null = null
  let postUpdateRemover: (() => void) | null = null
  let rebuildToken = 0

  const scratchCameraDir = new Cesium.Cartesian3()
  const scratchSatelliteDir = new Cesium.Cartesian3()
  const scratchPosition = new Cesium.Cartesian3()
  const scratchFrustumSphere = new Cesium.BoundingSphere()

  /**
   * 构建卫星名称标签文案；选中时附加系列、类型、用途。
   *
   * @param visual 卫星可视化对象
   * @param selected 是否为当前选中星
   * @returns Cesium Label 文本
   */
  const buildSatelliteLabelText = (visual: SatellitePointVisual, selected: boolean): string => {
    if (!selected) return visual.name
    const meta = formatSatelliteMetaInline(visual.series, visual.sysType, visual.usage)
    return meta ? `${visual.name}\n${meta}` : visual.name
  }

  /**
   * 判断笛卡尔坐标是否有效。
   *
   * @param position 世界坐标
   * @returns 是否为有限数值
   */
  const isFiniteCartesian = (position: Cesium.Cartesian3): boolean =>
    Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)

  /**
   * 获取或创建卫星 satrec。
   *
   * @param sat 卫星数据
   * @returns satrec 或 null
   */
  const getOrCreateSatrec = (sat: BattleGlobeSatellite): satellitejs.SatRec | null => {
    const cached = satrecCache.get(sat.norad)
    if (cached) return cached
    try {
      const satrec = satellitejs.twoline2satrec(sat.line1, sat.line2)
      if (satrec) {
        satrecCache.set(sat.norad, satrec)
        return satrec
      }
    } catch {
      return null
    }
    return null
  }

  /**
   * 根据 TLE 计算指定时刻的 ECEF 坐标。
   *
   * @param norad 卫星 NORAD
   * @param date 推演时刻
   * @returns 世界坐标或 null
   */
  const propagatePosition = (norad: number, date: Date): Cesium.Cartesian3 | null => {
    const satrec = satrecCache.get(norad)
    if (!satrec) return null
    try {
      const posVel = satellitejs.propagate(satrec, date)
      if (!posVel?.position) return null
      const gmst = satellitejs.gstime(date)
      const posEcf = satellitejs.eciToEcf(posVel.position, gmst)
      if (!posEcf) return null
      return Cesium.Cartesian3.fromElements(
        posEcf.x * 1000,
        posEcf.y * 1000,
        posEcf.z * 1000,
        scratchPosition
      )
    } catch {
      return null
    }
  }

  /**
   * 判断目标是否位于相机可见半球（背面剔除）。
   *
   * @param position 目标世界坐标
   * @param cameraPosition 相机世界坐标
   * @returns 是否可见
   */
  const isPositionFacingCamera = (
    position: Cesium.Cartesian3,
    cameraPosition: Cesium.Cartesian3
  ): boolean => {
    Cesium.Cartesian3.subtract(cameraPosition, Cesium.Cartesian3.ZERO, scratchCameraDir)
    Cesium.Cartesian3.subtract(position, Cesium.Cartesian3.ZERO, scratchSatelliteDir)
    if (
      Cesium.Cartesian3.magnitudeSquared(scratchCameraDir) < 1e-6 ||
      Cesium.Cartesian3.magnitudeSquared(scratchSatelliteDir) < 1e-6
    ) {
      return true
    }
    Cesium.Cartesian3.normalize(scratchCameraDir, scratchCameraDir)
    Cesium.Cartesian3.normalize(scratchSatelliteDir, scratchSatelliteDir)
    return Cesium.Cartesian3.dot(scratchCameraDir, scratchSatelliteDir) > 0
  }

  /**
   * 判断目标是否位于当前相机视锥体内（视锥体剔除）。
   *
   * @param viewer Cesium Viewer
   * @param position 目标世界坐标
   * @returns 是否在视锥体内
   */
  const isPositionInCameraFrustum = (
    viewer: Cesium.Viewer,
    position: Cesium.Cartesian3
  ): boolean => {
    const camera = viewer.camera
    const cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC
    )
    scratchFrustumSphere.center = position
    scratchFrustumSphere.radius = FRUSTUM_BOUNDING_RADIUS
    return cullingVolume.computeVisibility(scratchFrustumSphere) !== Cesium.Intersect.OUTSIDE
  }

  /**
   * 按距离计算 LOD 点大小与颜色。
   *
   * @param distance 相机距离（米）
   * @param selected 是否选中
   * @param struck 是否已被打击
   * @returns 点样式
   */
  const resolveLodStyle = (
    distance: number,
    selected: boolean,
    playbackSelected: boolean,
    struck: boolean
  ) => {
    if (struck) {
      const size = playbackSelected || selected ? 14 : distance <= LOD_NEAR_DISTANCE ? 8 : 6
      return { pixelSize: size, color: STRUCK_SATELLITE_COLOR }
    }
    if (playbackSelected) {
      return { pixelSize: 14, color: Cesium.Color.YELLOW }
    }
    if (selected) {
      return { pixelSize: 12, color: Cesium.Color.YELLOW }
    }
    if (distance <= LOD_NEAR_DISTANCE) {
      return { pixelSize: 8, color: SATELLITE_POINT_COLOR }
    }
    if (distance <= LOD_MID_DISTANCE) {
      return { pixelSize: 6, color: SATELLITE_POINT_COLOR }
    }
    if (distance <= LOD_FAR_DISTANCE) {
      return { pixelSize: 4, color: SATELLITE_POINT_COLOR }
    }
    return { pixelSize: 3, color: SATELLITE_POINT_COLOR }
  }

  /**
   * 清理卫星 Point 集合。
   */
  const clearSatellitePoints = () => {
    visualMap.clear()
    satrecCache.clear()
    if (!viewerRef.value || viewerRef.value.isDestroyed()) {
      pointCollection = null
      labelCollection = null
      return
    }
    if (pointCollection && !pointCollection.isDestroyed()) {
      viewerRef.value.scene.primitives.remove(pointCollection)
    }
    if (labelCollection && !labelCollection.isDestroyed()) {
      viewerRef.value.scene.primitives.remove(labelCollection)
    }
    pointCollection = null
    labelCollection = null
  }

  /**
   * 确保 Point / Label 图元集合已创建。
   */
  const ensurePrimitiveCollections = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return
    if (!pointCollection || pointCollection.isDestroyed()) {
      pointCollection = viewer.scene.primitives.add(new Cesium.PointPrimitiveCollection())
    }
    if (!labelCollection || labelCollection.isDestroyed()) {
      labelCollection = viewer.scene.primitives.add(new Cesium.LabelCollection({ scene: viewer.scene }))
    }
  }

  /**
   * 最近 LOD 层是否应显示卫星名称。
   *
   * @param distance 相机距离（米）
   * @param selected 是否选中
   * @returns 是否显示名称标签
   */
  const shouldShowSatelliteLabel = (
    distance: number,
    selected: boolean,
    playbackSelected: boolean
  ): boolean => playbackSelected || selected || distance <= LOD_NEAR_DISTANCE

  /**
   * 根据卫星列表重建 Point 图元。
   */
  const rebuildSatellitePoints = async () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return

    const token = ++rebuildToken
    clearSatellitePoints()
    ensurePrimitiveCollections()
    if (!pointCollection || !labelCollection) return

    const satellites = satellitesRef.value
    const initialDate = new Date(currentTimeMsRef.value > 0 ? currentTimeMsRef.value : Date.now())
    for (const sat of satellites) {
      if (token !== rebuildToken) return
      const satrec = getOrCreateSatrec(sat)
      if (!satrec) continue

      const initialPosition = propagatePosition(sat.norad, initialDate)
      if (!initialPosition || !isFiniteCartesian(initialPosition) || Cesium.Cartesian3.magnitude(initialPosition) < 1) {
        continue
      }

      const position = Cesium.Cartesian3.clone(initialPosition)
      const point = pointCollection.add({
        position,
        pixelSize: 6,
        color: SATELLITE_POINT_COLOR,
        // 始终参与深度检测，被地球遮挡的背面卫星不再穿透绘制
        disableDepthTestDistance: 0,
        show: false,
      })
      const label = labelCollection.add({
        position,
        text: sat.name,
        font: 'bold 12px "Microsoft YaHei", sans-serif',
        fillColor: SATELLITE_POINT_COLOR,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.35),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        disableDepthTestDistance: 0,
        show: false,
      })

      visualMap.set(sat.norad, {
        norad: sat.norad,
        name: sat.name,
        series: sat.series,
        sysType: sat.sysType,
        usage: sat.usage,
        point,
        label,
        position,
      })
    }

    updateSatelliteVisuals()
    viewer.scene.requestRender()
  }

  /**
   * 每帧更新卫星位置、背面剔除、视锥剔除与 LOD。
   */
  const updateSatelliteVisuals = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !pointCollection || visualMap.size === 0) return

    const currentTime = currentTimeMsRef.value
    const date = new Date(currentTime > 0 ? currentTime : Date.now())
    const cameraPosition = viewer.camera.positionWC
    const selectedNorad = selectedNoradRef.value

    visualMap.forEach((visual) => {
      const position = propagatePosition(visual.norad, date)
      if (!position || !isFiniteCartesian(position) || Cesium.Cartesian3.magnitude(position) < 1) {
        visual.point.show = false
        visual.label.show = false
        return
      }

      Cesium.Cartesian3.clone(position, visual.position)
      visual.point.position = visual.position
      visual.label.position = visual.position

      const selected = selectedNorad === visual.norad
      /** 选中星：加强点大小与名称标签（播放时同样保持） */
      const emphasizeSelected = selected
      const struck = struckSatelliteNoradRef.value === visual.norad
      const facing = isPositionFacingCamera(visual.position, cameraPosition)
      const inFrustum = isPositionInCameraFrustum(viewer, visual.position)
      const distance = Cesium.Cartesian3.distance(cameraPosition, visual.position)
      const lodStyle = resolveLodStyle(distance, selected, emphasizeSelected, struck)
      const showLabel = shouldShowSatelliteLabel(distance, selected, emphasizeSelected)

      if (!selected && !facing) {
        visual.point.show = false
        visual.label.show = false
        return
      }

      if (!selected && !inFrustum) {
        visual.point.show = false
        visual.label.show = false
        return
      }

      visual.point.show = true
      visual.point.pixelSize = lodStyle?.pixelSize ?? 6
      visual.point.color = lodStyle?.color ?? SATELLITE_POINT_COLOR

      visual.label.show = showLabel
      visual.label.text = buildSatelliteLabelText(visual, selected)
      visual.label.fillColor = struck
        ? STRUCK_SATELLITE_COLOR
        : selected
          ? Cesium.Color.YELLOW
          : SATELLITE_POINT_COLOR
      if (struck) {
        visual.label.showBackground = true
        visual.label.backgroundColor = new Cesium.Color(0.35, 0.08, 0.08, 0.58)
        visual.label.font = 'bold 13px "Microsoft YaHei", sans-serif'
        visual.label.pixelOffset = new Cesium.Cartesian2(0, -14)
      } else if (emphasizeSelected) {
        visual.label.showBackground = true
        visual.label.backgroundColor = new Cesium.Color(0.45, 0.35, 0, 0.55)
        visual.label.font = 'bold 13px "Microsoft YaHei", sans-serif'
        visual.label.pixelOffset = new Cesium.Cartesian2(0, -14)
      } else {
        visual.label.font = 'bold 12px "Microsoft YaHei", sans-serif'
        visual.label.backgroundColor = new Cesium.Color(0, 0, 0, 0.35)
        visual.label.pixelOffset = new Cesium.Cartesian2(0, -10)
      }
    })

    viewer.scene.requestRender()
  }

  /**
   * 相机飞到指定卫星。
   *
   * @param norad 卫星 NORAD
   */
  const flyToSatellite = (norad: number | null) => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !norad) return

    const visual = visualMap.get(norad)
    if (!visual) return

    const date = new Date(currentTimeMsRef.value || Date.now())
    const position = propagatePosition(norad, date)
    if (!position || !isFiniteCartesian(position)) return

    Cesium.Cartesian3.clone(position, visual.position)
    visual.point.position = visual.position

    viewer.camera.flyToBoundingSphere(
      new Cesium.BoundingSphere(visual.position, 1000),
      {
        duration: 1.2,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), SELECTED_CAMERA_RANGE),
      }
    )
  }

  /**
   * 注册场景 postUpdate 监听。
   */
  const ensurePostUpdateListener = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || postUpdateRemover) return
    postUpdateRemover = viewer.scene.postUpdate.addEventListener(() => {
      updateSatelliteVisuals()
    })
  }

  /**
   * 移除 postUpdate 监听。
   */
  const removePostUpdateListener = () => {
    postUpdateRemover?.()
    postUpdateRemover = null
  }

  watch(
    () => viewerRef.value,
    (viewer) => {
      removePostUpdateListener()
      clearSatellitePoints()
      if (!viewer || viewer.isDestroyed()) return
      ensurePostUpdateListener()
      void rebuildSatellitePoints()
    },
    { immediate: true }
  )

  watch(
    satellitesRef,
    () => {
      void rebuildSatellitePoints()
    },
    { deep: true }
  )

  watch(currentTimeMsRef, () => {
    updateSatelliteVisuals()
  })

  watch(selectedNoradRef, (norad) => {
    if (norad && followSelectedRef.value) flyToSatellite(norad)
    updateSatelliteVisuals()
  })

  watch(struckSatelliteNoradRef, () => {
    updateSatelliteVisuals()
  })

  watch(timelinePlaybackActiveRef, () => {
    updateSatelliteVisuals()
  })

  onBeforeUnmount(() => {
    removePostUpdateListener()
    clearSatellitePoints()
  })

  return {
    rebuildSatellitePoints,
    updateSatelliteVisuals,
    flyToSatellite,
    clearSatellitePoints,
  }
}
