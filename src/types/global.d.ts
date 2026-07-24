// 扩展 Window 接口
declare global {
  interface Window {
    UE: any
    CESIUM_BASE_URL: string

    // Qiankun 微前端相关
    __POWERED_BY_QIANKUN__?: boolean
    __INJECTED_PUBLIC_PATH_BY_QIANKUN__?: string

    // 其他可能需要的全局声明
    // __YOUR_CUSTOM_GLOBAL__?: YourType;
    orbitUpdateCache: { [number]: number }
  }
}
export { } // 确保文件被视为模块
declare module 'cesium' {
  interface Timeline {
    makeLabel(julianDate: Cesium.JulianDate): string
  }
}
// 获取数组对象类型工具类型
type Elem<T> = T extends (infer E)[] ? E : never

// 解决.sql文件不能被import的问题 
declare module '*?raw' {
  const content: string;
  export default content;
}
