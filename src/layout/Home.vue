<template>
  <div class="home-container">
    <!-- 下层内容展示区域 -->
    <main class="bottom-content">
      <keep-alive
        :include="['BattleSituation', 'ElectronicWarfareG6', 'SatelliteGantt', 'WeaponAttackList', 'StrikePlanGenerator']">
        <component :is="currentComponent" :key="activeTab" />
      </keep-alive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BattleSituation from '@/components/BattleSituation/BattleSituation.vue'
import ElectronicWarfareG6 from '@/components/electronic/ElectronicWarfareG6.vue'
import SatelliteGantt from '@/components/electronic/SatelliteGantt.vue'
import WeaponAttackList from '@/components/electronic/WeaponAttackList.vue'
import StrikePlanGenerator from '@/components/electronic/StrikePlanGenerator.vue'
import { useLayoutStore } from '@/store/modules/layout'

defineOptions({ name: 'Home' })

/** [变量说明] 全局 Store */
const store = useLayoutStore()
/** [变量说明] 当前路由，用于同步顶栏菜单与分析页 */
const route = useRoute()
/** [变量说明] 路由实例，顶栏切换时跳转到对应分析页 */
const router = useRouter()

/**
 * [类型定义]
 * 顶部导航菜单项配置接口
 */
interface MenuTabItem {
  /** 与 Store.mainActiveTab 对齐的页签 Key */
  key: string
  /** 顶栏展示名称 */
  name: string
  /** 顶栏图标 */
  icon: string
  /** 对应分析页组件 */
  component: Component
  /** 顶栏菜单对应的路由 path */
  path: string
}

/** [变量说明] 当前激活的菜单项 Key（与 Store 同步） */
const activeTab = computed({
  get: () => store.mainActiveTab,
  set: (key: string) => store.setMainActiveTab(key),
})

/**
 * [变量说明]
 * 整体态势分析及其后四个分析页配置（与顶栏菜单顺序一致）
 */
const menuTabs: MenuTabItem[] = [
  { key: '整体态势分析', name: '整体态势分析', icon: '🌐', path: '/home', component: BattleSituation },
  { key: '态势拓扑分析', name: '态势拓扑分析', icon: '🕸️', path: '/home/topo', component: ElectronicWarfareG6 },
  { key: '甘特图分析', name: '甘特图分析', icon: '📊', path: '/home/gantt', component: SatelliteGantt },
  { key: '打击窗口分析', name: '打击窗口分析', icon: '🎯', path: '/home/windows', component: WeaponAttackList },
  { key: '打击方案生成', name: '打击方案生成', icon: '⚔️', path: '/home/strike-plan', component: StrikePlanGenerator },
]

/** [变量说明] 路由 path → 分析页 Key */
const tabKeyByPath = Object.fromEntries(menuTabs.map((item) => [item.path, item.key])) as Record<string, string>
/** [变量说明] 分析页 Key → 路由 path */
const pathByTabKey = Object.fromEntries(menuTabs.map((item) => [item.key, item.path])) as Record<string, string>

/**
 * 根据当前路由同步激活的分析页。
 */
watch(
  () => route.path,
  (path) => {
    const tabKey = tabKeyByPath[path]
    if (tabKey && store.mainActiveTab !== tabKey) {
      store.setMainActiveTab(tabKey)
    }
  },
  { immediate: true },
)

/**
 * Store 内跳转分析页时，同步顶栏路由。
 */
watch(
  () => store.mainActiveTab,
  (tabKey) => {
    const targetPath = pathByTabKey[tabKey]
    if (targetPath && route.path !== targetPath) {
      void router.push(targetPath)
    }
  },
)

/** [计算属性说明] 动态组件引用 */
const currentComponent = computed<Component>(() => {
  const targetTab = menuTabs.find((item) => item.key === activeTab.value)
  return targetTab ? targetTab.component : BattleSituation
})
</script>

<style lang="scss" scoped>
.home-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: calc(100vh - 60px);
  overflow: hidden;
  background-color: #0b1528;

  /* 下层内容展示区域 */
  .bottom-content {
    flex: 1;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
}
</style>
