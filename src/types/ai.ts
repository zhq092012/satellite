/**
 * AI 助手的前端数据结构。
 *
 * 威胁度、攻击记录和打击方案不在这些类型里重复保存，提问时从 useLayoutStore 现读。
 * 内容块是 Mock 与未来真实 AI 服务共用的渲染协议。
 */

/** 一条聊天消息的生成状态 */
export type AiMessageStatus =
  /** 已发出，助手内容尚未写入 */
  | 'loading'
  /** 正在逐段写入内容。类型已预留，当前发送完成前不会赋这个状态。 */
  | 'streaming'
  /** 内容已写完。用户消息固定为该状态。 */
  | 'completed'
  /** 生成失败 */
  | 'error'

/** 消息角色。第一版只有用户和助手。 */
export type AiMessageRole =
  /** 用户提问 */
  | 'user'
  /** 助手回答 */
  | 'assistant'

/** 柱状图、折线图的类目数据。categories 与每个 series.values 一一对应。 */
export interface AiChartCategoryData {
  /** 横轴类目，例如卫星名称 */
  categories: string[]
  /** 序列。values 长度必须与 categories 一致 */
  series: AiChartSeries[]
}

/** 图表中的一条数值序列 */
export interface AiChartSeries {
  /** 图例名称 */
  name: string
  /** 与类目对齐的数值 */
  values: number[]
}

/** 饼图数据 */
export interface AiChartPieData {
  /** 扇区。value 为数量或指标，不用未知结构 */
  items: AiChartPieItem[]
}

/** 饼图的一个扇区 */
export interface AiChartPieItem {
  /** 扇区名称，例如国家 */
  name: string
  /** 扇区数值 */
  value: number
}

/** 表格列。prop 对应 data 行里的字段名 */
export interface AiTableColumn {
  /** 行数据字段名 */
  prop: string
  /** 表头文字 */
  label: string
}

/** 表格单元格允许的值。空单元格用 null，不把缺失写成 0 或空对象。 */
export type AiTableCell =
  /** 文本 */
  | string
  /** 数字 */
  | number
  /** 空单元格 */
  | null

/** 表格中的一行 */
export type AiTableRow = Record<string, AiTableCell>

/**
 * 助手回答的一个内容块。
 * Markdown 负责说明，表格和图表负责可交互展示，两者不要互相解析。
 */
export type AiContentBlock =
  /** Markdown 说明 */
  | AiMarkdownBlock
  /** 动态表格 */
  | AiTableBlock
  /** 柱状图 */
  | AiBarChartBlock
  /** 折线图 */
  | AiLineChartBlock
  /** 饼图 */
  | AiPieChartBlock
  /** 指标卡片 */
  | AiMetricBlock
  /** 文件信息 */
  | AiFileBlock

/** Markdown 文本块。渲染前会做 HTML 过滤。 */
export interface AiMarkdownBlock {
  /** 内容块类型 */
  type: 'markdown'
  /** Markdown 原文 */
  content: string
}

/** 动态表格。列和行都由回答生成，不在渲染器里写死。 */
export interface AiTableBlock {
  /** 内容块类型 */
  type: 'table'
  /** 表格标题。没有标题时不展示 */
  title?: string
  /** 列定义 */
  columns: AiTableColumn[]
  /** 行数据 */
  data: AiTableRow[]
}

/** 柱状图 */
export interface AiBarChartBlock {
  /** 内容块类型 */
  type: 'chart'
  /** 图表种类 */
  chartType: 'bar'
  /** 图表标题 */
  title: string
  /** 类目和序列 */
  data: AiChartCategoryData
}

/** 折线图 */
export interface AiLineChartBlock {
  /** 内容块类型 */
  type: 'chart'
  /** 图表种类 */
  chartType: 'line'
  /** 图表标题 */
  title: string
  /** 类目和序列 */
  data: AiChartCategoryData
}

/** 饼图 */
export interface AiPieChartBlock {
  /** 内容块类型 */
  type: 'chart'
  /** 图表种类 */
  chartType: 'pie'
  /** 图表标题 */
  title: string
  /** 扇区数据 */
  data: AiChartPieData
}

/** 指标卡片 */
export interface AiMetricBlock {
  /** 内容块类型 */
  type: 'metric'
  /** 指标名称 */
  title: string
  /** 指标数值。保持源数据的数字或文本，不在类型层改写 */
  value: string | number
  /** 单位，例如 % 、颗 */
  unit?: string
}

/**
 * 文件信息。
 * 第一版 Mock 不生成文件，渲染器只做只读展示，供后续真实服务返回附件。
 */
export interface AiFileBlock {
  /** 内容块类型 */
  type: 'file'
  /** 文件名 */
  name: string
  /** 文件地址。当前没有下载接口，只展示不请求 */
  url: string
  /** 文件格式，例如 csv、markdown */
  format: string
}

/** 一轮对话中的一条消息 */
export interface AiMessage {
  /** 消息 ID */
  id: string
  /** 发言角色 */
  role: AiMessageRole
  /** 结构化内容。用户消息使用一个 markdown 块保存原文，展示时按纯文本输出 */
  content: AiContentBlock[]
  /** 生成状态。用户消息固定为 completed */
  status: AiMessageStatus
  /** 创建时间，本地时间 YYYY-MM-DD HH:mm:ss */
  createTime: string
}

/** 推荐提示词。文案与界面分离，后续可换成接口数据。 */
export interface AiPrompt {
  /** 提示词 ID */
  id: string
  /** 卡片上的短标题 */
  title: string
  /** 补充说明 */
  description?: string
  /** 点击后实际发送的问题 */
  prompt: string
  /** 分类，用于分组展示 */
  category?: string
}

/**
 * 提问时的页面和任务上下文。
 * 只描述当前任务、页面和选中卫星，不复制威胁度、攻击度和方案明细。
 */
export interface AiBusinessContext {
  /** 当前任务 ID。未选择任务时没有该字段 */
  taskId?: number
  /** 当前任务名称 */
  taskName?: string
  /** 当前路由 path */
  pagePath?: string
  /** 当前页面的业务名称 */
  pageLabel?: string
  /** 当前选中的卫星。地图点击和分析页 NORAD 不是同一个字段，由 Mock 读取时决定 */
  selectedSatellite?: AiSelectedSatellite
}

/** 上下文中的选中卫星 */
export interface AiSelectedSatellite {
  /** NORAD 编号 */
  norad: number
  /** 展示名称 */
  name: string
}

/**
 * 一次会话。
 * 第一版只在内存中保留当前这一条，类型按后续多会话预留。
 */
export interface AiConversation {
  /** 会话 ID */
  id: string
  /** 会话标题。首条问题写入前为「新会话」 */
  title: string
  /** 按时间排列的消息 */
  messages: AiMessage[]
  /** 创建时间 */
  createTime: string
  /** 最近一条消息或清空操作的时间 */
  updateTime: string
}
