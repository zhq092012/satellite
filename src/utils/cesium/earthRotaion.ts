import { useLayoutStore } from '@/store/modules/layout'
import * as Cesium from 'cesium'
const store = useLayoutStore()
/**
 * 转换地球参考系
 * @param viewer 视图
 * @param isEnabled 是否启动惯性参考系
 */
export class EarthRotationController {
  private viewer: Cesium.Viewer
  private enabled = false
  private handler: (scene: Cesium.Scene, time: Cesium.JulianDate) => void

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer
    this.handler = this.onPostUpdate
  }

  enable() {
    if (this.enabled) return
    // 开启光照
    this.viewer.scene.globe.enableLighting = true
    this.viewer.scene.postUpdate.addEventListener(this.handler)
    this.enabled = true
    console.log('EarthRotationController enabled')
  }

  disable() {
    if (!this.enabled) return
    this.viewer.scene.globe.enableLighting = false
    this.viewer.scene.postUpdate.removeEventListener(this.handler)
    this.enabled = false
    // 尝试恢复相机到默认变换，避免残留绑定导致视图异常

    try {
      this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      this.viewer.camera.flyTo({
        destination: store.battleCenterCartensian || Cesium.Cartesian3.fromDegrees(0, 0, 10000000),
        orientation: store.battleCenterOritentation || { heading: 0.0, pitch: -Cesium.Math.toRadians(90.0), roll: 0.0 },
        duration: 1.5,
      })
    } catch (e) {
      console.warn('reset camera transform failed', e)
    }
    console.log('EarthRotationController disabled')
  }

  isEnabled() {
    return this.enabled
  }

  private onPostUpdate = (scene: Cesium.Scene, time: Cesium.JulianDate) => {
    if (scene.mode !== Cesium.SceneMode.SCENE3D) {
      return
    }

    try {
      // 计算 ICRF 到固定坐标系的转换矩阵
      const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(time)
      if (!Cesium.defined(icrfToFixed)) {
        return
      }

      const camera = this.viewer.camera
      const offset = Cesium.Cartesian3.clone(camera.position)
      const transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed)

      camera.lookAtTransform(transform, offset)

      // 更新太阳位置（可选）
      this.updateSunLight(scene, time, icrfToFixed)
    } catch (e) {
      console.error('ICRF 更新失败:', e)
    }
  }

  private updateSunLight(scene: Cesium.Scene, time: Cesium.JulianDate, icrfToFixed: Cesium.Matrix3) {
    // 计算日心惯性系中太阳的位置
    const sunPosition = Cesium.Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(
      time,
      new Cesium.Cartesian3()
    )
    // 转换太阳方向到固定坐标系
    const fixedSun = Cesium.Matrix3.multiplyByVector(icrfToFixed, sunPosition, new Cesium.Cartesian3())

    scene.light = new Cesium.DirectionalLight({
      direction: Cesium.Cartesian3.normalize(fixedSun, new Cesium.Cartesian3()),
    })
  }
}
