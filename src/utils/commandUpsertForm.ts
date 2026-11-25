import {
  COMMAND_OWN_COUNTRY_FIXED,
  normalizeCommandEnemyCountries,
} from '@/constants/commandForm'
import type { CommandForm, CommandUpsertPayload } from '@/types/command/command'

/**
 * 新建命令表单的默认空值（对齐 OpenAPI `CommandReq`）。
 */
export const createEmptyCommandUpsertPayload = (): CommandUpsertPayload => ({
  id: undefined,
  name: '',
  code: '',
  source: '',
  stage: '',
  ownCountry: ['中国'],
  enemyCountry: [],
  backGround: '',
  expectation: '',
  expectationOption: '',
  description: '',
})

/**
 * 将列表/详情命令实体转为可编辑提交体。
 *
 * @param command 命令实体
 */
export const commandFormToUpsertPayload = (command: CommandForm): CommandUpsertPayload => ({
  id: command.id,
  name: command.name ?? '',
  code: command.code ?? '',
  source: command.source ?? '',
  stage: command.stage ?? '',
  ownCountry: [COMMAND_OWN_COUNTRY_FIXED],
  enemyCountry: normalizeCommandEnemyCountries(command.enemyCountry),
  backGround: command.backGround ?? '',
  expectation: command.expectation ?? '',
  expectationOption: command.expectationOption ?? '',
  description: command.description ?? '',
})

/**
 * 序列化为 `POST|PUT /api/command` 请求体。
 *
 * @param payload 表单数据
 */
export const serializeCommandUpsertPayload = (payload: CommandUpsertPayload): CommandUpsertPayload => {
  const idRaw = payload.id != null ? String(payload.id).trim() : ''
  return {
    id: idRaw || undefined,
    name: payload.name.trim(),
    code: payload.code?.trim() ?? '',
    source: payload.source?.trim() ?? '',
    stage: payload.stage?.trim() ?? '',
    ownCountry: [COMMAND_OWN_COUNTRY_FIXED],
    enemyCountry: normalizeCommandEnemyCountries(payload.enemyCountry),
    backGround: payload.backGround?.trim() ?? '',
    expectation: payload.expectation?.trim() ?? '',
    expectationOption: payload.expectationOption?.trim() ?? '',
    description: payload.description?.trim() ?? '',
  }
}

/**
 * 从创建接口 `data` 解析新命令 id（字符串或数字）。
 *
 * @param data 接口 `data`
 */
export const resolveCreatedCommandId = (data: unknown): string | undefined => {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (typeof data === 'number' && Number.isFinite(data)) return String(data)
  return undefined
}