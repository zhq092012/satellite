<template>
  <div
    class="strike-scheme-panel"
    :class="{
      'strike-scheme-panel--dense': dense,
      'strike-scheme-panel--horizontal': horizontal,
    }"
  >
    <template v-if="view.reportScheme">
      <header class="scheme-summary">
        <dl v-if="summaryFields.length" class="scheme-kv">
          <div
            v-for="item in summaryFields"
            :key="item.label"
            class="scheme-kv__row"
            :class="{ 'scheme-kv__row--wide': item.wide }"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
        <dl v-if="metricFields.length" class="scheme-kv scheme-kv--metrics">
          <div v-for="item in metricFields" :key="item.label" class="scheme-kv__row">
            <dt>{{ item.label }}</dt>
            <dd class="scheme-kv__num">{{ item.value }}</dd>
          </div>
        </dl>
      </header>

      <section v-if="quotaRows.length" class="scheme-list-block">
        <h3 class="scheme-list-block__title">配额</h3>
        <ul class="scheme-quota-list">
          <li
            v-for="(row, idx) in quotaRows"
            :key="`q-${idx}`"
            class="scheme-quota-list__item"
            :class="{ 'scheme-quota-list__item--bad': row.satisfied === false }"
          >
            <span class="scheme-quota-list__system">{{ row.system }}</span>
            <span class="scheme-quota-list__count">{{ row.countText }}</span>
            <span v-if="row.note" class="scheme-quota-list__note">{{ row.note }}</span>
          </li>
        </ul>
      </section>

      <section v-if="selectedRows.length" class="scheme-list-block scheme-list-block--grow">
        <h3 class="scheme-list-block__title">入选卫星（{{ selectedRows.length }}）</h3>
        <ul class="scheme-sat-list">
          <li v-for="(row, idx) in selectedRows" :key="`sat-${idx}-${row.name}`" class="scheme-sat-list__item">
            <div class="scheme-sat-list__name">
              <el-tooltip
                v-if="row.reasonText"
                placement="top"
                trigger="click"
                effect="dark"
                :teleported="true"
                popper-class="scheme-reason-tooltip-popper"
              >
                <template #content>
                  <p class="scheme-reason-tooltip-body">{{ row.reasonText }}</p>
                </template>
                <button type="button" class="scheme-sat-list__name-btn" @click.stop>
                  {{ row.name }}
                </button>
              </el-tooltip>
              <span v-else>{{ row.name }}</span>
            </div>
            <div v-if="satMetaLine(row)" class="scheme-sat-list__meta">{{ satMetaLine(row) }}</div>
          </li>
        </ul>
      </section>
    </template>

    <p v-else class="scheme-empty">暂无方案数据</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrikePlanSchemeView } from '@/utils/buildStrikePlanSchemeView'
import {
  buildReportMetricsSummaryFields,
  buildReportSchemeQuotaRows,
  buildReportSchemeSelectedRows,
  buildReportSchemeSummaryFields,
  formatReportSelectedRowMeta,
  type ReportSchemeSelectedRow,
} from '@/utils/reportSchemeDisplay'

const props = defineProps<{
  /** 单方案视图数据 */
  view: StrikePlanSchemeView
  /** 紧凑卡片模式（报告多列） */
  dense?: boolean
  /** 仅选一方案时横向分栏撑满列宽 */
  horizontal?: boolean
}>()

interface SummaryField {
  label: string
  value: string
  wide?: boolean
}

/** 长文本字段用整行展示 */
const WIDE_SUMMARY_LABELS = new Set(['作战目标', '明细截断'])

/**
 * 计算：方案概要（不含任务名）。
 * 返回 SummaryField[]。
 * 作用：卡片顶部综合区。
 */
const summaryFields = computed((): SummaryField[] => {
  const scheme = props.view.reportScheme
  if (!scheme) return []
  return buildReportSchemeSummaryFields(scheme).map((item) => ({
    ...item,
    wide: WIDE_SUMMARY_LABELS.has(item.label),
  }))
})

/**
 * 计算：metrics 短标签芯片。
 * 返回 { label, value }[]。
 * 作用：综合区指标条。
 */
const metricFields = computed(() =>
  props.view.reportScheme
    ? buildReportMetricsSummaryFields(props.view.reportScheme.metrics, true)
    : [],
)

const selectedRows = computed(() =>
  props.view.reportScheme ? buildReportSchemeSelectedRows(props.view.reportScheme) : [],
)

const quotaRows = computed(() =>
  props.view.reportScheme ? buildReportSchemeQuotaRows(props.view.reportScheme.quota) : [],
)

/**
 * @param row 选星行
 */
const satMetaLine = (row: ReportSchemeSelectedRow): string => formatReportSelectedRowMeta(row)
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

$scheme-kv-key-width: 110px;

.strike-scheme-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  font-size: battleUi.$battle-ui-font-base;
  line-height: 1.45;
  color: #e2e8f0;
  text-align: left;
}

.scheme-summary {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.22);
  background: rgba(10, 20, 36, 0.85);
}

.scheme-kv {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;

  &--metrics {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(79, 147, 221, 0.15);
  }

  &__row {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    text-align: left;

    &--wide {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;

      dt {
        width: auto;
        flex: none;
      }
    }
  }

  dt {
    flex: 0 0 $scheme-kv-key-width;
    width: $scheme-kv-key-width;
    margin: 0;
    font-size: battleUi.$battle-ui-font-base;
    color: #7dd3fc;
    font-weight: 600;
    text-align: left;

    &::after {
      content: '：';
    }
  }

  dd {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: battleUi.$battle-ui-font-base;
    color: #f1f5f9;
    word-break: break-word;
    text-align: left;
  }

  &__num {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #fde68a;
  }
}

.scheme-list-block {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.18);
  background: rgba(8, 14, 26, 0.75);

  &--grow {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  &__title {
    margin: 0 0 10px;
    font-size: battleUi.$battle-ui-font-emphasis;
    font-weight: 700;
    color: #7dd3fc;
  }
}

.scheme-quota-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(15, 25, 42, 0.65);
    font-size: battleUi.$battle-ui-font-base;

    &--bad {
      border: 1px solid rgba(253, 230, 138, 0.4);
      background: rgba(50, 44, 20, 0.35);
    }
  }

  &__system {
    font-weight: 600;
    color: #e2e8f0;
    min-width: 3em;
  }

  &__count {
    font-variant-numeric: tabular-nums;
    color: #fde68a;
    font-weight: 600;
  }

  &__note {
    flex: 1 1 100%;
    font-size: battleUi.$battle-ui-font-base;
    color: #94a3b8;
  }
}

.scheme-sat-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 360px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &__item {
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid transparent;

    &:hover {
      border-color: rgba(0, 225, 255, 0.12);
      background: rgba(0, 225, 255, 0.04);
    }
  }

  &__name {
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    color: #7dd3fc;
    word-break: break-word;
  }

  &__name-btn {
    margin: 0;
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    text-decoration: underline dotted rgba(125, 211, 252, 0.45);
  }

  &__meta {
    margin-top: 4px;
    font-size: battleUi.$battle-ui-font-base;
    color: #94a3b8;
    line-height: 1.4;
    word-break: break-word;
  }
}

.strike-scheme-panel--dense .scheme-sat-list {
  max-height: 280px;
}

.strike-scheme-panel--horizontal {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 12px;
  width: 100%;

  .scheme-summary {
    flex: 1 1 320px;
    min-width: min(100%, 320px);
  }

  .scheme-kv:not(.scheme-kv--metrics) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 16px;
    row-gap: 8px;
  }

  .scheme-kv--metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px 16px;
  }

  .scheme-list-block {
    flex: 1 1 260px;
    min-width: min(100%, 240px);
  }

  .scheme-list-block--grow {
    flex: 1 1 100%;
    max-height: none;
  }

  .scheme-sat-list {
    max-height: 320px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 6px;
    align-content: start;
  }
}

.scheme-empty {
  margin: 0;
  padding: 20px;
  text-align: left;
  color: #64748b;
}
</style>

<style lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.scheme-reason-tooltip-popper {
  max-width: min(440px, 92vw);

  .scheme-reason-tooltip-body {
    margin: 0;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
    font-size: battleUi.$battle-ui-font-base;
  }
}
</style>