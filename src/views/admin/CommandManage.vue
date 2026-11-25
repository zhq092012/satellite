<template>
  <div class="command-manage-container">
    <!-- 头部工具栏与操作区域 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar-header">
        <div class="toolbar-title">
          <span class="icon">🌐</span>
          <span class="text">命令与任务统一管理</span>
        </div>
        <div class="toolbar-actions">
          <el-button type="primary" icon="Plus" round @click="handleCreateCommand"> 新建命令 </el-button>
          <el-button icon="Refresh" circle @click="loadCommandList" />
        </div>
      </div>
    </el-card>

    <!-- 战场列表与所属任务列表 -->
    <div class="command-list-box">
      <el-empty v-if="commandList.length === 0" description="暂无命令数据，请点击右上角新建命令" />

      <div v-for="command in commandList" :key="command.id" class="command-card">
        <div class="command-card-header" @click="toggleCommandExpand(command.id)">
          <div class="header-left">
            <el-icon class="expand-icon" :class="{ 'is-expanded': isCommandExpanded(command.id) }">
              <ArrowRight />
            </el-icon>
            <span class="command-name">⚔️ {{ command.name }}</span>
            <el-tag size="small" type="info" round class="command-desc-tag">
              {{ command.description || '无概述' }}
            </el-tag>
            <el-button type="success" size="small" plain round @click.stop="handleEditCommand(command)">
              编辑命令
            </el-button>
            <el-button type="danger" size="small" plain round @click.stop="handleDeleteCommand(command.id)">
              删除命令
            </el-button>
            <el-button type="primary" size="small" plain round class="create-task-btn"
              @click.stop="handleCreateTask(command)">
              新建任务
            </el-button>
          </div>

        </div>

        <div v-show="isCommandExpanded(command.id)" class="command-card-body">
          <div class="task-table-wrapper">
            <el-table :data="command.tasks || []" border style="width: 100%" size="small">
              <el-table-column prop="name" label="任务名称" min-width="140" />
              <el-table-column prop="description" label="任务概述" min-width="180" show-overflow-tooltip />
              <el-table-column label="起止时间" width="350">
                <template #default="scope">
                  <span>{{ scope.row.beginDate || '--' }} ~ {{ scope.row.endDate || '--' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="作战对象" min-width="140" show-overflow-tooltip>
                <template #default="scope">
                  {{ formatCommandTaskCountryDisplay(command) }}
                </template>
              </el-table-column>

              <el-table-column label="操作" width="300" fixed="right" align="center">
                <template #default="scope">
                  <div class="table-action-group">
                    <el-button type="success" size="small" plain round @click="handleEditTask(scope.row, command)">
                      编辑任务
                    </el-button>
                    <el-button type="danger" size="small" plain round @click="handleDeleteTask(scope.row)">
                      删除任务
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建 / 编辑命令弹窗 -->
    <el-dialog :title="commandDialogTitle" v-model="commandDialogVisible" width="760px" destroy-on-close>
      <CommandUpsertForm ref="commandUpsertFormRef" v-model="commandForm" label-width="110px" />
      <template #footer>
        <el-button @click="cancelCommandForm">取 消</el-button>
        <el-button type="primary" @click="submitCommandForm">确 定</el-button>
      </template>
    </el-dialog>

    <TaskEditDialog v-model="taskEditVisible" :is-edit="taskEditIsEdit" :task="editingTask" @saved="handleTaskSaved" />
  </div>
</template>

<script setup lang="ts">
/**
 * 导入 Vue 核心 API 及 Element Plus 类型定义
 */
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CommandUpsertForm from '@/components/BattleSituation/CommandUpsertForm.vue'
import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'

/**
 * 导入后台仪表盘与场景/任务管理相关 API 函数与类型
 */
import { createCommand, deleteCommand, getCommandList, updateCommand } from '@/api/command/command'
import { deleteTask, getTaskList } from '@/api/task/task'
import type { CommandForm, CommandUpsertPayload } from '@/types/command/command'
import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import type { TaskForm } from '@/types/task/task'
import { isSameCommandId, normalizeCommandId } from '@/utils/commandEntity'
import { normalizeTaskListFromApi } from '@/utils/taskEntity'
import { formatCommandEnemyCountryDisplay } from '@/utils/commandEntity'
import {
  commandFormToUpsertPayload,
  createEmptyCommandUpsertPayload,
  serializeCommandUpsertPayload,
} from '@/utils/commandUpsertForm'

/** 场景管理任务列表：作战对象来自所属作战命令 */
const formatCommandTaskCountryDisplay = (command: CommandForm): string =>
  formatCommandEnemyCountryDisplay(command)

/** Store 状态对象 */
const store = useLayoutStore()

/** 命令表单组件引用 */
const commandUpsertFormRef = ref<InstanceType<typeof CommandUpsertForm> | null>(null)

/** 场景列表及卡片展开控制响应式变量 */
const commandList = ref<CommandForm[]>([])
const activeNames = ref<string[]>([])

/** 弹窗状态及标题 */
const commandDialogTitle = ref('新建命令')
const commandDialogVisible = ref(false)

/** 任务编辑弹窗（复用态势页 TaskEditDialog） */
const taskEditVisible = ref(false)
const taskEditIsEdit = ref(false)
const editingTask = ref<TaskForm | null>(null)

/** 命令新建/编辑表单 */
const commandForm = reactive<CommandUpsertPayload>(createEmptyCommandUpsertPayload())

const {
  startTaskProgressPolling,
  resumeTaskProgressPollingForTasks,
} = useTaskProgressPolling()

/**
 * 判断指定战场 ID 的卡片是否展开
 * @param id 战场 ID
 */
const isCommandExpanded = (id?: string | number) => {
  if (id === undefined) return false
  return activeNames.value.some((activeId) => isSameCommandId(activeId, id))
}

/**
 * 切换指定战场 ID 的卡片展开状态
 * @param id 战场 ID
 */
const toggleCommandExpand = (id?: string | number) => {
  if (id === undefined) return
  const normalizedId = normalizeCommandId(id)
  if (!normalizedId) return
  const index = activeNames.value.findIndex((activeId) => isSameCommandId(activeId, normalizedId))
  if (index > -1) {
    activeNames.value.splice(index, 1)
  } else {
    activeNames.value.push(normalizedId)
  }
}

/**
 * 监听：战役折叠面板展开项 `activeNames`（`deep: true`）。
 * 返回：回调不返回清理函数。
 * 作用：展开某战役时为该 `commandId` 拉取任务列表、恢复轮询并写回 `commandList` 对应项。
 */
watch(
  activeNames,
  () => {
    if (activeNames.value.length) {
      activeNames.value.forEach(async (commandId) => {
        const res = await getTaskList(commandId)
        if (res.code === 200) {
          const tasks = normalizeTaskListFromApi(res.data)
          await resumeTaskProgressPollingForTasks(tasks)
          const cmd = commandList.value.find((s) => isSameCommandId(s.id, commandId))
          if (cmd) {
            cmd.tasks = tasks
          }
        }
      })
    }
  },
  { deep: true }
)

/**
 * 刷新指定场景下的任务列表。
 *
 * @param commandId 场景 ID
 */
const refreshCommandTasks = async (commandId: string | number) => {
  const res = await getTaskList(commandId)
  if (res.code !== 200) return
  const tasks = normalizeTaskListFromApi(res.data)
  await resumeTaskProgressPollingForTasks(tasks)
  const cmd = commandList.value.find((item) => isSameCommandId(item.id, commandId))
  if (cmd) {
    cmd.tasks = tasks
  }
}

/**
 * 重新拉取当前已展开场景的任务列表。
 */
const refreshExpandedCommandTaskLists = async () => {
  const commandIds = activeNames.value.filter((id) =>
    commandList.value.some((cmd) => isSameCommandId(cmd.id, id)),
  )
  await Promise.all(commandIds.map((commandId) => refreshCommandTasks(commandId)))
}

/** 加载战场列表，并补回已展开场景的任务 */
const loadCommandList = async () => {
  const res = await getCommandList()
  if (res.code === 200) {
    commandList.value = res.data || []
    if (commandList.value.length > 0 && activeNames.value.length === 0) {
      const firstId = commandList.value[0].id
      if (firstId != null) {
        const normalizedFirstId = normalizeCommandId(firstId)
        activeNames.value = [normalizedFirstId]
        await refreshCommandTasks(normalizedFirstId)
      }
      return
    }
    await refreshExpandedCommandTaskLists()
  }
}

/** 打开新建场景弹窗 */
const handleCreateCommand = () => {
  Object.assign(commandForm, createEmptyCommandUpsertPayload())
  commandDialogTitle.value = '新建命令'
  commandDialogVisible.value = true
}

/** 打开编辑命令弹窗 */
const handleEditCommand = (command: CommandForm) => {
  Object.assign(commandForm, commandFormToUpsertPayload(command))
  commandDialogTitle.value = '修改命令'
  commandDialogVisible.value = true
}

/** 删除战场 */
const handleDeleteCommand = (commandId?: string | number) => {
  if (!commandId) return
  ElMessageBox.confirm('确定要删除该命令及其下属任务吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const res = await deleteCommand(commandId)
    if (res.code === 200) {
      ElMessage.success('删除命令成功')
      await loadCommandList()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  })
}

/** 取消命令表单 */
const cancelCommandForm = () => {
  commandUpsertFormRef.value?.resetFields()
  commandDialogVisible.value = false
}

/** 提交命令表单（完整 `CommandReq`） */
const submitCommandForm = async () => {
  const valid = await commandUpsertFormRef.value?.validate()
  if (!valid) {
    ElMessage.warning('请填写完整的命令信息')
    return
  }
  const payload = serializeCommandUpsertPayload(commandForm)
  try {
    const res = payload.id ? await updateCommand(payload) : await createCommand(payload)
    if (res.code === 200) {
      await loadCommandList()
      cancelCommandForm()
      ElMessage.success(payload.id ? '修改命令成功' : '新增命令成功')
    } else {
      ElMessage.warning(res.msg)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存命令失败')
  }
}

/** 打开新建任务弹窗（复用 TaskEditDialog） */
const handleCreateTask = (command: CommandForm) => {
  if (!command.id) return
  store.setActivedCommand(command)
  taskEditIsEdit.value = false
  editingTask.value = null
  taskEditVisible.value = true
}

/** 查看任务详情（编辑接口未开放，仅查看） */
const handleEditTask = (task: TaskForm, command: CommandForm) => {
  store.setActivedCommand(command)
  taskEditIsEdit.value = true
  editingTask.value = task
  taskEditVisible.value = true
}

/**
 * 任务保存成功后刷新场景任务列表，并为新建任务订阅进度 WebSocket。
 *
 * @param updated 保存后的任务数据
 */
const handleTaskSaved = async (updated: TaskForm) => {
  const commandId = updated.commandId || store.command?.id
  const previousTaskIds = new Set(
    commandList.value.flatMap((cmd) => (cmd.tasks || []).map((task) => task.id).filter(Boolean) as string[])
  )
  const isCreate = Boolean(updated.id && !previousTaskIds.has(updated.id))

  if (!commandId) {
    await loadCommandList()
    return
  }

  const normalizedCommandId = normalizeCommandId(commandId)
  if (normalizedCommandId) {
    if (!activeNames.value.some((id) => isSameCommandId(id, normalizedCommandId))) {
      activeNames.value.push(normalizedCommandId)
    }
    await refreshCommandTasks(normalizedCommandId)
  }

  if (isCreate && updated.id) {
    await startTaskProgressPolling(updated.id)
  }
}

/** 删除任务 */
const handleDeleteTask = (task: TaskForm) => {
  if (!task.id) return
  ElMessageBox.confirm('确定要删除该任务吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const res = await deleteTask(task.id!)
    if (res.code === 200) {
      ElMessage.success('删除任务成功')
      const commandId =
        task.commandId || commandList.value.find((cmd) => cmd.tasks?.some((item) => item.id === task.id))?.id
      if (commandId) {
        await refreshCommandTasks(commandId)
      } else {
        await refreshExpandedCommandTaskLists()
      }
    } else {
      ElMessage.error(res.msg || '删除任务失败')
    }
  })
}

/** 页面挂载时数据初始化 */
onMounted(async () => {
  await loadCommandList()
})
</script>

<style scoped lang="scss">
.command-manage-container {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  padding: 8px 0;

  .toolbar-card {
    flex-shrink: 0;
    margin-bottom: 16px;
    background: var(--surface-bg-color);
    border: 1px solid var(--surface-border-color);

    .toolbar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .toolbar-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: bold;
        color: var(--text-color-strong);
      }

      .toolbar-actions {
        display: flex;
        gap: 10px;
      }
    }
  }

  .command-list-box {
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 24px;
    scrollbar-gutter: stable;

    .command-card {
      flex-shrink: 0;
      background: var(--surface-bg-color);
      border: 1px solid var(--surface-border-color);
      border-radius: 8px;
      overflow: visible;

      .command-card-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 14px 18px;
        background: rgba(0, 225, 255, 0.04);
        cursor: pointer;
        border-radius: 8px 8px 0 0;

        .header-left {
          display: flex;
          flex: 1;
          min-width: 0;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 10px;

          .expand-icon {
            transition: transform 0.25s ease;

            &.is-expanded {
              transform: rotate(90deg);
            }
          }

          .command-name {
            font-size: 15px;
            font-weight: 700;
            color: #7dd3fc;
          }
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .command-card-body {
        padding: 16px 16px 20px;
        border-top: 1px solid var(--surface-border-color);
        border-radius: 0 0 8px 8px;
        background: var(--surface-bg-color);

        .task-table-wrapper {
          width: 100%;
          overflow-x: auto;
          overflow-y: visible;

          :deep(.el-table) {
            margin-bottom: 0;
          }

          :deep(.el-table__inner-wrapper) {
            overflow: visible;
          }
        }
      }
    }
  }
}

.table-action-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;

  .el-button {
    margin-left: 0 !important;
  }
}

.text-muted {
  color: var(--text-color-secondary);
  font-size: 12px;
}
</style>
