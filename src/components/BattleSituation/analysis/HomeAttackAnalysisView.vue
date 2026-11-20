<template>
  <div class="home-attack-analysis home-analysis-page dark-theme">
    <div v-if="!store.activedTask" class="home-analysis-empty">请先选择场景与任务</div>
    <div v-else class="attack-table-shell">
      <div class="attack-table-panel">
        <div class="attack-table-caption">
          <span class="attack-table-title">打击度分析</span>
          <span class="attack-table-formula">各蓝方卫星可打击程度及因子分解</span>
          <el-button size="small" :loading="loading" @click="loadStrikeAnalysis">刷新</el-button>
        </div>
        <p class="analysis-intro">
          数据来自 <code>GET /api/compute/strike/{taskId}</code>。打击度与因子明细由后端注册算法计算；可通过顶栏「算法列表」查看默认生效算法编码。
        </p>
        <p v-if="metaLine" class="analysis-meta">{{ metaLine }}</p>
        <p v-if="algorithmLine" class="analysis-meta analysis-meta--algo">{{ algorithmLine }}</p>
        <p v-if="errorMessage" class="analysis-error">{{ errorMessage }}</p>
        <div v-loading="loading" class="attack-table-scroll">
          <table class="attack-dual-table" cellspacing="0" cellpadding="0">
            <colgroup>
              <col v-for="(width, idx) in columnWidths" :key="`col-${idx}`" :style="{ width }" />
            </colgroup>
            <thead>
              <tr class="attack-col-header">
                <th scope="col">NORAD</th>
                <th scope="col">所属国家</th>
                <th scope="col">卫星名称</th>
                <th scope="col">卫星类型</th>
                <th scope="col">打击度</th>
                <th scope="col">打击因子</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!tableRows.length && !loading">
                <td colspan="6" class="attack-empty-cell">暂无打击度数据</td>
              </tr>
              <tr
                v-for="row in tableRows"
                :key="row.rowKey"
                :class="computeAnalysisCountryRowClass(row.country, priorityCountries)"
              >
                <td>{{ row.noradId || '--' }}</td>
                <td>{{ row.country || '--' }}</td>
                <td class="attack-cell--name">{{ row.satelliteName || '--' }}</td>
                <td>{{ row.satelliteType || '--' }}</td>
                <td class="attack-cell--emphasis">{{ row.strikeText }}</td>
                <td class="attack-cell--factors">
                  <span class="attack-cell-hint">{{ row.factorsHint || '--' }}</span>
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
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getStrikeAnalysis } from '@/api/strike/strike'
import { listRegisteredComputeAlgorithms } from '@/api/threat/threat'
import { useLayoutStore } from '@/store/modules/layout'
import type { AlgorithmInfo } from '@/types/threat'
import type { ComputeStrikeRow, StrikeResp } from '@/types/strike'
import { isComputeApiSuccess } from '@/utils/computeApi'
import { resolveCombatCountriesFromTask } from '@/utils/taskEntity'
import {
  computeAnalysisCountryRowClass,
  formatAlgorithmSelectionText,
  formatComputeScore,
  formatFactorScoreHints,
  sortComputeRowsByCountryAndScore,
} from '@/utils/computeAnalysisDisplay'

defineOptions({ name: 'HomeAttackAnalysisView' })

const columnWidths = ['10%', '10%', '18%', '14%', '10%', '38%'] as const

const store = useLayoutStore()
const loading = ref(false)
const errorMessage = ref('')
const strikeResp = ref<StrikeResp | null>(null)
const algorithmCatalog = ref<AlgorithmInfo[]>([])

/**
 * 计算：作战对象国家，用于排序与高亮。
 * 返回：enemyCountry 列表。
 * 作用：表格展示优先级。
 */
const priorityCountries = computed(() => resolveCombatCountriesFromTask(store.activedTask))

interface StrikeTableRow {
  rowKey: string
  noradId?: string
  country?: string
  satelliteName?: string
  satelliteType?: string
  strikeText: string
  factorsHint: string
}

const mapStrikeRow = (row: ComputeStrikeRow): StrikeTableRow => ({
  rowKey: row.noradId?.trim() || `${row.satelliteName}-${row.country}`,
  noradId: row.noradId,
  country: row.country,
  satelliteName: row.satelliteName,
  satelliteType: row.satelliteType,
  strikeText: formatComputeScore(row.strike),
  factorsHint: formatFactorScoreHints(row.factors),
})

/**
 * 计算：打击度表格行。
 * 返回：排序后的展示行。
 * 作用：表格绑定数据。
 */
const tableRows = computed((): StrikeTableRow[] => {
  const rows = strikeResp.value?.rows ?? []
  const mapped = rows.map(mapStrikeRow)
  return sortComputeRowsByCountryAndScore(
    mapped.map((item) => ({
      ...item,
      score: Number.parseFloat(item.strikeText) || 0,
    })),
    priorityCountries.value,
  )
})

/**
 * 计算：任务元信息说明。
 * 返回：拼接字符串。
 * 作用：页头展示。
 */
const metaLine = computed(() => {
  const data = strikeResp.value
  if (!data) return ''
  return [
    data.taskName ? `任务：${data.taskName}` : '',
    data.generatedAt ? `计算时间：${data.generatedAt}` : '',
    data.taskId ? `任务 ID：${data.taskId}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

/**
 * 计算：打击度算法说明文本。
 * 返回：算法名称解析结果。
 * 作用：页头辅助说明。
 */
const algorithmLine = computed(() =>
  formatAlgorithmSelectionText(strikeResp.value?.algorithms, algorithmCatalog.value),
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

const loadStrikeAnalysis = async () => {
  const task = store.activedTask
  if (!task?.id) {
    strikeResp.value = null
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await getStrikeAnalysis(String(task.id))
    if (!isComputeApiSuccess(res.code)) {
      throw new Error(res.msg || `打击度分析失败（code=${res.code}）`)
    }
    if (!res.data) {
      throw new Error('打击度分析返回 data 为空')
    }
    strikeResp.value = res.data
  } catch (error) {
    strikeResp.value = null
    errorMessage.value = error instanceof Error ? error.message : String(error)
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

/**
 * 监听：当前激活任务 id。
 * 回调不返回清理函数。
 * 作用：任务切换后重新请求打击度分析。
 */
watch(
  () => store.activedTask?.id,
  () => {
    void loadStrikeAnalysis()
  },
  { immediate: true },
)

void loadAlgorithmCatalog()
</script>

<style scoped lang="scss">
$attack-table-border: rgba(56, 189, 248, 0.55);

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
}

.attack-table-caption {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  column-gap: 12px;
  padding: 12px 16px;
  background: rgba(13, 27, 49, 0.6);
  border-bottom: 1px solid $attack-table-border;
}

.attack-table-title {
  font-size: 18px;
  font-weight: 700;
  color: #7dd3fc;
}

.attack-table-formula {
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

.attack-table-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.attack-dual-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 13px;
}

.attack-col-header th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 10px 8px;
  border: 1px solid $attack-table-border;
  background: rgba(13, 27, 49, 0.95);
  color: #e2e8f0;
  font-weight: 600;
}

.attack-dual-table td {
  padding: 8px 6px;
  border: 1px solid rgba(56, 189, 248, 0.25);
  text-align: center;
  vertical-align: top;
  word-break: break-word;
}

.attack-cell--name {
  text-align: left;
}

.attack-cell--emphasis {
  font-weight: 700;
  color: #38bdf8;
}

.attack-cell--factors .attack-cell-hint {
  display: block;
  text-align: left;
  white-space: pre-wrap;
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.35;
}

.attack-empty-cell {
  padding: 24px !important;
  color: #64748b;
}

.compute-row--priority-country td {
  background: rgba(34, 197, 94, 0.08);
}
</style>