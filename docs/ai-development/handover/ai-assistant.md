# AI 问答助手

## 功能概述

登录后的全局问答面板。它根据当前任务 Store 里已经加载的数据做说明、表格、图表和指标，不访问大模型。

## 功能入口

`src/layout/Dashboard.vue` 根节点中的 `AiAssistant`。右下角悬浮按钮打开右侧 460px 面板。登录页没有这个按钮。

## 核心文件

- `src/components/ai-assistant/AiAssistant.vue`：按钮、面板、提示词、输入和消息列表。
- `src/composables/useAiAssistant.ts`：开关和会话。
- `src/api/ai/index.ts`：以后替换真实服务时只改这里。
- `src/mock/ai/service.ts`：问题识别和回答内容。
- `src/mock/ai/prompts.ts`：推荐问题。
- `src/types/ai.ts`：内容块协议。
- `renderers/` 下四个渲染组件。

## 核心函数

- `sendMessage`：发送问题或提示词。
- `stopGenerating`：取消尚未写回的回答。
- `buildAiAnswer`：生成内容块。
- `detectIntent`：决定读威胁、攻击、方案、任务还是卫星。

## 关键类型

`AiContentBlock` 是 Mock 和界面之间的协议。改回答结构时先改这个类型，再改 `service.ts` 和对应渲染器。

## 关键变量

`visible`、`draft`、`conversation`、`generationId` 定义在 `useAiAssistant.ts` 模块顶层。换页不会清空。不要把这些状态再存进 `useLayoutStore`。

## 数据来源

全部来自 `useLayoutStore`：

- 任务：`activedTask`
- 威胁和攻击矩阵：`taskAnalysisData`，并且 `taskAnalysisTaskId` 必须等于当前任务 ID
- 方案：`activeZhchPlan`，并且 `zhchPlanTaskId` 必须等于当前任务 ID
- 卫星清单：`allSatelliteOfTask`
- 选中卫星：`selectedAnalysisNorad`、`selectedSatellite`

威胁表复用 `buildHomeThreatAnalysisRowsFromMatrix`。攻击表复用 `buildHomeAttackAnalysisRowsFromMatrix`。不要改用两个 `buildMock*` 函数。

## 业务流程

打开面板后，空会话显示提示词。发送后先看到自己的问题和「正在根据当前任务数据分析」。Mock 延迟结束后，按内容块渲染。没有任务、矩阵或方案时，正文直接写暂无，不补假卫星。

## 调用关系

`AiAssistant` 调用 `useAiAssistant`。`sendMessage` 调用 `askAi`。`askAi` 调用 `buildAiAnswer`。渲染器只接收已经组装好的内容块，不再读 Store。

## 资源生命周期

助手不创建 Cesium 对象。图表在 `ChartRenderer.vue` 里 `echarts.init`，`ResizeObserver` 负责尺寸，`onBeforeUnmount` 里 `dispose`。面板用 `v-if` 控制，关闭时图表组件会卸载。

## 修改指南

- 改提示词：`src/mock/ai/prompts.ts`。
- 改某类问题的回答：`src/mock/ai/service.ts` 里对应的 `answer*` 函数。
- 改窗口样式：`AiAssistant.vue` 的样式。面板 `z-index` 是 `100010`，避免被地图加载层挡住。
- 接入真实接口：替换 `src/api/ai/index.ts` 的 `askAi`，返回同样的 `AiContentBlock[]`。

## 常见问题

- 回答说未选择任务：顶栏场景还没选，`activedTask` 为空。
- 回答说暂无矩阵：任务在，但态势页还没算出 `taskAnalysisData`，或矩阵属于另一个任务。
- 攻击度看起来像固定小数：分析页本身用演示公式，助手原样展示并写明来源。
- 刷新后聊天没了：第一版不做本地保存。
