<template>
  <div class="system-manage-page">
    <el-card shadow="never" class="system-manage-card">
      <div class="system-manage-header">
        <div>
          <h2>系统管理</h2>
          <p>用户、角色与菜单权限统一管理</p>
        </div>
      </div>

      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="用户管理" name="users" />
        <el-tab-pane label="角色管理" name="roles" />
        <el-tab-pane label="菜单管理" name="menus" />
        <el-tab-pane label="武器管理" name="weapons" />
        <el-tab-pane label="基站管理" name="basestations" />
        <el-tab-pane label="导弹管理" name="missiles" />
        <el-tab-pane label="导弹基地管理" name="missileBases" />
        <el-tab-pane label="战场管理" name="battles" />
      </el-tabs>

      <router-view />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const tabNameMap: Record<string, string> = {
  UserManage: 'users',
  RoleManage: 'roles',
  MenuManage: 'menus',
  WeaponManage: 'weapons',
  BaseStationManage: 'basestations',
  MissileManage: 'missiles',
  MissileBaseManage: 'missileBases',
  BattleManage: 'battles',
}

const activeTab = computed({
  get: () => tabNameMap[String(route.name ?? '')] ?? 'users',
  set: () => undefined,
})

const handleTabChange = (tabName: string) => {
  if (tabName === 'users') {
    router.push({ name: 'UserManage' })
  } else if (tabName === 'roles') {
    router.push({ name: 'RoleManage' })
  } else if (tabName === 'menus') {
    router.push({ name: 'MenuManage' })
  } else if (tabName === 'weapons') {
    router.push({ name: 'WeaponManage' })
  } else if (tabName === 'basestations') {
    router.push({ name: 'BaseStationManage' })
  } else if (tabName === 'missiles') {
    router.push({ name: 'MissileManage' })
  } else if (tabName === 'missileBases') {
    router.push({ name: 'MissileBaseManage' })
  } else if (tabName === 'battles') {
    router.push({ name: 'BattleManage' })
  }
}
</script>

<style scoped lang="scss">
.system-manage-page {
  padding: 16px;
}

.system-manage-card {
  min-height: calc(100vh - 92px);
  background: var(--surface-bg-color);
  border: 1px solid var(--surface-border-color);
  color: var(--text-color-strong);
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
