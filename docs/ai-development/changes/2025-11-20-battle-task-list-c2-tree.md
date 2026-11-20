# 战场任务列表与 C2 资源树（任务卫星反查）

## 需求概述

- 进入场景管理（战场列表）时拉取 `/api/battle-task/list` 填充各场景任务表。
- 首页顶栏切换场景时同步任务列表，左侧面板展示任务下拉并切换激活任务。
- 左侧面板卫星树：根据任务 `satellites` 调用资源树接口，裁剪为「国家 → 体系 → 系列 → 卫星」并默认勾选任务内卫星。

## 文件变更

| 文件 | 变更 |
| --- | --- |
| `src/utils/taskEntity.ts` | 新增 `normalizeTaskListFromApi` |
| `src/utils/satelliteResourceTree.ts` | 裁剪树 `pruneSatelliteResourceTreeByTaskSatellites` |
| `src/utils/buildC2ResourceCatalog.ts` | 资源树扁平行/节点、`filter` 支持卫星叶子 |
| `src/components/BattleSituation/C2LeftControlPanel.vue` | 任务列表 UI、资源树加载与回显勾选 |
| `src/views/admin/BattleManage.vue` | 进入列表即拉首场景任务；列表数据规范化 |
| `src/layout/Dashboard.vue` | 切换场景规范化任务；默认场景+任务初始化 |

## 测试

| 项目 | 结果 |
| --- | --- |
| vue-tsc | 通过 |
| 人工验证 | 未执行 |