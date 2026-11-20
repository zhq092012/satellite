<template>
  <div class="home-threat-analysis home-analysis-page dark-theme">
    <div v-if="!store.activedTask" class="home-analysis-empty">请先选择场景与任务</div>
  <div v-else class="threat-table-shell">
      <div class="threat-table-panel">
        <div class="threat-table-caption">
          <span class="threat-table-title">威胁度分析</span>
          <span class="threat-table-formula">综合威胁度 = 静态威胁度 × 动态威胁度（默认聚合算法 multiply）</span>
          <el-button size="small" :loading="loading" @click="loadThreatAnalysis">刷新</el-button>
        </div>
        <p class="analysis-intro">
          数据来自 <code>GET /api/compute/threat/{taskId}</code>。静态、动态因子明细见对应列辅助说明；任务算法未完成时接口可能返回错误，请以提示为准。
        </p>
        <p v-if="metaLine" class="analysis-meta">{{ metaLine }}</p>
        <p v-if="algorithmLine" class="analysis-meta analysis-meta--algo">{{ algorithmLine }}</p>
        <p v-if="errorMessage" class="analysis-error">{{ errorMessage }}</p>
        <div v-loading="loading" class="threat-table-scroll">
          <table class="threat-dual-table" cellspacing="0" cellpadding="0">
            <colgroup>
              <col v-for="(width, idx) in columnWidths" :key="`col-${idx}`" :style="{ width }" />
            </colgroup>
            <thead>
              <tr class="threat-group-header">
                <th colspan="4" scope="colgroup" class="threat-grp threat-grp--basic">基本信息</th>
                <th colspan="2" scope="colgroup" class="threat-grp threat-grp--static">静态威胁度</th>
                <th colspan="5" scope="colgroup" class="threat-grp threat-grp--dynamic">动态威胁度</th>
                <th colspan="1" scope="colgroup" class="threat-grp threat-grp--composite">综合威胁度</th>
              </tr>
              <tr class="threat-col-header">
                <th scope="col">NORAD</th>
                <th scope="col">所属国家</th>
                <th scope="col">卫星名称</th>
                <th scope="col">卫星类型</th>
                <th scope="col">静态威胁度</th>
                <th scope="col">静态因子</th>
                <th scope="col">首次回传时间</th>
                <th scope="col">覆盖率</th>
                <th scope="col">过境时长</th>
                <th scope="col">回传时效</th>
                <th scope="col">动态威胁度</th>
                <th scope="col">综合威胁度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!tableRows.length && !loading">
                <td colspan="12" class="threat-empty-cell">暂无威胁度数据</td>
              </tr>
              <tr
                v-for="row in tableRows"
                :key="row.rowKey"
                :class="computeAnalysisCountryRowClass(row.country, priorityCountries)"
              >
                <td>{{ row.noradId || '--' }}</td>
                <td>{{ row.country || '--' }}</td>
                <td class="threat-cell--name">{{ row.satelliteName || '--' }}</td>
                <td>{{ row.satelliteType || '--' }}</td>
                <td class="threat-cell--metric">
                  <span class="threat-cell-value">{{ row.staticThreatText }}</span>
                </td>
                <td class="threat-cell--metric threat-cell--factors">
                  <span class="threat-cell-hint">{{ row.staticFactorsHint || '--' }}</span>
                </td>
                <td>{{ row.firstReturnTimeText }}</td>
                <td>{{ row.coverageRateText }}</td>
                <td>{{ row.passTotalDurationText }}</td>
                <td>{{ row.transmissionTimelinessText }}</td>
                <td>{{ row.dynamicThreatText }}</td>
                <td class="threat-cell--emphasis">{{ row.comprehensiveThreatText }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getThreatAnalysis, listRegisteredComputeAlgorithms } from '@/api/threat/threat'
import { useLayoutStore } from '@/store/modules/layout'
import type { AlgorithmInfo, ThreatResp, ThreatRow } from '@/types/threat'
import { isComputeApiSuccess } from '@/utils/computeApi'
import { resolveCombatCountriesFromTask } from '@/utils/taskEntity'
import {
  computeAnalysisCountryRowClass,
  formatAlgorithmSelectionText,
  formatComputeRatioPercent,
  formatComputeScore,
  formatFactorScoreHints,
  sortComputeRowsByCountryAndScore,
} from '@/utils/computeAnalysisDisplay'

defineOptions({ name: 'HomeThreatAnalysisView' })

const columnWidths = [
  '8%',
  '7%',
  '12%',
  '10%',
  '8%',
  '14%',
  '10%',
  '7%',
  '8%',
  '8%',
  '8%',
  '8%',
] as const

const store = useLayoutStore()
const loading = ref(false)
const errorMessage = ref('')
const threatResp = ref<ThreatResp | null>(null)
const algorithmCatalog = ref<AlgorithmInfo[]>([])

/**
 * 计算：当前任务作战对象国家列表。
 * 返回：enemyCountry 数组。
 * 作用：表格排序与行高亮。
 */
const priorityCountries = computed(() => resolveCombatCountriesFromTask(store.activedTask))

interface ThreatTableRow {
  rowKey: string
  noradId?: string
  country?: string
  satelliteName?: string
  satelliteType?: string
  staticThreatText: string
  staticFactorsHint: string
  firstReturnTimeText: string
  coverageRateText: string
  passTotalDurationText: string
  transmissionTimelinessText: string
  dynamicThreatText: string
  comprehensiveThreatText: string
}

const mapThreatRow = (row: ThreatRow): ThreatTableRow => ({
  rowKey: row.noradId?.trim() || `${row.satelliteName}-${row.country}`,
  noradId: row.noradId,
  country: row.country,
  satelliteName: row.satelliteName,
  satelliteType: row.satelliteType,
  staticThreatText: formatComputeScore(row.staticThreat),
  staticFactorsHint: formatFactorScoreHints(row.staticFactors),
  firstReturnTimeText: row.firstReturnTime?.trim() || '--',
  coverageRateText: formatComputeRatioPercent(row.coverageRate),
  passTotalDurationText: formatComputeRatioPercent(row.passTotalDuration),
  transmissionTimelinessText: formatComputeRatioPercent(row.transmissionTimeliness),
  dynamicThreatText: formatComputeScore(row.dynamicThreat),
  comprehensiveThreatText: formatComputeScore(row.comprehensiveThreat),
})

/**
 * 计算：威胁度表格展示行（排序后）。
 * 返回：`ThreatTableRow[]`。
 * 作用：表格数据源。
 */
const tableRows = computed((): ThreatTableRow[] => {
  const rows = threatResp.value?.rows ?? []
  const mapped = rows.map(mapThreatRow)
  return sortComputeRowsByCountryAndScore(
    mapped.map((item) => ({
      ...item,
      score: Number.parseFloat(item.comprehensiveThreatText) || 0,
    })),
    priorityCountries.value,
  )
})

/**
 * 计算：任务与计算时间说明行。
 * 返回：拼接文本或空。
 * 作用：页头辅助信息。
 */
const metaLine = computed(() => {
  const data = threatResp.value
  if (!data) return ''
  const parts = [
    data.taskName ? `任务：${data.taskName}` : '',
    data.generatedAt ? `计算时间：${data.generatedAt}` : '',
    data.taskId ? `任务 ID：${data.taskId}` : '',
  ].filter(Boolean)
  return parts.join(' · ')
})

/**
 * 计算：本次计算使用的算法说明。
 * 返回：可读文本。
 * 作用：页头算法辅助信息。
 */
const algorithmLine = computed(() =>
  formatAlgorithmSelectionText(threatResp.value?.algorithms, algorithmCatalog.value),
)

const loadAlgorithmCatalog = async () => {
  try {
    const res = await listRegisteredComputeAlgorithms()
    if (isComputeApiSuccess(res.code) && Array.isArray(res.data)) {
      algorithmCatalog.value = res.data
    }
  } catch {
    algorithmCatalog.value = []
  }
}

const loadThreatAnalysis = async () => {
  const task = store.activedTask
  if (!task?.id) {
    threatResp.value = null
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getThreatAnalysis(String(task.id))
    if (!isComputeApiSuccess(res.code)) {
      throw new Error(res.msg || `威胁度分析失败（code=${res.code}）`)
    }
    if (!res.data) {
      throw new Error('威胁度分析返回 data 为空')
    }
    threatResp.value = res.data
  } catch (error) {
    threatResp.value = null
    errorMessage.value = error instanceof Error ? error.message : String(error)
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

/**
 * 监听：当前激活任务 id。
 * 回调不返回清理函数。
 * 作用：切换任务后自动拉取威胁度分析。
 */
watch(
  () => store.activedTask?.id,
  () => {
    void loadThreatAnalysis()
  },
  { immediate: true },
)

void loadAlgorithmCatalog()
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
}

.threat-table-caption {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: 12px;
  padding: 12px 16px;
  background: rgba(13, 27, 49, 0.6);
  border-bottom: 1px solid $threat-table-border;
}

.threat-table-title {
  font-size: 18px;
  font-weight: 700;
  color: #7dd3fc;
}

.threat-table-formula {
  justify-self: center;
  color: #94a3b8;
  font-size: 14px;
}

.analysis-intro,
.analysis-meta {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 16px;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.5;
  border-bottom: 1px solid rgba(56, 189, 248, 0.15);
}

.analysis-meta--algo {
  color: #cbd5e1;
}

.analysis-error {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 16px;
  color: #f87171;
  font-size: 13px;
}

.threat-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.threat-dual-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.threat-group-header th,
.threat-col-header th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 6px;
  border: 1px solid $threat-table-border;
  background: rgba(13, 27, 49, 0.95);
  color: #e2e8f0;
  font-weight: 600;
  text-align: center;
}

.threat-grp--basic {
  background: rgba(30, 58, 95, 0.85) !important;
}

.threat-grp--static {
  background: rgba(78, 52, 20, 0.85) !important;
}

.threat-grp--dynamic {
  background: rgba(22, 78, 99, 0.85) !important;
}

.threat-grp--composite {
  background: rgba(88, 28, 66, 0.85) !important;
}

.threat-dual-table td {
  padding: 8px 6px;
  border: 1px solid rgba(56, 189, 248, 0.25);
  text-align: center;
  vertical-align: top;
  word-break: break-word;
}

.threat-cell--name {
  text-align: left;
}

.threat-cell--factors .threat-cell-hint {
  display: block;
  text-align: left;
  white-space: pre-wrap;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.35;
}

.threat-cell--emphasis {
  font-weight: 700;
  color: #fbbf24;
}

.threat-empty-cell {
  padding: 24px !important;
  color: #64748b;
}

.compute-row--priority-country td {
  background: rgba(34, 197, 94, 0.08);
}
</style>