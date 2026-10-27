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
