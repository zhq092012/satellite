<template>
  <div class="algorithm-view-container">
    <SatelliteUnreal />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入打击方案仿真功能组件
 */
import SatelliteUnreal from '@/components/cesium/SatelliteUnreal.vue'
</script>

<style scoped lang="scss">
.algorithm-view-container {
  width: 100%;
  margin-top: 0;
}
</style>
