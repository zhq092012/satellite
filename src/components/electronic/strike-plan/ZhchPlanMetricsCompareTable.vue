<template>
  <ZhchPlanMetricsTable
    title="打击前后指标对比"
    :columns="tableModel.columns"
    :rows="rows"
    show-phase-column
    :vertical="vertical"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanResp } from '@/api/electronic'
import {
  buildZhchPlanMetricsCompareTable,
  toZhchPlanMetricsTableRowsFromCompare,
} from '@/utils/buildZhchPlanMetricsCompareTable'
import ZhchPlanMetricsTable from './ZhchPlanMetricsTable.vue'

const props = defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
  /** 多方案并排纵向表 */
  vertical?: boolean
}>()

const tableModel = computed(() => buildZhchPlanMetricsCompareTable(props.plan))
const rows = computed(() => toZhchPlanMetricsTableRowsFromCompare(tableModel.value))
</script>
