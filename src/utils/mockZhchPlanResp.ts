import type {
  InitMatrix,
  WeaponAttackRecord,
  ZhchPlanLevelSeriesEntity,
  ZhchPlanResp,
  ThreatSatelliteItem,
} from '@/api/electronic'

/** 演示用 TLE 占位（不参与轨道计算） */
const MOCK_TLE_LINE1 = '1 99999U 24001A   25248.50000000  .00000000  00000+0  00000+0 0    04'
const MOCK_TLE_LINE2 = '2 99999  97.4123 123.4567 0012345  90.0000 270.0000 15.12345678901234'

/**
 * 构造演示用初始卫星矩阵项。
 *
 * @param norad NORAD
 * @param name 名称
 * @param satType 类型
 */
function mockInitSatellite(norad: number, name: string, satType: string): InitMatrix {
  return {
    norad,
    name,
    satType,
    line1: MOCK_TLE_LINE1,
    line2: MOCK_TLE_LINE2,
    orbitType: 1,
    initWindows: [],
  }
}

/**
 * 构造演示用武器打击记录。
 *
 * @param target 目标卫星名
 * @param weaponName 武器名
 * @param weaponType 武器类型
 * @param beginTime 窗口开始
 * @param endTime 窗口结束
 */
function mockAttackRecord(
  target: string,
  weaponName: string,
  weaponType: string,
  beginTime: string,
  endTime: string,
): WeaponAttackRecord {
  return {
    weaponName,
    weaponType,
    beginTime,
    endTime,
    angle: 0,
    windows: [],
    target,
    targetType: '卫星',
  }
}

/** 演示表格固定行数（便于核对区块高度） */
const MOCK_TABLE_ROW_COUNT = 5

/** 演示卫星行定义 */
interface MockSatelliteDef {
  norad: number
  name: string
  satType: string
  series: string
  sysType: string
}

/**
 * 生成打击窗口文本（按行序号错开）。
 *
 * @param index 行序号（0-based）
 */
function mockAttackWindow(index: number): { begin: string; end: string } {
  const startMin = 10 + index * 12
  const endMin = startMin + 30
  return {
    begin: `2026-09-17 09:${String(startMin).padStart(2, '0')}:00`,
    end: `2026-09-17 09:${String(endMin).padStart(2, '0')}:00`,
  }
}

/**
 * 由卫星定义列表构造系列实体（卫星清单 + 打击计划各 {@link MOCK_TABLE_ROW_COUNT} 条）。
 *
 * @param satellites 卫星定义（至少 5 条，不足则循环补齐）
 * @param usageLabel 用途前缀（武器命名）
 */
function buildMockEntityFromSatellites(
  satellites: MockSatelliteDef[],
  usageLabel: string,
): ZhchPlanLevelSeriesEntity[] {
  const taskId = 0
  let rows = satellites.slice(0, MOCK_TABLE_ROW_COUNT)
  while (rows.length < MOCK_TABLE_ROW_COUNT) {
    const base = satellites[rows.length % Math.max(satellites.length, 1)]
    if (!base) break
    rows = [
      ...rows,
      {
        ...base,
        norad: base.norad + 500 + rows.length,
        name: `${base.name}-D${rows.length + 1}`,
      },
    ]
  }

  const weaponTypes = ['电子干扰', '定向能', '网络病毒', '电子干扰', '定向能']
  const initList = rows.map((row, index) =>
    mockInitSatellite(row.norad + index, row.name, row.satType),
  )

  const attackPlanList = initList.map((sat, index) => {
    const window = mockAttackWindow(index)
    return mockAttackRecord(
      sat.name,
      `DEMO-${usageLabel}-${index + 1}`,
      weaponTypes[index % weaponTypes.length],
      window.begin,
      window.end,
    )
  })

  const series = rows[0]?.series ?? 'DEMO'
  const sysType = rows[0]?.sysType ?? '侦察'

  return [
    {
      intensityLevel: '智能',
      taskId,
      sysType,
      series,
      initMatrixList: initList,
      relayRelation: null,
      initRelationList: {},
      satelliteMatrixList: [],
      stationRelationList: {},
      attackPlanList,
      threatSats: initList.map((s, i) => ({
        norad: s.norad,
        name: s.name,
        satType: s.satType,
        threatScore: 0.82 - i * 0.06,
        afterThreatScore: 0.45 - i * 0.05,
      })) as ThreatSatelliteItem[],
      timeEffects: [],
    },
  ]
}

/**
 * 按用途类型选取 5 条演示卫星定义。
 *
 * @param usageType 军用 / 民用 / 军用民用
 */
function getMockSatelliteDefsForUsage(usageType: string): MockSatelliteDef[] {
  if (usageType === '民用') {
    return [
      { norad: 43001, name: 'JCSAT-17', satType: '通信', series: 'JCSAT', sysType: '通信' },
      { norad: 43002, name: 'BSAT-4b', satType: '通信', series: 'BSAT', sysType: '通信' },
      { norad: 43003, name: 'Superbird-C2', satType: '通信', series: 'Superbird', sysType: '通信' },
      { norad: 43004, name: 'Kirameki-1', satType: '通信', series: 'Kirameki', sysType: '通信' },
      { norad: 43005, name: 'Optus-D3', satType: '通信', series: 'Optus', sysType: '通信' },
    ]
  }

  if (usageType === '军用民用') {
    return [
      { norad: 39001, name: 'IGS-Optical 7', satType: '侦察', series: 'IGS', sysType: '侦察' },
      { norad: 39002, name: 'IGS-Radar 2', satType: '侦察', series: 'IGS', sysType: '侦察' },
      { norad: 44001, name: 'QZSS-4', satType: '导航', series: 'QZSS', sysType: '导航' },
      { norad: 43010, name: 'JCSAT-15', satType: '通信', series: 'JCSAT', sysType: '通信' },
      { norad: 38010, name: 'IGS-Optical 5', satType: '侦察', series: 'IGS', sysType: '侦察' },
    ]
  }

  return [
    { norad: 38001, name: 'IGS-Optical 5', satType: '侦察', series: 'IGS', sysType: '侦察' },
    { norad: 38002, name: 'IGS-Radar 3', satType: '侦察', series: 'IGS', sysType: '侦察' },
    { norad: 38003, name: 'IGS-Optical 7', satType: '侦察', series: 'IGS', sysType: '侦察' },
    { norad: 41001, name: 'Kirameki-2', satType: '通信', series: 'Kirameki', sysType: '通信' },
    { norad: 44002, name: 'QZSS-1R', satType: '导航', series: 'QZSS', sysType: '导航' },
  ]
}

/**
 * 用途类型对应的武器名前缀。
 *
 * @param usageType 用途类型
 */
function getMockUsageLabel(usageType: string): string {
  if (usageType === '民用') return '民用'
  if (usageType === '军用民用') return '军民'
  return '军用'
}

/**
 * 统计 mock 方案内卫星数量。
 *
 * @param entities 系列实体
 */
function countMockSatellites(entities: ZhchPlanLevelSeriesEntity[]): number {
  const names = new Set<string>()
  entities.forEach((entity) => {
    entity.initMatrixList?.forEach((sat) => {
      if (sat.name) names.add(sat.name)
    })
  })
  return names.size
}

/**
 * 接口未返回或返回空方案时，生成可展示的演示综合打击方案。
 *
 * @param usageType 军用 / 民用 / 军用民用
 * @param taskId 任务 ID
 * @param enemyCountries 作战对象国家（用于文案）
 * @returns 演示用 ZhchPlanResp
 */
export function buildMockZhchPlanResp(
  usageType: string,
  taskId: number,
  enemyCountries: string[],
): ZhchPlanResp {
  const country = enemyCountries[0] ?? '日本'
  const satelliteDefs = getMockSatelliteDefsForUsage(usageType)
  const entities = buildMockEntityFromSatellites(satelliteDefs, getMockUsageLabel(usageType))
  entities.forEach((entity) => {
    entity.taskId = taskId
  })

  const satNum = countMockSatellites(entities)
  const stationNum = 14
  const visibleWindowNum = 86
  const visibleWindowStrikeNum = Math.round(visibleWindowNum * 0.35)
  const feedbackWindowNum = 52
  const beforeCov = usageType === '民用' ? 62.4 : usageType === '军用民用' ? 55.8 : 58.2
  const afterCov = usageType === '民用' ? 38.1 : usageType === '军用民用' ? 31.6 : 34.5

  return {
    intensityLevel: '智能',
    summary: `【演示数据】${country}方向 ${getUsageTypeHint(usageType)}：共${satNum}颗卫星，${stationNum}个可用地面站，${visibleWindowNum}个可见过境窗口，${feedbackWindowNum}个数据回传窗口，其中${visibleWindowStrikeNum}个被打击压制，打击前平均覆盖率：${beforeCov.toFixed(1)}，打击后平均覆盖率：${afterCov.toFixed(1)}`,
    visibleWindowNum,
    visibleWindowStrikeNum,
    feedbackWindowNum,
    beforeFirstFeedbackTime: '2026-09-16 08:07:19',
    afterFirstFeedbackTime: '2026-09-16 08:27:34',
    beforeAvgCoverage: beforeCov,
    afterAvgCoverage: afterCov,
    satNum,
    stationNum,
    stationList: ['筑波站', '冲绳站', '三泽站'],
    beforeResult: '',
    afterResult: '',
    levelSeriesEntities: entities,
  }
}

/**
 * 用途类型中文提示。
 *
 * @param usageType 用途键
 */
function getUsageTypeHint(usageType: string): string {
  if (usageType === '民用') return '民用软杀伤'
  if (usageType === '军用民用') return '军民联合软杀伤'
  return '军用软杀伤'
}

/**
 * 判断接口方案是否缺少可展示的业务数据。
 *
 * @param plan 接口方案
 */
export function isZhchPlanRespEmpty(plan: ZhchPlanResp | null | undefined): boolean {
  if (!plan) return true
  const hasSats = plan.levelSeriesEntities?.some(
    (entity) => (entity.initMatrixList?.length ?? 0) > 0,
  )
  if (hasSats) return false
  const hasAttacks = plan.levelSeriesEntities?.some(
    (entity) => (entity.attackPlanList?.length ?? 0) > 0,
  )
  if (hasAttacks) return false
  return (plan.satNum ?? 0) <= 0
}
