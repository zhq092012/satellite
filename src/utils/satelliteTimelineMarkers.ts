/** 将毫秒时间戳映射到任务时间轴 0–1 区间 */
export const msToRatio = (ms: number, startMs: number, endMs: number): number => {
  const span = endMs - startMs
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (ms - startMs) / span))
}

/** 时间轴刻度展示用时间字符串 */
export const formatTimelineTime = (ms: number): string => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}