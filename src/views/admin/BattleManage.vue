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
            <el-button type="primary" size="small" plain round class="create-task-btn" @click.stop="handleCreateTask(battle)">
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
              <el-table-column label="起止时间" width="300">
                <template #default="scope">
                  <span>{{ scope.row.beginDate || '--' }} ~ {{ scope.row.endDate || '--' }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="meCountry" label="红方" width="120" show-overflow-tooltip />
              <el-table-column prop="enemyCountry" label="蓝方" width="120" show-overflow-tooltip />
              <el-table-column label="关注状态" width="100" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.focusStatus === 1 ? 'danger' : 'info'" size="small">
                    {{ scope.row.focusStatus === 1 ? '已关注' : '未关注' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="算法计算进度" width="180">
                <template #default="scope">
                  <div v-if="getTaskProgress(scope.row)" class="progress-box">
                    <el-progress :percentage="getTaskProgressPercent(getTaskProgress(scope.row))"
                      :status="isTaskProgressComplete(getTaskProgress(scope.row)) ? 'success' : ''" :stroke-width="6" />
                  </div>
                  <span v-else class="text-muted">未开始或未获取</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="300" fixed="right" align="center">
                <template #default="scope">
                  <div class="table-action-group">
                    <el-button type="success" size="small" plain round @click="handleEditTask(scope.row, battle)">
                      查看任务
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
        <el-form-item label="" v-if="battleForm.createAreaMode === '多边形'">
          <el-button type="primary" @click="addPolygonArea" size="small"> 新增区域 </el-button>
        </el-form-item>
        <div v-show="battleForm.createAreaMode === '多边形'" v-for="[idx, area] in store.battlePolygonMap" :key="idx"
          class="polygon-area-item">
          <el-form-item label="区域名称">
            <div class="area-name-row">
              <el-input v-model="area.name" placeholder="区域名称" />
              <el-button type="primary" @click="chooseArea(idx)" round size="small">选择区域</el-button>
              <el-button type="danger" @click="removeArea(idx)" round size="small">删除区域</el-button>
            </div>
          </el-form-item>
          <el-form-item label="区域坐标">
            <div v-for="(lonlat, lIdx) in area.lonlats" :key="lIdx" class="lonlat-row">
              <div class="coord-field"><span>经度：</span><el-input v-model="lonlat.lon" type="number" /></div>
              <div class="coord-field"><span>纬度：</span><el-input v-model="lonlat.lat" type="number" /></div>
            </div>
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="cancelBattleForm(battleFormRef)">取 消</el-button>
        <el-button type="primary" @click="submitBattleForm(battleFormRef)">确 定</el-button>
      </template>
    </el-dialog>

    <TaskEditDialog v-model="taskEditVisible" :is-edit="taskEditIsEdit" :task="editingTask" @saved="handleTaskSaved" />

    <!-- 战场区域地图绘制选择弹窗 -->
    <el-dialog title="战场区域选择" v-model="showPolygonMap" width="1100px">
      <div>
        <PolygonMap ref="polygonRef" />
      </div>
      <template #footer>
        <el-button @click="clearMap">取 消</el-button>
        <el-button type="primary" @click="confirmPolygonMap">确 定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 导入 Vue 核心 API 及 Element Plus 类型定义
 */
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import PolygonMap from '@/components/cesium/BattleArea.vue'
import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'

/**
 * 导入后台仪表盘与场景/任务管理相关 API 函数与类型
 */
import {
  deleteBattle,
  deleteTask,
  getBattleList,
  getTaskList,
  saveBattle,
  updateBattle,
} from '@/api/dashboard'
import type { BattleForm, TaskForm } from '@/types/dashboard'
import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'

/** Store 状态对象 */
const store = useLayoutStore()

/** 多边形绘制组件引用 */
const polygonRef = ref<InstanceType<typeof PolygonMap> | null>(null)

/** 场景表单引用的 DOM 对象 */
const battleFormRef = ref<FormInstance>()

/** 场景列表及卡片展开控制响应式变量 */
const battleList = ref<BattleForm[]>([])
const activeNames = ref<number[]>([])

/** 弹窗状态及标题 */
const battleDialogTitle = ref('新建场景')
const battleDialogVisible = ref(false)
const showPolygonMap = ref(false)

/** 任务编辑弹窗（复用态势页 TaskEditDialog） */
const taskEditVisible = ref(false)
const taskEditIsEdit = ref(false)
const editingTask = ref<TaskForm | null>(null)

/** 场景表单绑定的数据结构 */
const battleForm = reactive<BattleForm>({
  name: '',
  description: '',
  createAreaMode: '多边形',
  area: '',
  beginDate: '',
  endDate: '',
  dataRefreshRate: '',
  tasks: [],
})

/** 日期范围选择器的底层中转变量 */
const battleDatePickValue = ref<[string, string]>(['2025-12-01 09:00', '2025-12-02 18:00'])

/** 场景表单校验规则 */
const createBattleRules = reactive<FormRules<BattleForm>>({
  name: [{ required: true, message: '请输入战场名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入战场概述', trigger: 'blur' }],
})

const {
  getTaskProgress,
  getTaskProgressPercent,
  isTaskProgressComplete,
  startTaskProgressPolling,
  resumeTaskProgressPollingForTasks,
} = useTaskProgressPolling()

/**
 * 判断指定战场 ID 的卡片是否展开
 * @param id 战场 ID
 */
const isBattleExpanded = (id?: number) => {
  return id !== undefined && activeNames.value.includes(id)
}

/**
 * 切换指定战场 ID 的卡片展开状态
 * @param id 战场 ID
 */
const toggleBattleExpand = (id?: number) => {
  if (id === undefined) return
  const index = activeNames.value.indexOf(id)
  if (index > -1) {
    activeNames.value.splice(index, 1)
  } else {
    activeNames.value.push(id)
  }
}

/**
 * 监视 activeNames 展开项并自动加载对应的任务列表
 */
watch(
  activeNames,
  () => {
    if (activeNames.value.length) {
      activeNames.value.forEach(async (battleId) => {
        const res = await getTaskList(Number(battleId))
        if (res.code === 200) {
          await resumeTaskProgressPollingForTasks(res.data)
          const battle = battleList.value.find((s) => s.id === Number(battleId))
          if (battle) {
            battle.tasks = res.data
          }
        }
      })
    }
  },
  { deep: true }
)

/**
 * 多边形区域绘制操作方法
 */
const chooseArea = (idx: number) => {
  store.currentPolygonIdx = idx
  showPolygonMap.value = true
  polygonRef.value?.clearAll()
}

const addPolygonArea = () => {
  store.setPolygon(store.currentPolygonIdx, { name: '', lonlats: [] })
  store.currentPolygonIdx++
}

const removeArea = (idx: number) => {
  store.removePolygon(idx)
}

const confirmPolygonMap = () => {
  showPolygonMap.value = false
}

const clearMap = () => {
  showPolygonMap.value = false
  polygonRef.value?.clearAll()
}

/** 加载战场列表 */
const loadBattleList = async () => {
  const res = await getBattleList()
  if (res.code === 200) {
    battleList.value = res.data || []
    if (battleList.value.length > 0 && activeNames.value.length === 0) {
      nextTick(() => {
        activeNames.value = [battleList.value[0].id ?? 0]
      })
    }
  }
}

/** 打开新建场景弹窗 */
const handleCreateBattle = () => {
  battleForm.id = undefined
  battleForm.name = ''
  battleForm.description = ''
  battleForm.area = ''
  battleForm.beginDate = ''
  battleForm.endDate = ''
  battleForm.dataRefreshRate = ''
  battleDatePickValue.value = ['', '']
  battleForm.tasks = []
  battleDialogTitle.value = '新建场景'
  battleDialogVisible.value = true
  store.battleCircleMap.clear()
  store.battlePolygonMap.clear()
}

/** 打开编辑战场弹窗 */
const handleEditBattle = (battle: BattleForm) => {
  Object.assign(battleForm, battle)
  if (battle.createAreaMode === '圆' && battle.circleJSON) {
    const circles = JSON.parse(battle.circleJSON)
    store.battleCircleMap.clear()
    circles.forEach((circle: any, idx: number) => {
      store.setCircle(idx, circle)
    })
    store.currentCircleIdx = circles.length
  }
  battleDialogTitle.value = '修改战场'
  battleDialogVisible.value = true
}

/** 删除战场 */
const handleDeleteBattle = (battleId?: number) => {
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
      battleForm.area = JSON.stringify(Array.from(store.battlePolygonMap.values()))
      battleForm.circleJSON = JSON.stringify(Array.from(store.battleCircleMap.values()))
      if (battleForm.id) {
        res = await updateBattle(battleForm)
      } else {
        res = await saveBattle(battleForm)
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

/**
 * 刷新指定场景下的任务列表。
 *
 * @param battleId 场景 ID
 */
const refreshBattleTasks = async (battleId: number) => {
  const res = await getTaskList(battleId)
  if (res.code !== 200) return
  await resumeTaskProgressPollingForTasks(res.data)
  const battle = battleList.value.find((item) => item.id === battleId)
  if (battle) {
    battle.tasks = res.data
  }
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
 * 任务保存成功后刷新场景任务列表，并为新建任务启动进度轮询。
 *
 * @param updated 保存后的任务数据
 */
const handleTaskSaved = async (updated: TaskForm) => {
  const battleId = updated.battleId || store.battle?.id
  const previousTaskIds = new Set(
    battleList.value.flatMap((battle) => (battle.tasks || []).map((task) => task.id).filter(Boolean) as number[])
  )
  const isCreate = Boolean(updated.id && !previousTaskIds.has(updated.id))

  await loadBattleList()

  if (!battleId) return

  if (!activeNames.value.includes(battleId)) {
    activeNames.value.push(battleId)
  }
  await refreshBattleTasks(battleId)

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
      await loadBattleList()
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
  padding: 8px 0;

  .toolbar-card {
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

.polygon-area-item {
  margin: 10px 0;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;

  .area-name-row {
    display: flex;
    gap: 10px;
    align-items: center;
    width: 100%;
  }

  .lonlat-row {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    width: 100%;

    .coord-field {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      min-width: 0;

      span {
        white-space: nowrap;
        flex-shrink: 0;
        font-size: 13px;
      }

      .el-input {
        flex: 1;
        min-width: 0;
      }
    }
  }
}

.text-muted {
  color: var(--text-color-secondary);
  font-size: 12px;
}
</style>
