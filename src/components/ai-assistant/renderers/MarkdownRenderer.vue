<script setup lang="ts">
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { Marked } from 'marked'
import { computed } from 'vue'
import 'github-markdown-css/github-markdown.css'
import 'highlight.js/styles/github-dark.css'

const props = defineProps<{
  /** Markdown 原文 */
  content: string
}>()

/**
 * 全局复用的 Markdown 解析器。
 * 代码块交给 highlight.js，其余按 GFM 解析。解析结果仍要经过 DOMPurify。
 */
const markdownParser = new Marked({
  async: false,
  gfm: true,
  breaks: false,
})

markdownParser.use({
  renderer: {
    code({ text, lang }) {
      const safeLang = lang && /^[\w+-]+$/.test(lang) ? lang : ''
      const highlighted =
        safeLang && hljs.getLanguage(safeLang)
          ? hljs.highlight(text, { language: safeLang }).value
          : hljs.highlightAuto(text).value
      const className = safeLang ? `hljs language-${safeLang}` : 'hljs'
      return `<pre><code class="${className}">${highlighted}</code></pre>`
    },
  },
})

/**
 * 计算助手 Markdown 对应的 HTML。
 * 返回经过 DOMPurify 过滤的字符串。解析器若返回 Promise，说明配置被改成了异步，直接抛出。
 * 作用：消息区只渲染过滤后的 HTML，不把未完成的解析结果写进页面。
 */
const html = computed(() => {
  const parsed = markdownParser.parse(props.content)
  if (typeof parsed !== 'string') {
    throw new Error('Markdown 解析未返回字符串')
  }
  return DOMPurify.sanitize(parsed)
})
</script>

<template>
  <!-- DOMPurify 已过滤 marked 的输出，只渲染助手生成的 Markdown -->
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-body ai-markdown" v-html="html"></div>
</template>

<style scoped lang="scss">
.ai-markdown {
  box-sizing: border-box;
  padding: 0;
  background: transparent;
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.6;
}

.ai-markdown :deep(h1),
.ai-markdown :deep(h2),
.ai-markdown :deep(h3),
.ai-markdown :deep(h4) {
  margin: 0 0 8px;
  color: #f8fafc;
  font-size: 15px;
  border-bottom: none;
}

.ai-markdown :deep(p),
.ai-markdown :deep(ul),
.ai-markdown :deep(ol) {
  margin-top: 0;
  margin-bottom: 8px;
}

.ai-markdown :deep(table) {
  display: block;
  width: 100%;
  overflow-x: auto;
  color: #e2e8f0;
}

.ai-markdown :deep(th),
.ai-markdown :deep(td) {
  background: transparent;
  color: #e2e8f0;
  border-color: rgba(148, 163, 184, 0.35);
}

.ai-markdown :deep(pre) {
  background: #0f172a;
}

.ai-markdown :deep(code),
.ai-markdown :deep(tt) {
  background: rgba(15, 23, 42, 0.85);
  color: #e2e8f0;
}

.ai-markdown :deep(a) {
  color: #7dd3fc;
}
</style>
