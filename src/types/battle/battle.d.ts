import type { TaskForm } from '@/api/task/task'

/**
 * 战场实体（列表、详情及 Store 中的当前战场）。
 */
export interface BattleForm {
  /** 战场 ID（接口多为 MongoDB 字符串，历史数据可能为数字） */
  id?: string | number
  /** 战场名称 */
  name: string
  /** 战场描述 */
  description: string
  /** 数据刷新频率（列表字段） */
  dataRefreshRate?: string
  /** 关联任务数（列表字段） */
  taskCount?: number
  /** 创建时间（列表字段） */
  createTime?: string
  /** 更新时间（列表字段） */
  updateTime?: string
  /**
   * 场景管理页展开卡片时由前端写入的任务列表，非创建/修改战场接口字段。
   */
  tasks?: TaskForm[] | null
}

/**
 * 新建或修改战场时提交给后端的请求体，仅包含名称与描述。
 */
export interface BattleUpsertPayload {
  /** 修改时必填 */
  id?: string | number
  /** 战场名称 */
  name: string
  /** 战场描述 */
  description: string
}