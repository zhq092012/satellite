<template>
  <div class="zhch-plan-detail" :class="{ 'zhch-plan-detail--align': alignBlocks }">
    <!-- 1. 计算结果总览 -->
    <div class="result-header">
      <h2 class="result-title">计算结果</h2>
      <p v-if="plan.intensityLevel" class="intensity-badge">打击烈度：{{ plan.intensityLevel }}</p>
    </div>

    <ZhchPlanSummaryMetricsTable :plan="plan" :vertical="!!alignBlocks" />

    <!-- 打击前 / 打击后指标对比表 -->
    <ZhchPlanMetricsCompareTable :plan="plan" :vertical="!!alignBlocks" />

    <!-- 卫星指标 TOP5 -->
    <div
      v-if="showRecommendSection"
      class="recommend-top-panel"
      :class="{ 'recommend-top-panel--align': alignBlocks }"
    >
      <div class="recommend-section" :class="{ 'recommend-section--align': alignBlocks, 'recommend-section--panel': true }">
        <div v-if="alignBlocks || topCoverageRecommends.length" class="recommend-block">
          <div class="recommend-title">覆盖率降幅 TOP5</div>
          <ul
            v-if="topCoverageRecommends.length"
            class="recommend-list"
            :class="{ 'recommend-list--fixed': alignBlocks }"
          >
            <li v-for="item in topCoverageRecommends" :key="`cov-${item.norad}`" class="recommend-item">
              <span class="recommend-name">{{ item.name }}</span>
              <span class="recommend-meta">
                {{ formatCoverage(item.coverage) }}
                <span class="recommend-arrow">→</span>
                {{ formatCoverage(item.afterCoverage) }}
                <span class="recommend-delta recommend-delta--down">↓{{ formatCoverageDelta(item.reducedCoverage) }}</span>
              </span>
            </li>
          </ul>
          <p v-else-if="alignBlocks" class="recommend-empty">暂无覆盖率降幅数据</p>
        </div>
        <div v-if="alignBlocks || topDelayRecommends.length" class="recommend-block">
          <div class="recommend-title">链路时延增幅 TOP5</div>
          <ul
            v-if="topDelayRecommends.length"
            class="recommend-list"
            :class="{ 'recommend-list--fixed': alignBlocks }"
          >
            <li v-for="item in topDelayRecommends" :key="`delay-${item.norad}`" class="recommend-item">
              <span class="recommend-name">{{ item.name }}</span>
              <span class="recommend-meta">
                {{ formatDelay(item.delay) }}
                <span class="recommend-arrow">→</span>
                {{ formatDelay(item.afterDelay) }}
                <span class="recommend-delta recommend-delta--up">↑{{ formatDelayDelta(item.increasedDelay) }}</span>
              </span>
            </li>
          </ul>
          <p v-else-if="alignBlocks" class="recommend-empty">暂无链路时延增幅数据</p>
        </div>
      </div>
    </div>

    <!-- 5. 系列链路通断时序（仅单方案展示，多方案对比时隐藏） -->
    <SeriesLinkTimeline v-if="showSeriesLinkTimeline" :plan="plan" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  ZhchPlanCoverageRecommend,
  ZhchPlanDelayRecommend,
  ZhchPlanResp,
} from '@/api/electronic'
import SeriesLinkTimeline from './SeriesLinkTimeline.vue'
import ZhchPlanMetricsCompareTable from './ZhchPlanMetricsCompareTable.vue'
import ZhchPlanSummaryMetricsTable from './ZhchPlanSummaryMetricsTable.vue'

const props = defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
  /** 是否展示系列链路通断时序（多方案对比时不展示） */
  showSeriesLinkTimeline?: boolean
  /** 多方案对比时与其它列按块对齐高度 */
  alignBlocks?: boolean
}>()

/** 将平均覆盖率格式化为百分比。 */
const formatCoverage = (coverage: number | null | undefined): string => {
  if (coverage == null || !Number.isFinite(coverage)) return '--'
  return `${Number(coverage.toFixed(2))}%`
}

/** 格式化覆盖率变化量（展示绝对值，方向由样式符号表达）。 */
const formatCoverageDelta = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return `${Math.abs(Number(value.toFixed(2)))}%`
}

/** 格式化链路时延（分钟）。 */
const formatDelay = (minutes: number | null | undefined): string => {
  if (minutes == null || !Number.isFinite(minutes)) return '--'
  return `${Number(minutes.toFixed(2))} 分钟`
}

/** 格式化时延变化量（分钟）。 */
const formatDelayDelta = (minutes: number | null | undefined): string => {
  if (minutes == null || !Number.isFinite(minutes)) return '--'
  return `${Math.abs(Number(minutes.toFixed(2)))} 分钟`
}

const RECOMMEND_TOP_N = 5

/**
 * 取覆盖率推荐前列：优先按 reducedCoverage 降序，不足时保留接口原序。
 * @param list 接口返回的 coverageRecommends
 */
const pickTopCoverageRecommends = (
  list: ZhchPlanCoverageRecommend[] | undefined
): ZhchPlanCoverageRecommend[] => {
  const source = list ?? []
  if (!source.length) return []
  const sorted = [...source].sort((a, b) => (b.reducedCoverage ?? 0) - (a.reducedCoverage ?? 0))
  return sorted.slice(0, RECOMMEND_TOP_N)
}

/**
 * 取链路时延推荐前列：优先按 increasedDelay 降序。
 * @param list 接口返回的 delayRecommends
 */
const pickTopDelayRecommends = (list: ZhchPlanDelayRecommend[] | undefined): ZhchPlanDelayRecommend[] => {
  const source = list ?? []
  if (!source.length) return []
  const sorted = [...source].sort((a, b) => (b.increasedDelay ?? 0) - (a.increasedDelay ?? 0))
  return sorted.slice(0, RECOMMEND_TOP_N)
}

/** 覆盖率降幅 TOP5 */
const topCoverageRecommends = computed(() => pickTopCoverageRecommends(props.plan.coverageRecommends))

/** 链路时延增幅 TOP5 */
const topDelayRecommends = computed(() => pickTopDelayRecommends(props.plan.delayRecommends))

/** 是否展示 TOP5 区域：单方案有数据才展示；多方案对比时固定占位以保持列对齐 */
const showRecommendSection = computed(
  () =>
    !!props.alignBlocks ||
    topCoverageRecommends.value.length > 0 ||
    topDelayRecommends.value.length > 0
)

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

.recommend-section {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 14px 16px;
  padding: 0 16px 14px;

  > .recommend-block:only-child {
    flex: 1 1 100%;
  }

  .recommend-block {
    flex: 1 1 0;
    min-width: 0;
  }

  .recommend-title {
    font-size: 15px;
    font-weight: 800;
    color: #bae6fd;
    margin-bottom: 8px;
  }

  .recommend-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .recommend-item {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 13px;
    line-height: 1.45;
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(8, 15, 26, 0.55);
    border: 1px solid rgba(79, 147, 221, 0.2);
  }

  .recommend-name {
    font-weight: 700;
    color: #e2e8f0;
    flex: 0 1 42%;
    min-width: 0;
    word-break: break-word;
  }

  .recommend-meta {
    color: #94a3b8;
    font-weight: 600;
    flex: 1 1 58%;
    min-width: 0;
    text-align: right;
    white-space: normal;
    word-break: break-word;
  }

  .recommend-arrow {
    margin: 0 4px;
    color: #64748b;
  }

  .recommend-delta {
    margin-left: 8px;
    font-weight: 800;

    &--down {
      color: #f87171;
    }

    &--up {
      color: #fb923c;
    }
  }
}

.recommend-section--align {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 14px 16px;
  margin-top: 0;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(14, 28, 48, 0.6);

  .recommend-block {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .recommend-list--fixed {
    flex: 1;
    min-height: calc(5 * 36px + 4 * 6px);
  }

  .recommend-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 8px 10px;
  }

  .recommend-name {
    flex: none;
    width: 100%;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: normal;
  }

  .recommend-meta {
    width: 100%;
    flex: none;
    text-align: left;
    white-space: normal;
    word-break: keep-all;
    line-height: 1.45;
    font-size: 12px;
  }

  .recommend-delta {
    display: block;
    margin-left: 0;
    margin-top: 2px;
  }

  .recommend-empty {
    flex: 1;
    min-height: calc(5 * 36px + 4 * 6px);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
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

.recommend-top-panel {
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(14, 28, 48, 0.6);

  &--align {
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .recommend-section--panel {
    padding: 0;
  }

  .recommend-section--panel.recommend-section--align {
    flex: 1;
    min-height: 0;
    margin-top: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
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
