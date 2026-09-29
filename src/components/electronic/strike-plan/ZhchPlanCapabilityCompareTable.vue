<template>
  <ZhchPlanMetricsTable
    :title="title"
    :columns="tableModel.columns"
    :rows="rows"
    show-phase-column
    :vertical="vertical"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanResp } from '@/api/electronic'
import { toZhchPlanMetricsTableRowsFromCompare } from '@/utils/buildZhchPlanMetricsCompareTable'
import {
  buildCommCapabilityCompareTable,
  buildReconCapabilityCompareTable,
} from '@/utils/buildZhchPlanCapabilityCompareTable'
import ZhchPlanMetricsTable from './ZhchPlanMetricsTable.vue'

const props = defineProps<{
  /** 综合打击方案 */
  plan: ZhchPlanResp
  /** 表格类型：天基侦察 / 通信保障 */
  kind: 'recon' | 'comm'
  /** 多方案并排纵向表 */
  vertical?: boolean
}>()

/** 表标题 */
const title = computed(() =>
  props.kind === 'recon' ? '天基侦察能力' : '通信保障能力'
)

const tableModel = computed(() =>
  props.kind === 'recon'
    ? buildReconCapabilityCompareTable(props.plan)
    : buildCommCapabilityCompareTable(props.plan)
)

const rows = computed(() => toZhchPlanMetricsTableRowsFromCompare(tableModel.value))
</script>
