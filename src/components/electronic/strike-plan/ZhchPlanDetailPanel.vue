<template>
  <div class="zhch-plan-detail" :class="{ 'zhch-plan-detail--align': alignBlocks }">
    <!-- 1. 计算结果总览 -->
    <div class="result-header">
      <h2 class="result-title">计算结果</h2>
      <p v-if="plan.intensityLevel" class="intensity-badge">打击烈度：{{ plan.intensityLevel }}</p>
    </div>

    <ZhchPlanCapabilityCompareTable :plan="plan" kind="recon" :vertical="!!alignBlocks" />
    <ZhchPlanCapabilityCompareTable :plan="plan" kind="comm" :vertical="!!alignBlocks" />

    <ZhchPlanSummaryMetricsTable :plan="plan" :vertical="!!alignBlocks" />

    <!-- 打击前 / 打击后指标对比表 -->
    <ZhchPlanMetricsCompareTable :plan="plan" :vertical="!!alignBlocks" />

    <!-- 系列链路通断时序（仅单方案展示，多方案对比时隐藏） -->
    <SeriesLinkTimeline v-if="showSeriesLinkTimeline" :plan="plan" />
  </div>
</template>

<script setup lang="ts">
import type { ZhchPlanResp } from '@/api/electronic'
import SeriesLinkTimeline from './SeriesLinkTimeline.vue'
import ZhchPlanMetricsCompareTable from './ZhchPlanMetricsCompareTable.vue'
import ZhchPlanSummaryMetricsTable from './ZhchPlanSummaryMetricsTable.vue'
import ZhchPlanCapabilityCompareTable from './ZhchPlanCapabilityCompareTable.vue'

defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
  /** 是否展示系列链路通断时序（多方案对比时不展示） */
  showSeriesLinkTimeline?: boolean
  /** 多方案对比时与其它列按块对齐高度 */
  alignBlocks?: boolean
}>()
</script>

<style lang="scss" scoped>
.zhch-plan-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;

  &--align {
    display: grid;
    grid-template-rows: subgrid;
    grid-row: span 5;
    min-height: 0;
    // 与外层 plan-columns--compare 的 --plan-compare-row-gap 保持一致；
    // subgrid 会用自身 gap 覆盖父级 row-gap，写成 0 会导致块与块贴死。
    gap: var(--plan-compare-row-gap, 10px);

    .result-header {
      height: 100%;
      box-sizing: border-box;
    }
  }
}

.result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.result-title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: #40f2ff;
  text-shadow: 0 0 12px rgba(64, 242, 255, 0.5);
}

.intensity-badge {
  margin: 0;
  padding: 4px 14px;
  font-size: 16px;
  font-weight: 700;
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.5);
  border-radius: 20px;
  background: rgba(251, 191, 36, 0.1);
}

.summary-line {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.8;
  color: #e2e8f0;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;

  &--compact {
    gap: 6px;

    .kpi-card {
      padding: 10px 4px;

      .kpi-value {
        font-size: 16px;

        em {
          font-size: 11px;
        }
      }

      .kpi-label {
        margin-top: 4px;
        font-size: 11px;
      }
    }
  }
}

.kpi-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14px 8px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.3);
  background: rgba(8, 15, 26, 0.7);

  .kpi-value {
    font-size: 28px;
    font-weight: 900;
    line-height: 1.1;

    em {
      font-style: normal;
      font-size: 16px;
      font-weight: 700;
      margin-left: 2px;
      opacity: 0.85;
    }
  }

  .kpi-label {
    margin-top: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #94a3b8;
  }

  &--cyan .kpi-value {
    color: #38bdf8;
    text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
  }

  &--yellow .kpi-value {
    color: #fbbf24;
    text-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
  }

  &--green .kpi-value {
    color: #4ade80;
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
  }

  &--red .kpi-value {
    color: #f87171;
    text-shadow: 0 0 10px rgba(248, 113, 113, 0.5);
  }

  &--orange .kpi-value {
    color: #fb923c;
    text-shadow: 0 0 10px rgba(251, 146, 60, 0.5);
  }
}

.summary-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(14, 28, 48, 0.6);
  overflow: hidden;

  &--align {
    display: contents;
    border: none;
    background: none;
  }

  .text-block--summary {
    border: none;
    border-radius: 0;
    background: transparent;
  }
}

.compare-section {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &--align {
    display: contents;
  }
}

.text-block {
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(14, 28, 48, 0.6);

  .zhch-plan-detail--align & {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 0;
    gap: 10px;
  }

  .zhch-plan-detail--align &.text-block--summary {
    .block-text.large {
      flex: 1;
      min-height: 7.6em;
    }
  }

  .block-head {
    font-size: 17px;
    font-weight: 800;
    color: #7dd3fc;
    margin-bottom: 10px;
    padding: 6px 10px;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.08);

    &--before {
      color: #86efac;
      background: rgba(34, 197, 94, 0.1);
    }

    &--after {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.1);
    }
  }

  .block-text {
    margin: 0;
    font-size: 16px;
    line-height: 1.9;
    color: #e2e8f0;

    &.large {
      font-size: 17px;
      text-align: left;
    }

    :deep(.hl-num) {
      color: #4ade80;
      font-weight: 800;
      font-size: 1.1em;
    }

    :deep(.hl-time) {
      color: #fbbf24;
      font-weight: 800;
    }
  }
}

.feedback-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  font-size: 16px;

  .row-label {
    flex-shrink: 0;
    color: #94a3b8;
    font-weight: 600;
  }
}

.feedback-time {
  font-size: 17px;
  font-weight: 800;
  word-break: break-all;

  &--coverage,
  &--before {
    color: #4ade80;
  }

  &--after {
    color: #fbbf24;
  }

  &--delay {
    color: #f87171;
    text-shadow: 0 0 8px rgba(248, 113, 113, 0.4);
  }
}

.num-green {
  color: #4ade80;
  font-weight: 800;
}

.num-red {
  color: #f87171;
  font-weight: 800;
}

.num-orange {
  color: #fbbf24;
  font-weight: 800;
}
</style>
