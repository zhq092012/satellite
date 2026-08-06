import { requestAPI } from '@/utils/tools/request'

import type { AxiosResponseType } from '@/types/http'

/// ==================== 基础子模块 ====================

// 接收站基础信息（用于关系列表）
export interface ReceiveObj {
  receiveId: string;//接收站id
  receiveName: string;//接收站名称
  receiveLatLon: string;//接收站经纬度 格式为："68.350,133.500"
  receiveStatus: number;//接收站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

// 中心云站基础信息（用于关系列表）
export interface StationObj {
  stationId: string;//中心站id
  stationName: string;//中心站名称
  stationLatLon: string;//中心站经纬度  格式为:"68.350,133.500"
  stationStatus: number;//中心站状态 0-未打击（可用） 1-被打击（不可用） 如果是1就没有relations数组了
}

// 站与站之间的拓扑关联映射
export interface RelationMap {
  from: string; // 发起方id，与 receiveId 或 stationId 对应 接收站Id
  to: string;   // 接收方id，与 receiveId 或 stationId 对应 中心云站id
}

// 武器 / 拦截系统配置
export interface Weapon {
  id: string; //武器Id
  name: string; //武器名称
  country: string;//武器所属国家
  type: string;//武器类型 ()
  latitude: number;//武器纬度
  longitude: number; //武器经度
  range: number;//武器射程（km）
}

// ==================== 业务主要结构 ====================

// 初始状态下的过境窗口
export interface InitWindow {
  receiveId: string;//地面接收站id
  receiveName: string;//地面接收站名称
  receiveLat: number;//地面接收站纬度
  receiveLon: number;//地面接收站经度
  peakWindow: string;//开始过境时间窗口
  endWindow: string;//结束过境时间窗口
}

// 初始状态下的卫星矩阵元素
export interface InitMatrix {
  norad: number;//卫星id
  name: string;//卫星名称
  satType: string;//卫星类型
  line1: string;//卫星tle轨道一
  line2: string;//卫星tle轨道二
  initWindows: InitWindow[];//卫星过境时间窗口
}

export interface StationRelationList {
  receiveObjList: ReceiveObj[];// 接收站列表
  stationObjList: StationObj[];// 中心站列表
  relations: RelationMap[];// 站与站之间的拓扑关联映射
}
/**
 * [类型用途]
 * 星间中继拓扑关联单项映射结构。
 *
 * [数据来源]
 * 后端算法矩阵接口返回数据中的 relayRelation.relations 元素。
 *
 * [字段规则]
 * - from: 发起卫星 ID / NORAD (如 "48643")
 * - to: 目标中继卫星 ID / NORAD (如 "22314")
 */
export interface RelayRelationMap {
  /** 发起方卫星 NORAD/Id 字符串 */
  from: string;
  /** 接收方中继卫星 NORAD/Id 字符串 */
  to: string;
  /** 中继卫星过境时间窗口列表 */
  visibilityWindows: SatelliteRelayWindow[]
}

/**
 * [类型用途]
 * 星间中继拓扑关系结构。
 *
 * [数据来源]
 * 后端算法矩阵接口返回数据中的 relayRelation 节点。
 *
 * [字段规则]
 * - relayList: 中继卫星 NORAD 编号列表 (如 [22314])
 * - satelliteList: 普通/观测卫星 NORAD 编号列表 (如 [48643, 57693, 58136])
 * - relations: 星间中继拓扑链路映射列表
 */
export interface RelayRelation {
  /** 中继卫星 NORAD 编号数组 */
  relayList: number[];
  /** 普通/观测卫星 NORAD 编号数组 */
  satelliteList: number[];
  /** 星间中继拓扑链路映射列表 */
  relations: RelayRelationMap[];
}


/**
 * 卫星矩阵中的地面站接收窗口数据结构。
 *
 * 数据来源：后端算法矩阵接口返回数据中的 satelliteMatrixList[].stationWindows 元素。
 *
 * 字段说明：
 * - receiveId: 接收站 ID
 * - receiveName: 接收站名称
 * - peakWindow: 开始过境时间窗口
 * - endWindow: 结束过境时间窗口
 * - strikeStatus: 打击状态（0-未打击，1-被打击）
 * - delayMin: 单个接收站过境/过基站延迟（分钟，可选）
 * - weapons: 针对该窗口的武器/拦截系统配置列表
 */
export interface StationWindow {
  /** 接收站 Id */
  receiveId: string;
  /** 接收站名称 */
  receiveName: string;
  /** 开始过境时间窗口 */
  peakWindow: string;
  /** 结束过境时间窗口 */
  endWindow: string;
  /** 打击状态 0-未打击 1-被打击 */
  strikeStatus: number;
  /** 单个接收窗口延时（分钟，可选） */
  delayMin?: number;
  /** 兼容数据中可能出现的 null 值 武器/拦截系统配置 */
  weapons: Weapon[];
}

// 卫星矩阵元素（包含攻击/干扰及延迟信息）
export interface SatelliteMatrix {
  norad: number;//卫星id
  name: string;//卫星名称
  satType: string;//卫星类型
  delayMin: number;//过基站延迟
  satelliteStatus: number;//卫星状态 0-未打击 1-被打击
  weapons: Weapon[];//武器/拦截系统配置
  stationWindows: StationWindow[];
}

/**
 * [类型用途]
 * 战场过境单个时间窗口数据结构。
 *
 * [数据来源]
 * 后端算法矩阵接口返回数据中的 battleMatrixList[].windows 元素。
 *
 * [字段规则]
 * - startTime: 开始过境时间字符串
 * - endTime: 结束过境时间字符串
 *
 * [使用约束]
 * 保持时间格式一致性。
 */
export interface BattleWindow {
  /** 开始过境时间 */
  startTime: string;
  /** 结束过境时间 */
  endTime: string;
}

/**
 * [类型用途]
 * 卫星过境战场矩阵（BattleMatrix）单项数据结构。
 *
 * [数据来源]
 * 后端算法接口 getMatrixList 返回的 battleMatrixList 节点。
 *
 * [字段规则]
 * - norad: 卫星 NORAD 唯一编号
 * - name: 卫星名称
 * - satType: 卫星类型
 * - gjNum: 过境/过基站次数
 * - windows: 战场过境时间窗口列表
 *
 * [使用约束]
 * 勿随意修改字段类型，以兼容 3D 拓扑图节点提取。
 */
export interface BattleMatrixItem {
  /** 卫星 NORAD 编号 */
  norad: number;
  /** 卫星名称 */
  name: string;
  /** 卫星类型 */
  satType: string;
  /** 过境次数 */
  gjNum: number;
  /** 过境时间窗口列表 */
  windows: BattleWindow[];
}

// 针对 windows 数组项的接口定义
export interface WeaponWindow {
  beginWindow: string; // 时间格式："YYYY-MM-DD HH:mm:ss"
  endWindow: string;   // 时间格式："YYYY-MM-DD HH:mm:ss"
}

export type SatelliteRelayWindow = WeaponWindow
// 主数据项接口定义
export interface WeaponAttackRecord {
  weaponName: string;   // 武器名称
  weaponType: string;   // 武器类型（如："网络病毒" | "电子干扰"）
  beginTime: string;    // 开始时间
  endTime: string;      // 结束时间
  angle: number;        // 角度
  windows: WeaponWindow[]; // 时间窗口列表
  target: string;       // 目标名称
  targetType: string;   // 目标类型（如："接收站"）
}


// ==================== 根数据结构 ====================

/**
 * [类型用途]
 * 算法矩阵根接口返回数据结构。
 *
 * [数据来源]
 * /api/algorithm/calSeriesChain 接口返回 data 结构。
 *
 * [字段规则]
 * - attackPlanList: 攻击计划列表
 * - battleMatrixList: 卫星过境战场矩阵列表
 * - initMatrixList: 初始状态下的过境时间窗口列表
 * - initRelationList: 初始状态下的站站拓扑映射
 * - satelliteMatrixList: 卫星矩阵（包含攻击/干扰及延迟信息）
 * - stationRelationList: 最终拓扑关联映射
 * - series: 卫星系列名称
 *
 * [使用约束]
 * 新增字段必须包含注释并明确类型。
 */
export interface MatrixResult {
  /** 攻击计划列表 */
  attackPlanList: WeaponAttackRecord[];
  /** 卫星过境战场矩阵 */
  battleMatrixList: BattleMatrixItem[];
  /** 初始状态下的过境时间窗口 */
  initMatrixList: InitMatrix[];
  /** 初始状态下的站与站之间的拓扑关联映射 */
  initRelationList: StationRelationList;
  /** 卫星矩阵（包含攻击/干扰及延迟信息） */
  satelliteMatrixList: SatelliteMatrix[];
  /** 站与站之间的拓扑关联映射 */
  stationRelationList: StationRelationList;
  /** 星间中继拓扑关系映射 (可选) */
  relayRelation?: RelayRelation;
  /** 卫星系列 */
  series: string;
}

/**
 * [功能]
 * 获取过境、过基站、延迟、打击以及战场矩阵的数据。
 *
 * [处理规则]
 * 向后端算法计算接口发送 POST 请求并返回 MatrixResult。
 *
 * [副作用]
 * 发送网络 HTTP 请求。
 *
 * [异常处理]
 * 异常由调用方 Axios 拦截器与 catch 逻辑捕获处理。
 *
 * [修改约束]
 * 保持请求参数 data 格式一致。
 *
 * @param data 请求参数对象 (norad, taskId, intensityLevel)
 * @returns 包含 MatrixResult 的 Axios 响应 Promise
 */
export const getMatrixList = (data: { norad: number; taskId: number; intensityLevel: string }) => {
  const url = `/api/algorithm/calSeriesChain`
  return requestAPI.post<AxiosResponseType<MatrixResult>>(url, data)
}

/**
 * [功能]
 * 当后端接口未返回或数据为空时提供完整的电子信息网络算法矩阵默认兜底数据。
 * 包含天基观测卫星、数据中继卫星 (TDRS-6)、12 个地基接收站与 3 个中心云数据中心。
 */
export const getDefaultMatrixData = (): MatrixResult => {
  return {
    series: 'Capella-Constellation',
    attackPlanList: [
      {
        weaponName: '网络病毒',
        weaponType: '网络病毒',
        beginTime: '2026-08-03 16:20:00',
        endTime: '2026-08-03 16:50:00',
        angle: 180,
        windows: [
          {
            beginWindow: '2026-08-03 16:20:00',
            endWindow: '2026-08-03 16:50:00',
          },
        ],
        target: 'CAPELLA-13',
        targetType: '地球观测',
      },
    ],
    initMatrixList: [
      {
        norad: 60419,
        name: 'CAPELLA-13',
        satType: '地球观测',
        line1: '1 60419U 24142A   26133.49944190  .00002381  00000-0  28492-3 0  9990',
        line2: '2 60419  53.0044 208.9792 0001302  86.0099 274.1029 14.87644116 95240',
        initWindows: [
          {
            receiveId: 'REC_IRL',
            receiveName: '爱尔兰Ireland',
            receiveLat: 53.3,
            receiveLon: -8.15,
            peakWindow: '2026-08-03 16:20:00',
            endWindow: '2026-08-03 16:50:00',
          },
        ],
      },
      {
        norad: 48643,
        name: 'STARLINK-V1-0-L28-6',
        satType: '通信',
        line1: '1 48643U 21044F   26133.48239236  .00000525  00000-0  28691-4 0  9990',
        line2: '2 48643  53.0543 147.6710 0001476  94.2486 265.8679 15.06411200272183',
        initWindows: [
          {
            receiveId: 'REC_HWI',
            receiveName: '夏威夷Kapolei',
            receiveLat: 21.33,
            receiveLon: -158.09,
            peakWindow: '2026-08-03 16:00:00',
            endWindow: '2026-08-03 16:30:00',
          },
        ],
      },
      {
        norad: 59444,
        name: 'CAPELLA-14',
        satType: '地球观测',
        line1: '1 59444U 24063A   26133.51231120  .00001920  00000-0  21021-3 0  9991',
        line2: '2 59444  45.0123 120.4412 0001102  77.1023 282.4102 15.12019481 8121',
        initWindows: [
          {
            receiveId: 'REC_ORE',
            receiveName: '俄勒冈Oregon',
            receiveLat: 45.21,
            receiveLon: -123.11,
            peakWindow: '2026-08-03 16:40:00',
            endWindow: '2026-08-03 17:15:00',
          },
        ],
      },
      {
        norad: 58136,
        name: 'STARLINK-30776',
        satType: '通信',
        line1: '1 58136U 23160A   26133.41902120  .00000812  00000-0  31021-4 0  9992',
        line2: '2 58136  53.2102 210.1192 0001201  66.1201 293.4102 15.01920192 4102',
        initWindows: [
          {
            receiveId: 'REC_SVA',
            receiveName: '斯瓦尔巴SvalSat',
            receiveLat: 78.22,
            receiveLon: 15.65,
            peakWindow: '2026-08-03 16:15:00',
            endWindow: '2026-08-03 16:45:00',
          },
        ],
      },
      {
        norad: 57693,
        name: 'CAPELLA-11',
        satType: '地球观测',
        line1: '1 57693U 23120A   26133.40192010  .00001410  00000-0  19021-3 0  9993',
        line2: '2 57693  53.0102 190.4102 0001021  80.4102 279.1023 14.99120491 5192',
        initWindows: [
          {
            receiveId: 'REC_TRA',
            receiveName: '加州特拉西',
            receiveLat: 37.73,
            receiveLon: -121.42,
            peakWindow: '2026-08-03 16:30:00',
            endWindow: '2026-08-03 17:00:00',
          },
        ],
      },
      {
        norad: 22314,
        name: 'TDRS-6 [数据中继]',
        satType: '通信/数据中继',
        line1: '1 22314U 93003B   26133.50192010  .00000120  00000-0  10291-5 0  9994',
        line2: '2 22314  12.4102  45.1029 0002102  12.4102 340.1029  1.00271029 9102',
        initWindows: [],
      },
    ],
    satelliteMatrixList: [
      {
        norad: 60419,
        name: 'CAPELLA-13',
        satType: '地球观测',
        delayMin: 18.5,
        satelliteStatus: 1,
        weapons: [{ id: 'w1', name: '红方-电子打压车01', country: 'CN', type: '电子干扰', latitude: 35.0, longitude: 105.0, range: 2500 }],
        stationWindows: [
          {
            receiveId: 'REC_IRL',
            receiveName: '爱尔兰Ireland',
            peakWindow: '2026-08-03 16:20:00',
            endWindow: '2026-08-03 16:50:00',
            strikeStatus: 1,
            delayMin: 18.5,
            weapons: [{ id: 'w1', name: '红方-电子打压车01', country: 'CN', type: '电子干扰', latitude: 35.0, longitude: 105.0, range: 2500 }],
          },
        ],
      },
      {
        norad: 48643,
        name: 'STARLINK-V1-0-L28-6',
        satType: '通信',
        delayMin: 0,
        satelliteStatus: 0,
        weapons: [],
        stationWindows: [
          {
            receiveId: 'REC_HWI',
            receiveName: '夏威夷Kapolei',
            peakWindow: '2026-08-03 16:00:00',
            endWindow: '2026-08-03 16:30:00',
            strikeStatus: 0,
            weapons: [],
          },
        ],
      },
      {
        norad: 59444,
        name: 'CAPELLA-14',
        satType: '地球观测',
        delayMin: 45.0,
        satelliteStatus: 1,
        weapons: [{ id: 'w2', name: '红方-动能ASAT-02', country: 'CN', type: '动能拦截', latitude: 30.0, longitude: 110.0, range: 3000 }],
        stationWindows: [
          {
            receiveId: 'REC_ORE',
            receiveName: '俄勒冈Oregon',
            peakWindow: '2026-08-03 16:40:00',
            endWindow: '2026-08-03 17:15:00',
            strikeStatus: 1,
            delayMin: 45.0,
            weapons: [{ id: 'w2', name: '红方-动能ASAT-02', country: 'CN', type: '动能拦截', latitude: 30.0, longitude: 110.0, range: 3000 }],
          },
        ],
      },
      {
        norad: 58136,
        name: 'STARLINK-30776',
        satType: '通信',
        delayMin: 0,
        satelliteStatus: 0,
        weapons: [],
        stationWindows: [
          {
            receiveId: 'REC_SVA',
            receiveName: '斯瓦尔巴SvalSat',
            peakWindow: '2026-08-03 16:15:00',
            endWindow: '2026-08-03 16:45:00',
            strikeStatus: 0,
            weapons: [],
          },
        ],
      },
      {
        norad: 57693,
        name: 'CAPELLA-11',
        satType: '地球观测',
        delayMin: 22.0,
        satelliteStatus: 1,
        weapons: [{ id: 'w3', name: '红方-定向能激光站', country: 'CN', type: '定向能', latitude: 40.0, longitude: 90.0, range: 2000 }],
        stationWindows: [
          {
            receiveId: 'REC_TRA',
            receiveName: '加州特拉西',
            peakWindow: '2026-08-03 16:30:00',
            endWindow: '2026-08-03 17:00:00',
            strikeStatus: 1,
            delayMin: 22.0,
            weapons: [{ id: 'w3', name: '红方-定向能激光站', country: 'CN', type: '定向能', latitude: 40.0, longitude: 90.0, range: 2000 }],
          },
        ],
      },
      {
        norad: 22314,
        name: 'TDRS-6 [数据中继]',
        satType: '通信/数据中继',
        delayMin: 0,
        satelliteStatus: 0,
        weapons: [],
        stationWindows: [],
      },
    ],
    relayRelation: {
      relayList: [22314],
      satelliteList: [60419, 48643, 59444, 58136, 57693],
      relations: [
        {
          from: '60419', to: '22314', visibilityWindows: [{
            "beginWindow": "2026-07-28 20:55:20",
            "endWindow": "2026-07-28 21:51:39"
          }]
        },
        {
          from: '48643', to: '22314', visibilityWindows: [{
            "beginWindow": "2026-07-28 20:55:20",
            "endWindow": "2026-07-28 21:51:39"
          }]
        },
        {
          from: '57693', to: '22314', visibilityWindows: [{
            "beginWindow": "2026-07-28 20:55:20",
            "endWindow": "2026-07-28 21:51:39"
          }]
        },
      ],
    },
    initRelationList: {
      receiveObjList: [
        { receiveId: 'REC_IRL', receiveName: '爱尔兰Ireland', receiveLatLon: '53.300, -8.150', receiveStatus: 1 },
        { receiveId: 'REC_HWI', receiveName: '夏威夷Kapolei', receiveLatLon: '21.330, -158.090', receiveStatus: 0 },
        { receiveId: 'REC_ORE', receiveName: '俄勒冈Oregon', receiveLatLon: '45.210, -123.110', receiveStatus: 1 },
        { receiveId: 'REC_SVA', receiveName: '斯瓦尔巴SvalSat', receiveLatLon: '78.220, 15.650', receiveStatus: 0 },
        { receiveId: 'REC_TRA', receiveName: '加州特拉西', receiveLatLon: '37.730, -121.420', receiveStatus: 1 },
        { receiveId: 'REC_AK', receiveName: '阿拉斯加Inuvik', receiveLatLon: '68.350, -133.500', receiveStatus: 0 },
        { receiveId: 'REC_NOR', receiveName: '挪威Tromso', receiveLatLon: '69.640, 18.950', receiveStatus: 0 },
        { receiveId: 'REC_CHL', receiveName: '智利Santiago', receiveLatLon: '-33.440, -70.660', receiveStatus: 0 },
        { receiveId: 'REC_ESP', receiveName: '西班牙Madrid', receiveLatLon: '40.410, -3.700', receiveStatus: 0 },
        { receiveId: 'REC_DUB', receiveName: '澳洲Dubbo', receiveLatLon: '-32.250, 148.610', receiveStatus: 0 },
        { receiveId: 'REC_JPN', receiveName: '日本Tokyo', receiveLatLon: '35.670, 139.650', receiveStatus: 0 },
        { receiveId: 'REC_UK', receiveName: '英国Goonhilly', receiveLatLon: '50.040, -5.180', receiveStatus: 0 },
      ],
      stationObjList: [
        { stationId: 'STA_01', stationName: '华盛顿云数据中心', stationLatLon: '38.900, -77.030', stationStatus: 0 },
        { stationId: 'STA_02', stationName: '圣迭戈指挥中心', stationLatLon: '32.710, -117.160', stationStatus: 0 },
        { stationId: 'STA_03', stationName: '伦敦备用中心', stationLatLon: '51.500, -0.120', stationStatus: 0 },
      ],
      relations: [
        { from: 'REC_IRL', to: 'STA_01' },
        { from: 'REC_HWI', to: 'STA_02' },
        { from: 'REC_ORE', to: 'STA_02' },
        { from: 'REC_SVA', to: 'STA_01' },
        { from: 'REC_TRA', to: 'STA_02' },
        { from: 'REC_AK', to: 'STA_01' },
        { from: 'REC_NOR', to: 'STA_03' },
        { from: 'REC_UK', to: 'STA_03' },
      ],
    },
    stationRelationList: {
      receiveObjList: [
        { receiveId: 'REC_IRL', receiveName: '爱尔兰Ireland', receiveLatLon: '53.300, -8.150', receiveStatus: 1 },
        { receiveId: 'REC_HWI', receiveName: '夏威夷Kapolei', receiveLatLon: '21.330, -158.090', receiveStatus: 0 },
        { receiveId: 'REC_ORE', receiveName: '俄勒冈Oregon', receiveLatLon: '45.210, -123.110', receiveStatus: 1 },
        { receiveId: 'REC_SVA', receiveName: '斯瓦尔巴SvalSat', receiveLatLon: '78.220, 15.650', receiveStatus: 0 },
        { receiveId: 'REC_TRA', receiveName: '加州特拉西', receiveLatLon: '37.730, -121.420', receiveStatus: 1 },
        { receiveId: 'REC_AK', receiveName: '阿拉斯加Inuvik', receiveLatLon: '68.350, -133.500', receiveStatus: 0 },
        { receiveId: 'REC_NOR', receiveName: '挪威Tromso', receiveLatLon: '69.640, 18.950', receiveStatus: 0 },
        { receiveId: 'REC_CHL', receiveName: '智利Santiago', receiveLatLon: '-33.440, -70.660', receiveStatus: 0 },
        { receiveId: 'REC_ESP', receiveName: '西班牙Madrid', receiveLatLon: '40.410, -3.700', receiveStatus: 0 },
        { receiveId: 'REC_DUB', receiveName: '澳洲Dubbo', receiveLatLon: '-32.250, 148.610', receiveStatus: 0 },
        { receiveId: 'REC_JPN', receiveName: '日本Tokyo', receiveLatLon: '35.670, 139.650', receiveStatus: 0 },
        { receiveId: 'REC_UK', receiveName: '英国Goonhilly', receiveLatLon: '50.040, -5.180', receiveStatus: 0 },
      ],
      stationObjList: [
        { stationId: 'STA_01', stationName: '华盛顿云数据中心', stationLatLon: '38.900, -77.030', stationStatus: 0 },
        { stationId: 'STA_02', stationName: '圣迭戈指挥中心', stationLatLon: '32.710, -117.160', stationStatus: 0 },
        { stationId: 'STA_03', stationName: '伦敦备用中心', stationLatLon: '51.500, -0.120', stationStatus: 0 },
      ],
      relations: [
        { from: 'REC_HWI', to: 'STA_02' },
        { from: 'REC_SVA', to: 'STA_01' },
        { from: 'REC_AK', to: 'STA_01' },
      ],
    },
    battleMatrixList: [],
  }
}


