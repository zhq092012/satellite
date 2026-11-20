<template>
  <div class="battle-manage-container">
    <!-- 头部工具栏与操作区域 -->
    <el-card shadow="never" class="toolbar-card">
      <div class="toolbar-header">
        <div class="toolbar-title">
          <span class="icon">🌐</span>
          <span class="text">场景与任务统一管理</span>
        </div>
        <div class="toolbar-actions">
          <el-button type="primary" icon="Plus" round @click="handleCreateBattle"> 新建场景 </el-button>
          <el-button icon="Refresh" circle @click="loadBattleList" />
        </div>
      </div>
    </el-card>

    <!-- 战场列表与所属任务列表 -->
    <div class="battle-list-box">
      <el-empty v-if="battleList.length === 0" description="暂无场景数据，请点击右上角新建场景" />

      <div v-for="battle in battleList" :key="battle.id" class="battle-card">
        <!-- 场景卡片头部 -->
        <div class="battle-card-header" @click="toggleBattleExpand(battle.id)">
          <div class="header-left">
            <el-icon class="expand-icon" :class="{ 'is-expanded': isBattleExpanded(battle.id) }">
              <ArrowRight />
            </el-icon>
            <span class="battle-name">⚔️ {{ battle.name }}</span>
            <el-tag size="small" type="info" round class="battle-desc-tag">
              {{ battle.description || '无概述' }}
            </el-tag>
            <el-button type="primary" size="small" plain round class="create-task-btn"
              @click.stop="handleCreateTask(battle)">
              新建任务
            </el-button>
          </div>
          <div class="header-right" @click.stop>
            <el-button type="success" size="small" plain round @click.stop="handleEditBattle(battle)">
              编辑场景
            </el-button>
            <el-button type="danger" size="small" plain round @click.stop="handleDeleteBattle(battle.id)">
              删除场景
            </el-button>
          </div>
        </div>

        <!-- 战场展开展示的任务列表 -->
        <div v-show="isBattleExpanded(battle.id)" class="battle-card-body">
          <div class="task-table-wrapper">
            <el-table :data="battle.tasks || []" border style="width: 100%" size="small">
              <el-table-column prop="name" label="任务名称" min-width="140" />
              <el-table-column prop="description" label="任务概述" min-width="180" show-overflow-tooltip />
              <el-table-column label="起止时间" width="350">
                <template #default="scope">
                  <span>{{ scope.row.beginDate || '--' }} ~ {{ scope.row.endDate || '--' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="作战对象" min-width="140" show-overflow-tooltip>
                <template #default="scope">
                  {{ formatBattleTaskCountryDisplay(scope.row) }}
                </template>
              </el-table-column>
              <!-- <el-table-column label="关注状态" width="100" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.focusStatus === 1 ? 'danger' : 'info'" size="small">
                    {{ scope.row.focusStatus === 1 ? '已关注' : '未关注' }}
                  </el-tag>
                </template>
              </el-table-column> -->
              <!-- <el-table-column label="算法计算进度" width="180">
                <template #default="scope">
                  <div v-if="getTaskProgress(scope.row)" class="progress-box">
                    <el-progress :percentage="getTaskProgressPercent(getTaskProgress(scope.row))"
                      :status="isTaskProgressComplete(getTaskProgress(scope.row)) ? 'success' : ''" :stroke-width="6" />
                  </div>
                  <span v-else class="text-muted">未开始或未获取</span>
                </template>
              </el-table-column> -->
              <el-table-column label="操作" width="300" fixed="right" align="center">
                <template #default="scope">
                  <div class="table-action-group">
                    <el-button type="success" size="small" plain round @click="handleEditTask(scope.row, battle)">
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

    <!-- 新建 / 编辑场景弹窗 -->
    <el-dialog :title="battleDialogTitle" v-model="battleDialogVisible" width="680px">
      <el-form :model="battleForm" ref="battleFormRef" :rules="createBattleRules" label-width="110px">
        <el-form-item label="场景名称" prop="name">
          <el-input v-model="battleForm.name" placeholder="请输入 场景名称" />
        </el-form-item>
        <el-form-item label="场景概述" prop="description">
          <el-input v-model="battleForm.description" type="textarea" placeholder="请输入场景概述" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelBattleForm(battleFormRef)">取 消</el-button>
        <el-button type="primary" @click="submitBattleForm(battleFormRef)">确 定</el-button>
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
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'

/**
 * 导入后台仪表盘与场景/任务管理相关 API 函数与类型
 */
import { createBattle, deleteBattle, getBattleList, updateBattle } from '@/api/battle/battle'
import { deleteTask, getTaskList } from '@/api/task/task'
import type { BattleForm, BattleUpsertPayload } from '@/types/battle/battle'
import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import type { TaskForm } from '@/types/task/task'
import { isSameBattleId, normalizeBattleId } from '@/utils/battleEntity'
import {
  normalizeTaskListFromApi,
  parseTaskCombatCountries,
  resolveTaskCountryFieldFromEntity,
} from '@/utils/taskEntity'

/** 场景管理任务列表：作战对象展示文案 */
const formatBattleTaskCountryDisplay = (task: TaskForm): string => {
  const countries = parseTaskCombatCountries(resolveTaskCountryFieldFromEntity(task))
  return countries.length ? countries.join('、') : '--'
}

/** Store 状态对象 */
const store = useLayoutStore()

/** 场景表单引用的 DOM 对象 */
const battleFormRef = ref<FormInstance>()

/** 场景列表及卡片展开控制响应式变量 */
const battleList = ref<BattleForm[]>([])
const activeNames = ref<string[]>([])

/** 弹窗状态及标题 */
const battleDialogTitle = ref('新建场景')
const battleDialogVisible = ref(false)

/** 任务编辑弹窗（复用态势页 TaskEditDialog） */
const taskEditVisible = ref(false)
const taskEditIsEdit = ref(false)
const editingTask = ref<TaskForm | null>(null)

/** 场景表单绑定的数据结构 */
const battleForm = reactive<BattleUpsertPayload & { tasks?: TaskForm[] | null }>({
  name: '',
  description: '',
})

/** 场景表单校验规则 */
const createBattleRules = reactive<FormRules<BattleUpsertPayload>>({
  name: [{ required: true, message: '请输入战场名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入战场概述', trigger: 'blur' }],
})

const {
  startTaskProgressPolling,
  resumeTaskProgressPollingForTasks,
} = useTaskProgressPolling()

/**
 * 判断指定战场 ID 的卡片是否展开
 * @param id 战场 ID
 */
const isBattleExpanded = (id?: string | number) => {
  if (id === undefined) return false
  return activeNames.value.some((activeId) => isSameBattleId(activeId, id))
}

/**
 * 切换指定战场 ID 的卡片展开状态
 * @param id 战场 ID
 */
const toggleBattleExpand = (id?: string | number) => {
  if (id === undefined) return
  const normalizedId = normalizeBattleId(id)
  if (!normalizedId) return
  const index = activeNames.value.findIndex((activeId) => isSameBattleId(activeId, normalizedId))
  if (index > -1) {
    activeNames.value.splice(index, 1)
  } else {
    activeNames.value.push(normalizedId)
  }
}

/**
 * 监听：战役折叠面板展开项 `activeNames`（`deep: true`）。
 * 返回：回调不返回清理函数。
 * 作用：展开某战役时为该 `battleId` 拉取任务列表、恢复轮询并写回 `battleList` 对应项。
 */
watch(
  activeNames,
  () => {
    if (activeNames.value.length) {
      activeNames.value.forEach(async (battleId) => {
        const res = await getTaskList(battleId)
        if (res.code === 200) {
          const tasks = normalizeTaskListFromApi(res.data)
          await resumeTaskProgressPollingForTasks(tasks)
          const battle = battleList.value.find((s) => isSameBattleId(s.id, battleId))
          if (battle) {
            battle.tasks = tasks
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
 * @param battleId 场景 ID
 */
const refreshBattleTasks = async (battleId: string | number) => {
  const res = await getTaskList(battleId)
  if (res.code !== 200) return
  const tasks = normalizeTaskListFromApi(res.data)
  await resumeTaskProgressPollingForTasks(tasks)
  const battle = battleList.value.find((item) => isSameBattleId(item.id, battleId))
  if (battle) {
    battle.tasks = tasks
  }
}

/**
 * 重新拉取当前已展开场景的任务列表。
 */
const refreshExpandedTaskLists = async () => {
  const battleIds = activeNames.value.filter((id) =>
    battleList.value.some((battle) => isSameBattleId(battle.id, id)),
  )
  await Promise.all(battleIds.map((battleId) => refreshBattleTasks(battleId)))
}

/** 加载战场列表，并补回已展开场景的任务 */
const loadBattleList = async () => {
  const res = await getBattleList()
  if (res.code === 200) {
    battleList.value = res.data || []
    if (battleList.value.length > 0 && activeNames.value.length === 0) {
      const firstId = battleList.value[0].id
      if (firstId != null) {
        const normalizedFirstId = normalizeBattleId(firstId)
        activeNames.value = [normalizedFirstId]
        await refreshBattleTasks(normalizedFirstId)
      }
      return
    }
    await refreshExpandedTaskLists()
  }
}

/** 打开新建场景弹窗 */
const handleCreateBattle = () => {
  battleForm.id = undefined
  battleForm.name = ''
  battleForm.description = ''
  battleDialogTitle.value = '新建场景'
  battleDialogVisible.value = true
}

/** 打开编辑战场弹窗 */
const handleEditBattle = (battle: BattleForm) => {
  battleForm.id = battle.id
  battleForm.name = battle.name
  battleForm.description = battle.description
  battleDialogTitle.value = '修改战场'
  battleDialogVisible.value = true
}

/** 删除战场 */
const handleDeleteBattle = (battleId?: string | number) => {
  if (!battleId) return
  ElMessageBox.confirm('确定要删除该战场及其下属任务吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    const res = await deleteBattle(battleId)
    if (res.code === 200) {
      ElMessage.success('删除战场成功')
      await loadBattleList()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  })
}

/** 取消战场表单 */
const cancelBattleForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.resetFields()
  battleDialogVisible.value = false
}

/** 提交战场表单 */
const submitBattleForm = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate(async (valid) => {
    if (valid) {
      let res
      const payload: BattleUpsertPayload = {
        id: battleForm.id,
        name: battleForm.name.trim(),
        description: battleForm.description.trim(),
      }
      if (battleForm.id) {
        res = await updateBattle(payload)
      } else {
        res = await createBattle(payload)
      }
      if (res.code === 200) {
        await loadBattleList()
        cancelBattleForm(battleFormRef.value)
        ElMessage.success(battleForm.id ? '修改战场成功' : '新增战场成功')
      } else {
        ElMessage.warning(res.msg)
      }
    }
  })
}

/** 打开新建任务弹窗（复用 TaskEditDialog） */
const handleCreateTask = (battle: BattleForm) => {
  if (!battle.id) return
  store.setActivedBattle(battle)
  taskEditIsEdit.value = false
  editingTask.value = null
  taskEditVisible.value = true
}

/** 查看任务详情（编辑接口未开放，仅查看） */
const handleEditTask = (task: TaskForm, battle: BattleForm) => {
  store.setActivedBattle(battle)
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
  const battleId = updated.battleId || store.battle?.id
  const previousTaskIds = new Set(
    battleList.value.flatMap((battle) => (battle.tasks || []).map((task) => task.id).filter(Boolean) as string[])
  )
  const isCreate = Boolean(updated.id && !previousTaskIds.has(updated.id))

  if (!battleId) {
    await loadBattleList()
    return
  }

  const normalizedBattleId = normalizeBattleId(battleId)
  if (normalizedBattleId) {
    if (!activeNames.value.some((id) => isSameBattleId(id, normalizedBattleId))) {
      activeNames.value.push(normalizedBattleId)
    }
    await refreshBattleTasks(normalizedBattleId)
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
      const battleId =
        task.battleId || battleList.value.find((battle) => battle.tasks?.some((item) => item.id === task.id))?.id
      if (battleId) {
        await refreshBattleTasks(battleId)
      } else {
        await refreshExpandedTaskLists()
      }
    } else {
      ElMessage.error(res.msg || '删除任务失败')
    }
  })
}

/** 页面挂载时数据初始化 */
onMounted(async () => {
  await loadBattleList()
})
</script>

<style scoped lang="scss">
.battle-manage-container {
  height: 100%;
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

  .battle-list-box {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;

    .battle-card {
      background: var(--surface-bg-color);
      border: 1px solid var(--surface-border-color);
      border-radius: 8px;
      overflow: hidden;

      .battle-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: rgba(0, 225, 255, 0.04);
        cursor: pointer;

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;

          .expand-icon {
            transition: transform 0.25s ease;

            &.is-expanded {
              transform: rotate(90deg);
            }
          }

          .battle-name {
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

      .battle-card-body {
        padding: 16px;
        border-top: 1px solid var(--surface-border-color);
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
