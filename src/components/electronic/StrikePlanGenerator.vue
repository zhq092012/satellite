<template>
  <div class="strike-plan-generator dark-theme" v-loading="store.zhchPlanLoading">
    <!-- 顶部：用途类型多选与生成 -->
    <div class="plan-header">
      <div class="header-left">
        <span class="header-icon">⚔️</span>
        <span class="header-title glow-text">综合打击方案生成</span>
      </div>

      <div class="header-center">
        <span class="type-label">方案名称：</span>
        <div class="type-selector">
          <button v-for="item in usageTypeOptions" :key="item.value" class="type-btn"
            :class="{ active: store.selectedZhchUsageTypes.includes(item.value) }"
            @click="handleToggleUsageType(item.value)">
            {{ item.label }}
          </button>
        </div>

      </div>


      <div class="header-right">
        <el-button type="primary" size="default" :loading="store.zhchPlanLoading" @click="handleGenerate">
          <span class="btn-icon">⚡</span> 生成方案
        </el-button>
        <el-button type="warning" size="default" :loading="cacheClearing" @click="handleClearCache">
          <span class="btn-icon">🗑️</span> 清除缓存
        </el-button>
      </div>

    </div>

    <!-- 主体内容 -->
    <div class="plan-body">
      <div v-if="!store.activedTask" class="empty-container">
        <div class="empty-icon">📋</div>
        <div class="empty-text">请先在右上角选择战场与任务</div>
      </div>

      <div v-else-if="!hasVisiblePlans && !store.zhchPlanLoading" class="empty-container">
        <div class="empty-icon">🎯</div>
        <div class="empty-text">勾选用途类型后点击「生成方案」获取综合打击方案</div>
      </div>

      <!-- 单选：左右分屏对比（按行对齐，概述等高，每颗卫星一行） -->
      <div v-else-if="isSingleMode && primaryPlan && baselinePlan" class="compare-split">
        <div class="compare-split-scroll">
          <!-- 面板标题行 -->
          <div class="compare-row compare-row--head">
            <div class="compare-panel-head compare-panel-head--baseline">
              <span class="panel-title">打击前基准</span>
              <span class="panel-sub">延迟 0 · 全部未打击</span>
            </div>
            <div class="compare-panel-head compare-panel-head--actual">
              <span class="panel-title">{{ selectedUsageTypes[0] }} 方案</span>
              <PlanStatsRow :plan="primaryPlan" compact />
            </div>
          </div>

          <!-- 方案概述行：同一 grid 行内自动等高 -->
          <div class="compare-row compare-row--summary">
            <PlanSummaryBlock :plan="baselinePlan" compact />
            <PlanSummaryBlock :plan="primaryPlan" compact />
          </div>

          <!-- 矩阵标题行 -->
          <div class="compare-row compare-row--matrix-title">
            <div class="section-title">
              卫星打击矩阵
              <span class="count-tag">{{ compareSatelliteList.length }} 颗</span>
            </div>
            <div class="section-title">
              卫星打击矩阵
              <span class="count-tag">{{ compareSatelliteList.length }} 颗</span>
            </div>
          </div>

          <!-- 无卫星数据 -->
          <div v-if="!compareSatelliteList.length" class="compare-row">
            <div class="empty-container small">暂无卫星打击数据</div>
            <div class="empty-container small">暂无卫星打击数据</div>
          </div>

          <!-- 每颗卫星一行：左基准 / 右方案，同一 NORAD -->
          <div v-for="sat in compareSatelliteList" :key="sat.norad" class="compare-satellite-group">
            <SatelliteCard v-if="getBaselineSatellite(sat.norad)" :sat="getBaselineSatellite(sat.norad)!"
              panel-key="baseline" variant="baseline" :windows-collapsible="true"
              :expanded-window-keys="expandedWindowKeys" @toggle-windows="toggleSatWindows" />
            <SatelliteCard :sat="sat" :panel-key="selectedUsageTypes[0]" variant="actual" :windows-collapsible="true"
              :expanded-window-keys="expandedWindowKeys" @toggle-windows="toggleSatWindows" />
          </div>
        </div>
      </div>

      <!-- 多选：分栏对比统计 -->
      <div v-else-if="isMultiMode" class="compare-columns"
        :style="{ gridTemplateColumns: `repeat(${selectedUsageTypes.length}, minmax(0, 1fr))` }">
        <div v-for="usageType in selectedUsageTypes" :key="usageType" class="compare-column">
          <div class="column-head">
            <span class="column-title">{{ usageType }}</span>
            <PlanStatsRow v-if="getPlanByType(usageType)" :plan="getPlanByType(usageType)!" />
          </div>

          <div v-if="getPlanByType(usageType)" class="column-body">
            <div class="summary-card compact">
              <div class="summary-title">方案概述</div>
              <p class="summary-text">{{ getPlanByType(usageType)!.summary || '暂无概述' }}</p>
              <div class="weapon-types" v-if="getPlanByType(usageType)!.weaponTypes?.length">
                <span class="weapon-types-label">武器类型：</span>
                <span v-for="(wt, idx) in getPlanByType(usageType)!.weaponTypes" :key="wt" class="weapon-type-chip">
                  {{ wt }}{{ idx < getPlanByType(usageType)!.weaponTypes.length - 1 ? '、' : '' }} </span>
              </div>
            </div>

            <button type="button" class="matrix-toggle-btn" @click="toggleMatrixExpand(usageType)">
              {{ isMatrixExpanded(usageType) ? '收起卫星打击明细' : '查看卫星打击明细' }}
              <span class="toggle-count">{{ getPlanByType(usageType)!.satelliteMatrixList?.length || 0 }} 颗</span>
            </button>

            <div v-if="isMatrixExpanded(usageType)" class="satellite-section">
              <SatelliteMatrixGrid :plan="getPlanByType(usageType)!" :panel-key="usageType" :windows-collapsible="true"
                :expanded-window-keys="expandedWindowKeys" @toggle-windows="toggleSatWindows" />
            </div>
          </div>

          <div v-else class="empty-container small">
            <div class="empty-text">暂无 {{ usageType }} 方案数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, defineComponent, h, type PropType } from 'vue'
import { ElMessage } from 'element-plus'
import type { ZhchPlanResp, ZhchPlanSatelliteMatrix } from '@/api/electronic'
import { refreshZhchPlanCache } from '@/api/electronic'
import { useLayoutStore, ZHCH_USAGE_TYPE_OPTIONS } from '@/store/modules/layout'
import PlanSummaryBlock from './strike-plan/PlanSummaryBlock.vue'
import SatelliteCard from './strike-plan/SatelliteCard.vue'

defineOptions({ name: 'StrikePlanGenerator' })

/** 卫星用途类型选项 */
interface UsageTypeOption {
  /** 展示名称 */
  label: string
  /** 传给接口的 type 参数 */
  value: string
}

/** 可选用途类型：全部打击军用 / 全部打击民用 / 打击军用民用 */
const usageTypeOptions: UsageTypeOption[] = ZHCH_USAGE_TYPE_OPTIONS.map((value) => ({
  label: '打击' + value,
  value,
}))

const store = useLayoutStore()

onMounted(() => {
  store.sanitizeZhchUsageTypes()
})

/** 已展开的接收站过境窗口（panelKey-norad） */
const expandedWindowKeys = ref<Set<string>>(new Set())

/** 多栏对比模式下已展开的卫星矩阵用途类型 */
const expandedMatrixTypes = ref<Set<string>>(new Set())

/** 清除服务端缓存请求中 */
const cacheClearing = ref(false)

/** 当前勾选的用途类型（过滤旧版「军用」等无效值） */
const selectedUsageTypes = computed(() =>
  store.selectedZhchUsageTypes.filter((type) =>
    (ZHCH_USAGE_TYPE_OPTIONS as readonly string[]).includes(type)
  )
)

/** 是否已有可展示的方案（任一勾选类型有缓存） */
const hasVisiblePlans = computed(() =>
  selectedUsageTypes.value.some((type) => !!store.zhchPlanMap[type])
)

/** 是否为单选对比模式 */
const isSingleMode = computed(() => selectedUsageTypes.value.length === 1)

/** 是否为多选对比模式 */
const isMultiMode = computed(() => selectedUsageTypes.value.length >= 2)

/** 单选模式下当前方案 */
const primaryPlan = computed(() => {
  const type = selectedUsageTypes.value[0]
  return type ? store.zhchPlanMap[type] ?? null : null
})

/**
 * 根据用途类型读取 store 中的方案
 * @param type 用途类型
 */
const getPlanByType = (type: string): ZhchPlanResp | null => store.zhchPlanMap[type] ?? null

/**
 * 将方案转换为打击前基准状态（延迟 0、全部未打击）
 * @param plan 原始方案
 */
const buildBaselinePlan = (plan: ZhchPlanResp): ZhchPlanResp => ({
  ...plan,
  summary: '打击前基准状态：所有卫星链路无延迟，卫星与接收站均未受打击。',
  avgDelayMin: 0,
  satelliteMatrixList: (plan.satelliteMatrixList || []).map((sat) => ({
    ...sat,
    delayMin: 0,
    satelliteStatus: 0,
    weapons: [],
    stationWindows: (sat.stationWindows || []).map((win) => ({
      ...win,
      strikeStatus: 0,
      weapons: [],
    })),
  })),
})

/** 单选模式左侧基准方案 */
const baselinePlan = computed(() => (primaryPlan.value ? buildBaselinePlan(primaryPlan.value) : null))

/** 单选对比模式下用于逐行渲染的卫星列表（与左右面板同源） */
const compareSatelliteList = computed(
  () => primaryPlan.value?.satelliteMatrixList ?? []
)

/**
 * 按 NORAD 从基准方案中取对应卫星
 * @param norad 卫星 NORAD
 */
const getBaselineSatellite = (norad: number): ZhchPlanSatelliteMatrix | undefined =>
  baselinePlan.value?.satelliteMatrixList?.find((s) => s.norad === norad)

/**
 * 切换用途类型多选
 * @param type 用途类型
 */
const handleToggleUsageType = (type: string) => {
  const before = store.selectedZhchUsageTypes.length
  store.toggleZhchUsageType(type)
  if (before === 1 && store.selectedZhchUsageTypes.length === 1) {
    ElMessage.warning('至少选择一种用途类型')
  }
}

/** 生成方案：拉取选中类型并写入 store */
const handleGenerate = async () => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择战场与任务')
    return
  }
  store.sanitizeZhchUsageTypes()
  expandedWindowKeys.value = new Set()
  expandedMatrixTypes.value = new Set()
  const ok = await store.fetchZhchPlans(selectedUsageTypes.value, true)
  if (!ok) {
    ElMessage.warning('获取打击方案失败，请稍后重试')
  }
}

/**
 * 清除打击方案服务端缓存，并清空本地已缓存方案
 */
const handleClearCache = async () => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    ElMessage.warning('请先选择战场与任务')
    return
  }

  cacheClearing.value = true
  try {
    const res = await refreshZhchPlanCache(taskId)
    if (res.code === 200) {
      store.clearZhchPlans()
      expandedWindowKeys.value = new Set()
      expandedMatrixTypes.value = new Set()
      ElMessage.success('打击方案缓存已清除')
    } else {
      ElMessage.warning(res.msg || '清除缓存失败，请稍后重试')
    }
  } catch {
    ElMessage.error('清除缓存失败，请稍后重试')
  } finally {
    cacheClearing.value = false
  }
}

/**
 * 切换卫星过境窗口展开状态
 * @param panelKey 面板标识
 * @param norad 卫星 NORAD
 */
const toggleSatWindows = (panelKey: string, norad: number) => {
  const key = `${panelKey}-${norad}`
  const next = new Set(expandedWindowKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedWindowKeys.value = next
}

/**
 * 切换多栏模式下卫星矩阵展开
 * @param usageType 用途类型
 */
const toggleMatrixExpand = (usageType: string) => {
  const next = new Set(expandedMatrixTypes.value)
  if (next.has(usageType)) next.delete(usageType)
  else next.add(usageType)
  expandedMatrixTypes.value = next
}

/**
 * 判断多栏模式下卫星矩阵是否展开
 * @param usageType 用途类型
 */
const isMatrixExpanded = (usageType: string): boolean => expandedMatrixTypes.value.has(usageType)

/**
 * 格式化过境窗口时间展示
 * @param timeStr 原始时间字符串
 */
const formatWindowTime = (timeStr?: string): string => {
  if (!timeStr) return '--'
  const normalized = timeStr.replace('T', ' ').replace('Z', '')
  const date = new Date(normalized.includes('-') ? normalized.replace(/-/g, '/') : normalized)
  if (Number.isNaN(date.getTime())) return timeStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 轨道类型枚举转中文标签
 * @param orbitType 轨道类型枚举值
 */
const orbitTypeLabel = (orbitType: number): string => {
  const map: Record<number, string> = { 1: '低轨', 2: '中轨', 3: '高轨' }
  return map[orbitType] || `类型${orbitType}`
}

/** 方案统计行子组件 */
const PlanStatsRow = defineComponent({
  name: 'PlanStatsRow',
  props: {
    plan: { type: Object as PropType<ZhchPlanResp>, required: true },
    compact: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h('div', { class: ['plan-stats-row', props.compact ? 'plan-stats-row--compact' : ''] }, [
        h('span', { class: 'stat stat--sat' }, [`卫星 ${props.plan.satNum}`]),
        h('span', { class: 'stat stat--station' }, [`接收站 ${props.plan.receiveNum}`]),
        h('span', { class: 'stat stat--weapon' }, [`武器 ${props.plan.weaponNum}`]),
        h('span', { class: 'stat stat--delay' }, [`延迟 ${props.plan.avgDelayMin} 分`]),
      ])
  },
})

/** 卫星矩阵网格子组件 */
const SatelliteMatrixGrid = defineComponent({
  name: 'SatelliteMatrixGrid',
  props: {
    plan: { type: Object as PropType<ZhchPlanResp>, required: true },
    panelKey: { type: String, required: true },
    windowsCollapsible: { type: Boolean, default: false },
    expandedWindowKeys: { type: Object as PropType<Set<string>>, required: true },
  },
  emits: ['toggle-windows'],
  setup(props, { emit }) {
    const renderSatCard = (sat: ZhchPlanSatelliteMatrix) => {
      const winExpanded =
        !props.windowsCollapsible || props.expandedWindowKeys.has(`${props.panelKey}-${sat.norad}`)

      return h(
        'div',
        { class: ['satellite-card', sat.satelliteStatus === 1 ? 'struck' : ''] },
        [
          h('div', { class: 'sat-header' }, [
            h('div', { class: 'sat-title' }, [
              h('span', { class: 'sat-name' }, sat.name),
              h('span', { class: 'sat-type-tag' }, sat.satType),
              h('span', { class: 'usage-tag' }, sat.usage),
            ]),
            h('div', { class: 'sat-meta' }, [
              h('span', `NORAD ${sat.norad}`),
              h(
                'span',
                { class: ['status-tag', sat.satelliteStatus === 1 ? 'struck' : 'ok'] },
                sat.satelliteStatus === 1 ? '已打击' : '正常'
              ),
            ]),
          ]),
          h('div', { class: 'sat-metrics' }, [
            h('div', { class: 'metric-item' }, [
              h('span', { class: 'metric-label' }, '链路延迟'),
              h('span', { class: 'metric-val' }, `${sat.delayMin} 分钟`),
            ]),
            h('div', { class: 'metric-item' }, [
              h('span', { class: 'metric-label' }, '轨道类型'),
              h('span', { class: 'metric-val' }, orbitTypeLabel(sat.orbitType)),
            ]),
          ]),
          sat.weapons?.length
            ? h('div', { class: 'weapon-block' }, [
              h('div', { class: 'block-title' }, '针对卫星的武器'),
              h(
                'div',
                { class: 'weapon-list' },
                sat.weapons.map((weapon) =>
                  h('span', { class: 'weapon-chip', key: weapon.id || weapon.name }, [
                    weapon.name,
                    weapon.type ? h('em', ` (${weapon.type})`) : null,
                  ])
                )
              ),
            ])
            : null,
          h('div', { class: 'window-block' }, [
            h(
              'div',
              {
                class: ['block-title', 'block-title--clickable', winExpanded ? 'is-expanded' : ''],
                onClick: () => {
                  if (props.windowsCollapsible) emit('toggle-windows', props.panelKey, sat.norad)
                },
              },
              [
                `接收站过境窗口 (${sat.stationWindows?.length || 0})`,
                props.windowsCollapsible ? h('span', { class: 'expand-icon' }, winExpanded ? '▲' : '▼') : null,
              ]
            ),
            winExpanded && sat.stationWindows?.length
              ? h(
                'div',
                { class: 'window-list' },
                sat.stationWindows.map((win) =>
                  h(
                    'div',
                    {
                      class: ['window-item', win.strikeStatus === 1 ? 'struck' : ''],
                      key: win.receiveId + win.peakWindow,
                    },
                    [
                      h('div', { class: 'window-top' }, [
                        h('span', { class: 'receive-name' }, `📡 ${win.receiveName}`),
                        h(
                          'span',
                          { class: ['strike-tag', win.strikeStatus === 1 ? 'struck' : 'ok'] },
                          win.strikeStatus === 1 ? '已打击' : '未打击'
                        ),
                      ]),
                      h('div', { class: 'window-time' }, `过境时间：${formatWindowTime(win.peakWindow)}`),
                      win.weapons?.length
                        ? h('div', { class: 'window-weapons' }, [
                          h('span', { class: 'weapon-label' }, '武器：'),
                          ...win.weapons.map((w) =>
                            h('span', { class: 'mini-weapon', key: w.id || w.name }, w.name)
                          ),
                        ])
                        : null,
                    ]
                  )
                )
              )
              : winExpanded
                ? h('div', { class: 'no-window-tip' }, '暂无接收站窗口数据')
                : null,
          ]),
        ]
      )
    }

    return () =>
      h(
        'div',
        { class: 'satellite-grid' },
        (props.plan.satelliteMatrixList || []).map((sat) => renderSatCard(sat))
      )
  },
})

/** 任务切换后清空展开状态；有任务时尝试使用 store 缓存 */
watch(
  () => store.activedTask?.id,
  (taskId, prevId) => {
    expandedWindowKeys.value = new Set()
    expandedMatrixTypes.value = new Set()
    if (taskId !== prevId) {
      store.clearZhchPlans()
    }
  }
)
</script>

<style lang="scss" scoped>
.strike-plan-generator {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(79, 147, 221, 0.25);
  background: linear-gradient(180deg, rgba(12, 28, 48, 0.95) 0%, rgba(8, 20, 36, 0.98) 100%);
  flex-shrink: 0;
  flex-wrap: wrap;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-title {
      font-size: 16px;
      font-weight: 700;
    }
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .type-label {
      font-size: 16px;
      color: #94a3b8;
    }

    .type-selector {
      display: flex;
      gap: 6px;

      .type-btn {
        padding: 5px 14px;
        font-size: 13px;
        color: #8eb3d6;
        background: rgba(16, 36, 62, 0.7);
        border: 1px solid rgba(79, 147, 221, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          color: #fff;
          border-color: rgba(0, 225, 255, 0.5);
        }

        &.active {
          color: #fff;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(79, 147, 221, 0.85) 0%, rgba(0, 180, 216, 0.9) 100%);
          border-color: #00e1ff;
          box-shadow: 0 0 10px rgba(0, 225, 255, 0.35);
        }
      }
    }

    :deep(.atlas-app-button) {
      height: auto;
      padding: 5px 14px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      transition: all 0.2s ease;

      .btn-icon {
        margin-right: 2px;
      }
    }

    :deep(.atlas-app-button--primary) {
      background: linear-gradient(135deg, rgba(79, 147, 221, 0.85) 0%, rgba(0, 180, 216, 0.9) 100%);
      border-color: #00e1ff;
      color: #fff;
      box-shadow: 0 0 10px rgba(0, 225, 255, 0.35);

      &:hover {
        background: linear-gradient(135deg, rgba(79, 147, 221, 1) 0%, rgba(0, 180, 216, 1) 100%);
        border-color: #00e1ff;
      }
    }

    :deep(.atlas-app-button--default) {
      background: rgba(16, 36, 62, 0.7);
      border: 1px solid rgba(79, 147, 221, 0.3);
      color: #8eb3d6;

      &:hover {
        color: #fff;
        border-color: rgba(0, 225, 255, 0.5);
        background: rgba(16, 36, 62, 0.9);
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .stat-badge-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    .label {
      color: #94a3b8;
    }

    .value {
      font-weight: 700;
      color: #e2e8f0;
    }
  }
}

.glow-text {
  color: #eaf3ff;
  text-shadow: 0 0 8px rgba(64, 242, 255, 0.35);
}

.glow-text-cyan {
  color: #38bdf8;
}

.glow-text-yellow {
  color: #fbbf24;
}

.glow-text-red {
  color: #f87171;
}

.plan-body {
  flex: 1;
  overflow: hidden;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.compare-split {
  flex: 1;
  min-height: 0;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(10, 20, 36, 0.85);
  overflow: hidden;
}

.compare-split-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.compare-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;

  >* {
    min-width: 0;
  }
}

.compare-panel-head {
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(14, 28, 48, 0.75);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  overflow: hidden;

  &--baseline {
    border-color: rgba(34, 197, 94, 0.3);
  }

  &--actual {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .panel-title {
    font-size: 14px;
    font-weight: 700;
    color: #7dd3fc;
  }

  .panel-sub {
    font-size: 11px;
    color: #86efac;
  }
}

.compare-row--summary {
  align-items: stretch;

  :deep(.summary-card) {
    min-width: 0;
    overflow: hidden;
  }
}

.compare-row--matrix-title {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #b5d5ff;
    min-width: 0;

    .count-tag {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      background: rgba(56, 189, 248, 0.15);
      color: #7dd3fc;
      flex-shrink: 0;
    }
  }
}

.compare-satellite-group {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.22);
  background: rgba(8, 15, 26, 0.4);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);

  >* {
    min-width: 0;
  }
}

.compare-columns {
  flex: 1;
  display: grid;
  gap: 12px;
  min-height: 0;
  overflow: hidden;
}

.compare-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.25);
  background: rgba(10, 20, 36, 0.85);
  overflow: hidden;

  .column-head {
    flex-shrink: 0;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(79, 147, 221, 0.2);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .column-title {
    font-size: 20px;
    font-weight: 800;
    color: #40f2ff;
    letter-spacing: 1px;
    text-shadow: 0 0 10px rgba(64, 242, 255, 0.45);
  }

  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

:deep(.plan-stats-row) {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .stat {
    font-size: 14px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 6px;
    background: rgba(8, 15, 26, 0.6);
    color: #cbd5e1;
    border: 1px solid rgba(79, 147, 221, 0.2);

    &--sat {
      color: #38bdf8;
      border-color: rgba(56, 189, 248, 0.35);
    }

    &--station {
      color: #fbbf24;
      border-color: rgba(251, 191, 36, 0.35);
    }

    &--weapon {
      color: #f87171;
      border-color: rgba(248, 113, 113, 0.35);
    }

    &--delay {
      color: #4ade80;
      font-weight: 800;
      background: rgba(74, 222, 128, 0.1);
      border: 1px solid rgba(74, 222, 128, 0.45);
      box-shadow: 0 0 10px rgba(74, 222, 128, 0.25);
    }
  }
}

:deep(.plan-stats-row--compact .stat) {
  font-size: 11px;
  padding: 2px 7px;
}

.matrix-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
  color: #7dd3fc;
  background: rgba(0, 225, 255, 0.08);
  border: 1px dashed rgba(0, 225, 255, 0.35);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(0, 225, 255, 0.15);
    border-color: #00e1ff;
  }

  .toggle-count {
    font-size: 13px;
    font-weight: 800;
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }
}

.summary-card {
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(14, 28, 48, 0.75);
  border: 1px solid rgba(79, 147, 221, 0.25);

  &.compact {
    padding: 12px 14px;
  }

  .summary-title {
    font-size: 16px;
    font-weight: 800;
    color: #7dd3fc;
    margin-bottom: 8px;
    padding-left: 8px;
    border-left: 3px solid #00e1ff;
  }

  .summary-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.8;
    color: #e2e8f0;
  }

  .weapon-types {
    margin-top: 10px;
    font-size: 13px;
    color: #94a3b8;

    .weapon-type-chip {
      color: #7dd3fc;
      font-weight: 700;
      text-shadow: 0 0 6px rgba(125, 211, 252, 0.35);
    }
  }
}

.satellite-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #b5d5ff;
    margin-bottom: 10px;

    .count-tag {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      background: rgba(56, 189, 248, 0.15);
      color: #7dd3fc;
    }
  }
}

:deep(.satellite-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 10px;
}

:deep(.satellite-card) {
  padding: 12px;
  border-radius: 8px;
  background: rgba(18, 32, 54, 0.85);
  border: 1px solid rgba(79, 147, 221, 0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;

  .sat-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;

    .sat-title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;

      .sat-name {
        font-size: 13px;
        font-weight: 700;
        color: #fff;
      }

      .sat-type-tag,
      .usage-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(0, 225, 255, 0.12);
        color: #7dd3fc;
      }

      .usage-tag {
        background: rgba(251, 191, 36, 0.12);
        color: #fbbf24;
      }
    }

    .sat-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      font-size: 11px;
      color: #94a3b8;

      .status-tag {
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;

        &.ok {
          color: #86efac;
          background: rgba(34, 197, 94, 0.15);
        }

        &.struck {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.15);
        }
      }
    }
  }

  .sat-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;

    .metric-item {
      padding: 6px 8px;
      border-radius: 4px;
      background: rgba(8, 15, 26, 0.55);

      .metric-label {
        display: block;
        font-size: 10px;
        color: #64748b;
      }

      .metric-val {
        font-size: 12px;
        font-weight: 700;
        color: #e2e8f0;
      }
    }
  }

  .weapon-block,
  .window-block {
    .block-title {
      font-size: 12px;
      font-weight: 600;
      color: #7dd3fc;
      margin-bottom: 6px;

      &--clickable {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 8px;
        border-radius: 4px;
        background: rgba(8, 15, 26, 0.45);
        border: 1px solid rgba(79, 147, 221, 0.2);
        cursor: pointer;
        user-select: none;
        margin-bottom: 0;

        &:hover {
          border-color: rgba(0, 225, 255, 0.4);
        }

        &.is-expanded {
          border-color: rgba(0, 225, 255, 0.45);
          margin-bottom: 6px;
        }

        .expand-icon {
          font-size: 10px;
          color: #94a3b8;
        }
      }
    }
  }

  .weapon-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .weapon-chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);

      em {
        font-style: normal;
        color: #94a3b8;
      }
    }
  }

  .window-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
  }

  .window-item {
    padding: 8px;
    border-radius: 6px;
    background: rgba(8, 15, 26, 0.55);
    border: 1px solid rgba(79, 147, 221, 0.15);

    &.struck {
      border-color: rgba(239, 68, 68, 0.3);
    }

    .window-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;

      .receive-name {
        font-size: 12px;
        font-weight: 600;
        color: #e2e8f0;
      }

      .strike-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;

        &.ok {
          color: #86efac;
          background: rgba(34, 197, 94, 0.12);
        }

        &.struck {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.12);
        }
      }
    }

    .window-time {
      margin-top: 4px;
      font-size: 11px;
      color: #94a3b8;
    }

    .window-weapons {
      margin-top: 4px;
      font-size: 11px;
      color: #cbd5e1;

      .weapon-label {
        color: #64748b;
      }

      .mini-weapon {
        margin-right: 6px;
        color: #fca5a5;
      }
    }
  }

  .no-window-tip {
    font-size: 11px;
    color: #64748b;
    padding: 4px 0;
  }
}

:deep(.satellite-card.struck) {
  border-color: rgba(239, 68, 68, 0.35);
  background: rgba(36, 18, 24, 0.45);
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 280px;
  gap: 10px;
  color: #94a3b8;

  &.small {
    min-height: 100px;
  }

  .empty-icon {
    font-size: 36px;
  }

  .empty-text {
    font-size: 14px;
  }
}
</style>
