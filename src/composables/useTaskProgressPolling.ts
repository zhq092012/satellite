import { reactive } from 'vue'
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

/**
 * WebSocket 推送的进度载荷，与后端实际报文对齐。
 * 示例：`{"_id":"...","taskId":113,"threatAndStrikeStatus":"进行中","totalStatus":"进行中","transitMin":1.7,"transitStatus":"完成"}`
 */
interface TaskProgressWsPayload {
  /** Mongo 文档 ID */
  _id?: string
  /** 任务 ID */
  taskId?: number | string
  /** 总体计算状态 */
  totalStatus?: string
  /** 过境计算状态 */
  transitStatus?: string
  /** 过境耗时（分钟） */
  transitMin?: number
  /** 总体耗时（分钟） */
  totalMin?: number
  /** 威胁与打击计算状态 */
  threatAndStrikeStatus?: string
  /** 威胁与打击耗时（分钟） */
  threatAndStrikeMin?: number
  /** 进度描述 */
  mes?: string | null
}

/** 各任务 ID 对应的最新进度快照（模块级共享，供态势页监听进度完成）。 */
export const taskProgressMap = reactive<Record<number, TaskProgressInfo>>({})

/** 各任务 ID 对应的进度 WebSocket 连接。 */
const taskProgressSocketMap = new Map<number, WebSocket>()

/** 用户主动关闭或任务完成后不再自动重连的任务集合。 */
const taskProgressStopSet = new Set<number>()

/** 各任务重连定时器。 */
const taskProgressReconnectTimerMap = new Map<number, ReturnType<typeof setTimeout>>()

/** 重连间隔（毫秒）。 */
const TASK_PROGRESS_RECONNECT_MS = 3000

declare global {
  interface Window {
    /**
     * 部署期可选覆盖项。若 nginx 不便代理 /ws，可在页面注入：
     * `window.__APP_RUNTIME__ = { wsUrl: 'ws://新地址:端口/ws' }`
     */
    __APP_RUNTIME__?: {
      /** 任务进度 WebSocket 完整或相对地址 */
      wsUrl?: string
    }
  }
}

/**
 * 解析任务进度 WebSocket 地址。
 * 优先级：运行时 `window.__APP_RUNTIME__.wsUrl` > 打包时 `VITE_WS_URL` > `/ws`。
 * 相对路径走当前页面协议，便于 nginx 反向代理。
 *
 * @param taskId 任务 ID，会作为 query 参数附加到地址上
 * @returns 可直接传入 `WebSocket` 的地址
 */
const resolveTaskProgressWsUrl = (taskId: number): string => {
  const configured = window.__APP_RUNTIME__?.wsUrl || import.meta.env.VITE_WS_URL || '/ws'
  const url = /^wss?:\/\//i.test(configured)
    ? new URL(configured)
    : new URL(configured, window.location.origin)

  if (url.protocol === 'https:') url.protocol = 'wss:'
  if (url.protocol === 'http:') url.protocol = 'ws:'
  url.searchParams.set('taskId', String(taskId))
  return url.toString()
}

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
 * 清除指定任务的重连定时器。
 *
 * @param taskId 任务 ID
 */
const clearTaskProgressReconnectTimer = (taskId: number): void => {
  const timer = taskProgressReconnectTimerMap.get(taskId)
  if (!timer) return
  clearTimeout(timer)
  taskProgressReconnectTimerMap.delete(taskId)
}

/**
 * 关闭指定任务的 WebSocket（不触发自动重连）。
 *
 * @param taskId 任务 ID
 */
export const stopTaskProgressPolling = (taskId: number): void => {
  taskProgressStopSet.add(taskId)
  clearTaskProgressReconnectTimer(taskId)
  const socket = taskProgressSocketMap.get(taskId)
  if (!socket) return
  socket.onopen = null
  socket.onmessage = null
  socket.onerror = null
  socket.onclose = null
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close()
  }
  taskProgressSocketMap.delete(taskId)
}

/**
 * 关闭全部任务进度 WebSocket。
 */
export const stopAllTaskProgressPolling = (): void => {
  const taskIds = [...taskProgressSocketMap.keys()]
  taskIds.forEach((taskId) => stopTaskProgressPolling(taskId))
}

/**
 * 从 WebSocket 原始文本中解析进度对象。
 * 后端可能直接推 JSON 对象，也可能再包一层字符串（`JSON.stringify` 两次）。
 *
 * @param raw 服务端推送文本
 * @returns 含 taskId / totalStatus / transitStatus / threatAndStrikeStatus 的载荷；无法识别时返回 null
 */
const parseTaskProgressWsMessage = (raw: string): TaskProgressWsPayload | null => {
  const text = raw.trim()
  if (!text) return null

  try {
    let parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const payload = parsed as TaskProgressWsPayload
    if (
      payload.taskId == null &&
      payload.totalStatus == null &&
      payload.transitStatus == null &&
      payload.threatAndStrikeStatus == null
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

/**
 * 将 WebSocket 载荷写入进度快照；完成后自动关闭连接。
 *
 * @param fallbackTaskId 连接时绑定的任务 ID（消息未带 taskId 时使用）
 * @param payload 解析后的进度载荷
 */
const applyTaskProgressPayload = (fallbackTaskId: number, payload: TaskProgressWsPayload): void => {
  const totalStatus = payload.totalStatus
  const transitStatus = payload.transitStatus
  const threatAndStrikeStatus = payload.threatAndStrikeStatus
  if (!totalStatus && !transitStatus && !threatAndStrikeStatus && payload.mes == null) return

  const taskId = Number(payload.taskId ?? fallbackTaskId)
  if (!Number.isFinite(taskId)) return

  const previous = taskProgressMap[taskId]
  taskProgressMap[taskId] = {
    totalStatus: totalStatus ?? previous?.totalStatus ?? '进行中',
    transitStatus: transitStatus ?? previous?.transitStatus ?? '进行中',
    threatAndStrikeStatus: threatAndStrikeStatus ?? previous?.threatAndStrikeStatus ?? '进行中',
    mes: payload.mes ?? previous?.mes,
  }

  if (isTaskProgressComplete(taskProgressMap[taskId])) {
    stopTaskProgressPolling(taskId)
  }
}

/**
 * 建立指定任务的进度 WebSocket，并在异常断开时自动重连。
 *
 * @param taskId 任务 ID
 */
const connectTaskProgressSocket = (taskId: number): void => {
  if (taskProgressStopSet.has(taskId)) return

  const existing = taskProgressSocketMap.get(taskId)
  if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
    return
  }

  const socket = new WebSocket(resolveTaskProgressWsUrl(taskId))
  taskProgressSocketMap.set(taskId, socket)

  socket.onopen = () => {
    if (socket.readyState !== WebSocket.OPEN) return
    /**
     * 连接后发送订阅消息，兼容「query 参数 + 消息体」两种后端约定。
     */
    socket.send(JSON.stringify({ action: 'subscribe', type: 'subscribe', taskId }))
  }

  socket.onmessage = (event) => {
    const payload = parseTaskProgressWsMessage(String(event.data ?? ''))
    if (!payload) return
    applyTaskProgressPayload(taskId, payload)
  }

  socket.onerror = () => {
    /**
     * 错误会随后触发 close；在此仅记录，避免重复重连。
     */
  }

  socket.onclose = () => {
    if (taskProgressSocketMap.get(taskId) === socket) {
      taskProgressSocketMap.delete(taskId)
    }
    if (taskProgressStopSet.has(taskId) || isTaskProgressComplete(taskProgressMap[taskId])) return

    clearTaskProgressReconnectTimer(taskId)
    const timer = setTimeout(() => {
      taskProgressReconnectTimerMap.delete(taskId)
      connectTaskProgressSocket(taskId)
    }, TASK_PROGRESS_RECONNECT_MS)
    taskProgressReconnectTimerMap.set(taskId, timer)
  }
}

/**
 * 启动指定任务的进度订阅（WebSocket 推送，完成后自动关闭）。
 *
 * @param taskId 任务 ID
 */
export const startTaskProgressPolling = async (taskId: number): Promise<void> => {
  stopTaskProgressPolling(taskId)
  taskProgressStopSet.delete(taskId)
  taskProgressMap[taskId] = {
    totalStatus: '进行中',
    transitStatus: '进行中',
    threatAndStrikeStatus: '进行中',
    mes: '任务后台计算中',
  }
  connectTaskProgressSocket(taskId)
}

/**
 * 根据任务列表恢复未完成任务的进度订阅。
 *
 * @param tasks 任务列表
 */
export const resumeTaskProgressPollingForTasks = async (tasks: TaskForm[]): Promise<void> => {
  for (const task of tasks) {
    if (!task.id) continue

    const cached = taskProgressMap[task.id]
    const entity = task.algorithmProgressEntity
    if (isTaskProgressComplete(cached) || isTaskProgressComplete(entity as unknown as TaskProgressInfo)) continue

    const shouldWatch =
      !!cached ||
      (entity &&
        (entity.totalStatus !== '完成' ||
          entity.transitStatus !== '完成' ||
          entity.threatAndStrikeStatus !== '完成'))

    if (shouldWatch) {
      await startTaskProgressPolling(task.id)
    }
  }
}

/**
 * 任务后台算法进度订阅组合式函数。
 *
 * @returns 进度状态与 WebSocket 控制方法
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
