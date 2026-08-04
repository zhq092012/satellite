<template>
  <div class="weapon-manage-page">
    <section class="hero-card">
      <div>
        <p class="hero-card__eyebrow">系统管理 / 武器管理</p>
        <h1>武器资源管理</h1>
        <p class="hero-card__desc">
          统一维护武器基础数据，支持新增、编辑、删除与条件筛选。
          <!-- 页面权限由 `system:weapon:list`、
          `system:weapon:add`、`system:weapon:edit`、`system:weapon:delete` 控制。 -->
        </p>
      </div>
      <div class="hero-card__stats">
        <div class="stat-card">
          <span>武器总数</span>
          <strong>{{ totalCount }}</strong>
        </div>
        <div class="stat-card">
          <span>当前筛选</span>
          <strong>{{ filteredCount }}</strong>
        </div>
        <div class="stat-card">
          <span>国家/地区</span>
          <strong>{{ countryCount }}</strong>
        </div>
      </div>
    </section>

    <section class="panel-card toolbar-card">
      <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
        <el-form-item label="武器名称">
          <el-input v-model="queryForm.keyword" clearable placeholder="模糊搜索名称" />
        </el-form-item>
        <el-form-item label="所属国家/地区">
          <el-select v-model="queryForm.country" clearable placeholder="全部" style="width: 180px">
            <el-option v-for="item in countries" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="武器类型">
          <el-input v-model="queryForm.type" clearable placeholder="例如 导弹/火炮" />
        </el-form-item>
        <el-form-item label="适用卫星类型">
          <el-input v-model="queryForm.satellite_type" clearable placeholder="例如 低轨通信卫星" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <div class="toolbar-actions">
          <el-button type="primary" plain @click="openCreateDialog">新增武器</el-button>
          <el-button @click="loadWeapons" :loading="loading">刷新</el-button>
        </div>
      </el-form>
    </section>

    <section class="panel-card table-card">
      <el-table :data="displayWeapons" v-loading="loading" stripe border height="calc(100vh - 362px)">
        <el-table-column prop="name" label="武器名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="country" label="所属国家/地区" min-width="160" />
        <el-table-column prop="type" label="武器类型" min-width="150" show-overflow-tooltip />
        <el-table-column prop="satellite_type" label="适用卫星类型" min-width="160" show-overflow-tooltip />
        <el-table-column prop="longitude" label="经度" width="110" />
        <el-table-column prop="latitude" label="纬度" width="110" />
        <el-table-column prop="range" label="打击高度(km)" width="130" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="openEditDialog(scope.row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="page.current"
          v-model:page-size="page.size"
          :total="filteredCount"
          layout="total, prev, pager, next, sizes"
          :page-sizes="[10, 20, 50, 100]"
        />
      </div>
    </section>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="680px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="武器名称" prop="name">
              <el-input v-model.trim="form.name" placeholder="请输入武器名称" />
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
            <el-form-item label="武器类型" prop="type">
              <el-input v-model.trim="form.type" placeholder="请输入武器类型" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用卫星类型" prop="satellite_type">
              <el-input v-model.trim="form.satellite_type" placeholder="请输入适用卫星类型" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="打击高度(km)" prop="range">
              <el-input-number v-model.number="form.range" :min="0" :controls="true" class="full-width-number" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="经度" prop="longitude">
              <el-input-number
                v-model.number="form.longitude"
                :min="-180"
                :max="180"
                :controls="true"
                class="full-width-number"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="纬度" prop="latitude">
              <el-input-number
                v-model.number="form.latitude"
                :min="-90"
                :max="90"
                :controls="true"
                class="full-width-number"
              />
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
import { createWeapon, deleteWeapon, getAllWeapons, getBattleCountrys, updateWeapon } from '@/api/dashboard'
import { useAuthStore } from '@/store/modules/auth'
import { hasPermission } from '@/utils/permission'

const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const weapons = ref<Weapon[]>([])
const countries = ref<string[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()

// [变量用途]
// 保存武器筛选表单的检索条件，包括关键词、所属国家/地区、武器类型以及适用卫星类型。
//
// [数据来源]
// 用户在界面顶部搜索栏中输入的过滤参数。
//
// [取值规则]
// 各属性默认为空字符串。
//
// [修改约束]
// 修改时请保持与过滤匹配逻辑 (filteredWeapons) 同步。
const queryForm = reactive({
  keyword: '',
  country: '',
  type: '',
  satellite_type: '',
})

const page = reactive({
  current: 1,
  size: 10,
})

/**
 * 创建空白武器表单对象。
 *
 * @returns 包含默认初始值的 Weapon 实体对象
 */
const createEmptyForm = (): Weapon => ({
  name: '',
  country: '',
  type: '',
  latitude: 0,
  longitude: 0,
  range: 0,
  satellite_type: '',
})

// [变量用途]
// 武器新增/编辑对话框中的响应式表单数据实体。
//
// [数据来源]
// 新增时来自 createEmptyForm，编辑时来自表格行对象深拷贝。
//
// [修改约束]
// 提交保存前需先通过 formRef 校验。
const form = reactive<Weapon>(createEmptyForm())

const rules = reactive<FormRules<Weapon>>({
  name: { required: true, message: '请输入武器名称', trigger: 'blur' },
  country: { required: true, message: '请选择所属国家/地区', trigger: 'change' },
  type: { required: true, message: '请输入武器类型', trigger: 'blur' },
  range: { required: true, message: '请输入正确的打击高度', trigger: 'blur', type: 'number', min: 0 },
  longitude: { required: true, message: '请输入正确的经度', trigger: 'blur', type: 'number', min: -180, max: 180 },
  latitude: { required: true, message: '请输入正确的纬度', trigger: 'blur', type: 'number', min: -90, max: 90 },
})

// const canCreate = computed(() => hasPermission(authStore.permissions, ['system:weapon:add']))
// const canEdit = computed(() => hasPermission(authStore.permissions, ['system:weapon:edit']))
// const canDelete = computed(() => hasPermission(authStore.permissions, ['system:weapon:delete']))

const totalCount = computed(() => weapons.value.length)
const countryCount = computed(() => new Set(weapons.value.map((item) => item.country).filter(Boolean)).size)

/**
 * 根据多条件组合过滤武器列表。
 *
 * 支持匹配：
 * - 武器名称模糊匹配 (keyword)
 * - 所属国家全等匹配 (country)
 * - 武器类型模糊匹配 (type)
 * - 适用卫星类型模糊匹配 (satellite_type)
 */
const filteredWeapons = computed(() => {
  const keyword = queryForm.keyword.trim().toLowerCase()
  const country = queryForm.country.trim()
  const type = queryForm.type.trim().toLowerCase()
  const satelliteType = queryForm.satellite_type.trim().toLowerCase()

  return weapons.value.filter((weapon) => {
    const matchesKeyword = !keyword || weapon.name.toLowerCase().includes(keyword)
    const matchesCountry = !country || weapon.country === country
    const matchesType = !type || weapon.type.toLowerCase().includes(type)
    const matchesSatelliteType =
      !satelliteType || (weapon.satellite_type && weapon.satellite_type.toLowerCase().includes(satelliteType))
    return matchesKeyword && matchesCountry && matchesType && matchesSatelliteType
  })
})

const filteredCount = computed(() => filteredWeapons.value.length)

const displayWeapons = computed(() => {
  const start = (page.current - 1) * page.size
  return filteredWeapons.value.slice(start, start + page.size)
})

const dialogTitle = computed(() => (form.id ? '编辑武器' : '新增武器'))

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

async function loadWeapons() {
  loading.value = true
  try {
    const res = await getAllWeapons()
    weapons.value = res.code === 200 ? (res.data?.weapons ?? []) : []
    page.current = 1
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.current = 1
}

/**
 * 重置查询条件并重新从第一页开始显示。
 */
function resetQuery() {
  queryForm.keyword = ''
  queryForm.country = ''
  queryForm.type = ''
  queryForm.satellite_type = ''
  page.current = 1
}

/**
 * 打开新增武器对话框并重置表单对象。
 */
function openCreateDialog() {
  Object.assign(form, createEmptyForm())
  dialogVisible.value = true
}

/**
 * 打开编辑武器对话框并将当前行数据填充至表单对象。
 *
 * @param row 当前选中的武器记录
 */
function openEditDialog(row: Weapon) {
  Object.assign(form, { ...row })
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
      const payload = { ...form }
      const response = form.id ? await updateWeapon(payload) : await createWeapon(payload)

      if (response.code === 200) {
        ElMessage.success(`${dialogTitle.value}成功`)
        dialogVisible.value = false
        await loadWeapons()
      }
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: Weapon) {
  await ElMessageBox.confirm(`确定删除武器「${row.name}」吗？`, '提示', { type: 'warning' })
  const response = await deleteWeapon(row.id!)
  if (response.code === 200) {
    ElMessage.success('删除成功')
    await loadWeapons()
  }
}

onMounted(async () => {
  await Promise.all([loadWeapons(), loadCountries()])
})
</script>

<style scoped lang="scss">
.weapon-manage-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(79, 147, 221, 0.2), transparent 24%),
    radial-gradient(circle at right center, rgba(30, 79, 132, 0.18), transparent 26%), var(--app-bg-gradient);
}

.panel-card,
.hero-card {
  border: 1px solid var(--surface-border-color);
  border-radius: 24px;
  background: linear-gradient(180deg, var(--surface-bg-color-soft) 0%, var(--surface-bg-color) 100%);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.hero-card {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 24px;
  padding: 26px 28px;
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
  grid-template-columns: repeat(3, minmax(110px, 1fr));
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
