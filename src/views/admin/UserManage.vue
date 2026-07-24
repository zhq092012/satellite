<template>
  <div class="page-shell">
    <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
      <el-form-item label="用户名">
        <el-input v-model="queryForm.username" clearable placeholder="用户名" />
      </el-form-item>
      <el-form-item label="昵称">
        <el-input v-model="queryForm.nickname" clearable placeholder="昵称" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="queryForm.status" clearable placeholder="全部" style="width: 180px">
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="fetchList">查询</el-button>
        <el-button @click="resetQuery">重置</el-button>
      </el-form-item>
      <div class="toolbar-actions">
        <el-button type="primary" plain @click="openDialog()">新增用户</el-button>
      </div>
    </el-form>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="username" label="用户名" min-width="140" />
      <el-table-column prop="nickname" label="昵称" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column prop="phone" label="手机号" min-width="140" />
      <el-table-column label="角色" min-width="160">
        <template #default="scope">
          <el-tag v-for="role in scope.row.roles || []" :key="role.id" type="info" class="tag-gap">{{
            role.roleName
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">{{
            scope.row.status === 1 ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" min-width="180" />
      <el-table-column fixed="right" label="操作" width="240">
        <template #default="scope">
          <el-button link type="primary" @click="openDialog(scope.row)">编辑</el-button>
          <el-button link type="warning" @click="handleResetPassword(scope.row)">重置密码</el-button>
          <el-button link type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="page.total"
        layout="total, prev, pager, next, sizes"
        :page-sizes="[10, 20, 50, 100]"
        @current-change="fetchList"
        @size-change="fetchList"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="760px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="用户名" prop="username">
              <el-input v-model="form.username" :disabled="isEdit" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="昵称" prop="nickname">
              <el-input v-model="form.nickname" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱" prop="email">
              <el-input v-model="form.email" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="form.password"
                type="password"
                show-password
                :placeholder="isEdit ? '留空则不修改密码' : '请输入密码'"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" class="full-width">
                <el-option label="启用" :value="1" />
                <el-option label="禁用" :value="0" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="角色">
              <el-select v-model="form.roleIds" multiple filterable placeholder="请选择角色" class="full-width">
                <el-option v-for="role in roleOptions" :key="role.id" :label="role.roleName" :value="role.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createUser,
  deleteUser,
  getRoleList,
  getUserList,
  resetUserPassword,
  updateUser,
  type RoleListItem,
  type UserListItem,
  type UserUpsertPayload,
} from '@/api/auth'

const loading = ref(false)
const saving = ref(false)
const list = ref<UserListItem[]>([])
const roleOptions = ref<RoleListItem[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const isEdit = ref(false)

const page = reactive({
  current: 1,
  size: 10,
  total: 0,
})

const queryForm = reactive({
  username: '',
  nickname: '',
  status: undefined as number | undefined,
})

const emptyForm = () => ({
  id: 0,
  username: '',
  nickname: '',
  email: '',
  phone: '',
  password: '',
  status: 1,
  roleIds: [] as number[],
})

const form = reactive(emptyForm())

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  nickname: [{ required: true, message: '请输入昵称', trigger: 'blur' }],
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }],
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
}

const dialogTitle = computed(() => (isEdit.value ? '编辑用户' : '新增用户'))

const fetchRoles = async () => {
  const response = await getRoleList({ page: 1, size: 999, roleName: '', roleCode: '', status: undefined })
  roleOptions.value = response.data?.records ?? []
}

const fetchList = async () => {
  loading.value = true
  try {
    const response = await getUserList({
      username: queryForm.username,
      nickname: queryForm.nickname,
      status: queryForm.status as number,
      page: page.current,
      size: page.size,
    })
    list.value = response.data?.records ?? []
    page.total = response.data?.totalElements ?? response.data?.total ?? list.value.length
  } finally {
    loading.value = false
  }
}

const resetQuery = () => {
  queryForm.username = ''
  queryForm.nickname = ''
  queryForm.status = undefined
  page.current = 1
  fetchList()
}

const openDialog = (row?: UserListItem) => {
  isEdit.value = Boolean(row)
  Object.assign(form, emptyForm())

  if (row) {
    form.id = row.id
    form.username = row.username
    form.nickname = row.nickname
    form.email = row.email
    form.phone = row.phone
    form.status = row.status
    form.roleIds = (row.roles ?? []).map((role) => role.id)
  }

  dialogVisible.value = true
}

const submitForm = async () => {
  if (!formRef.value) {
    return
  }

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      return
    }

    saving.value = true
    try {
      if (isEdit.value) {
        const updatePayload = {
          id: form.id,
          username: form.username,
          nickname: form.nickname,
          email: form.email,
          phone: form.phone,
          status: form.status,
          roleIds: form.roleIds,
          ...(form.password ? { password: form.password } : {}),
        }
        await updateUser(updatePayload)
      } else {
        const createPayload: UserUpsertPayload = {
          username: form.username,
          nickname: form.nickname,
          email: form.email,
          phone: form.phone,
          password: form.password,
          status: form.status,
          roleIds: form.roleIds,
        }
        await createUser(createPayload)
      }

      ElMessage.success('保存成功')
      dialogVisible.value = false
      await fetchList()
    } finally {
      saving.value = false
    }
  })
}

const handleResetPassword = async (row: UserListItem) => {
  await ElMessageBox.confirm(`确定要重置用户 ${row.username} 的密码吗？`, '重置密码', { type: 'warning' })
  await resetUserPassword({ userId: row.id })
  ElMessage.success('已发送重置请求')
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该用户吗？', '提示', { type: 'warning' })
  await deleteUser(id)
  ElMessage.success('删除成功')
  await fetchList()
}

onMounted(async () => {
  await Promise.all([fetchRoles(), fetchList()])
})
</script>

<style scoped lang="scss">
.page-shell {
  padding-top: 16px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.toolbar-actions {
  margin-left: auto;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.tag-gap {
  margin-right: 6px;
}

.full-width {
  width: 100%;
}
</style>
