<template>
  <div class="algorithm-view-container">
    <SatelliteAttackabilityView />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入卫星可打击度分析功能组件
 */
import SatelliteAttackabilityView from '@/components/cesium/SatelliteAttackabilityView.vue'
</script>

<style scoped lang="scss">
.algorithm-view-container {
  width: 100%;
  min-height: calc(100vh - 160px);
  margin-top: 16px;
}
</style>
