import type { StrikePlanStrikeRow } from '@/utils/buildStrikePlanSchemeView'

/** CSV 导出列（与需求一致） */
const EXPORT_HEADERS = ['国家', '卫星名称', '卫星类型', '武器', '武器类型', '打击窗口'] as const

/**
 * 转义 CSV 字段。
 *
 * @param value 单元格文本
 */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * 将打击计划行转为 CSV 文本（UTF-8 BOM）。
 *
 * @param rows 导出行
 */
export function buildStrikePlanCsvContent(rows: StrikePlanStrikeRow[]): string {
  const lines = [
    EXPORT_HEADERS.join(','),
    ...rows.map((row) =>
      [
        row.country,
        row.satelliteName,
        row.satelliteType,
        row.weaponName,
        row.weaponType,
        row.attackWindow,
      ]
        .map((cell) => escapeCsvField(cell ?? ''))
        .join(','),
    ),
  ]
  return `\uFEFF${lines.join('\r\n')}`
}

/**
 * 触发浏览器下载文本文件。
 *
 * @param filename 文件名
 * @param content 文件内容
 * @param mime MIME 类型
 */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * 下载打击计划 CSV。
 *
 * @param rows 导出行
 * @param filenamePrefix 文件名前缀
 */
export function downloadStrikePlanCsv(rows: StrikePlanStrikeRow[], filenamePrefix = '打击计划'): void {
  const content = buildStrikePlanCsvContent(rows)
  downloadTextFile(`${filenamePrefix}.csv`, content, 'text/csv')
}

/**
 * 下载打击计划 XLS（Tab 分隔，Excel 可打开）。
 *
 * @param rows 导出行
 * @param filenamePrefix 文件名前缀
 */
export function downloadStrikePlanXls(rows: StrikePlanStrikeRow[], filenamePrefix = '打击计划'): void {
  const header = EXPORT_HEADERS.join('\t')
  const body = rows
    .map((row) =>
      [row.country, row.satelliteName, row.satelliteType, row.weaponName, row.weaponType, row.attackWindow].join(
        '\t',
      ),
    )
    .join('\r\n')
  downloadTextFile(`${filenamePrefix}.xls`, `\uFEFF${header}\r\n${body}`, 'application/vnd.ms-excel')
}
