<template>
  <div class="strike-plan-generator dark-theme" v-loading="store.zhchPlanLoading">
    <div class="plan-header">
      <div class="header-left">
        <span class="header-icon">⚔️</span>
        <span class="header-title glow-text">综合打击方案生成</span>
      </div>

      <div class="header-center">
        <span class="type-label">方案名称：</span>
        <div class="type-selector">
          <button
            v-for="item in usageTypeOptions"
            :key="item.value"
            class="type-btn"
            :class="{ active: store.selectedZhchUsageTypes.includes(item.value) }"
            @click="handleToggleUsageType(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div class="header-right">
        <el-button type="primary" size="default" :loading="store.zhchPlanLoading" @click="handleGenerate">
          <span class="btn-icon">⚡</span> 生成方案
        </el-button>
        <el-button type="warning" size="default" :loading="cacheClearing" @click="handleClearCache">
          <span class="btn-icon">🗑️</span> 清除缓存
        </el-button>
      </div>
    </div>

    <div class="plan-body">
      <div v-if="!store.activedTask" class="empty-container">
        <div class="empty-icon">📋</div>
        <div class="empty-text">请先在右上角选择战场与任务</div>
      </div>

      <div v-else-if="!hasVisiblePlans && !store.zhchPlanLoading" class="empty-container">
        <div class="empty-icon">🎯</div>
        <div class="empty-text">勾选用途类型后点击「生成方案」获取综合打击方案</div>
      </div>

      <div
        v-else
        class="plan-columns"
        :class="{ 'plan-columns--single': selectedUsageTypes.length === 1 }"
        :style="{ gridTemplateColumns: `repeat(${selectedUsageTypes.length}, minmax(0, 1fr))` }"
      >
        <div v-for="usageType in selectedUsageTypes" :key="usageType" class="plan-column">
          <div class="column-type-title">{{ getZhchUsageTypeLabel(usageType) }}</div>
          <div v-if="getPlanByType(usageType)" class="column-content">
            <ZhchPlanDetailPanel :plan="getPlanByType(usageType)!" />
          </div>
          <div v-else class="empty-container small">
            <div class="empty-text">暂无 {{ getZhchUsageTypeLabel(usageType) }} 方案数据</div>
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
import { refreshZhchPlanCache } from '@/api/electronic'
import { useLayoutStore, ZHCH_USAGE_TYPE_OPTIONS, getZhchUsageTypeLabel } from '@/store/modules/layout'
import ZhchPlanDetailPanel from './strike-plan/ZhchPlanDetailPanel.vue'

defineOptions({ name: 'StrikePlanGenerator' })

/** 卫星用途类型选项 */
interface UsageTypeOption {
  /** 展示名称 */
  label: string
  /** 传给接口的 type 参数 */
  value: string
}

const usageTypeOptions: UsageTypeOption[] = ZHCH_USAGE_TYPE_OPTIONS.map((value) => ({
  label: getZhchUsageTypeLabel(value),
  value,
}))

const store = useLayoutStore()

onMounted(() => {
  store.sanitizeZhchUsageTypes()
})

/** 清除服务端缓存请求中 */
const cacheClearing = ref(false)

/** 当前勾选的用途类型 */
const selectedUsageTypes = computed(() =>
  store.selectedZhchUsageTypes.filter((type) =>
    (ZHCH_USAGE_TYPE_OPTIONS as readonly string[]).includes(type)
  )
)

/** 是否已有可展示的方案 */
const hasVisiblePlans = computed(() =>
  selectedUsageTypes.value.some((type) => !!store.zhchPlanMap[type])
)

/**
 * 根据用途类型读取 store 中的方案
 * @param type 用途类型
 */
const getPlanByType = (type: string): ZhchPlanResp | null => store.zhchPlanMap[type] ?? null

/**
 * 切换用途类型多选
 * @param type 用途类型
 */
const handleToggleUsageType = (type: string) => {
  const before = store.selectedZhchUsageTypes.length
  store.toggleZhchUsageType(type)
  if (before === 1 && store.selectedZhchUsageTypes.length === 1) {
    ElMessage.warning('至少选择一种用途类型')
  }
}

/** 生成方案 */
const handleGenerate = async () => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择战场与任务')
    return
  }
  store.sanitizeZhchUsageTypes()
  const ok = await store.fetchZhchPlans(selectedUsageTypes.value, true)
  if (!ok) {
    ElMessage.warning('获取打击方案失败，请稍后重试')
    return
  }
  if (selectedUsageTypes.value.includes(store.activeZhchUsageType)) {
    await store.fetchMatrixForCurrentScope(true)
  }
}

/** 清除打击方案缓存 */
const handleClearCache = async () => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    ElMessage.warning('请先选择战场与任务')
    return
  }

  cacheClearing.value = true
  try {
    const res = await refreshZhchPlanCache(taskId)
    if (res.code === 200) {
      store.clearZhchPlans()
      ElMessage.success('打击方案缓存已清除')
    } else {
      ElMessage.warning(res.msg || '清除缓存失败，请稍后重试')
    }
  } catch {
    ElMessage.error('清除缓存失败，请稍后重试')
  } finally {
    cacheClearing.value = false
  }
}

/** 任务切换后清空缓存 */
watch(
  () => store.activedTask?.id,
  (taskId, prevId) => {
    if (taskId !== prevId) {
      store.clearZhchPlans()
    }
  }
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

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-title {
      font-size: 18px;
      font-weight: 700;
    }
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .type-label {
      font-size: 16px;
      color: #94a3b8;
    }

    .type-selector {
      display: flex;
      gap: 6px;

      .type-btn {
        padding: 6px 16px;
        font-size: 14px;
        color: #8eb3d6;
        background: rgba(16, 36, 62, 0.7);
        border: 1px solid rgba(79, 147, 221, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          color: #fff;
          border-color: rgba(0, 225, 255, 0.5);
        }

        &.active {
          color: #fff;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(79, 147, 221, 0.85) 0%, rgba(0, 180, 216, 0.9) 100%);
          border-color: #00e1ff;
          box-shadow: 0 0 10px rgba(0, 225, 255, 0.35);
        }
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

.glow-text {
  color: #eaf3ff;
  text-shadow: 0 0 8px rgba(64, 242, 255, 0.35);
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
}

.plan-column {
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.3);
  background: rgba(10, 20, 36, 0.9);
  min-width: 0;
  max-width: 100%;
  overflow: hidden;

  .column-type-title {
    padding: 14px;
    font-size: 22px;
    font-weight: 900;
    text-align: center;
    color: #40f2ff;
    letter-spacing: 2px;
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
    font-size: 16px;
  }
}
</style>
