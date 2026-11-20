# 计算-威胁度/打击度/算法列表

## 需求概述

按 OpenAPI `/api/compute/*` 重构威胁度分析、打击度分析、已注册算法列表三个页面，移除 matrix/mock 数据源。

## API

| 方法 | 路径 | 函数 |
| --- | --- | --- |
| GET | `/api/compute/algorithms` | `listRegisteredComputeAlgorithms` |
| GET | `/api/compute/threat/{taskId}` | `getThreatAnalysis` |
| GET | `/api/compute/strike/{taskId}` | `getStrikeAnalysis` |

## 主要变更

- `src/types/threat/index.d.ts`：新增 `ThreatRow`、`ThreatResp`、`AlgorithmInfo` 等；保留旧 `ThreatWeight` 供 SatelliteProfile。
- `src/types/strike/index.d.ts`：新增 `ComputeStrikeRow`、`StrikeResp`；保留仿真用 `StrikeV2` 等。
- 删除 `buildHomeThreatAnalysisTable.ts`、`buildHomeAttackAnalysisTable.ts`（mock/matrix 构建）。
- 顶栏新增「算法列表」路由 `/home/algorithms`；「攻击度分析」改名为「打击度分析」。

## 测试

- `vue-tsc -p tsconfig.app.json`：通过