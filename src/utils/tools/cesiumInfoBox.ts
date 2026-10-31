import type { SatelliteDetail } from '@/types/cesium/satellite'
import type { BlueSatelliteRecord } from '@/types/strike'
import * as Cesium from 'cesium'

type InfoBoxButtonHandler = (payload: { button: HTMLButtonElement; event: MouseEvent }) => void

interface BindInfoBoxButtonOptions {
  selector?: string
  handler: InfoBoxButtonHandler
}

const infoBoxHandlerMap = new WeakMap<
  Cesium.Viewer,
  {
    frameLoadHandler: (() => void) | null
    clickHandler: ((event: MouseEvent) => void) | null
  }
>()

/**
 * 取出或创建某个 Viewer 上 InfoBox 按钮的监听器状态。
 * 用 WeakMap 挂在 Viewer 上，避免重复绑定，也避免 Viewer 销毁后泄漏。
 *
 * @param viewer Cesium Viewer
 * @returns 该 Viewer 的 iframe load 与 click 监听器槽位
 */
const getHandlerState = (viewer: Cesium.Viewer) => {
  const existing = infoBoxHandlerMap.get(viewer)
  if (existing) return existing

  const state = {
    frameLoadHandler: null as (() => void) | null,
    clickHandler: null as ((event: MouseEvent) => void) | null,
  }
  infoBoxHandlerMap.set(viewer, state)
  return state
}

/**
 * 生成 InfoBox 描述 HTML 里的操作按钮。
 * 业务数据通过 `data-*` 属性带出，点击时由 {@link bindInfoBoxButton} 读回。
 *
 * @param label 按钮可见文案
 * @param dataAttributes 写入按钮的 data 属性，键名不要带 `data-` 前缀
 * @returns 可直接拼进 InfoBox HTML 的 button 片段
 */
export function createInfoBoxActionButton(label: string, dataAttributes: Record<string, string | number>) {
  const attributes = Object.entries(dataAttributes)
    .map(([key, value]) => `data-${key}="${String(value)}"`)
    .join(' ')

  return `<button type="button" ${attributes} style="cursor:pointer;padding:4px 10px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;">${label}</button>`
}

/**
 * 把 InfoBox iframe 内按钮的点击委托到宿主页面。
 * InfoBox 内容会随选中实体重绘，因此同时监听 iframe `load`，在文档重建后重新挂上 click。
 *
 * @param viewer 持有 infoBox 的 Cesium Viewer
 * @param options.selector 按钮选择器，默认 `[data-norad]`
 * @param options.handler 命中按钮后的回调，参数为按钮元素与原始鼠标事件
 */
export function bindInfoBoxButton(viewer: Cesium.Viewer, options: BindInfoBoxButtonOptions) {
  const frame = viewer.infoBox?.frame as HTMLIFrameElement | undefined
  if (!frame) return

  const selector = options.selector ?? '[data-norad]'
  const state = getHandlerState(viewer)

  /**
   * 在 InfoBox iframe 文档上注册（或替换）点击委托。
   * 文档尚未就绪时直接返回，等 iframe `load` 后再调一次。
   */
  const attachClickHandler = () => {
    const doc = frame.contentDocument || frame.contentWindow?.document
    if (!doc) return

    if (state.clickHandler) {
      doc.removeEventListener('click', state.clickHandler)
    }

    state.clickHandler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const button = target?.closest?.(selector) as HTMLButtonElement | null
      if (!button) return

      event.preventDefault()
      event.stopPropagation()
      options.handler({ button, event })
    }

    doc.addEventListener('click', state.clickHandler)
  }

  if (state.frameLoadHandler) {
    frame.removeEventListener('load', state.frameLoadHandler)
  }

  state.frameLoadHandler = () => {
    attachClickHandler()
  }

  frame.addEventListener('load', state.frameLoadHandler)
  attachClickHandler()
}

/**
 * 移除某个 Viewer 上由 {@link bindInfoBoxButton} 注册的 load / click 监听，并丢掉状态。
 *
 * @param viewer 持有 infoBox 的 Cesium Viewer
 */
export function unbindInfoBoxButton(viewer: Cesium.Viewer) {
  const frame = viewer.infoBox?.frame as HTMLIFrameElement | undefined
  const state = infoBoxHandlerMap.get(viewer)
  if (!frame || !state) return

  const doc = frame.contentDocument || frame.contentWindow?.document
  if (doc && state.clickHandler) {
    doc.removeEventListener('click', state.clickHandler)
  }

  if (state.frameLoadHandler) {
    frame.removeEventListener('load', state.frameLoadHandler)
  }

  infoBoxHandlerMap.delete(viewer)
}

/**
 * 转义 HTML 特殊字符，避免卫星名称等外部文本被当成标记插入 InfoBox。
 *
 * @param value 任意展示值；null / undefined 显示为 `--`
 * @returns 可安全插入 HTML 的字符串
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '--')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/**
 * 把详情字段格式化为固定小数位，并拼上单位后缀。
 *
 * @param value 原始数值或数字字符串
 * @param digits 保留小数位数，默认 3
 * @param suffix 单位等后缀，默认空串
 * @returns 格式化文本；空值为 `--`，非数字时原样转字符串
 */
export const formatDetailNumber = (value: unknown, digits = 3, suffix = ''): string => {
  if (value === null || value === undefined || value === '') return '--'
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return String(value)
  return `${numericValue.toFixed(digits)}${suffix}`
}

/**
 * 把可能为空的详情字段转成展示文本。
 *
 * @param value 原始字段
 * @returns 字符串；null、undefined、空串时为 `--`
 */
export const formatNullableText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '--'
  return String(value)
}

/**
 * 把卫星打击阶段枚举转成 InfoBox 上的中文状态。
 *
 * @param phase 阶段：`active` 打击中，`fading` / `done` 已打击，其余为正常运行
 * @returns 中文状态文案
 */
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
