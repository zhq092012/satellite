<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">任务列表（当前战场）</span>
      </div>
      <span class="battle-name-tag" :title="store.battle?.name || '当前战场'">
        {{ store.battle?.name || '当前战场' }}
      </span>
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
          <span class="task-count">包含任务 {{ taskList.length }} 个</span>
          <span class="task-current" :title="store.activedTask?.name || '未选择任务'">
            当前任务：{{ store.activedTask?.name || '未选择' }}
          </span>
        </div>

        <div class="task-filter-container">
          <!-- 搜索输入框 + 搜索按钮 -->
          <div class="task-search-row">
            <el-input v-model="taskSearchKey" size="small" placeholder="搜索任务名称/作战目标..." clearable :prefix-icon="Search"
              class="task-search-input" @keyup.enter="handleSearch" @clear="handleSearch" />
            <el-button type="primary" size="small" class="task-search-btn" :icon="Search" @click="handleSearch">
              搜索
            </el-button>
          </div>

          <!-- 排序与折叠控制栏 (Image 1 风格) -->
          <div class="filter-action-bar">
            <div class="sort-box">
              <span class="sort-icon">⇅</span>
              <el-select v-model="sortOrder" size="small" class="sort-select" popper-class="cyber-select-popper">
                <el-option label="默认顺序" value="default" />
                <el-option label="时间降序 (最新)" value="time-desc" />
                <el-option label="时间升序 (最早)" value="time-asc" />
                <el-option label="任务名称 (A-Z)" value="name" />
              </el-select>
            </div>

            <button type="button" class="filter-toggle-btn" :class="{ active: isFilterExpanded }"
              @click="isFilterExpanded = !isFilterExpanded" title="展开/收起筛选面板">
              <el-icon class="btn-icon">
                <Operation />
              </el-icon>
              <span>{{ isFilterExpanded ? '收起筛选' : '指标筛选' }}</span>
            </button>
          </div>

          <!-- 可折叠筛选卡片 (Image 1 风格边框与滑块 + Image 2 Tag 多选) -->
          <el-collapse-transition>
            <div v-show="isFilterExpanded" class="collapsible-filter-panel">
              <!-- 2. Tag 选择组 (Image 2) -->
              <div class="tags-filter-group">
                <!-- 卫星类型 (五大类) -->
                <div class="filter-group">
                  <div class="filter-group-header">
                    <span class="group-title">卫星类型</span>
                    <span v-if="selectedSatTypes.length > 0" class="group-clear-btn" @click="clearSatTypes">
                      重置
                    </span>
                  </div>
                  <div class="filter-tags-wrap">
                    <span v-for="type in SATELLITE_TYPES" :key="type" class="filter-tag-chip"
                      :class="{ active: selectedSatTypes.includes(type) }" @click="toggleSatType(type)">
                      {{ type }}
                    </span>
                  </div>
                </div>

                <!-- 卫星系列 (矩阵中返回的所有系列) -->
                <div class="filter-group" v-if="seriesOptions.length > 0">
                  <div class="filter-group-header">
                    <span class="group-title">卫星系列</span>
                    <span v-if="selectedSatSeriesList.length > 0" class="group-clear-btn" @click="clearSatSeries">
                      重置
                    </span>
                  </div>
                  <div class="filter-tags-wrap">
                    <span v-for="series in seriesOptions" :key="series" class="filter-tag-chip"
                      :class="{ active: selectedSatSeriesList.includes(series) }" @click="toggleSatSeries(series)">
                      {{ series }}
                    </span>
                  </div>
                </div>

                <!-- 打击方案 (打击军用、打击民用、打击军用民用) -->
                <div class="filter-group">
                  <div class="filter-group-header">
                    <span class="group-title">打击方案</span>
                  </div>
                  <div class="filter-tags-wrap">
                    <span v-for="opt in strikeSchemeOptions" :key="opt.value" class="filter-tag-chip"
                      :class="{ active: selectedStrikeSchemes.includes(opt.value) }"
                      @click="toggleStrikeScheme(opt.value)">
                      {{ opt.label }}
                    </span>
                  </div>
                </div>
              </div>


              <!-- 分割虚线 -->
              <div class="filter-divider" />

              <!-- 1. 指标滑块组 (Image 1) -->
              <div class="metrics-filter-group">
                <!-- 威胁度 -->
                <div class="metric-slider-item">
                  <div class="slider-header">
                    <span class="slider-label slider-label--threat">🛡️ 威胁度 ≥</span>
                    <span class="slider-val slider-val--threat">{{ filterThreat }}分</span>
                  </div>
                  <el-slider v-model="filterThreat" :min="0" :max="100" :step="1" size="small"
                    class="cyber-slider cyber-slider--threat" />
                </div>

                <!-- 链路延迟 -->
                <div class="metric-slider-item">
                  <div class="slider-header">
                    <span class="slider-label slider-label--delay">📶 链路延迟 ≤</span>
                    <span class="slider-val slider-val--delay">{{ filterDelay }}ms</span>
                  </div>
                  <el-slider v-model="filterDelay" :min="0" :max="1000" :step="10" size="small"
                    class="cyber-slider cyber-slider--delay" />
                </div>

                <!-- 覆盖率 -->
                <div class="metric-slider-item">
                  <div class="slider-header">
                    <span class="slider-label slider-label--coverage">🌐 覆盖率 ≥</span>
                    <span class="slider-val slider-val--coverage">{{ filterCoverage }}%</span>
                  </div>
                  <el-slider v-model="filterCoverage" :min="0" :max="100" :step="1" size="small"
                    class="cyber-slider cyber-slider--coverage" />
                </div>
              </div>
            </div>
          </el-collapse-transition>
        </div>

        <div class="task-scroll-list">
          <div v-for="task in filteredTaskList" :key="task.id" class="task-item-card"
            :class="{ active: store.activedTask?.id === task.id, disabled: taskSwitching }" @click="selectTask(task)">
            <div class="task-card-top">
              <span class="task-icon">🎯</span>
              <span class="task-name" :title="task.name">{{ task.name }}</span>
              <span class="task-status-badge">
                {{ store.activedTask?.id === task.id ? '✓ 当前任务' : '点击切换' }}
              </span>
            </div>

            <div class="task-card-meta" v-if="task.targetType || task.beginDate || task.description">
              <div class="meta-tags-row" v-if="task.targetType || task.enemyCountry">
                <span v-if="task.targetType" class="meta-tag tag-target" title="作战目标">
                  目标: {{ task.targetType }}
                </span>
                <span v-if="task.enemyCountry" class="meta-tag tag-country" title="敌方国家">
                  敌方: {{ task.enemyCountry }}
                </span>
              </div>

              <div class="meta-time-row" v-if="task.beginDate || task.endDate">
                <span class="time-label">周期:</span>
                <span class="time-val">{{ formatTaskDate(task.beginDate) }} ~ {{ formatTaskDate(task.endDate) }}</span>
              </div>

              <div class="meta-desc-row" v-if="task.description">
                <span class="desc-text" :title="task.description">{{ task.description }}</span>
              </div>
            </div>
          </div>

          <div v-if="filteredTaskList.length === 0" class="task-search-empty">
            无匹配任务
          </div>
        </div>
      </div>

      <div v-else class="task-empty-tip">
        当前战场暂无任务数据
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * [功能]
 * 战场态势 - C2 左侧战场任务列表控制面板
 *
 * [处理规则]
 * - 集中展示当前战场下的所有任务列表
 * - 支持按关键词、卫星类型（五大类Tag多选）、卫星系列（Tag多选）、打击方案（Tag多选）多维度过滤与检索
 * - 点击任务一键切换全局当前任务，联动刷新全局 Store 方案与矩阵数据
 */
import { ref, computed, watch } from 'vue'
import { Search, Operation } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getTaskList } from '@/api/dashboard'
import type { TaskForm } from '@/types/dashboard'
import type { MatrixResult } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'

/** 卫星五大类（创建任务时的五大类） */
const SATELLITE_TYPES = ['侦察', '导航', '通信', '导弹预警', '空间目标监视与攻防'] as const

/** 打击方案三类（打击军用、打击民用、打击军用民用） */
const strikeSchemeOptions = [
  { value: '军用', label: '打击军用' },
  { value: '民用', label: '打击民用' },
  { value: '军用民用', label: '打击军用民用' },
]

/** 组件接收的矩阵数据及当前选中卫星信息（保持兼容） */
const props = defineProps<{
  /** 算法矩阵响应式数据 */
  matrixData?: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

/** 组件向父级触发的事件（保持兼容） */
const emit = defineEmits<{
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
/** 任务快速搜索关键词 */
const taskSearchKey = ref('')
/** 点击搜索或回车确认的搜索词 */
const confirmedSearchKey = ref('')

/** 筛选面板是否展开（可折叠） */
const isFilterExpanded = ref(true)

/** 任务排序方式：default(默认顺序) / time-desc(时间降序) / time-asc(时间升序) / name(任务名称) */
const sortOrder = ref('default')

/** 指标滑块筛选 (威胁度, 链路延迟, 覆盖率) */
const filterThreat = ref(0)
const filterDelay = ref(1000)
const filterCoverage = ref(0)

/** 选中的卫星类型列表（多选） */
const selectedSatTypes = ref<string[]>(
  store.selectedSatType ? store.selectedSatType.split(',').filter(Boolean) : []
)

/** 选中的卫星系列列表（多选） */
const selectedSatSeriesList = ref<string[]>(
  store.selectedSatSeries ? [store.selectedSatSeries] : []
)

/** 选中的打击方案列表（多选） */
const selectedStrikeSchemes = ref<string[]>(
  Array.isArray(store.selectedZhchUsageTypes) && store.selectedZhchUsageTypes.length > 0
    ? [...store.selectedZhchUsageTypes]
    : [store.activeZhchUsageType || '军用']
)

/** 监听 store 中的卫星类型、系列、打击方案变动，保持面板内双向同步 */
watch(
  () => store.selectedSatType,
  (val) => {
    const list = val ? val.split(',').filter(Boolean) : []
    if (JSON.stringify(list) !== JSON.stringify(selectedSatTypes.value)) {
      selectedSatTypes.value = list
    }
  }
)

watch(
  () => store.selectedSatSeries,
  (val) => {
    if (!val) {
      if (selectedSatSeriesList.value.length > 0) selectedSatSeriesList.value = []
    } else if (!selectedSatSeriesList.value.includes(val)) {
      selectedSatSeriesList.value = [val]
    }
  }
)

watch(
  () => store.activeZhchUsageType,
  (val) => {
    if (val && !selectedStrikeSchemes.value.includes(val)) {
      selectedStrikeSchemes.value = [val]
    }
  }
)

/** 从当前方案和矩阵中提取所有卫星系列列表 */
const seriesOptions = computed<string[]>(() => {
  const seriesSet = new Set<string>()
  if (store.zhchPlanSeriesList && Array.isArray(store.zhchPlanSeriesList)) {
    store.zhchPlanSeriesList.forEach((s) => {
      if (s) seriesSet.add(s)
    })
  }
  const mData = props.matrixData || store.matrixData
  if (mData) {
    if (Array.isArray(mData.initMatrixList)) {
      mData.initMatrixList.forEach((m: any) => {
        if (m?.series) seriesSet.add(m.series)
      })
    }
    // if (Array.isArray(mData.coverRateMatrices)) {
    //   mData.coverRateMatrices.forEach((c: any) => {
    //     if (c?.series) seriesSet.add(c.series)
    //   })
    // }
  }
  return Array.from(seriesSet)
})

/** 切换卫星类型选中状态 (多选) */
const toggleSatType = (type: string) => {
  const idx = selectedSatTypes.value.indexOf(type)
  if (idx > -1) {
    selectedSatTypes.value.splice(idx, 1)
  } else {
    selectedSatTypes.value.push(type)
  }
  store.selectedSatType = selectedSatTypes.value.join(',')
}

const clearSatTypes = () => {
  selectedSatTypes.value = []
  store.selectedSatType = ''
}

/** 切换卫星系列选中状态 (多选) */
const toggleSatSeries = (series: string) => {
  const idx = selectedSatSeriesList.value.indexOf(series)
  if (idx > -1) {
    selectedSatSeriesList.value.splice(idx, 1)
  } else {
    selectedSatSeriesList.value.push(series)
  }
  const activeSeries = selectedSatSeriesList.value.length === 1 ? selectedSatSeriesList.value[0] : ''
  store.setSelectedSatSeries(activeSeries)
}

const clearSatSeries = () => {
  selectedSatSeriesList.value = []
  store.setSelectedSatSeries('')
}

/** 切换打击方案选中状态 (多选) */
const toggleStrikeScheme = async (val: string) => {
  const idx = selectedStrikeSchemes.value.indexOf(val)
  if (idx > -1) {
    if (selectedStrikeSchemes.value.length > 1) {
      selectedStrikeSchemes.value.splice(idx, 1)
    }
  } else {
    selectedStrikeSchemes.value.push(val)
  }
  store.selectedZhchUsageTypes = [...selectedStrikeSchemes.value]
  const lastActive = selectedStrikeSchemes.value[selectedStrikeSchemes.value.length - 1]
  if (lastActive && lastActive !== store.activeZhchUsageType) {
    await store.setActiveZhchUsageType(lastActive)
  }
}

/** 执行搜索 */
const handleSearch = () => {
  confirmedSearchKey.value = taskSearchKey.value.trim().toLowerCase()
}

/** 加载当前战场下的所有任务 */
const loadBattleTasks = async () => {
  const battleId = store.battle?.id
  if (!battleId) {
    taskList.value = store.battle?.tasks || []
    return
  }
  taskLoading.value = true
  try {
    const res = await getTaskList(battleId)
    if (res.code === 200 && Array.isArray(res.data)) {
      taskList.value = res.data
    } else {
      taskList.value = store.battle?.tasks || []
    }
  } catch (error) {
    console.error('加载战场任务列表失败:', error)
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

/** 根据卫星类型和搜索关键词筛选后的任务列表 */
const filteredTaskList = computed<TaskForm[]>(() => {
  let list = taskList.value

  // 1. 卫星类型多选筛选 (五大类)
  if (selectedSatTypes.value.length > 0) {
    list = list.filter((t) =>
      selectedSatTypes.value.some((st) => t.targetType && t.targetType.includes(st))
    )
  }

  // 2. 搜索关键词筛选（实时输入或点击搜索均响应）
  const query = (taskSearchKey.value || confirmedSearchKey.value).trim().toLowerCase()
  if (query) {
    list = list.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(query)) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.targetType && t.targetType.toLowerCase().includes(query)) ||
        (t.enemyCountry && t.enemyCountry.toLowerCase().includes(query))
    )
  }

  // 3. 排序 (默认顺序 / 时间升序 / 时间降序 / 名称)
  if (sortOrder.value === 'time-desc') {
    list = [...list].sort((a, b) => {
      const ta = a.beginDate ? new Date(a.beginDate).getTime() : 0
      const tb = b.beginDate ? new Date(b.beginDate).getTime() : 0
      return tb - ta
    })
  } else if (sortOrder.value === 'time-asc') {
    list = [...list].sort((a, b) => {
      const ta = a.beginDate ? new Date(a.beginDate).getTime() : 0
      const tb = b.beginDate ? new Date(b.beginDate).getTime() : 0
      return ta - tb
    })
  } else if (sortOrder.value === 'name') {
    list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }

  return list
})

/** 格式化任务日期字符串展示 */
const formatTaskDate = (dateStr?: string) => {
  if (!dateStr) return '--'
  return dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr
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
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  flex-shrink: 0;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .battle-name-tag {
    max-width: 160px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.12);
    color: #5ce1e6;
    border: 1px solid rgba(0, 225, 255, 0.3);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
      justify-content: space-between;
      font-size: 11px;
      color: #7dd3fc;
      padding-bottom: 6px;
      border-bottom: 1px rgba(0, 225, 255, 0.15) solid;
      flex-shrink: 0;

      .task-count {
        font-weight: 600;
        flex-shrink: 0;
      }

      .task-current {
        flex: 1;
        min-width: 0;
        margin-left: 8px;
        padding: 1px 8px;
        border-radius: 4px;
        text-align: right;
        font-weight: 700;
        color: #40f2ff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .task-filter-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      margin: 2px 0 6px;
      flex-shrink: 0;
      background: rgba(10, 24, 44, 0.55);
      border: 1px solid rgba(0, 225, 255, 0.16);
      border-radius: 6px;

      .task-search-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;

        :deep(.task-search-input) {
          flex: 1;
          min-width: 0;

          .el-input__wrapper {
            background-color: rgba(8, 20, 36, 0.85);
            box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.25) inset;
            border-radius: 4px;
            padding: 1px 8px;
            transition: all 0.2s ease;

            &:hover {
              box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.5) inset, 0 0 6px rgba(0, 225, 255, 0.15);
            }

            &.is-focus {
              box-shadow: 0 0 0 1px #00e1ff inset, 0 0 8px rgba(0, 225, 255, 0.3) !important;
            }
          }

          .el-input__inner {
            color: #e2efff;
            font-size: 11px;
            height: 26px;
            line-height: 26px;

            &::placeholder {
              color: rgba(158, 197, 237, 0.45);
            }
          }

          .el-input__prefix {
            color: #40f2ff;
            margin-right: 4px;
          }

          .el-input__clear {
            color: #7dd3fc;
            font-size: 12px;

            &:hover {
              color: #ffffff;
            }
          }
        }

        .task-search-btn {
          flex-shrink: 0;
          height: 26px;
          padding: 0 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          background: linear-gradient(135deg, rgba(0, 225, 255, 0.25), rgba(14, 116, 144, 0.45));
          border: 1px solid rgba(0, 225, 255, 0.45);
          color: #40f2ff;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            background: linear-gradient(135deg, rgba(0, 225, 255, 0.4), rgba(14, 116, 144, 0.65));
            border-color: #00e1ff;
            box-shadow: 0 0 8px rgba(0, 225, 255, 0.35);
            color: #ffffff;
          }

          &:active {
            transform: scale(0.97);
          }
        }
      }

      .filter-action-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 2px 0 2px;
        gap: 6px;

        .sort-box {
          display: flex;
          align-items: center;
          gap: 4px;

          .sort-icon {
            color: #00e1ff;
            font-size: 13px;
            font-weight: 700;
          }

          :deep(.sort-select) {
            width: 120px;

            .el-select__wrapper {
              background-color: rgba(8, 20, 36, 0.85);
              box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.25) inset;
              border-radius: 4px;
              padding: 0 8px;
              min-height: 26px;
              height: 26px;
              font-size: 11px;
              color: #e2efff;

              &:hover {
                box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.5) inset;
              }

              &.is-focused {
                box-shadow: 0 0 0 1px #00e1ff inset, 0 0 6px rgba(0, 225, 255, 0.3) !important;
              }

              .el-select__selected-item {
                color: #e2efff;
                font-size: 11px;
              }

              .el-select__suffix {
                color: #40f2ff;
              }
            }
          }
        }

        .filter-toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 26px;
          padding: 0 10px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 4px;
          background: rgba(0, 225, 255, 0.08);
          border: 1px solid rgba(0, 225, 255, 0.6);
          color: #00e1ff;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

          .btn-icon {
            font-size: 12px;
          }

          &:hover {
            background: rgba(0, 225, 255, 0.2);
            box-shadow: 0 0 8px rgba(0, 225, 255, 0.35);
            color: #ffffff;
          }

          &.active {
            background: rgba(0, 225, 255, 0.22);
            border-color: #00e1ff;
            box-shadow: 0 0 10px rgba(0, 225, 255, 0.45);
            color: #40f2ff;
          }
        }
      }

      .collapsible-filter-panel {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-top: 4px;
        padding: 10px 12px;
        background: rgba(8, 18, 32, 0.88);
        border: 1px solid rgba(0, 225, 255, 0.4);
        border-radius: 6px;
        box-shadow: 0 0 12px rgba(0, 0, 0, 0.4), inset 0 0 12px rgba(0, 225, 255, 0.05);

        .metrics-filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .metric-slider-item {
            display: flex;
            flex-direction: column;
            gap: 2px;

            .slider-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 11px;
              font-weight: 600;

              .slider-label--threat,
              .slider-val--threat {
                color: #f87171;
                font-family: monospace, system-ui;
              }

              .slider-label--delay,
              .slider-val--delay {
                color: #38bdf8;
                font-family: monospace, system-ui;
              }

              .slider-label--coverage,
              .slider-val--coverage {
                color: #fbbf24;
                font-family: monospace, system-ui;
              }
            }

            :deep(.cyber-slider) {
              --el-slider-height: 4px;

              .el-slider__runway {
                height: 4px;
                margin: 6px 0;
                background-color: rgba(79, 147, 221, 0.25);
                border-radius: 2px;
              }

              .el-slider__bar {
                height: 4px;
                border-radius: 2px;
              }

              .el-slider__button-wrapper {
                top: -14px;
                width: 32px;
                height: 32px;
              }

              .el-slider__button {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
              }

              &.cyber-slider--threat {
                .el-slider__bar {
                  background: #ef4444;
                }

                .el-slider__button {
                  background: #ef4444;
                  border: 2px solid #fca5a5;
                }
              }

              &.cyber-slider--delay {
                .el-slider__bar {
                  background: #00e1ff;
                }

                .el-slider__button {
                  background: #00e1ff;
                  border: 2px solid #ffffff;
                }
              }

              &.cyber-slider--coverage {
                .el-slider__bar {
                  background: #f59e0b;
                }

                .el-slider__button {
                  background: #f59e0b;
                  border: 2px solid #fde68a;
                }
              }
            }
          }
        }

        .filter-divider {
          height: 1px;
          background: rgba(0, 225, 255, 0.15);
          margin: 2px 0;
        }

        .tags-filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .filter-group {
            display: flex;
            flex-direction: column;
            gap: 4px;

            .filter-group-header {
              display: flex;
              align-items: center;
              justify-content: space-between;

              .group-title {
                font-size: 11px;
                font-weight: 600;
                color: #7dd3fc;
                letter-spacing: 0.2px;
              }

              .group-clear-btn {
                font-size: 10px;
                color: #38bdf8;
                cursor: pointer;
                opacity: 0.8;
                transition: all 0.15s ease;

                &:hover {
                  opacity: 1;
                  color: #00e1ff;
                  text-decoration: underline;
                }
              }
            }

            .filter-tags-wrap {
              display: flex;
              flex-wrap: wrap;
              gap: 4px 6px;

              .filter-tag-chip {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 2px 8px;
                font-size: 11px;
                line-height: 1.35;
                border-radius: 4px;
                background: rgba(18, 36, 62, 0.7);
                border: 1px solid rgba(79, 147, 221, 0.3);
                color: #94a3b8;
                cursor: pointer;
                user-select: none;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

                &:hover {
                  border-color: rgba(0, 225, 255, 0.5);
                  color: #e2efff;
                  background: rgba(24, 52, 88, 0.85);
                  transform: translateY(-1px);
                }

                &.active {
                  background: linear-gradient(135deg, rgba(0, 225, 255, 0.25), rgba(14, 116, 144, 0.5));
                  border-color: #00e1ff;
                  color: #40f2ff;
                  font-weight: 600;
                  box-shadow: 0 0 8px rgba(0, 225, 255, 0.35);
                  text-shadow: 0 0 4px rgba(64, 242, 255, 0.5);
                }
              }
            }
          }
        }
      }
    }

    .task-search-empty {
      padding: 24px 8px;
      font-size: 12px;
      color: rgba(158, 197, 237, 0.6);
      text-align: center;
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

          .task-icon {
            font-size: 14px;
            flex-shrink: 0;
          }

          .task-name {
            flex: 1;
            min-width: 0;
            font-weight: 600;
            font-size: 13px;
            color: #e2efff;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .task-status-badge {
            flex-shrink: 0;
            font-size: 11px;
            color: #64748b;
            padding: 1px 6px;
            border-radius: 3px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: all 0.2s ease;
          }
        }

        .task-card-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-left: 22px;

          .meta-tags-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;

            .meta-tag {
              padding: 1px 6px;
              font-size: 10px;
              border-radius: 3px;

              &.tag-target {
                background: rgba(0, 225, 255, 0.12);
                border: 1px solid rgba(0, 225, 255, 0.3);
                color: #38bdf8;
              }

              &.tag-country {
                background: rgba(244, 63, 94, 0.12);
                border: 1px solid rgba(244, 63, 94, 0.3);
                color: #fda4af;
              }
            }
          }

          .meta-time-row {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: #94a3b8;

            .time-label {
              color: #64748b;
            }

            .time-val {
              font-family: Consolas, monospace;
              color: #cbd5e1;
            }
          }

          .meta-desc-row {
            font-size: 11px;
            color: #94a3b8;
            line-height: 1.4;

            .desc-text {
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }

        &:hover {
          border-color: rgba(0, 225, 255, 0.55);
          background: rgba(24, 52, 88, 0.85);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

          .task-card-top .task-name {
            color: #ffffff;
          }

          .task-status-badge {
            color: #38bdf8;
            border-color: rgba(0, 225, 255, 0.3);
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

          .task-status-badge {
            color: #00e1ff;
            font-weight: 600;
            background: rgba(0, 225, 255, 0.2);
            border-color: #00e1ff;
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
