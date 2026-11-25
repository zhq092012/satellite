<template>
  <div
    class="report-strike-plan"
    :class="{ 'report-strike-plan--horizontal': horizontal }"
  >
    <div v-if="plan.struck" class="report-strike-plan__split">
      <span class="report-strike-plan__split-label">打击分类</span>
      <span class="report-strike-plan__split-value">{{ struckSplitLine }}</span>
    </div>

    <section v-if="struckRows.length" class="report-strike-plan__section">
      <h4 class="report-strike-plan__section-title">
        被打击卫星（{{ struckRows.length }}）
      </h4>
      <p v-if="plan.satellitesTruncated" class="report-strike-plan__caption">
        被打击清单已截断，完整明细见阶段结构中对应档位。
      </p>
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

    <div
      v-if="compareBlocks.length"
      class="report-strike-plan__compare-group"
    >
      <h4 class="report-strike-plan__section-title report-strike-plan__section-title--major">
        打击前后比对
      </h4>
      <p v-if="comparisonBaseline" class="report-strike-plan__caption">{{ comparisonBaseline }}</p>

      <div
        class="report-strike-plan__compare-list"
        :class="{ 'report-strike-plan__compare-list--matrix': horizontal }"
        :style="horizontalCompareGridStyle"
      >
        <template v-if="horizontal">
          <h5
            v-for="(block, bidx) in compareBlocks"
            :key="`title-${block.title}-${bidx}`"
            class="report-strike-plan__subsection-title report-strike-plan__compare-matrix-title"
          >
            {{ block.title }}
          </h5>
          <p
            v-for="(block, bidx) in compareBlocks"
            :key="`caption-${block.title}-${bidx}`"
            class="report-strike-plan__caption report-strike-plan__compare-matrix-caption"
          >
            {{ block.summary?.trim() || '\u00a0' }}
          </p>
          <div
            v-for="(block, bidx) in compareBlocks"
            :key="`table-${block.title}-${bidx}`"
            class="report-strike-plan__compare-matrix-table"
          >
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
          </div>
        </template>
        <template v-else>
          <section
            v-for="(block, bidx) in compareBlocks"
            :key="`${block.title}-${bidx}`"
            class="report-strike-plan__section report-strike-plan__section--compare"
          >
            <h5 class="report-strike-plan__subsection-title">{{ block.title }}</h5>
            <p v-if="block.summary" class="report-strike-plan__caption">{{ block.summary }}</p>
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
        </template>
      </div>
    </div>

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

/**
 * 计算：横排比对网格列数 CSS 变量。
 * 返回 style 对象或 undefined。
 * 作用：说明行等高后表格顶对齐。
 */
const horizontalCompareGridStyle = computed(() => {
  if (!props.horizontal) return undefined
  const count = compareBlocks.value.length
  if (count < 1) return undefined
  return { '--compare-cols': String(count) } as Record<string, string>
})
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

/** 表格上方说明字号（略小于正文） */
$table-caption-font: 16px;

.report-strike-plan {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0;
  min-width: 0;
  text-align: left;
  font-size: battleUi.$battle-ui-font-base;
  color: #e2e8f0;

  &--horizontal {
    width: 100%;
  }
}

.report-strike-plan__compare-group {
  margin-top: 24px;
  text-align: left;
}

.report-strike-plan__compare-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: stretch;
}

/**
 * 横排：标题一行、说明一行（行高取最高）、表格一行，保证表头顶对齐。
 */
.report-strike-plan__compare-list--matrix {
  display: grid;
  grid-template-columns: repeat(var(--compare-cols, 1), minmax(0, 1fr));
  column-gap: 28px;
  row-gap: 8px;
  align-items: stretch;
}

.report-strike-plan__compare-matrix-title {
  margin: 0;
  align-self: end;
}

.report-strike-plan__compare-matrix-caption {
  margin: 0;
  min-height: 0;
}

.report-strike-plan__compare-matrix-table {
  min-width: 0;
  align-self: start;
}

.report-strike-plan__split {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-start;
  gap: 6px 10px;
  margin-bottom: 16px;
  text-align: left;
}

.report-strike-plan__split-label {
  font-weight: 700;
  color: #7dd3fc;
}

.report-strike-plan__split-value {
  color: #fde68a;
  font-weight: 600;
}

.report-strike-plan__section {
  margin-top: 20px;
  padding: 0;
  text-align: left;

  &:first-of-type {
    margin-top: 0;
  }

  &--compare {
    margin-top: 16px;
  }
}

.report-strike-plan__section-title {
  margin: 0 0 8px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
  text-align: left;

  &--major {
    margin-top: 0;
  }
}

.report-strike-plan__subsection-title {
  margin: 0 0 6px;
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 700;
  color: #7dd3fc;
  text-align: left;
}

.report-strike-plan__caption {
  margin: 0 0 8px;
  font-size: $table-caption-font;
  line-height: 1.5;
  color: #94a3b8;
  text-align: left;
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
  min-width: 420px;

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

.report-strike-plan__num {
  font-variant-numeric: tabular-nums;
  color: #fde68a;
  font-weight: 600;
}

.report-strike-plan__compare-table {
  min-width: 480px;
  font-size: battleUi.$battle-ui-font-base;

  thead th {
    padding: 8px 10px;
    font-size: battleUi.$battle-ui-font-emphasis;
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

.report-strike-plan__warnings {
  margin: 20px 0 0;
  padding-left: 1.2em;
  font-size: $table-caption-font;
  color: #fde68a;
  line-height: 1.45;
  text-align: left;
}
</style>