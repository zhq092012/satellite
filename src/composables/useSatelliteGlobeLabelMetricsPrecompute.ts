import type { SatelliteAnalysisData } from '@/api/task/task'
import type { BattleGlobeSatellite } from '@/utils/buildBattleGlobeSatellites'
import {
  buildMatrixPeakAltitudeOverrides,
  canPrecomputeSatelliteLabelMetrics,
  collectSatelliteLabelMetricTimestamps,
  computeSatelliteLabelMetricTimelineFromTle,
  findEntityForSatelliteLabelMetrics,
  findSatelliteMatrixRowsForNorad,
  pickSatelliteLabelMetricSampleForPlayhead,
  resolveNextStationTransitLabel,
  toSatelliteGlobeLabelDisplayMetrics,
  type SatelliteGlobeLabelDisplayMetrics,
  type SatelliteGlobeLabelMetricSample,
} from '@/utils/computeSatelliteLabelMetrics'
import { onBeforeUnmount, type Ref } from 'vue'

/** 单颗卫星预计算结果 */
interface NoradMetricCacheEntry {
  /** 预计算时间轴 */
  samples: SatelliteGlobeLabelMetricSample[]
  /** 预计算时的 TLE 指纹，用于失效判断 */
  tleKey: string
}

let metricsWorker: Worker | null = null
let workerRequestId = 0
const pendingWorkerRequests = new Map<
  number,
  {
    norad: number
    tleKey: string
    resolve: (samples: SatelliteGlobeLabelMetricSample[]) => void
    reject: (error: Error) => void
  }
>()

/**
 * 懒创建卫星 Label 指标 Worker。
 *
 * @returns Worker；环境不支持时 null
 */
const getSatelliteLabelMetricsWorker = (): Worker | null => {
  if (typeof Worker === 'undefined') return null
  if (metricsWorker) return metricsWorker
  try {
    metricsWorker = new Worker(
      new URL('../workers/satelliteLabelMetrics.worker.ts', import.meta.url),
      { type: 'module' },
    )
    metricsWorker.onmessage = (
      event: MessageEvent<{
        requestId: number
        ok: boolean
        samples?: SatelliteGlobeLabelMetricSample[]
        error?: string
      }>,
    ) => {
      const pending = pendingWorkerRequests.get(event.data.requestId)
      if (!pending) return
      pendingWorkerRequests.delete(event.data.requestId)
      if (event.data.ok && event.data.samples) {
        pending.resolve(event.data.samples)
        return
      }
      pending.reject(new Error(event.data.error || '卫星 Label 指标 Worker 计算失败'))
    }
    metricsWorker.onerror = () => {
      pendingWorkerRequests.forEach(({ reject }) => reject(new Error('卫星 Label 指标 Worker 异常退出')))
      pendingWorkerRequests.clear()
      metricsWorker?.terminate()
      metricsWorker = null
    }
  } catch (error) {
    console.warn('创建卫星 Label 指标 Worker 失败，将回退主线程计算:', error)
    metricsWorker = null
  }
  return metricsWorker
}

/**
 * 在 Worker 或主线程上预计算关键节点指标。
 *
 * @param norad 卫星 NORAD
 * @param line1 TLE 第一行
 * @param line2 TLE 第二行
 * @param timestamps 时刻列表
 * @param altitudeOverrides 矩阵 peak 高度覆盖
 */
const runSatelliteLabelMetricsPrecompute = (
  norad: number,
  line1: string,
  line2: string,
  timestamps: number[],
  altitudeOverrides: Map<number, number>,
): Promise<SatelliteGlobeLabelMetricSample[]> => {
  const tleKey = `${line1}\n${line2}`
  const worker = getSatelliteLabelMetricsWorker()
  if (!worker) {
    return Promise.resolve(
      computeSatelliteLabelMetricTimelineFromTle(line1, line2, timestamps, altitudeOverrides),
    )
  }

  const requestId = ++workerRequestId
  return new Promise((resolve, reject) => {
    pendingWorkerRequests.set(requestId, { norad, tleKey, resolve, reject })
    worker.postMessage({
      requestId,
      line1,
      line2,
      timestamps,
      altitudeOverrides: [...altitudeOverrides.entries()],
    })
  })
}

/**
 * 选中卫星 Label 轨道指标：关键节点预计算 + 播放头查表（渲染与传播分离）。
 *
 * @param taskAnalysisDataRef 任务分析数据
 * @param globeSatellitesRef 地球卫星列表
 * @param taskStartMsRef 任务开始毫秒
 * @param taskEndMsRef 任务结束毫秒
 */
export const useSatelliteGlobeLabelMetricsPrecompute = (
  taskAnalysisDataRef: Ref<SatelliteAnalysisData | null | undefined>,
  globeSatellitesRef: Ref<BattleGlobeSatellite[]>,
  taskStartMsRef: Ref<number>,
  taskEndMsRef: Ref<number>,
) => {
  const cacheByNorad = new Map<number, NoradMetricCacheEntry>()
  let activePrecomputeToken = 0
  let inFlightNorad: number | null = null

  /**
   * 为指定卫星调度预计算（仅关键事件时刻）。
   *
   * @param norad 卫星 NORAD
   * @param anchorMs 当前播放头，纳入节点集合
   */
  const schedulePrecomputeForNorad = async (norad: number, anchorMs: number): Promise<void> => {
    const sat = globeSatellitesRef.value.find((item) => item.norad === norad)
    if (!sat || !canPrecomputeSatelliteLabelMetrics(sat.line1, sat.line2)) {
      cacheByNorad.delete(norad)
      return
    }

    const entity = findEntityForSatelliteLabelMetrics(taskAnalysisDataRef.value, norad)
    const timestamps = collectSatelliteLabelMetricTimestamps({
      norad,
      entity,
      taskStartMs: taskStartMsRef.value,
      taskEndMs: taskEndMsRef.value,
      anchorMs,
    })
    if (!timestamps.length) return

    const tleKey = `${sat.line1}\n${sat.line2}`
    const cached = cacheByNorad.get(norad)
    if (cached && cached.tleKey === tleKey && cached.samples.length === timestamps.length) {
      const sameTimeline = cached.samples.every((sample, index) => sample.atMs === timestamps[index])
      if (sameTimeline) return
    }

    const token = ++activePrecomputeToken
    inFlightNorad = norad
    const { initSat } = findSatelliteMatrixRowsForNorad(entity, norad)
    const altitudeOverrides = buildMatrixPeakAltitudeOverrides(initSat)

    try {
      const samples = await runSatelliteLabelMetricsPrecompute(
        norad,
        sat.line1,
        sat.line2,
        timestamps,
        altitudeOverrides,
      )
      if (token !== activePrecomputeToken) return
      cacheByNorad.set(norad, { samples, tleKey })
    } catch (error) {
      console.error(`卫星 NORAD ${norad} Label 指标预计算失败:`, error)
    } finally {
      if (inFlightNorad === norad) inFlightNorad = null
    }
  }

  /**
   * 解析播放头处的 Label 指标（仅查表 + 矩阵下次过境，不在此传播 TLE）。
   *
   * @param norad 卫星 NORAD
   * @param playheadMs 播放头毫秒
   */
  const resolveDisplayMetricsAtPlayhead = (
    norad: number,
    playheadMs: number,
  ): SatelliteGlobeLabelDisplayMetrics | null => {
    const entry = cacheByNorad.get(norad)
    if (!entry?.samples.length) return null
    const sample = pickSatelliteLabelMetricSampleForPlayhead(entry.samples, playheadMs)
    if (!sample) return null
    const entity = findEntityForSatelliteLabelMetrics(taskAnalysisDataRef.value, norad)
    const nextTransitLabel = resolveNextStationTransitLabel(entity, norad, playheadMs)
    return toSatelliteGlobeLabelDisplayMetrics(sample, nextTransitLabel)
  }

  /** 清除缓存（任务切换等） */
  const clearSatelliteLabelMetricsCache = () => {
    activePrecomputeToken += 1
    cacheByNorad.clear()
    inFlightNorad = null
  }

  onBeforeUnmount(() => {
    activePrecomputeToken += 1
    pendingWorkerRequests.forEach(({ reject }) => reject(new Error('组件已卸载')))
    pendingWorkerRequests.clear()
    metricsWorker?.terminate()
    metricsWorker = null
  })

  return {
    schedulePrecomputeForNorad,
    resolveDisplayMetricsAtPlayhead,
    clearSatelliteLabelMetricsCache,
  }
}
