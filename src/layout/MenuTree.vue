<template>
  <el-menu :default-active="activeMenu" :collapse="isCollapse" :mode="menuMode" unique-opened router
    class="side-bar--menu" :class="[`side-bar--menu--${menuMode}`]" @select="handleMenuSelect">
    <template v-for="item in menuData" :key="item.path">
      <el-sub-menu v-if="item.children && item.children.length > 0" :index="item.path" class="menu-sub-item">
        <template #title>
          <span v-if="getIcon(item)" class="nav-icon">{{ getIcon(item) }}</span>
          <span class="nav-title">{{ item.meta?.title }}</span>
        </template>
        <MenuItem :menu-data="item.children" :show-icon="showIcon">
        </MenuItem>
      </el-sub-menu>
      <el-menu-item v-else :index="item.path" class="menu-single-item">
        <template #title>
          <span v-if="getIcon(item)" class="nav-icon">{{ getIcon(item) }}</span>
          <span class="nav-title">{{ item.meta?.title }}</span>
        </template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
import { type RouteRecordRaw } from 'vue-router'
import MenuItem from './MenuItem.vue'

defineOptions({
  name: 'MenuTree',
})

interface Props {
  activeMenu?: string
  isCollapse?: boolean
  menuData: RouteRecordRaw[]
  menuMode?: 'horizontal' | 'vertical'
  showIcon?: boolean
}
withDefaults(defineProps<Props>(), {
  activeMenu: '',
  isCollapse: false,
  menuData: () => [],
  menuMode: 'vertical',
  showIcon: true,
})

const handleMenuSelect = () => { }

/**
 * 获取菜单图标配饰
 *
 * @param item 路由菜单节点
 */
const getIcon = (item: RouteRecordRaw): string => {
  const title = String(item.meta?.title || '')
  if (title.includes('整体态势')) return '🌐'
  if (title.includes('拓扑')) return '🕸️'
  if (title.includes('甘特')) return '📊'
  if (title.includes('打击窗口')) return '🎯'
  if (title.includes('方案管理')) return '📋'
  if (title.includes('打击方案')) return '⚔️'
  if (title.includes('威胁')) return '⚠️'
  if (title.includes('攻击')) return '🎯'
  if (title.includes('战场')) return '🌐'
  if (title.includes('系统')) return '⚙️'
  if (title.includes('用户')) return '👤'
  if (title.includes('角色')) return '🛡️'
  if (title.includes('菜单')) return '📜'
  if (title.includes('场景管理')) return '🗺️'
  if (title.includes('卫星管理')) return '🛰️'
  if (title.includes('地面站')) return '📡'
  if (title.includes('数据中心')) return '🗄️'
  if (title.includes('武器管理')) return '🚀'
  if (title.includes('武器')) return '⚔️'
  if (title.includes('基站')) return '📡'
  if (title.includes('导弹')) return '🚀'
  return ''
}
</script>

<style lang="scss" scoped>
.side-bar--menu {
  border-right: none;
  overflow-x: hidden;
}

.side-bar--menu--vertical {
  height: calc(100vh - 60px);
  background: var(--sidebar-bg-gradient);
}

.side-bar--menu--horizontal {
  display: flex;
  align-items: stretch;
  background: transparent !important;
  border: none !important;
  height: 60px;
  gap: 3px;

  .nav-icon {
    margin-right: 8px;
    font-size: 20px;
  }

  :deep(.atlas-app-menu-item),
  :deep(.atlas-app-sub-menu__title) {
    height: 60px !important;
    line-height: 60px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 20px !important;
    border-radius: 0 !important;
    color: #cbd5e1 !important;
    font-size: 22px !important;
    font-weight: 600 !important;
    background: rgba(0, 225, 255, 0.06) !important;
    border: none !important;
    margin: 0;
    box-sizing: border-box !important;
    transition: all 0.2s ease !important;

    &::after,
    &::before {
      display: none !important;
    }

    &:hover {
      color: #00e1ff !important;
      background: rgba(0, 225, 255, 0.12) !important;
      border-top: none !important;
      border-bottom: none !important;
    }

    &.is-disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
      background: transparent !important;
      color: #64748b !important;
    }
  }

  :deep(.atlas-app-menu-item.is-active),
  :deep(.atlas-app-sub-menu.is-active .atlas-app-sub-menu__title) {
    color: #00e1ff !important;
    background: linear-gradient(180deg, rgba(0, 225, 255, 0.2) 0%, rgba(0, 225, 255, 0.05) 100%) !important;
    border-top: none !important;
    border-bottom: none !important;
    text-shadow: 0 0 10px rgba(0, 225, 255, 0.6);
    box-shadow: inset 0 0 16px rgba(0, 225, 255, 0.15) !important;

    .nav-title {
      font-weight: 700;
    }
  }

  :deep(.atlas-app-sub-menu .el-sub-menu__icon-arrow) {
    color: #94a3b8;
    margin-left: 6px;
  }
}

:global(.atlas-app-menu--popup-container .atlas-app-menu-item),
:global(.atlas-app-menu--popup-container .atlas-app-sub-menu__title) {
  display: flex !important;
  justify-content: center !important;
  text-align: center !important;
  font-size: 22px !important;
  font-weight: 600 !important;
}
</style>
