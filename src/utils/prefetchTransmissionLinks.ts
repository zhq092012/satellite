import type { MatrixResult } from '@/api/electronic'
import {
  collectSeriesTransmissionLinks,
  hasSeriesTransmissionLinksCache,
  seedSeriesTransmissionLinksCache,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

/** 卫星数量达到该阈值时改走 Worker，避免 STARLINK 规模阻塞首屏。 */
const WORKER_PREFETCH_SAT_THRESHOLD = 80

let linkWorker: Worker | null = null
let workerRequestId = 0
const pendingWorkerRequests = new Map<
  number,
  { resolve: (links: SatelliteTransmissionLink[]) => void; reject: (error: Error) => void }
>()

/**
 * 懒创建链路预计算 Worker。
 *
 * @returns Worker 实例；当前环境不支持时返回 null
 */
const getLinkWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null
  if (linkWorker) return linkWorker
  try {
    linkWorker = new Worker(new URL('../workers/transmissionLinks.worker.ts', import.meta.url), {
      type: 'module',
    })
    linkWorker.onmessage = (
      event: MessageEvent<{ requestId: number; ok: boolean; links?: SatelliteTransmissionLink[]; error?: string }>
    ) => {
      const pending = pendingWorkerRequests.get(event.data.requestId)
      if (!pending) return
      pendingWorkerRequests.delete(event.data.requestId)
      if (event.data.ok && event.data.links) pending.resolve(event.data.links)
      else pending.reject(new Error(event.data.error || '链路 Worker 计算失败'))
    }
    linkWorker.onerror = () => {
      pendingWorkerRequests.forEach(({ reject }) => reject(new Error('链路 Worker 异常退出')))
      pendingWorkerRequests.clear()
      linkWorker?.terminate()
      linkWorker = null
    }
  } catch (error) {
    console.warn('创建传输链路 Worker 失败，回退主线程计算:', error)
    linkWorker = null
  }
  return linkWorker
}

/**
 * 通过 Worker 计算全系列传输链路。
 *
 * @param matrix 算法矩阵
 * @returns 传输链路列表
 */
const collectSeriesLinksInWorker = (matrix: MatrixResult): Promise<SatelliteTransmissionLink[]> => {
  const worker = getLinkWorker()
  if (!worker) return Promise.reject(new Error('Worker 不可用'))

  const requestId = ++workerRequestId
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(requestId, { resolve, reject })
    worker.postMessage({ requestId, matrix })
  })
}

/**
 * 在写入 Pinia 之前预热全系列链路缓存。
 * STARLINK 等大规模系列走 Worker，小系列直接主线程计算。
 *
 * @param matrix 算法矩阵
 */
export const prefetchSeriesTransmissionLinks = async (matrix: MatrixResult | null): Promise<void> => {
  if (!matrix || hasSeriesTransmissionLinksCache(matrix)) return

  const satCount = Math.max(matrix.initMatrixList?.length || 0, matrix.satelliteMatrixList?.length || 0)
  try {
    if (satCount >= WORKER_PREFETCH_SAT_THRESHOLD) {
      const links = await collectSeriesLinksInWorker(matrix)
      seedSeriesTransmissionLinksCache(matrix, links)
      return
    }
  } catch (error) {
    console.warn('Worker 预计算传输链路失败，回退主线程:', error)
  }

  collectSeriesTransmissionLinks(matrix)
}
