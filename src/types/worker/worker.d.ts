import { EdgeConfig, GraphData, NodeConfig } from '@antv/g6'
import type { SixGraphTuple, SixTuple } from '@/types/graph-manage'
declare module 'worker-module' {
  // Web Worker 消息类型
  export type MessageType =
    | { type: 'PROCESS_DATA'; payload: { pageNo: number; sixtuples: SixGraphTuple[] } }
    | { type: 'DATA_CHUNK_PROCESSED'; payload: SixGraphTuple[] }
    | { type: 'DATA_PROCESSED'; payload: number }
    | { type: 'ERROR'; error: string }
}
