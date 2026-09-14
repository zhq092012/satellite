<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 场景操作：添加 / 修改当前场景（即战场） -->
    <div class="panel-header">
      <button type="button" class="scene-action-btn" @click="openCreateScene">添加场景</button>
      <button type="button" class="scene-action-btn" :disabled="!store.battle" title="修改当前选择的场景" @click="openEditScene">
        修改场景
      </button>
      <button type="button" class="scene-action-btn" @click="openCreateTask">添加任务</button>
    </div>

    <!-- 当前战场下的任务列表容器（占满面板剩余高度） -->
    <div class="task-section">
      <div v-if="taskLoading && !taskList.length" class="task-list-box is-loading">
        <div class="task-loading-mask">
          <span class="task-loading-spinner" aria-hidden="true" />
          <span class="task-loading-text">正在加载任务数据...</span>
        </div>
      </div>

      <div v-else-if="taskList.length > 0" class="task-list-box" :class="{ 'is-loading': taskSwitching }">
        <div v-if="taskSwitching" class="task-loading-mask task-loading-mask--light">
          <span class="task-loading-spinner" aria-hidden="true" />
          <span class="task-loading-text">正在切换任务...</span>
        </div>

        <div class="task-list-header">
          <!-- 从左到右：当前场景、任务数量、当前任务 -->
          <span
            class="task-header-text"
            :title="`当前场景：${store.battle?.name || '未选择'}（包含${taskList.length}个任务），当前任务：${store.activedTask?.name || '未选择'}`"
          >
            当前场景：{{ store.battle?.name || '未选择' }}（包含{{ taskList.length }}个任务），当前任务：{{ store.activedTask?.name || '未选择' }}
          </span>
        </div>

        <div class="task-scroll-list">
          <div v-for="task in taskList" :key="task.id" class="task-item-card"
            :class="{ active: store.activedTask?.id === task.id, disabled: taskSwitching }" @click="selectTask(task)">
            <div class="task-card-top">
              <span class="task-name" :title="task.name">{{ task.name }}</span>
              <button type="button" class="task-edit-btn" :disabled="taskSwitching" title="修改任务"
                @click.stop="openEditTask(task)">
                修改任务
              </button>
            </div>

            <div class="task-card-fields">
              <div class="field-row">
                <span class="field-label">作战目标</span>
                <span class="field-val field-val--target" :title="displayTaskValue(task.targetType)">
                  {{ displayTaskValue(task.targetType) }}
                </span>
              </div>
              <div class="field-row">
                <span class="field-label">红方</span>
                <span class="field-val" :title="displayTaskValue(task.meCountry)">
                  {{ displayTaskValue(task.meCountry) }}
                </span>
              </div>
              <div class="field-row">
                <span class="field-label">敌方</span>
                <span class="field-val field-val--enemy" :title="displayTaskValue(task.enemyCountry)">
                  {{ displayTaskValue(task.enemyCountry) }}
                </span>
              </div>
              <div class="field-row">
                <span class="field-label">开始时间</span>
                <span class="field-val field-val--time">{{ formatTaskDate(task.beginDate) }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">结束时间</span>
                <span class="field-val field-val--time">{{ formatTaskDate(task.endDate) }}</span>
              </div>
              <div class="field-row">
                <span class="field-label">任务概述</span>
                <span class="field-val field-val--desc" :title="displayTaskValue(task.description)">
                  {{ displayTaskValue(task.description) }}
                </span>
              </div>
              <div class="field-row">
                <span class="field-label">关注状态</span>
                <span class="field-val" :class="task.focusStatus === 1 ? 'is-focus' : 'is-muted'">
                  {{ task.focusStatus === 1 ? '已关注' : '未关注' }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div v-else class="task-empty-tip">
        当前场景暂无任务数据
      </div>
    </div>

    <TaskEditDialog v-model="taskEditVisible" :is-edit="taskEditIsEdit" :task="editingTask" @saved="handleTaskSaved" />
    <SceneEditDialog v-model="sceneEditVisible" :is-edit="sceneEditIsEdit" :scene="editingScene"
      @saved="handleSceneSaved" />
  </aside>
</template>

<script setup lang="ts">
/**
 * [功能]
 * 战场态势 - C2 左侧场景任务列表控制面板
 *
 * [处理规则]
 * - 集中展示当前场景（战场）下的所有任务列表
 * - 顶栏切换场景后根据 battle.id 重新拉取并展示任务
 * - 顶部提供添加场景、修改当前场景
 * - 点击任务一键切换全局当前任务，联动刷新全局 Store 方案与矩阵数据
 */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getTaskList } from '@/api/dashboard'
import type { BattleForm, TaskForm } from '@/types/dashboard'
import type { MatrixResult } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'
import SceneEditDialog from '@/components/BattleSituation/SceneEditDialog.vue'

/** 组件接收的矩阵数据及当前选中卫星信息（保持与父组件传参兼容） */
defineProps<{
  /** 算法矩阵响应式数据 */
  matrixData?: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

/** 组件向父级触发的事件（保持兼容，任务列表不再直接选星） */
defineEmits<{
  (e: 'select-satellite', norad: number | null): void
}>()

/** 布局 Store，用于读取当前战场、当前任务及持久化状态。 */
const store = useLayoutStore()

/** 当前战场下的任务列表数据 */
const taskList = ref<TaskForm[]>([])
/** 任务列表是否正在加载中 */
const taskLoading = ref(false)
/** 任务切换中状态 */
const taskSwitching = ref(false)
/** 任务对话框是否可见 */
const taskEditVisible = ref(false)
/** 任务对话框是否为修改模式（false 为添加任务） */
const taskEditIsEdit = ref(false)
/** 当前正在编辑的任务；添加任务时为 null */
const editingTask = ref<TaskForm | null>(null)
/** 添加 / 修改场景对话框是否可见 */
const sceneEditVisible = ref(false)
/** 场景对话框是否为修改模式 */
const sceneEditIsEdit = ref(false)
/** 当前正在编辑的场景（修改模式为当前战场） */
const editingScene = ref<BattleForm | null>(null)

/**
 * 拉取当前场景（战场）下的全部任务并展示在左侧列表。
 * 顶栏切换场景后会因 battle.id 变化自动触发。
 *
 * @returns 无返回值；接口失败时回退到 Store 中已缓存的 tasks
 */
const loadBattleTasks = async () => {
  const battleId = store.battle?.id
  if (!battleId) {
    taskList.value = store.battle?.tasks || []
    return
  }
  taskLoading.value = true
  taskList.value = []
  try {
    const res = await getTaskList(battleId)
    if (res.code === 200 && Array.isArray(res.data)) {
      taskList.value = res.data
    } else {
      taskList.value = store.battle?.tasks || []
    }
  } catch (error) {
    console.error('加载场景任务列表失败:', error)
    taskList.value = store.battle?.tasks || []
  } finally {
    taskLoading.value = false
  }
}

watch(
  () => store.battle?.id,
  () => {
    loadBattleTasks()
  },
  { immediate: true }
)

/**
 * 将任务时间格式化为「日期 + 时分秒」展示。
 *
 * @param dateStr 任务开始/结束时间字符串
 * @returns `YYYY-MM-DD HH:mm:ss`；无法解析时回退为原字符串，空值显示 `--`
 */
const formatTaskDate = (dateStr?: string) => {
  if (!dateStr) return '--'
  const ts = new Date(dateStr.replace(/-/g, '/')).getTime()
  if (!Number.isFinite(ts) || Number.isNaN(ts)) {
    return dateStr.trim() || '--'
  }
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 任务字段空值展示。
 *
 * @param value 原始文本
 * @returns 有内容时返回原文，否则 `--`
 */
const displayTaskValue = (value?: string) => {
  const text = (value || '').trim()
  return text || '--'
}

/**
 * 打开添加场景对话框。
 */
const openCreateScene = () => {
  sceneEditIsEdit.value = false
  editingScene.value = null
  sceneEditVisible.value = true
}

/**
 * 打开添加任务对话框。必须先选择当前场景，以便把任务挂到该战场下。
 */
const openCreateTask = () => {
  if (!store.battle?.id) {
    ElMessage.warning('请先选择当前场景后再添加任务')
    return
  }
  taskEditIsEdit.value = false
  editingTask.value = null
  taskEditVisible.value = true
}

/**
 * 打开修改当前场景对话框。
 */
const openEditScene = () => {
  if (!store.battle) {
    ElMessage.warning('请先在顶部选择当前场景')
    return
  }
  sceneEditIsEdit.value = true
  editingScene.value = store.battle
  sceneEditVisible.value = true
}

/**
 * 场景保存成功后同步当前战场，并刷新任务列表。
 * 若是新增场景（ID 变化），则清空或选中该场景下的第一个任务。
 *
 * @param scene 保存后的场景数据
 */
const handleSceneSaved = async (scene: BattleForm) => {
  const prevId = store.battle?.id
  store.setActivedBattle(scene)
  await loadBattleTasks()
  if (scene.id !== prevId) {
    store.setActivedTask(taskList.value[0] ?? null)
    store.setSelectedSatSeries('')
  }
}

/**
 * 打开任务修改对话框，不切换当前任务。
 *
 * @param task 列表中的任务项
 */
const openEditTask = (task: TaskForm) => {
  if (taskSwitching.value) return
  taskEditIsEdit.value = true
  editingTask.value = task
  taskEditVisible.value = true
}

/**
 * 任务保存成功后刷新列表。
 * 新增任务会切到该任务并加载矩阵；修改当前任务则同步 Store 后重拉矩阵。
 *
 * @param updated 提交后的任务数据
 */
const handleTaskSaved = async (updated: TaskForm) => {
  await loadBattleTasks()
  if (!updated.id) return

  const latest = taskList.value.find((item) => item.id === updated.id) || updated
  const isCurrentTask = store.activedTask?.id === updated.id
  const isNewTask = !isCurrentTask

  if (!isCurrentTask && !isNewTask) return

  store.setActivedTask(latest)
  if (isNewTask) {
    store.setSelectedSatSeries('')
    ElMessage.success(`已切换到新任务：${latest.name}`)
  }

  try {
    if (isNewTask) {
      await store.ensureActiveZhchPlan(true)
    }
    await store.fetchMatrixForCurrentScope(true)
  } catch (error) {
    console.error('刷新任务矩阵失败:', error)
  }
}

/**
 * [函数说明]
 * 切换选中的任务，并触发全局 Store 数据更新
 * @param task 选中的任务对象
 */
const selectTask = async (task: TaskForm) => {
  if (taskLoading.value || taskSwitching.value) return
  if (store.activedTask?.id === task.id) return
  taskSwitching.value = true
  try {
    store.setActivedTask(task)
    store.setSelectedSatSeries('')
    ElMessage.success(`已切换当前任务：${task.name}`)
    await store.ensureActiveZhchPlan(true)
    await store.fetchMatrixForCurrentScope(true)
  } catch (err) {
    console.error('切换任务失败:', err)
  } finally {
    taskSwitching.value = false
  }
}
</script>

<style scoped lang="scss">
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  color: #e2efff;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  overflow: hidden;
  gap: 10px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  flex-shrink: 0;

  .scene-action-btn {
    flex: 1;
    min-width: 0;
    height: 32px;
    padding: 0 10px;
    font-size: 13px;
    font-weight: 700;
    color: #7dd3fc;
    background: rgba(0, 225, 255, 0.08);
    border: 1px solid rgba(0, 225, 255, 0.35);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.18s ease;

    &:hover:not(:disabled) {
      color: #40f2ff;
      border-color: #00e1ff;
      background: rgba(0, 225, 255, 0.18);
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
}

.task-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;

  .task-list-box {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    flex: 1;
    min-height: 0;
    height: 100%;
    box-sizing: border-box;
    background: rgba(12, 22, 38, 0.75);
    border: 1px dashed rgba(0, 225, 255, 0.25);
    border-radius: 6px;

    &.is-loading .task-scroll-list {
      pointer-events: none;
      opacity: 0.5;
    }

    .task-loading-mask {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border-radius: 6px;
      background: rgba(8, 15, 26, 0.78);
      pointer-events: all;

      &--light {
        background: rgba(8, 15, 26, 0.45);
      }
    }

    .task-loading-spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(0, 225, 255, 0.2);
      border-top-color: #00e1ff;
      border-radius: 50%;
      animation: task-panel-spin 0.8s linear infinite;
    }

    .task-loading-text {
      font-size: 11px;
      font-weight: 600;
      color: #7dd3fc;
      letter-spacing: 0.5px;
    }

    .task-list-header {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-size: 11px;
      color: #7dd3fc;
      padding-bottom: 6px;
      border-bottom: 1px rgba(0, 225, 255, 0.15) solid;
      flex-shrink: 0;
      min-width: 0;

      /* 单行从左到右展示，过长时省略 */
      .task-header-text {
        min-width: 0;
        font-weight: 600;
        color: #40f2ff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }


    .task-scroll-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 6px 3px 6px 2px;

      &::-webkit-scrollbar {
        width: 4px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(0, 225, 255, 0.3);
        border-radius: 3px;
      }

      .task-item-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        background: rgba(18, 36, 62, 0.6);
        border: 1px solid rgba(79, 147, 221, 0.22);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.22s ease;
        box-sizing: border-box;

        .task-card-top {
          display: flex;
          align-items: center;
          gap: 8px;

          .task-name {
            flex: 1;
            min-width: 0;
            font-weight: 600;
            font-size: 16px;
            color: #e2efff;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .task-edit-btn {
            flex-shrink: 0;
            height: 24px;
            padding: 0 8px;
            font-size: 14px;
            line-height: 22px;
            color: #7dd3fc;
            background: rgba(0, 225, 255, 0.08);
            border: 1px solid rgba(0, 225, 255, 0.35);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.18s ease;

            &:hover {
              color: #40f2ff;
              border-color: #00e1ff;
              background: rgba(0, 225, 255, 0.18);
            }

            &:disabled {
              opacity: 0.45;
              cursor: not-allowed;
            }
          }
        }

        .task-card-fields {
          display: flex;
          flex-direction: column;
          gap: 5px;
          font-size: 14px;
          font-weight: 600;

          .field-row {
            display: grid;
            grid-template-columns: 64px minmax(0, 1fr);
            align-items: start;
            column-gap: 8px;
            min-width: 0;
          }

          .field-label {
            line-height: 1.45;
            color: #64748b;
            flex-shrink: 0;

          }

          .field-val {
            min-width: 0;
            line-height: 1.45;
            color: #cbd5e1;
            word-break: break-word;
            text-align: left;


            &.field-val--target {
              color: #38bdf8;
            }

            &.field-val--enemy {
              color: #fda4af;
            }

            &.field-val--time {
              font-family: Consolas, 'Courier New', monospace;
              color: #e2e8f0;
            }

            &.field-val--desc {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              color: #94a3b8;
            }

            &.is-focus {
              color: #fbbf24;
            }

            &.is-muted {
              color: #64748b;
            }
          }
        }

        &:hover {
          border-color: rgba(0, 225, 255, 0.55);
          background: rgba(24, 52, 88, 0.85);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

          .task-card-top .task-name {
            color: #ffffff;
          }
        }

        &.active {
          background: rgba(0, 225, 255, 0.12);
          border-color: #00e1ff;
          box-shadow: 0 0 12px rgba(0, 225, 255, 0.25);

          .task-card-top .task-name {
            color: #40f2ff;
            text-shadow: 0 0 8px rgba(0, 225, 255, 0.4);
          }
        }

        &.disabled {
          cursor: not-allowed;
          pointer-events: none;
          opacity: 0.55;
        }
      }
    }
  }

  .task-empty-tip {
    padding: 36px 12px;
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.55);
    text-align: center;
    border: 1px dashed rgba(79, 147, 221, 0.35);
    border-radius: 6px;
    background: rgba(12, 22, 38, 0.75);
  }
}

@keyframes task-panel-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
