<template>
  <div class="weapon-attack-dashboard dark-theme">
    <!-- 顶部概览 Header -->
    <div class="attack-header">
      <div class="header-left">
        <span class="header-icon">🎯</span>
        <span class="header-title glow-text">武器打击时间窗口与计划矩阵</span>
      </div>

      <!-- 统计指标与搜索 -->
      <div class="header-center">
        <div class="stat-badge-item">
          <span class="label">打击计划总数:</span>
          <span class="value glow-text-cyan">{{ filteredPlans.length }} / {{ attackPlans.length }} 项</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">攻击武器种类:</span>
          <span class="value glow-text-yellow">{{ filteredWeaponTypeCount }} 种</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">受打击目标数:</span>
          <span class="value glow-text-red">{{ filteredTargetCount }} 个</span>
        </div>
      </div>

      <div class="header-right">
        <!-- 视图模式切换 Tab -->
        <el-radio-group v-model="activeViewTab" size="small" class="view-switch-radio">
          <el-radio-button value="snake">S型打击时序流</el-radio-button>
          <el-radio-button value="card">📋 窗口卡片</el-radio-button>
        </el-radio-group>

        <el-input v-model="searchKeyword" placeholder="请输入搜索信息" prefix-icon="Search" clearable size="small"
          class="search-input" />
      </div>
    </div>

    <!-- 筛选与排序工具栏 -->
    <div class="filter-toolbar">
      <div class="filter-group">
        <span class="filter-label">武器类型</span>
        <el-select v-model="selectedWeaponTypes" multiple collapse-tags collapse-tags-tooltip :max-collapse-tags="2"
          size="small" placeholder="全部武器类型" clearable class="filter-select">
          <el-option v-for="item in weaponTypeOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-group">
        <span class="filter-label">目标卫星</span>
        <el-select v-model="selectedTargetSatellites" multiple collapse-tags collapse-tags-tooltip
          :max-collapse-tags="2" size="small" placeholder="全部目标卫星" clearable class="filter-select">
          <el-option v-for="item in targetSatelliteOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-group">
        <span class="filter-label">中继卫星</span>
        <el-select v-model="selectedRelaySatellites" multiple collapse-tags collapse-tags-tooltip :max-collapse-tags="2"
          size="small" placeholder="全部中继卫星" clearable class="filter-select">
          <el-option v-for="item in relaySatelliteOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-group">
        <span class="filter-label">地面站</span>
        <el-select v-model="selectedGroundStations" multiple collapse-tags collapse-tags-tooltip :max-collapse-tags="2"
          size="small" placeholder="全部地面站" clearable class="filter-select">
          <el-option v-for="item in groundStationOptions" :key="item" :label="item" :value="item" />
        </el-select>
      </div>

      <div class="filter-divider" />

      <div class="filter-group">
        <span class="filter-label">排序字段</span>
        <el-select v-model="sortField" size="small" class="sort-select">
          <el-option label="总持续时长" value="duration" />
          <el-option label="开始时间" value="startTime" />
          <el-option label="结束时间" value="endTime" />
        </el-select>
      </div>

      <div class="filter-group">
        <span class="filter-label">排序方式</span>
        <el-select v-model="sortOrder" size="small" class="sort-select sort-select--narrow">
          <el-option label="升序 ↑" value="asc" />
          <el-option label="降序 ↓" value="desc" />
        </el-select>
      </div>

      <el-button v-if="hasActiveFilters" size="small" type="info" plain class="clear-filter-btn"
        @click="clearAllFilters">
        清除筛选
      </el-button>
    </div>

    <!-- 主体区域：打击计划卡片/表格展示 或 S型时序流程展示 -->
    <div class="attack-body" :class="{ 'attack-body--snake': activeViewTab === 'snake' }">
      <div v-if="filteredPlans.length === 0" class="empty-container">
        <div class="empty-icon">🛡️</div>
        <div class="empty-text">当前暂无匹配的武器打击计划与时间窗口数据</div>
      </div>

      <template v-else>
        <!-- Tab 1: 卡片列表视图 -->
        <div v-show="activeViewTab === 'card'" class="plans-grid">
          <div v-for="(plan, index) in filteredPlans" :key="plan.weaponName + plan.target + index" class="plan-card"
            :class="getCardClass(plan.weaponType)">
            <!-- 概要信息：武器 → 目标 → 窗口 → 持续时长 → 攻击角度 -->
            <div class="plan-summary-row">
              <div class="summary-cell summary-cell--weapon">
                <span class="cell-label">打击武器</span>
                <div class="cell-content">
                  <span class="type-badge" :class="getBadgeClass(plan.weaponType)">
                    {{ plan.weaponType || '通用打击' }}
                  </span>
                  <span class="weapon-name">{{ plan.weaponName }}</span>
                </div>
              </div>

              <span class="summary-arrow" aria-hidden="true">→</span>

              <div class="summary-cell summary-cell--target">
                <span class="cell-label">{{ getTargetColumnLabel(plan.targetType) }}</span>
                <div class="cell-content">
                  <span class="target-name">{{ plan.target }}</span>
                </div>
              </div>

              <span class="summary-arrow" aria-hidden="true">→</span>

              <div class="summary-cell summary-cell--window">
                <span class="cell-label">打击窗口</span>
                <div class="cell-content">
                  <span class="time-range">{{ plan.beginTime || '—' }}</span>
                  <span class="time-sep">~</span>
                  <span class="time-range">{{ plan.endTime || '—' }}</span>
                </div>
              </div>

              <span class="summary-arrow" aria-hidden="true">→</span>

              <div class="summary-cell summary-cell--duration">
                <span class="cell-label">持续时长</span>
                <span class="cell-value duration-tag">{{ formatTotalWindowsDuration(plan) }}</span>
              </div>

              <span class="summary-arrow" aria-hidden="true">→</span>

              <div class="summary-cell summary-cell--angle">
                <span class="cell-label">攻击角度</span>
                <span class="cell-value angle-tag">{{ plan.angle }}°</span>
              </div>
            </div>

            <!-- 详细打击窗口列表 -->
            <div class="windows-section">
              <div class="section-title">
                <span>详细窗口</span>
                <span class="window-count">共 {{ plan.windows?.length || 0 }} 个</span>
              </div>

              <div v-if="plan.windows && plan.windows.length > 0" class="windows-table">
                <div class="windows-table__head">
                  <span class="col-index">序号</span>
                  <span class="col-time">窗口时间</span>
                  <span class="col-duration">时长</span>
                </div>
                <div v-for="(win, wIdx) in plan.windows" :key="wIdx" class="windows-table__row">
                  <span class="col-index">#{{ wIdx + 1 }}</span>
                  <span class="col-time">
                    <span>{{ getWindowStart(win) }}</span>
                    <span class="time-arrow">→</span>
                    <span>{{ getWindowEnd(win) }}</span>
                  </span>
                  <span class="col-duration">{{ formatDuration(getWindowStart(win), getWindowEnd(win)) }}</span>
                </div>
              </div>
              <div v-else class="no-windows-tip">暂无独立子时间窗口数据</div>
            </div>
          </div>
        </div>

        <!-- Tab 2: S型时序流程图 (蛇形时间协同链) -->
        <div v-show="activeViewTab === 'snake'" class="snake-flow-view-container">
          <!-- S型流程图顶部控制工具栏 -->
          <div class="snake-flow-toolbar">
            <div class="toolbar-left">
              <span class="toolbar-icon">⚡</span>
              <span class="toolbar-title">S型打击时序协同流程链</span>
              <span class="toolbar-divider"></span>
              <span class="toolbar-stat">
                时序总节点 <strong>{{ snakeStrikeSteps.length }}</strong> 步 ·
                协同武器 <strong>{{ filteredWeaponTypeCount }}</strong> 种 ·
                打击目标 <strong>{{ filteredTargetCount }}</strong> 个
              </span>
              <span class="toolbar-divider"></span>
              <span class="toolbar-time-span">
                ⏱️ 起止跨度：<strong class="time-range-text">{{ snakeTimeSpanText }}</strong>
              </span>
            </div>

            <div class="toolbar-right">
              <div class="toolbar-filter-inline">
                <span class="filter-label-inline">高亮武器</span>
                <el-select v-model="snakeWeaponFilter" size="small" placeholder="全部武器" clearable class="snake-weapon-select">
                  <el-option label="全部武器协同" value="" />
                  <el-option v-for="w in availableWeaponsInSteps" :key="w" :label="w" :value="w" />
                </el-select>
              </div>

              <div class="toolbar-btn-group">
                <button class="tool-btn" :class="{ active: snakeCols === 3 }" @click="snakeCols = 3" title="每行3个节点">3列</button>
                <button class="tool-btn" :class="{ active: snakeCols === 4 }" @click="snakeCols = 4" title="每行4个节点">4列</button>
              </div>

              <div class="toolbar-btn-group">
                <button class="tool-btn" @click="scrollSnakeToTop" title="滚动到流程开始">⬆️ 顶部</button>
                <button class="tool-btn" @click="scrollSnakeToBottom" title="滚动到流程结束">⬇️ 底部</button>
              </div>
            </div>
          </div>

          <!-- 蛇形时序流动主体容器 (支持纵向平滑无限滚动) -->
          <div class="snake-flow-scroll-area" ref="snakeScrollContainerRef">
            <div class="snake-flow-track-wrapper">
              <div
                v-for="(row, rIdx) in snakeRows"
                :key="'row-' + rIdx"
                class="snake-flow-row"
                :class="[`direction-${row.direction}`, { 'last-row': row.isLastRow }]"
              >
                <!-- S型折返连接管道 (右侧掉头至下一行) -->
                <div v-if="!row.isLastRow && row.direction === 'ltr'" class="snake-turn-track snake-turn-track--right">
                  <div class="turn-glow-dot turn-glow-dot--down"></div>
                </div>

                <!-- S型折返连接管道 (左侧掉头至下一行) -->
                <div v-if="!row.isLastRow && row.direction === 'rtl'" class="snake-turn-track snake-turn-track--left">
                  <div class="turn-glow-dot turn-glow-dot--down"></div>
                </div>

                <!-- 行内打击节点卡片及横向导线 (使用 template 扁平排列，确保所有卡片槽位宽度完全一致) -->
                <template
                  v-for="(step, itemIdx) in row.items"
                  :key="step.planId + '-' + step.stepIndex"
                >
                  <!-- 单个打击节点卡片槽位 -->
                  <div class="snake-step-slot">
                    <!-- 打击节点卡片 -->
                    <div
                      class="snake-node-card"
                      :class="[
                        getCardClass(step.weaponType),
                        {
                          'is-highlighted': !snakeWeaponFilter || snakeWeaponFilter === step.weaponName,
                          'is-dimmed': snakeWeaponFilter && snakeWeaponFilter !== step.weaponName,
                        }
                      ]"
                    >
                      <!-- 卡片头部：时序序号 + 起止时间 + 时长 -->
                      <div class="node-card-header">
                        <div class="step-badge-wrap">
                          <span class="step-badge">#{{ step.stepIndex < 10 ? '0' + step.stepIndex : step.stepIndex }}</span>
                        </div>
                        <div class="time-range-wrap">
                          <span class="time-text">{{ step.timeRangeShort }}</span>
                        </div>
                        <span class="duration-badge">{{ step.duration }}</span>
                      </div>

                      <!-- 卡片主体：打击武器 ──(打击向量)──▶ 目标对象 -->
                      <div class="node-card-body">
                        <!-- 武器发起端 -->
                        <div class="subject-box weapon-box">
                          <span class="subject-type-badge" :class="getBadgeClass(step.weaponType)">
                            {{ step.weaponType || '定向能' }}
                          </span>
                          <span class="subject-name" :title="step.weaponName">{{ step.weaponName }}</span>
                        </div>

                        <!-- 打击向量指示 (能量光束/攻击角度) -->
                        <div class="strike-vector-arrow">
                          <span class="vector-angle">{{ step.angle }}°</span>
                          <div class="vector-line">
                            <span class="vector-beam"></span>
                            <span class="vector-head">▶</span>
                          </div>
                        </div>

                        <!-- 目标接收端 -->
                        <div class="subject-box target-box">
                          <span class="subject-type-badge target-badge" :class="'target-badge--' + step.targetCategory">
                            {{ step.targetCategory }}
                          </span>
                          <span class="subject-name target-name" :title="step.target">
                            {{ getTargetIcon(step.targetCategory) }} {{ step.target }}
                          </span>
                        </div>
                      </div>

                      <!-- 卡片底部：所属计划窗口 + 并行/接续协同状态 -->
                      <div class="node-card-footer">
                        <span
                          class="coordination-tag"
                          :class="step.isParallelWithPrev ? 'tag--parallel' : 'tag--sequential'"
                        >
                          {{ step.isParallelWithPrev ? '🟡 并行协同打击' : '🟢 阶段接续打击' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- 行内横向连接导线 (除当前行最后一个卡片外) -->
                  <div
                    v-if="itemIdx < row.items.length - 1"
                    class="snake-inline-connector"
                    :class="row.direction === 'ltr' ? 'connector--ltr' : 'connector--rtl'"
                  >
                    <span class="connector-line"></span>
                    <span class="connector-arrow">{{ row.direction === 'ltr' ? '▶' : '◀' }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- 底部图例与操作提示 -->
          <div class="snake-flow-legend">
            <div class="legend-items">
              <span class="legend-item"><span class="legend-dot dot-weapon"></span>打击武器 (发起端)</span>
              <span class="legend-item"><span class="legend-dot dot-target"></span>打击目标 (接收站/卫星/中继)</span>
              <span class="legend-item"><span class="legend-badge-sample sample-seq">🟢 阶段接续</span>按时间次序发起</span>
              <span class="legend-item"><span class="legend-badge-sample sample-par">🟡 并行协同</span>多武器重叠时段打击</span>
            </div>
            <span class="legend-tip">💡 提示：流程严格依据开始时间时序排列，顺沿S型轨道向下延伸，可垂直平滑滚动查看全量作战流程</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { type MatrixResult, type CommucationMatrix, type AttackPlanItem } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'

/**
 * [组件属性定义]
 * 接收来自父组件 ElectronicWarfareG6 的 matrixData 矩阵数据结构 (支持侦察卫星与通讯卫星)
 */
interface Props {
  matrixData?: MatrixResult | CommucationMatrix | any
}

const props = withDefaults(defineProps<Props>(), {
  matrixData: null,
})

const store = useLayoutStore()

/** 当前激活的视图 Tab ('card': 卡片表格, 'snake': S型打击时序流) */
const activeViewTab = ref<'card' | 'snake'>('snake')

/** S型时序流程：每行卡片列数（默认4列） */
const snakeCols = ref<number>(4)

/** S型时序流程：单武器高亮/聚焦过滤 */
const snakeWeaponFilter = ref<string>('')

/** S型时序流程滚动容器引用 */
const snakeScrollContainerRef = ref<HTMLDivElement | null>(null)

// [变量用途]
// 组件内部自主管理的 MatrixResult 矩阵数据引用
const internalMatrixData = ref<MatrixResult | CommucationMatrix | any>(null)

// [变量用途]
// 用户在顶部输入的搜索关键字
const searchKeyword = ref('')

/** 多选筛选：武器类型 */
const selectedWeaponTypes = ref<string[]>([])

/** 多选筛选：目标卫星名称 */
const selectedTargetSatellites = ref<string[]>([])

/** 多选筛选：中继卫星名称 */
const selectedRelaySatellites = ref<string[]>([])

/** 多选筛选：地面站名称 */
const selectedGroundStations = ref<string[]>([])

/**
 * 排序字段类型
 * - duration: 按所有子窗口累加总持续时长排序
 * - startTime: 按计划 beginTime 排序
 * - endTime: 按计划 endTime 排序
 */
type SortField = 'duration' | 'startTime' | 'endTime'

/** 排序字段，默认按开始时间 */
const sortField = ref<SortField>('startTime')

/** 排序方向，默认升序（时间从早到晚 / 时长从短到长） */
const sortOrder = ref<'asc' | 'desc'>('asc')

/**
 * 打击计划目标类别枚举
 * - 卫星: 敌方目标卫星
 * - 中继卫星: 星间中继节点
 * - 接收站: 地面接收站
 * - 数据中心: 地面数据处理中心
 */
type PlanTargetCategory = '卫星' | '中继卫星' | '接收站' | '数据中心'

/**
 * 根据 targetType 字段推断打击目标所属类别
 *
 * @param targetType 后端返回的目标类型字符串
 * @returns 归一化后的目标类别
 */
const resolvePlanTargetCategory = (targetType?: string | null): PlanTargetCategory => {
  const type = (targetType || '').trim()
  if (type.includes('中继') || type.toUpperCase() === 'RELAY') return '中继卫星'
  if (type.includes('接收') || type.includes('地面')) return '接收站'
  if (type.includes('中心') || type.includes('数据')) return '数据中心'
  if (type.includes('卫星') || type.toUpperCase() === 'SAT') return '卫星'
  return '卫星'
}

/**
 * [数据来源]
 * 组合使用外部传入或内部根据 store 系列拉取的矩阵数据
 */
const currentData = computed<MatrixResult | CommucationMatrix | null>(() => {
  return props.matrixData || store.matrixData || internalMatrixData.value
})

/**
 * [数据来源]
 * 提取打击计划列表数据 (兼容侦察卫星与通讯卫星的打击计划类型)
 */
const attackPlans = computed<AttackPlanItem[]>(() => {
  return currentData.value?.attackPlanList || []
})

/**
 * [功能说明]
 * 自主异步拉取后端打击窗口矩阵数据 (优先使用 store 中已查询的共享矩阵数据)。
 */
const loadMatrixData = async () => {
  if (props.matrixData || store.matrixData) return
  try {
    const data = await store.fetchMatrixForCurrentScope()
    if (data) {
      internalMatrixData.value = data
    }
  } catch (err: any) {
    console.error('获取武器打击窗口矩阵数据失败:', err)
  }
}

/**
 * [监听器说明]
 * 监听 store 中共享的矩阵数据、卫星系列和激活任务改变，自动同步矩阵数据
 */
watch(
  [() => store.matrixData, () => store.selectedSatSeries, () => store.activedTask?.id, () => store.activeZhchUsageType],
  () => {
    if (!props.matrixData && !store.matrixData) {
      void loadMatrixData()
    }
  },
  { immediate: true }
)

/**
 * 矩阵数据变更时，移除已失效的筛选项，避免选中项不在新选项列表中
 */
watch(attackPlans, () => {
  const weaponSet = new Set(weaponTypeOptions.value)
  const satSet = new Set(targetSatelliteOptions.value)
  const relaySet = new Set(relaySatelliteOptions.value)
  const groundSet = new Set(groundStationOptions.value)

  selectedWeaponTypes.value = selectedWeaponTypes.value.filter((v) => weaponSet.has(v))
  selectedTargetSatellites.value = selectedTargetSatellites.value.filter((v) => satSet.has(v))
  selectedRelaySatellites.value = selectedRelaySatellites.value.filter((v) => relaySet.has(v))
  selectedGroundStations.value = selectedGroundStations.value.filter((v) => groundSet.has(v))
})

onMounted(() => {
  if (!props.matrixData && !store.matrixData) {
    void loadMatrixData()
  }
})

/** 武器类型筛选项（从打击计划中提取去重） */
const weaponTypeOptions = computed<string[]>(() => {
  const types = new Set<string>()
  attackPlans.value.forEach((plan) => {
    if (plan.weaponType) types.add(plan.weaponType)
  })
  return Array.from(types).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

/** 目标卫星筛选项 */
const targetSatelliteOptions = computed<string[]>(() => {
  const targets = new Set<string>()
  attackPlans.value.forEach((plan) => {
    if (plan.target && resolvePlanTargetCategory(plan.targetType) === '卫星') {
      targets.add(plan.target)
    }
  })
  return Array.from(targets).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

/** 中继卫星筛选项 */
const relaySatelliteOptions = computed<string[]>(() => {
  const targets = new Set<string>()
  attackPlans.value.forEach((plan) => {
    if (plan.target && resolvePlanTargetCategory(plan.targetType) === '中继卫星') {
      targets.add(plan.target)
    }
  })
  return Array.from(targets).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

/** 地面站筛选项（含接收站与数据中心） */
const groundStationOptions = computed<string[]>(() => {
  const targets = new Set<string>()
  attackPlans.value.forEach((plan) => {
    const category = resolvePlanTargetCategory(plan.targetType)
    if (plan.target && (category === '接收站' || category === '数据中心')) {
      targets.add(plan.target)
    }
  })
  return Array.from(targets).sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

/** 筛选后武器种类数 */
const filteredWeaponTypeCount = computed(() => {
  const types = new Set(filteredPlans.value.map((p) => p.weaponType).filter(Boolean))
  return types.size
})

/** 筛选后受打击目标数 */
const filteredTargetCount = computed(() => {
  const targets = new Set(filteredPlans.value.map((p) => p.target).filter(Boolean))
  return targets.size
})

/** 是否存在任意激活的筛选条件 */
const hasActiveFilters = computed(() => {
  return (
    selectedWeaponTypes.value.length > 0 ||
    selectedTargetSatellites.value.length > 0 ||
    selectedRelaySatellites.value.length > 0 ||
    selectedGroundStations.value.length > 0 ||
    !!searchKeyword.value.trim()
  )
})

/**
 * 判断打击计划是否命中当前目标类筛选条件
 *
 * @param plan 打击计划
 * @returns 是否通过目标筛选
 */
const matchTargetFilters = (plan: AttackPlanItem): boolean => {
  const hasSatFilter = selectedTargetSatellites.value.length > 0
  const hasRelayFilter = selectedRelaySatellites.value.length > 0
  const hasGroundFilter = selectedGroundStations.value.length > 0

  if (!hasSatFilter && !hasRelayFilter && !hasGroundFilter) return true

  const category = resolvePlanTargetCategory(plan.targetType)
  const target = plan.target || ''

  if (hasSatFilter && category === '卫星' && selectedTargetSatellites.value.includes(target)) {
    return true
  }
  if (hasRelayFilter && category === '中继卫星' && selectedRelaySatellites.value.includes(target)) {
    return true
  }
  if (
    hasGroundFilter &&
    (category === '接收站' || category === '数据中心') &&
    selectedGroundStations.value.includes(target)
  ) {
    return true
  }
  return false
}

/**
 * 计算打击计划总持续时长（秒），用于排序
 *
 * @param plan 打击计划
 * @returns 累加秒数
 */
const calcPlanTotalDurationSecs = (plan: AttackPlanItem): number => {
  if (plan.windows && plan.windows.length > 0) {
    let totalSecs = 0
    plan.windows.forEach((win: any) => {
      totalSecs += calcSecondsSpan(getWindowStart(win), getWindowEnd(win))
    })
    if (totalSecs > 0) return totalSecs
  }
  return calcSecondsSpan(plan.beginTime || '', plan.endTime || '')
}

/**
 * 解析计划开始/结束时间为毫秒时间戳
 *
 * @param timeStr 时间字符串
 * @returns 毫秒时间戳，无效时返回 0
 */
const parsePlanTimeMs = (timeStr?: string | null): number => {
  if (!timeStr) return 0
  const ts = new Date(timeStr.replace(/-/g, '/')).getTime()
  return Number.isFinite(ts) ? ts : 0
}

/**
 * 清除全部筛选与搜索条件
 */
const clearAllFilters = () => {
  selectedWeaponTypes.value = []
  selectedTargetSatellites.value = []
  selectedRelaySatellites.value = []
  selectedGroundStations.value = []
  searchKeyword.value = ''
}

// [数据来源]
// 结合关键字检索、多维度筛选与排序后的打击计划列表
const filteredPlans = computed<AttackPlanItem[]>(() => {
  const kw = searchKeyword.value.trim().toLowerCase()

  let list = attackPlans.value.filter((plan) => {
    if (selectedWeaponTypes.value.length > 0 && !selectedWeaponTypes.value.includes(plan.weaponType)) {
      return false
    }
    if (!matchTargetFilters(plan)) {
      return false
    }
    if (!kw) return true

    const nameMatch = (plan.weaponName || '').toLowerCase().includes(kw)
    const typeMatch = (plan.weaponType || '').toLowerCase().includes(kw)
    const targetMatch = (plan.target || '').toLowerCase().includes(kw)
    const targetTypeMatch = (plan.targetType || '').toLowerCase().includes(kw)
    return nameMatch || typeMatch || targetMatch || targetTypeMatch
  })

  const direction = sortOrder.value === 'asc' ? 1 : -1
  list = [...list].sort((a, b) => {
    let diff = 0
    if (sortField.value === 'duration') {
      diff = calcPlanTotalDurationSecs(a) - calcPlanTotalDurationSecs(b)
    } else if (sortField.value === 'startTime') {
      diff = parsePlanTimeMs(a.beginTime) - parsePlanTimeMs(b.beginTime)
    } else {
      diff = parsePlanTimeMs(a.endTime) - parsePlanTimeMs(b.endTime)
    }
    if (diff === 0) {
      diff = (a.weaponName || '').localeCompare(b.weaponName || '', 'zh-CN')
    }
    return diff * direction
  })

  return list
})

/**
 * [功能说明]
 * 安全获取窗口对象的开始时间（兼容侦察卫星 beginWindow/peakWindow 与通讯卫星 startWindow 字段）
 *
 * @param win 窗口对象
 * @returns 开始时间字符串
 */
const getWindowStart = (win: any): string => {
  if (!win) return ''
  return win.beginWindow || win.startWindow || win.peakWindow || ''
}

/**
 * [功能说明]
 * 安全获取窗口对象的结束时间（兼容侦察卫星与通讯卫星字段）
 *
 * @param win 窗口对象
 * @returns 结束时间字符串
 */
const getWindowEnd = (win: any): string => {
  if (!win) return ''
  return win.endWindow || ''
}

/**
 * 根据目标类型返回概要行第二列的标签文案
 *
 * @param targetType 目标类型字符串
 * @returns 列标题（卫星 / 中继 / 地面站 / 目标）
 */
const getTargetColumnLabel = (targetType?: string | null): string => {
  const category = resolvePlanTargetCategory(targetType)
  if (category === '中继卫星') return '中继'
  if (category === '接收站' || category === '数据中心') return '地面站'
  return '卫星'
}

/**
 * [功能说明]
 * 根据武器类型返回对应卡片的修饰 Class
 *
 * @param type 武器类型字符串
 */
const getCardClass = (type: string) => {
  if (!type) return ''
  if (type.includes('网络') || type.includes('病毒')) return 'card-cyber'
  if (type.includes('干扰') || type.includes('电磁')) return 'card-jamming'
  if (type.includes('导弹') || type.includes('动能') || type.includes('物理')) return 'card-kinetic'
  return ''
}

/**
 * [功能说明]
 * 根据武器类型返回对应 Badge 的修饰 Class
 *
 * @param type 武器类型字符串
 */
const getBadgeClass = (type: string) => {
  if (!type) return 'badge-default'
  if (type.includes('网络') || type.includes('病毒')) return 'badge-purple'
  if (type.includes('干扰') || type.includes('电磁')) return 'badge-yellow'
  if (type.includes('导弹') || type.includes('动能') || type.includes('物理')) return 'badge-red'
  return 'badge-cyan'
}

/**
 * [功能说明]
 * 将秒数差格式化为人类可读的时间字符串（如：30分钟、1小时15分钟）
 *
 * @param diffSec 秒数差
 * @returns 格式化后的时间字符串
 */
const formatSecondsToText = (diffSec: number): string => {
  if (diffSec <= 0) return '0秒'

  const hours = Math.floor(diffSec / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)
  const secs = diffSec % 60

  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`
  }
  return `${secs}秒`
}

/**
 * [功能说明]
 * 计算两个时间字符串之间的秒数差
 *
 * @param startStr 开始时间字符串
 * @param endStr 结束时间字符串
 * @returns 差异秒数，非法时间返回 0
 */
const calcSecondsSpan = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0
  const t1 = new Date(startStr.replace(/-/g, '/')).getTime()
  const t2 = new Date(endStr.replace(/-/g, '/')).getTime()
  if (isNaN(t1) || isNaN(t2) || t2 <= t1) return 0
  return Math.floor((t2 - t1) / 1000)
}

/**
 * [功能说明]
 * 计算单段时间字符串的持续时长描述
 *
 * @param startStr 开始时间字符串 (支持 null / undefined)
 * @param endStr 结束时间字符串 (支持 null / undefined)
 * @returns 格式化后的时长描述字符串
 */
const formatDuration = (startStr?: string | null, endStr?: string | null): string => {
  if (!startStr || !endStr) return '即时/未知'
  const secs = calcSecondsSpan(startStr, endStr)
  return secs > 0 ? formatSecondsToText(secs) : '即时/未知'
}

/**
 * [功能说明]
 * 计算某项武器打击计划中所有打击窗口 (windows) 时长的累加总和
 *
 * [处理规则]
 * - 优先遍历 plan.windows 列表中每一个子窗口的起止时间，计算时长秒数并求和。
 * - 当 plan.windows 为空或无效时，兜底计算整体起止时间 beginTime ~ endTime 的时间差。
 *
 * @param plan 武器打击计划记录对象
 * @returns 累加格式化后的总时长描述字符串
 */
const formatTotalWindowsDuration = (plan: AttackPlanItem): string => {
  if (!plan) return '未知'

  // 1. 优先累加所有子时间窗口的时长秒数
  if (plan.windows && plan.windows.length > 0) {
    let totalSecs = 0
    plan.windows.forEach((win: any) => {
      const s = getWindowStart(win)
      const e = getWindowEnd(win)
      totalSecs += calcSecondsSpan(s, e)
    })
    if (totalSecs > 0) {
      return formatSecondsToText(totalSecs)
    }
  }

  // 2. 若无子窗口数据，判断起止时间是否存在
  if (!plan.beginTime || !plan.endTime) return '即时/未知'
  return formatDuration(plan.beginTime, plan.endTime)
}

/**
 * S型时序流程单个作战节点结构
 */
interface SnakeStrikeStep {
  stepIndex: number
  planId: string
  weaponName: string
  weaponType: string
  target: string
  targetType?: string
  targetCategory: PlanTargetCategory
  windowIndex: number
  totalWindowsInPlan: number
  startTime: string
  endTime: string
  duration: string
  durationSecs: number
  angle?: number | string
  timeRangeShort: string
  dateLabel: string
  isParallelWithPrev?: boolean
}

/**
 * 转换所有经过筛选的打击计划为全局按时间升序串联的时序打击步骤
 */
const snakeStrikeSteps = computed<SnakeStrikeStep[]>(() => {
  const plans = filteredPlans.value
  if (!plans.length) return []

  const rawSteps: {
    planId: string
    weaponName: string
    weaponType: string
    target: string
    targetType?: string
    targetCategory: PlanTargetCategory
    windowIndex: number
    totalWindowsInPlan: number
    startTime: string
    endTime: string
    duration: string
    durationSecs: number
    angle?: number | string
  }[] = []

  plans.forEach((plan, pIdx) => {
    const wName = plan.weaponName || '未知武器'
    const wType = plan.weaponType || '定向能'
    const tName = plan.target || '未知目标'
    const tCat = resolvePlanTargetCategory(plan.targetType)
    const angle = plan.angle || 0

    if (plan.windows && plan.windows.length > 0) {
      const totalWins = plan.windows.length
      plan.windows.forEach((win: any, wIdx: number) => {
        const start = getWindowStart(win)
        const end = getWindowEnd(win)
        const dur = formatDuration(start, end)
        const durSecs = parsePlanTimeMs(end) - parsePlanTimeMs(start)
        rawSteps.push({
          planId: `plan-${pIdx}-win-${wIdx}`,
          weaponName: wName,
          weaponType: wType,
          target: tName,
          targetType: plan.targetType,
          targetCategory: tCat,
          windowIndex: wIdx + 1,
          totalWindowsInPlan: totalWins,
          startTime: start,
          endTime: end,
          duration: dur,
          durationSecs: Math.max(durSecs / 1000, 0),
          angle,
        })
      })
    } else {
      const start = plan.beginTime || ''
      const end = plan.endTime || ''
      const dur = formatDuration(start, end)
      rawSteps.push({
        planId: `plan-${pIdx}`,
        weaponName: wName,
        weaponType: wType,
        target: tName,
        targetType: plan.targetType,
        targetCategory: tCat,
        windowIndex: 1,
        totalWindowsInPlan: 1,
        startTime: start,
        endTime: end,
        duration: dur,
        durationSecs: Math.max((parsePlanTimeMs(end) - parsePlanTimeMs(start)) / 1000, 0),
        angle,
      })
    }
  })

  // 关键：严格按开始时间升序排列时序
  rawSteps.sort((a, b) => {
    const tA = parsePlanTimeMs(a.startTime)
    const tB = parsePlanTimeMs(b.startTime)
    if (tA !== tB) return tA - tB
    return parsePlanTimeMs(a.endTime) - parsePlanTimeMs(b.endTime)
  })

  return rawSteps.map((step, idx) => {
    const startShort = step.startTime.length >= 19 ? step.startTime.substring(5, 19) : step.startTime
    const endShort = step.endTime.length >= 19 ? step.endTime.substring(11, 19) : step.endTime
    const dateLabel = step.startTime.length >= 10 ? step.startTime.substring(0, 10) : ''

    const prev = rawSteps[idx - 1]
    const isParallel = prev ? parsePlanTimeMs(step.startTime) < parsePlanTimeMs(prev.endTime) : false

    return {
      ...step,
      stepIndex: idx + 1,
      timeRangeShort: `${startShort} ~ ${endShort}`,
      dateLabel,
      isParallelWithPrev: isParallel,
    }
  })
})

/** 当前时序节点涉及的武器名称列表（用于高亮筛选） */
const availableWeaponsInSteps = computed(() => {
  const set = new Set<string>()
  snakeStrikeSteps.value.forEach((s) => {
    if (s.weaponName) set.add(s.weaponName)
  })
  return Array.from(set)
})

/** 起止时间跨度文本 */
const snakeTimeSpanText = computed(() => {
  const steps = snakeStrikeSteps.value
  if (!steps.length) return '—'
  const earliest = steps[0].startTime
  const latest = steps.reduce((max, s) => (parsePlanTimeMs(s.endTime) > parsePlanTimeMs(max) ? s.endTime : max), steps[0].endTime)
  const eShort = earliest.length >= 19 ? earliest.substring(5, 19) : earliest
  const lShort = latest.length >= 19 ? latest.substring(5, 19) : latest
  return `${eShort} → ${lShort}`
})

/**
 * 将一维时序节点数组切片为蛇形交替行 (LTR -> RTL -> LTR...)
 */
const snakeRows = computed(() => {
  const steps = snakeStrikeSteps.value
  const cols = snakeCols.value || 3
  const rows: {
    rowIndex: number
    direction: 'ltr' | 'rtl'
    items: SnakeStrikeStep[]
    isLastRow: boolean
  }[] = []

  for (let i = 0; i < steps.length; i += cols) {
    const rowIndex = Math.floor(i / cols)
    const direction = rowIndex % 2 === 0 ? 'ltr' : 'rtl'
    const chunk = steps.slice(i, i + cols)
    const isLastRow = i + cols >= steps.length

    rows.push({
      rowIndex,
      direction,
      items: chunk,
      isLastRow,
    })
  }
  return rows
})

/** 滚动到 S 型流程顶部 */
const scrollSnakeToTop = () => {
  if (snakeScrollContainerRef.value) {
    snakeScrollContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

/** 滚动到 S 型流程底部 */
const scrollSnakeToBottom = () => {
  if (snakeScrollContainerRef.value) {
    snakeScrollContainerRef.value.scrollTo({
      top: snakeScrollContainerRef.value.scrollHeight,
      behavior: 'smooth',
    })
  }
}

/** 获取目标类型图标 */
const getTargetIcon = (cat?: PlanTargetCategory | string) => {
  if (cat === '接收站' || cat === '数据中心') return '📡'
  if (cat === '中继卫星') return '🛰️'
  return '🛰️'
}

</script>

<style lang="scss" scoped>
.weapon-attack-dashboard {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.attack-header {
  height: 52px;
  background: rgba(10, 18, 34, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 10;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .header-icon {
      font-size: 20px;
    }

    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #00e1ff;
      letter-spacing: 0.5px;
    }

    .situation-btn {
      margin-left: 12px;
      background: linear-gradient(135deg, rgba(239, 107, 115, 0.85), rgba(220, 38, 38, 0.75));
      border: 1px solid rgba(239, 107, 115, 0.6);
      color: #fff;
      font-size: 12px;
      font-weight: 600;

      &:hover {
        background: linear-gradient(135deg, rgba(239, 107, 115, 1), rgba(220, 38, 38, 0.9));
        border-color: #ef6b73;
      }
    }
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 20px;

    .stat-badge-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 15px;
      background: rgba(8, 14, 26, 0.6);
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid rgba(0, 225, 255, 0.15);

      .label {
        color: #94a3b8;
      }

      .value {
        font-weight: 700;
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;

    .view-switch-radio {
      flex-shrink: 0;
      white-space: nowrap;

      :deep(.atlas-app-radio-button__inner) {
        background-color: rgba(8, 14, 26, 0.85);
        border-color: rgba(0, 225, 255, 0.3);
        color: #94a3b8;
        font-size: 13px;
        font-weight: 600;
        padding: 6px 14px;
        transition: all 0.2s ease;
      }

      :deep(.atlas-app-radio-button__original-radio:checked + .atlas-app-radio-button__inner) {
        background: linear-gradient(135deg, rgba(0, 225, 255, 0.25), rgba(6, 182, 212, 0.4));
        border-color: #00e1ff;
        color: #00e1ff;
        box-shadow: 0 0 10px rgba(0, 225, 255, 0.3) inset, 0 0 8px rgba(0, 225, 255, 0.25);
        text-shadow: 0 0 6px rgba(0, 225, 255, 0.6);
      }
    }
  }

  .search-input {
    width: 240px;

    :deep(.atlas-app-input__wrapper) {
      background-color: rgba(8, 14, 26, 0.8);
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.25) inset;
      color: #e2e8f0;

      &.is-focus {
        box-shadow: 0 0 0 1px #00e1ff inset;
      }
    }

    :deep(.atlas-app-input__inner) {
      color: #e2e8f0;
      font-size: 14px;
    }
  }
}

.filter-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 20px;
  background: rgba(8, 14, 26, 0.85);
  border-bottom: 1px solid rgba(0, 225, 255, 0.12);

  .filter-group {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .filter-label {
    font-size: 14px;
    color: #94a3b8;
    white-space: nowrap;
  }

  .filter-select {
    width: 160px;

    :deep(.atlas-app-select__wrapper) {
      background-color: rgba(8, 14, 26, 0.8);
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.2) inset;
    }

    :deep(.atlas-app-select__placeholder),
    :deep(.atlas-app-select__selected-item),
    :deep(.atlas-app-tag) {
      font-size: 14px;
    }
  }

  .sort-select {
    width: 120px;

    &--narrow {
      width: 100px;
    }

    :deep(.atlas-app-select__wrapper) {
      background-color: rgba(8, 14, 26, 0.8);
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.2) inset;
    }

    :deep(.atlas-app-select__placeholder),
    :deep(.atlas-app-select__selected-item) {
      font-size: 14px;
    }
  }

  .filter-divider {
    width: 1px;
    height: 24px;
    background: rgba(0, 225, 255, 0.15);
    margin: 0 4px;
  }

  .clear-filter-btn {
    margin-left: auto;
    font-size: 14px;
  }
}

.attack-body {
  flex: 1;
  width: 100%;
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 3px;
  }
}

.empty-container {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 18, 34, 0.4);
  border: 1px dashed rgba(0, 225, 255, 0.2);
  border-radius: 8px;
  color: #64748b;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 14px;
  }
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 1280px) {
    grid-template-columns: 1fr;
  }
}

.plan-card {
  background: rgba(13, 22, 42, 0.85);
  border: 1px solid rgba(0, 225, 255, 0.2);
  border-radius: 8px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
  min-width: 0;

  &:hover {
    border-color: rgba(0, 225, 255, 0.45);
    box-shadow: 0 6px 20px rgba(0, 225, 255, 0.12);
  }

  &.card-cyber {
    border-left: 4px solid #a855f7;
  }

  &.card-jamming {
    border-left: 4px solid #eab308;
  }

  &.card-kinetic {
    border-left: 4px solid #ef4444;
  }
}

.plan-summary-row {
  display: flex;
  align-items: stretch;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(8, 14, 26, 0.65);
  border: 1px solid rgba(0, 225, 255, 0.12);
  border-radius: 6px;
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 2px;
  }
}

.summary-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex-shrink: 0;

  .cell-label {
    font-size: 13px;
    color: #64748b;
    white-space: nowrap;
  }

  .cell-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cell-value {
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
  }

  &--weapon {
    min-width: 100px;

    .cell-content {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .weapon-name {
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
    }
  }

  &--target {
    min-width: 110px;

    .target-name {
      font-size: 15px;
      font-weight: 700;
      color: #f87171;
      word-break: break-all;
    }
  }

  &--window {
    flex: 1;
    min-width: 180px;

    .cell-content {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
    }

    .time-range {
      font-size: 13px;
      color: #38bdf8;
      font-weight: 600;
      white-space: nowrap;
    }

    .time-sep {
      color: #64748b;
      font-size: 13px;
    }
  }

  &--duration {
    min-width: 72px;
  }

  &--angle {
    min-width: 56px;
  }
}

.summary-arrow {
  display: flex;
  align-items: center;
  color: rgba(0, 225, 255, 0.35);
  font-size: 16px;
  padding-top: 14px;
  flex-shrink: 0;
}

.type-badge {
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  white-space: nowrap;

  &.badge-purple {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }

  &.badge-yellow {
    background: rgba(234, 179, 8, 0.2);
    color: #fde047;
    border: 1px solid rgba(234, 179, 8, 0.4);
  }

  &.badge-red {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  &.badge-cyan {
    background: rgba(0, 225, 255, 0.2);
    color: #38bdf8;
    border: 1px solid rgba(0, 225, 255, 0.4);
  }
}

.duration-tag {
  color: #34d399;
}

.angle-tag {
  color: #fbbf24;
}

.windows-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 14px;
    font-weight: 600;
    color: #94a3b8;
    padding: 0 2px;

    .window-count {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }
  }
}

.windows-table {
  border: 1px solid rgba(0, 225, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;

  &__head,
  &__row {
    display: grid;
    grid-template-columns: 52px 1fr 88px;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    font-size: 13px;
  }

  &__head {
    background: rgba(8, 14, 26, 0.8);
    color: #64748b;
    font-weight: 600;
    border-bottom: 1px solid rgba(0, 225, 255, 0.1);
  }

  &__row {
    background: rgba(18, 30, 56, 0.45);
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba(18, 30, 56, 0.75);
    }
  }

  .col-index {
    color: #00e1ff;
    font-weight: 600;
  }

  .col-time {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    color: #e2e8f0;
    min-width: 0;

    .time-arrow {
      color: #64748b;
      flex-shrink: 0;
    }
  }

  .col-duration {
    color: #a7f3d0;
    text-align: right;
    white-space: nowrap;
  }
}

.no-windows-tip {
  font-size: 14px;
  color: #64748b;
  font-style: italic;
  padding: 8px 10px;
  background: rgba(18, 30, 56, 0.4);
  border-radius: 4px;
}

.glow-text-cyan {
  color: #00e1ff;
  text-shadow: 0 0 6px rgba(0, 225, 255, 0.4);
}

.glow-text-yellow {
  color: #fde047;
  text-shadow: 0 0 6px rgba(253, 224, 71, 0.4);
}

.glow-text-red {
  color: #f87171;
  text-shadow: 0 0 6px rgba(248, 113, 113, 0.4);
}

.attack-body--snake {
  padding: 12px 20px 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.snake-flow-view-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(10, 18, 34, 0.75);
  border: 1px solid rgba(0, 225, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);

  .snake-flow-toolbar {
    height: 48px;
    padding: 0 18px;
    background: linear-gradient(90deg, rgba(8, 16, 32, 0.95) 0%, rgba(15, 28, 54, 0.85) 100%);
    border-bottom: 1px solid rgba(0, 225, 255, 0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .toolbar-icon {
        font-size: 18px;
      }

      .toolbar-title {
        font-size: 15px;
        font-weight: 700;
        color: #00e1ff;
      }

      .toolbar-divider {
        width: 1px;
        height: 16px;
        background: rgba(0, 225, 255, 0.25);
        margin: 0 4px;
      }

      .toolbar-stat {
        font-size: 13px;
        color: #94a3b8;

        strong {
          color: #fde047;
          font-weight: 700;
        }
      }

      .toolbar-time-span {
        font-size: 13px;
        color: #94a3b8;

        .time-range-text {
          color: #38bdf8;
          font-family: monospace;
          font-weight: 700;
        }
      }
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;

      .toolbar-filter-inline {
        display: flex;
        align-items: center;
        gap: 6px;

        .filter-label-inline {
          font-size: 12px;
          color: #94a3b8;
          white-space: nowrap;
        }

        .snake-weapon-select {
          width: 130px;
        }
      }

      .toolbar-btn-group {
        display: inline-flex;
        align-items: center;
        background: rgba(8, 14, 26, 0.85);
        border: 1px solid rgba(0, 225, 255, 0.28);
        border-radius: 4px;
        overflow: hidden;

        .tool-btn {
          padding: 4px 12px;
          background: transparent;
          border: none;
          border-right: 1px solid rgba(0, 225, 255, 0.18);
          color: #94eaff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          outline: none;

          &:last-child {
            border-right: none;
          }

          &:hover {
            color: #ffffff;
            background: rgba(0, 225, 255, 0.18);
          }

          &.active {
            color: #ffffff;
            background: rgba(0, 225, 255, 0.35);
            font-weight: 700;
            box-shadow: inset 0 0 8px rgba(0, 225, 255, 0.4);
          }

          &:active {
            background: rgba(0, 225, 255, 0.45);
          }
        }
      }
    }
  }

  .snake-flow-scroll-area {
    flex: 1;
    width: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 24px 36px 36px;
    background: radial-gradient(circle at 50% 30%, #0d1a33 0%, #060b18 100%);
    position: relative;
    box-sizing: border-box;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(6, 11, 24, 0.8);
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0, 225, 255, 0.3);
      border-radius: 3px;

      &:hover {
        background: rgba(0, 225, 255, 0.6);
      }
    }
  }

  .snake-flow-track-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    position: relative;
  }

  .snake-flow-row {
    display: flex;
    align-items: center;
    position: relative;
    margin-bottom: 48px;
    padding: 0 44px;

    &.direction-ltr {
      flex-direction: row;
    }

    &.direction-rtl {
      flex-direction: row-reverse;
    }

    &.last-row {
      margin-bottom: 12px;
    }

    .snake-turn-track {
      position: absolute;
      width: 44px;
      height: calc(100% + 48px);
      pointer-events: none;
      z-index: 1;

      &.snake-turn-track--right {
        right: 0;
        top: 50%;
        border-top: 3px solid rgba(0, 225, 255, 0.7);
        border-right: 3px solid #00e1ff;
        border-bottom: 3px solid rgba(0, 225, 255, 0.7);
        border-left: none;
        border-radius: 0 32px 32px 0;
        box-shadow: 4px 0 12px rgba(0, 225, 255, 0.3);

        .turn-glow-dot--down {
          right: -4px;
          left: auto;
        }
      }

      &.snake-turn-track--left {
        left: 0;
        top: 50%;
        border-top: 3px solid rgba(0, 225, 255, 0.7);
        border-left: 3px solid #00e1ff;
        border-bottom: 3px solid rgba(0, 225, 255, 0.7);
        border-right: none;
        border-radius: 32px 0 0 32px;
        box-shadow: -4px 0 12px rgba(0, 225, 255, 0.3);

        .turn-glow-dot--down {
          left: -4px;
          right: auto;
        }
      }

      .turn-glow-dot {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00e1ff;
        box-shadow: 0 0 8px #00e1ff;
        top: 50%;
        transform: translateY(-50%);
      }
    }

    .snake-step-slot {
      display: flex;
      align-items: stretch;
      flex: 1 1 0;
      min-width: 0;
      position: relative;
      z-index: 2;

      .snake-node-card {
        width: 100%;
        min-width: 0;
        background: linear-gradient(135deg, rgba(13, 23, 44, 0.95) 0%, rgba(8, 16, 32, 0.98) 100%);
        border: 1.5px solid rgba(0, 225, 255, 0.35);
        border-radius: 8px;
        padding: 10px 14px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5), inset 0 0 12px rgba(0, 225, 255, 0.05);
        transition: all 0.25s ease;
        cursor: pointer;
        box-sizing: border-box;

        &:hover {
          transform: translateY(-3px);
          border-color: #00e1ff;
          box-shadow: 0 8px 24px rgba(0, 225, 255, 0.35);
        }

        &.is-dimmed {
          opacity: 0.32;
          filter: grayscale(40%);
        }

        &.is-highlighted {
          border-color: #00e1ff;
          box-shadow: 0 0 16px rgba(0, 225, 255, 0.35);
        }

        .node-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(0, 225, 255, 0.15);

          .step-badge-wrap {
            .step-badge {
              font-size: 13px;
              font-weight: 800;
              color: #00e1ff;
              background: rgba(0, 225, 255, 0.15);
              padding: 2px 8px;
              border-radius: 12px;
              border: 1px solid rgba(0, 225, 255, 0.4);
            }
          }

          .time-range-wrap {
            flex: 1;
            text-align: center;

            .time-text {
              font-size: 13px;
              font-weight: 700;
              color: #ffffff;
              font-family: monospace;
              letter-spacing: 0.3px;
            }
          }

          .duration-badge {
            font-size: 12px;
            font-weight: 700;
            color: #34d399;
            background: rgba(52, 211, 153, 0.15);
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid rgba(52, 211, 153, 0.3);
          }
        }

        .node-card-body {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
          background: rgba(6, 12, 24, 0.65);
          border-radius: 6px;
          padding: 6px 10px;
          border: 1px solid rgba(255, 255, 255, 0.06);

          .subject-box {
            display: flex;
            flex-direction: column;
            gap: 4px;
            max-width: 42%;
            min-width: 0;

            .subject-type-badge {
              font-size: 11px;
              font-weight: 700;
              padding: 1px 6px;
              border-radius: 3px;
              width: fit-content;
              white-space: nowrap;

              &.target-badge {
                background: rgba(248, 113, 113, 0.2);
                color: #f87171;
                border: 1px solid rgba(248, 113, 113, 0.4);

                &--接收站,
                &--数据中心 {
                  background: rgba(56, 189, 248, 0.2);
                  color: #38bdf8;
                  border-color: rgba(56, 189, 248, 0.4);
                }

                &--中继卫星 {
                  background: rgba(168, 85, 247, 0.2);
                  color: #c084fc;
                  border-color: rgba(168, 85, 247, 0.4);
                }
              }
            }

            .subject-name {
              font-size: 14px;
              font-weight: 700;
              color: #ffffff;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;

              &.target-name {
                color: #fca5a5;
              }
            }
          }

          .strike-vector-arrow {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            min-width: 50px;

            .vector-angle {
              font-size: 11px;
              font-weight: 700;
              color: #fbbf24;
              margin-bottom: 2px;
            }

            .vector-line {
              display: flex;
              align-items: center;
              width: 100%;

              .vector-beam {
                flex: 1;
                height: 2px;
                background: linear-gradient(90deg, #38bdf8, #f87171);
                box-shadow: 0 0 6px rgba(56, 189, 248, 0.5);
              }

              .vector-head {
                font-size: 10px;
                color: #f87171;
                margin-left: -2px;
              }
            }
          }
        }

        .node-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: #94a3b8;

          .plan-window-tag {
            color: #cbd5e1;

            strong {
              color: #00e1ff;
              font-weight: 700;
            }
          }

          .coordination-tag {
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;

            &.tag--parallel {
              background: rgba(245, 158, 11, 0.18);
              color: #fbbf24;
              border: 1px solid rgba(245, 158, 11, 0.35);
            }

            &.tag--sequential {
              background: rgba(16, 185, 129, 0.18);
              color: #34d399;
              border: 1px solid rgba(16, 185, 129, 0.35);
            }
          }
        }
      }
    }

    .snake-inline-connector {
      display: flex;
      align-items: center;
      width: 32px;
      margin: 0 6px;
      flex-shrink: 0;
      position: relative;
      z-index: 2;

      .connector-line {
        flex: 1;
        height: 2px;
        background: linear-gradient(90deg, rgba(0, 225, 255, 0.3), rgba(0, 225, 255, 0.8), rgba(0, 225, 255, 0.3));
        box-shadow: 0 0 6px rgba(0, 225, 255, 0.4);
      }

      .connector-arrow {
        color: #00e1ff;
        font-size: 11px;
        font-weight: 800;
        text-shadow: 0 0 6px #00e1ff;
        margin: 0 -2px;
      }
    }
  }

  .snake-flow-legend {
    height: 40px;
    padding: 0 18px;
    background: rgba(8, 14, 26, 0.95);
    border-top: 1px solid rgba(0, 225, 255, 0.14);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: #94a3b8;
    flex-shrink: 0;

    .legend-items {
      display: flex;
      align-items: center;
      gap: 20px;

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;

          &.dot-weapon {
            background: #38bdf8;
            box-shadow: 0 0 6px #38bdf8;
          }

          &.dot-target {
            background: #f87171;
            box-shadow: 0 0 6px #f87171;
          }
        }

        .legend-badge-sample {
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 3px;

          &.sample-seq {
            background: rgba(16, 185, 129, 0.2);
            color: #34d399;
          }

          &.sample-par {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
          }
        }
      }
    }

    .legend-tip {
      color: #64748b;
      font-size: 11px;
    }
  }
}
</style>
