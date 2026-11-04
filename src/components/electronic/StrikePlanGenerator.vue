<template>
  <div class="strike-plan-generator dark-theme" v-loading="store.zhchPlanLoading">
    <div class="plan-header">
      <div class="header-center">
        <span class="type-label">方案名称：</span>
        <el-checkbox-group v-model="selectedPlanTypes" class="plan-checkbox-group">
          <el-checkbox v-for="item in usageTypeOptions" :key="item.value" :label="item.value">
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
      </div>

      <div class="header-right">
        <el-dropdown trigger="click" @command="handleDownload">
          <el-button type="primary" size="default">
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

      <div v-else-if="!selectedPlanTypes.length" class="empty-container">
        <div class="empty-icon">🎯</div>
        <div class="empty-text">请勾选 1～3 个方案名称进行对比展示</div>
      </div>

      <div v-else class="plan-columns" :class="{
        'plan-columns--single': selectedPlanTypes.length === 1,
        'plan-columns--compare': selectedPlanTypes.length > 1,
      }" :style="{ gridTemplateColumns: `repeat(${selectedPlanTypes.length}, minmax(0, 1fr))` }">
        <div v-for="usageType in selectedPlanTypes" :key="usageType" class="plan-column">
          <div class="column-type-title">{{ getPlanColumnTitle(usageType) }}</div>
          <div v-if="getSchemeView(usageType)" class="column-content">
            <StrikePlanSchemePanel :view="getSchemeView(usageType)!" :align-blocks="selectedPlanTypes.length > 1" />
          </div>
          <div v-else class="empty-container small">
            <div class="empty-text">暂无 {{ getPlanColumnTitle(usageType) }} 方案数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ZhchPlanResp } from '@/api/electronic'
import {
  buildStrikePlanSchemeView,
  flattenStrikePlanRowsForExport,
  type StrikePlanSchemeView,
} from '@/utils/buildStrikePlanSchemeView'
import { downloadStrikePlanCsv, downloadStrikePlanXls } from '@/utils/exportStrikePlanTable'
import { buildStrikePlanDisplayName } from '@/config/combatScenarioOptions'
import {
  useLayoutStore,
  ZHCH_USAGE_TYPE_OPTIONS,
  getZhchUsageTypeLabel,
} from '@/store/modules/layout'
import StrikePlanSchemePanel from './strike-plan/StrikePlanSchemePanel.vue'
import { buildMockZhchPlanResp, isZhchPlanRespEmpty } from '@/utils/mockZhchPlanResp'

defineOptions({ name: 'StrikePlanGenerator' })

interface UsageTypeOption {
  label: string
  value: string
}

const store = useLayoutStore()

/**
 * 顶栏/列标题：作战阶段-作战预期；多方案并存时附加用途类型以区分。
 *
 * @param usageType 用途类型键
 */
const getPlanColumnTitle = (usageType: string): string => {
  const taskId = store.activedTask?.id
  if (!taskId) return getZhchUsageTypeLabel(usageType)
  const base = buildStrikePlanDisplayName(taskId)
  return `${base}（${getZhchUsageTypeLabel(usageType)}）`
}

const usageTypeOptions = computed((): UsageTypeOption[] =>
  ZHCH_USAGE_TYPE_OPTIONS.map((value) => ({
    label: getPlanColumnTitle(value),
    value,
  })),
)

/** 勾选对比的方案（最多 3 个） */
const selectedPlanTypes = ref<string[]>([])

onMounted(() => {
  store.sanitizeZhchUsageTypes()
})

const priorityCountries = computed(() => store.activedTask?.enemyCountryShow ?? [])

/**
 * 读取展示用方案：优先接口缓存，缺失或空数据时使用演示 Mock。
 *
 * @param type 用途类型
 */
const getPlanByType = (type: string): ZhchPlanResp | null => {
  const taskId = store.activedTask?.id
  if (!taskId) return null
  const cached = store.zhchPlanMap[type]
  if (cached && !isZhchPlanRespEmpty(cached)) {
    return cached
  }
  return buildMockZhchPlanResp(type, taskId, priorityCountries.value)
}

/**
 * 构建单方案页面视图。
 *
 * @param usageType 用途类型
 */
const getSchemeView = (usageType: string): StrikePlanSchemeView | null => {
  const plan = getPlanByType(usageType)
  const taskId = store.activedTask?.id
  if (!plan || !taskId) return null
  return buildStrikePlanSchemeView(
    usageType,
    plan,
    taskId,
    store.c2ResourceSatelliteRows,
    priorityCountries.value,
  )
}

/** 当前勾选方案的可导出打击行 */
const exportRows = computed(() => {
  const views = selectedPlanTypes.value
    .map((type) => getSchemeView(type))
    .filter((view): view is StrikePlanSchemeView => view != null)
  return flattenStrikePlanRowsForExport(views)
})

/**
 * 拉取全部用途类型方案（不按卫星类型过滤）。
 *
 * @param force 是否强制刷新
 */
const reloadAllPlans = async (force = false) => {
  if (!store.activedTask?.id) return
  store.sanitizeZhchUsageTypes()
  await store.fetchZhchPlans([...ZHCH_USAGE_TYPE_OPTIONS], force, null)
}

/**
 * 初始化默认勾选（优先已有数据的方案，最多 3 个）。
 */
const syncDefaultSelectedPlans = () => {
  selectedPlanTypes.value = [...ZHCH_USAGE_TYPE_OPTIONS]
}

/** 下载打击计划 */
const handleDownload = (format: 'csv' | 'xls') => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择战场与任务')
    return
  }
  if (!exportRows.value.length) {
    ElMessage.warning('当前勾选方案无打击计划可导出')
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

watch(selectedPlanTypes, (val) => {
  if (val.length > 3) {
    selectedPlanTypes.value = val.slice(0, 3)
    ElMessage.warning('最多选择 3 个方案对比')
  }
})

watch(
  () => store.activedTask?.id,
  async (taskId, prevId) => {
    if (taskId !== prevId) {
      store.clearZhchPlans()
      selectedPlanTypes.value = []
    }
    if (!taskId) return
    await reloadAllPlans(true)
    syncDefaultSelectedPlans()
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
