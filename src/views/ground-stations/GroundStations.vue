<template>
  <div class="container">
    <section class="panel-card toolbar-card">
      <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
        <el-form-item label="关键字">
          <el-input v-model="queryForm.keyword" clearable placeholder="站点名称 / 站号编码" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryForm.status" clearable placeholder="全部" class="status-select">
            <el-option label="正常" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <div class="toolbar-actions">
          <el-button type="primary" plain @click="openCreateDialog">新增地面站</el-button>
          <el-button @click="loadStations" :loading="loading">刷新</el-button>
        </div>
      </el-form>
    </section>

    <section class="panel-card table-card">
      <div class="table-fill">
        <el-table :data="stations" v-loading="loading" stripe border height="100%">
          <el-table-column prop="name" label="站点名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="code" label="站号编码" width="120" show-overflow-tooltip />
          <el-table-column prop="country" label="所属国家/地区" width="160" show-overflow-tooltip />
          <el-table-column label="经度" width="110" align="right">
            <template #default="scope">
              {{ formatCoordinate(scope.row.longitude) }}
            </template>
          </el-table-column>
          <el-table-column label="纬度" width="110" align="right">
            <template #default="scope">
              {{ formatCoordinate(scope.row.latitude) }}
            </template>
          </el-table-column>
          <el-table-column label="高度(m)" width="100" align="right">
            <template #default="scope">
              {{ formatAltitude(scope.row.altitude) }}
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column label="状态" width="120" align="center" fixed="right">
            <template #default="scope">
              <el-switch :model-value="scope.row.status" :active-value="1" :inactive-value="0"
                :loading="statusUpdatingId === scope.row.id" inline-prompt active-text="正常" inactive-text="停用"
                @change="(value: GroundStationStatus) => handleStatusChange(scope.row, value)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
              <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div class="pager">
        <el-pagination v-model:current-page="page.pageNum" v-model:page-size="page.pageSize" :total="totalElements"
          @current-change="loadStations" @size-change="loadStations" layout="total, prev, pager, next, sizes"
          :page-sizes="[10, 20, 50, 100]" />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="750px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="160px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="站点名称" prop="name">
              <el-input v-model.trim="form.name" placeholder="请输入站点名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="站号编码" prop="code">
              <el-input v-model.trim="form.code" placeholder="例如 KS-01" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属国家/地区" prop="country">
              <el-select v-model="form.country" filterable placeholder="请选择国家/地区" class="full-width">
                <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="高度(m)" prop="altitude">
              <el-input-number v-model="form.altitude" :controls="true" class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude">
              <el-input-number v-model="form.longitude" :precision="6" :step="0.001" :min="-180" :max="180"
                class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude">
              <el-input-number v-model="form.latitude" :precision="6" :step="0.001" :min="-90" :max="90"
                class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="描述" prop="description">
              <el-input type="textarea" :rows="4" v-model.trim="form.description" placeholder="请输入描述" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { GROUND_STATION_COUNTRY_OPTIONS } from '@/constants/groundStationCountries'
import {
  createGroundStation,
  deleteGroundStation,
  getGroundStationList,
  updateGroundStation,
  updateGroundStationStatus,
} from '@/api/ground-station/ground-station'
import type {
  GroundStation,
  GroundStationStatus,
  GroundStationUpsertPayload,
} from '@/types/ground-station/groundstation'

/** 新增/编辑弹窗表单（不含列表只读字段 status、id 由单独逻辑维护）。 */
type GroundStationFormModel = GroundStationUpsertPayload & { id?: number }

const loading = ref(false)
const saving = ref(false)
const statusUpdatingId = ref<number | null>(null)
const stations = ref<GroundStation[]>([])
/** 所属国家/地区下拉：见 `GROUND_STATION_COUNTRY_OPTIONS`（后期改字典）。 */
const countries = GROUND_STATION_COUNTRY_OPTIONS
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const totalElements = ref(0)

const queryForm = reactive<{
  /** 匹配站点名称、站号编码 */
  keyword: string
  status: GroundStationStatus | undefined
}>({
  keyword: '',
  status: undefined,
})

const page = reactive({
  pageNum: 1,
  pageSize: 10,
})

/**
 * 将经度或纬度格式化为保留三位小数的展示文本。
 *
 * @param value 坐标数值
 * @returns 三位小数文本；无效时为 `--`
 */
const formatCoordinate = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return value.toFixed(3)
}

/**
 * 格式化高度展示。
 *
 * @param value 高度（米）
 * @returns 整数或一位小数文本
 */
const formatAltitude = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const createEmptyForm = (): GroundStationFormModel => ({
  name: '',
  code: '',
  country: '',
  longitude: 0,
  latitude: 0,
  altitude: 0,
  description: '',
})

const form = reactive<GroundStationFormModel>(createEmptyForm())

const rules = reactive<FormRules<GroundStationFormModel>>({
  name: { required: true, message: '请输入站点名称', trigger: 'blur' },
  code: { required: true, message: '请输入站号编码', trigger: 'blur' },
  country: { required: true, message: '请选择所属国家/地区', trigger: 'change' },
  longitude: { required: true, message: '请输入经度', trigger: 'blur', type: 'number' },
  latitude: { required: true, message: '请输入纬度', trigger: 'blur', type: 'number' },
})

/**
 * 计算：地面站新增/编辑弹窗标题。
 * 返回：有 `id` 时为「编辑地面站」，否则为「新增地面站」。
 * 作用：弹窗标题区分新增与编辑。
 */
const dialogTitle = computed(() => (form.id ? '编辑地面站' : '新增地面站'))

async function loadStations() {
  loading.value = true
  try {
    const res = await getGroundStationList({
      keyword: queryForm.keyword || undefined,
      status: queryForm.status,
    })
    const list = res.code === 200 ? (res.data ?? []) : []
    totalElements.value = list.length
    const start = (page.pageNum - 1) * page.pageSize
    stations.value = list.slice(start, start + page.pageSize)
  } finally {
    loading.value = false
  }
}

async function handleStatusChange(row: GroundStation, status: GroundStationStatus) {
  const previous = row.status
  row.status = status
  statusUpdatingId.value = row.id
  try {
    const res = await updateGroundStationStatus(row.id, status)
    if (res.code !== 200) {
      row.status = previous
    } else {
      ElMessage.success(status === 1 ? '已启用' : '已停用')
    }
  } catch {
    row.status = previous
  } finally {
    statusUpdatingId.value = null
  }
}

function handleSearch() {
  page.pageNum = 1
  void loadStations()
}

function resetQuery() {
  queryForm.keyword = ''
  queryForm.status = undefined
  page.pageNum = 1
  void loadStations()
}

function openCreateDialog() {
  Object.assign(form, createEmptyForm())
  dialogVisible.value = true
}

function openEditDialog(row: GroundStation) {
  const { status: _status, ...rest } = row
  Object.assign(form, { ...rest })
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
}

async function submitForm() {
  if (!formRef.value) {
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      return
    }

    saving.value = true
    try {
      const response = form.id
        ? await updateGroundStation({ ...form, id: form.id })
        : await createGroundStation({ ...form })

      if (response.code === 200) {
        ElMessage.success(`${dialogTitle.value}成功`)
        dialogVisible.value = false
        await loadStations()
      }
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: GroundStation) {
  await ElMessageBox.confirm(`确定删除地面站「${row.name}」吗？`, '提示', { type: 'warning' })
  const response = await deleteGroundStation(row.id)
  if (response.code === 200) {
    ElMessage.success('删除成功')
    await loadStations()
  }
}

onMounted(() => {
  void loadStations()
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

.status-select {
  width: 120px;
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

.pager {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
}

.full-width {
  width: 100%;
}

.full-width-number {
  width: 100%;
}

@media (max-width: 1200px) {
  .toolbar-actions {
    width: 100%;
    margin-left: 0;
  }
}
</style>