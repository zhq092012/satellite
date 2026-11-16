import type { AiContentBlock, AiMarkdownBlock, AiTableRow } from '@/types/ai'
import {
  DEMO_ATTACK_ROWS,
  DEMO_MATRIX_METRICS,
  DEMO_PLAN,
  DEMO_TASK,
  DEMO_THREAT_COUNTRY_PIE,
  DEMO_THREAT_ROWS,
} from '@/mock/ai/demoScenario'

/**
 * 创建 Markdown 内容块。
 *
 * @param content Markdown 原文
 * @returns 内容块
 */
function markdown(content: string): AiMarkdownBlock {
  return { type: 'markdown', content }
}

/** 威胁度表格列 */
const THREAT_COLUMNS = [
  { prop: 'country', label: '国家' },
  { prop: 'satelliteName', label: '卫星' },
  { prop: 'satelliteType', label: '类型' },
  { prop: 'staticThreat', label: '静态威胁' },
  { prop: 'dynamicThreat', label: '动态威胁' },
  { prop: 'compositeThreat', label: '综合威胁' },
] as const

/** 打击记录表格列 */
const ATTACK_COLUMNS = [
  { prop: 'country', label: '国家' },
  { prop: 'target', label: '目标' },
  { prop: 'weaponName', label: '武器' },
  { prop: 'weaponType', label: '武器类型' },
  { prop: 'attackWindow', label: '时间窗' },
  { prop: 'attackDegree', label: '攻击度' },
] as const

/**
 * 威胁度行转表格行。
 *
 * @param row 演示威胁行
 * @returns 表格行
 */
function threatTableRow(row: (typeof DEMO_THREAT_ROWS)[number]): AiTableRow {
  return {
    country: row.country,
    satelliteName: row.satelliteName,
    satelliteType: row.satelliteType,
    staticThreat: row.staticThreat,
    dynamicThreat: row.dynamicThreat,
    compositeThreat: row.compositeThreat,
  }
}

/**
 * 打击记录行转表格行。
 *
 * @param row 演示打击行
 * @returns 表格行
 */
function attackTableRow(row: (typeof DEMO_ATTACK_ROWS)[number]): AiTableRow {
  return {
    country: row.country,
    target: row.target,
    weaponName: row.weaponName,
    weaponType: row.weaponType,
    attackWindow: row.attackWindow,
    attackDegree: row.attackDegree,
  }
}

/**
 * 方案指标卡片组。
 *
 * @returns 指标内容块
 */
function planMetricBlocks(): AiContentBlock[] {
  const plan = DEMO_PLAN
  return [
    { type: 'metric', title: '打击前平均覆盖率', value: plan.beforeAvgCoverage, unit: '%' },
    { type: 'metric', title: '打击后平均覆盖率', value: plan.afterAvgCoverage, unit: '%' },
    { type: 'metric', title: '侦察卫星数量', value: plan.satNum, unit: '颗' },
    { type: 'metric', title: '可见窗口', value: plan.visibleWindowNum, unit: '个' },
    { type: 'metric', title: '被压制窗口', value: plan.visibleWindowStrikeNum, unit: '个' },
  ]
}

/**
 * 演示：分析当前任务的整体情况。
 *
 * @returns 结构化内容块
 */
export function demoAnswerTaskOverview(): AiContentBlock[] {
  const task = DEMO_TASK
  const matrix = DEMO_MATRIX_METRICS
  return [
    markdown(
      [
        '### 任务整体情况',
        '',
        `当前演示任务：**${task.name}**（ID ${task.id}）。`,
        '',
        `- 任务时间：${task.beginDate} 至 ${task.endDate}`,
        `- 作战对象：${task.enemyCountries.join('、')}`,
        `- 我方：${task.meCountries.join('、')}`,
        `- 说明：${task.description}`,
        '',
        '#### 已加载数据概览',
        '',
        '以下为演示场景中的模拟矩阵与方案摘要，不依赖真实接口返回。',
      ].join('\n'),
    ),
    { type: 'metric', title: '矩阵卫星数量', value: matrix.satNum, unit: '颗' },
    { type: 'metric', title: '接收站数量', value: matrix.stationNum, unit: '个' },
    { type: 'metric', title: '打击前平均覆盖率', value: matrix.beforeAvgCoverage, unit: '%' },
    { type: 'metric', title: '打击后平均覆盖率', value: matrix.afterAvgCoverage, unit: '%' },
    markdown(
      [
        '#### 威胁与打击规模',
        '',
        `- 威胁度矩阵含 **${DEMO_THREAT_ROWS.length}** 颗卫星，最高综合威胁 **${DEMO_THREAT_ROWS[0]?.compositeThreat ?? '--'}**（${DEMO_THREAT_ROWS[0]?.satelliteName ?? ''}）。`,
        `- 打击记录 **${DEMO_ATTACK_ROWS.length}** 条，覆盖光学、雷达与电子侦察等类型。`,
        `- 当前用途「${DEMO_PLAN.usageType}」下已生成打击方案，烈度 **${DEMO_PLAN.intensityLevel}**。`,
      ].join('\n'),
    ),
    {
      type: 'chart',
      chartType: 'line',
      title: '覆盖率变化（演示）',
      data: {
        categories: ['打击前', '打击后'],
        series: [
          {
            name: '平均覆盖率',
            values: [matrix.beforeAvgCoverage, matrix.afterAvgCoverage],
          },
        ],
      },
    },
  ]
}

/**
 * 演示：威胁度最高的卫星。
 *
 * @returns 结构化内容块
 */
export function demoAnswerThreatTop(): AiContentBlock[] {
  const ranked = [...DEMO_THREAT_ROWS].sort((a, b) => b.compositeThreatSort - a.compositeThreatSort)
  return [
    markdown(
      [
        '### 威胁度最高的卫星',
        '',
        '按**综合威胁度**从高到低排列（演示数据）。综合威胁 = 静态威胁 × 动态威胁；动态威胁缺失时等于静态威胁。',
        '',
        `共 **${ranked.length}** 颗卫星，下表展示全部排名。`,
      ].join('\n'),
    ),
    {
      type: 'table',
      title: '卫星威胁度排名',
      columns: [...THREAT_COLUMNS],
      data: ranked.map(threatTableRow),
    },
    {
      type: 'chart',
      chartType: 'bar',
      title: '综合威胁度对比',
      data: {
        categories: ranked.map((row) => row.satelliteName),
        series: [
          {
            name: '综合威胁度',
            values: ranked.map((row) => row.compositeThreatSort),
          },
        ],
      },
    },
    markdown(
      [
        '**研判要点**',
        '',
        '- **USA-274** 综合威胁最高，光学侦察属性且动态威胁显著抬升，建议列为首轮压制对象。',
        '- 美国目标占威胁榜前四位中的三位，日本 **JPN-IGS** 系列构成区域补充威胁。',
      ].join('\n'),
    ),
  ]
}

/**
 * 演示：威胁度按国家分布。
 *
 * @returns 结构化内容块
 */
export function demoAnswerThreatDistribution(): AiContentBlock[] {
  const total = DEMO_THREAT_ROWS.length
  const list = DEMO_THREAT_COUNTRY_PIE.map((item) => `- **${item.name}**：${item.value} 颗`).join('\n')
  return [
    markdown(
      [
        '### 卫星威胁度分布',
        '',
        `矩阵中共 **${total}** 颗卫星，按国家统计如下：`,
        '',
        list,
        '',
        '美国目标数量更多且类型多元；日本目标以 IGS 系列为主，威胁峰值略低但窗口重叠度较高。',
      ].join('\n'),
    ),
    {
      type: 'chart',
      chartType: 'pie',
      title: '威胁卫星国家分布',
      data: { items: DEMO_THREAT_COUNTRY_PIE },
    },
    { type: 'metric', title: '矩阵卫星总数', value: total, unit: '颗' },
    { type: 'metric', title: '最高威胁国家', value: '美国' },
  ]
}

/**
 * 演示：当前任务的攻击能力。
 *
 * @returns 结构化内容块
 */
export function demoAnswerAttackCapability(): AiContentBlock[] {
  const avgDegree =
    DEMO_ATTACK_ROWS.reduce((sum, row) => sum + parseFloat(row.attackDegree), 0) / DEMO_ATTACK_ROWS.length
  const avgText = avgDegree.toFixed(2)
  const attackSummary = [
    `共 **${DEMO_ATTACK_ROWS.length}** 条窗口内可执行打击，平均攻击度 **${avgText}**。`,
    '激光类对光学目标窗口匹配度较好，电子类对中继与电子侦察星覆盖更稳。',
  ].join('')
  return [
    markdown(
      [
        '### 攻击能力评估',
        '',
        '目标、武器、类型与时间窗来自演示打击记录。攻击度为演示口径下的可执行性评分，**非正式算法输出**。',
        '',
        attackSummary,
      ].join('\n'),
    ),
    { type: 'metric', title: '可执行打击数', value: DEMO_ATTACK_ROWS.length, unit: '条' },
    { type: 'metric', title: '平均攻击度', value: avgText },
    {
      type: 'table',
      title: '打击记录',
      columns: [...ATTACK_COLUMNS],
      data: DEMO_ATTACK_ROWS.map(attackTableRow),
    },
    {
      type: 'chart',
      chartType: 'bar',
      title: '各目标攻击度',
      data: {
        categories: DEMO_ATTACK_ROWS.map((row) => row.target),
        series: [
          {
            name: '攻击度',
            values: DEMO_ATTACK_ROWS.map((row) => parseFloat(row.attackDegree)),
          },
        ],
      },
    },
  ]
}

export function demoAnswerPlanProsCons(): AiContentBlock[] {
  const plan = DEMO_PLAN
  return [
    markdown(
      [
        '### 当前打击方案 · 优缺点',
        '',
        `用途：**${plan.usageType}** · 烈度：**${plan.intensityLevel}**`,
        '',
        '#### 方案概述',
        plan.summary,
        '',
        '#### 优势',
        '',
        '- **窗口编排清晰**：先光学后电子，降低多星同时可见导致的资源挤占。',
        '- **覆盖率降幅明显**：打击后平均覆盖率由 78% 降至 41%，首轮回传闭合推迟有效。',
        '- **武器类型搭配合理**：激光压制高威胁光学星，电子干扰切断中继，冗余窗口 6 个已纳入方案。',
        '',
        '#### 不足与风险',
        '',
        '- **USA-529 导弹预警星**未列入首轮打击，若敌方提升预警转发优先级，可能部分抵消压制效果。',
        '- 日本 **JPN-IGS-1** 威胁偏低但轨道相位与 IGS-7 邻近，存在短暂补盲风险。',
        '- 演示攻击度非正式算法结果，实装前需用 `/algorithm/attackability` 复核可执行性。',
        '',
        '#### 态势结论（接口字段口径）',
        '',
        `- 打击前：${plan.beforeResult}`,
        `- 打击后：${plan.afterResult}`,
        '',
        `各系列打击记录合计 **${plan.attackRecordCount}** 条。`,
      ].join('\n'),
    ),
    ...planMetricBlocks(),
  ]
}

/**
 * 演示：方案可优化点。
 *
 * @returns 结构化内容块
 */
export function demoAnswerPlanOptimize(): AiContentBlock[] {
  const plan = DEMO_PLAN
  return [
    markdown(
      [
        '### 方案优化建议',
        '',
        `基于演示方案「${plan.summary.slice(0, 24)}…」与当前指标，建议优先关注以下 **4** 项：`,
        '',
        '| 优先级 | 优化方向 | 说明 |',
        '| --- | --- | --- |',
        '| P0 | 补打导弹预警窗口 | USA-529 未纳入首轮，建议在第 2 轨道圈叠加电子压制 |',
        '| P1 | 拉长电子干扰占空 | USA-401 仅单窗口阻断，可追加 03-03 夜侧重叠窗 |',
        '| P1 | 日本星相位去重 | IGS-4 与 IGS-7 时间窗部分重叠，合并可释放 1 套激光资源 |',
        '| P2 | 覆盖率余量监控 | 打击后 41% 仍高于「低烈度」阈值 35%，可按任务目标再压一档 |',
        '',
        '#### 预期收益（演示估算）',
        '',
        '- 补打预警星后，敌方首轮回传推迟时间有望再 **+2～3 小时**。',
        '- 合并日本星窗口后，激光类武器占用率预计下降 **约 15%**。',
      ].join('\n'),
    ),
    {
      type: 'chart',
      chartType: 'line',
      title: '优化前后覆盖率对比（演示）',
      data: {
        categories: ['现状', 'P0 完成后', 'P0+P1 完成后'],
        series: [
          {
            name: '平均覆盖率',
            values: [plan.afterAvgCoverage, 36, 32],
          },
        ],
      },
    },
    ...planMetricBlocks(),
    markdown('*以上建议基于演示 Mock 数据，接入真实方案接口后应重新生成。*'),
  ]
}

/**
 * 演示：威胁与攻击综合分析。
 *
 * @returns 结构化内容块
 */
export function demoAnswerTaskSynthesis(): AiContentBlock[] {
  const task = DEMO_TASK
  const top = DEMO_THREAT_ROWS[0]
  return [
    markdown(
      [
        '### 威胁与攻击综合分析',
        '',
        `任务 **${task.name}**（${task.beginDate} ~ ${task.endDate}）面向 **${task.enemyCountries.join('、')}** 低轨侦察体系。`,
        '',
        '#### 威胁侧',
        '',
        `- 矩阵 **${DEMO_THREAT_ROWS.length}** 星，**${top?.country ?? ''}** **${top?.satelliteName ?? ''}** 综合威胁最高（${top?.compositeThreat ?? ''}）。`,
        '- 美国国家样本占多数，类型涵盖光学、雷达、电子与预警。',
        '',
        '#### 攻击侧',
        '',
        `- 已编排 **${DEMO_ATTACK_ROWS.length}** 条打击记录，高威胁光学星 USA-274、USA-311 均已分配窗口。`,
        '- 激光与电子组合对应当前方案两段式节奏，与威胁排序基本一致。',
        '',
        '#### 方案侧',
        '',
        `- 烈度 **${DEMO_PLAN.intensityLevel}**，覆盖率 **${DEMO_PLAN.beforeAvgCoverage}% → ${DEMO_PLAN.afterAvgCoverage}%**，压制可见窗口 **${DEMO_PLAN.visibleWindowStrikeNum}** 个。`,
        '',
        '**综合结论**：威胁—打击—方案三条链路在演示数据下闭合良好；正式环境需以接口矩阵与方案字段替换本节数字。',
      ].join('\n'),
    ),
    {
      type: 'chart',
      chartType: 'bar',
      title: '威胁 TOP5 与是否已分配打击',
      data: {
        categories: DEMO_THREAT_ROWS.slice(0, 5).map((row) => row.satelliteName),
        series: [
          {
            name: '综合威胁度',
            values: DEMO_THREAT_ROWS.slice(0, 5).map((row) => row.compositeThreatSort),
          },
          {
            name: '已分配打击（0/1）',
            values: DEMO_THREAT_ROWS.slice(0, 5).map((row) =>
              DEMO_ATTACK_ROWS.some((attack) => attack.target === row.satelliteName) ? 1 : 0,
            ),
          },
        ],
      },
    },
    {
      type: 'table',
      title: '威胁 TOP5 明细',
      columns: [...THREAT_COLUMNS],
      data: DEMO_THREAT_ROWS.slice(0, 5).map(threatTableRow),
    },
    ...planMetricBlocks().slice(0, 2),
  ]
}

/**
 * 无法精确匹配推荐问题时，返回引导性演示回答。
 *
 * @returns 引导内容块
 */
export function demoAnswerFallback(): AiContentBlock[] {
  return [
    markdown(
      [
        '### 演示模式说明',
        '',
        '当前 AI 助手使用**内置 Mock 场景**回答，不读取真实任务矩阵。',
        '',
        '点击下方推荐问题可获得完整表格、图表与指标演示：',
        '',
        '- 分析当前任务的整体情况',
        '- 当前任务中威胁度最高的卫星有哪些？',
        '- 分析当前任务的卫星威胁度分布',
        '- 当前任务的攻击能力如何？',
        '- 分析当前打击方案的优缺点',
        '- 当前方案有哪些需要优化的地方？',
        '- 综合分析当前任务的威胁和攻击能力',
      ].join('\n'),
    ),
    { type: 'metric', title: '演示任务', value: DEMO_TASK.name },
    { type: 'metric', title: '演示卫星数', value: DEMO_THREAT_ROWS.length, unit: '颗' },
  ]
}