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
      <el-button v-if="apiEnabled" class="task-edit-btn task-edit-btn--ghost" size="small"
        :loading="isSatelliteKind ? satelliteTreePaneLoading : listLoading" @click="handleRefreshToolbar">
        刷新
      </el-button>
      <span class="assemble-count">{{ isSatelliteKind ? `已选卫星 ${assembledTaskSatellites.length} 颗` : `已装配
        ${assembledRows.length} 项` }}</span>
    </div>

    <!-- 卫星：资源树（国家 → 体系 → 系列 → 卫星） + 已选列表 -->
    <div v-if="isSatelliteKind" class="assemble-satellite-body assemble-satellite-body--tree">
      <section class="assemble-pane satellite-tree-pane">
        <div class="assemble-pane-head">
          <span>卫星资源树</span>
        </div>
        <div v-loading="satelliteTreePaneLoading"
          :element-loading-text="satelliteTreeCheckLoading ? '正在加载系列卫星并计算勾选状态…' : undefined"
          class="assemble-pane-body satellite-tree-body">
          <div v-if="!satelliteTreePaneLoading && !satelliteTreeLazyReady" class="series-empty">
            请先配置作战对象与卫星类型，并点击刷新加载系列树
          </div>
          <div v-else-if="satelliteTreeLoading && !satelliteTreeLazyReady" class="series-empty">
            系列树后台构建中，可先查看右侧已选卫星列表
          </div>
          <el-tree v-else ref="satelliteTreeRef" v-model:expanded-keys="satelliteTreeExpandedKeys"
            class="satellite-resource-tree" lazy :load="loadSatelliteTreeLazyNode" node-key="id" show-checkbox
            :props="satelliteTreeLazyProps" @check="handleSatelliteTreeCheck" />
        </div>
      </section>
      <section class="assemble-pane satellite-list-pane">
        <div class="assemble-pane-head">
          <span>已选卫星</span>
        </div>
        <div class="assemble-pane-body assemble-pane-body--satellite-list">
          <el-table :data="displayAssembledSatelliteRows" size="small" row-key="id"
            class="assemble-table assemble-table--satellite-preview" empty-text="请在上方树中勾选卫星" height="100%" fit
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
                <el-option v-for="item in groundStationCountryOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="站号编码" prop="code">
              <el-input v-model.trim="stationForm.code" placeholder="例如 KS-01" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="高度(m)" prop="altitude">
              <el-input-number v-model="stationForm.altitude" class="full-width" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude">
              <el-input-number v-model="stationForm.longitude" :precision="6" :min="-180" :max="180"
                class="full-width" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude">
              <el-input-number v-model="stationForm.latitude" :precision="6" :min="-90" :max="90" class="full-width" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="描述" prop="description">
              <el-input v-model.trim="stationForm.description" type="textarea" :rows="3" placeholder="请输入描述" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button v-if="stationForm.id" class="task-edit-btn task-edit-btn--ghost" type="danger" :loading="deleting"
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
import { computed, nextTick, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import type { TableInstance } from 'element-plus'
import type { ElTree } from 'element-plus'
import {
  createWeapon,
  deleteWeapon,
  updateWeapon,
} from '@/api/dashboard'
import {
  getSeriesTaskSatellitesFromPanelTreeCache,
  loadSatelliteResourceTreeRootsForPanel,
} from '@/utils/satelliteResourceTreeStoreCache'
import type { SatelliteAssembleTreeNode, SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import type { TaskResourceItem } from '@/types/task/task'
import { buildSatelliteAssembleTreeInBackground } from '@/utils/satelliteAssembleTreeWorkerClient'
import {
  clearSeriesSatelliteCache,
  fetchSeriesTaskSatellites,
  mergeSeriesSatellitesIntoTaskList,
  removeSeriesSatellitesFromTaskList,
  buildSeriesScopeCacheKey,
  resolveSeriesScopeFromAssembleNode,
  applyElTreeSeriesCheckStates,
  buildTaskSatelliteDisplayMetaFromInventory,
  type SatelliteSeriesScope,
  type TaskSatelliteTreeDisplayMeta,
} from '@/utils/taskSatelliteTreeBridge'
import {
  buildTaskScopedInventoryFromApiTreeRoots,
  type AssembleSeriesCheckState,
  type AssembleSeriesCheckStateEntry,
} from '@/utils/satelliteResourceTree'
import { useLayoutStore } from '@/store/modules/layout'
import { GROUND_STATION_COUNTRY_OPTIONS } from '@/constants/groundStationCountries'
import {
  createGroundStation,
  deleteGroundStation,
  getGroundStationList,
  updateGroundStation,
} from '@/api/ground-station/ground-station'
import type { GroundStation, GroundStationUpsertPayload } from '@/types/ground-station/groundstation'

/** 地面站弹窗表单。 */
type GroundStationFormModel = GroundStationUpsertPayload & { id?: number }
import type { Weapon } from '@/types/dashboard'

/** 任务装配页的资源类型。 */
export type TaskAssembleKind =
  /** 卫星系列 */
  | 'satellite'
  /** 地面接收站 */
  | 'station'
  /** 打击或干扰武器 */
  | 'weapon'

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
  /** 任务作战对象国家列表（来自任务 `country` 拆分） */
  combatCountries?: string[]
  /** 任务基本信息中的卫星类型（侦察、通信），用于过滤系列下拉 */
  targetTypes?: string[]
  /** 编辑任务回显：进入卫星 Tab 前已知的任务 `satellites` */
  initialTaskSatellites?: TaskResourceItem[]
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
/** 卫星资源树组件引用 */
const satelliteTreeRef = ref<InstanceType<typeof ElTree> | null>(null)
/** 回显时展开的国家 / 体系节点（懒加载树下勾选态依赖子节点已挂载） */
const satelliteTreeExpandedKeys = ref<string[]>([])
/** Worker 构建的完整系列树（懒加载数据源，不一次性挂到 el-tree） */
const satelliteTreeBuiltRoots = shallowRef<SatelliteAssembleTreeNode[]>([])
/** 系列树是否可懒加载展示（Worker 至少返回一国后即 true） */
const satelliteTreeLazyReady = ref(false)
/** 仅系列树区域加载中（与已选卫星表分离） */
const satelliteTreeLoading = ref(false)
/** 勾选系列后 search + Worker 重算勾选态 */
const satelliteTreeCheckLoading = ref(false)
/** 最近一次 Worker 建树入参（勾选后重算勾选态复用） */
const satelliteTreeLastBuildContext = shallowRef<{
  roots: SatelliteTreeCountryNode[]
  systems: string[]
} | null>(null)
/**
 * 计算：卫星资源树区域是否显示 loading 遮罩。
 * 返回 boolean。
 * 作用：初次 Worker 建树与勾选后重算期间禁止重复操作树。
 */
const satelliteTreePaneLoading = computed(
  () => satelliteTreeLoading.value || satelliteTreeCheckLoading.value,
)
/** Worker 计算的系列勾选态 */
const seriesCheckStateByNodeId = ref(new Map<string, AssembleSeriesCheckState>())
/** API 快照系列卫星（取消勾选时本地比对，默认不 search） */
const seriesInventoryFromApiByScopeKey = shallowRef<Record<string, TaskResourceItem[]>>({})
/** 已选卫星展示元数据（与树节点分离，resourceId → 国家/体系/系列） */
const satelliteDisplayMetaByResourceId = ref(new Map<string, TaskSatelliteTreeDisplayMeta>())
/** 系列节点处于「全选」态的 tree id（与任务卫星分离，用于 diff 勾选） */
const trackedFullyCheckedSeriesIds = ref<Set<string>>(new Set())
/** 已勾选卫星（对应任务 `satellites` 字段） */
const assembledTaskSatellites = ref<TaskResourceItem[]>([])
/** 程序化同步树勾选，避免递归触发 */
const syncingTreeCheck = ref(false)
/** 卫星树拉取世代号，丢弃过期异步结果避免重复渲染 */
let satelliteTreeLoadGeneration = 0
/** @deprecated 系列多选遗留；C2 系列推导改由已选卫星反推 */
const assembledSeriesIds = ref<Set<string>>(new Set())
/** 列表加载中。 */
const listLoading = ref(false)
/** 表单保存中。 */
const saving = ref(false)
/** 删除中。 */
const deleting = ref(false)
/** 国家下拉选项。 */
/** 武器等国家下拉（接口）；地面站使用 `groundStationCountryOptions`。 */
const countries = ref<string[]>([])
/** 地面站国家选项（写死，后期改字典）。 */
const groundStationCountryOptions = GROUND_STATION_COUNTRY_OPTIONS
/** 地面站/数据中心原始数据缓存，供编辑回填。 */
const stationRawMap = reactive<Record<string, GroundStation>>({})
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
  weapon: [],
})

/** 各装配页的标题、筛选与列配置。 */
const KIND_CONFIG: Record<TaskAssembleKind, AssembleKindConfig> = {
  satellite: {
    title: '卫星装配',
    description: '按国家拉取资源树（国家→体系→系列→卫星）；勾选卫星叶子即装配，并写入任务 satellites 字段。',
    searchPlaceholder: '国家 / 名称 / 系列',
    typePlaceholder: '卫星类型',
    typeOptions: [],
    seriesOptions: [],
    columns: [
      { prop: 'country', label: '国家', width: 90 },
      { prop: 'name', label: '卫星名称', minWidth: 96, flex: true },
      { prop: 'series', label: '卫星系列', minWidth: 120 },
      { prop: 'extra1', label: '卫星体系', minWidth: 120 },
      { prop: 'extra2', label: '代号', minWidth: 120 },
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
      { prop: 'country', label: '国家', width: 100 },
      { prop: 'name', label: '名称', minWidth: 112, flex: true },
      { prop: 'type', label: '站号', minWidth: 100 },
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

/**
 * 计算：当前装配页种类（`props.kind`）对应的页面配置项。
 * 返回：`KIND_CONFIG` 中该种类的配置对象。
 * 作用：驱动列定义、类型选项等同类页面的共性展示。
 */
const config = computed(() => KIND_CONFIG[props.kind])

/**
 * 计算：当前种类配置里的表格列定义。
 * 返回：配置对象中的 `columns` 数组。
 * 作用：左侧预览表与待选资源表按种类渲染对应列。
 */
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



/**
 * 计算：当前种类是否为地面站、数据中心或武器（已接入本地增删改查）。
 * 返回：满足种类时为 `true`，否则为 `false`。
 * 作用：控制资源弹窗、删除与候选池 CRUD 能力是否可用。
 */
const crudEnabled = computed(() => props.kind === 'station' || props.kind === 'weapon')

/**
 * 计算：当前种类是否需要从接口加载候选列表。
 * 返回：CRUD 种类或卫星种类时为 `true`。
 * 作用：决定是否调用 `loadCandidatePool` 等列表拉取逻辑。
 */
const apiEnabled = computed(() => crudEnabled.value || props.kind === 'satellite')

/**
 * 计算：当前是否为卫星装配页。
 * 返回：`props.kind === 'satellite'`。
 * 作用：切换系列勾选、卫星预览等与卫星专属流程相关的 UI 与逻辑。
 */
const isSatelliteKind = computed(() => props.kind === 'satellite')

/**
 * 计算：当前是否为地面站装配页。
 * 返回：种类为 `station` 时为 `true`。
 * 作用：共用基站表单与编辑弹窗时区分资源类型。
 */
const isStationKind = computed(() => props.kind === 'station')

/**
 * 计算：当前是否为武器装配页。
 * 返回：`props.kind === 'weapon'`。
 * 作用：控制武器表单、武器弹窗及相关校验的展示。
 */
const isWeaponKind = computed(() => props.kind === 'weapon')

/**
 * 计算：任务基本信息中的蓝方国家列表（去空）。
 * 返回：非空国家名称字符串数组。
 * 作用：查询卫星系列接口与系列分组展示时的国家条件。
 */
const seriesQueryCountries = computed(() => (props.combatCountries || []).filter(Boolean))

/**
 * 计算：任务已选卫星类型中可用于系列查询的类型。
 * 返回：仅包含「侦察」「通信」的字符串数组。
 * 作用：与后端系列字段对齐，过滤系列分组与接口请求类型。
 */
const seriesQueryTargetTypes = computed(() =>
  (props.targetTypes || []).filter((type) => type === '侦察' || type === '通信')
)

/**
 * 比较两个字符串列表是否语义相同（去空、排序后逐项相等）。
 *
 * @param a 列表 a
 * @param b 列表 b
 */
const areStringListsEqual = (a: readonly string[], b: readonly string[]): boolean => {
  const na = [...a].map((s) => s.trim()).filter(Boolean).sort((x, y) => x.localeCompare(y, 'zh-CN'))
  const nb = [...b].map((s) => s.trim()).filter(Boolean).sort((x, y) => x.localeCompare(y, 'zh-CN'))
  if (na.length !== nb.length) return false
  return na.every((value, index) => value === nb[index])
}

/**
 * 计算：类型筛选下拉的可选项。
 * 返回：卫星页为 `satTypes`；无 CRUD 时为配置静态选项；否则从候选池去重排序的类型列表。
 * 作用：驱动「类型」筛选与表格过滤条件。
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

/**
 * 计算：当前关键字与类型筛选后的待选资源条数。
 * 返回：条数的字符串形式。
 * 作用：待选表标题或统计区展示候选总量。
 */
const candidateTotalText = computed(() => String(filteredCandidates.value.length))

/** 懒加载树 props：系列为叶子 */
const satelliteTreeLazyProps = {
  label: 'label',
  children: 'children',
  isLeaf: (data: SatelliteAssembleTreeNode) => data.nodeType === 'series',
}

/**
 * 在 Worker 完整树中查找节点。
 *
 * @param nodeId 节点 id
 */
const findBuiltAssembleNodeById = (nodeId: string): SatelliteAssembleTreeNode | undefined => {
  let found: SatelliteAssembleTreeNode | undefined
  const walk = (list: SatelliteAssembleTreeNode[]) => {
    for (const node of list) {
      if (node.id === nodeId) {
        found = node
        return
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(satelliteTreeBuiltRoots.value)
  return found
}



/**
 * 从 Worker 完整树收集某节点下全部系列 id。
 *
 * @param nodeId 国家 / 体系 / 系列节点 id
 */
const collectSeriesIdsUnderBuiltNode = (nodeId: string): string[] => {
  const root = findBuiltAssembleNodeById(nodeId)
  if (!root) return []
  const ids: string[] = []
  const walk = (node: SatelliteAssembleTreeNode) => {
    if (node.nodeType === 'series') {
      ids.push(node.id)
      return
    }
    node.children?.forEach(walk)
  }
  walk(root)
  return ids
}

/**
 * 解析当前应视为「全选」的系列 id（含懒加载未展开的父节点勾选）。
 *
 * @param tree ElTree 实例
 */
const resolveFullyCheckedSeriesIdsFromTree = (tree: InstanceType<typeof ElTree>): Set<string> => {
  const seriesIds = new Set(
    (tree.getCheckedNodes(true) as SatelliteAssembleTreeNode[])
      .filter((node) => node.nodeType === 'series')
      .map((node) => node.id),
  )
  for (const node of tree.getCheckedNodes(false) as SatelliteAssembleTreeNode[]) {
    if (node.nodeType !== 'country' && node.nodeType !== 'system') continue
    const storeNode = tree.getNode(node.id)
    if (!storeNode?.checked || storeNode.indeterminate) continue
    collectSeriesIdsUnderBuiltNode(node.id).forEach((id) => seriesIds.add(id))
  }
  return seriesIds
}

/**
 * el-tree 懒加载：国家 → 体系 → 系列；不预加载 search 卫星。
 */
const loadSatelliteTreeLazyNode = (
  node: { level: number; data: SatelliteAssembleTreeNode },
  resolve: (children: SatelliteAssembleTreeNode[]) => void,
) => {
  if (node.level === 0) {
    resolve(
      satelliteTreeBuiltRoots.value.map((country) => ({
        ...country,
        children: undefined,
      })),
    )
    void nextTick(() => refreshMountedTreeEchoCheckStates())
    return
  }
  const data = node.data
  const full = findBuiltAssembleNodeById(data.id)
  if (!full?.children?.length) {
    resolve([])
    return
  }
  if (data.nodeType === 'system') {
    const seriesNodes = full.children.map((item) => ({ ...item, children: undefined }))
    resolve(seriesNodes)
    void nextTick(() => refreshMountedTreeEchoCheckStates())
    return
  }
  const childNodes = full.children.map((item) => ({
    ...item,
    children: undefined,
  }))
  resolve(childNodes)
  void nextTick(() => refreshMountedTreeEchoCheckStates())
}

/**
 * 创建空白地面站表单。
 * @returns 默认地面站信息对象
 */
const createEmptyStationForm = (): GroundStationFormModel => ({
  name: '',
  code: '',
  country: '',
  longitude: 0,
  latitude: 0,
  altitude: 0,
  description: '',
})

/** 地面站/数据中心编辑表单。 */
const stationForm = reactive<GroundStationFormModel>(createEmptyStationForm())

/** 地面站/数据中心表单校验规则。 */
const stationRules = reactive<FormRules<GroundStationFormModel>>({
  name: { required: true, message: '请输入名称', trigger: 'blur' },
  code: { required: true, message: '请输入站号编码', trigger: 'blur' },
  country: { required: true, message: '请选择所属国家/地区', trigger: 'change' },
  longitude: { required: true, message: '请输入经度', trigger: 'blur', type: 'number' },
  latitude: { required: true, message: '请输入纬度', trigger: 'blur', type: 'number' },
  altitude: { required: true, message: '请输入高度', trigger: 'blur', type: 'number' },
  description: { required: true, message: '请输入描述', trigger: 'blur' },
})

/**
 * 计算：地面站/数据中心编辑弹窗标题。
 * 返回：表单含 `_id` 时为「修改资源」，否则为「添加资源」。
 * 作用：区分新增与编辑模式的弹窗标题展示。
 */
const stationDialogTitle = computed(() => (stationForm.id ? '修改资源' : '添加资源'))

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

/**
 * 计算：武器编辑弹窗标题。
 * 返回：表单含 `id` 时为「修改武器」，否则为「添加武器」。
 * 作用：区分武器新增与编辑时的弹窗标题。
 */
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
 * 将地面站信息映射为装配表格行。
 * @param station 地面站原始数据
 */
const stationToRow = (station: GroundStation): TaskAssembleRow => {
  const id = String(station.id)
  stationRawMap[id] = station
  return {
    id,
    name: station.name,
    series: '',
    type: station.code,
    country: station.country,
    extra1: formatCoordinateDisplay(station.longitude),
    extra2: formatCoordinateDisplay(station.latitude),
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
 * 计算：候选池中未装配且匹配关键字与类型筛选的行。
 * 返回：经 `typeFilter` 与 `keyword` 过滤后的 `TaskAssembleRow` 数组（卫星与非卫星逻辑一致）。
 * 作用：作为待选表与下游展示/计数的数据源。
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

/**
 * 计算：已选卫星表格行（本地关键字过滤）。
 * 返回：`TaskAssembleRow[]`。
 * 作用：展示任务将提交的卫星挂载列表。
 */
const displayAssembledSatelliteRows = computed(() => {
  const key = keyword.value.trim().toLowerCase()
  const rows = assembledRows.value
  if (!key) return rows
  return rows.filter((row) => buildRowSearchText(row).includes(key))
})

/**
 * 清空卫星系列勾选与预览。
 */
const clearSatelliteAssemblyState = () => {
  assembledSeriesIds.value = new Set()
  assembledTaskSatellites.value = []
  assembledRows.value = []
  previewFocusSeries.value = ''
  satelliteTableSeriesFilter.value = ''
  candidatePool.satellite = []
  satelliteTreeBuiltRoots.value = []
  satelliteTreeLazyReady.value = false
  seriesCheckStateByNodeId.value = new Map()
  seriesInventoryFromApiByScopeKey.value = {}
  satelliteDisplayMetaByResourceId.value = new Map()
  trackedFullyCheckedSeriesIds.value = new Set()
  satelliteTreeLastBuildContext.value = null
  satelliteTreeExpandedKeys.value = []
  clearSeriesSatelliteCache()
  satelliteTreeRef.value?.setCheckedKeys([], false)
}

/**
 * 合并 Worker 与 Store 树快照，用于任务卫星反向归属查询。
 */
const layoutStore = useLayoutStore()

/**
 * 合并 Worker / Store 树快照，用于任务卫星反向归属（仅扫任务相关系列）。
 */
const resolveSatelliteEchoInventorySnapshot = (): Record<string, TaskResourceItem[]> => ({
  ...buildTaskScopedInventoryFromApiTreeRoots(
    layoutStore.satelliteAssembleTreeRootsCache,
    assembledTaskSatellites.value,
  ),
  ...seriesInventoryFromApiByScopeKey.value,
})

/**
 * 从树快照反查任务卫星的国家 / 体系 / 系列并写入展示元数据。
 */
const hydrateSatelliteDisplayMetaFromInventory = () => {
  if (!assembledTaskSatellites.value.length) {
    satelliteDisplayMetaByResourceId.value = new Map()
    return
  }
  satelliteDisplayMetaByResourceId.value = buildTaskSatelliteDisplayMetaFromInventory(
    assembledTaskSatellites.value,
    resolveSatelliteEchoInventorySnapshot(),
  )
}

/**
 * 生成装配树节点 id（与 `satelliteResourceTree` 建树规则一致）。
 */
const buildAssembleTreeEchoNodeId = (
  nodeType: 'country' | 'system',
  parts: string[],
): string => [nodeType, ...parts].join('::')

/**
 * 根据子系列 Worker 勾选态汇总 country / system 在树上的展示态。
 *
 * @param nodeId 国家 / 体系节点 id
 */
const computeAggregateCheckStateForBuiltNode = (nodeId: string): AssembleSeriesCheckState => {
  const seriesIds = collectSeriesIdsUnderBuiltNode(nodeId)
  if (!seriesIds.length) return 'none'
  const states = seriesIds.map((id) => seriesCheckStateByNodeId.value.get(id) ?? 'none')
  if (states.every((state) => state === 'all')) return 'all'
  if (states.every((state) => state === 'none')) return 'none'
  return 'partial'
}

/**
 * 收集应回写到树上的勾选条目（系列 + 已挂载的 country / system 汇总态）。
 */
const collectEchoCheckStateEntries = (): AssembleSeriesCheckStateEntry[] => {
  const entries: AssembleSeriesCheckStateEntry[] = []
  const pushed = new Set<string>()
  const pushEntry = (id: string, state: AssembleSeriesCheckState) => {
    if (state === 'none' || pushed.has(id)) return
    pushed.add(id)
    entries.push({ id, state })
  }
  for (const [seriesId, state] of seriesCheckStateByNodeId.value) {
    pushEntry(seriesId, state)
  }
  const walk = (nodes: SatelliteAssembleTreeNode[]) => {
    for (const node of nodes) {
      if (node.nodeType === 'country' || node.nodeType === 'system') {
        pushEntry(node.id, computeAggregateCheckStateForBuiltNode(node.id))
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(satelliteTreeBuiltRoots.value)
  return entries
}

/**
 * 将回显勾选态写入当前已挂载节点（懒加载未展开的系列节点之后于展开时再写）。
 */
const refreshMountedTreeEchoCheckStates = () => {
  const tree = satelliteTreeRef.value
  if (!tree) return
  const entries = collectEchoCheckStateEntries().filter((entry) => Boolean(tree.getNode(entry.id)))
  if (!entries.length) return
  syncingTreeCheck.value = true
  try {
    applyElTreeSeriesCheckStates(tree, entries)
    trackedFullyCheckedSeriesIds.value = new Set(
      [...seriesCheckStateByNodeId.value.entries()]
        .filter(([, state]) => state === 'all')
        .map(([id]) => id),
    )
  } finally {
    syncingTreeCheck.value = false
  }
}

/**
 * 展开回显路径后等待系列叶子挂载到 ElTree store。
 */
const waitForLazyEchoSeriesNodes = async () => {
  const tree = satelliteTreeRef.value
  if (!tree) return
  const targetSeriesIds = [...seriesCheckStateByNodeId.value.entries()]
    .filter(([, state]) => state !== 'none')
    .map(([id]) => id)
  if (!targetSeriesIds.length) return
  for (let round = 0; round < 40; round += 1) {
    await nextTick()
    const pending = targetSeriesIds.filter((id) => !tree.getNode(id))
    if (!pending.length) return
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

/**
 * 根据系列勾选态收集需展开的 country / system 节点 id。
 */
const collectSatelliteTreeEchoExpandedKeys = (): string[] => {
  const keys = new Set<string>()
  for (const [seriesNodeId, state] of seriesCheckStateByNodeId.value) {
    if (state === 'none') continue
    const node = findBuiltAssembleNodeById(seriesNodeId)
    if (!node || node.nodeType !== 'series' || !node.country?.trim()) continue
    const country = node.country.trim()
    keys.add(buildAssembleTreeEchoNodeId('country', [country]))
    const system = node.system?.trim()
    if (system) keys.add(buildAssembleTreeEchoNodeId('system', [country, system]))
  }
  return [...keys]
}

/**
 * 树加载或任务卫星变更后：回填列表元数据、展开路径并回写系列勾选态。
 */
const applyTaskSatelliteTreeEcho = async () => {
  if (!isSatelliteKind.value || !satelliteTreeLazyReady.value) return
  hydrateSatelliteDisplayMetaFromInventory()
  syncAssembledRowsFromTaskSatellites()
  satelliteTreeExpandedKeys.value = collectSatelliteTreeEchoExpandedKeys()
  await nextTick()
  refreshMountedTreeEchoCheckStates()
  await waitForLazyEchoSeriesNodes()
  refreshMountedTreeEchoCheckStates()
}

/**
 * 登记系列下卫星的展示元数据。
 *
 * @param scope 系列
 * @param items 卫星挂载项
 */
const registerSeriesSatelliteDisplayMeta = (scope: SatelliteSeriesScope, items: TaskResourceItem[]) => {
  const next = new Map(satelliteDisplayMetaByResourceId.value)
  items.forEach((item) => {
    next.set(item.resourceId, {
      ...scope,
      name: item.name,
      code: item.code,
    })
  })
  satelliteDisplayMetaByResourceId.value = next
}

/**
 * 由 `assembledTaskSatellites` 同步展示行。
 */
const syncAssembledRowsFromTaskSatellites = () => {
  if (!isSatelliteKind.value) return
  assembledRows.value = assembledTaskSatellites.value.map((item) => {
    const meta = satelliteDisplayMetaByResourceId.value.get(item.resourceId)
    return {
      id: item.resourceId,
      name: item.name || meta?.name || item.resourceId,
      series: meta?.series || '--',
      type: '--',
      country: meta?.country || '--',
      extra1: meta?.system || '--',
      extra2: item.code || meta?.code || '--',
    }
  })
}

/**
 * 在装配树中按 node id 查找系列节点数据。
 *
 * @param seriesNodeId 系列节点 id
 */
const findSeriesAssembleNodeById = (seriesNodeId: string): SatelliteAssembleTreeNode | undefined => {
  let found: SatelliteAssembleTreeNode | undefined
  const walk = (list: SatelliteAssembleTreeNode[]) => {
    for (const node of list) {
      if (node.id === seriesNodeId && node.nodeType === 'series') {
        found = node
        return
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(satelliteTreeBuiltRoots.value)
  return found
}

/**
 * 取消系列勾选时：用 Worker/API 树快照或 Store 树缓存，不调用 search。
 *
 * @param scope 系列
 */
const resolveSeriesSatellitesForRemoval = (scope: SatelliteSeriesScope): TaskResourceItem[] => {
  const scopeKey = buildSeriesScopeCacheKey(scope)
  const fromApi = seriesInventoryFromApiByScopeKey.value[scopeKey]
  if (fromApi?.length) return fromApi.map((item) => ({ ...item }))
  return getSeriesTaskSatellitesFromPanelTreeCache(scope)
}

/**
 * 按当前已选卫星在 Worker 中重算系列勾选态并回写 el-tree（不重建树根数据）。
 *
 * @param taskSatellites 任务已选卫星快照
 */
const refreshAssembleSeriesCheckStatesViaWorker = async (taskSatellites: TaskResourceItem[]) => {
  const ctx = satelliteTreeLastBuildContext.value
  if (!ctx) return
  const { seriesCheckStates, seriesInventory } = await buildSatelliteAssembleTreeInBackground(
    ctx.roots,
    ctx.systems,
    taskSatellites,
  )
  seriesInventoryFromApiByScopeKey.value = seriesInventory
  const checkMap = new Map<string, AssembleSeriesCheckState>()
  seriesCheckStates.forEach((entry: AssembleSeriesCheckStateEntry) => {
    checkMap.set(entry.id, entry.state)
  })
  seriesCheckStateByNodeId.value = checkMap
  await nextTick()
  const tree = satelliteTreeRef.value
  if (tree && seriesCheckStates.length) {
    applyElTreeSeriesCheckStates(tree, seriesCheckStates)
  }
}

/**
 * 树勾选变化：系列叶子全选时按 search 拉取卫星；取消全选时从任务卫星列表移除该系列。
 */
const handleSatelliteTreeCheck = async () => {
  if (
    syncingTreeCheck.value ||
    satelliteTreeLoading.value ||
    satelliteTreeCheckLoading.value ||
    !satelliteTreeRef.value
  ) {
    return
  }
  const tree = satelliteTreeRef.value
  const checkedSeriesIds = resolveFullyCheckedSeriesIdsFromTree(tree)
  const prev = trackedFullyCheckedSeriesIds.value
  const added = [...checkedSeriesIds].filter((id) => !prev.has(id))
  const removed = [...prev].filter((id) => !checkedSeriesIds.has(id))
  if (!added.length && !removed.length) return

  syncingTreeCheck.value = true
  satelliteTreeCheckLoading.value = true
  try {
    let nextTaskSatellites = assembledTaskSatellites.value.map((item) => ({ ...item }))
    for (const seriesId of added) {
      const node = findSeriesAssembleNodeById(seriesId)
      const scope = node ? resolveSeriesScopeFromAssembleNode(node) : null
      if (!scope) continue
      const seriesSatellites = await fetchSeriesTaskSatellites(scope)
      registerSeriesSatelliteDisplayMeta(scope, seriesSatellites)
      nextTaskSatellites = mergeSeriesSatellitesIntoTaskList(nextTaskSatellites, seriesSatellites)
    }
    for (const seriesId of removed) {
      const node = findSeriesAssembleNodeById(seriesId)
      const scope = node ? resolveSeriesScopeFromAssembleNode(node) : null
      if (!scope) continue
      const seriesSatellites = resolveSeriesSatellitesForRemoval(scope)
      nextTaskSatellites = removeSeriesSatellitesFromTaskList(nextTaskSatellites, seriesSatellites)
    }
    assembledTaskSatellites.value = nextTaskSatellites
    trackedFullyCheckedSeriesIds.value = checkedSeriesIds
    await refreshAssembleSeriesCheckStatesViaWorker(nextTaskSatellites)
    syncAssembledRowsFromTaskSatellites()
  } catch (error) {
    console.error('处理卫星树勾选失败:', error)
    ElMessage.error('加载系列卫星失败，请稍后重试')
  } finally {
    satelliteTreeCheckLoading.value = false
    syncingTreeCheck.value = false
  }
}

/**
 * 按国家与任务卫星类型加载资源树。
 */
const loadSatelliteTree = async (options?: { forceRefresh?: boolean }) => {
  if (!isSatelliteKind.value) return
  const countries = seriesQueryCountries.value
  const systems = seriesQueryTargetTypes.value
  syncAssembledRowsFromTaskSatellites()
  if (!countries.length || !systems.length) {
    satelliteTreeBuiltRoots.value = []
    satelliteTreeLazyReady.value = false
    satelliteDisplayMetaByResourceId.value = new Map()
    return
  }
  const loadGeneration = ++satelliteTreeLoadGeneration
  satelliteTreeLoading.value = true
  satelliteTreeLazyReady.value = false
  try {
    let treeRoots: Awaited<ReturnType<typeof loadSatelliteResourceTreeRootsForPanel>>
    try {
      treeRoots = await loadSatelliteResourceTreeRootsForPanel(countries, options)
    } catch {
      satelliteTreeBuiltRoots.value = []
      satelliteTreeLazyReady.value = false
      satelliteDisplayMetaByResourceId.value = new Map()
      return
    }
    if (loadGeneration !== satelliteTreeLoadGeneration) return
    clearSeriesSatelliteCache()
    trackedFullyCheckedSeriesIds.value = new Set()
    const taskSnapshot = assembledTaskSatellites.value.map((item) => ({ ...item }))
    const { nodes, seriesCheckStates, seriesInventory } = await buildSatelliteAssembleTreeInBackground(
      treeRoots,
      systems,
      taskSnapshot,
      (partialNodes) => {
        if (loadGeneration !== satelliteTreeLoadGeneration) return
        satelliteTreeBuiltRoots.value = partialNodes
        if (partialNodes.length) satelliteTreeLazyReady.value = true
      },
    )
    if (loadGeneration !== satelliteTreeLoadGeneration) return
    satelliteTreeBuiltRoots.value = nodes
    satelliteTreeLastBuildContext.value = { roots: treeRoots, systems }
    seriesInventoryFromApiByScopeKey.value = seriesInventory
    const checkMap = new Map<string, AssembleSeriesCheckState>()
    seriesCheckStates.forEach((entry: AssembleSeriesCheckStateEntry) => {
      checkMap.set(entry.id, entry.state)
    })
    seriesCheckStateByNodeId.value = checkMap
    trackedFullyCheckedSeriesIds.value = new Set(
      seriesCheckStates.filter((item) => item.state === 'all').map((item) => item.id),
    )
    satelliteTreeLazyReady.value = nodes.length > 0
    await nextTick()
    if (loadGeneration !== satelliteTreeLoadGeneration) return
    await applyTaskSatelliteTreeEcho()
  } catch (error) {
    if (loadGeneration !== satelliteTreeLoadGeneration) return
    console.error('加载卫星资源树失败:', error)
    satelliteTreeBuiltRoots.value = []
    satelliteTreeLazyReady.value = false
    satelliteDisplayMetaByResourceId.value = new Map()
    ElMessage.error('加载卫星资源树失败')
  } finally {
    if (loadGeneration === satelliteTreeLoadGeneration) {
      satelliteTreeLoading.value = false
    }
  }
}

/**
 * 设置已装配卫星（编辑任务回显）。
 *
 * @param items 任务 `satellites`
 */
const setAssembledTaskSatellites = (items: TaskResourceItem[]) => {
  assembledTaskSatellites.value = items.map((item) => ({ ...item }))
  syncAssembledRowsFromTaskSatellites()
  void (async () => {
    hydrateSatelliteDisplayMetaFromInventory()
    syncAssembledRowsFromTaskSatellites()
    if (!satelliteTreeLazyReady.value || !satelliteTreeLastBuildContext.value) return
    await refreshAssembleSeriesCheckStatesViaWorker(assembledTaskSatellites.value)
    await applyTaskSatelliteTreeEcho()
  })()
}

/**
 * 获取将提交至任务的卫星挂载列表。
 */
const getAssembledTaskSatellites = (): TaskResourceItem[] =>
  assembledTaskSatellites.value.map((item) => ({ ...item }))

/**
 * 计算：左侧待选表绑定的行数据。
 * 返回：与 `filteredCandidates` 相同的数组引用结果。
 * 作用：非卫星种类待选 `el-table` 的数据源。
 */
const displayCandidates = computed(() => filteredCandidates.value)





/**
 * 从接口加载地面站或数据中心候选列表。
 */
const loadStationCandidates = async () => {
  const res = await getGroundStationList({ status: 1 })
  const filtered = res.code === 200 ? (res.data ?? []).filter((item) => item.status === 1) : []
  Object.keys(stationRawMap).forEach((key) => delete stationRawMap[key])
  const rows = filtered.map(stationToRow)
  candidatePool.station = rows
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
  const pools = props.kind === 'station' ? candidatePool.station : candidatePool.weapon
  pools.forEach((row) => poolById.set(row.id, row))
  assembledRows.value = assembledRows.value.map((row) => {
    const matched = poolById.get(row.id)
    return matched ? { ...matched } : row
  })
}


/**
 * 工具栏刷新：卫星页可强制拉取最新树缓存。
 */
const handleRefreshToolbar = () => {
  void loadCandidatePool(isSatelliteKind.value)
}

/**
 * 按当前种类加载候选资源池。
 *
 * @param forceTreeRefresh 卫星页为 true 时跳过 Store 树缓存
 */
const loadCandidatePool = async (forceTreeRefresh = false) => {
  if (isSatelliteKind.value) {
    await loadSatelliteTree(forceTreeRefresh ? { forceRefresh: true } : undefined)
    return
  }
  if (!crudEnabled.value) return
  listLoading.value = true
  try {
    if (isStationKind.value) {
      await loadStationCandidates()
    }
    enrichAssembledFromPool()
    if (!isSatelliteKind.value) {
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
      const res = stationForm.id
        ? await updateGroundStation({ ...stationForm, id: stationForm.id })
        : await createGroundStation({ ...stationForm })
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
  if (!stationForm.id) return
  await ElMessageBox.confirm(`确定删除「${stationForm.name}」吗？`, '提示', { type: 'warning' })
  deleting.value = true
  try {
    const res = await deleteGroundStation(stationForm.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      stationDialogVisible.value = false
      assembledRows.value = assembledRows.value.filter((row) => row.id !== String(stationForm.id))
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
 * 监听：`props.resetKey`（任务编辑弹窗每次打开递增）。
 * 返回：回调不返回清理函数。
 * 作用：重置筛选、系列、勾选与候选池，并在需要时重新加载列表。
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

/**
 * 监听：装配页种类 `props.kind` 变化。
 * 返回：回调不返回清理函数。
 * 作用：种类切换且接口可用时重新拉取对应候选资源池。
 */
watch(
  () => props.kind,
  () => {
    if (apiEnabled.value) {
      loadCandidatePool()
    }
  }
)

/**
 * 监听：卫星系列查询用的蓝方国家列表 `seriesQueryCountries`（含深度变更）。
 * 返回：回调不返回清理函数。
 * 作用：卫星页国家变化时清空装配/预览并重新加载系列选项。
 */
watch(
  seriesQueryCountries,
  async (next, prev) => {
    if (!isSatelliteKind.value) return
    if (prev !== undefined && areStringListsEqual(next, prev)) return
    clearSatelliteAssemblyState()
    await loadSatelliteTree()
  },
  { deep: true }
)

/**
 * 监听：参与系列过滤的任务卫星类型 `seriesQueryTargetTypes`（含深度变更）。
 * 返回：回调不返回清理函数。
 * 作用：类型变化时清空卫星装配并重新加载资源树（按体系过滤）；内容未变时不重置已选卫星。
 */
watch(
  seriesQueryTargetTypes,
  async (next, prev) => {
    if (!isSatelliteKind.value) return
    if (prev !== undefined && areStringListsEqual(next, prev)) return
    clearSatelliteAssemblyState()
    await loadSatelliteTree()
  },
  { deep: true }
)

onMounted(async () => {
  if (isSatelliteKind.value) {
    const initial = props.initialTaskSatellites
    if (initial?.length) {
      assembledTaskSatellites.value = initial.map((item) => ({ ...item }))
      syncAssembledRowsFromTaskSatellites()
    }
    await loadSatelliteTree()
    return
  }
  if (crudEnabled.value) {
    await loadCandidatePool()
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
const getAssembledSeries = (): string[] => {
  if (!isSatelliteKind.value) {
    return assembledRows.value.map((row) => row.series || row.name).filter(Boolean)
  }
  const series = new Set<string>()
  for (const item of assembledTaskSatellites.value) {
    const meta = satelliteDisplayMetaByResourceId.value.get(item.resourceId)
    if (meta?.series) series.add(meta.series)
  }
  return [...series].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

/**
 * 回显已装配资源行（编辑任务时由弹窗调用）。
 *
 * @param rows 已装配资源列表
 */
const setAssembledRows = (rows: TaskAssembleRow[]) => {
  if (isSatelliteKind.value) {
    if (!rows.length) {
      setAssembledTaskSatellites([])
      return
    }
    const items: TaskResourceItem[] = rows.map((row) => ({
      resourceId: row.id,
      name: row.name || row.id,
      code: row.extra2 && row.extra2 !== '--' ? row.extra2 : row.series || row.id,
    }))
    setAssembledTaskSatellites(items)
    return
  }
  assembledRows.value = rows.map((row) => ({ ...row }))
  enrichAssembledFromPool()
  void restoreDirectAssemblySelection()
}

defineExpose({
  getAssembledRows,
  getAssembledSeries,
  getAssembledTaskSatellites,
  setAssembledRows,
  setAssembledTaskSatellites,
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
  padding-bottom: 0;
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

.assemble-satellite-body--tree {
  flex-direction: row;
  align-items: stretch;
  gap: 10px;
  flex: 1;
  min-height: 0;
}

.satellite-tree-pane {
  flex: 0 0 clamp(200px, 26%, 280px);
  max-width: 300px;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.satellite-list-pane {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.satellite-tree-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px 6px;
  box-sizing: border-box;
}

.satellite-resource-tree {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  background: transparent;
  color: #e2efff;
  @include battleUi.battle-ui-el-tree-typography;

  :deep(.atlas-app-tree) {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  :deep(.atlas-app-tree-node__content) {
    min-width: 0;
    overflow: hidden;
  }

  :deep(.atlas-app-tree-node__label) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
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

.assemble-pane-body--satellite-list {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.assemble-table--satellite-preview {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 100%;
  @include battleUi.battle-ui-c2-panel-table-fit;

  :deep(.atlas-app-table),
  :deep(.atlas-app-table__inner-wrapper) {
    height: 100% !important;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-table__body-wrapper) {
    overflow-y: auto !important;
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

/** 卫星树：覆盖通用 pane-body 的 hidden，内容超出时仅竖向滚动 */
.assemble-pane-body.satellite-tree-body {
  overflow-x: hidden;
  overflow-y: auto;
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
