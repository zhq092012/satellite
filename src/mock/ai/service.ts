import type { ZhchPlanResp } from '@/api/electronic'
import type { SatelliteAnalysisData } from '@/api/task/task'
import router from '@/router'
import { useLayoutStore } from '@/store/modules/layout'
import type { SatelliteDetail } from '@/types/cesium/satellite'
import type { TaskForm } from '@/types/dashboard'
import type {
  AiChartPieItem,
  AiContentBlock,
  AiMarkdownBlock,
  AiMetricBlock,
  AiTableRow,
} from '@/types/ai'
import { buildSatelliteAnalysisTableRows } from '@/utils/buildSatelliteAnalysisTable'
import {
  buildHomeAttackAnalysisRowsFromMatrix,
  type HomeAttackAnalysisTableRow,
} from '@/utils/buildHomeAttackAnalysisTable'
import {
  buildHomeThreatAnalysisRowsFromMatrix,
  type HomeThreatAnalysisTableRow,
} from '@/utils/buildHomeThreatAnalysisTable'

/** layout Store 实例。Mock 只读它，不写入。 */
type LayoutStore = ReturnType<typeof useLayoutStore>

/** 问题意图。更具体的规则在 detectIntent 里优先匹配。 */
type AiIntent =
  /** 威胁度最高的卫星 */
  | 'threat-top'
  /** 威胁度按国家分布 */
  | 'threat-distribution'
  /** 攻击能力 */
  | 'attack'
  /** 当前打击方案 */
  | 'plan'
  /** 任务整体或综合分析 */
  | 'task'
  /** 指定卫星或当前选中卫星 */
  | 'satellite'
  /** 无法对应到以上意图 */
  | 'fallback'

/** 当前任务是否已经有可引用的分析矩阵 */
interface AnalysisRead {
  /** 属于当前任务的矩阵。没有时为 null */
  data: SatelliteAnalysisData | null
  /** data 为 null 时给用户看的原因 */
  reason: string | null
}

/** 当前任务是否已经有可引用的打击方案 */
interface PlanRead {
  /** 当前激活用途下的方案 */
  plan: ZhchPlanResp | null
  /** plan 为 null 时给用户看的原因 */
  reason: string | null
}

/**
 * 一颗可查询的卫星。
 * 过境列表和分析矩阵按 NORAD 合并，威胁分数只来自分析矩阵。
 */
interface SatelliteHit {
  /** NORAD 文本，与 SatelliteData.norad_id 对齐 */
  norad: string
  /** 展示名称 */
  name: string
  /** 国家。分析矩阵行里没有国家时保持空字符串 */
  country: string
  /** 卫星类型或系统类型 */
  satType: string
  /** 打击前威胁分数。矩阵没有该星时为 null */
  threatBefore: number | null
  /** 打击后威胁分数。矩阵没有该星时为 null */
  threatAfter: number | null
  /** 是否出现在当前任务过境卫星列表 */
  inTaskSatellites: boolean
  /** 是否出现在当前任务分析矩阵 */
  inAnalysis: boolean
}

/** 路由 path 与业务页面名称。只用于回答开头，不反向改路由。 */
const PAGE_LABEL_BY_PATH: Record<string, string> = {
  '/home': '整体态势分析',
  '/situation': '卫星态势',
  '/home/threat': '威胁度分析',
  '/home/attack': '攻击度分析',
  '/home/strike-plan': '打击方案管理',
}

/** 威胁度排名和柱状图最多展示的卫星数 */
const THREAT_TOP_LIMIT = 10

/** 攻击记录表格最多展示的行数。超出部分只说明总数，不截断后假装没有 */
const ATTACK_TABLE_LIMIT = 20

/** 卫星清单最多展示的行数 */
const SATELLITE_LIST_LIMIT = 30

/**
 * 根据问题生成结构化回答。
 *
 * 数据只来自当前 layout Store。矩阵为空时返回「暂无」，不使用威胁度页、攻击度页的演示行。
 *
 * @param question 已经去掉首尾空白的问题
 * @returns 内容块。第一块会带上当前页面和任务
 */
export function buildAiAnswer(question: string): AiContentBlock[] {
  const store = useLayoutStore()
  const intent = detectIntent(question)
  const blocks = dispatchIntent(store, question, intent)
  return withContext(store, blocks)
}

/**
 * 按关键词识别问题。综合分析优先于单独的威胁或攻击，避免「综合分析威胁和攻击」被拆开。
 *
 * @param question 用户问题
 * @returns 意图
 */
function detectIntent(question: string): AiIntent {
  if (question.includes('综合')) return 'task'
  if (question.includes('威胁') && /最高|排名|哪些|排序/.test(question)) return 'threat-top'
  if (question.includes('威胁')) return 'threat-distribution'
  if (question.includes('攻击')) return 'attack'
  if (/方案|优缺点|优化/.test(question)) return 'plan'
  if (question.includes('任务') && /整体|情况/.test(question)) return 'task'
  if (question.includes('选中') || question.includes('卫星')) return 'satellite'
  return 'fallback'
}

/**
 * 把意图分到对应的读取逻辑。
 *
 * @param store 布局 Store
 * @param question 用户问题
 * @param intent 已识别的意图
 * @returns 尚未加页面上下文的内容块
 */
function dispatchIntent(store: LayoutStore, question: string, intent: AiIntent): AiContentBlock[] {
  if (intent === 'threat-top') return answerThreatTop(store)
  if (intent === 'threat-distribution') return answerThreatDistribution(store)
  if (intent === 'attack') return answerAttack(store)
  if (intent === 'plan') return answerPlan(store)
  if (intent === 'task') return answerTask(store)
  if (intent === 'satellite') return answerSatellite(store, question)
  return answerFallback(store)
}

/**
 * 把当前页面和任务写进第一段说明。
 *
 * @param store 布局 Store
 * @param blocks 业务内容块
 * @returns 带上下文的内容块
 */
function withContext(store: LayoutStore, blocks: AiContentBlock[]): AiContentBlock[] {
  const context = buildContextLine(store)
  const first = blocks[0]
  if (first && first.type === 'markdown') {
    const merged: AiMarkdownBlock = { type: 'markdown', content: `${context}\n\n${first.content}` }
    return [merged, ...blocks.slice(1)]
  }
  return [{ type: 'markdown', content: context }, ...blocks]
}

/**
 * 读取当前路由和当前任务，生成回答开头的一句话。
 *
 * @param store 布局 Store
 * @returns 上下文句子
 */
function buildContextLine(store: LayoutStore): string {
  const pageLabel = resolvePageLabel(router.currentRoute.value.path)
  const task = store.activedTask
  if (!task) {
    return `当前页面：${pageLabel}。当前未选择任务。`
  }
  const idText = typeof task.id === 'number' ? `（ID ${task.id}）` : '（缺少任务 ID）'
  return `当前页面：${pageLabel}。当前任务：${task.name}${idText}。`
}

/**
 * 把路由转换成业务页面名称。未知页面保留 path，避免编一个页面名。
 *
 * @param path 当前路由 path
 * @returns 页面名称
 */
function resolvePageLabel(path: string): string {
  const exact = PAGE_LABEL_BY_PATH[path]
  if (exact) return exact
  if (path.startsWith('/data-manage')) return '数据管理'
  if (path.startsWith('/system')) return '系统管理'
  return path || '未知页面'
}

/**
 * 确认当前任务存在且带有数字 ID。分析和方案都靠这个 ID 判断是不是当前任务的数据。
 *
 * @param store 布局 Store
 * @returns 任务；不存在或没有 ID 时返回 null，并由 reason 说明
 */
function readTask(store: LayoutStore): { task: TaskForm | null; reason: string | null } {
  const task = store.activedTask
  if (!task) {
    return { task: null, reason: '当前未选择任务。请先在战场中选择任务，再提问。' }
  }
  if (typeof task.id !== 'number') {
    return { task: null, reason: `任务「${task.name}」缺少 ID，无法关联威胁度、攻击度和打击方案。` }
  }
  return { task, reason: null }
}

/**
 * 读取属于当前任务的分析矩阵。
 * taskAnalysisTaskId 不一致、正在计算或矩阵为空，都按暂无数据处理。
 *
 * @param store 布局 Store
 * @param task 已确认有 ID 的当前任务
 * @returns 矩阵或原因
 */
function readAnalysis(store: LayoutStore, task: TaskForm): AnalysisRead {
  if (store.taskAnalysisLoading && store.taskAnalysisTaskId !== task.id) {
    return { data: null, reason: '任务分析正在计算，请稍后再问。' }
  }
  if (store.taskAnalysisTaskId !== task.id || !store.taskAnalysisData) {
    return { data: null, reason: '当前任务暂无威胁度与攻击度矩阵。请先在态势页完成计算。' }
  }
  const entities = store.taskAnalysisData.levelSeriesEntities
  if (!Array.isArray(entities) || entities.length === 0) {
    return { data: null, reason: '当前任务的分析矩阵为空，暂无卫星威胁度与打击记录。' }
  }
  return { data: store.taskAnalysisData, reason: null }
}

/**
 * 读取当前激活用途下、且属于当前任务的打击方案。
 *
 * @param store 布局 Store
 * @param task 已确认有 ID 的当前任务
 * @returns 方案或原因
 */
function readPlan(store: LayoutStore, task: TaskForm): PlanRead {
  if (store.zhchPlanTaskId !== task.id) {
    const reason = store.zhchPlanLoading
      ? '打击方案正在加载，请稍后再问。'
      : '当前任务还没有已生成的打击方案。请先在打击方案页生成。'
    return { plan: null, reason }
  }
  const plan = store.activeZhchPlan
  if (store.zhchPlanLoading && !plan) {
    return { plan: null, reason: '打击方案正在加载，请稍后再问。' }
  }
  if (!plan) {
    return { plan: null, reason: `当前用途「${store.activeZhchUsageType}」下没有打击方案。` }
  }
  return { plan, reason: null }
}

/**
 * 作战对象、我方国家的展示。空数组是未填写，不是字段缺失。
 *
 * @param value 国家列表
 * @param label 字段名称，写进缺失说明
 * @returns 展示文本
 */
function formatCountries(value: string[], label: string): string {
  if (!Array.isArray(value)) return `${label}字段缺失`
  if (value.length === 0) return '未填写'
  return value.join('、')
}

/**
 * 威胁度最高的卫星。排序字段是威胁度分析页已经算出的 compositeThreatSort。
 *
 * @param store 布局 Store
 * @returns 说明、表格和柱状图；没有矩阵时只有说明
 */
function answerThreatTop(store: LayoutStore): AiContentBlock[] {
  const taskRead = readTask(store)
  if (!taskRead.task || taskRead.reason) {
    return [markdown(taskRead.reason ?? '当前未选择任务。')]
  }
  const analysis = readAnalysis(store, taskRead.task)
  if (!analysis.data || analysis.reason) {
    return [markdown(analysis.reason ?? '当前任务暂无威胁度数据。')]
  }

  const rows = threatRows(store, analysis.data, taskRead.task)
  if (rows.length === 0) {
    return [markdown('当前任务的分析矩阵里没有可排序的卫星威胁度。')]
  }

  const ranked = [...rows].sort(compareThreatDesc).slice(0, THREAT_TOP_LIMIT)
  const chartRows = ranked.filter((row) => typeof row.compositeThreatSort === 'number')
  const blocks: AiContentBlock[] = [
    markdown(
      [
        '### 威胁度最高的卫星',
        '',
        '按综合威胁度从高到低排列。综合威胁度与威胁度分析页相同：静态威胁是打击前分数，动态威胁是打击后除以打击前，综合威胁是二者的乘积；动态威胁缺失时综合威胁等于静态威胁。',
        '',
        `矩阵中共 ${rows.length} 颗卫星，下面展示前 ${ranked.length} 颗。`,
      ].join('\n'),
    ),
    {
      type: 'table',
      title: '卫星威胁度',
      columns: [
        { prop: 'country', label: '国家' },
        { prop: 'satelliteName', label: '卫星' },
        { prop: 'satelliteType', label: '类型' },
        { prop: 'staticThreat', label: '静态威胁' },
        { prop: 'dynamicThreat', label: '动态威胁' },
        { prop: 'compositeThreat', label: '综合威胁' },
      ],
      data: ranked.map(threatTableRow),
    },
  ]

  if (chartRows.length > 0) {
    blocks.push({
      type: 'chart',
      chartType: 'bar',
      title: '综合威胁度',
      data: {
        categories: chartRows.map((row) => row.satelliteName),
        series: [
          {
            name: '综合威胁度',
            values: chartRows.map((row) => {
              if (typeof row.compositeThreatSort !== 'number') {
                throw new Error('综合威胁度筛选后仍不是数字')
              }
              return row.compositeThreatSort
            }),
          },
        ],
      },
    })
  } else {
    blocks.push(markdown('这批卫星没有可用的综合威胁度数值，因此不绘制柱状图。'))
  }

  return blocks
}

/**
 * 按国家统计威胁矩阵中的卫星数量。
 *
 * @param store 布局 Store
 * @returns 说明和饼图
 */
function answerThreatDistribution(store: LayoutStore): AiContentBlock[] {
  const taskRead = readTask(store)
  if (!taskRead.task || taskRead.reason) {
    return [markdown(taskRead.reason ?? '当前未选择任务。')]
  }
  const analysis = readAnalysis(store, taskRead.task)
  if (!analysis.data || analysis.reason) {
    return [markdown(analysis.reason ?? '当前任务暂无威胁度数据。')]
  }

  const rows = threatRows(store, analysis.data, taskRead.task)
  if (rows.length === 0) {
    return [markdown('当前任务的分析矩阵里没有卫星威胁度，无法统计分布。')]
  }

  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const country = row.country && row.country !== '--' ? row.country : '未标注国家'
    counts.set(country, (counts.get(country) ?? 0) + 1)
  })
  const items: AiChartPieItem[] = [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const list = items.map((item) => `- ${item.name}：${item.value} 颗`).join('\n')

  return [
    markdown(`### 卫星威胁度分布\n\n矩阵中共 ${rows.length} 颗卫星。\n\n${list}`),
    {
      type: 'chart',
      chartType: 'pie',
      title: '威胁卫星国家分布',
      data: { items },
    },
  ]
}

/**
 * 用与威胁度分析页相同的函数把矩阵转成行。
 * 不调用 buildMockHomeThreatAnalysisRows。
 *
 * @param store 布局 Store
 * @param analysis 当前任务矩阵
 * @param task 当前任务
 * @returns 威胁度行
 */
function threatRows(
  store: LayoutStore,
  analysis: SatelliteAnalysisData,
  task: TaskForm,
): HomeThreatAnalysisTableRow[] {
  const countries = Array.isArray(task.enemyCountryShow) ? task.enemyCountryShow : []
  return buildHomeThreatAnalysisRowsFromMatrix(analysis, countries, store.c2ResourceSatelliteRows)
}

/**
 * 综合威胁度降序。没有数值的行排在后面，不补 0。
 *
 * @param left 左行
 * @param right 右行
 * @returns 排序差
 */
function compareThreatDesc(left: HomeThreatAnalysisTableRow, right: HomeThreatAnalysisTableRow): number {
  if (left.compositeThreatSort == null && right.compositeThreatSort == null) return 0
  if (left.compositeThreatSort == null) return 1
  if (right.compositeThreatSort == null) return -1
  return right.compositeThreatSort - left.compositeThreatSort
}

/**
 * 威胁度行转成表格行。展示文本沿用分析页，排序值不直接显示。
 *
 * @param row 威胁度行
 * @returns 表格行
 */
function threatTableRow(row: HomeThreatAnalysisTableRow): AiTableRow {
  return {
    country: row.country,
    satelliteName: row.satelliteName,
    satelliteType: row.satelliteType,
    staticThreat: row.staticThreatText,
    dynamicThreat: row.dynamicThreatText,
    compositeThreat: row.compositeThreatText,
  }
}

/**
 * 攻击能力。武器、目标和时间窗来自 attackPlanList。
 * 攻击度分数是分析页的演示计算，回答里明确标出，不把它写成算法结果。
 *
 * @param store 布局 Store
 * @returns 说明和表格
 */
function answerAttack(store: LayoutStore): AiContentBlock[] {
  const taskRead = readTask(store)
  if (!taskRead.task || taskRead.reason || typeof taskRead.task.id !== 'number') {
    return [markdown(taskRead.reason ?? '当前未选择任务。')]
  }
  const analysis = readAnalysis(store, taskRead.task)
  if (!analysis.data || analysis.reason) {
    return [markdown(analysis.reason ?? '当前任务暂无攻击度数据。')]
  }

  const countries = Array.isArray(taskRead.task.enemyCountryShow) ? taskRead.task.enemyCountryShow : []
  const rows = buildHomeAttackAnalysisRowsFromMatrix(
    analysis.data,
    taskRead.task.id,
    countries,
    store.c2ResourceSatelliteRows,
  )
  if (rows.length === 0) {
    return [markdown('当前任务的分析矩阵里没有打击记录，暂无攻击能力数据。')]
  }

  const visible = rows.slice(0, ATTACK_TABLE_LIMIT)
  const extra =
    rows.length > visible.length ? `\n\n共 ${rows.length} 条打击记录，表格展示前 ${visible.length} 条。` : ''

  return [
    markdown(
      [
        '### 攻击能力',
        '',
        '目标、武器、武器类型和时间窗来自当前任务矩阵的 attackPlanList。',
        '表中的攻击度与攻击度分析页相同，按演示公式 0.55 + (序号 % 7) × 0.06 计算，不是 `/algorithm/attackability` 的正式结果。',
        extra,
      ].join('\n'),
    ),
    {
      type: 'table',
      title: '打击记录',
      columns: [
        { prop: 'country', label: '国家' },
        { prop: 'target', label: '目标' },
        { prop: 'weaponName', label: '武器' },
        { prop: 'weaponType', label: '武器类型' },
        { prop: 'attackWindow', label: '时间窗' },
        { prop: 'attackDegree', label: '攻击度（演示）' },
      ],
      data: visible.map(attackTableRow),
    },
  ]
}

/**
 * 攻击度行转成表格行。
 *
 * @param row 攻击度分析行
 * @returns 表格行
 */
function attackTableRow(row: HomeAttackAnalysisTableRow): AiTableRow {
  return {
    country: row.country,
    target: row.satelliteName,
    weaponName: row.weaponName,
    weaponType: row.weaponType,
    attackWindow: row.attackWindowText,
    attackDegree: row.attackDegreeText,
  }
}

/**
 * 打击方案。概述和打击前后结论只转述接口字段，字段为空就写未返回，不补写优缺点。
 *
 * @param store 布局 Store
 * @returns 指标和说明
 */
function answerPlan(store: LayoutStore): AiContentBlock[] {
  const taskRead = readTask(store)
  if (!taskRead.task || taskRead.reason) {
    return [markdown(taskRead.reason ?? '当前未选择任务。')]
  }
  const planRead = readPlan(store, taskRead.task)
  if (!planRead.plan || planRead.reason) {
    return [markdown(planRead.reason ?? '当前任务暂无打击方案。')]
  }

  const plan = planRead.plan
  return [
    markdown(
      [
        `### 当前打击方案`,
        '',
        `用途：${store.activeZhchUsageType}。`,
        textOrMissing('烈度', plan.intensityLevel),
        textOrMissing('方案概述', plan.summary),
        textOrMissing('打击前态势', plan.beforeResult),
        textOrMissing('打击后态势', plan.afterResult),
        '',
        '以上文字来自当前方案接口。接口没有返回的项不会在这里补写优缺点。',
        planCountText(plan),
      ].join('\n'),
    ),
    ...planMetrics(plan),
  ]
}

/**
 * 统计方案里的打击记录条数。列表结构不符合类型时直接说明，不按 0 条继续分析。
 *
 * @param plan 打击方案
 * @returns 一句统计，或结构异常说明
 */
function planCountText(plan: ZhchPlanResp): string {
  if (!Array.isArray(plan.levelSeriesEntities)) {
    return '方案的 levelSeriesEntities 不是数组，无法统计打击记录。'
  }
  let count = 0
  for (const entity of plan.levelSeriesEntities) {
    if (!Array.isArray(entity.attackPlanList)) {
      return `系列「${entity.series}」的 attackPlanList 不是数组，无法统计打击记录。`
    }
    count += entity.attackPlanList.length
  }
  return `各系列打击记录合计 ${count} 条。`
}

/**
 * 把方案上的数值指标转成卡片。不是数字的字段单独说明未返回。
 *
 * @param plan 打击方案
 * @returns 指标块或未返回说明
 */
function planMetrics(plan: ZhchPlanResp): AiContentBlock[] {
  const blocks: AiContentBlock[] = []
  pushMetric(blocks, '打击前平均覆盖率', plan.beforeAvgCoverage, '%')
  pushMetric(blocks, '打击后平均覆盖率', plan.afterAvgCoverage, '%')
  pushMetric(blocks, '侦察卫星数量', plan.satNum, '颗')
  pushMetric(blocks, '可见窗口', plan.visibleWindowNum, '个')
  pushMetric(blocks, '被压制窗口', plan.visibleWindowStrikeNum, '个')
  return blocks
}

/**
 * 数值指标做成卡片，缺失或非有限数字时保留可见说明。
 *
 * @param blocks 内容块列表，函数会追加
 * @param title 指标名
 * @param value 接口原值
 * @param unit 单位
 */
function pushMetric(blocks: AiContentBlock[], title: string, value: unknown, unit?: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    blocks.push(markdown(`${title}：接口未返回该项`))
    return
  }
  const metric: AiMetricBlock = unit ? { type: 'metric', title, value, unit } : { type: 'metric', title, value }
  blocks.push(metric)
}

/**
 * 字符串字段的展示。空白和未返回都明确写出来。
 *
 * @param label 字段名
 * @param value 接口原值
 * @returns 一行 Markdown
 */
function textOrMissing(label: string, value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return `- ${label}：接口未返回该项`
  return `- ${label}：${value}`
}

/**
 * 任务整体或综合分析。某一类数据缺失只影响那一类，其余仍展示。
 *
 * @param store 布局 Store
 * @returns 任务说明、矩阵指标和方案指标
 */
function answerTask(store: LayoutStore): AiContentBlock[] {
  const task = store.activedTask
  if (!task) {
    return [markdown('当前未选择任务，无法做整体分析。请先在战场中选择任务。')]
  }

  const blocks: AiContentBlock[] = [
    markdown(
      [
        '### 任务整体情况',
        '',
        `- 任务时间：${task.beginDate} 至 ${task.endDate}`,
        `- 作战对象：${formatCountries(task.enemyCountryShow, '作战对象')}`,
        `- 我方：${formatCountries(task.meCountryShow, '我方国家')}`,
        typeof task.description === 'string' && task.description.trim()
          ? `- 说明：${task.description}`
          : '- 说明：未填写',
      ].join('\n'),
    ),
  ]

  if (typeof task.id !== 'number') {
    blocks.push(markdown('当前任务缺少 ID，无法关联威胁度、攻击度和打击方案。'))
    return blocks
  }

  const analysis = readAnalysis(store, task)
  if (analysis.data) {
    blocks.push(markdown('#### 威胁与攻击矩阵'))
    pushMetric(blocks, '矩阵卫星数量', analysis.data.satNum, '颗')
    pushMetric(blocks, '接收站数量', analysis.data.stationNum, '个')
    pushMetric(blocks, '打击前平均覆盖率', analysis.data.beforeAvgCoverage, '%')
    pushMetric(blocks, '打击后平均覆盖率', analysis.data.afterAvgCoverage, '%')
    const threats = threatRows(store, analysis.data, task)
    blocks.push(markdown(`威胁度矩阵展开 ${threats.length} 颗卫星。`))
    const attacks = buildHomeAttackAnalysisRowsFromMatrix(
      analysis.data,
      task.id,
      Array.isArray(task.enemyCountryShow) ? task.enemyCountryShow : [],
      store.c2ResourceSatelliteRows,
    )
    blocks.push(
      markdown(
        attacks.length > 0
          ? `打击记录 ${attacks.length} 条。攻击度分数仍是分析页的演示计算，不是正式攻击度算法结果。`
          : '矩阵中没有打击记录。',
      ),
    )
  } else {
    blocks.push(markdown(analysis.reason ?? '当前任务暂无威胁度与攻击度矩阵。'))
  }

  const planRead = readPlan(store, task)
  if (planRead.plan) {
    blocks.push(markdown(`#### 打击方案\n\n用途：${store.activeZhchUsageType}。\n${textOrMissing('方案概述', planRead.plan.summary)}`))
    blocks.push(...planMetrics(planRead.plan))
  } else {
    blocks.push(markdown(planRead.reason ?? '当前任务暂无打击方案。'))
  }

  return blocks
}

/**
 * 按 NORAD、名称或当前选中对象查询卫星。找不到时不返回名称相近的其他卫星。
 *
 * @param store 布局 Store
 * @param question 用户问题
 * @returns 卫星说明、指标或清单
 */
function answerSatellite(store: LayoutStore, question: string): AiContentBlock[] {
  const task = store.activedTask
  if (!task) {
    return [markdown('当前未选择任务，无法查询该任务下的卫星。')]
  }

  const collected = collectSatellites(store, task)
  if (question.includes('选中')) {
    return answerSelectedSatellite(store, collected.hits)
  }

  const numbers: string[] = question.match(/\d+/g) ?? []
  const byNorad = collected.hits.filter((hit) => numbers.includes(hit.norad))
  const byName = findByName(question, collected.hits)
  const matched = uniqueHits([...byNorad, ...byName])

  if (numbers.length > 0 && byNorad.length === 0 && byName.length === 0) {
    return [markdown(`未在当前任务数据中找到 NORAD ${numbers.join('、')}。`)]
  }
  if (matched.length > 0) {
    return describeHits(matched)
  }
  if (/哪些|列出|清单/.test(question)) {
    return listSatellites(collected.hits, collected.missingNorad)
  }

  const scope = collected.hits.length
  return [
    markdown(
      `请提供卫星名称或 NORAD，也可以在态势页选中卫星后询问「当前选中的卫星」。当前可查询的卫星有 ${scope} 颗。`,
    ),
  ]
}

/**
 * 回答当前选中的卫星。分析页 NORAD 和地图点击的卫星详情都读，两者不同就都说明。
 *
 * @param store 布局 Store
 * @param hits 已合并的卫星索引
 * @returns 选中卫星的内容块
 */
function answerSelectedSatellite(store: LayoutStore, hits: SatelliteHit[]): AiContentBlock[] {
  const selected: SatelliteHit[] = []
  if (typeof store.selectedAnalysisNorad === 'number') {
    const hit = hits.find((item) => item.norad === String(store.selectedAnalysisNorad))
    selected.push(
      hit ?? {
        norad: String(store.selectedAnalysisNorad),
        name: '',
        country: '',
        satType: '',
        threatBefore: null,
        threatAfter: null,
        inTaskSatellites: false,
        inAnalysis: false,
      },
    )
  }
  if (store.selectedSatellite) {
    const detailHit = hitFromDetail(store.selectedSatellite, hits)
    if (!selected.some((item) => item.norad === detailHit.norad)) {
      selected.push(detailHit)
    }
  }
  if (selected.length === 0) {
    return [markdown('当前没有选中卫星或地面目标中的卫星。请先在态势图或分析页选中一颗卫星。')]
  }
  return describeHits(selected)
}

/**
 * 用地图上的卫星详情生成一条记录，并尽量补上矩阵里的威胁分数。
 *
 * @param detail 地图选中的卫星详情
 * @param hits 已合并的卫星索引
 * @returns 卫星记录
 */
function hitFromDetail(detail: SatelliteDetail, hits: SatelliteHit[]): SatelliteHit {
  const indexed = hits.find((item) => item.norad === String(detail.norad))
  if (indexed) return indexed
  const name = typeof detail.name_cn === 'string' && detail.name_cn.trim() ? detail.name_cn : detail.name_en
  return {
    norad: String(detail.norad),
    name,
    country: detail.country,
    satType: detail.sat_type,
    threatBefore: null,
    threatAfter: null,
    inTaskSatellites: false,
    inAnalysis: false,
  }
}

/**
 * 合并过境卫星和分析矩阵。缺少 NORAD 的过境记录不编造编号，只计数。
 *
 * @param store 布局 Store
 * @param task 当前任务
 * @returns 卫星索引和缺少 NORAD 的条数
 */
function collectSatellites(store: LayoutStore, task: TaskForm): { hits: SatelliteHit[]; missingNorad: number } {
  const byNorad = new Map<string, SatelliteHit>()
  let missingNorad = 0

  store.allSatelliteOfTask.forEach((item) => {
    if (typeof item.norad_id !== 'string' || !item.norad_id.trim()) {
      missingNorad += 1
      return
    }
    byNorad.set(item.norad_id.trim(), {
      norad: item.norad_id.trim(),
      name: typeof item.name_en === 'string' ? item.name_en : '',
      country: typeof item.country === 'string' ? item.country : '',
      satType: typeof item.sat_type === 'string' ? item.sat_type : '',
      threatBefore: null,
      threatAfter: null,
      inTaskSatellites: true,
      inAnalysis: false,
    })
  })

  if (typeof task.id === 'number') {
    const analysis = readAnalysis(store, task)
    if (analysis.data) {
      buildSatelliteAnalysisTableRows(analysis.data).forEach((row) => {
        const norad = String(row.norad)
        const current = byNorad.get(norad)
        if (current) {
          current.threatBefore = row.threatBefore
          current.threatAfter = row.threatAfter
          current.inAnalysis = true
          if (!current.name && row.name) current.name = row.name
          return
        }
        byNorad.set(norad, {
          norad,
          name: row.name,
          country: '',
          satType: row.sysType,
          threatBefore: row.threatBefore,
          threatAfter: row.threatAfter,
          inTaskSatellites: false,
          inAnalysis: true,
        })
      })
    }
  }

  return { hits: [...byNorad.values()], missingNorad }
}

/**
 * 找出问题中完整出现的卫星名。较短名称如果只是较长名称的一部分，不单独算命中。
 *
 * @param question 用户问题
 * @param hits 卫星索引
 * @returns 名称命中的卫星
 */
function findByName(question: string, hits: SatelliteHit[]): SatelliteHit[] {
  const normalized = question.toLowerCase()
  const included = hits.filter((hit) => {
    const name = hit.name.trim()
    return name.length >= 2 && normalized.includes(name.toLowerCase())
  })
  return included.filter((hit) => {
    const name = hit.name.trim().toLowerCase()
    return !included.some((other) => {
      const otherName = other.name.trim().toLowerCase()
      return otherName.length > name.length && otherName.includes(name)
    })
  })
}

/**
 * 按 NORAD 去重，保留先出现的记录。
 *
 * @param hits 可能重复的卫星
 * @returns 去重后的卫星
 */
function uniqueHits(hits: SatelliteHit[]): SatelliteHit[] {
  const seen = new Set<string>()
  return hits.filter((hit) => {
    if (seen.has(hit.norad)) return false
    seen.add(hit.norad)
    return true
  })
}

/**
 * 一颗卫星用指标卡片，多颗卫星用表格。
 *
 * @param hits 要展示的卫星
 * @returns 内容块
 */
function describeHits(hits: SatelliteHit[]): AiContentBlock[] {
  if (hits.length === 1) {
    const hit = hits[0]
    if (!hit) return [markdown('未找到卫星。')]
    const blocks: AiContentBlock[] = [
      markdown(`### ${hit.name || hit.norad}\n\n${satelliteSourceText(hit)}`),
      { type: 'metric', title: 'NORAD', value: hit.norad },
    ]
    if (hit.country) blocks.push({ type: 'metric', title: '国家', value: hit.country })
    if (hit.satType) blocks.push({ type: 'metric', title: '类型', value: hit.satType })
    if (typeof hit.threatBefore === 'number') {
      blocks.push({ type: 'metric', title: '打击前威胁', value: hit.threatBefore })
    }
    if (typeof hit.threatAfter === 'number') {
      blocks.push({ type: 'metric', title: '打击后威胁', value: hit.threatAfter })
    }
    if (!hit.inAnalysis) {
      blocks.push(markdown('当前分析矩阵中没有这颗卫星的威胁分数。'))
    }
    return blocks
  }

  return [
    markdown(`找到 ${hits.length} 颗卫星。`),
    {
      type: 'table',
      title: '卫星',
      columns: [
        { prop: 'norad', label: 'NORAD' },
        { prop: 'name', label: '名称' },
        { prop: 'country', label: '国家' },
        { prop: 'satType', label: '类型' },
        { prop: 'threatBefore', label: '打击前威胁' },
        { prop: 'threatAfter', label: '打击后威胁' },
      ],
      data: hits.map(satelliteTableRow),
    },
  ]
}

/**
 * 列出当前任务可查询的卫星。超过上限时说明总数。
 *
 * @param hits 卫星索引
 * @param missingNorad 缺少 NORAD 的过境记录数
 * @returns 清单
 */
function listSatellites(hits: SatelliteHit[], missingNorad: number): AiContentBlock[] {
  if (hits.length === 0) {
    const extra = missingNorad > 0 ? `另有 ${missingNorad} 条过境记录缺少 NORAD，未编造编号。` : ''
    return [markdown(`当前任务没有可查询的卫星。${extra}`)]
  }
  const visible = hits.slice(0, SATELLITE_LIST_LIMIT)
  const omitted = hits.length > visible.length ? `共 ${hits.length} 颗，表格展示前 ${visible.length} 颗。` : `共 ${hits.length} 颗。`
  const missing = missingNorad > 0 ? `另有 ${missingNorad} 条过境记录缺少 NORAD，未纳入清单。` : ''
  return [
    markdown(`### 当前任务卫星\n\n${omitted}${missing}`),
    {
      type: 'table',
      title: '卫星清单',
      columns: [
        { prop: 'norad', label: 'NORAD' },
        { prop: 'name', label: '名称' },
        { prop: 'country', label: '国家' },
        { prop: 'satType', label: '类型' },
      ],
      data: visible.map((hit) => ({
        norad: hit.norad,
        name: hit.name || null,
        country: hit.country || null,
        satType: hit.satType || null,
      })),
    },
  ]
}

/**
 * 卫星来源说明，区分过境列表和分析矩阵。
 *
 * @param hit 卫星记录
 * @returns 一句来源说明
 */
function satelliteSourceText(hit: SatelliteHit): string {
  if (hit.inTaskSatellites && hit.inAnalysis) return '这颗卫星同时在当前任务过境列表和分析矩阵中。'
  if (hit.inAnalysis) return '这颗卫星来自当前任务分析矩阵。'
  if (hit.inTaskSatellites) return '这颗卫星来自当前任务过境列表。'
  return '这颗卫星来自当前选中对象，不在已加载的任务卫星列表中。'
}

/**
 * 卫星记录转成表格行。没有的分数保持 null。
 *
 * @param hit 卫星记录
 * @returns 表格行
 */
function satelliteTableRow(hit: SatelliteHit): AiTableRow {
  return {
    norad: hit.norad,
    name: hit.name || null,
    country: hit.country || null,
    satType: hit.satType || null,
    threatBefore: hit.threatBefore,
    threatAfter: hit.threatAfter,
  }
}

/**
 * 无法识别的问题。告诉用户当前能问什么，并带上任务名。
 *
 * @param store 布局 Store
 * @returns 说明
 */
function answerFallback(store: LayoutStore): AiContentBlock[] {
  const taskName = store.activedTask?.name
  const taskLine = taskName ? `当前任务是「${taskName}」。` : '当前未选择任务。'
  return [
    markdown(
      [
        '这个问题目前无法对应到任务、威胁度、攻击能力、打击方案或某一颗卫星。',
        taskLine,
        '可以直接问：当前任务的整体情况、威胁度最高的卫星、威胁度分布、攻击能力、打击方案优缺点，或指定卫星名称 / NORAD。',
      ].join('\n\n'),
    ),
  ]
}

/**
 * 创建 Markdown 内容块。
 *
 * @param content Markdown 原文
 * @returns 内容块
 */
function markdown(content: string): AiMarkdownBlock {
  return { type: 'markdown', content }
}
