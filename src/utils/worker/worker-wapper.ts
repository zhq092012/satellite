import type { MessageType } from 'worker-module'
/**
 * 创建Worker
 * @returns GraphWorker
 */
export function createGraphWorker() {
  return new Worker(new URL('@/workers/graph.worker.ts', import.meta.url), {
    type: 'module',
  })
}
/**
 * worker通信
 * @param worker worker
 * @param message 消息
 */
export function SendToWorker<T extends MessageType>(worker: Worker, message: T) {
  worker.postMessage(message)
}
