import type {
  MatrixResult,
  StationRelationList,
  Weapon,
  WeaponAttackRecord,
} from '@/api/electronic'

export interface ChainNode {
  layer: 'SAT' | 'RELAY' | 'RECEIVE' | 'STATION'
  id: string
  name: string
  icon: string
}

export interface FullChainResult {
  finishTime: string | null
  finishTimestamp: number | null
  nodes: ChainNode[]
  blocked: boolean
  blockedReason?: string
}

export interface StationPassAnalysis {
  chain: FullChainResult
  delayMin: number
  delayText: string
  currentTime: string
  struck: boolean
}

export interface SatelliteTransmissionLink {
  /** 链路唯一标识 */
  id: string
  /** 全链路节点序列 */
  nodes: ChainNode[]
  /** 地面接收站名称 */
  receiveName: string
  /** 传输时间区间展示 */
  transmitTime: string
  /** 传输开始时间戳（用于排序） */
  transmitStartMs: number
  /** 传输结束时间戳（过境窗口结束） */
  transmitEndMs: number
  /** 地面接收站 ID */
  receiveId: string
  /** 链路完成时间 */
  finishTime: string
  /** 是否被打击 */
  struck: boolean
  /** 卫星是否被打击 */
  satelliteStruck: boolean
  /** 地面站是否被打击 */
  receiveStruck: boolean
  /** 中继卫星是否被打击 */
  relayStruck?: boolean
  /** 打击目标描述（卫星 / 地面站 / 卫星 + 地面站 / 无） */
  strikeTargetLabel: string
  /** 打击武器名称（多个以顿号分隔） */
  weaponNames: string
  /** 武器类型（若唯一） */
  weaponType?: string
  /** 造成延迟（分钟） */
  delayMin: number
  /** 延迟描述 */
  delayText: string
  /** 是否因拓扑缺失而无法完成 */
  blocked?: boolean
  /** 阻断原因 */
  blockedReason?: string
}

export interface NetworkChainStats {
  totalCount: number
  remainingCount: number
  remainingChains: FullChainResult[]
}

export interface JamWeaponRecord {
  weaponName: string
  weaponType?: string
  targetName: string
  targetType: '卫星' | '中继卫星' | '接收站' | '数据中心'
  timeRange: string
  source: 'attackPlan' | 'window' | 'satellite'
}

interface ChainCandidate {
  finishTs: number
  groundStartTs: number
  groundEndTs: number
  nodes: ChainNode[]
}

export const parseTimeToMs = (timeStr: string): number => {
  if (!timeStr) return 0
  const normalized = timeStr.replace(/-/g, '/')
  const ts = new Date(normalized).getTime()
  return Number.isNaN(ts) ? 0 : ts
}

const formatTimestampMs = (ts: number): string => {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export type WindowTimeLike = {
  peakWindow?: string
  startWindow?: string
  beginWindow?: string
  endWindow?: string
}

const getWindowStartStr = (win?: WindowTimeLike | Record<string, any> | null): string =>
  win ? (win as WindowTimeLike).peakWindow || (win as WindowTimeLike).startWindow || (win as WindowTimeLike).beginWindow || '' : ''

const getWindowEndStr = (win?: WindowTimeLike | Record<string, any> | null): string =>
  (win as WindowTimeLike)?.endWindow || ''

const windowsOverlapMs = (startA: string, endA: string, startB: string, endB: string): boolean => {
  const aStart = parseTimeToMs(startA)
  const aEnd = parseTimeToMs(endA || startA)
  const bStart = parseTimeToMs(startB)
  const bEnd = parseTimeToMs(endB || startB)
  if (!aStart || !bStart) return false
  return aStart <= bEnd && bStart <= aEnd
}

const buildSatNameMap = (matrix: MatrixResult): Map<number, string> => {
  const map = new Map<number, string>()
    ; (matrix.initMatrixList || []).forEach((s) => map.set(s.norad, s.name))
    ; (matrix.satelliteMatrixList || []).forEach((s) => map.set(s.norad, s.name))
  return map
}

const getRelationData = (matrix: MatrixResult, usePostStrike: boolean): StationRelationList => {
  if (usePostStrike && matrix.stationRelationList?.relations?.length) {
    return matrix.stationRelationList
  }
  return matrix.initRelationList || { receiveObjList: [], stationObjList: [], relations: [] }
}

const buildReceiveToStations = (
  relationData: StationRelationList,
  usePostStrike: boolean
): Map<string, { stationId: string; stationName: string }[]> => {
  const blockedReceive = new Set(
    (relationData.receiveObjList || []).filter((r) => usePostStrike && r.receiveStatus === 1).map((r) => r.receiveId)
  )
  const blockedStation = new Set(
    (relationData.stationObjList || []).filter((s) => usePostStrike && s.stationStatus === 1).map((s) => s.stationId)
  )
  const stationMap = new Map((relationData.stationObjList || []).map((s) => [s.stationId, s.stationName || s.stationId]))

  const map = new Map<string, { stationId: string; stationName: string }[]>()
    ; (relationData.relations || []).forEach((rel) => {
      if (blockedReceive.has(rel.from) || blockedStation.has(rel.to)) return
      const list = map.get(rel.from) || []
      list.push({
        stationId: rel.to,
        stationName: stationMap.get(rel.to) || rel.to,
      })
      map.set(rel.from, list)
    })
  return map
}

const mergeSatelliteTransitWindows = (initWindows: Record<string, any>[] = [], stationWindows: Record<string, any>[] = []) => {
  const map = new Map<string, Record<string, any>>()
    ;[...initWindows, ...stationWindows].forEach((win) => {
      const key = `${win.receiveId || win.receiveName || ''}-${getWindowStartStr(win)}-${getWindowEndStr(win)}`
      const existing = map.get(key)
      if (!existing || (Number(win.strikeStatus) === 1 && Number(existing.strikeStatus) !== 1)) {
        map.set(key, win)
      }
    })
  return Array.from(map.values())
}

/**
 * 查找观测卫星对应的中继关系
 * @param matrix 算法矩阵
 * @param norad 观测卫星 NORAD
 */
const findRelayRelation = (matrix: MatrixResult, norad: number) =>
  matrix.relayRelation?.relations?.find(
    (r) => Number(r.from) === norad || String(r.from) === String(norad)
  )

/**
 * 合并指定 NORAD 卫星的全部过境窗口
 * @param matrix 算法矩阵
 * @param norad 卫星 NORAD
 */
const getMergedWindowsForNorad = (matrix: MatrixResult, norad: number): Record<string, any>[] => {
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  return mergeSatelliteTransitWindows(
    (initSat?.initWindows || []) as Record<string, any>[],
    (postSat?.stationWindows || []) as Record<string, any>[]
  )
}

const resolveWindowReceive = (
  matrix: MatrixResult,
  norad: number,
  win: Record<string, any>
): { receiveId: string; receiveName: string } | null => {
  const receiveId = win.receiveId as string | undefined
  const receiveName = win.receiveName as string | undefined
  if (receiveId || receiveName) {
    return { receiveId: receiveId || receiveName || '', receiveName: receiveName || receiveId || '' }
  }

  const timeEffect = matrix.timeEffects?.find((item) => item.norad === norad)
  if (timeEffect?.receiveName) {
    const relationData = getRelationData(matrix, false)
    const matched = relationData.receiveObjList?.find((rec) => rec.receiveName === timeEffect.receiveName)
    return {
      receiveId: matched?.receiveId || timeEffect.receiveName,
      receiveName: timeEffect.receiveName,
    }
  }
  return null
}

const chainPathKey = (nodes: ChainNode[]): string => nodes.map((n) => `${n.layer}:${n.id}`).join('>')

/**
 * 补充「观测星 → 中继星 → 地面站 → 数据中心」候选链路。
 * 纯中继下传场景下，地面过境窗口在中继卫星上，而非观测卫星。
 */
const appendRelayDownlinkCandidates = (
  matrix: MatrixResult,
  norad: number,
  usePostStrike: boolean,
  candidates: ChainCandidate[],
  ctx: {
    satName: string
    relayRel: NonNullable<ReturnType<typeof findRelayRelation>>
    relayNorad: number
    relayName: string
    receiveToStations: Map<string, { stationId: string; stationName: string }[]>
    receiveMap: Map<string, { receiveId: string; receiveName?: string; receiveStatus?: number }>
  }
) => {
  const existingKeys = new Set(candidates.map((c) => chainPathKey(c.nodes)))
  const relayGroundWindows = getMergedWindowsForNorad(matrix, ctx.relayNorad)

  relayGroundWindows.forEach((groundWin) => {
    if (usePostStrike && groundWin.strikeStatus === 1) return

    const receive = resolveWindowReceive(matrix, ctx.relayNorad, groundWin)
    if (!receive) return

    const { receiveId, receiveName } = receive
    const receiveObj = ctx.receiveMap.get(receiveId)
    if (usePostStrike && receiveObj?.receiveStatus === 1) return

    const stationLinks = ctx.receiveToStations.get(receiveId) || []
    if (!stationLinks.length) return

    const groundStart = getWindowStartStr(groundWin)
    const groundEnd = getWindowEndStr(groundWin)
    const groundStartTs = parseTimeToMs(groundStart)
    const groundEndTs = parseTimeToMs(groundEnd || groundStart)
    if (!groundStartTs || !groundEndTs) return

    stationLinks.forEach(({ stationId, stationName }) => {
      ; (ctx.relayRel.visibilityWindows || []).forEach((vis) => {
        if (!windowsOverlapMs(vis.beginWindow, vis.endWindow, groundStart, groundEnd)) return
        const relayEndTs = parseTimeToMs(vis.endWindow || vis.beginWindow)
        if (!relayEndTs) return
        const finishTs = Math.max(relayEndTs, groundEndTs)
        const nodes: ChainNode[] = [
          { layer: 'SAT', id: String(norad), name: ctx.satName, icon: '🛰️' },
          { layer: 'RELAY', id: String(ctx.relayNorad), name: ctx.relayName, icon: '📡' },
          { layer: 'RECEIVE', id: receiveId, name: receiveName, icon: '📡' },
          { layer: 'STATION', id: stationId, name: stationName, icon: '💻' },
        ]
        const key = chainPathKey(nodes)
        if (existingKeys.has(key)) return
        existingKeys.add(key)
        candidates.push({ finishTs, groundStartTs, groundEndTs, nodes })
      })
    })
  })
}

const enumerateChainCandidates = (
  matrix: MatrixResult,
  norad: number,
  usePostStrike: boolean
): ChainCandidate[] => {
  const satNameMap = buildSatNameMap(matrix)
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name || `Sat-${norad}`

  if (usePostStrike && (!postSat || postSat.satelliteStatus === 1)) return []

  const windows: Record<string, any>[] = usePostStrike
    ? postSat?.stationWindows || []
    : initSat?.initWindows || []

  const relationData = getRelationData(matrix, usePostStrike)
  const receiveToStations = buildReceiveToStations(relationData, usePostStrike)
  const receiveMap = new Map((relationData.receiveObjList || []).map((r) => [r.receiveId, r]))

  const relayRel = findRelayRelation(matrix, norad)
  const relayNorad = relayRel ? Number(relayRel.to) : null
  const relayName = relayNorad ? satNameMap.get(relayNorad) || `TDRS-${relayNorad}` : ''

  const candidates: ChainCandidate[] = []

  windows.forEach((win) => {
    if (usePostStrike && win.strikeStatus === 1) return

    const receiveId = win.receiveId || 'target-area'
    const receiveObj = receiveMap.get(receiveId)
    if (usePostStrike && receiveObj?.receiveStatus === 1) return

    const stationLinks = receiveToStations.get(receiveId) || []
    if (!stationLinks.length) return

    const groundStart = getWindowStartStr(win)
    const groundEnd = getWindowEndStr(win)
    const groundStartTs = parseTimeToMs(groundStart)
    const groundEndTs = parseTimeToMs(groundEnd || groundStart)
    if (!groundStartTs || !groundEndTs) return

    const receiveName = win.receiveName || receiveObj?.receiveName || receiveId

    stationLinks.forEach(({ stationId, stationName }) => {
      const baseNodes: ChainNode[] = [
        { layer: 'SAT', id: String(norad), name: satName, icon: '🛰️' },
      ]

      // 直连路径：卫星 → 地面站 → 数据中心
      candidates.push({
        finishTs: groundEndTs,
        groundStartTs,
        groundEndTs,
        nodes: [
          ...baseNodes,
          { layer: 'RECEIVE', id: receiveId, name: receiveName, icon: '📡' },
          { layer: 'STATION', id: stationId, name: stationName, icon: '💻' },
        ],
      })

      // 中继路径：卫星 → 中继 → 地面站 → 数据中心
      if (relayRel && relayNorad) {
        ; (relayRel.visibilityWindows || []).forEach((vis) => {
          if (!windowsOverlapMs(vis.beginWindow, vis.endWindow, groundStart, groundEnd)) return
          const relayEndTs = parseTimeToMs(vis.endWindow || vis.beginWindow)
          if (!relayEndTs) return
          const finishTs = Math.max(relayEndTs, groundEndTs)
          candidates.push({
            finishTs,
            groundStartTs,
            groundEndTs,
            nodes: [
              ...baseNodes,
              { layer: 'RELAY', id: String(relayNorad), name: relayName, icon: '📡' },
              { layer: 'RECEIVE', id: receiveId, name: receiveName, icon: '📡' },
              { layer: 'STATION', id: stationId, name: stationName, icon: '💻' },
            ],
          })
        })
      }
    })
  })

  if (relayRel && relayNorad) {
    appendRelayDownlinkCandidates(matrix, norad, usePostStrike, candidates, {
      satName,
      relayRel,
      relayNorad,
      relayName,
      receiveToStations,
      receiveMap,
    })
  }

  return candidates
}

const pickEarliestChain = (candidates: ChainCandidate[]): ChainCandidate | null => {
  if (!candidates.length) return null
  return candidates.reduce((best, cur) => (cur.finishTs < best.finishTs ? cur : best))
}

/** 将全链路节点序列映射为 G6 边 ID 集合 */
export const chainToEdgeIds = (chain: FullChainResult): Set<string> => {
  const ids = new Set<string>()
  const nodes = chain.nodes
  if (nodes.length < 2) return ids

  const satNode = nodes.find((n) => n.layer === 'SAT')
  const satNorad = satNode?.id

  for (let i = 0; i < nodes.length - 1; i++) {
    const from = nodes[i]
    const to = nodes[i + 1]
    if (from.layer === 'SAT' && to.layer === 'RELAY') {
      ids.add(`edge-relay-${from.id}-${to.id}`)
    } else if (from.layer === 'SAT' && to.layer === 'RECEIVE') {
      ids.add(`edge-sat-${from.id}-${to.id}`)
    } else if (from.layer === 'RELAY' && to.layer === 'RECEIVE' && satNorad) {
      ids.add(`edge-relay-${satNorad}-${from.id}`)
      ids.add(`edge-sat-${satNorad}-${to.id}`)
    } else if (from.layer === 'RECEIVE' && to.layer === 'STATION') {
      ids.add(`edge-${from.id}-${to.id}`)
    }
  }
  return ids
}

/** 获取某颗卫星相关的全部拓扑边 ID */
export const getSatelliteRelatedEdgeIds = (matrix: MatrixResult, norad: number): Set<string> => {
  const ids = new Set<string>()
  const satId = `sat-${norad}`

  const windows = [
    ...(matrix.initMatrixList?.find((s) => s.norad === norad)?.initWindows || []),
    ...(matrix.satelliteMatrixList?.find((s) => s.norad === norad)?.stationWindows || []),
  ]
  const receiveIds = new Set(windows.map((w) => w.receiveId).filter(Boolean) as string[])

  receiveIds.forEach((recId) => {
    ids.add(`edge-${satId}-${recId}`)
    ids.add(`edge-sat-${norad}-${recId}`)
  })

  const relayRel = matrix.relayRelation?.relations?.find((r) => Number(r.from) === norad)
  if (relayRel) {
    ids.add(`edge-relay-${relayRel.from}-${relayRel.to}`)
  }

  const relationLists = [matrix.initRelationList, matrix.stationRelationList].filter(Boolean)
  relationLists.forEach((relData) => {
    ; (relData?.relations || []).forEach((rel) => {
      if (receiveIds.has(rel.from)) {
        ids.add(`edge-${rel.from}-${rel.to}`)
      }
    })
  })

  const targetId = 'target-area'
  if (windows.length > 0) {
    ids.add(`edge-${satId}-${targetId}`)
  }

  return ids
}

/**
 * 判断指定 NORAD 是否为中继卫星。
 * @param matrix 算法矩阵数据
 * @param norad 卫星 NORAD 编号
 * @param satType 可选的卫星类型描述
 * @returns 是否为中继卫星
 */
export const isRelaySatellite = (matrix: MatrixResult, norad: number, satType?: string): boolean => {
  if ((satType || '').includes('中继')) return true
  return (matrix.relayRelation?.relayList || []).includes(norad)
}

/**
 * 列出经指定中继卫星下传的全部上游观测卫星 NORAD。
 * @param matrix 算法矩阵数据
 * @param relayNorad 中继卫星 NORAD 编号
 * @returns 上游观测卫星 NORAD 列表
 */
export const listSourceSatelliteNoradsForRelay = (matrix: MatrixResult, relayNorad: number): number[] => {
  return (matrix.relayRelation?.relations || [])
    .filter((rel) => Number(rel.to) === relayNorad || String(rel.to) === String(relayNorad))
    .map((rel) => Number(rel.from))
    .filter((norad) => Number.isFinite(norad) && norad > 0)
}

/** 普通侦察卫星 NORAD 列表（不含中继） */
export const listNormalSatelliteNorads = (matrix: MatrixResult): number[] => {
  const norads = new Set<number>()
    ; (matrix.initMatrixList || []).forEach((s) => {
      if (!isRelaySatellite(matrix, s.norad, s.satType)) norads.add(s.norad)
    })
    ; (matrix.satelliteMatrixList || []).forEach((s) => {
      if (!isRelaySatellite(matrix, s.norad, s.satType)) norads.add(s.norad)
    })
  return Array.from(norads)
}

/** 全部卫星打击后最早可用链路边 ID 并集 */
export const collectPostStrikePrimaryEdgeIds = (matrix: MatrixResult): Set<string> => {
  const ids = new Set<string>()
  listNormalSatelliteNorads(matrix).forEach((norad) => {
    const chain = analyzeSatelliteFullChain(matrix, norad, true)
    if (!chain.blocked) {
      chainToEdgeIds(chain).forEach((id) => ids.add(id))
    }
  })
  return ids
}

/** 指定时刻被干扰的链路边 ID（用于时间轴打击点标红） */
export const collectJamStrikeEdgeIdsAtTime = (
  matrix: MatrixResult,
  norad: number,
  atMs: number
): Set<string> => {
  const ids = new Set<string>()
  const satId = `sat-${norad}`
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const receiveIds = new Set<string>()

    ; (postSat?.stationWindows || []).forEach((win) => {
      if (win.strikeStatus !== 1) return
      const start = parseTimeToMs(getWindowStartStr(win))
      const end = parseTimeToMs(win.endWindow || '')
      if (!start || atMs < start || atMs > (end || start)) return
      const recId = win.receiveId
      if (!recId) return
      receiveIds.add(recId)
      ids.add(`edge-${satId}-${recId}`)
      ids.add(`edge-sat-${norad}-${recId}`)
    })

  const relationLists = [matrix.initRelationList, matrix.stationRelationList].filter(Boolean)
  relationLists.forEach((relData) => {
    ; (relData?.relations || []).forEach((rel) => {
      if (receiveIds.has(rel.from)) {
        ids.add(`edge-${rel.from}-${rel.to}`)
      }
    })
  })

  const relayRel = matrix.relayRelation?.relations?.find((r) => Number(r.from) === norad)
  if (relayRel) {
    ids.add(`edge-relay-${relayRel.from}-${relayRel.to}`)
  }

  return ids
}

const isChainActiveAtMs = (candidate: ChainCandidate, atMs: number): boolean => {
  if (!atMs) return false
  if (atMs >= candidate.groundStartTs && atMs <= candidate.groundEndTs) return true
  return Math.abs(candidate.finishTs - atMs) <= 1000
}

/** 解析指定时刻的活跃全链路 */
export const analyzeSatelliteChainAtTime = (
  matrix: MatrixResult | null,
  norad: number,
  atMs: number,
  usePostStrike: boolean
): FullChainResult => {
  const empty: FullChainResult = {
    finishTime: null,
    finishTimestamp: null,
    nodes: [],
    blocked: true,
    blockedReason: '该时刻无活跃链路',
  }
  if (!matrix || !norad || !atMs) return empty

  const candidates = enumerateChainCandidates(matrix, norad, usePostStrike).filter((c) =>
    isChainActiveAtMs(c, atMs)
  )
  const best = pickEarliestChain(candidates)
  if (!best) return empty

  return {
    finishTime: formatTimestampMs(best.finishTs),
    finishTimestamp: best.finishTs,
    nodes: best.nodes,
    blocked: false,
  }
}

export type TimelineChainMarkerType =
  | 'task_start'
  | 'first_transmit'
  | 'jam'
  | 'post_chain_finish'
  | 'all_blocked'
  | 'task_end'

/** 根据时间轴关键点类型解析应展示的链路 */
export const resolveChainForTimelineMarker = (
  matrix: MatrixResult | null,
  norad: number,
  markerType: TimelineChainMarkerType,
  atMs: number
): FullChainResult => {
  if (!matrix || !norad) {
    return {
      finishTime: null,
      finishTimestamp: null,
      nodes: [],
      blocked: true,
      blockedReason: '暂无矩阵数据',
    }
  }

  if (markerType === 'post_chain_finish' || markerType === 'all_blocked') {
    return analyzeSatelliteFullChain(matrix, norad, true)
  }
  if (markerType === 'first_transmit') {
    return analyzeSatelliteChainAtTime(matrix, norad, atMs, false)
  }
  if (markerType === 'jam') {
    const active = analyzeSatelliteChainAtTime(matrix, norad, atMs, true)
    if (!active.blocked) return active
    return analyzeSatelliteChainAtTime(matrix, norad, atMs, false)
  }

  const postChain = analyzeSatelliteFullChain(matrix, norad, true)
  const usePostStrike =
    markerType === 'task_end' ||
    (!!postChain.finishTimestamp && atMs >= postChain.finishTimestamp)
  return analyzeSatelliteChainAtTime(matrix, norad, atMs, usePostStrike)
}
/**
 * 分析卫星的全链路
 * @param matrix 算法矩阵数据
 * @param norad 卫星 NORAD 号
 * @param usePostStrike 是否使用打击后数据
 * @returns 卫星的全链路分析结果
 */
export const analyzeSatelliteFullChain = (
  matrix: MatrixResult | null,
  norad: number,
  usePostStrike: boolean
): FullChainResult => {
  const empty: FullChainResult = {
    finishTime: null,
    finishTimestamp: null,
    nodes: [],
    blocked: true,
    blockedReason: '暂无矩阵数据',
  }
  if (!matrix || !norad) return empty

  const candidates = enumerateChainCandidates(matrix, norad, usePostStrike)
  const best = pickEarliestChain(candidates)

  if (!best) {
    if (usePostStrike) {
      return {
        finishTime: '时间无限期延长',
        finishTimestamp: null,
        nodes: [],
        blocked: true,
        blockedReason: '所有通信全部被干扰',
      }
    }
    return {
      finishTime: null,
      finishTimestamp: null,
      nodes: [],
      blocked: true,
      blockedReason: '无可完成链路',
    }
  }

  return {
    finishTime: formatTimestampMs(best.finishTs),
    finishTimestamp: best.finishTs,
    nodes: best.nodes,
    blocked: false,
  }
}

const formatDelayText = (delayMin: number, struck: boolean): string => {
  if (delayMin > 0) return `造成延迟 +${delayMin} 分钟`
  if (struck) return '该站被干扰，链路中断'
  return '未造成额外延迟'
}

/** 按当前过境站解析打击前全链路：卫星 → (中继) → 地面站 → 数据中心 */
export const resolveStationPassChain = (
  matrix: MatrixResult | null,
  norad: number,
  receiveKey: string | null | undefined,
  atMs: number
): StationPassAnalysis => {
  const emptyChain: FullChainResult = {
    finishTime: null,
    finishTimestamp: null,
    nodes: [],
    blocked: true,
    blockedReason: '未找到该过境站对应链路',
  }
  const empty: StationPassAnalysis = {
    chain: emptyChain,
    delayMin: 0,
    delayText: '未造成额外延迟',
    currentTime: atMs ? formatTimestampMs(atMs) : '',
    struck: false,
  }
  if (!matrix || !norad || !receiveKey) return empty

  const satNameMap = buildSatNameMap(matrix)
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name || `Sat-${norad}`
  const windows = [...(postSat?.stationWindows || []), ...(initSat?.initWindows || [])]
  const matched = windows.filter(
    (win) => win.receiveId === receiveKey || win.receiveName === receiveKey
  )
  const win =
    matched.find((item) => {
      const start = parseTimeToMs(getWindowStartStr(item))
      const end = parseTimeToMs(getWindowEndStr(item) || '') || start
      if (!start) return false
      return atMs >= start && atMs <= end
    }) ||
    matched.find((item) => {
      const start = parseTimeToMs(getWindowStartStr(item))
      return !!start && Math.abs(start - atMs) <= 2000
    }) ||
    matched[0]

  if (!win) return empty

  const receiveId = win.receiveId || receiveKey
  const receiveName = win.receiveName || receiveId
  const finishTs =
    parseTimeToMs(getWindowEndStr(win) || '') ||
    parseTimeToMs(getWindowStartStr(win)) ||
    atMs

  const relationData = getRelationData(matrix, false)
  const receiveToStations = buildReceiveToStations(relationData, false)
  let stationLinks = receiveToStations.get(receiveId) || []
  if (!stationLinks.length) {
    stationLinks = buildReceiveToStations(getRelationData(matrix, true), false).get(receiveId) || []
  }
  const station = stationLinks[0]

  const relayRel = findRelayRelation(matrix, norad)
  const relayNorad = relayRel ? Number(relayRel.to) : null
  const relayPostSat = relayNorad
    ? matrix.satelliteMatrixList?.find((s) => s.norad === relayNorad)
    : undefined
  const groundStart = getWindowStartStr(win)
  const groundEnd = getWindowEndStr(win)
  let relayWindow = (relayRel?.visibilityWindows || []).find((vis) =>
    windowsOverlapMs(vis.beginWindow, vis.endWindow, groundStart, groundEnd)
  )
  if (relayRel && relayNorad && !relayWindow) {
    const relayGroundWindows = getMergedWindowsForNorad(matrix, relayNorad)
    for (const relayGroundWin of relayGroundWindows) {
      const relayReceive = resolveWindowReceive(matrix, relayNorad, relayGroundWin)
      if (
        !relayReceive ||
        (relayReceive.receiveId !== receiveId && relayReceive.receiveName !== receiveName)
      ) {
        continue
      }
      const relayGroundStart = getWindowStartStr(relayGroundWin)
      const relayGroundEnd = getWindowEndStr(relayGroundWin)
      const matchedVis = (relayRel.visibilityWindows || []).find((vis) =>
        windowsOverlapMs(vis.beginWindow, vis.endWindow, relayGroundStart, relayGroundEnd)
      )
      if (matchedVis) {
        relayWindow = matchedVis
        break
      }
    }
  }
  const usesRelay = !!(relayRel && relayNorad && relayWindow)
  const struck = isTransmissionLinkStruck(
    win as Record<string, any>,
    postSat,
    usesRelay ? relayPostSat : undefined
  )
  const delayMin =
    Number((win as { delayMin?: number }).delayMin) ||
    (struck ? Number(postSat?.delayMin) || 0 : 0)

  if (!station) {
    return {
      chain: {
        finishTime: finishTs ? formatTimestampMs(finishTs) : null,
        finishTimestamp: finishTs || null,
        nodes: [
          { layer: 'SAT', id: String(norad), name: satName, icon: '🛰️' },
          { layer: 'RECEIVE', id: receiveId, name: receiveName, icon: '📡' },
        ],
        blocked: true,
        blockedReason: '该地面站未连接到数据中心',
      },
      delayMin,
      delayText: formatDelayText(delayMin, struck),
      currentTime: formatTimestampMs(atMs || finishTs),
      struck,
    }
  }

  const nodes: ChainNode[] = [{ layer: 'SAT', id: String(norad), name: satName, icon: '🛰️' }]
  if (usesRelay) {
    nodes.push({
      layer: 'RELAY',
      id: String(relayNorad),
      name: satNameMap.get(relayNorad!) || `TDRS-${relayNorad}`,
      icon: '📡',
    })
  }
  nodes.push(
    { layer: 'RECEIVE', id: receiveId, name: receiveName, icon: '📡' },
    { layer: 'STATION', id: station.stationId, name: station.stationName, icon: '💻' }
  )

  return {
    chain: {
      finishTime: finishTs ? formatTimestampMs(finishTs) : null,
      finishTimestamp: finishTs || null,
      nodes,
      blocked: false,
    },
    delayMin,
    delayText: formatDelayText(delayMin, struck),
    currentTime: formatTimestampMs(atMs || finishTs),
    struck,
  }
}

/**
 * 解析单条链路的打击目标：卫星、中继卫星、地面站或组合
 *
 * @param win 过境窗口
 * @param postSat 观测卫星打击后矩阵项
 * @param relayPostSat 链路途经的中继卫星打击后矩阵项（可选）
 * @returns 打击目标分解与展示文案
 */
export const resolveLinkStrikeTarget = (
  win: Record<string, any>,
  postSat: MatrixResult['satelliteMatrixList'][number] | undefined,
  relayPostSat?: MatrixResult['satelliteMatrixList'][number] | undefined
): {
  satelliteStruck: boolean
  receiveStruck: boolean
  relayStruck: boolean
  struck: boolean
  label: string
} => {
  const satelliteStruck = postSat?.satelliteStatus === 1
  const receiveStruck = Number(win.strikeStatus) === 1
  const relayStruck = relayPostSat?.satelliteStatus === 1
  const struck = satelliteStruck || receiveStruck || relayStruck
  const parts: string[] = []
  if (satelliteStruck) parts.push('卫星')
  if (relayStruck) parts.push('中继卫星')
  if (receiveStruck) parts.push('地面站')
  const label = parts.length ? parts.join(' + ') : '无'
  return { satelliteStruck, receiveStruck, relayStruck, struck, label }
}

/**
 * 判断单条传输链路是否被打击：观测卫星、中继卫星或地面站受打击时链路均中断
 *
 * @param win 过境窗口
 * @param postSat 打击后卫星矩阵项（含 satelliteStatus）
 * @param relayPostSat 中继卫星打击后矩阵项（可选）
 * @returns 链路是否被打击
 */
const isTransmissionLinkStruck = (
  win: Record<string, any>,
  postSat: MatrixResult['satelliteMatrixList'][number] | undefined,
  relayPostSat?: MatrixResult['satelliteMatrixList'][number] | undefined
): boolean => resolveLinkStrikeTarget(win, postSat, relayPostSat).struck

const resolveWeaponsForWindow = (
  matrix: MatrixResult,
  postSat: MatrixResult['satelliteMatrixList'][number] | undefined,
  win: Record<string, any>,
  relayPostSat?: MatrixResult['satelliteMatrixList'][number] | undefined
): { weaponNames: string; weaponType?: string } => {
  const windowStruck = Number(win.strikeStatus) === 1
  const satStruck = postSat?.satelliteStatus === 1
  const relayStruck = relayPostSat?.satelliteStatus === 1
  const struck = windowStruck || satStruck || relayStruck
  const weaponMap = new Map<string, string | undefined>()

  if (windowStruck) {
    ; (win.weapons || []).forEach((w: Weapon) => weaponMap.set(w.name, w.type))
    const receiveId = win.receiveId as string | undefined
    const receiveName = win.receiveName as string | undefined
      ; (matrix.attackPlanList || []).forEach((plan: WeaponAttackRecord & { targetId?: string }) => {
        const matchedById = !!plan.targetId && !!receiveId && plan.targetId === receiveId
        const matchedByName =
          !!plan.target && (!!receiveName ? plan.target === receiveName : plan.target === receiveId)
        if (matchedById || matchedByName) {
          weaponMap.set(plan.weaponName, plan.weaponType)
        }
      })
  }

  if (satStruck) {
    ; (postSat?.weapons || []).forEach((w: Weapon) => {
      if (!weaponMap.has(w.name)) weaponMap.set(w.name, w.type)
    })
    const satNorad = postSat?.norad
    const satName = postSat?.name
      ; (matrix.attackPlanList || []).forEach((plan: WeaponAttackRecord & { targetId?: string; targetType?: string }) => {
        const matchedByNorad = !!plan.targetId && !!satNorad && String(plan.targetId) === String(satNorad)
        const matchedByName = !!plan.target && !!satName && plan.target === satName
        const targetIsSatellite =
          !plan.targetType || plan.targetType.includes('卫星') || plan.targetType.toUpperCase() === 'SAT'
        if ((matchedByNorad || matchedByName) && (targetIsSatellite || matchedByNorad)) {
          weaponMap.set(plan.weaponName, plan.weaponType)
        }
      })
  }

  if (relayStruck) {
    ; (relayPostSat?.weapons || []).forEach((w: Weapon) => {
      if (!weaponMap.has(w.name)) weaponMap.set(w.name, w.type)
    })
    const relayNorad = relayPostSat?.norad
    const relayName = relayPostSat?.name
      ; (matrix.attackPlanList || []).forEach((plan: WeaponAttackRecord & { targetId?: string; targetType?: string }) => {
        const matchedByNorad = !!plan.targetId && !!relayNorad && String(plan.targetId) === String(relayNorad)
        const matchedByName = !!plan.target && !!relayName && plan.target === relayName
        const targetIsRelay =
          !plan.targetType || plan.targetType.includes('中继') || plan.targetType.toUpperCase() === 'RELAY'
        if ((matchedByNorad || matchedByName) && (targetIsRelay || matchedByNorad)) {
          weaponMap.set(plan.weaponName, plan.weaponType)
        }
      })
  }

  if (struck && !weaponMap.size) {
    weaponMap.set('电磁干扰', undefined)
  }

  const names = Array.from(weaponMap.keys())
  const types = Array.from(new Set(Array.from(weaponMap.values()).filter(Boolean) as string[]))
  return {
    weaponNames: names.length ? names.join('、') : '未打击',
    weaponType: types.length === 1 ? types[0] : undefined,
  }
}

/**
 * 收集中继卫星作为传输枢纽的全部链路（观测星 → 中继 → 地面站 → 数据中心）。
 *
 * @param matrix 算法矩阵数据
 * @param relayNorad 中继卫星 NORAD 编号
 * @returns 按传输开始时间升序排列的链路列表
 */
export const collectRelaySatelliteTransmissionLinks = (
  matrix: MatrixResult | null,
  relayNorad: number
): SatelliteTransmissionLink[] => {
  if (!matrix || !relayNorad) return []

  const sourceNorads = listSourceSatelliteNoradsForRelay(matrix, relayNorad)
  const links: SatelliteTransmissionLink[] = []
  const seen = new Set<string>()

  sourceNorads.forEach((sourceNorad) => {
    collectSatelliteTransmissionLinks(matrix, sourceNorad).forEach((link) => {
      const usesThisRelay = link.nodes.some(
        (node) => node.layer === 'RELAY' && Number(node.id) === relayNorad
      )
      if (!usesThisRelay) return
      const key = chainPathKey(link.nodes)
      if (seen.has(key)) return
      seen.add(key)
      links.push(link)
    })
  })

  return links.sort((a, b) => {
    if (a.transmitStartMs !== b.transmitStartMs) return a.transmitStartMs - b.transmitStartMs
    return a.receiveName.localeCompare(b.receiveName, 'zh-CN')
  })
}

/**
 * 收集选中卫星的全部传输链路：每条链路包含路径、传输时间、打击武器与延迟
 *
 * @param matrix 算法矩阵数据
 * @param norad 卫星 NORAD 编号
 * @returns 按传输开始时间升序排列的链路列表
 */
export const collectSatelliteTransmissionLinks = (
  matrix: MatrixResult | null,
  norad: number
): SatelliteTransmissionLink[] => {
  if (!matrix || !norad) return []

  if (isRelaySatellite(matrix, norad)) {
    return collectRelaySatelliteTransmissionLinks(matrix, norad)
  }

  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name || `Sat-${norad}`
  const windows = mergeSatelliteTransitWindows(
    (initSat?.initWindows || []) as Record<string, any>[],
    (postSat?.stationWindows || []) as Record<string, any>[]
  )
  const satNameMap = buildSatNameMap(matrix)
  const links: SatelliteTransmissionLink[] = []
  const relayRel = findRelayRelation(matrix, norad)
  const relayNorad = relayRel ? Number(relayRel.to) : null
  const relayPostSat = relayNorad
    ? matrix.satelliteMatrixList?.find((s) => s.norad === relayNorad)
    : undefined

  windows.forEach((win, index) => {
    const receive = resolveWindowReceive(matrix, norad, win)
    if (!receive) return

    const { receiveId, receiveName } = receive
    const groundStart = getWindowStartStr(win)
    const groundEnd = getWindowEndStr(win) || groundStart
    const groundStartTs = parseTimeToMs(groundStart)
    const groundEndTs = parseTimeToMs(groundEnd) || groundStartTs
    if (!groundStartTs) return

    const relationData = getRelationData(matrix, false)
    const receiveToStations = buildReceiveToStations(relationData, false)
    let stationLinks = receiveToStations.get(receiveId) || []
    if (!stationLinks.length) {
      stationLinks = buildReceiveToStations(getRelationData(matrix, true), false).get(receiveId) || []
    }

    const nodes: ChainNode[] = [{ layer: 'SAT', id: String(norad), name: satName, icon: '🛰️' }]
    let relayWindow = (relayRel?.visibilityWindows || []).find((vis) =>
      windowsOverlapMs(vis.beginWindow, vis.endWindow, groundStart, groundEnd)
    )
    if (relayRel && relayNorad && !relayWindow) {
      const relayGroundWindows = getMergedWindowsForNorad(matrix, relayNorad)
      for (const relayGroundWin of relayGroundWindows) {
        const relayReceive = resolveWindowReceive(matrix, relayNorad, relayGroundWin)
        if (!relayReceive || relayReceive.receiveId !== receiveId) continue
        const relayGroundStart = getWindowStartStr(relayGroundWin)
        const relayGroundEnd = getWindowEndStr(relayGroundWin)
        const matchedVis = (relayRel.visibilityWindows || []).find((vis) =>
          windowsOverlapMs(vis.beginWindow, vis.endWindow, relayGroundStart, relayGroundEnd)
        )
        if (matchedVis) {
          relayWindow = matchedVis
          break
        }
      }
    }
    const usesRelay = !!(relayRel && relayNorad && relayWindow)
    if (usesRelay) {
      nodes.push({
        layer: 'RELAY',
        id: String(relayNorad),
        name: satNameMap.get(relayNorad) || `TDRS-${relayNorad}`,
        icon: '📡',
      })
    }
    nodes.push({ layer: 'RECEIVE', id: receiveId, name: receiveName, icon: '📡' })

    let blocked = false
    let blockedReason: string | undefined
    const station = stationLinks[0]
    if (station) {
      nodes.push({ layer: 'STATION', id: station.stationId, name: station.stationName, icon: '💻' })
    } else {
      blocked = true
      blockedReason = '该地面站未连接到数据中心'
    }

    const strikeTarget = resolveLinkStrikeTarget(win, postSat, usesRelay ? relayPostSat : undefined)
    const struck = strikeTarget.struck
    const delayMin = Number(win.delayMin) || (struck ? Number(postSat?.delayMin) || 0 : 0)
    const { weaponNames, weaponType } = resolveWeaponsForWindow(
      matrix,
      postSat,
      win,
      usesRelay ? relayPostSat : undefined
    )
    const relayEndTs = relayWindow
      ? parseTimeToMs(relayWindow.endWindow || relayWindow.beginWindow)
      : 0
    const finishTs = relayEndTs ? Math.max(relayEndTs, groundEndTs) : groundEndTs

    links.push({
      id: `${norad}-${receiveId}-${groundStart}-${index}`,
      nodes,
      receiveName,
      receiveId,
      transmitTime: groundEnd && groundEnd !== groundStart ? `${groundStart} ~ ${groundEnd}` : groundStart,
      transmitStartMs: groundStartTs,
      transmitEndMs: groundEndTs,
      finishTime: formatTimestampMs(finishTs),
      struck,
      satelliteStruck: strikeTarget.satelliteStruck,
      receiveStruck: strikeTarget.receiveStruck,
      relayStruck: strikeTarget.relayStruck,
      strikeTargetLabel: strikeTarget.label,
      weaponNames,
      weaponType,
      delayMin,
      delayText: formatDelayText(delayMin, struck),
      blocked,
      blockedReason,
    })
  })

  if (relayRel && relayNorad) {
    const relayName = satNameMap.get(relayNorad) || `TDRS-${relayNorad}`
    const relationData = getRelationData(matrix, false)
    const receiveToStations = buildReceiveToStations(relationData, false)
    const receiveMap = new Map((relationData.receiveObjList || []).map((r) => [r.receiveId, r]))
    const extraCandidates: ChainCandidate[] = []
    appendRelayDownlinkCandidates(matrix, norad, false, extraCandidates, {
      satName,
      relayRel,
      relayNorad,
      relayName,
      receiveToStations,
      receiveMap,
    })

    const existingKeys = new Set(links.map((l) => chainPathKey(l.nodes)))
    extraCandidates.forEach((candidate, idx) => {
      const pathKey = chainPathKey(candidate.nodes)
      if (existingKeys.has(pathKey)) return
      existingKeys.add(pathKey)

      const receiveNode = candidate.nodes.find((n) => n.layer === 'RECEIVE')
      const stationNode = candidate.nodes.find((n) => n.layer === 'STATION')
      if (!receiveNode) return

      const relayGroundWin =
        getMergedWindowsForNorad(matrix, relayNorad).find((rgw) => {
          const relayReceive = resolveWindowReceive(matrix, relayNorad, rgw)
          if (!relayReceive || relayReceive.receiveId !== receiveNode.id) return false
          return parseTimeToMs(getWindowStartStr(rgw)) === candidate.groundStartTs
        }) || {}

      const strikeTarget = resolveLinkStrikeTarget(relayGroundWin, postSat, relayPostSat)
      const { weaponNames, weaponType } = resolveWeaponsForWindow(
        matrix,
        postSat,
        relayGroundWin,
        relayPostSat
      )
      const delayMin =
        Number(relayGroundWin.delayMin) ||
        (strikeTarget.struck ? Number(relayPostSat?.delayMin) || Number(postSat?.delayMin) || 0 : 0)

      const groundStart = formatTimestampMs(candidate.groundStartTs)
      const groundEnd = formatTimestampMs(candidate.groundEndTs)
      links.push({
        id: `${norad}-relay-${receiveNode.id}-${candidate.groundStartTs}-${idx}`,
        nodes: candidate.nodes,
        receiveName: receiveNode.name,
        receiveId: receiveNode.id,
        transmitTime: groundEnd !== groundStart ? `${groundStart} ~ ${groundEnd}` : groundStart,
        transmitStartMs: candidate.groundStartTs,
        transmitEndMs: candidate.groundEndTs,
        finishTime: formatTimestampMs(candidate.finishTs),
        struck: strikeTarget.struck,
        satelliteStruck: strikeTarget.satelliteStruck,
        receiveStruck: strikeTarget.receiveStruck,
        relayStruck: strikeTarget.relayStruck,
        strikeTargetLabel: strikeTarget.label,
        weaponNames,
        weaponType,
        delayMin,
        delayText: formatDelayText(delayMin, strikeTarget.struck),
        blocked: !stationNode,
        blockedReason: stationNode ? undefined : '该地面站未连接到数据中心',
      })
    })
  }

  return links.sort((a, b) => {
    if (a.transmitStartMs !== b.transmitStartMs) return a.transmitStartMs - b.transmitStartMs
    return a.receiveName.localeCompare(b.receiveName, 'zh-CN')
  })
}

/**
 * 收集当前系列矩阵中全部普通卫星的传输链路（按传输开始时间升序）
 *
 * @param matrix 算法矩阵数据
 * @returns 全系列传出链路列表
 */
export const collectSeriesTransmissionLinks = (matrix: MatrixResult | null): SatelliteTransmissionLink[] => {
  if (!matrix) return []
  const links: SatelliteTransmissionLink[] = []
  listNormalSatelliteNorads(matrix).forEach((norad) => {
    links.push(...collectSatelliteTransmissionLinks(matrix, norad))
  })
  return links.sort((a, b) => {
    if (a.transmitStartMs !== b.transmitStartMs) return a.transmitStartMs - b.transmitStartMs
    return a.receiveName.localeCompare(b.receiveName, 'zh-CN')
  })
}

/**
 * 根据链路 ID 查找传输链路（优先单星范围，否则在全系列中检索）
 *
 * @param matrix 算法矩阵数据
 * @param linkId 链路唯一标识
 * @param norad 可选的卫星 NORAD，传入时仅在单星链路中查找
 * @returns 匹配的链路，未找到时返回 null
 */
export const findTransmissionLinkById = (
  matrix: MatrixResult | null,
  linkId: string,
  norad?: number | null
): SatelliteTransmissionLink | null => {
  if (!matrix || !linkId) return null
  if (norad != null) {
    const links = isRelaySatellite(matrix, norad)
      ? collectRelaySatelliteTransmissionLinks(matrix, norad)
      : collectSatelliteTransmissionLinks(matrix, norad)
    return links.find((item) => item.id === linkId) ?? null
  }
  return collectSeriesTransmissionLinks(matrix).find((item) => item.id === linkId) ?? null
}

/** 统计全网打击前通信链路数，以及打击后仍可完成的全链路 */
export const collectNetworkChainStats = (matrix: MatrixResult | null): NetworkChainStats => {
  if (!matrix) return { totalCount: 0, remainingCount: 0, remainingChains: [] }

  const totalKeys = new Set<string>()
  const remaining = new Map<string, FullChainResult>()

  listNormalSatelliteNorads(matrix).forEach((norad) => {
    enumerateChainCandidates(matrix, norad, false).forEach((candidate) => {
      totalKeys.add(chainPathKey(candidate.nodes))
    })
    enumerateChainCandidates(matrix, norad, true).forEach((candidate) => {
      const key = chainPathKey(candidate.nodes)
      if (remaining.has(key)) return
      remaining.set(key, {
        finishTime: formatTimestampMs(candidate.finishTs),
        finishTimestamp: candidate.finishTs,
        nodes: candidate.nodes,
        blocked: false,
      })
    })
  })

  return {
    totalCount: totalKeys.size,
    remainingCount: remaining.size,
    remainingChains: Array.from(remaining.values()).sort(
      (a, b) => (a.finishTimestamp || 0) - (b.finishTimestamp || 0)
    ),
  }
}

/** 整体态势右侧面板使用的矩阵概览统计 */
export interface MatrixOverviewStats {
  /** 卫星总数（含中继） */
  satelliteCount: number
  /** 地面接收站总数 */
  receiveCount: number
  /** 数据中心总数 */
  stationCount: number
  /** 武器总数（去重） */
  weaponCount: number
  /** 打击前可能链路总数 */
  possibleLinkCount: number
  /** 当前统计范围文案 */
  scopeLabel: string
}

/**
 * 按唯一键合并数组项，后出现的项覆盖先出现的项。
 * @param items 待合并数组
 * @param keyFn 唯一键提取函数
 */
const mergeUniqueBy = <T,>(items: T[], keyFn: (item: T) => string): T[] => {
  const map = new Map<string, T>()
  items.forEach((item) => map.set(keyFn(item), item))
  return Array.from(map.values())
}

/**
 * 合并多个系列矩阵为单一矩阵，供「全部系列」视图使用。
 * @param matrices 各系列矩阵结果
 * @returns 合并后的矩阵；无有效输入时返回 null
 */
export const mergeMatrixResults = (matrices: MatrixResult[]): MatrixResult | null => {
  const valid = matrices.filter(Boolean)
  if (!valid.length) return null
  if (valid.length === 1) return valid[0]

  const mergeRelationList = (lists: StationRelationList[]): StationRelationList => {
    const receiveObjList = mergeUniqueBy(
      lists.flatMap((list) => list.receiveObjList || []),
      (item) => item.receiveId
    )
    const stationObjList = mergeUniqueBy(
      lists.flatMap((list) => list.stationObjList || []),
      (item) => item.stationId
    )
    const relationKeys = new Set<string>()
    const relations = lists
      .flatMap((list) => list.relations || [])
      .filter((rel) => {
        const key = `${rel.from}->${rel.to}`
        if (relationKeys.has(key)) return false
        relationKeys.add(key)
        return true
      })
    return { receiveObjList, stationObjList, relations }
  }

  type RelayRelation = NonNullable<MatrixResult['relayRelation']>

  const mergeRelayRelations = (relations: (RelayRelation | null | undefined)[]): RelayRelation | undefined => {
    const validRelay = relations.filter(Boolean) as RelayRelation[]
    if (!validRelay.length) return undefined
    return {
      relayList: Array.from(new Set(validRelay.flatMap((item) => item.relayList || []))),
      satelliteList: Array.from(new Set(validRelay.flatMap((item) => item.satelliteList || []))),
      relations: mergeUniqueBy(
        validRelay.flatMap((item) => item.relations || []),
        (item) => `${item.from}-${item.to}`
      ),
    }
  }

  return {
    attackPlanList: valid.flatMap((matrix) => matrix.attackPlanList || []),
    battleMatrixList: valid.flatMap((matrix) => matrix.battleMatrixList || []),
    initMatrixList: mergeUniqueBy(valid.flatMap((matrix) => matrix.initMatrixList || []), (item) =>
      String(item.norad)
    ),
    initRelationList: mergeRelationList(
      valid.map((matrix) => matrix.initRelationList || { receiveObjList: [], stationObjList: [], relations: [] })
    ),
    satelliteMatrixList: mergeUniqueBy(
      valid.flatMap((matrix) => matrix.satelliteMatrixList || []),
      (item) => String(item.norad)
    ),
    stationRelationList: mergeRelationList(
      valid.map((matrix) => matrix.stationRelationList || { receiveObjList: [], stationObjList: [], relations: [] })
    ),
    relayRelation: mergeRelayRelations(valid.map((matrix) => matrix.relayRelation)),
    series: valid.map((matrix) => matrix.series).filter(Boolean).join(' / ') || '全部系列',
    threatSats: mergeUniqueBy(valid.flatMap((matrix) => matrix.threatSats || []), (item) => String(item.norad)),
    timeEffects: mergeUniqueBy(valid.flatMap((matrix) => matrix.timeEffects || []), (item) => String(item.norad)),
  }
}

/**
 * 汇总矩阵中的卫星、地面站、数据中心、武器与可能链路数量。
 * @param matrix 算法矩阵数据
 * @param scopeLabel 统计范围展示文案
 * @returns 概览统计结果
 */
export const collectMatrixOverviewStats = (
  matrix: MatrixResult | null,
  scopeLabel?: string
): MatrixOverviewStats => {
  if (!matrix) {
    return {
      satelliteCount: 0,
      receiveCount: 0,
      stationCount: 0,
      weaponCount: 0,
      possibleLinkCount: 0,
      scopeLabel: scopeLabel || '未加载',
    }
  }

  const satelliteIds = new Set<number>()
    ; (matrix.initMatrixList || []).forEach((sat) => satelliteIds.add(sat.norad))
    ; (matrix.satelliteMatrixList || []).forEach((sat) => satelliteIds.add(sat.norad))

  const relationData =
    matrix.initRelationList?.receiveObjList?.length || matrix.initRelationList?.stationObjList?.length
      ? matrix.initRelationList
      : matrix.stationRelationList

  const weaponNames = new Set<string>()
    ; (matrix.attackPlanList || []).forEach((plan) => {
      if (plan.weaponName) weaponNames.add(plan.weaponName)
    })
    ; (matrix.satelliteMatrixList || []).forEach((sat) => {
      ; (sat.weapons || []).forEach((weapon: Weapon) => {
        if (weapon.name) weaponNames.add(weapon.name)
      })
    })

  const chainStats = collectNetworkChainStats(matrix)

  return {
    satelliteCount: satelliteIds.size,
    receiveCount: relationData?.receiveObjList?.length || 0,
    stationCount: relationData?.stationObjList?.length || 0,
    weaponCount: weaponNames.size,
    possibleLinkCount: chainStats.totalCount,
    scopeLabel: scopeLabel || matrix.series || '全部系列',
  }
}

const mapTargetType = (targetType: string): JamWeaponRecord['targetType'] => {
  if (targetType.includes('中继')) return '中继卫星'
  if (targetType.includes('接收') || targetType.includes('地面')) return '接收站'
  if (targetType.includes('中心') || targetType.includes('数据')) return '数据中心'
  return '卫星'
}

interface AggregatedWeapon {
  weaponName: string
  weaponType?: string
  source: JamWeaponRecord['source']
  targets: Map<string, JamWeaponRecord['targetType']>
}

export const collectSatelliteJamWeapons = (
  matrix: MatrixResult | null,
  norad: number,
  receiveKey?: string | null
): JamWeaponRecord[] => {
  if (!matrix || !norad) return []

  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name || ''
  const struckWindows = (postSat?.stationWindows || []).filter((win) => {
    if (win.strikeStatus !== 1) return false
    if (!receiveKey) return true
    return win.receiveId === receiveKey || win.receiveName === receiveKey
  })
  const struckReceiveIds = new Set(struckWindows.map((win) => win.receiveId).filter(Boolean))
  const struckReceiveNames = new Set(struckWindows.map((win) => win.receiveName).filter(Boolean))

  const aggs = new Map<string, AggregatedWeapon>()

  const addWeapon = (
    name: string,
    type: string | undefined,
    targetName: string,
    targetType: JamWeaponRecord['targetType'],
    source: JamWeaponRecord['source']
  ) => {
    if (!name || !targetName) return
    const key = `${name}|${type || ''}`
    let agg = aggs.get(key)
    if (!agg) {
      agg = { weaponName: name, weaponType: type, source, targets: new Map() }
      aggs.set(key, agg)
    }
    if (!agg.weaponType && type) agg.weaponType = type
    agg.targets.set(targetName, targetType)
  }

  struckWindows.forEach((win) => {
    const targetName = win.receiveName || win.receiveId
      ; (win.weapons || []).forEach((w: Weapon) => {
        addWeapon(w.name, w.type, targetName, '接收站', 'window')
      })
  })

  if (postSat?.satelliteStatus === 1 && !receiveKey) {
    ; (postSat.weapons || []).forEach((w: Weapon) => {
      addWeapon(w.name, w.type, satName, '卫星', 'satellite')
    })
  }

  ; (matrix.attackPlanList || []).forEach((plan: WeaponAttackRecord & { targetId?: string }) => {
    const matchedById = !!plan.targetId && struckReceiveIds.has(plan.targetId)
    const matchedByName = !!plan.target && struckReceiveNames.has(plan.target)
    if (!matchedById && !matchedByName) return
    addWeapon(
      plan.weaponName,
      plan.weaponType,
      plan.target,
      mapTargetType(plan.targetType || ''),
      'attackPlan'
    )
  })

  if (!aggs.size && struckWindows.length) {
    struckWindows.forEach((win) => {
      addWeapon('电磁干扰', undefined, win.receiveName || win.receiveId, '接收站', 'window')
    })
  }

  return Array.from(aggs.values()).map((agg) => {
    const targetNames = Array.from(agg.targets.keys())
    const types = Array.from(new Set(agg.targets.values()))
    return {
      weaponName: agg.weaponName,
      weaponType: agg.weaponType,
      targetName: targetNames.join('、'),
      targetType: types.length === 1 ? types[0] : '接收站',
      timeRange: `打击 ${targetNames.length} 个目标`,
      source: agg.source,
    }
  })
}
/**
 * 获取选中卫星的显示信息 (名称、类型、NORAD)
 * @param matrix 算法矩阵数据
 * @param norad 卫星 NORAD 号
 * @returns 卫星的显示信息，包括名称和类型，如果未找到则返回 null
 */
export const getSatelliteDisplayInfo = (
  matrix: MatrixResult | null,
  norad: number
): { name: string; satType: string } | null => {
  if (!matrix || !norad) return null
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  if (!postSat && !initSat) return null
  return {
    name: postSat?.name || initSat?.name || `Sat-${norad}`,
    satType: postSat?.satType || initSat?.satType || '天基节点',
  }
}

/**
 * 传输链路优先级指标与归一化分解
 */
export interface LinkPriorityMetrics {
  /** 卫星威胁度原始得分 (0-100) */
  threatScoreRaw: number
  /** 卫星威胁度归一化得分 [0, 1] */
  threatScoreNorm: number
  /** 传输开始时间戳 (毫秒) */
  transmitStartMs: number
  /** 传输开始时效归一化得分 [0, 1] (越早越接近 1.0) */
  earlyTimeNorm: number
  /** 该卫星在当前范围内的传输链路总数 */
  satelliteLinkCount: number
  /** 孤立度 / 无可复用链路归一化得分 [0, 1] (链路越少越孤立，得分越接近 1.0) */
  isolationNorm: number
  /** 是否途经中继卫星 */
  isRelay: boolean
  /** 中继优先归一化得分 [0, 1] (中继为 1.0，普通为 0.2) */
  relayNorm: number
  /** 加权综合优先级总分 (0-100) */
  totalScore: number
  /** 排序名次 (1, 2, 3...) */
  rank: number
  /** 详细推荐原因 */
  reason: string
  /** 原因分项结构 */
  reasonDetails: {
    threatText: string
    timeText: string
    isolationText: string
    relayText: string
  }
  /** 原因亮点标签 */
  reasonTags: string[]
}

/**
 * 包含优先级评分的传输链路对象
 */
export interface PrioritizedTransmissionLink {
  link: SatelliteTransmissionLink
  priority: LinkPriorityMetrics
}

/**
 * 链路优先级多维评价权重
 */
export interface PriorityWeights {
  /** 卫星威胁度权重，默认 0.35 */
  threat: number
  /** 最早传输时效权重，默认 0.25 */
  earlyTime: number
  /** 孤立度/无复用权重，默认 0.25 */
  isolation: number
  /** 中继优先权重，默认 0.15 */
  relay: number
}

/**
 * 默认多维指标权重配置
 * 1. 卫星威胁度最高: 35%
 * 2. 最早开始传输: 25%
 * 3. 优先孤立链路，没有可复用链路: 25%
 * 4. 优先中继卫星，其次普通卫星: 15%
 */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  threat: 0.35,
  earlyTime: 0.25,
  isolation: 0.25,
  relay: 0.15,
}

/**
 * 依据四维指标计算传输链路优先级并归一化：
 * 1. 卫星威胁度最高 (权重 35%)
 * 2. 最早开始传输 (权重 25%)
 * 3. 优先孤立链路，没有可复用链路 (权重 25%)
 * 4. 优先中继卫星，其次普通卫星 (权重 15%)
 *
 * @param matrix 算法矩阵数据
 * @param links 待评估的传输链路列表 (可为全系列或单星链路)
 * @param weights 可选的自定义权重配置
 * @returns 按优先级降序排列的链路列表，包含完整指标分解与原因说明
 */
export const rankTransmissionLinksByPriority = (
  matrix: MatrixResult | null,
  links: SatelliteTransmissionLink[],
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS
): PrioritizedTransmissionLink[] => {
  if (!matrix || !links.length) return []

  // 1. 构建 NORAD -> 威胁度映射
  const threatMap = new Map<number, number>()
    ; (matrix.threatSats || []).forEach((item) => {
      const raw = Number(item.threatScore)
      if (Number.isFinite(raw)) {
        threatMap.set(item.norad, raw <= 1 ? raw * 100 : raw)
      }
    })

  // 2. 统计每颗源卫星拥有的链路总数 (用于计算孤立度/无复用度)
  const satLinkCountMap = new Map<number, number>()
  links.forEach((link) => {
    const satNode = link.nodes.find((n) => n.layer === 'SAT')
    const norad = satNode ? Number(satNode.id) : null
    if (norad != null && Number.isFinite(norad)) {
      satLinkCountMap.set(norad, (satLinkCountMap.get(norad) || 0) + 1)
    }
  })

  // 3. 提取所有链路的原始特征值
  interface RawLinkFeatures {
    link: SatelliteTransmissionLink
    satNorad: number | null
    satName: string
    threatRaw: number
    startMs: number
    linkCount: number
    isRelay: boolean
  }

  const featureList: RawLinkFeatures[] = links.map((link) => {
    const satNode = link.nodes.find((n) => n.layer === 'SAT')
    const satNorad = satNode ? Number(satNode.id) : null
    const satName = satNode ? satNode.name : `Sat-${satNorad || ''}`
    const threatRaw = (satNorad != null ? threatMap.get(satNorad) : null) ?? 50
    const startMs = link.transmitStartMs || parseTimeToMs(link.transmitTime.split('~')[0]?.trim())
    const linkCount = (satNorad != null ? satLinkCountMap.get(satNorad) : null) ?? 1
    const isRelay = link.nodes.some((n) => n.layer === 'RELAY')

    return {
      link,
      satNorad,
      satName,
      threatRaw,
      startMs,
      linkCount,
      isRelay,
    }
  })

  // 4. 计算极值以进行归一化
  let minThreat = Infinity, maxThreat = -Infinity
  let minStart = Infinity, maxStart = -Infinity
  let minLinkCount = Infinity, maxLinkCount = -Infinity

  featureList.forEach((f) => {
    if (f.threatRaw < minThreat) minThreat = f.threatRaw
    if (f.threatRaw > maxThreat) maxThreat = f.threatRaw

    if (f.startMs < minStart) minStart = f.startMs
    if (f.startMs > maxStart) maxStart = f.startMs

    if (f.linkCount < minLinkCount) minLinkCount = f.linkCount
    if (f.linkCount > maxLinkCount) maxLinkCount = f.linkCount
  })

  if (!Number.isFinite(minThreat)) { minThreat = 0; maxThreat = 100 }
  if (!Number.isFinite(minStart)) { minStart = 0; maxStart = 0 }
  if (!Number.isFinite(minLinkCount)) { minLinkCount = 1; maxLinkCount = 1 }

  // 5. 逐个归一化并计算加权总分
  const totalWeight = weights.threat + weights.earlyTime + weights.isolation + weights.relay || 1.0

  const scoredList: PrioritizedTransmissionLink[] = featureList.map((f) => {
    // 5.1 威胁度归一化 [0, 1]
    let threatNorm = 0.5
    if (maxThreat > minThreat) {
      threatNorm = (f.threatRaw - minThreat) / (maxThreat - minThreat)
    } else {
      threatNorm = Math.min(Math.max(f.threatRaw / 100, 0), 1)
    }

    // 5.2 传输最早时间归一化 [0, 1]（越早越接近 1.0）
    let earlyTimeNorm = 1.0
    if (maxStart > minStart) {
      earlyTimeNorm = (maxStart - f.startMs) / (maxStart - minStart)
    }

    // 5.3 孤立度归一化 [0, 1]（链路越少越孤立，1条链路为最孤立）
    let isolationNorm = 1.0
    if (maxLinkCount > minLinkCount) {
      isolationNorm = (maxLinkCount - f.linkCount) / (maxLinkCount - minLinkCount)
    } else {
      isolationNorm = f.linkCount === 1 ? 1.0 : 1 / f.linkCount
    }

    // 5.4 中继优先级归一化 [0, 1]
    const relayNorm = f.isRelay ? 1.0 : 0.2

    // 5.5 加权总分 (0 - 100)
    const weightedSum =
      (weights.threat * threatNorm +
        weights.earlyTime * earlyTimeNorm +
        weights.isolation * isolationNorm +
        weights.relay * relayNorm) /
      totalWeight

    const totalScore = Number((weightedSum * 100).toFixed(1))

    // 5.6 生成分项与综合原因
    const reasonTags: string[] = []
    const timeStr = f.link.transmitTime.split('~')[0]?.trim() || f.link.transmitTime

    let threatText = ''
    if (threatNorm >= 0.7 || f.threatRaw >= 70) {
      reasonTags.push(`高威胁(${f.threatRaw.toFixed(0)}分)`)
      threatText = `源卫星【${f.satName}】威胁度高达 ${f.threatRaw.toFixed(0)} 分，属于高价值情报节点`
    } else {
      threatText = `源卫星【${f.satName}】威胁度评分为 ${f.threatRaw.toFixed(0)} 分`
    }

    let timeText = ''
    if (earlyTimeNorm >= 0.8) {
      reasonTags.push('紧急下传')
      timeText = `传输最早于 ${timeStr} 启动，拦截响应窗口最紧迫`
    } else {
      timeText = `传输开始时间为 ${timeStr}，响应窗口尚算宽裕`
    }

    let isolationText = ''
    if (f.linkCount === 1) {
      reasonTags.push('独占孤立')
      isolationText = `该星仅有 1 条通信链路（无可复用备用路径），阻断该链路可使其彻底失效`
    } else if (f.linkCount <= 2) {
      reasonTags.push(`低冗余(${f.linkCount}条)`)
      isolationText = `该星仅有 ${f.linkCount} 条下传链路，备用路径极少，具备极高阻断效益`
    } else {
      isolationText = `该星共有 ${f.linkCount} 条关联链路，存在备用下传通道`
    }

    let relayText = ''
    if (f.isRelay) {
      const relayNode = f.link.nodes.find((n) => n.layer === 'RELAY')
      const relayName = relayNode ? relayNode.name : '中继卫星'
      reasonTags.push(`中继枢纽(${relayName})`)
      relayText = `经由中继星【${relayName}】转发下传，破坏该链路可瘫痪天基中继聚合通道`
    } else {
      relayText = `直接下传至地面接收站`
    }

    const reason = `${threatText}；${timeText}；${isolationText}；${relayText}。`

    return {
      link: f.link,
      priority: {
        threatScoreRaw: f.threatRaw,
        threatScoreNorm: Number(threatNorm.toFixed(3)),
        transmitStartMs: f.startMs,
        earlyTimeNorm: Number(earlyTimeNorm.toFixed(3)),
        satelliteLinkCount: f.linkCount,
        isolationNorm: Number(isolationNorm.toFixed(3)),
        isRelay: f.isRelay,
        relayNorm: Number(relayNorm.toFixed(3)),
        totalScore,
        rank: 0,
        reason,
        reasonDetails: {
          threatText,
          timeText,
          isolationText,
          relayText,
        },
        reasonTags,
      },
    }
  })

  // 6. 按综合得分降序排序（同分时按传输时间升序，再按威胁度降序）
  scoredList.sort((a, b) => {
    if (b.priority.totalScore !== a.priority.totalScore) {
      return b.priority.totalScore - a.priority.totalScore
    }
    if (a.priority.transmitStartMs !== b.priority.transmitStartMs) {
      return a.priority.transmitStartMs - b.priority.transmitStartMs
    }
    return b.priority.threatScoreRaw - a.priority.threatScoreRaw
  })

  // 7. 分配名次
  scoredList.forEach((item, idx) => {
    item.priority.rank = idx + 1
  })

  return scoredList
}

