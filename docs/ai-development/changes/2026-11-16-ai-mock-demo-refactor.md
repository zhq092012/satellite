# AI 助手 Mock 演示重构

## 需求概述

将 AI 助手从「读取 layout Store 真数据」改为「全部使用内置 Mock 场景」，保证 7 条推荐提示词在无任务、无矩阵时也能得到含 Markdown、表格、图表、指标的完整演示回答。

## 文件变更清单

| 文件路径 | 变更类型 | 修改内容 |
| ----- | ----- | ----- |
| `src/mock/ai/demoScenario.ts` | 新增 | 演示任务、威胁、打击、方案静态数据 |
| `src/mock/ai/demoAnswers.ts` | 新增 | 7 条提示词对应的演示回答构建器 |
| `src/mock/ai/service.ts` | 修改 | 去掉 Store 依赖，按 prompt id / 关键词分发 Mock |
| `src/mock/ai/prompts.ts` | 修改 | 注释说明与 demoAnswers 的 id 映射 |
| `src/api/ai/index.ts` | 修改 | 注释标明纯 Mock，不读 Store |
| `src/components/ai-assistant/AiAssistant.vue` | 修改 | 副标题与加载文案改为演示模式 |

## 函数变更清单

| 函数名称 | 所属文件 | 变更类型 | 作用 |
| ----- | ----- | ---- | ---- |
| `buildAiAnswer` | `service.ts` | 修改 | 分发演示回答并加演示上下文 |
| `demoAnswerTaskOverview` 等 7 个 | `demoAnswers.ts` | 新增 | 各提示词的结构化 Mock 回答 |
| `demoAnswerFallback` | `demoAnswers.ts` | 新增 | 未识别问题的引导页 |

## 业务流程

用户点击推荐提示词 → `sendMessage(prompt)` → `askAi` → `buildAiAnswer` → 按 `AI_PROMPTS` 精确匹配 id → 对应 `demoAnswer*` → `withDemoContext` 加演示说明 → 渲染器展示。

## 测试记录

| 检查项目 | 执行结果 | 说明 |
| ---- | ---- | ---- |
| vue-tsc | 通过 | `npx vue-tsc --noEmit` |
| Vite Build | 通过 | `npm run build` |
| 人工验证 | 未验证 | 需在浏览器逐条点击 7 个提示词 |

## 已知问题

- 自由输入的非关键词问题仅返回引导页，不再尝试卫星 NORAD 查询（演示模式有意收窄范围）。
- 接入真实 `/api/ai/ask` 时需恢复或并行保留本 Mock 模块供离线演示。