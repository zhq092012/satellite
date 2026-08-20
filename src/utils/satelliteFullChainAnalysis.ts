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

const getWindowStartStr = (win: Record<string, string | undefined>): string =>
  win.peakWindow || win.startWindow || win.beginWindow || ''

const getWindowEndStr = (win: Record<string, string | undefined>): string => win.endWindow || ''

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
  ;(matrix.initMatrixList || []).forEach((s) => map.set(s.norad, s.name))
  ;(matrix.satelliteMatrixList || []).forEach((s) => map.set(s.norad, s.name))
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
  ;(relationData.relations || []).forEach((rel) => {
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

  const relayRel = matrix.relayRelation?.relations?.find((r) => Number(r.from) === norad)
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
        ;(relayRel.visibilityWindows || []).forEach((vis) => {
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
    ;(relData?.relations || []).forEach((rel) => {
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

const isRelaySatellite = (matrix: MatrixResult, norad: number, satType?: string): boolean => {
  if ((satType || '').includes('中继')) return true
  return (matrix.relayRelation?.relayList || []).includes(norad)
}

/** 普通侦察卫星 NORAD 列表（不含中继） */
export const listNormalSatelliteNorads = (matrix: MatrixResult): number[] => {
  const norads = new Set<number>()
  ;(matrix.initMatrixList || []).forEach((s) => {
    if (!isRelaySatellite(matrix, s.norad, s.satType)) norads.add(s.norad)
  })
  ;(matrix.satelliteMatrixList || []).forEach((s) => {
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

  ;(postSat?.stationWindows || []).forEach((win) => {
    if (win.strikeStatus !== 1) return
    const start = parseTimeToMs(getWindowStartStr(win as Record<string, string>))
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
    ;(relData?.relations || []).forEach((rel) => {
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

const chainPathKey = (nodes: ChainNode[]): string => nodes.map((n) => `${n.layer}:${n.id}`).join('>')

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
      const start = parseTimeToMs(getWindowStartStr(item as Record<string, string>))
      const end = parseTimeToMs(getWindowEndStr(item as Record<string, string>) || '') || start
      if (!start) return false
      return atMs >= start && atMs <= end
    }) ||
    matched.find((item) => {
      const start = parseTimeToMs(getWindowStartStr(item as Record<string, string>))
      return !!start && Math.abs(start - atMs) <= 2000
    }) ||
    matched[0]

  if (!win) return empty

  const receiveId = win.receiveId || receiveKey
  const receiveName = win.receiveName || receiveId
  const struck = Number((win as { strikeStatus?: number }).strikeStatus) === 1
  const delayMin =
    Number((win as { delayMin?: number }).delayMin) ||
    (struck ? Number(postSat?.delayMin) || 0 : 0)
  const finishTs =
    parseTimeToMs(getWindowEndStr(win as Record<string, string>) || '') ||
    parseTimeToMs(getWindowStartStr(win as Record<string, string>)) ||
    atMs

  const relationData = getRelationData(matrix, false)
  const receiveToStations = buildReceiveToStations(relationData, false)
  let stationLinks = receiveToStations.get(receiveId) || []
  if (!stationLinks.length) {
    stationLinks = buildReceiveToStations(getRelationData(matrix, true), false).get(receiveId) || []
  }
  const station = stationLinks[0]
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
  const relayRel = matrix.relayRelation?.relations?.find((r) => Number(r.from) === norad)
  const relayNorad = relayRel ? Number(relayRel.to) : null
  const groundStart = getWindowStartStr(win as Record<string, string>)
  const groundEnd = getWindowEndStr(win as Record<string, string>)
  const relayWindow = (relayRel?.visibilityWindows || []).find((vis) =>
    windowsOverlapMs(vis.beginWindow, vis.endWindow, groundStart, groundEnd)
  )
  if (relayRel && relayNorad && relayWindow) {
    nodes.push({
      layer: 'RELAY',
      id: String(relayNorad),
      name: satNameMap.get(relayNorad) || `TDRS-${relayNorad}`,
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
    ;(win.weapons || []).forEach((w: Weapon) => {
      addWeapon(w.name, w.type, targetName, '接收站', 'window')
    })
  })

  if (postSat?.satelliteStatus === 1 && !receiveKey) {
    ;(postSat.weapons || []).forEach((w: Weapon) => {
      addWeapon(w.name, w.type, satName, '卫星', 'satellite')
    })
  }

  ;(matrix.attackPlanList || []).forEach((plan: WeaponAttackRecord & { targetId?: string }) => {
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
