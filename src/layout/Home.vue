<template>
  <div class="home-container">
    <!-- 顶层菜单栏 -->
    <header class="top-nav-bar">
      <!-- 中间：四个功能切换按钮 -->
      <div class="menu-tabs">
        <button v-for="tab in menuTabs" :key="tab.key" class="menu-btn" :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)">
          <!-- <span class="btn-icon">{{ tab.icon }}</span> -->
          <span class="btn-label">{{ tab.name }}</span>
        </button>
      </div>

      <!-- 当前打击方案切换 -->
      <div v-if="store.activedTask" class="plan-switch-bar">
        <span class="plan-switch-label">当前打击方案：</span>
        <button v-for="type in ZHCH_USAGE_TYPE_OPTIONS" :key="type" class="plan-switch-btn"
          :class="{ active: store.activeZhchUsageType === type }" :disabled="planSwitching"
          @click="handleSwitchPlan(type)">
          {{ getZhchUsageTypeLabel(type) }}
        </button>
      </div>

      <!-- 右侧：战场与任务显示 / 切换区域 -->
      <div class="task-status-bar">
        <!-- 场景 A：已选择战场和任务 -->
        <div v-if="store.battle && store.activedTask" class="task-info-badge" @click="openTaskSelector">
          <span class="battle-name"> {{ store.battle.name }}</span>
          <span class="divider">/</span>
          <span class="task-name"> {{ store.activedTask.name }}</span>
          <el-button type="primary" size="small" link class="switch-btn">切换任务</el-button>
        </div>

        <!-- 场景 B：尚未选择战场任务，突出提醒 -->
        <div v-else class="task-prompt-badge" @click="openTaskSelector">
          <el-tag type="warning" effect="dark" round class="prompt-tag"> ⚠️ 尚未选择战场任务（点击选择） </el-tag>
        </div>
      </div>
    </header>

    <!-- 下层内容展示区域 -->
    <main class="bottom-content">
      <keep-alive
        :include="['BattleSituation', 'ElectronicWarfareG6', 'SatelliteGantt', 'WeaponAttackList', 'StrikePlanGenerator']">
        <component :is="currentComponent" :key="activeTab" />
      </keep-alive>
    </main>

    <!-- 战场与任务选择模态弹窗 -->
    <el-dialog v-model="selectorDialogVisible" title=" 选择战场与任务" width="540px" append-to-body
      class="task-selector-dialog">
      <div class="dialog-body" v-loading="loadingData">
        <!-- 级联选择器 -->
        <el-form>
          <el-form-item>
            <el-cascader v-model="selectedCascadeValue" :options="battleTaskOptions"
              :props="{ expandTrigger: 'hover', value: 'id', label: 'name', children: 'children' }"
              placeholder="请选择 战场 / 任务" style="width: 100%" filterable @change="handleCascaderChange" />
          </el-form-item>
        </el-form>

        <!-- 战场-任务 快捷选择列表 -->
        <div class="quick-battle-tree" v-if="battleListWithTasks.length > 0">
          <div class="tree-title">快捷选择列表：</div>
          <el-scrollbar max-height="260px">
            <div v-for="battle in battleListWithTasks" :key="battle.id" class="battle-group">
              <div class="battle-group-name"> {{ battle.name }}</div>
              <div class="task-chips">
                <div v-for="task in battle.tasks" :key="task.id" class="task-chip"
                  :class="{ active: store.activedTask?.id === task.id }" @click="selectBattleAndTask(battle, task)">
                  {{ task.name }}
                </div>
                <div v-if="!battle.tasks || battle.tasks.length === 0" class="no-task">暂无所属任务</div>
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>

      <template #footer>
        <el-button @click="selectorDialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!pendingSelection" @click="confirmTaskSelection"> 确认选择 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import BattleSituation from '@/components/BattleSituation/BattleSituation.vue'
import ElectronicWarfareG6 from '@/components/electronic/ElectronicWarfareG6.vue'
import SatelliteGantt from '@/components/electronic/SatelliteGantt.vue'
import WeaponAttackList from '@/components/electronic/WeaponAttackList.vue'
import StrikePlanGenerator from '@/components/electronic/StrikePlanGenerator.vue'
import { useLayoutStore, ZHCH_USAGE_TYPE_OPTIONS, getZhchUsageTypeLabel } from '@/store/modules/layout'
import { getBattleList, getTaskList } from '@/api/dashboard'
import type { BattleForm, TaskForm } from '@/types/dashboard'
import { ElMessage } from 'element-plus'

defineOptions({ name: 'Home' })

/** [变量说明] 全局 Store */
const store = useLayoutStore()

/** 打击方案切换中 */
const planSwitching = ref(false)

/**
 * 切换当前激活的综合打击方案
 * @param type 用途类型
 */
const handleSwitchPlan = async (type: string) => {
  if (store.activeZhchUsageType === type || planSwitching.value) return
  planSwitching.value = true
  try {
    await store.setActiveZhchUsageType(type)
  } finally {
    planSwitching.value = false
  }
}

/**
 * [类型定义]
 * 顶部导航菜单项配置接口
 */
interface MenuTabItem {
  key: string
  name: string
  icon: string
  component: Component
}

/** [变量说明] 当前激活的菜单项 Key（与 Store 同步） */
const activeTab = computed({
  get: () => store.mainActiveTab,
  set: (key: string) => store.setMainActiveTab(key),
})

/** [变量说明] 顶层四个切换菜单按钮配置 */
const menuTabs: MenuTabItem[] = [
  { key: '整体态势分析', name: '整体态势分析', icon: '🌐', component: BattleSituation },
  { key: '态势拓扑分析', name: '态势拓扑分析', icon: '🕸️', component: ElectronicWarfareG6 },
  { key: '甘特图分析', name: '甘特图分析', icon: '📊', component: SatelliteGantt },
  { key: '打击窗口分析', name: '打击窗口分析', icon: '🎯', component: WeaponAttackList },
  { key: '打击方案生成', name: '打击方案生成', icon: '⚔️', component: StrikePlanGenerator },
]

/** [计算属性说明] 动态组件引用 */
const currentComponent = computed<Component>(() => {
  const targetTab = menuTabs.find((item) => item.key === activeTab.value)
  return targetTab ? targetTab.component : BattleSituation
})

/**
 * [函数说明] 切换顶部导航菜单
 * @param key 目标菜单 Key
 */
const switchTab = (key: string) => {
  store.setMainActiveTab(key)
}

/** [变量说明] 任务选择弹窗显隐控制 */
const selectorDialogVisible = ref(false)
/** [变量说明] 战场与任务数据加载状态 */
const loadingData = ref(false)
/** [变量说明] 包含完整任务列表的战场数据列表 */
const battleListWithTasks = ref<BattleForm[]>([])
/** [变量说明] Cascader 级联选择器绑定的路径 */
const selectedCascadeValue = ref<string[]>([])
/** [变量说明] 暂存待确认的战场与任务 */
const pendingSelection = ref<{ battle: BattleForm; task: TaskForm } | null>(null)

/** [计算属性说明] 转换为 Cascader 选项数据 */
const battleTaskOptions = computed(() => {
  return battleListWithTasks.value.map((battle) => ({
    id: `battle_${battle.id}`,
    name: `${battle.name}`,
    battleObj: battle,
    children: (battle.tasks || []).map((task) => ({
      id: `task_${task.id}`,
      name: `${task.name}`,
      taskObj: task,
      battleObj: battle,
    })),
  }))
})

/**
 * [函数说明] 加载战场及其对应的关联任务列表
 */
const loadBattleAndTaskData = async () => {
  loadingData.value = true
  try {
    const res = await getBattleList()
    if (res.code === 200 && Array.isArray(res.data)) {
      const list = res.data
      await Promise.all(
        list.map(async (battle) => {
          if (battle.id) {
            const taskRes = await getTaskList(battle.id)
            if (taskRes.code === 200 && Array.isArray(taskRes.data)) {
              battle.tasks = taskRes.data
            }
          }
        })
      )
      battleListWithTasks.value = list
    }
  } catch (error) {
    console.error('加载战场任务列表失败:', error)
  } finally {
    loadingData.value = false
  }
}

/**
 * [函数说明] 打开战场任务选择弹窗
 */
const openTaskSelector = async () => {
  selectorDialogVisible.value = true
  if (battleListWithTasks.value.length === 0) {
    await loadBattleAndTaskData()
  }
}

/**
 * [函数说明] Cascader 选择变更回调
 * @param val 选中的节点 ID 路径数组
 */
const handleCascaderChange = (val: any) => {
  if (Array.isArray(val) && val.length === 2) {
    const taskIdStr = val[1]
    for (const battle of battleListWithTasks.value) {
      const matchedTask = (battle.tasks || []).find((t) => `task_${t.id}` === taskIdStr)
      if (matchedTask) {
        pendingSelection.value = { battle, task: matchedTask }
        break
      }
    }
  }
}

/**
 * [函数说明] 快捷芯片列表项选择任务
 * @param battle 战场对象
 * @param task 任务对象
 */
const selectBattleAndTask = (battle: BattleForm, task: TaskForm) => {
  pendingSelection.value = { battle, task }
  selectedCascadeValue.value = [`battle_${battle.id}`, `task_${task.id}`]
}

/**
 * [函数说明] 确认选择并写入全局 Store
 */
const confirmTaskSelection = async () => {
  if (pendingSelection.value) {
    const { battle, task } = pendingSelection.value
    store.setActivedBattle(battle)
    store.setActivedTask(task)
    selectorDialogVisible.value = false
    ElMessage.success(`已设置当前任务：${battle.name} / ${task.name}`)
    await store.ensureActiveZhchPlan(true)
    await store.fetchMatrixForCurrentScope(true)
  }
}

onMounted(async () => {
  await loadBattleAndTaskData()

  if (store.activedTask?.id) {
    await store.ensureActiveZhchPlan(false)
    await store.fetchMatrixForCurrentScope(false)
  }

  if (!store.battle || !store.activedTask) {
    selectorDialogVisible.value = true
  }
})
</script>

<style lang="scss" scoped>
.home-container {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: calc(100vh - 60px);
  overflow: hidden;
  background-color: #0b1528;

  /* 顶层菜单栏样式 */
  .top-nav-bar {
    height: 52px;
    padding: 0 20px;
    background: linear-gradient(180deg, rgba(12, 28, 48, 0.95) 0%, rgba(8, 20, 36, 0.98) 100%);
    border-bottom: 1px solid rgba(79, 147, 221, 0.3);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 1000;
    flex-shrink: 0;

    .brand-title {
      display: flex;
      align-items: center;
      gap: 8px;

      .brand-icon {
        font-size: 20px;
      }

      .brand-text {
        font-size: 16px;
        font-weight: bold;
        color: #eaf3ff;
        letter-spacing: 0.5px;
        background: linear-gradient(90deg, #ffffff 0%, #4f93dd 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
    }

    .menu-tabs {
      display: flex;
      align-items: center;
      gap: 12px;

      .menu-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 18px;
        font-size: 16px;
        font-weight: 600;
        color: #8eb3d6;
        background: rgba(16, 36, 62, 0.6);
        border: 1px solid rgba(79, 147, 221, 0.25);
        cursor: pointer;
        outline: none;
        transition: all 0.25s ease;

        .btn-icon {
          font-size: 16px;
        }

        &:hover {
          color: #ffffff;
          border-color: rgba(0, 225, 255, 0.5);
          background: rgba(24, 52, 88, 0.8);
          box-shadow: 0 0 10px rgba(0, 225, 255, 0.2);
        }

        &.active {
          color: #ffffff;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(79, 147, 221, 0.8) 0%, rgba(0, 180, 216, 0.9) 100%);
          border-color: #00e1ff;
          box-shadow: 0 0 12px rgba(0, 225, 255, 0.4);
        }
      }
    }

    .plan-switch-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin: 0 12px;

      .plan-switch-label {
        font-size: 14px;
        font-weight: 600;
        color: #94a3b8;
        white-space: nowrap;
      }

      .plan-switch-btn {
        padding: 5px 12px;
        font-size: 13px;
        font-weight: 600;
        color: #8eb3d6;
        background: rgba(16, 36, 62, 0.7);
        border: 1px solid rgba(79, 147, 221, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;

        &:hover:not(:disabled) {
          color: #fff;
          border-color: rgba(0, 225, 255, 0.5);
        }

        &.active {
          color: #fff;
          background: linear-gradient(135deg, rgba(79, 147, 221, 0.8) 0%, rgba(0, 180, 216, 0.9) 100%);
          border-color: #00e1ff;
          box-shadow: 0 0 12px rgba(0, 225, 255, 0.4);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }

    /* 右侧：战场与任务指示状态栏 */
    .task-status-bar {
      display: flex;
      align-items: center;

      .task-info-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 14px;
        background: rgba(14, 38, 66, 0.8);
        border: 1px solid rgba(79, 147, 221, 0.35);
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.25s ease;
        font-size: 15px;

        &:hover {
          border-color: #00e1ff;
          box-shadow: 0 0 12px rgba(0, 225, 255, 0.25);
        }

        .battle-name {
          color: #00e1ff;
          font-weight: bold;
        }

        .divider {
          color: #8eb3d6;
        }

        .task-name {
          color: #ffffff;
        }

        .switch-btn {
          margin-left: 4px;
          color: #4f93dd;
          font-size: 15px;
        }
      }

      .task-prompt-badge {
        cursor: pointer;

        .prompt-tag {
          font-size: 13px;
          padding: 6px 14px;
          cursor: pointer;
          transition: transform 0.2s ease;

          &:hover {
            transform: scale(1.04);
          }
        }
      }
    }
  }

  /* 下层内容展示区域 */
  .bottom-content {
    flex: 1;
    position: relative;
    width: 100%;
    height: calc(100vh - 52px);
    overflow: hidden;
  }
}

/* 战场与任务选择模态框深色主旨样式 */
:deep(.task-selector-dialog) {
  .el-dialog {
    background: #0d1e36 !important;
    border: 1px solid rgba(79, 147, 221, 0.35) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6) !important;
    border-radius: 10px;

    .el-dialog__header {
      padding: 16px 20px 10px 20px;
      border-bottom: 1px solid rgba(79, 147, 221, 0.2);

      .el-dialog__title {
        color: #ffffff !important;
        font-size: 16px;
        font-weight: bold;
      }

      .el-dialog__headerbtn .el-dialog__close {
        color: #94a3b8 !important;

        &:hover {
          color: #00e1ff !important;
        }
      }
    }

    .el-dialog__body {
      padding: 16px 20px;
      color: #e2e8f0;
    }

    .el-dialog__footer {
      padding: 12px 20px;
      border-top: 1px solid rgba(79, 147, 221, 0.2);
    }
  }
}

.dialog-body {
  .form-tip {
    font-size: 13px;
    color: #94a3b8;
    margin-bottom: 16px;
  }

  :deep(.el-form-item__label) {
    color: #cbd5e1 !important;
    font-weight: 500;
  }

  .quick-battle-tree {
    margin-top: 16px;
    border-top: 1px dashed rgba(79, 147, 221, 0.25);
    padding-top: 14px;

    .tree-title {
      font-size: 14px;
      font-weight: bold;
      color: #ffffff;
      /* 快捷选择列表字样改为白色 */
      margin-bottom: 12px;
    }

    .battle-group {
      margin-bottom: 12px;
      padding: 10px 14px;
      background: rgba(16, 36, 62, 0.6);
      border: 1px solid rgba(79, 147, 221, 0.25);
      border-radius: 8px;

      .battle-group-name {
        font-size: 14px;
        font-weight: bold;
        color: #00e1ff;
        margin-bottom: 8px;
      }

      .task-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .task-chip {
          padding: 5px 14px;
          font-size: 12px;
          color: #e2e8f0;
          background: rgba(8, 20, 36, 0.9);
          border: 1px solid rgba(79, 147, 221, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.25s ease;

          &:hover {
            border-color: #00e1ff;
            color: #00e1ff;
            background: rgba(0, 225, 255, 0.12);
            box-shadow: 0 0 8px rgba(0, 225, 255, 0.2);
          }

          &.active {
            background: linear-gradient(135deg, rgba(79, 147, 221, 0.8) 0%, rgba(0, 180, 216, 0.9) 100%);
            color: #ffffff;
            font-weight: 600;
            border-color: #00e1ff;
            box-shadow: 0 0 10px rgba(0, 225, 255, 0.4);
          }
        }

        .no-task {
          font-size: 12px;
          color: #64748b;
        }
      }
    }
  }
}
</style>
