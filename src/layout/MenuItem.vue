<template>
  <template v-for="item in menuData" :key="item.path">
    <div v-if="isMenuDisabled(item)" class="disabled-menu-wrapper" @click.capture.prevent.stop="notifyTaskRequired">
      <el-sub-menu v-if="item.children && item.children.length > 0" :index="item.path" :disabled="true">
        <template #title>
          <span>{{ item.meta?.title }}</span>
        </template>
        <MenuItem :menu-data="item.children"></MenuItem>
      </el-sub-menu>
      <el-menu-item v-else :index="item.path" :disabled="true">
        <template #title>
          <span>{{ item.meta?.title }}</span>
        </template>
      </el-menu-item>
    </div>

    <template v-else>
      <el-sub-menu v-if="item.children && item.children.length > 0" :index="item.path">
        <template #title>
          <span>{{ item.meta?.title }}</span>
        </template>
        <MenuItem :menu-data="item.children"></MenuItem>
      </el-sub-menu>
      <el-menu-item v-else :index="item.path">
        <template #title>
          <span>{{ item.meta?.title }}</span>
        </template>
      </el-menu-item>
    </template>
  </template>
</template>

<script setup lang="ts">
import { type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'

defineOptions({
  name: 'MenuItem',
})

interface Props {
  menuData: RouteRecordRaw[]
  showIcon?: boolean
}
withDefaults(defineProps<Props>(), {
  menuData: () => [],
  showIcon: true,
})

/** [变量说明] 全局 Layout Store */
const layoutStore = useLayoutStore()

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
</script>

<style lang="scss" scoped>
.disabled-menu-wrapper {
  cursor: not-allowed;
  display: block;
  width: 100%;
}
</style>
