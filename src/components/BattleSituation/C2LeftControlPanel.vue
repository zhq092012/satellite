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
                <el-tooltip :content="getTaskProgressDisplay(task).tooltip" placement="top"
                  :show-after="getTaskProgressDisplay(task).kind === 'running' ? 200 : 0">
                  <div class="task-progress-mini">
                    <el-progress v-if="getTaskProgressDisplay(task).kind !== 'done'" class="task-progress-mini-bar"
                      :percentage="getTaskProgressDisplay(task).percent" :stroke-width="4" :show-text="false" />
                    <span class="task-progress-percent" :class="{
                      'task-progress-percent--done': getTaskProgressDisplay(task).kind === 'done',
                      'task-progress-percent--idle': getTaskProgressDisplay(task).kind === 'idle',
                    }">{{ getTaskProgressDisplay(task).text }}</span>
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
      <!-- 中：当前任务可编辑项（超出时滚动） -->
      <section class="panel-zone panel-zone--middle">
        <div v-if="taskSwitching" class="zone-loading">正在切换任务...</div>
        <div v-else-if="!editorDraft" class="zone-empty">请选择任务以编辑配置</div>
        <div v-else class="task-editor" :class="{ 'task-editor--locked': isActiveTaskCalculating }">
          <div class="tag-section task-time-section">
            <div class="tag-section-head">任务基本信息</div>
            <div class="task-editor-times">
              <label class="time-field">
                <span class="time-label">开始时间</span>
                <input class="task-datetime-input" type="datetime-local" step="60"
                  :value="toTaskDatetimeLocalValue(editorDraft.beginDate)"
                  @input="handleBeginInput(($event.target as HTMLInputElement).value)" />
              </label>
              <label class="time-field">
                <span class="time-label">结束时间</span>
                <input class="task-datetime-input" type="datetime-local" step="60"
                  :value="toTaskDatetimeLocalValue(editorDraft.endDate)"
                  @input="handleEndInput(($event.target as HTMLInputElement).value)" />
              </label>
            </div>
            <div class="task-metric-rows">
              <div class="metric-row metric-row--readonly">
                <span class="metric-label">国家/组织</span>
                <span class="metric-value" :title="enemyCountryDisplayText">{{ enemyCountryDisplayText }}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">任务时长</span>
                <el-input-number v-model="durationHours" class="metric-input-number" size="small" :min="1" :max="8760"
                  :step="1" controls-position="right" @change="handleDurationHoursChange" />
                <span class="metric-unit">小时</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">链路时延</span>
                <el-input-number v-model="editorDraft.delayMin" class="metric-input-number" size="small" :min="1"
                  :max="4320" :step="1" controls-position="right" />
                <span class="metric-unit">分钟</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">覆盖率</span>
                <el-input-number v-model="editorDraft.coverage" class="metric-input-number" size="small" :min="0"
                  :max="100" :step="1" controls-position="right" />
                <span class="metric-unit">%</span>
              </div>
              <div class="metric-row metric-row--types">
                <span class="metric-label">卫星类型</span>
                <div class="tag-cloud metric-type-tags">
                  <el-tag v-for="typeName in TASK_PANEL_SATELLITE_TYPES" :key="typeName" class="task-config-tag"
                    :class="{ 'is-selected': isTargetTypeSelected(typeName) }"
                    :closable="isTargetTypeSelected(typeName)" disable-transitions @close="removeTargetType(typeName)"
                    @click="toggleTargetType(typeName)">
                    {{ typeName }}
                  </el-tag>
                </div>
              </div>
              <div class="metric-row metric-row--combat-head">
                <span class="metric-label">作战区域</span>
                <label class="combat-area-enable">
                  <el-checkbox v-model="editorDraft.combatArea.enabled">启用</el-checkbox>
                </label>
              </div>
              <div class="metric-row">
                <span class="metric-label">经度</span>
                <el-input-number v-model="editorDraft.combatArea.centerLon" class="metric-input-number" size="small"
                  :controls="false" :precision="4" :step="0.0001" :min="-180" :max="180" />
                <span class="metric-unit metric-unit--empty" aria-hidden="true" />
              </div>
              <div class="metric-row">
                <span class="metric-label">纬度</span>
                <el-input-number v-model="editorDraft.combatArea.centerLat" class="metric-input-number" size="small"
                  :controls="false" :precision="4" :step="0.0001" :min="-90" :max="90" />
                <span class="metric-unit metric-unit--empty" aria-hidden="true" />
              </div>
              <div class="metric-row">
                <span class="metric-label">半径</span>
                <el-input-number v-model="editorDraft.combatArea.radiusKm" class="metric-input-number" size="small"
                  :controls="false" :precision="0" :step="10" :min="1" :max="20000" />
                <span class="metric-unit">km</span>
              </div>
            </div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务卫星</div>
            <div v-if="seriesOptionsLoading" class="tag-hint">正在加载系列...</div>
            <div v-else-if="!seriesTagOptions.length" class="tag-hint">暂无系列候选项</div>
            <div v-else class="tag-cloud task-config-checkbox-list">
              <label v-for="item in seriesTagOptions" :key="item.id" class="task-config-checkbox">
                <el-checkbox :model-value="isSeriesSelected(item.id)" size="small"
                  @change="(checked) => handleSeriesCheckboxChange(item.id, checked)" />
                <span class="task-config-checkbox__label">{{ item.label }}</span>
              </label>
            </div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务武器</div>
            <div class="weapon-use-item">
              <span class="weapon-use-item-label">使用武器</span>
              <el-switch v-model="useWeaponsEnabled" size="small" @change="handleUseWeaponsChange" />
            </div>
            <template v-if="useWeaponsEnabled">
              <div v-if="weaponOptionsLoading" class="tag-hint">正在加载武器...</div>
              <div v-else-if="!weaponTagOptions.length" class="tag-hint">暂无武器候选项</div>
              <div v-else class="tag-cloud task-config-checkbox-list">
                <label v-for="item in weaponTagOptions" :key="item.id" class="task-config-checkbox">
                  <el-checkbox :model-value="isWeaponSelected(item.id)" size="small"
                    @change="(checked) => handleWeaponCheckboxChange(item.id, checked)" />
                  <span class="task-config-checkbox__label">{{ item.label }}</span>
                </label>
              </div>
            </template>
            <div v-else class="tag-hint">已关闭「使用武器」，武器选择已暂存；重新打开可恢复</div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务地面站</div>
            <div v-if="receiveOptionsLoading" class="tag-hint">正在加载地面站...</div>
            <div v-else-if="!receiveTagOptions.length" class="tag-hint">暂无地面站候选项</div>
            <div v-else class="tag-cloud task-config-checkbox-list">
              <label v-for="item in receiveTagOptions" :key="item.id" class="task-config-checkbox">
                <el-checkbox :model-value="isReceiveSelected(item.id)" size="small"
                  @change="(checked) => handleReceiveCheckboxChange(item.id, checked)" />
                <span class="task-config-checkbox__label">{{ item.label }}</span>
              </label>
            </div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务数据中心</div>
            <div v-if="centerOptionsLoading" class="tag-hint">正在加载数据中心...</div>
            <div v-else-if="!centerTagOptions.length" class="tag-hint">暂无数据中心候选项</div>
            <div v-else class="tag-cloud task-config-checkbox-list">
              <label v-for="item in centerTagOptions" :key="item.id" class="task-config-checkbox">
                <el-checkbox :model-value="isCenterSelected(item.id)" size="small"
                  @change="(checked) => handleCenterCheckboxChange(item.id, checked)" />
                <span class="task-config-checkbox__label">{{ item.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </section>
      <!-- 下：保存并重算 -->
      <footer class="panel-zone panel-zone--bottom">
        <el-button type="primary" class="save-recalc-btn" :loading="savingRecalc"
          :disabled="!editorDraft || taskSwitching || isActiveTaskCalculating" @click="handleSaveAndRecalculate">
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
 * 战场态势 - C2 左侧场景任务面板（上：任务进度列表，中：任务配置，下：保存并重算）。
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getTaskList, updateTask, getAllWeapons } from '@/api/dashboard'
import { getSatelliteSeries } from '@/api/task/task'
import { getGroundStationList } from '@/api/system/satellite-system-api'
import type { TaskForm } from '@/types/dashboard'
import type { MatrixResult } from '@/api/electronic'
import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import TaskEditDialog, { type TaskEditDialogMode } from '@/components/BattleSituation/TaskEditDialog.vue'
import {
  applyDurationHoursToDraft,
  buildSeriesOptionsFromApiData,
  calcTaskDurationHours,
  createDraftFromTask,
  fromTaskDatetimeLocalValue,
  isDataCenterStationType,
  mergeTaskFormWithDraft,
  normalizeTaskWeaponIds,
  parseTaskPanelTimeMs,
  TASK_PANEL_SATELLITE_TYPES,
  toTaskDatetimeLocalValue,
  type C2TaskEditorDraft,
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

/**
 * 任务是否处于算法计算中（有进度且未完成）。
 *
 * @param task 任务项
 * @returns 计算中为 true
 */
const isTaskCalculating = (task: TaskForm): boolean =>
  getTaskProgressDisplay(task).kind === 'running'

/** 当前选中任务是否正在计算（禁止编辑与保存并重算） */
const isActiveTaskCalculating = computed(() => {
  const task = store.activedTask
  if (!task) return false
  return isTaskCalculating(task)
})

const taskList = ref<TaskForm[]>([])
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
const seriesTagOptions = ref<TaskPanelTagOption[]>([])
const weaponTagOptions = ref<TaskPanelTagOption[]>([])
const receiveTagOptions = ref<TaskPanelTagOption[]>([])
const centerTagOptions = ref<TaskPanelTagOption[]>([])
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
 * 拉取当前场景任务列表。
 */
const loadBattleTasks = async () => {
  const battleId = store.battle?.id
  if (!battleId) {
    taskList.value = store.battle?.tasks || []
    return
  }
  taskLoading.value = true
  taskList.value = []
  try {
    const res = await getTaskList(battleId)
    if (res.code === 200 && Array.isArray(res.data)) {
      taskList.value = res.data
      await resumeTaskProgressPollingForTasks(res.data)
    } else {
      taskList.value = store.battle?.tasks || []
    }
  } catch (error) {
    console.error('加载场景任务列表失败:', error)
    taskList.value = store.battle?.tasks || []
  } finally {
    taskLoading.value = false
  }
}
watch(
  () => store.battle?.id,
  () => {
    void loadBattleTasks()
  },
  { immediate: true }
)
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

/**
 * 当前编辑任务蓝方（敌方）国家/组织展示文案。
 */
const enemyCountryDisplayText = computed(() => {
  const countries = resolveEnemyCountries(store.activedTask)
  return countries.length ? countries.join('、') : '--'
})
/**
 * 加载卫星系列候选项。
 *
 * @param task 当前任务
 */
const loadSeriesTagOptions = async (task: TaskForm | null | undefined) => {
  const countries = resolveEnemyCountries(task)
  const types = editorDraft.value?.targetTypeShow?.length
    ? [...editorDraft.value.targetTypeShow]
    : resolveTaskTargetTypes(task)
  if (!countries.length || !types.length) {
    seriesTagOptions.value = (editorDraft.value?.selectedSeries || []).map((series) => ({
      id: series,
      label: series,
    }))
    return
  }
  seriesOptionsLoading.value = true
  try {
    const res = await getSatelliteSeries(countries)
    if (res.code === 200 && res.data) {
      const options = buildSeriesOptionsFromApiData(res.data, types)
      const merged = new Set([...options, ...(editorDraft.value?.selectedSeries || [])])
      seriesTagOptions.value = [...merged]
        .sort((a, b) => a.localeCompare(b, 'zh-CN'))
        .map((series) => ({ id: series, label: series }))
    } else {
      seriesTagOptions.value = (editorDraft.value?.selectedSeries || []).map((series) => ({
        id: series,
        label: series,
      }))
    }
  } catch {
    seriesTagOptions.value = (editorDraft.value?.selectedSeries || []).map((series) => ({
      id: series,
      label: series,
    }))
  } finally {
    seriesOptionsLoading.value = false
  }
}
/**
 * 加载武器候选项。
 */
const loadWeaponTagOptions = async () => {
  weaponOptionsLoading.value = true
  try {
    const res = await getAllWeapons()
    const list = res.code === 200 ? (res.data?.weapons ?? []) : []
    weaponTagOptions.value = list
      .map((weapon) => ({
        id: String(weapon.id ?? ''),
        label: weapon.name || String(weapon.id ?? ''),
      }))
      .filter((item) => item.id)
  } catch {
    weaponTagOptions.value = (editorDraft.value?.selectedWeaponIds || []).map((id) => ({
      id,
      label: id,
    }))
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
    receiveTagOptions.value = list
      .filter((item) => !isDataCenterStationType(item.type || ''))
      .map((item) => ({
        id: item._id || item.name,
        label: item.name || item._id || '',
      }))
      .filter((item) => item.id)
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
    centerTagOptions.value = list
      .filter((item) => isDataCenterStationType(item.type || ''))
      .map((item) => ({
        id: item._id || item.name,
        label: item.name || item._id || '',
      }))
      .filter((item) => item.id)
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
 */
const syncEditorForTask = async (task: TaskForm | null | undefined) => {
  editorDraft.value = createDraftFromTask(task)
  if (task && editorDraft.value) {
    durationHours.value = calcTaskDurationHours(editorDraft.value.beginDate, editorDraft.value.endDate)
    editorDraft.value.selectedWeaponIds = normalizeTaskWeaponIds(editorDraft.value.selectedWeaponIds)
    stashedWeaponIds.value = [...editorDraft.value.selectedWeaponIds]
    useWeaponsEnabled.value = editorDraft.value.selectedWeaponIds.length > 0
    store.setTaskCombatArea({ ...editorDraft.value.combatArea })
  } else {
    stashedWeaponIds.value = []
    useWeaponsEnabled.value = false
    store.setTaskCombatArea(null)
  }
  if (!task) return
  await Promise.all([
    loadSeriesTagOptions(task),
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
watch(
  () =>
    editorDraft.value
      ? ([editorDraft.value.beginDate, editorDraft.value.endDate] as const)
      : null,
  (range) => {
    if (!range || !editorDraft.value) return
    durationHours.value = calcTaskDurationHours(range[0], range[1])
  }
)
const isTargetTypeSelected = (typeName: string) =>
  editorDraft.value?.targetTypeShow.includes(typeName) ?? false
/**
 * 选中卫星类型并刷新系列候选项。
 *
 * @param typeName 类型名
 */
const toggleTargetType = (typeName: string) => {
  if (!editorDraft.value || editorDraft.value.targetTypeShow.includes(typeName)) return
  editorDraft.value.targetTypeShow = [...editorDraft.value.targetTypeShow, typeName]
  void loadSeriesTagOptions(store.activedTask)
}
/**
 * 取消卫星类型；至少保留一种。
 *
 * @param typeName 类型名
 */
const removeTargetType = (typeName: string) => {
  if (!editorDraft.value) return
  if (editorDraft.value.targetTypeShow.length <= 1) {
    ElMessage.warning('请至少保留一种卫星类型')
    return
  }
  editorDraft.value.targetTypeShow = editorDraft.value.targetTypeShow.filter((item) => item !== typeName)
  void loadSeriesTagOptions(store.activedTask)
}
/**
 * 修改任务时长时联动结束时间。
 *
 * @param value 小时数
 */
const handleDurationHoursChange = (value: number | undefined) => {
  if (!editorDraft.value || value == null || Number.isNaN(value)) return
  applyDurationHoursToDraft(editorDraft.value, value)
  durationHours.value = Math.max(1, Math.round(value))
}
const isSeriesSelected = (series: string) => editorDraft.value?.selectedSeries.includes(series) ?? false
const isWeaponSelected = (id: string) => editorDraft.value?.selectedWeaponIds.includes(id) ?? false
const isReceiveSelected = (id: string) => editorDraft.value?.selectedReceiveIds.includes(id) ?? false
const isCenterSelected = (id: string) => editorDraft.value?.stationIds.includes(id) ?? false
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

const toggleWeapon = (id: string) => {
  if (!useWeaponsEnabled.value || !editorDraft.value || !id) return
  const current = normalizeTaskWeaponIds(editorDraft.value.selectedWeaponIds)
  if (current.includes(id)) return
  editorDraft.value.selectedWeaponIds = normalizeTaskWeaponIds([...current, id])
  stashedWeaponIds.value = [...editorDraft.value.selectedWeaponIds]
}
const removeWeapon = (id: string) => {
  if (!useWeaponsEnabled.value || !editorDraft.value) return
  editorDraft.value.selectedWeaponIds = normalizeTaskWeaponIds(
    editorDraft.value.selectedWeaponIds.filter((item) => item !== id),
  )
  stashedWeaponIds.value = [...editorDraft.value.selectedWeaponIds]
}
const toggleReceive = (id: string) => {
  if (!editorDraft.value || editorDraft.value.selectedReceiveIds.includes(id)) return
  editorDraft.value.selectedReceiveIds = [...editorDraft.value.selectedReceiveIds, id]
}
const removeReceive = (id: string) => {
  if (!editorDraft.value) return
  editorDraft.value.selectedReceiveIds = editorDraft.value.selectedReceiveIds.filter((item) => item !== id)
}
const toggleCenter = (id: string) => {
  if (!editorDraft.value || editorDraft.value.stationIds.includes(id)) return
  editorDraft.value.stationIds = [...editorDraft.value.stationIds, id]
}
const removeCenter = (id: string) => {
  if (!editorDraft.value) return
  editorDraft.value.stationIds = editorDraft.value.stationIds.filter((item) => item !== id)
}

/**
 * 卫星系列 checkbox 变更。
 *
 * @param series 系列名
 * @param checked 是否勾选
 */
const handleSeriesCheckboxChange = (series: string, checked: boolean | string | number) => {
  if (checked) toggleSeries(series)
  else removeSeries(series)
}

/**
 * 武器 checkbox 变更。
 *
 * @param id 武器 ID
 * @param checked 是否勾选
 */
const handleWeaponCheckboxChange = (id: string, checked: boolean | string | number) => {
  if (checked) toggleWeapon(id)
  else removeWeapon(id)
}

/**
 * 地面站 checkbox 变更。
 *
 * @param id 地面站 ID
 * @param checked 是否勾选
 */
const handleReceiveCheckboxChange = (id: string, checked: boolean | string | number) => {
  if (checked) toggleReceive(id)
  else removeReceive(id)
}

/**
 * 数据中心 checkbox 变更。
 *
 * @param id 数据中心 ID
 * @param checked 是否勾选
 */
const handleCenterCheckboxChange = (id: string, checked: boolean | string | number) => {
  if (checked) toggleCenter(id)
  else removeCenter(id)
}

/**
 * 更新开始时间。
 *
 * @param value datetime-local 值
 */
const handleBeginInput = (value: string) => {
  if (!editorDraft.value) return
  editorDraft.value.beginDate = fromTaskDatetimeLocalValue(value)
}
/**
 * 更新结束时间。
 *
 * @param value datetime-local 值
 */
const handleEndInput = (value: string) => {
  if (!editorDraft.value) return
  editorDraft.value.endDate = fromTaskDatetimeLocalValue(value)
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

const handleTaskSaved = async (updated: TaskForm) => {
  const isCreate = !taskList.value.some((item) => item.id === updated.id)
  await loadBattleTasks()
  if (!updated.id) return
  await startTaskProgressPolling(updated.id)
  const latest = taskList.value.find((item) => item.id === updated.id) || updated
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
  /** 1. 校验任务基本信息 */
  const baseTask = store.activedTask
  /** 2. 校验任务编辑器数据 */
  const draft = editorDraft.value
  /** 3. 校验任务编辑器数据与任务基本信息一致 */
  if (!baseTask?.id || !draft || draft.taskId !== baseTask.id) {
    ElMessage.warning('请先选择任务')
    return
  }
  /** 4. 校验任务是否正在计算 */
  if (isTaskCalculating(baseTask)) {
    ElMessage.warning('任务计算中，请完成后再保存并重算')
    return
  }
  /** 5. 校验任务开始与结束时间 */
  if (!draft.beginDate || !draft.endDate) {
    ElMessage.warning('请填写开始与结束时间')
    return
  }
  /** 6. 校验任务开始与结束时间 */
  if (parseTaskPanelTimeMs(draft.endDate) <= parseTaskPanelTimeMs(draft.beginDate)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  /** 7. 校验任务卫星系列 */
  if (!draft.selectedSeries.length) {
    ElMessage.warning('请至少保留一个卫星系列')
    return
  }
  /** 8. 校验任务卫星类型 */
  if (!draft.targetTypeShow.length) {
    ElMessage.warning('请至少选择一种卫星类型')
    return
  }
  /** 9. 合并任务编辑器数据与任务基本信息 */
  const payload = mergeTaskFormWithDraft(baseTask, draft)
  /** 10. 保存并重算任务 */
  savingRecalc.value = true
  try {
    const res = await updateTask(payload)
    if (res.code !== 200) {
      ElMessage.error(res.msg || '保存任务失败')
      return
    }
    ElMessage.success('已保存，任务重新计算中')
    /** 11. 刷新任务列表 */
    await loadBattleTasks()
    /** 12. 设置当前选中任务 */
    const latest = taskList.value.find((item) => item.id === baseTask.id) || payload
    /** 12. 设置当前选中任务 */
    store.setActivedTask(latest)
    /** 13. 清除任务分析数据 */
    store.setSelectedSatSeries('')
    /** 13. 清除任务分析数据 */
    store.clearTaskAnalysisData()
    /** 14. 启动任务进度轮询 */
    await startTaskProgressPolling(baseTask.id)
    /** 15. 同步任务编辑器数据 */
    await syncEditorForTask(latest)
    /** 16. 触发任务重算事件 */
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

.task-time-section .task-editor-times {
  margin-bottom: 0;
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

.task-config-checkbox {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  column-gap: 8px;
  margin: 0;
  min-height: 30px;
  padding: 4px 8px;
  box-sizing: border-box;
  border-radius: 4px;
  border: 1px solid rgba(100, 116, 139, 0.35);
  background: rgba(15, 23, 42, 0.65);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.18s ease, background 0.18s ease;

  &:has(.el-checkbox.is-checked) {
    border-color: rgba(0, 225, 255, 0.55);
    background: rgba(0, 225, 255, 0.1);
  }

  :deep(.el-checkbox) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 18px;
    margin: 0;
    line-height: 1;
  }

  :deep(.el-checkbox__input) {
    vertical-align: middle;
  }

  :deep(.el-checkbox__label) {
    display: none;
  }
}

.task-config-checkbox__label {
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-config-checkbox:has(.el-checkbox.is-checked) .task-config-checkbox__label {
  color: #e0f2fe;
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
