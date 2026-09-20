import type { Ref } from 'vue'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { MatrixResult } from '@/api/electronic'
import type { SatelliteAnalysisData } from '@/api/task/task'
import {
  buildSatelliteDeductionBundle,
  resolveLevelSeriesEntityForNorad,
  type DeductionToastLine,
  type SatelliteDeductionEvent,
  type SatelliteDeductionVisualPlan,
} from '@/utils/buildSatelliteDeductionTimeline'

/** 推演播放阶段 */
export type SatelliteDeductionPhase = 'idle' | 'pausedAtEvent' | 'jumpingToNext'

/** 事件点停留时长（毫秒） */
export const DEDUCTION_EVENT_PAUSE_MS = 2000

/** 事件之间时钟插值时长（毫秒） */
export const DEDUCTION_JUMP_DURATION_MS = 3000

/**
 * 选中卫星 Cesium 推演播放：在事件点暂停并展示提示，事件间插值推进 currentTimeMs。
 *
 * @param currentTimeMs 与地球/时间轴共享的当前时刻
 * @returns 推演状态与控制方法
 */
export function useSatelliteDeductionPlayback(currentTimeMs: Ref<number>) {
  /** 是否正在推演播放 */
  const isDeductionPlaying = ref(false)

  /** 当前推演阶段 */
  const phase = ref<SatelliteDeductionPhase>('idle')

  /** 当前事件索引 */
  const currentEventIndex = ref(-1)

  /** 提示框高亮文案行 */
  const toastHighlightLines = ref<DeductionToastLine[]>([])

  /** 推演 Cesium 视觉计划 */
  const deductionVisualPlan = ref<SatelliteDeductionVisualPlan | null>(null)

  /** 兼容旧模板：纯文本行 */
  const toastLines = computed(() =>
    toastHighlightLines.value.map((line) => line.segments.map((segment) => segment.text).join(''))
  )

  /** 当前事件序列 */
  let events: SatelliteDeductionEvent[] = []

  /** 事件暂停定时器 */
  let pauseTimerId: ReturnType<typeof setTimeout> | null = null

  /** 插值动画 RAF */
  let jumpRafId: number | null = null

  /** 播放代际 token，用于丢弃过期异步步骤 */
  let playToken = 0

  /**
   * 清除所有定时器与动画帧。
   */
  const clearTimers = () => {
    if (pauseTimerId != null) {
      clearTimeout(pauseTimerId)
      pauseTimerId = null
    }
    if (jumpRafId != null) {
      cancelAnimationFrame(jumpRafId)
      jumpRafId = null
    }
  }

  /**
   * 停止推演并重置播放状态（保留最后一帧提示与时刻）。
   */
  const stopDeduction = () => {
    playToken += 1
    clearTimers()
    isDeductionPlaying.value = false
    phase.value = 'idle'
    currentEventIndex.value = -1
    events = []
    deductionVisualPlan.value = null
  }

  /**
   * 完全清空推演 UI（换星/清除选中时）。
   */
  const resetDeductionUi = () => {
    stopDeduction()
    toastHighlightLines.value = []
  }

  /**
   * 在指定事件索引处暂停并展示文案。
   *
   * @param index 事件索引
   * @param token 播放代际
   * @returns Promise，在停留结束后 resolve
   */
  const pauseAtEvent = (index: number, token: number): Promise<void> => {
    return new Promise((resolve) => {
      if (token !== playToken || !isDeductionPlaying.value) {
        resolve()
        return
      }

      const event = events[index]
      if (!event) {
        resolve()
        return
      }

      currentEventIndex.value = index
      currentTimeMs.value = event.atMs
      toastHighlightLines.value = event.highlightLines.map((line) => ({
        segments: line.segments.map((segment) => ({ ...segment })),
      }))
      phase.value = 'pausedAtEvent'

      pauseTimerId = setTimeout(() => {
        pauseTimerId = null
        resolve()
      }, DEDUCTION_EVENT_PAUSE_MS)
    })
  }

  /**
   * 在固定时长内将 currentTimeMs 从 fromMs 线性插值到 toMs。
   *
   * @param fromMs 起点毫秒
   * @param toMs 终点毫秒
   * @param token 播放代际
   * @returns Promise，插值结束后 resolve
   */
  const animateTimeJump = (fromMs: number, toMs: number, token: number): Promise<void> => {
    return new Promise((resolve) => {
      if (token !== playToken || !isDeductionPlaying.value) {
        resolve()
        return
      }

      phase.value = 'jumpingToNext'
      const startWall = performance.now()

      const tick = (now: number) => {
        if (token !== playToken || !isDeductionPlaying.value) {
          jumpRafId = null
          resolve()
          return
        }

        const ratio = Math.min(1, (now - startWall) / DEDUCTION_JUMP_DURATION_MS)
        currentTimeMs.value = fromMs + (toMs - fromMs) * ratio

        if (ratio >= 1) {
          currentTimeMs.value = toMs
          jumpRafId = null
          resolve()
          return
        }

        jumpRafId = requestAnimationFrame(tick)
      }

      jumpRafId = requestAnimationFrame(tick)
    })
  }

  /**
   * 顺序执行推演事件流。
   *
   * @param token 播放代际
   */
  const runPlaybackLoop = async (token: number) => {
    if (!events.length) return

    for (let i = 0; i < events.length; i += 1) {
      await pauseAtEvent(i, token)
      if (token !== playToken || !isDeductionPlaying.value) return

      if (i < events.length - 1) {
        await animateTimeJump(events[i].atMs, events[i + 1].atMs, token)
        if (token !== playToken || !isDeductionPlaying.value) return
      }
    }

    if (token === playToken) {
      isDeductionPlaying.value = false
      phase.value = 'idle'
    }
  }

  /**
   * 开始选中卫星推演播放。
   *
   * @param norad 卫星 NORAD
   * @param analysisData 任务分析数据
   * @param matrixFallback 当前系列矩阵（分析数据未命中时兜底）
   * @returns 是否成功启动
   */
  const startDeduction = (
    norad: number,
    analysisData: SatelliteAnalysisData | null,
    matrixFallback?: MatrixResult | null
  ): boolean => {
    if (!norad) return false

    const entity = resolveLevelSeriesEntityForNorad(norad, analysisData, matrixFallback)
    if (!entity) {
      ElMessage.warning('未找到该卫星的矩阵数据，无法推演')
      return false
    }

    const bundle = buildSatelliteDeductionBundle(entity, norad, matrixFallback)
    if (!bundle?.events.length) {
      ElMessage.warning('无可推演事件')
      return false
    }

    stopDeduction()
    events = bundle.events
    deductionVisualPlan.value = bundle.visualPlan
    const token = ++playToken
    isDeductionPlaying.value = true
    currentTimeMs.value = bundle.events[0].atMs
    void runPlaybackLoop(token)
    return true
  }

  return {
    isDeductionPlaying,
    phase,
    currentEventIndex,
    toastHighlightLines,
    toastLines,
    deductionVisualPlan,
    startDeduction,
    stopDeduction,
    resetDeductionUi,
  }
}
