# AI 问答助手 — 代码变更说明

## 需求概述

已登录布局右下角增加 AI 助手。问答读取 `useLayoutStore` 里的当前任务、威胁矩阵、打击记录和打击方案，由前端 Mock 生成 Markdown、表格、图表和指标。不请求后端，不修改业务 Store。

## 文件变更清单

| 文件路径 | 变更类型 | 修改内容 |
| --- | --- | --- |
| `src/layout/Dashboard.vue` | 修改 | 在布局根节点挂载 `AiAssistant` |
| `src/types/ai.ts` | 新增 | 消息、提示词、上下文、会话和内容块类型 |
| `src/mock/ai/prompts.ts` | 新增 | 7 条推荐提示词 |
| `src/mock/ai/service.ts` | 新增 | 关键词识别和基于 Store 的回答组装 |
| `src/api/ai/index.ts` | 新增 | `askAi` 门面，内部调用 Mock |
| `src/composables/useAiAssistant.ts` | 新增 | 面板、会话、发送、停止、新建、清空 |
| `src/components/ai-assistant/AiAssistant.vue` | 新增 | 悬浮按钮、右侧面板、提示词、输入框 |
| `src/components/ai-assistant/renderers/MarkdownRenderer.vue` | 新增 | Markdown 渲染 |
| `src/components/ai-assistant/renderers/TableRenderer.vue` | 新增 | 动态表格 |
| `src/components/ai-assistant/renderers/ChartRenderer.vue` | 新增 | ECharts 柱状、折线、饼图 |
| `src/components/ai-assistant/renderers/MetricRenderer.vue` | 新增 | 指标卡片 |

## 函数变更清单

| 函数名称 | 所属文件 | 变更类型 | 作用 |
| --- | --- | --- | --- |
| `askAi` | `src/api/ai/index.ts` | 新增 | 校验非空问题并调用 Mock |
| `buildAiAnswer` | `src/mock/ai/service.ts` | 新增 | 识别意图、读取 Store、返回内容块 |
| `detectIntent` | `src/mock/ai/service.ts` | 新增 | 关键词匹配：综合、威胁排名、威胁分布、攻击、方案、任务、卫星 |
| `useAiAssistant` | `src/composables/useAiAssistant.ts` | 新增 | 模块级面板和当前会话 |

`askAi(question: string): Promise<AiContentBlock[]>`。空白问题抛出「问题不能为空」。调用方是 `useAiAssistant` 的 `sendMessage`。内部调用 `buildAiAnswer`。不发 HTTP。

`buildAiAnswer(question: string): AiContentBlock[]`。调用方是 `askAi`。内部按意图调用威胁、攻击、方案、任务、卫星整理函数，并在第一段 Markdown 前加上当前页面和任务。副作用：无，只读 Store。

`sendMessage`、`stopGenerating`、`newConversation`、`clearConversation` 都在 `useAiAssistant` 内。`sendMessage` 先写入用户消息和 `loading` 消息，等待 700 毫秒；若期间序号变化则丢弃结果。停止时把该条改成「已停止生成。」

## 类型变更清单

| 类型名称 | 文件路径 | 变更类型 | 业务含义 |
| --- | --- | --- | --- |
| `AiMessage` | `src/types/ai.ts` | 新增 | 一条用户或助手消息 |
| `AiPrompt` | `src/types/ai.ts` | 新增 | 推荐提示词 |
| `AiBusinessContext` | `src/types/ai.ts` | 新增 | 预留的页面和任务上下文，本版回答仍直接读 Store |
| `AiConversation` | `src/types/ai.ts` | 新增 | 当前这一条会话 |
| `AiContentBlock` | `src/types/ai.ts` | 新增 | markdown、table、bar、line、pie、metric、file |

图表数据不使用 `unknown`。柱状和折线是 `categories` 加 `series`，饼图是 `items`。表格单元格是 `string | number | null`。

## 变量变更清单

| 变量名称 | 类型 | 文件路径 | 作用 | 更新时机 |
| --- | --- | --- | --- | --- |
| `visible` | `Ref<boolean>` | `useAiAssistant.ts` | 面板是否打开 | 打开、关闭、再次点击悬浮按钮 |
| `draft` | `Ref<string>` | `useAiAssistant.ts` | 输入草稿 | 输入、发送、新建、清空 |
| `conversation` | `Ref<AiConversation>` | `useAiAssistant.ts` | 当前会话和消息 | 发送、完成、失败、停止、新建、清空 |
| `generationId` | `number` | `useAiAssistant.ts` | 作废过期的生成结果 | 发送、停止、新建、清空 |

这些 ref 在模块顶层创建，页面切换时不重置。刷新页面会丢失。

## 业务流程

1. `Dashboard.vue` 挂载 `AiAssistant`，组件把按钮和面板传送到 `body`。
2. 用户打开面板。没有消息时展示 `AI_PROMPTS`。
3. 点击提示词或按 Enter 调用 `sendMessage`。
4. `askAi` 调用 `buildAiAnswer`。
5. Mock 用 `router.currentRoute` 写页面名，用 `activedTask` 写任务名。
6. 威胁问题调用 `buildHomeThreatAnalysisRowsFromMatrix`。攻击问题调用 `buildHomeAttackAnalysisRowsFromMatrix`。方案问题读 `activeZhchPlan`。
7. 渲染器按内容块类型显示结果。

## 函数调用链

悬浮按钮或提示词  
→ `useAiAssistant.sendMessage`  
→ `askAi`  
→ `buildAiAnswer`  
→ `useLayoutStore` 与现有表格构建函数  
→ `AiAssistant` 中的 Markdown、Table、Chart、Metric 渲染器

异步点只有 700 毫秒延迟和 `askAi` 的 Promise。Mock 本身是同步读取。

## 数据流

- 任务：`activedTask.name`、`id`、`beginDate`、`endDate`、`enemyCountryShow`、`meCountryShow`、`description`。
- 威胁：`taskAnalysisData` 经 `buildHomeThreatAnalysisRowsFromMatrix` 得到国家、卫星、静态、动态、综合威胁。排序使用已有的 `compositeThreatSort`。
- 攻击：同一矩阵的 `attackPlanList` 经 `buildHomeAttackAnalysisRowsFromMatrix` 得到目标、武器和时间窗。攻击度列沿用分析页演示公式，文案标明不是 `/algorithm/attackability`。
- 方案：`zhchPlanTaskId` 匹配后读取 `summary`、`beforeResult`、`afterResult` 和覆盖率、窗口数。字段不是字符串或数字时写「接口未返回该项」。
- 卫星：`allSatelliteOfTask` 与分析矩阵按 NORAD 合并。选中对象读 `selectedAnalysisNorad` 和 `selectedSatellite`。

不调用 `buildMockHomeThreatAnalysisRows` 和 `buildMockHomeAttackAnalysisRows`。

## 原有逻辑变化

业务页面的计算、接口和 Store 写入没有改。`Dashboard` 只多挂了一个组件。登录页不在 `Dashboard` 内，因此不显示助手。

攻击度演示公式和威胁度综合公式都是原来分析页的计算，AI 只是引用其结果并说明来源。

## 测试记录

| 检查项目 | 执行结果 | 说明 |
| --- | --- | --- |
| TypeScript | 本次文件通过 | `vue-tsc --noEmit -p tsconfig.app.json` 中，新增文件无报错。工程里原有文件仍有未使用变量等报错，本次未改那些文件 |
| ESLint | 未执行 | ESLint 9 无法加载现有 `.eslintrc.cjs` 的 `plugin:vue/vue3-essential`，配置阶段就失败，与本次文件无关 |
| Vitest | 未执行 | 本版没有新增测试文件 |
| Vite Build | 通过 | `pnpm exec vite build --mode production` 成功 |
| 人工验证 | 部分验证 | 登录页没有助手。登录后右下角有 AI 按钮，面板能打开并看到 7 条提示词。选择场景「台湾战场2」后出现任务 test2。尚未在该任务上点完一条提示词并核对回答正文 |

## 已知问题

- 关闭面板或刷新后，会话只留在内存里，刷新即丢失。
- 没有多会话列表，也没有逐字输出。表格和图表在整段回答完成后一次出现。
- 攻击度数字是分析页演示值，不是正式攻击度接口。
- 当前任务没有矩阵或方案时，回答会说明暂无数据。浏览器里任务 test2 是否已有矩阵，这次没有通过提示词再核一次。
