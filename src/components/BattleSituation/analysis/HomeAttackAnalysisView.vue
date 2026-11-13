<template>
  <div class="home-attack-analysis home-analysis-page dark-theme">
    <div v-if="!store.activedTask" class="home-analysis-empty">请先选择场景与任务</div>
    <div v-else-if="analysisLoading" class="home-analysis-empty">正在加载分析数据...</div>
    <div v-else class="attack-table-shell">
      <div class="attack-table-panel">
        <div class="attack-table-caption">
          <span class="attack-table-title">目标攻击度分析</span>
          <span class="attack-table-formula">综合可攻击条件 = 攻击度 × 背景加权</span>
        </div>
        <div class="attack-table-scroll">
          <table class="attack-dual-table" cellspacing="0" cellpadding="0">
            <colgroup>
              <col v-for="(width, idx) in columnWidths" :key="`col-${idx}`" :style="{ width }" />
            </colgroup>
            <thead>
              <tr class="attack-col-header">
                <th scope="col">所属国家</th>
                <th scope="col">卫星名称</th>
                <th scope="col">卫星类型</th>
                <th scope="col">国家权重</th>
                <th scope="col">武器名称</th>
                <th scope="col">武器类型</th>
                <th scope="col">攻击窗口</th>
                <th scope="col">攻击度</th>
                <th scope="col">背景加权</th>
                <th scope="col">综合可攻击条件</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in tableRows"
                :key="row.rowKey"
                :class="homeAttackAnalysisCountryRowClass(row.country)"
              >
                <td>{{ row.country }}</td>
                <td class="attack-cell--name">{{ row.satelliteName }}</td>
                <td>{{ row.satelliteType }}</td>
                <td>{{ row.countryWeightText }}</td>
                <td class="attack-cell--name">{{ row.weaponName }}</td>
                <td>{{ row.weaponType }}</td>
                <td>{{ row.attackWindowText }}</td>
                <td class="attack-cell--metric">
                  <span class="attack-cell-value">{{ row.attackDegreeText }}</span>
                  <span class="attack-cell-hint">{{ row.attackDegreeHint }}</span>
                </td>
                <td>{{ row.backgroundWeightText }}</td>
                <td class="attack-cell--metric">
                  <span class="attack-cell-value">{{ row.compositeAttackText }}</span>
                  <span class="attack-cell-hint">{{ row.compositeAttackHint }}</span>
                </td>
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
  buildHomeAttackAnalysisRowsFromMatrix,
  buildMockHomeAttackAnalysisRows,
  homeAttackAnalysisCountryRowClass,
  type HomeAttackAnalysisDataSource,
  type HomeAttackAnalysisTableRow,
} from '@/utils/buildHomeAttackAnalysisTable'

defineOptions({ name: 'HomeAttackAnalysisView' })

/** 10 列宽 */
const columnWidths = ['8%', '12%', '11%', '7%', '12%', '8%', '16%', '9%', '7%', '10%'] as const

const store = useLayoutStore()

/**
 * 计算：当前任务攻击分析矩阵是否正在加载。
 * 返回：`store.taskAnalysisLoading` 布尔值。
 * 作用：表格加载态展示依据。
 */
const analysisLoading = computed(() => store.taskAnalysisLoading)
/**
 * 计算：布局 Store 中缓存的任务分析矩阵原始数据。
 * 返回：`store.taskAnalysisData`。
 * 作用：攻击度矩阵行构建的数据来源。
 */
const analysisData = computed(() => store.taskAnalysisData)
/**
 * 计算：攻击分析矩阵是否已就绪且属于当前激活任务。
 * 返回：矩阵含层级实体且分析任务 id 与当前任务一致时为 `true`。
 * 作用：在接口矩阵与 mock 行之间切换数据源。
 */
const analysisReady = computed(
  () =>
    Boolean(analysisData.value?.levelSeriesEntities?.length) &&
    store.taskAnalysisTaskId === store.activedTask?.id,
)

/**
 * 计算：当前任务作战对象国家列表。
 * 返回：`activedTask.enemyCountryShow`，缺失时为空数组。
 * 作用：构建矩阵行与 mock 攻击分析表的优先国家。
 */
const priorityCountries = computed(() => store.activedTask?.enemyCountryShow ?? [])

/**
 * 计算：首页攻击度表格行及数据来源。
 * 返回：`{ rows, source }`；无任务时空行 mock；矩阵可用且解析出行时用 matrix，否则 mock。
 * 作用：模板绑定攻击度表格数据与来源。
 */
const tablePayload = computed((): { rows: HomeAttackAnalysisTableRow[]; source: HomeAttackAnalysisDataSource } => {
  const task = store.activedTask
  if (!task) {
    return { rows: [], source: 'mock' }
  }
  if (analysisReady.value && analysisData.value) {
    const fromMatrix = buildHomeAttackAnalysisRowsFromMatrix(
      analysisData.value,
      task.id!,
      priorityCountries.value,
      store.c2ResourceSatelliteRows,
    )
    if (fromMatrix.length) {
      return { rows: fromMatrix, source: 'matrix' }
    }
  }
  return {
    rows: buildMockHomeAttackAnalysisRows(priorityCountries.value, task.id),
    source: 'mock',
  }
})

/**
 * 计算：攻击度表格当前展示的行列表。
 * 返回：`tablePayload.rows`。
 * 作用：表格组件的数据源。
 */
const tableRows = computed(() => tablePayload.value.rows)
</script>

<style scoped lang="scss">
$attack-table-border: rgba(56, 189, 248, 0.55);

$attack-header-basic: #6d5a1f;
$attack-header-weapon: #7a4428;
$attack-header-degree: #1e5280;
$attack-header-composite: #6b3a55;

.home-attack-analysis {
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

.attack-table-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-height: 0;
}

.attack-table-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  border: 2px solid $attack-table-border;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  box-sizing: border-box;
}

.attack-table-caption {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: 12px;
  padding: 12px 16px;
  background: rgba(13, 27, 49, 0.6);
  border-bottom: 1px solid $attack-table-border;
}

.attack-table-title {
  grid-column: 1 / -1;
  grid-row: 1;
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  color: #e2e8f0;
}

.attack-table-formula {
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

.attack-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.attack-dual-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: inherit;
}

.attack-dual-table thead {
  position: sticky;
  top: 0;
  z-index: 4;
}

.attack-col-header th,
.attack-dual-table tbody td {
  box-sizing: border-box;
  border-right: 1px solid $attack-table-border;
  border-bottom: 1px solid $attack-table-border;
}

.attack-col-header th:first-child,
.attack-dual-table tbody td:first-child {
  border-left: 1px solid $attack-table-border;
}

.attack-col-header th {
  border-top: 1px solid $attack-table-border;
  padding: 8px 6px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  color: #f1f5f9;
  vertical-align: middle;
  line-height: 1.25;
}

.attack-col-header th:nth-child(-n + 4) {
  background-color: $attack-header-basic;
}

.attack-col-header th:nth-child(n + 5):nth-child(-n + 7) {
  background-color: $attack-header-weapon;
}

.attack-col-header th:nth-child(8) {
  background-color: $attack-header-degree;
}

.attack-col-header th:nth-child(n + 9) {
  background-color: $attack-header-composite;
}

.attack-dual-table tbody td {
  padding: 8px 6px;
  text-align: center;
  vertical-align: middle;
  color: #cbd5e1;
  word-break: break-word;
}

.attack-cell--name {
  text-align: left;
}

.attack-cell--metric {
  text-align: center;
  vertical-align: top;
}

.attack-cell-value {
  display: block;
  color: #e2e8f0;
  line-height: 1.35;
}

.attack-cell-hint {
  display: block;
  margin-top: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.35;
  white-space: normal;
  text-align: center;
}

.attack-row--tw td {
  background-color: rgba(234, 179, 8, 0.2);
}

.attack-row--tw td:first-child {
  border-left: 4px solid #fbbf24;
}

.attack-row--jp td {
  background-color: rgba(16, 185, 129, 0.18);
}

.attack-row--jp td:first-child {
  border-left: 4px solid #34d399;
}

.attack-row--us td {
  background-color: rgba(59, 130, 246, 0.2);
}

.attack-row--us td:first-child {
  border-left: 4px solid #38bdf8;
}

.attack-row--default td {
  background-color: rgba(148, 163, 184, 0.12);
}

.attack-row--default td:first-child {
  border-left: 4px solid #94a3b8;
}
</style>

<style lang="scss">
@use '@/components/BattleSituation/styles/home-analysis-typography.scss';

.home-attack-analysis .attack-dual-table {
  font-size: inherit;
}
</style>
