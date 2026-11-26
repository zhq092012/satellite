<template>
  <div class="report-strike-plan">
    <!-- 顶部：方案概要（StrikePlan 元字段） -->
    <header v-if="metaFields.length" class="report-strike-plan__meta">
      <dl class="report-strike-plan__meta-list">
        <div v-for="item in metaFields" :key="item.label" class="report-strike-plan__meta-row">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.value }}</dd>
        </div>
      </dl>
    </header>

    <!-- 中部：被打击卫星清单 -->
    <section class="report-strike-plan__section report-strike-plan__section--satellites">
      <h4 class="report-strike-plan__section-title">打击卫星（{{ struckRows.length }}）</h4>
      <p v-if="!struckRows.length" class="report-strike-plan__empty">暂无被打击卫星</p>
      <div v-else class="report-strike-plan__table-wrap">
        <table class="report-strike-plan__table">
          <thead>
            <tr>
              <th>国家</th>

              <th>名称</th>
              <th>体系</th>
              <th>系列</th>

              <th>威胁度</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in struckRows" :key="`${row.noradId}-${idx}`">
              <td>{{ row.country }}</td>
              <td class="report-strike-plan__name">{{ row.name }}</td>
              <td>{{ row.system }}</td>
              <td>{{ row.series }}</td>

              <td class="report-strike-plan__num">{{ row.threatText }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 底部：侦察 / 通信卫星打击前后对比 -->
    <section v-if="compareBlocks.length" class="report-strike-plan__section report-strike-plan__section--compare">
      <div class="report-strike-plan__compare-list">
        <section v-for="(block, bidx) in compareBlocks" :key="`${block.title}-${bidx}`"
          class="report-strike-plan__compare-card">
          <h5 class="report-strike-plan__subsection-title">{{ block.title }}</h5>
          <div class="report-strike-plan__table-wrap">
            <table class="report-strike-plan__compare-table">
              <thead>
                <tr>
                  <th>指标</th>
                  <th>打击前</th>
                  <th>打击后</th>
                  <th>变化</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, ridx) in block.rows" :key="`${row.label}-${ridx}`">
                  <td class="report-strike-plan__metric">{{ row.label }}</td>
                  <td class="report-strike-plan__cell">{{ row.before }}</td>
                  <td class="report-strike-plan__cell">{{ row.after }}</td>
                  <td class="report-strike-plan__cell">{{ row.delta }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
    <p v-else class="report-strike-plan__empty report-strike-plan__empty--compare">无比对数据</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrikePlan } from '@/types/report/report'
import {
  buildStrikePlanCompareBlocks,
  buildStrikePlanMetaFields,
  formatStruckSatelliteRow,
} from '@/utils/strikePlanDisplay'

const props = defineProps<{
  /** 打击方案（与勾选格子同 code） */
  plan: StrikePlan
}>()

/**
 * 计算：方案顶部概要键值。
 * 返回 StrikePlanMetaField[]。
 * 作用：头部信息区数据源。
 */
const metaFields = computed(() => buildStrikePlanMetaFields(props.plan))

/**
 * 计算：被打击卫星表行。
 * 返回格式化后的行数组。
 * 作用：中部卫星清单表格。
 */
const struckRows = computed(() =>
  (props.plan.satellites ?? []).map(formatStruckSatelliteRow),
)

/**
 * 计算：打击前后比对块。
 * 返回 StrikePlanCompareBlock[]。
 * 作用：底部侦察/通信对比区。
 */
const compareBlocks = computed(() => buildStrikePlanCompareBlocks(props.plan))

</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

/** 概要区标签列固定宽度（与最长标签「被打击目标总数」对齐） */
$report-meta-key-width: 80px;

.report-strike-plan {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  text-align: left;
  font-size: battleUi.$battle-ui-font-base;
  color: #e2e8f0;

}

.report-strike-plan__meta {
  margin-bottom: 20px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.28);
  background: linear-gradient(135deg, rgba(12, 28, 48, 0.92), rgba(8, 18, 32, 0.96));
}

.report-strike-plan__meta-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.report-strike-plan__meta-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 12px;
  margin: 0;
  min-width: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(79, 147, 221, 0.12);

  &:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  dt {
    flex: 0 0 $report-meta-key-width;
    width: $report-meta-key-width;
    margin: 0;
    font-weight: 600;
    color: #7dd3fc;
    white-space: nowrap;
    text-align: left;
  }

  dd {
    flex: 1 1 auto;
    margin: 0;
    min-width: 0;
    color: #fde68a;
    font-weight: 600;
    line-height: 1.5;
    text-align: left;
    word-break: break-word;
  }
}

.report-strike-plan__section {
  margin-top: 4px;
  padding: 0;
  text-align: left;

  &--compare {
    margin-top: 24px;
  }
}

.report-strike-plan__section-title {
  margin: 0 0 10px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
  text-align: left;

  &--major {
    margin-bottom: 12px;
  }
}

.report-strike-plan__subsection-title {
  margin: 0 0 8px;
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 700;
  color: #7dd3fc;
  text-align: left;
}

.report-strike-plan__empty {
  margin: 0;
  font-size: battleUi.$battle-ui-font-base;
  color: #94a3b8;

  &--compare {
    margin-top: 16px;
  }
}

.report-strike-plan__compare-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
}

.report-strike-plan__compare-card {
  margin: 0;
}

.report-strike-plan__table-wrap {
  overflow-x: auto;
  width: 100%;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.22);
  background: rgba(8, 14, 26, 0.45);
}

.report-strike-plan__table,
.report-strike-plan__compare-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.report-strike-plan__table {
  min-width: 560px;

  th,
  td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(79, 147, 221, 0.15);
    text-align: left;
  }

  th {
    color: #7dd3fc;
    font-weight: 600;
    white-space: nowrap;
    background: rgba(12, 28, 48, 0.85);
    border-bottom: 1px solid rgba(79, 147, 221, 0.22);
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.report-strike-plan__name {
  font-weight: 600;
  color: #7dd3fc;
}

.report-strike-plan__mono {
  font-variant-numeric: tabular-nums;
  color: #a5f3fc;
}

.report-strike-plan__num {
  font-variant-numeric: tabular-nums;
  color: #fde68a;
  font-weight: 600;
}

.report-strike-plan__compare-table {
  min-width: 420px;
  font-size: battleUi.$battle-ui-font-base;

  thead th {
    padding: 8px 10px;
    font-weight: 600;
    color: #7dd3fc;
    border-bottom: 1px solid rgba(79, 147, 221, 0.22);
    text-align: left;
    white-space: nowrap;
    background: rgba(12, 28, 48, 0.85);

    &:not(:first-child) {
      text-align: center;
    }
  }

  tbody td {
    padding: 9px 10px;
    border-bottom: 1px solid rgba(79, 147, 221, 0.12);
    vertical-align: middle;
    line-height: 1.45;

    &:not(:first-child) {
      text-align: center;
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.report-strike-plan__metric {
  font-weight: 600;
  color: #7dd3fc;
  text-align: left;
  white-space: nowrap;
}

.report-strike-plan__cell {
  font-variant-numeric: tabular-nums;
  word-break: break-word;
  color: #fde68a;
  font-weight: 600;
}
</style>