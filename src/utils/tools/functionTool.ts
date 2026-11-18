import { useLayoutStore } from '@/store/modules/layout'
import type { TaskArea } from '@/types/task/task'
import { collectTaskAreaGeoCoords, filterEnabledTaskAreas, normalizeTaskAreaKind } from '@/utils/taskAreaGeo'
import { EntityCollection } from 'cesium'
import * as Cesium from 'cesium'

export { collectTaskAreaGeoCoords } from '@/utils/taskAreaGeo'
/**
 * 求多边形面积质心（椭球面）
 * @param {number[][]} lonlats  [[lon,lat], …]  必须闭合（首末点可相同）
 * @returns {Cesium.Cartesian3}
 */
export function getCentroid(lonlats: { lon: number; lat: number }[]) {
  if (!lonlats || lonlats.length < 3) return null
  // 1. 转成 Cartographic 数组
  const positions = lonlats.map((p) => Cesium.Cartographic.fromDegrees(p.lon, p.lat))

  // 2. 用 Cesium 内置的 PolygonGeometry 计算质心
  const geom = new Cesium.PolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(positions.map((c) => Cesium.Cartographic.toCartesian(c))),
    vertexFormat: Cesium.VertexFormat.POSITION_ONLY,
  })

  const center = Cesium.PolygonGeometry.createGeometry(geom)?.boundingSphere?.center
  return center // Cartesian3
}

/**
 * 根据一组经纬度计算外接圆中心与半径
 * @param {number[]} lonlats  [lon1,lat1, lon2,lat2, ...]
 * @returns {Object}  { center:[lon,lat], radiusKm }
 */
export function getCircumCircle(lonlats: number[]): { center: [number, number]; radiusKm: number } | null {
  if (!lonlats || lonlats.length < 3) return null

  // 1. 转笛卡尔
  const positions = Cesium.Cartesian3.fromDegreesArray(lonlats)

  // 2. 外接球
  const bs = Cesium.BoundingSphere.fromPoints(positions)

  // 3. 球心转回经纬度
  const carto = Cesium.Cartographic.fromCartesian(bs.center)
  const centerLon = Cesium.Math.toDegrees(carto.longitude)
  const centerLat = Cesium.Math.toDegrees(carto.latitude)

  // 4. 半径 km
  const radiusKm = bs.radius / 1000

  return { center: [centerLon, centerLat], radiusKm }
}

/* ====== 用例 ====== */
// const pts = [
//   116.397,
//   39.909, // 北京
//   121.473,
//   31.23, // 上海
//   113.264,
//   23.129, // 广州
// ]
// const result = getCircumCircle(pts)
// console.log('外接圆中心', result.center) // [lon, lat]
// console.log('外接圆半径', result.radiusKm, 'km')
export function listenMousePoint(viewer: Cesium.Viewer) {
  // 开启深度检测，保证拾取准确
  viewer.scene.globe.depthTestAgainstTerrain = true
  // 创建事件处理器
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction(function (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
    // 屏幕坐标 → 射线
    const ray = viewer.camera.getPickRay(movement.position)
    // 射线与地形求交
    const cartesian = viewer.scene.globe.pick(ray!, viewer.scene)

    if (cartesian) {
      // 笛卡尔 → 弧度 → 角度
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      const lon = Cesium.Math.toDegrees(cartographic.longitude)
      const lat = Cesium.Math.toDegrees(cartographic.latitude)
      const alt = cartographic.height

      console.log(`经度: ${lon.toFixed(6)}°, 纬度: ${lat.toFixed(6)}°, 高程: ${alt.toFixed(2)} m`)

      // 可选：在点击处加一个红点到场景
      viewer.entities.add({
        position: cartesian,
        point: { pixelSize: 8, color: Cesium.Color.RED },
      })
    } else {
      console.log('未拾取到有效地形点，请确认点击位置或地形已加载。')
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}
export type TrackSegment = { lon: number; lat: number; height: number }[]
export interface SegmentedTrackResult {
  track: Cesium.SampledPositionProperty
  segments: Cesium.Cartesian3[][]
  segmentRanges: { start: Cesium.JulianDate; end: Cesium.JulianDate }[]
}
// 将多段轨迹均匀切分到总时长内并返回插值轨迹与分段坐标
export function buildSegmentedTrack(
  paths: TrackSegment | Record<string, TrackSegment>,
  start: Cesium.JulianDate,
  stop: Cesium.JulianDate
): SegmentedTrackResult | null {
  const segments = Array.isArray(paths)
    ? [paths]
    : Object.keys(paths || {})
      .sort()
      .map((k) => (paths as Record<string, TrackSegment>)[k])
      .filter((seg) => seg && seg.length)

  if (!segments.length) return null

  const property = new Cesium.SampledPositionProperty()
  property.setInterpolationOptions({
    interpolationDegree: 2,
    interpolationAlgorithm: Cesium.HermitePolynomialApproximation,
  })

  const totalSeconds = Cesium.JulianDate.secondsDifference(stop, start)
  const segSeconds = totalSeconds / segments.length

  let segStart = start
  const segmentCartesians: Cesium.Cartesian3[][] = []
  const segmentRanges: { start: Cesium.JulianDate; end: Cesium.JulianDate }[] = []

  segments.forEach((seg, idx) => {
    const segEnd =
      idx === segments.length - 1
        ? stop
        : Cesium.JulianDate.addSeconds(start, segSeconds * (idx + 1), new Cesium.JulianDate())
    segmentRanges.push({ start: segStart, end: segEnd })
    const cart = seg.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height))
    segmentCartesians.push(cart)

    if (!cart.length) {
      segStart = segEnd
      return
    }

    const dist: number[] = [0]
    for (let i = 1; i < cart.length; i++) {
      dist[i] = dist[i - 1] + Cesium.Cartesian3.distance(cart[i - 1], cart[i])
    }
    const totalDist = dist[dist.length - 1]
    const skipFirst = idx > 0
    const duration = Cesium.JulianDate.secondsDifference(segEnd, segStart)

    if (totalDist === 0) {
      property.addSample(segStart, cart[0])
      property.addSample(segEnd, cart[cart.length - 1])
      segStart = segEnd
      return
    }

    for (let i = skipFirst ? 1 : 0; i < cart.length; i++) {
      const t = Cesium.JulianDate.addSeconds(segStart, (dist[i] / totalDist) * duration, new Cesium.JulianDate())
      property.addSample(t, cart[i])
    }

    segStart = segEnd
  })

  return { track: property, segments: segmentCartesians, segmentRanges }
}
/** 战场名称离地高度（米），配合 CLAMP_TO_GROUND 紧贴地表显示 */
const BATTLE_SPACE_LABEL_ALTITUDE_M = 50

/** 战场名称标签与区域边界的最小间距（度） */
const BATTLE_LABEL_BOUNDS_MARGIN_DEG = 0.08

/**
 * 计算任务区域中心点（算术平均）。
 *
 * @param areas 当前任务的 `TaskForm.areas`
 */
export function resolveTaskGeoCenter(areas: TaskArea[] | null | undefined): { lon: number; lat: number } | null {
  const coords = collectTaskAreaGeoCoords(areas)
  if (!coords.length) return null
  const lon = coords.reduce((sum, point) => sum + point.lon, 0) / coords.length
  const lat = coords.reduce((sum, point) => sum + point.lat, 0) / coords.length
  if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat }
  return null
}

/**
 * 计算战场名称标签锚点（基于任务区域包络，置于北侧外部）。
 *
 * @param areas 当前任务的 `TaskForm.areas`
 */
export function resolveTaskLabelGeoAnchor(areas: TaskArea[] | null | undefined): { lon: number; lat: number } | null {
  const coords = collectTaskAreaGeoCoords(areas)
  if (!coords.length) return resolveTaskGeoCenter(areas)

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  coords.forEach(({ lon, lat }) => {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  })

  const centerLon = (minLon + maxLon) / 2
  const latSpan = maxLat - minLat
  const margin = Math.max(latSpan * 0.25, BATTLE_LABEL_BOUNDS_MARGIN_DEG)
  return { lon: centerLon, lat: maxLat + margin }
}

/**
 * 计算战场名称贴地标签的三维坐标（锚点来自任务区域）。
 *
 * @param areas 当前任务的 `TaskForm.areas`
 * @param fallbackCenter 已缓存的任务俯视中心（可选）
 */
export function resolveTaskSpaceLabelPosition(
  areas: TaskArea[] | null | undefined,
  fallbackCenter?: Cesium.Cartesian3 | null
): Cesium.Cartesian3 | null {
  const anchor = resolveTaskLabelGeoAnchor(areas)
  if (anchor) {
    return Cesium.Cartesian3.fromDegrees(anchor.lon, anchor.lat, BATTLE_SPACE_LABEL_ALTITUDE_M)
  }
  if (fallbackCenter && Cesium.Cartesian3.magnitude(fallbackCenter) > 1) {
    const carto = Cesium.Cartographic.fromCartesian(fallbackCenter)
    if (Number.isFinite(carto.longitude) && Number.isFinite(carto.latitude)) {
      return Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, BATTLE_SPACE_LABEL_ALTITUDE_M)
    }
  }
  return null
}

/** 任务区域标记可选配置 */
export interface MarkTaskAreaOptions {
  /** 是否将多边形/边线贴地，避免开启 globe 深度检测后被地形遮挡 */
  clampToGround?: boolean
}

/**
 * 在地球上标记当前任务区域（`TaskForm.areas`）并调整初始视角。
 *
 * @param viewer Cesium Viewer
 * @param areas 任务区域列表
 * @param orbit_altitude_km 初始俯视高度（米）
 * @param options 可选渲染配置
 */
export function markTaskAreas(
  viewer: Cesium.Viewer,
  areas: TaskArea[] | null | undefined,
  orbit_altitude_km: number = 24000000,
  options?: MarkTaskAreaOptions
) {
  const clampToGround = options?.clampToGround ?? false
  if (!viewer || (viewer as any).isDestroyed?.()) return

  /** 先清掉旧任务区域面，避免重复叠加几何体 */
  const staleBattleEntities = viewer.entities.values.filter((entity) =>
    String(entity.id ?? '').startsWith('battle-area-')
  )
  staleBattleEntities.forEach((entity) => viewer.entities.remove(entity))

  const entitys: EntityCollection = new EntityCollection()
  let combinedBS: Cesium.BoundingSphere | null = null
  const enabledAreas = filterEnabledTaskAreas(areas)
  if (!enabledAreas.length) return

  enabledAreas.forEach((area, index) => {
    const kind = normalizeTaskAreaKind(area.type)
    const entityKey = area.name || `${area.id || kind || 'area'}-${index}`

    if (kind === 'POLYGON') {
      const points = (area.points ?? [])
        .filter((pt) => typeof pt.lng === 'number' && typeof pt.lat === 'number')
        .map((pt) => Cesium.Cartesian3.fromDegrees(pt.lng, pt.lat))
      if (points.length < 3) return

      const entity = viewer.entities.add({
        id: `battle-area-${entityKey}-${entitys.values.length}`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(points),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE.withAlpha(0.3)),
          ...(clampToGround
            ? { heightReference: Cesium.HeightReference.CLAMP_TO_TERRAIN }
            : { perPositionHeight: true }),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000000),
        },
        polyline: {
          positions: [...points, points[0]],
          width: 2,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.RED),
          ...(clampToGround ? { clampToGround: true } : {}),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000000),
        },
      })
      entitys.add(entity)
      try {
        const bs = Cesium.BoundingSphere.fromPoints(points)
        if (bs) {
          combinedBS = combinedBS ? Cesium.BoundingSphere.union(combinedBS, bs, new Cesium.BoundingSphere()) : bs
        }
      } catch (e) {
        console.error('任务多边形区域包围球计算失败:', area, e)
      }
      return
    }

    if (kind === 'CIRCLE') {
      const centerLng = area.center?.lng
      const centerLat = area.center?.lat
      const radiusKm = typeof area.radius === 'number' ? area.radius : 0
      if (typeof centerLng !== 'number' || typeof centerLat !== 'number' || radiusKm <= 0) return

      const center = Cesium.Cartesian3.fromDegrees(centerLng, centerLat)
      const radiusM = radiusKm * 1000
      const entity = viewer.entities.add({
        id: `battle-area-${entityKey}-${entitys.values.length}`,
        position: center,
        ellipse: {
          semiMajorAxis: radiusM,
          semiMinorAxis: radiusM,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE.withAlpha(0.3)),
          outline: true,
          outlineColor: Cesium.Color.RED,
          outlineWidth: 2,
          ...(clampToGround ? { heightReference: Cesium.HeightReference.CLAMP_TO_GROUND } : {}),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000000),
        },
      })
      entitys.add(entity)
      try {
        const bs = new Cesium.BoundingSphere(center, radiusM)
        combinedBS = combinedBS ? Cesium.BoundingSphere.union(combinedBS, bs, new Cesium.BoundingSphere()) : bs
      } catch (e) {
        console.error('任务圆形区域包围球计算失败:', area, e)
      }
    }
  })

  if (combinedBS) {
    // 避免半径为 0 导致视角过近
    const bs = combinedBS as Cesium.BoundingSphere
    if (!bs.radius || bs.radius === 0 || bs.radius < orbit_altitude_km) bs.radius = orbit_altitude_km
    try {
      const targetAltitude = Math.max(bs.radius * 1.6, 24000000)
      const offset = new Cesium.HeadingPitchRange(0.0, -Cesium.Math.toRadians(90.0), targetAltitude)
      viewer.camera.flyToBoundingSphere(bs, { duration: 1.5, offset })
      // 若相机视角飞到包围球，保存当前的坐标和朝向到 store 中，供其它组件使用
      const centerCarto = Cesium.Cartographic.fromCartesian(bs.center)
      const lon = Cesium.Math.toDegrees(centerCarto.longitude)
      const lat = Cesium.Math.toDegrees(centerCarto.latitude)
      const battleCenterCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, targetAltitude)
      const battleCenterOrientation = new Cesium.HeadingPitchRoll(0.0, -Cesium.Math.toRadians(90.0), 0.0)
      useLayoutStore().setBattleCenter(battleCenterCartesian, battleCenterOrientation)
    } catch (e) {
      console.error('无法定位战场中心', e)
    }
  }
}
/**
 * 将 Cesium 的时间轴和动画组件的时间显示格式化为中文习惯（年月日 时分秒），并且在时间轴上显示月-日 时:分的格式
 * @param view 视图
 */
export function formatTimeLineAndAnimation(view: Cesium.Viewer) {
  // 自定义时间格式
  view.animation.viewModel.timeFormatter = (date) =>
    Cesium.JulianDate.toDate(date).toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  view.animation.viewModel.dateFormatter = (julianDate: Cesium.JulianDate) => {
    const d = Cesium.JulianDate.toDate(julianDate)
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
  }

  Cesium.Timeline.prototype.makeLabel = function (julianDate) {
    // 转成 JS Date 后再格式化为本地字符串
    const date = Cesium.JulianDate.toDate(julianDate)
    // 例：06-01 22:00（24 小时制，不带秒）
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }
}
