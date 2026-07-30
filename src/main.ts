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

let app: ReturnType<typeof createApp> | null = null

app = createApp(App)
app.use(store)
app.use(router)

// 注册所有图标组件
for (const [key, component] of Object.entries(ElementPlusIcons)) {
  app.component(key, component)
}

app.mount('#atlas-app')
