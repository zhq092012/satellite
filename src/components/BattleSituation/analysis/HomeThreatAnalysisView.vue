<template>
  <div class="home-analysis-page dark-theme">
    <header class="home-analysis-header">
      <h1 class="home-analysis-title">威胁度分析</h1>
      <p class="home-analysis-desc">
        综合威胁度 = 静态威胁度 × 动态威胁度（结果区间归一化展示）。任务阶段国家优先排序并高亮。
      </p>
    </header>

    <div v-if="!store.activedTask" class="home-analysis-empty">请先选择场景与任务</div>
    <div v-else-if="analysisLoading" class="home-analysis-empty">正在加载分析数据...</div>
    <div v-else-if="!analysisReady" class="home-analysis-empty">请等待当前任务算法计算完成</div>

    <template v-else>
      <section class="analysis-section panel-card">
        <h2>首次回传时间与延迟</h2>
        <div class="feedback-kpi-grid">
          <div class="feedback-cell"><span class="kpi-label">打击前</span></div>
          <div class="feedback-cell"><span class="kpi-label">打击后</span></div>
          <div class="feedback-cell"><span class="kpi-label">造成延迟</span></div>
          <div class="feedback-cell"><span>{{ beforeFeedbackTime }}</span></div>
          <div class="feedback-cell"><span>{{ afterFeedbackTime }}</span></div>
          <div class="feedback-cell"><span>{{ strikeDelayText }}</span></div>
        </div>
        <p class="formula-note">计算方法：解析任务 matrix 的 beforeFirstFeedbackTime / afterFirstFeedbackTime，延迟为二者时间差。</p>
      </section>

      <section class="analysis-section panel-card">
        <h2>平均覆盖率</h2>
        <div class="kpi-row">
          <span>打击前 {{ beforeCoverageText }}</span>
          <span>打击后 {{ afterCoverageText }}</span>
          <span>减少 {{ coverageReductionText }}</span>
        </div>
        <p class="formula-note">计算方法：levelSeriesEntities 内 initMatrixList / satelliteMatrixList 覆盖率均值。</p>
      </section>

      <section v-for="country in sortedCountries" :key="country" class="analysis-section panel-card"
        :class="countryRowPriorityClass(country, priorityCountries)">
        <h2>{{ country }} · 威胁度指标</h2>
        <el-table :data="rowsByCountry(country)" size="small" border empty-text="暂无数据">
          <el-table-column prop="name" label="卫星" min-width="120" show-overflow-tooltip />
          <el-table-column prop="sysType" label="类型" width="80" />
          <el-table-column label="综合威胁度" width="100">
            <template #default="{ row }">{{ formatThreat(compositeThreat(row)) }}</template>
          </el-table-column>
          <el-table-column label="静态威胁度" width="100">
            <template #default="{ row }">{{ formatThreat(row.threatBefore) }}</template>
          </el-table-column>
          <el-table-column label="动态威胁度" width="100">
            <template #default="{ row }">{{ formatThreat(dynamicThreat(row)) }}</template>
          </el-table-column>
        </el-table>
        <p class="formula-note">
          静态威胁度：打击前 threatBefore（发射日期、分辨率、带宽等权重见算法管理-卫星威胁分析配置）。
          动态威胁度：打击前后 threat 变化比；综合 = 静态 × 动态（归一化）。
        </p>
      </section>

      <section class="analysis-section panel-card">
        <h2>卫星打击推荐（待接口）</h2>
        <p class="formula-note">
          当前展示逻辑与整体态势原右侧面板一致；替换为真实接口时请对接 getSuggestionOfTask / 推荐列表 API。
        </p>
        <el-table :data="strikeRecommendRows" size="small" border empty-text="暂无推荐">
          <el-table-column type="index" label="序号" width="52" />
          <el-table-column prop="name" label="卫星名称" min-width="120" />
          <el-table-column label="综合威胁度" width="100">
            <template #default="{ row }">{{ formatThreat(row.compositeThreat) }}</template>
          </el-table-column>
          <el-table-column label="静态" width="80">
            <template #default="{ row }">{{ formatThreat(row.staticThreat) }}</template>
          </el-table-column>
          <el-table-column label="动态" width="80">
            <template #default="{ row }">{{ formatThreat(row.dynamicThreat) }}</template>
          </el-table-column>
        </el-table>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '@/store/modules/layout'
import {
  buildSatelliteAnalysisTableRows,
  type SatelliteMetricTableRow,
} from '@/utils/buildSatelliteAnalysisTable'
import {
  MOCK_SATELLITE_STRIKE_RECOMMENDATIONS,
  sortStrikeRecommendByCompositeThreat,
} from '@/utils/mockSatelliteStrikeRecommendations'
import {
  formatCoveragePercent,
  formatCoverageReduction,
  formatStrikeDelayDuration,
  parseFeedbackTimeAndLink,
} from '@/utils/zhchPlanDisplay'
import {
  countryRowPriorityClass,
  sortCountriesForTaskPhase,
} from '@/components/BattleSituation/analysis/countryAnalysisSort'

defineOptions({ name: 'HomeThreatAnalysisView' })

const store = useLayoutStore()

const analysisLoading = computed(() => store.taskAnalysisLoading)
const analysisData = computed(() => store.taskAnalysisData)
const analysisReady = computed(
  () => Boolean(analysisData.value?.levelSeriesEntities?.length) && store.taskAnalysisTaskId === store.activedTask?.id,
)

const priorityCountries = computed(() => store.activedTask?.enemyCountryShow ?? [])

const metricRows = computed(() => buildSatelliteAnalysisTableRows(analysisData.value))

const sortedCountries = computed(() => {
  const list = priorityCountries.value.length ? priorityCountries.value : ['蓝方目标']
  return sortCountriesForTaskPhase(list, priorityCountries.value)
})

/** 按国家分区展示（matrix 无 country 字段时，蓝方任务下展示全量指标） */
const rowsByCountry = (_country: string) => metricRows.value

const beforeFeedback = computed(() => parseFeedbackTimeAndLink(analysisData.value?.beforeFirstFeedbackTime))
const afterFeedback = computed(() => parseFeedbackTimeAndLink(analysisData.value?.afterFirstFeedbackTime))
const beforeFeedbackTime = computed(() => beforeFeedback.value.time || '--')
const afterFeedbackTime = computed(() => afterFeedback.value.time || '--')
const strikeDelayText = computed(() =>
  formatStrikeDelayDuration(analysisData.value?.beforeFirstFeedbackTime, analysisData.value?.afterFirstFeedbackTime),
)

const beforeCoverageText = computed(() => formatCoveragePercent(analysisData.value?.beforeAvgCoverage))
const afterCoverageText = computed(() => formatCoveragePercent(analysisData.value?.afterAvgCoverage))
const coverageReductionText = computed(() =>
  formatCoverageReduction(analysisData.value?.beforeAvgCoverage, analysisData.value?.afterAvgCoverage),
)

/** 动态威胁：打击后/打击前比值（缺数据时为 null） */
const dynamicThreat = (row: SatelliteMetricTableRow): number | null => {
  const before = row.threatBefore
  const after = row.threatAfter
  if (before == null || after == null || before === 0) return null
  return after / before
}

/** 综合威胁 = 静态 × 动态 */
const compositeThreat = (row: SatelliteMetricTableRow): number | null => {
  const s = row.threatBefore
  const d = dynamicThreat(row)
  if (s == null || d == null) return s
  return s * d
}

const formatThreat = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toFixed(4)
}

/** 推荐列表（mock，待接口替换） */
const strikeRecommendRows = computed(() => sortStrikeRecommendByCompositeThreat([...MOCK_SATELLITE_STRIKE_RECOMMENDATIONS]))
</script>

<style scoped lang="scss">
.home-analysis-page {
  padding: 16px 20px 32px;
  min-height: 100%;
  background: #0b1220;
  color: #e2e8f0;
}

.home-analysis-header {
  margin-bottom: 16px;
}

.home-analysis-title {
  margin: 0 0 8px;
}

.home-analysis-desc {
  margin: 0;
  color: #94a3b8;
}

.home-analysis-empty {
  padding: 48px;
  text-align: center;
  color: #94a3b8;
}

.analysis-section {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.15);
}

.formula-note {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.5;
}

.feedback-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.kpi-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.analysis-country-row--priority {
  border-color: rgba(251, 191, 36, 0.45);
}

.analysis-country-row--default {
  border-color: rgba(56, 189, 248, 0.12);
}
</style>

<style lang="scss">
@use '@/components/BattleSituation/styles/home-analysis-typography.scss';
</style>
