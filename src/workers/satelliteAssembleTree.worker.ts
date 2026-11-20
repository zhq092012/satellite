import type { SatelliteAssembleTreeNode, SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import type { TaskResourceItem } from '@/types/task/task'
import {
  buildSatelliteAssembleTreeNodesToSeries,
  buildSeriesSatelliteInventoryFromApiRoots,
  collectSeriesDescriptorsFromAssembleNodes,
  computeAssembleSeriesCheckStates,
  type AssembleSeriesCheckStateEntry,
} from '@/utils/satelliteResourceTree'

/** Worker 请求入参 */
interface BuildTreeMessage {
  /** 与主线程派发顺序对应的请求 ID */
  requestId: number
  /** 卫星资源树 API 原始国家根列表 */
  roots: SatelliteTreeCountryNode[]
  /** 允许的体系（侦察 / 通信等） */
  allowedSystems: string[]
  /** 当前任务已选卫星（用于勾选态计算，与树节点分离） */
  taskSatellites: TaskResourceItem[]
}

/** Worker 成功回包（支持分片渐进返回国家节点） */
interface BuildTreeSuccess {
  requestId: number
  ok: true
  /** 是否为渐进分片（末包为 false） */
  partial: boolean
  /** 当前已构建的国家根节点（逐包递增） */
  nodes: SatelliteAssembleTreeNode[]
  /** 系列勾选态（仅末包携带完整结果） */
  seriesCheckStates: AssembleSeriesCheckStateEntry[]
  /** API 系列卫星清单（仅末包；供取消勾选时本地比对，不触发 search） */
  seriesInventory: Record<string, TaskResourceItem[]>
}

/** Worker 失败回包 */
interface BuildTreeFailure {
  requestId: number
  ok: false
  error: string
}

/**
 * 卫星装配资源树 Worker：渐进构建系列树 + 后台计算勾选态。
 */
self.onmessage = (event: MessageEvent<BuildTreeMessage>) => {
  const { requestId, roots, allowedSystems, taskSatellites } = event.data || {}
  try {
    if (!Array.isArray(roots)) {
      throw new Error('卫星树 Worker 入参 roots 无效')
    }
    const systems = allowedSystems ?? []
    const picked = Array.isArray(taskSatellites) ? taskSatellites : []
    const nodes = buildSatelliteAssembleTreeNodesToSeries(roots, systems)
    const inventory = buildSeriesSatelliteInventoryFromApiRoots(roots, systems)
    const descriptors = collectSeriesDescriptorsFromAssembleNodes(nodes)
    const seriesCheckStates = computeAssembleSeriesCheckStates(descriptors, picked, inventory)

    if (!nodes.length) {
      const payload: BuildTreeSuccess = {
        requestId,
        ok: true,
        partial: false,
        nodes: [],
        seriesCheckStates,
        seriesInventory: inventory,
      }
      self.postMessage(payload)
      return
    }

    for (let index = 0; index < nodes.length; index += 1) {
      const partial = index < nodes.length - 1
      const payload: BuildTreeSuccess = {
        requestId,
        ok: true,
        partial,
        nodes: nodes.slice(0, index + 1),
        seriesCheckStates: partial ? [] : seriesCheckStates,
        seriesInventory: partial ? {} : inventory,
      }
      self.postMessage(payload)
    }
  } catch (error) {
    const payload: BuildTreeFailure = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(payload)
  }
}