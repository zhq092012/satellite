# 战场任务 REST 接口迁移（`/api/battle-task`）

## 需求概述

任务 CRUD 从 `/api/battle/saveTask` 等旧路径迁至 Rust 风格 `/api/battle-task`；任务与战场仅保留 `battleId` 关联，移除嵌套 `battleEntity`。

## 新接口（`src/api/task/task.ts`）

| 方法 | 路径 | 函数 |
| --- | --- | --- |
| GET | `/api/battle-task/list?battleId=` | `getTaskList(battleId)` |
| GET | `/api/battle-task/{id}` | `getTaskById(taskId)` |
| POST | `/api/battle-task` | `createTask(task)` |
| PUT | `/api/battle-task` | `updateTask(task)` |
| DELETE | `/api/battle-task/{id}` | `deleteTask(taskId)` |

均经 `requestAPI`，自动携带 Bearer Token。

## 已删除（`src/api/dashboard/index.ts`）

- `POST /api/battle/saveTask`（`createTask`）
- `PUT /api/battle/updateTask`
- `DELETE /api/battle/delTask/{id}`
- `GET /api/battle/taskList`

已删除 `addTask`（`task.ts` 中旧实现）。

## 类型

- 唯一任务类型：`TaskForm`（`src/api/task/task.ts`，由原 `TaskFormNew` 更名）。
- 已删除 `@/types/dashboard` 中的 `TaskForm`；附带 `TaskResourceItem`、`TaskCombatArea`、`TaskArea` 等同文件导出。

## 调用方

- `BattleManage.vue`、`Dashboard.vue`、`C2LeftControlPanel.vue`、`TaskEditDialog.vue` → `@/api/task/task`

## 测试

- `npx vue-tsc --noEmit`：通过