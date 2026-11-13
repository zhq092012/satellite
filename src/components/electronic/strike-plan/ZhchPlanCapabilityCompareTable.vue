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

/**
 * 计算：按 props.kind 选择能力对比表标题文案。
 * 返回：string（「天基侦察能力」或「通信保障能力」）。
 * 作用：传递给 ZhchPlanMetricsTable 的 title。
 */
const title = computed(() =>
  props.kind === 'recon' ? '天基侦察能力' : '通信保障能力'
)

/**
 * 计算：按 kind 调用对应构建函数生成侦察或通信能力对比表模型。
 * 返回：buildReconCapabilityCompareTable / buildCommCapabilityCompareTable 的模型对象。
 * 作用：提供列定义与原始对比数据供行视图转换。
 */
const tableModel = computed(() =>
  props.kind === 'recon'
    ? buildReconCapabilityCompareTable(props.plan)
    : buildCommCapabilityCompareTable(props.plan)
)

/**
 * 计算：将 tableModel 转为 ZhchPlanMetricsTable 可用的行视图。
 * 返回：ZhchPlanMetricsTableRowView[]（由 toZhchPlanMetricsTableRowsFromCompare 决定）。
 * 作用：作为子表 rows 数据源。
 */
const rows = computed(() => toZhchPlanMetricsTableRowsFromCompare(tableModel.value))
</script>
