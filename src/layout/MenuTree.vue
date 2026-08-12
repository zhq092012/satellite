<template>
  <el-menu
    :default-active="activeMenu"
    :collapse="isCollapse"
    :mode="menuMode"
    unique-opened
    router
    class="side-bar--menu"
    :class="[`side-bar--menu--${menuMode}`]"
    @select="handleMenuSelect"
  >
    <template v-for="item in menuData" :key="item.path">
      <div v-if="isMenuDisabled(item)" class="disabled-menu-wrapper" @click.capture.prevent.stop="notifyTaskRequired">
        <el-sub-menu
          v-if="item.children && item.children.length > 0"
          :index="item.path"
          :disabled="true"
          class="menu-sub-item"
        >
          <template #title>
            <span v-if="getIcon(item)" class="nav-icon">{{ getIcon(item) }}</span>
            <span class="nav-title">{{ item.meta?.title }}</span>
          </template>
          <MenuItem :menu-data="item.children" :show-icon="showIcon"></MenuItem>
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
          <MenuItem :menu-data="item.children" :show-icon="showIcon"></MenuItem>
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
import { type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'
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

/** [变量说明] 全局 Layout Store */
const layoutStore = useLayoutStore()

const handleMenuSelect = () => {}

/**
 * [函数说明]
 * 判断菜单节点是否禁用（未选择任务时禁止点击算法管理及其子菜单）
 * @param item 路由节点对象
 */
const isMenuDisabled = (item: RouteRecordRaw): boolean => {
  if (item.path && item.path.startsWith('/algorithm')) {
    return !layoutStore.activedTask
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
  if (title.includes('战场')) return '🌐'
  if (title.includes('系统')) return '⚙️'
  if (title.includes('用户')) return '👤'
  if (title.includes('角色')) return '🛡️'
  if (title.includes('菜单')) return '📜'
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
  align-items: center;
  background: transparent !important;
  border-bottom: none !important;
  height: 60px;
  gap: 8px;

  .nav-icon {
    margin-right: 6px;
    font-size: 14px;
  }

  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    height: 38px !important;
    line-height: 38px !important;
    padding: 0 16px !important;
    border-radius: 6px;
    color: #94a3b8 !important;
    font-size: 14px;
    font-weight: 600;
    background: transparent !important;
    border-bottom: 2px solid transparent !important;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

    &:hover {
      color: #00e1ff !important;
      background: rgba(0, 225, 255, 0.08) !important;
    }

    &.is-disabled {
      opacity: 0.45 !important;
      cursor: not-allowed !important;
      background: transparent !important;
      color: #64748b !important;
    }
  }

  :deep(.el-menu-item.is-active),
  :deep(.el-sub-menu.is-active .el-sub-menu__title) {
    color: #00e1ff !important;
    background: linear-gradient(180deg, rgba(0, 225, 255, 0.16) 0%, rgba(0, 225, 255, 0.04) 100%) !important;
    border-bottom: 2px solid #00e1ff !important;
    box-shadow: 0 4px 12px rgba(0, 225, 255, 0.15);
    text-shadow: 0 0 8px rgba(0, 225, 255, 0.5);

    .nav-title {
      font-weight: 700;
    }
  }

  :deep(.el-sub-menu .el-sub-menu__icon-arrow) {
    color: #94a3b8;
    margin-left: 6px;
  }
}
</style>
