import router from '@/router'
import { AI_PROMPTS } from '@/mock/ai/prompts'
import type { AiContentBlock, AiMarkdownBlock } from '@/types/ai'
import {
  demoAnswerAttackCapability,
  demoAnswerFallback,
  demoAnswerPlanOptimize,
  demoAnswerPlanProsCons,
  demoAnswerTaskOverview,
  demoAnswerTaskSynthesis,
  demoAnswerThreatDistribution,
  demoAnswerThreatTop,
} from '@/mock/ai/demoAnswers'
import { DEMO_TASK } from '@/mock/ai/demoScenario'

/** 演示回答构建器 */
type DemoAnswerBuilder = () => AiContentBlock[]

/** 推荐提示词 ID 与演示回答的映射 */
const DEMO_ANSWER_BY_PROMPT_ID: Record<string, DemoAnswerBuilder> = {
  'task-overview': demoAnswerTaskOverview,
  'threat-top': demoAnswerThreatTop,
  'threat-distribution': demoAnswerThreatDistribution,
  'attack-capability': demoAnswerAttackCapability,
  'plan-pros-cons': demoAnswerPlanProsCons,
  'plan-optimize': demoAnswerPlanOptimize,
  'task-synthesis': demoAnswerTaskSynthesis,
}

/**
 * 根据问题生成结构化回答（纯 Mock 演示）。
 *
 * 优先按推荐提示词原文精确匹配；否则按关键词落到对应演示回答；均无法识别时返回引导页。
 *
 * @param question 已经去掉首尾空白的问题
 * @returns 内容块。首段 Markdown 会附带演示上下文说明
 */
export function buildAiAnswer(question: string): AiContentBlock[] {
  const promptId = resolvePromptId(question)
  const builder = promptId ? DEMO_ANSWER_BY_PROMPT_ID[promptId] : resolveKeywordBuilder(question)
  const blocks = builder ? builder() : demoAnswerFallback()
  return withDemoContext(blocks)
}

/**
 * 用推荐提示词列表精确匹配用户问题。
 *
 * @param question 用户问题
 * @returns 提示词 ID；未命中为 null
 */
function resolvePromptId(question: string): string | null {
  const hit = AI_PROMPTS.find((item) => item.prompt === question)
  return hit?.id ?? null
}

/**
 * 自由输入时按关键词选择演示回答。
 *
 * @param question 用户问题
 * @returns 演示构建器；无法识别为 null
 */
function resolveKeywordBuilder(question: string): DemoAnswerBuilder | null {
  if (question.includes('综合')) return demoAnswerTaskSynthesis
  if (question.includes('优化')) return demoAnswerPlanOptimize
  if (/优缺点|优劣/.test(question)) return demoAnswerPlanProsCons
  if (question.includes('威胁') && /最高|排名|哪些|排序/.test(question)) return demoAnswerThreatTop
  if (question.includes('威胁')) return demoAnswerThreatDistribution
  if (question.includes('攻击')) return demoAnswerAttackCapability
  if (/方案/.test(question)) return demoAnswerPlanProsCons
  if (question.includes('任务') && /整体|情况/.test(question)) return demoAnswerTaskOverview
  return null
}

/**
 * 在首段说明前加上演示上下文（页面 + 演示任务名）。
 *
 * @param blocks 业务内容块
 * @returns 带上下文的内容块
 */
function withDemoContext(blocks: AiContentBlock[]): AiContentBlock[] {
  const context = buildDemoContextLine()
  const first = blocks[0]
  if (first && first.type === 'markdown') {
    const merged: AiMarkdownBlock = {
      type: 'markdown',
      content: `${context}\n\n${first.content}`,
    }
    return [merged, ...blocks.slice(1)]
  }
  return [{ type: 'markdown', content: context }, ...blocks]
}

/** 路由 path 与业务页面名称 */
const PAGE_LABEL_BY_PATH: Record<string, string> = {
  '/home': '整体态势分析',
  '/situation': '卫星态势',
  '/home/threat': '威胁度分析',
  '/home/attack': '攻击度分析',
  '/home/strike-plan': '打击方案管理',
}

/**
 * 生成演示模式下的上下文一句。
 *
 * @returns Markdown 段落
 */
function buildDemoContextLine(): string {
  const pageLabel = resolvePageLabel(router.currentRoute.value.path)
  return `> **演示模式** · 当前页面：${pageLabel} · 演示任务：${DEMO_TASK.name}（ID ${DEMO_TASK.id}） · 数据为内置 Mock，不依赖真实接口。`
}

/**
 * 把路由转换成业务页面名称。
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