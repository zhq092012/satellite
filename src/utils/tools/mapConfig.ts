import * as Cesium from 'cesium'
interface MapConfig {
  accessToken: string
  tiandituKey: string
}
/**
 * 天地图影像服务提供者
 */
export class TiandituImagercyProvider {
  private tk: string
  constructor(config: MapConfig) {
    //设置Cesium Ion 的默认访问令牌
    Cesium.Ion.defaultAccessToken = config.accessToken
    this.tk = config.tiandituKey
  }

  /**
   * 创建天地图影像服务提供者
   * @returns 返回Cesium的Web地图瓦片服务影像提供者实例
   */
  createImageryProvider(): Cesium.WebMapTileServiceImageryProvider {
    // 配置天地图WMTS服务参数，创建影像服务提供者
    return new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/img_w/wmts?tk=${this.tk}`,
      layer: 'img',
      style: 'default',
      format: 'tiles',
      tileMatrixSetID: 'w',
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maximumLevel: 18,
      credit: new Cesium.Credit('天地图全球影像服务'),
    })
  }

  /**
   * 创建天地图标注服务提供者
   * @returns 返回Cesium的Web地图瓦片服务影像提供者实例
   */
  createCiaProvider(): Cesium.WebMapTileServiceImageryProvider {
    // 配置天地图WMTS服务参数，创建影像服务提供者
    return new Cesium.WebMapTileServiceImageryProvider({
      url: `https://t{s}.tianditu.gov.cn/cia_w/wmts?tk=${this.tk}`,
      layer: 'cia',
      style: 'default',
      format: 'tiles',
      tileMatrixSetID: 'w',
      subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
      maximumLevel: 18,
      credit: new Cesium.Credit('天地图全球影像服务'),
    })
  }
}
