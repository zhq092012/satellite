/**
 * Cesium InfoBox HTML 构建
 * 用于生成点击卫星后弹出的信息面板内容
 */
import type { BlueSatelliteRecord } from '@/types/strike'
import { createInfoBoxActionButton } from '@/utils/tools/infoBox'


/** HTML 转义，防止 XSS */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '--')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** 格式化数字为指定小数位，附带可选后缀 */
export const formatDetailNumber = (value: unknown, digits = 3, suffix = ''): string => {
  if (value === null || value === undefined || value === '') return '--'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return String(value)
  return `${numericValue.toFixed(digits)}${suffix}`
}

/** 格式化可能为空的文本 */
export const formatNullableText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '--'
  return String(value)
}

/** 将卫星打击阶段转换为中文展示文本 */
export const formatSatelliteState = (phase: string): string => {
  if (phase === 'active') return '打击中'
  if (phase === 'fading' || phase === 'done') return '已打击'
  return '正常运行'
}

/**
 * 构建卫星 InfoBox 的 HTML 描述内容
 * 包含卫星的基本信息、轨道参数，以及"详情"按钮
 */
export const buildSatelliteInfoBoxDescription = (
  satellite: BlueSatelliteRecord,
  detail: SatelliteDetail | null,
  satellitePhase: string
): string => {
  const rows = [
    ['NORAD', satellite.noradId],
    ['名称', detail?.name_en ?? satellite.name],
    ['国家', detail?.country ?? satellite.country],
    ['类型', detail?.sat_type ?? satellite.satType],
    ['状态', formatSatelliteState(satellitePhase)],
    ['经度', `${formatDetailNumber(satellite.longitude, 2, '°')}`],
    ['纬度', `${formatDetailNumber(satellite.latitude, 2, '°')}`],
    ['高度', `${formatDetailNumber(satellite.altitude, 2, ' km')}`],
    ['半长轴 a', `${formatDetailNumber(detail?.a, 2, ' km')}`],
    ['偏心率 e', formatDetailNumber(detail?.e, 6)],
    ['轨道倾角 i', `${formatDetailNumber(detail?.i, 2, '°')}`],
    [
      '升交点赤经 Ω',
      `${formatNullableText(detail?.o)}${detail?.o === null || detail?.o === undefined || detail?.o === '' ? '' : '°'}`,
    ],
    [
      '近地点幅角 ω',
      `${formatNullableText(detail?.w)}${detail?.w === null || detail?.w === undefined || detail?.w === '' ? '' : '°'}`,
    ],
    [
      '平近点角 M',
      `${formatNullableText(detail?.m)}${detail?.m === null || detail?.m === undefined || detail?.m === '' ? '' : '°'}`,
    ],
  ]

  const tableRows = rows
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>`
    )
    .join('')

  return `
    <div style="padding: 10px; font-family: inherit; background-color: white; color: rgba(0, 0, 0, 0.82); border-radius: 8px;">
      <h3 style="color: #1890ff; margin: 0 0 10px 0; display:flex; justify-content: space-between; align-items:center; gap: 12px;">
        <span>🛰️ ${escapeHtml(detail?.name_en ?? satellite.name)}</span>
        ${createInfoBoxActionButton('详情', { norad: satellite.noradId })}
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;color:rgba(0, 0, 0, 0.82);text-align:left">
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `.trim()
}
