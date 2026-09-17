import type { SatelliteAnalysisData } from '@/api/task/task'
import {
  buildBattleGlobeGroundTargets,
  buildGroundTargetKey,
  parseReceiveLatLonString,
  type BattleGlobeGroundTargetKind,
} from '@/utils/buildBattleGlobeGroundTargets'

/** 接收站/数据中心表格行基类 */
export interface GroundStationTableRowBase {
  /** 行唯一键（与地图选中键一致） */
  key: string
  /** 目标 ID */
  id: string
  /** 名称 */
  name: string
  /** 状态码：0 正常，1 被打击 */
  status: number
  /** 状态展示文本 */
  statusText: string
  /** 经纬度展示文本 */
  latLonText: string
  /** 是否被打击（status=1） */
  struck: boolean
}

/** 接收站表格行 */
export interface ReceiveStationTableRow extends GroundStationTableRowBase {
  /** 用途 */
  usage: string
}

/** 数据中心表格行 */
export interface DataCenterTableRow extends GroundStationTableRowBase {}

/**
 * 格式化地面站状态文本。
 *
 * @param status 状态码
 * @returns 展示文本
 */
export const formatGroundStationStatusText = (status: number): string =>
  status === 1 ? '被打击' : '正常'

/**
 * 格式化经纬度展示。
 *
 * @param latitude 纬度
 * @param longitude 经度
 * @returns 展示文本
 */
export const formatGroundStationLatLonText = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`

/**
 * 从任务分析结果构建接收站表格行。
 *
 * @param data 任务分析数据
 * @returns 接收站表格行（按名称排序）
 */
export const buildReceiveStationTableRows = (
  data: SatelliteAnalysisData | null | undefined
): ReceiveStationTableRow[] => {
  const rows = buildBattleGlobeGroundTargets(data)
    .filter((item) => item.kind === 'receive')
    .map((item) => ({
      key: buildGroundTargetKey('receive', item.id),
      id: item.id,
      name: item.name,
      status: item.status,
      statusText: formatGroundStationStatusText(item.status),
      latLonText: formatGroundStationLatLonText(item.latitude, item.longitude),
      struck: item.status === 1,
      usage: item.usage || '--',
    }))

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

/**
 * 从任务分析结果构建数据中心表格行。
 *
 * @param data 任务分析数据
 * @returns 数据中心表格行（按名称排序）
 */
export const buildDataCenterTableRows = (
  data: SatelliteAnalysisData | null | undefined
): DataCenterTableRow[] => {
  const rows = buildBattleGlobeGroundTargets(data)
    .filter((item) => item.kind === 'station')
    .map((item) => ({
      key: buildGroundTargetKey('station', item.id),
      id: item.id,
      name: item.name,
      status: item.status,
      statusText: formatGroundStationStatusText(item.status),
      latLonText: formatGroundStationLatLonText(item.latitude, item.longitude),
      struck: item.status === 1,
    }))

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

/**
 * 根据选中键解析目标类型（表格行校验用）。
 *
 * @param key 选中键
 * @returns 目标类型或 null
 */
export const resolveGroundTargetKindFromKey = (
  key: string | null | undefined
): BattleGlobeGroundTargetKind | null => {
  if (!key) return null
  if (key.startsWith('receive:')) return 'receive'
  if (key.startsWith('station:')) return 'station'
  return null
}

/**
 * 校验关系列表中的经纬度是否可解析（调试/测试辅助）。
 *
 * @param latLon 经纬度字符串
 * @returns 是否有效
 */
export const isValidGroundStationLatLon = (latLon?: string | null): boolean =>
  parseReceiveLatLonString(latLon) != null
