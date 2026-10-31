<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">分析结果</span>
      </div>
    </div>

    <div v-if="analysisLoading" class="empty-sat-box">
      <span class="task-loading-spinner" aria-hidden="true" />
      <p class="empty-text">正在加载分析结果...</p>
    </div>

    <div v-else-if="!algorithmComplete || !analysisData" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无分析结果</p>
      <p class="empty-sub">请等待当前任务算法计算完成</p>
    </div>

    <div v-else class="analysis-scroll">
      <!-- 卫星打击推荐列表（targetsThreatLevel） -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">卫星打击推荐列表</span>
          <span class="section-count">
            展示 {{ displayedSatelliteStrikeRecommendRows.length }} / 共 {{ strikeRecommendDisplayRows.length }} 颗 · 按综合威胁度降序
          </span>
        </div>

        <el-table v-loading="strikeRecommendLoading" :data="displayedSatelliteStrikeRecommendRows" size="small"
          row-key="norad"
          class="sat-metric-table strike-recommend-table" empty-text="暂无推荐数据">
          <el-table-column label="序号" width="48" align="center" class-name="strike-recommend-index-col">
            <template #default="{ $index }">
              <span class="strike-recommend-index">{{ $index + 1 }}</span>
            </template>
          </el-table-column>
          <el-table-column label="卫星名称" min-width="100" show-overflow-tooltip class-name="strike-recommend-name-col">
            <template #default="{ row }">
              <button type="button" class="sat-name-wrap strike-recommend-name"
                :class="{ 'sat-name-wrap--selected': selectedNorad === row.norad }"
                @click="emit('select-satellite', row.norad)">
                {{ row.name }}
              </button>
            </template>
          </el-table-column>
          <el-table-column label="综合威胁度" width="88" align="right" class-name="strike-recommend-metric-col">
            <template #default="{ row }">
              <span class="strike-recommend-score strike-recommend-score--composite">{{
                formatStrikeRecommendThreat(row.compositeThreat) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="静态威胁度" width="88" align="right" class-name="strike-recommend-metric-col">
            <template #default="{ row }">
              <button type="button" class="strike-recommend-score strike-recommend-score--link"
                @click.stop="handleStaticThreatClick(row)">
                {{ formatStrikeRecommendThreat(row.staticThreat) }}
              </button>
            </template>
          </el-table-column>
          <el-table-column label="动态威胁度" width="88" align="right" class-name="strike-recommend-metric-col">
            <template #default="{ row }">
              <button type="button" class="strike-recommend-score strike-recommend-score--link"
                @click.stop="handleDynamicThreatClick(row)">
                {{ formatStrikeRecommendThreat(row.dynamicThreat) }}
              </button>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="strikeRecommendDisplayRows.length > SATELLITE_TABLE_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllSatelliteStrikeRecommend" type="button" class="table-more-btn"
            @click="showAllSatelliteStrikeRecommend = true">
            查看更多（{{ strikeRecommendDisplayRows.length - SATELLITE_TABLE_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllSatelliteStrikeRecommend = false">
            收起
          </button>
        </div>
      </section>

    </div>
  </aside>

  <BattleSatelliteLinkDelayDialog v-model="linkDelayDialogVisible" :matrix="chartMatrix" :norad="chartNorad"
    :task-end="taskEndDate" :subtitle="chartDialogSubtitle" :threat-metrics="linkDelayThreatMetrics"
    dialog-title="动态威胁度" />

  <SatelliteThreatInfoDialog v-model="threatInfoDialogVisible" :loading="threatInfoLoading"
    :threat-info="threatInfoData" :subtitle="threatInfoSubtitle" :empty-hint="threatInfoEmptyHint" />
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧面板。
 * 算法完成后仅展示卫星打击推荐列表（综合 / 静态 / 动态威胁度）。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getSatelliteThreatInfo, type MatrixResult, type SatelliteThreatInfo } from '@/api/electronic'
import { getTargetsThreatLevel, type SatelliteAnalysisData } from '@/api/task/task'
import BattleSatelliteLinkDelayDialog from '@/components/BattleSituation/BattleSatelliteLinkDelayDialog.vue'
import type { LinkDelayThreatMetrics } from '@/components/BattleSituation/BattleSatelliteLinkDelayDialog.vue'
import SatelliteThreatInfoDialog from '@/components/BattleSituation/SatelliteThreatInfoDialog.vue'
import { useLayoutStore } from '@/store/modules/layout'
import { formatSatelliteThreat, SATELLITE_TABLE_TOP_COUNT } from '@/utils/buildSatelliteAnalysisTable'
import { findLevelSeriesEntityForNorad } from '@/utils/buildSatelliteDeductionTimeline'
import { levelSeriesEntityToMatrix } from '@/utils/seriesLinkTimeline'
import {
  mapTargetThreatLevelListToStrikeRecommend,
  sortStrikeRecommendByCompositeThreat,
  type SatelliteStrikeRecommendItem,
} from '@/utils/mockSatelliteStrikeRecommendations'

/** 全局布局 Store（当前任务 ID） */
const store = useLayoutStore()

const props = defineProps<{
  /** 任务算法分析结果；就绪后才拉取打击推荐 */
  analysisData: SatelliteAnalysisData | null
  /** 当前任务算法是否已完成 */
  algorithmComplete: boolean
  /** 分析结果是否正在加载 */
  analysisLoading?: boolean
  /** 当前选中的卫星 NORAD，用于推荐列表高亮 */
  selectedNorad?: number | null
}>()

/** 选中推荐卫星时通知父组件定位地球 */
const emit = defineEmits<{
  (e: 'select-satellite', norad: number): void
}>()

/** 卫星打击推荐列表（接口原始行，按任务加载） */
const satelliteStrikeRecommendRows = ref<SatelliteStrikeRecommendItem[]>([])

/** 卫星打击推荐列表加载中 */
const strikeRecommendLoading = ref(false)

/** 动态威胁度弹窗（复用链路时延的三层链路图）是否可见 */
const linkDelayDialogVisible = ref(false)

/** 静态威胁度算法参数弹窗是否可见 */
const threatInfoDialogVisible = ref(false)

/** 威胁度算法参数是否正在加载 */
const threatInfoLoading = ref(false)

/** 威胁度算法参数 */
const threatInfoData = ref<SatelliteThreatInfo | null>(null)

/** 威胁度弹窗副标题 */
const threatInfoSubtitle = ref('')

/** 威胁度弹窗无数据提示 */
const threatInfoEmptyHint = ref('')

/** 并发请求序号：仅最新一次威胁度参数请求可写回弹窗 */
let threatInfoLoadToken = 0

/** 弹窗绘制链路使用的系列矩阵 */
const chartMatrix = ref<MatrixResult | null>(null)

/** 弹窗聚焦的卫星 NORAD */
const chartNorad = ref<number | null>(null)

/** 弹窗副标题 */
const chartDialogSubtitle = ref('')

/** 弹窗顶部指标，取自已加载的 getTargetsThreatLevel 行 */
const linkDelayThreatMetrics = ref<LinkDelayThreatMetrics | null>(null)

/** 当前任务结束时间，供链路过站计算 */
const taskEndDate = computed(() => store.activeTask?.endDate ?? '')

/** 并发请求序号：仅最新一次 `getTargetsThreatLevel` 可写回列表 */
let strikeRecommendLoadToken = 0

/** 已成功加载过的任务 ID（同一任务、分析数据未清空时不重复请求） */
let strikeRecommendLoadedTaskId: number | null = null

/**
 * 拉取任务下卫星打击推荐（综合/静态/动态威胁度）。
 *
 * @param taskId 任务 ID
 * @param force 是否忽略「已加载」缓存（任务重算后由 watch 清空缓存再拉取）
 */
const loadSatelliteStrikeRecommendations = async (taskId: number, force = false) => {
  if (!force && strikeRecommendLoadedTaskId === taskId) return
  const token = ++strikeRecommendLoadToken
  strikeRecommendLoading.value = true
  try {
    const res = await getTargetsThreatLevel({ taskId: String(taskId) })
    if (token !== strikeRecommendLoadToken) return
    if (res.code !== 200) {
      satelliteStrikeRecommendRows.value = []
      strikeRecommendLoadedTaskId = null
      return
    }
    satelliteStrikeRecommendRows.value = mapTargetThreatLevelListToStrikeRecommend(res.data)
    strikeRecommendLoadedTaskId = taskId
  } catch (error) {
    if (token !== strikeRecommendLoadToken) return
    console.error('获取卫星打击推荐列表失败:', error)
    satelliteStrikeRecommendRows.value = []
    strikeRecommendLoadedTaskId = null
  } finally {
    if (token === strikeRecommendLoadToken) {
      strikeRecommendLoading.value = false
    }
  }
}

/**
 * 卫星打击推荐列表展示行（综合威胁度降序；接口未返回时由 sort 保持空表）。
 */
const strikeRecommendDisplayRows = computed((): SatelliteStrikeRecommendItem[] =>
  sortStrikeRecommendByCompositeThreat(satelliteStrikeRecommendRows.value)
)

/** 推荐列表威胁度数值格式化 */
const formatStrikeRecommendThreat = formatSatelliteThreat

/**
 * 从接口列表中取出与 NORAD 匹配的威胁度参数。
 *
 * @param list 接口返回列表
 * @param norad 目标 NORAD
 * @returns 匹配项；列表为空时返回 null。未命中目标 NORAD 时取首项（接口按 norad 查询，列表通常只有该星）
 */
const resolveThreatInfoFromResponse = (
  list: SatelliteThreatInfo[] | null | undefined,
  norad: number
): SatelliteThreatInfo | null => {
  if (!list?.length) return null
  return list.find((item) => item.satelliteBaseModelResp?.norad === norad) ?? list[0] ?? null
}

/**
 * 点击静态威胁度，打开威胁度算法参数弹窗并拉取 `getSatelliteThreatInfo`。
 * 卫星类型取该星所在系列实体的 `sysType`，缺失时不请求。
 *
 * @param row 当前推荐行
 */
const handleStaticThreatClick = async (row: SatelliteStrikeRecommendItem) => {
  const taskId = store.activeTask?.id
  if (!taskId) {
    ElMessage.warning('请先选择任务')
    return
  }
  const entity = props.analysisData
    ? findLevelSeriesEntityForNorad(props.analysisData, row.norad)
    : null
  const sysType = entity?.sysType.trim()
  if (!entity || !sysType) {
    ElMessage.warning('缺少卫星类型，无法查询威胁度算法参数')
    return
  }

  const token = ++threatInfoLoadToken
  threatInfoDialogVisible.value = true
  threatInfoLoading.value = true
  threatInfoData.value = null
  threatInfoEmptyHint.value = ''
  threatInfoSubtitle.value = `${row.name}${entity.series ? ` · 系列：${entity.series}` : ''} · 类型：${sysType}`

  try {
    const res = await getSatelliteThreatInfo({
      norad: row.norad,
      sysType,
      taskId,
    })
    if (token !== threatInfoLoadToken) return
    if (res.code !== 200) {
      threatInfoEmptyHint.value = res.msg || '未查询到威胁度算法参数'
      return
    }
    const info = resolveThreatInfoFromResponse(res.data, row.norad)
    threatInfoData.value = info
    if (!info) {
      threatInfoEmptyHint.value = '未查询到威胁度算法参数'
    }
  } catch (error) {
    if (token !== threatInfoLoadToken) return
    console.error('获取卫星威胁度算法参数失败:', error)
    threatInfoEmptyHint.value = '获取威胁度算法参数失败'
  } finally {
    if (token === threatInfoLoadToken) {
      threatInfoLoading.value = false
    }
  }
}

/**
 * 点击动态威胁度，打开该星的指标表和三层链路图。
 * 指标使用列表已拉取的 `getTargetsThreatLevel` 行，链路矩阵取该星所在系列。
 *
 * @param row 当前推荐行
 */
const handleDynamicThreatClick = (row: SatelliteStrikeRecommendItem) => {
  if (!props.analysisData) {
    ElMessage.warning('请等待任务算法分析完成')
    return
  }
  const entity = findLevelSeriesEntityForNorad(props.analysisData, row.norad)
  chartMatrix.value = entity ? levelSeriesEntityToMatrix(entity) : null
  chartNorad.value = row.norad
  chartDialogSubtitle.value = row.name
  linkDelayThreatMetrics.value = {
    name: row.name,
    dynamicThreat: row.dynamicThreat,
    linkClosedLoopTime: row.linkClosedLoopTime,
    coverPercent: row.coverPercent,
  }
  linkDelayDialogVisible.value = true
}

/** 是否展示全部卫星打击推荐（默认前 10 条） */
const showAllSatelliteStrikeRecommend = ref(false)

/** 当前表格展示的卫星打击推荐行 */
const displayedSatelliteStrikeRecommendRows = computed(() => {
  if (showAllSatelliteStrikeRecommend.value) return strikeRecommendDisplayRows.value
  return strikeRecommendDisplayRows.value.slice(0, SATELLITE_TABLE_TOP_COUNT)
})

/** 任务分析数据变化时收起「查看更多」 */
watch(
  () => props.analysisData,
  () => {
    showAllSatelliteStrikeRecommend.value = false
  }
)

/**
 * 算法完成且 getTaskMatrix 分析数据就绪后拉取推荐列表。
 * 不再监听 analysisData 引用本身，避免刷新时 matrix 多次赋值触发重复请求。
 */
watch(
  () => {
    const taskId = store.activeTask?.id
    if (!taskId || !props.algorithmComplete || !props.analysisData) return null
    return taskId
  },
  (taskId) => {
    if (taskId == null) {
      strikeRecommendLoadToken += 1
      strikeRecommendLoadedTaskId = null
      satelliteStrikeRecommendRows.value = []
      strikeRecommendLoading.value = false
      linkDelayDialogVisible.value = false
      threatInfoDialogVisible.value = false
      return
    }
    void loadSatelliteStrikeRecommendations(taskId)
  },
  { immediate: true }
)

</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: var(--swatch-rgba-8-15-26-0_88);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  border-radius: 0;
  backdrop-filter: blur(8px);
  color: var(--text-color-bright);
  overflow: hidden;

  &--right {
    border-right: none;
    border-top: none;
    border-bottom: none;
  }
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: var(--font-size-subtitle);
    font-weight: var(--font-weight-bold);
  }

  .glow-text-cyan {
    color: var(--accent-cyan-hover);
    text-shadow: 0 0 8px var(--swatch-rgba-64-242-255-0_4);
  }
}

.analysis-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(var(--accent-cyan-rgb), 0.25);
    border-radius: 2px;
  }
}

.analysis-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: var(--swatch-rgba-12-22-38-0_55);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.12);
  min-width: 0;
  overflow: hidden;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-info-soft);
}

.section-count {
  font-size: var(--font-size-xs);
  color: var(--text-color-muted);
}

.analysis-section--table {
  padding-bottom: 8px;
  overflow: hidden;
}

.sat-metric-table {
  width: 100%;
  table-layout: fixed;
  --atlas-app-table-border-color: rgba(var(--accent-cyan-rgb), 0.12);
  --atlas-app-table-header-bg-color: var(--panel-bg);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(var(--accent-cyan-rgb), 0.08);
  --atlas-app-text-color-regular: var(--text-color-soft);
  --atlas-app-text-color-primary: var(--text-color-bright);
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    table-layout: fixed;
  }

  :deep(th.atlas-app-table__cell) {
    color: var(--accent-cyan);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    background: var(--panel-bg) !important;
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  }

  :deep(td.atlas-app-table__cell) {
    font-size: var(--font-size-sm);
    color: var(--text-color-soft);
    background: transparent !important;
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.08);
    padding-top: 10px;
    padding-bottom: 10px;
    padding-left: 4px;
    padding-right: 4px;
    vertical-align: top;
    overflow: hidden;
  }

  :deep(th.atlas-app-table__cell .cell),
  :deep(td.atlas-app-table__cell .cell) {
    padding-left: 0;
    padding-right: 0;
    overflow: hidden;
  }

  :deep(.atlas-app-table__empty-block) {
    background: transparent;
    color: var(--text-color-subtle);
  }
}

.strike-recommend-table {
  :deep(td.strike-recommend-index-col) {
    vertical-align: middle;
  }

  :deep(td.strike-recommend-name-col),
  :deep(td.strike-recommend-metric-col) {
    vertical-align: middle;
  }
}

.strike-recommend-index {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--text-color-muted);
}

.strike-recommend-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.strike-recommend-score {
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-xs);
  color: var(--text-color-soft);
}

.strike-recommend-score--link {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--color-info-soft);

  &:hover {
    color: var(--accent-cyan-hover);
    text-shadow: 0 0 8px var(--swatch-rgba-64-242-255-0_45);
  }
}

.strike-recommend-score--composite {
  font-weight: var(--font-weight-bold);
  color: var(--color-warning);
}

.sat-name-wrap {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-size: var(--font-size-xs);
  line-height: 1.35;
  color: var(--text-color-bright);
  word-break: break-all;
  white-space: normal;
  text-align: left;
  cursor: pointer;
  transition: color 0.2s ease, text-shadow 0.2s ease;

  &:hover {
    color: var(--color-info-soft);
  }

  &--selected {
    color: var(--color-warning);
    text-shadow: 0 0 8px var(--swatch-rgba-251-191-36-0_45);
  }
}

.table-more-actions {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.table-more-btn {
  height: 28px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid var(--swatch-rgba-64-242-255-0_35);
  background: rgba(var(--accent-cyan-rgb), 0.08);
  color: var(--color-info-soft);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: var(--accent-cyan-hover);
    border-color: var(--accent-cyan);
    background: rgba(var(--accent-cyan-rgb), 0.16);
  }
}

.empty-sat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-color-subtle);
  gap: 8px;

  .empty-icon {
    font-size: var(--font-size-3xl);
  }

  .empty-text {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-color-muted);
  }

  .empty-sub {
    margin: 0;
    font-size: var(--font-size-sm);
  }
}

.task-loading-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--swatch-rgba-64-242-255-0_2);
  border-top-color: var(--accent-cyan-hover);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
