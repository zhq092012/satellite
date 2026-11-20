import type { SatelliteAssembleTreeNode, SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import type { TaskResourceItem } from '@/types/task/task'
import {
  buildSatelliteAssembleTreeNodesToSeries,
  buildSeriesSatelliteInventoryFromApiRoots,
  collectSeriesDescriptorsFromAssembleNodes,
  computeAssembleSeriesCheckStates,
  type AssembleSeriesCheckStateEntry,
} from '@/utils/satelliteResourceTree'

/** Worker 构建最终结果 */
export interface SatelliteAssembleTreeBuildResult {
  /** 系列树国家根（完整） */
  nodes: SatelliteAssembleTreeNode[]
  /** 各系列勾选态 */
  seriesCheckStates: AssembleSeriesCheckStateEntry[]
  /** API 快照中的系列卫星（key = country::system::series） */
  seriesInventory: Record<string, TaskResourceItem[]>
}

type WorkerSuccessMessage = {
  requestId: number
  ok: true
  partial: boolean
  nodes: SatelliteAssembleTreeNode[]
  seriesCheckStates: AssembleSeriesCheckStateEntry[]
  seriesInventory: Record<string, TaskResourceItem[]>
}

type WorkerFailureMessage = {
  requestId: number
  ok: false
  error: string
}

type WorkerResponseMessage = WorkerSuccessMessage | WorkerFailureMessage

/** 懒创建的装配树 Worker */
let assembleTreeWorker: Worker | null = null
/** 请求自增 ID */
let workerRequestId = 0
/** 进行中的 Worker 请求 */
const pendingWorkerRequests = new Map<
  number,
  {
    resolve: (result: SatelliteAssembleTreeBuildResult) => void
    reject: (error: Error) => void
    onProgress?: (nodes: SatelliteAssembleTreeNode[]) => void
  }
>()

/**
 * 懒创建卫星装配树 Worker。
 *
 * @returns Worker；环境不支持或创建失败时为 null
 */
const getAssembleTreeWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null
  if (assembleTreeWorker) return assembleTreeWorker
  try {
    assembleTreeWorker = new Worker(new URL('../workers/satelliteAssembleTree.worker.ts', import.meta.url), {
      type: 'module',
    })
    assembleTreeWorker.onmessage = (event: MessageEvent<WorkerResponseMessage>) => {
      const pending = pendingWorkerRequests.get(event.data.requestId)
      if (!pending) return
      if (event.data.ok) {
        if (event.data.nodes.length && pending.onProgress) {
          pending.onProgress(event.data.nodes)
        }
        if (!event.data.partial) {
          pendingWorkerRequests.delete(event.data.requestId)
          pending.resolve({
            nodes: event.data.nodes,
            seriesCheckStates: event.data.seriesCheckStates,
            seriesInventory: event.data.seriesInventory,
          })
        }
        return
      }
      pendingWorkerRequests.delete(event.data.requestId)
      pending.reject(new Error(event.data.error || '卫星树 Worker 计算失败'))
    }
    assembleTreeWorker.onerror = () => {
      pendingWorkerRequests.forEach(({ reject }) => reject(new Error('卫星树 Worker 异常退出')))
      pendingWorkerRequests.clear()
      assembleTreeWorker?.terminate()
      assembleTreeWorker = null
    }
  } catch (error) {
    console.warn('创建卫星装配树 Worker 失败:', error)
    assembleTreeWorker = null
  }
  return assembleTreeWorker
}

/**
 * 主线程同步构建（Worker 不可用或失败时的回退）。
 */
const buildOnMainThread = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
  taskSatellites: TaskResourceItem[],
): SatelliteAssembleTreeBuildResult => {
  const nodes = buildSatelliteAssembleTreeNodesToSeries(roots, allowedSystems)
  const inventory = buildSeriesSatelliteInventoryFromApiRoots(roots, allowedSystems)
  const descriptors = collectSeriesDescriptorsFromAssembleNodes(nodes)
  const seriesCheckStates = computeAssembleSeriesCheckStates(descriptors, taskSatellites, inventory)
  return { nodes, seriesCheckStates, seriesInventory: inventory }
}

/**
 * Worker 渐进构建系列树并计算勾选态。
 *
 * @param roots API 树
 * @param allowedSystems 体系过滤
 * @param taskSatellites 已选卫星
 * @param onProgress Worker 每追加一个国家根时的回调
 */
export const buildSatelliteAssembleTreeInBackground = async (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
  taskSatellites: TaskResourceItem[],
  onProgress?: (nodes: SatelliteAssembleTreeNode[]) => void,
): Promise<SatelliteAssembleTreeBuildResult> => {
  const worker = getAssembleTreeWorker()
  if (!worker) {
    console.warn('卫星装配树 Worker 不可用，回退主线程')
    return buildOnMainThread(roots, allowedSystems, taskSatellites)
  }
  const requestId = ++workerRequestId
  try {
    return await new Promise<SatelliteAssembleTreeBuildResult>((resolve, reject) => {
      pendingWorkerRequests.set(requestId, { resolve, reject, onProgress })
      worker.postMessage({ requestId, roots, allowedSystems, taskSatellites })
    })
  } catch (error) {
    console.warn('卫星装配树 Worker 计算失败，回退主线程:', error)
    return buildOnMainThread(roots, allowedSystems, taskSatellites)
  }
}

/**
 * 让主线程先完成一帧绘制（加载态），再挂载大树数据减轻感知卡顿。
 */
export const yieldToUiBeforeHeavyTreeMount = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 120 })
      return
    }
    requestAnimationFrame(() => resolve())
  })