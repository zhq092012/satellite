<template>

  <aside class="c2-panel c2-panel--left dark-theme">

    <div class="panel-header">

      <button type="button" class="scene-action-btn" @click="openCreateScene">添加场景</button>

      <button type="button" class="scene-action-btn" :disabled="!store.battle" title="修改当前选择的场景" @click="openEditScene">

        修改场景

      </button>

      <button type="button" class="scene-action-btn" @click="openCreateTask">添加任务</button>

    </div>



    <div class="panel-body">

      <!-- 上：任务名称 + 进度（不滚动） -->

      <section class="panel-zone panel-zone--top">

        <p class="scene-summary" :title="sceneSummaryText">{{ sceneSummaryText }}</p>



        <div v-if="taskLoading && !taskList.length" class="zone-loading">正在加载任务...</div>

        <div v-else-if="!taskList.length" class="zone-empty">当前场景暂无任务</div>

        <ul v-else class="task-progress-list">

          <li

            v-for="task in taskList"

            :key="task.id"

            class="task-progress-item"

            :class="{ active: store.activedTask?.id === task.id, disabled: taskSwitching }"

            @click="selectTask(task)">

            <span class="task-progress-name" :title="task.name">{{ task.name }}</span>

            <div class="task-progress-bar-wrap">

              <template v-if="getTaskProgress(task)">

                <el-progress

                  :percentage="getTaskProgressPercent(getTaskProgress(task))"

                  :status="isTaskProgressComplete(getTaskProgress(task)) ? 'success' : undefined"

                  :stroke-width="5"

                  class="task-progress-bar" />

                <span v-if="getTaskProgress(task)?.mes" class="task-progress-mes">{{ getTaskProgress(task)?.mes }}</span>

              </template>

              <span v-else class="task-progress-mes is-muted">未开始</span>

            </div>

          </li>

        </ul>

      </section>



      <!-- 中：当前任务可编辑项（超出时滚动） -->

      <section class="panel-zone panel-zone--middle">

        <div v-if="taskSwitching" class="zone-loading">正在切换任务...</div>

        <div v-else-if="!editorDraft" class="zone-empty">请选择任务以编辑配置</div>

        <div v-else class="task-editor">

          <div class="tag-section task-time-section">
            <div class="tag-section-head">任务基本信息</div>
            <div class="task-editor-times">
              <label class="time-field">
                <span class="time-label">开始时间</span>
                <input
                  class="task-datetime-input"
                  type="datetime-local"
                  step="60"
                  :value="toTaskDatetimeLocalValue(editorDraft.beginDate)"
                  @input="handleBeginInput(($event.target as HTMLInputElement).value)" />
              </label>
              <label class="time-field">
                <span class="time-label">结束时间</span>
                <input
                  class="task-datetime-input"
                  type="datetime-local"
                  step="60"
                  :value="toTaskDatetimeLocalValue(editorDraft.endDate)"
                  @input="handleEndInput(($event.target as HTMLInputElement).value)" />
              </label>
            </div>

            <div class="task-metric-rows">
              <div class="metric-row">
                <span class="metric-label">任务时长</span>
                <el-input-number
                  v-model="durationHours"
                  class="metric-input-number"
                  size="small"
                  :min="1"
                  :max="8760"
                  :step="1"
                  controls-position="right"
                  @change="handleDurationHoursChange" />
                <span class="metric-unit">小时</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">链路时延</span>
                <el-input-number
                  v-model="editorDraft.delayMin"
                  class="metric-input-number"
                  size="small"
                  :min="1"
                  :max="4320"
                  :step="1"
                  controls-position="right" />
                <span class="metric-unit">分钟</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">覆盖率</span>
                <el-input-number
                  v-model="editorDraft.coverage"
                  class="metric-input-number"
                  size="small"
                  :min="0"
                  :max="100"
                  :step="1"
                  controls-position="right" />
                <span class="metric-unit">%</span>
              </div>
              <div class="metric-row metric-row--types">
                <span class="metric-label">卫星类型</span>
                <div class="tag-cloud metric-type-tags">
                  <el-tag
                    v-for="typeName in TASK_PANEL_SATELLITE_TYPES"
                    :key="typeName"
                    class="task-config-tag"
                    :class="{ 'is-selected': isTargetTypeSelected(typeName) }"
                    :closable="isTargetTypeSelected(typeName)"
                    disable-transitions
                    @close="removeTargetType(typeName)"
                    @click="toggleTargetType(typeName)">
                    {{ typeName }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>

          <div class="tag-section">
            <div class="tag-section-head">任务卫星</div>

            <div v-if="seriesOptionsLoading" class="tag-hint">正在加载系列...</div>

            <div v-else-if="!seriesTagOptions.length" class="tag-hint">暂无系列候选项</div>

            <div v-else class="tag-cloud">

              <el-tag

                v-for="item in seriesTagOptions"

                :key="item.id"

                class="task-config-tag"

                :class="{ 'is-selected': isSeriesSelected(item.id) }"

                :closable="isSeriesSelected(item.id)"

                disable-transitions

                @close="removeSeries(item.id)"

                @click="toggleSeries(item.id)">

                {{ item.label }}

              </el-tag>

            </div>

          </div>



          <div class="tag-section">

            <div class="tag-section-head">任务武器</div>

            <div v-if="weaponOptionsLoading" class="tag-hint">正在加载武器...</div>

            <div v-else-if="!weaponTagOptions.length" class="tag-hint">暂无武器候选项</div>

            <div v-else class="tag-cloud">

              <el-tag

                v-for="item in weaponTagOptions"

                :key="item.id"

                class="task-config-tag"

                :class="{ 'is-selected': isWeaponSelected(item.id) }"

                :closable="isWeaponSelected(item.id)"

                disable-transitions

                @close="removeWeapon(item.id)"

                @click="toggleWeapon(item.id)">

                {{ item.label }}

              </el-tag>

            </div>

          </div>



          <div class="tag-section">

            <div class="tag-section-head">任务地面站</div>

            <div v-if="receiveOptionsLoading" class="tag-hint">正在加载地面站...</div>

            <div v-else-if="!receiveTagOptions.length" class="tag-hint">暂无地面站候选项</div>

            <div v-else class="tag-cloud">

              <el-tag

                v-for="item in receiveTagOptions"

                :key="item.id"

                class="task-config-tag"

                :class="{ 'is-selected': isReceiveSelected(item.id) }"

                :closable="isReceiveSelected(item.id)"

                disable-transitions

                @close="removeReceive(item.id)"

                @click="toggleReceive(item.id)">

                {{ item.label }}

              </el-tag>

            </div>

          </div>

          <div class="tag-section">
            <div class="tag-section-head">任务数据中心</div>
            <div v-if="centerOptionsLoading" class="tag-hint">正在加载数据中心...</div>
            <div v-else-if="!centerTagOptions.length" class="tag-hint">暂无数据中心候选项</div>
            <div v-else class="tag-cloud">
              <el-tag
                v-for="item in centerTagOptions"
                :key="item.id"
                class="task-config-tag"
                :class="{ 'is-selected': isCenterSelected(item.id) }"
                :closable="isCenterSelected(item.id)"
                disable-transitions
                @close="removeCenter(item.id)"
                @click="toggleCenter(item.id)">
                {{ item.label }}
              </el-tag>
            </div>
          </div>
        </div>

      </section>



      <!-- 下：保存并重算 -->

      <footer class="panel-zone panel-zone--bottom">

        <el-button

          type="primary"

          class="save-recalc-btn"

          :loading="savingRecalc"

          :disabled="!editorDraft || taskSwitching"

          @click="handleSaveAndRecalculate">

          保存并重算

        </el-button>

      </footer>

    </div>



    <TaskEditDialog v-model="taskEditVisible" :is-edit="taskEditIsEdit" :task="editingTask" @saved="handleTaskSaved" />

    <SceneEditDialog v-model="sceneEditVisible" :is-edit="sceneEditIsEdit" :scene="editingScene" @saved="handleSceneSaved" />

  </aside>

</template>



<script setup lang="ts">

/**

 * 战场态势 - C2 左侧场景任务面板（上：任务进度列表，中：任务配置，下：保存并重算）。

 */

import { computed, onUnmounted, ref, watch } from 'vue'

import { ElMessage } from 'element-plus'

import { getTaskList, updateTask, getAllWeapons } from '@/api/dashboard'

import { getSatelliteSeries } from '@/api/task/task'

import { getGroundStationList } from '@/api/system/satellite-system-api'

import type { BattleForm, TaskForm } from '@/types/dashboard'

import type { MatrixResult } from '@/api/electronic'

import { useTaskProgressPolling } from '@/composables/useTaskProgressPolling'

import { useLayoutStore } from '@/store/modules/layout'

import TaskEditDialog from '@/components/BattleSituation/TaskEditDialog.vue'

import SceneEditDialog from '@/components/BattleSituation/SceneEditDialog.vue'

import {

  applyDurationHoursToDraft,

  buildSeriesOptionsFromApiData,

  calcTaskDurationHours,

  createDraftFromTask,

  fromTaskDatetimeLocalValue,

  isDataCenterStationType,

  mergeTaskFormWithDraft,

  parseTaskPanelTimeMs,

  TASK_PANEL_SATELLITE_TYPES,

  toTaskDatetimeLocalValue,

  type C2TaskEditorDraft,

  type TaskPanelTagOption,

} from '@/utils/c2TaskPanelEditor'



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

  getTaskProgress,

  getTaskProgressPercent,

  isTaskProgressComplete,

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



const sceneEditVisible = ref(false)

const sceneEditIsEdit = ref(false)

const editingScene = ref<BattleForm | null>(null)



/** 当前选中任务的内联编辑草稿 */

const editorDraft = ref<C2TaskEditorDraft | null>(null)



/** 任务时长（小时），与起止时间联动 */

const durationHours = ref(8)



const seriesTagOptions = ref<TaskPanelTagOption[]>([])

const weaponTagOptions = ref<TaskPanelTagOption[]>([])

const receiveTagOptions = ref<TaskPanelTagOption[]>([])

const centerTagOptions = ref<TaskPanelTagOption[]>([])

const seriesOptionsLoading = ref(false)

const weaponOptionsLoading = ref(false)

const receiveOptionsLoading = ref(false)

const centerOptionsLoading = ref(false)



const sceneSummaryText = computed(() => {

  const scene = store.battle?.name || '未选择'

  const count = taskList.value.length

  const current = store.activedTask?.name || '未选择'

  return `当前场景：${scene}（${count} 个任务）· 当前任务：${current}`

})



/**

 * 拉取当前场景任务列表。

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



watch(

  () => store.battle?.id,

  () => {

    void loadBattleTasks()

  },

  { immediate: true }

)



/**

 * 解析任务卫星类型列表。

 *

 * @param task 任务

 * @returns 类型数组

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

 * 解析系列查询用的蓝方国家列表。

 *

 * @param task 任务

 * @returns 国家列表

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

 * 加载卫星系列候选项。

 *

 * @param task 当前任务

 */

const loadSeriesTagOptions = async (task: TaskForm | null | undefined) => {

  const countries = resolveEnemyCountries(task)

  const types = editorDraft.value?.targetTypeShow?.length

    ? [...editorDraft.value.targetTypeShow]

    : resolveTaskTargetTypes(task)

  if (!countries.length || !types.length) {

    seriesTagOptions.value = (editorDraft.value?.selectedSeries || []).map((series) => ({

      id: series,

      label: series,

    }))

    return

  }

  seriesOptionsLoading.value = true

  try {

    const res = await getSatelliteSeries(countries)

    if (res.code === 200 && res.data) {

      const options = buildSeriesOptionsFromApiData(res.data, types)

      const merged = new Set([...options, ...(editorDraft.value?.selectedSeries || [])])

      seriesTagOptions.value = [...merged]

        .sort((a, b) => a.localeCompare(b, 'zh-CN'))

        .map((series) => ({ id: series, label: series }))

    } else {

      seriesTagOptions.value = (editorDraft.value?.selectedSeries || []).map((series) => ({

        id: series,

        label: series,

      }))

    }

  } catch {

    seriesTagOptions.value = (editorDraft.value?.selectedSeries || []).map((series) => ({

      id: series,

      label: series,

    }))

  } finally {

    seriesOptionsLoading.value = false

  }

}



/**

 * 加载武器候选项。

 */

const loadWeaponTagOptions = async () => {

  weaponOptionsLoading.value = true

  try {

    const res = await getAllWeapons()

    const list = res.code === 200 ? (res.data?.weapons ?? []) : []

    weaponTagOptions.value = list

      .map((weapon) => ({

        id: String(weapon.id ?? ''),

        label: weapon.name || String(weapon.id ?? ''),

      }))

      .filter((item) => item.id)

  } catch {

    weaponTagOptions.value = (editorDraft.value?.selectedWeaponIds || []).map((id) => ({

      id,

      label: id,

    }))

  } finally {

    weaponOptionsLoading.value = false

  }

}



/**

 * 加载地面接收站候选项。

 */

const loadReceiveTagOptions = async () => {

  receiveOptionsLoading.value = true

  try {

    const res = await getGroundStationList({ type: '', name: '', country: '' })

    const list = res.code === 200 ? (res.data ?? []) : []

    receiveTagOptions.value = list

      .filter((item) => !isDataCenterStationType(item.type || ''))

      .map((item) => ({

        id: item._id || item.name,

        label: item.name || item._id || '',

      }))

      .filter((item) => item.id)

    const knownIds = new Set(receiveTagOptions.value.map((item) => item.id))

    ;(editorDraft.value?.selectedReceiveIds || []).forEach((id) => {

      if (!knownIds.has(id)) {

        receiveTagOptions.value.push({ id, label: id })

      }

    })

  } catch {

    receiveTagOptions.value = (editorDraft.value?.selectedReceiveIds || []).map((id) => ({

      id,

      label: id,

    }))

  } finally {

    receiveOptionsLoading.value = false

  }

}



/**

 * 加载数据中心候选项。

 */

const loadCenterTagOptions = async () => {

  centerOptionsLoading.value = true

  try {

    const res = await getGroundStationList({ type: '', name: '', country: '' })

    const list = res.code === 200 ? (res.data ?? []) : []

    centerTagOptions.value = list

      .filter((item) => isDataCenterStationType(item.type || ''))

      .map((item) => ({

        id: item._id || item.name,

        label: item.name || item._id || '',

      }))

      .filter((item) => item.id)

    const knownIds = new Set(centerTagOptions.value.map((item) => item.id))

    ;(editorDraft.value?.stationIds || []).forEach((id) => {

      if (!knownIds.has(id)) {

        centerTagOptions.value.push({ id, label: id })

      }

    })

  } catch {

    centerTagOptions.value = (editorDraft.value?.stationIds || []).map((id) => ({

      id,

      label: id,

    }))

  } finally {

    centerOptionsLoading.value = false

  }

}



/**

 * 切换任务时同步编辑草稿与候选项。

 *

 * @param task 当前任务

 */

const syncEditorForTask = async (task: TaskForm | null | undefined) => {

  editorDraft.value = createDraftFromTask(task)

  if (task && editorDraft.value) {

    durationHours.value = calcTaskDurationHours(editorDraft.value.beginDate, editorDraft.value.endDate)

  }

  if (!task) return

  await Promise.all([

    loadSeriesTagOptions(task),

    loadWeaponTagOptions(),

    loadReceiveTagOptions(),

    loadCenterTagOptions(),

  ])

}



watch(

  () => store.activedTask?.id,

  () => {

    void syncEditorForTask(store.activedTask)

  },

  { immediate: true }

)



watch(

  () =>

    editorDraft.value

      ? ([editorDraft.value.beginDate, editorDraft.value.endDate] as const)

      : null,

  (range) => {

    if (!range || !editorDraft.value) return

    durationHours.value = calcTaskDurationHours(range[0], range[1])

  }

)



const isTargetTypeSelected = (typeName: string) =>

  editorDraft.value?.targetTypeShow.includes(typeName) ?? false



/**

 * 选中卫星类型并刷新系列候选项。

 *

 * @param typeName 类型名

 */

const toggleTargetType = (typeName: string) => {

  if (!editorDraft.value || editorDraft.value.targetTypeShow.includes(typeName)) return

  editorDraft.value.targetTypeShow = [...editorDraft.value.targetTypeShow, typeName]

  void loadSeriesTagOptions(store.activedTask)

}



/**

 * 取消卫星类型；至少保留一种。

 *

 * @param typeName 类型名

 */

const removeTargetType = (typeName: string) => {

  if (!editorDraft.value) return

  if (editorDraft.value.targetTypeShow.length <= 1) {

    ElMessage.warning('请至少保留一种卫星类型')

    return

  }

  editorDraft.value.targetTypeShow = editorDraft.value.targetTypeShow.filter((item) => item !== typeName)

  void loadSeriesTagOptions(store.activedTask)

}



/**

 * 修改任务时长时联动结束时间。

 *

 * @param value 小时数

 */

const handleDurationHoursChange = (value: number | undefined) => {

  if (!editorDraft.value || value == null || Number.isNaN(value)) return

  applyDurationHoursToDraft(editorDraft.value, value)

  durationHours.value = Math.max(1, Math.round(value))

}



const isSeriesSelected = (series: string) => editorDraft.value?.selectedSeries.includes(series) ?? false

const isWeaponSelected = (id: string) => editorDraft.value?.selectedWeaponIds.includes(id) ?? false

const isReceiveSelected = (id: string) => editorDraft.value?.selectedReceiveIds.includes(id) ?? false

const isCenterSelected = (id: string) => editorDraft.value?.stationIds.includes(id) ?? false



/**

 * 切换系列选中状态。

 *

 * @param series 系列名

 */

const toggleSeries = (series: string) => {

  if (!editorDraft.value) return

  const list = editorDraft.value.selectedSeries

  if (list.includes(series)) return

  editorDraft.value.selectedSeries = [...list, series]

}



/**

 * 取消选中系列。

 *

 * @param series 系列名

 */

const removeSeries = (series: string) => {

  if (!editorDraft.value) return

  editorDraft.value.selectedSeries = editorDraft.value.selectedSeries.filter((item) => item !== series)

}



const toggleWeapon = (id: string) => {

  if (!editorDraft.value || editorDraft.value.selectedWeaponIds.includes(id)) return

  editorDraft.value.selectedWeaponIds = [...editorDraft.value.selectedWeaponIds, id]

}



const removeWeapon = (id: string) => {

  if (!editorDraft.value) return

  editorDraft.value.selectedWeaponIds = editorDraft.value.selectedWeaponIds.filter((item) => item !== id)

}



const toggleReceive = (id: string) => {

  if (!editorDraft.value || editorDraft.value.selectedReceiveIds.includes(id)) return

  editorDraft.value.selectedReceiveIds = [...editorDraft.value.selectedReceiveIds, id]

}



const removeReceive = (id: string) => {

  if (!editorDraft.value) return

  editorDraft.value.selectedReceiveIds = editorDraft.value.selectedReceiveIds.filter((item) => item !== id)

}



const toggleCenter = (id: string) => {

  if (!editorDraft.value || editorDraft.value.stationIds.includes(id)) return

  editorDraft.value.stationIds = [...editorDraft.value.stationIds, id]

}



const removeCenter = (id: string) => {

  if (!editorDraft.value) return

  editorDraft.value.stationIds = editorDraft.value.stationIds.filter((item) => item !== id)

}



/**

 * 更新开始时间。

 *

 * @param value datetime-local 值

 */

const handleBeginInput = (value: string) => {

  if (!editorDraft.value) return

  editorDraft.value.beginDate = fromTaskDatetimeLocalValue(value)

}



/**

 * 更新结束时间。

 *

 * @param value datetime-local 值

 */

const handleEndInput = (value: string) => {

  if (!editorDraft.value) return

  editorDraft.value.endDate = fromTaskDatetimeLocalValue(value)

}



const openCreateScene = () => {

  sceneEditIsEdit.value = false

  editingScene.value = null

  sceneEditVisible.value = true

}



const openCreateTask = () => {

  if (!store.battle?.id) {

    ElMessage.warning('请先选择当前场景后再添加任务')

    return

  }

  taskEditIsEdit.value = false

  editingTask.value = null

  taskEditVisible.value = true

}



const openEditScene = () => {

  if (!store.battle) {

    ElMessage.warning('请先在顶部选择当前场景')

    return

  }

  sceneEditIsEdit.value = true

  editingScene.value = store.battle

  sceneEditVisible.value = true

}



const handleSceneSaved = async (scene: BattleForm) => {

  const prevId = store.battle?.id

  store.setActivedBattle(scene)

  await loadBattleTasks()

  if (scene.id !== prevId) {

    store.setActivedTask(taskList.value[0] ?? null)

    store.setSelectedSatSeries('')

  }

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

  await syncEditorForTask(latest)

  if (isCreate) {

    ElMessage.success(`已切换到新任务：${latest.name}`)

  }

}



/**

 * 切换当前任务。

 *

 * @param task 目标任务

 */

const selectTask = async (task: TaskForm) => {

  if (taskLoading.value || taskSwitching.value) return

  if (store.activedTask?.id === task.id) return

  taskSwitching.value = true

  try {

    store.setActivedTask(task)

    store.setSelectedSatSeries('')

    await syncEditorForTask(task)

    ElMessage.success(`已切换当前任务：${task.name}`)

    if (store.selectedSatSeries) {

      await store.fetchMatrixForCurrentScope(true)

    }

  } catch (err) {

    console.error('切换任务失败:', err)

  } finally {

    taskSwitching.value = false

  }

}



/**

 * 校验并提交任务修改，触发后台重算。

 */

const handleSaveAndRecalculate = async () => {

  const baseTask = store.activedTask

  const draft = editorDraft.value

  if (!baseTask?.id || !draft || draft.taskId !== baseTask.id) {

    ElMessage.warning('请先选择任务')

    return

  }

  if (!draft.beginDate || !draft.endDate) {

    ElMessage.warning('请填写开始与结束时间')

    return

  }

  if (parseTaskPanelTimeMs(draft.endDate) <= parseTaskPanelTimeMs(draft.beginDate)) {

    ElMessage.warning('结束时间必须晚于开始时间')

    return

  }

  if (!draft.selectedSeries.length) {

    ElMessage.warning('请至少保留一个卫星系列')

    return

  }

  if (!draft.targetTypeShow.length) {

    ElMessage.warning('请至少选择一种卫星类型')

    return

  }



  const payload = mergeTaskFormWithDraft(baseTask, draft)

  savingRecalc.value = true

  try {

    const res = await updateTask(payload)

    if (res.code !== 200) {

      ElMessage.error(res.msg || '保存任务失败')

      return

    }

    ElMessage.success('已保存，任务重新计算中')

    await loadBattleTasks()

    const latest = taskList.value.find((item) => item.id === baseTask.id) || payload

    store.setActivedTask(latest)

    store.setSelectedSatSeries('')

    store.clearTaskAnalysisData()

    await startTaskProgressPolling(baseTask.id)

    await syncEditorForTask(latest)

    emit('task-recalculated', baseTask.id)

  } catch (error) {

    console.error('保存并重算失败:', error)

    ElMessage.error('保存并重算失败')

  } finally {

    savingRecalc.value = false

  }

}



onUnmounted(() => {

  stopAllTaskProgressPolling()

})

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

  backdrop-filter: blur(8px);

  color: #e2efff;

  overflow: hidden;

  gap: 10px;



  &--left {

    border-left: none;

    border-top: none;

    border-bottom: none;

  }

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

    padding: 0 8px;

    font-size: 12px;

    font-weight: 700;

    color: #7dd3fc;

    background: rgba(0, 225, 255, 0.08);

    border: 1px solid rgba(0, 225, 255, 0.35);

    border-radius: 6px;

    cursor: pointer;



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



.panel-body {

  display: flex;

  flex-direction: column;

  flex: 1;

  min-height: 0;

  gap: 8px;

}



.panel-zone {

  border: 1px dashed rgba(0, 225, 255, 0.22);

  border-radius: 6px;

  background: rgba(12, 22, 38, 0.72);

  box-sizing: border-box;



  &--top {

    flex-shrink: 0;

    padding: 8px 10px;

  }



  &--middle {

    flex: 1;

    min-height: 0;

    overflow: hidden;

    display: flex;

    flex-direction: column;

  }



  &--bottom {

    flex-shrink: 0;

    padding: 10px;

    border-style: solid;

  }

}



.scene-summary {

  margin: 0 0 8px;

  font-size: 11px;

  line-height: 1.4;

  color: #7dd3fc;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}



.task-progress-list {

  list-style: none;

  margin: 0;

  padding: 0;

  display: flex;

  flex-direction: column;

  gap: 6px;

}



.task-progress-item {

  padding: 8px 10px;

  border-radius: 6px;

  border: 1px solid rgba(79, 147, 221, 0.25);

  background: rgba(18, 36, 62, 0.55);

  cursor: pointer;

  transition: border-color 0.2s ease, background 0.2s ease;



  &.active {

    border-color: #00e1ff;

    background: rgba(0, 225, 255, 0.1);

  }



  &.disabled {

    pointer-events: none;

    opacity: 0.55;

  }



  &:hover:not(.disabled) {

    border-color: rgba(0, 225, 255, 0.55);

  }

}



.task-progress-name {

  display: block;

  font-size: 14px;

  font-weight: 700;

  color: #e2efff;

  margin-bottom: 4px;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}



.task-progress-bar-wrap {

  display: flex;

  flex-direction: column;

  gap: 2px;

}



.task-progress-mes {

  font-size: 10px;

  color: #7dd3fc;

  line-height: 1.3;



  &.is-muted {

    color: #64748b;

  }

}



.task-editor {

  flex: 1;

  min-height: 0;

  overflow-y: auto;

  padding: 10px 12px 12px;

  text-align: left;



  &::-webkit-scrollbar {

    width: 4px;

  }



  &::-webkit-scrollbar-thumb {

    background: rgba(0, 225, 255, 0.3);

    border-radius: 3px;

  }

}



.task-time-section .task-editor-times {

  margin-bottom: 0;

}



.task-metric-rows {

  display: flex;

  flex-direction: column;

  gap: 10px;

  margin-top: 12px;

}



.metric-row {

  display: grid;

  grid-template-columns: 72px minmax(0, 1fr) 36px;

  align-items: center;

  column-gap: 8px;

}



.metric-row--types {

  grid-template-columns: 72px minmax(0, 1fr);

  align-items: start;

}



.metric-label {

  font-size: 12px;

  color: #94a3b8;

  text-align: left;

}



.metric-input-number {

  width: 100%;

  max-width: none;

}



.metric-input-number :deep(.atlas-app-input-number) {

  width: 100%;

}



.metric-input-number :deep(.atlas-app-input-number .atlas-app-input__wrapper) {

  min-height: 28px;

  padding-top: 0;

  padding-bottom: 0;

}



.metric-input-number :deep(.atlas-app-input-number .atlas-app-input__inner) {

  height: 26px;

  line-height: 26px;

}



.metric-unit {

  font-size: 12px;

  color: #64748b;

  width: 36px;

  flex-shrink: 0;

  text-align: left;

}



.metric-type-tags {

  grid-column: 2;

}



.tag-section-head {

  margin-bottom: 6px;

  font-size: 12px;

  font-weight: 700;

  color: #7dd3fc;

  text-align: left;

}



.task-editor-times {

  display: flex;

  flex-direction: column;

  gap: 8px;

  margin-bottom: 12px;

}



.time-field {

  display: flex;

  flex-direction: column;

  gap: 4px;

}



.time-label {

  font-size: 11px;

  color: #94a3b8;

}



.task-datetime-input {

  width: 100%;

  height: 32px;

  padding: 0 10px;

  box-sizing: border-box;

  border-radius: 6px;

  border: 1px solid rgba(0, 225, 255, 0.28);

  background: rgba(8, 15, 26, 0.85);

  color: #e2e8f0;

  font-size: 12px;

}



.tag-section {

  margin-bottom: 12px;

}



.tag-hint {

  font-size: 11px;

  color: #64748b;

}



.tag-cloud {

  display: flex;

  flex-wrap: wrap;

  gap: 6px;

  justify-content: flex-start;

}



.task-config-tag {

  cursor: pointer;

  border-color: rgba(100, 116, 139, 0.45);

  background: rgba(15, 23, 42, 0.8);

  color: #94a3b8;



  &.is-selected {

    border-color: rgba(0, 225, 255, 0.65);

    background: rgba(0, 225, 255, 0.14);

    color: #e0f2fe;

  }

}



.save-recalc-btn {

  width: 100%;

  height: 38px;

  font-weight: 700;

}



.zone-loading,

.zone-empty {

  padding: 16px 12px;

  font-size: 12px;

  color: #64748b;

  text-align: center;

}



.zone-loading {

  color: #7dd3fc;

}

</style>


