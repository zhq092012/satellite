/**
 * 跨页面公共工具：数组去重、分页切片、静态资源 URL、reactive 深同步、删除确认框、日期偏移等。
 */
import { ElMessage, ElMessageBox } from 'element-plus'
import { isReactive, type Ref } from 'vue'

/**
 * 返回去重后的数组
 * @param arr 对象数组
 * @param getKey 去重key
 * @returns 去重后的数组
 */
export function duduplicateByKey<T, K extends string | number>(arr: T[], getKey: (item: T) => K): T[] {
  return arr.reduce<{ result: T[]; seen: Set<K> }>(
    (acc, currentItem) => {
      const key = getKey(currentItem)
      if (!acc.seen.has(key)) {
        acc.seen.add(key)
        acc.result.push(currentItem)
      }
      return acc
    },
    { result: [], seen: new Set<K>() } //初始值包含结果数组和已见集合
  ).result //最终返回结果数组
}
/**
 * 用 requestAnimationFrame 把进度从 start 线性涨到 end。
 *
 * @param start 起始百分比
 * @param end 结束百分比
 * @param duration 计划耗时，毫秒
 * @param percentage 接收当前整数进度的 ref
 */
export function simulateProgress(start: number, end: number, duration: number, percentage: Ref<number>) {
  let startTime: any = null
  /**
   * 按已过时间线性插值进度，未到终点时继续请求下一帧。
   */
  function updateProgress() {
    if (!startTime) startTime = Date.now()
    const elasped = Date.now() - startTime
    const progress = Math.min(start + (end - start) * (elasped / duration), end)
    percentage.value = Number(progress.toFixed(0))
    if (progress < end) {
      requestAnimationFrame(updateProgress)
    }
  }
  requestAnimationFrame(updateProgress)
}
/**
 * 按已完成数量推算圆环进度，并在两分钟内动画过渡到下一项。
 * 若算出的起点低于当前进度，则不回退。
 *
 * @param finishdCount 已经完成的数量
 * @param sumCount 总数量，为 0 时进度无意义
 * @param percentage 接收当前整数进度的 ref
 */
export function simulateExtractProgress(finishdCount: number, sumCount: number, percentage: Ref<number>) {
  const start = Math.floor((finishdCount / sumCount) * 100)
  const end = Math.floor(((finishdCount + 1) / sumCount) * 100)
  if (start < percentage.value) return
  simulateProgress(start, end, 2 * 60 * 1000, percentage)
}
/**
 * 获取分页数据
 * @param data 原始数据
 * @param _page 当前页
 * @param _page_size 每页大小
 * @returns 分页后数据
 */
export function getPageData<T>(data: T[], _page: number, _page_size: number): T[] {
  return data.slice((_page - 1) * _page_size, _page * _page_size)
}
/**
 * 拼接图谱服务根地址和相对路径。
 *
 * @param imgUrl 图谱相对路径
 * @returns `VITE_PICTURE_URL` 与路径直接相接的完整地址
 */
export function getImgServerPath(imgUrl: string) {
  return import.meta.env.VITE_PICTURE_URL + imgUrl
}
/**
 * 获取服务器多媒体地址
 * @param mediaUrl 多媒体路径
 * @returns 完整的多媒体地址
 */
export function getMediaServerPath(mediaUrl: string) {
  return import.meta.env.VITE_MEDIA_URL + mediaUrl
}
/**
 * 深度同步同名属性（Vue3 版，无需 set）
 * @param tar  目标 reactive 对象
 * @param src  来源 reactive 对象
 */
export function syncSharedDeep(tar: Record<string, any>, src: Record<string, any>): void {
  if (!isReactive(tar) || !isReactive(src)) return

  for (const key in tar) {
    if (!(key in src)) continue

    const tarVal = tar[key]
    const srcVal = src[key]

    // 双方都是对象（或数组）→ 递归
    if (isPlainObject(tarVal) && isPlainObject(srcVal)) {
      syncSharedDeep(tarVal, srcVal)
      continue
    }

    // 基本类型或仅一方为对象 → 直接赋值即可触发响应式
    if (tarVal !== srcVal) {
      tar[key] = srcVal
    }
  }
}

/**
 * 判断值是否为可递归同步的普通对象。数组不算，避免把列表下标当成字段去合并。
 *
 * @param v 任意值
 * @returns 非 null 的普通对象时为 true
 */
const isPlainObject = (v: any): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * 弹出 Element Plus 删除确认框，确认后执行回调。
 *
 * @param func 用户确认删除后执行的逻辑
 */
export function elConfirm(func: () => void) {
  ElMessageBox.confirm('删除后无法恢复，是否继续删除?', '警告！', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      func()
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '用户取消删除',
      })
    })
}

// 任务时间往前推一周
/**
 * 获取指定天数前的日期
 * @param {number} days 天数（默认7天）
 * @param {Date} fromDate 起始日期（默认当前时间）
 * @returns {Date} 计算后的日期
 */
function getDaysAgo(days = 7, fromDate = new Date()) {
  return new Date(fromDate.getTime() - days * 24 * 60 * 60 * 1000)
}
/**
 * 将日期格式化为 `YYYY-MM-DD`。
 *
 * @param date 日期对象
 * @returns 本地时区的日期字符串
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export { getDaysAgo, formatDate }
