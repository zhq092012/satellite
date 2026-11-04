<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AI_PROMPTS } from '@/mock/ai/prompts'
import { useAiAssistant } from '@/composables/useAiAssistant'
import type { AiContentBlock, AiMessage, AiPrompt } from '@/types/ai'
import ChartRenderer from './renderers/ChartRenderer.vue'
import MarkdownRenderer from './renderers/MarkdownRenderer.vue'
import MetricRenderer from './renderers/MetricRenderer.vue'
import TableRenderer from './renderers/TableRenderer.vue'

defineOptions({ name: 'AiAssistant' })

const {
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
} = useAiAssistant()

/** 消息列表滚动容器 */
const messageScroller = ref<HTMLElement | null>(null)

/** 当前会话消息。关闭面板后仍然保留 */
const messages = computed(() => conversation.value.messages)

/** 输入框去掉空白后是否可以发送 */
const canSend = computed(() => draft.value.trim().length > 0 && !generating.value)

/**
 * 悬浮按钮位置。面板打开时移到面板左侧，避免被 460px 面板盖住。
 */
const fabStyle = computed(() => ({
  right: visible.value ? '484px' : '24px',
}))

/**
 * 按分类整理提示词。分类缺失时归到「其他」，数据本身仍来自提示词文件。
 */
const promptGroups = computed(() => {
  const groups = new Map<string, AiPrompt[]>()
  AI_PROMPTS.forEach((prompt) => {
    const category = prompt.category ?? '其他'
    const list = groups.get(category) ?? []
    list.push(prompt)
    groups.set(category, list)
  })
  return [...groups.entries()]
})

/**
 * 用户消息按纯文本展示，不把用户输入送进 Markdown 渲染。
 *
 * @param message 用户消息
 * @returns 原文
 */
function userText(message: AiMessage): string {
  return message.content
    .filter((block): block is Extract<AiContentBlock, { type: 'markdown' }> => block.type === 'markdown')
    .map((block) => block.content)
    .join('\n')
}

/**
 * 判断内容块是不是图表，便于模板收窄到 ChartRenderer。
 *
 * @param block 内容块
 * @returns 是否为图表
 */
function isChartBlock(
  block: AiContentBlock,
): block is Extract<AiContentBlock, { type: 'chart' }> {
  return block.type === 'chart'
}

/**
 * 把消息区滚到最新一条。
 */
async function scrollToBottom() {
  await nextTick()
  const scroller = messageScroller.value
  if (!scroller) return
  scroller.scrollTop = scroller.scrollHeight
}

/**
 * Enter 发送。Shift+Enter 不进入这里，留给 textarea 换行。
 * 正在生成时忽略，避免覆盖当前问题。
 */
function handleEnter() {
  if (!canSend.value) return
  void sendMessage()
}

/**
 * 点击提示词后直接发送，不先填进输入框。
 *
 * @param prompt 提示词
 */
function handlePrompt(prompt: AiPrompt) {
  void sendMessage(prompt.prompt)
}

watch(
  () => messages.value.map((message) => `${message.id}:${message.status}:${message.content.length}`).join('|'),
  () => {
    void scrollToBottom()
  },
)

watch(visible, (open) => {
  if (open) void scrollToBottom()
})
</script>

<template>
  <Teleport to="body">
    <div class="ai-assistant">
      <button class="ai-fab" type="button" :style="fabStyle" @click="toggleVisible">
        <el-icon><ChatDotRound /></el-icon>
        <span>AI</span>
      </button>

      <section v-if="visible" class="ai-panel" aria-label="AI 助手">
        <header class="ai-header">
          <div class="ai-header-title">
            <strong>AI 助手</strong>
            <span>本地模拟 · 读取当前任务</span>
          </div>
          <div class="ai-header-actions">
            <el-button size="small" text native-type="button" @click="newConversation">新建会话</el-button>
            <el-button size="small" text native-type="button" @click="clearConversation">清空</el-button>
            <el-button size="small" text native-type="button" aria-label="关闭" @click="close">
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </header>

        <div ref="messageScroller" class="ai-messages">
          <div v-if="messages.length === 0" class="ai-prompts">
            <p class="ai-prompts-lead">可以选择一个问题，或在下方直接输入。</p>
            <section v-for="[category, prompts] in promptGroups" :key="category" class="ai-prompt-group">
              <h3>{{ category }}</h3>
              <button
                v-for="prompt in prompts"
                :key="prompt.id"
                type="button"
                class="ai-prompt"
                :disabled="generating"
                @click="handlePrompt(prompt)"
              >
                <span class="ai-prompt-title">{{ prompt.title }}</span>
                <span v-if="prompt.description" class="ai-prompt-desc">{{ prompt.description }}</span>
              </button>
            </section>
          </div>

          <article
            v-for="message in messages"
            :key="message.id"
            class="ai-message"
            :class="`is-${message.role}`"
          >
            <div v-if="message.role === 'user'" class="ai-user-text">{{ userText(message) }}</div>
            <div v-else class="ai-assistant-body" :class="{ 'is-error': message.status === 'error' }">
              <div v-if="message.status === 'loading'" class="ai-loading">正在根据当前任务数据分析...</div>
              <div v-else class="ai-blocks">
                <template v-for="(block, index) in message.content" :key="`${message.id}-${index}`">
                  <MarkdownRenderer
                    v-if="block.type === 'markdown'"
                    class="ai-block-full"
                    :content="block.content"
                  />
                  <TableRenderer v-else-if="block.type === 'table'" class="ai-block-full" :block="block" />
                  <ChartRenderer v-else-if="isChartBlock(block)" class="ai-block-full" :block="block" />
                  <MetricRenderer
                    v-else-if="block.type === 'metric'"
                    :title="block.title"
                    :value="block.value"
                    :unit="block.unit"
                  />
                  <div v-else-if="block.type === 'file'" class="ai-file ai-block-full">
                    <strong>{{ block.name }}</strong>
                    <span>{{ block.format }}</span>
                    <span class="ai-file-url">{{ block.url }}</span>
                  </div>
                  <div v-else class="ai-block-full">暂不支持的内容块</div>
                </template>
                <div v-if="message.content.length === 0" class="ai-block-full">没有可展示的内容</div>
              </div>
            </div>
          </article>
        </div>

        <footer class="ai-footer">
          <textarea
            v-model="draft"
            class="ai-input"
            rows="3"
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            @keydown.enter.exact.prevent="handleEnter"
          ></textarea>
          <div class="ai-footer-actions">
            <el-button v-if="generating" type="warning" @click="stopGenerating">停止</el-button>
            <el-button v-else type="primary" :disabled="!canSend" @click="sendMessage()">发送</el-button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.ai-assistant {
  position: static;
}

.ai-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 100010;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 48px;
  padding: 0 16px;
  border: 0;
  border-radius: 999px;
  background: #1d4ed8;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.35);
  cursor: pointer;
}

.ai-panel {
  position: fixed;
  top: 60px;
  right: 0;
  z-index: 100010;
  display: flex;
  flex-direction: column;
  width: 460px;
  height: calc(100vh - 60px);
  border-left: 1px solid rgba(125, 211, 252, 0.28);
  background: #0b1528;
  color: #e2e8f0;
  box-shadow: -12px 0 32px rgba(2, 6, 23, 0.45);
  pointer-events: auto;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  padding: 12px 12px 8px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.ai-header-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  strong {
    color: #f8fafc;
    font-size: 16px;
  }

  span {
    color: #94a3b8;
    font-size: 12px;
  }
}

.ai-header-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.ai-messages {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
}

.ai-prompts-lead {
  margin: 0 0 12px;
  color: #94a3b8;
  font-size: 13px;
}

.ai-prompt-group {
  margin-bottom: 14px;

  h3 {
    margin: 0 0 8px;
    color: #7dd3fc;
    font-size: 13px;
    font-weight: 600;
  }
}

.ai-prompt {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  margin-bottom: 8px;
  padding: 10px 12px;
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.65);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.ai-prompt:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.ai-prompt-title {
  color: #f8fafc;
  font-size: 13px;
}

.ai-prompt-desc {
  margin-top: 4px;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
}

.ai-message {
  display: flex;
  margin-bottom: 14px;
}

.ai-message.is-user {
  justify-content: flex-end;
}

.ai-message.is-assistant {
  justify-content: flex-start;
}

.ai-user-text {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 12px 12px 4px 12px;
  background: #1e3a5f;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-assistant-body {
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px 12px 12px 4px;
  background: #111c33;
}

.ai-assistant-body.is-error {
  border: 1px solid rgba(248, 113, 113, 0.7);
}

.ai-loading {
  color: #7dd3fc;
}

.ai-blocks {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-block-full {
  width: 100%;
}

.ai-file {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
}

.ai-file-url {
  color: #94a3b8;
  font-size: 12px;
  word-break: break-all;
}

.ai-footer {
  flex-shrink: 0;
  padding: 12px 16px 16px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.ai-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 72px;
  max-height: 140px;
  padding: 8px 10px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 8px;
  background: #0f172a;
  color: #f8fafc;
  resize: vertical;
  font: inherit;
}

.ai-input:focus {
  outline: 1px solid #38bdf8;
}

.ai-footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
