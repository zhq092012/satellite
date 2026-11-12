import { computed, ref } from 'vue'
import { askAi } from '@/api/ai'
import type { AiContentBlock, AiConversation, AiMessage } from '@/types/ai'

/**
 * 面板开关、当前会话和生成过程放在模块级 ref 中。
 * Dashboard 不卸载时记录自然还在；即使布局重挂，同一次页面生命周期里也会保留。
 * 关闭面板不清空消息。刷新页面会丢失，持久化不属于第一版。
 */
const visible = ref(false)
/** 输入框草稿。放在模块里，避免面板关闭时丢掉未发送的文字 */
const draft = ref('')
/** 当前唯一会话 */
const conversation = ref<AiConversation>(createConversation())
/**
 * 生成序号。停止、新建、清空都会加一。
 * 延迟结束后序号不一致，就不再把结果写进消息。
 */
let generationId = 0

/**
 * 全局 AI 助手的界面状态。
 *
 * @returns 面板、会话和发送、停止、新建、清空操作
 */
export function useAiAssistant() {
  /** 是否有一条助手消息仍在等待 Mock 结果 */
  const generating = computed(() => conversation.value.messages.some((message) => message.status === 'loading'))

  /**
   * 打开或收起面板，不改变路由。
   */
  const toggleVisible = () => {
    visible.value = !visible.value
  }

  /**
   * 收起面板。
   */
  const close = () => {
    visible.value = false
  }

  /**
   * 发送问题。传入 text 时用提示词，否则用输入框草稿。
   * 空白或正在生成时不发送。
   *
   * @param text 提示词原文。不传则读取草稿
   */
  const sendMessage = async (text?: string) => {
    const question = (text ?? draft.value).trim()
    if (!question || generating.value) return

    draft.value = ''
    const id = ++generationId
    const createdAt = nowText()
    if (conversation.value.title === '新会话') {
      conversation.value.title = question.slice(0, 24)
    }
    conversation.value.messages.push(createUserMessage(question, createdAt), createLoadingMessage(createdAt))
    conversation.value.updateTime = createdAt

    try {
      await wait(700)
      if (generationId !== id) return
      const blocks = await askAi(question)
      if (generationId !== id) return
      completeLoadingMessage(blocks)
    } catch (error) {
      if (generationId !== id) return
      const detail = error instanceof Error ? error.message : '生成回答失败'
      failLoadingMessage(detail)
    }
  }

  /**
   * 停止当前生成。已经出现的用户消息保留，助手消息改成「已停止生成」。
   * 第一版没有逐字输出，停止时还没有表格和图表可保留。
   */
  const stopGenerating = () => {
    if (!generating.value) return
    generationId += 1
    const loading = findLoadingMessage()
    if (!loading) return
    loading.status = 'completed'
    loading.content = [{ type: 'markdown', content: '已停止生成。' }]
    conversation.value.updateTime = nowText()
  }

  /**
   * 新建会话。旧消息从内存移除，进行中的生成作废。
   */
  const newConversation = () => {
    generationId += 1
    conversation.value = createConversation()
    draft.value = ''
  }

  /**
   * 清空当前会话的消息，保留会话 ID。进行中的生成作废。
   */
  const clearConversation = () => {
    generationId += 1
    conversation.value.messages = []
    conversation.value.title = '新会话'
    conversation.value.updateTime = nowText()
    draft.value = ''
  }

  return {
    visible,
    draft,
    conversation,
    generating,
    toggleVisible,
    close,
    sendMessage,
    stopGenerating,
    newConversation,
    clearConversation,
  }
}

/**
 * 生成会话或消息 ID。
 *
 * `crypto.randomUUID` 只在 localhost 和 HTTPS 上存在。用 IP 以 HTTP 打开时它是 undefined，
 * 模块加载就会抛错，路由无法启动。`getRandomValues` 在这种地址上仍然可用。
 *
 * @returns UUID 字符串
 */
function createId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * 创建一条空会话。
 *
 * @returns 标题为「新会话」的会话
 */
function createConversation(): AiConversation {
  const time = nowText()
  return {
    id: createId(),
    title: '新会话',
    messages: [],
    createTime: time,
    updateTime: time,
  }
}

/**
 * 创建用户消息。原文放在 markdown 块里，界面按纯文本显示，不解析用户输入中的 HTML。
 *
 * @param question 问题原文
 * @param createTime 创建时间
 * @returns 用户消息
 */
function createUserMessage(question: string, createTime: string): AiMessage {
  return {
    id: createId(),
    role: 'user',
    status: 'completed',
    createTime,
    content: [{ type: 'markdown', content: question }],
  }
}

/**
 * 创建等待中的助手消息。内容先空着，完成后再写入完整内容块。
 *
 * @param createTime 创建时间
 * @returns 加载中的助手消息
 */
function createLoadingMessage(createTime: string): AiMessage {
  return {
    id: createId(),
    role: 'assistant',
    status: 'loading',
    createTime,
    content: [],
  }
}

/**
 * 找到当前正在加载的助手消息。
 *
 * @returns 加载中的消息；没有时为 undefined
 */
function findLoadingMessage(): AiMessage | undefined {
  return conversation.value.messages.find((message) => message.status === 'loading')
}

/**
 * 把加载中的助手消息写成完成状态。
 *
 * @param blocks Mock 返回的完整内容块
 */
function completeLoadingMessage(blocks: AiContentBlock[]): void {
  const loading = findLoadingMessage()
  if (!loading) return
  loading.status = 'completed'
  loading.content = blocks
  conversation.value.updateTime = nowText()
}

/**
 * 把加载中的助手消息写成失败状态，并保留错误说明。
 *
 * @param detail 错误信息
 */
function failLoadingMessage(detail: string): void {
  const loading = findLoadingMessage()
  if (!loading) return
  loading.status = 'error'
  loading.content = [{ type: 'markdown', content: `生成失败：${detail}` }]
  conversation.value.updateTime = nowText()
}

/**
 * 等待 Mock 的模拟延迟。
 *
 * @param ms 毫秒
 * @returns 延迟结束
 */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 当前本地时间，用于消息和会话时间。
 *
 * @returns YYYY-MM-DD HH:mm:ss
 */
function nowText(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
