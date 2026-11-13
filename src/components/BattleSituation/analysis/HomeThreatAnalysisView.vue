<template>
  <div class="home-threat-analysis home-analysis-page dark-theme">
    <div v-if="!store.activedTask" class="home-analysis-empty">请先选择场景与任务</div>
    <div v-else-if="analysisLoading" class="home-analysis-empty">正在加载分析数据...</div>
    <div v-else class="threat-table-shell">
      <!-- <p v-if="dataSource === 'mock'" class="threat-api-note">
        当前为演示数据（Mock）。真实数据需对接：任务 matrix（getTaskMatrix）、卫星 catalog（getSeries / querySatBySeries）、
        乘积模型威胁字段（/api/battle/rankProduct）及静态指标（幅宽、重访、覆盖范围等）专用接口。
      </p> -->
      <div class="threat-table-panel">
        <div class="threat-table-caption">
          <span class="threat-table-title">目标威胁度分析</span>
          <span class="threat-table-formula">综合威胁度 = 静态威胁度 × 动态威胁度</span>
        </div>
        <div class="threat-table-scroll">
          <table class="threat-dual-table" cellspacing="0" cellpadding="0">
            <colgroup>
              <col v-for="(width, idx) in columnWidths" :key="`col-${idx}`" :style="{ width }" />
            </colgroup>
            <thead>
              <tr class="threat-group-header">
                <th colspan="4" scope="colgroup" class="threat-grp threat-grp--basic">基本信息</th>
                <th colspan="5" scope="colgroup" class="threat-grp threat-grp--static">静态威胁度</th>
                <th colspan="3" scope="colgroup" class="threat-grp threat-grp--dynamic">动态威胁度</th>
                <th colspan="1" scope="colgroup" class="threat-grp threat-grp--composite">综合威胁度</th>
              </tr>
              <tr class="threat-col-header">
                <th scope="col">所属国家</th>
                <th scope="col">卫星名称</th>
                <th scope="col">卫星类型</th>
                <th scope="col">国家权重</th>
                <th scope="col">轨道倾角</th>
                <th scope="col">覆盖范围</th>
                <th scope="col">观测幅宽</th>
                <th scope="col">重访能力</th>
                <th scope="col">静态威胁度</th>
                <th scope="col">首次回传时间</th>
                <th scope="col">覆盖率</th>
                <th scope="col">动态威胁度</th>
                <th scope="col">综合威胁度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in tableRows" :key="row.rowKey" :class="homeThreatAnalysisCountryRowClass(row.country)">
                <td>{{ row.country }}</td>
                <td class="threat-cell--name">{{ row.satelliteName }}</td>
                <td>{{ row.satelliteType }}</td>
                <td>{{ row.countryWeightText }}</td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.orbitalInclinationText }}</span>
                  <span class="threat-cell-hint">{{ row.orbitalInclinationHint }}</span>
                </td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.coverageRangeText }}</span>
                  <span class="threat-cell-hint">{{ row.coverageRangeHint }}</span>
                </td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.swathWidthText }}</span>
                  <span class="threat-cell-hint">{{ row.swathWidthHint }}</span>
                </td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.revisitCapabilityText }}</span>
                  <span class="threat-cell-hint">{{ row.revisitCapabilityHint }}</span>
                </td>
                <td>{{ row.staticThreatText }}</td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.firstFeedbackTimeText }}</span>
                  <span class="threat-cell-hint">{{ row.firstFeedbackTimeHint }}</span>
                </td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.coverageRateText }}</span>
                  <span class="threat-cell-hint">{{ row.coverageRateHint }}</span>
                </td>
                <td>{{ row.dynamicThreatText }}</td>
                <td>{{ row.compositeThreatText }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '@/store/modules/layout'
import {
  buildHomeThreatAnalysisRowsFromMatrix,
  buildMockHomeThreatAnalysisRows,
  homeThreatAnalysisCountryRowClass,
  type HomeThreatAnalysisDataSource,
  type HomeThreatAnalysisTableRow,
} from '@/utils/buildHomeThreatAnalysisTable'

defineOptions({ name: 'HomeThreatAnalysisView' })

/** 表头与表体列宽一致（13 列） */
const columnWidths = [
  '7%',
  '11%',
  '12%',
  '6%',
  '7%',
  '7%',
  '7%',
  '8%',
  '8%',
  '9%',
  '7%',
  '8%',
  '8%',
] as const

const store = useLayoutStore()

/**
 * 计算：当前任务威胁分析矩阵是否正在加载。
 * 返回：`store.taskAnalysisLoading` 布尔值。
 * 作用：表格加载态与空态展示依据。
 */
const analysisLoading = computed(() => store.taskAnalysisLoading)
/**
 * 计算：布局 Store 中缓存的任务分析矩阵原始数据。
 * 返回：`store.taskAnalysisData` 或等价 undefined。
 * 作用：作为矩阵行构建与就绪判断的数据来源。
 */
const analysisData = computed(() => store.taskAnalysisData)
/**
 * 计算：威胁分析矩阵是否已就绪且属于当前激活任务。
 * 返回：矩阵含 `levelSeriesEntities` 且 `taskAnalysisTaskId` 与当前任务 id 一致时为 `true`。
 * 作用：决定使用接口矩阵数据还是回落 mock 行。
 */
const analysisReady = computed(
  () =>
    Boolean(analysisData.value?.levelSeriesEntities?.length) &&
    store.taskAnalysisTaskId === store.activedTask?.id,
)

/**
 * 计算：当前任务作战对象（蓝方）国家展示列表。
 * 返回：`activedTask.enemyCountryShow`，缺失时为空数组。
 * 作用：矩阵行构建与 mock 数据中的优先国家列。
 */
const priorityCountries = computed(() => store.activedTask?.enemyCountryShow ?? [])

/**
 * 计算：首页威胁度表格行及数据来源（矩阵或 mock）。
 * 返回：`{ rows, source }`，无任务时空行与 mock；就绪且矩阵可解析时用 matrix，否则 mock。
 * 作用：统一供模板消费的表格载荷与来源标识。
 */
const tablePayload = computed((): { rows: HomeThreatAnalysisTableRow[]; source: HomeThreatAnalysisDataSource } => {
  if (!store.activedTask) {
    return { rows: [], source: 'mock' }
  }
  if (analysisReady.value && analysisData.value) {
    const fromMatrix = buildHomeThreatAnalysisRowsFromMatrix(
      analysisData.value,
      priorityCountries.value,
      store.c2ResourceSatelliteRows,
    )
    if (fromMatrix.length) {
      return { rows: fromMatrix, source: 'matrix' }
    }
  }
  return {
    rows: buildMockHomeThreatAnalysisRows(priorityCountries.value),
    source: 'mock',
  }
})

/**
 * 计算：威胁度表格当前展示的行列表。
 * 返回：`tablePayload.rows`。
 * 作用：`el-table` 直接绑定的数据源。
 */
const tableRows = computed(() => tablePayload.value.rows)
</script>

<style scoped lang="scss">
$threat-table-border: rgba(56, 189, 248, 0.55);

.home-threat-analysis {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px 20px;
  overflow: hidden;
  background: #0b1220;
  color: #e2e8f0;
}

.home-analysis-empty {
  flex: 1;
  padding: 48px;
  text-align: center;
  color: #94a3b8;
}

.threat-api-note {
  flex-shrink: 0;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid rgba(251, 191, 36, 0.45);
  background: rgba(251, 191, 36, 0.08);
  color: #fcd34d;
  line-height: 1.5;
}

.threat-table-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.threat-table-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 2px solid $threat-table-border;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  box-sizing: border-box;
}

.threat-table-caption {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: 12px;
  padding: 12px 16px;
  background: rgba(13, 27, 49, 0.6);
  border-bottom: 1px solid $threat-table-border;
}

.threat-table-title {
  grid-column: 1 / -1;
  grid-row: 1;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  color: #e2e8f0;
}

.threat-table-formula {
  grid-column: 3;
  grid-row: 1;
  justify-self: end;
  align-self: center;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: #fca5a5;
  white-space: nowrap;
}

/* 单表 + sticky 表头：纵向滚动条与表头共用同一列宽，避免双表错位 */
.threat-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.threat-dual-table {
  width: 100%;
  min-width: 1200px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: inherit;
  border: 0;
}

.threat-dual-table thead {
  position: sticky;
  top: 0;
  z-index: 4;
}

.threat-group-header th,
.threat-col-header th,
.threat-dual-table tbody td {
  box-sizing: border-box;
  border-right: 1px solid $threat-table-border;
  border-bottom: 1px solid $threat-table-border;
}

.threat-group-header th:first-child,
.threat-col-header th:first-child,
.threat-dual-table tbody td:first-child {
  border-left: 1px solid $threat-table-border;
}

.threat-group-header th {
  border-top: 1px solid $threat-table-border;
}

/* 分组行与列名行紧贴，消除 sticky 表头行间空隙 */
.threat-col-header th {
  border-top: none;
}

.threat-group-header th,
.threat-col-header th {
  padding: 8px 6px;
  margin: 0;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  color: #f1f5f9;
  vertical-align: middle;
  line-height: 1.25;
}

/* 四块表头区域色（分组行 + 列名行一致，不透明） */
$threat-header-basic: #6d5a1f;
$threat-header-static: #7a4428;
$threat-header-dynamic: #1e5280;
$threat-header-composite: #6b3a55;

.threat-grp--basic {
  background-color: $threat-header-basic;
}

.threat-grp--static {
  background-color: $threat-header-static;
}

.threat-grp--dynamic {
  background-color: $threat-header-dynamic;
}

.threat-grp--composite {
  background-color: $threat-header-composite;
}

.threat-col-header th {
  font-weight: 600;
}

/* 基本信息：第 1–4 列 */
.threat-col-header th:nth-child(-n + 4) {
  background-color: $threat-header-basic;
}

/* 静态威胁度：第 5–9 列 */
.threat-col-header th:nth-child(n + 5):nth-child(-n + 9) {
  background-color: $threat-header-static;
}

/* 动态威胁度：第 10–12 列 */
.threat-col-header th:nth-child(n + 10):nth-child(-n + 12) {
  background-color: $threat-header-dynamic;
}

/* 综合威胁度：第 13 列 */
.threat-col-header th:nth-child(13) {
  background-color: $threat-header-composite;
}

.threat-dual-table tbody td {
  padding: 8px 6px;
  text-align: center;
  vertical-align: middle;
  color: #cbd5e1;
  word-break: break-word;
}

.threat-cell--name {
  text-align: left;
}

.threat-cell--metric {
  text-align: center;
  vertical-align: top;
}

.threat-cell-value {
  display: block;
  color: #e2e8f0;
  line-height: 1.35;
}

.threat-cell-hint {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  white-space: normal;
  text-align: center;
}

.threat-cell--name .threat-cell-hint {
  text-align: left;
}

/* 按国家区分行：提高底色饱和度 + 首列色条 */
.threat-row--tw td {
  background-color: rgba(234, 179, 8, 0.2);
}

.threat-row--tw td:first-child {
  border-left: 4px solid #fbbf24;
}

.threat-row--jp td {
  background-color: rgba(16, 185, 129, 0.18);
}

.threat-row--jp td:first-child {
  border-left: 4px solid #34d399;
}

.threat-row--us td {
  background-color: rgba(59, 130, 246, 0.2);
}

.threat-row--us td:first-child {
  border-left: 4px solid #38bdf8;
}

.threat-row--default td {
  background-color: rgba(148, 163, 184, 0.12);
}

.threat-row--default td:first-child {
  border-left: 4px solid #94a3b8;
}
</style>

<style lang="scss">
@use '@/components/BattleSituation/styles/home-analysis-typography.scss';

.home-threat-analysis .threat-dual-table {
  font-size: inherit;
}
</style>
