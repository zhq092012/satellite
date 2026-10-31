import { useLayoutStore } from '@/store/modules/layout'
import * as Cesium from 'cesium'

/** 读取战场中心，自转结束后把相机放回该位置。 */
const store = useLayoutStore()

/**
 * 在三维场景里把地球切到惯性参考系，让地表相对星空转动，并按太阳方向打光。
 */
export class EarthRotationController {
  private viewer: Cesium.Viewer
  private enabled = false
  private handler: (scene: Cesium.Scene, time: Cesium.JulianDate) => void

  /**
   * @param viewer 要控制自转和光照的 Viewer
   */
  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer
    this.handler = this.onPostUpdate
  }

  /**
   * 打开地球光照，并在每帧把相机锁定到惯性参考系。重复调用无效。
   */
  enable() {
    if (this.enabled) return
    // 开启光照
    this.viewer.scene.globe.enableLighting = true
    this.viewer.scene.postUpdate.addEventListener(this.handler)
    this.enabled = true
    console.log('EarthRotationController enabled')
  }

  /**
   * 关闭自转和光照，把相机从惯性系解绑并飞回战场中心。未开启时不做事。
   */
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

  /**
   * @returns 惯性参考系是否处于开启状态
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * 每帧把相机姿态绑到 ICRF，使地球相对星空转动，并刷新太阳光方向。
   * 非三维模式或转换矩阵不可用时跳过。
   *
   * @param scene 当前场景
   * @param time 当前仿真时刻
   */
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

  /**
   * 用 Simon 1994 模型算太阳在地心惯性系的位置，再转到地固系作为定向光方向。
   *
   * @param scene 要写入光照的场景
   * @param time 当前仿真时刻
   * @param icrfToFixed 惯性系到地固系的旋转矩阵
   */
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
