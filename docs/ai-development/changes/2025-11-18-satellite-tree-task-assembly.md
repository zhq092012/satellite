# 卫星资源树与任务 satellites 装配

## 需求概述

任务编辑/新增时，卫星配置改为调用 `GET /api/resource/satellite/tree`，按 **国家 → 体系 → 系列 → 卫星** 展示并勾选叶子节点；提交的 `satellites` 为 `{ resourceId, name, code }`，不再按系列名占位装配。

## 文件变更清单

| 文件路径 | 变更类型 | 修改内容 |
| --- | --- | --- |
| `src/api/satellite/satellite.ts` | 修改 | `getSatelliteResourceTree(countries)` |
| `src/types/satellite/satellite.d.ts` | 修改 | 树节点与叶子类型 |
| `src/utils/satelliteResourceTree.ts` | 新增 | 树转 `el-tree`、叶子 → `TaskResourceItem` |
| `src/components/BattleSituation/TaskAssembleTab.vue` | 修改 | 树上方可选、下方已选表；暴露 `getAssembledTaskSatellites` / `setAssembledTaskSatellites` |
| `src/components/BattleSituation/TaskEditDialog.vue` | 修改 | 提交与回显使用卫星实体列表 |

## 业务流程

1. 基本信息中选择蓝方国家与卫星类型（侦察/通信）。
2. 卫星配置页根据 `enemyCountries`、`targetTypes` 请求树并过滤体系。
3. 勾选叶子 → `assembledTaskSatellites` → 已选表格。
4. 保存任务 → `buildAddTaskPayload.satellites` 为勾选列表。

## 测试记录

| 检查项目 | 执行结果 | 说明 |
| --- | --- | --- |
| vue-tsc | 通过 | `npx vue-tsc --noEmit -p tsconfig.app.json` |

## 已知问题

- C2 左侧面板仍使用系列接口预览，与任务 `satellites` 字段逻辑独立。
- 编辑回显须在树加载完成后 `setCheckedKeys`，依赖 `loadSatelliteTree` 结束后的 `restoreSatelliteTreeCheckedFromTaskSatellites`。