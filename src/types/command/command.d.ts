import type { TaskForm } from '@/api/task/task'

/**
 * 作战命令实体（OpenAPI `CommandResp`；列表、详情及 Store 当前命令）。
 */
export interface CommandForm {
  /** 作战命令 id（接口多为 MongoDB 字符串） */
  id?: string | number
  /** 命令名称 */
  name: string
  /** 描述 */
  description?: string
  /** 命令编码（OpenAPI `code`） */
  code?: string
  /** 命令来源（OpenAPI `source`） */
  source?: string
  /** 作战阶段（OpenAPI `stage`） */
  stage?: string
  /** 我方国家/地区列表 */
  ownCountry?: string[]
  /** 敌方国家/地区列表（作战对象） */
  enemyCountry?: string[]
  /** 作战背景（OpenAPI `backGround`） */
  backGround?: string
  /** 作战预期 */
  expectation?: string
  /** 作战预期选项（二级） */
  expectationOption?: string
  /** 数据刷新频率（历史列表字段，接口未必返回） */
  dataRefreshRate?: string
  /** 关联任务数 */
  taskCount?: number
  /** 创建时间（历史字段） */
  createTime?: string
  /** 更新时间 */
  updateTime?: string
  /**
   * 命令管理页展开卡片时由前端写入的任务列表，非接口字段。
   */
  tasks?: TaskForm[] | null
}

/**
 * 新建或修改作战命令时提交给后端的请求体（OpenAPI `CommandReq`）。
 */
export interface CommandUpsertPayload {
  /** 命令 id（编辑必填；新增传空字符串或不传） */
  id?: string | number
  /** 命令名称（必填） */
  name: string
  /** 命令编码 */
  code?: string
  /** 命令来源 */
  source?: string
  /** 作战阶段 */
  stage?: string
  /** 我方所属国家/地区 */
  ownCountry?: string[]
  /** 敌方所属国家/地区（作战对象） */
  enemyCountry?: string[]
  /** 作战背景 */
  backGround?: string
  /** 作战预期 */
  expectation?: string
  /** 作战预期选项（二级） */
  expectationOption?: string
  /** 描述 */
  description?: string
}