<template>
  <div class="strike-scheme-panel" :class="{ 'strike-scheme-panel--align': alignBlocks }">
    <template v-if="view.reportScheme">
      <header class="scheme-report-header">
        <h2 class="scheme-report-title">
          {{ view.reportScheme.name?.trim() || view.usageType }}
        </h2>
        <dl v-if="summaryFields.length" class="scheme-summary-grid">
          <div v-for="item in summaryFields" :key="item.label" class="scheme-summary-item">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </header>

      <section v-if="selectedRows.length" class="scheme-section scheme-section--selected">
        <h3 class="scheme-section-title">入选卫星（{{ selectedRows.length }}）</h3>
        <div class="scheme-table-scroll">
          <table class="scheme-table scheme-table--report" cellspacing="0" cellpadding="0">
            <thead>
              <tr>
                <th v-if="colCountry">国家</th>
                <th>卫星名称</th>
                <th v-if="colSystem">体系</th>
                <th v-if="colSeries">系列</th>
                <th v-if="colThreat">威胁度</th>
                <th v-if="colScore">综合得分</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in selectedRows" :key="`sel-${idx}-${row.name}`">
                <td v-if="colCountry">{{ row.country }}</td>
                <td class="scheme-cell--name">
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
                    <button type="button" class="scheme-name-reason-trigger" @click.stop>
                      {{ row.name }}
                    </button>
                  </el-tooltip>
                  <span v-else class="scheme-name-plain">{{ row.name }}</span>
                </td>
                <td v-if="colSystem">{{ row.system }}</td>
                <td v-if="colSeries">{{ row.series }}</td>
                <td v-if="colThreat" class="scheme-cell--num">{{ row.threatText }}</td>
                <td v-if="colScore" class="scheme-cell--num">{{ row.scoreText }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p v-else class="scheme-empty-block">该方案暂无入选卫星</p>
    </template>

    <p v-else class="scheme-empty-block">暂无方案数据</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrikePlanSchemeView } from '@/utils/buildStrikePlanSchemeView'
import { useLayoutStore } from '@/store/modules/layout'
import {
  buildReportSchemeSelectedRows,
  buildReportSchemeSummaryFields,
  reportTableColumnVisible,
} from '@/utils/reportSchemeDisplay'

const props = defineProps<{
  /** 单方案视图数据 */
  view: StrikePlanSchemeView
  /** 多方案并排时纵向对齐 */
  alignBlocks?: boolean
}>()

const store = useLayoutStore()

/**
 * 计算：方案概要字段（仅接口与任务有值项）。
 * 返回 { label, value }[]。
 * 作用：顶部概要卡片。
 */
const summaryFields = computed(() => {
  const scheme = props.view.reportScheme
  if (!scheme) return []
  const taskName = store.activedTask?.name?.trim()
  return buildReportSchemeSummaryFields(scheme, taskName)
})

/**
 * 计算：入选卫星表行。
 * 返回 ReportSchemeSelectedRow[]。
 * 作用：主表格数据源；map 键用 satelliteId 解析，展示用 name。
 */
const selectedRows = computed(() =>
  props.view.reportScheme ? buildReportSchemeSelectedRows(props.view.reportScheme) : [],
)

/**
 * 计算：是否展示 NORAD 列。
 * 返回 boolean。
 * 作用：无数据列不渲染表头。
 */
const colNorad = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.noradId))
const colCountry = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.country))
const colSystem = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.system))
const colSeries = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.series))
const colThreat = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.threatText))
const colScore = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.scoreText))
const colWindow = computed(() => reportTableColumnVisible(selectedRows.value, (r) => r.windowText))
const colInWindow = computed(() =>
  reportTableColumnVisible(selectedRows.value, (r) => r.inTimeWindow),
)
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.strike-scheme-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  height: 100%;
  color: #e2e8f0;
}

.scheme-report-header {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(0, 225, 255, 0.18);
  background: linear-gradient(135deg, rgba(12, 28, 48, 0.95), rgba(8, 18, 32, 0.98));
  text-align: left;
}

.scheme-report-title {
  margin: 0 0 12px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
  line-height: 1.35;
  text-align: center;
}

.scheme-summary-grid {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  width: 100%;
}

.scheme-summary-item {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  width: 100%;
  max-width: 100%;
  text-align: left;

  dt {
    flex: 0 0 auto;
    margin: 0;
    font-size: 14px;
    color: #94a3b8;
    font-weight: 600;
    white-space: nowrap;
    min-width: 80px;

    &::after {
      content: '：';
    }
  }

  dd {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: battleUi.$battle-ui-font-base;
    color: #e2efff;
    word-break: break-word;
  }
}

.scheme-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.22);
  background: rgba(8, 15, 26, 0.72);
}

.scheme-section-title {
  margin: 0 0 10px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #00e1ff;
}

.scheme-table-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid rgba(0, 225, 255, 0.1);
}

.scheme-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: battleUi.$battle-ui-font-base;

  th {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 8px 10px;
    text-align: center;
    font-weight: 600;
    color: #00e1ff;
    background: rgba(13, 27, 49, 0.98);
    border-bottom: 1px solid rgba(0, 225, 255, 0.15);
    white-space: normal;
    word-break: break-word;
    line-height: 1.35;
  }

  td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(0, 225, 255, 0.08);
    vertical-align: middle;
    text-align: center;
    color: #cbd5e1;
    word-break: break-word;
    overflow-wrap: anywhere;
  }

  tbody tr:hover td {
    background: rgba(0, 225, 255, 0.06);
  }
}

.scheme-cell--name {
  font-weight: 600;
  color: #fde68a;
}

.scheme-name-plain {
  display: inline;
  color: #fde68a;
  font-weight: 600;
}

.scheme-name-reason-trigger {
  display: inline;
  margin: 0;
  padding: 0;
  border: none;
  background: none;
  color: #fde68a;
  font: inherit;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  word-break: break-word;
  text-decoration: underline dotted rgba(253, 230, 138, 0.45);
  text-underline-offset: 3px;
  transition: color 0.15s ease;

  &:hover {
    color: #fef3c7;
    text-decoration-color: rgba(254, 243, 199, 0.75);
  }
}

.scheme-cell--num {
  font-variant-numeric: tabular-nums;
  color: #a5f3fc;
  white-space: normal;
}

.scheme-cell--time {
  font-size: 14px;
  white-space: nowrap;
}

.scheme-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 600;

  &--yes {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
  }

  &--no {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
  }
}

.scheme-empty-block {
  margin: 0;
  padding: 24px;
  text-align: center;
  color: #64748b;
  border: 1px dashed rgba(0, 225, 255, 0.15);
  border-radius: 8px;
}

.strike-scheme-panel--align {
  .scheme-section--selected {
    min-height: 420px;
  }
}
</style>

<style lang="scss">
.scheme-reason-tooltip-popper {
  max-width: min(440px, 92vw);

  .scheme-reason-tooltip-body {
    margin: 0;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
    font-size: 14px;
  }
}
</style>