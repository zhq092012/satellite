<template>
  <div class="algorithm-view-container">
    <SatelliteThreatView />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入卫星威胁分析功能组件
 */
import SatelliteThreatView from '@/components/cesium/SatelliteThreatView.vue'
</script>

<style scoped lang="scss">
.algorithm-view-container {
  width: 100%;
  margin-top: 0;
}
</style>
