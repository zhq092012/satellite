# 战场 REST 接口迁移（Rust 风格）

## 需求概述

前端战场增删改查与列表统一为 `/api/battle` 资源风格，废弃 `/api/battle/save|update|del/*`。

## 创建/修改请求体

仅 `name`、`description`；修改时带 `id`。类型：`BattleUpsertPayload`（`src/types/battle/battle.ts`）。

## 新接口（前端 `src/api/battle/battle.ts`）

| 方法 | 路径 | 函数 |
| --- | --- | --- |
| GET | `/api/battle/list` | `getBattleList` |
| GET | `/api/battle/{id}` | `getBattleById` |
| POST | `/api/battle` | `createBattle` |
| PUT | `/api/battle` | `updateBattle` |
| DELETE | `/api/battle/{id}` | `deleteBattle` |

均经 `requestAPI`，自动携带 `Authorization: Bearer <token>`。

## 已删除（`src/api/dashboard/index.ts`）

- `POST /api/battle/save`
- `PUT /api/battle/update`
- `DELETE /api/battle/del/{id}`
- 原 `getBattleList` 实现（路径不变，模块迁至 battle）

## 调用方更新

- `BattleManage.vue`：`createBattle` 替代 `saveBattle`
- `SceneEditDialog.vue`：同上
- `Dashboard.vue`：从 `@/api/battle/battle` 引 `getBattleList`

任务、打击方案等仍使用 `dashboard` / `task` 下既有 `/api/battle/*` 子路径，本次未改。

## 测试

- `npx vue-tsc --noEmit`：通过