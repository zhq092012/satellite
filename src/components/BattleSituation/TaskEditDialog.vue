<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="1480px" align-center append-to-body destroy-on-close
    class="task-edit-dialog" modal-class="task-edit-dialog-modal" @closed="handleClosed">
    <div class="task-edit-layout">
      <nav class="task-edit-nav" aria-label="任务配置菜单">
        <button v-for="item in taskEditMenus" :key="item.key" type="button" class="task-edit-nav-item"
          :class="{ 'is-active': activeTab === item.key }" @click="activeTab = item.key">
          <span class="task-edit-nav-label">{{ item.label }}</span>
        </button>
      </nav>

      <div class="task-edit-main">
        <div v-show="activeTab === 'basic'" class="task-edit-pane">
          <el-form ref="formRef" :model="taskForm" :rules="formRules" label-width="148px" class="task-edit-form">
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
            <el-form-item label="卫星类型">
              <el-select v-model="assembleTargetTypes" multiple placeholder="请选择卫星类型"
                popper-class="task-edit-select-popper" style="width: 100%">
                <el-option v-for="item in satelliteTypes" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
            <el-form-item label="命令来源">
              <el-select v-model="combatScenario.commandSourceId" placeholder="请选择命令来源"
                popper-class="task-edit-select-popper" style="width: 100%">
                <el-option v-for="item in COMMAND_SOURCE_OPTIONS" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="作战阶段">
              <el-select v-model="combatScenario.combatPhaseId" placeholder="请选择作战阶段" style="width: 100%"
                popper-class="task-edit-select-popper" @change="handleCombatPhaseChange">
                <el-option v-for="item in COMBAT_PHASE_OPTIONS" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="作战对象" prop="country">
              <div class="combat-object-options" role="group" aria-label="作战对象">
                <div v-for="country in combatObjectCountryOptions" :key="country" class="combat-object-chip" :class="{
                  'combat-object-chip--active': isCombatObjectActive(country),
                  'combat-object-chip--inactive': !isCombatObjectActive(country),
                }">
                  <el-checkbox :model-value="isCombatObjectActive(country)" disabled class="combat-object-check" />
                  <span class="combat-object-label">{{ country }}</span>
                </div>
              </div>
            </el-form-item>
            <el-form-item label="作战背景">
              <el-select v-model="combatScenario.backgroundId" placeholder="请选择作战背景"
                popper-class="task-edit-select-popper" style="width: 100%">
                <el-option v-for="item in COMBAT_BACKGROUND_OPTIONS" :key="item.id" :label="item.label"
                  :value="item.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="作战预期">
              <div class="expectation-select-row">
                <el-select v-model="combatScenario.expectationPrimaryId" placeholder="一级预期" style="width: 42%"
                  popper-class="task-edit-select-popper" @change="handleExpectationPrimaryChange">
                  <el-option v-for="item in COMBAT_EXPECTATION_PRIMARY_OPTIONS" :key="item.id" :label="item.label"
                    :value="item.id" />
                </el-select>
                <el-select v-model="combatScenario.expectationSecondaryId" placeholder="二级预期" style="width: 56%"
                  popper-class="task-edit-select-popper" :disabled="!combatScenario.expectationPrimaryId">
                  <el-option v-for="item in expectationSecondaryOptions" :key="item.id" :label="item.label"
                    :value="item.id" />
                </el-select>
              </div>
            </el-form-item>
            <el-form-item label="任务区域">
              <div class="task-areas-block">
                <div class="task-areas-toolbar">
                  <el-button type="primary" plain @click="openAreaPicker">在地球上选取</el-button>
                  <span class="task-areas-hint">支持多个区域；多边形左键选点右键闭合，圆形左键拖拽。</span>
                </div>
                <el-table v-if="taskForm.areas.length" :data="taskForm.areas" size="small" border
                  class="task-areas-table" empty-text="暂无任务区域">
                  <el-table-column prop="name" label="名称" min-width="140">
                    <template #default="{ row }">
                      <el-input v-model="row.name" size="small" maxlength="40" />
                    </template>
                  </el-table-column>
                  <el-table-column label="类型" width="88" align="center">
                    <template #default="{ row }">
                      {{ row.type === 'CIRCLE' ? '圆形' : '多边形' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="中心 (°)" min-width="168">
                    <template #default="{ row }">
                      {{ formatAreaCenter(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="半径(km)" width="100" align="right">
                    <template #default="{ row }">
                      {{ formatAreaRadius(row) }}
                    </template>
                  </el-table-column>
                  <el-table-column label="启用" width="72" align="center">
                    <template #default="{ row }">
                      <el-switch v-model="row.enabled" />
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="72" align="center">
                    <template #default="{ $index }">
                      <el-button type="danger" link @click="removeTaskArea($index)">删除</el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <div v-else class="task-areas-empty">暂无任务区域</div>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <TaskAssembleTab v-if="activeTab === 'satellite'" ref="satelliteAssembleRef" kind="satellite"
          :reset-key="assembleResetKey" :combat-countries="combatCountriesForAssembly"
          :target-types="assembleTargetTypes" />
        <TaskAssembleTab ref="stationAssembleRef" v-show="activeTab === 'station'" kind="station"
          :reset-key="assembleResetKey" />
        <TaskTargetRelationTab v-show="activeTab === 'relation'" ref="targetRelationRef" :reset-key="assembleResetKey"
          :satellite-options="relationSatelliteOptions" :relay-options="relationRelayOptions"
          :station-options="relationStationOptions" />
        <TaskAssembleTab ref="weaponAssembleRef" v-show="activeTab === 'weapon'" kind="weapon"
          :reset-key="assembleResetKey" />
      </div>
    </div>
    <template #footer>
      <div class="task-edit-footer">
        <el-button class="task-edit-btn task-edit-btn--ghost" @click="visible = false">取 消</el-button>
        <el-button class="task-edit-btn task-edit-btn--primary" type="primary" :loading="submitting"
          @click="handleSubmit">
          {{ isEdit ? '修 改' : '保 存' }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  <TaskAreaGlobePickerDialog v-model="areaPickerVisible" :temp-area-id="areaPickerTempId"
    :default-name="nextAreaDefaultName" @confirm="handleAreaPicked" />
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { createTask, updateTask } from '@/api/task/task'
import { MISSION_SYS_TYPES, TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import {
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  COMMAND_SOURCE_OPTIONS,
  resolveEnemyCountriesByCombatPhase,
  type CombatScenarioSelection,
} from '@/config/combatScenarioOptions'
import {
  applyCombatScenarioSelectionToTaskFields,
  DEFAULT_TASK_COMBAT_COUNTRY,
  formatTaskCountryField,
  mapAssembleRowToTaskResource,
  parseTaskCombatCountries,
  resolveCombatScenarioSelectionFromTask,
  resolveTaskCountryFieldFromEntity,
} from '@/utils/taskEntity'
import { useLayoutStore } from '@/store/modules/layout'
import TaskAssembleTab, { type TaskAssembleRow } from '@/components/BattleSituation/TaskAssembleTab.vue'
import TaskTargetRelationTab from '@/components/BattleSituation/TaskTargetRelationTab.vue'
import TaskAreaGlobePickerDialog from '@/components/BattleSituation/TaskAreaGlobePickerDialog.vue'
import type { TaskArea, TaskForm, TaskRelationEndpointOption, TaskResourceItem } from '@/types/task/task'

/** 任务弹窗左侧菜单 key。 */
type TaskEditTabKey =
  /** 基本信息 */
  | 'basic'
  /** 卫星配置 */
  | 'satellite'
  /** 地面站配置 */
  | 'station'
  /** 目标关系配置 */
  | 'relation'
  /** 武器配置 */
  | 'weapon'

/** 左侧竖向菜单项。 */
interface TaskEditMenuItem {
  /** 对应右侧内容页 */
  key: TaskEditTabKey
  /** 菜单文案 */
  label: string
}

const store = useLayoutStore()


/** 新建任务默认作战对象（作战阶段选择后覆盖） */
/** 新建任务默认卫星类型（四分类全选） */
const DEFAULT_TARGET_TYPES = [...MISSION_SYS_TYPES] as string[]
/** 新建任务默认时长（小时） */
const DEFAULT_TASK_DURATION_HOURS = 8

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
/** 作战目标下拉选项。 */
const satelliteTypes = [...MISSION_SYS_TYPES]

/** 作战场景 */
const combatScenario = reactive<CombatScenarioSelection>({
  backgroundId: COMBAT_BACKGROUND_OPTIONS[0]?.id ?? '',
  commandSourceId: COMMAND_SOURCE_OPTIONS[0]?.id ?? '',
  combatPhaseId: COMBAT_PHASE_OPTIONS[0]?.id ?? '',
  expectationPrimaryId: COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.id ?? '',
  expectationSecondaryId: COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.children[0]?.id ?? '',
})

/** 作战对象固定展示顺序（三项始终可见） */
const combatObjectCountryOptions = [...TASK_ENEMY_COUNTRY_OPTIONS]

/**
 * 当前作战阶段是否勾选该作战对象（与任务 `country` 拆分列表一致）。
 *
 * @param country 国家/地区名称
 */
const isCombatObjectActive = (country: string): boolean =>
  parseTaskCombatCountries(taskForm.country).includes(country)

/**
 * 计算：卫星资源树查询用的作战对象国家列表。
 * 返回：由 `taskForm.country` 拆分后的国家名数组。
 * 作用：传给卫星装配 Tab 拉取资源树。
 */
const combatCountriesForAssembly = computed(() => parseTaskCombatCountries(taskForm.country))

/**
 * 计算：当前作战预期一级选项下的二级子选项列表。
 * 返回：匹配 `combatScenario.expectationPrimaryId` 的 `children`，无匹配时为空数组。
 * 作用：驱动作战预期二级下拉的可选项。
 */
const expectationSecondaryOptions = computed(() => {
  const primary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find(
    (item) => item.id === combatScenario.expectationPrimaryId,
  )
  return primary?.children ?? []
})

/** 卫星装配筛选用类型（不写入任务实体，接口无该字段）。 */
const assembleTargetTypes = ref<string[]>([...DEFAULT_TARGET_TYPES])

/** 深拷贝任务区域列表，避免编辑时污染原任务对象。 */
const cloneTaskAreas = (areas?: TaskArea[]): TaskArea[] =>
  (areas ?? []).map((area) => ({
    ...area,
    points: area.points?.map((pt) => ({ lng: pt.lng, lat: pt.lat })) ?? [],
    center: { lng: area.center.lng, lat: area.center.lat },
  }))

/** 客户端临时区域 ID 序列（待后端分配正式 ID）。 */
let tempTaskAreaIdSeq = 0
const allocTempTaskAreaId = () => {
  tempTaskAreaIdSeq += 1
  return `client-area-${tempTaskAreaIdSeq}`
}

const areaPickerVisible = ref(false)
const areaPickerTempId = ref('client-area-0')

/**
 * 计算：打开区域选取器时的默认名称。
 * 返回：`区域N` 字符串。
 * 作用：区域选取弹窗默认填充名称。
 */
const nextAreaDefaultName = computed(() => `区域${taskForm.areas.length + 1}`)

const openAreaPicker = () => {
  areaPickerTempId.value = allocTempTaskAreaId()
  areaPickerVisible.value = true
}

/** 将地球选取结果追加到任务区域列表。 */
const handleAreaPicked = (area: TaskArea) => {
  taskForm.areas.push({
    ...area,
    points: area.points.map((pt) => ({ ...pt })),
    center: { ...area.center },
  })
}

/** 删除指定下标的任务区域。 */
const removeTaskArea = (index: number) => {
  taskForm.areas.splice(index, 1)
}

const formatAreaCenter = (area: TaskArea): string => {
  const lng = area.center?.lng
  const lat = area.center?.lat
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return '--'
  return `${lng.toFixed(4)}, ${lat.toFixed(4)}`
}

const formatAreaRadius = (area: TaskArea): string => {
  if (!Number.isFinite(area.radius)) return '--'
  return area.radius.toFixed(2)
}

/** 可编辑任务表单。 */
const taskForm = reactive<TaskForm>({
  battleId: '',
  name: '',
  description: '',
  beginDate: '',
  endDate: '',
  taskSource: '',
  background: '',
  expectation: '',
  expectationCases: [],
  forecastHour: DEFAULT_TASK_DURATION_HOURS,
  areas: [],
  country: DEFAULT_TASK_COMBAT_COUNTRY,
  steps: '',
  focusStatus: 0,
  delayMin: 60,
  coverage: 50,
  satellites: [],
  receiveStations: [],
  weapons: [],
})

/** 任务表单校验规则。 */
const formRules = reactive<FormRules<TaskForm>>({
  name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入任务概述', trigger: 'blur' }],
  country: [{
    validator: (_rule, value, callback) => {
      if (!parseTaskCombatCountries(value).length) {
        callback(new Error('请选择作战阶段以确定作战对象'))
        return
      }
      callback()
    },
    trigger: 'change',
  }],
  beginDate: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endDate: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
})

/** 对话框可见性与 v-model 同步。 */
const visible = ref(false)

/**
 * 计算：任务弹窗是否处于编辑（非纯新增）模式。
 * 返回：`props.isEdit` 为真时为 `true`。
 * 作用：控制保存按钮等编辑态 UI 与标题文案分支。
 */
const isEdit = computed(() => !!props.isEdit)

/**
 * 计算：任务编辑弹窗标题文案。
 * 返回：编辑模式为「修改任务」，否则为「添加任务」。
 * 作用：弹窗头部展示当前为新增还是修改任务。
 */
const dialogTitle = computed(() => (isEdit.value ? '修改任务' : '添加任务'))

/** 各装配页组件引用，用于提交时汇总已选资源。 */
const satelliteAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)
const stationAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)
const targetRelationRef = ref<InstanceType<typeof TaskTargetRelationTab> | null>(null)
const weaponAssembleRef = ref<InstanceType<typeof TaskAssembleTab> | null>(null)

/** 左侧竖向菜单。 */
const taskEditMenus: TaskEditMenuItem[] = [
  { key: 'basic', label: '基本信息' },
  { key: 'satellite', label: '卫星配置' },
  { key: 'station', label: '地面站配置' },
  { key: 'relation', label: '目标关系配置' },
  { key: 'weapon', label: '武器配置' },
]

/** 当前右侧内容页。 */
const activeTab = ref<TaskEditTabKey>('basic')
/** 装配页重置令牌，弹窗每次打开递增。 */
const assembleResetKey = ref(0)
/** 卫星 Tab 未挂载时暂存回显数据，进入卫星页后写入装配组件。 */
const pendingSatelliteRestore = ref<TaskResourceItem[] | null>(null)

/**
 * 计算：目标关系「卫星（系列）」下拉选项，来自卫星装配页已选系列。
 * 返回：id/label 列表。
 * 作用：供目标关系配置 Tab 选择链路边端点。
 */
const relationSatelliteOptions = computed((): TaskRelationEndpointOption[] => {
  const rows = satelliteAssembleRef.value?.getAssembledRows() ?? []
  return rows.map((row) => ({
    id: row.id,
    label: row.name || row.series || row.id,
  }))
})

/**
 * 计算：目标关系「中继卫星」下拉选项。
 * 返回：已选系列列表；任务含通信类型时与卫星系列同源，否则仍使用已装配系列供演示配置。
 * 作用：中继端点候选列表。
 */
const relationRelayOptions = computed((): TaskRelationEndpointOption[] => relationSatelliteOptions.value)

/**
 * 计算：目标关系「地面站」下拉选项。
 * 返回：地面站装配页已选资源。
 * 作用：地面站端点候选列表。
 */
const relationStationOptions = computed((): TaskRelationEndpointOption[] => {
  const rows = stationAssembleRef.value?.getAssembledRows() ?? []
  return rows.map((row) => ({
    id: row.id,
    label: row.name || row.id,
  }))
})

/**
 * 监听：父组件 v-model 绑定的 `props.modelValue`（弹窗开关）。
 * 返回：回调不返回清理函数。
 * 作用：同步本地 `visible`，打开时重置装配页、回填表单并加载国家选项。
 */
watch(
  () => props.modelValue,
  (open) => {
    visible.value = open
    if (open) {
      activeTab.value = 'basic'
      fillForm(props.task)
      assembleResetKey.value += 1
    }
  }
)

/**
 * 监听：本地弹窗可见性 `visible`。
 * 返回：回调不返回清理函数。
 * 作用：向父组件 `emit('update:modelValue')` 以保持双向绑定一致。
 */
watch(visible, (open) => {
  if (open !== props.modelValue) {
    emit('update:modelValue', open)
  }
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
const durationHours = ref(DEFAULT_TASK_DURATION_HOURS)

/**
 * 监听：任务表单起止时间 `taskForm.beginDate` 与 `taskForm.endDate`（`immediate` 立即执行）。
 * 返回：回调不返回清理函数。
 * 作用：起止时间变化时用 `calcDurationHoursFromDates` 更新 `durationHours` 展示。
 */
watch(
  () => [taskForm.beginDate, taskForm.endDate] as const,
  () => {
    durationHours.value = calcDurationHoursFromDates()
  },
  { immediate: true }
)



/** 任务指标默认值：链路时延（分钟）、覆盖率（%）。 */
const DEFAULT_DELAY_MIN = 60
const DEFAULT_COVERAGE = 50

/**
 * 计算：任务链路时延（分钟），含 getter/setter。
 * 返回：getter 为 `taskForm.delayMin`（缺省 `DEFAULT_DELAY_MIN`）；setter 写入 `taskForm.delayMin`。
 * 作用：表单项与任务表单字段双向绑定链路时延指标。
 */
const linkDelayMin = computed({
  get: () => taskForm.delayMin ?? DEFAULT_DELAY_MIN,
  set: (value: number) => {
    taskForm.delayMin = value
  },
})

/**
 * 计算：任务覆盖率（%），含 getter/setter。
 * 返回：getter 为 `taskForm.coverage`（缺省 `DEFAULT_COVERAGE`）；setter 写入 `taskForm.coverage`。
 * 作用：表单项与任务表单字段双向绑定覆盖率指标。
 */
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
 * 从任务 resources / weaponIds 恢复各装配页已选资源（卫星系列不在弹窗内回显勾选）。
 *
 * @param task 列表接口返回的任务对象
 */
const applyPendingSatelliteRestore = () => {
  const pending = pendingSatelliteRestore.value
  if (!pending?.length || !satelliteAssembleRef.value) return
  satelliteAssembleRef.value.setAssembledTaskSatellites(pending)
  pendingSatelliteRestore.value = null
}

/**
 * 监听：任务编辑弹窗当前 Tab。
 * 回调不返回清理函数。
 * 作用：进入卫星配置页且卫星 Tab 挂载后应用暂存的卫星回显。
 */
watch(activeTab, (tab) => {
  if (tab !== 'satellite') return
  void nextTick(() => applyPendingSatelliteRestore())
})

const restoreAssembleFromTask = (task: TaskForm) => {
  const satellites = (task.satellites ?? []).map((item) => ({
    resourceId: item.resourceId,
    name: item.name,
    code: item.code,
  }))
  pendingSatelliteRestore.value = satellites.length ? satellites : null
  satelliteAssembleRef.value?.setAssembledTaskSatellites(satellites)
  if (satelliteAssembleRef.value) {
    pendingSatelliteRestore.value = null
  }
  stationAssembleRef.value?.setAssembledRows(
    (task.receiveStations ?? []).map((item) =>
      createPlaceholderRow(item.resourceId, item.name || item.resourceId),
    ),
  )
  weaponAssembleRef.value?.setAssembledRows(
    (task.weapons ?? []).map((item) => createPlaceholderRow(item.resourceId, item.name || item.resourceId)),
  )
  void nextTick(() => {
    targetRelationRef.value?.setRelations([])
  })
}

/**
 * 获取新建任务默认开始时间（当天 08:00）。
 *
 * @returns `YYYY-MM-DD HH:mm` 格式时间
 */
const createDefaultBeginDate = (): string => {
  const now = new Date()
  const begin = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0)
  return formatDateToTaskTime(begin)
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
  return formatDateToTaskTime(new Date(beginMs + hours * 3600000))
}

/**
 * 重置为当前场景下的空白任务（添加模式）。
 */
const resetCreateForm = () => {
  const beginDate = createDefaultBeginDate()
  const endDate = createDefaultEndDate(beginDate, DEFAULT_TASK_DURATION_HOURS)
  Object.assign(taskForm, {
    id: undefined,
    battleId: store.battle?.id != null ? String(store.battle.id) : '',
    name: '',
    description: '',
    beginDate,
    endDate,
    taskSource: '',
    background: '',
    expectation: '',
    expectationCases: [],
    country: DEFAULT_TASK_COMBAT_COUNTRY,
    steps: '',
    focusStatus: 0,
    delayMin: DEFAULT_DELAY_MIN,
    coverage: DEFAULT_COVERAGE,
    satellites: [],
    receiveStations: [],
    weapons: [],
    forecastHour: DEFAULT_TASK_DURATION_HOURS,
    areas: [] as TaskArea[],
  })
  assembleTargetTypes.value = [...DEFAULT_TARGET_TYPES]
  durationHours.value = DEFAULT_TASK_DURATION_HOURS
  initCombatScenarioDefaults()
  void nextTick(() => {
    satelliteAssembleRef.value?.setAssembledRows([])
    stationAssembleRef.value?.setAssembledRows([])
    weaponAssembleRef.value?.setAssembledRows([])
    targetRelationRef.value?.setRelations([])
  })
}

/** 初始化作战场景默认值 */
const initCombatScenarioDefaults = () => {
  combatScenario.backgroundId = COMBAT_BACKGROUND_OPTIONS[0]?.id ?? ''
  combatScenario.commandSourceId = COMMAND_SOURCE_OPTIONS[0]?.id ?? ''
  combatScenario.combatPhaseId = COMBAT_PHASE_OPTIONS[0]?.id ?? ''
  combatScenario.expectationPrimaryId = COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.id ?? ''
  combatScenario.expectationSecondaryId =
    COMBAT_EXPECTATION_PRIMARY_OPTIONS[0]?.children[0]?.id ?? ''
  applyCombatPhaseToCountry(combatScenario.combatPhaseId)
}

/**
 * 填充作战场景
 * @param task 任务
 */
const syncCombatScenarioFromTask = (task: TaskForm) => {
  const selection = resolveCombatScenarioSelectionFromTask({
    ...task,
    country: resolveTaskCountryFieldFromEntity(task),
  })
  combatScenario.backgroundId = selection.backgroundId
  combatScenario.commandSourceId = selection.commandSourceId
  combatScenario.combatPhaseId = selection.combatPhaseId
  combatScenario.expectationPrimaryId = selection.expectationPrimaryId
  combatScenario.expectationSecondaryId = selection.expectationSecondaryId
  if (!parseTaskCombatCountries(task.country).length) {
    applyCombatPhaseToCountry(selection.combatPhaseId)
  }
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
    battleId: task.battleId != null ? String(task.battleId) : '',
    country: resolveTaskCountryFieldFromEntity(task),
    expectationCases: task.expectationCases ? [...task.expectationCases] : [],
    steps: task.steps || '',
    focusStatus: Number(task.focusStatus) === 1 ? 1 : 0,
    delayMin: Number.isFinite(task.delayMin) ? Number(task.delayMin) : DEFAULT_DELAY_MIN,
    coverage: Number.isFinite(task.coverage) ? Number(task.coverage) : DEFAULT_COVERAGE,
    satellites: task.satellites ? task.satellites.map((item) => ({ ...item })) : [],
    receiveStations: task.receiveStations ? task.receiveStations.map((item) => ({ ...item })) : [],
    weapons: task.weapons ? task.weapons.map((item) => ({ ...item })) : [],
    areas: cloneTaskAreas(task.areas),
  })
  assembleTargetTypes.value = [...DEFAULT_TARGET_TYPES]
  const begin = normalizeDateTime(task.beginDate)
  const end = normalizeDateTime(task.endDate)
  taskForm.beginDate = begin
  taskForm.endDate = end
  syncCombatScenarioFromTask(task)
  syncCountryFields()
  void nextTick(() => {
    restoreAssembleFromTask(task)
  })
}

/**
 * 将多选国家同步回逗号分隔字段，供提交使用。
 */
const syncCountryFields = () => {
  applyCombatScenarioSelectionToTaskFields(combatScenario, taskForm)
}

/**
 * 作战阶段变更：自动设置作战对象并写入 `country`。
 *
 * @param phaseId 作战阶段 ID
 */
const applyCombatPhaseToCountry = (phaseId: string) => {
  const countries = resolveEnemyCountriesByCombatPhase(phaseId)
  taskForm.country = formatTaskCountryField(countries)
  syncCountryFields()
  formRef.value?.validateField('country').catch(() => undefined)
}

const handleCombatPhaseChange = (phaseId: string) => {
  applyCombatPhaseToCountry(phaseId)
}

/**
 * 作战预期一级变更：重置二级为该项首选项。
 */
const handleExpectationPrimaryChange = () => {
  const first = expectationSecondaryOptions.value[0]
  combatScenario.expectationSecondaryId = first?.id ?? ''
}


/**
 * 对话框关闭后重置表单状态。
 */
const handleClosed = () => {
  formRef.value?.resetFields()
  pendingSatelliteRestore.value = null
}

/**
 * 从新增任务接口响应中解析新任务 ID。
 *
 * @param data 接口 data 字段（可能是数字或带 id 的对象）
 * @returns 新任务 ID；无法解析时为 undefined
 */
const resolveCreatedTaskId = (data: unknown): string | undefined => {
  if (typeof data === 'string' && data.trim()) return data.trim()
  const numeric = Number(data)
  if (Number.isFinite(numeric) && numeric > 0) return String(numeric)
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as { id?: string | number }).id
    if (id != null && String(id).trim()) return String(id).trim()
  }
  return undefined
}

/**
 * 汇总各装配页数据，构建算法新增任务请求体（satellites 为勾选的卫星 resourceId/name/code）。
 * @returns 请求体；校验失败时返回 null
 */
type AddTaskPayload = Parameters<typeof createTask>[0]

const buildAddTaskPayload = (): AddTaskPayload | null => {
  const satellites = satelliteAssembleRef.value
    ? satelliteAssembleRef.value.getAssembledTaskSatellites()
    : (taskForm.satellites ?? []).map((item) => ({
        resourceId: item.resourceId,
        name: item.name,
        code: item.code,
      }))
  const stations = stationAssembleRef.value?.getAssembledRows() ?? []
  const weapons = weaponAssembleRef.value?.getAssembledRows() ?? []

  syncCountryFields()

  if (!assembleTargetTypes.value.length) {
    ElMessage.warning('请选择卫星类型')
    activeTab.value = 'basic'
    return null
  }

  if (!satellites.length) {
    ElMessage.warning('请至少选择一颗卫星')
    activeTab.value = 'satellite'
    return null
  }

  return {
    battleId: store.battle?.id != null ? String(store.battle.id) : '',
    name: taskForm.name,
    description: taskForm.description,
    beginDate: normalizeDateTime(taskForm.beginDate),
    endDate: normalizeDateTime(taskForm.endDate),
    taskSource: taskForm.taskSource ?? '',
    background: taskForm.background ?? '',
    expectation: taskForm.expectation ?? '',
    expectationCases: [...(taskForm.expectationCases ?? [])],
    forecastHour: durationHours.value,
    country: taskForm.country ?? '',
    steps: taskForm.steps ?? '',
    focusStatus: taskForm.focusStatus ?? 0,
    areas: cloneTaskAreas(taskForm.areas),
    coverage: taskCoverage.value,
    delayMin: linkDelayMin.value,
    satellites: satellites.map((item) => ({
      resourceId: item.resourceId,
      name: item.name,
      code: item.code,
    })),
    receiveStations: stations.map((row) => mapAssembleRowToTaskResource(row)),
    weapons: weapons.map((row) => mapAssembleRowToTaskResource(row)),
  }
}

/**
 * 在编辑模式下合并表单与装配数据，构建 updateTask 请求体。
 *
 * @returns 完整任务对象；校验失败或缺少任务 ID 时返回 null
 */
const buildUpdateTaskPayload = (): TaskForm | null => {
  const base = props.task
  if (!base?.id) {
    ElMessage.warning('缺少任务 ID，无法修改任务')
    return null
  }
  const assembled = buildAddTaskPayload()
  if (!assembled) return null
  return {
    ...base,
    ...assembled,
    id: base.id,
    battleId: base.battleId,
    name: taskForm.name,
    description: taskForm.description,
    steps: taskForm.steps || base.steps || '',
    focusStatus: taskForm.focusStatus ?? base.focusStatus ?? 0,
    createTime: base.createTime,
    updateTime: base.updateTime,
  }
}

/**
 * 校验并提交任务：新增走 createTask，编辑走 updateTask。
 */
const handleSubmit = async () => {
  if (!formRef.value) return
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
    if (props.isEdit) {
      if (!props.task?.id) {
        ElMessage.warning('缺少任务 ID，无法修改任务')
        return
      }
    } else if (!store.battle?.id) {
      ElMessage.warning('请先选择当前场景后再添加任务')
      return
    }

    submitting.value = true
    try {
      if (props.isEdit) {
        const updatePayload = buildUpdateTaskPayload()
        if (!updatePayload) return
        const res = await updateTask(updatePayload)
        if (res.code === 200) {
          ElMessage.success('修改任务成功')
          visible.value = false
          emit('saved', updatePayload)
        } else {
          ElMessage.error(res.msg || '修改任务失败')
        }
        return
      }

      const taskPayload = buildAddTaskPayload()
      if (!taskPayload) return

      const res = await createTask(taskPayload)
      if (res.code === 200) {
        const savedTask: TaskForm = {
          ...taskPayload,
          name: taskForm.name,
          description: taskForm.description,
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
  --el-font-size-base: 18px;
  --el-form-label-font-size: 18px;
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
  width: min(1480px, 94vw) !important;
  max-width: 94vw !important;
  height: 86vh !important;
  max-height: 86vh !important;
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
    grid-template-columns: 220px minmax(0, 1fr);
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
    min-height: 44px;
    padding: 8px 12px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: #94a3b8;
    font-size: 18px !important;
    line-height: 1.35;
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
    font-size: 18px !important;
    font-weight: 600;
    line-height: 1.35;
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
      min-height: 40px;
      padding: 0 18px;
      margin: 0 !important;
      line-height: 1.2;
    }
  }

  .task-edit-form {
    --el-form-item-margin-bottom: 16px;
    font-size: 18px;

    .atlas-app-form-item {
      margin-bottom: 16px;
    }

    .atlas-app-form-item:last-child {
      margin-bottom: 0;
    }

    .enemy-country-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      min-height: 32px;
    }

    .combat-object-options {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      width: 100%;
    }

    .combat-object-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: background 0.15s, border-color 0.15s;

      &--active {
        border-color: rgba(248, 113, 113, 0.85);
        background: rgba(127, 29, 29, 0.45);

        .combat-object-label {
          color: #fecaca;
          font-weight: 700;
        }

        :deep(.atlas-app-checkbox__inner) {
          border-color: #f87171;
          background-color: #dc2626;
        }

        :deep(.atlas-app-checkbox__input.is-disabled.is-checked .atlas-app-checkbox__inner) {
          background-color: #dc2626;
          border-color: #f87171;
        }
      }

      &--inactive {
        border-color: rgba(250, 204, 21, 0.55);
        background: rgba(113, 63, 18, 0.35);

        .combat-object-label {
          color: #fde68a;
        }

        :deep(.atlas-app-checkbox__inner) {
          border-color: #eab308;
          background-color: rgba(30, 27, 10, 0.6);
        }
      }
    }

    .combat-object-check {
      height: auto;
      margin: 0;
    }

    .combat-object-label {
      font-size: 18px !important;
      line-height: 1.35;
    }

    .enemy-country-empty {
      color: #64748b;
    }

    .expectation-select-row {
      display: flex;
      gap: 8px;
      width: 100%;
    }

    .combat-scenario-hint {
      margin-bottom: 8px;
    }

    .task-areas-block {
      width: 100%;
    }

    .task-areas-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .task-areas-hint {
      color: #94a3b8;
      font-size: 13px;
    }

    .task-areas-empty {
      color: #64748b;
      font-size: 14px;
      padding: 8px 0;
    }

    .task-areas-table {
      width: 100%;
    }
  }

  .atlas-app-form-item__label {
    color: #7dd3fc !important;
    font-size: 18px !important;
    line-height: 1.35;
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
    min-height: 40px;
    padding: 0 12px;
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
      padding-left: 8px;
    }

    .atlas-app-checkbox__input.is-checked+.atlas-app-checkbox__label {
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
    color: #9ecfe8;
    white-space: nowrap;
  }

  .metric-input-hint {
    flex: 1;
    min-width: 0;
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

<style lang="scss">
@use '@/components/BattleSituation/styles/task-edit-typography.scss';
</style>
