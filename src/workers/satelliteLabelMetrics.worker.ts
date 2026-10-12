import {
  computeSatelliteLabelMetricTimelineFromTle,
  type SatelliteGlobeLabelMetricSample,
} from '@/utils/computeSatelliteLabelMetrics'

/** Worker 入参 */
interface SatelliteLabelMetricsWorkerRequest {
  /** 请求序号 */
  requestId: number
  /** TLE 第一行 */
  line1: string
  /** TLE 第二行 */
  line2: string
  /** 关键节点时刻（毫秒） */
  timestamps: number[]
  /** 矩阵 peak 高度覆盖：[atMs, altitudeKm][] */
  altitudeOverrides: Array<[number, number]>
}

/** Worker 出参 */
interface SatelliteLabelMetricsWorkerResponse {
  requestId: number
  ok: boolean
  samples?: SatelliteGlobeLabelMetricSample[]
  error?: string
}

/**
 * 卫星 Label 轨道指标预计算 Worker（仅在关键事件时刻传播 TLE，不占用主线程）。
 */
self.onmessage = (event: MessageEvent<SatelliteLabelMetricsWorkerRequest>) => {
  const { requestId, line1, line2, timestamps, altitudeOverrides } = event.data || {}
  try {
    const altitudeKmByAtMs = new Map<number, number>(altitudeOverrides)
    const samples = computeSatelliteLabelMetricTimelineFromTle(
      line1,
      line2,
      timestamps,
      altitudeKmByAtMs,
    )
    const response: SatelliteLabelMetricsWorkerResponse = { requestId, ok: true, samples }
    self.postMessage(response)
  } catch (error) {
    const response: SatelliteLabelMetricsWorkerResponse = {
      requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
