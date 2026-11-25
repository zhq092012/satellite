# 报告 Swagger 同步与展示增强

## 5.1 需求概述

从 `http://192.168.52.72:34127/v3/api-docs` 拉取最新 OpenAPI，更新本地类型与快照；在前端展示报告接口新增的战役元信息、告警、自检、口径、阶段结构，以及方案格子上的指标、配额与选星扩展字段。

## 5.2 文件变更清单

| 文件路径 | 变更类型 | 修改内容 |
| ----- | ----- | ----- |
| `src/types/report/openapi-snapshot.json` | 新增 | 完整 v3 api-docs 快照 |
| `src/types/report/report.d.ts` | 修改 | 对齐 ReportGenerateResp / SchemeResult / stages 等 schema |
| `src/utils/reportSchemeDisplay.ts` | 修改 | 概要、metrics、配额行、选星新列 |
| `src/components/electronic/strike-plan/ReportGenerateOverview.vue` | 新增 | 报告全局信息与阶段折叠面板 |
| `src/components/electronic/StrikePlanGenerator.vue` | 修改 | 挂载报告概览 |
| `src/components/electronic/strike-plan/StrikePlanSchemePanel.vue` | 修改 | 配额表与选星新列 |

## 5.10 测试记录

| 检查项目 | 执行结果 | 说明 |
| ---- | ---- | ---- |
| TypeScript | 通过 | `npx vue-tsc --noEmit` |
| ESLint | 未执行 | |
| 人工验证 | 未验证 | 需在有报告数据的任务下查看作战方案页 |

## 5.11 展示规则（2026-11-25 补充）

- 不展示 `warnings` / `caliber` / `selfCheck`。
- `stages` 按 scheme.code 前缀（`P1-T1` → `P1`）匹配，展示于单格底部三档对比。
- 全部 `schemes` 平铺展示；页底为跨方案指标对比表。
- 单格结构：上综合 → 中列表（配额/选星）→ 下对比（同 stage 三档）。

## 5.12 已知问题

- `stages` 内 counterfactual、residualCurve 等仍未单独可视化。