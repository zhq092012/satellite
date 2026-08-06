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

export function createInfoBoxActionButton(label: string, dataAttributes: Record<string, string | number>) {
  const attributes = Object.entries(dataAttributes)
    .map(([key, value]) => `data-${key}="${String(value)}"`)
    .join(' ')

  return `<button type="button" ${attributes} style="cursor:pointer;padding:4px 10px;border:1px solid #1890ff;border-radius:4px;background:#1890ff;color:#fff;">${label}</button>`
}

export function bindInfoBoxButton(viewer: Cesium.Viewer, options: BindInfoBoxButtonOptions) {
  const frame = viewer.infoBox?.frame as HTMLIFrameElement | undefined
  if (!frame) return

  const selector = options.selector ?? '[data-norad]'
  const state = getHandlerState(viewer)

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
