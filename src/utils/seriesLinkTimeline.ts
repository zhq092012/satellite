import type { MatrixResult, ZhchPlanLevelSeriesEntity, ZhchPlanResp } from '@/api/electronic'
import {
  collectSeriesTransmissionLinks,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'
import { parseWindowTimestamp } from '@/utils/tools/matrixAdapter'

/** 单行时间块在轨道中的布局结果 */
export interface SeriesLinkTimelineBlock {
  /** 块唯一标识 */
  id: string
  /** 主展示名称 */
  label: string
  /** 副标题（如系列名、节点类型） */
  subLabel?: string
  /** 窗口开始时间戳（毫秒） */
  startMs: number
  /** 窗口结束时间戳（毫秒） */
  endMs: number
  /** 是否已被打击（true=灰色，false=绿色） */
  struck: boolean
  /** 轨道层级（从 0 起，用于纵向错开重叠块） */
  lane: number
  /** 左侧偏移（像素） */
  leftPx: number
  /** 块宽度（像素） */
  widthPx: number
  /** 悬浮提示标题 */
  tooltipTitle: string
  /** 悬浮提示明细行 */
  tooltipLines: string[]
}

/** 上下行块之间的链路连线 */
export interface SeriesLinkTimelineConnection {
  /** 连线唯一标识 */
  id: string
  /** 上行块 id */
  topBlockId: string
  /** 下行块 id */
  bottomBlockId: string
  /** 起点 X（像素，相对轨道区域） */
  x1: number
  /** 起点 Y（像素） */
  y1: number
  /** 终点 X（像素） */
  x2: number
  /** 终点 Y（像素） */
  y2: number
}

/** 单个卫星系列的通断时序分组 */
export interface SeriesLinkTimelineGroup {
  /** 系列名称 */
  series: string
  /** 上行（卫星）时间块 */
  topBlocks: SeriesLinkTimelineBlock[]
  /** 下行（地面站/中继）时间块 */
  bottomBlocks: SeriesLinkTimelineBlock[]
  /** 链路连线 */
  connections: SeriesLinkTimelineConnection[]
  /** 上行轨道总高度（像素） */
  topTrackHeight: number
  /** 下行轨道总高度（像素） */
  bottomTrackHeight: number
  /** 分组总高度（像素，含两行与间距） */
  groupHeight: number
}

/** 方案级通断时序模型 */
export interface PlanLinkTimelineModel {
  /** 时间轴起点（毫秒） */
  minMs: number
  /** 时间轴终点（毫秒） */
  maxMs: number
  /** 画布总宽度（像素） */
  canvasWidth: number
  /** 按系列划分的时序分组 */
  groups: SeriesLinkTimelineGroup[]
}

/** 单行轨道布局常量 */
export const LANE_HEIGHT = 14
export const LANE_GAP = 4
export const ROW_PADDING = 6
export const ROW_GAP = 30
export const MIN_BLOCK_WIDTH = 10
export const MIN_CANVAS_WIDTH = 960
/** 每分钟对应像素宽度 */
export const PX_PER_MINUTE = 3
/** 同一层中两个块之间的最小水平像素间隙 */
export const MIN_GAP_PX = 4

interface RawTimelineBlock {
  id: string
  label: string
  subLabel?: string
  startMs: number
  endMs: number
  struck: boolean
  tooltipTitle: string
  tooltipLines: string[]
}

/**
 * 将系列实体转为矩阵结构，供链路分析复用。
 *
 * @param entity 综合打击方案中的系列实体
 * @returns 与 MatrixResult 兼容的矩阵对象
 */
export const levelSeriesEntityToMatrix = (entity: ZhchPlanLevelSeriesEntity): MatrixResult => {
  return entity as unknown as MatrixResult
}

/**
 * 格式化毫秒时间戳为展示文本。
 *
 * @param ms 毫秒时间戳
 * @returns `YYYY-MM-DD HH:mm:ss` 或 `--`
 */
export const formatTimelineMs = (ms: number): string => {
  if (!ms) return '--'
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '--'
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${d} ${h}:${m}:${s}`
}

/**
 * 根据时间跨度计算画布宽度。
 *
 * @param minMs 起点毫秒
 * @param maxMs 终点毫秒
 * @returns 画布像素宽度
 */
const resolveCanvasWidth = (minMs: number, maxMs: number): number => {
  const minutes = Math.max((maxMs - minMs) / 60000, 1)
  return Math.max(MIN_CANVAS_WIDTH, Math.ceil(minutes * PX_PER_MINUTE))
}

/**
 * 为同一行的时间块分配轨道并计算像素坐标。
 * 当两个链路时间重叠或在屏幕像素上紧挨挤压时，自动错开分配到下一层（Lane+1），避免重叠堆叠。
 *
 * @param blocks 原始块列表
 * @param minMs 时间轴起点
 * @param maxMs 时间轴终点
 * @param canvasWidth 画布宽度
 * @returns 带布局的时间块
 */
const layoutBlocks = (
  blocks: RawTimelineBlock[],
  minMs: number,
  maxMs: number,
  canvasWidth: number
): SeriesLinkTimelineBlock[] => {
  const range = Math.max(maxMs - minMs, 1)
  // 按开始时间排序，开始时间相同时按结束时间排序
  const sorted = [...blocks].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs || a.id.localeCompare(b.id))

  // 记录每个 lane 的当前结束时间戳与右边界像素
  const laneStates: Array<{ endMs: number; rightPx: number }> = []

  return sorted.map((block) => {
    const leftPx = ((block.startMs - minMs) / range) * canvasWidth
    const widthPx = Math.max(((block.endMs - block.startMs) / range) * canvasWidth, MIN_BLOCK_WIDTH)
    const rightPx = leftPx + widthPx

    // 寻找能够容纳当前块的层（既满足时间不重叠，又满足像素上有安全间隙）
    let lane = laneStates.findIndex(
      (state) => state.endMs <= block.startMs && state.rightPx + MIN_GAP_PX <= leftPx
    )

    if (lane === -1) {
      // 存在时间重叠或像素挤压，自动错开往下一层
      lane = laneStates.length
      laneStates.push({ endMs: block.endMs, rightPx })
    } else {
      // 放入该层，更新该层的占用状态
      laneStates[lane] = { endMs: block.endMs, rightPx }
    }

    return {
      ...block,
      lane,
      leftPx,
      widthPx,
    }
  })
}

/**
 * 计算单行轨道高度。
 *
 * @param blocks 已布局块
 * @returns 轨道高度（像素）
 */
export const trackHeightFromBlocks = (blocks: SeriesLinkTimelineBlock[]): number => {
  if (!blocks.length) return LANE_HEIGHT + ROW_PADDING * 2
  const maxLane = Math.max(...blocks.map((item) => item.lane))
  return ROW_PADDING * 2 + (maxLane + 1) * LANE_HEIGHT + maxLane * LANE_GAP
}

/**
 * 从单条传输链路提取上下行原始块。
 *
 * @param link 传输链路
 * @param series 系列名称
 * @returns 上行块与下行块；无法解析时返回 null
 */
const buildBlocksFromLink = (
  link: SatelliteTransmissionLink,
  series: string
): { top: RawTimelineBlock; bottom: RawTimelineBlock } | null => {
  const satNode = link.nodes.find((node) => node.layer === 'SAT')
  const relayNode = link.nodes.find((node) => node.layer === 'RELAY')
  const receiveNode = link.nodes.find((node) => node.layer === 'RECEIVE')
  const bottomNode = relayNode ?? receiveNode

  if (!satNode || !bottomNode) return null

  const startMs = link.transmitStartMs
  const endMs = link.transmitEndMs || link.transmitStartMs
  if (!startMs || endMs < startMs) return null

  const timeLine = `${formatTimelineMs(startMs)} ~ ${formatTimelineMs(endMs)}`
  const topStruck = !!link.satelliteStruck
  const bottomStruck = relayNode ? !!link.relayStruck : !!link.receiveStruck

  const top: RawTimelineBlock = {
    id: `${link.id}-top`,
    label: satNode.name,
    subLabel: series,
    startMs,
    endMs,
    struck: topStruck,
    tooltipTitle: `${satNode.name} (${series})`,
    tooltipLines: [
      `过境：${timeLine}`,
      `链路：${link.receiveName}`,
      `状态：${topStruck ? '已打击' : '正常'}`,
      link.weaponNames && topStruck ? `武器：${link.weaponNames}` : '',
    ].filter(Boolean),
  }

  const bottom: RawTimelineBlock = {
    id: `${link.id}-bottom`,
    label: bottomNode.name,
    subLabel: relayNode ? '中继卫星' : '地面站',
    startMs,
    endMs,
    struck: bottomStruck || (!topStruck && link.struck),
    tooltipTitle: bottomNode.name,
    tooltipLines: [
      `过境：${timeLine}`,
      `类型：${relayNode ? '中继卫星' : '地面接收站'}`,
      `状态：${bottomStruck || link.struck ? '已打击' : '正常'}`,
      link.delayMin ? `延迟：+${link.delayMin} 分钟` : '',
    ].filter(Boolean),
  }

  return { top, bottom }
}

/**
 * 构建单个系列的通断时序分组。
 *
 * @param entity 系列实体
 * @param minMs 全局时间起点
 * @param maxMs 全局时间终点
 * @param canvasWidth 画布宽度
 * @returns 系列时序分组
 */
const buildSeriesGroup = (
  entity: ZhchPlanLevelSeriesEntity,
  minMs: number,
  maxMs: number,
  canvasWidth: number
): SeriesLinkTimelineGroup => {
  const matrix = levelSeriesEntityToMatrix(entity)
  const links = collectSeriesTransmissionLinks(matrix)

  const topRaw: RawTimelineBlock[] = []
  const bottomRaw: RawTimelineBlock[] = []
  const pairMeta: Array<{ topId: string; bottomId: string; linkId: string }> = []

  links.forEach((link) => {
    const pair = buildBlocksFromLink(link, entity.series)
    if (!pair) return
    topRaw.push(pair.top)
    bottomRaw.push(pair.bottom)
    pairMeta.push({ topId: pair.top.id, bottomId: pair.bottom.id, linkId: link.id })
  })

  const topBlocks = layoutBlocks(topRaw, minMs, maxMs, canvasWidth)
  const bottomBlocks = layoutBlocks(bottomRaw, minMs, maxMs, canvasWidth)
  const topTrackHeight = trackHeightFromBlocks(topBlocks)
  const bottomTrackHeight = trackHeightFromBlocks(bottomBlocks)

  const topMap = new Map(topBlocks.map((item) => [item.id, item]))
  const bottomMap = new Map(bottomBlocks.map((item) => [item.id, item]))

  const connections: SeriesLinkTimelineConnection[] = pairMeta
    .map((pair) => {
      const top = topMap.get(pair.topId)
      const bottom = bottomMap.get(pair.bottomId)
      if (!top || !bottom) return null

      const x1 = top.leftPx + top.widthPx / 2
      const x2 = bottom.leftPx + bottom.widthPx / 2
      const y1 = ROW_PADDING + top.lane * (LANE_HEIGHT + LANE_GAP) + LANE_HEIGHT
      const y2 = topTrackHeight + ROW_GAP + ROW_PADDING + bottom.lane * (LANE_HEIGHT + LANE_GAP)

      return {
        id: pair.linkId,
        topBlockId: top.id,
        bottomBlockId: bottom.id,
        x1,
        y1,
        x2,
        y2,
      }
    })
    .filter(Boolean) as SeriesLinkTimelineConnection[]

  return {
    series: entity.series,
    topBlocks,
    bottomBlocks,
    connections,
    topTrackHeight,
    bottomTrackHeight,
    groupHeight: topTrackHeight + ROW_GAP + bottomTrackHeight,
  }
}

/**
 * 从综合打击方案构建完整的系列链路通断时序模型。
 *
 * @param plan 综合打击方案
 * @param taskBeginDate 任务开始日期（用于时间解析兜底）
 * @param taskEndDate 任务结束日期（用于时间解析兜底）
 * @returns 时序模型；无系列或无链路时 groups 为空
 */
export const buildPlanLinkTimelineModel = (
  plan: ZhchPlanResp,
  taskBeginDate?: string,
  taskEndDate?: string
): PlanLinkTimelineModel => {
  const entities = plan.levelSeriesEntities || []
  const fallbackBeginSec = taskBeginDate
    ? parseWindowTimestamp(taskBeginDate, Math.floor(Date.now() / 1000))
    : Math.floor(Date.now() / 1000)
  const fallbackEndSec = taskEndDate
    ? parseWindowTimestamp(taskEndDate, fallbackBeginSec)
    : fallbackBeginSec + 86400

  const allMs: number[] = []
  entities.forEach((entity) => {
    const matrix = levelSeriesEntityToMatrix(entity)
    collectSeriesTransmissionLinks(matrix).forEach((link) => {
      allMs.push(link.transmitStartMs, link.transmitEndMs || link.transmitStartMs)
    })
  })

  let minMs = allMs.length ? Math.min(...allMs) : fallbackBeginSec * 1000
  let maxMs = allMs.length ? Math.max(...allMs) : fallbackEndSec * 1000
  if (maxMs <= minMs) maxMs = minMs + 3600000

  const padding = Math.max((maxMs - minMs) * 0.02, 60000)
  minMs -= padding
  maxMs += padding

  const canvasWidth = resolveCanvasWidth(minMs, maxMs)
  const groups = entities.map((entity) => buildSeriesGroup(entity, minMs, maxMs, canvasWidth))

  return { minMs, maxMs, canvasWidth, groups }
}

/**
 * 生成时间轴刻度标签。
 *
 * @param minMs 起点毫秒
 * @param maxMs 终点毫秒
 * @param tickCount 期望刻度数
 * @returns 刻度数组
 */
export const buildTimelineTicks = (
  minMs: number,
  maxMs: number,
  tickCount = 8
): Array<{ ms: number; leftPx: number; label: string }> => {
  const range = Math.max(maxMs - minMs, 1)
  const canvasWidth = resolveCanvasWidth(minMs, maxMs)
  const step = range / Math.max(tickCount - 1, 1)
  const ticks: Array<{ ms: number; leftPx: number; label: string }> = []

  for (let i = 0; i < tickCount; i += 1) {
    const ms = minMs + step * i
    ticks.push({
      ms,
      leftPx: ((ms - minMs) / range) * canvasWidth,
      label: formatTimelineMs(ms).slice(11, 16),
    })
  }

  return ticks
}
