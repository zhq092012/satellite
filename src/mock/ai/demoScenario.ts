/**
 * AI 助手演示场景数据。
 * 与真实任务、矩阵、方案接口无关，专用于无后端数据时的界面演示。
 */

/** 演示用任务概要 */
export interface DemoTaskProfile {
  /** 任务名称 */
  name: string
  /** 任务 ID（演示） */
  id: number
  /** 开始日期 */
  beginDate: string
  /** 结束日期 */
  endDate: string
  /** 作战对象国家 */
  enemyCountries: string[]
  /** 我方国家 */
  meCountries: string[]
  /** 任务说明 */
  description: string
}

/** 演示用威胁度表格行 */
export interface DemoThreatRow {
  /** 国家 */
  country: string
  /** 卫星名称 */
  satelliteName: string
  /** 卫星类型 */
  satelliteType: string
  /** 静态威胁展示 */
  staticThreat: string
  /** 动态威胁展示 */
  dynamicThreat: string
  /** 综合威胁展示 */
  compositeThreat: string
  /** 综合威胁排序数值 */
  compositeThreatSort: number
}

/** 演示用打击记录行 */
export interface DemoAttackRow {
  /** 国家 */
  country: string
  /** 目标卫星 */
  target: string
  /** 武器名称 */
  weaponName: string
  /** 武器类型 */
  weaponType: string
  /** 时间窗 */
  attackWindow: string
  /** 攻击度 */
  attackDegree: string
}

/** 演示用打击方案概要 */
export interface DemoPlanProfile {
  /** 用途类型 */
  usageType: string
  /** 烈度 */
  intensityLevel: string
  /** 方案概述 */
  summary: string
  /** 打击前态势 */
  beforeResult: string
  /** 打击后态势 */
  afterResult: string
  /** 打击前平均覆盖率 */
  beforeAvgCoverage: number
  /** 打击后平均覆盖率 */
  afterAvgCoverage: number
  /** 侦察卫星数量 */
  satNum: number
  /** 可见窗口数 */
  visibleWindowNum: number
  /** 被压制窗口数 */
  visibleWindowStrikeNum: number
  /** 打击记录条数 */
  attackRecordCount: number
}

/** 演示任务 */
export const DEMO_TASK: DemoTaskProfile = {
  name: '西太平洋海区侦察压制演练',
  id: 20250301,
  beginDate: '2025-03-01',
  endDate: '2025-03-07',
  enemyCountries: ['美国', '日本'],
  meCountries: ['中国'],
  description:
    '针对敌方低轨光学与电子侦察星座，实施分阶段窗口压制与链路阻断，重点削弱其首轮回传能力。',
}

/** 演示威胁度矩阵（综合威胁度降序） */
export const DEMO_THREAT_ROWS: DemoThreatRow[] = [
  {
    country: '美国',
    satelliteName: 'USA-274',
    satelliteType: '光学侦察',
    staticThreat: '0.92',
    dynamicThreat: '1.15',
    compositeThreat: '1.06',
    compositeThreatSort: 1.06,
  },
  {
    country: '美国',
    satelliteName: 'USA-311',
    satelliteType: '雷达成像',
    staticThreat: '0.88',
    dynamicThreat: '1.08',
    compositeThreat: '0.95',
    compositeThreatSort: 0.95,
  },
  {
    country: '日本',
    satelliteName: 'JPN-IGS-7',
    satelliteType: '光学侦察',
    staticThreat: '0.81',
    dynamicThreat: '0.97',
    compositeThreat: '0.79',
    compositeThreatSort: 0.79,
  },
  {
    country: '美国',
    satelliteName: 'USA-401',
    satelliteType: '电子侦察',
    staticThreat: '0.76',
    dynamicThreat: '1.02',
    compositeThreat: '0.78',
    compositeThreatSort: 0.78,
  },
  {
    country: '美国',
    satelliteName: 'USA-155',
    satelliteType: '通信中继',
    staticThreat: '0.72',
    dynamicThreat: '0.91',
    compositeThreat: '0.66',
    compositeThreatSort: 0.66,
  },
  {
    country: '日本',
    satelliteName: 'JPN-IGS-4',
    satelliteType: '雷达成像',
    staticThreat: '0.68',
    dynamicThreat: '0.85',
    compositeThreat: '0.58',
    compositeThreatSort: 0.58,
  },
  {
    country: '美国',
    satelliteName: 'USA-529',
    satelliteType: '导弹预警',
    staticThreat: '0.65',
    dynamicThreat: '0.88',
    compositeThreat: '0.57',
    compositeThreatSort: 0.57,
  },
  {
    country: '日本',
    satelliteName: 'JPN-IGS-1',
    satelliteType: '光学侦察',
    staticThreat: '0.61',
    dynamicThreat: '0.79',
    compositeThreat: '0.48',
    compositeThreatSort: 0.48,
  },
]

/** 按国家汇总的威胁卫星数量 */
export const DEMO_THREAT_COUNTRY_PIE: { name: string; value: number }[] = [
  { name: '美国', value: 5 },
  { name: '日本', value: 3 },
]

/** 演示打击记录 */
export const DEMO_ATTACK_ROWS: DemoAttackRow[] = [
  {
    country: '美国',
    target: 'USA-274',
    weaponName: '定向能-甲',
    weaponType: '激光',
    attackWindow: '03-02 08:12 — 08:42',
    attackDegree: '0.91',
  },
  {
    country: '美国',
    target: 'USA-311',
    weaponName: '协同干扰-乙',
    weaponType: '电子',
    attackWindow: '03-02 10:05 — 10:35',
    attackDegree: '0.85',
  },
  {
    country: '日本',
    target: 'JPN-IGS-7',
    weaponName: '定向能-甲',
    weaponType: '激光',
    attackWindow: '03-03 06:20 — 06:50',
    attackDegree: '0.82',
  },
  {
    country: '美国',
    target: 'USA-401',
    weaponName: '链路阻断-丙',
    weaponType: '电子',
    attackWindow: '03-03 14:18 — 14:48',
    attackDegree: '0.79',
  },
  {
    country: '美国',
    target: 'USA-155',
    weaponName: '协同干扰-乙',
    weaponType: '电子',
    attackWindow: '03-04 09:00 — 09:30',
    attackDegree: '0.73',
  },
  {
    country: '日本',
    target: 'JPN-IGS-4',
    weaponName: '定向能-甲',
    weaponType: '激光',
    attackWindow: '03-04 16:40 — 17:10',
    attackDegree: '0.71',
  },
]

/** 演示打击方案 */
export const DEMO_PLAN: DemoPlanProfile = {
  usageType: '军用',
  intensityLevel: '中等',
  summary:
    '采用「先压制高威胁光学星、再切断电子侦察中继」的两段式窗口编排，优先保障我方首轮回传窗口，并对敌方可见窗口实施同步压制。',
  beforeResult:
    '打击前敌方低轨星座对目标海区平均覆盖率约 78%，首轮回传窗口集中在任务开始后 4.2 小时内形成完整闭合。',
  afterResult:
    '打击后高威胁光学与电子侦察星可见窗口被压制 6 个，覆盖率降至 41%，首轮回传闭合时间推迟约 11 小时。',
  beforeAvgCoverage: 78,
  afterAvgCoverage: 41,
  satNum: 8,
  visibleWindowNum: 14,
  visibleWindowStrikeNum: 6,
  attackRecordCount: 6,
}

/** 演示用矩阵汇总指标 */
export const DEMO_MATRIX_METRICS = {
  /** 矩阵内卫星数 */
  satNum: 8,
  /** 接收站数 */
  stationNum: 3,
  /** 打击前平均覆盖率 */
  beforeAvgCoverage: 78,
  /** 打击后平均覆盖率 */
  afterAvgCoverage: 41,
} as const