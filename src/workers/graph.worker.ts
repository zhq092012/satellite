/// <reference lib="webworker">
import type { SixGraphTuple } from '@/types/graph-manage'
import type { MessageType } from 'worker-module'
/**
 * worker 异步处理数据
 * @param data 原始数据
 * @returns 处理后的数据
 */
function processInChunks(data: { pageNo: number; sixtuples: SixGraphTuple[] }) {
  const chunkSize = 1000
  for (let i = 0; i < data.sixtuples.length; i += chunkSize) {
    const chunk = data.sixtuples.slice(i, i + chunkSize)
    // 分批处理数据
    self.postMessage({
      type: 'DATA_CHUNK_PROCESSED',
      payload: chunk,
    })
  }
  self.postMessage({
    type: 'DATA_PROCESSED',
    payload: data.pageNo + 1,
  })
}

self.onmessage = (e: MessageEvent<MessageType>) => {
  switch (e.data.type) {
    case 'PROCESS_DATA':
      processInChunks(e.data.payload)
      break
  }
}
