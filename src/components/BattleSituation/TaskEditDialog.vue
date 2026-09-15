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
            <el-form-item label="任务时长">
              <div class="metric-input-row">
                <el-input-number v-model="durationHours" :min="1" :max="8760" :step="1" :controls="true"
                  controls-position="right" class="metric-input-number" @change="handleDurationHoursChange" />
                <span class="metric-input-unit">小时</span>
              </div>
            </el-form-item>
            <el-form-item label="链路时延">
              <div class="metric-input-row">
                <el-input-number v-model="linkDelayMin" :min="1" :max="4320" :step="1" :controls="true"
                  controls-position="right" class="metric-input-number" />
                <span class="metric-input-unit">分钟</span>
              </div>
            </el-form-item>
            <el-form-item label="覆盖率">
              <div class="metric-input-row">
                <el-input-number v-model="taskCoverage" :min="0" :max="100" :step="1" :controls="true"
                  controls-position="right" class="metric-input-number" />
                <span class="metric-input-unit">%</span>
              </div>
            </el-form-item>
            <el-form-item label="卫星类型" prop="targetTypeShow">
              <el-select v-model="taskForm.targetTypeShow" multiple placeholder="请选择卫星类型"
                popper-class="task-edit-select-popper" style="width: 100%" @change="handleTargetTypeShowChange">
                <el-option v-for="item in satelliteTypes" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="红方" prop="meCountryShow">
              <el-checkbox-group v-model="taskForm.meCountryShow" class="country-checkbox-group"
                @change="handleCountryShowChange">
                <el-checkbox v-for="item in countryOptions" :key="`me-${item}`" :value="item">{{ item }}</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="蓝方" prop="enemyCountryShow">
              <el-checkbox-group v-model="taskForm.enemyCountryShow" class="country-checkbox-group"
                @change="handleCountryShowChange">
                <el-checkbox v-for="item in countryOptions" :key="`enemy-${item}`" :value="item">{{ item
                  }}</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="设置关注">
              <el-switch v-model="taskForm.focusStatus" :active-value="1" :inactive-value="0" />
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
        <el-button v-if="!isEdit" class="task-edit-btn task-edit-btn--primary" type="primary" :loading="submitting"
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
import { getBattleCountrys } from '@/api/dashboard'
import { addTask } from '@/api/task/task'
import type { TaskForm } from '@/types/dashboard'
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

const props = defineProps<{
  /** 对话框是否可见。 */
  modelValue: boolean
  /** 是否为修改模式；false 表示添加任务。 */
  isEdit?: boolean
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
/** 红蓝方国家下拉选项。 */
const countryOptions = ref<string[]>([])
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
  focusStatus: 0,
  delayMin: 60,
  coverage: 50,
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

/** 对话框可见性与 v-model 同步。 */
const visible = ref(false)

/** 是否为查看/编辑模式（当前后端仅支持新增，编辑时隐藏保存按钮）。 */
const isEdit = computed(() => !!props.isEdit)

/** 弹窗标题：添加与修改分开展示。 */
const dialogTitle = computed(() => (isEdit.value ? '查看任务（暂不支持修改）' : '添加任务'))

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

watch(
  () => props.modelValue,
  (open) => {
    visible.value = open
    if (open) {
      activeTab.value = 'basic'
      assembleResetKey.value += 1
      fillForm(props.task)
      loadCountryOptions()
    }
  }
)

watch(visible, (open) => {
  emit('update:modelValue', open)
})

/**
 * 规范化时间字符串为任务提交格式（不含秒）。
 *
 * @param value 原始时间
 * @returns `YYYY-MM-DD HH:mm` 或空串
 */
const normalizeDateTime = (value?: string): string => {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 16)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const [datePart, timePart] = trimmed.replace('T', ' ').split(' ')
    return `${datePart} ${timePart.slice(0, 5)}`
  }
  const ts = new Date(trimmed.replace(/-/g, '/')).getTime()
  if (!Number.isFinite(ts) || Number.isNaN(ts)) return trimmed
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 将任务时间转为 datetime-local 所需的 `YYYY-MM-DDTHH:mm`。
 *
 * @param value 任务时间字符串
 * @returns 可供原生时间输入回填的值
 */
const toDatetimeLocalValue = (value?: string): string => {
  const normalized = normalizeDateTime(value)
  return normalized ? normalized.replace(' ', 'T') : ''
}

/**
 * 将 datetime-local 值转回任务时间格式。
 *
 * @param value 原生时间输入值
 * @returns `YYYY-MM-DD HH:mm`
 */
const fromDatetimeLocalValue = (value?: string): string => {
  if (!value) return ''
  return normalizeDateTime(value.replace('T', ' '))
}

/**
 * 解析任务时间为毫秒。无效时返回 0。
 *
 * @param value 任务时间
 * @returns 毫秒时间戳
 */
const parseTaskTimeMs = (value?: string): number => {
  const normalized = normalizeDateTime(value)
  if (!normalized) return 0
  const ts = new Date(normalized.replace(/-/g, '/')).getTime()
  return Number.isFinite(ts) ? ts : 0
}

/**
 * 将 Date 格式化为任务时间字符串。
 *
 * @param date 日期对象
 * @returns `YYYY-MM-DD HH:mm`
 */
const formatDateToTaskTime = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 根据起止时间计算任务时长（小时，至少 1）。
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
const durationHours = ref(1)

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
  taskForm.endDate = formatDateToTaskTime(new Date(beginMs + safeHours * 3600000))
}



/** 任务指标默认值：链路时延（分钟）、覆盖率（%）。 */
const DEFAULT_DELAY_MIN = 60
const DEFAULT_COVERAGE = 50

/** 链路时延（分钟），与 taskForm.delayMin 双向同步。 */
const linkDelayMin = computed({
  get: () => taskForm.delayMin ?? DEFAULT_DELAY_MIN,
  set: (value: number) => {
    taskForm.delayMin = value
  },
})

/** 覆盖率（%），与 taskForm.coverage 双向同步。 */
const taskCoverage = computed({
  get: () => taskForm.coverage ?? DEFAULT_COVERAGE,
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
    taskForm.endDate = formatDateToTaskTime(new Date(beginMs + keepHours * 3600000))
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
 * 重置为当前场景下的空白任务（添加模式）。
 */
const resetCreateForm = () => {
  Object.assign(taskForm, {
    id: undefined,
    battleId: store.battle?.id ?? -1,
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
    focusStatus: 0,
    delayMin: DEFAULT_DELAY_MIN,
    coverage: DEFAULT_COVERAGE,
  })
}

/**
 * 用当前任务填充表单；添加任务时重置为空表单并挂到当前场景。
 *
 * @param task 待编辑任务；添加时为 null
 */
const fillForm = (task: TaskForm | null) => {
  if (!task || !props.isEdit) {
    resetCreateForm()
    return
  }
  Object.assign(taskForm, {
    ...task,
    meCountryShow: task.meCountryShow?.length ? [...task.meCountryShow] : splitCsv(task.meCountry),
    enemyCountryShow: task.enemyCountryShow?.length ? [...task.enemyCountryShow] : splitCsv(task.enemyCountry),
    targetTypeShow: task.targetTypeShow?.length
      ? [...task.targetTypeShow]
      : splitCsv(task.targetTypeNew || task.targetType),
    steps: task.steps || '',
    focusStatus: Number(task.focusStatus) === 1 ? 1 : 0,
    delayMin: Number.isFinite(task.delayMin) ? Number(task.delayMin) : DEFAULT_DELAY_MIN,
    coverage: Number.isFinite(task.coverage) ? Number(task.coverage) : DEFAULT_COVERAGE,
    weaponIds: task.weaponIds ? [...task.weaponIds] : [],
    resources: task.resources ? task.resources.map((item) => ({
      series: item.series,
      receiveIds: [...(item.receiveIds ?? [])],
      stationIds: [...(item.stationIds ?? [])],
    })) : [],
  })
  const begin = normalizeDateTime(task.beginDate)
  const end = normalizeDateTime(task.endDate)
  taskForm.beginDate = begin
  taskForm.endDate = end
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
 * 加载红蓝方可选国家列表。
 */
const loadCountryOptions = async () => {
  try {
    const res = await getBattleCountrys()
    if (res.code === 200 && Array.isArray(res.data)) {
      countryOptions.value = res.data
    }
  } catch (error) {
    console.error('加载国家列表失败:', error)
  }
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

  return {
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
}

/**
 * 校验并提交任务：目前仅支持新增（addTask），修改接口未就绪。
 */
const handleSubmit = async () => {
  if (!formRef.value) return
  if (props.isEdit) {
    ElMessage.warning('任务修改接口暂未开放，请新建任务')
    return
  }
  syncCountryFields()
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
      ElMessage.warning('请先选择当前场景后再添加任务')
      return
    }

    const taskPayload = buildAddTaskPayload()
    if (!taskPayload) return

    submitting.value = true
    try {
      const res = await addTask(taskPayload)
      if (res.code === 200) {
        const savedTask: TaskForm = {
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
        }
        const createdId = resolveCreatedTaskId(res.data)
        if (createdId != null) savedTask.id = createdId
        ElMessage.success('添加任务成功')
        visible.value = false
        emit('saved', savedTask)
      } else {
        ElMessage.error(res.msg || '添加任务失败')
      }
    } catch (error) {
      console.error('添加任务失败:', error)
      ElMessage.error('添加任务失败')
    } finally {
      submitting.value = false
    }
  })
}
</script>

<style lang="scss">
/** 项目 Element Plus 命名空间为 atlas-app，选择器必须用 atlas-app-* 才能生效。 */
.task-edit-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.task-edit-dialog-modal {
  background-color: rgba(4, 10, 20, 0.72) !important;
}

.atlas-app-dialog.task-edit-dialog,
.task-edit-dialog .atlas-app-dialog {
  --el-dialog-bg-color: rgba(8, 15, 26, 0.96);
  --el-color-primary: #00e1ff;
  --el-color-primary-light-3: #40f2ff;
  --el-color-primary-light-5: rgba(0, 225, 255, 0.55);
  --el-color-primary-light-7: rgba(0, 225, 255, 0.35);
  --el-color-primary-light-9: rgba(0, 225, 255, 0.12);
  --el-button-bg-color: #00e1ff;
  --el-button-text-color: #08202c;
  --el-button-hover-bg-color: #40f2ff;
  --el-button-hover-text-color: #04141c;
  --el-dialog-padding-primary: 0;
  padding: 0 !important;
  background: rgba(8, 15, 26, 0.96) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;
  border-radius: 10px !important;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.55),
    0 0 18px rgba(0, 225, 255, 0.12) !important;
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

  .atlas-app-dialog__header {
    flex-shrink: 0;
    margin-right: 0;
    padding: 10px 20px;
    background: rgba(8, 15, 26, 0.96);
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  .atlas-app-dialog__title {
    color: #40f2ff !important;
    font-size: 15px;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .atlas-app-dialog__headerbtn .atlas-app-dialog__close {
    color: #94a3b8 !important;

    &:hover {
      color: #00e1ff !important;
    }
  }

  .atlas-app-dialog__body {
    flex: 1;
    min-height: 0;
    padding: 0 !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: rgba(12, 22, 38, 0.72);
    color: #e2efff;
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
    border-right: 1px solid rgba(0, 225, 255, 0.16);
    background: rgba(8, 15, 26, 0.55);
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
    color: #94a3b8;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: all 0.18s ease;

    &:hover {
      color: #e0faff;
      background: rgba(0, 225, 255, 0.08);
    }

    &.is-active {
      color: #40f2ff;
      background: rgba(0, 225, 255, 0.14);
      border-color: rgba(0, 225, 255, 0.35);
      box-shadow: inset 3px 0 0 #00e1ff;
    }
  }

  .task-edit-nav-label {
    font-weight: 600;
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

  .atlas-app-dialog__footer {
    flex-shrink: 0;
    padding: 0 !important;
    margin: 0 !important;
    background: rgba(8, 15, 26, 0.96);
    border-top: 1px solid rgba(0, 225, 255, 0.18);
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

    .atlas-app-button {
      height: 32px;
      padding: 0 16px;
      margin: 0 !important;
      font-size: 13px;
      line-height: 32px;
    }
  }

  .task-edit-form {
    --el-form-item-margin-bottom: 16px;

    .atlas-app-form-item {
      margin-bottom: 16px;
    }

    .atlas-app-form-item:last-child {
      margin-bottom: 0;
    }
  }

  .atlas-app-form-item__label {
    color: #7dd3fc !important;
    font-size: 13px;
  }

  .atlas-app-form-item.is-required:not(.is-no-asterisk)>.atlas-app-form-item__label::before {
    color: #f87171 !important;
  }

  .atlas-app-input__wrapper,
  .atlas-app-textarea__wrapper,
  .atlas-app-select__wrapper,
  .atlas-app-date-editor.atlas-app-input__wrapper,
  .atlas-app-date-editor {
    background-color: rgba(8, 20, 36, 0.9) !important;
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.32) inset !important;
    border-radius: 6px;

    &:hover {
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.55) inset !important;
    }

    &.is-focus,
    &.is-focused {
      box-shadow:
        0 0 0 1px #00e1ff inset,
        0 0 8px rgba(0, 225, 255, 0.28) !important;
    }
  }

  /**
   * Element Plus 多行输入没有 wrapper，边框画在 textarea.inner 上。
   */
  .atlas-app-textarea__inner {
    color: #e2efff !important;
    background-color: rgba(8, 20, 36, 0.9) !important;
    border: none !important;
    border-radius: 6px !important;
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.32) inset !important;

    &::placeholder {
      color: #64748b !important;
    }

    &:hover {
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.55) inset !important;
    }

    &:focus {
      box-shadow:
        0 0 0 1px #00e1ff inset,
        0 0 8px rgba(0, 225, 255, 0.28) !important;
    }
  }

  .atlas-app-input__count,
  .atlas-app-input__count-inner {
    color: #64748b !important;
    background: transparent !important;
  }

  .atlas-app-select__placeholder,
  .atlas-app-range-separator {
    color: #94a3b8 !important;
  }

  .atlas-app-range-input {
    color: #e2efff !important;
    background: transparent !important;
  }

  .atlas-app-select__selected-item,
  .atlas-app-select__caret,
  .atlas-app-select__suffix {
    color: #e2efff !important;
  }

  .atlas-app-tag {
    background: rgba(0, 225, 255, 0.14) !important;
    border-color: rgba(0, 225, 255, 0.35) !important;
    color: #7dd3fc !important;
  }

  .atlas-app-tag .atlas-app-tag__close {
    color: #7dd3fc !important;

    &:hover {
      background: rgba(0, 225, 255, 0.28) !important;
      color: #40f2ff !important;
    }
  }

  .atlas-app-switch.is-checked .atlas-app-switch__core {
    background-color: #00e1ff !important;
    border-color: #00e1ff !important;
  }

  .atlas-app-switch__core {
    background-color: rgba(100, 116, 139, 0.55) !important;
    border-color: rgba(148, 163, 184, 0.4) !important;
  }

  .task-datetime-input {
    width: 100%;
    height: 36px;
    padding: 0 10px;
    box-sizing: border-box;
    color: #e2efff;
    background: rgba(8, 20, 36, 0.9);
    border: 1px solid rgba(0, 225, 255, 0.32);
    border-radius: 6px;
    outline: none;
    color-scheme: dark;

    &:hover {
      border-color: rgba(0, 225, 255, 0.55);
    }

    &:focus {
      border-color: #00e1ff;
      box-shadow: 0 0 8px rgba(0, 225, 255, 0.28);
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
    background: rgba(8, 20, 36, 0.9);
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.32) inset;

    .atlas-app-checkbox {
      margin-right: 0;
      height: auto;
    }

    .atlas-app-checkbox__label {
      color: #e2efff;
      font-size: 13px;
      padding-left: 8px;
    }

    .atlas-app-checkbox__input.is-checked + .atlas-app-checkbox__label {
      color: #7dd3fc;
    }

    .atlas-app-checkbox__inner {
      background-color: rgba(8, 20, 36, 0.9);
      border-color: rgba(0, 225, 255, 0.45);
    }

    .atlas-app-checkbox__input.is-checked .atlas-app-checkbox__inner {
      background-color: #00e1ff;
      border-color: #00e1ff;
    }

    .atlas-app-checkbox__input.is-checked .atlas-app-checkbox__inner::after {
      border-color: #08202c;
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
    font-size: 13px;
    color: #9ecfe8;
    white-space: nowrap;
  }

  .metric-input-hint {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: #7dd3fc;
    white-space: nowrap;
  }

  .task-edit-btn--ghost.atlas-app-button,
  .atlas-app-button.task-edit-btn--ghost {
    --el-button-bg-color: rgba(0, 225, 255, 0.08);
    --el-button-text-color: #7dd3fc;
    --el-button-border-color: rgba(0, 225, 255, 0.4);
    --el-button-hover-bg-color: rgba(0, 225, 255, 0.18);
    --el-button-hover-text-color: #40f2ff;
    --el-button-hover-border-color: #00e1ff;
    color: #7dd3fc !important;
    background: rgba(0, 225, 255, 0.08) !important;
    border: 1px solid rgba(0, 225, 255, 0.4) !important;

    &:hover {
      color: #40f2ff !important;
      background: rgba(0, 225, 255, 0.18) !important;
      border-color: #00e1ff !important;
    }
  }

  .task-edit-btn--primary.atlas-app-button,
  .atlas-app-button.task-edit-btn--primary,
  .atlas-app-button--primary.task-edit-btn--primary {
    --el-button-bg-color: #00e1ff;
    --el-button-text-color: #08202c;
    --el-button-border-color: #00e1ff;
    --el-button-hover-bg-color: #40f2ff;
    --el-button-hover-text-color: #04141c;
    --el-button-hover-border-color: #40f2ff;
    color: #08202c !important;
    background: linear-gradient(135deg, #40f2ff, #00b8d4) !important;
    border: 1px solid #00e1ff !important;

    &:hover {
      color: #04141c !important;
      background: linear-gradient(135deg, #7af7ff, #00e1ff) !important;
      border-color: #40f2ff !important;
    }
  }
}

.task-edit-select-popper.atlas-app-popper,
.task-edit-date-popper.atlas-app-popper,
.atlas-app-popper.task-edit-select-popper,
.atlas-app-popper.task-edit-date-popper {
  background: rgba(8, 15, 26, 0.98) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55) !important;

  .atlas-app-select-dropdown__item {
    color: #cbd5e1 !important;

    &:hover,
    &.is-hovering {
      background: rgba(0, 225, 255, 0.12) !important;
      color: #40f2ff !important;
    }

    &.is-selected {
      color: #40f2ff !important;
      font-weight: 600;
    }
  }

  .atlas-app-picker-panel,
  .atlas-app-date-range-picker {
    background: transparent !important;
    color: #e2efff !important;
    border: none !important;
  }

  .atlas-app-date-range-picker__header,
  .atlas-app-date-picker__header-label,
  .atlas-app-picker-panel__icon-btn {
    color: #7dd3fc !important;
  }

  .atlas-app-date-table th {
    color: #64748b !important;
    border-bottom-color: rgba(0, 225, 255, 0.15) !important;
  }

  .atlas-app-date-table td .atlas-app-date-table-cell__text {
    color: #e2efff !important;
  }

  .atlas-app-date-table td.available:hover .atlas-app-date-table-cell__text,
  .atlas-app-date-table td.current:not(.disabled) .atlas-app-date-table-cell__text {
    background: rgba(0, 225, 255, 0.22) !important;
    color: #40f2ff !important;
  }

  .atlas-app-date-table td.in-range .atlas-app-date-table-cell {
    background: rgba(0, 225, 255, 0.1) !important;
  }

  .atlas-app-time-panel {
    background: rgba(8, 15, 26, 0.98) !important;
    border-color: rgba(0, 225, 255, 0.22) !important;
  }

  .atlas-app-time-spinner__item {
    color: #cbd5e1 !important;

    &:hover:not(.is-disabled):not(.is-active) {
      background: rgba(0, 225, 255, 0.12) !important;
    }

    &.is-active:not(.is-disabled) {
      color: #40f2ff !important;
    }
  }

  .atlas-app-picker-panel__footer {
    background: rgba(8, 15, 26, 0.96) !important;
    border-top: 1px solid rgba(0, 225, 255, 0.15) !important;
  }
}
</style>
