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
      <el-sub-menu v-if="item.children && item.children.length > 0" :index="item.path">
        <template #title>
          <span>{{ item.meta?.title }}</span>
        </template>
        <MenuItem :menu-data="item.children" :show-icon="showIcon"></MenuItem>
      </el-sub-menu>
      <el-menu-item v-else :index="item.path">
        <template #title>
          <span>{{ item.meta?.title }}</span>
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
const props = withDefaults(defineProps<Props>(), {
  activeMenu: '',
  isCollapse: false,
  menuData: () => [],
  menuMode: 'vertical',
  showIcon: true,
})

const handleMenuSelect = () => {}
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
  align-items: center;
  background: transparent;
  border-bottom: none;
}
</style>
