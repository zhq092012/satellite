import { buildAiAnswer } from '@/mock/ai/service'
import type { AiContentBlock } from '@/types/ai'

/**
 * 向 AI 助手提问。
 *
 * 当前实现只调用前端 Mock，不经过 requestAPI，也不会访问大模型。
 * 以后接入真实服务时，替换本函数内部实现，保持返回 AiContentBlock[]。
 *
 * @param question 用户问题。空白问题会拒绝，避免把空消息送给分析逻辑
 * @returns 可直接渲染的内容块
 * @throws 问题为空，或 Mock 在读取 Store、整理矩阵时出现未预期的程序错误
 */
export async function askAi(question: string): Promise<AiContentBlock[]> {
  const normalized = question.trim()
  if (!normalized) {
    throw new Error('问题不能为空')
  }
  return buildAiAnswer(normalized)
}
