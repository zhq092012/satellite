interface SatelliteInfo {
  _id: string
  norad: number
  name_en: string
  int_id: string
  sat_type: string
  satellitePosition: {
    latitude: number
    longitude: number
    altitude: number
  }
}
interface Satellite {
  get_id: string
  norad: number
  description: string
  img: string
  code_id: string
  int_id: string
  name_en: string
  name_cn: string
  country: string
  target_type: number
  orbit_status: number
  orbit_type: number
  orbit_class: number
  payload_status: number
  sat_type: string
  epoch: string
  a: number
  e: number
  i: number
  o: number
  w: number
  m: number
  prg: number
  apg: number
  cycle: number
  no: number
  bstar: number
  asc_longitude: number
  asc_hours: number
  rcs: number
  launch_date: string
  launch_place: string
  rocket: string
  fallen_date: string
  contractors: string
  operator: string
  equipment: string
  configuration: string
  propulsion: string
  power: string
  lifetime: string
  sat_series_id: string
  create_time: string
  update_time: string
  is_deleted: number
  mass: number
  shape: string
  width: number
  height: number
  depth: number
  diameter: number
  span: number
  xsectmax: number
  xsectmin: number
  xsectavg: number
  name_all: string
}

interface SatelliteDetail {
  _id: string
  norad: number
  description: string
  img: string
  code_id: null | string | number
  int_id: string
  name_en: string
  name_cn: null | string | number
  country: string
  target_type: number
  orbit_status: number
  orbit_type: number
  orbit_class: number
  payload_status: number
  sat_type: string
  epoch: null | string | number
  a: number
  e: number
  i: number
  o: null | string | number
  w: null | string | number
  m: null | string | number
  prg: number
  apg: number
  cycle: number
  no: number
  bstar: null | string | number
  asc_longitude: null | string | number
  asc_hours: null | string | number
  rcs: null | string | number
  launch_date: string
  launch_place: string
  rocket: string
  fallen_date: number[]
  contractors: string
  operator: null | string | number
  equipment: string
  configuration: string
  propulsion: string
  power: string
  lifetime: string
  sat_series_id: string
  create_time: string
  update_time: string
  is_deleted: number
  mass: number
  shape: string
  width: number
  height: number
  depth: number
  diameter: null | string | number
  span: number
  xsectmax: number
  xsectmin: number
  xsectavg: number
  name_all: string
}
/**
 * 卫星TLE数据解析
 */
interface SatelliteTle {
  _id: string
  /** 全球唯一ID */
  norad_id: number
  line1: string
  line2: string
  /** TLE历元时刻 这组根数“有效瞬间”的 UTC 时刻，格式 YYDDD.ffffffff（年＋年内天）。例 25184.40558737 = 2025-07-03 09:44:00 UTC。 */
  epoch: string
  /** 轨道倾角 卫星轨道平面与赤道平面夹角，°；0°≈赤道，90°≈极轨，决定了地面能看到的纬度范围。 */
  inclination: number
  /** 升交点赤经 春分点→升交点的地心角，°；告诉你在哪个“经度”穿过赤道向北。 */
  raan: number
  /** 偏心率 0=正圆，0–1=椭圆；值越大轨道越“扁”；例 0.18 表示远地点比近地点高约 36%。*/
  eccentricity: number
  /** 近地点幅角 从升交点→近地点在轨道面内转过的角度，°；决定椭圆“长轴”指向哪。*/
  arg_perigee: number
  /** 平近点角 历元时刻卫星在轨道上的“平均角度”，°；配合平均运动可算此刻真位置。 */
  mean_anomaly: number
  /** 半长轴 轨道大小，km；圆轨道时 = 轨道半径；与周期直接挂钩：T=2π√(a³/GM)。*/
  semi_major_axis: number
  /** 数据下载时间 */
  retrieval_time: string
  name: null | string
  country: null | string
  target_type: null | string
  orbit_type: null | string
}
/**
 * 任务步骤
 */
interface TaskSteps {
  id: number
  name: string
  startTime: string
  endTime: string
  sateTypeShow: string[]
  sateType: string
  /**
   *  作战目标
   */
  target: string
}
interface StepSatellite {
  taskStepResp: {
    id: number
    name: string
    startTime: string
    endTime: string
    sateType: string
    target: string
  }
  structureList: {
    name: string
    gjList: {
      norad_id: string
      satellite: string | null
      geoCoordinates: {
        latitude: number
        longitude: number
        altitude: number
      }
      country: string
      orbit_status: number
      orbit_type: number
      payload_status: number
      sat_type: string
      int_id: string
      name_en: string
      contractors: string
      launch_place: string
      rocket: string
      operator: string
      threat_level: string
      gjMap: {
        地区: string
        过境持续时间_分: string
        norad_id: number
        过境_峰值仰角: string
        过境_开始时间: string
        过境_结束时间: string
        过境_方位角: string
        过境_峰值时间: string
      }
    }[]
  }[]
}
