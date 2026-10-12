/** 地球资源详情 Label 最大内容宽度（像素） */
export const GLOBE_DETAIL_LABEL_MAX_WIDTH_PX = 300

/** 详情 Label 假定字号（与 Cesium / DOM 一致） */
export const GLOBE_DETAIL_LABEL_FONT_SIZE_PX = 12

/** 详情 Label 展示结果 */
export interface GlobeDetailLabelDisplay {
  /** 用于 DOM 展示的多行文本（超长行带 …） */
  displayText: string
  /** 完整原文（Tooltip） */
  fullText: string
  /** 是否存在截断 */
  truncated: boolean
}

/**
 * 估算单行文本在指定字号下的像素宽度（中文按全角、ASCII 按半角）。
 *
 * @param text 文本
 * @param fontPx 字号
 * @returns 估算宽度（px）
 */
export const estimateGlobeDetailLabelTextWidthPx = (text: string, fontPx: number): number => {
  let width = 0
  for (const ch of text) {
    width += ch.charCodeAt(0) > 255 ? fontPx : fontPx * 0.55
  }
  return width
}

/**
 * 将单行截断到不超过 maxWidthPx，超出部分以 … 结尾。
 *
 * @param line 原始行
 * @param maxWidthPx 最大宽度
 * @param fontPx 字号
 * @returns 截断后的行
 */
export const truncateGlobeDetailLabelLine = (
  line: string,
  maxWidthPx: number,
  fontPx: number,
): string => {
  const trimmed = line.trim()
  if (!trimmed) return ''
  if (estimateGlobeDetailLabelTextWidthPx(trimmed, fontPx) <= maxWidthPx) return trimmed
  const ellipsis = '…'
  let acc = ''
  for (const ch of trimmed) {
    const candidate = acc + ch
    if (estimateGlobeDetailLabelTextWidthPx(candidate + ellipsis, fontPx) > maxWidthPx) break
    acc = candidate
  }
  return acc ? `${acc}${ellipsis}` : ellipsis
}

/**
 * 将多行详情格式化为地球 Label 展示文案（约 300px 宽、左对齐由 DOM 控制）。
 *
 * @param fullText 完整详情（换行分隔）
 * @param maxWidthPx 行宽上限
 * @param fontPx 字号
 * @returns 展示文案与是否截断
 */
export const buildGlobeDetailLabelDisplay = (
  fullText: string,
  maxWidthPx: number = GLOBE_DETAIL_LABEL_MAX_WIDTH_PX,
  fontPx: number = GLOBE_DETAIL_LABEL_FONT_SIZE_PX,
): GlobeDetailLabelDisplay => {
  const normalized = fullText.trim()
  if (!normalized) {
    return { displayText: '', fullText: '', truncated: false }
  }
  const lines = normalized.split('\n')
  const displayLines = lines.map((line) => truncateGlobeDetailLabelLine(line, maxWidthPx, fontPx))
  const displayText = displayLines.join('\n')
  const truncated = displayText !== normalized
  return {
    displayText,
    fullText: normalized,
    truncated,
  }
}
