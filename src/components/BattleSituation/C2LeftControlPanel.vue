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
              <div v-if="editorDraft.taskApiError" class="combat-area-api-error" role="alert">
                {{ editorDraft.taskApiError }}
              </div>
              <div v-if="scheduleDurationError" class="combat-area-api-error" role="alert">
                {{ scheduleDurationError }}
              </div>
              <div v-if="showTaskDurationDelayCoverageInUi" class="metric-row">
                <span class="metric-label">任务时长</span>
                <el-input-number v-model="durationHours" class="metric-input-number" size="small" :min="1" :max="8760"
                  :step="1" controls-position="right"
                  :disabled="Boolean(editorDraft.taskApiError || scheduleDurationError)"
                  @change="handleDurationHoursChange" />
                <span class="metric-unit">小时</span>
              </div>
              <div v-if="showTaskDurationDelayCoverageInUi && editorDraft.delayMin != null" class="metric-row">
                <span class="metric-label">链路时延</span>
                <el-input-number v-model="editorDraft.delayMin" class="metric-input-number" size="small" :min="1"
                  :max="4320" :step="1" controls-position="right" />
                <span class="metric-unit">分钟</span>
              </div>
              <div v-if="showTaskDurationDelayCoverageInUi && editorDraft.coverage != null" class="metric-row">
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
              <template v-if="showTaskCombatAreaInUi">
                <div class="metric-row metric-row--combat-head">
                  <span class="metric-label">作战区域</span>
                  <label v-if="editorDraft.combatArea" class="combat-area-enable">
                    <el-checkbox v-model="editorDraft.combatArea.enabled">启用</el-checkbox>
                  </label>
                </div>
                <template v-if="editorDraft.combatArea">
                  <div class="metric-row">
                    <span class="metric-label">经度</span>
                    <el-input-number v-model="editorDraft.combatArea.centerLon" class="metric-input-number"
                      size="small" :controls="false" :precision="4" :step="0.0001" :min="-180" :max="180" />
                    <span class="metric-unit metric-unit--empty" aria-hidden="true" />
                  </div>
                  <div class="metric-row">
                    <span class="metric-label">纬度</span>
                    <el-input-number v-model="editorDraft.combatArea.centerLat" class="metric-input-number"
                      size="small" :controls="false" :precision="4" :step="0.0001" :min="-90" :max="90" />
                    <span class="metric-unit metric-unit--empty" aria-hidden="true" />
                  </div>
                  <div class="metric-row">
                    <span class="metric-label">半径</span>
                    <el-input-number v-model="editorDraft.combatArea.radiusKm" class="metric-input-number"
                      size="small" :controls="false" :precision="0" :step="10" :min="0" :max="20000" />
                    <span class="metric-unit">km</span>
                  </div>
                </template>
              </template>
            </div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务卫星</div>
            <div v-if="seriesOptionsLoading" class="tag-hint">正在加载系列...</div>
            <div v-else-if="!seriesTagOptions.length" class="tag-hint">暂无系列候选项</div>
            <div v-else class="resource-pick-block">
              <div class="resource-pick-group">
                <div class="resource-pick-group__title">已选择（{{ seriesTagOptionGroups.selected.length }}）</div>
                <div v-if="!seriesTagOptionGroups.selected.length" class="tag-hint">暂无已选系列</div>
                <div v-else class="tag-cloud task-config-checkbox-list">
                  <TaskPanelResourceCheckbox v-for="item in seriesTagOptionGroups.selected" :key="`sel-${item.id}`"
                    :item="item" :selected="true" resource-kind="series"
                    :class="{ 'task-config-checkbox--analysis-focus': store.selectedSatSeries === item.id }"
                    @change="(checked) => handleSeriesCheckboxChange(item.id, checked)"
                    @label-click="handleSeriesLabelFocus(item.id)"
                    @detail="handleTaskResourceDetail" />
                </div>
              </div>
              <div v-if="seriesTagOptionGroups.unselected.length" class="resource-pick-group resource-pick-group--pool">
                <button type="button" class="resource-pick-group__toggle"
                  :aria-expanded="resourcePoolExpanded.series"
                  @click="resourcePoolExpanded.series = !resourcePoolExpanded.series">
                  <span>未选择（{{ seriesTagOptionGroups.unselected.length }}）</span>
                  <span class="resource-pick-group__chevron" :class="{ 'is-open': resourcePoolExpanded.series }"
                    aria-hidden="true">▸</span>
                </button>
                <div v-show="resourcePoolExpanded.series" class="tag-cloud task-config-checkbox-list">
                  <TaskPanelResourceCheckbox v-for="item in seriesTagOptionGroups.unselected" :key="`pool-${item.id}`"
                    :item="item" :selected="false" resource-kind="series"
                    @change="(checked) => handleSeriesCheckboxChange(item.id, checked)"
                    @label-click="handleSeriesLabelFocus(item.id)"
                    @detail="handleTaskResourceDetail" />
                </div>
              </div>
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
              <div v-else class="resource-pick-block">
                <div class="resource-pick-group">
                  <div class="resource-pick-group__title">已选择（{{ weaponTagOptionGroups.selected.length }}）</div>
                  <div v-if="!weaponTagOptionGroups.selected.length" class="tag-hint">暂无已选武器</div>
                  <div v-else class="tag-cloud task-config-checkbox-list">
                    <TaskPanelResourceCheckbox v-for="item in weaponTagOptionGroups.selected" :key="`sel-${item.id}`"
                      :item="item" :selected="true" resource-kind="weapon"
                      @change="(checked) => handleWeaponCheckboxChange(item.id, checked)"
                      @detail="handleTaskResourceDetail" />
                  </div>
                </div>
                <div v-if="weaponTagOptionGroups.unselected.length" class="resource-pick-group resource-pick-group--pool">
                  <button type="button" class="resource-pick-group__toggle"
                    :aria-expanded="resourcePoolExpanded.weapon"
                    @click="resourcePoolExpanded.weapon = !resourcePoolExpanded.weapon">
                    <span>未选择（{{ weaponTagOptionGroups.unselected.length }}）</span>
                    <span class="resource-pick-group__chevron" :class="{ 'is-open': resourcePoolExpanded.weapon }"
                      aria-hidden="true">▸</span>
                  </button>
                  <div v-show="resourcePoolExpanded.weapon" class="tag-cloud task-config-checkbox-list">
                    <TaskPanelResourceCheckbox v-for="item in weaponTagOptionGroups.unselected" :key="`pool-${item.id}`"
                      :item="item" :selected="false" resource-kind="weapon"
                      @change="(checked) => handleWeaponCheckboxChange(item.id, checked)"
                      @detail="handleTaskResourceDetail" />
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="tag-hint">已关闭「使用武器」，武器选择已暂存；重新打开可恢复</div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务地面站</div>
            <div v-if="receiveOptionsLoading" class="tag-hint">正在加载地面站...</div>
            <div v-else-if="!receiveTagOptions.length" class="tag-hint">暂无地面站候选项</div>
            <div v-else class="resource-pick-block">
              <div class="resource-pick-group">
                <div class="resource-pick-group__title">已选择（{{ receiveTagOptionGroups.selected.length }}）</div>
                <div v-if="!receiveTagOptionGroups.selected.length" class="tag-hint">暂无已选地面站</div>
                <div v-else class="tag-cloud task-config-checkbox-list">
                  <TaskPanelResourceCheckbox v-for="item in receiveTagOptionGroups.selected" :key="`sel-${item.id}`"
                    :item="item" :selected="true" resource-kind="receive"
                    @change="(checked) => handleReceiveCheckboxChange(item.id, checked)"
                    @detail="handleTaskResourceDetail" />
                </div>
              </div>
              <div v-if="receiveTagOptionGroups.unselected.length" class="resource-pick-group resource-pick-group--pool">
                <button type="button" class="resource-pick-group__toggle"
                  :aria-expanded="resourcePoolExpanded.receive"
                  @click="resourcePoolExpanded.receive = !resourcePoolExpanded.receive">
                  <span>未选择（{{ receiveTagOptionGroups.unselected.length }}）</span>
                  <span class="resource-pick-group__chevron" :class="{ 'is-open': resourcePoolExpanded.receive }"
                    aria-hidden="true">▸</span>
                </button>
                <div v-show="resourcePoolExpanded.receive" class="tag-cloud task-config-checkbox-list">
                  <TaskPanelResourceCheckbox v-for="item in receiveTagOptionGroups.unselected" :key="`pool-${item.id}`"
                    :item="item" :selected="false" resource-kind="receive"
                    @change="(checked) => handleReceiveCheckboxChange(item.id, checked)"
                    @detail="handleTaskResourceDetail" />
                </div>
              </div>
            </div>
          </div>
          <div class="tag-section">
            <div class="tag-section-head">任务数据中心</div>
            <div v-if="centerOptionsLoading" class="tag-hint">正在加载数据中心...</div>
            <div v-else-if="!centerTagOptions.length" class="tag-hint">暂无数据中心候选项</div>
            <div v-else class="resource-pick-block">
              <div class="resource-pick-group">
                <div class="resource-pick-group__title">已选择（{{ centerTagOptionGroups.selected.length }}）</div>
                <div v-if="!centerTagOptionGroups.selected.length" class="tag-hint">暂无已选数据中心</div>
                <div v-else class="tag-cloud task-config-checkbox-list">
                  <TaskPanelResourceCheckbox v-for="item in centerTagOptionGroups.selected" :key="`sel-${item.id}`"
                    :item="item" :selected="true" resource-kind="center"
                    @change="(checked) => handleCenterCheckboxChange(item.id, checked)"
                    @detail="handleTaskResourceDetail" />
                </div>
              </div>
              <div v-if="centerTagOptionGroups.unselected.length" class="resource-pick-group resource-pick-group--pool">
                <button type="button" class="resource-pick-group__toggle"
                  :aria-expanded="resourcePoolExpanded.center"
                  @click="resourcePoolExpanded.center = !resourcePoolExpanded.center">
                  <span>未选择（{{ centerTagOptionGroups.unselected.length }}）</span>
                  <span class="resource-pick-group__chevron" :class="{ 'is-open': resourcePoolExpanded.center }"
                    aria-hidden="true">▸</span>
                </button>
                <div v-show="resourcePoolExpanded.center" class="tag-cloud task-config-checkbox-list">
                  <TaskPanelResourceCheckbox v-for="item in centerTagOptionGroups.unselected" :key="`pool-${item.id}`"
                    :item="item" :selected="false" resource-kind="center"
                    @change="(checked) => handleCenterCheckboxChange(item.id, checked)"
                    @detail="handleTaskResourceDetail" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <!-- 下：保存并重算 -->
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
 * 战场态势 - C2 左侧场景任务面板（上：任务进度列表，中：任务配置，下：保存并重算）。
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getTaskList, updateTask, getAllWeapons } from '@/api/dashboard'
import { getSatelliteSeries } from '@/api/task/task'
import { getGroundStationList, type BaseStationInfo } from '@/api/system/satellite-system-api'
import type { TaskForm, Weapon } from '@/types/dashboard'
import type { MatrixResult } from '@/api/electronic'
import { taskProgressMap, useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import TaskEditDialog, { type TaskEditDialogMode } from '@/components/BattleSituation/TaskEditDialog.vue'
import TaskPanelResourceCheckbox from '@/components/BattleSituation/TaskPanelResourceCheckbox.vue'
import {
  applyDurationHoursToDraft,
  buildSeriesOptionsFromApiData,
  calcTaskDurationHours,
  createDraftFromTask,
  fromTaskDatetimeLocalValue,
  isDataCenterStationType,
  mergeTaskFormWithDraft,
  notifyTaskListValidationErrors,
  normalizeTaskWeaponIds,
  parseTaskPanelTimeMs,
  SHOW_TASK_DURATION_DELAY_COVERAGE_IN_UI,
  SHOW_TASK_COMBAT_AREA_IN_UI,
  TASK_PANEL_SATELLITE_TYPES,
  toTaskDatetimeLocalValue,
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
/** 是否展示任务时长 / 链路时延 / 覆盖率表单项（仅 UI） */
const showTaskDurationDelayCoverageInUi = SHOW_TASK_DURATION_DELAY_COVERAGE_IN_UI
/** 是否展示作战区域 / 启用 / 经纬度 / 半径表单项（仅 UI） */
const showTaskCombatAreaInUi = SHOW_TASK_COMBAT_AREA_IN_UI

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
const seriesTagOptions = ref<TaskPanelTagOption[]>([])
const weaponTagOptions = ref<TaskPanelTagOption[]>([])
const receiveTagOptions = ref<TaskPanelTagOption[]>([])
const centerTagOptions = ref<TaskPanelTagOption[]>([])

/** 武器库 ID → 接口记录（详情展示用） */
const weaponRecordById = ref<Map<string, Weapon>>(new Map())

/** 基站/数据中心 ID → 接口记录（详情展示用） */
const groundStationRecordById = ref<Map<string, BaseStationInfo>>(new Map())

/** 候选项「未选择」分区是否展开（默认折叠） */
const resourcePoolExpanded = ref({
  series: false,
  weapon: false,
  receive: false,
  center: false,
})
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

/**
 * 当前编辑任务蓝方（敌方）国家/组织展示文案。
 */
const enemyCountryDisplayText = computed(() => {
  const countries = resolveEnemyCountries(store.activedTask)
  return countries.length ? countries.join('、') : '--'
})
/** 进行中的 getSatelliteSeries 请求（同参数合并，避免刷新时重复调用） */
let seriesOptionsInflight: { queryKey: string; promise: Promise<void> } | null = null

/**
 * 生成系列候选项接口查询键（国家 + 卫星类型）。
 *
 * @param task 当前任务
 * @returns 用于去重的键
 */
const buildSeriesOptionsQueryKey = (task: TaskForm | null | undefined): string => {
  const countries = resolveEnemyCountries(task)
  const types = editorDraft.value?.targetTypeShow?.length
    ? [...editorDraft.value.targetTypeShow]
    : resolveTaskTargetTypes(task)
  return `${[...countries].sort().join('\u0001')}|${[...types].sort().join('\u0001')}`
}

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
  const queryKey = buildSeriesOptionsQueryKey(task)
  if (seriesOptionsInflight?.queryKey === queryKey) {
    await seriesOptionsInflight.promise
    return
  }

  const loadPromise = (async () => {
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
  })()

  seriesOptionsInflight = { queryKey, promise: loadPromise }
  try {
    await loadPromise
  } finally {
    if (seriesOptionsInflight?.promise === loadPromise) {
      seriesOptionsInflight = null
    }
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

/** 按是否已选拆分候选项（上：已选，下：未选） */
interface TaskPanelTagOptionGroups {
  /** 已勾选项 */
  selected: TaskPanelTagOption[]
  /** 未勾选项 */
  unselected: TaskPanelTagOption[]
}

/**
 * 将候选项拆成已选 / 未选两组。
 *
 * @param options 全部候选项
 * @param isSelected 是否已选
 * @returns 分组结果
 */
const splitTaskPanelTagOptions = (
  options: TaskPanelTagOption[],
  isSelected: (id: string) => boolean,
): TaskPanelTagOptionGroups => {
  const selected: TaskPanelTagOption[] = []
  const unselected: TaskPanelTagOption[] = []
  for (const item of options) {
    if (isSelected(item.id)) selected.push(item)
    else unselected.push(item)
  }
  return { selected, unselected }
}

const seriesTagOptionGroups = computed(() =>
  splitTaskPanelTagOptions(seriesTagOptions.value, isSeriesSelected),
)
const weaponTagOptionGroups = computed(() =>
  splitTaskPanelTagOptions(weaponTagOptions.value, isWeaponSelected),
)
const receiveTagOptionGroups = computed(() =>
  splitTaskPanelTagOptions(receiveTagOptions.value, isReceiveSelected),
)
const centerTagOptionGroups = computed(() =>
  splitTaskPanelTagOptions(centerTagOptions.value, isCenterSelected),
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
  if (!editorDraft.value.selectedWeaponIds.length) {
    useWeaponsEnabled.value = false
  }
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
/**
 * 将当前分析系列同步到 Store 并通知地球高亮。
 *
 * @param series 系列名
 */
const focusTaskSeriesForAnalysis = (series: string) => {
  const trimmed = series.trim()
  if (!trimmed) return
  if (!editorDraft.value?.selectedSeries.includes(trimmed)) return
  store.setSelectedSatSeries(trimmed)
  emit('focus-task-series', trimmed)
}

/**
 * 点击系列名称：已装配系列则聚焦到地图与分析页。
 *
 * @param series 系列名
 */
const handleSeriesLabelFocus = (series: string) => {
  if (!editorDraft.value?.selectedSeries.includes(series)) return
  focusTaskSeriesForAnalysis(series)
}

const handleSeriesCheckboxChange = (series: string, checked: boolean | string | number) => {
  if (checked) {
    toggleSeries(series)
    focusTaskSeriesForAnalysis(series)
  } else {
    removeSeries(series)
    if (store.selectedSatSeries === series) {
      const next = editorDraft.value?.selectedSeries[0]
      if (next) {
        focusTaskSeriesForAnalysis(next)
      } else {
        store.setSelectedSatSeries('')
      }
    }
  }
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
  let payload: TaskForm
  try {
    payload = mergeTaskFormWithDraft(baseTask, draft)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '作战区域数据不完整，无法保存'
    ElMessage.error(msg)
    return
  }
  /** 10. 保存并重算任务 */
  savingRecalc.value = true
  try {
    const res = await updateTask(payload)
    if (res.code !== 200) {
      ElMessage.error(res.msg || '保存任务失败')
      return
    }
    ElMessage.success('已保存，任务重新计算中')
    taskProgressCompleteNotified.delete(baseTask.id)
    /** 11. 先订阅 WS，避免 loadBattleTasks 期间完成推送被后续 start 重置 */
    await startTaskProgressPolling(baseTask.id)
    /** 12. 刷新任务列表 */
    await loadBattleTasks()
    const latest = requireTaskFromList(baseTask.id)
    if (!latest) return
    store.setActivedTask(latest)
    /** 13. 清除任务分析数据 */
    store.setSelectedSatSeries('')
    store.clearTaskAnalysisData()
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
