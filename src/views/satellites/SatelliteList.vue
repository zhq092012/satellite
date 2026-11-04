<template>
  <div class="container">
    <section class="panel-card toolbar-card">
      <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
        <el-form-item label="NORAD">
          <el-input v-model="queryForm.norad" clearable placeholder="请输入 NORAD" style="width: 160px" />
        </el-form-item>
        <el-form-item label="卫星名称">
          <el-input v-model="queryForm.name_en" clearable placeholder="请输入英文名称" style="width: 180px" />
        </el-form-item>
        <el-form-item label="国家/地区">
          <el-select v-model="queryForm.country" clearable filterable placeholder="全部" style="width: 160px">
            <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="卫星类型">
          <el-select v-model="queryForm.sat_type" clearable filterable placeholder="载荷/平台类型" style="width: 160px">
            <el-option v-for="item in satTypes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="任务系统类型">
          <el-select v-model="queryForm.mission_sys_type" clearable placeholder="全部" style="width: 140px"
            :disabled="!catalogExtendedFieldsAvailable">
            <el-option v-for="item in missionSysTypeOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="卫星系列">
          <el-input v-model="queryForm.series_name" clearable placeholder="系列名称" style="width: 140px"
            :disabled="!catalogExtendedFieldsAvailable" />
        </el-form-item>
        <el-form-item label="卫星用途">
          <el-select v-model="queryForm.usage" clearable placeholder="全部" style="width: 120px"
            :disabled="!catalogExtendedFieldsAvailable">
            <el-option v-for="item in usageTypeOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="轨道类型">
          <el-select v-model="queryForm.orbit_type" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in orbitTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="轨道状态">
          <el-select v-model="queryForm.orbit_status" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in orbitStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="载荷状态">
          <el-select v-model="queryForm.payload_status" clearable placeholder="全部" style="width: 140px">
            <el-option v-for="item in payloadStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <div class="toolbar-actions">
          <el-button @click="loadSatellites" :loading="loading">刷新</el-button>
        </div>
      </el-form>
    </section>

    <section class="panel-card table-card">
      <div class="table-fill">
      <el-table :data="satellites" v-loading="loading" stripe border height="100%">
        <el-table-column prop="norad" label="NORAD" width="110" />
        <el-table-column prop="name_en" label="英文名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="name_cn" label="中文名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="int_id" label="国际编号" width="130" show-overflow-tooltip />
        <el-table-column prop="country" label="国家/地区" min-width="120" show-overflow-tooltip />
        <el-table-column prop="sat_type" label="载荷类型" min-width="120" show-overflow-tooltip />
        <el-table-column label="任务系统类型" width="110" show-overflow-tooltip>
          <template #default="scope">{{ formatMissionSysType(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="卫星系列" width="120" show-overflow-tooltip>
          <template #default="scope">{{ formatSeriesName(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="卫星用途" width="100" show-overflow-tooltip>
          <template #default="scope">{{ formatUsage(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="轨道类型" width="110">
          <template #default="scope">
            {{ getOrbitType(Number(scope.row.orbit_type)) }}
          </template>
        </el-table-column>
        <el-table-column label="轨道状态" width="110">
          <template #default="scope">
            {{ getOrbitStatus(Number(scope.row.orbit_status)) }}
          </template>
        </el-table-column>
        <el-table-column label="载荷状态" width="110">
          <template #default="scope">
            {{ getPayloadStatus(Number(scope.row.payload_status)) }}
          </template>
        </el-table-column>
        <el-table-column prop="launch_date" label="发射时间" width="130" show-overflow-tooltip />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="handleViewDetail(scope.row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>
      <p v-if="!catalogExtendedFieldsAvailable" class="catalog-field-hint">
        卫星系列、用途、任务系统类型依赖 catalog 接口扩展；当前列表无对应字段时显示为 --，筛选不可用。
      </p>
      <div class="pager">
        <el-pagination
          v-model:current-page="page.pageNum"
          v-model:page-size="page.pageSize"
          :total="totalElements"
          @current-change="loadSatellites"
          @size-change="loadSatellites"
          layout="total, prev, pager, next, sizes"
          :page-sizes="[10, 20, 50, 100]"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { getBattleCountrys, getBattleSateTypes, getSatelliteList } from '@/api/dashboard'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { getOrbitStatus, getOrbitType, getPayloadStatus } from '@/utils/tools/satellite'
import type { Satellite } from '@/types/cesium/satellite'
import { MISSION_SYS_TYPES, SATELLITE_USAGE_TYPES } from '@/constants/missionSatellite'

/** 查询表单中轨道/载荷枚举选项。 */
interface SatelliteEnumOption {
  /** 下拉展示文案。 */
  label: string
  /** 对应接口枚举值。 */
  value: number
}

/** 轨道类型筛选项，与 getOrbitType 枚举保持一致。 */
const orbitTypeOptions: SatelliteEnumOption[] = [
  { label: '未知', value: 0 },
  { label: '低轨', value: 1 },
  { label: '中轨', value: 2 },
  { label: '高轨', value: 3 },
  { label: '大椭圆', value: 4 },
]

/** 轨道状态筛选项，与 getOrbitStatus 枚举保持一致。 */
const orbitStatusOptions: SatelliteEnumOption[] = [
  { label: '未知', value: 0 },
  { label: '在轨', value: 1 },
  { label: '离轨', value: 2 },
]

/** 载荷状态筛选项，与 getPayloadStatus 枚举保持一致。 */
const payloadStatusOptions: SatelliteEnumOption[] = [
  { label: '未知', value: 0 },
  { label: '堪用', value: 1 },
  { label: '失效', value: 2 },
]

const { openSatelliteProfile } = useSatelliteProfileDialog()

/** 列表加载状态。 */
const loading = ref(false)
/** 当前页卫星列表。 */
const satellites = ref<Satellite[]>([])
/** 国家/地区下拉数据。 */
const countries = ref<string[]>([])
/** 卫星类型下拉数据。 */
const satTypes = ref<string[]>([])
/** 分页总数。 */
const totalElements = ref(0)

/**
 * 查询表头条件。空值表示不参与接口过滤。
 */
const queryForm = reactive({
  /** NORAD 编号，提交时转为数字。 */
  norad: '',
  /** 卫星英文名称。 */
  name_en: '',
  /** 国家/地区。 */
  country: '',
  /** 卫星类型。 */
  sat_type: '',
  /** 轨道类型枚举。 */
  orbit_type: undefined as number | undefined,
  /** 轨道状态枚举。 */
  orbit_status: undefined as number | undefined,
  /** 载荷状态枚举。 */
  payload_status: undefined as number | undefined,
  /** 任务系统类型（catalog 扩展，仅前端筛选） */
  mission_sys_type: '',
  /** 系列名称（catalog 扩展，仅前端筛选） */
  series_name: '',
  /** 用途（catalog 扩展，仅前端筛选） */
  usage: '',
})

const missionSysTypeOptions = [...MISSION_SYS_TYPES]
const usageTypeOptions = [...SATELLITE_USAGE_TYPES]

/** 当前页是否已有 catalog 扩展字段（有则启用扩展筛选） */
const catalogExtendedFieldsAvailable = computed(() =>
  satellites.value.some(
    (row) =>
      Boolean(row.series_name?.trim()) ||
      Boolean(row.usage?.trim()) ||
      Boolean(row.mission_sys_type?.trim()),
  ),
)

const EMPTY = '--'

/**
 * 展示任务系统类型。
 *
 * @param row 卫星行
 */
const formatMissionSysType = (row: Satellite): string => row.mission_sys_type?.trim() || EMPTY

/**
 * 展示卫星系列名。
 *
 * @param row 卫星行
 */
const formatSeriesName = (row: Satellite): string =>
  row.series_name?.trim() || row.sat_series_id?.trim() || EMPTY

/**
 * 展示卫星用途。
 *
 * @param row 卫星行
 */
const formatUsage = (row: Satellite): string => row.usage?.trim() || EMPTY

/** 分页参数。 */
const page = reactive({
  pageNum: 1,
  pageSize: 10,
})

/**
 * 将字符串查询值转换为接口可选参数。
 *
 * @param value 原始输入
 * @returns 非空字符串，空值时返回 undefined
 */
const toOptionalString = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

/**
 * 将 NORAD 输入转换为接口可选数字。
 *
 * @param value 原始输入
 * @returns 合法正整数，非法时返回 undefined
 */
const toOptionalNorad = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const norad = Number(trimmed)
  return Number.isFinite(norad) && norad > 0 ? norad : undefined
}

/**
 * 加载国家/地区筛选项。
 */
async function loadCountries() {
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
async function loadSatTypes() {
  try {
    const res = await getBattleSateTypes()
    satTypes.value = res.code === 200 ? (res.data ?? []) : []
  } catch {
    satTypes.value = []
  }
}

/**
 * 对 catalog 扩展字段做前端筛选（接口未支持时仅过滤当前页）。
 *
 * @param rows 接口返回行
 */
function applyClientCatalogFilters(rows: Satellite[]): Satellite[] {
  const mission = queryForm.mission_sys_type.trim()
  const series = queryForm.series_name.trim()
  const usage = queryForm.usage.trim()
  if (!mission && !series && !usage) return rows
  return rows.filter((row) => {
    if (mission && formatMissionSysType(row) !== mission) return false
    if (series && !formatSeriesName(row).includes(series)) return false
    if (usage && formatUsage(row) !== usage) return false
    return true
  })
}

/**
 * 按当前查询条件和分页拉取卫星列表。
 */
async function loadSatellites() {
  loading.value = true
  try {
    const res = await getSatelliteList(
      page.pageNum,
      page.pageSize,
      toOptionalNorad(queryForm.norad),
      undefined,
      toOptionalString(queryForm.name_en),
      toOptionalString(queryForm.country),
      queryForm.orbit_status,
      queryForm.orbit_type,
      queryForm.payload_status,
      toOptionalString(queryForm.sat_type)
    )
    satellites.value = res.code === 200 ? (res.data?.content ?? []) : []
    satellites.value = applyClientCatalogFilters(satellites.value)
    totalElements.value = res.code === 200 ? (res.data?.totalElements ?? 0) : 0
  } finally {
    loading.value = false
  }
}

/**
 * 按查询表头重新检索，并从第一页开始。
 */
function handleSearch() {
  page.pageNum = 1
  loadSatellites()
}

/**
 * 清空查询表头并重新加载列表。
 */
function resetQuery() {
  queryForm.norad = ''
  queryForm.name_en = ''
  queryForm.country = ''
  queryForm.sat_type = ''
  queryForm.orbit_type = undefined
  queryForm.orbit_status = undefined
  queryForm.payload_status = undefined
  queryForm.mission_sys_type = ''
  queryForm.series_name = ''
  queryForm.usage = ''
  page.pageNum = 1
  loadSatellites()
}

/**
 * 打开卫星本体详情弹窗（SatelliteProfile）。
 *
 * @param row 当前行卫星数据
 */
function handleViewDetail(row: Satellite) {
  openSatelliteProfile(row.norad)
}

onMounted(async () => {
  await Promise.all([loadSatellites(), loadCountries(), loadSatTypes()])
})
</script>

<style scoped lang="scss">
.container {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  border-radius: 8px;
  box-sizing: border-box;
}

.panel-card {
  border: 1px solid var(--surface-border-color);
  border-radius: 24px;
  background: linear-gradient(180deg, var(--surface-bg-color-soft) 0%, var(--surface-bg-color) 100%);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.toolbar-card,
.table-card {
  padding: 18px 20px;
}

.toolbar-card {
  flex-shrink: 0;
  margin-bottom: 16px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.table-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.table-fill {
  flex: 1;
  height: 0;
  min-height: 0;
  overflow: hidden;
}

.table-card :deep(.atlas-app-table) {
  --el-table-border-color: var(--surface-border-color);
  --el-table-header-bg-color: var(--surface-bg-color-strong);
  --el-table-bg-color: var(--surface-bg-color);
  --el-table-tr-bg-color: var(--surface-bg-color);
  --el-table-row-hover-bg-color: rgba(79, 147, 221, 0.18);
  --el-fill-color-lighter: rgba(79, 147, 221, 0.14);
  --el-text-color-regular: var(--text-color-primary);
  --el-text-color-primary: var(--text-color-strong);
  border-radius: 16px;
  overflow: hidden;
}

.table-card :deep(.atlas-app-table th.atlas-app-table__cell),
.table-card :deep(.atlas-app-table th.el-table__cell) {
  color: var(--accent-color-active);
  font-weight: 800;
}

.table-card :deep(.atlas-app-table td.el-table__cell) {
  color: var(--text-color-primary);
  background: var(--surface-bg-color);
}

.table-card :deep(.atlas-app-table__empty-block) {
  background: var(--surface-bg-color);
}

.pager {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1200px) {
  .toolbar-actions {
    width: 100%;
    margin-left: 0;
  }
}
.catalog-field-hint {
  margin: 8px 16px 0;
  font-size: 12px;
  color: #64748b;
}
</style>
