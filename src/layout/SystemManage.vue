<template>
  <div class="system-manage-page">
    <el-card shadow="never" class="system-manage-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="用户管理" name="users" />
        <el-tab-pane label="角色管理" name="roles" />
        <el-tab-pane label="菜单管理" name="menus" />
      </el-tabs>

      <div class="system-manage-view">
        <router-view />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

/** 系统管理子路由名称与 Tab 标识的映射 */
const tabNameMap: Record<string, string> = {
  UserManage: 'users',
  RoleManage: 'roles',
  MenuManage: 'menus',
}

/**
 * 计算系统管理当前页签。
 * 返回子路由名称对应的 users、roles 或 menus，无法识别时返回 users。setter 不改状态。
 * 作用：页签高亮跟随当前子路由。
 */
const activeTab = computed({
  get: () => tabNameMap[String(route.name ?? '')] ?? 'users',
  set: () => undefined,
})

/**
 * Tab 切换时跳转到对应的系统管理子路由
 *
 * @param tabName Tab 标识
 */
const handleTabChange = (tabName: string) => {
  if (tabName === 'users') {
    router.push({ name: 'UserManage' })
  } else if (tabName === 'roles') {
    router.push({ name: 'RoleManage' })
  } else if (tabName === 'menus') {
    router.push({ name: 'MenuManage' })
  }
}
</script>

<style scoped lang="scss">
.system-manage-page {
  height: calc(100vh - 60px);
  max-height: calc(100vh - 60px);
  box-sizing: border-box;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.system-manage-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface-bg-color);
  border: 1px solid var(--surface-border-color);
  color: var(--text-color-strong);

  :deep(.atlas-app-card__body) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-sizing: border-box;
  }

  :deep(.atlas-app-tabs) {
    flex-shrink: 0;
  }

  :deep(.atlas-app-tabs__content) {
    display: none;
  }

  :deep(.atlas-app-tabs__header) {
    margin-bottom: 8px;
  }
}

.system-manage-view {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  :deep(> *) {
    box-sizing: border-box;
  }
}

.system-manage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    margin: 0;
    font-size: 22px;
  }

  p {
    margin: 8px 0 0;
    color: var(--text-color-secondary);
  }
}
</style>

<style lang="scss">
@use '@/components/BattleSituation/styles/admin-manage-typography.scss' as adminManage;

@include adminManage.admin-manage-page-typography('.system-manage-page');
</style>
