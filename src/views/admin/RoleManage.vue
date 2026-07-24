<template>
  <div class="page-shell">
    <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
      <el-form-item label="角色名称">
        <el-input v-model="queryForm.roleName" clearable placeholder="角色名称" />
      </el-form-item>
      <el-form-item label="角色编码">
        <el-input v-model="queryForm.roleCode" clearable placeholder="角色编码" />
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
        <el-button type="primary" plain @click="openDialog()">新增角色</el-button>
      </div>
    </el-form>

    <el-table :data="list" v-loading="loading" border stripe>
      <el-table-column prop="roleName" label="角色名称" min-width="160" />
      <el-table-column prop="roleCode" label="角色编码" min-width="160" />
      <el-table-column prop="description" label="描述" min-width="220" />
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">{{
            scope.row.status === 1 ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" min-width="180" />
      <el-table-column fixed="right" label="操作" width="220">
        <template #default="scope">
          <el-button link type="primary" @click="openDialog(scope.row)">编辑</el-button>
          <el-button link type="success" @click="openMenuDialog(scope.row)">配置菜单</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="角色名称" prop="roleName">
          <el-input v-model="form.roleName" />
        </el-form-item>
        <el-form-item label="角色编码" prop="roleCode">
          <el-input v-model="form.roleCode" />
        </el-form-item>
        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="form.status" class="full-width">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="menuDialogVisible" title="配置菜单权限" width="720px" destroy-on-close>
      <el-alert
        title="勾选角色可访问的菜单项，保存后会同步菜单权限。"
        type="info"
        :closable="false"
        class="dialog-alert"
      />
      <el-tree ref="menuTreeRef" :data="menuOptions" node-key="id" show-checkbox default-expand-all :props="treeProps">
        <template #default="{ data }">
          <div class="menu-tree-node">
            <span class="menu-tree-node__name">{{ data.menuName }}</span>
            <el-tag size="small" type="info">{{ menuTypeText(data.type) }}</el-tag>
            <span class="menu-tree-node__path">{{ data.path }}</span>
          </div>
        </template>
      </el-tree>
      <template #footer>
        <el-button @click="menuDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="menuSaving" @click="submitMenuPermissions">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import type { ElTree, FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  assignMenusToRole,
  createRole,
  deleteRole,
  getAllMenus,
  getRoleById,
  getRoleList,
  getRoleMenus,
  updateRole,
  type MenuItem,
  type RoleListItem,
} from '@/api/auth'

const loading = ref(false)
const saving = ref(false)
const menuSaving = ref(false)
const list = ref<RoleListItem[]>([])
const menuOptions = ref<MenuItem[]>([])
const dialogVisible = ref(false)
const menuDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const menuTreeRef = ref<InstanceType<typeof ElTree>>()
const isEdit = ref(false)
const activeRoleId = ref<number | null>(null)

const page = reactive({
  current: 1,
  size: 10,
  total: 0,
})

const queryForm = reactive({
  roleName: '',
  roleCode: '',
  status: undefined as number | undefined,
})

const emptyForm = () => ({
  id: 0,
  roleName: '',
  roleCode: '',
  description: '',
  status: 1,
})

const form = reactive(emptyForm())

const rules: FormRules = {
  roleName: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
}

const dialogTitle = computed(() => (isEdit.value ? '编辑角色' : '新增角色'))

const treeProps = { children: 'children', label: 'menuName' }

const menuTypeText = (type: number) => {
  if (type === 1) return '目录'
  if (type === 3) return '按钮'
  return '菜单'
}

const normalizeMenuTree = (menus: MenuItem[]) => {
  if (menus.some((menu) => menu.children && menu.children.length > 0)) {
    return menus
  }

  const menuMap = new Map<number, MenuItem & { children: MenuItem[] }>()
  const roots: Array<MenuItem & { children: MenuItem[] }> = []

  menus.forEach((menu) => {
    menuMap.set(menu.id, {
      ...menu,
      children: [],
    })
  })

  menus.forEach((menu) => {
    const current = menuMap.get(menu.id)
    if (!current) {
      return
    }

    if (menu.parentId && menu.parentId !== 0 && menuMap.has(menu.parentId)) {
      menuMap.get(menu.parentId)!.children.push(current)
    } else {
      roots.push(current)
    }
  })

  return roots
}

const fetchMenus = async () => {
  const response = await getAllMenus()
  menuOptions.value = normalizeMenuTree(response.data ?? [])
}

const fetchList = async () => {
  loading.value = true
  try {
    const response = await getRoleList({
      roleName: queryForm.roleName,
      roleCode: queryForm.roleCode,
      status: queryForm.status,
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
  queryForm.roleName = ''
  queryForm.roleCode = ''
  queryForm.status = undefined
  page.current = 1
  fetchList()
}

const openDialog = async (row?: RoleListItem) => {
  isEdit.value = Boolean(row)
  Object.assign(form, emptyForm())

  if (row) {
    const response = await getRoleById(row.id)
    const detail = response.data
    form.id = detail.id
    form.roleName = detail.roleName
    form.roleCode = detail.roleCode
    form.description = detail.description
    form.status = detail.status
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
      const payload = {
        roleName: form.roleName,
        roleCode: form.roleCode,
        description: form.description,
        status: form.status,
      }

      if (isEdit.value) {
        await updateRole({ id: form.id, ...payload })
      } else {
        await createRole(payload)
      }

      ElMessage.success('保存成功')
      dialogVisible.value = false
      await fetchList()
    } finally {
      saving.value = false
    }
  })
}

const handleDelete = async (id: number) => {
  await ElMessageBox.confirm('确定删除该角色吗？', '提示', { type: 'warning' })
  await deleteRole(id)
  ElMessage.success('删除成功')
  await fetchList()
}

const openMenuDialog = async (row: RoleListItem) => {
  activeRoleId.value = row.id
  await fetchMenus()
  menuDialogVisible.value = true
  await nextTick()

  const response = await getRoleMenus(row.id)
  const checkedKeys = response.data ?? []
  menuTreeRef.value?.setCheckedKeys(checkedKeys)
}

const submitMenuPermissions = async () => {
  if (!activeRoleId.value) {
    return
  }

  menuSaving.value = true
  try {
    const checkedKeys = (menuTreeRef.value?.getCheckedKeys(false) ?? []) as number[]
    await assignMenusToRole(activeRoleId.value, checkedKeys)
    ElMessage.success('菜单权限保存成功')
    menuDialogVisible.value = false
  } finally {
    menuSaving.value = false
  }
}

onMounted(async () => {
  await Promise.all([fetchMenus(), fetchList()])
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

.full-width {
  width: 100%;
}

.dialog-alert {
  margin-bottom: 12px;
}

.menu-tree-node {
  display: flex;
  align-items: center;
  gap: 10px;

  &__name {
    font-weight: 600;
  }

  &__path {
    color: var(--text-color-secondary);
    font-size: 12px;
  }
}
</style>
