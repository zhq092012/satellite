import * as Cesium from 'cesium'

/** 拖拽画圆完成回调参数 */
export interface DrawCircleCompletePayload {
  /** 圆心经度（度） */
  centerLng: number
  /** 圆心纬度（度） */
  centerLat: number
  /** 圆半径（千米） */
  radiusKm: number
}

/**
 * 在 Cesium 地球上通过按下拖动绘制圆形区域。
 * 左键按下设圆心，拖动调整半径，左键释放结束。
 */
export class DrawCircleByDrag {
  viewer: Cesium.Viewer
  fillColor: Cesium.Color
  outlineColor: Cesium.Color
  handler: Cesium.ScreenSpaceEventHandler | null = null
  centerCartesian: Cesium.Cartesian3 | null = null
  dragging = false
  previewEntity: Cesium.Entity | null = null
  onComplete?: (payload: DrawCircleCompletePayload) => void
  onDrawStopped?: () => void

  constructor(
    viewer: Cesium.Viewer,
    options: {
      fillColor?: Cesium.Color
      outlineColor?: Cesium.Color
      onComplete?: (payload: DrawCircleCompletePayload) => void
      /** 结束绘制（含取消、半径过小）时回调 */
      onDrawStopped?: () => void
    } = {},
  ) {
    this.viewer = viewer
    this.fillColor = options.fillColor ?? Cesium.Color.CYAN.withAlpha(0.35)
    this.outlineColor = options.outlineColor ?? Cesium.Color.CYAN
    this.onComplete = options.onComplete
    this.onDrawStopped = options.onDrawStopped
  }

  /** 开始监听拖拽画圆 */
  start() {
    this.stop()
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas)
    this.handler.setInputAction((e) => this.onLeftDown(e), Cesium.ScreenSpaceEventType.LEFT_DOWN)
    this.handler.setInputAction((e) => this.onMouseMove(e), Cesium.ScreenSpaceEventType.MOUSE_MOVE)
    this.handler.setInputAction((e) => this.onLeftUp(e), Cesium.ScreenSpaceEventType.LEFT_UP)
    this.viewer.canvas.style.cursor = 'crosshair'
  }

  /** 停止监听并清理预览 */
  stop() {
    const wasDrawing = Boolean(this.handler)
    if (this.handler) {
      this.handler.destroy()
      this.handler = null
    }
    this.viewer.canvas.style.cursor = 'default'
    this.clearPreview()
    this.centerCartesian = null
    this.dragging = false
    if (wasDrawing) {
      this.onDrawStopped?.()
    }
  }

  private pickCartesian(position: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    const ray = this.viewer.camera.getPickRay(position)
    if (!ray) return null
    return this.viewer.scene.globe.pick(ray, this.viewer.scene) ?? null
  }

  private onLeftDown(e: { position: Cesium.Cartesian2 }) {
    const pos = this.pickCartesian(e.position)
    if (!pos) return
    this.centerCartesian = pos
    this.dragging = true
    this.ensurePreviewEntity()
  }

  private onMouseMove(e: { endPosition: Cesium.Cartesian2 }) {
    if (!this.dragging || !this.centerCartesian) return
    const edge = this.pickCartesian(e.endPosition)
    if (!edge) return
    const radiusM = Cesium.Cartesian3.distance(this.centerCartesian, edge)
    if (!Number.isFinite(radiusM) || radiusM <= 0) return
    this.updatePreview(radiusM)
  }

  private onLeftUp(e: { position: Cesium.Cartesian2 }) {
    if (!this.dragging || !this.centerCartesian) return
    const edge = this.pickCartesian(e.position)
    if (!edge) {
      this.stop()
      return
    }
    const radiusM = Cesium.Cartesian3.distance(this.centerCartesian, edge)
    const radiusKm = radiusM / 1000
    if (radiusKm < 0.01) {
      this.stop()
      return
    }

    const centerCarto = Cesium.Cartographic.fromCartesian(this.centerCartesian)
    const centerLng = Cesium.Math.toDegrees(centerCarto.longitude)
    const centerLat = Cesium.Math.toDegrees(centerCarto.latitude)

    this.viewer.entities.add({
      position: this.centerCartesian,
      ellipse: {
        semiMajorAxis: radiusM,
        semiMinorAxis: radiusM,
        material: this.fillColor,
        outline: true,
        outlineColor: this.outlineColor,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })

    this.onComplete?.({ centerLng, centerLat, radiusKm })
    this.stop()
  }

  private previewRadiusM = 1

  private ensurePreviewEntity() {
    if (this.previewEntity || !this.centerCartesian) return
    this.previewEntity = this.viewer.entities.add({
      position: new Cesium.ConstantPositionProperty(this.centerCartesian),
      ellipse: {
        semiMajorAxis: new Cesium.CallbackProperty(() => this.previewRadiusM, false),
        semiMinorAxis: new Cesium.CallbackProperty(() => this.previewRadiusM, false),
        material: this.fillColor,
        outline: true,
        outlineColor: this.outlineColor,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })
  }

  private updatePreview(radiusM: number) {
    this.previewRadiusM = radiusM
    this.ensurePreviewEntity()
  }

  private clearPreview() {
    if (this.previewEntity) {
      this.viewer.entities.remove(this.previewEntity)
      this.previewEntity = null
    }
    this.previewRadiusM = 1
  }
}