<template>
  <section v-if="tierRows.length" class="stage-compare" :class="{ 'stage-compare--top': top }">
    <h3 class="stage-compare__title">
      {{ stageTitle ? `${stageTitle} · 三档对比` : '本阶段三档对比' }}
    </h3>
    <p v-if="recommendation" class="stage-compare__rec">{{ recommendation }}</p>
    <ul v-if="upgradeLines.length" class="stage-compare__upgrades">
      <li v-for="(line, idx) in upgradeLines" :key="`up-${idx}`">{{ line }}</li>
    </ul>
    <p v-if="adviceLine" class="stage-compare__advice">{{ adviceLine }}</p>
    <div class="stage-compare__table-wrap">
      <table class="stage-compare__table">
        <thead>
          <tr>
            <th>档位</th>
            <th>目标数</th>
            <th>达成度</th>
            <th>综合分</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tier in tierRows"
            :key="`tier-${tier.index ?? tier.label}`"
            :class="{
              'stage-compare__row--current': tier.current,
              'stage-compare__row--rec': tier.recommended && !tier.current,
            }"
          >
            <td class="stage-compare__tier">
              <span>{{ tier.label }}</span>
              <span v-if="tier.current" class="stage-compare__tag">已选档</span>
              <span v-else-if="tier.recommended" class="stage-compare__tag stage-compare__tag--rec">推荐</span>
            </td>
            <td>{{ tier.targetSize ?? '—' }}</td>
            <td>{{ tier.attainmentText }}</td>
            <td>{{ tier.scoreText }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportStageResult } from '@/types/report/report'
import { buildReportStageTierCompareRows } from '@/utils/reportSchemeDisplay'

const props = defineProps<{
  /** 阶段实体 */
  stage: ReportStageResult
  /** 本阶段已展示格子的档位序号 */
  activeTierIndexes?: number[]
  /** 阶段展示标题 */
  stageTitle?: string
  /** 置于页面顶部综合区 */
  top?: boolean
}>()

/**
 * 计算：三档对比行。
 * 返回 ReportStageTierCompareRow[]。
 * 作用：阶段底部唯一对比表。
 */
const tierRows = computed(() =>
  buildReportStageTierCompareRows(props.stage, props.activeTierIndexes),
)

/**
 * 计算：推荐结论文本。
 * 返回 string | undefined。
 * 作用：表上方一行摘要。
 */
const recommendation = computed(() => props.stage.recommendation?.trim())

/**
 * 计算：升档性价比摘要列表。
 * 返回 string[]。
 * 作用：推荐下方的补充说明。
 */
const upgradeLines = computed(() =>
  (props.stage.upgrades ?? [])
    .map((u) => u.conclusion?.trim())
    .filter((t): t is string => Boolean(t)),
)

/**
 * 计算：当前推荐档的建议文案拼接。
 * 返回 string | undefined。
 * 作用：表上方补充建议。
 */
const adviceLine = computed(() => {
  const rec = props.stage.recommendedTier
  const tier = (props.stage.tiers ?? []).find((t) => t.index === rec)
  return tier?.advice?.trim()
})
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

/** 表格上方说明字号（略小于正文） */
$table-caption-font: 16px;

.stage-compare {
  margin-top: 16px;
  padding: 16px 18px;
  text-align: left;

  &--top {
    margin-top: 0;
  }
  border-radius: 12px;
  border: 1px solid rgba(79, 147, 221, 0.28);
  background: linear-gradient(180deg, rgba(12, 28, 48, 0.95), rgba(8, 18, 32, 0.98));
}

.stage-compare__title {
  margin: 0 0 10px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
}

.stage-compare__rec {
  margin: 0 0 8px;
  font-size: $table-caption-font;
  line-height: 1.55;
  color: #e2e8f0;
}

.stage-compare__upgrades {
  margin: 0 0 10px;
  padding-left: 1.2em;
  font-size: $table-caption-font;
  line-height: 1.5;
  color: #a5f3fc;
}

.stage-compare__table-wrap {
  overflow-x: auto;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.2);
}

.stage-compare__table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  font-size: battleUi.$battle-ui-font-base;

  th,
  td {
    padding: 10px 14px;
    text-align: left;
    border-bottom: 1px solid rgba(79, 147, 221, 0.12);
  }

  th {
    font-size: battleUi.$battle-ui-font-emphasis;
    font-weight: 600;
    color: #7dd3fc;
    background: rgba(12, 28, 48, 0.95);
    white-space: nowrap;
  }

  td {
    color: #e2e8f0;
    font-variant-numeric: tabular-nums;

    &:nth-child(n + 2) {
      color: #fde68a;
      font-weight: 600;
    }
  }

  tbody tr:last-child td {
    border-bottom: none;
  }
}

.stage-compare__row--current td {
  background: rgba(56, 189, 248, 0.12);
}

.stage-compare__row--rec td {
  background: rgba(253, 230, 138, 0.1);
}

.stage-compare__tier {
  font-weight: 600;
  color: #7dd3fc;
}

.stage-compare__tag {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 700;
  background: rgba(56, 189, 248, 0.22);
  color: #7dd3fc;

  &--rec {
    background: rgba(56, 189, 248, 0.18);
    color: #7dd3fc;
  }
}

.stage-compare__advice {
  margin: 0 0 10px;
  font-size: $table-caption-font;
  line-height: 1.5;
  color: #94a3b8;
}
</style>