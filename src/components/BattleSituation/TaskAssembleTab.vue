<template>
  <div class="task-assemble-tab">
    <div class="assemble-head">
      <div>
        <h3 class="assemble-title">{{ config.title }}</h3>
        <p class="assemble-desc">{{ config.description }}</p>
      </div>
      <span v-if="!apiEnabled" class="assemble-api-tag">接口待接入</span>
    </div>

    <div class="assemble-toolbar">
      <el-button v-if="crudEnabled" class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
        @click="openCreateDialog">
        添加
      </el-button>
      <el-input v-model="keyword" size="small" clearable :placeholder="config.searchPlaceholder"
        class="assemble-search" style="width: 160px" @keyup.enter="handleSatelliteSearch"
        @clear="handleSatelliteSearch" />
      <el-select v-if="seriesFilterOptions.length" v-model="seriesFilter" size="small" clearable placeholder="卫星系列"
        class="assemble-filter" style="width: 160px" popper-class="task-edit-select-popper"
        @change="handleSatelliteSearch" @clear="handleSatelliteSearch">
        <el-option v-for="item in seriesFilterOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-if="isSatelliteKind" v-model="countryFilter" size="small" clearable placeholder="国家/地区"
        class="assemble-filter" style="width: 160px" popper-class="task-edit-select-popper"
        @change="handleSatelliteSearch" @clear="handleSatelliteSearch">
        <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
      </el-select>
      <el-select v-if="typeFilterOptions.length" v-model="typeFilter" size="small" clearable
        :placeholder="config.typePlaceholder" class="assemble-filter" style="width: 160px"
        popper-class="task-edit-select-popper" @change="handleSatelliteSearch" @clear="handleSatelliteSearch">
        <el-option v-for="item in typeFilterOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-button v-if="apiEnabled" class="task-edit-btn task-edit-btn--ghost" size="small" :loading="listLoading"
        @click="loadCandidatePool">
        刷新
      </el-button>
      <span class="assemble-count">已装配 {{ assembledRows.length }} 项</span>
    </div>

    <div class="assemble-split">
      <section class="assemble-pane">
        <div class="assemble-pane-head">
          <span>待选资源</span>
          <span class="assemble-pane-sub">共 {{ candidateTotalText }} 项</span>
        </div>
        <div class="assemble-pane-body">
          <el-table ref="candidateTableRef" v-loading="listLoading" :data="displayCandidates" size="small"
            height="100%" row-key="id" class="assemble-table"
            :empty-text="apiEnabled ? '暂无资源' : '暂无候选资源，接口接入后将在此列出'"
            @selection-change="onCandidateSelectionChange">
            <el-table-column type="selection" width="42" />
            <el-table-column v-for="col in config.columns" :key="col.prop" :prop="col.prop" :label="col.label"
              :min-width="col.minWidth" :width="col.width" show-overflow-tooltip />
            <el-table-column v-if="crudEnabled" label="修改" width="64" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" class="assemble-edit-btn" @click="openEditDialog(row)">修改</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination v-if="isSatelliteKind" v-model:current-page="satPage.pageNum"
            v-model:page-size="satPage.pageSize" class="assemble-pager" :total="satTotalElements" small
            layout="total, prev, pager, next" :page-sizes="[10, 20, 50]" @current-change="loadSatelliteCandidates"
            @size-change="handleSatPageSizeChange" />
        </div>
      </section>

      <div class="assemble-actions">
        <el-button class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
          :disabled="!candidateSelection.length" @click="addSelected">
          装配选中 →
        </el-button>
        <el-button class="task-edit-btn task-edit-btn--ghost" size="small" :disabled="!assembledSelection.length"
          @click="removeSelected">
          ← 移除选中
        </el-button>
      </div>

      <section class="assemble-pane">
        <div class="assemble-pane-head">
          <span>已装配</span>
          <span class="assemble-pane-sub">将随任务保存（接口就绪后）</span>
        </div>
        <el-table :data="assembledRows" size="small" height="100%" row-key="id" class="assemble-table"
          empty-text="尚未装配资源" @selection-change="onAssembledSelectionChange">
          <el-table-column type="selection" width="42" />
          <el-table-column v-for="col in config.columns" :key="`a-${col.prop}`" :prop="col.prop" :label="col.label"
            :min-width="col.minWidth" :width="col.width" show-overflow-tooltip />
        </el-table>
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
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import type { TableInstance } from 'element-plus'
import {
  createWeapon,
  deleteWeapon,
  getAllWeapons,
  getBattleCountrys,
  getBattleSateTypes,
  getSatelliteConstellations,
  getSatelliteList,
  updateWeapon,
  type SatelliteConstellation,
} from '@/api/dashboard'
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
}>()

/** 候选表实例，用于清空勾选。 */
const candidateTableRef = ref<TableInstance>()
/** 名称关键字。 */
const keyword = ref('')
/** 系列筛选。 */
const seriesFilter = ref('')
/** 类型筛选。 */
const typeFilter = ref('')
/** 卫星国家筛选。 */
const countryFilter = ref('')
/** 卫星分页参数。 */
const satPage = reactive({
  pageNum: 1,
  pageSize: 20,
})
/** 卫星分页总数。 */
const satTotalElements = ref(0)
/** 卫星类型筛选项。 */
const satTypes = ref<string[]>([])
/** 星座筛选项。 */
const constellationOptions = ref<{ label: string; value: string }[]>([])
/** 星座原始数据，用于系列名称映射与筛选。 */
const constellations = ref<SatelliteConstellation[]>([])
/** NORAD 到星座名称的映射。 */
const constellationNoradMap = ref<Map<number, string>>(new Map())
/** 待选表当前勾选。 */
const candidateSelection = ref<TaskAssembleRow[]>([])
/** 已装配表当前勾选。 */
const assembledSelection = ref<TaskAssembleRow[]>([])
/** 已从待选移入的资源。 */
const assembledRows = ref<TaskAssembleRow[]>([])
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
    description: '从候选星座中勾选本任务需要纳入的卫星。',
    searchPlaceholder: '名称 / NORAD / 系列',
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
      { prop: 'name', label: '名称', minWidth: 110 },
      { prop: 'type', label: '类型', width: 72 },
      { prop: 'country', label: '所属', width: 72 },
      { prop: 'extra1', label: '适用目标', minWidth: 90 },
      { prop: 'extra2', label: '射程/高度', width: 88 },
    ],
  },
}

/** 当前种类的页面配置。 */
const config = computed(() => KIND_CONFIG[props.kind])

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

/**
 * 系列筛选项：卫星从星座接口加载，其余种类使用静态配置。
 */
const seriesFilterOptions = computed(() => {
  if (isSatelliteKind.value) {
    return constellationOptions.value
  }
  return config.value.seriesOptions.map((item) => ({ label: item, value: item }))
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
const candidateTotalText = computed(() => {
  if (isSatelliteKind.value) {
    return String(satTotalElements.value)
  }
  return String(filteredCandidates.value.length)
})

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

/**
 * 将字符串查询值转换为接口可选参数。
 * @param value 原始输入
 */
const toOptionalString = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/**
 * 将 NORAD 输入转换为接口可选数字。
 * @param value 原始输入
 */
const toOptionalNorad = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const norad = Number(trimmed)
  return Number.isFinite(norad) && norad > 0 ? norad : undefined
}

/**
 * 解析卫星列表查询使用的名称参数。
 */
const resolveSatelliteNameParam = (): string | undefined => {
  const key = keyword.value.trim()
  if (key && !/^\d+$/.test(key)) {
    return key
  }
  if (seriesFilter.value) {
    return seriesFilter.value
  }
  return undefined
}

/**
 * 根据 NORAD 解析所属星座名称。
 * @param norad 卫星 NORAD 编号
 */
const resolveSeriesName = (norad: number): string => {
  return constellationNoradMap.value.get(norad) || '--'
}

/**
 * 将卫星信息映射为装配表格行。
 * @param satellite 卫星原始数据
 */
const satelliteToRow = (satellite: Satellite): TaskAssembleRow => ({
  id: String(satellite.norad),
  name: satellite.name_en || satellite.name_cn || String(satellite.norad),
  series: resolveSeriesName(satellite.norad),
  type: satellite.sat_type || '--',
  country: satellite.country || '--',
  extra1: String(satellite.norad),
  extra2: getOrbitType(Number(satellite.orbit_type)),
})

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
  const intervalText = weapon.interval ? `${weapon.interval}min` : ''
  return {
    id,
    name: weapon.name,
    series: '',
    type: weapon.type,
    country: weapon.country,
    extra1: weapon.satellite_type || '--',
    extra2: intervalText ? `${rangeText} / ${intervalText}` : rangeText,
  }
}

/**
 * 尚未装配、且匹配关键字与类型筛选的候选行（非卫星种类使用客户端过滤）。
 */
const filteredCandidates = computed(() => {
  const assembledIds = new Set(assembledRows.value.map((row) => row.id))
  const key = keyword.value.trim().toLowerCase()
  return candidatePool[props.kind].filter((row) => {
    if (assembledIds.has(row.id)) return false
    if (seriesFilter.value && row.series !== seriesFilter.value) return false
    if (typeFilter.value && row.type !== typeFilter.value) return false
    if (!key) return true
    const haystack = `${row.name} ${row.series} ${row.type} ${row.country} ${row.extra1} ${row.extra2}`.toLowerCase()
    return haystack.includes(key)
  })
})

/**
 * 左侧待选表实际展示数据：卫星走服务端分页，其余走本地过滤。
 */
const displayCandidates = computed(() => {
  if (isSatelliteKind.value) {
    const assembledIds = new Set(assembledRows.value.map((row) => row.id))
    return candidatePool.satellite.filter((row) => !assembledIds.has(row.id))
  }
  return filteredCandidates.value
})

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
 * 加载星座筛选项，并构建 NORAD 到星座名称的映射。
 */
const loadConstellations = async () => {
  try {
    const res = await getSatelliteConstellations()
    const list = res.code === 200 ? (res.data ?? []) : []
    constellations.value = list
    constellationOptions.value = list.map((item) => ({
      label: item.chineseName || item.englishName || item.name,
      value: item.englishName || item.name,
    }))
    const noradMap = new Map<number, string>()
    list.forEach((item) => {
      const label = item.chineseName || item.englishName || item.name
      item.noradIds?.forEach((norad) => noradMap.set(norad, label))
    })
    constellationNoradMap.value = noradMap
  } catch {
    constellations.value = []
    constellationOptions.value = []
    constellationNoradMap.value = new Map()
  }
}

/**
 * 按当前筛选与分页拉取卫星列表。
 */
const loadSatelliteCandidates = async () => {
  listLoading.value = true
  try {
    const res = await getSatelliteList(
      satPage.pageNum,
      satPage.pageSize,
      toOptionalNorad(keyword.value),
      undefined,
      resolveSatelliteNameParam(),
      toOptionalString(countryFilter.value),
      undefined,
      undefined,
      undefined,
      toOptionalString(typeFilter.value)
    )
    let list = res.code === 200 ? (res.data?.content ?? []) : []
    if (seriesFilter.value && !toOptionalNorad(keyword.value)) {
      const selected = constellations.value.find(
        (item) => (item.englishName || item.name) === seriesFilter.value
      )
      if (selected?.noradIds?.length) {
        const noradSet = new Set(selected.noradIds)
        list = list.filter((item) => noradSet.has(item.norad))
      }
    }
    candidatePool.satellite = list.map(satelliteToRow)
    satTotalElements.value = res.code === 200 ? (res.data?.totalElements ?? 0) : 0
  } finally {
    listLoading.value = false
  }
}

/**
 * 卫星筛选条件变化时回到第一页并重新查询。
 */
const handleSatelliteSearch = () => {
  if (!isSatelliteKind.value) return
  satPage.pageNum = 1
  loadSatelliteCandidates()
}

/**
 * 卫星分页大小变化时重新查询。
 */
const handleSatPageSizeChange = () => {
  satPage.pageNum = 1
  loadSatelliteCandidates()
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
const loadCandidatePool = async () => {
  if (isSatelliteKind.value) {
    await loadSatelliteCandidates()
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
  } finally {
    listLoading.value = false
  }
}

/**
 * 待选表勾选变化。
 * @param rows 当前勾选行
 */
const onCandidateSelectionChange = (rows: TaskAssembleRow[]) => {
  candidateSelection.value = rows
}

/**
 * 已装配表勾选变化。
 * @param rows 当前勾选行
 */
const onAssembledSelectionChange = (rows: TaskAssembleRow[]) => {
  assembledSelection.value = rows
}

/**
 * 将待选勾中的资源移入已装配列表。
 */
const addSelected = () => {
  const incoming = candidateSelection.value.filter(
    (row) => !assembledRows.value.some((item) => item.id === row.id)
  )
  assembledRows.value = [...assembledRows.value, ...incoming]
  candidateSelection.value = []
  candidateTableRef.value?.clearSelection()
}

/**
 * 将已装配勾中的资源移回待选。
 */
const removeSelected = () => {
  const removeIds = new Set(assembledSelection.value.map((row) => row.id))
  assembledRows.value = assembledRows.value.filter((row) => !removeIds.has(row.id))
  assembledSelection.value = []
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
    seriesFilter.value = ''
    typeFilter.value = ''
    countryFilter.value = ''
    satPage.pageNum = 1
    candidateSelection.value = []
    assembledSelection.value = []
    assembledRows.value = []
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

onMounted(async () => {
  if (isSatelliteKind.value) {
    await Promise.all([loadCountries(), loadSatTypes(), loadConstellations(), loadSatelliteCandidates()])
    return
  }
  if (crudEnabled.value) {
    await Promise.all([loadCountries(), loadCandidatePool()])
  }
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

.assemble-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px minmax(0, 1fr);
  gap: 10px;
  flex: 1;
  min-height: 0;
  align-items: stretch;
  box-sizing: border-box;
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

.assemble-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding-top: 28px;

  :deep(.atlas-app-button) {
    width: 100%;
    margin: 0;
    padding-left: 6px;
    padding-right: 6px;
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
