import * as Cesium from 'cesium'
import { onBeforeUnmount, watch, type ComputedRef, type Ref } from 'vue'
import type { BattleGlobeWeapon } from '@/utils/buildBattleGlobeWeapons'

/** 近距离 LOD 阈值（米） */
const LOD_NEAR_DISTANCE = 2_000_000
/** 中距离 LOD 阈值（米） */
const LOD_MID_DISTANCE = 8_000_000
/** 远距离 LOD 阈值（米） */
const LOD_FAR_DISTANCE = 50_000_000
/** 视锥体剔除包围球半径（米） */
const FRUSTUM_BOUNDING_RADIUS = 30_000
/**
 * 贴地标签三点深度检测距离（米）。
 * 相机距地面较近时，保证 CLAMP_TO_GROUND 标签任一角可见则整体可见。
 */
const WEAPON_LABEL_THREE_POINT_DEPTH_TEST_DISTANCE = 5000
/** 武器点默认颜色 */
const WEAPON_POINT_COLOR = Cesium.Color.fromCssColorString('#ff3333')
/** 选中武器相机距离（米） */
const SELECTED_CAMERA_RANGE = 600_000

/** 武器 Point + Label 可视化对象 */
interface WeaponPointVisual {
  /** 武器 ID */
  id: string
  /** 武器名称 */
  name: string
  /** Point 图元 */
  point: Cesium.PointPrimitive
  /** 名称标签（最近 LOD 层显示） */
  label: Cesium.Label
  /** 当前世界坐标 */
  position: Cesium.Cartesian3
}

/**
 * 整体态势地球武器渲染：固定经纬度 + Point + 背面剔除 + 视锥剔除 + LOD。
 *
 * @param viewerRef Cesium Viewer 引用
 * @param weaponsRef 武器列表
 * @param selectedWeaponIdRef 当前选中武器 ID
 */
export const useBattleGlobeWeapons = (
  viewerRef: Ref<Cesium.Viewer | null>,
  weaponsRef: Ref<BattleGlobeWeapon[]> | ComputedRef<BattleGlobeWeapon[]>,
  selectedWeaponIdRef: Ref<string | null> | ComputedRef<string | null>
) => {
  const visualMap = new Map<string, WeaponPointVisual>()
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
   * 将武器经纬度转为世界坐标。
   *
   * @param weapon 武器数据
   * @returns 世界坐标或 null
   */
  const resolveWeaponPosition = (weapon: BattleGlobeWeapon): Cesium.Cartesian3 | null => {
    // 高度由 Label.heightReference 贴地；Point 关闭自身深度检测后由背面剔除控制可见性
    const position = Cesium.Cartesian3.fromDegrees(weapon.longitude, weapon.latitude, 0)
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
   * 按距离计算 LOD 点大小与颜色。
   *
   * @param distance 相机距离（米）
   * @param selected 是否选中
   * @returns 点样式
   */
  const resolveLodStyle = (distance: number, selected: boolean) => {
    if (selected) {
      return { pixelSize: 12, color: Cesium.Color.YELLOW }
    }
    if (distance <= LOD_NEAR_DISTANCE) {
      return { pixelSize: 8, color: WEAPON_POINT_COLOR }
    }
    if (distance <= LOD_MID_DISTANCE) {
      return { pixelSize: 6, color: WEAPON_POINT_COLOR }
    }
    if (distance <= LOD_FAR_DISTANCE) {
      return { pixelSize: 4, color: WEAPON_POINT_COLOR }
    }
    return { pixelSize: 3, color: WEAPON_POINT_COLOR }
  }

  /**
   * 最近 LOD 层是否应显示武器名称。
   *
   * @param distance 相机距离（米）
   * @param selected 是否选中
   * @returns 是否显示名称标签
   */
  const shouldShowWeaponLabel = (distance: number, selected: boolean): boolean =>
    selected || distance <= LOD_NEAR_DISTANCE

  /**
   * 清理武器 Point 集合。
   */
  const clearWeaponPoints = () => {
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
          threePointDepthTestDistance: WEAPON_LABEL_THREE_POINT_DEPTH_TEST_DISTANCE,
        })
      )
    }
  }

  /**
   * 根据武器列表重建 Point 图元。
   */
  const rebuildWeaponPoints = async () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed()) return

    const token = ++rebuildToken
    clearWeaponPoints()
    ensurePrimitiveCollections()
    if (!pointCollection || !labelCollection) return

    const weapons = weaponsRef.value
    for (const weapon of weapons) {
      if (token !== rebuildToken) return

      const initialPosition = resolveWeaponPosition(weapon)
      if (!initialPosition) continue

      const position = Cesium.Cartesian3.clone(initialPosition)
      const point = pointCollection.add({
        position,
        pixelSize: 6,
        color: WEAPON_POINT_COLOR,
        // 关闭 Point 自身深度检测，避免被地形遮挡；背面可见性由 isPositionFacingCamera 控制
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: false,
      })
      const label = labelCollection.add({
        position,
        text: weapon.name,
        font: 'bold 12px "Microsoft YaHei", sans-serif',
        fillColor: WEAPON_POINT_COLOR,
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

      visualMap.set(weapon.id, {
        id: weapon.id,
        name: weapon.name,
        point,
        label,
        position,
      })
    }

    updateWeaponVisuals()
    viewer.scene.requestRender()
  }

  /**
   * 每帧更新武器背面剔除、视锥剔除与 LOD。
   */
  const updateWeaponVisuals = () => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !pointCollection || visualMap.size === 0) return

    const cameraPosition = viewer.camera.positionWC
    const selectedWeaponId = selectedWeaponIdRef.value

    visualMap.forEach((visual) => {
      const selected = selectedWeaponId === visual.id
      const facing = isPositionFacingCamera(visual.position, cameraPosition)
      const inFrustum = isPositionInCameraFrustum(viewer, visual.position)
      const distance = Cesium.Cartesian3.distance(cameraPosition, visual.position)
      const lodStyle = resolveLodStyle(distance, selected)
      const showLabel = shouldShowWeaponLabel(distance, selected)

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
      visual.label.fillColor = selected ? Cesium.Color.YELLOW : WEAPON_POINT_COLOR
    })

    viewer.scene.requestRender()
  }

  /**
   * 相机飞到指定武器。
   *
   * @param weaponId 武器 ID
   */
  const flyToWeapon = (weaponId: string | null) => {
    const viewer = viewerRef.value
    if (!viewer || viewer.isDestroyed() || !weaponId) return

    const visual = visualMap.get(weaponId)
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
      updateWeaponVisuals()
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
      clearWeaponPoints()
      if (!viewer || viewer.isDestroyed()) return
      ensurePostUpdateListener()
      void rebuildWeaponPoints()
    },
    { immediate: true }
  )

  watch(
    weaponsRef,
    () => {
      void rebuildWeaponPoints()
    },
    { deep: true }
  )

  watch(selectedWeaponIdRef, (weaponId) => {
    if (weaponId) flyToWeapon(weaponId)
    updateWeaponVisuals()
  })

  onBeforeUnmount(() => {
    removePostUpdateListener()
    clearWeaponPoints()
  })

  return {
    rebuildWeaponPoints,
    updateWeaponVisuals,
    flyToWeapon,
    clearWeaponPoints,
  }
}
