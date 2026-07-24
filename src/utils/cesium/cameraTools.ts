import * as Cesium from 'cesium'
interface CameraPos {
  longitude: number
  latitude: number
  height: number
  heading: number
  pitch: number
}
/**
 * 获取相机当前位置的经纬度
 * @param viewer
 * @returns
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
 * 添加监听器，输出当前视图的相机信息
 * @param viewer
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
 * 获取点击位置经纬度
 * @param event
 * @param viewer
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
