import { reactive } from 'vue'
import { queryTaskProgress } from '@/api/dashboard'
import type { TaskForm } from '@/types/dashboard'

/**
 * 任务后台算法计算进度信息。
 */
export interface TaskProgressInfo {
  /** 总体计算状态 */
  totalStatus: string
  /** 过境计算状态 */
  transitStatus: string
  /** 威胁与打击计算状态 */
  threatAndStrikeStatus: string
  /** 进度描述信息 */
  mes?: string
}

/** 各任务 ID 对应的最新进度快照。 */
const taskProgressMap = reactive<Record<number, TaskProgressInfo>>({})

/** 各任务 ID 对应的轮询定时器。 */
const taskProgressTimerMap = new Map<number, ReturnType<typeof setInterval>>()

/**
 * 判断任务进度是否三项均已完成。
 *
 * @param progress 进度对象
 * @returns 是否全部完成
 */
export const isTaskProgressComplete = (progress?: TaskProgressInfo | null): boolean => {
  if (!progress) return false
  return (
    progress.totalStatus === '完成' &&
    progress.transitStatus === '完成' &&
    progress.threatAndStrikeStatus === '完成'
  )
}

/**
 * 根据三项完成数计算进度百分比。
 *
 * @param progress 进度对象
 * @returns 0-100 的整数百分比
 */
export const getTaskProgressPercent = (progress?: TaskProgressInfo | null): number => {
  if (!progress) return 0
  const finishedCount = [progress.totalStatus, progress.transitStatus, progress.threatAndStrikeStatus].filter(
    (status) => status === '完成'
  ).length
  return Math.round((finishedCount / 3) * 100)
}

/**
 * 停止指定任务的进度轮询。
 *
 * @param taskId 任务 ID
 */
export const stopTaskProgressPolling = (taskId: number): void => {
  const timer = taskProgressTimerMap.get(taskId)
  if (!timer) return
  clearInterval(timer)
  taskProgressTimerMap.delete(taskId)
}

/**
 * 停止全部任务进度轮询。
 */
export const stopAllTaskProgressPolling = (): void => {
  taskProgressTimerMap.forEach((timer) => clearInterval(timer))
  taskProgressTimerMap.clear()
}

/**
 * 拉取并更新单个任务的进度；完成后自动停止轮询。
 *
 * @param taskId 任务 ID
 */
export const updateTaskProgress = async (taskId: number): Promise<void> => {
  const res = await queryTaskProgress(taskId)
  if (res.code !== 200) return

  taskProgressMap[taskId] = {
    totalStatus: res.data.totalStatus,
    transitStatus: res.data.transitStatus,
    threatAndStrikeStatus: res.data.threatAndStrikeStatus,
    mes: res.data.mes,
  }

  if (isTaskProgressComplete(taskProgressMap[taskId])) {
    stopTaskProgressPolling(taskId)
  }
}

/**
 * 启动指定任务的进度轮询（默认每 3 秒查询一次）。
 *
 * @param taskId 任务 ID
 */
export const startTaskProgressPolling = async (taskId: number): Promise<void> => {
  stopTaskProgressPolling(taskId)
  taskProgressMap[taskId] = {
    totalStatus: '进行中',
    transitStatus: '进行中',
    threatAndStrikeStatus: '进行中',
    mes: '任务后台计算中',
  }
  await updateTaskProgress(taskId)

  const timer = setInterval(() => {
    void updateTaskProgress(taskId)
  }, 3000)
  taskProgressTimerMap.set(taskId, timer)
}

/**
 * 根据任务列表恢复未完成任务的进度轮询。
 *
 * @param tasks 任务列表
 */
export const resumeTaskProgressPollingForTasks = async (tasks: TaskForm[]): Promise<void> => {
  for (const task of tasks) {
    if (!task.id) continue

    const cached = taskProgressMap[task.id]
    const entity = task.algorithmProgressEntity
    if (isTaskProgressComplete(cached) || isTaskProgressComplete(entity as unknown as TaskProgressInfo)) continue

    const shouldPoll =
      !!cached ||
      (entity &&
        (entity.totalStatus !== '完成' ||
          entity.transitStatus !== '完成' ||
          entity.threatAndStrikeStatus !== '完成'))

    if (shouldPoll) {
      await startTaskProgressPolling(task.id)
    }
  }
}

/**
 * 任务后台算法进度轮询组合式函数。
 *
 * @returns 进度状态与轮询控制方法
 */
export const useTaskProgressPolling = () => {
  /**
   * 获取任务当前进度（优先内存缓存）。
   *
   * @param task 任务对象
   * @returns 进度信息；无数据时返回 undefined
   */
  const getTaskProgress = (task: TaskForm): TaskProgressInfo | undefined => {
    if (!task.id) return undefined
    return taskProgressMap[task.id] ?? task.algorithmProgressEntity ?? undefined
  }

  return {
    taskProgressMap,
    getTaskProgress,
    getTaskProgressPercent,
    isTaskProgressComplete,
    startTaskProgressPolling,
    stopTaskProgressPolling,
    stopAllTaskProgressPolling,
    resumeTaskProgressPollingForTasks,
  }
}
