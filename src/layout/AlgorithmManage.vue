<template>
  <div class="algorithm-manage-page">
    <el-card shadow="never" class="algorithm-manage-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="卫星威胁分析" name="threat" />
        <el-tab-pane label="可打击度分析" name="attackability" />
        <el-tab-pane label="杀伤链方案" name="killchain" />
        <el-tab-pane label="打击结果评估" name="evaluation" />
        <el-tab-pane label="打击方案仿真" name="simulation" />
      </el-tabs>

      <router-view />
    </el-card>
  </div>
</template>

<script setup lang="ts">
/**
 * 导入 Vue 核心 API 及 Vue Router 路由钩子
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

/** 获取当前路由信息对象 */
const route = useRoute()

/** 获取路由导航控制器对象 */
const router = useRouter()

/** 路由 Name 到 Tab 页标识的映射关系对象 */
const tabNameMap: Record<string, string> = {
  SatelliteThreat: 'threat',
  SatelliteAttackability: 'attackability',
  KillChainPlan: 'killchain',
  EvaluationResult: 'evaluation',
  StrikeSimulation: 'simulation',
}

/** 当前激活的选项卡名称，根据当前路由自动匹配 */
const activeTab = computed({
  get: () => tabNameMap[String(route.name ?? '')] ?? 'threat',
  set: () => undefined,
})

/**
 * 响应选项卡点击切换逻辑
 * @param tabName 目标选项卡标识字符串
 */
const handleTabChange = (tabName: string) => {
  if (tabName === 'threat') {
    router.push({ name: 'SatelliteThreat' })
  } else if (tabName === 'attackability') {
    router.push({ name: 'SatelliteAttackability' })
  } else if (tabName === 'killchain') {
    router.push({ name: 'KillChainPlan' })
  } else if (tabName === 'evaluation') {
    router.push({ name: 'EvaluationResult' })
  } else if (tabName === 'simulation') {
    router.push({ name: 'StrikeSimulation' })
  }
}
</script>

<style scoped lang="scss">
.algorithm-manage-page {
  padding: 8px 12px;
  box-sizing: border-box;
}

.algorithm-manage-card {
  background: var(--surface-bg-color);
  border: 1px solid var(--surface-border-color);
  color: var(--text-color-strong);
  box-sizing: border-box;

  :deep(.el-card__body) {
    padding: 6px 12px 12px 12px;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 4px;
  }
}
</style>
