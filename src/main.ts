import { createApp } from 'vue'
import App from './App.vue'
import store from './store'
import router from './router'
import './style.css'
// import ElementPlus from 'element-plus'
import * as ElementPlusIcons from '@element-plus/icons-vue'
import '@/styles/dark/index.scss'

// 引入 cesium 样式
import 'cesium/Build/Cesium/Widgets/widgets.css'
window.CESIUM_BASE_URL = '/cesium/'

/** 旧版 layout 持久化若含全量卫星树，JSON 解析会卡死主线程 */
const LEGACY_LAYOUT_STORAGE_KEYS = ['layout-store', 'layout-store-v2']
const LAYOUT_STORAGE_SIZE_WARN_BYTES = 1_500_000
if (typeof localStorage !== 'undefined') {
  for (const key of LEGACY_LAYOUT_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw && raw.length >= LAYOUT_STORAGE_SIZE_WARN_BYTES) {
        localStorage.removeItem(key)
        console.warn(`已移除过大的本地缓存 ${key}，避免页面无法操作`)
      }
    } catch {
      // 保持启动
    }
  }
}

let app: ReturnType<typeof createApp> | null = null

app = createApp(App)
app.use(store)
app.use(router)

// 注册所有图标组件
for (const [key, component] of Object.entries(ElementPlusIcons)) {
  app.component(key, component)
}

app.mount('#atlas-app')
