<template>
  <div class="data-manage-page">
    <el-card shadow="never" class="data-manage-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="场景管理" name="battles" />
        <el-tab-pane label="卫星管理" name="satellites" />
        <el-tab-pane label="地面站管理" name="groundStations" />
        <el-tab-pane label="数据中心管理" name="dataCenters" />
        <el-tab-pane label="武器管理" name="weapons" />
        <el-tab-pane label="卫星网络管理" name="satelliteNetwork" />
      </el-tabs>

      <div class="data-manage-view">
        <router-view />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 当前路由，用于同步激活的数据管理页签 */
const route = useRoute()
/** 路由实例，页签切换时跳转到对应子页面 */
const router = useRouter()

/** 数据管理子路由名称与页签标识的映射 */
const tabNameMap: Record<string, string> = {
  BattleManage: 'battles',
  SatelliteManage: 'satellites',
  GroundStationManage: 'groundStations',
  DataCenterManage: 'dataCenters',
  WeaponManage: 'weapons',
  SatelliteNetworkManage: 'satelliteNetwork',
}

/** 当前激活的页签，由子路由名称反查 */
const activeTab = computed({
  get: () => tabNameMap[String(route.name ?? '')] ?? 'battles',
  set: () => undefined,
})

/**
 * 切换数据管理页签并打开对应页面。
 * @param tabName 页签标识
 */
const handleTabChange = (tabName: string) => {
  if (tabName === 'battles') {
    router.push({ name: 'BattleManage' })
  } else if (tabName === 'satellites') {
    router.push({ name: 'SatelliteManage' })
  } else if (tabName === 'groundStations') {
    router.push({ name: 'GroundStationManage' })
  } else if (tabName === 'dataCenters') {
    router.push({ name: 'DataCenterManage' })
  } else if (tabName === 'weapons') {
    router.push({ name: 'WeaponManage' })
  } else if (tabName === 'satelliteNetwork') {
    router.push({ name: 'SatelliteNetworkManage' })
  }
}
</script>

<style scoped lang="scss">
.data-manage-page {
  /* 顶栏 60px 以外的可视高度，页面本身不再产生竖向滚动 */
  height: calc(100vh - 60px);
  max-height: calc(100vh - 60px);
  box-sizing: border-box;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.data-manage-card {
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

  :deep(.atlas-app-tabs__item) {
    font-size: 16px;
    font-weight: 600;
  }
}

.data-manage-view {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(> *) {
    flex: 1 1 auto;
    height: 100%;
    max-height: 100%;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
  }
}
</style>
