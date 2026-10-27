import type { MessageType } from 'worker-module'
/**
 * 创建图计算 Worker。模块类型，入口为 `src/workers/graph.worker.ts`。
 *
 * @returns 尚未发送消息的 Worker
 */
export function createGraphWorker() {
  return new Worker(new URL('@/workers/graph.worker.ts', import.meta.url), {
    type: 'module',
  })
}
/**
 * 向图计算 Worker 投递一条类型化消息。不等待回包，结果由调用方监听 `message`。
 *
 * @param worker {@link createGraphWorker} 创建的 Worker
 * @param message 与 Worker 协议一致的消息体
 */
export function SendToWorker<T extends MessageType>(worker: Worker, message: T) {
  worker.postMessage(message)
}
