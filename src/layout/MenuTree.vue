<template>
  <el-menu :default-active="activeMenu" :collapse="isCollapse" :mode="menuMode" unique-opened router
    class="side-bar--menu" :class="[`side-bar--menu--${menuMode}`]" @select="handleMenuSelect">
    <template v-for="item in menuData" :key="item.path">
      <div v-if="isMenuDisabled(item)" class="disabled-menu-wrapper" @click.capture.prevent.stop="notifyTaskRequired">
        <el-sub-menu v-if="item.children && item.children.length > 0" :index="item.path" :disabled="true"
          class="menu-sub-item">
          <template #title>
            <span v-if="getIcon(item)" class="nav-icon">{{ getIcon(item) }}</span>
            <span class="nav-title">{{ item.meta?.title }}</span>
          </template>
          <MenuItem :menu-data="item.children" :show-icon="showIcon">
          </MenuItem>
        </el-sub-menu>
        <el-menu-item v-else :index="item.path" :disabled="true" class="menu-single-item">
          <template #title>
            <span v-if="getIcon(item)" class="nav-icon">{{ getIcon(item) }}</span>
            <span class="nav-title">{{ item.meta?.title }}</span>
          </template>
        </el-menu-item>
      </div>

      <template v-else>
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
    </template>
  </el-menu>
</template>

<script setup lang="ts">
/**
 * 递归导航菜单（水平/垂直）：支持图标、路由跳转，并在未选任务时禁用算法管理相关入口。
 */
import { type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'
import MenuItem from './MenuItem.vue'

defineOptions({
  name: 'MenuTree',
})

/** 组件 Props：菜单数据与展示模式 */
interface Props {
  /** 当前高亮菜单 path（与 el-menu default-active 对齐） */
  activeMenu?: string
  /** 是否折叠（侧栏模式） */
  isCollapse?: boolean
  /** 菜单路由节点列表 */
  menuData: RouteRecordRaw[]
  /** 水平顶栏或垂直侧栏 */
  menuMode?: 'horizontal' | 'vertical'
  /** 是否展示 meta.icon */
  showIcon?: boolean
}
withDefaults(defineProps<Props>(), {
  activeMenu: '',
  isCollapse: false,
  menuData: () => [],
  menuMode: 'vertical',
  showIcon: true,
})

/** [变量说明] 全局 Layout Store */
const layoutStore = useLayoutStore()

const handleMenuSelect = () => { }

/**
 * [函数说明]
 * 判断菜单节点是否禁用（未选择任务时禁止点击算法管理及其子菜单）
 * @param item 路由节点对象
 */
const isMenuDisabled = (item: RouteRecordRaw): boolean => {
  if (item.path && item.path.startsWith('/algorithm')) {
    return !layoutStore.activeTask
  }
  return false
}

/**
 * [函数说明]
 * 禁用状态下点击弹窗提示警告
 */
const notifyTaskRequired = () => {
  ElMessage.warning('尚未选择战场任务，请先在首页选择战场及任务！')
}

/**
 * [函数说明]
 * 获取菜单图标配饰
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
  if (title.includes('战场')) return '🌐'
  if (title.includes('系统')) return '⚙️'
  if (title.includes('用户')) return '👤'
  if (title.includes('角色')) return '🛡️'
  if (title.includes('菜单')) return '📜'
  if (title.includes('场景管理')) return '🗺️'
  if (title.includes('卫星管理')) return '🛰️'
  if (title.includes('地面站')) return '📡'
  if (title.includes('数据中心')) return '🗄️'
  if (title.includes('卫星网络')) return '🕸️'
  if (title.includes('武器管理')) return '🚀'
  if (title.includes('武器')) return '⚔️'
  if (title.includes('基站')) return '📡'
  if (title.includes('导弹')) return '🚀'
  if (title.includes('算法')) return '🧮'
  return ''
}
</script>

<style lang="scss" scoped>
.side-bar--menu {
  border-right: none;
  overflow-x: hidden;
}

.disabled-menu-wrapper {
  cursor: not-allowed;
  display: flex;
  align-items: center;
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
    font-size: var(--font-size-lg);
  }

  .disabled-menu-wrapper {
    cursor: not-allowed;
    display: flex;
    align-items: stretch;
    height: 60px;
  }

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: 60px !important;
    line-height: 60px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    padding: 0 20px !important;
    border-radius: 0 !important;
    color: var(--text-color-soft) !important;
    font-size: var(--font-size-subtitle) !important;
    font-weight: var(--font-weight-semibold) !important;
    background: rgba(var(--accent-cyan-rgb), 0.06) !important;
    border: none !important;
    margin: 0;
    box-sizing: border-box !important;
    transition: all 0.2s ease !important;

    &::after,
    &::before {
      display: none !important;
    }

    &:hover {
      color: var(--accent-cyan) !important;
      background: rgba(var(--accent-cyan-rgb), 0.12) !important;
      border-top: none !important;
      border-bottom: none !important;
    }

    &.is-disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
      background: transparent !important;
      color: var(--text-color-subtle) !important;
    }
  }

  :deep(.el-menu-item.is-active),
  :deep(.el-sub-menu.is-active .el-sub-menu__title) {
    color: var(--accent-cyan) !important;
    background: linear-gradient(180deg, rgba(var(--accent-cyan-rgb), 0.2) 0%, rgba(var(--accent-cyan-rgb), 0.05) 100%) !important;
    border-top: none !important;
    border-bottom: none !important;
    text-shadow: 0 0 10px rgba(var(--accent-cyan-rgb), 0.6);
    box-shadow: inset 0 0 16px rgba(var(--accent-cyan-rgb), 0.15) !important;

    .nav-title {
      font-weight: var(--font-weight-bold);
    }
  }

  :deep(.el-sub-menu .el-sub-menu__icon-arrow) {
    color: var(--text-color-muted);
    margin-left: 6px;
  }
}

/* 二级下拉菜单会被 teleport 到 body，无法通过祖先选择器命中，需用 :global 单独定义 */
:global(.el-menu--popup-container .el-menu-item),
:global(.el-menu--popup-container .el-sub-menu__title) {
  display: flex !important;
  justify-content: center !important;
  text-align: center !important;
  font-size: var(--font-size-lg) !important;
  font-weight: var(--font-weight-semibold) !important;
}
</style>
