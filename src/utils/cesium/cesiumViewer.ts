import * as Cesium from 'cesium'
import { TiandituImagercyProvider } from './mapConfig'
import type { PointData } from '@/types/dashboard'

interface ViewerConfig {
  creditContainerId: string
  containerId: string
  tiandituKey: string
}
class CesiumViewer {
  private viewer: Cesium.Viewer | null = null
  private tiandituProvider: TiandituImagercyProvider | null = null
  constructor(private config: ViewerConfig) {

  }
  /**
   * 初始化Cesium Viewer
   */
  async initViewer(): Promise<Cesium.Viewer> {
    //等待世界地形就绪
    const terrainProvider = await Cesium.createWorldTerrainAsync({
      requestVertexNormals: true, //请求法向量
      requestWaterMask: true, //请求水印
    })

    // 创建天地图影像和标注图层
    const imgProvider = this.tiandituProvider?.createImageryProvider()
    const ciaProvider = this.tiandituProvider?.createCiaProvider()
    //创建Viewer
    this.viewer = new Cesium.Viewer(this.config.containerId, {
      baseLayerPicker: false,
      animation: false,
      geocoder: false,
      fullscreenButton: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: true,
      timeline: false,
      navigationHelpButton: false,
      baseLayer: new Cesium.ImageryLayer(imgProvider),
      creditContainer: this.config.creditContainerId, //不显示版权信息
      terrainProvider,
    })
    if (ciaProvider) {
      this.viewer.imageryLayers.addImageryProvider(ciaProvider)
    }
    return this.viewer
  }
}
const cesiumViewer = new CesiumViewer({
  creditContainerId: 'creditContainer',
  containerId: 'cesiumContainer',
  tiandituKey: import.meta.env.VITE_TDT_KEY,
})
/**
 * 创建单位
 * @param type 'our' 我方 'enemy' 敌方
 * @param id 唯一标识
 * @param name 名称
 * @param longitude 经度
 * @param latitude 纬度
 * @param pointData  单位数据
 * @param addEntity 是否添加实体
 */
export function createBillboard(pointData: PointData): Promise<string> {
  // 生成一个圆形带白色边框的画布图标并把点位图片绘制在中央，最终返回 DataURL
  const size = 30 // 画布宽高（像素）
  const iconSize = 24 // 内部图标实际绘制大小
  const canvas = document.createElement('canvas') // 创建 canvas 元素
  canvas.width = size // 设置 canvas 宽度
  canvas.height = size // 设置 canvas 高度
  const ctx = canvas.getContext('2d')! // 获取 2D 绘图上下文
  // 开始绘制外圆背景
  ctx.beginPath()
  // 绘制圆（在画布中心，半径留 2px 的内边距用于描边）
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI)
  // 根据点的类型选择填充色（我方蓝色、敌方红色、默认灰色）
  ctx.fillStyle = pointData.type === 'our' ? '#ff4040' : pointData.type === 'enemy' ? '#4083ff' : '#696969'
  ctx.fill()
  // 配置白色边框用于突出图标
  ctx.lineWidth = 3
  ctx.strokeStyle = '#fff'
  ctx.stroke()

  // 返回一个 Promise，用于在图片加载完成后将其绘制到 canvas 并返回 DataURL
  return new Promise<string>((resolve) => {
    // 创建图片对象并设置跨域，以便 canvas.toDataURL 不受跨域限制
    const iconImg = new window.Image()
    iconImg.crossOrigin = 'anonymous'
    // 图片加载完成后绘制到 canvas 中心
    iconImg.onload = function () {
      // 在画布中心位置绘制图片
      ctx.drawImage(iconImg, (size - iconSize) / 2, (size - iconSize) / 2, iconSize, iconSize)
      // 导出为 DataURL 字符串并 resolve
      resolve(canvas.toDataURL())
    }
    // 设置图片来源，开始加载
    iconImg.src = pointData.img
  })
}
// 创建支持 emoji 的 billboard 函数
export function createEmojiBillboard(pointData: PointData & { emoji: string }): Promise<string> {
  // 不绘制背景和边框，直接使用彩色 emoji 原始颜色与合适大小
  const size = 32
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  const canvas = document.createElement('canvas')
  // 使用物理像素并通过样式保持逻辑像素大小
  canvas.width = size * dpr
  canvas.height = size * dpr
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // 让 emoji 占据大部分画布，保留少量内边距
  const fontSize = Math.floor(size * 0.85)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`

  // 对于彩色 emoji 字体，浏览器会使用字体的真实颜色；这里保持 fillStyle 为黑色以兼容无法上色的回退字体
  ctx.fillStyle = '#000'
  ctx.fillText(pointData.emoji, size / 2, size / 2)

  return Promise.resolve(canvas.toDataURL())
}
/**
 *  添加粒子系统
 * @param viewer
 * @param img
 * @param longitude 经度
 * @param latitude 纬度
 * @param altitude 高度
 * @param isLoop 是否循环
 * @param lifetime 生命周期
 * @param burstsTime 集中爆发事件
 * @param emissionRate 每秒发射的粒子数量
 * @param sizeInMeters 是否透视（使用真实近大远小）
 */
export const explosion = (
  viewer: Cesium.Viewer,
  img: string,
  longitude: number,
  latitude: number,
  altitude: number,
  isLoop: boolean = false,
  lifetime: number = 10.0,
  burstsTime: number = 0.1,
  emissionRate: number = 0,
  sizeInMeters: boolean = false
) => {
  // 兼容用户传入错误的 public 路径前缀（vite 在 public 文件夹直接映射到根路径）
  const imageSrc = typeof img === 'string' && img.startsWith('/public/') ? img.replace('/public', '') : img

  const particle = viewer.scene.primitives.add(
    new Cesium.ParticleSystem({
      image: imageSrc, // 火光贴图（URL 或 HTMLImageElement）
      imageSize: new Cesium.Cartesian2(48, 48), // 贴图像素大小（当 sizeInMeters=false 时生效）
      sizeInMeters: sizeInMeters, //粒子大小固定为 48x48 像素。无论相机离得远还是近，粒子看起来一样大。适合 HUD、屏幕特效、或者像本例中可能需要在远距离也能看清的 “闪光”。
      emissionRate: emissionRate, //每秒发射的粒子数量 默认为5,改为0避免持续发射
      // 颜色：高温白→橙→暗红→透明
      startColor: Cesium.Color.WHITE.withAlpha(0.95),
      endColor: Cesium.Color.RED.withAlpha(0.0),

      // 尺寸：1 倍 → 2 倍
      startScale: 1.0,
      endScale: 2.0,

      //粒子扩散需要的速度，随机1.5-2.0秒后消失
      minimumParticleLife: 1.5,
      maximumParticleLife: 2.0,

      // 速度：15~25 m/s 向外飞
      minimumSpeed: 15,
      maximumSpeed: 25,

      // 发射器：锥形 45°，粒子向上扩散
      emitter: new Cesium.ConeEmitter(Cesium.Math.toRadians(45)),

      // 9.9秒一次性爆发 800 个粒子
      bursts: [
        new Cesium.ParticleBurst({
          time: burstsTime,
          minimum: 800,
          maximum: 2000,
        }),
      ],

      // 整个系统在短时间后移除，非循环
      lifetime: lifetime,
      loop: isLoop,
    })
  )

  particle.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(longitude, latitude, altitude)
  )
}

// 转换惯性参考系
function icrf(viewer: Cesium.Viewer, scene: Cesium.Scene, time: Cesium.JulianDate) {
  if (scene.mode !== Cesium.SceneMode.SCENE3D) {
    return
  }

  const icrfToFixed = Cesium.Transforms.computeIcrfToFixedMatrix(time)
  if (Cesium.defined(icrfToFixed)) {
    const camera = viewer.camera
    const offset = Cesium.Cartesian3.clone(camera.position)
    const transform = Cesium.Matrix4.fromRotationTranslation(icrfToFixed)
    camera.lookAtTransform(transform, offset)
  }
  // 调整晨昏线
  const sunECF = new Cesium.Cartesian3(1, 0, 0) // 春分正午方向
  scene.light = new Cesium.DirectionalLight({
    direction: Cesium.Cartesian3.normalize(sunECF, new Cesium.Cartesian3()),
  })
}

export { cesiumViewer }
