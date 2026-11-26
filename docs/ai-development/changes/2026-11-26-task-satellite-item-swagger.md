# 任务查询 SatelliteItem 与挂载资源字段对齐

## 需求概述

从 `http://192.168.52.72:34127/v3/api-docs` 拉取最新 OpenAPI。任务查询/资源接口的卫星挂载项改为 `SatelliteItem`（含 `country`、`satelliteType`、`series`），前端在任务回显、C2 右侧列表与资源接口映射中填充这些字段。

## 接口与类型

| OpenAPI | 前端类型 |
| --- | --- |
| `CommandTaskResp.satellites[]` → `SatelliteItem` | `TaskResourceSatelliteItem` |
| `CommandTaskResourceResp` | `BattleTaskResourceResp` |
| `StationItem` | `TaskResourceStationItem`（`id` → `resourceId`） |
| `WeaponItem` | `TaskResourceWeaponItem` |

快照：`src/types/task/openapi-snapshot.json`、根目录 `.cursor-api-docs.json`。

## 主要变更

| 文件 | 说明 |
| --- | --- |
| `src/types/task/task.d.ts` | 卫星/站/武器挂载类型与 OpenAPI 对齐 |
| `src/utils/taskEntity.ts` | `mapSatelliteItemFromApi`、`normalizeTaskFromApi` |
| `src/api/task/task.ts` | `getTaskResources` 归一化 |
| `src/utils/buildC2ResourceCatalog.ts` | resources 行与 catalog 回退使用接口元数据 |
| `src/utils/taskSatelliteTreeBridge.ts` | 回显 meta、资源库 → 任务项带元数据 |
| `TaskAssembleTab.vue` / `C2LeftControlPanel.vue` | 任务回显列表展示国家/类型/系列 |

## 测试

| 检查 | 结果 |
| --- | --- |
| vue-tsc | 任务相关文件通过（仓库另有无关历史错误） |