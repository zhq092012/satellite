import { useLayoutStore } from '@/store/modules/layout'
import type { BattleForm } from '@/types/dashboard';
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
/** 战场名称离地高度（米），配合 CLAMP_TO_GROUND 紧贴地表显示 */
const BATTLE_SPACE_LABEL_ALTITUDE_M = 50

/** 战场名称标签与区域边界的最小间距（度） */
const BATTLE_LABEL_BOUNDS_MARGIN_DEG = 0.08

/**
 * 从战场区域 JSON 解析地理中心点。
 *
 * @param battle 战场表单
 * @returns 经纬度中心；无法解析时返回 null
 */
/**
 * 从多边形坐标项中解析经纬度。
 *
 * @param point 坐标项（数组或 {lon,lat} 对象）
 * @returns 经纬度或 null
 */
const parseLonLatPoint = (point: unknown): { lon: number; lat: number } | null => {
  if (Array.isArray(point) && point.length >= 2) {
    const lon = Number(point[0])
    const lat = Number(point[1])
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat }
  }
  if (point && typeof point === 'object') {
    const record = point as { lon?: number; lng?: number; lat?: number }
    const lon = typeof record.lon === 'number' ? record.lon : typeof record.lng === 'number' ? record.lng : NaN
    const lat = typeof record.lat === 'number' ? record.lat : NaN
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat }
  }
  return null
}

/**
 * 计算战场区域中心点。
 *
 * @param battle 战场表单
 * @returns 经纬度中心；无法解析时返回 null
 */
export function resolveBattleGeoCenter(battle: BattleForm | null): { lon: number; lat: number } | null {
  // 如果战场表单为空，则返回 null
  if (!battle) return null

  // 如果战场区域模式为多边形且有区域坐标，则解析多边形坐标
  if (battle.createAreaMode === '多边形' && battle.area) {
    try {
      const polygons = JSON.parse(battle.area) as { lonlats?: unknown[] }[]
      // 解析多边形坐标，并过滤掉解析失败的坐标
      const coords = polygons.flatMap((polygon) => polygon.lonlats || []).map(parseLonLatPoint).filter(Boolean) as {
        lon: number
        lat: number
      }[]
      if (coords.length) {
        const lon = coords.reduce((sum, point) => sum + point.lon, 0) / coords.length
        const lat = coords.reduce((sum, point) => sum + point.lat, 0) / coords.length
        // 如果经纬度都为有限数，则返回经纬度中心
        if (Number.isFinite(lon) && Number.isFinite(lat)) return { lon, lat }
      }
    } catch {
      // ignore parse error
    }
  }

  // 如果战场区域模式为圆形且有圆形坐标，则解析圆形坐标
  if (battle.circleJSON) {
    try {
      const circles = JSON.parse(battle.circleJSON) as { center?: unknown }[]
      const center = parseLonLatPoint(circles[0]?.center)
      if (center) return center
    } catch {
      // ignore parse error
    }
  }

  return null
}

/**
 * 收集战场区域全部经纬度坐标点。
 *
 * @param battle 战场表单
 * @returns 区域坐标列表
 */
function collectBattleGeoCoords(battle: BattleForm | null): { lon: number; lat: number }[] {
  const coords: { lon: number; lat: number }[] = []
  if (!battle) return coords

  if (battle.createAreaMode === '多边形' && battle.area) {
    try {
      const polygons = JSON.parse(battle.area) as { lonlats?: unknown[] }[]
      polygons
        .flatMap((polygon) => polygon.lonlats || [])
        .forEach((point) => {
          const parsed = parseLonLatPoint(point)
          if (parsed) coords.push(parsed)
        })
    } catch {
      // ignore parse error
    }
  }

  if (battle.circleJSON) {
    try {
      const circles = JSON.parse(battle.circleJSON) as { center?: unknown; radiusKm?: number }[]
      circles.forEach((circle) => {
        const center = parseLonLatPoint(circle.center)
        const radiusKm = typeof circle.radiusKm === 'number' ? circle.radiusKm : 0
        if (center && radiusKm > 0) {
          const latOffset = radiusKm / 111
          const lonOffset = radiusKm / (111 * Math.cos(Cesium.Math.toRadians(center.lat)))
          coords.push({ lon: center.lon - lonOffset, lat: center.lat - latOffset })
          coords.push({ lon: center.lon + lonOffset, lat: center.lat + latOffset })
        } else if (center) {
          coords.push(center)
        }
      })
    } catch {
      // ignore parse error
    }
  }

  return coords
}

/**
 * 计算战场名称标签锚点（置于区域北侧外部，避免遮挡多边形）。
 *
 * @param battle 战场表单
 * @returns 标签经纬度锚点；无法解析时返回 null
 */
export function resolveBattleLabelGeoAnchor(battle: BattleForm | null): { lon: number; lat: number } | null {
  // 收集战场区域全部经纬度坐标点
  const coords = collectBattleGeoCoords(battle)
  // 如果收集到的坐标点为空，则返回战场中心
  if (!coords.length) return resolveBattleGeoCenter(battle)

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  coords.forEach(({ lon, lat }) => {
    // 计算经度最小值
    minLon = Math.min(minLon, lon)
    // 计算经度最大值
    maxLon = Math.max(maxLon, lon)
    // 计算纬度最小值
    minLat = Math.min(minLat, lat)
    // 计算纬度最大值
    maxLat = Math.max(maxLat, lat)
  })

  const centerLon = (minLon + maxLon) / 2
  // 计算纬度跨度
  const latSpan = maxLat - minLat
  // 计算标签与区域边界的最小间距
  const margin = Math.max(latSpan * 0.25, BATTLE_LABEL_BOUNDS_MARGIN_DEG)
  // 返回标签经纬度锚点，锚点在区域北侧外部，避免遮挡多边形
  return { lon: centerLon, lat: maxLat + margin }
}

/**
 * 计算战场名称贴地标签的三维坐标。
 *
 * @param battle 战场表单
 * @param fallbackCenter 已缓存的战场中心（可选，仅取经纬度）
 * @returns 贴地标签坐标
 */
export function resolveBattleSpaceLabelPosition(
  battle: BattleForm | null,
  fallbackCenter?: Cesium.Cartesian3 | null
): Cesium.Cartesian3 | null {
  // 计算战场名称标签锚点
  const anchor = resolveBattleLabelGeoAnchor(battle)
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

/** 战场区域标记可选配置 */
export interface MarkBattleAreaOptions {
  /** 是否将多边形/边线贴地，避免开启 globe 深度检测后被地形遮挡 */
  clampToGround?: boolean
}

/**
 * 在地球上标记战场区域并调整初始视角。
 *
 * @param viewer Cesium Viewer
 * @param battle 战场表单数据
 * @param orbit_altitude_km 初始俯视高度（米）
 * @param options 可选渲染配置
 */
export function markBattleArea(
  viewer: Cesium.Viewer,
  battle: BattleForm | null,
  orbit_altitude_km: number = 24000000,
  options?: MarkBattleAreaOptions
) {
  const clampToGround = options?.clampToGround ?? false
  if (!viewer || (viewer as any).isDestroyed?.() || battle === null) return

  /** 先清掉旧战场面，避免每次 markBattle 再叠加一份 Polygon/Polyline 几何体 */
  const staleBattleEntities = viewer.entities.values.filter((entity) =>
    String(entity.id ?? '').startsWith('battle-area-')
  )
  staleBattleEntities.forEach((entity) => viewer.entities.remove(entity))

  let entitys: EntityCollection = new EntityCollection()
  // 用于计算整体视野的 BoundingSphere（包含所有圆与多边形）
  let combinedBS: Cesium.BoundingSphere | null = null
  const createAreaMode = battle.createAreaMode
  if (createAreaMode === '多边形') {
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
        id: `battle-area-${polygon.name || 'poly'}-${entitys.values.length}`,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(points),
          material: new Cesium.ColorMaterialProperty(Cesium.Color.ORANGE.withAlpha(0.3)),
          ...(clampToGround
            ? { heightReference: Cesium.HeightReference.CLAMP_TO_TERRAIN }
            : { perPositionHeight: true }),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000000),
        },
        polyline: {
          positions: [...points, points[0]], // 闭合线
          width: 2,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.RED),
          ...(clampToGround ? { clampToGround: true } : {}),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 150000000),
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
      const targetAltitude = Math.max(bs.radius * 1.6, 24000000)
      const offset = new Cesium.HeadingPitchRange(0.0, -Cesium.Math.toRadians(90.0), targetAltitude)
      viewer.camera.flyToBoundingSphere(bs, { duration: 1.5, offset })
      // 若相机视角飞到包围球，保存当前的坐标和朝向到 store 中，供其它组件使用
      const centerCarto = Cesium.Cartographic.fromCartesian(bs.center)
      const lon = Cesium.Math.toDegrees(centerCarto.longitude)
      const lat = Cesium.Math.toDegrees(centerCarto.latitude)
      const battleCenterCartesian = Cesium.Cartesian3.fromDegrees(lon, lat, targetAltitude)
      const battleCenterOrientation = new Cesium.HeadingPitchRoll(0.0, -Cesium.Math.toRadians(90.0), 0.0)
      store.setBattleCenter(battleCenterCartesian, battleCenterOrientation)
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
