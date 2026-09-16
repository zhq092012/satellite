import type { LevelSeriesEntity, SatelliteAnalysisData, VisibilityWindow } from '@/api/task/task'
import type { MatrixResult } from '@/api/electronic'
import {
  collectSeriesTransmissionLinks,
  parseTimeToMs,
  type ChainNode,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'
import { parseFeedbackTimestamp } from '@/utils/zhchPlanDisplay'

/** 链路表格默认展示条数 */
export const LINK_CHAIN_TOP_COUNT = 10

/** 链路表格行 */
export interface LinkChainTableRow {
  /** 行唯一标识 */
  id: string
  /** 链路路径文本，如 卫星A->中继B->地面站C->数据中心D */
  chainText: string
  /** 开始时间 */
  beginTime: string
  /** 结束时间 */
  endTime: string
  /** 开始时间毫秒（排序用） */
  beginTimeMs: number
  /** 结束时间毫秒（排序用） */
  endTimeMs: number
  /** 是否经过中继 */
  hasRelay: boolean
  /** 所属系列 */
  series: string
}

/**
 * 将毫秒时间戳格式化为 `yyyy-MM-dd HH:mm:ss`。
 *
 * @param ms 毫秒时间戳
 * @returns 格式化后的时间文本
 */
const formatTimestampMs = (ms: number): string => {
  if (!ms) return '--'
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 判断两个时间窗口是否重叠。
 *
 * @param window 可见窗口
 * @param start 对比开始时间
 * @param end 对比结束时间
 * @returns 是否重叠
 */
const visibilityWindowOverlaps = (window: VisibilityWindow, start: string, end: string): boolean => {
  const windowStart = parseTimeToMs(window.beginWindow)
  const windowEnd = parseTimeToMs(window.endWindow || window.beginWindow)
  const compareStart = parseTimeToMs(start)
  const compareEnd = parseTimeToMs(end || start)
  if (!windowStart || !compareStart) return false
  return windowStart <= compareEnd && compareStart <= windowEnd
}

/**
 * 将链路节点序列格式化为展示文本。
 *
 * @param nodes 链路节点
 * @returns 链路路径文本
 */
export const formatChainPathText = (nodes: ChainNode[]): string => {
  return nodes.map((node) => node.name).join('->')
}

/**
 * 从 VisibilityWindow 列表中选取与地面窗口重叠的第一条。
 *
 * @param windows 可见窗口列表
 * @param groundStart 地面过境开始时间
 * @param groundEnd 地面过境结束时间
 * @returns 匹配的可见窗口
 */
const pickOverlappingVisibilityWindow = (
  windows: VisibilityWindow[] | null | undefined,
  groundStart: string,
  groundEnd: string
): VisibilityWindow | null => {
  return (windows || []).find((window) => visibilityWindowOverlaps(window, groundStart, groundEnd)) || null
}

/**
 * 解析单条链路的开始/结束时间，优先使用 VisibilityWindow。
 *
 * 规则：
 * 1. 中继链路：优先取卫星->中继的 visibilityWindows
 * 2. 接收站->数据中心：取 initRelationList 中重叠的 visibilityWindows
 * 3. 直连链路：回退到卫星->地面站 initWindows（peakWindow/endWindow）
 *
 * @param entity 系列矩阵实体
 * @param link 传输链路
 * @returns 开始/结束时间
 */
const resolveLinkWindowTimes = (
  entity: LevelSeriesEntity,
  link: SatelliteTransmissionLink
): { beginTime: string; endTime: string } => {
  const groundStart = formatTimestampMs(link.transmitStartMs)
  const groundEnd = formatTimestampMs(link.transmitEndMs)

  const satNode = link.nodes.find((node) => node.layer === 'SAT')
  const receiveNode = link.nodes.find((node) => node.layer === 'RECEIVE')
  const stationNode = link.nodes.find((node) => node.layer === 'STATION')
  const hasRelay = link.nodes.some((node) => node.layer === 'RELAY')
  const norad = satNode ? Number(satNode.id) : NaN

  const relayRelation = (entity.relayRelation?.relations || []).find((rel) => Number(rel.from) === norad)
  const stationRelation = (entity.initRelationList?.relations || []).find(
    (rel) => receiveNode && stationNode && rel.from === receiveNode.id && rel.to === stationNode.id
  )

  if (hasRelay && relayRelation) {
    const relayWindow = pickOverlappingVisibilityWindow(
      relayRelation.visibilityWindows,
      groundStart,
      groundEnd
    )
    if (relayWindow) {
      return {
        beginTime: relayWindow.beginWindow || '--',
        endTime: relayWindow.endWindow || relayWindow.beginWindow || '--',
      }
    }
  }

  const stationWindow = pickOverlappingVisibilityWindow(
    stationRelation?.visibilityWindows,
    groundStart,
    groundEnd
  )
  if (stationWindow) {
    return {
      beginTime: stationWindow.beginWindow || '--',
      endTime: stationWindow.endWindow || stationWindow.beginWindow || '--',
    }
  }

  return {
    beginTime: groundStart,
    endTime: groundEnd,
  }
}

/**
 * 将单条传输链路转换为表格行。
 *
 * @param entity 系列矩阵实体
 * @param link 传输链路
 * @param index 序号
 * @returns 链路表格行
 */
const toLinkChainRow = (
  entity: LevelSeriesEntity,
  link: SatelliteTransmissionLink,
  index: number
): LinkChainTableRow => {
  const { beginTime, endTime } = resolveLinkWindowTimes(entity, link)
  const beginTimeMs = parseFeedbackTimestamp(beginTime) ?? link.transmitStartMs ?? Number.MAX_SAFE_INTEGER
  const endTimeMs = parseFeedbackTimestamp(endTime) ?? link.transmitEndMs ?? Number.MAX_SAFE_INTEGER

  return {
    id: `${entity.series || 'series'}-${link.id}-${index}`,
    chainText: formatChainPathText(link.nodes),
    beginTime,
    endTime,
    beginTimeMs,
    endTimeMs,
    hasRelay: link.nodes.some((node) => node.layer === 'RELAY'),
    series: entity.series || '',
  }
}

/**
 * 从任务分析结果汇总各系列通信链路，并按开始时间升序排序。
 *
 * 链路组装逻辑复用 `collectSeriesTransmissionLinks`：
 * - 从 initMatrixList 取卫星并剔除 relayRelation.relayList 中的中继星
 * - 区分卫星->中继->地面站->数据中心 与 卫星->地面站->数据中心
 * - 接收站->数据中心关系来自 initRelationList（打击前）
 *
 * @param data 任务算法分析结果
 * @returns 链路表格行
 */
export const buildLinkChainTableRows = (
  data: SatelliteAnalysisData | null | undefined
): LinkChainTableRow[] => {
  if (!data) return []

  const rows: LinkChainTableRow[] = []
  let index = 0

  ;(data.levelSeriesEntities || []).forEach((entity) => {
    if (!entity) return

    const links = collectSeriesTransmissionLinks(entity as MatrixResult)
    links.forEach((link) => {
      rows.push(toLinkChainRow(entity, link, index))
      index += 1
    })
  })

  return rows.sort((a, b) => {
    if (a.beginTimeMs !== b.beginTimeMs) return a.beginTimeMs - b.beginTimeMs
    return a.chainText.localeCompare(b.chainText, 'zh-CN')
  })
}
