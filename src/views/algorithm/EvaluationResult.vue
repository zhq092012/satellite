<template>
  <div class="algorithm-view-container">
    <EvaluationReport />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入打击结果评估功能组件
 */
import EvaluationReport from '@/components/cesium/EvaluationReport.vue'
</script>

<style scoped lang="scss">
.algorithm-view-container {
  width: 100%;
  min-height: calc(100vh - 160px);
  margin-top: 16px;
}
</style>
