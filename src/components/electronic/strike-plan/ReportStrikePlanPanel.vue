<template>
  <div
    class="report-strike-plan"
    :class="{ 'report-strike-plan--horizontal': horizontal }"
  >
    <header v-if="plan.struck" class="report-strike-plan__split">
      <span class="report-strike-plan__split-label">打击分类</span>
      <span class="report-strike-plan__split-value">{{ struckSplitLine }}</span>
    </header>

    <p v-if="plan.satellitesTruncated" class="report-strike-plan__hint">
      被打击清单已截断，完整明细见阶段结构中对应档位。
    </p>

    <section v-if="struckRows.length" class="report-strike-plan__block">
      <h4 class="report-strike-plan__block-title">
        被打击卫星（{{ struckRows.length }}）
      </h4>
      <div class="report-strike-plan__table-wrap">
        <table class="report-strike-plan__table">
          <thead>
            <tr>
              <th>名称</th>
              <th>体系</th>
              <th>系列</th>
              <th>威胁度</th>
              <th>角色</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in struckRows" :key="`${row.noradId}-${idx}`">
              <td class="report-strike-plan__name">{{ row.name }}</td>
              <td>{{ row.system }}</td>
              <td>{{ row.series }}</td>
              <td class="report-strike-plan__num">{{ row.threatText }}</td>
              <td>{{ row.quotaRole }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="compareBlocks.length"
      class="report-strike-plan__block report-strike-plan__block--compare"
    >
      <h4 class="report-strike-plan__block-title">打击前后比对</h4>
      <p v-if="comparisonBaseline" class="report-strike-plan__baseline">{{ comparisonBaseline }}</p>
      <div class="report-strike-plan__compare-grid">
        <article
          v-for="(block, bidx) in compareBlocks"
          :key="`${block.title}-${bidx}`"
          class="report-strike-plan__compare-card"
        >
          <h5 class="report-strike-plan__compare-title">{{ block.title }}</h5>
          <div class="report-strike-plan__compare-table-wrap">
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
                  <td class="report-strike-plan__cell report-strike-plan__cell--before">{{ row.before }}</td>
                  <td class="report-strike-plan__cell report-strike-plan__cell--after">{{ row.after }}</td>
                  <td class="report-strike-plan__cell report-strike-plan__cell--delta">{{ row.delta }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="block.summary" class="report-strike-plan__summary">{{ block.summary }}</p>
        </article>
      </div>
    </section>

    <ul v-if="warningTexts.length" class="report-strike-plan__warnings">
      <li v-for="(text, idx) in warningTexts" :key="idx">{{ text }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrikePlan } from '@/types/report/report'
import {
  buildStrikePlanCompareBlocks,
  formatStruckSatelliteRow,
  formatStrikeSystemSplitLine,
} from '@/utils/strikePlanDisplay'

const props = defineProps<{
  /** 与 scheme 同 code 的打击方案 */
  plan: StrikePlan
  /** 横向撑满（仅选一方案时） */
  horizontal?: boolean
}>()

/**
 * 计算：打击分类一行文案。
 * 返回 string。
 * 作用：顶部体系拆分摘要。
 */
const struckSplitLine = computed(() => formatStrikeSystemSplitLine(props.plan.struck))

/**
 * 计算：被打击卫星表行。
 * 返回格式化后的行数组。
 * 作用：清单表格数据源。
 */
const struckRows = computed(() =>
  (props.plan.satellites ?? []).map(formatStruckSatelliteRow),
)

/**
 * 计算：打击前后比对块。
 * 返回 StrikePlanCompareBlock[]。
 * 作用：多卡片对比区。
 */
const compareBlocks = computed(() => buildStrikePlanCompareBlocks(props.plan.comparison))

/**
 * 计算：基线口径说明。
 * 返回 string | undefined。
 * 作用：比对区顶部说明。
 */
const comparisonBaseline = computed(() => props.plan.comparison?.baselineText?.trim() || undefined)

/**
 * 计算：本方案告警文案列表。
 * 返回 string[]。
 * 作用：底部提示。
 */
const warningTexts = computed(() =>
  (props.plan.warnings ?? []).map((w) => w.text?.trim()).filter((t): t is string => Boolean(t)),
)
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.report-strike-plan {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  text-align: left;
  font-size: battleUi.$battle-ui-font-base;
  color: #e2e8f0;

  &--horizontal {
    width: 100%;

    .report-strike-plan__compare-grid {
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
  }
}

.report-strike-plan__split {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  background: rgba(69, 26, 26, 0.35);
}

.report-strike-plan__split-label {
  font-weight: 700;
  color: #fca5a5;
}

.report-strike-plan__split-value {
  color: #fecaca;
}

.report-strike-plan__hint {
  margin: 0;
  font-size: battleUi.$battle-ui-font-base;
  color: #fbbf24;
}

.report-strike-plan__block {
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(248, 113, 113, 0.22);
  background: rgba(20, 12, 24, 0.75);
}

.report-strike-plan__block-title {
  margin: 0 0 10px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #f87171;
}

.report-strike-plan__table-wrap {
  overflow-x: auto;
}

.report-strike-plan__table {
  width: 100%;
  min-width: 420px;
  border-collapse: collapse;

  th,
  td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(248, 113, 113, 0.12);
    text-align: left;
  }

  th {
    color: #fca5a5;
    font-weight: 600;
    white-space: nowrap;
  }
}

.report-strike-plan__name {
  font-weight: 600;
  color: #fde68a;
}

.report-strike-plan__num {
  font-variant-numeric: tabular-nums;
  color: #7dd3fc;
}

.report-strike-plan__compare-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

.report-strike-plan__compare-card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(167, 139, 250, 0.2);
  background: rgba(15, 12, 32, 0.6);
}

.report-strike-plan__compare-title {
  margin: 0 0 8px;
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 700;
  color: #c4b5fd;
}

.report-strike-plan__compare-table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(167, 139, 250, 0.15);
}

.report-strike-plan__compare-table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: battleUi.$battle-ui-font-base;

  thead th {
    padding: 8px 10px;
    font-size: battleUi.$battle-ui-font-emphasis;
    font-weight: 600;
    color: #a78bfa;
    background: rgba(30, 20, 60, 0.9);
    border-bottom: 1px solid rgba(167, 139, 250, 0.2);
    text-align: center;
    white-space: nowrap;

    &:first-child {
      text-align: left;
    }
  }

  tbody td {
    padding: 9px 10px;
    border-bottom: 1px solid rgba(167, 139, 250, 0.1);
    vertical-align: middle;
    line-height: 1.45;
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.report-strike-plan__metric {
  font-weight: 600;
  color: #cbd5e1;
  text-align: left;
  white-space: nowrap;
}

.report-strike-plan__cell {
  text-align: center;
  font-variant-numeric: tabular-nums;
  word-break: break-word;

  &--before {
    color: #a5f3fc;
  }

  &--after {
    color: #fde68a;
    font-weight: 600;
  }

  &--delta {
    color: #fb923c;
    font-weight: 600;
  }
}

.report-strike-plan__baseline {
  margin: 0 0 10px;
  font-size: battleUi.$battle-ui-font-base;
  color: #94a3b8;
  line-height: 1.5;
}

.report-strike-plan__summary {
  margin: 8px 0 0;
  font-size: battleUi.$battle-ui-font-base;
  line-height: 1.5;
  color: #cbd5e1;
}

.report-strike-plan__warnings {
  margin: 0;
  padding-left: 1.2em;
  font-size: battleUi.$battle-ui-font-base;
  color: #fbbf24;
  line-height: 1.45;
}
</style>