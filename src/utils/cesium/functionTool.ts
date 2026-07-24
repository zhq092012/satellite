import { useLayoutStore } from '@/store/modules/layout'
import { EntityCollection } from 'cesium'
import * as Cesium from 'cesium'
const store = useLayoutStore()
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
// 标记战场
export function markBattleArea(viewer: Cesium.Viewer, battle: BattleForm | null, orbit_altitude_km: number = 20000000) {
  if (battle === null) return
  let entitys: EntityCollection = new EntityCollection()
  // 用于计算整体视野的 BoundingSphere（包含所有圆与多边形）
  let combinedBS: Cesium.BoundingSphere | null = null
  const createAreaMode = battle.createAreaMode
  if (createAreaMode === '圆') {
    const circleJSON = JSON.parse(battle.circleJSON!) as { name: string; center: [number, number]; radiusKm: number }[]
    if (circleJSON.length === 0) return
    circleJSON.forEach((circle) => {
      const center = Cesium.Cartesian3.fromDegrees(circle.center[0], circle.center[1], circle.radiusKm * 1000)
      const entity = viewer.entities.add({
        position: center,
        ellipse: {
          semiMinorAxis: circle.radiusKm * 1000,
          semiMajorAxis: circle.radiusKm * 1000,
          height: 0,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.YELLOW.withAlpha(0.3)),
          outline: true,
          outlineColor: Cesium.Color.RED,
        },
      })
      entitys.add(entity)
      // 为圆生成 BoundingSphere 并合并
      try {
        const bs = new Cesium.BoundingSphere(center, circle.radiusKm * 1000)
        combinedBS = combinedBS ? Cesium.BoundingSphere.union(combinedBS, bs, new Cesium.BoundingSphere()) : bs
      } catch (e) {
        // 忽略计算错误，继续处理其它要素
      }
    })
  } else if (createAreaMode === '多边形') {
    const polygonJSON = JSON.parse(battle.area!) as {
      name: string
      lonlats: [number, number][]
    }[]
    if (polygonJSON.length === 0) return
    polygonJSON.forEach((polygon) => {
      const raw = (polygon as any).lonlats
      if (!Array.isArray(raw) || raw.length === 0) return

      const points = raw
        .map((p: any) => {
          if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number') {
            return Cesium.Cartesian3.fromDegrees(p[0], p[1])
          }
          if (p && typeof p === 'object') {
            const lon = typeof p.lon === 'number' ? p.lon : typeof p.lng === 'number' ? p.lng : undefined
            const lat = typeof p.lat === 'number' ? p.lat : undefined
            if (typeof lon === 'number' && typeof lat === 'number') {
              return Cesium.Cartesian3.fromDegrees(lon, lat)
            }
          }
          return null
        })
        .filter((pt) => pt !== null) as Cesium.Cartesian3[]

      if (points.length === 0) return

      // 生成正式闭合多边形
      const entity = viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(points),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE.withAlpha(0.3)),
          perPositionHeight: true,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15000000),
        },
        polyline: {
          positions: [...points, points[0]], // 闭合线
          width: 2,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.RED),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15000000),
        },
      })

      entitys.add(entity)
      // 计算多边形的 BoundingSphere 并合并到 overall
      try {
        const bs = Cesium.BoundingSphere.fromPoints(points)
        if (bs) {
          combinedBS = combinedBS ? Cesium.BoundingSphere.union(combinedBS, bs, new Cesium.BoundingSphere()) : bs
        }
      } catch (e) {
        // 忽略计算错误
      }
    })
  }

  // 如果存在计算出的总 BoundingSphere，则让相机飞到该范围
  if (combinedBS) {
    // 避免半径为 0 导致视角过近
    const bs = combinedBS as Cesium.BoundingSphere
    if (!bs.radius || bs.radius === 0 || bs.radius < orbit_altitude_km) bs.radius = orbit_altitude_km
    try {
      const offset = new Cesium.HeadingPitchRange(0.0, -Cesium.Math.toRadians(90.0), Math.min(bs.radius * 2, 15000000))
      viewer.camera.flyToBoundingSphere(bs, { duration: 1.5, offset })
      // 若相机视角飞到包围球，保存当前的坐标和朝向到 store 中，供其它组件使用
      const centerCarto = Cesium.Cartographic.fromCartesian(bs.center)
      const lon = Cesium.Math.toDegrees(centerCarto.longitude)
      const lat = Cesium.Math.toDegrees(centerCarto.latitude)
      const battleCenterCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, Math.min(bs.radius * 1.5, 15000000))
      const battleCenterOrientation = new Cesium.HeadingPitchRoll(0.0, -Cesium.Math.toRadians(90.0), 0.0)
      store.setBattleCenter(battleCenterCartesian, battleCenterOrientation)
    } catch (e) {
      // 备用：若 flyToBoundingSphere 不可用，使用 flyTo
      try {
        const bs = combinedBS as Cesium.BoundingSphere
        const centerCarto = Cesium.Cartographic.fromCartesian(bs.center)
        const lon = Cesium.Math.toDegrees(centerCarto.longitude)
        const lat = Cesium.Math.toDegrees(centerCarto.latitude)
        // 在store 中保存当前战场中心坐标，供其它组件使用
        const battleCenterCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, Math.min(bs.radius * 2, 15000000))
        const battleCenterOrientation = new Cesium.HeadingPitchRoll(0.0, -Cesium.Math.toRadians(45.0), 0.0)
        store.setBattleCenter(battleCenterCartesian, battleCenterOrientation)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(lon, lat, Math.min(bs.radius * 2, 15000000)),
          orientation: battleCenterOrientation,
          duration: 1.5,
        })
      } catch (_) {
        // 最后兜底，不抛出
      }
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
