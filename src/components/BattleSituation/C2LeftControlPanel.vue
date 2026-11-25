<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <div class="panel-body">
      <div v-if="taskSwitching" class="zone-loading">正在切换任务...</div>
      <div v-else-if="taskLoading" class="zone-loading">正在加载任务列表...</div>
      <div v-else class="task-panel">
        <section class="task-panel-block task-panel-block--tasks">
          <template v-if="taskList.length">
            <div class="task-panel-section-head">任务列表</div>
            <el-select
              v-model="activeTaskId"
              class="task-panel-task-select"
              placeholder="选择任务"
              filterable
              @change="handleSwitchTask"
            >
              <el-option v-for="task in taskList" :key="task.id" :label="task.name" :value="task.id" />
            </el-select>
          </template>
          <template v-else-if="store.command?.id">
            <button type="button" class="task-create-entry" @click="openCreateTask">新建任务</button>
          </template>
          <p v-else class="task-panel-hint">请先选择或创建命令</p>
        </section>

        <div v-if="taskList.length && !store.activedTask" class="zone-empty">请选择任务</div>
        <template v-else-if="store.activedTask">
          <section class="task-panel-block task-panel-block--meta">
            <div class="task-panel-row task-panel-row--name">
              <span class="task-panel-label">任务名称</span>
              <span class="task-panel-value task-panel-name" :title="store.activedTask.name">{{ store.activedTask.name
              }}</span>
              <button type="button" class="task-edit-link" @click="openEditTask">编辑</button>
            </div>
            <div class="task-panel-row">
              <span class="task-panel-label">作战阶段</span>
              <span class="task-panel-value" :title="currentCombatPhaseLabel">{{ currentCombatPhaseLabel }}</span>
            </div>
            <div class="task-panel-row task-panel-row--objects">
              <span class="task-panel-label">作战对象</span>
              <div class="combat-object-options" role="group" aria-label="当前作战对象">
                <button v-for="country in combatObjectCountryOptions" :key="country" type="button"
                  class="combat-object-chip" :class="{
                    'combat-object-chip--active': isTaskCombatObjectActive(country),
                    'combat-object-chip--inactive': !isTaskCombatObjectActive(country),
                    'combat-object-chip--tree-focus': treeSortFocusCountry === country,
                  }" @click="handleCombatObjectCountryClick(country)">
                  <span class="combat-object-label">{{ country }}</span>
                </button>
              </div>
            </div>
            <div class="task-panel-row task-panel-row--expectation">
              <span class="task-panel-label">作战预期</span>
              <div class="task-panel-expectation">
                <span class="task-panel-value" :title="currentCombatExpectationPrimaryLabel">{{
                  currentCombatExpectationPrimaryLabel }}</span>
                <span class="task-panel-expectation-sep">/</span>
                <span class="task-panel-value task-panel-expectation-secondary"
                  :title="currentCombatExpectationSecondaryLabel">{{ currentCombatExpectationSecondaryLabel }}</span>
              </div>
            </div>
          </section>

          <section class="task-panel-block task-panel-block--tree">
            <div class="task-panel-section-head">任务资源</div>
            <p v-if="catalogSourceHint" class="task-panel-hint">{{ catalogSourceHint }}</p>
            <div v-loading="treeBootLoading" class="task-panel-block-body task-panel-block-body--tree">
              <div v-if="!treeBootLoading && !c2PanelResourceTreeNodes.length"
                class="task-panel-hint task-panel-hint--center">
                暂无卫星资源
              </div>
              <el-tree v-show="c2PanelResourceTreeNodes.length > 0" ref="resourceTreeRef" class="c2-resource-tree"
                :data="c2PanelResourceTreeNodes" node-key="id" show-checkbox :check-on-click-node="false"
                v-model:expanded-keys="c2TreeExpandedKeys" :props="resourceTreeProps" @check="handleResourceTreeCheck">
                <template #default="{ node, data }">
                  <span class="c2-resource-tree-node-label" :class="{
                    'c2-resource-tree-node-label--focus':
                      data.kind === 'country' && data.label === treeSortFocusCountry,
                  }">{{ node.label }}</span>
                </template>
              </el-tree>
            </div>
          </section>

          <div class="task-panel-weapon-dock">
            <section v-if="useWeaponsEnabled" class="task-panel-block task-panel-block--weapons">
              <div class="task-panel-section-head">武器列表</div>
              <div class="task-panel-block-body task-panel-block-body--table">
                <div v-if="weaponOptionsLoading" class="task-panel-hint task-panel-hint--center">正在加载武器...</div>
                <div v-else-if="!weaponTableRows.length" class="task-panel-hint task-panel-hint--center">暂无武器候选项</div>
                <el-table v-else ref="weaponTableRef" :data="weaponTableRows" size="small" class="c2-resource-table"
                  max-height="128" empty-text="暂无武器" @selection-change="handleWeaponSelectionChange">
                  <el-table-column type="selection" width="32" />
                  <el-table-column prop="name" label="武器名称" min-width="1" />
                  <el-table-column prop="type" label="武器类型" min-width="1" />
                  <el-table-column label="纬度" min-width="1" align="right">
                    <template #default="{ row }">{{ formatWeaponCoordinate(row.latitude) }}</template>
                  </el-table-column>
                  <el-table-column label="经度" min-width="1" align="right">
                    <template #default="{ row }">{{ formatWeaponCoordinate(row.longitude) }}</template>
                  </el-table-column>
                </el-table>
              </div>
            </section>

            <section class="task-panel-block task-panel-block--switch">
              <div class="weapon-use-item">
                <span class="weapon-use-item-label">是否使用武器</span>
                <el-switch v-model="useWeaponsEnabled" size="small" @change="handleUseWeaponsChange" />
              </div>
            </section>
          </div>
        </template>
      </div>
    </div>
    <TaskEditDialog v-model="taskEditVisible" :is-edit="taskEditIsEdit" :task="editingTask" @saved="handleTaskSaved" />
  </aside>
</template>
<script setup lang="ts">
/**
 * 战场态势 - C2 左侧面板：任务摘要、作战阶段/对象、三国资源树、武器配置。
 */
import { computed, nextTick, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ElTable } from 'element-plus'
import type { ElTree } from 'element-plus'
import { getTaskList, updateTask } from '@/api/task/task'
import { loadSatelliteSeriesDataForCountries } from '@/api/satellite/satellite'
import {
  getSeriesTaskSatellitesFromPanelTreeCache,
  loadSatelliteResourceTreeRootsForPanel,
} from '@/utils/satelliteResourceTreeStoreCache'
import type { TaskForm } from '@/api/task/task'
import type { TaskResourceItem } from '@/types/task/task'
import type { SatelliteTreeCountryNode } from '@/types/satellite/satellite'
import type { Weapon } from '@/types/dashboard'
import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'
import {
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
} from '@/config/combatScenarioOptions'
import { resolveCombatScenarioSelectionFromCommand } from '@/utils/commandEntity'
import {
  normalizeTaskListFromApi,
  resolveCombatCountriesFromTask,
  resolveCombatScenarioSelectionFromTask,
} from '@/utils/taskEntity'
import { isSameCommandId } from '@/utils/commandEntity'
import {
  buildTaskScopedInventoryFromApiTreeRoots,
  pruneSatelliteResourceTreeByTaskSatellites,
} from '@/utils/satelliteResourceTree'
import { MISSION_SYS_TYPES, TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import {
  createDraftFromTask,
  mergeTaskFormWithDraft,
  parseTaskPanelTimeMs,
  readTaskWeaponResourceIds,
  writeTaskWeaponResourceIds,
} from '@/utils/c2TaskPanelEditor'
import {
  parseSeriesApiBuckets,
  buildC2FlatRowsFromSatelliteResourceTree,
  buildC2PanelCountryNodeId,
  buildC2PanelFilterKeysFromSeriesCheckStates,
  buildC2PanelResourceTreeFromApiRoots,
  buildC2PanelSystemNodeId,
  parseC2PanelSeriesNodeId,
  C2_PANEL_TREE_COUNTRIES,
  C2_RESOURCE_EMPTY_FIELD,
  collectC2ResourceTreeSeriesIdsUnderNode,
  collectC2ResourceTreeSeriesNodes,
  filterC2ResourceRowsToPanelCountries,
  mapTaskResourceItemToC2Row,
  mergeC2ResourceSatelliteRows,
  resolveC2SeriesScopeFromNode,
  type C2ResourceSatelliteRow,
  type C2ResourceTreeNode,
} from '@/utils/buildC2ResourceCatalog'
import type { AssembleSeriesCheckState, AssembleSeriesCheckStateEntry } from '@/utils/satelliteResourceTree'
import {
  applyElTreeSeriesCheckStates,
  buildTaskSatelliteDisplayMetaFromInventory,
  clearSeriesSatelliteCache,
  computeElTreeSeriesCheckStates,
  fetchSeriesTaskSatellites,
  mergeSeriesSatellitesIntoTaskList,
  removeSeriesSatellitesFromTaskList,
} from '@/utils/taskSatelliteTreeBridge'
import {
  buildSatelliteAssembleTreeInBackground,
  yieldToUiBeforeHeavyTreeMount,
} from '@/utils/satelliteAssembleTreeWorkerClient'
import { resolveSeriesNamesFromTaskSatellites } from '@/utils/taskEntity'

defineProps<{
  /** 当前选中 NORAD（与父组件兼容） */
  selectedNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'select-satellite', norad: number | null): void
  /** 保存并重算已提交，右侧面板应重新等待/拉取分析结果 */
  (e: 'task-recalculated', taskId: string): void
}>()

const store = useLayoutStore()
const {
  startTaskProgressPolling,
  stopAllTaskProgressPolling,
  resumeTaskProgressPollingForTasks,
} = useTaskProgressPolling()

const taskList = ref<TaskForm[]>([])
const taskLoading = ref(false)
const taskSwitching = ref(false)
const savingRecalc = ref(false)
const taskEditVisible = ref(false)
const taskEditIsEdit = ref(false)
const editingTask = ref<TaskForm | null>(null)

/** 当前选中任务的内联编辑副本（系列/武器） */
const editorDraft = ref<TaskForm | null>(null)
/** 是否启用任务武器配置 */
const useWeaponsEnabled = ref(false)
/** 关闭「使用武器」时暂存的武器 ID */
const stashedWeaponIds = ref<string[]>([])

const weaponOptionsLoading = ref(false)
const resourceTreeRef = ref<InstanceType<typeof ElTree>>()
const weaponTableRef = ref<InstanceType<typeof ElTable>>()
const flatCatalogRows = ref<C2ResourceSatelliteRow[]>([])
/** 左树数据源：`/resource/satellite/tree` 三国缓存（与任务装配一致，展示到系列层） */
const panelApiTreeRoots = ref<SatelliteTreeCountryNode[]>([])
/** 扁平行是否来自任务已挂卫星裁剪（仅影响 catalog 提示与右侧数据，不影响左树层级） */
const catalogFromTaskResource = ref(false)
/** 首次加载卫星资源树（不遮挡已挂载的 el-tree） */
const treeBootLoading = ref(false)
const catalogLoading = ref(false)
const programmaticTreeSync = ref(false)
/** 程序化回显期间禁止 @check 触发保存 / 重算（避免连锁写任务） */
const suppressResourceTreeSave = ref(false)
/** Worker 构建的系列卫星清单，供勾选态一次计算 */
const c2SeriesInventoryForEcho = shallowRef<Record<string, TaskResourceItem[]>>({})
/** C2 树中处于全选态的系列 node-key（与任务卫星列表分离） */
const trackedC2FullyCheckedSeriesIds = ref<Set<string>>(new Set())
/** 系列节点勾选态缓存（避免勾选后再全树 sync 触发 @check 把选中打没） */
const c2SeriesCheckStateByNodeId = ref<Map<string, AssembleSeriesCheckState>>(new Map())
const weaponTableRows = ref<Weapon[]>([])
const resourceTreeProps = { label: 'label', children: 'children' as const }

/** 作战对象固定三项（只读展示，高亮任务所选国家） */
const combatObjectCountryOptions = [...TASK_ENEMY_COUNTRY_OPTIONS]

/** 点击作战对象后用于资源树排序 / 高亮的国家（不改变任务数据） */
const treeSortFocusCountry = ref<string | null>(null)

/** 左树 el-tree 数据（引用稳定，避免勾选/更新 catalog 时整树 remount） */
const c2PanelResourceTreeNodes = shallowRef<C2ResourceTreeNode[]>([])
/** 左树当前展开节点 id（用户展开状态与重建树时保留） */
const c2TreeExpandedKeys = ref<string[]>([])

/**
 * 收集树中全部 node id。
 *
 * @param nodes 树根
 */
const collectC2ResourceTreeNodeIds = (nodes: C2ResourceTreeNode[]): Set<string> => {
  const ids = new Set<string>()
  const walk = (list: C2ResourceTreeNode[]) => {
    list.forEach((node) => {
      ids.add(node.id)
      if (node.children?.length) walk(node.children)
    })
  }
  walk(nodes)
  return ids
}

/**
 * 重建 C2 资源树节点（仅在树根缓存 / 体系过滤 / 国家排序变化时调用）。
 *
 * @param options.resetCountryExpand 为 true 时保证国家根处于展开态
 */
const rebuildC2PanelResourceTreeNodes = (options?: { resetCountryExpand?: boolean }) => {
  const next = buildC2PanelResourceTreeFromApiRoots(
    panelApiTreeRoots.value,
    resolveTaskTargetTypes(store.activedTask),
    treeSortFocusCountry.value,
  )
  c2PanelResourceTreeNodes.value = next
  const validIds = collectC2ResourceTreeNodeIds(next)
  const countryIds = next.filter((node) => node.kind === 'country').map((node) => node.id)
  let preserved = c2TreeExpandedKeys.value.filter((id) => validIds.has(id))
  if (options?.resetCountryExpand || !preserved.length) {
    preserved = [...new Set([...preserved, ...countryIds])]
  }
  c2TreeExpandedKeys.value = preserved
}

/**
 * 读取 el-tree 中已全选的系列叶子 id（不含国家/体系父节点）。
 *
 * @param tree ElTree 实例
 */
const collectC2FullyCheckedSeriesNodeIds = (tree: InstanceType<typeof ElTree>): Set<string> =>
  new Set(
    (tree.getCheckedNodes(true) as C2ResourceTreeNode[])
      .filter((node) => node.kind === 'series')
      .map((node) => node.id),
  )

/**
 * 解析应视为全选的系列 id（含勾选 country / system 父节点时未在 true 列表中的系列）。
 *
 * @param tree ElTree 实例
 */
const resolveC2FullyCheckedSeriesIdsFromTree = (tree: InstanceType<typeof ElTree>): Set<string> => {
  const seriesIds = collectC2FullyCheckedSeriesNodeIds(tree)
  for (const node of tree.getCheckedNodes(false) as C2ResourceTreeNode[]) {
    if (node.kind !== 'country' && node.kind !== 'system') continue
    const storeNode = tree.getNode(node.id)
    if (!storeNode?.checked || storeNode.indeterminate) continue
    collectC2ResourceTreeSeriesIdsUnderNode(c2PanelResourceTreeNodes.value, node.id).forEach((id) => seriesIds.add(id))
  }
  return seriesIds
}

/**
 * 将 el-tree 当前勾选 / 半选 key 同步到 Store，供右侧列表过滤。
 */
const syncC2TreeCheckedKeysToStore = () => {
  const tree = resourceTreeRef.value
  if (!tree) {
    store.setC2TreeCheckedKeys([])
    return
  }
  const checked = tree.getCheckedKeys() as string[]
  const half =
    typeof (tree as { getHalfCheckedKeys?: () => string[] }).getHalfCheckedKeys === 'function'
      ? ((tree as { getHalfCheckedKeys: () => string[] }).getHalfCheckedKeys() as string[])
      : []
  store.setC2TreeCheckedKeys([...checked, ...half])
}

/**
 * 将缓存的系列勾选态写入树（单节点，不触发全树 sync）。
 *
 * @param nodeId 系列节点 id
 */
const applyC2CachedSeriesCheckStateToTreeNode = (nodeId: string) => {
  const state = c2SeriesCheckStateByNodeId.value.get(nodeId)
  const tree = resourceTreeRef.value
  if (!state || !tree) return
  applyElTreeSeriesCheckStates(tree, [{ id: nodeId, state }])
}

/**
 * 保证左树已加载（重复调用不会 remount 树）。
 *
 * @param options.forceRebuild 强制按最新树根重建
 */
const ensureC2PanelResourceTreeLoaded = async (options?: { forceRebuild?: boolean }) => {
  const needFetchRoots = !panelApiTreeRoots.value.length
  const needBuild = options?.forceRebuild || !c2PanelResourceTreeNodes.value.length
  if (!needFetchRoots && !needBuild) return
  if (needFetchRoots && !c2PanelResourceTreeNodes.value.length) {
    treeBootLoading.value = true
  }
  try {
    if (needFetchRoots) {
      panelApiTreeRoots.value = await loadSatelliteResourceTreeRootsForPanel([...C2_PANEL_TREE_COUNTRIES])
    }
    if (needBuild) {
      rebuildC2PanelResourceTreeNodes({ resetCountryExpand: !c2PanelResourceTreeNodes.value.length })
      if (c2SeriesCheckStateByNodeId.value.size) {
        await nextTick()
        await applyC2TreeVisualCheckStates()
      }
    }
  } finally {
    treeBootLoading.value = false
  }
}

/**
 * 监听：草稿任务卫星类型（体系过滤）。
 * 回调不返回清理函数。
 * 作用：类型变更时重建左树，不影响 catalog 扁平行刷新。
 */
watch(
  () => editorDraft.value?.targetTypeShow,
  () => {
    if (!panelApiTreeRoots.value.length) return
    rebuildC2PanelResourceTreeNodes()
  },
  { deep: true },
)

/**
 * 计算：左侧面板任务下拉当前值。
 * 返回：激活任务 ID；写入时切换 `store.activedTask`。
 * 作用：任务列表与全局激活任务双向同步。
 */
const activeTaskId = computed({
  get: () => store.activedTask?.id ?? '',
  set: (taskId: string) => {
    if (!taskId) return
    const task = taskList.value.find((item) => item.id === taskId)
    if (task) store.setActivedTask(task)
  },
})

/** 作战场景展示刷新令牌（任务保存 localStorage 后递增） */
const combatScenarioDisplayToken = ref(0)

/**
 * 读取当前任务的作战场景（localStorage；与添加/编辑任务弹窗一致）。
 */
const readActiveCombatScenario = () => {
  combatScenarioDisplayToken.value
  if (store.command) {
    const fromCommand = resolveCombatScenarioSelectionFromCommand(store.command)
    if (fromCommand) return fromCommand
  }
  const task = store.activedTask
  if (!task?.id) return null
  return resolveCombatScenarioSelectionFromTask(task, store.command)
}

/**
 * 计算：卫星 catalog 数据来源提示文案。
 * 返回：空字符串或算法未完成时的预览说明。
 * 作用：界面角标提示当前树数据是否仅为系列预览。
 */
const catalogSourceHint = computed(() => {
  if (catalogLoading.value || !flatCatalogRows.value.length) return ''
  if (catalogFromTaskResource.value) return ''
  return '算法未完成：当前为系列预览数据，用途/国际编号/发射时间可能为空。'
})

/**
 * 切换左侧面板当前任务。
 *
 * @param taskId 任务 ID
 */
const handleSwitchTask = (taskId: string) => {
  activeTaskId.value = taskId
}

/**
 * 计算：当前任务作战阶段展示名。
 * 返回：阶段 label 或 `--`。
 * 作用：只读作战场景信息区文案。
 */
const currentCombatPhaseLabel = computed(() => {
  const scenario = readActiveCombatScenario()
  if (!scenario?.combatPhaseId) return '--'
  const phase = COMBAT_PHASE_OPTIONS.find((item) => item.id === scenario.combatPhaseId)
  return phase?.label ?? '--'
})

/**
 * 计算：作战预期一级选项展示名。
 * 返回：一级 label 或 `--`。
 * 作用：只读作战预期展示。
 */
const currentCombatExpectationPrimaryLabel = computed(() => {
  const scenario = readActiveCombatScenario()
  if (!scenario?.expectationPrimaryId) return '--'
  const primary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.id === scenario.expectationPrimaryId)
  return primary?.label ?? '--'
})

/**
 * 计算：作战预期二级选项展示名。
 * 返回：二级 label 或 `--`。
 * 作用：在一级场景配置下展示细分类预期。
 */
const currentCombatExpectationSecondaryLabel = computed(() => {
  const scenario = readActiveCombatScenario()
  if (!scenario?.expectationSecondaryId) return '--'
  const primary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.id === scenario.expectationPrimaryId)
  const secondary = primary?.children.find((item) => item.id === scenario.expectationSecondaryId)
  return secondary?.label ?? '--'
})

/**
 * 拉取当前场景任务列表（供任务保存后刷新）。
 *
 * @param options.silent 为 true 时不顶掉整面板（避免保存后卸载 el-tree）
 */
const loadBattleTasks = async (options?: { silent?: boolean }) => {
  const commandId = store.command?.id
  if (!commandId) {
    taskList.value = store.command?.tasks || []
    return
  }
  const previousTaskList = [...taskList.value]
  const activeId = store.activedTask?.id
  if (!options?.silent) {
    taskLoading.value = true
    taskList.value = []
  }
  try {
    const res = await getTaskList(commandId)
    if (res.code === 200 && Array.isArray(res.data)) {
      const tasks = normalizeTaskListFromApi(res.data)
      taskList.value = tasks
      await resumeTaskProgressPollingForTasks(tasks)
      // 请求返回后场景可能已切换；只有仍是本次拉取的战场对象时才写回任务列表。
      const currentCommand = store.command
      if (currentCommand && isSameCommandId(currentCommand.id, commandId)) {
        store.setActivedCommand({ ...currentCommand, tasks })
      }
      if (options?.silent) {
        if (!tasks.length) {
          store.setActivedTask(null)
        } else if (!activeId || !tasks.some((item) => item.id === activeId)) {
          store.setActivedTask(tasks[0])
        }
      } else if (!tasks.length) {
        store.setActivedTask(null)
      } else if (!activeId || !tasks.some((item) => item.id === activeId)) {
        store.setActivedTask(tasks[0])
      } else {
        store.setActivedTask(tasks.find((item) => item.id === activeId) ?? tasks[0])
      }
    } else if (!options?.silent) {
      taskList.value = store.command?.tasks || []
    } else {
      taskList.value = previousTaskList
    }
  } catch (error) {
    console.error('加载场景任务列表失败:', error)
    if (!options?.silent) {
      taskList.value = store.command?.tasks || []
    }
  } finally {
    if (!options?.silent) {
      taskLoading.value = false
    }
  }
}

/**
 * 监听：当前战场场景 ID。
 * 返回：回调不返回清理函数。
 * 作用：切换场景时重新加载该场景任务列表。
 */
watch(
  () => store.command?.id,
  (commandId, prevCommandId) => {
    if (!commandId || commandId === prevCommandId) return
    void loadBattleTasks({ silent: true })
  },
  { immediate: true },
)

/**
 * 解析任务蓝方国家列表。
 *
 * @param task 任务
 */
const resolveEnemyCountries = (task: TaskForm | null | undefined): string[] =>
  resolveCombatCountriesFromTask(task, store.command)

/**
 * 解析任务卫星类型列表（接口无字段时由 C2 草稿或默认类型兜底）。
 *
 * @param task 任务
 */
const resolveTaskTargetTypes = (task: TaskForm | null | undefined): string[] => {
  if (editorDraft.value?.targetTypeShow?.length) return [...editorDraft.value.targetTypeShow]
  if (!task) return []
  return [...MISSION_SYS_TYPES]
}

/**
 * 作战对象是否为当前任务所选蓝方国家。
 *
 * @param country 国家/地区名
 */
const isTaskCombatObjectActive = (country: string): boolean =>
  resolveEnemyCountries(store.activedTask).includes(country)

/**
 * 由任务作战对象推导资源树国家排序优先项（单国为该国；多国取 `country` 中首个合法项）。
 *
 * @param task 当前任务
 */
const resolveDefaultTreeSortFocusCountry = (task: TaskForm | null | undefined): string | null => {
  const countries = resolveCombatCountriesFromTask(task, store.command)
  if (!countries.length) return null
  const allowed = new Set<string>(TASK_ENEMY_COUNTRY_OPTIONS as readonly string[])
  const matched = countries.filter((country) => allowed.has(country))
  if (!matched.length) return null
  return matched[0]
}

/**
 * 将任务作战对象同步为资源树顶部国家（切换任务或 country 更新时调用）。
 *
 * @param task 当前任务
 */
const applyTreeSortFocusFromTask = (task: TaskForm | null | undefined) => {
  treeSortFocusCountry.value = resolveDefaultTreeSortFocusCountry(task)
}

/**
 * 点击作战对象：将该国家排到资源树顶部，并高亮对应根节点（仅 UI 排序）。
 *
 * @param country 国家/地区名
 */
const handleCombatObjectCountryClick = (country: string) => {
  if (!(TASK_ENEMY_COUNTRY_OPTIONS as readonly string[]).includes(country)) return
  treeSortFocusCountry.value = country
  if (panelApiTreeRoots.value.length) {
    rebuildC2PanelResourceTreeNodes()
  }
}

/**
 * 武器表经纬度展示（保留三位小数）。
 *
 * @param value 纬度或经度
 */
const formatWeaponCoordinate = (value: number | string | undefined | null): string => {
  if (value == null || value === '') return '--'
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return '--'
  return num.toFixed(3)
}

/**
 * 按任务已挂载卫星拉取资源树并裁剪为左树数据源。
 *
 * @param task 当前任务
 * @returns 是否成功走任务资源树模式
 */
const fetchTaskSatelliteResourceCatalog = async (task: TaskForm): Promise<boolean> => {
  const mounted = (task.satellites ?? []).filter((item) => item.resourceId?.trim())
  if (!mounted.length) return false

  const countries = resolveCombatCountriesFromTask(task, store.command)
  const queryCountries = countries.length ? countries : [...C2_PANEL_TREE_COUNTRIES]
  const roots = await loadSatelliteResourceTreeRootsForPanel(queryCountries)
  const pruned = pruneSatelliteResourceTreeByTaskSatellites(roots, mounted)
  if (!pruned.length) return false

  flatCatalogRows.value = buildC2FlatRowsFromSatelliteResourceTree(pruned)
  catalogFromTaskResource.value = true
  return true
}

/**
 * 拉取三国全量系列预览 catalog（树结构数据源，不受任务已选系列限制）。
 *
 * @param task 当前任务
 */
/**
 * 按草稿已选卫星 lazy 填充右侧列表（系列预览树骨架不含 NORAD）。
 *
 * @param taskSatellites 任务挂载卫星
 */
const hydrateC2FlatRowsFromTaskSatellites = async (taskSatellites: TaskResourceItem[]) => {
  if (!taskSatellites.length) return
  const inventory = buildTaskScopedInventoryFromApiTreeRoots(
    store.satelliteAssembleTreeRootsCache,
    taskSatellites,
  )
  const metaById = buildTaskSatelliteDisplayMetaFromInventory(taskSatellites, inventory)
  const rowsFromMeta: C2ResourceSatelliteRow[] = []
  for (const item of taskSatellites) {
    const meta = metaById.get(item.resourceId)
    rowsFromMeta.push(
      mapTaskResourceItemToC2Row(
        item,
        meta ?? {
          country: C2_RESOURCE_EMPTY_FIELD,
          system: C2_RESOURCE_EMPTY_FIELD,
          series: C2_RESOURCE_EMPTY_FIELD,
        },
      ),
    )
  }
  const roots = await loadSatelliteResourceTreeRootsForPanel([...C2_PANEL_TREE_COUNTRIES])
  const pruned = pruneSatelliteResourceTreeByTaskSatellites(roots, taskSatellites)
  const rowsFromTree = buildC2FlatRowsFromSatelliteResourceTree(pruned)
  flatCatalogRows.value = mergeC2ResourceSatelliteRows(
    flatCatalogRows.value,
    mergeC2ResourceSatelliteRows(rowsFromTree, rowsFromMeta),
  )
  store.setC2ResourceSatelliteRows(flatCatalogRows.value)
}

const fetchSeriesFallbackCatalog = async (task: TaskForm): Promise<C2ResourceSatelliteRow[]> => {
  const treeCountries = [...C2_PANEL_TREE_COUNTRIES]
  const types = editorDraft.value?.targetTypeShow?.length
    ? [...editorDraft.value.targetTypeShow]
    : resolveTaskTargetTypes(task)
  if (!types.length) return []
  const seriesData = await loadSatelliteSeriesDataForCountries(treeCountries)
  const buckets = parseSeriesApiBuckets(seriesData, types)
  const skeletonRows: C2ResourceSatelliteRow[] = []
  for (const country of treeCountries) {
    for (const bucket of buckets) {
      skeletonRows.push({
        rowKey: `skeleton|${country}|${bucket.sysType}|${bucket.series}`,
        norad: -1,
        name: '',
        country,
        sysType: bucket.sysType,
        usage: C2_RESOURCE_EMPTY_FIELD,
        series: bucket.series,
        sat_type: bucket.sysType,
        int_id: C2_RESOURCE_EMPTY_FIELD,
        launch_date: C2_RESOURCE_EMPTY_FIELD,
      })
    }
  }
  return filterC2ResourceRowsToPanelCountries(skeletonRows)
}

const refreshResourceCatalog = async (task: TaskForm | null | undefined) => {
  await yieldToUiBeforeHeavyTreeMount()
  if (!task) {
    flatCatalogRows.value = []
    panelApiTreeRoots.value = []
    c2PanelResourceTreeNodes.value = []
    c2TreeExpandedKeys.value = []
    catalogFromTaskResource.value = false
    store.setC2ResourceSatelliteRows([])
    return
  }
  try {
    catalogFromTaskResource.value = false
    await ensureC2PanelResourceTreeLoaded()

    const usedTaskResourceTree = await fetchTaskSatelliteResourceCatalog(task)
    if (usedTaskResourceTree) {
      store.setC2ResourceSatelliteRows(flatCatalogRows.value)
    } else {
      flatCatalogRows.value = await fetchSeriesFallbackCatalog(task)
      store.setC2ResourceSatelliteRows(flatCatalogRows.value)
    }
    const taskSats = editorDraft.value?.satellites ?? task.satellites ?? []
    store.setC2ResourceSatelliteRows(flatCatalogRows.value)
    suppressResourceTreeSave.value = true
    try {
      if (taskSats.length) {
        await hydrateC2FlatRowsFromTaskSatellites(taskSats)
        store.setC2ResourceSatelliteRows(flatCatalogRows.value)
        const roots = store.satelliteAssembleTreeRootsCache
        if (roots?.length) {
          const systems = resolveTaskTargetTypes(task)
          const { seriesInventory } = await buildSatelliteAssembleTreeInBackground(
            roots,
            systems,
            taskSats.map((item) => ({ ...item })),
          )
          c2SeriesInventoryForEcho.value = seriesInventory
        } else {
          c2SeriesInventoryForEcho.value = {}
        }
        buildC2SeriesCheckEchoFromTaskSatellites(taskSats)
        await nextTick()
        await applyTaskResourceTreeCheckedKeys()
      } else {
        c2SeriesInventoryForEcho.value = {}
        await clearResourceTreeSelection()
      }
    } finally {
      await nextTick()
      suppressResourceTreeSave.value = false
    }
  } catch (error) {
    console.error('加载 C2 资源 catalog 失败:', error)
    flatCatalogRows.value = []
    panelApiTreeRoots.value = []
    c2PanelResourceTreeNodes.value = []
    c2TreeExpandedKeys.value = []
    catalogFromTaskResource.value = false
    store.setC2ResourceSatelliteRows([])
  }
}

/**
 * 根据系列勾选态汇总 country / system 展示态（与任务装配页一致）。
 *
 * @param nodeId 国家或体系节点 id
 */
const computeC2AggregateCheckState = (nodeId: string): AssembleSeriesCheckState => {
  const seriesIds = collectC2ResourceTreeSeriesIdsUnderNode(c2PanelResourceTreeNodes.value, nodeId)
  if (!seriesIds.length) return 'none'
  const states = seriesIds.map((id) => c2SeriesCheckStateByNodeId.value.get(id) ?? 'none')
  if (states.every((state) => state === 'all')) return 'all'
  if (states.every((state) => state === 'none')) return 'none'
  return 'partial'
}

/**
 * 根据任务 satellites 计算系列勾选态，并写入 Store 过滤键（不依赖 el-tree 已挂载）。
 *
 * @param taskSats 任务已选卫星
 */
const buildC2SeriesCheckEchoFromTaskSatellites = (taskSats: TaskResourceItem[]) => {
  const entries = collectC2ResourceTreeSeriesNodes(c2PanelResourceTreeNodes.value)
    .map((node) => {
      const scope = resolveC2SeriesScopeFromNode(node)
      return scope ? { id: node.id, scope } : null
    })
    .filter(Boolean) as Array<{ id: string; scope: { country: string; system: string; series: string } }>
  const seriesStates = computeElTreeSeriesCheckStates(entries, taskSats, c2SeriesInventoryForEcho.value)
  c2SeriesCheckStateByNodeId.value = new Map(seriesStates.map((item) => [item.id, item.state]))
  const filterKeys = buildC2PanelFilterKeysFromSeriesCheckStates(
    seriesStates,
    c2PanelResourceTreeNodes.value,
  )
  if (filterKeys.length) {
    store.setC2TreeCheckedKeys(filterKeys)
  }
  trackedC2FullyCheckedSeriesIds.value = new Set(
    seriesStates.filter((item) => item.state === 'all').map((item) => item.id),
  )
  return seriesStates
}

/**
 * 收集 C2 树回显勾选条目（系列 + country/system 汇总；与任务装配页 `collectEchoCheckStateEntries` 一致）。
 */
const collectC2EchoCheckStateEntries = (): AssembleSeriesCheckStateEntry[] => {
  const entries: AssembleSeriesCheckStateEntry[] = []
  const pushed = new Set<string>()
  const pushEntry = (id: string, state: AssembleSeriesCheckState) => {
    if (state === 'none' || pushed.has(id)) return
    pushed.add(id)
    entries.push({ id, state })
  }
  for (const [seriesId, state] of c2SeriesCheckStateByNodeId.value) {
    pushEntry(seriesId, state)
  }
  const walk = (nodes: C2ResourceTreeNode[]) => {
    for (const node of nodes) {
      if (node.kind === 'country' || node.kind === 'system') {
        pushEntry(node.id, computeC2AggregateCheckState(node.id))
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(c2PanelResourceTreeNodes.value)
  return entries
}

/**
 * 回显写入顺序：先系列，再体系，最后国家（避免父节点先写导致子节点被清掉）。
 */
const orderC2EchoEntriesForTreeApply = (entries: AssembleSeriesCheckStateEntry[]): AssembleSeriesCheckStateEntry[] => {
  const rank = (nodeId: string): number => {
    if (nodeId.startsWith('series::')) return 0
    if (nodeId.startsWith('system::')) return 1
    if (nodeId.startsWith('country::')) return 2
    return 3
  }
  return [...entries].sort((left, right) => rank(left.id) - rank(right.id))
}

/**
 * 将已缓存的勾选态绘制到 C2 el-tree（展开路径 + 分层层级回写）。
 */
const applyC2TreeVisualCheckStates = async () => {
  const tree = resourceTreeRef.value
  if (!tree || !c2PanelResourceTreeNodes.value.length) return
  if (!c2SeriesCheckStateByNodeId.value.size) return

  const expandKeys = new Set(c2TreeExpandedKeys.value)
  for (const [seriesId, state] of c2SeriesCheckStateByNodeId.value) {
    if (state === 'none') continue
    const parsed = parseC2PanelSeriesNodeId(seriesId)
    if (parsed) {
      expandKeys.add(buildC2PanelCountryNodeId(parsed.country))
      expandKeys.add(buildC2PanelSystemNodeId(parsed.country, parsed.system))
    }
  }
  c2TreeExpandedKeys.value = [...expandKeys]
  await nextTick()

  const entries = orderC2EchoEntriesForTreeApply(
    collectC2EchoCheckStateEntries().filter((entry) => Boolean(tree.getNode(entry.id))),
  )
  if (!entries.length) return

  programmaticTreeSync.value = true
  try {
    applyElTreeSeriesCheckStates(tree, entries)
    trackedC2FullyCheckedSeriesIds.value = new Set(
      [...c2SeriesCheckStateByNodeId.value.entries()]
        .filter(([, state]) => state === 'all')
        .map(([id]) => id),
    )
    const seriesStates = [...c2SeriesCheckStateByNodeId.value.entries()].map(([id, state]) => ({ id, state }))
    const filterKeys = buildC2PanelFilterKeysFromSeriesCheckStates(
      seriesStates,
      c2PanelResourceTreeNodes.value,
    )
    if (filterKeys.length) store.setC2TreeCheckedKeys(filterKeys)
  } finally {
    await nextTick()
    programmaticTreeSync.value = false
  }
}

/**
 * 任务资源树模式：按任务 satellites 回显系列全选 / 半选，并同步右侧列表过滤键。
 */
const applyTaskResourceTreeCheckedKeys = async () => {
  await nextTick()
  const taskSats = editorDraft.value?.satellites ?? store.activedTask?.satellites ?? []
  if (!taskSats.length) return
  buildC2SeriesCheckEchoFromTaskSatellites(taskSats)
  await applyC2TreeVisualCheckStates()
}

/** 清空资源树勾选（界面默认不勾选，右侧列表为空） */
const clearResourceTreeSelection = async () => {
  await nextTick()
  const tree = resourceTreeRef.value
  programmaticTreeSync.value = true
  tree?.setCheckedKeys([])
  store.setC2TreeCheckedKeys([])
  await nextTick()
  programmaticTreeSync.value = false
}



/**
 * 资源树勾选：系列叶子全选时 search 加载卫星；与 `satellites` 分离维护后写回任务。
 */
const handleResourceTreeCheck = async () => {
  if (programmaticTreeSync.value || suppressResourceTreeSave.value) return
  const tree = resourceTreeRef.value
  if (!tree) return
  syncC2TreeCheckedKeysToStore()
  if (!editorDraft.value) return
  const checkedSeriesIds = resolveC2FullyCheckedSeriesIdsFromTree(tree)
  const prev = trackedC2FullyCheckedSeriesIds.value
  const added = [...checkedSeriesIds].filter((id) => !prev.has(id))
  const removed = [...prev].filter((id) => !checkedSeriesIds.has(id))
  if (!added.length && !removed.length) return

  const findSeriesNode = (id: string) =>
    collectC2ResourceTreeSeriesNodes(c2PanelResourceTreeNodes.value).find((node) => node.id === id)

  programmaticTreeSync.value = true
  try {
    let nextSelected = editorDraft.value.satellites.map((item) => ({ ...item }))
    let nextRows = [...flatCatalogRows.value]

    for (const seriesId of added) {
      const scope = resolveC2SeriesScopeFromNode(findSeriesNode(seriesId) as C2ResourceTreeNode)
      if (!scope) continue
      const seriesResources = await fetchSeriesTaskSatellites(scope)
      nextSelected = mergeSeriesSatellitesIntoTaskList(nextSelected, seriesResources)
      nextRows = mergeC2ResourceSatelliteRows(
        nextRows,
        seriesResources.map((item) => mapTaskResourceItemToC2Row(item, scope)),
      )
    }

    for (const seriesId of removed) {
      const scope = resolveC2SeriesScopeFromNode(findSeriesNode(seriesId) as C2ResourceTreeNode)
      if (!scope) continue
      const seriesResources = getSeriesTaskSatellitesFromPanelTreeCache(scope)
      const removedKeys = new Set(seriesResources.map((item) => item.resourceId))
      nextSelected = removeSeriesSatellitesFromTaskList(nextSelected, seriesResources)
      nextRows = nextRows.filter((row) => !row.resourceId || !removedKeys.has(row.resourceId))
    }

    editorDraft.value.satellites = nextSelected
    store.setC2RightPanelTaskSatellites(nextSelected)
    flatCatalogRows.value = nextRows
    store.setC2ResourceSatelliteRows(nextRows)
    added.forEach((id) => c2SeriesCheckStateByNodeId.value.set(id, 'all'))
    removed.forEach((id) => c2SeriesCheckStateByNodeId.value.set(id, 'none'))
    for (const id of [...added, ...removed]) {
      applyC2CachedSeriesCheckStateToTreeNode(id)
    }
    trackedC2FullyCheckedSeriesIds.value = resolveC2FullyCheckedSeriesIdsFromTree(tree)
    syncC2TreeCheckedKeysToStore()

    if (editorDraft.value.satellites.length > 0) {
      void handleSaveAndRecalculate()
    }
  } catch (error) {
    console.error('C2 资源树勾选处理失败:', error)
    ElMessage.error('加载系列卫星失败')
  } finally {
    await nextTick()
    programmaticTreeSync.value = false
  }
}

/**
 * 武器表多选变更。
 *
 * @param rows 选中武器行
 */
const handleWeaponSelectionChange = (rows: Weapon[]) => {
  if (!useWeaponsEnabled.value || !editorDraft.value) return
  const ids = rows.map((row) => String(row.id ?? '')).filter(Boolean)
  writeTaskWeaponResourceIds(editorDraft.value, ids)
  stashedWeaponIds.value = [...ids]
  void handleSaveAndRecalculate()
}

/** 回显武器表勾选 */
const syncWeaponTableSelection = async () => {
  await nextTick()
  const table = weaponTableRef.value
  if (!table || !useWeaponsEnabled.value || !editorDraft.value) return
  table.clearSelection()
  const wanted = new Set(readTaskWeaponResourceIds(editorDraft.value))
  weaponTableRows.value.forEach((row) => {
    const id = String(row.id ?? '')
    if (id && wanted.has(id)) {
      table.toggleRowSelection(row, true)
    }
  })
}

/** 同一任务并发同步去重 */
let syncEditorInflight: Promise<void> | null = null
let syncEditorInflightTaskId: string | null = null

/**
 * 切换任务时同步编辑草稿与资源/武器。
 *
 * @param task 当前任务
 */
const syncEditorForTask = async (task: TaskForm | null | undefined) => {
  const taskId = task?.id ?? null
  if (syncEditorInflight && syncEditorInflightTaskId === taskId) {
    return syncEditorInflight
  }
  syncEditorInflightTaskId = taskId
  syncEditorInflight = (async () => {
    editorDraft.value = createDraftFromTask(task)
    store.setC2RightPanelTaskSatellites(editorDraft.value?.satellites ?? [])
    if (task && editorDraft.value) {
      stashedWeaponIds.value = [...readTaskWeaponResourceIds(editorDraft.value)]
      useWeaponsEnabled.value = false
      writeTaskWeaponResourceIds(editorDraft.value, [])
    } else {
      stashedWeaponIds.value = []
      useWeaponsEnabled.value = false
    }
    if (!task) {
      store.clearC2ResourceSelection()
      return
    }
    clearSeriesSatelliteCache()
    trackedC2FullyCheckedSeriesIds.value = new Set()
    c2SeriesCheckStateByNodeId.value = new Map()
    c2SeriesInventoryForEcho.value = {}
    store.setC2TreeCheckedKeys([])
    await refreshResourceCatalog(task)
  })().finally(() => {
    syncEditorInflight = null
    syncEditorInflightTaskId = null
  })
  return syncEditorInflight
}

/**
 * 监听：当前激活任务 ID。
 * 返回：回调不返回清理函数。
 * 作用：换任务时重置树排序焦点、刷新作战场景展示令牌并同步编辑草稿与资源。
 */
watch(
  () => store.activedTask?.id,
  () => {
    applyTreeSortFocusFromTask(store.activedTask)
    combatScenarioDisplayToken.value += 1
    void syncEditorForTask(store.activedTask)
  },
  { immediate: true },
)

/**
 * 监听：左侧任务草稿中的卫星挂载。
 * 回调不返回清理函数。
 * 作用：系列勾选后尚未保存时，右侧列表仍能展示草稿卫星。
 */
watch(
  () => editorDraft.value?.satellites,
  (satellites) => {
    if (!editorDraft.value || !store.activedTask?.id) return
    if (String(editorDraft.value.id) !== String(store.activedTask.id)) return
    store.setC2RightPanelTaskSatellites(satellites ?? [])
  },
  { deep: true },
)

/**
 * 监听：当前任务 `country`（作战对象）。
 * 回调不返回清理函数。
 * 作用：任务作战对象变更后将对应国家排到资源树顶部。
 */
watch(
  () => store.activedTask?.country,
  () => {
    applyTreeSortFocusFromTask(store.activedTask)
  },
)

/**
 * 监听：C2 el-tree 实例挂载。
 * 回调不返回清理函数。
 * 作用：与任务装配页一致，树组件就绪后把缓存勾选态写入界面。
 */
watch(
  () => resourceTreeRef.value,
  async (tree) => {
    if (!tree) return
    if (!c2SeriesCheckStateByNodeId.value.size) return
    await nextTick()
    await applyC2TreeVisualCheckStates()
  },
)

/**
 * 监听：「使用武器」开关 `useWeaponsEnabled`。
 * 返回：回调不返回清理函数。
 * 作用：开启武器选择时回显武器表勾选行。
 */
watch(
  () => useWeaponsEnabled.value,
  (enabled) => {
    if (enabled) {
      void syncWeaponTableSelection()
    }
  },
)

/**
 * 「使用武器」开关切换：关闭时暂存当前选择并清空草稿；打开时从暂存恢复。
 *
 * @param enabled 是否使用武器
 */
const handleUseWeaponsChange = (enabled: boolean) => {
  if (!editorDraft.value) return
  if (!enabled) {
    stashedWeaponIds.value = [...readTaskWeaponResourceIds(editorDraft.value)]
    writeTaskWeaponResourceIds(editorDraft.value, [])
    weaponTableRef.value?.clearSelection()
    void handleSaveAndRecalculate({ forceWeaponIds: [] })
    return
  }
  writeTaskWeaponResourceIds(editorDraft.value, [...stashedWeaponIds.value])
  void syncWeaponTableSelection()
  void handleSaveAndRecalculate()
}

/**
 * 打开当前任务编辑弹窗。
 */
const openEditTask = () => {
  if (!store.activedTask) {
    ElMessage.warning('请先选择任务')
    return
  }
  taskEditIsEdit.value = true
  editingTask.value = store.activedTask
  taskEditVisible.value = true
}

/**
 * 当前场景无任务时，打开新建任务弹窗。
 */
const openCreateTask = () => {
  if (!store.command?.id) {
    ElMessage.warning('请先选择当前命令')
    return
  }
  taskEditIsEdit.value = false
  editingTask.value = null
  taskEditVisible.value = true
}

const handleTaskSaved = async (updated: TaskForm) => {
  const isCreate = !taskList.value.some((item) => item.id === updated.id)
  await loadBattleTasks()
  if (!updated.id) return
  if (isCreate) {
    await startTaskProgressPolling(updated.id)
  }
  const latest = taskList.value.find((item) => item.id === updated.id) || updated
  store.setActivedTask(latest)
  store.setSelectedSatSeries('')
  combatScenarioDisplayToken.value += 1
  await syncEditorForTask(latest)
  if (isCreate) {
    ElMessage.success(`已切换到新任务：${latest.name}`)
  }
}

/**
 * 校验并提交任务修改（系列/武器变更），触发后台重算。
 *
 * @param options.forceWeaponIds 显式指定 weaponIds（关闭「使用武器」时传 []）
 */
const handleSaveAndRecalculate = async (options?: { forceWeaponIds?: string[] }) => {
  const baseTask = store.activedTask
  const draft = editorDraft.value
  if (!baseTask?.id || !draft || draft.id !== baseTask.id) return
  if (savingRecalc.value) return
  if (!draft.beginDate || !draft.endDate) return
  if (parseTaskPanelTimeMs(draft.endDate) <= parseTaskPanelTimeMs(draft.beginDate)) return
  if (!resolveSeriesNamesFromTaskSatellites(draft.satellites).length) return
  if (!draft.targetTypeShow?.length) return
  const payload = mergeTaskFormWithDraft(baseTask, draft)
  if (options?.forceWeaponIds !== undefined) {
    payload.weapons = options.forceWeaponIds.map((resourceId) => ({
      resourceId,
      name: resourceId,
      code: '',
    }))
  } else if (!useWeaponsEnabled.value) {
    payload.weapons = []
  }
  savingRecalc.value = true
  try {
    const res = await updateTask(payload)
    if (res.code !== 200) {
      ElMessage.error(res.msg || '保存任务失败')
      return
    }
    await loadBattleTasks({ silent: true })
    await startTaskProgressPolling(baseTask.id)
    emit('task-recalculated', baseTask.id)
  } catch (error) {
    console.error('保存任务失败:', error)
    ElMessage.error('保存任务失败')
  } finally {
    savingRecalc.value = false
  }
}

onUnmounted(() => {
  stopAllTaskProgressPolling()
})
</script>
<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  backdrop-filter: blur(8px);
  color: #e2efff;
  overflow: hidden;

  &--left {
    border-left: none;
    border-top: none;
    border-bottom: none;
  }
}

.task-panel-task-select {
  width: 100%;
}

.panel-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.task-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

/** 底部固定区：武器列表（可选）+ 是否使用武器 */
.task-panel-weapon-dock {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
}

.task-panel-block {
  flex-shrink: 0;
  min-height: 0;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(14, 26, 44, 0.92) 0%, rgba(10, 20, 36, 0.88) 100%);
  box-shadow: inset 0 1px 0 rgba(0, 225, 255, 0.06);

  &--meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 10px;

    .task-panel-row {
      gap: 6px;
      line-height: 1.2;

      &+& {
        padding-top: 4px;
      }
    }

    .task-panel-label,
    .task-panel-value {
      line-height: 1.2;
    }

    .task-panel-name {
      font-size: battleUi.$battle-ui-font-base;
      font-weight: 700;
    }

    .task-edit-link {
      min-height: 28px;
      padding: 0 10px;
    }

    .combat-object-options {
      gap: 4px;
    }

    .combat-object-chip {
      padding: 2px 8px;
    }

    .combat-object-label {
      line-height: 1.15;
    }
  }

  &--tree {
    flex: 1 1 0;
    display: flex;
    flex-direction: column;
    min-height: 100px;
    overflow: hidden;
  }

  &--switch {
    flex-shrink: 0;
    padding: 8px 12px;
  }

  &--weapons {
    flex-shrink: 0;
    max-height: 172px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.task-panel-block-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 225, 255, 0.1);
  border-radius: 6px;
  background: rgba(8, 18, 32, 0.65);

  &--tree {
    overflow: auto;
    padding: 4px 6px;
  }

  &--table {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-height: 132px;

    .c2-resource-table {
      flex: 1;
      min-height: 0;
    }
  }
}

.task-panel-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 8px;

  &--name {
    grid-template-columns: 88px minmax(0, 1fr) auto;
  }

  &--objects {
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: start;
  }

  &--expectation {
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: start;
  }

  &+& {
    padding-top: 8px;
    border-top: 1px dashed rgba(0, 225, 255, 0.12);
  }
}

.task-panel-expectation {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
}

.task-panel-expectation-sep {
  font-size: battleUi.$battle-ui-font-base;
  color: #64748b;
  flex-shrink: 0;
}

.task-panel-expectation-secondary {
  font-weight: 500;
  color: #cbd5e1;
}

.task-panel-label {
  font-size: battleUi.$battle-ui-font-base;
  color: #94a3b8;
}

.task-panel-value {
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 600;
  color: #e2efff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-panel-name {
  font-size: battleUi.$battle-ui-font-emphasis;
}

.task-edit-link {
  flex-shrink: 0;
  min-height: 40px;
  padding: 0 14px;
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 700;
  color: #7dd3fc;
  background: rgba(0, 225, 255, 0.08);
  border: 1px solid rgba(0, 225, 255, 0.35);
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    color: #40f2ff;
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.18);
  }
}

.combat-object-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.combat-object-chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
  appearance: none;
  background: transparent;

  &--tree-focus {
    box-shadow: 0 0 0 2px rgba(0, 225, 255, 0.55);
  }

  &--active {
    border-color: rgba(248, 113, 113, 0.85);
    background: rgba(127, 29, 29, 0.45);

    .combat-object-label {
      color: #fecaca;
      font-weight: 700;
    }
  }

  &--inactive {
    border-color: rgba(250, 204, 21, 0.45);
    background: rgba(113, 63, 18, 0.3);

    .combat-object-label {
      color: #fde68a;
    }
  }
}

.combat-object-label {
  font-size: battleUi.$battle-ui-font-base;
  line-height: 1.2;
}

.task-panel-section-head {
  flex-shrink: 0;
  margin: 0 0 8px;
  padding-bottom: 6px;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
  border-bottom: 1px solid rgba(0, 225, 255, 0.14);
}

.task-create-entry {
  display: block;
  width: 100%;
  margin: 0;
  padding: 14px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(0, 225, 255, 0.45);
  background: rgba(0, 225, 255, 0.06);
  color: #7dd3fc;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.75);
    background: rgba(0, 225, 255, 0.12);
    color: #00e1ff;
  }
}

.task-panel-hint {
  flex-shrink: 0;
  margin: 0 0 6px;
  font-size: battleUi.$battle-ui-font-base;
  color: #64748b;
  line-height: 1.4;

  &--center {
    padding: 12px 8px;
    text-align: center;
  }
}

.c2-resource-tree {
  min-height: 0;
  background: transparent;
  @include battleUi.battle-ui-el-tree-typography;

  .c2-resource-tree-node-label {
    font-size: battleUi.$battle-ui-font-base !important;
    line-height: 1.35;
    color: #cbd5e1;
  }

  :deep(.atlas-app-tree-node__label) {
    color: #cbd5e1;
  }

  .c2-resource-tree-node-label--focus {
    display: inline-block;
    padding: 0 4px;
    border-radius: 4px;
    box-shadow: inset 0 0 0 1px rgba(0, 225, 255, 0.55);
    background: rgba(0, 225, 255, 0.08);
  }

  :deep(.atlas-app-checkbox__inner) {
    border-color: rgba(0, 225, 255, 0.45);
  }
}

.c2-resource-table {
  width: 100%;
  max-width: 100%;
  @include battleUi.battle-ui-el-table-typography;
  @include battleUi.battle-ui-c2-panel-table-fit;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.08);
  --atlas-app-text-color-regular: #cbd5e1;

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
  }
}

.weapon-use-item-label {
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
}

.weapon-use-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.zone-loading,
.zone-empty {
  padding: 24px 12px;
  font-size: battleUi.$battle-ui-font-base;
  color: #64748b;
  text-align: center;
}

.zone-loading {
  color: #7dd3fc;
}
</style>
