# AI 问答助手（第一版）开发计划

## 需求背景

在已登录的卫星态势系统中增加全局 AI 助手。用户从任意业务页打开右侧问答窗口，用输入或推荐提示词提问。回答由前端 Mock 根据当前任务 Store 生成，不接后端、不接真实大模型。

## 需求理解

第一版完成数据结构、全局入口、聊天窗口、提示词、Mock 分析和 Markdown / 表格 / 图表 / 指标渲染。会话列表、本地持久化和逐字流式输出不在本版。

## 当前实现（开发前核对）

- Vue 3.5、TypeScript 5.9、Pinia 3。业务数据集中在 `src/store/modules/layout.ts` 的 `useLayoutStore`。
- 当前任务是 `activedTask`，没有单独的 `currentTaskId`。
- 威胁度和攻击记录在 `taskAnalysisData`，且只有 `taskAnalysisTaskId === activedTask.id` 时属于当前任务。
- 打击方案在 `zhchPlanMap[activeZhchUsageType]`，且只有 `zhchPlanTaskId === activedTask.id` 时使用。
- 威胁度页、攻击度页在矩阵为空时会展示演示行。AI 不走那两条演示函数。
- 已有依赖可复用：Element Plus、ECharts、marked、highlight.js、DOMPurify、github-markdown-css。不新增依赖。

## 当前调用链

用户操作在 `Dashboard.vue` 内的各业务页。任务、矩阵和方案已经由现有页面写入 `useLayoutStore`。AI 只读这些字段。

## 当前数据流

`activedTask`、`taskAnalysisData`、`zhchPlanMap`、`allSatelliteOfTask`、`selectedAnalysisNorad`、`selectedSatellite` 已在 Store 中。AI 不复制这些数据。

## 计划修改的文件

- 修改 `src/layout/Dashboard.vue`：挂载助手。
- 新增 `src/types/ai.ts`、`src/mock/ai/prompts.ts`、`src/mock/ai/service.ts`、`src/api/ai/index.ts`。
- 新增 `src/composables/useAiAssistant.ts` 和 `src/components/ai-assistant/` 下的面板与四个渲染器。

## 计划新增或修改的函数

- `askAi`：对外提问入口，内部调用 Mock。
- `buildAiAnswer`：按关键词识别问题并组装内容块。
- `useAiAssistant`：面板开关、发送、停止、新建、清空。

## 计划新增或修改的类型

`AiMessage`、`AiPrompt`、`AiBusinessContext`、`AiConversation`、`AiContentBlock`。

## 计划新增或修改的变量

模块级 `visible`、`draft`、`conversation`、`generationId`。不新增 Pinia 状态。

## 业务流程

用户打开面板，发送问题或点击提示词。界面立即放入用户消息和加载中的助手消息。约 700 毫秒后 Mock 读取 Store 并返回内容块。缺数据时说明缺什么，不编造卫星。

## 影响范围

只在 `Dashboard` 增加一个固定层。不改任务、威胁、攻击、方案页面的写入逻辑，不改路由。

## 测试方案

`vue-tsc`、ESLint、`vite build`，以及登录后的悬浮按钮、空数据和有任务时的提问。

## 人工确认情况

按已确认计划实施第一版 Task 1～7。
