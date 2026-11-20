import type { SatelliteAssembleTreeNode, SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import {
  buildSatelliteAssembleTreeNodes,
  indexSatelliteTreeResources,
  type SatelliteTreeResourceMeta,
} from '@/utils/satelliteResourceTree'

/** Worker 请求入参 */
interface BuildTreeMessage {
  /** 与主线程派发顺序对应的请求 ID */
  requestId: number
  /** 卫星资源树 API 原始国家根列表 */
  roots: SatelliteTreeCountryNode[]
  /** 允许的体系（侦察 / 通信等） */
  allowedSystems: string[]
}

/** Worker 成功回包 */
interface BuildTreeSuccess {
  requestId: number
  ok: true
  nodes: SatelliteAssembleTreeNode[]
  indexEntries: Array<[string, SatelliteTreeResourceMeta]>
}

/** Worker 失败回包 */
interface BuildTreeFailure {
  requestId: number
  ok: false
  error: string
}

/**
 * 卫星装配资源树构建 Worker。
 * 将 API 原始数据转换为 el-tree 节点并建立 resourceId 索引，避免大国家在主线程长时间阻塞。
 */
self.onmessage = (event: MessageEvent<BuildTreeMessage>) => {
  const { requestId, roots, allowedSystems } = event.data || {}
  try {
    if (!Array.isArray(roots)) {
      throw new Error('卫星树 Worker 入参 roots 无效')
    }
    const nodes = buildSatelliteAssembleTreeNodes(roots, allowedSystems ?? [])
    const index = indexSatelliteTreeResources(nodes)
    const payload: BuildTreeSuccess = {
      requestId,
      ok: true,
      nodes,
      indexEntries: [...index.entries()],
    }
    self.postMessage(payload)
  } catch (error) {
    const payload: BuildTreeFailure = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(payload)
  }
}