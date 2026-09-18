import * as Cesium from 'cesium'
import { onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  buildGroundTargetKey,
  isGroundTargetNearDeductionPass,
  type BattleGlobeGroundTarget,
} from '@/utils/buildBattleGlobeGroundTargets'
import {
  matchesDeductionReceiveHighlight,
  type DeductionStationPassWindow,
} from '@/utils/buildSatelliteDeductionTimeline'

/** 近距离 LOD 阈值（米） */
const LOD_NEAR_DISTANCE = 2_000_000
/** 中距离 LOD 阈值（米） */
const LOD_MID_DISTANCE = 8_000_000
/** 远距离 LOD 阈值（米） */
const LOD_FAR_DISTANCE = 50_000_000
/** 视锥体剔除包围球半径（米） */
const FRUSTUM_BOUNDING_RADIUS = 30_000
/** 接收站点颜色 */
const RECEIVE_POINT_COLOR = Cesium.Color.fromCssColorString('#22d3ee')
/** 数据中心的点颜色 */
const STATION_POINT_COLOR = Cesium.Color.fromCssColorString('#fb923c')
/** 被打击状态点颜色 */
const STRUCK_POINT_COLOR = Cesium.Color.fromCssColorString('#f87171')
/** 推演过站高亮颜色（与过站虚线一致） */
const DEDUCTION_PASS_HIGHLIGHT_COLOR = Cesium.Color.fromCssColorString('#facc15')
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
  /** 纬度（度） */
  latitude: number
  /** 经度（度） */
  longitude: number
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
 * @param deductionPassHighlightReceiveKeysRef 推演当前过站窗口内接收站 ID/名称集合
 * @param deductionPassHighlightPassesRef 推演高亮过站窗口（含坐标）
 */
export const useBattleGlobeGroundTargets = (
  viewerRef: Ref<Cesium.Viewer | null>,
  targetsRef: Ref<BattleGlobeGroundTarget[]> | ComputedRef<BattleGlobeGroundTarget[]>,
  selectedTargetKeyRef: Ref<string | null> | ComputedRef<string | null>,
  deductionStruckReceiveKeysRef: Ref<Set<string>> | ComputedRef<Set<string>> = ref(new Set()),
  deductionPassHighlightReceiveKeysRef: Ref<Set<string>> | ComputedRef<Set<string>> = ref(
    new Set()
  ),
  deductionPassHighlightPassesRef: Ref<DeductionStationPassWindow[]> | ComputedRef<
    DeductionStationPassWindow[]
  > = ref([])
) => {
  // 可视化对象映射
  const visualMap = new Map<string, GroundTargetVisual>()
  // 点图元集合
  let pointCollection: Cesium.PointPrimitiveCollection | null = null
  // 标签集合
  let labelCollection: Cesium.LabelCollection | null = null
  // postUpdate 监听器
  let postUpdateRemover: (() => void) | null = null
  // 重建令牌
  let rebuildToken = 0

  // 临时相机方向
  const scratchCameraDir = new Cesium.Cartesian3()
  // 临时目标方向
  const scratchTargetDir = new Cesium.Cartesian3()
  // 临时视锥体包围球
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
    // 判断坐标是否有效且距离大于1米
    if (!isFiniteCartesian(position) || Cesium.Cartesian3.magnitude(position) < 1) {
      return null
    }
    // 返回世界坐标
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
    // 地心到相机
    Cesium.Cartesian3.subtract(cameraPosition, Cesium.Cartesian3.ZERO, scratchCameraDir)
    // 地心到目标
    Cesium.Cartesian3.subtract(position, Cesium.Cartesian3.ZERO, scratchTargetDir)

    if (
      // 如果向量异常小，直接认为可见，注意：magnitudeSquared 是向量长度的平方，这里假如相机或目标就在地心，就认为可见，但是一般情况下不会这样，
      // 这是一种兜底处理，将这种极端情况判定为可见，而不是不可见
      Cesium.Cartesian3.magnitudeSquared(scratchCameraDir) < 1e-6 ||
      Cesium.Cartesian3.magnitudeSquared(scratchTargetDir) < 1e-6
    ) {
      return true
    }
    // 将向量转成单位向量
    Cesium.Cartesian3.normalize(scratchCameraDir, scratchCameraDir)
    Cesium.Cartesian3.normalize(scratchTargetDir, scratchTargetDir)
    // 如果点乘结果大于0，则认为可见
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
    // 计算视锥体包围球
    const cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,//相机位置
      camera.directionWC,//相机方向
      camera.upWC//相机上方向
    )
    scratchFrustumSphere.center = position//包围球中心
    scratchFrustumSphere.radius = FRUSTUM_BOUNDING_RADIUS//包围球半径
    // 判断是否在视锥体内
    return cullingVolume.computeVisibility(scratchFrustumSphere) !== Cesium.Intersect.OUTSIDE//如果返回的是OUTSIDE，则说明不在视锥体内
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
  const resolveLodStyle = (
    distance: number,
    selected: boolean,
    passHighlight: boolean,
    baseColor: Cesium.Color
  ) => {
    if (selected) {
      return { pixelSize: 12, color: Cesium.Color.YELLOW }
    }
    if (passHighlight) {
      return { pixelSize: 12, color: DEDUCTION_PASS_HIGHLIGHT_COLOR }
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
  const shouldShowTargetLabel = (
    distance: number,
    selected: boolean,
    passHighlight: boolean
  ): boolean => selected || passHighlight || distance <= LOD_NEAR_DISTANCE

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
        new Cesium.LabelCollection({ scene: viewer.scene })
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
      // 如果重建令牌不匹配，则返回
      if (token !== rebuildToken) return

      // 将地面目标经纬度转为世界坐标。
      const initialPosition = resolveTargetPosition(target)
      if (!initialPosition) continue
      // 构建地面目标唯一键
      const key = buildGroundTargetKey(target.kind, target.id)
      // 解析地面目标默认点颜色
      const baseColor = resolveBasePointColor(target)
      // 克隆世界坐标
      const position = Cesium.Cartesian3.clone(initialPosition)
      // 添加点图元
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
        latitude: target.latitude,
        longitude: target.longitude,
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
      const passHighlightKeys = deductionPassHighlightReceiveKeysRef.value
      const passHighlightPasses = deductionPassHighlightPassesRef.value
      const struckInDeduction =
        targetKind === 'receive' &&
        (deductionStruck.has(targetId) ||
          deductionStruck.has(visual.name) ||
          matchesDeductionReceiveHighlight(targetId, visual.name, deductionStruck))
      const passHighlightInDeduction =
        !struckInDeduction &&
        (matchesDeductionReceiveHighlight(targetId, visual.name, passHighlightKeys) ||
          isGroundTargetNearDeductionPass(visual.latitude, visual.longitude, passHighlightPasses))
      const baseColor = struckInDeduction
        ? STRUCK_POINT_COLOR
        : visual.struck
          ? STRUCK_POINT_COLOR
          : targetKind === 'receive'
            ? RECEIVE_POINT_COLOR
            : STATION_POINT_COLOR
      const lodStyle = resolveLodStyle(distance, selected, passHighlightInDeduction, baseColor)
      const showLabel = shouldShowTargetLabel(distance, selected, passHighlightInDeduction)

      if (!selected && !passHighlightInDeduction && !facing) {
        visual.point.show = false
        visual.label.show = false
        return
      }

      if (!selected && !passHighlightInDeduction && !inFrustum) {
        visual.point.show = false
        visual.label.show = false
        return
      }

      visual.point.show = true
      visual.point.pixelSize = lodStyle.pixelSize
      visual.point.color = lodStyle.color

      visual.label.show = showLabel
      visual.label.fillColor = selected
        ? Cesium.Color.YELLOW
        : passHighlightInDeduction
          ? DEDUCTION_PASS_HIGHLIGHT_COLOR
          : baseColor
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
  watch(deductionPassHighlightReceiveKeysRef, () => updateGroundTargetVisuals(), { deep: true })
  watch(deductionPassHighlightPassesRef, () => updateGroundTargetVisuals(), { deep: true })

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
