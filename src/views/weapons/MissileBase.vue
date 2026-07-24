<template>
  <div class="container">
    <section class="hero-card">
      <div>
        <p class="hero-card__eyebrow">系统管理 / 导弹基地管理</p>
        <h1>导弹基地管理</h1>
        <p class="hero-card__desc">
          统一维护导弹基地基础数据，支持新增、编辑、删除与条件筛选。
          <!-- 页面权限由 `system:missileBases:list`、
          `system:missileBases:add`、`system:missileBases:edit`、`system:missileBases:delete` 控制。 -->
        </p>
      </div>
      <div class="hero-card__stats">
        <div class="stat-card">
          <span>导弹总数</span>
          <strong>{{ totalElements }}</strong>
        </div>
        <div class="stat-card">
          <span>国家/地区</span>
          <strong>{{ countryCount }}</strong>
        </div>
      </div>
    </section>
    <section class="panel-card toolbar-card">
      <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
        <el-form-item label="导弹基地名称">
          <el-input v-model="queryForm.name" clearable placeholder="模糊搜索名称" />
        </el-form-item>

        <el-form-item label="国家/地区">
          <el-input v-model="queryForm.country" clearable placeholder="输入国家/地区" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <div class="toolbar-actions">
          <el-button type="primary" plain @click="openCreateDialog">新增导弹基地</el-button>
          <el-button @click="loadMissileBases" :loading="loading">刷新</el-button>
        </div>
      </el-form>
    </section>

    <section class="panel-card table-card">
      <el-table :data="missileBases" v-loading="loading" stripe border height="calc(100vh - 362px)">
        <el-table-column prop="name" label="导弹基地名称" />
        <el-table-column prop="country" label="所属国家/地区" />
        <el-table-column prop="latLon" label="经纬度" />

        <el-table-column label="部署导弹">
          <template #default="{ row }">
            <div v-for="missle in row.deployMissiles" :key="missle._id">{{ missle.missileName }}</div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page.pageNum"
          v-model:page-size="page.pageSize"
          :total="totalElements"
          @current-change="loadMissileBases"
          @size-change="loadMissileBases"
          layout="total, prev, pager, next, sizes"
          :page-sizes="[10, 20, 50, 100]"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="680px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="导弹基地名称" prop="name">
              <el-input v-model.trim="form.name" placeholder="请输入导弹基地名称" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属国家/地区" prop="country">
              <el-select
                v-model="form.country"
                filterable
                placeholder="请选择国家/地区"
                class="full-width"
                @change="getMissilePageListByCountry(form.country)"
              >
                <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经纬度" prop="latLon">
              <el-input v-model.trim="form.latLon" placeholder="请输入经纬度，格式：lat,lon" />
            </el-form-item>
          </el-col>
          <!-- 选择导弹基地下部署的导弹 -->
          <el-col :span="12">
            <el-form-item label="部署导弹" prop="deployMissiles">
              <el-select
                v-model="form.deployMissiles"
                multiple
                filterable
                placeholder="请选择部署的导弹"
                class="full-width"
              >
                <el-option
                  v-for="missile in missiles"
                  :key="missile._id"
                  :label="missile.missileName"
                  :value="missile._id"
                />
              </el-select>
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
import { getBattleCountrys } from '@/api/dashboard'
import {
  deleteMissileBases,
  getMissileBaseList,
  getMissileList,
  saveOrUpdateMissileBase,
  type MissileBaseInfo,
  type MissileInfo,
} from '@/api/system/satellite-system-api'
const loading = ref(false)
const saving = ref(false)
const missileBases = ref<MissileBaseInfo[]>([])
const missiles = ref<MissileInfo[]>([])
const countries = ref<string[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

const queryForm = reactive({
  name: '',
  country: '',
})

const page = reactive({
  pageNum: 1,
  pageSize: 10,
})

type MissileBaseForm = Omit<MissileBaseInfo, 'deployMissiles'> & {
  deployMissiles: string[]
}

const createEmptyForm = (): MissileBaseForm => ({
  name: '',
  country: '',
  latLon: '',
  deployMissiles: [],
})

const form = reactive<MissileBaseForm>(createEmptyForm())

const rules = reactive<FormRules<MissileBaseInfo>>({})

// const canCreate = computed(() => hasPermission(authStore.permissions, ['system:weapon:add']))
// const canEdit = computed(() => hasPermission(authStore.permissions, ['system:weapon:edit']))
// const canDelete = computed(() => hasPermission(authStore.permissions, ['system:weapon:delete']))

const countryCount = computed(() => new Set(missileBases.value.map((item) => item.country).filter(Boolean)).size)

const dialogTitle = computed(() => (form._id ? '编辑导弹基地' : '新增导弹基地'))

async function loadCountries() {
  try {
    const res = await getBattleCountrys()
    if (res.code === 200) {
      countries.value = res.data ?? []
    }
  } catch {
    countries.value = []
  }
}

const getMissilePageListByCountry = async (country: string) => {
  try {
    const res = await getMissileList({ pageNum: 1, pageSize: 1000, country })
    missiles.value = res.code === 200 ? (res.data.content ?? []) : []
  } catch {
    missiles.value = []
  }
}

const totalElements = ref(0)
async function loadMissileBases() {
  loading.value = true
  try {
    const res = await getMissileBaseList({
      pageNum: page.pageNum,
      pageSize: page.pageSize,
      name: queryForm.name,
      country: queryForm.country,
    })
    missileBases.value = res.code === 200 ? (res.data?.content ?? []) : []
    totalElements.value = res.code === 200 ? (res.data?.totalElements ?? 0) : 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.pageNum = 1
  loadMissileBases()
}

function resetQuery() {
  ;(queryForm.name = ''), (queryForm.country = '')
  page.pageNum = 1
  loadMissileBases()
}

function resetform() {
  form._id = undefined
  form.name = ''
  form.country = ''
  form.latLon = ''
  form.deployMissiles = []
}

function openCreateDialog() {
  // 先清空form
  resetform()
  Object.assign(form, createEmptyForm())
  dialogVisible.value = true
}

async function openEditDialog(row: MissileBaseInfo) {
  Object.assign(form, {
    _id: row._id,
    name: row.name,
    country: row.country,
    latLon: row.latLon,
    deployMissiles: row.deployMissiles.map((item) => item._id),
  })
  await getMissilePageListByCountry(row.country)
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
      const payload: MissileBaseInfo = {
        _id: form._id,
        name: form.name,
        country: form.country,
        latLon: form.latLon,
        deployMissiles: form.deployMissiles.map((id) => ({
          _id: id,
          missileName: missiles.value.find((missile) => missile._id === id)?.missileName ?? '',
        })),
      }
      const response = await saveOrUpdateMissileBase(payload)

      if (response.code === 200) {
        ElMessage.success(`${dialogTitle.value}成功`)
        dialogVisible.value = false
        await loadMissileBases()
      }
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: MissileBaseInfo) {
  await ElMessageBox.confirm(`确定删除导弹基地「${row.name}」吗？`, '提示', { type: 'warning' })
  const response = await deleteMissileBases([row._id!])
  if (response.code === 200) {
    ElMessage.success('删除成功')
    await loadMissileBases()
  }
}

onMounted(async () => {
  await Promise.all([loadMissileBases(), loadCountries()])
})
</script>

<style scoped lang="scss">
.container {
  padding: 16px;
  border-radius: 8px;
}
.hero-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px;
  border: 1px solid var(--surface-border-color);
  border-radius: 24px;
  background: linear-gradient(180deg, var(--surface-bg-color-soft) 0%, var(--surface-bg-color) 100%);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.hero-card__eyebrow {
  display: inline-flex;
  margin: 0 0 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(79, 147, 221, 0.18);
  color: var(--accent-color-active);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.hero-card h1 {
  margin: 0;
  color: var(--text-color-strong);
  font-size: 38px;
  line-height: 1.1;
  font-weight: 800;
}

.hero-card__desc {
  max-width: 900px;
  margin: 14px 0 0;
  color: var(--text-color-secondary);
  line-height: 1.8;
}

.hero-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(110px, 1fr));
  gap: 12px;
  align-self: center;
}

.stat-card {
  min-width: 130px;
  padding: 16px 18px;
  border: 1px solid var(--surface-border-color);
  border-radius: 18px;
  background: linear-gradient(180deg, var(--surface-bg-color-soft), var(--surface-bg-color));
}

.stat-card span {
  display: block;
  margin-bottom: 10px;
  color: var(--text-color-secondary);
  font-size: 13px;
}

.stat-card strong {
  color: var(--text-color-strong);
  font-size: 24px;
  font-weight: 800;
}

.toolbar-card,
.table-card {
  padding: 18px 20px;
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
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.table-card :deep(.el-table) {
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

.table-card :deep(.el-table th.el-table__cell) {
  color: var(--accent-color-active);
  font-size: 13px;
  font-weight: 800;
}

.table-card :deep(.el-table td.el-table__cell) {
  color: var(--text-color-primary);
  background: var(--surface-bg-color);
}

.table-card :deep(.el-table__empty-block) {
  background: var(--surface-bg-color);
}

.pager {
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
  .hero-card {
    flex-direction: column;
  }

  .hero-card__stats {
    grid-template-columns: repeat(3, minmax(110px, 1fr));
  }

  .toolbar-actions {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .weapon-manage-page {
    padding: 12px;
  }

  .hero-card {
    padding: 20px 18px;
  }

  .hero-card h1 {
    font-size: 30px;
  }

  .hero-card__stats {
    grid-template-columns: 1fr;
  }
}
</style>
