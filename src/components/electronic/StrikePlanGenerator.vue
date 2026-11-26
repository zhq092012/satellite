<template>
  <div class="strike-plan-generator dark-theme" v-loading="reportLoading">
    <div class="plan-header">
      <div class="header-center">
        <span class="type-label">作战方案报告</span>
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

        <!-- 报告级：任务名、生成时间 -->
        <ReportGenerateOverview :report="reportData" />

        <div v-if="!selectedStrikePlanCodes.length" class="empty-container small">
          <div class="empty-text">请勾选 1～3 个方案查看明细</div>
        </div>

        <div
          v-else
          class="plan-columns strike-plan-columns"
          :class="{
            'plan-columns--single': selectedStrikePlanCodes.length === 1,
            'plan-columns--triple': selectedStrikePlanCodes.length === 3,
          }"
        >
          <article
            v-for="schemeCode in selectedStrikePlanCodes"
            :key="`strike-${schemeCode}`"
            class="plan-column plan-column--strike"
          >
            <div class="column-content">
              <ReportStrikePlanPanel :plan="getStrikePlan(schemeCode)!" />
            </div>
          </article>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getReportSchemes } from '@/api/report/report'
import type { ReportGenerateResp, StrikePlan } from '@/types/report/report'
import {
  buildStrikePlanMapByCode,
  filterSchemeCodesWithStrikePlan,
} from '@/utils/strikePlanDisplay'
import { downloadStrikePlanCsv, downloadStrikePlanXls, type StrikePlanStrikeRow } from '@/utils/exportStrikePlanTable'
import { listReportSchemeCodes } from '@/utils/strikePlanReportAdapter'
import { useLayoutStore } from '@/store/modules/layout'
import ReportGenerateOverview from './strike-plan/ReportGenerateOverview.vue'
import ReportStrikePlanPanel from './strike-plan/ReportStrikePlanPanel.vue'

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
 * 计算：`strikePlans` 按 code 索引（与 `schemes` 对齐）。
 * 返回 Map。
 * 作用：仅展示与勾选 scheme 同 code 的打击方案。
 */
const strikePlanByCode = computed(() =>
  buildStrikePlanMapByCode(reportData.value?.strikePlans),
)

/**
 * 计算：当前勾选且存在打击方案的 code 列表。
 * 返回 string[]（顺序与勾选一致）。
 * 作用：打击方案区列渲染。
 */
const selectedStrikePlanCodes = computed(() =>
  filterSchemeCodesWithStrikePlan(selectedSchemeCodes.value, strikePlanByCode.value),
)

/**
 * 计算：全部扁平 scheme 的 code 列表（稳定排序）。
 * 返回 string[]。
 * 作用：页面中间区展示全部格子。
 */
const allSchemeCodes = computed((): string[] => listReportSchemeCodes(reportData.value))

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
    const plan = strikePlanByCode.value.get(code)
    const name = plan?.name?.trim() || code
    return { value: code, label: `${code} · ${name}` }
  }),
)

/**
 * 取与 scheme 同 code 的打击方案。
 *
 * @param schemeCode 方案 code
 */
const getStrikePlan = (schemeCode: string): StrikePlan | null => {
  const code = schemeCode.trim()
  return strikePlanByCode.value.get(code) ?? null
}

/**
 * 计算：勾选方案的打击清单导出行。
 * 返回 StrikePlanStrikeRow[]。
 * 作用：CSV/XLS 导出。
 */
const exportRows = computed((): StrikePlanStrikeRow[] => {
  const rows: StrikePlanStrikeRow[] = []
  for (const code of selectedSchemeCodes.value) {
    const plan = strikePlanByCode.value.get(code)
    if (!plan) continue
    for (const sat of plan.satellites ?? []) {
      rows.push({
        country: sat.country?.trim() ?? '',
        satelliteName: sat.name?.trim() ?? sat.noradId?.trim() ?? '',
        satelliteType: sat.system?.trim() ?? '',
        series: sat.series?.trim() ?? '',
        weaponName: '',
        weaponType: '',
        attackWindow: '',
      })
    }
  }
  return rows
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
    const sorted = listReportSchemeCodes(data)
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
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.strike-plan-generator {
  font-size: battleUi.$battle-ui-font-base;
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
  border: 1px solid rgba(253, 230, 138, 0.45);
  background: rgba(40, 36, 18, 0.55);
  color: #fde68a;
  font-size: battleUi.$battle-ui-font-base;
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
      font-size: battleUi.$battle-ui-font-emphasis;
      color: #7dd3fc;
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
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    color: #7dd3fc;
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
    font-size: battleUi.$battle-ui-font-base;
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

.strike-plan-detail-section {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px dashed rgba(79, 147, 221, 0.35);
  text-align: left;

  &__title {
    margin: 0 0 6px;
    font-size: battleUi.$battle-ui-font-emphasis;
    font-weight: 700;
    color: #7dd3fc;
  }

  &__hint {
    margin: 0 0 14px;
    font-size: battleUi.$battle-ui-font-base;
    color: #94a3b8;

    code {
      font-size: battleUi.$battle-ui-font-base;
      color: #7dd3fc;
    }
  }
}

.plan-column--strike {
  border-color: rgba(79, 147, 221, 0.28);
}

.column-head--strike {
  background: rgba(14, 28, 48, 0.75);
  border-bottom-color: rgba(79, 147, 221, 0.2);
}

.strike-plan-columns {
  margin-top: 0;
}

.plan-columns {
  display: grid;
  gap: 16px;
  width: 100%;
  min-width: 0;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));

  &--single {
    grid-template-columns: minmax(0, 1fr);
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
    font-size: battleUi.$battle-ui-font-base;
    font-family: ui-monospace, monospace;
    color: #94a3b8;
    background: rgba(15, 23, 42, 0.9);
  }

  &__name {
    margin: 0;
    font-size: battleUi.$battle-ui-font-emphasis;
    font-weight: 700;
    line-height: 1.4;
    color: #7dd3fc;
    word-break: break-word;
  }
}

.column-content {
  flex: 1;
  padding: 14px 14px 16px;
  min-width: 0;
  text-align: left;
}

.plan-column--strike .column-content {
  padding-top: 12px;
}

.report-cross-compare {
  margin-top: 0;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.3);
  background: rgba(10, 20, 36, 0.85);
  width: 100%;
  box-sizing: border-box;
  text-align: left;

  &--single &__table {
    min-width: 0;
  }

  &--single th,
  &--single td {
    width: auto;
  }

  &--single td:not(.report-cross-compare__name) {
    white-space: nowrap;
  }

  &__title {
    margin: 0 0 12px;
    font-size: battleUi.$battle-ui-font-emphasis;
    font-weight: 700;
    color: #7dd3fc;
    text-align: left;
  }

  &__scroll {
    overflow-x: auto;
    border-radius: 8px;
    border: 1px solid rgba(79, 147, 221, 0.2);
  }

  &__table {
    width: 100%;
    min-width: 720px;
    border-collapse: collapse;
    font-size: battleUi.$battle-ui-font-base;

    th,
    td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(79, 147, 221, 0.15);
      text-align: center;
      vertical-align: middle;
    }

    th {
      font-size: battleUi.$battle-ui-font-emphasis;
      color: #7dd3fc;
      font-weight: 600;
      background: rgba(12, 28, 48, 0.95);
      position: sticky;
      top: 0;
    }

    td {
      color: #e2e8f0;
    }

    tbody tr:hover td {
      background: rgba(56, 189, 248, 0.08);
    }
  }

  &__code {
    font-family: ui-monospace, monospace;
    font-size: battleUi.$battle-ui-font-base;
    color: #94a3b8;
  }

  &__name {
    text-align: left;
    font-weight: 600;
    color: #7dd3fc;
  }

  &__num {
    font-variant-numeric: tabular-nums;
    color: #fde68a;
    font-weight: 600;
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
    font-size: battleUi.$battle-ui-font-emphasis;
  }
}

.strike-plan-generator {
  :deep(.el-button) {
    font-size: battleUi.$battle-ui-font-base;
  }
}
</style>
