import * as Cesium from 'cesium'
import { onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  buildGroundTargetKey,
  type BattleGlobeGroundTarget,
} from '@/utils/buildBattleGlobeGroundTargets'

/** 近距离 LOD 阈值（米） */
const LOD_NEAR_DISTANCE = 2_000_000
/** 中距离 LOD 阈值（米） */
const LOD_MID_DISTANCE = 8_000_000
/** 远距离 LOD 阈值（米） */
const LOD_FAR_DISTANCE = 50_000_000
/** 视锥体剔除包围球半径（米） */
const FRUSTUM_BOUNDING_RADIUS = 30_000
/** 贴地标签三点深度检测距离（米） */
const GROUND_LABEL_THREE_POINT_DEPTH_TEST_DISTANCE = 5000
/** 接收站点颜色 */
const RECEIVE_POINT_COLOR = Cesium.Color.fromCssColorString('#22d3ee')
/** 数据中心的点颜色 */
const STATION_POINT_COLOR = Cesium.Color.fromCssColorString('#fb923c')
/** 被打击状态点颜色 */
const STRUCK_POINT_COLOR = Cesium.Color.fromCssColorString('#f87171')
/** 选中目标相机距离（米） */
const SELECTED_CAMERA_RANGE = 600_000

/** 地面站 Point + Label 可视化对象 */
interface GroundTargetVisual {
  /** 唯一键 receive:xxx / station:yyy */
  key: string
  /** 展示名称 */
  name: string
  /** Point 图元 */
  point: Cesium.PointPrimitive
  /** 名称标签 */
  label: Cesium.Label
  /** 世界坐标 */
  position: Cesium.Cartesian3
  /** 是否被打击 */
  struck: boolean
}

/**
 * 整体态势地球地面站渲染：接收站/数据中心 + 背面剔除 + 视锥剔除 + LOD。
 *
 * @param viewerRef Cesium Viewer 引用
 * @param targetsRef 地面目标列表
 * @param selectedTargetKeyRef 当前选中键（receive: / station:）
 * @param deductionStruckReceiveKeysRef 推演中已被打击的接收站 ID/名称集合
 */
export const useBattleGlobeGroundTargets = (
  viewerRef: Ref<Cesium.Viewer | null>,
  targetsRef: Ref<BattleGlobeGroundTarget[]> | ComputedRef<BattleGlobeGroundTarget[]>,
  selectedTargetKeyRef: Ref<string | null> | ComputedRef<string | null>,
  deductionStruckReceiveKeysRef: Ref<Set<string>> | ComputedRef<Set<string>> = ref(new Set())
) => {
  const visualMap = new Map<string, GroundTargetVisual>()
  let pointCollection: Cesium.PointPrimitiveCollection | null = null
  let labelCollection: Cesium.LabelCollection | null = null
  let postUpdateRemover: (() => void) | null = null
  let rebuildToken = 0

  const scratchCameraDir = new Cesium.Cartesian3()
  const scratchTargetDir = new Cesium.Cartesian3()
  const scratchFrustumSphere = new Cesium.BoundingSphere()

  /**
   * 判断笛卡尔坐标是否有效。
   *
   * @param position 世界坐标
   * @returns 是否为有限数值
   */
  const isFiniteCartesian = (position: Cesium.Cartesian3): boolean =>
    Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)

  /**
   * 将地面目标经纬度转为世界坐标。
   *
   * @param target 地面目标
   * @returns 世界坐标或 null
   */
  const resolveTargetPosition = (target: BattleGlobeGroundTarget): Cesium.Cartesian3 | null => {
    const position = Cesium.Cartesian3.fromDegrees(target.longitude, target.latitude, 0)
    if (!isFiniteCartesian(position) || Cesium.Cartesian3.magnitude(position) < 1) {
      return null
    }
    return position
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
    Cesium.Cartesian3.subtract(position, Cesium.Cartesian3.ZERO, scratchTargetDir)
    if (
      Cesium.Cartesian3.magnitudeSquared(scratchCameraDir) < 1e-6 ||
      Cesium.Cartesian3.magnitudeSquared(scratchTargetDir) < 1e-6
    ) {
      return true
    }
    Cesium.Cartesian3.normalize(scratchCameraDir, scratchCameraDir)
    Cesium.Cartesian3.normalize(scratchTargetDir, scratchTargetDir)
    return Cesium.Cartesian3.dot(scratchCameraDir, scratchTargetDir) > 0
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
   * 解析目标默认点颜色。
   *
   * @param target 地面目标
   * @returns 点颜色
   */
  const resolveBasePointColor = (target: BattleGlobeGroundTarget): Cesium.Color => {
    if (target.status === 1) return STRUCK_POINT_COLOR
    return target.kind === 'receive' ? RECEIVE_POINT_COLOR : STATION_POINT_COLOR
  }

  /**
   * 按距离计算 LOD 点大小与颜色。
   *
   * @param distance 相机距离（米）
   * @param selected 是否选中
   * @param baseColor 默认颜色
   * @returns 点样式
   */
  const resolveLodStyle = (distance: number, selected: boolean, baseColor: Cesium.Color) => {
    if (selected) {
      return { pixelSize: 12, color: Cesium.Color.YELLOW }
    }
    if (distance <= LOD_NEAR_DISTANCE) {
      return { pixelSize: 8, color: baseColor }
    }
    if (distance <= LOD_MID_DISTANCE) {
      return { pixelSize: 6, color: baseColor }
    }
    if (distance <= LOD_FAR_DISTANCE) {
      return { pixelSize: 4, color: baseColor }
    }
    return { pixelSize: 3, color: baseColor }
  }

  /**
   * 最近 LOD 层是否应显示名称标签。
   *
   * @param distance 相机距离（米）
   * @param selected 是否选中
   * @returns 是否显示标签
   */
  const shouldShowTargetLabel = (distance: number, selected: boolean): boolean =>
    selected || distance <= LOD_NEAR_DISTANCE

  /**
   * 清理地面站 Point 集合。
   */
  const clearGroundTargetPoints = () => {
    visualMap.clear()
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
      labelCollection = viewer.scene.primitives.add(
        new Cesium.LabelCollection({
          scene: viewer.scene,
          threePointDepthTestDistance: GROUND_LABEL_THREE_POINT_DEPTH_TEST_DISTANCE,
        })
      )
    }
  }

  /**
   * 根据目标列表重建 Point 图元。
   */
  const rebuildGroundTargetPoints = async () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return

    const token = ++rebuildToken
    clearGroundTargetPoints()
    ensurePrimitiveCollections()
    if (!pointCollection || !labelCollection) return

    const targets = targetsRef.value
    for (const target of targets) {
      if (token !== rebuildToken) return

      const initialPosition = resolveTargetPosition(target)
      if (!initialPosition) continue

      const key = buildGroundTargetKey(target.kind, target.id)
      const baseColor = resolveBasePointColor(target)
      const position = Cesium.Cartesian3.clone(initialPosition)
      const point = pointCollection.add({
        position,
        pixelSize: 6,
        color: baseColor,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: false,
      })
      const label = labelCollection.add({
        position,
        text: target.name,
        font: 'bold 12px "Microsoft YaHei", sans-serif',
        fillColor: baseColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.35),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        heightReference: Cesium.HeightReference.CLAMP_TO_TERRAIN,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: false,
      })

      visualMap.set(key, {
        key,
        name: target.name,
        point,
        label,
        position,
        struck: target.status === 1,
      })
    }

    updateGroundTargetVisuals()
    viewer.scene.requestRender()
  }

  /**
   * 每帧更新背面剔除、视锥剔除与 LOD。
   */
  const updateGroundTargetVisuals = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !pointCollection || visualMap.size === 0) return

    const cameraPosition = viewer.camera.positionWC
    const selectedKey = selectedTargetKeyRef.value

    visualMap.forEach((visual) => {
      const selected = selectedKey === visual.key
      const facing = isPositionFacingCamera(visual.position, cameraPosition)
      const inFrustum = isPositionInCameraFrustum(viewer, visual.position)
      const distance = Cesium.Cartesian3.distance(cameraPosition, visual.position)
      const targetKind = visual.key.startsWith('receive:') ? 'receive' : 'station'
      const targetId = visual.key.split(':')[1] || ''
      const deductionStruck = deductionStruckReceiveKeysRef.value
      const struckInDeduction =
        targetKind === 'receive' &&
        (deductionStruck.has(targetId) || deductionStruck.has(visual.name))
      const baseColor = struckInDeduction
        ? STRUCK_POINT_COLOR
        : visual.struck
          ? STRUCK_POINT_COLOR
          : targetKind === 'receive'
            ? RECEIVE_POINT_COLOR
            : STATION_POINT_COLOR
      const lodStyle = resolveLodStyle(distance, selected, baseColor)
      const showLabel = shouldShowTargetLabel(distance, selected)

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
      visual.point.pixelSize = lodStyle.pixelSize
      visual.point.color = lodStyle.color

      visual.label.show = showLabel
      visual.label.fillColor = selected ? Cesium.Color.YELLOW : baseColor
    })

    viewer.scene.requestRender()
  }

  /**
   * 相机飞到指定地面目标。
   *
   * @param targetKey 目标键
   */
  const flyToGroundTarget = (targetKey: string | null) => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !targetKey) return

    const visual = visualMap.get(targetKey)
    if (!visual) return

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
      updateGroundTargetVisuals()
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
      clearGroundTargetPoints()
      if (!viewer || viewer.isDestroyed()) return
      ensurePostUpdateListener()
      void rebuildGroundTargetPoints()
    },
    { immediate: true }
  )

  watch(
    targetsRef,
    () => {
      void rebuildGroundTargetPoints()
    },
    { deep: true }
  )

  watch(selectedTargetKeyRef, (targetKey) => {
    if (targetKey) flyToGroundTarget(targetKey)
    updateGroundTargetVisuals()
  })

  watch(deductionStruckReceiveKeysRef, () => updateGroundTargetVisuals(), { deep: true })

  onBeforeUnmount(() => {
    removePostUpdateListener()
    clearGroundTargetPoints()
  })

  return {
    rebuildGroundTargetPoints,
    updateGroundTargetVisuals,
    flyToGroundTarget,
    clearGroundTargetPoints,
  }
}
