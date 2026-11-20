import type { SatelliteAssembleTreeNode, SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import {
  buildSatelliteAssembleTreeNodes,
  indexSatelliteTreeResources,
  type SatelliteTreeResourceMeta,
} from '@/utils/satelliteResourceTree'

/** Worker 构建结果（索引以可结构化克隆的键值对数组表示） */
export interface SatelliteAssembleTreeBuildResult {
  /** el-tree 节点树根 */
  nodes: SatelliteAssembleTreeNode[]
  /** `indexSatelliteTreeResources` 的 Map 条目 */
  indexEntries: Array<[string, SatelliteTreeResourceMeta]>
}

type WorkerSuccessMessage = {
  requestId: number
  ok: true
  nodes: SatelliteAssembleTreeNode[]
  indexEntries: Array<[string, SatelliteTreeResourceMeta]>
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
      pendingWorkerRequests.delete(event.data.requestId)
      if (event.data.ok) {
        pending.resolve({
          nodes: event.data.nodes,
          indexEntries: event.data.indexEntries,
        })
        return
      }
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
 * 在 Worker 中构建卫星装配树与索引。
 *
 * @param roots 资源树 API 数据
 * @param allowedSystems 允许的体系列表
 */
const buildInWorker = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): Promise<SatelliteAssembleTreeBuildResult> => {
  const worker = getAssembleTreeWorker()
  if (!worker) {
    return Promise.reject(new Error('Worker 不可用'))
  }
  const requestId = ++workerRequestId
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(requestId, { resolve, reject })
    worker.postMessage({ requestId, roots, allowedSystems })
  })
}

/**
 * 主线程同步构建（Worker 不可用或失败时的回退）。
 *
 * @param roots 资源树 API 数据
 * @param allowedSystems 允许的体系列表
 */
const buildOnMainThread = (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): SatelliteAssembleTreeBuildResult => {
  const nodes = buildSatelliteAssembleTreeNodes(roots, allowedSystems)
  const index = indexSatelliteTreeResources(nodes)
  return { nodes, indexEntries: [...index.entries()] }
}

/**
 * 在后台 Worker 中构建卫星装配树；失败时回退主线程同步构建。
 *
 * @param roots 资源树 API 数据
 * @param allowedSystems 允许的体系列表
 */
export const buildSatelliteAssembleTreeInBackground = async (
  roots: SatelliteTreeCountryNode[],
  allowedSystems: string[],
): Promise<SatelliteAssembleTreeBuildResult> => {
  try {
    return await buildInWorker(roots, allowedSystems)
  } catch (error) {
    console.warn('卫星装配树 Worker 计算失败，回退主线程:', error)
    return buildOnMainThread(roots, allowedSystems)
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