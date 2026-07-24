<template>
  <template v-for="item in menuData" :key="item.path">
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
<script setup lang="ts">
import { type RouteRecordRaw } from 'vue-router'
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
</script>
<style lang="scss" scoped></style>
