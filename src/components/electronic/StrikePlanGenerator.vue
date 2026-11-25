<template>
  <div class="strike-plan-generator dark-theme" v-loading="reportLoading">
    <div class="plan-header">
      <div class="header-center">
        <span class="type-label">作战方案：</span>
        <el-checkbox-group v-model="selectedSchemeCodes" class="plan-checkbox-group">
          <el-checkbox v-for="item in schemeOptions" :key="item.value" :label="item.value">
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
        <el-button v-if="store.activedTask?.id" type="primary" link @click="reloadReportSchemes(true)">
          刷新方案
        </el-button>
      </div>

      <div class="header-right">
        <el-dropdown trigger="click" @command="handleDownload">
          <el-button type="primary" size="default">
            导入选星清单
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

      <div v-else-if="!schemeOptions.length && !reportLoading" class="empty-container">
        <div class="empty-icon">📄</div>
        <div class="empty-text">当前任务暂无作战方案，请点击刷新或稍后重试</div>
      </div>

      <div v-else-if="!selectedSchemeCodes.length" class="empty-container">
        <div class="empty-icon">🎯</div>
        <div class="empty-text">请勾选 1～3 个作战方案进行对比展示</div>
      </div>

      <div v-else class="plan-columns" :class="{
        'plan-columns--single': selectedSchemeCodes.length === 1,
        'plan-columns--compare': selectedSchemeCodes.length > 1,
      }" :style="{ gridTemplateColumns: `repeat(${selectedSchemeCodes.length}, minmax(0, 1fr))` }">
        <div v-for="schemeCode in selectedSchemeCodes" :key="schemeCode" class="plan-column">
          <div class="column-type-title">{{ getSchemeColumnTitle(schemeCode) }}</div>
          <div v-if="getSchemeView(schemeCode)" class="column-content">
            <StrikePlanSchemePanel :view="getSchemeView(schemeCode)!" :align-blocks="selectedSchemeCodes.length > 1" />
          </div>
          <div v-else class="empty-container small">
            <div class="empty-text">暂无 {{ getSchemeColumnTitle(schemeCode) }} 数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getReportSchemes } from '@/api/report/report'
import type { ReportGenerateResp, SchemeResult } from '@/types/report/report'
import {
  flattenStrikePlanRowsForExport,
  type StrikePlanSchemeView,
} from '@/utils/buildStrikePlanSchemeView'
import { buildReportSchemeView } from '@/utils/buildReportSchemeView'
import { downloadStrikePlanCsv, downloadStrikePlanXls } from '@/utils/exportStrikePlanTable'
import { buildStrikePlanDisplayNameFromTask } from '@/utils/taskEntity'
import { useLayoutStore } from '@/store/modules/layout'
import StrikePlanSchemePanel from './strike-plan/StrikePlanSchemePanel.vue'

defineOptions({ name: 'StrikePlanGenerator' })

interface SchemeOption {
  label: string
  value: string
}

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
 * 计算：顶栏复选框选项（报告 schemes）。
 * 返回 SchemeOption[]。
 * 作用：用户选择对比的方案列。
 */
const schemeOptions = computed((): SchemeOption[] => {
  const task = store.activedTask
  const baseTitle = task?.id ? buildStrikePlanDisplayNameFromTask(task) : '作战方案'
  return (reportData.value?.schemes ?? [])
    .map((scheme) => {
      const code = scheme.code?.trim()
      if (!code) return null
      const name = scheme.name?.trim() || code
      return {
        value: code,
        label: `${baseTitle} · ${name}`,
      }
    })
    .filter((item): item is SchemeOption => item != null)
})

/**
 * 列标题：任务显示名 + 方案名称。
 *
 * @param schemeCode 方案 code
 */
const getSchemeColumnTitle = (schemeCode: string): string => {
  const scheme = schemeByCode.value.get(schemeCode)
  const task = store.activedTask
  if (!task?.id) return scheme?.name?.trim() || schemeCode
  const base = buildStrikePlanDisplayNameFromTask(task)
  const name = scheme?.name?.trim() || schemeCode
  return `${base}（${name}）`
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
  return buildReportSchemeView(schemeCode, scheme, task)
}

/**
 * 计算：将 selectedSchemeCodes 对应视图扁平化为导出行。
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
    selectedSchemeCodes.value = []
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
    if (!selectedSchemeCodes.value.length) {
      selectedSchemeCodes.value = codes.slice(0, Math.min(3, codes.length))
    } else {
      selectedSchemeCodes.value = selectedSchemeCodes.value.filter((c) => codes.includes(c))
    }
    if (!codes.length) {
      selectedSchemeCodes.value = []
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

/**
 * 有新方案时默认勾选前 3 个。
 */
const syncDefaultSelectedSchemes = () => {
  const codes = schemeOptions.value.map((item) => item.value)
  selectedSchemeCodes.value = codes.slice(0, Math.min(3, codes.length))
}

/** 下载打击计划 */
const handleDownload = (format: 'csv' | 'xls') => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择战场与任务')
    return
  }
  if (!exportRows.value.length) {
    ElMessage.warning('当前勾选方案无入选卫星可导出')
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
 * 返回：回调不返回清理函数。
 * 作用：勾选超过 3 个方案时截断列表并提示用户上限。
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
      selectedSchemeCodes.value = []
      reportError.value = ''
    }
    if (!taskId) return
    await reloadReportSchemes(true)
    if (!selectedSchemeCodes.value.length) {
      syncDefaultSelectedSchemes()
    }
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

    .plan-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;

      :deep(.el-checkbox__label) {
        color: #cbd5e1;
        font-size: 18px;
      }
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

.plan-columns {
  display: grid;
  gap: 14px;
  align-items: start;
  width: 100%;
  max-width: 100%;
  min-width: 0;

  &--single {
    grid-template-columns: 1fr !important;
  }

  &--compare {
    align-items: stretch;

    .plan-column {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .column-type-title {
      flex-shrink: 0;
      min-height: 76px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
    }

    .column-content {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
  }
}

.plan-column {
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.3);
  background: rgba(10, 20, 36, 0.9);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;

  .column-type-title {
    padding: 14px 16px;
    font-size: 22px;
    font-weight: 900;
    text-align: left;
    color: #40f2ff;
    letter-spacing: 1px;
    text-shadow: 0 0 12px rgba(64, 242, 255, 0.5);
    border-bottom: 1px solid rgba(79, 147, 221, 0.25);
    background: rgba(14, 28, 48, 0.8);
  }

  .column-content {
    padding: 16px;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }
}

.plan-columns--compare .column-content {
  padding-bottom: 8px;
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
