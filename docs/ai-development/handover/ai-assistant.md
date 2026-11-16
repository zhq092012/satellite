# AI 问答助手

## 功能概述

登录后的全局问答面板。演示模式下使用内置 Mock 场景生成说明、表格、图表和指标，不访问大模型，也不读取 layout Store。

## 功能入口

`src/layout/Dashboard.vue` 根节点中的 `AiAssistant`。右下角悬浮按钮打开右侧 528px 面板，宽于 500px 的右侧卫星列表，用来盖住列表左边框。登录页没有这个按钮。

## 核心文件

- `src/components/ai-assistant/AiAssistant.vue`：按钮、面板、提示词、输入和消息列表。
- `src/composables/useAiAssistant.ts`：开关和会话。
- `src/api/ai/index.ts`：以后替换真实服务时只改这里。
- `src/mock/ai/service.ts`：按提示词 id 分发演示回答。
- `src/mock/ai/demoScenario.ts`、`src/mock/ai/demoAnswers.ts`：内置 Mock 场景与 7 条完整回答。
- `src/mock/ai/prompts.ts`：推荐问题。
- `src/types/ai.ts`：内容块协议。
- `renderers/` 下四个渲染组件。

## 核心函数

- `sendMessage`：发送问题或提示词。
- `stopGenerating`：取消尚未写回的回答。
- `buildAiAnswer`：按推荐提示词 id 或关键词分发 `demoAnswer*` 并加演示上下文。

## 关键类型

`AiContentBlock` 是 Mock 和界面之间的协议。改回答结构时先改这个类型，再改 `service.ts` 和对应渲染器。

## 关键变量

`visible`、`draft`、`conversation`、`generationId` 定义在 `useAiAssistant.ts` 模块顶层。换页不会清空。不要把这些状态再存进 `useLayoutStore`。

## 数据来源

演示数据定义在 `src/mock/ai/demoScenario.ts`。7 条推荐问题与 `demoAnswers.ts` 中的构建器通过 `prompts.ts` 的 id 一一对应。接入真实服务后，在 `askAi` 内改回按 `taskId` 拉数，可保留本目录供离线演示。

## 业务流程

打开面板后，推荐问题原文以可换行的按钮排在输入框上方。点击发送后显示「正在生成演示回答」，约 700ms 后按内容块渲染完整 Mock 回答。

## 调用关系

`AiAssistant` 调用 `useAiAssistant`。`sendMessage` 调用 `askAi`。`askAi` 调用 `buildAiAnswer`。渲染器只接收已经组装好的内容块，不再读 Store。

## 资源生命周期

助手不创建 Cesium 对象。图表在 `ChartRenderer.vue` 里 `echarts.init`，`ResizeObserver` 负责尺寸，`onBeforeUnmount` 里 `dispose`。面板用 `v-if` 控制，关闭时图表组件会卸载。

## 修改指南

- 改提示词：`src/mock/ai/prompts.ts`。
- 改某类问题的回答：`src/mock/ai/demoAnswers.ts` 里对应的 `demoAnswer*` 函数；改演示数字改 `demoScenario.ts`。
- 改窗口样式：`AiAssistant.vue` 的样式。面板 `z-index` 是 `100010`，避免被地图加载层挡住。
- 接入真实接口：替换 `src/api/ai/index.ts` 的 `askAi`，返回同样的 `AiContentBlock[]`。

## 常见问题

- 回答与真实任务不一致：当前为演示模式，内容与 `demoScenario.ts` 一致，与战场所选任务无关。
- 回答说暂无矩阵：任务在，但态势页还没算出 `taskAnalysisData`，或矩阵属于另一个任务。
- 攻击度看起来像固定小数：分析页本身用演示公式，助手原样展示并写明来源。
- 刷新后聊天没了：第一版不做本地保存。
