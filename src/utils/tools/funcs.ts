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
 * 模拟进度条
 * @param start
 * @param end
 * @param duration
 * @param percentage
 */
export function simulateProgress(start: number, end: number, duration: number, percentage: Ref<number>) {
  let startTime: any = null
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
 * 圆环进度条
 * @param finishdCount
 * @param sumCount
 * @param percentage
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
 * 获取服务器图谱地址
 * @param imgUrl 图谱路径
 * @returns
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

const isPlainObject = (v: any): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v)
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
// 自定义格式 YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export { getDaysAgo, formatDate }
