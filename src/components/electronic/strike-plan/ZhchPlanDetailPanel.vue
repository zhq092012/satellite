<template>
  <div class="zhch-plan-detail">
    <!-- 1. 计算结果总览 -->
    <div class="result-header">
      <h2 class="result-title">计算结果</h2>
      <p v-if="plan.intensityLevel" class="intensity-badge">打击烈度：{{ plan.intensityLevel }}</p>
    </div>

    <p class="summary-line">
      共 <span class="num-green">{{ plan.visibleWindowNum }}</span> 个过境窗口，其中
      <span class="num-red">{{ plan.visibleWindowStrikeNum }}</span> 个被打击压制，
      <span class="num-green">{{ plan.feedbackWindowNum }}</span> 个回传窗口。
    </p>

    <!-- 关键指标（带单位） -->
    <div class="kpi-grid">
      <div class="kpi-card kpi-card--cyan">
        <span class="kpi-value">{{ plan.satNum }}<em>颗</em></span>
        <span class="kpi-label">侦察卫星</span>
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
        <span class="kpi-value">{{ plan.feedbackWindowNum }}<em>个</em></span>
        <span class="kpi-label">回传窗口</span>
      </div>
    </div>

    <!-- 2. 方案概要 + 打击前后对比（顶部） -->
    <div class="text-block">
      <div class="block-head">方案概要</div>
      <p class="block-text large" v-html="highlightText(plan.summary)"></p>
    </div>

    <div class="compare-section">
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
          <span v-for="name in plan.stationList" :key="name" class="station-tag">{{ name }}</span>
          <span v-if="!plan.stationList?.length" class="empty-hint">暂无地面站数据</span>
        </div>
      </div>
    </div>

    <!-- 4. 系列链路通断时序（分层甘特式展示） -->
    <SeriesLinkTimeline :plan="plan" />
  </div>
</template>

<script setup lang="ts">
import type { ZhchPlanResp } from '@/api/electronic'
import { highlightResultText } from '@/utils/zhchPlanDisplay'
import SeriesLinkTimeline from './SeriesLinkTimeline.vue'

defineProps<{
  /** 综合打击方案完整数据 */
  plan: ZhchPlanResp
}>()

/**
 * 高亮描述文本中的数字与时间
 * @param text 原始文本
 */
const highlightText = (text?: string | null) => highlightResultText(text)
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
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
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
}

.compare-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.text-block {
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(14, 28, 48, 0.6);

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

  &--before {
    color: #4ade80;
  }

  &--after {
    color: #fbbf24;
  }
}

.strike-analysis-card {
  padding: 16px 18px;
  border-radius: 10px;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: linear-gradient(180deg, rgba(40, 30, 10, 0.5) 0%, rgba(14, 28, 48, 0.8) 100%);

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
