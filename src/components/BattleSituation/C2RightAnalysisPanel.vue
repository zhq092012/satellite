<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">分析结果</span>
      </div>
    </div>

    <div v-if="analysisLoading" class="empty-sat-box">
      <span class="task-loading-spinner" aria-hidden="true" />
      <p class="empty-text">正在加载分析结果...</p>
    </div>

    <div v-else-if="!algorithmComplete || !analysisData" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无分析结果</p>
      <p class="empty-sub">请等待当前任务算法计算完成</p>
    </div>

    <div v-else class="analysis-scroll">
      <!-- 1. 首次回传时间与延迟 -->
      <section class="analysis-section">
        <div class="section-head">
          <span class="section-title">首次回传时间</span>
        </div>

        <div class="feedback-kpi-grid">
          <div class="feedback-cell">
            <span class="analysis-kpi-label">打击前</span>
          </div>
          <div class="feedback-cell">
            <span class="analysis-kpi-label">打击后</span>
          </div>
          <div class="feedback-cell">
            <span class="analysis-kpi-label">造成延迟</span>
          </div>

          <div class="feedback-cell">
            <span class="feedback-link">{{ beforeFeedback.link }}</span>
          </div>
          <div class="feedback-cell">
            <span class="feedback-link">{{ afterFeedback.link }}</span>
          </div>
          <div class="feedback-cell feedback-cell--empty" />

          <div class="feedback-cell">
            <span class="feedback-time">{{ beforeFeedback.time }}</span>
          </div>
          <div class="feedback-cell">
            <span class="feedback-time">{{ afterFeedback.time }}</span>
          </div>
          <div class="feedback-cell">
            <span class="analysis-kpi-value analysis-kpi-value--delay">{{ strikeDelayText }}</span>
          </div>
        </div>
      </section>

      <!-- 2. 平均覆盖率对比 -->
      <section class="analysis-section">
        <div class="section-head">
          <span class="section-title">平均覆盖率</span>
        </div>

        <div class="analysis-kpi-row">
          <div class="analysis-kpi-item">
            <span class="analysis-kpi-label">打击前</span>
            <span class="analysis-kpi-value analysis-kpi-value--before">{{ beforeCoverageText }}</span>
          </div>

          <div class="analysis-kpi-item">
            <span class="analysis-kpi-label">打击后</span>
            <span class="analysis-kpi-value analysis-kpi-value--after">{{ afterCoverageText }}</span>
          </div>

          <div class="analysis-kpi-item">
            <span class="analysis-kpi-label">覆盖率减少</span>
            <span class="analysis-kpi-value analysis-kpi-value--reduce">{{ coverageReductionText }}</span>
          </div>
        </div>
      </section>

      <!-- 3. 卫星指标表格 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">卫星指标</span>
          <span class="section-count">
            展示 {{ displayedSatelliteTableRows.length }} / 共 {{ rankedSatelliteTableRows.length }} 颗
          </span>
        </div>

        <el-table :data="displayedSatelliteTableRows" size="small" row-key="norad" class="sat-metric-table"
          empty-text="暂无卫星数据">
          <el-table-column label="卫星" width="98" class-name="sat-name-column">
            <template #default="{ row }">
              <el-tooltip :content="row.name" placement="left" :show-after="200">
                <span class="sat-name-wrap">{{ row.name }}</span>
              </el-tooltip>
            </template>
          </el-table-column>

          <el-table-column label="覆盖率" width="96" sortable :sort-method="sortByCoverageBefore">
            <template #default="{ row }">
              <div class="metric-cell">
                <div class="metric-line">
                  <span class="metric-line-label">打击前</span>
                  <span class="metric-line-value">{{ row.coverageBeforeText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">打击后</span>
                  <span class="metric-line-value">{{ row.coverageAfterText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">覆盖率减少</span>
                  <span class="metric-line-delta metric-line-delta--green">{{ row.coverageReduceText }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="链路时延" width="96" sortable :sort-method="sortByDelayBefore">
            <template #default="{ row }">
              <div class="metric-cell">
                <div class="metric-line">
                  <span class="metric-line-label">打击前</span>
                  <span class="metric-line-value">{{ row.delayBeforeText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">打击后</span>
                  <span class="metric-line-value">{{ row.delayAfterText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">增加时延</span>
                  <span class="metric-line-delta metric-line-delta--yellow">{{ row.delayIncreaseText }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="威胁度" width="96" sortable :sort-method="sortByThreatBefore">
            <template #default="{ row }">
              <div class="metric-cell">
                <div class="metric-line">
                  <span class="metric-line-label">打击前</span>
                  <span class="metric-line-value">{{ row.threatBeforeText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">打击后</span>
                  <span class="metric-line-value">{{ row.threatAfterText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">威胁度降低</span>
                  <span class="metric-line-delta metric-line-delta--green">{{ row.threatReduceText }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="rankedSatelliteTableRows.length > SATELLITE_TABLE_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllSatellites" type="button" class="table-more-btn" @click="showAllSatellites = true">
            查看更多（{{ rankedSatelliteTableRows.length - SATELLITE_TABLE_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllSatellites = false">
            收起
          </button>
        </div>
      </section>

      <!-- 4. 打击计划 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">打击计划</span>
          <span class="section-count">
            展示 {{ displayedAttackPlanTableRows.length }} / 共 {{ attackPlanTableRows.length }} 条
          </span>
        </div>

        <div class="attack-plan-table-wrap">
          <el-table :data="displayedAttackPlanTableRows" size="small" row-key="id"
            class="sat-metric-table attack-plan-table" empty-text="暂无打击计划">
            <el-table-column label="卫星/站" min-width="0" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tooltip :content="row.targetType ? `${row.target}（${row.targetType}）` : row.target" placement="left"
                  :show-after="200">
                  <span class="plan-target-text">{{ row.target }}</span>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="武器" min-width="0" show-overflow-tooltip>
              <template #default="{ row }">
                <span class="plan-weapon-text">{{ row.weaponName }}</span>
              </template>
            </el-table-column>

            <el-table-column label="开始时间" min-width="0" sortable :sort-method="sortAttackPlanByBeginTime">
              <template #default="{ row }">
                <el-tooltip :content="row.beginTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.beginTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.beginTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.beginTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="结束时间" min-width="0" sortable :sort-method="sortAttackPlanByEndTime">
              <template #default="{ row }">
                <el-tooltip :content="row.endTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.endTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.endTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.endTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="attackPlanTableRows.length > ATTACK_PLAN_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllAttackPlans" type="button" class="table-more-btn" @click="showAllAttackPlans = true">
            查看更多（{{ attackPlanTableRows.length - ATTACK_PLAN_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllAttackPlans = false">
            收起
          </button>
        </div>
      </section>

      <!-- 5. 通信链路 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">通信链路</span>
          <span class="section-count">
            展示 {{ displayedLinkChainTableRows.length }} / 共 {{ linkChainTableRows.length }} 条
          </span>
        </div>

        <div class="link-chain-table-wrap">
          <el-table :data="displayedLinkChainTableRows" size="small" row-key="id"
            class="sat-metric-table link-chain-table" empty-text="暂无通信链路">
            <el-table-column label="链路" min-width="0">
              <template #default="{ row }">
                <el-tooltip :content="row.chainText" placement="left" :show-after="200">
                  <span class="link-chain-text" :class="{ 'link-chain-text--relay': row.hasRelay }">
                    {{ row.chainText }}
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="开始时间" min-width="0" sortable :sort-method="sortLinkChainByBeginTime">
              <template #default="{ row }">
                <el-tooltip :content="row.beginTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.beginTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.beginTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.beginTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="结束时间" min-width="0" sortable :sort-method="sortLinkChainByEndTime">
              <template #default="{ row }">
                <el-tooltip :content="row.endTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.endTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.endTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.endTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="linkChainTableRows.length > LINK_CHAIN_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllLinkChains" type="button" class="table-more-btn" @click="showAllLinkChains = true">
            查看更多（{{ linkChainTableRows.length - LINK_CHAIN_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllLinkChains = false">
            收起
          </button>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧面板。
 * 根据任务算法进度展示 getTaskMatrix 返回的分析摘要。
 */
import { computed, ref, watch } from 'vue'
import type { SatelliteAnalysisData } from '@/api/task/task'
import {
  ATTACK_PLAN_TOP_COUNT,
  buildAttackPlanTableRows,
  type AttackPlanTableRow,
} from '@/utils/buildAttackPlanTable'
import {
  buildLinkChainTableRows,
  LINK_CHAIN_TOP_COUNT,
  type LinkChainTableRow,
} from '@/utils/buildLinkChainTable'
import {
  buildSatelliteAnalysisTableRows,
  compareNullableMetric,
  rankSatellitesByCompositeBeforeMetrics,
  SATELLITE_TABLE_TOP_COUNT,
  type SatelliteMetricTableRow,
} from '@/utils/buildSatelliteAnalysisTable'
import {
  formatCoveragePercent,
  formatCoverageReduction,
  formatStrikeDelayDuration,
  parseFeedbackTimeAndLink,
  splitDateTimeDisplay,
} from '@/utils/zhchPlanDisplay'

/** 打击计划时间拆分为日期/时分秒两行展示 */
const getPlanTimeParts = splitDateTimeDisplay

const props = defineProps<{
  /** 任务算法分析结果 */
  analysisData: SatelliteAnalysisData | null
  /** 当前任务算法是否已完成 */
  algorithmComplete: boolean
  /** 分析结果是否正在加载 */
  analysisLoading?: boolean
}>()

/**
 * 从系列矩阵中推算打击前平均覆盖率（接口未返回时兜底）。
 *
 * @param data 任务分析数据
 * @returns 打击前平均覆盖率；无法计算时返回 null
 */
const resolveBeforeAvgCoverage = (data: SatelliteAnalysisData | null): number | null => {
  if (!data) return null
  if (Number.isFinite(data.beforeAvgCoverage)) {
    return Number(data.beforeAvgCoverage)
  }

  const coverages: number[] = []
    ; (data.levelSeriesEntities || []).forEach((entity) => {
      ; (entity.initMatrixList || []).forEach((sat) => {
        if (Number.isFinite(sat.coverage)) {
          coverages.push(sat.coverage)
        }
      })
    })

  if (!coverages.length) return null
  return coverages.reduce((sum, value) => sum + value, 0) / coverages.length
}

/** 打击前首次回传时间与链路 */
const beforeFeedback = computed(() =>
  parseFeedbackTimeAndLink(props.analysisData?.beforeFirstFeedbackTime)
)

/** 打击后首次回传时间与链路 */
const afterFeedback = computed(() =>
  parseFeedbackTimeAndLink(props.analysisData?.afterFirstFeedbackTime)
)

/** 打击造成的回传延迟 */
const strikeDelayText = computed(() =>
  formatStrikeDelayDuration(
    props.analysisData?.beforeFirstFeedbackTime,
    props.analysisData?.afterFirstFeedbackTime
  )
)

/** 打击前平均覆盖率展示 */
const beforeCoverageText = computed(() =>
  formatCoveragePercent(resolveBeforeAvgCoverage(props.analysisData))
)

/** 打击后平均覆盖率展示 */
const afterCoverageText = computed(() =>
  formatCoveragePercent(props.analysisData?.afterAvgCoverage)
)

/** 覆盖率减少量展示 */
const coverageReductionText = computed(() =>
  formatCoverageReduction(
    resolveBeforeAvgCoverage(props.analysisData),
    props.analysisData?.afterAvgCoverage
  )
)

/** 是否展示全部卫星（默认仅展示综合排序前 10 条） */
const showAllSatellites = ref(false)

/** 卫星指标表格全量行 */
const satelliteTableRows = computed(() => buildSatelliteAnalysisTableRows(props.analysisData))

/** 按打击前覆盖率、链路时延、威胁度综合排序后的卫星列表 */
const rankedSatelliteTableRows = computed(() =>
  rankSatellitesByCompositeBeforeMetrics(satelliteTableRows.value)
)

/** 当前表格展示的卫星行 */
const displayedSatelliteTableRows = computed(() => {
  if (showAllSatellites.value) return rankedSatelliteTableRows.value
  return rankedSatelliteTableRows.value.slice(0, SATELLITE_TABLE_TOP_COUNT)
})

/** 任务分析数据变化时重置「查看更多」状态 */
watch(
  () => props.analysisData,
  () => {
    showAllSatellites.value = false
    showAllAttackPlans.value = false
    showAllLinkChains.value = false
  }
)

/** 按打击前覆盖率排序 */
const sortByCoverageBefore = (a: SatelliteMetricTableRow, b: SatelliteMetricTableRow) =>
  compareNullableMetric(a.coverageBefore, b.coverageBefore)

/** 按打击前链路时延排序 */
const sortByDelayBefore = (a: SatelliteMetricTableRow, b: SatelliteMetricTableRow) =>
  compareNullableMetric(a.delayBefore, b.delayBefore)

/** 按打击前威胁度排序 */
const sortByThreatBefore = (a: SatelliteMetricTableRow, b: SatelliteMetricTableRow) =>
  compareNullableMetric(a.threatBefore, b.threatBefore)

/** 打击计划按开始时间排序 */
const sortAttackPlanByBeginTime = (a: AttackPlanTableRow, b: AttackPlanTableRow) =>
  compareNullableMetric(a.beginTimeMs, b.beginTimeMs)

/** 打击计划按结束时间排序 */
const sortAttackPlanByEndTime = (a: AttackPlanTableRow, b: AttackPlanTableRow) =>
  compareNullableMetric(a.endTimeMs, b.endTimeMs)

/** 通信链路按开始时间排序 */
const sortLinkChainByBeginTime = (a: LinkChainTableRow, b: LinkChainTableRow) =>
  compareNullableMetric(a.beginTimeMs, b.beginTimeMs)

/** 通信链路按结束时间排序 */
const sortLinkChainByEndTime = (a: LinkChainTableRow, b: LinkChainTableRow) =>
  compareNullableMetric(a.endTimeMs, b.endTimeMs)

/** 是否展示全部打击计划（默认仅展示前 10 条） */
const showAllAttackPlans = ref(false)

/** 打击计划表格全量行（按开始时间升序） */
const attackPlanTableRows = computed(() => buildAttackPlanTableRows(props.analysisData))

/** 当前表格展示的打击计划行 */
const displayedAttackPlanTableRows = computed(() => {
  if (showAllAttackPlans.value) return attackPlanTableRows.value
  return attackPlanTableRows.value.slice(0, ATTACK_PLAN_TOP_COUNT)
})

/** 是否展示全部通信链路（默认仅展示前 10 条） */
const showAllLinkChains = ref(false)

/** 通信链路表格全量行（按开始时间升序） */
const linkChainTableRows = computed(() => buildLinkChainTableRows(props.analysisData))

/** 当前表格展示的通信链路行 */
const displayedLinkChainTableRows = computed(() => {
  if (showAllLinkChains.value) return linkChainTableRows.value
  return linkChainTableRows.value.slice(0, LINK_CHAIN_TOP_COUNT)
})
</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 0;
  backdrop-filter: blur(8px);
  color: #e2efff;
  overflow: hidden;

  &--right {
    border-right: none;
    border-top: none;
    border-bottom: none;
  }
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }
}

.analysis-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 2px;
  }
}

.analysis-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(12, 22, 38, 0.55);
  border: 1px solid rgba(0, 225, 255, 0.12);
  min-width: 0;
  overflow: hidden;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #7dd3fc;
}

.section-count {
  font-size: 11px;
  color: #94a3b8;
}

.analysis-section--table {
  padding-bottom: 8px;
  overflow: hidden;
}

.sat-metric-table {
  width: 100%;
  table-layout: fixed;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.08);
  --atlas-app-text-color-regular: #cbd5e1;
  --atlas-app-text-color-primary: #e2efff;
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    table-layout: fixed;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  :deep(td.atlas-app-table__cell) {
    font-size: 12px;
    color: #cbd5e1;
    background: transparent !important;
    border-bottom: 1px solid rgba(0, 225, 255, 0.08);
    padding-top: 10px;
    padding-bottom: 10px;
    padding-left: 4px;
    padding-right: 4px;
    vertical-align: top;
    overflow: hidden;
  }

  :deep(th.atlas-app-table__cell .cell),
  :deep(td.atlas-app-table__cell .cell) {
    padding-left: 0;
    padding-right: 0;
    overflow: hidden;
  }

  :deep(.atlas-app-table__empty-block) {
    background: transparent;
    color: #64748b;
  }

  :deep(.caret-wrapper) {
    width: 14px;
  }

  :deep(td.sat-name-column) {
    padding-left: 4px;
    padding-right: 4px;
    vertical-align: middle;
  }
}

.sat-name-wrap {
  display: block;
  font-size: 11px;
  line-height: 1.4;
  color: #e2efff;
  word-break: break-all;
  white-space: normal;
  text-align: left;
  cursor: default;
}

.table-more-actions {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.table-more-btn {
  height: 28px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid rgba(64, 242, 255, 0.35);
  background: rgba(0, 225, 255, 0.08);
  color: #7dd3fc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: #40f2ff;
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.16);
  }
}

.metric-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.metric-line {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  line-height: 1.35;
}

.metric-line-label {
  font-size: 10px;
  color: #64748b;
}

.metric-line-value {
  font-size: 12px;
  color: #e2efff;
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-word;
}

.metric-line-delta {
  font-size: 12px;
  font-weight: 700;
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-word;

  &--green {
    color: #4ade80;
  }

  &--yellow {
    color: #fbbf24;
  }
}

.attack-plan-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.attack-plan-table {
  width: 100%;
  max-width: 100%;

  :deep(.atlas-app-table__inner-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__wrap) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__bar.is-horizontal) {
    display: none !important;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(1)),
  :deep(.atlas-app-table__body colgroup col:nth-child(1)) {
    width: 35% !important;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(2)),
  :deep(.atlas-app-table__body colgroup col:nth-child(2)) {
    width: 15% !important;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(3)),
  :deep(.atlas-app-table__body colgroup col:nth-child(3)),
  :deep(.atlas-app-table__header colgroup col:nth-child(4)),
  :deep(.atlas-app-table__body colgroup col:nth-child(4)) {
    width: 25% !important;
  }

  :deep(col[name='gutter']) {
    width: 0 !important;
  }

  :deep(td.atlas-app-table__cell) {
    padding-top: 6px;
    padding-bottom: 6px;
    vertical-align: middle;
  }

  :deep(td.atlas-app-table__cell .cell) {
    display: flex;
    align-items: center;
    min-height: 100%;
  }
}

.plan-target-text {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #4ade80;
  word-break: break-all;
  white-space: normal;
  line-height: 1.35;
  overflow: hidden;
}

.plan-weapon-text {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #fbbf24;
  word-break: break-all;
  white-space: normal;
  line-height: 1.35;
  overflow: hidden;
}

.plan-time-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  font-size: 10px;
  color: #7dd3fc;
  font-family: Consolas, 'Courier New', monospace;
  line-height: 1.35;
  overflow: hidden;
  white-space: normal;
}

.plan-time-date,
.plan-time-clock {
  display: block;
}

.link-chain-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.link-chain-table {
  width: 100%;
  max-width: 100%;

  :deep(.atlas-app-table__inner-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__wrap) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__bar.is-horizontal) {
    display: none !important;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(1)),
  :deep(.atlas-app-table__body colgroup col:nth-child(1)) {
    width: 46% !important;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(2)),
  :deep(.atlas-app-table__body colgroup col:nth-child(2)),
  :deep(.atlas-app-table__header colgroup col:nth-child(3)),
  :deep(.atlas-app-table__body colgroup col:nth-child(3)) {
    width: 27% !important;
  }

  :deep(col[name='gutter']) {
    width: 0 !important;
  }

  :deep(td.atlas-app-table__cell) {
    padding-top: 6px;
    padding-bottom: 6px;
    vertical-align: middle;
  }

  :deep(td.atlas-app-table__cell .cell) {
    display: flex;
    align-items: center;
    min-height: 100%;
  }
}

.link-chain-text {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #7dd3fc;
  word-break: break-all;
  white-space: normal;
  line-height: 1.4;
  overflow: hidden;

  &--relay {
    color: #c4b5fd;
  }
}

.feedback-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: auto auto auto;
  gap: 8px 8px;
  padding: 10px 8px;
  border-radius: 6px;
  background: rgba(0, 225, 255, 0.04);
  border: 1px solid rgba(0, 225, 255, 0.1);
}

.feedback-cell {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;

  &--empty {
    min-height: 0;
  }
}

.feedback-link {
  font-size: 13px;
  font-weight: 600;
  color: #7dd3fc;
  word-break: break-word;
  line-height: 1.45;
  text-shadow: 0 0 6px rgba(125, 211, 252, 0.35);
}

.feedback-time {
  font-size: 13px;
  font-weight: 700;
  color: #40f2ff;
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-word;
  line-height: 1.3;
  text-shadow: 0 0 8px rgba(64, 242, 255, 0.5);
}

.analysis-kpi-row {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
}

.analysis-kpi-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 6px;
  background: rgba(0, 225, 255, 0.04);
  border: 1px solid rgba(0, 225, 255, 0.1);
}

.analysis-kpi-label {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.3;
  white-space: nowrap;
}

.analysis-kpi-value {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  word-break: break-word;

  &--before {
    color: #4ade80;
  }

  &--after {
    color: #fb923c;
  }

  &--reduce {
    color: #f87171;
  }

  &--delay {
    color: #fbbf24;
    font-size: 16px;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.45);
  }
}

.empty-sat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  gap: 8px;

  .empty-icon {
    font-size: 28px;
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    color: #94a3b8;
  }

  .empty-sub {
    margin: 0;
    font-size: 12px;
  }
}

.task-loading-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(64, 242, 255, 0.2);
  border-top-color: #40f2ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
