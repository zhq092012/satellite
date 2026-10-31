import * as Cesium from 'cesium'
import { useLayoutStore } from '@/store/modules/layout'
/*******************************************************
 *  Cesium  选点 → 自动首尾闭合 → 绘制多边形
 *******************************************************/
const store = useLayoutStore()
class DrawClosedPolygon {
  viewer: Cesium.Viewer
  fillColor: Cesium.Color
  outColor: Cesium.Color
  outWidth: number
  points: Cesium.Cartesian3[]
  fixedPoints: Cesium.Cartesian3[]
  mousePoint: Cesium.Cartesian3 | null
  tempLine: Cesium.Entity | null
  tempPoly: Cesium.Entity | null
  handler: Cesium.ScreenSpaceEventHandler | null
  _dynamicPositions: any
  positions: number[] | null

  /**
   * 绑定 Viewer，并可用 options 覆盖填充色、边框色和线宽。
   *
   * @param viewer 绘制所在的 Cesium Viewer
   * @param options 可选样式，字段与类上的 fillColor、outColor、outWidth 同名
   */
  constructor(viewer: Cesium.Viewer, options = {}) {
    this.viewer = viewer
    this.fillColor = Cesium.Color.YELLOW.withAlpha(0.5)
    this.outColor = Cesium.Color.YELLOW
    this.outWidth = 2
    Object.assign(this, options)
    this.points = [] // 已点击的点
    this.fixedPoints = [] // 已点击的线段
    this.mousePoint = null // 鼠标当前点
    this.tempLine = null // 临时折线（动态）
    this.tempPoly = null // 临时面（动态）
    this.handler = null
    this.positions = []
  }

  /**
   * 开始选点。左键落点，鼠标移动预览，右键结束并闭合。
   * 若上一次绘制未停止，会先拆掉旧的事件处理器。
   */
  start() {
    this.stop() // 如果上次没关，先清掉
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas)
    this.handler.setInputAction((e: any) => this._leftClick(e), Cesium.ScreenSpaceEventType.LEFT_CLICK)
    this.handler.setInputAction((e: any) => this._mouseMove(e), Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    this.handler.setInputAction(() => this._finish(), Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    this.viewer.canvas.style.cursor = 'crosshair'
  }

  /**
   * 销毁屏幕事件处理器，并把鼠标恢复为默认样式。未开始绘制时不做事。
   */
  stop() {
    if (!this.handler) return
    this.handler.destroy()
    this.handler = null
    this.viewer.canvas.style.cursor = 'default'
  }

  /**
   * 左键在地形上落一个顶点，并记下经纬度。第一个点会创建跟随鼠标的临时线和面。
   *
   * @param e 屏幕点击位置
   */
  _leftClick(e: { position: Cesium.Cartesian2 }) {
    const ray = this.viewer.camera.getPickRay(e.position)
    if (!ray) return
    const pos = this.viewer.scene.globe.pick(ray, this.viewer.scene)
    if (!pos) return

    this.points.push(pos)
    this.fixedPoints = [...this.points] // 追加后重新赋值
    const res = listenClickPositionCartesian(e, this.viewer)
    if (res) this.positions = this.positions ? this.positions.concat([res.经度, res.纬度]) : [res.经度, res.纬度]
    if (this.points.length === 1) {
      // 第一次点击：创建动态线 + 面
      this.fixedPoints = [...this.points] // 此时只有 1 个点
      this._createTempShape()
    }
  }

  /**
   * 鼠标移动时更新预览点，让临时折线始终连回起点。还没有顶点时忽略。
   *
   * @param e 屏幕上的鼠标位置
   */
  _mouseMove(e: { endPosition: Cesium.Cartesian2 }) {
    if (this.points.length === 0) return
    const ray = this.viewer.camera.getPickRay(e.endPosition)
    if (!ray) return
    const pos = this.viewer.scene.globe.pick(ray, this.viewer.scene)
    if (!pos) return
    this.mousePoint = pos // 只存鼠标点
    // 用 CallbackProperty 让线/面实时刷新
    this._dynamicPositions.pop()
    this._dynamicPositions.pop()
    this._dynamicPositions.push(pos, this.points[0]) // 保证首尾相连
  }

  /**
   * 右键结束绘制。不足 3 个点时清掉临时图形；否则生成闭合多边形和边线，并写入布局 store。
   */
  _finish() {
    if (this.points.length < 3) {
      this._clear()
      return
    }

    // 移除临时实体
    ;[this.tempLine, this.tempPoly].forEach((en) => {
      if (en) this.viewer.entities.remove(en)
    })
    this.tempLine = this.tempPoly = null

    // 生成正式闭合多边形
    this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(this.points),
        material: this.fillColor,
        perPositionHeight: true,
      },
      polyline: {
        positions: [...this.points, this.points[0]], // 闭合线
        width: this.outWidth,
        material: this.outColor,
      },
    })

    if (this.points && this.points.length >= 3) {
      const _points = this.points.map((p) => {
        const cartographic = Cesium.Cartographic.fromCartesian(p)
        const lon = Cesium.Math.toDegrees(cartographic.longitude) // 经度 °
        const lat = Cesium.Math.toDegrees(cartographic.latitude) // 纬度 °
        return { lon, lat }
      })

      store.setPolygon(store.currentPolygonIdx, { name: '', lonlats: _points })
    }

    // if (this.positions && this.positions.length >= 6) {
    //   const sphere = getCircumCircle(this.positions)
    //   if (sphere) {
    //     store.setCircle(store.currentCircleIdx, sphere)
    //   }
    // }
    this.points = []
    this.stop()
  }

  /**
   * 创建跟随鼠标的临时折线和临时面。位置由 CallbackProperty 每帧重算。
   */
  _createTempShape() {
    this._dynamicPositions = [...this.points] // 会实时被 _mouseMove 改
    this.tempLine = this.viewer.entities.add({
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          if (!this.mousePoint) return []
          // 固定点 + 鼠标点 + 回到起点
          return [...this.fixedPoints, this.mousePoint, this.fixedPoints[0]]
        }, false),
        width: this.outWidth,
        material: this.outColor,
      },
    })

    this.tempPoly = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(() => {
          if (!this.mousePoint) return new Cesium.PolygonHierarchy([])
          return new Cesium.PolygonHierarchy([...this.fixedPoints, this.mousePoint, this.fixedPoints[0]])
        }, false),
        material: this.fillColor,
      },
    })
  }

  /**
   * 丢掉已选点和临时实体，不生成正式多边形。点数不够闭合时由 {@link DrawClosedPolygon._finish} 调用。
   */
  _clear() {
    this.points = []
    this.positions = []
    ;[this.tempLine, this.tempPoly].forEach((en) => {
      if (en) this.viewer.entities.remove(en)
    })
    this.tempLine = this.tempPoly = null
  }
}
export { DrawClosedPolygon }
/* ========== 用法示例 ========== */
// const drawer = new DrawClosedPolygon(viewer, {fillColor:Cesium.Color.RED.withAlpha(0.3)});
// drawer.start();   // 开始选点
// 右键结束，自动闭合

interface CameraPos {
  longitude: number
  latitude: number
  height: number
  heading: number
  pitch: number
}
/**
 * 读取相机在椭球面上的位置，以及由视线方向算出的航向和俯仰。
 *
 * @param viewer 提供相机的 Cesium Viewer
 * @returns 经度、纬度、高度（米）、航向和俯仰（度）
 */
function getCameraLocation(viewer: Cesium.Viewer): CameraPos {
  const position = viewer.camera.position
  const direction = viewer.camera.direction
  const cartographic = Cesium.Ellipsoid.WGS84.cartesianToCartographic(position)
  // 经度
  const longitude = Cesium.Math.toDegrees(cartographic.longitude)
  // 纬度
  const latitude = Cesium.Math.toDegrees(cartographic.latitude)
  // 高度
  const height = cartographic.height
  // 计算航向
  let heading = Cesium.Math.toDegrees(Math.atan2(direction.x, direction.y))
  if (heading < 0) {
    heading += 360
  }
  // 计算俯仰角
  const pitch = Cesium.Math.toDegrees(Math.asin(-direction.z))
  return {
    longitude,
    latitude,
    height,
    heading,
    pitch,
  }
}
/**
 * 监听相机开始移动和位置变化，把当前位置打印到控制台。
 *
 * @param viewer 要监听的 Cesium Viewer
 */
export function listenCameraLocaion(viewer: Cesium.Viewer) {
  //监听相机移动事件
  viewer.camera.moveStart.addEventListener(function () {
    console.log(`监测到相机移动`)
  })
  viewer.camera.changed.addEventListener(function () {
    const location = getCameraLocation(viewer)
    console.log(`-------相机当前位置----
    经度:${location.longitude}
    纬度:${location.latitude}
    高度:${location.height}
    航向:${location.heading}
    俯仰角:${location.pitch}`)
  })
}
/**
 * 把一次屏幕点击换成地理坐标：优先取地形高度，取不到时退回椭球面。
 * 同时计算相机姿态，以及从点击点看向相机的航向和仰角，并在该处放一个红点。
 *
 * @param event 屏幕点击事件
 * @param viewer 发生点击的 Viewer
 * @returns 经纬度、高度和角度；点击未落到地球上时为 undefined
 */
export function listenClickPositionCartesian(
  event: Cesium.ScreenSpaceEventHandler.PositionedEvent,
  viewer: Cesium.Viewer
) {
  // --- 新增：把点击位置转换为地理坐标并计算方向角 ---
  // 优先使用地形高度（scene.pickPosition），若不可用回退到椭球 pick
  let clickedCartesian = viewer.scene.pickPosition(event.position)
  if (!clickedCartesian) {
    clickedCartesian = viewer.camera.pickEllipsoid(event.position, viewer.scene.globe.ellipsoid)!
  }
  if (Cesium.defined(clickedCartesian)) {
    const carto = Cesium.Cartographic.fromCartesian(clickedCartesian)
    const lon = Cesium.Math.toDegrees(carto.longitude)
    const lat = Cesium.Math.toDegrees(carto.latitude)
    const height = carto.height

    // 相机自身的 heading/pitch/roll（弧度 -> 度）
    const camHeadingDeg = Cesium.Math.toDegrees(viewer.camera.heading)
    const camPitchDeg = Cesium.Math.toDegrees(viewer.camera.pitch)
    const camRollDeg = Cesium.Math.toDegrees(viewer.camera.roll)

    // 计算从 点击点 指向 相机 的局部 ENU 向量（用于得到相对于该点的航向和仰角）
    const cameraPosWC = viewer.camera.positionWC // 相机世界坐标
    const vecToCamera = Cesium.Cartesian3.subtract(cameraPosWC, clickedCartesian, new Cesium.Cartesian3())

    // 把向量变换到该点的东-北-上(ENU)局部坐标系
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(clickedCartesian)
    const invEnu = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4())
    const localVec = Cesium.Matrix4.multiplyByPointAsVector(invEnu, vecToCamera, new Cesium.Cartesian3())
    const ex = localVec.x,
      ey = localVec.y,
      ez = localVec.z

    // 航向(azimuth)：east->north 顺序 atan2(x, y)
    const azimuthDeg = Cesium.Math.toDegrees(Math.atan2(ex, ey))
    // 仰角(elevation)：向量 z 与水平分量的夹角
    const horizontalLen = Math.sqrt(ex * ex + ey * ey)
    const elevationDeg = Cesium.Math.toDegrees(Math.atan2(ez, horizontalLen))
    viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat), // 经度, 纬度
      point: {
        color: Cesium.Color.RED, // 纯红
        pixelSize: 10, // 像素大小
        outlineWidth: 0, // 不需要轮廓
      },
    })
    console.log({
      经度: lon,
      纬度: lat,
      高度: height,
      朝向: camHeadingDeg,
      俯仰角: camPitchDeg,
      旋转: camRollDeg,
      从点看相机的航向: azimuthDeg, // 从点看相机的航向（度）
      从点看相机的仰角: elevationDeg, // 从点看相机的仰角（度）
    })
    return {
      经度: lon,
      纬度: lat,
      高度: height,
      朝向: camHeadingDeg,
      俯仰角: camPitchDeg,
      旋转: camRollDeg,
      从点看相机的航向: azimuthDeg, // 从点看相机的航向（度）
      从点看相机的仰角: elevationDeg, // 从点看相机的仰角（度）
    }
  }
}
