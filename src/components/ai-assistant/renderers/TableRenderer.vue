<script setup lang="ts">
import type { AiTableBlock } from '@/types/ai'

defineProps<{
  /** 动态表格内容块 */
  block: AiTableBlock
}>()
</script>

<template>
  <div class="ai-table">
    <div v-if="block.title" class="ai-table-title">{{ block.title }}</div>
    <div v-if="block.data.length === 0" class="ai-table-empty">暂无数据</div>
    <div v-else class="ai-table-scroll">
      <el-table :data="block.data" size="small" border max-height="280">
        <el-table-column
          v-for="column in block.columns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          min-width="120"
          show-overflow-tooltip
        />
      </el-table>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-table-title {
  margin-bottom: 6px;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
}

.ai-table-empty {
  padding: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 8px;
  color: #94a3b8;
  text-align: center;
}

.ai-table-scroll {
  width: 100%;
  overflow-x: auto;
}
</style>
