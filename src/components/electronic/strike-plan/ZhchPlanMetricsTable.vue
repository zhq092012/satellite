<template>
  <div class="zhch-metrics-table" :class="{ 'zhch-metrics-table--vertical': vertical }">
    <div class="zhch-metrics-table__head">{{ title }}</div>
    <div class="zhch-metrics-table__scroll">
      <!-- 多方案并排：指标为行，列宽随容器，无横向滚动 -->
      <table
        v-if="vertical"
        class="zhch-metrics-table__grid zhch-metrics-table__grid--vertical"
        :class="
          isPhaseCompare
            ? 'zhch-metrics-table__grid--vertical-compare'
            : 'zhch-metrics-table__grid--vertical-summary'
        "
      >
        <colgroup>
          <col class="zhch-metrics-table__col zhch-metrics-table__col--label" />
          <template v-if="isPhaseCompare">
            <col class="zhch-metrics-table__col zhch-metrics-table__col--value" />
            <col class="zhch-metrics-table__col zhch-metrics-table__col--value" />
          </template>
          <col v-else class="zhch-metrics-table__col zhch-metrics-table__col--value" />
        </colgroup>
        <thead>
          <tr>
            <th class="zhch-metrics-table__th zhch-metrics-table__th--label">指标</th>
            <template v-if="isPhaseCompare">
              <th class="zhch-metrics-table__th zhch-metrics-table__th--value">打击前</th>
              <th class="zhch-metrics-table__th zhch-metrics-table__th--value">打击后</th>
            </template>
            <th v-else class="zhch-metrics-table__th zhch-metrics-table__th--value">数值</th>
          </tr>
        </thead>
        <tbody v-if="isPhaseCompare">
          <tr v-for="item in verticalCompareRows" :key="item.key" class="zhch-metrics-table__tr">
            <td class="zhch-metrics-table__td zhch-metrics-table__td--label">{{ item.label }}</td>
            <td class="zhch-metrics-table__td zhch-metrics-table__td--value">
              <MetricCellContent
                :cell="item.beforeCell"
                :apply-value-tone="false"
                align="end"
              />
            </td>
            <td class="zhch-metrics-table__td zhch-metrics-table__td--value">
              <MetricCellContent
                :cell="item.afterCell"
                :apply-value-tone="true"
                show-delta
                align="end"
              />
            </td>
          </tr>
        </tbody>
        <tbody v-else>
          <tr v-for="item in verticalSummaryRows" :key="item.key" class="zhch-metrics-table__tr">
            <td class="zhch-metrics-table__td zhch-metrics-table__td--label">{{ item.label }}</td>
            <td class="zhch-metrics-table__td zhch-metrics-table__td--value">
              <MetricCellContent
                :cell="item.valueCell"
                :apply-value-tone="true"
                align="end"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 单方案宽屏：指标为列 -->
      <table v-else class="zhch-metrics-table__grid">
        <thead>
          <tr>
            <th
              v-if="showPhaseColumn"
              class="zhch-metrics-table__th zhch-metrics-table__th--phase"
            >
              阶段
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              class="zhch-metrics-table__th"
              :style="col.minWidth ? { minWidth: `${col.minWidth}px` } : undefined"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.rowKey"
            class="zhch-metrics-table__tr"
            :class="rowVariantClass(row.rowVariant)"
          >
            <td
              v-if="showPhaseColumn"
              class="zhch-metrics-table__td zhch-metrics-table__td--phase"
            >
              {{ row.rowLabel ?? '' }}
            </td>
            <td
              v-for="col in columns"
              :key="`${row.rowKey}-${col.key}`"
              class="zhch-metrics-table__td zhch-metrics-table__td--horizontal-value"
            >
              <MetricCellContent
                :cell="row.cells[col.key]"
                :apply-value-tone="shouldApplyValueTone(row, col.key)"
                :show-delta="!!row.showDelta"
                align="center"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  ZhchPlanMetricColumnDef,
  ZhchPlanMetricsTableRowView,
} from '@/utils/buildZhchPlanMetricsCompareTable'
import MetricCellContent from './ZhchPlanMetricCellContent.vue'

const props = defineProps<{
  /** 表格标题 */
  title: string
  /** 列定义 */
  columns: ZhchPlanMetricColumnDef[]
  /** 数据行 */
  rows: ZhchPlanMetricsTableRowView[]
  /** 是否展示首列「阶段」（横向对比表） */
  showPhaseColumn?: boolean
  /** 多方案并排时使用纵向指标表，避免横向滚动 */
  vertical?: boolean
}>()

/** 是否为打击前/后双行对比（纵向三列） */
const isPhaseCompare = computed(
  () => !!props.showPhaseColumn && props.rows.some((r) => r.rowVariant === 'before')
)

/** 纵向对比表：每个指标一行，单元格分为打击前和打击后。 */
const verticalCompareRows = computed(() => {
  if (!props.vertical || !isPhaseCompare.value) return []
  const beforeRow = props.rows.find((row) => row.rowVariant === 'before')
  const afterRow = props.rows.find((row) => row.rowVariant === 'after')
  return props.columns.map((col) => ({
    key: col.key,
    label: col.label,
    beforeCell: beforeRow?.cells[col.key],
    afterCell: afterRow?.cells[col.key],
  }))
})

/** 纵向概要表：每个指标一行，只有一个数值单元格。 */
const verticalSummaryRows = computed(() => {
  if (!props.vertical || isPhaseCompare.value) return []
  const summaryRow = props.rows[0]
  return props.columns.map((col) => ({
    key: col.key,
    label: col.label,
    valueCell: summaryRow?.cells[col.key],
  }))
})

const shouldApplyValueTone = (row: ZhchPlanMetricsTableRowView, colKey: string): boolean => {
  if (row.rowVariant === 'before') return false
  return !!row.cells[colKey]?.valueTone
}

const rowVariantClass = (variant?: ZhchPlanMetricsTableRowView['rowVariant']): string | undefined => {
  if (!variant || variant === 'summary') return undefined
  return `zhch-metrics-table__tr--${variant}`
}
</script>

<style lang="scss" scoped>
.zhch-metrics-table {
  border-radius: 8px;
  border: 1px solid var(--accent-border-strong);
  background: var(--swatch-rgba-14-28-48-0_6);
  overflow: hidden;

  .zhch-plan-detail--align & {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  &--vertical {
    .zhch-metrics-table__head {
      font-size: var(--font-size-lg);
      padding: 8px 10px;
    }

    .zhch-metrics-table__scroll {
      overflow-x: hidden;
    }

    .zhch-metrics-table__grid--vertical {
      font-size: var(--font-size-lg);
      table-layout: fixed;
      width: 100%;
    }

    .zhch-metrics-table__col--label {
      width: 38%;
    }

    .zhch-metrics-table__col--value {
      width: 31%;
    }

    .zhch-metrics-table__grid--vertical-summary {
      .zhch-metrics-table__col--label {
        width: 42%;
      }

      .zhch-metrics-table__col--value {
        width: 58%;
      }
    }

    .zhch-metrics-table__th,
    .zhch-metrics-table__td {
      box-sizing: border-box;
      padding-top: 6px;
      padding-bottom: 6px;
      white-space: normal;
      word-break: break-word;
      vertical-align: top;
    }

    .zhch-metrics-table__th--label,
    .zhch-metrics-table__td--label {
      text-align: left;
      padding-left: 8px;
      padding-right: 4px;
      color: var(--text-color-muted);
      font-weight: var(--font-weight-bold);
    }

    .zhch-metrics-table__th--label {
      color: var(--accent-cyan);
    }

    .zhch-metrics-table__th--value,
    .zhch-metrics-table__td--value {
      text-align: right;
      padding-left: 4px;
      padding-right: 8px;
    }

    .zhch-metrics-table__th--value {
      color: var(--accent-cyan);
      font-weight: var(--font-weight-bold);
    }
  }

  &__head {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-heavy);
    color: var(--color-info-soft);
    padding: 10px 14px;
    border-bottom: 1px solid var(--accent-bg);
    background: rgba(var(--accent-cyan-rgb), 0.06);
    text-align: center;
  }

  &__scroll {
    overflow-x: auto;
    flex: 1;
    min-height: 0;
  }

  &__grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: auto;
    font-size: var(--font-size-lg);
  }

  &__th {
    padding: 10px 8px;
    text-align: center;
    font-weight: var(--font-weight-bold);
    color: var(--accent-cyan);
    background: var(--panel-bg);
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
    white-space: nowrap;

    &--phase {
      text-align: left;
      padding-left: 14px;
      position: sticky;
      left: 0;
      z-index: 2;
    }
  }

  &__td {
    padding: 10px 8px;
    text-align: center;
    vertical-align: middle;
    color: var(--text-color-soft);
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.08);
    line-height: 1.45;

    &--horizontal-value {
      :deep(.zhch-metric-cell) {
        margin-left: auto;
        margin-right: auto;
      }
    }

    &--phase {
      text-align: left;
      padding-left: 14px;
      font-weight: var(--font-weight-heavy);
      white-space: nowrap;
      position: sticky;
      left: 0;
      z-index: 1;
      background: var(--swatch-rgba-14-28-48-0_98);
    }
  }

  &__tr--before :deep(.zhch-metric-cell__value) {
    color: var(--text-color-soft);
  }

  &__tr--after :deep(.zhch-metric-cell__value) {
    color: var(--text-color-strong);
    font-weight: var(--font-weight-semibold);
  }
}
</style>
