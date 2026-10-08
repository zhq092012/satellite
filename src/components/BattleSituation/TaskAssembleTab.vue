<template>
  <div class="task-assemble-tab">
    <div class="assemble-head">
      <div>
        <h3 class="assemble-title">{{ config.title }}</h3>
        <p class="assemble-desc">{{ config.description }}</p>
      </div>
      <span v-if="!apiEnabled" class="assemble-api-tag">接口待接入</span>
    </div>
    <!-- 卫星装配页工具栏 -->
    <div class="assemble-toolbar">
      <el-button v-if="crudEnabled" class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
        @click="openCreateDialog">
        添加
      </el-button>
      <el-input v-model="keyword" size="small" clearable :placeholder="config.searchPlaceholder" class="assemble-search"
        style="width: 160px" @keyup.enter="handleSatelliteSearch" @clear="handleSatelliteSearch" />
      <el-select v-if="typeFilterOptions.length" v-model="typeFilter" size="small" clearable
        :placeholder="config.typePlaceholder" class="assemble-filter" style="width: 160px"
        popper-class="task-edit-select-popper" @change="handleSatelliteSearch" @clear="handleSatelliteSearch" filterable>
        <el-option v-for="item in typeFilterOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-button v-if="apiEnabled" class="task-edit-btn task-edit-btn--ghost" size="small" :loading="listLoading"
        @click="loadCandidatePool">
        刷新
      </el-button>
      <span class="assemble-count">{{ isSatelliteKind ? `已选系列 ${assembledRows.length} 个` : `已装配 ${assembledRows.length}
        项` }}</span>
    </div>
  
    <!-- 卫星装配：顶部系列多选 + 下方卫星预览 -->
    <div v-if="isSatelliteKind" class="assemble-satellite-layout">
      <section class="assemble-pane assemble-pane--series">
        <div class="assemble-pane-head">
          <span>选择卫星系列</span>
          <span class="assemble-pane-sub">{{ satelliteSeriesPanelSubText }}</span>
        </div>
        <div v-loading="listLoading" class="assemble-series-body">
          <p v-if="!seriesOptions.length" class="assemble-series-empty">{{ satelliteSeriesEmptyText }}</p>
          <el-checkbox-group v-else v-model="selectedSeriesList" class="assemble-series-checkboxes"
            @change="handleSeriesCheckboxChange">
            <el-checkbox v-for="item in seriesOptions" :key="item" :label="item" :value="item">
              {{ item }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </section>

      <section class="assemble-pane assemble-pane--sat-preview">
        <div class="assemble-pane-head">
          <span>系列卫星预览</span>
          <span class="assemble-pane-sub">{{ satellitePreviewSubText }}</span>
        </div>
        <div class="assemble-pane-body">
          <el-table v-loading="listLoading" :data="displayCandidates" size="small" height="100%" row-key="id"
            class="assemble-table" empty-text="勾选系列后展示对应卫星（仅预览，提交仅传系列）">
            <el-table-column v-for="col in tableColumns" :key="col.prop" :prop="col.prop" :label="col.label"
              :min-width="col.minWidth" :width="col.width" show-overflow-tooltip />
          </el-table>
        </div>
      </section>
    </div>

    <!-- 地面站 / 数据中心 / 武器：单表勾选即装配 -->
    <div v-else class="assemble-single-layout">
      <section class="assemble-pane">
        <div class="assemble-pane-head">
          <span>资源列表</span>
          <span class="assemble-pane-sub">勾选表示装配，将随任务保存</span>
        </div>
        <div class="assemble-pane-body">
          <el-table ref="candidateTableRef" v-loading="listLoading" :data="displayCandidates" size="small"
            height="100%" row-key="id" class="assemble-table"
            :empty-text="apiEnabled ? '暂无资源' : '暂无候选资源，接口接入后将在此列出'"
            @selection-change="onAssemblyTableSelectionChange">
            <el-table-column type="selection" width="42" :reserve-selection="true" />
            <el-table-column v-for="col in tableColumns" :key="col.prop" :prop="col.prop" :label="col.label"
              :min-width="col.minWidth" :width="col.width" show-overflow-tooltip />
            <el-table-column v-if="crudEnabled" label="修改" width="64" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" class="assemble-edit-btn" @click="openEditDialog(row)">修改</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </div>

    <!-- 地面站 / 数据中心 新增编辑弹窗 -->
    <el-dialog v-if="isStationKind" v-model="stationDialogVisible" :title="stationDialogTitle" width="680px"
      append-to-body destroy-on-close align-center class="assemble-crud-dialog" modal-class="assemble-crud-dialog-modal"
      @closed="resetStationForm">
      <el-form ref="stationFormRef" :model="stationForm" :rules="stationRules" label-width="120px"
        class="assemble-crud-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="名称" prop="name">
              <el-input v-model.trim="stationForm.name" placeholder="请输入名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属国家/地区" prop="country">
              <el-select v-model="stationForm.country" filterable placeholder="请选择国家/地区" class="full-width"
                popper-class="task-edit-select-popper">
                <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="类型" prop="type">
              <el-input v-model.trim="stationForm.type" :placeholder="stationTypePlaceholder" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="位置" prop="location">
              <el-input v-model.trim="stationForm.location" placeholder="请输入位置" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经纬度" prop="latLon">
              <el-input v-model.trim="stationForm.latLon" placeholder="经度,纬度" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="功能" prop="function">
              <el-input v-model.trim="stationForm.function" placeholder="请输入功能" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="介绍" prop="introduction">
              <el-input v-model.trim="stationForm.introduction" type="textarea" :rows="3" placeholder="请输入介绍" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button v-if="stationForm._id" class="task-edit-btn task-edit-btn--ghost" type="danger" :loading="deleting"
          @click="handleDeleteStation">
          删除
        </el-button>
        <el-button class="task-edit-btn task-edit-btn--ghost" @click="stationDialogVisible = false">取消</el-button>
        <el-button class="task-edit-btn task-edit-btn--primary" type="primary" :loading="saving"
          @click="submitStationForm">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 武器 新增编辑弹窗 -->
    <el-dialog v-if="isWeaponKind" v-model="weaponDialogVisible" :title="weaponDialogTitle" width="720px" append-to-body
      destroy-on-close align-center class="assemble-crud-dialog" modal-class="assemble-crud-dialog-modal"
      @closed="resetWeaponForm">
      <el-form ref="weaponFormRef" :model="weaponForm" :rules="weaponRules" label-width="140px"
        class="assemble-crud-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="武器名称" prop="name">
              <el-input v-model.trim="weaponForm.name" placeholder="请输入武器名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属国家/地区" prop="country">
              <el-select v-model="weaponForm.country" filterable placeholder="请选择国家/地区" class="full-width"
                popper-class="task-edit-select-popper">
                <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="武器类型" prop="type">
              <el-input v-model.trim="weaponForm.type" placeholder="请输入武器类型" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用卫星类型" prop="satellite_type">
              <el-input v-model.trim="weaponForm.satellite_type" placeholder="请输入适用卫星类型" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="打击高度(km)" prop="range">
              <el-input-number v-model.number="weaponForm.range" :min="0" :controls="true" class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="打击间隔(分钟)" prop="interval">
              <el-input-number v-model.number="weaponForm.interval" :min="0" :controls="true"
                class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude">
              <el-input-number v-model.number="weaponForm.longitude" :min="-180" :max="180" :controls="true"
                class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude">
              <el-input-number v-model.number="weaponForm.latitude" :min="-90" :max="90" :controls="true"
                class="full-width-number" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button v-if="weaponForm.id" class="task-edit-btn task-edit-btn--ghost" type="danger" :loading="deleting"
          @click="handleDeleteWeapon">
          删除
        </el-button>
        <el-button class="task-edit-btn task-edit-btn--ghost" @click="weaponDialogVisible = false">取消</el-button>
        <el-button class="task-edit-btn task-edit-btn--primary" type="primary" :loading="saving"
          @click="submitWeaponForm">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 任务弹窗中的资源装配页（卫星 / 地面站 / 数据中心 / 武器）。
 * 卫星列表分页查询；地面站、数据中心、武器已接入增删改查。
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import type { TableInstance } from 'element-plus'
import {
  createWeapon,
  deleteWeapon,
  getAllWeapons,
  getBattleCountrys,
  getBattleSateTypes,
  updateWeapon,
} from '@/api/dashboard'
import { getSatelliteBySeries, getSatelliteSeries } from '@/api/task/task'
import { getOrbitType } from '@/utils/tools/satellite'
import {
  deleteBaseStations,
  getGroundStationList,
  saveOrUpdateBaseStation,
  type BaseStationInfo,
} from '@/api/system/satellite-system-api'
import type { Weapon } from '@/types/dashboard'

/** 装配资源类型。 */
export type TaskAssembleKind = 'satellite' | 'station' | 'center' | 'weapon'

/** 装配资源行。字段按类型复用，空值用 `--` 展示。 */
export interface TaskAssembleRow {
  /** 资源唯一标识 */
  id: string
  /** 名称 */
  name: string
  /** 卫星系列（仅卫星装配使用） */
  series: string
  /** 类型 */
  type: string
  /** 国家或所属方 */
  country: string
  /** 额外字段：NORAD、经度、适用卫星等 */
  extra1: string
  /** 额外字段：轨道、纬度、射程/间隔等 */
  extra2: string
  /** 额外字段：武器经度等 */
  extra3?: string
  /** 额外字段：武器纬度等 */
  extra4?: string
  /** 额外字段：武器打击间隔等 */
  extra5?: string
}

/** 表格列配置。 */
interface AssembleColumn {
  /** 对应行字段 */
  prop: keyof TaskAssembleRow
  /** 列标题 */
  label: string
  /** 弹性宽度 */
  minWidth?: number
  /** 固定宽度 */
  width?: number
}

/** 某一类装配页的文案与列定义。 */
interface AssembleKindConfig {
  /** 页标题 */
  title: string
  /** 页说明 */
  description: string
  /** 搜索框占位 */
  searchPlaceholder: string
  /** 类型筛选占位 */
  typePlaceholder: string
  /** 类型筛选项；接口接入后由数据动态生成 */
  typeOptions: string[]
  /** 系列筛选项；空数组则不展示系列筛选 */
  seriesOptions: string[]
  /** 表格列 */
  columns: AssembleColumn[]
}

const props = defineProps<{
  /** 装配资源种类 */
  kind: TaskAssembleKind
  /** 弹窗打开时递增，用于清空本地勾选与已装配列表 */
  resetKey: number
  /** 任务基本信息中的蓝方国家，卫星系列查询直接使用该列表 */
  enemyCountries?: string[]
  /** 任务基本信息中的卫星类型（侦察、通信），用于过滤系列下拉 */
  targetTypes?: string[]
}>()

/** 候选表实例，用于清空勾选。 */
const candidateTableRef = ref<TableInstance>()
/** 名称关键字。 */
const keyword = ref('')
/** 已勾选的卫星系列（多选，提交任务仅传系列名）。 */
const selectedSeriesList = ref<string[]>([])
/** 类型筛选。 */
const typeFilter = ref('')
/** 卫星系列候选项。 */
const seriesOptions = ref<string[]>([])
/** 最近一次系列接口返回，用于卫星类型变化时本地重算候选项。 */
const seriesDataCache = ref<{ 侦察?: string[]; 通信?: string[] } | null>(null)
/** 卫星类型筛选项。 */
const satTypes = ref<string[]>([])
/** 已装配资源（卫星为系列行；其余为勾选的资源行）。 */
const assembledRows = ref<TaskAssembleRow[]>([])
/** 单表模式下正在同步勾选，避免 selection-change 循环。 */
const syncingAssemblySelection = ref(false)
/** 列表加载中。 */
const listLoading = ref(false)
/** 表单保存中。 */
const saving = ref(false)
/** 删除中。 */
const deleting = ref(false)
/** 国家下拉选项。 */
const countries = ref<string[]>([])
/** 地面站/数据中心原始数据缓存，供编辑回填。 */
const stationRawMap = reactive<Record<string, BaseStationInfo>>({})
/** 武器原始数据缓存，供编辑回填。 */
const weaponRawMap = reactive<Record<string, Weapon>>({})

/** 地面站/数据中心弹窗可见性。 */
const stationDialogVisible = ref(false)
/** 武器弹窗可见性。 */
const weaponDialogVisible = ref(false)
/** 地面站/数据中心表单引用。 */
const stationFormRef = ref<FormInstance>()
/** 武器表单引用。 */
const weaponFormRef = ref<FormInstance>()

/**
 * 候选资源池。卫星待接入；地面站/数据中心/武器由接口加载。
 */
const candidatePool = reactive<Record<TaskAssembleKind, TaskAssembleRow[]>>({
  satellite: [],
  station: [],
  center: [],
  weapon: [],
})

/** 各装配页的标题、筛选与列配置。 */
const KIND_CONFIG: Record<TaskAssembleKind, AssembleKindConfig> = {
  satellite: {
    title: '卫星装配',
    description: '系列按蓝方国家查询，并按任务卫星类型（侦察/通信）过滤；勾选系列即装配，下方展示对应卫星预览。',
    searchPlaceholder: '名称 / NORAD',
    typePlaceholder: '卫星类型',
    typeOptions: [],
    seriesOptions: [],
    columns: [
      { prop: 'name', label: '名称', minWidth: 110 },
      { prop: 'series', label: '系列', minWidth: 96 },
      { prop: 'extra1', label: 'NORAD', width: 88 },
      { prop: 'type', label: '类型', width: 80 },
      { prop: 'extra2', label: '轨道', width: 72 },
      { prop: 'country', label: '所属', minWidth: 72 },
    ],
  },
  station: {
    title: '地面站装配',
    description: '选择本任务使用的地面接收站，可在此新增或修改地面站资源。',
    searchPlaceholder: '站名 / 国家',
    typePlaceholder: '站点类型',
    typeOptions: [],
    seriesOptions: [],
    columns: [
      { prop: 'name', label: '名称', minWidth: 120 },
      { prop: 'type', label: '类型', width: 80 },
      { prop: 'country', label: '国家', width: 80 },
      { prop: 'extra1', label: '经度', width: 80 },
      { prop: 'extra2', label: '纬度', width: 80 },
    ],
  },
  center: {
    title: '数据中心装配',
    description: '选择本任务回传与处理使用的数据中心，可在此新增或修改数据中心资源。',
    searchPlaceholder: '名称 / 国家',
    typePlaceholder: '中心类型',
    typeOptions: [],
    seriesOptions: [],
    columns: [
      { prop: 'name', label: '名称', minWidth: 120 },
      { prop: 'type', label: '类型', width: 88 },
      { prop: 'country', label: '国家', width: 80 },
      { prop: 'extra1', label: '经度', width: 80 },
      { prop: 'extra2', label: '纬度', width: 80 },
    ],
  },
  weapon: {
    title: '武器装配',
    description: '为本任务挂载可用的打击或干扰武器，可在此新增或修改武器资源。',
    searchPlaceholder: '武器名称 / 类型',
    typePlaceholder: '武器类型',
    typeOptions: [],
    seriesOptions: [],
    columns: [
      { prop: 'name', label: '名称', minWidth: 100 },
      { prop: 'type', label: '类型', width: 72 },
      { prop: 'country', label: '所属', width: 72 },
      { prop: 'extra1', label: '适用目标', minWidth: 88 },
      { prop: 'extra2', label: '射程/高度', width: 80 },
      { prop: 'extra3', label: '经度', width: 72 },
      { prop: 'extra4', label: '纬度', width: 72 },
      { prop: 'extra5', label: '打击间隔', width: 80 },
    ],
  },
}

/** 当前种类的页面配置。 */
const config = computed(() => KIND_CONFIG[props.kind])

/** 左侧预览/待选表列：卫星为卫星详情列，其余为各类型配置列。 */
const tableColumns = computed(() => config.value.columns)

/** 是否已接入增删改查（地面站 / 数据中心 / 武器）。 */
const crudEnabled = computed(() => props.kind === 'station' || props.kind === 'center' || props.kind === 'weapon')

/** 是否已接入列表接口（含卫星分页）。 */
const apiEnabled = computed(() => crudEnabled.value || props.kind === 'satellite')

/** 是否为卫星种类。 */
const isSatelliteKind = computed(() => props.kind === 'satellite')

/** 是否为地面站或数据中心种类。 */
const isStationKind = computed(() => props.kind === 'station' || props.kind === 'center')

/** 是否为武器种类。 */
const isWeaponKind = computed(() => props.kind === 'weapon')

/** 查询卫星系列使用的蓝方国家（来自任务基本信息）。 */
const seriesQueryCountries = computed(() => (props.enemyCountries || []).filter(Boolean))

/** 参与系列过滤的卫星类型（仅侦察、通信与接口字段一致）。 */
const seriesQueryTargetTypes = computed(() =>
  (props.targetTypes || []).filter((type) => type === '侦察' || type === '通信')
)

/** 系列勾选区副标题。 */
const satelliteSeriesPanelSubText = computed(() => {
  if (!seriesQueryCountries.value.length) return '请先在基本信息中选择蓝方国家'
  if (!seriesQueryTargetTypes.value.length) return '请先在基本信息中选择卫星类型（侦察/通信）'
  return `已选 ${selectedSeriesList.value.length} 个系列 · 提交时仅传系列`
})

/** 系列勾选区空态文案。 */
const satelliteSeriesEmptyText = computed(() => {
  if (!seriesQueryCountries.value.length) return '请先在基本信息中选择蓝方国家'
  if (!seriesQueryTargetTypes.value.length) return '请先在基本信息中选择卫星类型（侦察/通信）'
  return '当前条件下暂无可用系列，请调整国家或卫星类型后刷新'
})

/** 卫星预览区副标题。 */
const satellitePreviewSubText = computed(() => {
  if (!selectedSeriesList.value.length) return '请勾选上方系列'
  const typeText = seriesQueryTargetTypes.value.join('、') || '--'
  return `共 ${displayCandidates.value.length} 颗 · 蓝方：${seriesQueryCountries.value.join('、')}；类型：${typeText}`
})

/**
 * 类型筛选项：卫星使用 satType 接口，其余从已加载数据动态提取。
 */
const typeFilterOptions = computed(() => {
  if (isSatelliteKind.value) {
    return satTypes.value
  }
  if (!crudEnabled.value) {
    return config.value.typeOptions
  }
  const types = new Set(candidatePool[props.kind].map((row) => row.type).filter(Boolean))
  return Array.from(types).sort()
})

/** 待选资源总数展示文案。 */
const candidateTotalText = computed(() => String(filteredCandidates.value.length))

/** 新建地面站/数据中心时的默认类型占位。 */
const stationTypePlaceholder = computed(() =>
  props.kind === 'center' ? '例如 中心云 / 区域中心' : '例如 接收站 / 测控站'
)

/**
 * 创建空白地面站/数据中心表单。
 * @returns 默认基站信息对象
 */
const createEmptyStationForm = (): BaseStationInfo => ({
  name: '',
  type: props.kind === 'center' ? '中心云' : '接收站',
  country: '',
  latLon: '',
  location: '',
  function: '',
  introduction: '',
})

/** 地面站/数据中心编辑表单。 */
const stationForm = reactive<BaseStationInfo>(createEmptyStationForm())

/** 地面站/数据中心表单校验规则。 */
const stationRules = reactive<FormRules<BaseStationInfo>>({
  name: { required: true, message: '请输入名称', trigger: 'blur' },
  type: { required: true, message: '请输入类型', trigger: 'blur' },
  country: { required: true, message: '请选择所属国家/地区', trigger: 'change' },
  latLon: { required: true, message: '请输入经纬度', trigger: 'blur' },
  location: { required: true, message: '请输入位置', trigger: 'blur' },
  function: { required: true, message: '请输入功能', trigger: 'blur' },
})

/** 地面站/数据中心弹窗标题。 */
const stationDialogTitle = computed(() => (stationForm._id ? '修改资源' : '添加资源'))

/**
 * 创建空白武器表单。
 * @returns 默认武器对象
 */
const createEmptyWeaponForm = (): Weapon => ({
  name: '',
  country: '',
  type: '',
  latitude: 0,
  longitude: 0,
  range: 0,
  satellite_type: '',
  interval: '',
})

/** 武器编辑表单。 */
const weaponForm = reactive<Weapon>(createEmptyWeaponForm())

/** 武器表单校验规则。 */
const weaponRules = reactive<FormRules<Weapon>>({
  name: { required: true, message: '请输入武器名称', trigger: 'blur' },
  country: { required: true, message: '请选择所属国家/地区', trigger: 'change' },
  type: { required: true, message: '请输入武器类型', trigger: 'blur' },
  range: { required: true, message: '请输入打击高度', trigger: 'blur', type: 'number', min: 0 },
  longitude: { required: true, message: '请输入经度', trigger: 'blur', type: 'number', min: -180, max: 180 },
  latitude: { required: true, message: '请输入纬度', trigger: 'blur', type: 'number', min: -90, max: 90 },
})

/** 武器弹窗标题。 */
const weaponDialogTitle = computed(() => (weaponForm.id ? '修改武器' : '添加武器'))

/**
 * 解析经纬度字符串。
 * @param latLon 格式为 "经度,纬度"
 */
const parseLatLon = (latLon: string): { lng: string; lat: string } => {
  const parts = (latLon || '').split(',').map((item) => item.trim())
  return { lng: parts[0] || '--', lat: parts[1] || '--' }
}

/**
 * 判断基站类型是否属于数据中心。
 * @param type 基站类型文案
 */
const isDataCenterType = (type: string): boolean => {
  const value = type || ''
  return value.includes('中心') || value.includes('数据') || value.includes('云')
}

/**
 * 将基站信息映射为装配表格行。
 * @param station 基站原始数据
 */
const stationToRow = (station: BaseStationInfo): TaskAssembleRow => {
  const { lng, lat } = parseLatLon(station.latLon)
  const id = station._id || station.name
  if (station._id) {
    stationRawMap[station._id] = station
  }
  return {
    id,
    name: station.name,
    series: '',
    type: station.type,
    country: station.country,
    extra1: lng,
    extra2: lat,
  }
}

/** querySatBySeries 返回项（仅本页展示用，不修改 task API 类型定义）。 */
interface SatellitePreviewItem {
  _id?: string
  norad: number
  name_en?: string
  name_cn?: string | null
  series?: string
  sat_type?: string
  country?: string
  orbit_type?: number
}

/**
 * 将卫星信息映射为装配表格行。
 * @param satellite 卫星原始数据
 */
const satelliteToRow = (satellite: SatellitePreviewItem, seriesName: string): TaskAssembleRow => ({
  id: `${seriesName}-${satellite.norad}`,
  name: satellite.name_en || satellite.name_cn || String(satellite.norad),
  series: satellite.series || seriesName || '--',
  type: satellite.sat_type || '--',
  country: satellite.country || '--',
  extra1: String(satellite.norad),
  extra2: getOrbitType(Number(satellite.orbit_type)),
})

/**
 * 格式化武器坐标展示。
 *
 * @param value 经度或纬度
 * @returns 坐标文本；无效时为 `--`
 */
const formatWeaponCoord = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return String(value)
}

/**
 * 格式化武器打击间隔展示。
 *
 * @param value 打击间隔（分钟）
 * @returns 间隔文本；无效时为 `--`
 */
const formatWeaponInterval = (value?: string | number | null): string => {
  if (value == null || value === '') return '--'
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return `${numeric}min`
  return String(value)
}

/**
 * 将武器信息映射为装配表格行。
 * @param weapon 武器原始数据
 */
const weaponToRow = (weapon: Weapon): TaskAssembleRow => {
  const id = weapon.id || weapon.name
  if (weapon.id) {
    weaponRawMap[weapon.id] = weapon
  }
  const rangeText = weapon.range != null ? `${weapon.range}km` : '--'
  return {
    id,
    name: weapon.name,
    series: '',
    type: weapon.type,
    country: weapon.country,
    extra1: weapon.satellite_type || '--',
    extra2: rangeText,
    extra3: formatWeaponCoord(weapon.longitude),
    extra4: formatWeaponCoord(weapon.latitude),
    extra5: formatWeaponInterval(weapon.interval),
  }
}

/**
 * 生成资源行搜索关键字串。
 *
 * @param row 装配行
 * @returns 用于关键字过滤的拼接文本
 */
const buildRowSearchText = (row: TaskAssembleRow): string =>
  `${row.name} ${row.series} ${row.type} ${row.country} ${row.extra1} ${row.extra2} ${row.extra3 ?? ''} ${row.extra4 ?? ''} ${row.extra5 ?? ''}`.toLowerCase()

/**
 * 尚未装配、且匹配关键字与类型筛选的候选行（非卫星种类使用客户端过滤）。
 */
const filteredCandidates = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  const pool = candidatePool[props.kind]
  return pool.filter((row) => {
    if (typeFilter.value && row.type !== typeFilter.value) return false
    if (!key) return true
    return buildRowSearchText(row).includes(key)
  })
})

/** 左侧待选表实际展示数据。 */
const displayCandidates = computed(() => filteredCandidates.value)

/**
 * 加载国家下拉选项。
 */
const loadCountries = async () => {
  try {
    const res = await getBattleCountrys()
    countries.value = res.code === 200 ? (res.data ?? []) : []
  } catch {
    countries.value = []
  }
}

/**
 * 加载卫星类型筛选项。
 */
const loadSatTypes = async () => {
  try {
    const res = await getBattleSateTypes()
    satTypes.value = res.code === 200 ? (res.data ?? []) : []
  } catch {
    satTypes.value = []
  }
}

/**
 * 按任务卫星类型从系列接口结果中提取候选项。
 *
 * @param data 系列接口 data
 * @returns 去重排序后的系列名列表
 */
const buildSeriesOptions = (data: { 侦察?: string[]; 通信?: string[] }): string[] => {
  const selectedTypes = seriesQueryTargetTypes.value
  if (!selectedTypes.length) return []

  const merged: string[] = []
  if (selectedTypes.includes('侦察')) merged.push(...(data.侦察 || []))
  if (selectedTypes.includes('通信')) merged.push(...(data.通信 || []))

  return Array.from(new Set(merged.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/**
 * 使用缓存的系列数据刷新下拉候选项。
 */
const applySeriesOptionsFromCache = () => {
  if (!seriesDataCache.value) {
    seriesOptions.value = []
    return
  }
  seriesOptions.value = buildSeriesOptions(seriesDataCache.value)
  const valid = new Set(seriesOptions.value)
  const nextSelected = selectedSeriesList.value.filter((name) => valid.has(name))
  if (nextSelected.length !== selectedSeriesList.value.length) {
    selectedSeriesList.value = nextSelected
    syncAssembledRowsFromSeriesList()
    void loadSatellitesForSelectedSeries()
  }
}

/**
 * 根据国家列表拉取卫星系列（如 Capella、STARLINK），并按任务卫星类型过滤。
 */
const loadSeriesOptions = async () => {
  if (!seriesQueryCountries.value.length) {
    seriesDataCache.value = null
    seriesOptions.value = []
    return
  }
  listLoading.value = true
  try {
    const res = await getSatelliteSeries(seriesQueryCountries.value)
    if (res.code === 200 && res.data) {
      seriesDataCache.value = res.data
      applySeriesOptionsFromCache()
    } else {
      seriesDataCache.value = null
      seriesOptions.value = []
    }
  } catch {
    seriesDataCache.value = null
    seriesOptions.value = []
  } finally {
    listLoading.value = false
  }
}

/**
 * 将勾选系列同步为已装配行（仅系列名）。
 */
const syncAssembledRowsFromSeriesList = () => {
  const countryText = seriesQueryCountries.value.join('、') || '--'
  assembledRows.value = selectedSeriesList.value.map((series) => ({
    id: series,
    name: series,
    series,
    type: '--',
    country: countryText,
    extra1: '--',
    extra2: '--',
  }))
}

/**
 * 按已勾选的全部系列拉取卫星并合并预览列表。
 */
const loadSatellitesForSelectedSeries = async () => {
  if (!isSatelliteKind.value) return
  const seriesList = selectedSeriesList.value
  if (!seriesList.length) {
    candidatePool.satellite = []
    return
  }
  listLoading.value = true
  try {
    const responses = await Promise.all(seriesList.map((series) => getSatelliteBySeries(series)))
    const merged: TaskAssembleRow[] = []
    responses.forEach((res, index) => {
      const seriesName = seriesList[index]
      const raw = res.code === 200 ? res.data : null
      const list = Array.isArray(raw) ? raw : raw ? [raw] : []
      list.forEach((item) => merged.push(satelliteToRow(item as SatellitePreviewItem, seriesName)))
    })
    candidatePool.satellite = merged
  } catch {
    candidatePool.satellite = []
  } finally {
    listLoading.value = false
  }
}

/**
 * 系列勾选变化：更新已装配系列并刷新卫星预览。
 */
const handleSeriesCheckboxChange = async () => {
  syncAssembledRowsFromSeriesList()
  await loadSatellitesForSelectedSeries()
}

/**
 * 卫星关键字 / 类型筛选变化（本地过滤，不重新请求）。
 */
const handleSatelliteSearch = () => {
  if (!isSatelliteKind.value) return
}

/**
 * 从接口加载地面站或数据中心候选列表。
 */
const loadStationCandidates = async () => {
  const res = await getGroundStationList({ type: '', name: '', country: '' })
  const list = res.code === 200 ? (res.data ?? []) : []
  const filtered = list.filter((item) =>
    props.kind === 'center' ? isDataCenterType(item.type) : !isDataCenterType(item.type)
  )
  Object.keys(stationRawMap).forEach((key) => delete stationRawMap[key])
  candidatePool.station = []
  candidatePool.center = []
  const rows = filtered.map(stationToRow)
  candidatePool[props.kind] = rows
}

/**
 * 从接口加载武器候选列表。
 */
const loadWeaponCandidates = async () => {
  const res = await getAllWeapons()
  const list = res.code === 200 ? (res.data?.weapons ?? []) : []
  Object.keys(weaponRawMap).forEach((key) => delete weaponRawMap[key])
  candidatePool.weapon = list.map(weaponToRow)
}

/**
 * 按当前种类加载候选资源池。
 */
/**
 * 将已装配占位行与候选池按 ID 对齐，补全名称等展示字段。
 */
const enrichAssembledFromPool = () => {
  if (!assembledRows.value.length) return
  const poolById = new Map<string, TaskAssembleRow>()
  const pools = isSatelliteKind.value
    ? candidatePool.satellite
    : props.kind === 'center'
      ? candidatePool.center
      : props.kind === 'station'
        ? candidatePool.station
        : candidatePool.weapon
  pools.forEach((row) => poolById.set(row.id, row))
  assembledRows.value = assembledRows.value.map((row) => {
    const matched = poolById.get(row.id)
    return matched ? { ...matched } : row
  })
}

const loadCandidatePool = async () => {
  if (isSatelliteKind.value) {
    if (seriesQueryCountries.value.length) {
      await loadSeriesOptions()
    }
    await loadSatellitesForSelectedSeries()
    return
  }
  if (!crudEnabled.value) return
  listLoading.value = true
  try {
    if (isStationKind.value) {
      await loadStationCandidates()
    } else if (isWeaponKind.value) {
      await loadWeaponCandidates()
    }
    enrichAssembledFromPool()
    restoreAssemblyTableSelection()
  } finally {
    listLoading.value = false
  }
}

/**
 * 单表模式：根据已装配 ID 恢复表格勾选。
 */
const restoreAssemblyTableSelection = () => {
  if (isSatelliteKind.value) return
  nextTick(() => {
    const table = candidateTableRef.value
    if (!table) return
    syncingAssemblySelection.value = true
    table.clearSelection()
    const assembledIds = new Set(assembledRows.value.map((row) => row.id))
    displayCandidates.value.forEach((row) => {
      if (assembledIds.has(row.id)) {
        table.toggleRowSelection(row, true)
      }
    })
    syncingAssemblySelection.value = false
  })
}

/**
 * 地面站 / 数据中心 / 武器：勾选即装配。
 *
 * @param rows 当前勾选行
 */
const onAssemblyTableSelectionChange = (rows: TaskAssembleRow[]) => {
  if (syncingAssemblySelection.value) return
  assembledRows.value = rows.map((row) => ({ ...row }))
}

/** 重置地面站/数据中心表单。 */
const resetStationForm = () => {
  Object.assign(stationForm, createEmptyStationForm())
}

/** 重置武器表单。 */
const resetWeaponForm = () => {
  Object.assign(weaponForm, createEmptyWeaponForm())
}

/** 打开新增地面站/数据中心弹窗。 */
const openCreateDialog = () => {
  if (isStationKind.value) {
    resetStationForm()
    stationDialogVisible.value = true
    return
  }
  if (isWeaponKind.value) {
    resetWeaponForm()
    weaponDialogVisible.value = true
  }
}

/**
 * 打开编辑弹窗。
 * @param row 当前表格行
 */
const openEditDialog = (row: TaskAssembleRow) => {
  if (isStationKind.value) {
    const raw = stationRawMap[row.id]
    if (raw) {
      Object.assign(stationForm, { ...raw })
      stationDialogVisible.value = true
    }
    return
  }
  if (isWeaponKind.value) {
    const raw = weaponRawMap[row.id]
    if (raw) {
      Object.assign(weaponForm, { ...raw })
      weaponDialogVisible.value = true
    }
  }
}

/** 提交地面站/数据中心表单（新增或修改）。 */
const submitStationForm = async () => {
  if (!stationFormRef.value) return
  await stationFormRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      const res = await saveOrUpdateBaseStation({ ...stationForm })
      if (res.code === 200) {
        ElMessage.success(`${stationDialogTitle.value}成功`)
        stationDialogVisible.value = false
        await loadCandidatePool()
      }
    } finally {
      saving.value = false
    }
  })
}

/** 删除当前编辑中的地面站/数据中心。 */
const handleDeleteStation = async () => {
  if (!stationForm._id) return
  await ElMessageBox.confirm(`确定删除「${stationForm.name}」吗？`, '提示', { type: 'warning' })
  deleting.value = true
  try {
    const res = await deleteBaseStations([stationForm._id])
    if (res.code === 200) {
      ElMessage.success('删除成功')
      stationDialogVisible.value = false
      assembledRows.value = assembledRows.value.filter((row) => row.id !== stationForm._id)
      await loadCandidatePool()
    }
  } finally {
    deleting.value = false
  }
}

/** 提交武器表单（新增或修改）。 */
const submitWeaponForm = async () => {
  if (!weaponFormRef.value) return
  await weaponFormRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      const payload = { ...weaponForm }
      const res = weaponForm.id ? await updateWeapon(payload) : await createWeapon(payload)
      if (res.code === 200) {
        ElMessage.success(`${weaponDialogTitle.value}成功`)
        weaponDialogVisible.value = false
        await loadCandidatePool()
      }
    } finally {
      saving.value = false
    }
  })
}

/** 删除当前编辑中的武器。 */
const handleDeleteWeapon = async () => {
  if (!weaponForm.id) return
  await ElMessageBox.confirm(`确定删除武器「${weaponForm.name}」吗？`, '提示', { type: 'warning' })
  deleting.value = true
  try {
    const res = await deleteWeapon(weaponForm.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      weaponDialogVisible.value = false
      assembledRows.value = assembledRows.value.filter((row) => row.id !== weaponForm.id)
      await loadCandidatePool()
    }
  } finally {
    deleting.value = false
  }
}

/**
 * 弹窗重新打开时清空本页本地状态。
 */
watch(
  () => props.resetKey,
  () => {
    keyword.value = ''
    typeFilter.value = ''
    seriesOptions.value = []
    seriesDataCache.value = null
    selectedSeriesList.value = []
    assembledRows.value = []
    candidatePool.satellite = []
    candidateTableRef.value?.clearSelection()
    if (apiEnabled.value) {
      loadCandidatePool()
    }
  }
)

/** 切换装配种类时重新加载候选数据。 */
watch(
  () => props.kind,
  () => {
    if (apiEnabled.value) {
      loadCandidatePool()
    }
  }
)

/** 蓝方国家变化时，重新查询系列并清空当前系列与预览。 */
watch(
  seriesQueryCountries,
  async () => {
    if (!isSatelliteKind.value) return
    selectedSeriesList.value = []
    candidatePool.satellite = []
    syncAssembledRowsFromSeriesList()
    await loadSeriesOptions()
  },
  { deep: true }
)

/** 卫星类型变化时，按类型重算系列候选项并清空无效预览。 */
watch(
  seriesQueryTargetTypes,
  async () => {
    if (!isSatelliteKind.value) return
    if (seriesDataCache.value) {
      applySeriesOptionsFromCache()
      return
    }
    await loadSeriesOptions()
  },
  { deep: true }
)

onMounted(async () => {
  if (isSatelliteKind.value) {
    await Promise.all([loadSatTypes(), loadSeriesOptions()])
    return
  }
  if (crudEnabled.value) {
    await Promise.all([loadCountries(), loadCandidatePool()])
  }
})

/**
 * 获取当前已装配资源行，供任务弹窗提交时汇总。
 * @returns 已装配资源列表
 */
const getAssembledRows = (): TaskAssembleRow[] => assembledRows.value

/**
 * 获取已选卫星系列名称列表（提交任务时仅传系列）。
 * @returns 系列名称数组
 */
const getAssembledSeries = (): string[] =>
  assembledRows.value.map((row) => row.series || row.name).filter(Boolean)

/**
 * 回显已装配资源行（编辑任务时由弹窗调用）。
 *
 * @param rows 已装配资源列表
 */
const setAssembledRows = (rows: TaskAssembleRow[]) => {
  assembledRows.value = rows.map((row) => ({ ...row }))
  if (isSatelliteKind.value) {
    selectedSeriesList.value = rows.map((row) => row.series || row.name).filter(Boolean)
    void loadSatellitesForSelectedSeries()
    return
  }
  enrichAssembledFromPool()
  restoreAssemblyTableSelection()
}

defineExpose({
  getAssembledRows,
  getAssembledSeries,
  setAssembledRows,
})
</script>

<style lang="scss" scoped>
.task-assemble-tab {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding-bottom: 8px;
}

.assemble-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.assemble-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: #40f2ff;
}

.assemble-desc {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.assemble-api-tag {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid rgba(250, 204, 21, 0.45);
  background: rgba(250, 204, 21, 0.12);
  color: #facc15;
  font-size: 11px;
  line-height: 18px;
}

.assemble-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.assemble-search,
.assemble-filter {
  flex: 0 0 160px;
  width: 160px !important;
  max-width: 160px;

  :deep(.atlas-app-input__wrapper),
  :deep(.atlas-app-select__wrapper) {
    width: 160px !important;
  }
}

.assemble-count {
  margin-left: auto;
  font-size: 12px;
  color: #7dd3fc;
  white-space: nowrap;
}

.assemble-satellite-layout {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.assemble-pane--series {
  flex: 0 0 auto;
  max-height: 38%;
}

.assemble-pane--sat-preview {
  flex: 1;
  min-height: 0;
}

.assemble-series-body {
  padding: 10px 12px 12px;
  max-height: 160px;
  overflow-y: auto;
}

.assemble-series-empty {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.assemble-series-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;

  :deep(.atlas-app-checkbox) {
    margin-right: 0;
  }

  :deep(.atlas-app-checkbox__label) {
    color: #cbd5e1;
    font-size: 12px;
  }
}

.assemble-single-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.assemble-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  border: 1px solid rgba(0, 225, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 20, 36, 0.55);
  overflow: hidden;
}

.assemble-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #7dd3fc;
  border-bottom: 1px solid rgba(0, 225, 255, 0.12);
}

.assemble-pane-sub {
  font-weight: 400;
  color: #64748b;
}

.assemble-pane-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.assemble-pager {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 6px 8px 8px;
  border-top: 1px solid rgba(0, 225, 255, 0.1);

  :deep(.atlas-app-pagination__total),
  :deep(.atlas-app-pagination button),
  :deep(.atlas-app-pager li) {
    color: #94a3b8;
    background: transparent;
  }

  :deep(.atlas-app-pager li.is-active) {
    color: #40f2ff;
  }
}

.assemble-edit-btn {
  padding: 0;
  font-size: 12px;
}

.assemble-table {
  flex: 1;
  min-height: 0;
  height: 100%;
  width: 100%;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.1);
  --atlas-app-text-color-regular: #cbd5e1;
  --atlas-app-text-color-primary: #e2efff;
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.atlas-app-table),
  :deep(.atlas-app-table__inner-wrapper) {
    height: 100%;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
  }

  :deep(td.atlas-app-table__cell) {
    font-size: 12px;
    color: #cbd5e1;
    background: transparent !important;
  }

  :deep(.atlas-app-table__empty-block) {
    background: transparent;
    color: #64748b;
  }
}

.full-width {
  width: 100%;
}

.full-width-number {
  width: 100%;

  :deep(.atlas-app-input__wrapper) {
    width: 100%;
  }
}
</style>

<style lang="scss">
.assemble-crud-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.assemble-crud-dialog-modal {
  background-color: rgba(2, 8, 18, 0.72) !important;
}

.atlas-app-dialog.assemble-crud-dialog,
.assemble-crud-dialog .atlas-app-dialog {
  --atlas-app-dialog-bg-color: #0a1628;
  --atlas-app-dialog-border-radius: 10px;
  border: 1px solid rgba(0, 225, 255, 0.22);
  background: linear-gradient(180deg, rgba(10, 22, 40, 0.98) 0%, rgba(6, 14, 28, 0.98) 100%);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55);

  .atlas-app-dialog__header {
    padding: 14px 18px 10px;
    margin-right: 0;
    border-bottom: 1px solid rgba(0, 225, 255, 0.12);
  }

  .atlas-app-dialog__title {
    color: #40f2ff;
    font-size: 15px;
    font-weight: 700;
  }

  .atlas-app-dialog__headerbtn .atlas-app-dialog__close {
    color: #7dd3fc;

    &:hover {
      color: #40f2ff;
    }
  }

  .atlas-app-dialog__body {
    padding: 16px 18px 8px;
    color: #cbd5e1;
  }

  .atlas-app-dialog__footer {
    padding: 10px 18px 16px;
    border-top: 1px solid rgba(0, 225, 255, 0.12);
  }

  .atlas-app-form-item__label {
    color: #94a3b8;
  }

  .atlas-app-input__wrapper,
  .atlas-app-textarea__inner {
    background: rgba(8, 20, 36, 0.85);
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.18) inset;
  }

  .atlas-app-input__inner,
  .atlas-app-textarea__inner {
    color: #e2efff;
  }
}
</style>
