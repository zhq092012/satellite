<template>
  <div class="zhch-plan-detail" :class="{ 'zhch-plan-detail--align': alignBlocks }">
    <!-- 1. 计算结果总览 -->
    <div class="result-header">
      <h2 class="result-title">计算结果</h2>
      <p v-if="plan.intensityLevel" class="intensity-badge">打击烈度：{{ plan.intensityLevel }}</p>
    </div>

    <p class="summary-line">
      共 <span class="num-green">{{ plan.visibleWindowNum }}</span> 个过境窗口，其中
      <span class="num-red">{{ plan.visibleWindowStrikeNum }}</span> 个被打击压制；
      打击前覆盖率 <span class="num-green">{{ formatCoverage(plan.beforeAvgCoverage) }}</span>，
      打击后覆盖率 <span class="num-orange">{{ formatCoverage(plan.afterAvgCoverage) }}</span>。
    </p>

    <!-- 关键指标（带单位）；三方案并排时缩小数字避免挤叠 -->
    <div class="kpi-grid" :class="{ 'kpi-grid--compact': compactKpi }">
      <div class="kpi-card kpi-card--cyan">
        <span class="kpi-value">{{ plan.satNum }}<em>颗</em></span>
        <span class="kpi-label">卫星数量</span>
      </div>
      <div class="kpi-card kpi-card--yellow">
        <span class="kpi-value">{{ plan.stationNum }}<em>座</em></span>
        <span class="kpi-label">地面站</span>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-value">{{ plan.visibleWindowNum }}<em>个</em></span>
        <span class="kpi-label">过境窗口</span>
      </div>
      <div class="kpi-card kpi-card--red">
        <span class="kpi-value">{{ plan.visibleWindowStrikeNum }}<em>个</em></span>
        <span class="kpi-label">压制窗口</span>
      </div>
      <div class="kpi-card kpi-card--green">
        <span class="kpi-value">{{ formatCoverage(plan.beforeAvgCoverage) }}</span>
        <span class="kpi-label">打击前覆盖率</span>
      </div>
      <div class="kpi-card kpi-card--orange">
        <span class="kpi-value">{{ formatCoverage(plan.afterAvgCoverage) }}</span>
        <span class="kpi-label">打击后覆盖率</span>
      </div>
    </div>

    <!-- 2. 方案概要 + 打击前后对比（顶部） -->
    <div class="text-block">
      <div class="block-head">方案概要</div>
      <p class="block-text large" v-html="highlightText(plan.summary)"></p>

      <div v-if="topCoverageRecommends.length || topDelayRecommends.length" class="recommend-section">
        <div v-if="topCoverageRecommends.length" class="recommend-block">
          <div class="recommend-title">覆盖率降幅 TOP5</div>
          <ul class="recommend-list">
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
        </div>
        <div v-if="topDelayRecommends.length" class="recommend-block">
          <div class="recommend-title">链路时延增幅 TOP5</div>
          <ul class="recommend-list">
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
        </div>
      </div>
    </div>

    <div class="compare-section" :class="{ 'compare-section--align': alignBlocks }">
      <div class="text-block">
        <div class="block-head block-head--before">① 打击前计算结果</div>
        <p class="block-text large" v-html="highlightText(plan.beforeResult)"></p>
        <div class="feedback-row">
          <span class="row-label">最早回传时间：</span>
          <span class="feedback-time feedback-time--before">{{ plan.beforeFirstFeedbackTime || '--' }}</span>
        </div>
      </div>

      <div class="text-block">
        <div class="block-head block-head--after">② 打击后计算结果</div>
        <p class="block-text large" v-html="highlightText(plan.afterResult)"></p>
        <div class="feedback-row">
          <span class="row-label">最早回传时间：</span>
          <span class="feedback-time feedback-time--after">{{ plan.afterFirstFeedbackTime || '--' }}</span>
        </div>
        <div class="feedback-row">
          <span class="row-label">干扰造成延迟：</span>
          <span class="feedback-time feedback-time--delay">{{ interferenceDelay }}</span>
        </div>
        <div class="feedback-row">
          <span class="row-label">覆盖率减少：</span>
          <span class="feedback-time feedback-time--coverage">{{ coverageReduction }}</span>
        </div>
      </div>
    </div>

    <!-- 3. 可用地面站（底部） -->
    <div class="strike-analysis-card">
      <div class="card-title">
        地面站打击分析（共 <span class="num-orange">{{ plan.stationNum }}</span> 座）
      </div>
      <div class="station-row">
        <span class="row-label">可用地面站：</span>
        <div class="station-tags">
          <span v-for="name in stationNames" :key="name" class="station-tag">{{ name }}</span>
          <span v-if="!stationNames.length" class="empty-hint">暂无地面站数据</span>
        </div>
      </div>
    </div>

    <!-- 4. 系列链路通断时序（仅单方案展示，多方案对比时隐藏） -->
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
import { highlightResultText, formatInterferenceDelay } from '@/utils/zhchPlanDisplay'
import SeriesLinkTimeline from './SeriesLinkTimeline.vue'

const props = defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
  /** 是否展示系列链路通断时序（多方案对比时不展示） */
  showSeriesLinkTimeline?: boolean
  /** 三方案并排时缩小 KPI 数字字号，单方案保持原尺寸 */
  compactKpi?: boolean
  /** 多方案对比时与其它列按块对齐高度 */
  alignBlocks?: boolean
}>()

/**
 * 高亮描述文本中的数字与时间
 * @param text 原始文本
 */
const highlightText = (text?: string | null) => highlightResultText(text)

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

/** 方案概要下展示的覆盖率 TOP5 */
const topCoverageRecommends = computed(() => pickTopCoverageRecommends(props.plan.coverageRecommends))

/** 方案概要下展示的链路时延 TOP5 */
const topDelayRecommends = computed(() => pickTopDelayRecommends(props.plan.delayRecommends))

/** 将 stationList 统一为名称数组（兼容字符串与数组两种返回）。 */
const stationNames = computed((): string[] => {
  const raw = props.plan.stationList
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,，、;；\s]+/).map((s) => s.trim()).filter(Boolean)
  }
  return []
})

/** 打击干扰造成的延迟时长（格式：xx时xx分xx秒） */
const interferenceDelay = computed(() =>
  formatInterferenceDelay(props.plan.beforeFirstFeedbackTime, props.plan.afterFirstFeedbackTime)
)

/** 覆盖率变化：打击后平均覆盖率减去打击前平均覆盖率 */
const coverageReduction = computed(() => {
  const before = props.plan.beforeAvgCoverage
  const after = props.plan.afterAvgCoverage
  if (!Number.isFinite(before) || !Number.isFinite(after)) return '--'
  return `${(after - before).toFixed(2)}%`
})
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
    grid-row: span 7;
    min-height: 0;
    // 与外层 plan-columns--compare 的 --plan-compare-row-gap 保持一致；
    // subgrid 会用自身 gap 覆盖父级 row-gap，写成 0 会导致块与块贴死。
    gap: var(--plan-compare-row-gap, 10px);

    .result-header,
    .summary-line,
    .kpi-grid {
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

  .recommend-section {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 14px 16px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px dashed rgba(79, 147, 221, 0.35);

    > .recommend-block:only-child {
      flex: 1 1 100%;
    }
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

.strike-analysis-card {
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: linear-gradient(180deg, rgba(40, 30, 10, 0.5) 0%, rgba(14, 28, 48, 0.8) 100%);

  .zhch-plan-detail--align & {
    height: 100%;
    box-sizing: border-box;
    gap: 10px;
  }

  .card-title {
    font-size: 18px;
    font-weight: 800;
    color: #fbbf24;
    margin-bottom: 12px;
  }
}

.station-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 16px;

  .row-label {
    flex-shrink: 0;
    color: #94a3b8;
    font-weight: 600;
  }
}

.station-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.station-tag {
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 600;
  color: #7dd3fc;
  border: 1px solid rgba(0, 225, 255, 0.4);
  border-radius: 16px;
  background: rgba(0, 225, 255, 0.08);
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

.empty-hint {
  font-size: 15px;
  color: #64748b;
}
</style>
