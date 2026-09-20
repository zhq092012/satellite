/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_BASE_ROUTER: string
  readonly VITE_PICTURE_URL: string
  readonly VITE_MATERIAL_URL: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_MEDIA_URL: string
  /** 任务重算进度 WebSocket 地址，相对路径走当前域（开发环境由 Vite 代理）。 */
  readonly VITE_WS_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
