import {
  computeSatelliteLabelMetricTimelineFromTle,
  type SatelliteGlobeLabelMetricSample,
} from '@/utils/computeSatelliteLabelMetrics'
import {
  computeGroundPassStartsFromTle,
  type GroundObserverSite,
  type SatelliteGroundPassStart,
} from '@/utils/computeSatelliteGroundPass'

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
  /** 可选：地面站过境扫描 */
  passScan?: {
    startMs: number
    endMs: number
    stepSec: number
    minElevationDeg: number
    observers: GroundObserverSite[]
  }
}

/** Worker 出参 */
interface SatelliteLabelMetricsWorkerResponse {
  requestId: number
  ok: boolean
  samples?: SatelliteGlobeLabelMetricSample[]
  passStarts?: SatelliteGroundPassStart[]
  error?: string
}

/**
 * 卫星 Label 轨道指标预计算 Worker（仅在关键事件时刻传播 TLE，不占用主线程）。
 */
self.onmessage = (event: MessageEvent<SatelliteLabelMetricsWorkerRequest>) => {
  const { requestId, line1, line2, timestamps, altitudeOverrides, passScan } = event.data || {}
  try {
    const altitudeKmByAtMs = new Map<number, number>(altitudeOverrides)
    const samples = computeSatelliteLabelMetricTimelineFromTle(
      line1,
      line2,
      timestamps,
      altitudeKmByAtMs,
    )
    const passStarts =
      passScan && passScan.observers.length
        ? computeGroundPassStartsFromTle({
            line1,
            line2,
            startMs: passScan.startMs,
            endMs: passScan.endMs,
            stepSec: passScan.stepSec,
            minElevationDeg: passScan.minElevationDeg,
            observers: passScan.observers,
          })
        : []
    const response: SatelliteLabelMetricsWorkerResponse = {
      requestId,
      ok: true,
      samples,
      passStarts,
    }
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
