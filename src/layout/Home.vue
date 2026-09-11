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
import { computed, type Component } from 'vue'
import BattleSituation from '@/components/BattleSituation/BattleSituation.vue'
import ElectronicWarfareG6 from '@/components/electronic/ElectronicWarfareG6.vue'
import SatelliteGantt from '@/components/electronic/SatelliteGantt.vue'
import WeaponAttackList from '@/components/electronic/WeaponAttackList.vue'
import StrikePlanGenerator from '@/components/electronic/StrikePlanGenerator.vue'
import { useLayoutStore } from '@/store/modules/layout'

defineOptions({ name: 'Home' })

/** [变量说明] 全局 Store */
const store = useLayoutStore()

/**
 * [类型定义]
 * 顶部导航菜单项配置接口
 */
interface MenuTabItem {
  key: string
  name: string
  icon: string
  component: Component
}

/** [变量说明] 当前激活的菜单项 Key（与 Store 同步） */
const activeTab = computed({
  get: () => store.mainActiveTab,
  set: (key: string) => store.setMainActiveTab(key),
})

/** [变量说明] 顶层五个切换菜单按钮配置（保留组件结构） */
const menuTabs: MenuTabItem[] = [
  { key: '整体态势分析', name: '整体态势分析', icon: '🌐', component: BattleSituation },
  { key: '态势拓扑分析', name: '态势拓扑分析', icon: '🕸️', component: ElectronicWarfareG6 },
  { key: '甘特图分析', name: '甘特图分析', icon: '📊', component: SatelliteGantt },
  { key: '打击窗口分析', name: '打击窗口分析', icon: '🎯', component: WeaponAttackList },
  { key: '打击方案生成', name: '打击方案生成', icon: '⚔️', component: StrikePlanGenerator },
]

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
