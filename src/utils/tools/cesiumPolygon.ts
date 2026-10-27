import * as Cesium from 'cesium'
import { listenClickPositionCartesian } from './cameraTools'
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
