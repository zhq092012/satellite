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
        style="width: 200px" @keyup.enter="handleSatelliteSearch" @clear="handleSatelliteSearch" />
      <el-select v-if="typeFilterOptions.length && !isSatelliteKind" v-model="typeFilter" size="small" clearable
        :placeholder="config.typePlaceholder" class="assemble-filter" style="width: 160px"
        popper-class="task-edit-select-popper" @change="handleSatelliteSearch" @clear="handleSatelliteSearch"
        filterable>
        <el-option v-for="item in typeFilterOptions" :key="item" :label="item" :value="item" />
      </el-select>
      <el-button v-if="apiEnabled" class="task-edit-btn task-edit-btn--ghost" size="small" :loading="listLoading"
        @click="loadCandidatePool">
        刷新
      </el-button>
      <span class="assemble-count">{{ isSatelliteKind ? `已选系列 ${assembledSeriesIds.size} 个` : `已装配
        ${assembledRows.length} 项` }}</span>
    </div>

    <!-- 卫星：系列栏 + 卫星列表（无穿梭框） -->
    <div v-if="isSatelliteKind" class="assemble-satellite-body">
      <section class="assemble-pane series-pane">
        <div class="assemble-pane-head">
          <span>卫星系列</span>
          <span class="assemble-pane-sub">勾选即装配系列</span>
        </div>
        <div v-loading="listLoading" class="assemble-pane-body series-pane-body">
          <div v-if="!seriesGroupsByType.length" class="series-empty">
            请先配置作战对象与卫星类型
          </div>
          <div v-else class="series-group-list">
            <section v-for="group in seriesGroupsByType" :key="group.typeLabel" class="series-type-group"
              :aria-label="`${group.typeLabel}卫星系列`">
              <div class="series-type-head">{{ group.typeLabel }}</div>
              <div class="series-chip-list" role="list">
                <div v-for="row in group.rows" :key="row.id" class="series-chip" role="listitem" tabindex="0" :class="{
                  'series-chip--preview': previewFocusSeries === row.series,
                  'series-chip--assembled': isSeriesAssembled(row.id),
                }" @click="handleSeriesChipToggle(row)" @keydown.enter.prevent="handleSeriesChipToggle(row)"
                  @keydown.space.prevent="handleSeriesChipToggle(row)">
                  <input type="checkbox" class="series-chip-native-check" :checked="isSeriesAssembled(row.id)"
                    :aria-label="`装配系列 ${row.name}`" @click.stop @change="onSeriesNativeCheckChange(row, $event)" />
                  <span class="series-chip-label">{{ row.name }}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
      <section class="assemble-pane satellite-list-pane">
        <div class="assemble-pane-head">
          <span>卫星列表</span>
          <span class="assemble-pane-sub">{{ previewSeriesLabel }}</span>
        </div>
        <div class="assemble-pane-body assemble-pane-body--satellite-list">
          <el-table v-loading="listLoading" :data="displaySatellitePreview" size="small" row-key="id"
            class="assemble-table assemble-table--satellite-preview" empty-text="请勾选系列以加载卫星" :max-height="520" fit
            style="width: 100%">
            <el-table-column v-for="col in tableColumns" :key="col.prop" :prop="col.prop" :label="col.label"
              v-bind="assembleColumnTableProps(col)" show-overflow-tooltip />
          </el-table>
        </div>
      </section>
    </div>

    <!-- 地面站 / 数据中心 / 武器：单表勾选即装配 -->
    <div v-else class="assemble-single-pane">
      <div class="assemble-pane-head">
        <span>待选资源</span>
        <span class="assemble-pane-sub">勾选表格行即为装配 · 共 {{ candidateTotalText }} 项</span>
      </div>
      <div class="assemble-pane-body assemble-pane-body--tall">
        <el-table ref="candidateTableRef" v-loading="listLoading" :data="displayCandidates" size="small" height="100%"
          row-key="id" class="assemble-table" :empty-text="apiEnabled ? '暂无资源' : '暂无候选资源'" fit style="width: 100%"
          @selection-change="onDirectAssemblySelection">
          <el-table-column type="selection" width="42" :reserve-selection="true" />
          <el-table-column v-for="col in tableColumns" :key="col.prop" :prop="col.prop" :label="col.label"
            v-bind="assembleColumnTableProps(col)" show-overflow-tooltip />
          <el-table-column v-if="crudEnabled" label="修改" width="64" fixed="right" align="center">
            <template #default="{ row }">
              <el-button link type="primary" class="assemble-edit-btn" @click="openEditDialog(row)">修改</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
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
import { MISSION_SYS_TYPES } from '@/constants/missionSatellite'
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
  /** 额外字段：卫星体系 / 经度 / 适用目标等（依装配类型复用） */
  extra1: string
  /** 额外字段：发射日期 / 纬度 / 射程高度等（依装配类型复用） */
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
  /** 为 true 时不设固定 width，列占满表格剩余宽度 */
  flex?: boolean
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

/** 候选表实例，用于同步勾选。 */
const candidateTableRef = ref<TableInstance>()
/** 程序化同步表格勾选，避免递归 */
const syncingTableSelection = ref(false)
/** 名称关键字。 */
const keyword = ref('')
/** 点击系列名称时的单系列预览（未勾选装配时）。 */
const previewFocusSeries = ref('')
/** 已勾选系列下，表格按名称点击收窄到某一系列（仅本地过滤）。 */
const satelliteTableSeriesFilter = ref('')
/** 类型筛选。 */
const typeFilter = ref('')
/** 卫星系列候选项。 */
const seriesOptions = ref<string[]>([])
/** 最近一次系列接口返回，用于卫星类型变化时本地重算候选项。 */
const seriesDataCache = ref<{ 侦察?: string[]; 通信?: string[] } | null>(null)
/** 卫星类型筛选项。 */
const satTypes = ref<string[]>([])
/** 待选表当前勾选。 */
const candidateSelection = ref<TaskAssembleRow[]>([])
/** 已装配表当前勾选。 */
const assembledSelection = ref<TaskAssembleRow[]>([])
/** 已从待选移入的资源。 */
const assembledRows = ref<TaskAssembleRow[]>([])
/** 卫星装配：已勾选系列 id 集合（与系列名一致，支持多选）。 */
const assembledSeriesIds = ref<Set<string>>(new Set())
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
    description: '系列按蓝方国家查询，并按任务卫星类型（侦察/通信）分组展示；勾选系列后可预览卫星，装配的是系列本身。',
    searchPlaceholder: '国家 / 名称 / 系列',
    typePlaceholder: '卫星类型',
    typeOptions: [],
    seriesOptions: [],
    columns: [
      { prop: 'country', label: '国家', width: 90 },
      { prop: 'name', label: '卫星名称', minWidth: 96, flex: true },
      { prop: 'type', label: '卫星类型', minWidth: 120 },
      { prop: 'series', label: '卫星系列', minWidth: 120 },
      { prop: 'extra1', label: '卫星体系', minWidth: 120 },
      { prop: 'extra2', label: '发射日期', minWidth: 120 },
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
      { prop: 'country', label: '国家', width: 72 },
      { prop: 'name', label: '名称', minWidth: 112, flex: true },
      { prop: 'type', label: '类型', minWidth: 120 },
      { prop: 'extra1', label: '经度', minWidth: 120 },
      { prop: 'extra2', label: '纬度', minWidth: 120 },
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
      { prop: 'country', label: '国家', width: 72 },
      { prop: 'name', label: '名称', minWidth: 112, flex: true },
      { prop: 'type', label: '类型', minWidth: 120 },
      { prop: 'extra1', label: '经度', minWidth: 120 },
      { prop: 'extra2', label: '纬度', minWidth: 120 },
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
      { prop: 'country', label: '国家', width: 72 },
      { prop: 'name', label: '名称', minWidth: 100, flex: true },
      { prop: 'type', label: '类型', minWidth: 120 },
      { prop: 'extra1', label: '适用目标', minWidth: 120 },
      { prop: 'extra2', label: '射程/高度', minWidth: 120 },
      { prop: 'extra3', label: '经度', minWidth: 120 },
      { prop: 'extra4', label: '纬度', minWidth: 120 },
      { prop: 'extra5', label: '打击间隔', minWidth: 120 },
    ],
  },
}

/** 当前种类的页面配置。 */
const config = computed(() => KIND_CONFIG[props.kind])

/** 左侧预览/待选表列：卫星为卫星详情列，其余为各类型配置列。 */
const tableColumns = computed(() => config.value.columns)

/**
 * 绑定 el-table-column 宽度：flex 列仅 minWidth；固定列仅 width，避免 minWidth 累加触发横向滚动。
 *
 * @param col 列配置
 */
const assembleColumnTableProps = (col: AssembleColumn): { width?: number; minWidth?: number } => {
  if (col.flex) {
    return { minWidth: col.minWidth ?? 96 }
  }
  if (col.width != null) {
    return { width: col.width }
  }
  return { minWidth: col.minWidth ?? 72 }
}



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

/** 卫星预览区副标题。 */
const satellitePreviewSubText = computed(() => {
  const assembled = [...assembledSeriesIds.value]
  if (assembled.length === 1) return `当前系列：${assembled[0]}`
  if (assembled.length > 1) return `已勾选 ${assembled.length} 个系列`
  if (previewFocusSeries.value) return `预览系列：${previewFocusSeries.value}`
  if (!seriesQueryCountries.value.length) return '请先在基本信息中选择蓝方国家'
  if (!seriesQueryTargetTypes.value.length) return '请先在基本信息中选择卫星类型（侦察/通信）'
  const typeText = seriesQueryTargetTypes.value.join('、')
  return `蓝方：${seriesQueryCountries.value.join('、')}；类型：${typeText}，请勾选系列`
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
 * 将经度或纬度格式化为保留三位小数的展示文本。
 *
 * @param value 原始坐标（数字或字符串）
 * @returns 三位小数文本；无效时为 `--`
 */
const formatCoordinateDisplay = (value: string | number | null | undefined): string => {
  if (value == null || value === '' || value === '--') return '--'
  const numeric = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(numeric)) return '--'
  return numeric.toFixed(3)
}

/**
 * 解析经纬度字符串，展示时保留三位小数。
 *
 * @param latLon 格式为 "经度,纬度"
 * @returns 经度、纬度展示文案
 */
const parseLatLon = (latLon: string): { lng: string; lat: string } => {
  const parts = (latLon || '').split(',').map((item) => item.trim())
  return {
    lng: parts[0] ? formatCoordinateDisplay(parts[0]) : '--',
    lat: parts[1] ? formatCoordinateDisplay(parts[1]) : '--',
  }
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
  /** catalog 扩展：任务系统类型（卫星体系） */
  mission_sys_type?: string
  /** catalog 扩展：发射日期 */
  launch_date?: string
}

/**
 * 根据系列在 getSeries 缓存中的归属推断任务系统类型。
 *
 * @param seriesName 系列名称
 * @returns 侦察 / 通信等；无法推断时为 null
 */
const resolveMissionSysTypeFromSeriesCache = (seriesName: string): string | null => {
  const cache = seriesDataCache.value
  const name = seriesName.trim()
  if (!cache || !name) return null
  if (cache.侦察?.includes(name)) return '侦察'
  if (cache.通信?.includes(name)) return '通信'
  return null
}

/**
 * catalog 未返回发射日期时，按 NORAD 生成稳定演示日期（仅展示用）。
 *
 * @param norad NORAD 编号
 * @returns `YYYY-MM-DD` 或 `--`
 */
const mockLaunchDateFromNorad = (norad: number): string => {
  if (!Number.isFinite(norad) || norad <= 0) return '--'
  const year = 1985 + (Math.abs(Math.trunc(norad)) % 35)
  const month = (Math.abs(Math.trunc(norad)) % 12) + 1
  const day = (Math.abs(Math.trunc(norad)) % 27) + 1
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * 将未知类型字段规范为展示用字符串。
 *
 * @param value 原始字段
 * @returns 去空白后的字符串
 */
const toAssembleDisplayText = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  return String(value).trim()
}

/**
 *
 * @param satellite 卫星预览数据
 * @param seriesName 所属系列
 * @returns 任务系统类型文案
 */
const resolveSatelliteMissionSysType = (satellite: SatellitePreviewItem, seriesName: string): string => {
  const fromApi = toAssembleDisplayText(satellite.mission_sys_type)
  if (fromApi) return fromApi
  const fromSeries = resolveMissionSysTypeFromSeriesCache(seriesName)
  if (fromSeries) return fromSeries
  const norad = Number(satellite.norad)
  const idx = Number.isFinite(norad) ? Math.abs(Math.trunc(norad)) % MISSION_SYS_TYPES.length : 0
  return MISSION_SYS_TYPES[idx] ?? '侦察'
}

/**
 * 将接口返回的发射时间规范为 `YYYY-MM-DD` 展示。
 *
 * @param raw 原始发射时间（可能为逗号分隔或 ISO 字符串）
 * @returns 展示用日期；无法解析时返回原文或 `--`
 */
const normalizeLaunchDateDisplay = (raw: string): string => {
  const text = raw.trim()
  if (!text) return '--'
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  const commaParts = text.split(',').map((part) => part.trim())
  if (commaParts.length >= 3) {
    const year = Number(commaParts[0])
    const month = Number(commaParts[1])
    const day = Number(commaParts[2])
    if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${year}-${pad(month)}-${pad(day)}`
    }
  }
  const parsed = Date.parse(text.replace(/-/g, '/'))
  if (Number.isFinite(parsed)) {
    const d = new Date(parsed)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  return text
}

/**
 * 解析发射日期展示值：优先接口字段，缺失时使用 mock。
 *
 * @param satellite 卫星预览数据
 * @returns 发射日期文案
 */
const resolveSatelliteLaunchDate = (satellite: SatellitePreviewItem): string => {
  const fromApi = toAssembleDisplayText(satellite.launch_date)
  if (fromApi) return normalizeLaunchDateDisplay(fromApi)
  return mockLaunchDateFromNorad(Number(satellite.norad))
}

/**
 * 将卫星信息映射为装配表格行。
 *
 * @param satellite 卫星原始数据
 * @param seriesName 所属系列（接口未返回 series 时使用）
 */
const satelliteToRow = (satellite: SatellitePreviewItem, seriesName?: string): TaskAssembleRow => {
  const series = toAssembleDisplayText(satellite.series) || seriesName || '--'
  const countryFromApi = toAssembleDisplayText(satellite.country)
  const fallbackCountry =
    props.enemyCountries?.length === 1
      ? toAssembleDisplayText(props.enemyCountries[0])
      : ''
  const norad = Number(satellite.norad)
  const id =
    toAssembleDisplayText(satellite._id) ||
    (Number.isFinite(norad) && norad > 0 ? String(norad) : `${series}-${toAssembleDisplayText(satellite.name_en) || toAssembleDisplayText(satellite.name_cn) || 'unknown'}`)
  return {
    id,
    name:
      toAssembleDisplayText(satellite.name_en) ||
      toAssembleDisplayText(satellite.name_cn) ||
      (Number.isFinite(norad) ? String(norad) : '--'),
    series,
    type: toAssembleDisplayText(satellite.sat_type) || '--',
    country: countryFromApi || fallbackCountry || '--',
    extra1: resolveSatelliteMissionSysType(satellite, series),
    extra2: resolveSatelliteLaunchDate(satellite),
  }
}

/**
 * 格式化武器坐标展示。
 *
 * @param value 经度或纬度
 * @returns 坐标文本；无效时为 `--`
 */
const formatWeaponCoord = (value?: number | null): string => formatCoordinateDisplay(value)

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
  if (isSatelliteKind.value) {
    return pool.filter((row) => {
      if (typeFilter.value && row.type !== typeFilter.value) return false
      if (!key) return true
      return buildRowSearchText(row).includes(key)
    })
  }
  return pool.filter((row) => {
    if (typeFilter.value && row.type !== typeFilter.value) return false
    if (!key) return true
    return buildRowSearchText(row).includes(key)
  })
})

/** 按任务卫星类型分组的系列 chip 数据（侦察 / 通信）。 */
interface SeriesTypeGroup {
  /** 类型标题（侦察、通信） */
  typeLabel: '侦察' | '通信'
  /** 该类型下的系列行 */
  rows: TaskAssembleRow[]
}

/**
 * 从系列接口缓存构建分组列表（顺序：侦察 → 通信，与任务已选类型一致）。
 */
const seriesGroupsByType = computed((): SeriesTypeGroup[] => {
  const cache = seriesDataCache.value
  const selectedTypes = seriesQueryTargetTypes.value
  if (!cache || !selectedTypes.length) return []

  const countryText = seriesQueryCountries.value.join('、') || '--'
  const groups: SeriesTypeGroup[] = []

  const appendGroup = (typeLabel: '侦察' | '通信', rawList: string[] | undefined) => {
    if (!selectedTypes.includes(typeLabel)) return
    const names = Array.from(new Set((rawList || []).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'zh-CN'),
    )
    if (!names.length) return
    groups.push({
      typeLabel,
      rows: names.map((series) => ({
        id: series,
        name: series,
        series,
        type: typeLabel,
        country: countryText,
        extra1: '--',
        extra2: '--',
      })),
    })
  }

  appendGroup('侦察', cache.侦察)
  appendGroup('通信', cache.通信)
  return groups
})

/** 卫星系列候选项表行（分组扁平化，供装配同步与校验使用）。 */
const seriesTableRows = computed((): TaskAssembleRow[] =>
  seriesGroupsByType.value.flatMap((group) => group.rows),
)

/** 卫星预览列表（关键字 + 可选单系列收窄） */
const displaySatellitePreview = computed(() => {
  const rows = filteredCandidates.value
  const narrow = satelliteTableSeriesFilter.value
  if (!narrow) return rows
  return rows.filter((row) => row.series === narrow)
})

/**
 * 根据当前系列候选项与 id 集合，同步 assembledRows（仅卫星装配页）。
 */
const syncAssembledRowsFromSeriesIds = () => {
  if (!isSatelliteKind.value) return
  const idSet = assembledSeriesIds.value
  assembledRows.value = seriesTableRows.value
    .filter((row) => idSet.has(row.id))
    .map((row) => ({ ...row }))
}

/**
 * 移除已不在候选项中的系列勾选。
 */
const pruneAssembledSeriesIds = () => {
  if (!isSatelliteKind.value) return
  const allowed = new Set(seriesOptions.value)
  const next = new Set([...assembledSeriesIds.value].filter((id) => allowed.has(id)))
  assembledSeriesIds.value = next
  syncAssembledRowsFromSeriesIds()
}

/**
 * 清空卫星系列勾选与预览。
 */
const clearSatelliteAssemblyState = () => {
  assembledSeriesIds.value = new Set()
  assembledRows.value = []
  previewFocusSeries.value = ''
  satelliteTableSeriesFilter.value = ''
  candidatePool.satellite = []
}

/**
 * 系列是否已勾选装配。
 *
 * @param seriesId 系列 id（与系列名一致）
 */
const isSeriesAssembled = (seriesId: string): boolean => assembledSeriesIds.value.has(seriesId)

/**
 * 原生 checkbox change：勾选/取消系列（可多选）。
 *
 * @param row 系列行
 * @param event change 事件
 */
const onSeriesNativeCheckChange = async (row: TaskAssembleRow, event: Event) => {
  const input = event.target as HTMLInputElement | null
  if (!input) return
  await handleSeriesAssemblyToggle(row, input.checked)
}

/**
 * 勾选/取消系列装配；按全部已勾选系列合并加载下方卫星列表。
 *
 * @param row 系列行
 * @param checked 是否勾选
 */
const handleSeriesAssemblyToggle = async (row: TaskAssembleRow, checked: boolean) => {
  if (syncingTableSelection.value) return
  const nextIds = new Set(assembledSeriesIds.value)
  if (checked) {
    nextIds.add(row.id)
  } else {
    nextIds.delete(row.id)
  }
  assembledSeriesIds.value = nextIds
  syncAssembledRowsFromSeriesIds()
  satelliteTableSeriesFilter.value = ''
  await reloadSatellitePreview()
}

/**
 * 点击系列 chip（含文字与边框内空白）：与 checkbox 一致，切换装配并刷新卫星列表。
 *
 * @param row 系列行
 */
const handleSeriesChipToggle = async (row: TaskAssembleRow) => {
  if (!row.series) return
  await handleSeriesAssemblyToggle(row, !isSeriesAssembled(row.id))
}

/** 当前预览系列标题 */
const previewSeriesLabel = computed(() => satellitePreviewSubText.value)

/**
 * 按系列名称列表并行拉取卫星并合并到候选池（去重 by id）。
 *
 * @param seriesList 系列名称列表
 */
const loadSatelliteCandidatesForSeriesList = async (seriesList: string[]) => {
  if (!seriesList.length) {
    candidatePool.satellite = []
    return
  }
  listLoading.value = true
  try {
    const batches = await Promise.all(
      seriesList.map(async (series) => {
        const res = await getSatelliteBySeries(series)
        const raw = res.code === 200 ? res.data : null
        const list = Array.isArray(raw) ? raw : raw ? [raw] : []
        return list.map((item) => satelliteToRow(item as SatellitePreviewItem, series))
      }),
    )
    const byId = new Map<string, TaskAssembleRow>()
    batches.flat().forEach((row) => {
      if (!byId.has(row.id)) {
        byId.set(row.id, row)
      }
    })
    candidatePool.satellite = [...byId.values()].sort(
      (a, b) =>
        a.series.localeCompare(b.series, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN'),
    )
  } catch (error) {
    console.error('加载系列卫星预览失败:', error)
    candidatePool.satellite = []
  } finally {
    listLoading.value = false
  }
}

/**
 * 根据已勾选系列或预览焦点，刷新下方卫星列表。
 */
const reloadSatellitePreview = async () => {
  const assembled = [...assembledSeriesIds.value].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  if (assembled.length) {
    previewFocusSeries.value = ''
    await loadSatelliteCandidatesForSeriesList(assembled)
    return
  }
  if (previewFocusSeries.value) {
    await loadSatelliteCandidatesForSeriesList([previewFocusSeries.value])
    return
  }
  candidatePool.satellite = []
}

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
  if (previewFocusSeries.value && !seriesOptions.value.includes(previewFocusSeries.value)) {
    previewFocusSeries.value = ''
    candidatePool.satellite = []
  }
  pruneAssembledSeriesIds()
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
 * 卫星关键字 / 类型筛选变化（本地过滤，不重新请求）。
 */
const handleSatelliteSearch = () => {
  if (!isSatelliteKind.value) return
}

/**
 * 将已装配占位行与候选池按 ID 对齐，补全名称等展示字段。
 */
const enrichAssembledFromPool = () => {
  if (!assembledRows.value.length) return
  if (isSatelliteKind.value) {
    /** 卫星装配按系列名存储，候选池为具体卫星行，不可按 id 对齐 */
    return
  }
  const poolById = new Map<string, TaskAssembleRow>()
  const pools =
    props.kind === 'center'
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
    if (seriesQueryCountries.value.length) {
      await loadSeriesOptions()
    }
    await reloadSatellitePreview()
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
    if (isSatelliteKind.value) {
      await restoreSeriesAssemblySelection()
    } else {
      await restoreDirectAssemblySelection()
    }
  } finally {
    listLoading.value = false
  }
}

/**
 * 同步非卫星种类候选表勾选（勾选即装配）。
 */
const restoreDirectAssemblySelection = async () => {
  await nextTick()
  const table = candidateTableRef.value
  if (!table || isSatelliteKind.value) return
  syncingTableSelection.value = true
  table.clearSelection()
  const wanted = new Set(assembledRows.value.map((row) => row.id))
  displayCandidates.value.forEach((row) => {
    if (wanted.has(row.id)) table.toggleRowSelection(row, true)
  })
  syncingTableSelection.value = false
}

/**
 * 卫星系列装配状态由 assembledRows 驱动，chip 勾选为受控展示，无需表格回显。
 */
const restoreSeriesAssemblySelection = async () => {
  await nextTick()
}

/**
 * 地面站/数据中心/武器：勾选行即装配集合。
 *
 * @param rows 当前勾选
 */
const onDirectAssemblySelection = (rows: TaskAssembleRow[]) => {
  if (syncingTableSelection.value) return
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
    previewFocusSeries.value = ''
    satelliteTableSeriesFilter.value = ''
    typeFilter.value = ''
    seriesOptions.value = []
    seriesDataCache.value = null
    candidateSelection.value = []
    assembledSelection.value = []
    if (isSatelliteKind.value) {
      clearSatelliteAssemblyState()
    } else {
      assembledRows.value = []
    }
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
    clearSatelliteAssemblyState()
    await loadSeriesOptions()
  },
  { deep: true }
)

/** 卫星类型变化时，按类型重算系列候选项并清空无效预览与装配勾选。 */
watch(
  seriesQueryTargetTypes,
  async () => {
    if (!isSatelliteKind.value) return
    clearSatelliteAssemblyState()
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
  isSatelliteKind.value
    ? [...assembledSeriesIds.value].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    : assembledRows.value.map((row) => row.series || row.name).filter(Boolean)

/**
 * 回显已装配资源行（编辑任务时由弹窗调用）。
 *
 * @param rows 已装配资源列表
 */
const setAssembledRows = (rows: TaskAssembleRow[]) => {
  if (isSatelliteKind.value) {
    assembledSeriesIds.value = new Set(rows.map((row) => row.id).filter(Boolean))
    syncAssembledRowsFromSeriesIds()
    void restoreSeriesAssemblySelection()
    void reloadSatellitePreview()
    return
  }
  assembledRows.value = rows.map((row) => ({ ...row }))
  enrichAssembledFromPool()
  void restoreDirectAssemblySelection()
}

defineExpose({
  getAssembledRows,
  getAssembledSeries,
  setAssembledRows,
})
</script>

<style lang="scss" scoped>
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.task-assemble-tab {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  min-width: 0;
  width: 100%;
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
  font-weight: 700;
  color: #40f2ff;
}

.assemble-desc {
  margin: 0;
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
  color: #7dd3fc;
  white-space: nowrap;
}

.assemble-satellite-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.series-pane {
  flex: 0 0 auto;
}

.series-pane-body {
  flex: 0 1 auto;
  max-height: 280px;
  overflow-y: auto;
  padding: 10px;
}

.series-empty {
  color: #64748b;
  line-height: 1.5;
}

.series-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.series-type-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.series-type-head {
  font-size: 18px;
  font-weight: 700;
  color: #40f2ff;
  line-height: 1.35;
  border-left: 3px solid rgba(0, 225, 255, 0.55);
  padding-left: 8px;
}

.series-chip-list {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.series-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid rgba(0, 225, 255, 0.22);
  background: rgba(8, 20, 36, 0.65);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: rgba(56, 189, 248, 0.45);
    background: rgba(0, 225, 255, 0.08);
  }

  &--assembled {
    border-color: rgba(34, 197, 94, 0.55);
    background: rgba(20, 83, 45, 0.35);
  }

  &--preview {
    border-color: rgba(64, 242, 255, 0.75);
    box-shadow: 0 0 0 1px rgba(64, 242, 255, 0.25) inset;
  }
}

.series-chip-native-check {
  width: 18px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
  cursor: pointer;
  accent-color: #00e1ff;
}

.series-chip-label {
  color: #e2efff;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: #7dd3fc;
  }
}

.satellite-list-pane {
  flex: 1;
  min-height: 0;
}

.assemble-pane-body--satellite-list {
  flex: 1;
  min-height: 240px;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.assemble-table--satellite-preview {
  flex: 0 1 auto;
  height: auto;
  min-height: 120px;
  width: 100%;
  max-width: 100%;
  @include battleUi.battle-ui-c2-panel-table-fit;

  :deep(.atlas-app-table),
  :deep(.atlas-app-table__inner-wrapper) {
    height: auto !important;
  }

  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden !important;
  }
}

.assemble-single-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(56, 189, 248, 0.18);
  border-radius: 8px;
  overflow: hidden;
}

.assemble-pane-body--tall {
  flex: 1;
  min-height: 320px;
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
  min-width: 0;
  width: 100%;
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
}

.assemble-table {
  flex: 1;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100% !important;
  max-width: 100%;
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
    width: 100% !important;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper),
  :deep(.atlas-app-table__footer-wrapper) {
    width: 100% !important;
  }

  :deep(.atlas-app-table__header table),
  :deep(.atlas-app-table__body table) {
    table-layout: fixed;
    width: 100% !important;
  }

  :deep(th.atlas-app-table__cell),
  :deep(td.atlas-app-table__cell) {
    padding-left: 6px;
    padding-right: 6px;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
  }

  :deep(td.atlas-app-table__cell) {
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
@use '@/components/BattleSituation/styles/task-edit-typography.scss';

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
