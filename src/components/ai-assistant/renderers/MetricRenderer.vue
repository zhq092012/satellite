<script setup lang="ts">
defineProps<{
  /** 指标名称 */
  title: string
  /** 指标数值 */
  value: string | number
  /** 单位。没有单位时不显示 */
  unit?: string
}>()
</script>

<template>
  <div class="ai-metric">
    <div class="ai-metric-title">{{ title }}</div>
    <div class="ai-metric-value">
      <span>{{ value }}</span>
      <span v-if="unit" class="ai-metric-unit">{{ unit }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-metric {
  box-sizing: border-box;
  width: calc(50% - 6px);
  min-height: 72px;
  padding: 10px 12px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
}

.ai-metric-title {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.4;
}

.ai-metric-value {
  margin-top: 6px;
  color: #f8fafc;
  font-size: 18px;
  font-weight: 650;
  word-break: break-all;
}

.ai-metric-unit {
  margin-left: 4px;
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 500;
}
</style>
