<template>
  <div class="algorithm-view-container">
    <SatelliteUnReal />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入打击方案仿真功能组件
 */
import SatelliteUnReal from '@/components/cesium/SatelliteUnReal.vue'
</script>

<style scoped lang="scss">
.algorithm-view-container {
  width: 100%;
  min-height: calc(100vh - 160px);
  margin-top: 16px;
}
</style>
