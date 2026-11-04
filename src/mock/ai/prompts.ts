import type { AiPrompt } from '@/types/ai'

/**
 * AI 助手的初始推荐提示词。
 * 点击后发送 prompt 字段，不在组件里写死问题文案。
 */
export const AI_PROMPTS: AiPrompt[] = [
  {
    id: 'task-overview',
    category: '任务分析',
    title: '任务整体情况',
    description: '查看当前任务的时间、作战对象和已加载的数据',
    prompt: '分析当前任务的整体情况',
  },
  {
    id: 'threat-top',
    category: '威胁度分析',
    title: '威胁度最高的卫星',
    description: '按综合威胁度排序，只使用当前矩阵',
    prompt: '当前任务中威胁度最高的卫星有哪些？',
  },
  {
    id: 'threat-distribution',
    category: '威胁度分析',
    title: '威胁度分布',
    description: '按国家统计当前矩阵中的卫星',
    prompt: '分析当前任务的卫星威胁度分布',
  },
  {
    id: 'attack-capability',
    category: '攻击度分析',
    title: '攻击能力',
    description: '读取打击记录。攻击度分数与分析页的演示计算一致',
    prompt: '当前任务的攻击能力如何？',
  },
  {
    id: 'plan-pros-cons',
    category: '方案分析',
    title: '方案优缺点',
    description: '只转述当前打击方案接口已经返回的结论',
    prompt: '分析当前打击方案的优缺点',
  },
  {
    id: 'plan-optimize',
    category: '方案分析',
    title: '方案可优化点',
    description: '根据方案概述和打击前后指标说明现状',
    prompt: '当前方案有哪些需要优化的地方？',
  },
  {
    id: 'task-synthesis',
    category: '综合分析',
    title: '威胁与攻击综合分析',
    description: '同时查看任务、威胁矩阵和打击方案，缺哪一类就单独说明',
    prompt: '综合分析当前任务的威胁和攻击能力',
  },
]
