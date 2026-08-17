import type {
  MatrixResult,
  StationRelationList,
  Weapon,
  WeaponAttackRecord,
} from '@/api/electronic'
import { formatFullDateTime } from '@/utils/tools/dateFormat'

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
  nodes: ChainNode[]
}

const parseTimeToMs = (timeStr: string): number => {
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
    const groundEndTs = parseTimeToMs(groundEnd || groundStart)
    if (!groundEndTs) return

    const receiveName = win.receiveName || receiveObj?.receiveName || receiveId

    stationLinks.forEach(({ stationId, stationName }) => {
      const baseNodes: ChainNode[] = [
        { layer: 'SAT', id: String(norad), name: satName, icon: '🛰️' },
      ]

      // 直连路径：卫星 → 地面站 → 数据中心
      candidates.push({
        finishTs: groundEndTs,
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

const matchTargetInSet = (target: string, related: Set<string>): boolean => {
  if (!target) return false
  for (const name of related) {
    if (target === name || target.includes(name) || name.includes(target)) return true
  }
  return false
}

const mapTargetType = (targetType: string): JamWeaponRecord['targetType'] => {
  if (targetType.includes('中继')) return '中继卫星'
  if (targetType.includes('接收') || targetType.includes('地面')) return '接收站'
  if (targetType.includes('中心') || targetType.includes('数据')) return '数据中心'
  return '卫星'
}

const pushWeaponRecord = (
  list: JamWeaponRecord[],
  dedupe: Set<string>,
  record: JamWeaponRecord
) => {
  const key = `${record.weaponName}|${record.targetName}|${record.timeRange}`
  if (dedupe.has(key)) return
  dedupe.add(key)
  list.push(record)
}

const collectRelatedNodeNames = (matrix: MatrixResult, norad: number): Set<string> => {
  const names = new Set<string>()
  const satNameMap = buildSatNameMap(matrix)

  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name
  if (satName) names.add(satName)
  names.add(String(norad))

  const relayRel = matrix.relayRelation?.relations?.find((r) => Number(r.from) === norad)
  if (relayRel) {
    const relayNorad = Number(relayRel.to)
    const relayName = satNameMap.get(relayNorad)
    if (relayName) names.add(relayName)
    names.add(String(relayNorad))
  }

  const allWindows = [
    ...(initSat?.initWindows || []),
    ...(postSat?.stationWindows || []),
  ]
  allWindows.forEach((win) => {
    if (win.receiveName) names.add(win.receiveName)
    if (win.receiveId) names.add(win.receiveId)
  })

  const relationLists = [matrix.initRelationList, matrix.stationRelationList].filter(Boolean)
  relationLists.forEach((relData) => {
  const receiveIds = new Set(allWindows.map((w) => w.receiveId).filter(Boolean))
    ;(relData?.relations || []).forEach((rel) => {
      if (!receiveIds.has(rel.from)) return
      const station = relData?.stationObjList?.find((s) => s.stationId === rel.to)
      if (station?.stationName) names.add(station.stationName)
      names.add(rel.to)
    })
  })

  return names
}

export const collectSatelliteJamWeapons = (
  matrix: MatrixResult | null,
  norad: number
): JamWeaponRecord[] => {
  if (!matrix || !norad) return []

  const records: JamWeaponRecord[] = []
  const dedupe = new Set<string>()
  const relatedNames = collectRelatedNodeNames(matrix, norad)

  const postSat = matrix.satelliteMatrixList?.find((s) => s.norad === norad)
  const initSat = matrix.initMatrixList?.find((s) => s.norad === norad)
  const satName = postSat?.name || initSat?.name || ''

  ;(matrix.attackPlanList || []).forEach((plan: WeaponAttackRecord) => {
    if (!matchTargetInSet(plan.target || '', relatedNames)) return

    const windows = plan.windows?.length
      ? plan.windows
      : [{ beginWindow: plan.beginTime, endWindow: plan.endTime }]

    windows.forEach((win) => {
      const begin = win.beginWindow || plan.beginTime || ''
      const end = win.endWindow || plan.endTime || ''
      pushWeaponRecord(records, dedupe, {
        weaponName: plan.weaponName,
        weaponType: plan.weaponType,
        targetName: plan.target,
        targetType: mapTargetType(plan.targetType || ''),
        timeRange: `${formatFullDateTime(begin)} ~ ${formatFullDateTime(end)}`,
        source: 'attackPlan',
      })
    })
  })

  if (postSat?.satelliteStatus === 1) {
    ;(postSat.weapons || []).forEach((w: Weapon) => {
      pushWeaponRecord(records, dedupe, {
        weaponName: w.name,
        weaponType: w.type,
        targetName: satName,
        targetType: '卫星',
        timeRange: '卫星被干扰期间',
        source: 'satellite',
      })
    })
  }

  ;(postSat?.stationWindows || []).forEach((win) => {
    if (win.strikeStatus !== 1) return
    const begin = getWindowStartStr(win as Record<string, string>)
    const end = getWindowEndStr(win as Record<string, string>)
    const timeRange = `${formatFullDateTime(begin)} ~ ${formatFullDateTime(end)}`

    ;(win.weapons || []).forEach((w: Weapon) => {
      pushWeaponRecord(records, dedupe, {
        weaponName: w.name,
        weaponType: w.type,
        targetName: win.receiveName || win.receiveId,
        targetType: '接收站',
        timeRange,
        source: 'window',
      })
    })

    if (!win.weapons?.length) {
      pushWeaponRecord(records, dedupe, {
        weaponName: '电磁干扰',
        targetName: win.receiveName || win.receiveId,
        targetType: '接收站',
        timeRange,
        source: 'window',
      })
    }
  })

  return records
}

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
