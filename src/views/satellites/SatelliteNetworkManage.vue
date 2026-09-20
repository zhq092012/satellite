<template>
  <div class="satellite-network-manage">
    <SatelliteNetView standalone />
  </div>
</template>

<script setup lang="ts">
/**
 * 顶栏「卫星网络管理」页面：全屏展示卫星关系网络图谱。
 */
import SatelliteNetView from '@/components/cesium/SatelliteNetView.vue'
</script>

<style lang="scss" scoped>
.satellite-network-manage {
  width: 100%;
  padding: 8px 12px 12px;
  box-sizing: border-box;
  min-height: calc(100vh - 76px);
}
</style>
