import type { MatrixResult } from '@/api/electronic'
import { collectSeriesTransmissionLinks } from '@/utils/satelliteFullChainAnalysis'

/**
 * 全系列传输链路预计算 Worker。
 * 主线程把矩阵 post 进来，回传已经枚举好的链路，避免 STARLINK 规模卡住 UI。
 */
self.onmessage = (event: MessageEvent<{ requestId: number; matrix: MatrixResult }>) => {
  const { requestId, matrix } = event.data || {}
  try {
    const links = collectSeriesTransmissionLinks(matrix)
    self.postMessage({ requestId, ok: true, links })
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
