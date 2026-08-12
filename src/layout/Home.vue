<template>
  <div class="home-container">
    <!-- 顶层菜单栏 -->
    <header class="top-nav-bar">
      <div class="brand-title">
        <span class="brand-icon">🛰️</span>
        <span class="brand-text">态势分析决策平台</span>
      </div>
      <div class="menu-tabs">
        <button
          v-for="tab in menuTabs"
          :key="tab.key"
          class="menu-btn"
          :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          <span class="btn-icon">{{ tab.icon }}</span>
          <span class="btn-label">{{ tab.name }}</span>
        </button>
      </div>
    </header>

    <!-- 下层内容展示区域 -->
    <main class="bottom-content">
      <keep-alive>
        <component :is="currentComponent" :key="activeTab" />
      </keep-alive>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import BattleSituation from '@/components/BattleSituation/BattleSituation.vue'
import ElectronicWarfareG6 from '@/components/electronic/ElectronicWarfareG6.vue'
import SatelliteGantt from '@/components/electronic/SatelliteGantt.vue'
import WeaponAttackList from '@/components/electronic/WeaponAttackList.vue'

defineOptions({ name: 'Home' })

/**
 * [类型定义]
 * 顶部导航菜单项配置接口
 */
interface MenuTabItem {
  /** 菜单项唯一标识 Key */
  key: string
  /** 菜单按钮显示文本 */
  name: string
  /** 菜单按钮前置图标 */
  icon: string
  /** 关联的视图组件引用 */
  component: Component
}

/**
 * [变量说明]
 * 当前激活的菜单项 Key，默认选中 "GIS态势分析"
 */
const activeTab = ref<string>('GIS态势分析')

/**
 * [变量说明]
 * 顶层四个切换菜单按钮配置
 */
const menuTabs: MenuTabItem[] = [
  { key: 'GIS态势分析', name: 'GIS态势分析', icon: '🌐', component: BattleSituation },
  { key: 'G6图谱态势分析', name: 'G6图谱态势分析', icon: '🕸️', component: ElectronicWarfareG6 },
  { key: '甘特图态势分析', name: '甘特图态势分析', icon: '📊', component: SatelliteGantt },
  { key: '武器打击窗口分析', name: '武器打击窗口分析', icon: '🎯', component: WeaponAttackList },
]

/**
 * [计算属性说明]
 * 根据当前选中的 activeTab 返回目标切换组件
 */
const currentComponent = computed<Component>(() => {
  const targetTab = menuTabs.find((item) => item.key === activeTab.value)
  return targetTab ? targetTab.component : BattleSituation
})

/**
 * [函数说明]
 * 切换顶部导航菜单
 * @param key 目标菜单 Key
 */
const switchTab = (key: string) => {
  activeTab.value = key
}
</script>

<style lang="scss" scoped>
.home-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #0b1528;

  /* 顶层菜单栏样式 */
  .top-nav-bar {
    height: 52px;
    padding: 0 20px;
    background: linear-gradient(180deg, rgba(12, 28, 48, 0.95) 0%, rgba(8, 20, 36, 0.98) 100%);
    border-bottom: 1px solid rgba(79, 147, 221, 0.3);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 1000;
    flex-shrink: 0;

    .brand-title {
      display: flex;
      align-items: center;
      gap: 8px;

      .brand-icon {
        font-size: 20px;
      }

      .brand-text {
        font-size: 16px;
        font-weight: bold;
        color: #eaf3ff;
        letter-spacing: 0.5px;
        background: linear-gradient(90deg, #ffffff 0%, #4f93dd 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }

    .menu-tabs {
      display: flex;
      align-items: center;
      gap: 12px;

      .menu-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 16px;
        font-size: 14px;
        font-weight: 500;
        color: #8eb3d6;
        background: rgba(16, 36, 62, 0.6);
        border: 1px solid rgba(79, 147, 221, 0.25);
        border-radius: 6px;
        cursor: pointer;
        outline: none;
        transition: all 0.25s ease;

        .btn-icon {
          font-size: 14px;
        }

        &:hover {
          color: #ffffff;
          border-color: rgba(0, 225, 255, 0.5);
          background: rgba(24, 52, 88, 0.8);
          box-shadow: 0 0 10px rgba(0, 225, 255, 0.2);
        }

        &.active {
          color: #ffffff;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(79, 147, 221, 0.8) 0%, rgba(0, 180, 216, 0.9) 100%);
          border-color: #00e1ff;
          box-shadow: 0 0 12px rgba(0, 225, 255, 0.4);
        }
      }
    }
  }

  /* 下层内容展示区域 */
  .bottom-content {
    flex: 1;
    position: relative;
    width: 100%;
    height: calc(100vh - 52px);
    overflow: hidden;
  }
}
</style>
