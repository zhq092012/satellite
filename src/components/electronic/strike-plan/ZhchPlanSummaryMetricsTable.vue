<template>
  <ZhchPlanMetricsTable
    title="方案概要"
    :columns="tableModel.columns"
    :rows="rows"
    :vertical="vertical"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanResp } from '@/api/electronic'
import {
  buildZhchPlanSummaryMetricsTable,
  toZhchPlanMetricsTableRowsFromSummary,
} from '@/utils/buildZhchPlanMetricsCompareTable'
import ZhchPlanMetricsTable from './ZhchPlanMetricsTable.vue'

const props = defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
  /** 多方案并排纵向表 */
  vertical?: boolean
}>()

const tableModel = computed(() => buildZhchPlanSummaryMetricsTable(props.plan))
const rows = computed(() => toZhchPlanMetricsTableRowsFromSummary(tableModel.value))
</script>
