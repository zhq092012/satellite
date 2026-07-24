<template>
  <div class="page-shell">
    <el-form :inline="true" :model="queryForm" class="toolbar" @submit.prevent>
      <el-form-item label="菜单名称">
        <el-input v-model="queryForm.menuName" clearable placeholder="菜单名称" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="queryForm.type" clearable placeholder="全部" style="width: 180px">
          <el-option label="目录" :value="1" />
          <el-option label="菜单" :value="2" />
          <el-option label="按钮" :value="3" />
        </el-select>
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
        <el-button type="primary" plain @click="openDialog()">新增菜单</el-button>
      </div>
    </el-form>

    <el-table :data="list" v-loading="loading" border row-key="id" stripe default-expand-all :tree-props="treeProps">
      <el-table-column prop="menuName" label="菜单名称" min-width="180" />
      <el-table-column prop="path" label="路径" min-width="180" />
      <el-table-column prop="component" label="组件" min-width="220" />
      <el-table-column prop="icon" label="图标" min-width="120" />
      <el-table-column prop="permission" label="权限标识" min-width="180" />
      <el-table-column prop="type" label="类型" width="90">
        <template #default="scope">
          <el-tag>{{ typeLabel(scope.row.type) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 1 ? 'success' : 'danger'">{{
            scope.row.status === 1 ? '启用' : '禁用'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="90" />
      <el-table-column fixed="right" label="操作" width="220">
        <template #default="scope">
          <el-button link type="primary" @click="openDialog(scope.row, true)">新增子菜单</el-button>
          <el-button link type="primary" @click="openDialog(scope.row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(scope.row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="720px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="菜单名称" prop="menuName">
              <el-input v-model="form.menuName" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="类型" prop="type">
              <el-select v-model="form.type" class="full-width" @change="handleTypeChange">
                <el-option label="目录" :value="1" />
                <el-option label="菜单" :value="2" />
                <el-option label="按钮" :value="3" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="路径" prop="path">
              <el-input v-model="form.path" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="组件" prop="component">
              <el-input v-model="form.component" :disabled="form.type === 3" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="图标" prop="icon">
              <el-input v-model="form.icon" placeholder="例如 icon-us" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="权限标识" prop="permission">
              <el-input v-model="form.permission" placeholder="例如 system:user:list" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="父级菜单" prop="parentId">
              <el-select v-model="form.parentId" class="full-width" filterable clearable>
                <el-option :value="0" label="顶级菜单" />
                <el-option v-for="item in parentOptions" :key="item.id" :value="item.id" :label="item.menuName" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序" prop="sort">
              <el-input-number v-model="form.sort" :min="0" class="full-width-number" />
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
import { createMenu, deleteMenu, getAllMenus, getMenuById, updateMenu, type MenuItem } from '@/api/auth'

type MenuTreeNode = MenuItem & {
  status?: number
  children?: MenuTreeNode[]
}

const loading = ref(false)
const saving = ref(false)
const list = ref<MenuTreeNode[]>([])
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const isEdit = ref(false)
const isChild = ref(false)

const queryForm = reactive({
  menuName: '',
  type: undefined as number | undefined,
  status: undefined as number | undefined,
})

const emptyForm = () => ({
  id: 0,
  menuName: '',
  path: '',
  component: '',
  icon: '',
  type: 2,
  parentId: 0,
  sort: 0,
  permission: '',
  status: 1,
})

const form = reactive(emptyForm())

const rules: FormRules = {
  menuName: [{ required: true, message: '请输入菜单名称', trigger: 'blur' }],
  path: [{ required: true, message: '请输入路径', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

const dialogTitle = computed(() => {
  if (isEdit.value) {
    return '编辑菜单'
  }
  return isChild.value ? '新增子菜单' : '新增菜单'
})

const treeProps = {
  children: 'children',
}

const flattenMenus = (menus: MenuTreeNode[]) => {
  const result: MenuTreeNode[] = []
  const walk = (nodes: MenuTreeNode[]) => {
    nodes.forEach((node) => {
      result.push(node)
      if (node.children?.length) {
        walk(node.children)
      }
    })
  }
  walk(menus)
  return result
}

const parentOptions = computed(() => flattenMenus(list.value))

const typeLabel = (type: number) => {
  if (type === 1) return '目录'
  if (type === 3) return '按钮'
  return '菜单'
}

const normalizeMenuTree = (menus: MenuTreeNode[]) => {
  if (menus.some((menu) => menu.children && menu.children.length > 0)) {
    return menus
  }

  const menuMap = new Map<number, MenuTreeNode>()
  const roots: MenuTreeNode[] = []

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
      menuMap.get(menu.parentId)!.children = [...(menuMap.get(menu.parentId)!.children ?? []), current]
    } else {
      roots.push(current)
    }
  })

  return roots
}

const fetchList = async () => {
  loading.value = true
  try {
    const response = await getAllMenus()
    const menus = normalizeMenuTree((response.data ?? []) as MenuTreeNode[])
    list.value = filterMenus(menus)
  } finally {
    loading.value = false
  }
}

const filterMenus = (menus: MenuTreeNode[]): MenuTreeNode[] => {
  const normalized: MenuTreeNode[] = menus
    .filter((menu) => {
      if (queryForm.menuName && !menu.menuName.includes(queryForm.menuName)) {
        return false
      }
      if (queryForm.type !== undefined && menu.type !== queryForm.type) {
        return false
      }
      if (queryForm.status !== undefined && menu.status !== queryForm.status) {
        return false
      }
      return true
    })
    .map((menu) => ({
      ...menu,
      children: menu.children ? filterMenus(menu.children) : [],
    }))

  return normalized
}

const resetQuery = () => {
  queryForm.menuName = ''
  queryForm.type = undefined
  queryForm.status = undefined
  fetchList()
}

const openDialog = async (row?: MenuTreeNode, childMode = false) => {
  isEdit.value = Boolean(row && !childMode)
  isChild.value = childMode
  Object.assign(form, emptyForm())

  if (row && childMode) {
    form.parentId = row.id
    form.type = 2
  }

  if (row && !childMode) {
    const response = await getMenuById(row.id)
    const detail = response.data as MenuTreeNode
    form.id = detail.id
    form.menuName = detail.menuName
    form.path = detail.path
    form.component = detail.component
    form.icon = detail.icon
    form.type = detail.type
    form.parentId = detail.parentId
    form.sort = detail.sort
    form.permission = detail.permission
    form.status = detail.status ?? 1
  }

  dialogVisible.value = true
}

const handleTypeChange = (type: number) => {
  if (type === 3) {
    form.component = ''
  }
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
        menuName: form.menuName,
        path: form.path,
        component: form.component,
        icon: form.icon,
        type: form.type,
        parentId: form.parentId,
        sort: form.sort,
        permission: form.permission,
        status: form.status,
      }

      if (isEdit.value) {
        await updateMenu({ id: form.id, ...payload })
      } else {
        await createMenu(payload)
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
  await ElMessageBox.confirm('确定删除该菜单吗？', '提示', { type: 'warning' })
  await deleteMenu(id)
  ElMessage.success('删除成功')
  await fetchList()
}

onMounted(fetchList)
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

.full-width {
  width: 100%;
}

.full-width-number {
  width: 100%;
}
</style>
