<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <div class="panel-header">
      <button type="button" class="scene-action-btn" @click="openCreateTask">添加任务</button>
    </div>
    <div class="panel-body">
      <!-- 上：任务名称 + 进度（不滚动） -->
      <section class="panel-zone panel-zone--top">
        <p class="scene-summary" :title="sceneSummaryText">{{ sceneSummaryText }}</p>
        <div v-if="taskLoading && !taskList.length" class="zone-loading">正在加载任务...</div>
        <div v-else-if="!taskList.length" class="zone-empty">当前场景暂无任务</div>
        <ul v-else class="task-progress-list">
          <li v-for="task in taskList" :key="task.id" class="task-progress-item" :class="{
            active: store.activedTask?.id === task.id,
            disabled: taskSwitching,
            'task-progress-item--done': isTaskCalculationComplete(task),
          }" @click="selectTask(task)">
            <span class="task-progress-name" :title="task.name">
              <span class="task-progress-name-tag">任务名称</span>
              <span class="task-progress-name-text">：{{ task.name }}</span>
            </span>
            <div class="task-progress-trailing">
              <div class="task-progress-status-row">
                <el-tooltip :content="resolveTaskProgressDisplay(task).tooltip" placement="top"
                  :show-after="resolveTaskProgressDisplay(task).kind === 'running' ? 200 : 0">
                  <div class="task-progress-mini">
                    <el-progress v-if="resolveTaskProgressDisplay(task).kind !== 'done'" class="task-progress-mini-bar"
                      :percentage="resolveTaskProgressDisplay(task).percent" :stroke-width="4" :show-text="false" />
                    <span class="task-progress-percent" :class="{
                      'task-progress-percent--done': resolveTaskProgressDisplay(task).kind === 'done',
                      'task-progress-percent--idle': resolveTaskProgressDisplay(task).kind === 'idle',
                    }">{{ resolveTaskProgressDisplay(task).text }}</span>
                  </div>
                </el-tooltip>
                <button type="button" class="task-progress-edit-btn" title="编辑任务"
                  :disabled="taskSwitching || isTaskCalculating(task)" @click.stop="openEditTask(task)">
                  编辑
                </button>
              </div>
            </div>
          </li>
        </ul>
      </section>
      <!-- 中：当前任务资源树（超出时滚动） -->
      <section class="panel-zone panel-zone--middle">
        <div v-if="taskSwitching" class="zone-loading">正在切换任务...</div>
        <div v-else-if="!editorDraft" class="zone-empty">请选择任务以查看资源</div>
        <div v-else class="task-editor task-editor-scroll" :class="{ 'task-editor--locked': isActiveTaskCalculating }">
          <div v-if="editorDraft.taskApiError" class="combat-area-api-error" role="alert">
            {{ editorDraft.taskApiError }}
          </div>
          <div class="tag-section task-time-section">
            <div class="tag-section-head">任务时间</div>
            <p class="task-time-readonly" :title="taskTimeRangeText">{{ taskTimeRangeText }}</p>
          </div>
          <div v-if="receiveOptionsLoading || centerOptionsLoading" class="tag-hint">正在加载地面站与数据中心...</div>
          <div v-if="!panelCountries.length && !receiveOptionsLoading && !centerOptionsLoading" class="tag-hint">
            当前任务未配置国家资源
          </div>
          <template v-else>
            <div class="country-filter">
              <label v-for="country in panelCountries" :key="country" class="country-filter__item">
                <el-checkbox :model-value="isCountryPanelVisible(country)"
                  @change="(val) => handleCountryPanelChange(country, val)" />
                <span class="country-filter__name">{{ country }}</span>
              </label>
            </div>
            <div class="tag-section">
              <div class="tag-section-head">卫星</div>
              <div v-if="seriesOptionsLoading" class="tag-hint">正在加载卫星系列...</div>
              <template v-else>
                <template v-for="country in checkedPanelCountries" :key="`sat-${country}`">
                  <div v-for="series in seriesForCountry(country)" :key="`${country}-${series}`" class="series-block">
                    <div class="series-block__head">
                      <el-checkbox :model-value="isSeriesSelected(series)"
                        @change="(checked) => handleSeriesCheckboxChange(series, checked)" />
                      <button type="button" class="series-block__name" @click="handleSeriesFocus(series)">
                        {{ series }}
                      </button>
                    </div>
                    <div v-if="isSeriesSelected(series)" class="satellite-table-wrap">
                      <div v-if="isSatelliteListLoading(series)" class="tag-hint">正在加载卫星...</div>
                      <div v-else-if="satelliteLoadErrorBySeries[series]" class="combat-area-api-error" role="alert">
                        {{ satelliteLoadErrorBySeries[series] }}
                      </div>
                      <table v-else-if="satellitesForSeries(series).length" class="satellite-table">
                        <thead>
                          <tr>
                            <th>卫星名称</th>
                            <th>类型</th>
                            <th>系列</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="row in satellitesForSeries(series)" :key="row.key" class="satellite-table__row"
                            @click="handleSatelliteRowClick(row)">
                            <td>{{ row.name }}</td>
                            <td>{{ row.satType }}</td>
                            <td>{{ row.series }}</td>
                          </tr>
                        </tbody>
                      </table>
                      <div v-else class="tag-hint">该系列暂无卫星数据</div>
                    </div>
                  </div>
                </template>
                <div v-for="series in unmatchedSelectedSeries" :key="`unmatched-${series}`" class="series-block">
                  <div class="series-block__head">
                    <el-checkbox :model-value="isSeriesSelected(series)"
                      @change="(checked) => handleSeriesCheckboxChange(series, checked)" />
                    <button type="button" class="series-block__name" @click="handleSeriesFocus(series)">
                      {{ series }}
                    </button>
                  </div>
                  <div v-if="isSeriesSelected(series)" class="satellite-table-wrap">
                    <div v-if="isSatelliteListLoading(series)" class="tag-hint">正在加载卫星...</div>
                    <div v-else-if="satelliteLoadErrorBySeries[series]" class="combat-area-api-error" role="alert">
                      {{ satelliteLoadErrorBySeries[series] }}
                    </div>
                    <table v-else-if="satellitesForSeries(series).length" class="satellite-table">
                      <thead>
                        <tr>
                          <th>卫星名称</th>
                          <th>类型</th>
                          <th>系列</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="row in satellitesForSeries(series)" :key="row.key" class="satellite-table__row"
                          @click="handleSatelliteRowClick(row)">
                          <td>{{ row.name }}</td>
                          <td>{{ row.satType }}</td>
                          <td>{{ row.series }}</td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="tag-hint">该系列暂无卫星数据</div>
                  </div>
                </div>
                <div v-if="!checkedPanelCountries.length" class="tag-hint">请勾选国家以查看卫星</div>
                <div v-else-if="!visibleSeriesCount && !unmatchedSelectedSeries.length" class="tag-hint">
                  已勾选国家暂无卫星系列
                </div>
              </template>
            </div>
            <div class="tag-section">
              <div class="tag-section-head">地面站</div>
              <div v-if="receiveOptionsLoading" class="tag-hint">正在加载地面站...</div>
              <div v-else-if="filteredReceiveRows.length" class="ground-station-table-wrap">
                <table class="satellite-table ground-station-table">
                  <thead>
                    <tr>
                      <th>基站名称</th>
                      <th>所属国家/地区</th>
                      <th>地理位置</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in filteredReceiveRows" :key="row.id" class="satellite-table__row"
                      @click="handleGroundStationRowClick('receive', row)">
                      <td>{{ row.name }}</td>
                      <td>{{ row.country }}</td>
                      <td>{{ row.location }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="tag-hint">已勾选国家暂无地面站</div>
            </div>
            <div class="tag-section">
              <div class="tag-section-head">数据中心</div>
              <div v-if="centerOptionsLoading" class="tag-hint">正在加载数据中心...</div>
              <div v-else-if="filteredCenterRows.length" class="ground-station-table-wrap">
                <table class="satellite-table ground-station-table">
                  <thead>
                    <tr>
                      <th>基站名称</th>
                      <th>所属国家/地区</th>
                      <th>地理位置</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in filteredCenterRows" :key="row.id" class="satellite-table__row"
                      @click="handleGroundStationRowClick('center', row)">
                      <td>{{ row.name }}</td>
                      <td>{{ row.country }}</td>
                      <td>{{ row.location }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="tag-hint">已勾选国家暂无数据中心</div>
            </div>
          </template>
          <div class="tag-section">
            <div class="tag-section-head">武器</div>
            <div v-if="weaponOptionsLoading" class="tag-hint">正在加载武器...</div>
            <div v-else-if="weaponTableRows.length" class="weapon-table-wrap">
              <table class="satellite-table weapon-table">
                <thead>
                  <tr>
                    <th>武器名称</th>
                    <th>所属国家/地区</th>
                    <th>武器类型</th>
                    <th>适用卫星类型</th>
                    <th>纬度</th>
                    <th>经度</th>
                    <th>打击高度(km)</th>
                    <th>打击间隔(分钟)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in weaponTableRows" :key="row.id" class="satellite-table__row"
                    @click="handleWeaponRowClick(row)">
                    <td>{{ row.name }}</td>
                    <td>{{ row.country }}</td>
                    <td>{{ row.type }}</td>
                    <td>{{ row.satelliteType }}</td>
                    <td>{{ row.latitude }}</td>
                    <td>{{ row.longitude }}</td>
                    <td>{{ row.strikeHeightKm }}</td>
                    <td>{{ row.strikeIntervalMinutes }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="tag-hint">任务未选择武器</div>
            <div class="weapon-use-item">
              <span class="weapon-use-item-label">使用武器</span>
              <el-switch v-model="useWeaponsEnabled" size="small" @change="handleUseWeaponsChange" />
            </div>
            <div v-if="!useWeaponsEnabled" class="tag-hint">已关闭「使用武器」，武器选择已暂存；重新打开可恢复</div>
          </div>
        </div>
      </section>
      <footer class="panel-zone panel-zone--bottom">
        <el-button type="primary" class="save-recalc-btn" :loading="savingRecalc"
          :disabled="!editorDraft || taskSwitching || isActiveTaskCalculating || Boolean(editorDraft?.taskApiError || scheduleDurationError)"
          @click="handleSaveAndRecalculate">
          保存并重算
        </el-button>
      </footer>
    </div>
    <TaskEditDialog :key="taskEditDialogKey" v-model="taskEditVisible" :mode="taskEditMode" :task="editingTask"
      @saved="handleTaskSaved" />
  </aside>
</template>
<script setup lang="ts">
/**
 * 战场态势 - C2 左侧场景任务面板（上：任务列表，中：资源树，下：保存并重算）。
 */
import { computed, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getTaskList, getAllWeapons, updateTask } from '@/api/dashboard'
import { getSatelliteBySeries } from '@/api/task/task'
import { getGroundStationList, type BaseStationInfo } from '@/api/system/satellite-system-api'
import type { TaskForm, Weapon } from '@/types/dashboard'
import type { MatrixResult } from '@/api/electronic'
import { taskProgressMap, useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import TaskEditDialog, { type TaskEditDialogMode } from '@/components/BattleSituation/TaskEditDialog.vue'
import {
  buildWeaponTableRow,
  calcTaskDurationHours,
  createDraftFromTask,
  fetchSeriesNamesByCountry,
  formatC2LeftPanelTaskTimeRange,
  groupGroundStationRowsByCountry,
  isDataCenterStationType,
  mapSatellitePreviewToTableRows,
  mergeTaskFormWithDraft,
  notifyTaskListValidationErrors,
  normalizeTaskWeaponIds,
  parseTaskPanelTimeMs,
  type C2LeftPanelCountryGroundGroup,
  type C2LeftPanelGroundStationTableRow,
  type C2LeftPanelSatellitePreviewItem,
  type C2LeftPanelSatelliteTableRow,
  type C2LeftPanelWeaponTableRow,
  type C2TaskEditorDraft,
  type TaskPanelResourceDetailPayload,
  type TaskPanelTagOption,
} from '@/utils/c2TaskPanelEditor'
defineProps<{
  /** 算法矩阵（与父组件兼容） */
  matrixData?: MatrixResult | null
  /** 当前选中 NORAD（与父组件兼容） */
  selectedNorad?: number | null
}>()
const emit = defineEmits<{
  (e: 'select-satellite', norad: number | null): void
  /** 保存并重算已提交，右侧面板应重新等待/拉取分析结果 */
  (e: 'task-recalculated', taskId: number): void
  /** 资源详情：地图定位并在 Label 展示当前已有字段 */
  (e: 'focus-resource-detail', payload: TaskPanelResourceDetailPayload): void
  /** 左侧面板聚焦任务卫星系列（地图高亮 + 同步拓扑/甘特图系列） */
  (e: 'focus-task-series', series: string): void
}>()
const store = useLayoutStore()
const {
  getTaskProgress,
  getTaskProgressPercent,
  isTaskProgressComplete,
  startTaskProgressPolling,
  stopAllTaskProgressPolling,
  resumeTaskProgressPollingForTasks,
} = useTaskProgressPolling()
/**
 * 判断任务后台算法是否已全部计算完成。
 *
 * @param task 任务项
 * @returns 三项进度均为「完成」时为 true
 */
const isTaskCalculationComplete = (task: TaskForm): boolean =>
  isTaskProgressComplete(getTaskProgress(task))

/** 任务进度文案类型：已完成 / 计算中 / 未开始 */
type TaskProgressLabelKind = 'done' | 'running' | 'idle'

/**
 * 左侧面板任务进度展示文案（100% 时显示「计算完成」而非百分比）。
 *
 * @param task 任务项
 * @returns 展示文案、样式类型与 tooltip
 */
const getTaskProgressDisplay = (
  task: TaskForm
): { text: string; kind: TaskProgressLabelKind; tooltip: string; percent: number } => {
  const progress = getTaskProgress(task)
  if (isTaskCalculationComplete(task) || (progress && getTaskProgressPercent(progress) >= 100)) {
    return { text: '计算完成', kind: 'done', tooltip: '计算完成', percent: 100 }
  }
  if (progress) {
    const percent = getTaskProgressPercent(progress)
    return {
      text: `${percent}%`,
      kind: 'running',
      tooltip: progress.mes || '算法计算中',
      percent,
    }
  }
  return { text: '未开始', kind: 'idle', tooltip: '未开始', percent: 0 }
}

const taskList = ref<TaskForm[]>([])

/** 任务列表进度展示（显式依赖 taskProgressMap，保证 WS 推送后重渲染） */
const taskProgressDisplayById = computed(() => {
  const map = new Map<number, ReturnType<typeof getTaskProgressDisplay>>()
  for (const task of taskList.value) {
    if (!task.id) continue
    void taskProgressMap[task.id]
    map.set(task.id, getTaskProgressDisplay(task))
  }
  return map
})

/**
 * 左侧面板任务进度展示（优先读 computed 缓存）。
 *
 * @param task 任务项
 */
const resolveTaskProgressDisplay = (task: TaskForm) =>
  (task.id ? taskProgressDisplayById.value.get(task.id) : undefined) ?? getTaskProgressDisplay(task)

/**
 * 任务是否处于算法计算中（有进度且未完成）。
 *
 * @param task 任务项
 * @returns 计算中为 true
 */
const isTaskCalculating = (task: TaskForm): boolean =>
  resolveTaskProgressDisplay(task).kind === 'running'

/** 当前选中任务是否正在计算（禁止编辑与保存并重算） */
const isActiveTaskCalculating = computed(() => {
  const task = store.activedTask
  if (!task) return false
  return isTaskCalculating(task)
})

/** 已对某任务触发过「计算完成」后续处理，避免 watch 重复 emit */
const taskProgressCompleteNotified = new Set<number>()
const taskLoading = ref(false)
const taskSwitching = ref(false)
const savingRecalc = ref(false)
const taskEditVisible = ref(false)
/** 任务弹窗模式：新建 / 修改 */
const taskEditMode = ref<TaskEditDialogMode>('create')
/** 每次打开弹窗递增，避免复用上一次状态 */
const taskEditDialogKey = ref(0)
const editingTask = ref<TaskForm | null>(null)
/** 当前选中任务的内联编辑草稿 */
const editorDraft = ref<C2TaskEditorDraft | null>(null)
/** 是否启用任务武器配置；关闭时草稿中不携带武器，选择暂存于此 */
const useWeaponsEnabled = ref(false)
/** 关闭「使用武器」时暂存的武器 ID，重新打开开关时恢复 */
const stashedWeaponIds = ref<string[]>([])
/** 任务时长（小时），与起止时间联动 */
const durationHours = ref(8)
/** 起止时间无效时的说明（不默认 1 小时） */
const scheduleDurationError = ref('')
/** 国家 → 卫星系列名（按国单独拉取） */
const countrySeriesMap = ref<Map<string, string[]>>(new Map())
/** 面板国家勾选（仅控制展示，与系列勾选独立） */
const countryPanelChecked = ref<Record<string, boolean>>({})
/** 系列 → 卫星表格行 */
const satellitesBySeries = ref<Map<string, C2LeftPanelSatelliteTableRow[]>>(new Map())
/** 系列 → 加载中 */
const satelliteLoadingSeries = ref<Set<string>>(new Set())
/** 系列 → 加载失败说明 */
const satelliteLoadErrorBySeries = reactive<Record<string, string>>({})
const weaponTagOptions = ref<TaskPanelTagOption[]>([])
const receiveTagOptions = ref<TaskPanelTagOption[]>([])
const centerTagOptions = ref<TaskPanelTagOption[]>([])

/** 武器库 ID → 接口记录（详情展示用） */
const weaponRecordById = ref<Map<string, Weapon>>(new Map())

/** 基站/数据中心 ID → 接口记录（详情展示用） */
const groundStationRecordById = ref<Map<string, BaseStationInfo>>(new Map())

const seriesOptionsLoading = ref(false)
const weaponOptionsLoading = ref(false)
const receiveOptionsLoading = ref(false)
const centerOptionsLoading = ref(false)
const sceneSummaryText = computed(() => {
  const scene = store.battle?.name || '未选择'
  const count = taskList.value.length
  const current = store.activedTask?.name || '未选择'
  return `当前场景：${scene}（${count} 个任务）· 当前任务：${current}`
})
/**
 * 解析任务卫星类型列表。
 *
 * @param task 任务
 * @returns 类型数组
 */
const resolveTaskTargetTypes = (task: TaskForm | null | undefined): string[] => {
  if (!task) return []
  if (task.targetTypeShow?.length) return [...task.targetTypeShow]
  return (task.targetTypeNew || task.targetType || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
/**
 * 解析系列查询用的蓝方国家列表。
 *
 * @param task 任务
 * @returns 国家列表
 */
const resolveEnemyCountries = (task: TaskForm | null | undefined): string[] => {
  if (!task) return []
  if (task.enemyCountryShow?.length) return [...task.enemyCountryShow]
  return (task.enemyCountry || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 当前任务敌方国家列表 */
const enemyCountriesList = computed(() => resolveEnemyCountries(store.activedTask))

/** 只读任务时间行 */
const taskTimeRangeText = computed(() =>
  formatC2LeftPanelTaskTimeRange(editorDraft.value?.beginDate, editorDraft.value?.endDate),
)

/**
 * 同步面板国家勾选（新出现的国家默认勾选，已有勾选保持不变）。
 *
 * @param countries 当前面板国家（敌方国家，以及已选地面站/数据中心所属国家）
 */
const syncCountryPanelChecked = (countries: string[]) => {
  const next: Record<string, boolean> = {}
  for (const country of countries) {
    next[country] = countryPanelChecked.value[country] ?? true
  }
  countryPanelChecked.value = next
}

/**
 * @param country 国家名
 * @returns 面板是否展示该国资源
 */
const isCountryPanelVisible = (country: string): boolean => countryPanelChecked.value[country] !== false

/**
 * @param country 国家名
 * @returns 该国中、任务 resources 已选择的系列
 */
const seriesForCountry = (country: string): string[] => {
  const selected = new Set(editorDraft.value?.selectedSeries ?? [])
  return (countrySeriesMap.value.get(country) ?? []).filter((series) => selected.has(series))
}

/**
 * 任务已选、但系列接口未归入任一敌方国家的系列。
 * 加载完成前返回空，避免把全部已选系列短暂当成未匹配项。
 */
const unmatchedSelectedSeries = computed(() => {
  if (seriesOptionsLoading.value) return []
  const known = new Set<string>()
  for (const list of countrySeriesMap.value.values()) {
    for (const series of list) known.add(series)
  }
  return (editorDraft.value?.selectedSeries ?? []).filter((series) => !known.has(series))
})

/** 进行中的按国系列请求键 */
let countrySeriesInflightKey = ''
let countrySeriesInflight: Promise<void> | null = null

/**
 * 按国加载卫星系列，仅用于把任务已选系列归到对应国家下展示。
 * 不把接口返回的全部系列写入草稿。
 *
 * @param task 当前任务
 */
const loadCountrySeriesMap = async (task: TaskForm | null | undefined) => {
  const countries = resolveEnemyCountries(task)
  const types = editorDraft.value?.targetTypeShow?.length
    ? [...editorDraft.value.targetTypeShow]
    : resolveTaskTargetTypes(task)
  satellitesBySeries.value = new Map()
  for (const key of Object.keys(satelliteLoadErrorBySeries)) {
    delete satelliteLoadErrorBySeries[key]
  }
  if (!countries.length) {
    countrySeriesMap.value = new Map()
    ensureSatellitesForVisibleSeries()
    return
  }
  const inflightKey = `${[...countries].sort().join('\u0001')}|${[...types].sort().join('\u0001')}`
  if (countrySeriesInflightKey === inflightKey && countrySeriesInflight) {
    await countrySeriesInflight
    ensureSatellitesForVisibleSeries()
    return
  }
  countrySeriesInflightKey = inflightKey

  const loadPromise = (async () => {
    seriesOptionsLoading.value = true
    try {
      const map = await fetchSeriesNamesByCountry(countries, types)
      countrySeriesMap.value = map
    } catch (error) {
      console.error('加载国家卫星系列失败:', error)
      const msg = error instanceof Error ? error.message : '加载卫星系列失败'
      ElMessage.error(msg)
      countrySeriesMap.value = new Map()
    } finally {
      seriesOptionsLoading.value = false
      ensureSatellitesForVisibleSeries()
    }
  })()

  countrySeriesInflight = loadPromise
  try {
    await loadPromise
  } finally {
    if (countrySeriesInflight === loadPromise) {
      countrySeriesInflight = null
    }
  }
}

/** 系列 → 进行中的卫星列表请求 */
const satelliteLoadInflight = new Map<string, Promise<void>>()

/**
 * 拉取系列下卫星列表。
 *
 * @param series 系列名
 */
const loadSatellitesForSeries = async (series: string): Promise<void> => {
  if (satellitesBySeries.value.has(series)) return
  const existing = satelliteLoadInflight.get(series)
  if (existing) {
    await existing
    return
  }
  const promise = (async () => {
    satelliteLoadingSeries.value = new Set(satelliteLoadingSeries.value).add(series)
    delete satelliteLoadErrorBySeries[series]
    try {
      const res = await getSatelliteBySeries(series)
      if (res.code !== 200 || !Array.isArray(res.data)) {
        satelliteLoadErrorBySeries[series] = res.msg || `加载系列「${series}」卫星失败`
        return
      }
      const rows = mapSatellitePreviewToTableRows(res.data as C2LeftPanelSatellitePreviewItem[], series)
      satellitesBySeries.value = new Map(satellitesBySeries.value).set(series, rows)
    } catch (error) {
      console.error(`加载系列 ${series} 卫星失败:`, error)
      satelliteLoadErrorBySeries[series] =
        error instanceof Error ? error.message : `加载系列「${series}」卫星失败`
    } finally {
      const next = new Set(satelliteLoadingSeries.value)
      next.delete(series)
      satelliteLoadingSeries.value = next
      satelliteLoadInflight.delete(series)
    }
  })()
  satelliteLoadInflight.set(series, promise)
  await promise
}

/**
 * 为当前可见、且属于任务已选系列的卫星加载表格。
 * 任务只保存系列名，该系列下的卫星即任务卫星，不展示其他系列。
 */
const ensureSatellitesForVisibleSeries = (): void => {
  for (const country of enemyCountriesList.value) {
    if (!isCountryPanelVisible(country)) continue
    for (const series of seriesForCountry(country)) {
      void loadSatellitesForSeries(series)
    }
  }
  for (const series of unmatchedSelectedSeries.value) {
    void loadSatellitesForSeries(series)
  }
}

/**
 * @param series 系列名
 * @returns 是否正在加载卫星
 */
const isSatelliteListLoading = (series: string): boolean => satelliteLoadingSeries.value.has(series)

/**
 * @param series 系列名
 * @returns 已加载的卫星行
 */
const satellitesForSeries = (series: string): C2LeftPanelSatelliteTableRow[] =>
  satellitesBySeries.value.get(series) ?? []

const receiveGroupsByCountry = computed(() => {
  const selected = new Set(editorDraft.value?.selectedReceiveIds ?? [])
  const options = receiveTagOptions.value.filter((item) => selected.has(item.id))
  return groupGroundStationRowsByCountry(
    options,
    groundStationRecordById.value,
    enemyCountriesList.value,
  )
})
const centerGroupsByCountry = computed(() => {
  const selected = new Set(editorDraft.value?.stationIds ?? [])
  const options = centerTagOptions.value.filter((item) => selected.has(item.id))
  return groupGroundStationRowsByCountry(
    options,
    groundStationRecordById.value,
    enemyCountriesList.value,
  )
})

/**
 * 左侧面板国家顺序：先敌方国家，再追加只出现在已选地面站或数据中心里的国家。
 */
const panelCountries = computed(() => {
  const ordered: string[] = []
  const seen = new Set<string>()
  const pushCountry = (country: string) => {
    const name = country.trim()
    if (!name || seen.has(name)) return
    seen.add(name)
    ordered.push(name)
  }
  for (const country of enemyCountriesList.value) pushCountry(country)
  for (const group of receiveGroupsByCountry.value) {
    if (group.rows.length) pushCountry(group.country)
  }
  for (const group of centerGroupsByCountry.value) {
    if (group.rows.length) pushCountry(group.country)
  }
  return ordered
})

watch(panelCountries, (countries) => {
  syncCountryPanelChecked(countries)
}, { immediate: true })

/** 当前勾选、需要展示资源的国家 */
const checkedPanelCountries = computed(() =>
  panelCountries.value.filter((country) => isCountryPanelVisible(country)),
)

/** 已勾选国家下、任务已选的卫星系列数量 */
const visibleSeriesCount = computed(() =>
  checkedPanelCountries.value.reduce((count, country) => count + seriesForCountry(country).length, 0),
)

/**
 * 把分组表格按已勾选国家收成一张表。没有国家的行仍保留在同一张表里。
 *
 * @param groups 按国家分组的地面站或数据中心
 * @returns 过滤后的表格行
 */
const filterRowsByCheckedCountries = (
  groups: C2LeftPanelCountryGroundGroup[],
): C2LeftPanelGroundStationTableRow[] => {
  const rows: C2LeftPanelGroundStationTableRow[] = []
  for (const group of groups) {
    if (!group.country || isCountryPanelVisible(group.country)) {
      rows.push(...group.rows)
    }
  }
  return rows
}

/** 已勾选国家的地面站，合并为一张表 */
const filteredReceiveRows = computed(() => filterRowsByCheckedCountries(receiveGroupsByCountry.value))

/** 已勾选国家的数据中心，合并为一张表 */
const filteredCenterRows = computed(() => filterRowsByCheckedCountries(centerGroupsByCountry.value))

/**
 * 任务已选武器 ID。关闭「使用武器」时草稿被清空，展示仍用暂存的任务选择，而不是武器库全量。
 */
const taskSelectedWeaponIds = computed(() => {
  const selected = editorDraft.value?.selectedWeaponIds ?? []
  if (selected.length) return selected
  return stashedWeaponIds.value
})

/** 任务已选武器的只读表格行 */
const weaponTableRows = computed(() => {
  const optionById = new Map(weaponTagOptions.value.map((item) => [item.id, item]))
  return taskSelectedWeaponIds.value.map((id) =>
    buildWeaponTableRow(optionById.get(id) ?? { id, label: id }, weaponRecordById.value),
  )
})
/**
 * 加载武器候选项。
 */
const loadWeaponTagOptions = async () => {
  weaponOptionsLoading.value = true
  try {
    const res = await getAllWeapons()
    const list = res.code === 200 ? (res.data?.weapons ?? []) : []
    const recordMap = new Map<string, Weapon>()
    weaponTagOptions.value = list
      .map((weapon) => {
        const id = String(weapon.id ?? '')
        if (id) recordMap.set(id, weapon)
        return {
          id,
          label: weapon.name || id,
        }
      })
      .filter((item) => item.id)
    weaponRecordById.value = recordMap
  } catch {
    weaponTagOptions.value = (editorDraft.value?.selectedWeaponIds || []).map((id) => ({
      id,
      label: id,
    }))
    weaponRecordById.value = new Map()
  } finally {
    weaponOptionsLoading.value = false
  }
}
/**
 * 加载地面接收站候选项。
 */
const loadReceiveTagOptions = async () => {
  receiveOptionsLoading.value = true
  try {
    const res = await getGroundStationList({ type: '', name: '', country: '' })
    const list = res.code === 200 ? (res.data ?? []) : []
    const recordMap = new Map(groundStationRecordById.value)
    receiveTagOptions.value = list
      .filter((item) => !isDataCenterStationType(item.type || ''))
      .map((item) => {
        const id = item._id || item.name
        if (id) recordMap.set(id, item)
        return {
          id,
          label: item.name || item._id || '',
        }
      })
      .filter((item) => item.id)
    groundStationRecordById.value = recordMap
    const knownIds = new Set(receiveTagOptions.value.map((item) => item.id))
      ; (editorDraft.value?.selectedReceiveIds || []).forEach((id) => {
        if (!knownIds.has(id)) {
          receiveTagOptions.value.push({ id, label: id })
        }
      })
  } catch {
    receiveTagOptions.value = (editorDraft.value?.selectedReceiveIds || []).map((id) => ({
      id,
      label: id,
    }))
  } finally {
    receiveOptionsLoading.value = false
  }
}
/**
 * 加载数据中心候选项。
 */
const loadCenterTagOptions = async () => {
  centerOptionsLoading.value = true
  try {
    const res = await getGroundStationList({ type: '', name: '', country: '' })
    const list = res.code === 200 ? (res.data ?? []) : []
    const recordMap = new Map(groundStationRecordById.value)
    centerTagOptions.value = list
      .filter((item) => isDataCenterStationType(item.type || ''))
      .map((item) => {
        const id = item._id || item.name
        if (id) recordMap.set(id, item)
        return {
          id,
          label: item.name || item._id || '',
        }
      })
      .filter((item) => item.id)
    groundStationRecordById.value = recordMap
    const knownIds = new Set(centerTagOptions.value.map((item) => item.id))
      ; (editorDraft.value?.stationIds || []).forEach((id) => {
        if (!knownIds.has(id)) {
          centerTagOptions.value.push({ id, label: id })
        }
      })
  } catch {
    centerTagOptions.value = (editorDraft.value?.stationIds || []).map((id) => ({
      id,
      label: id,
    }))
  } finally {
    centerOptionsLoading.value = false
  }
}
/**
 * 切换任务时同步编辑草稿与候选项。
 *
 * @param task 当前任务
 * @param options.reloadTagOptions 是否重新拉取系列/武器/地面站候选项；列表 reconcile 时传 false 避免与 activedTask watch 重复请求
 */
const syncEditorForTask = async (
  task: TaskForm | null | undefined,
  options?: { reloadTagOptions?: boolean },
) => {
  const reloadTagOptions = options?.reloadTagOptions ?? true
  editorDraft.value = createDraftFromTask(task)
  scheduleDurationError.value = ''
  if (task && editorDraft.value) {
    const hours = calcTaskDurationHours(editorDraft.value.beginDate, editorDraft.value.endDate)
    if (hours == null) {
      scheduleDurationError.value =
        '任务 beginDate/endDate 缺失或无效，无法计算时长。请检查 taskList 接口。'
    } else {
      durationHours.value = hours
    }
    editorDraft.value.selectedWeaponIds = normalizeTaskWeaponIds(editorDraft.value.selectedWeaponIds)
    stashedWeaponIds.value = [...editorDraft.value.selectedWeaponIds]
    useWeaponsEnabled.value = editorDraft.value.selectedWeaponIds.length > 0
    if (editorDraft.value.taskApiError) {
      ElMessage.error({
        message: editorDraft.value.taskApiError,
        duration: 10000,
        showClose: true,
      })
    }
    store.setTaskCombatArea(
      editorDraft.value.combatArea ? { ...editorDraft.value.combatArea } : null,
    )
  } else {
    stashedWeaponIds.value = []
    useWeaponsEnabled.value = false
    store.setTaskCombatArea(null)
  }
  if (!task) return
  if (!reloadTagOptions) return
  await Promise.all([
    loadCountrySeriesMap(task),
    loadWeaponTagOptions(),
    loadReceiveTagOptions(),
    loadCenterTagOptions(),
  ])
}
watch(
  () => store.activedTask?.id,
  () => {
    void syncEditorForTask(store.activedTask)
  },
  { immediate: true }
)

/**
 * 作战区域编辑同步到 Store，供地球视图绘制/隐藏。
 */
watch(
  () => editorDraft.value?.combatArea,
  (area) => {
    store.setTaskCombatArea(area ? { ...area } : null)
  },
  { deep: true }
)

/**
 * 任务列表刷新后，用接口数据覆盖 Pinia 中可能过期的 activedTask（如 localStorage 恢复的旧快照）。
 */
/**
 * 保存/重算后从 taskList 取最新任务；列表中不存在则报错，不用提交体冒充接口数据。
 *
 * @param taskId 任务 ID
 * @returns 列表中的任务或 null
 */
const requireTaskFromList = (taskId: number): TaskForm | null => {
  const fresh = taskList.value.find((item) => item.id === taskId)
  if (!fresh) {
    ElMessage.error(`任务 id=${taskId} 未出现在 taskList 中，请检查后端列表接口或刷新页面`)
    return null
  }
  return fresh
}

const reconcileActiveTaskWithTaskList = async () => {
  const tasks = taskList.value
  if (!tasks.length) return
  if (store.battle?.id) {
    store.setActivedBattle({ ...store.battle, tasks })
  }
  const activeId = store.activedTask?.id
  if (!activeId) return
  const fresh = tasks.find((item) => item.id === activeId)
  if (!fresh) return
  store.setActivedTask(fresh)
  await syncEditorForTask(fresh, { reloadTagOptions: false })
}

/**
 * 拉取当前场景任务列表。
 */
const loadBattleTasks = async () => {
  const battleId = store.battle?.id
  if (!battleId) {
    taskList.value = []
    return
  }
  taskLoading.value = true
  taskList.value = []
  try {
    const res = await getTaskList(battleId)
    if (res.code === 200 && Array.isArray(res.data)) {
      taskList.value = res.data
      const validationErrors = res.taskListValidationErrors ?? res.combatAreaErrors
      if (validationErrors?.length) {
        notifyTaskListValidationErrors(validationErrors, (message) => {
          ElMessage.error({ message, duration: 10000, showClose: true })
        })
      }
      await resumeTaskProgressPollingForTasks(res.data)
    } else {
      taskList.value = []
      ElMessage.error(res.msg || '加载任务列表失败')
    }
  } catch (error) {
    console.error('加载场景任务列表失败:', error)
    taskList.value = []
    ElMessage.error('加载场景任务列表失败，请检查网络或后端服务')
  } finally {
    taskLoading.value = false
  }
  await reconcileActiveTaskWithTaskList()
}

/**
 * WS 进度三项均为「完成」时，回写 taskList / activedTask 的 algorithmProgressEntity。
 *
 * @param taskId 任务 ID
 */
const applyCompletedProgressToTaskList = (taskId: number): void => {
  const progress = taskProgressMap[taskId]
  if (!isTaskProgressComplete(progress)) return

  const patchTask = (task: TaskForm): TaskForm => {
    if (task.id !== taskId) return task
    const prev = task.algorithmProgressEntity
    return {
      ...task,
      algorithmProgressEntity: {
        _id: prev?._id ?? '',
        taskId,
        totalMin: prev?.totalMin ?? null,
        transitMin: prev?.transitMin ?? null,
        threatAndStrikeMin: prev?.threatAndStrikeMin ?? null,
        totalStatus: progress!.totalStatus,
        transitStatus: progress!.transitStatus,
        threatAndStrikeStatus: progress!.threatAndStrikeStatus,
        mes: progress!.mes ?? prev?.mes ?? null,
      },
    }
  }

  taskList.value = taskList.value.map(patchTask)
  if (store.activedTask?.id === taskId) {
    // 回写当前激活任务的进度实体
    store.setActivedTask(patchTask(store.activedTask))
  }
}

watch(
  () =>
    taskList.value
      .map((t) => {
        if (!t.id) return ''
        const p = taskProgressMap[t.id]
        return p
          ? `${t.id}:${p.totalStatus}:${p.transitStatus}:${p.threatAndStrikeStatus}`
          : `${t.id}:`
      })
      .join('|'),
  () => {
    for (const task of taskList.value) {
      if (!task.id) continue
      if (!isTaskProgressComplete(taskProgressMap[task.id])) continue
      applyCompletedProgressToTaskList(task.id)
      if (taskProgressCompleteNotified.has(task.id)) continue
      taskProgressCompleteNotified.add(task.id)
      if (store.activedTask?.id === task.id) {
        emit('task-recalculated', task.id)
      }
    }
  },
)

watch(
  () => store.battle?.id,
  () => {
    // 监听战场id变化，重新加载任务列表
    void loadBattleTasks()
  },
  { immediate: true }
)

watch(
  () =>
    editorDraft.value
      ? ([editorDraft.value.beginDate, editorDraft.value.endDate] as const)
      : null,
  (range) => {
    if (!range || !editorDraft.value) return
    const hours = calcTaskDurationHours(range[0], range[1])
    if (hours == null) {
      scheduleDurationError.value =
        '任务 beginDate/endDate 缺失或无效，无法计算时长。请检查 taskList 接口。'
    } else {
      scheduleDurationError.value = ''
      durationHours.value = hours
    }
  }
)
const isSeriesSelected = (series: string) => editorDraft.value?.selectedSeries.includes(series) ?? false

watch(
  () => editorDraft.value?.selectedSeries.join('\u0001') ?? '',
  () => {
    ensureSatellitesForVisibleSeries()
  },
)
/**
 * 切换系列选中状态。
 *
 * @param series 系列名
 */
const toggleSeries = (series: string) => {
  if (!editorDraft.value) return
  const list = editorDraft.value.selectedSeries
  if (list.includes(series)) return
  editorDraft.value.selectedSeries = [...list, series]
}
/**
 * 取消选中系列。
 *
 * @param series 系列名
 */
const removeSeries = (series: string) => {
  if (!editorDraft.value) return
  editorDraft.value.selectedSeries = editorDraft.value.selectedSeries.filter((item) => item !== series)
}

/**
 * 「使用武器」开关切换：关闭时暂存当前选择并清空草稿；打开时从暂存恢复。
 * @param enabled 是否使用武器
 */
const handleUseWeaponsChange = (enabled: boolean) => {
  if (!editorDraft.value) return
  if (!enabled) {
    stashedWeaponIds.value = normalizeTaskWeaponIds(editorDraft.value.selectedWeaponIds)
    editorDraft.value.selectedWeaponIds = []
    return
  }
  editorDraft.value.selectedWeaponIds = normalizeTaskWeaponIds(stashedWeaponIds.value)
}

/**
 * 点击系列名称：同步分析页系列选择并高亮系列卫星。
 *
 * @param series 系列名
 */
const handleSeriesCheckboxChange = (series: string, checked: boolean | string | number) => {
  if (checked) toggleSeries(series)
  else removeSeries(series)
  ensureSatellitesForVisibleSeries()
}

/**
 * 国家面板勾选：仅控制该国分组展示。
 *
 * @param country 国家名
 * @param checked 是否展示
 */
const handleCountryPanelChange = (country: string, checked: boolean | string | number) => {
  countryPanelChecked.value = {
    ...countryPanelChecked.value,
    [country]: Boolean(checked),
  }
  ensureSatellitesForVisibleSeries()
}

/**
 * 点击系列名称：同步分析页系列选择并高亮系列卫星。
 *
 * @param series 系列名
 */
const handleSeriesFocus = (series: string) => {
  store.setSelectedSatSeries(series)
  handleTaskResourceDetail({ kind: 'series', item: { id: series, label: series } })
}

/**
 * 点击卫星表格行：单星定位与高亮。
 *
 * @param row 卫星行
 */
const handleSatelliteRowClick = (row: C2LeftPanelSatelliteTableRow) => {
  emit('focus-resource-detail', {
    kind: 'satellite',
    item: { id: String(row.norad), label: row.name },
    norad: row.norad,
  })
}

/**
 * 点击地面站或数据中心表格行。
 *
 * @param kind 资源类型
 * @param row 表格行
 */
const handleGroundStationRowClick = (kind: 'receive' | 'center', row: C2LeftPanelGroundStationTableRow) => {
  handleTaskResourceDetail({
    kind,
    item: { id: row.id, label: row.name },
  })
}

/**
 * 点击武器表格行：在地球上定位该武器并展示已有字段。不改变任务武器勾选。
 *
 * @param row 武器表格行
 */
const handleWeaponRowClick = (row: C2LeftPanelWeaponTableRow) => {
  handleTaskResourceDetail({
    kind: 'weapon',
    item: { id: row.id, label: row.name },
  })
}

/**
 * 任务资源详情：交由父组件在地球上定位，并在目标 Label 展示当前已有字段。
 *
 * @param payload 资源类型与候选项
 */
const handleTaskResourceDetail = (payload: {
  kind: TaskPanelResourceDetailPayload['kind']
  item: TaskPanelTagOption
}): void => {
  const detailPayload: TaskPanelResourceDetailPayload = {
    kind: payload.kind,
    item: payload.item,
  }
  if (payload.kind === 'weapon') {
    detailPayload.weapon = weaponRecordById.value.get(payload.item.id)
  }
  if (payload.kind === 'receive' || payload.kind === 'center') {
    detailPayload.groundStation = groundStationRecordById.value.get(payload.item.id)
  }
  emit('focus-resource-detail', detailPayload)
}

/**
 * 打开任务编辑弹窗（新建或修改）。
 *
 * @param mode 弹窗模式
 * @param task 目标任务；新建时为 null
 */
const openTaskEditDialog = async (mode: TaskEditDialogMode, task: TaskForm | null) => {
  if (!store.battle?.id) {
    ElMessage.warning('请先选择当前场景后再操作任务')
    return
  }
  if (taskEditVisible.value) {
    taskEditVisible.value = false
    await nextTick()
  }
  taskEditMode.value = mode
  editingTask.value = task
  taskEditDialogKey.value += 1
  await nextTick()
  taskEditVisible.value = true
}

/** 打开新建任务弹窗 */
const openCreateTask = () => {
  void openTaskEditDialog('create', null)
}

/**
 * 打开修改任务弹窗（全屏 TaskEditDialog，保存后刷新列表）。
 *
 * @param task 待编辑任务
 */
const openEditTask = (task: TaskForm) => {
  if (!task.id) {
    ElMessage.warning('任务 ID 无效，无法编辑')
    return
  }
  if (isTaskCalculating(task)) {
    ElMessage.warning('任务计算中，请完成后再编辑')
    return
  }
  void openTaskEditDialog('edit', task)
}
/**
 * 保存任务后处理
 * @param updated 
 */
const handleTaskSaved = async (updated: TaskForm) => {
  const isCreate = !taskList.value.some((item) => item.id === updated.id)
  if (!updated.id) return
  taskProgressCompleteNotified.delete(updated.id)
  await startTaskProgressPolling(updated.id)
  await loadBattleTasks()
  const latest = requireTaskFromList(updated.id)
  if (!latest) return
  store.setActivedTask(latest)
  store.setSelectedSatSeries('')
  await syncEditorForTask(latest)
  if (isCreate) {
    ElMessage.success(`已切换到新任务：${latest.name}`)
  } else {
    ElMessage.success(`任务已更新：${latest.name}`)
  }
}
/**
 * 切换当前任务。
 *
 * @param task 目标任务
 */
const selectTask = async (task: TaskForm) => {
  if (taskLoading.value || taskSwitching.value) return
  if (store.activedTask?.id === task.id) return
  taskSwitching.value = true
  try {
    /** 1. 设置当前选中任务 */
    store.setActivedTask(task)
    /** 2. 清除任务分析数据 */
    store.setSelectedSatSeries('')
    /** 3. 同步任务编辑器数据 */
    await syncEditorForTask(task)

    ElMessage.success(`已切换当前任务：${task.name}`)
    /** 5. 获取任务分析数据 */
    if (store.selectedSatSeries) {
      /** 6. 获取任务分析数据 */
      await store.fetchMatrixForCurrentScope(true)
    }
  } catch (err) {
    console.error('切换任务失败:', err)
  } finally {
    taskSwitching.value = false
  }
}

/**
 * 校验并提交任务修改，触发后台重算。
 */
const handleSaveAndRecalculate = async () => {
  const baseTask = store.activedTask
  const draft = editorDraft.value
  if (!baseTask?.id || !draft || draft.taskId !== baseTask.id) {
    ElMessage.warning('请先选择任务')
    return
  }
  if (isTaskCalculating(baseTask)) {
    ElMessage.warning('任务计算中，请完成后再保存并重算')
    return
  }
  if (!draft.beginDate || !draft.endDate) {
    ElMessage.warning('请填写开始与结束时间')
    return
  }
  if (parseTaskPanelTimeMs(draft.endDate) <= parseTaskPanelTimeMs(draft.beginDate)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  if (!draft.selectedSeries.length) {
    ElMessage.warning('请至少保留一个卫星系列')
    return
  }
  if (!draft.targetTypeShow.length) {
    ElMessage.warning('请至少选择一种卫星类型')
    return
  }
  let payload: TaskForm
  try {
    payload = mergeTaskFormWithDraft(baseTask, draft)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '作战区域数据不完整，无法保存'
    ElMessage.error(msg)
    return
  }
  savingRecalc.value = true
  try {
    const res = await updateTask(payload)
    if (res.code !== 200) {
      ElMessage.error(res.msg || '保存任务失败')
      return
    }
    ElMessage.success('已保存，任务重新计算中')
    taskProgressCompleteNotified.delete(baseTask.id)
    await startTaskProgressPolling(baseTask.id)
    await loadBattleTasks()
    const latest = requireTaskFromList(baseTask.id)
    if (!latest) return
    store.setActivedTask(latest)
    store.setSelectedSatSeries('')
    store.clearTaskAnalysisData()
    await syncEditorForTask(latest)
    emit('task-recalculated', baseTask.id)
  } catch (error) {
    console.error('保存并重算失败:', error)
    ElMessage.error('保存并重算失败')
  } finally {
    savingRecalc.value = false
  }
}

onUnmounted(() => {
  stopAllTaskProgressPolling()
})
</script>
<style scoped lang="scss">
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  backdrop-filter: blur(8px);
  color: #e2efff;
  overflow: hidden;
  gap: 10px;

  &--left {
    border-left: none;
    border-top: none;
    border-bottom: none;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  flex-shrink: 0;

  .scene-action-btn {
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 8px;
    font-size: 12px;
    font-weight: 700;
    color: #7dd3fc;
    background: rgba(0, 225, 255, 0.08);
    border: 1px solid rgba(0, 225, 255, 0.35);
    border-radius: 6px;
    cursor: pointer;

    &:hover:not(:disabled) {
      color: #40f2ff;
      border-color: #00e1ff;
      background: rgba(0, 225, 255, 0.18);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.panel-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 8px;
}

.panel-zone {
  border: 1px dashed rgba(0, 225, 255, 0.22);
  border-radius: 6px;
  background: rgba(12, 22, 38, 0.72);
  box-sizing: border-box;

  &--top {
    flex-shrink: 0;
    padding: 8px 10px;
  }

  &--middle {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  &--bottom {
    flex-shrink: 0;
    padding: 10px;
    border-style: solid;
  }
}

.scene-summary {
  margin: 0 0 8px;
  font-size: 11px;
  line-height: 1.4;
  color: #7dd3fc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-progress-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-progress-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(18, 36, 62, 0.55);
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;

  &.active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.1);
  }

  &.disabled {
    pointer-events: none;
    opacity: 0.55;
  }

  &:hover:not(.disabled) {
    border-color: rgba(0, 225, 255, 0.55);
  }
}

.task-progress-name {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 700;
  color: #e2efff;
  overflow: hidden;
}

.task-progress-edit-btn {
  flex-shrink: 0;
  height: 28px;
  align-self: center;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.4);
  background: rgba(0, 225, 255, 0.1);
  color: #7dd3fc;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;

  &:hover:not(:disabled) {
    color: #40f2ff;
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.2);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.task-progress-name-tag {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.35);
  background: rgba(0, 225, 255, 0.12);
  color: #7dd3fc;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
}

.task-progress-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #e2efff;
}

.task-progress-trailing {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.task-progress-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/** 短进度条与文案横向并排，不挤压任务名 */
.task-progress-mini {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.task-progress-mini-bar {
  width: 40px;
  line-height: 0;
  flex-shrink: 0;

  :deep(.el-progress-bar) {
    width: 40px;
  }

  :deep(.el-progress-bar__outer) {
    height: 4px;
    border-radius: 2px;
    background-color: rgba(100, 116, 139, 0.35);
  }

  :deep(.el-progress-bar__inner) {
    border-radius: 2px;
  }
}

.task-progress-percent {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  color: #7dd3fc;
  text-align: left;
  line-height: 1.2;
  white-space: nowrap;

  &--done {
    min-width: auto;
    font-size: 11px;
    color: #86efac;
  }

  &--idle {
    min-width: auto;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
  }
}

.task-editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 12px;
  text-align: left;

  &--locked {
    pointer-events: none;
    opacity: 0.62;
    user-select: none;
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 3px;
  }
}

.task-time-readonly {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: #e2efff;
  word-break: break-word;
}

.country-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin-bottom: 12px;
}

.country-filter__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  cursor: pointer;
}

.country-filter__name {
  font-size: 13px;
  font-weight: 700;
  color: #7dd3fc;
}

.series-block {
  margin-left: 4px;
  padding-left: 8px;
  border-left: 2px solid rgba(0, 225, 255, 0.15);
  margin-bottom: 10px;
}

.series-block__head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.series-block__name {
  padding: 0;
  border: none;
  background: transparent;
  color: #e2efff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: #40f2ff;
    text-decoration: underline;
  }
}

.satellite-table-wrap {
  margin: 0 0 4px 22px;
}

.satellite-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;

  th,
  td {
    padding: 4px 6px;
    border: 1px solid rgba(79, 147, 221, 0.25);
    text-align: left;
  }

  th {
    color: #94a3b8;
    font-weight: 600;
    background: rgba(8, 18, 32, 0.6);
  }

  td {
    color: #e2efff;
  }
}

.satellite-table__row {
  cursor: pointer;

  &:hover td {
    background: rgba(0, 225, 255, 0.08);
  }
}

.ground-station-table-wrap {
  overflow-x: auto;
}

.ground-station-table {
  min-width: 520px;

  td:nth-child(3) {
    max-width: 120px;
    word-break: break-word;
  }
}

.weapon-table-wrap {
  overflow-x: auto;
  margin-bottom: 10px;
}

.weapon-table {
  min-width: 880px;
  white-space: nowrap;
}

.task-metric-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

.metric-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) 36px;
  align-items: center;
  column-gap: 8px;
}

.metric-row--types {
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: start;
}

.metric-row--combat-head {
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
}

.combat-area-api-error {
  margin: 4px 0 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #ffb4b4;
  background: rgb(255 80 80 / 12%);
  border: 1px solid rgb(255 120 120 / 35%);
  border-radius: 4px;
}

.combat-area-enable {
  display: inline-flex;
  align-items: center;
  margin: 0;
  cursor: pointer;
  line-height: 1;
  justify-self: start;
}

.combat-area-enable :deep(.atlas-app-checkbox) {
  height: auto;
  align-items: center;
}

.metric-unit--empty {
  visibility: hidden;
}

.metric-row--readonly {
  grid-template-columns: 72px minmax(0, 1fr);
}

.metric-value {
  font-size: 13px;
  font-weight: 600;
  color: #e2efff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-label {
  font-size: 12px;
  color: #94a3b8;
  text-align: left;
}

.metric-input-number {
  width: 100%;
  max-width: none;
}

.metric-input-number :deep(.atlas-app-input-number) {
  width: 100%;
}

.metric-input-number :deep(.atlas-app-input-number .atlas-app-input__wrapper) {
  min-height: 28px;
  padding-top: 0;
  padding-bottom: 0;
}

.metric-input-number :deep(.atlas-app-input-number .atlas-app-input__inner) {
  height: 26px;
  line-height: 26px;
}

.metric-unit {
  font-size: 12px;
  color: #64748b;
  width: 36px;
  flex-shrink: 0;
  text-align: left;
}

.metric-type-tags {
  grid-column: 2;
}

.tag-section-head {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #7dd3fc;
  text-align: left;
}

.weapon-use-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  width: 100%;
  margin-bottom: 8px;
  text-align: left;
}

.weapon-use-item-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  flex-shrink: 0;
}

.task-editor-times {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.time-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-label {
  font-size: 11px;
  color: #94a3b8;
}

.task-datetime-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
  border-radius: 6px;
  border: 1px solid rgba(0, 225, 255, 0.28);
  background: rgba(8, 15, 26, 0.85);
  color: #e2e8f0;
  font-size: 12px;
}

.tag-section {
  margin-bottom: 12px;
}

.resource-pick-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.resource-pick-group__title {
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-align: left;
}

.resource-pick-group--pool {
  padding-top: 8px;
  border-top: 1px solid rgba(100, 116, 139, 0.28);
}

.resource-pick-group__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 6px;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;

  &:hover {
    color: #cbd5e1;
  }
}

.resource-pick-group__chevron {
  display: inline-block;
  font-size: 12px;
  line-height: 1;
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(90deg);
  }
}

.tag-hint {
  font-size: 11px;
  color: #64748b;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-start;
}

/** 选项列表：多列 grid，每格内 checkbox + 文案列对齐 */
.task-config-checkbox-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(152px, 1fr));
  gap: 8px;
  width: 100%;
  align-items: stretch;
}

.task-config-tag {
  cursor: pointer;
  border-color: rgba(100, 116, 139, 0.45);
  background: rgba(15, 23, 42, 0.8);
  color: #94a3b8;

  &.is-selected {
    border-color: rgba(0, 225, 255, 0.65);
    background: rgba(0, 225, 255, 0.14);
    color: #e0f2fe;
  }
}

.save-recalc-btn {
  width: 100%;
  height: 38px;
  font-weight: 700;
}

.zone-loading,
.zone-empty {
  padding: 16px 12px;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.zone-loading {
  color: #7dd3fc;
}
</style>
