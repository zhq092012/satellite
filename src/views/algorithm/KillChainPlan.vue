<template>
  <div class="algorithm-view-container">
    <KillChain />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入杀伤链方案功能组件
 */
import KillChain from '@/components/cesium/KillChain.vue'
</script>

<style scoped lang="scss">
.algorithm-view-container {
  width: 100%;
  margin-top: 0;
}
</style>
