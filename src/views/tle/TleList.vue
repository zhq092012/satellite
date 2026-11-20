<template>
  <div class="container">
    <section class="panel-card toolbar-card">
      <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
        <el-form-item label="关键字">
          <el-input v-model="queryForm.keyword" clearable placeholder="NORAD / 名称" class="keyword-input" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
        <div class="toolbar-actions">
          <el-button type="primary" plain @click="importVisible = true">TLE 批量导入</el-button>
          <el-button @click="loadTleList" :loading="loading">刷新</el-button>
        </div>
      </el-form>
    </section>

    <section class="panel-card table-card">
      <div class="table-fill">
        <el-table :data="pagedRows" v-loading="loading" stripe border height="100%">
          <el-table-column prop="noradId" label="NORAD" width="120" />
          <el-table-column prop="line1" label="TLE Line 1" min-width="240" show-overflow-tooltip />
          <el-table-column prop="line2" label="TLE Line 2" min-width="240" show-overflow-tooltip />
          <el-table-column prop="createTime" label="创建时间" width="170" show-overflow-tooltip />
          <el-table-column prop="updateTime" label="更新时间" width="170" show-overflow-tooltip />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="scope">
              <el-button link type="primary" @click="openDetail(scope.row.noradId)">详情</el-button>
              <el-button link type="danger" @click="handleDelete(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="pager">
        <el-pagination
          v-model:current-page="page.pageNum"
          v-model:page-size="page.pageSize"
          :total="totalElements"
          layout="total, prev, pager, next, sizes"
          :page-sizes="[10, 20, 50, 100]"
        />
      </div>
    </section>

    <el-dialog v-model="detailVisible" title="TLE 详情" width="640px" destroy-on-close append-to-body>
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="记录 ID">{{ detail.id || '--' }}</el-descriptions-item>
        <el-descriptions-item label="NORAD">{{ detail.noradId }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createTime || '--' }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ detail.updateTime || '--' }}</el-descriptions-item>
        <el-descriptions-item label="Line 1">
          <code class="tle-line">{{ detail.line1 }}</code>
        </el-descriptions-item>
        <el-descriptions-item label="Line 2">
          <code class="tle-line">{{ detail.line2 }}</code>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <TleImportDialog v-model:visible="importVisible" @success="onImportSuccess" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TleImportDialog from '@/components/satellite/TleImportDialog.vue'
import {
  deleteTleResourceByNoradId,
  getTleResourceByNoradId,
  getTleResourceList,
} from '@/api/tle/tle'
import type { TleResource } from '@/types/tle/tle'
import { isResourceApiSuccess } from '@/utils/resourceApi'

const loading = ref(false)
const importVisible = ref(false)
const detailVisible = ref(false)
const detail = ref<TleResource | null>(null)
const rows = ref<TleResource[]>([])

const queryForm = reactive({
  keyword: '',
})

const page = reactive({ pageNum: 1, pageSize: 10 })

/**
 * 计算：当前页列表数据。
 * 返回：内存分页切片。
 * 作用：表格绑定数据源。
 */
const pagedRows = computed(() => {
  const start = (page.pageNum - 1) * page.pageSize
  return rows.value.slice(start, start + page.pageSize)
})

/**
 * 计算：列表总条数。
 * 返回：数组长度。
 * 作用：分页 total。
 */
const totalElements = computed(() => rows.value.length)

async function loadTleList() {
  loading.value = true
  try {
    const res = await getTleResourceList({
      keyword: queryForm.keyword.trim() || undefined,
    })
    rows.value = isResourceApiSuccess(res.code) ? (res.data ?? []) : []
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.pageNum = 1
  void loadTleList()
}

function resetQuery() {
  queryForm.keyword = ''
  page.pageNum = 1
  void loadTleList()
}

function onImportSuccess() {
  void loadTleList()
}

async function openDetail(noradId: string) {
  const res = await getTleResourceByNoradId(noradId)
  if (isResourceApiSuccess(res.code) && res.data) {
    detail.value = res.data
    detailVisible.value = true
  }
}

async function handleDelete(row: TleResource) {
  await ElMessageBox.confirm(`确定删除 NORAD ${row.noradId} 的 TLE 吗？`, '提示', { type: 'warning' })
  const res = await deleteTleResourceByNoradId(row.noradId)
  if (isResourceApiSuccess(res.code)) {
    ElMessage.success('删除成功')
    await loadTleList()
  }
}

onMounted(() => {
  void loadTleList()
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
  width: 220px;
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

.tle-line {
  display: block;
  word-break: break-all;
  font-size: 12px;
}

@media (max-width: 1200px) {
  .toolbar-actions {
    width: 100%;
    margin-left: 0;
  }
}
</style>