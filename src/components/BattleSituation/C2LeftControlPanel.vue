<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <div class="panel-body">
      <div v-if="taskSwitching" class="zone-loading">正在切换任务...</div>
      <div v-else-if="!store.activedTask" class="zone-empty">请选择当前任务</div>
      <div v-else class="task-panel">
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
          <div v-loading="catalogLoading" class="task-panel-block-body task-panel-block-body--tree">
            <div v-if="!catalogLoading && !resourceTreeNodes.length" class="task-panel-hint task-panel-hint--center">
              暂无卫星资源
            </div>
            <el-tree v-show="resourceTreeNodes.length > 0" ref="resourceTreeRef" class="c2-resource-tree"
              :data="resourceTreeNodes" node-key="id" show-checkbox default-expand-all :props="resourceTreeProps"
              @check="handleResourceTreeCheck">
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
      </div>
    </div>
    <TaskEditDialog v-model="taskEditVisible" :is-edit="taskEditIsEdit" :task="editingTask" @saved="handleTaskSaved" />
  </aside>
</template>
<script setup lang="ts">
/**
 * 战场态势 - C2 左侧面板：任务摘要、作战阶段/对象、三国资源树、武器配置。
 */
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ElTable } from 'element-plus'
import type { ElTree } from 'element-plus'
import { getTaskList, updateTask, getAllWeapons } from '@/api/dashboard'
import { getSatelliteBySeries, getSatelliteSeries } from '@/api/task/task'
import type { TaskForm, Weapon } from '@/types/dashboard'
import type { MatrixResult } from '@/api/electronic'
import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'
import {
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  loadCombatScenarioForTask,
} from '@/config/combatScenarioOptions'
import { TASK_ENEMY_COUNTRY_OPTIONS } from '@/constants/missionSatellite'
import {
  createDraftFromTask,
  mergeTaskFormWithDraft,
  parseTaskPanelTimeMs,
  type C2TaskEditorDraft,
} from '@/utils/c2TaskPanelEditor'
import {
  buildC2ResourceTreeNodesForPanel,
  buildC2SatelliteFlatRowsFromMatrix,
  buildC2SatelliteFlatRowsFromSeriesFallback,
  C2_PANEL_TREE_COUNTRIES,
  expandCheckedKeysToSeriesNames,
  filterC2ResourceRowsToPanelCountries,
  mergeMatrixCatalogIntoPanelCatalog,
  parseSeriesApiBuckets,
  type C2ResourceSatelliteRow,
  type C2ResourceTreeNode,
  type C2SeriesPreviewSatellite,
} from '@/utils/buildC2ResourceCatalog'

defineProps<{
  /** 算法矩阵（与父组件兼容） */
  matrixData?: MatrixResult | null
  /** 当前选中 NORAD（与父组件兼容） */
  selectedNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'select-satellite', norad: number | null): void
  /** 保存并重算已提交，右侧面板应重新等待/拉取分析结果 */
  (e: 'task-recalculated', taskId: number): void
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

/** 当前选中任务的内联编辑草稿（系列/武器） */
const editorDraft = ref<C2TaskEditorDraft | null>(null)
/** 是否启用任务武器配置 */
const useWeaponsEnabled = ref(false)
/** 关闭「使用武器」时暂存的武器 ID */
const stashedWeaponIds = ref<string[]>([])

const weaponOptionsLoading = ref(false)
const resourceTreeRef = ref<InstanceType<typeof ElTree>>()
const weaponTableRef = ref<InstanceType<typeof ElTable>>()
const flatCatalogRows = ref<C2ResourceSatelliteRow[]>([])
const catalogLoading = ref(false)
const catalogUsesMatrix = ref(false)
const programmaticTreeSync = ref(false)
const weaponTableRows = ref<Weapon[]>([])
const resourceTreeProps = { label: 'label', children: 'children' as const }

/** 作战对象固定三项（只读展示，高亮任务所选国家） */
const combatObjectCountryOptions = [...TASK_ENEMY_COUNTRY_OPTIONS]

/** 点击作战对象后用于资源树排序 / 高亮的国家（不改变任务数据） */
const treeSortFocusCountry = ref<string | null>(null)

/**
 * 计算：左侧 C2 资源树节点。
 * 返回：`C2ResourceTreeNode[]`（三国根节点，顺序受 `treeSortFocusCountry` 影响）。
 * 作用：ElTree 数据源。
 */
const resourceTreeNodes = computed((): C2ResourceTreeNode[] =>
  buildC2ResourceTreeNodesForPanel(flatCatalogRows.value, treeSortFocusCountry.value),
)

/** 作战场景展示刷新令牌（任务保存 localStorage 后递增） */
const combatScenarioDisplayToken = ref(0)

/**
 * 读取当前任务的作战场景（localStorage；与添加/编辑任务弹窗一致）。
 */
const readActiveCombatScenario = () => {
  combatScenarioDisplayToken.value
  const taskId = store.activedTask?.id
  if (!taskId) return null
  return loadCombatScenarioForTask(taskId)
}

/**
 * 计算：卫星 catalog 数据来源提示文案。
 * 返回：空字符串或算法未完成时的预览说明。
 * 作用：界面角标提示当前树数据是否仅为系列预览。
 */
const catalogSourceHint = computed(() => {
  if (catalogLoading.value || !flatCatalogRows.value.length) return ''
  if (catalogUsesMatrix.value) return ''
  return '算法未完成：当前为系列预览数据，用途/国际编号/发射时间可能为空。'
})

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
      await resumeTaskProgressPollingForTasks(res.data)
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

/**
 * 监听：当前战场场景 ID。
 * 返回：回调不返回清理函数。
 * 作用：切换场景时重新加载该场景任务列表。
 */
watch(
  () => store.battle?.id,
  () => {
    void loadBattleTasks()
  },
  { immediate: true },
)

/**
 * 解析任务蓝方国家列表。
 *
 * @param task 任务
 */
const resolveEnemyCountries = (task: TaskForm | null | undefined): string[] => {
  if (!task) return []
  if (task.enemyCountryShow?.length) return [...task.enemyCountryShow]
  return (task.enemyCountry || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * 解析任务卫星类型列表。
 *
 * @param task 任务
 */
const resolveTaskTargetTypes = (task: TaskForm | null | undefined): string[] => {
  if (!task) return []
  if (task.targetTypeShow?.length) return [...task.targetTypeShow]
  return (task.targetTypeNew || task.targetType || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

/**
 * 作战对象是否为当前任务所选蓝方国家。
 *
 * @param country 国家/地区名
 */
const isTaskCombatObjectActive = (country: string): boolean =>
  resolveEnemyCountries(store.activedTask).includes(country)

/**
 * 点击作战对象：将该国家排到资源树顶部，并高亮对应根节点（仅 UI 排序）。
 *
 * @param country 国家/地区名
 */
const handleCombatObjectCountryClick = (country: string) => {
  if (!(TASK_ENEMY_COUNTRY_OPTIONS as readonly string[]).includes(country)) return
  treeSortFocusCountry.value = country
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
 * 拉取三国全量系列预览 catalog（树结构数据源，不受任务已选系列限制）。
 *
 * @param task 当前任务
 */
const fetchSeriesFallbackCatalog = async (task: TaskForm): Promise<C2ResourceSatelliteRow[]> => {
  const treeCountries = [...C2_PANEL_TREE_COUNTRIES]
  const types = editorDraft.value?.targetTypeShow?.length
    ? [...editorDraft.value.targetTypeShow]
    : resolveTaskTargetTypes(task)
  if (!types.length) return []
  const res = await getSatelliteSeries(treeCountries)
  const buckets = res.code === 200 ? parseSeriesApiBuckets(res.data, types) : []
  const previews: Array<{ series: string; sysType: string; satellites: C2SeriesPreviewSatellite[] }> = []
  for (const bucket of buckets) {
    const previewRes = await getSatelliteBySeries(bucket.series)
    const satellites =
      previewRes.code === 200 && Array.isArray(previewRes.data) ? previewRes.data : []
    previews.push({ series: bucket.series, sysType: bucket.sysType, satellites })
  }
  return filterC2ResourceRowsToPanelCountries(
    buildC2SatelliteFlatRowsFromSeriesFallback(previews, treeCountries),
  )
}

/**
 * 刷新 C2 卫星资源 catalog（树固定展示三国；matrix 仅覆盖对应系列，不裁剪整树）。
 *
 * @param task 当前任务
 */
const refreshResourceCatalog = async (task: TaskForm | null | undefined) => {
  if (!task) {
    flatCatalogRows.value = []
    store.setC2ResourceSatelliteRows([])
    catalogUsesMatrix.value = false
    return
  }
  const taskEnemies = resolveEnemyCountries(task)
  catalogLoading.value = true
  try {
    const analysis = store.taskAnalysisData
    const hasMatrix =
      Boolean(analysis?.levelSeriesEntities?.length) &&
      store.taskAnalysisTaskId === task.id

    if (hasMatrix && analysis) {
      const matrixRows = filterC2ResourceRowsToPanelCountries(
        buildC2SatelliteFlatRowsFromMatrix(analysis, taskEnemies),
      )
      let baseRows = flatCatalogRows.value
      if (!baseRows.length) {
        baseRows = await fetchSeriesFallbackCatalog(task)
      }
      flatCatalogRows.value = mergeMatrixCatalogIntoPanelCatalog(baseRows, matrixRows)
      catalogUsesMatrix.value = true
    } else {
      catalogUsesMatrix.value = false
      flatCatalogRows.value = await fetchSeriesFallbackCatalog(task)
    }
    store.setC2ResourceSatelliteRows(flatCatalogRows.value)
    await reapplyResourceTreeCheckedKeys()
  } catch (error) {
    console.error('加载 C2 资源 catalog 失败:', error)
    flatCatalogRows.value = []
    store.setC2ResourceSatelliteRows([])
  } finally {
    catalogLoading.value = false
  }
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
 * catalog 刷新后恢复 store 中的勾选（不从任务 resources 自动回显）。
 */
const reapplyResourceTreeCheckedKeys = async () => {
  await nextTick()
  const tree = resourceTreeRef.value
  if (!tree) return
  programmaticTreeSync.value = true
  tree.setCheckedKeys([...store.c2TreeCheckedKeys])
  await nextTick()
  programmaticTreeSync.value = false
}

/**
 * 资源树勾选变更：立即同步 Store 供右侧列表过滤；系列写入草稿后再保存任务。
 * 仅使用叶子节点 keys（不含半选父节点），避免取消单个系列时仍匹配整国/整类。
 */
const handleResourceTreeCheck = () => {
  if (programmaticTreeSync.value || !editorDraft.value) return
  const tree = resourceTreeRef.value
  if (!tree) return
  const checkedLeafKeys = tree.getCheckedKeys(true) as string[]
  store.setC2TreeCheckedKeys(checkedLeafKeys)
  const seriesSet = expandCheckedKeysToSeriesNames(checkedLeafKeys, flatCatalogRows.value)
  editorDraft.value.selectedSeries = [...seriesSet].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  if (editorDraft.value.selectedSeries.length > 0) {
    void handleSaveAndRecalculate()
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
  editorDraft.value.selectedWeaponIds = ids
  stashedWeaponIds.value = [...ids]
  void handleSaveAndRecalculate()
}

/** 回显武器表勾选 */
const syncWeaponTableSelection = async () => {
  await nextTick()
  const table = weaponTableRef.value
  if (!table || !useWeaponsEnabled.value || !editorDraft.value) return
  table.clearSelection()
  const wanted = new Set(editorDraft.value.selectedWeaponIds)
  weaponTableRows.value.forEach((row) => {
    const id = String(row.id ?? '')
    if (id && wanted.has(id)) {
      table.toggleRowSelection(row, true)
    }
  })
}

/**
 * 加载武器候选项。
 */
const loadWeaponTagOptions = async () => {
  weaponOptionsLoading.value = true
  try {
    const res = await getAllWeapons()
    const list = res.code === 200 ? (res.data?.weapons ?? []) : []
    weaponTableRows.value = list.filter((weapon) => weapon.id != null && String(weapon.id).length > 0)
    await syncWeaponTableSelection()
  } catch (error) {
    console.error('加载武器列表失败:', error)
    weaponTableRows.value = []
  } finally {
    weaponOptionsLoading.value = false
  }
}

/**
 * 切换任务时同步编辑草稿与资源/武器。
 *
 * @param task 当前任务
 */
const syncEditorForTask = async (task: TaskForm | null | undefined) => {
  editorDraft.value = createDraftFromTask(task)
  if (task && editorDraft.value) {
    stashedWeaponIds.value = [...editorDraft.value.selectedWeaponIds]
    useWeaponsEnabled.value = false
    editorDraft.value.selectedWeaponIds = []
  } else {
    stashedWeaponIds.value = []
    useWeaponsEnabled.value = false
  }
  if (!task) {
    store.clearC2ResourceSelection()
    return
  }
  store.setC2TreeCheckedKeys([])
  await Promise.all([refreshResourceCatalog(task), loadWeaponTagOptions()])
  await clearResourceTreeSelection()
}

/**
 * 监听：任务分析数据 `store.taskAnalysisData`（深度）。
 * 返回：回调不返回清理函数。
 * 作用：分析矩阵就绪且任务 ID 匹配时用 matrix 合并重建资源 catalog。
 */
watch(
  () => store.taskAnalysisData,
  (analysis) => {
    const task = store.activedTask
    if (!task?.id) return
    // 仅在拉取到新的 matrix 分析时重建树；清空分析（保存后等待重算）时不切到系列预览，避免结构闪变
    if (
      analysis?.levelSeriesEntities?.length &&
      store.taskAnalysisTaskId === task.id
    ) {
      void refreshResourceCatalog(task)
    }
  },
  { deep: true },
)

/**
 * 监听：当前激活任务 ID。
 * 返回：回调不返回清理函数。
 * 作用：换任务时重置树排序焦点、刷新作战场景展示令牌并同步编辑草稿与资源。
 */
watch(
  () => store.activedTask?.id,
  () => {
    treeSortFocusCountry.value = null
    combatScenarioDisplayToken.value += 1
    void syncEditorForTask(store.activedTask)
  },
  { immediate: true },
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
    stashedWeaponIds.value = [...editorDraft.value.selectedWeaponIds]
    editorDraft.value.selectedWeaponIds = []
    weaponTableRef.value?.clearSelection()
    void handleSaveAndRecalculate({ forceWeaponIds: [] })
    return
  }
  editorDraft.value.selectedWeaponIds = [...stashedWeaponIds.value]
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
  if (!baseTask?.id || !draft || draft.taskId !== baseTask.id) return
  if (savingRecalc.value) return
  if (!draft.beginDate || !draft.endDate) return
  if (parseTaskPanelTimeMs(draft.endDate) <= parseTaskPanelTimeMs(draft.beginDate)) return
  if (!draft.selectedSeries.length) return
  if (!draft.targetTypeShow.length) return
  const payload = mergeTaskFormWithDraft(baseTask, draft)
  if (options?.forceWeaponIds !== undefined) {
    payload.weaponIds = options.forceWeaponIds
  } else if (!useWeaponsEnabled.value) {
    payload.weaponIds = baseTask.weaponIds ? [...baseTask.weaponIds] : []
  }
  savingRecalc.value = true
  try {
    const res = await updateTask(payload)
    if (res.code !== 200) {
      ElMessage.error(res.msg || '保存任务失败')
      return
    }
    await loadBattleTasks()
    const latest = taskList.value.find((item) => item.id === baseTask.id) || payload
    store.setActivedTask(latest)
    store.clearTaskAnalysisData()
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

      & + & {
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
