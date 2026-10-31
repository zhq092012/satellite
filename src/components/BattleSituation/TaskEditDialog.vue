<template>
  <el-dialog v-model="visible" :title="dialogTitle" fullscreen append-to-body destroy-on-close class="task-edit-dialog"
    modal-class="task-edit-dialog-modal" @closed="handleClosed">
    <div class="task-edit-layout">
      <nav class="task-edit-nav" aria-label="任务配置菜单">
        <button v-for="item in taskEditMenus" :key="item.key" type="button" class="task-edit-nav-item"
          :class="{ 'is-active': activeTab === item.key }" @click="activeTab = item.key">
          <span class="task-edit-nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="task-edit-main">
        <div v-show="activeTab === 'basic'" class="task-edit-pane">
          <el-form ref="formRef" :model="taskForm" :rules="formRules" label-width="96px" class="task-edit-form">
            <el-form-item label="任务名称" prop="name">
              <el-input v-model="taskForm.name" maxlength="80" show-word-limit placeholder="请输入任务名称" />
            </el-form-item>
            <el-form-item label="任务概述" prop="description">
              <el-input v-model="taskForm.description" type="textarea" :rows="3" maxlength="400" show-word-limit
                placeholder="请输入任务概述" />
            </el-form-item>
            <el-form-item label="开始时间" prop="beginDate">
              <input class="task-datetime-input" type="datetime-local" step="60"
                :value="toDatetimeLocalValue(taskForm.beginDate)"
                @input="handleBeginInput(($event.target as HTMLInputElement).value)" />
            </el-form-item>
            <el-form-item label="结束时间" prop="endDate">
              <input class="task-datetime-input" type="datetime-local" step="60"
                :value="toDatetimeLocalValue(taskForm.endDate)"
                @input="handleEndInput(($event.target as HTMLInputElement).value)" />
            </el-form-item>
            <div v-if="taskListItemApiError" class="task-edit-api-error" role="alert">
              {{ taskListItemApiError }}
            </div>
            <div v-if="showTaskDurationDelayCoverageInUi" class="task-edit-metrics-grid">
              <el-form-item label="任务时长" class="task-edit-metrics-grid__left-cell">
                <div class="metric-input-row">
                  <el-input-number v-model="durationHours" :min="1" :max="8760" :step="1" :controls="true"
                    controls-position="right" class="metric-input-number" @change="handleDurationHoursChange" />
                  <span class="metric-input-unit">小时</span>
                </div>
              </el-form-item>

              <el-form-item v-if="showTaskMetricsInputs" label="链路时延" class="task-edit-metrics-grid__left-cell">
                <div class="metric-input-row">
                  <el-input-number v-model="linkDelayMin" :min="1" :max="4320" :step="1" :controls="true"
                    controls-position="right" class="metric-input-number" />
                  <span class="metric-input-unit">分钟</span>
                </div>
              </el-form-item>

              <el-form-item v-if="showTaskMetricsInputs" label="覆盖率" class="task-edit-metrics-grid__left-cell">
                <div class="metric-input-row">
                  <el-input-number v-model="taskCoverage" :min="0" :max="100" :step="1" :controls="true"
                    controls-position="right" class="metric-input-number" />
                  <span class="metric-input-unit">%</span>
                </div>
              </el-form-item>
            </div>
            <el-form-item label="卫星类型" prop="targetTypeShow">
              <el-select v-model="taskForm.targetTypeShow" multiple placeholder="请选择卫星类型"
                popper-class="task-edit-select-popper" style="width: 100%" @change="handleTargetTypeShowChange">
                <el-option v-for="item in satelliteTypes" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="红方" prop="meCountryShow">
              <el-checkbox-group v-model="taskForm.meCountryShow" class="country-checkbox-group"
                @change="handleCountryShowChange">
                <el-checkbox v-for="item in RED_COUNTRY_OPTIONS" :key="`me-${item}`" :value="item">{{ item }}</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="蓝方" prop="enemyCountryShow">
              <el-checkbox-group v-model="taskForm.enemyCountryShow" class="country-checkbox-group"
                @change="handleCountryShowChange">
                <el-checkbox v-for="item in BLUE_COUNTRY_OPTIONS" :key="`enemy-${item}`" :value="item">{{ item }}</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
          </el-form>
        </div>

        <TaskAssembleTab ref="satelliteAssembleRef" v-show="activeTab === 'satellite'" kind="satellite"
          :reset-key="assembleResetKey" :enemy-countries="taskForm.enemyCountryShow"
          :target-types="taskForm.targetTypeShow" />
        <TaskAssembleTab ref="stationAssembleRef" v-show="activeTab === 'station'" kind="station"
          :reset-key="assembleResetKey" />
        <TaskAssembleTab ref="centerAssembleRef" v-show="activeTab === 'center'" kind="center"
          :reset-key="assembleResetKey" />
        <TaskAssembleTab ref="weaponAssembleRef" v-show="activeTab === 'weapon'" kind="weapon"
          :reset-key="assembleResetKey" />
      </div>
    </div>
    <template #footer>
      <div class="task-edit-footer">
        <el-button class="task-edit-btn task-edit-btn--ghost" @click="visible = false">取 消</el-button>
        <el-button v-if="canSave" class="task-edit-btn task-edit-btn--primary" type="primary" :loading="submitting"
          @click="handleSubmit">
          保 存
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { updateTask } from '@/api/dashboard'
import { addTask } from '@/api/task/task'
import type { TaskForm } from '@/types/dashboard'
import {
  combatAreaToApiFields,
  fromTaskDatetimeLocalValue as fromDatetimeLocalValue,
  materializeTaskListItemFromApi,
  normalizeTaskCombatArea,
  normalizeTaskDateTime as normalizeDateTime,
  parseTaskPanelTimeMs as parseTaskTimeMs,
  SHOW_TASK_DURATION_DELAY_COVERAGE_IN_UI,
  TaskListItemFromApiError,
  toTaskDatetimeLocalValue as toDatetimeLocalValue,
} from '@/utils/c2TaskPanelEditor'
import { formatTaskMinuteDateTime } from '@/utils/tools/dateFormat'

/** 是否展示任务时长 / 链路时延 / 覆盖率表单项（仅 UI） */
const showTaskDurationDelayCoverageInUi = SHOW_TASK_DURATION_DELAY_COVERAGE_IN_UI
import { useLayoutStore } from '@/store/modules/layout'
import TaskAssembleTab, { type TaskAssembleRow } from '@/components/BattleSituation/TaskAssembleTab.vue'

/** 任务弹窗左侧菜单 key。 */
type TaskEditTabKey = 'basic' | 'satellite' | 'station' | 'center' | 'weapon'

/** 左侧竖向菜单项。 */
interface TaskEditMenuItem {
  /** 对应右侧内容页 */
  key: TaskEditTabKey
  /** 菜单文案 */
  label: string
}

const store = useLayoutStore()

/** 作战目标可选项（与任务创建五大类一致）。 */
const SATELLITE_TYPES = ['侦察', '通信'] as const

/** 新建任务默认红方国家 */
const DEFAULT_ME_COUNTRIES = ['中国'] as const
/** 新建任务默认蓝方国家 */
const DEFAULT_ENEMY_COUNTRIES = ['美国'] as const
/** 添加/修改任务时红方可选国家 */
const RED_COUNTRY_OPTIONS = ['中国'] as const
/** 添加/修改任务时蓝方可选国家 */
const BLUE_COUNTRY_OPTIONS = ['美国', '日本', '中国台湾'] as const
/** 新建任务默认卫星类型（侦察、通信全选） */
const DEFAULT_TARGET_TYPES = [...SATELLITE_TYPES] as string[]
/** 新建任务默认时长（小时） */
const DEFAULT_TASK_DURATION_HOURS = 8

/** 任务弹窗模式：新建、只读查看、可保存修改。 */
export type TaskEditDialogMode = 'create' | 'view' | 'edit'

const props = defineProps<{
  /** 对话框是否可见。 */
  modelValue: boolean
  /** 弹窗模式（推荐）；未传时由 isEdit / viewOnly 推导。 */
  mode?: TaskEditDialogMode
  /** @deprecated 请使用 mode；false 表示添加任务。 */
  isEdit?: boolean
  /** @deprecated 请使用 mode='view'；true 时隐藏保存。 */
  viewOnly?: boolean
  /** 当前正在编辑的任务；添加任务时为 null。 */
  task: TaskForm | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  /** 保存成功后回传最新任务数据。 */
  (e: 'saved', task: TaskForm): void
}>()

/** 表单实例，用于校验。 */
const formRef = ref<FormInstance>()
/** 提交中状态。 */
const submitting = ref(false)
/** 作战目标下拉选项。 */
const satelliteTypes = [...SATELLITE_TYPES]

/** 可编辑任务表单。 */
const taskForm = reactive<TaskForm>({
  battleId: -1,
  name: '',
  description: '',
  beginDate: '',
  endDate: '',
  targetType: '',
  targetTypeShow: [],
  meCountry: DEFAULT_ME_COUNTRIES.join(','),
  meCountryShow: [...DEFAULT_ME_COUNTRIES],
  enemyCountry: DEFAULT_ENEMY_COUNTRIES.join(','),
  enemyCountryShow: [...DEFAULT_ENEMY_COUNTRIES],
  steps: '',
  delayMin: 60,
  coverage: 50,
  combatArea: { centerLon: 0, centerLat: 0, radiusKm: 0, enabled: false },
})

/** 任务表单校验规则。 */
const formRules = reactive<FormRules<TaskForm>>({
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入任务概述', trigger: 'blur' }],
  targetTypeShow: [{
    type: 'array',
    required: true,
    min: 1,
    message: '请选择卫星类型',
    trigger: 'change',
  }],
  meCountryShow: [{
    type: 'array',
    required: true,
    min: 1,
    message: '请选择红方国家',
    trigger: 'change',
  }],
  enemyCountryShow: [{
    type: 'array',
    required: true,
    min: 1,
    message: '请选择蓝方国家',
    trigger: 'change',
  }],
  beginDate: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
})

/** 对话框可见性与 v-model 同步（初始值与父级一致，避免 remount 后未触发 watch）。 */
const visible = ref(props.modelValue)

/**
 * 解析弹窗模式（mode 优先，兼容旧 isEdit / viewOnly）。
 *
 * @returns create | view | edit
 */
const dialogMode = computed((): TaskEditDialogMode => {
  if (props.mode === 'create' || props.mode === 'view' || props.mode === 'edit') {
    return props.mode
  }
  if (!props.isEdit) return 'create'
  if (props.viewOnly) return 'view'
  return 'edit'
})

/** 是否打开已有任务（查看或修改）。 */
const isExistingTaskMode = computed(() => dialogMode.value !== 'create')

/** 编辑已有任务时接口字段校验失败说明 */
const taskListItemApiError = ref('')

/** 是否展示保存按钮（新建或可编辑修改；接口数据不完整时禁止保存）。 */
const canSave = computed(
  () =>
    (dialogMode.value === 'create' || dialogMode.value === 'edit') &&
    !taskListItemApiError.value,
)

/** 是否展示时延/覆盖率输入（编辑模式下接口缺字段时不展示默认值） */
const showTaskMetricsInputs = computed(
  () => dialogMode.value === 'create' || (!taskListItemApiError.value && Number.isFinite(taskForm.delayMin)),
)

/** 弹窗标题：添加、查看与修改分开展示。 */
const dialogTitle = computed(() => {
  const titles: Record<TaskEditDialogMode, string> = {
    create: '添加任务',
    view: '查看任务',
    edit: '修改任务',
  }
  return titles[dialogMode.value]
})

/** 各装配页组件引用，用于提交时汇总已选资源。 */
const satelliteAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)
const stationAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)
const centerAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)
const weaponAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)

/** 左侧竖向菜单。 */
const taskEditMenus: TaskEditMenuItem[] = [
  { key: 'basic', label: '任务基本信息' },
  { key: 'satellite', label: '卫星装配' },
  { key: 'station', label: '地面站装配' },
  { key: 'center', label: '数据中心装配' },
  { key: 'weapon', label: '武器装配' },
]

/** 当前右侧内容页。 */
const activeTab = ref<TaskEditTabKey>('basic')
/** 装配页重置令牌，弹窗每次打开递增。 */
const assembleResetKey = ref(0)

/**
 * 弹窗内编辑 combatArea 时，同步扁平字段，避免与接口解析优先级不一致。
 */
watch(
  () => taskForm.combatArea,
  (area) => {
    if (!area) return
    Object.assign(taskForm, combatAreaToApiFields(normalizeTaskCombatArea(area)))
  },
  { deep: true },
)

/**
 * 父级 v-model、模式或任务变化时同步弹窗并回填表单。
 */
watch(
  () => [props.modelValue, dialogMode.value, props.task?.id] as const,
  ([open]) => {
    visible.value = open
    if (open) {
      activeTab.value = 'basic'
      assembleResetKey.value += 1
      fillForm(props.task)
    }
  },
  { immediate: true }
)

watch(visible, (open) => {
  if (open !== props.modelValue) {
    emit('update:modelValue', open)
  }
})

/**
 * 根据起止时间计算任务时长（小时，至少 1）。
 * 时间无效时保持弹窗默认 1 小时，与任务面板「无法计算则为 null」的口径不同。
 *
 * @returns 小时数
 */
const calcDurationHoursFromDates = (): number => {
  const beginMs = parseTaskTimeMs(taskForm.beginDate)
  const endMs = parseTaskTimeMs(taskForm.endDate)
  if (!beginMs || !endMs || endMs <= beginMs) return 1
  return Math.max(1, Math.round((endMs - beginMs) / 3600000))
}

/** 任务时长输入值；起止时间变化时自动重算。 */
const durationHours = ref(DEFAULT_TASK_DURATION_HOURS)

/** 起止时间变动时，同步重算任务时长显示。 */
watch(
  () => [taskForm.beginDate, taskForm.endDate] as const,
  () => {
    durationHours.value = calcDurationHoursFromDates()
  },
  { immediate: true }
)

/**
 * 手动修改任务时长时，联动更新结束时间。
 *
 * @param value 小时数
 */
const handleDurationHoursChange = (value: number | undefined) => {
  if (value == null || Number.isNaN(value)) return
  const beginMs = parseTaskTimeMs(taskForm.beginDate)
  if (!beginMs) return
  const safeHours = Math.max(1, Math.round(value))
  durationHours.value = safeHours
  taskForm.endDate = formatTaskMinuteDateTime(new Date(beginMs + safeHours * 3600000))
}



/** 任务指标默认值：链路时延（分钟）、覆盖率（%）。 */
const DEFAULT_DELAY_MIN = 60
const DEFAULT_COVERAGE = 50

/** 链路时延（分钟），与 taskForm.delayMin 双向同步（仅新建模式使用默认值）。 */
const linkDelayMin = computed({
  get: () =>
    isExistingTaskMode.value
      ? (taskForm.delayMin as number)
      : (taskForm.delayMin ?? DEFAULT_DELAY_MIN),
  set: (value: number) => {
    taskForm.delayMin = value
  },
})

/** 覆盖率（%），与 taskForm.coverage 双向同步（仅新建模式使用默认值）。 */
const taskCoverage = computed({
  get: () =>
    isExistingTaskMode.value
      ? (taskForm.coverage as number)
      : (taskForm.coverage ?? DEFAULT_COVERAGE),
  set: (value: number) => {
    taskForm.coverage = value
  },
})

/**
 * 更新开始时间；若结束不晚于开始，则按当前时长顺延结束时间。
 *
 * @param value datetime-local 输入值
 */
const handleBeginInput = (value: string) => {
  const oldBegin = parseTaskTimeMs(taskForm.beginDate)
  const oldEnd = parseTaskTimeMs(taskForm.endDate)
  const keepHours =
    oldBegin && oldEnd && oldEnd > oldBegin
      ? Math.max(1, Math.round((oldEnd - oldBegin) / 3600000))
      : durationHours.value
  taskForm.beginDate = fromDatetimeLocalValue(value)
  const beginMs = parseTaskTimeMs(taskForm.beginDate)
  const endMs = parseTaskTimeMs(taskForm.endDate)
  if (beginMs && (!endMs || endMs <= beginMs)) {
    taskForm.endDate = formatTaskMinuteDateTime(new Date(beginMs + keepHours * 3600000))
  }
}

/**
 * 更新结束时间。
 *
 * @param value datetime-local 输入值
 */
const handleEndInput = (value: string) => {
  taskForm.endDate = fromDatetimeLocalValue(value)
}

/**
 * 将逗号分隔字符串拆成选项数组。
 *
 * @param value 原始字符串
 * @returns 去空白后的数组
 */
/**
 * 根据 ID 创建装配占位行（编辑回显时候选池尚未加载）。
 *
 * @param id 资源 ID
 * @param name 展示名称，缺省与 ID 相同
 * @returns 占位装配行
 */
const createPlaceholderRow = (id: string, name?: string): TaskAssembleRow => ({
  id,
  name: name || id,
  series: '',
  type: '--',
  country: '--',
  extra1: '--',
  extra2: '--',
})

/**
 * 根据卫星系列创建装配行（编辑回显卫星系列）。
 *
 * @param series 系列名称
 * @returns 卫星系列装配行
 */
const createSatelliteSeriesRow = (series: string): TaskAssembleRow => ({
  id: series,
  name: series,
  series,
  type: '--',
  country: '--',
  extra1: '--',
  extra2: '--',
})

/**
 * 从任务 resources / weaponIds 恢复各装配页已选资源。
 *
 * @param task 列表接口返回的任务对象
 */
const restoreAssembleFromTask = (task: TaskForm) => {
  const resources = task.resources ?? []
  const weaponIds = task.weaponIds ?? []

  const satelliteRows = resources
    .map((item) => item.series)
    .filter(Boolean)
    .map((series) => createSatelliteSeriesRow(series))

  const receiveIds = [...new Set(resources.flatMap((item) => item.receiveIds ?? []))]
  const stationIds = [...new Set(resources.flatMap((item) => item.stationIds ?? []))]

  satelliteAssembleRef.value?.setAssembledRows(satelliteRows)
  stationAssembleRef.value?.setAssembledRows(receiveIds.map((id) => createPlaceholderRow(id)))
  centerAssembleRef.value?.setAssembledRows(stationIds.map((id) => createPlaceholderRow(id)))
  weaponAssembleRef.value?.setAssembledRows(weaponIds.map((id) => createPlaceholderRow(id)))
}

const splitCsv = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

/**
 * 获取新建任务默认开始时间（当天 08:00）。
 *
 * @returns `YYYY-MM-DD HH:mm` 格式时间
 */
const createDefaultBeginDate = (): string => {
  const now = new Date()
  const begin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0)
  return formatTaskMinuteDateTime(begin)
}

/**
 * 根据开始时间与任务时长计算结束时间。
 *
 * @param beginDate 开始时间
 * @param hours 任务时长（小时）
 * @returns `YYYY-MM-DD HH:mm` 格式时间
 */
const createDefaultEndDate = (beginDate: string, hours: number): string => {
  const beginMs = parseTaskTimeMs(beginDate)
  if (!beginMs) return ''
  return formatTaskMinuteDateTime(new Date(beginMs + hours * 3600000))
}

/**
 * 重置为当前场景下的空白任务（添加模式）。
 */
const resetCreateForm = () => {
  taskListItemApiError.value = ''
  const beginDate = createDefaultBeginDate()
  const endDate = createDefaultEndDate(beginDate, DEFAULT_TASK_DURATION_HOURS)
  Object.assign(taskForm, {
    id: undefined,
    battleId: store.battle?.id ?? -1,
    name: '',
    description: '',
    beginDate,
    endDate,
    targetType: DEFAULT_TARGET_TYPES.join(','),
    targetTypeShow: [...DEFAULT_TARGET_TYPES],
    meCountry: DEFAULT_ME_COUNTRIES.join(','),
    meCountryShow: [...DEFAULT_ME_COUNTRIES],
    enemyCountry: DEFAULT_ENEMY_COUNTRIES.join(','),
    enemyCountryShow: [...DEFAULT_ENEMY_COUNTRIES],
    steps: '',
    delayMin: DEFAULT_DELAY_MIN,
    coverage: DEFAULT_COVERAGE,
    combatArea: { centerLon: 0, centerLat: 0, radiusKm: 0, enabled: false },
  })
  durationHours.value = DEFAULT_TASK_DURATION_HOURS
}

/**
 * 用当前任务填充表单；添加任务时重置为空表单并挂到当前场景。
 *
 * @param task 待编辑任务；添加时为 null
 */
const fillForm = (task: TaskForm | null) => {
  taskListItemApiError.value = ''
  if (!task || !isExistingTaskMode.value) {
    resetCreateForm()
    return
  }
  try {
    const materialized = materializeTaskListItemFromApi(task)
    Object.assign(taskForm, {
      ...materialized,
      meCountryShow: materialized.meCountryShow?.length
        ? [...materialized.meCountryShow]
        : splitCsv(materialized.meCountry),
      enemyCountryShow: materialized.enemyCountryShow?.length
        ? [...materialized.enemyCountryShow]
        : splitCsv(materialized.enemyCountry),
      targetTypeShow: materialized.targetTypeShow?.length
        ? [...materialized.targetTypeShow]
        : splitCsv(materialized.targetTypeNew || materialized.targetType),
      steps: materialized.steps || '',
      weaponIds: materialized.weaponIds ? [...materialized.weaponIds] : [],
      resources: materialized.resources
        ? materialized.resources.map((item) => ({
            series: item.series,
            receiveIds: [...(item.receiveIds ?? [])],
            stationIds: [...(item.stationIds ?? [])],
          }))
        : [],
      combatArea: materialized.combatArea ? { ...materialized.combatArea } : undefined,
    })
  } catch (err) {
    if (err instanceof TaskListItemFromApiError) {
      taskListItemApiError.value = err.message
      ElMessage.error({
        message: err.message,
        duration: 10000,
        showClose: true,
      })
      Object.assign(taskForm, {
        ...task,
        meCountryShow: task.meCountryShow?.length ? [...task.meCountryShow] : splitCsv(task.meCountry),
        enemyCountryShow: task.enemyCountryShow?.length ? [...task.enemyCountryShow] : splitCsv(task.enemyCountry),
        targetTypeShow: task.targetTypeShow?.length
          ? [...task.targetTypeShow]
          : splitCsv(task.targetTypeNew || task.targetType),
        steps: task.steps || '',
        beginDate: normalizeDateTime(task.beginDate),
        endDate: normalizeDateTime(task.endDate),
        delayMin: undefined,
        coverage: undefined,
        combatArea: undefined,
        weaponIds: task.weaponIds ? [...task.weaponIds] : [],
        resources: task.resources
          ? task.resources.map((item) => ({
              series: item.series,
              receiveIds: [...(item.receiveIds ?? [])],
              stationIds: [...(item.stationIds ?? [])],
            }))
          : [],
      })
    } else {
      throw err
    }
  }
  syncCountryFields()
  void nextTick(() => {
    restoreAssembleFromTask(task)
  })
}

/**
 * 将多选国家同步回逗号分隔字段，供提交使用。
 */
const syncCountryFields = () => {
  taskForm.meCountry = (taskForm.meCountryShow || []).join(',')
  taskForm.enemyCountry = (taskForm.enemyCountryShow || []).join(',')
}

/**
 * 卫星类型变化：刷新校验状态。
 */
const handleTargetTypeShowChange = () => {
  formRef.value?.validateField('targetTypeShow').catch(() => undefined)
}

/**
 * 国家勾选变化：同步提交字段并刷新对应表单项校验状态。
 */
const handleCountryShowChange = () => {
  syncCountryFields()
  formRef.value?.validateField(['meCountryShow', 'enemyCountryShow']).catch(() => undefined)
}

/**
 * 对话框关闭后重置表单状态。
 */
const handleClosed = () => {
  formRef.value?.resetFields()
}

/**
 * 从新增任务接口响应中解析新任务 ID。
 *
 * @param data 接口 data 字段（可能是数字或带 id 的对象）
 * @returns 新任务 ID；无法解析时为 undefined
 */
const resolveCreatedTaskId = (data: unknown): number | undefined => {
  const numeric = Number(data)
  if (Number.isFinite(numeric) && numeric > 0) return numeric
  if (data && typeof data === 'object' && 'id' in data) {
    const id = Number((data as { id?: number }).id)
    if (Number.isFinite(id) && id > 0) return id
  }
  return undefined
}

/**
 * 汇总各装配页数据，构建算法新增任务请求体（仅传系列，不传卫星 ID）。
 * @returns 请求体；校验失败时返回 null
 */
type AddTaskPayload = Parameters<typeof addTask>[0]

const buildAddTaskPayload = (): AddTaskPayload | null => {
  syncCountryFields()
  const targetTypeValue = (taskForm.targetTypeShow || []).join(',')

  const seriesList = satelliteAssembleRef.value?.getAssembledSeries() ?? []
  const stations = stationAssembleRef.value?.getAssembledRows() ?? []
  const centers = centerAssembleRef.value?.getAssembledRows() ?? []
  const weapons = weaponAssembleRef.value?.getAssembledRows() ?? []

  if (!seriesList.length) {
    ElMessage.warning('请至少选择一个卫星系列')
    activeTab.value = 'satellite'
    return null
  }

  const receiveIds = stations.map((row) => row.id)
  const stationIds = centers.map((row) => row.id)
  const weaponIds = weapons.map((row) => row.id)

  const resources = seriesList.map((series) => ({
    series,
    receiveIds,
    stationIds,
  }))

  const basePayload = {
    battleId: store.battle?.id as number,
    meCountry: taskForm.meCountry,
    enemyCountry: taskForm.enemyCountry,
    meCountryShow: [...(taskForm.meCountryShow || [])],
    enemyCountryShow: [...(taskForm.enemyCountryShow || [])],
    targetTypeNew: targetTypeValue,
    name: taskForm.name,
    description: taskForm.description,
    beginDate: normalizeDateTime(taskForm.beginDate),
    endDate: normalizeDateTime(taskForm.endDate),
    targetType: targetTypeValue,
    coverage: taskCoverage.value,
    delayMin: linkDelayMin.value,
    weaponIds,
    resources,
  }

  if (!taskForm.combatArea) {
    ElMessage.error(taskListItemApiError.value || '任务作战区域数据不完整，无法提交')
    activeTab.value = 'basic'
    return null
  }
  const combatArea = normalizeTaskCombatArea(taskForm.combatArea)
  return {
    ...basePayload,
    ...combatAreaToApiFields(combatArea),
  }
}

/**
 * 将装配页汇总结果转为可提交/回传的 TaskForm 片段。
 *
 * @param taskPayload addTask / updateTask 共用的请求体
 * @returns 合并当前表单后的任务对象
 */
const buildSavedTaskFromPayload = (taskPayload: AddTaskPayload): TaskForm => {
  if (!taskForm.combatArea) {
    throw new Error(taskListItemApiError.value || '任务作战区域数据不完整')
  }
  const combatArea = normalizeTaskCombatArea(taskForm.combatArea)
  return {
    ...taskForm,
    battleId: taskPayload.battleId,
    beginDate: taskPayload.beginDate,
    endDate: taskPayload.endDate,
    meCountry: taskPayload.meCountry,
    enemyCountry: taskPayload.enemyCountry,
    meCountryShow: [...(taskPayload.meCountryShow ?? [])],
    enemyCountryShow: [...(taskPayload.enemyCountryShow ?? [])],
    targetType: taskPayload.targetType,
    targetTypeNew: taskPayload.targetTypeNew,
    targetTypeShow: [...(taskForm.targetTypeShow || [])],
    steps: taskForm.steps || '',
    delayMin: taskPayload.delayMin,
    coverage: taskPayload.coverage,
    weaponIds: [...taskPayload.weaponIds],
    resources: taskPayload.resources.map((item) => ({
      series: item.series,
      receiveIds: [...item.receiveIds],
      stationIds: [...item.stationIds],
    })),
    combatArea: { ...combatArea },
    ...combatAreaToApiFields(combatArea),
  }
}

/**
 * 校验并提交任务：新建走 addTask，修改走 updateTask。
 */
const handleSubmit = async () => {
  if (!formRef.value || !canSave.value) return
  syncCountryFields()
  const isUpdate = dialogMode.value === 'edit'
  await formRef.value.validate(async (valid) => {
    if (!valid) {
      activeTab.value = 'basic'
      ElMessage.warning('请填写完整的任务信息')
      return
    }
    if (!taskForm.beginDate || !taskForm.endDate) {
      activeTab.value = 'basic'
      ElMessage.warning('请选择任务起止时间')
      return
    }
    if (parseTaskTimeMs(taskForm.endDate) <= parseTaskTimeMs(taskForm.beginDate)) {
      activeTab.value = 'basic'
      ElMessage.warning('结束时间必须晚于开始时间')
      return
    }
    if (!store.battle?.id) {
      ElMessage.warning(isUpdate ? '请先选择当前场景后再修改任务' : '请先选择当前场景后再添加任务')
      return
    }
    if (isUpdate && !taskForm.id) {
      ElMessage.error('任务 ID 无效，无法修改')
      return
    }

    const taskPayload = buildAddTaskPayload()
    if (!taskPayload) return

    submitting.value = true
    try {
      if (isUpdate) {
        const savedTask: TaskForm = {
          ...buildSavedTaskFromPayload(taskPayload),
          id: taskForm.id,
        }
        const res = await updateTask(savedTask)
        if (res.code === 200) {
          ElMessage.success('修改任务成功')
          visible.value = false
          emit('saved', savedTask)
        } else {
          ElMessage.error(res.msg || '修改任务失败')
        }
      } else {
        const res = await addTask(taskPayload)
        if (res.code === 200) {
          const savedTask = buildSavedTaskFromPayload(taskPayload)
          const createdId = resolveCreatedTaskId(res.data)
          if (createdId != null) savedTask.id = createdId
          ElMessage.success('添加任务成功')
          visible.value = false
          emit('saved', savedTask)
        } else {
          ElMessage.error(res.msg || '添加任务失败')
        }
      }
    } catch (error) {
      console.error(isUpdate ? '修改任务失败:' : '添加任务失败:', error)
      ElMessage.error(isUpdate ? '修改任务失败' : '添加任务失败')
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style lang="scss">
/** Element Plus 使用默认 el 前缀，选择器写 el-*。 */
.task-edit-dialog-modal.el-overlay,
.el-overlay.task-edit-dialog-modal {
  background-color: var(--swatch-rgba-4-10-20-0_72) !important;
}

.el-dialog.task-edit-dialog,
.task-edit-dialog .el-dialog {
  --el-dialog-bg-color: var(--dialog-bg);
  --el-color-primary: var(--accent-cyan);
  --el-color-primary-light-3: var(--accent-cyan-hover);
  --el-color-primary-light-5: rgba(var(--accent-cyan-rgb), 0.55);
  --el-color-primary-light-7: rgba(var(--accent-cyan-rgb), 0.35);
  --el-color-primary-light-9: rgba(var(--accent-cyan-rgb), 0.12);
  --el-button-bg-color: var(--accent-cyan);
  --el-button-text-color: var(--on-accent-cyan);
  --el-button-hover-bg-color: var(--accent-cyan-hover);
  --el-button-hover-text-color: var(--swatch-04141c);
  --el-dialog-padding-primary: 0;
  padding: 0 !important;
  background: var(--dialog-bg) !important;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.28) !important;
  border-radius: 10px !important;
  box-shadow:
    0 16px 40px var(--mask-color),
    0 0 18px rgba(var(--accent-cyan-rgb), 0.12) !important;
  backdrop-filter: blur(8px);
  display: flex !important;
  flex-direction: column;
  width: 100% !important;
  max-width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: hidden;

  .el-dialog__header {
    flex-shrink: 0;
    margin-right: 0;
    padding: 10px 20px;
    background: var(--dialog-bg);
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  }

  .el-dialog__title {
    color: var(--accent-cyan-hover) !important;
    font-size: var(--font-size-subtitle);
    font-weight: var(--font-weight-bold);
    text-shadow: 0 0 8px var(--swatch-rgba-64-242-255-0_4);
  }

  .el-dialog__headerbtn .el-dialog__close {
    color: var(--text-color-muted) !important;

    &:hover {
      color: var(--accent-cyan) !important;
    }
  }

  .el-dialog__body {
    flex: 1;
    min-height: 0;
    padding: 0 !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--swatch-rgba-12-22-38-0_72);
    color: var(--text-color-bright);
  }

  .task-edit-layout {
    display: grid;
    grid-template-columns: 168px minmax(0, 1fr);
    flex: 1;
    min-height: 0;
    height: 100%;
  }

  .task-edit-nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px 10px;
    border-right: 1px solid rgba(var(--accent-cyan-rgb), 0.16);
    background: var(--swatch-rgba-8-15-26-0_55);
  }

  .task-edit-nav-item {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: var(--text-color-muted);
    font-size: var(--font-size-md);
    text-align: left;
    cursor: pointer;
    transition: all 0.18s ease;

    &:hover {
      color: var(--swatch-e0faff);
      background: rgba(var(--accent-cyan-rgb), 0.08);
    }

    &.is-active {
      color: var(--accent-cyan-hover);
      background: rgba(var(--accent-cyan-rgb), 0.14);
      border-color: rgba(var(--accent-cyan-rgb), 0.35);
      box-shadow: inset 3px 0 0 var(--accent-cyan);
    }
  }

  .task-edit-nav-label {
    font-weight: var(--font-weight-semibold);
  }

  .task-edit-main {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    padding: 16px 20px 20px;
    overflow: hidden;
  }

  .task-edit-pane {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .task-assemble-tab {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .el-dialog__footer {
    flex-shrink: 0;
    padding: 0 !important;
    margin: 0 !important;
    background: var(--dialog-bg);
    border-top: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  }

  .task-edit-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    width: 100%;
    min-height: 44px;
    padding: 6px 20px;
    box-sizing: border-box;

    .el-button {
      height: 32px;
      padding: 0 16px;
      margin: 0 !important;
      font-size: var(--font-size-md);
      line-height: 32px;
    }
  }

  .task-edit-api-error {
    margin: 0 0 12px;
    padding: 8px 10px;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--swatch-ffb4b4);
    background: rgb(255 80 80 / 12%);
    border: 1px solid rgb(255 120 120 / 35%);
    border-radius: 4px;
  }

  .task-edit-form {
    --el-form-item-margin-bottom: 16px;

    .el-form-item {
      margin-bottom: 16px;
    }

    .el-form-item:last-child {
      margin-bottom: 0;
    }
  }

  /** 任务时长 / 链路时延 / 覆盖率纵向排列。 */
  .task-edit-metrics-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 16px;
    width: 100%;
    margin-bottom: 16px;
    align-items: center;

    .task-edit-metrics-grid__left-cell.el-form-item {
      margin-bottom: 0;
    }

    .metric-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 48px;
      align-items: center;
      column-gap: 10px;
      width: 100%;
      max-width: 280px;
    }

    .metric-input-number {
      width: 100% !important;
      max-width: 100%;
    }

    .metric-input-number.el-input-number,
    .el-input-number.metric-input-number {
      width: 100% !important;
    }

    .metric-input-unit {
      width: 48px;
      text-align: left;
    }

    .el-form-item__content {
      line-height: 32px;
    }
  }

  .el-form-item__label {
    color: var(--color-info-soft) !important;
    font-size: var(--font-size-md);
  }

  .el-form-item.is-required:not(.is-no-asterisk)>.el-form-item__label::before {
    color: var(--color-danger-soft) !important;
  }

  .el-input__wrapper,
  .el-textarea__wrapper,
  .el-select__wrapper,
  .el-date-editor.el-input__wrapper,
  .el-date-editor {
    background-color: var(--swatch-rgba-8-20-36-0_9) !important;
    box-shadow: 0 0 0 1px rgba(var(--accent-cyan-rgb), 0.32) inset !important;
    border-radius: 6px;

    &:hover {
      box-shadow: 0 0 0 1px rgba(var(--accent-cyan-rgb), 0.55) inset !important;
    }

    &.is-focus,
    &.is-focused {
      box-shadow:
        0 0 0 1px var(--accent-cyan) inset,
        0 0 8px rgba(var(--accent-cyan-rgb), 0.28) !important;
    }
  }

  /**
   * Element Plus 多行输入没有 wrapper，边框画在 textarea.inner 上。
   */
  .el-textarea__inner {
    color: var(--text-color-bright) !important;
    background-color: var(--swatch-rgba-8-20-36-0_9) !important;
    border: none !important;
    border-radius: 6px !important;
    box-shadow: 0 0 0 1px rgba(var(--accent-cyan-rgb), 0.32) inset !important;

    &::placeholder {
      color: var(--text-color-subtle) !important;
    }

    &:hover {
      box-shadow: 0 0 0 1px rgba(var(--accent-cyan-rgb), 0.55) inset !important;
    }

    &:focus {
      box-shadow:
        0 0 0 1px var(--accent-cyan) inset,
        0 0 8px rgba(var(--accent-cyan-rgb), 0.28) !important;
    }
  }

  .el-input__count,
  .el-input__count-inner {
    color: var(--text-color-subtle) !important;
    background: transparent !important;
  }

  .el-select__placeholder,
  .el-range-separator {
    color: var(--text-color-muted) !important;
  }

  .el-range-input {
    color: var(--text-color-bright) !important;
    background: transparent !important;
  }

  .el-select__selected-item,
  .el-select__caret,
  .el-select__suffix {
    color: var(--text-color-bright) !important;
  }

  .el-tag {
    background: rgba(var(--accent-cyan-rgb), 0.14) !important;
    border-color: rgba(var(--accent-cyan-rgb), 0.35) !important;
    color: var(--color-info-soft) !important;
  }

  .el-tag .el-tag__close {
    color: var(--color-info-soft) !important;

    &:hover {
      background: rgba(var(--accent-cyan-rgb), 0.28) !important;
      color: var(--accent-cyan-hover) !important;
    }
  }

  .el-switch.is-checked .el-switch__core {
    background-color: var(--accent-cyan) !important;
    border-color: var(--accent-cyan) !important;
  }

  .el-switch__core {
    background-color: var(--swatch-rgba-100-116-139-0_55) !important;
    border-color: var(--swatch-rgba-148-163-184-0_4) !important;
  }

  .task-datetime-input {
    width: 100%;
    height: 36px;
    padding: 0 10px;
    box-sizing: border-box;
    color: var(--text-color-bright);
    background: var(--swatch-rgba-8-20-36-0_9);
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.32);
    border-radius: 6px;
    outline: none;
    color-scheme: dark;

    &:hover {
      border-color: rgba(var(--accent-cyan-rgb), 0.55);
    }

    &:focus {
      border-color: var(--accent-cyan);
      box-shadow: 0 0 8px rgba(var(--accent-cyan-rgb), 0.28);
    }
  }

  .country-checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    width: 100%;
    min-height: 40px;
    padding: 10px 12px;
    box-sizing: border-box;
    border-radius: 6px;
    background: var(--swatch-rgba-8-20-36-0_9);
    box-shadow: 0 0 0 1px rgba(var(--accent-cyan-rgb), 0.32) inset;

    .el-checkbox {
      margin-right: 0;
      height: auto;
    }

    .el-checkbox__label {
      color: var(--text-color-bright);
      font-size: var(--font-size-md);
      padding-left: 8px;
    }

    .el-checkbox__input.is-checked+.el-checkbox__label {
      color: var(--color-info-soft);
    }

    .el-checkbox__inner {
      background-color: var(--swatch-rgba-8-20-36-0_9);
      border-color: rgba(var(--accent-cyan-rgb), 0.45);
    }

    .el-checkbox__input.is-checked .el-checkbox__inner {
      background-color: var(--accent-cyan);
      border-color: var(--accent-cyan);
    }

    .el-checkbox__input.is-checked .el-checkbox__inner::after {
      border-color: var(--on-accent-cyan);
    }
  }

  .metric-input-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    width: 100%;
  }

  .metric-input-number {
    width: 180px;
  }

  .metric-input-unit {
    flex-shrink: 0;
    font-size: var(--font-size-md);
    color: var(--swatch-9ecfe8);
    white-space: nowrap;
  }

  .metric-input-hint {
    flex: 1;
    min-width: 0;
    font-size: var(--font-size-sm);
    color: var(--color-info-soft);
    white-space: nowrap;
  }

  .task-edit-btn--ghost.el-button,
  .el-button.task-edit-btn--ghost {
    --el-button-bg-color: rgba(var(--accent-cyan-rgb), 0.08);
    --el-button-text-color: var(--color-info-soft);
    --el-button-border-color: rgba(var(--accent-cyan-rgb), 0.4);
    --el-button-hover-bg-color: rgba(var(--accent-cyan-rgb), 0.18);
    --el-button-hover-text-color: var(--accent-cyan-hover);
    --el-button-hover-border-color: var(--accent-cyan);
    color: var(--color-info-soft) !important;
    background: rgba(var(--accent-cyan-rgb), 0.08) !important;
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.4) !important;

    &:hover {
      color: var(--accent-cyan-hover) !important;
      background: rgba(var(--accent-cyan-rgb), 0.18) !important;
      border-color: var(--accent-cyan) !important;
    }
  }

  .task-edit-btn--primary.el-button,
  .el-button.task-edit-btn--primary,
  .el-button--primary.task-edit-btn--primary {
    --el-button-bg-color: var(--accent-cyan);
    --el-button-text-color: var(--on-accent-cyan);
    --el-button-border-color: var(--accent-cyan);
    --el-button-hover-bg-color: var(--accent-cyan-hover);
    --el-button-hover-text-color: var(--swatch-04141c);
    --el-button-hover-border-color: var(--accent-cyan-hover);
    color: var(--on-accent-cyan) !important;
    background: linear-gradient(135deg, var(--accent-cyan-hover), var(--swatch-00b8d4)) !important;
    border: 1px solid var(--accent-cyan) !important;

    &:hover {
      color: var(--swatch-04141c) !important;
      background: linear-gradient(135deg, var(--swatch-7af7ff), var(--accent-cyan)) !important;
      border-color: var(--accent-cyan-hover) !important;
    }
  }
}

.task-edit-select-popper.el-popper,
.task-edit-date-popper.el-popper,
.el-popper.task-edit-select-popper,
.el-popper.task-edit-date-popper {
  background: var(--swatch-rgba-8-15-26-0_98) !important;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.28) !important;
  box-shadow: 0 12px 28px var(--mask-color) !important;

  .el-select-dropdown__item {
    color: var(--text-color-soft) !important;

    &:hover,
    &.is-hovering {
      background: rgba(var(--accent-cyan-rgb), 0.12) !important;
      color: var(--accent-cyan-hover) !important;
    }

    &.is-selected {
      color: var(--accent-cyan-hover) !important;
      font-weight: var(--font-weight-semibold);
    }
  }

  .el-picker-panel,
  .el-date-range-picker {
    background: transparent !important;
    color: var(--text-color-bright) !important;
    border: none !important;
  }

  .el-date-range-picker__header,
  .el-date-picker__header-label,
  .el-picker-panel__icon-btn {
    color: var(--color-info-soft) !important;
  }

  .el-date-table th {
    color: var(--text-color-subtle) !important;
    border-bottom-color: rgba(var(--accent-cyan-rgb), 0.15) !important;
  }

  .el-date-table td .el-date-table-cell__text {
    color: var(--text-color-bright) !important;
  }

  .el-date-table td.available:hover .el-date-table-cell__text,
  .el-date-table td.current:not(.disabled) .el-date-table-cell__text {
    background: rgba(var(--accent-cyan-rgb), 0.22) !important;
    color: var(--accent-cyan-hover) !important;
  }

  .el-date-table td.in-range .el-date-table-cell {
    background: rgba(var(--accent-cyan-rgb), 0.1) !important;
  }

  .el-time-panel {
    background: var(--swatch-rgba-8-15-26-0_98) !important;
    border-color: rgba(var(--accent-cyan-rgb), 0.22) !important;
  }

  .el-time-spinner__item {
    color: var(--text-color-soft) !important;

    &:hover:not(.is-disabled):not(.is-active) {
      background: rgba(var(--accent-cyan-rgb), 0.12) !important;
    }

    &.is-active:not(.is-disabled) {
      color: var(--accent-cyan-hover) !important;
    }
  }

  .el-picker-panel__footer {
    background: var(--dialog-bg) !important;
    border-top: 1px solid rgba(var(--accent-cyan-rgb), 0.15) !important;
  }
}
</style>
