<template>
  <div class="strike-plan-generator dark-theme" v-loading="reportLoading">
    <div class="plan-header">
      <div class="header-center">
        <span class="type-label">作战方案报告</span>
        <span v-if="allSchemeCodes.length" class="scheme-count-badge">{{ allSchemeCodes.length }} 格</span>
        <el-button v-if="store.activedTask?.id" type="primary" link @click="reloadReportSchemes(true)">
          刷新方案
        </el-button>
      </div>

      <div class="header-right">
        <el-dropdown trigger="click" @command="handleDownload">
          <el-button type="primary" size="default" link>
            下载打击计划
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="csv">下载 CSV</el-dropdown-item>
              <el-dropdown-item command="xls">下载 XLS</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div class="plan-body">
      <div v-if="!store.activedTask" class="empty-container">
        <div class="empty-icon">📋</div>
        <div class="empty-text">请先在右上角选择战场与任务</div>
      </div>

      <p v-if="reportError" class="report-error">{{ reportError }}</p>

      <div v-else-if="!allSchemeCodes.length && !reportLoading" class="empty-container">
        <div class="empty-icon">📄</div>
        <div class="empty-text">当前任务暂无作战方案，请点击刷新或稍后重试</div>
      </div>

      <template v-else>
        <div class="scheme-picker">
          <span class="scheme-picker__label">对比方案</span>
          <el-checkbox-group v-model="selectedSchemeCodes" class="scheme-picker__group">
            <el-checkbox v-for="opt in schemeCheckboxOptions" :key="opt.value" :label="opt.value"
              class="scheme-picker__item">
              {{ opt.label }}
            </el-checkbox>
          </el-checkbox-group>
        </div>

        <ReportGenerateOverview :report="reportData" />

        <section v-if="topStageSections.length" class="report-comprehensive">
          <ReportStageCompareBlock v-for="section in topStageSections" :key="section.stageCode"
            class="report-comprehensive__stage" :stage-title="section.title" :stage="section.stage!"
            :active-tier-indexes="section.activeTierIndexes" top />
        </section>

        <div v-if="!selectedSchemeCodes.length" class="empty-container small">
          <div class="empty-text">请勾选 1～3 个方案查看明细</div>
        </div>

        <div v-else class="plan-columns" :class="{
          'plan-columns--single': selectedSchemeCodes.length === 1,
          'plan-columns--triple': selectedSchemeCodes.length === 3,
        }">
          <article v-for="schemeCode in selectedSchemeCodes" :key="schemeCode" class="plan-column">
            <header class="column-head">
              <span class="column-head__code">{{ schemeCode }}</span>
              <h3 class="column-head__name">{{ getSchemeShortTitle(schemeCode) }}</h3>
            </header>
            <div v-if="getSchemeView(schemeCode)" class="column-content">
              <StrikePlanSchemePanel :view="getSchemeView(schemeCode)!" dense />
            </div>
          </article>
        </div>

        <section v-if="crossCompareRows.length > 1" class="report-cross-compare">
          <h3 class="report-cross-compare__title">全部方案指标对比</h3>
          <div class="report-cross-compare__scroll">
            <table class="report-cross-compare__table" cellspacing="0" cellpadding="0">
              <thead>
                <tr>
                  <th>编码</th>
                  <th>方案</th>
                  <th>阶段</th>
                  <th>档位</th>
                  <th>选星数</th>
                  <th>达成度</th>
                  <th>综合分</th>
                  <th>求解</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in crossCompareRows" :key="row.code">
                  <td class="report-cross-compare__code">{{ row.code }}</td>
                  <td class="report-cross-compare__name">{{ row.name }}</td>
                  <td>{{ row.stageText || '—' }}</td>
                  <td>{{ row.tierText || '—' }}</td>
                  <td class="report-cross-compare__num">{{ row.targetSize ?? '—' }}</td>
                  <td class="report-cross-compare__num">{{ row.attainmentText }}</td>
                  <td class="report-cross-compare__num">{{ row.scoreText }}</td>
                  <td>{{ row.solverCaliber || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getReportSchemes } from '@/api/report/report'
import type { ReportGenerateResp, ReportStageResult, SchemeResult } from '@/types/report/report'
import {
  flattenStrikePlanRowsForExport,
  type StrikePlanSchemeView,
} from '@/utils/buildStrikePlanSchemeView'
import { buildReportSchemeView } from '@/utils/buildReportSchemeView'
import { downloadStrikePlanCsv, downloadStrikePlanXls } from '@/utils/exportStrikePlanTable'
import {
  buildReportSchemesCompareRows,
  buildReportStageSchemeGroups,
  collectReportTierIndexesForCodes,
  parseReportStageCodeFromSchemeCode,
} from '@/utils/reportSchemeDisplay'
import ReportStageCompareBlock from './strike-plan/ReportStageCompareBlock.vue'
import { useLayoutStore } from '@/store/modules/layout'
import StrikePlanSchemePanel from './strike-plan/StrikePlanSchemePanel.vue'
import ReportGenerateOverview from './strike-plan/ReportGenerateOverview.vue'

defineOptions({ name: 'StrikePlanGenerator' })

const store = useLayoutStore()

/** 报告接口加载中 */
const reportLoading = ref(false)
/** 报告接口错误文案 */
const reportError = ref('')
/** 当前任务方案报告 */
const reportData = ref<ReportGenerateResp | null>(null)
/** 请求序号，用于丢弃过期响应 */
let reportLoadToken = 0

/** 勾选对比的方案 code（最多 3 个） */
const selectedSchemeCodes = ref<string[]>([])

/**
 * 计算：接口返回的方案 code → 方案实体。
 * 返回 Map。
 * 作用：列渲染与构建视图时查找方案。
 */
const schemeByCode = computed(() => {
  const map = new Map<string, SchemeResult>()
  for (const scheme of reportData.value?.schemes ?? []) {
    const code = scheme.code?.trim()
    if (!code) continue
    map.set(code, scheme)
  }
  return map
})

/**
 * 计算：全部扁平 scheme 的 code 列表（稳定排序）。
 * 返回 string[]。
 * 作用：页面中间区展示全部格子。
 */
const allSchemeCodes = computed((): string[] => {
  const codes = (reportData.value?.schemes ?? [])
    .map((s) => s.code?.trim())
    .filter((c): c is string => Boolean(c))
  return [...codes].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
})

/**
 * 计算：页底跨方案对比行。
 * 返回 ReportSchemeCompareRow[]。
 * 作用：最后一块对比区表格。
 */
/**
 * 计算：顶栏复选框选项。
 * 返回 { value, label }[]。
 * 作用：横向勾选对比方案。
 */
const schemeCheckboxOptions = computed(() =>
  allSchemeCodes.value.map((code) => {
    const scheme = schemeByCode.value.get(code)
    const name = scheme?.name?.trim() || code
    return { value: code, label: `${code} · ${name}` }
  }),
)

/**
 * 计算：页底跨方案对比（仅当前勾选）。
 * 返回 ReportSchemeCompareRow[]。
 * 作用：最后一块对比表。
 */
const crossCompareRows = computed(() => {
  const rows = buildReportSchemesCompareRows(reportData.value?.schemes ?? [])
  const picked = new Set(selectedSchemeCodes.value)
  if (!picked.size) return []
  return rows.filter((row) => picked.has(row.code))
})

/**
 * 计算：按 stage 分组的方案列表。
 * 返回 ReportStageSchemeGroup[]。
 * 作用：解析 stage 与三档对比数据。
 */
const stageGroups = computed(() => buildReportStageSchemeGroups(reportData.value))

interface TopStageSection {
  stageCode: string
  title: string
  stage?: ReportStageResult
  activeTierIndexes: number[]
}

/**
 * 计算：页面顶部综合区——勾选方案涉及的阶段三档对比。
 * 返回 TopStageSection[]。
 * 作用：综合信息置顶展示。
 */
const topStageSections = computed((): TopStageSection[] => {
  const codes = selectedSchemeCodes.value
  if (!codes.length) return []
  const stageCodeSet = new Set<string>()
  for (const code of codes) {
    const scheme = schemeByCode.value.get(code)
    const stageCode =
      scheme?.stageCode?.trim() || parseReportStageCodeFromSchemeCode(code) || undefined
    if (stageCode) stageCodeSet.add(stageCode)
  }
  const sections: TopStageSection[] = []
  for (const stageCode of [...stageCodeSet].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))) {
    const group = stageGroups.value.find((g) => g.stageCode === stageCode)
    if (!group?.stage) continue
    const codesInStage = codes.filter((code) => {
      const scheme = schemeByCode.value.get(code)
      const sc =
        scheme?.stageCode?.trim() || parseReportStageCodeFromSchemeCode(code) || ''
      return sc === stageCode
    })
    sections.push({
      stageCode,
      title: group.title,
      stage: group.stage,
      activeTierIndexes: collectReportTierIndexesForCodes(reportData.value?.schemes, codesInStage),
    })
  }
  return sections
})

/**
 * @param schemeCodes 本组 scheme code
 */
const tierIndexesForGroup = (schemeCodes: string[]) =>
  collectReportTierIndexesForCodes(reportData.value?.schemes, schemeCodes)

/**
 * 列头短标题：仅方案名。
 *
 * @param schemeCode 格子 code
 */
const getSchemeShortTitle = (schemeCode: string): string => {
  const scheme = schemeByCode.value.get(schemeCode)
  return scheme?.name?.trim() || schemeCode
}

/**
 * 构建单方案页面视图（报告 API）。
 *
 * @param schemeCode 方案 code
 */
const getSchemeView = (schemeCode: string): StrikePlanSchemeView | null => {
  const scheme = schemeByCode.value.get(schemeCode)
  const task = store.activedTask
  if (!scheme || !task?.id) return null
  return buildReportSchemeView(schemeCode, scheme, task, reportData.value)
}

/**
 * 计算：将全部 scheme 视图扁平化为导出行。
 * 返回：flattenStrikePlanRowsForExport 返回的导出行数组。
 * 作用：CSV/XLS 导出按钮的数据源。
 */
const exportRows = computed(() => {
  const views = selectedSchemeCodes.value
    .map((code) => getSchemeView(code))
    .filter((view): view is StrikePlanSchemeView => view != null)
  return flattenStrikePlanRowsForExport(views)
})

/**
 * 拉取任务作战方案报告（GET /report/schemes/{taskId}）。
 *
 * @param force 保留参数以兼容刷新按钮；每次调用都会重新请求
 */
const reloadReportSchemes = async (force = false) => {
  void force
  const taskId = store.activedTask?.id
  if (!taskId) {
    reportData.value = null
    reportError.value = ''
    return
  }

  const token = ++reportLoadToken
  reportLoading.value = true
  reportError.value = ''
  try {
    const data = await getReportSchemes(taskId)
    if (token !== reportLoadToken) return
    reportData.value = data
    const codes = (data.schemes ?? [])
      .map((s) => s.code?.trim())
      .filter((c): c is string => Boolean(c))
    const sorted = [...codes].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
    if (!selectedSchemeCodes.value.length) {
      selectedSchemeCodes.value = sorted.slice(0, Math.min(3, sorted.length))
    } else {
      selectedSchemeCodes.value = selectedSchemeCodes.value.filter((c) => sorted.includes(c))
      if (!selectedSchemeCodes.value.length) {
        selectedSchemeCodes.value = sorted.slice(0, Math.min(3, sorted.length))
      }
    }
  } catch (err) {
    if (token !== reportLoadToken) return
    console.error('获取作战方案报告失败:', err)
    reportData.value = null
    reportError.value = err instanceof Error ? err.message : '获取作战方案报告失败'
    selectedSchemeCodes.value = []
  } finally {
    if (token === reportLoadToken) {
      reportLoading.value = false
    }
  }
}

/** 下载打击计划 */
const handleDownload = (format: 'csv' | 'xls') => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择战场与任务')
    return
  }
  if (!exportRows.value.length) {
    ElMessage.warning('当前方案无入选卫星可导出')
    return
  }
  const prefix = `打击计划_${store.activedTask.name || store.activedTask.id}`
  if (format === 'csv') {
    downloadStrikePlanCsv(exportRows.value, prefix)
  } else {
    downloadStrikePlanXls(exportRows.value, prefix)
  }
  ElMessage.success(format === 'csv' ? 'CSV 已开始下载' : 'XLS 已开始下载')
}

/**
 * 监听：selectedSchemeCodes。
 * 回调不返回清理函数。
 * 作用：最多勾选 3 个方案对比。
 */
watch(selectedSchemeCodes, (val) => {
  if (val.length > 3) {
    selectedSchemeCodes.value = val.slice(0, 3)
    ElMessage.warning('最多选择 3 个方案对比')
  }
})

/**
 * 监听：store.activedTask?.id。
 * 返回：回调不返回清理函数。
 * 作用：任务切换时清空报告数据并重新拉取。
 */
watch(
  () => store.activedTask?.id,
  async (taskId, prevId) => {
    if (taskId !== prevId) {
      reportData.value = null
      reportError.value = ''
      selectedSchemeCodes.value = []
    }
    if (!taskId) return
    await reloadReportSchemes(true)
  },
  { immediate: true },
)
</script>

<style lang="scss" scoped>
.strike-plan-generator {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.report-error {
  margin: 12px 20px 0;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.25);
  color: #fecaca;
  font-size: 14px;
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(79, 147, 221, 0.25);
  background: linear-gradient(180deg, rgba(12, 28, 48, 0.95) 0%, rgba(8, 20, 36, 0.98) 100%);
  flex-shrink: 0;
  flex-wrap: wrap;

  .header-center {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;

    .type-label {
      font-size: 18px;
      color: #94a3b8;
    }

    .scheme-count-badge {
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 600;
      color: #7dd3fc;
      border: 1px solid rgba(79, 147, 221, 0.35);
      background: rgba(14, 28, 48, 0.8);
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.plan-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 20px;
}

.scheme-picker {
  display: flex;
  align-items: flex-start;
  gap: 12px 16px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(10, 20, 36, 0.9);
  text-align: left;

  &__label {
    flex: 0 0 auto;
    padding-top: 2px;
    font-size: 14px;
    font-weight: 600;
    color: #94a3b8;
    white-space: nowrap;
  }

  &__group {
    flex: 1 1 auto;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 18px;
    min-width: 0;
  }

  :deep(.el-checkbox__label) {
    font-size: 14px;
    color: #e2e8f0;
    white-space: normal;
    line-height: 1.4;
    text-align: left;
  }
}

.report-comprehensive {
  margin-bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  text-align: left;

  &__stage {
    margin-top: 0;
  }
}

.plan-columns {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));

  &--single {
    grid-template-columns: minmax(0, 720px);
  }

  &--triple {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1280px) {
  .plan-columns--triple {
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  }
}

.plan-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 12px;
  border: 1px solid rgba(79, 147, 221, 0.28);
  background: rgba(10, 18, 32, 0.92);
  overflow: hidden;
}

.column-head {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(79, 147, 221, 0.2);
  background: rgba(14, 28, 48, 0.75);

  &__code {
    display: inline-block;
    margin-bottom: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: ui-monospace, monospace;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.9);
  }

  &__name {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
    color: #e2e8f0;
    word-break: break-word;
  }
}

.column-content {
  flex: 1;
  padding: 14px;
  min-width: 0;
}

.report-cross-compare {
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(167, 139, 250, 0.3);
  background: rgba(16, 12, 36, 0.85);

  text-align: left;

  &__title {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 700;
    color: #c4b5fd;
    text-align: left;
  }

  &__scroll {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid rgba(167, 139, 250, 0.15);
  }

  &__table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
    font-size: 14px;

    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(167, 139, 250, 0.12);
      text-align: center;
      vertical-align: middle;
    }

    th {
      color: #a78bfa;
      font-weight: 600;
      background: rgba(30, 20, 60, 0.9);
      position: sticky;
      top: 0;
    }

    td {
      color: #e2e8f0;
    }

    tbody tr:hover td {
      background: rgba(167, 139, 250, 0.08);
    }
  }

  &__code {
    font-family: ui-monospace, monospace;
    font-size: 13px;
    color: #94a3b8;
  }

  &__name {
    text-align: left;
    font-weight: 600;
    color: #fde68a;
  }

  &__num {
    font-variant-numeric: tabular-nums;
    color: #a5f3fc;
  }
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 280px;
  gap: 10px;
  color: #94a3b8;

  &.small {
    min-height: 120px;
    padding: 24px;
  }

  .empty-icon {
    font-size: 36px;
  }

  .empty-text {
    font-size: 18px;
  }
}
</style>
