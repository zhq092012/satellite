<template>
  <div class="zhch-plan-detail" :class="{ 'zhch-plan-detail--align': alignBlocks }">
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
    // 天基侦察、通信保障、方案概要、打击前后指标对比，共 4 行
    grid-row: span 4;
    min-height: 0;
    // 与外层 plan-columns--compare 的 --plan-compare-row-gap 保持一致；
    // subgrid 会用自身 gap 覆盖父级 row-gap，写成 0 会导致块与块贴死。
    gap: var(--plan-compare-row-gap, 10px);
  }
}

.summary-line {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  line-height: 1.8;
  color: var(--text-color-soft);
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
        font-size: var(--font-size-lg);

        em {
          font-size: var(--font-size-xs);
        }
      }

      .kpi-label {
        margin-top: 4px;
        font-size: var(--font-size-xs);
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
  border: 1px solid var(--swatch-rgba-79-147-221-0_3);
  background: var(--swatch-rgba-8-15-26-0_7);

  .kpi-value {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-heavy);
    line-height: 1.1;

    em {
      font-style: normal;
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      margin-left: 2px;
      opacity: 0.85;
    }
  }

  .kpi-label {
    margin-top: 6px;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-color-muted);
  }

  &--cyan .kpi-value {
    color: var(--color-info);
    text-shadow: 0 0 10px var(--swatch-rgba-56-189-248-0_5);
  }

  &--yellow .kpi-value {
    color: var(--color-warning);
    text-shadow: 0 0 10px var(--swatch-rgba-251-191-36-0_5);
  }

  &--green .kpi-value {
    color: var(--color-success-soft);
    text-shadow: 0 0 10px var(--swatch-rgba-74-222-128-0_5);
  }

  &--red .kpi-value {
    color: var(--color-danger-soft);
    text-shadow: 0 0 10px var(--swatch-rgba-248-113-113-0_5);
  }

  &--orange .kpi-value {
    color: var(--color-orange);
    text-shadow: 0 0 10px var(--swatch-rgba-251-146-60-0_5);
  }
}

.summary-group {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: 8px;
  border: 1px solid var(--accent-border-strong);
  background: var(--swatch-rgba-14-28-48-0_6);
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
  border: 1px solid var(--accent-border-strong);
  background: var(--swatch-rgba-14-28-48-0_6);

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
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-heavy);
    color: var(--color-info-soft);
    margin-bottom: 10px;
    padding: 6px 10px;
    border-radius: 4px;
    background: rgba(var(--accent-cyan-rgb), 0.08);

    &--before {
      color: var(--color-success-soft);
      background: var(--swatch-rgba-34-197-94-0_1);
    }

    &--after {
      color: var(--color-warning);
      background: var(--swatch-rgba-251-191-36-0_1);
    }
  }

  .block-text {
    margin: 0;
    font-size: var(--font-size-lg);
    line-height: 1.9;
    color: var(--text-color-soft);

    &.large {
      font-size: var(--font-size-lg);
      text-align: left;
    }

    :deep(.hl-num) {
      color: var(--color-success-soft);
      font-weight: var(--font-weight-heavy);
      font-size: 1.1em;
    }

    :deep(.hl-time) {
      color: var(--color-warning);
      font-weight: var(--font-weight-heavy);
    }
  }
}

.feedback-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 12px;
  font-size: var(--font-size-lg);

  .row-label {
    flex-shrink: 0;
    color: var(--text-color-muted);
    font-weight: var(--font-weight-semibold);
  }
}

.feedback-time {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-heavy);
  word-break: break-all;

  &--coverage,
  &--before {
    color: var(--color-success-soft);
  }

  &--after {
    color: var(--color-warning);
  }

  &--delay {
    color: var(--color-danger-soft);
    text-shadow: 0 0 8px var(--swatch-rgba-248-113-113-0_4);
  }
}

.num-green {
  color: var(--color-success-soft);
  font-weight: var(--font-weight-heavy);
}

.num-red {
  color: var(--color-danger-soft);
  font-weight: var(--font-weight-heavy);
}

.num-orange {
  color: var(--color-warning);
  font-weight: var(--font-weight-heavy);
}
</style>
