<template>
  <div class="container">
    <section class="panel-card toolbar-card">
      <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
        <el-form-item label="查询方式">
          <el-radio-group v-model="queryMode" @change="handleQueryModeChange">
            <el-radio-button value="keyword">关键字</el-radio-button>
            <el-radio-button value="filter">国家/体系/系列</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="queryMode === 'keyword'" label="关键字">
          <el-input v-model="queryForm.keyword" clearable placeholder="NORAD / 代号 / 名称" class="keyword-input" />
        </el-form-item>
        <template v-if="queryMode === 'filter'">
          <el-form-item label="国家/地区">
            <el-select v-model="queryForm.country" clearable filterable placeholder="全部" class="query-select"
              @change="handleCountryChangeForSeries">
              <el-option v-for="item in countryOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="卫星体系">
            <el-select v-model="queryForm.system" clearable filterable placeholder="全部" class="query-select">
              <el-option v-for="item in systemOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="卫星系列">
            <el-select v-model="queryForm.series" clearable filterable placeholder="全部" class="query-select-series"
              :loading="seriesLoading">
              <el-option v-for="item in seriesOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
        </template>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <div class="toolbar-actions">
          <el-button type="primary" plain @click="openCreateDialog">新增卫星</el-button>
          <el-button @click="satelliteImportVisible = true">卫星批量导入</el-button>
          <el-button @click="loadSatellites" :loading="loading">刷新</el-button>
        </div>
      </el-form>
    </section>

    <section class="panel-card table-card">
      <div class="table-fill">
        <el-table :data="pagedSatellites" v-loading="loading" stripe border height="100%">
          <el-table-column prop="noradId" label="NORAD" width="110" />
          <el-table-column prop="code" label="卫星代号" width="120" show-overflow-tooltip />
          <el-table-column prop="nameEn" label="英文名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="nameCn" label="中文名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="intlDesignator" label="国际编号" width="120" show-overflow-tooltip />
          <el-table-column prop="country" label="国家/地区" width="110" show-overflow-tooltip />
          <el-table-column prop="system" label="卫星体系" width="100" show-overflow-tooltip />
          <el-table-column prop="series" label="卫星系列" width="120" show-overflow-tooltip />
          <el-table-column prop="usage" label="用途" width="90" show-overflow-tooltip />
          <el-table-column prop="launchDate" label="发射时间" width="160" show-overflow-tooltip />
          <!-- <el-table-column prop="updateTime" label="更新时间" width="160" show-overflow-tooltip /> -->
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click="handleViewDetail(scope.row)">详情</el-button>
              <el-button link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
              <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pager">
        <el-pagination v-model:current-page="page.pageNum" v-model:page-size="page.pageSize" :total="totalElements"
          layout="total, prev, pager, next, sizes" :page-sizes="[10, 20, 50, 100]" />
      </div>
    </section>

    <SatelliteResourceImportDialog v-model:visible="satelliteImportVisible" @success="loadSatellites" />

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px" destroy-on-close append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="NORAD" prop="noradId">
              <el-input v-model.trim="form.noradId" placeholder="关联 TLE" :disabled="Boolean(form.id)" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="卫星代号" prop="code">
              <el-input v-model.trim="form.code" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="国际编号" prop="intlDesignator">
              <el-input v-model.trim="form.intlDesignator" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="英文名称" prop="nameEn">
              <el-input v-model.trim="form.nameEn" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="中文名称" prop="nameCn">
              <el-input v-model.trim="form.nameCn" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="国家/地区" prop="country">
              <el-select v-model="form.country" filterable class="full-width" @change="loadFormSeriesOptions">
                <el-option v-for="item in countryOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="卫星体系" prop="system">
              <el-select v-model="form.system" class="full-width">
                <el-option v-for="item in systemOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="卫星系列" prop="series">
              <el-select v-model="form.series" filterable allow-create class="full-width" :loading="formSeriesLoading">
                <el-option v-for="item in formSeriesOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="用途" prop="usage">
              <el-select v-model="form.usage" class="full-width">
                <el-option v-for="item in usageOptions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发射时间" prop="launchDate">
              <el-input v-model.trim="form.launchDate" placeholder="yyyy-MM-dd" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import SatelliteResourceImportDialog from '@/components/satellite/SatelliteResourceImportDialog.vue'
import {
  createSatelliteResource,
  deleteSatelliteResource,
  getSatelliteResourceList,
  fetchSatelliteSeriesNamesByCountry,
  searchSatelliteResources,
  updateSatelliteResource,
} from '@/api/satellite/satellite'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { SATELLITE_USAGE_TYPES, TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import type { SatelliteResource, SatelliteResourceUpsertPayload } from '@/types/satellite/satellite'
import { isResourceApiSuccess } from '@/utils/resourceApi'
import { parseNoradIdNumber } from '@/utils/satelliteResource'

type SatelliteFormModel = SatelliteResourceUpsertPayload

/**
 * 列表页查询方式：与 OpenAPI 两条接口一一对应。
 * - keyword → GET /resource/satellite/list（仅 keyword）
 * - filter → GET /resource/satellite/search（country / system / series）
 */
type SatelliteListQueryMode = 'keyword' | 'filter'

/** 卫星体系选项（与 OpenAPI 体系字段一致） */
const systemOptions = ['侦察', '通信', '中继'] as const

const { openSatelliteProfile } = useSatelliteProfileDialog()

const satelliteImportVisible = ref(false)
const loading = ref(false)
const saving = ref(false)
const seriesLoading = ref(false)
const formSeriesLoading = ref(false)
const satellites = ref<SatelliteResource[]>([])
const seriesOptions = ref<string[]>([])
const formSeriesOptions = ref<string[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const countryOptions = [...TASK_ENEMY_COUNTRY_OPTIONS]
const usageOptions = [...SATELLITE_USAGE_TYPES]

/** 当前查询方式，决定展示哪些表单项并调用 list 或 search。 */
const queryMode = ref<SatelliteListQueryMode>('keyword')

const queryForm = reactive<{
  keyword: string
  country: string
  system: string
  series: string
}>({
  keyword: '',
  country: '',
  system: '',
  series: '',
})

const page = reactive({ pageNum: 1, pageSize: 10 })

/**
 * 计算：当前页表格数据。
 * 返回：在内存中对检索结果切片后的列表。
 * 作用：服务端未分页时前端分页展示。
 */
const pagedSatellites = computed(() => {
  const start = (page.pageNum - 1) * page.pageSize
  return satellites.value.slice(start, start + page.pageSize)
})

/**
 * 计算：检索结果总数。
 * 返回：卫星列表长度。
 * 作用：分页组件 total。
 */
const totalElements = computed(() => satellites.value.length)

const createEmptyForm = (): SatelliteFormModel => ({
  noradId: '',
  code: '',
  intlDesignator: '',
  nameEn: '',
  nameCn: '',
  country: '',
  system: '侦察',
  series: '',
  usage: '军用',
  launchDate: '',
})

const form = reactive<SatelliteFormModel>(createEmptyForm())

const rules = reactive<FormRules<SatelliteFormModel>>({
  noradId: { required: true, message: '请输入 NORAD', trigger: 'blur' },
  country: { required: true, message: '请选择国家', trigger: 'change' },
  system: { required: true, message: '请选择体系', trigger: 'change' },
  series: { required: true, message: '请选择或输入系列', trigger: 'change' },
})

/**
 * 计算：卫星新增/编辑弹窗标题。
 * 返回：有 `id` 时为「编辑卫星」，否则为「新增卫星」。
 * 作用：弹窗标题区分新增与编辑。
 */
const dialogTitle = computed(() => (form.id ? '编辑卫星' : '新增卫星'))

async function fetchSeriesNames(country: string): Promise<string[]> {
  if (!country.trim()) return []
  try {
    return await fetchSatelliteSeriesNamesByCountry(country)
  } catch (error) {
    console.error('按国家加载系列失败', country, error)
    ElMessage.error(error instanceof Error ? error.message : '加载卫星系列失败')
    return []
  }
}

async function handleCountryChangeForSeries() {
  seriesLoading.value = true
  try {
    seriesOptions.value = await fetchSeriesNames(queryForm.country)
    if (queryForm.series && !seriesOptions.value.includes(queryForm.series)) {
      queryForm.series = ''
    }
  } finally {
    seriesLoading.value = false
  }
}

async function loadFormSeriesOptions() {
  formSeriesLoading.value = true
  try {
    formSeriesOptions.value = await fetchSeriesNames(form.country ?? '')
  } finally {
    formSeriesLoading.value = false
  }
}

async function loadSatellites() {
  loading.value = true
  try {
    const res =
      queryMode.value === 'filter'
        ? await searchSatelliteResources({
          country: queryForm.country || undefined,
          system: queryForm.system || undefined,
          series: queryForm.series || undefined,
        })
        : await getSatelliteResourceList({
          keyword: queryForm.keyword.trim() || undefined,
        })
    satellites.value = isResourceApiSuccess(res.code) ? (res.data ?? []) : []
  } finally {
    loading.value = false
  }
}

function handleQueryModeChange() {
  queryForm.keyword = ''
  queryForm.country = ''
  queryForm.system = ''
  queryForm.series = ''
  seriesOptions.value = []
  page.pageNum = 1
  void loadSatellites()
}

function handleSearch() {
  page.pageNum = 1
  void loadSatellites()
}

function resetQuery() {
  if (queryMode.value === 'keyword') {
    queryForm.keyword = ''
  } else {
    queryForm.country = ''
    queryForm.system = ''
    queryForm.series = ''
    seriesOptions.value = []
  }
  page.pageNum = 1
  void loadSatellites()
}

function openCreateDialog() {
  Object.assign(form, createEmptyForm())
  formSeriesOptions.value = []
  dialogVisible.value = true
}

function openEditDialog(row: SatelliteResource) {
  Object.assign(form, { ...row })
  void loadFormSeriesOptions()
  dialogVisible.value = true
}

async function submitForm() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (!form.id && !form.noradId.trim()) {
      ElMessage.warning('NORAD 不能为空')
      return
    }
    saving.value = true
    try {
      const res = form.id
        ? await updateSatelliteResource({ ...form, id: form.id })
        : await createSatelliteResource({ ...form })
      if (isResourceApiSuccess(res.code)) {
        ElMessage.success(`${dialogTitle.value}成功`)
        dialogVisible.value = false
        await loadSatellites()
      }
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: SatelliteResource) {
  if (!row.id) {
    ElMessage.error('缺少记录 id，无法删除')
    return
  }
  await ElMessageBox.confirm(
    `确定删除卫星「${row.nameEn || row.noradId}」吗？`,
    '提示',
    { type: 'warning' },
  )
  const res = await deleteSatelliteResource(row.id)
  if (isResourceApiSuccess(res.code)) {
    ElMessage.success('删除成功')
    await loadSatellites()
  }
}

function handleViewDetail(row: SatelliteResource) {
  const norad = parseNoradIdNumber(row.noradId)
  if (!norad) return
  openSatelliteProfile(norad)
}

/**
 * 监听：查询条件中国家/地区变化。
 * 回调不返回清理函数。
 * 作用：清空国家时重置系列下拉。
 */
watch(
  () => queryForm.country,
  (country) => {
    if (!country) {
      seriesOptions.value = []
    }
  },
)

onMounted(() => {
  void loadSatellites()
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
  box-sizing: border-box;
}

.panel-card {
  border: 1px solid var(--surface-border-color);
  border-radius: 16px;
  background: var(--surface-bg-color);
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

.keyword-input {
  width: 200px;
}

.query-select {
  width: 140px;
}

.query-select-series {
  width: 180px;
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
  min-height: 0;
  overflow: hidden;
}

.pager {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
}

.full-width {
  width: 100%;
}

@media (max-width: 1200px) {
  .toolbar-actions {
    width: 100%;
    margin-left: 0;
  }
}
</style>