<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">态势统计分析</span>
      </div>

    </div>

    <div v-if="!activeMatrix" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无矩阵数据</p>
      <p class="empty-sub">请在左侧选择系列，或选择「全部系列」加载态势</p>
    </div>

    <template v-else>
      <div class="stats-strip">
        <div class="stats-strip-item stats-strip-item--sat" role="button" tabindex="0" title="点击跳转到卫星管理"
          @click="goToSatellites" @keydown.enter.prevent="goToSatellites">
          <strong class="stats-strip-label">卫星</strong>
          <div class="stats-strip-bottom">
            <span class="stats-strip-value">{{ overviewStats.satelliteCount }}</span>
            <span class="stats-strip-unit">颗</span>
          </div>
        </div>
        <div class="stats-strip-divider"></div>
        <div class="stats-strip-item stats-strip-item--receive" role="button" tabindex="0" title="点击跳转到基站管理"
          @click="goToBaseStations" @keydown.enter.prevent="goToBaseStations">
          <strong class="stats-strip-label">地面站</strong>
          <div class="stats-strip-bottom">
            <span class="stats-strip-value">{{ overviewStats.receiveCount }}</span>
            <span class="stats-strip-unit">个</span>
          </div>
        </div>
        <div class="stats-strip-divider"></div>
        <div class="stats-strip-item stats-strip-item--station" role="button" tabindex="0" title="点击跳转到基站管理"
          @click="goToBaseStations" @keydown.enter.prevent="goToBaseStations">
          <strong class="stats-strip-label">数据中心</strong>
          <div class="stats-strip-bottom">
            <span class="stats-strip-value">{{ overviewStats.stationCount }}</span>
            <span class="stats-strip-unit">个</span>
          </div>
        </div>
        <div class="stats-strip-divider"></div>
        <div class="stats-strip-item stats-strip-item--weapon" role="button" tabindex="0" title="点击跳转到武器管理"
          @click="goToWeapons" @keydown.enter.prevent="goToWeapons">
          <strong class="stats-strip-label">我方武器</strong>
          <div class="stats-strip-bottom">
            <span class="stats-strip-value">{{ ourWeaponCount }}</span>
            <span class="stats-strip-unit">件</span>
          </div>
        </div>
      </div>

      <div class="link-section">
        <div class="link-section-header">
          <div class="link-section-title-wrap">
            <span class="link-section-title">可能传输链路</span>
            <span class="link-section-count">{{ transmissionLinks.length }} 条</span>
          </div>
          <span class="link-section-hint">
            {{ selectedSatelliteNorad != null ? '按过境开始时间升序' : '打击前全路径枚举' }}
          </span>
        </div>

        <div class="link-section-scroll">
          <VirtualScrollList
            v-if="displayLinkItems.length"
            :items="displayLinkItems"
            :item-height="OTHER_LINK_ITEM_HEIGHT"
            :get-item-height="getDisplayLinkItemHeight"
            item-key="id"
          >
            <template #default="{ item }">
              <div
                class="transmission-link-card"
                :class="[
                  {
                    active: selectedTransmissionLinkId === item.link.id,
                    blocked: item.link.blocked,
                  },
                  item.priority ? `priority-rank-${item.priority.rank}` : '',
                ]"
                role="button"
                tabindex="0"
                @click="handleLinkCardClick(item.link)"
                @keydown.enter.prevent="handleLinkCardClick(item.link)"
              >
                <div class="link-card-header">
                  <div class="link-title-left">
                    <span class="link-index">链路 {{ item.displayIndex }}</span>
                    <span
                      v-if="item.priority"
                      class="rank-badge"
                      :class="`rank-badge--${item.priority.rank}`"
                    >
                      {{ getRankMedal(item.priority.rank) }} TOP {{ item.priority.rank }}
                      ({{ item.priority.totalScore }}分)
                    </span>
                  </div>
                  <div class="link-metrics-row">
                    <div class="link-metric-card">
                      <span class="link-metric-label">{{ primaryLinkMetricLabel }}</span>
                      <strong>{{ formatPrimaryLinkMetric(item.link) }}</strong>
                    </div>
                  </div>
                </div>

                <div class="link-flow-row">
                  <template v-for="(node, nodeIdx) in item.link.nodes" :key="item.link.id + '-' + node.layer + node.id">
                    <div class="flow-node">
                      <span class="flow-node-icon">{{ node.icon }}</span>
                      <span class="flow-node-name" :title="node.name">{{ node.name }}</span>
                      <span class="flow-node-layer">{{ chainLayerLabel(node.layer) }}</span>
                    </div>
                    <span v-if="nodeIdx < item.link.nodes.length - 1" class="flow-arrow">→</span>
                  </template>
                </div>

                <div v-if="item.priority" class="priority-reason-tip">
                  <span class="reason-icon">💡</span>
                  <span class="reason-text">{{ item.priority.reason }}</span>
                </div>

                <div v-if="item.link.blocked" class="link-blocked-tip">{{ item.link.blockedReason }}</div>

                <div class="link-meta-row">
                  <span class="link-meta-label">传输时间</span>
                  <strong class="link-meta-val">{{ item.link.transmitTime }}</strong>
                </div>
              </div>
            </template>
          </VirtualScrollList>

          <div v-else class="empty-link-box">
            {{ selectedSatelliteNorad != null ? '该卫星暂无关联传输链路' : '当前范围内暂无可枚举链路' }}
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧统计面板
 * 上方展示卫星/地面站/数据中心/我方武器统计，下方列出全部可能传输链路。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { type MatrixResult } from '@/api/electronic'
import { getAllWeapons } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import VirtualScrollList from '@/components/common/VirtualScrollList.vue'
import {
  collectMatrixOverviewStats,
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  rankTransmissionLinksByPriority,
  STARLINK_PRIORITY_WEIGHTS,
  type ChainNode,
  type LinkPriorityMetrics,
  type SatelliteTransmissionLink,
  type PrioritizedTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

/**
 * 右侧面板统一链路列表项：TOP 3 带优先级，其余为普通链路。
 */
interface DisplayTransmissionLinkItem {
  /** 链路稳定 id，供虚拟列表作 key */
  id: string
  /** 原始传输链路 */
  link: SatelliteTransmissionLink
  /** 列表展示序号，从 1 开始 */
  displayIndex: number
  /** TOP 3 优先级信息；非推荐链路为 null */
  priority: LinkPriorityMetrics | null
}

/** 普通链路卡片行高（含间距），单位 px */
const OTHER_LINK_ITEM_HEIGHT = 188
/** TOP 3 推荐卡片行高（含推荐理由与间距），单位 px */
const TOP_LINK_ITEM_HEIGHT = 292

const router = useRouter()
const store = useLayoutStore()


/** 将毫秒时长格式化为小时和分钟。 */
const formatElapsedTime = (durationMs: number): string => {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '--'
  const totalMinutes = Math.floor(durationMs / 60000)
  return `${Math.floor(totalMinutes / 60)}时${totalMinutes % 60}分`
}

/**
 * 快捷跳转页面
 */
const goToSatellites = () => {
  router.push('/system/satellites')
}

const goToBaseStations = () => {
  router.push('/system/basestations')
}

const goToWeapons = () => {
  router.push('/system/weapons')
}

const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 保留兼容 */
  selectedSatelliteNorad?: number | null
  /** 当前在地图上高亮展示的传输链路 ID */
  selectedTransmissionLinkId?: string | null
}>()

const emit = defineEmits<{
  (e: 'clear-satellite-selection'): void
  /** 选中/取消选中传输链路（再次点击同一链路则取消） */
  (e: 'select-transmission-link', link: SatelliteTransmissionLink | null): void
}>()

/** 当前生效矩阵 */
const activeMatrix = computed<MatrixResult | null>(() => props.matrixData)

/** 统计范围文案 */
const scopeLabel = computed(() => (store.selectedSatSeries ? store.selectedSatSeries : '全部系列'))

/** STARLINK 系列的链路首要指标使用卫星覆盖率。 */
const isStarlinkSeries = computed(() => store.selectedSatSeries === 'STARLINK')

/** 链路卡片首个指标名称。 */
const primaryLinkMetricLabel = computed(() => (isStarlinkSeries.value ? '覆盖率' : '链路时长'))

/** 按 NORAD 编号索引的打击后卫星覆盖率。 */
const coverageByNorad = computed(() =>
  new Map(
    (activeMatrix.value?.satelliteMatrixList || [])
      .filter((satellite) => Number.isFinite(satellite.coverage))
      .map((satellite) => [satellite.norad, satellite.coverage!])
  )
)

/** 矩阵概览统计（不含我方武器数量） */
const overviewStats = computed(() => collectMatrixOverviewStats(activeMatrix.value, scopeLabel.value))

/** 我方武器总数 */
const ourWeaponCount = ref(0)

/**
 * 拉取我方武器总数
 */
const loadOurWeaponCount = async () => {
  try {
    const res = await getAllWeapons()
    if (res.code === 200 && res.data?.weapons) {
      ourWeaponCount.value = res.data.weapons.length
    } else {
      ourWeaponCount.value = 0
    }
  } catch (err) {
    console.error('获取我方武器统计失败:', err)
    ourWeaponCount.value = 0
  }
}

/**
 * 当前展示的传输链路：
 * - 选中卫星时：仅该卫星相关链路，按过境开始时间从早到晚排序
 * - 未选中时：当前系列范围内全部链路
 */
const transmissionLinks = computed<SatelliteTransmissionLink[]>(() => {
  const matrix = activeMatrix.value
  if (!matrix) return []

  const norad = props.selectedSatelliteNorad
  if (norad != null) {
    return collectSatelliteTransmissionLinks(matrix, norad)
  }

  return collectSeriesTransmissionLinks(matrix)
})

/**
 * 按多维优先级评估后的传输链路列表（降序）
 */
const prioritizedLinks = computed<PrioritizedTransmissionLink[]>(() => {
  const matrix = activeMatrix.value
  if (!matrix || !transmissionLinks.value.length) return []
  return rankTransmissionLinksByPriority(
    matrix,
    transmissionLinks.value,
    isStarlinkSeries.value ? STARLINK_PRIORITY_WEIGHTS : undefined
  )
})

/**
 * TOP 3 与其余链路拼成一条列表：推荐卡在前，其余保持原排序且不重复。
 */
const displayLinkItems = computed<DisplayTransmissionLinkItem[]>(() => {
  const top3 = prioritizedLinks.value.slice(0, 3)
  const topIds = new Set(top3.map((item) => item.link.id))
  const items: DisplayTransmissionLinkItem[] = top3.map((item, index) => ({
    id: item.link.id,
    link: item.link,
    displayIndex: index + 1,
    priority: item.priority,
  }))
  transmissionLinks.value.forEach((link) => {
    if (topIds.has(link.id)) return
    items.push({
      id: link.id,
      link,
      displayIndex: items.length + 1,
      priority: null,
    })
  })
  return items
})

/**
 * 虚拟列表按条目取行高：推荐卡更高，普通卡沿用紧凑高度。
 *
 * @param item 统一链路展示项
 * @returns 行高（px）
 */
const getDisplayLinkItemHeight = (item: DisplayTransmissionLinkItem): number =>
  item.priority ? TOP_LINK_ITEM_HEIGHT : OTHER_LINK_ITEM_HEIGHT

/** 格式化卫星覆盖率。 */
const formatCoverage = (coverage: number | undefined): string => {
  if (coverage == null || !Number.isFinite(coverage)) return '--'
  return `${Number(coverage.toFixed(2))}%`
}

/** 根据当前系列格式化链路卡片首个指标。 */
const formatPrimaryLinkMetric = (link: SatelliteTransmissionLink): string => {
  if (!isStarlinkSeries.value) {
    return formatElapsedTime(link.transmitEndMs - link.transmitStartMs)
  }
  const sourceSatellite = link.nodes.find((node) => node.layer === 'SAT')
  const norad = Number(sourceSatellite?.id)
  return formatCoverage(coverageByNorad.value.get(norad))
}

const getRankMedal = (rank: number): string => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

/**
 * 解析链路层的显示标签
 * @param layer 链路层类型
 */
const chainLayerLabel = (layer: ChainNode['layer']): string => {
  const map: Record<ChainNode['layer'], string> = {
    SAT: '卫星',
    RELAY: '中继',
    RECEIVE: '地面站',
    STATION: '数据中心',
  }
  return map[layer]
}

/**
 * 点击链路卡片：选中并在地图上绘制连线；再次点击同一链路则取消选中。
 * @param link 被点击的传输链路
 */
const handleLinkCardClick = (link: SatelliteTransmissionLink) => {
  if (props.selectedTransmissionLinkId === link.id) {
    emit('select-transmission-link', null)
    return
  }
  emit('select-transmission-link', link)
}

onMounted(() => {
  void loadOurWeaponCount()
})
</script>

<style lang="scss" scoped>
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
  overflow: hidden;
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

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

  .panel-badge {
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 4px;
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.scope-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 8px;
  background: rgba(0, 225, 255, 0.08);
  border: 1px solid rgba(0, 225, 255, 0.22);

  .scope-label {
    font-size: 12px;
    color: #94a3b8;
  }

  .scope-value {
    font-size: 13px;
    color: #67e8f9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.stats-strip {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  align-items: stretch;
  gap: 0;
  margin-bottom: 12px;
  padding: 12px 8px;
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(14, 25, 42, 0.95) 0%, rgba(8, 15, 26, 0.95) 100%);
  border: 1px solid rgba(0, 225, 255, 0.18);
  box-shadow: inset 0 0 20px rgba(0, 225, 255, 0.04);
}

.stats-strip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 6px 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;

  &:hover {
    background: rgba(0, 225, 255, 0.08);
    box-shadow: 0 0 10px rgba(0, 225, 255, 0.15);
    transform: translateY(-1px);

    .stats-strip-label {
      color: #ffffff;
    }
  }

  &:active {
    transform: translateY(0);
    background: rgba(0, 225, 255, 0.15);
  }

  &:focus-visible {
    outline: 1px solid rgba(0, 225, 255, 0.6);
    background: rgba(0, 225, 255, 0.08);
  }

  .stats-strip-label {
    font-size: 12px;
    font-weight: 700;
    color: #cbd5e1;
    letter-spacing: 0.5px;
    transition: color 0.2s ease;
  }

  .stats-strip-bottom {
    display: flex;
    align-items: baseline;
    gap: 2px;
  }

  .stats-strip-value {
    font-size: 20px;
    line-height: 1;
    color: #f8fafc;
    font-weight: 700;
  }

  .stats-strip-unit {
    font-size: 10px;
    color: #64748b;
  }

  &--sat .stats-strip-value {
    color: #38bdf8;
  }

  &--receive .stats-strip-value {
    color: #22d3ee;
  }

  &--station .stats-strip-value {
    color: #60a5fa;
  }

  &--weapon .stats-strip-value {
    color: #fb7185;
  }
}

.stats-strip-divider {
  width: 1px;
  align-self: stretch;
  background: rgba(148, 163, 184, 0.18);
}

.link-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.link-section-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.link-section-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #7dd3fc;
}

.link-section-count {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.link-section-hint {
  font-size: 11px;
  color: #64748b;
}

.link-section-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  :deep(.virtual-scroll-list__item) {
    padding-bottom: 8px;
  }

  .transmission-link-card {
    box-sizing: border-box;
    height: 100%;
    overflow: hidden;
  }
}

.transmission-link-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(14, 25, 42, 0.82);
  border: 1px solid rgba(0, 225, 255, 0.14);
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.32);
    background: rgba(18, 32, 54, 0.88);
  }

  &.active {
    border-color: rgba(245, 230, 163, 0.65);
    background: rgba(28, 32, 24, 0.72);
    box-shadow: 0 0 12px rgba(245, 230, 163, 0.12);
  }

  &.blocked {
    border-style: dashed;
  }

  &.priority-rank-1 {
    border-left: 3px solid #eab308;
  }

  &.priority-rank-2 {
    border-left: 3px solid #38bdf8;
  }

  &.priority-rank-3 {
    border-left: 3px solid #fb923c;
  }

  .link-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .link-title-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .link-index {
      font-size: 14px;
      flex-shrink: 0;
      font-weight: 700;
      color: #7dd3fc;
    }

    .rank-badge {
      font-size: 10px;
      font-weight: 800;
      padding: 1px 6px;
      border-radius: 4px;

      &--1 {
        background: rgba(234, 179, 8, 0.25);
        color: #fef08a;
        border: 1px solid rgba(234, 179, 8, 0.6);
      }

      &--2 {
        background: rgba(56, 189, 248, 0.25);
        color: #bae6fd;
        border: 1px solid rgba(56, 189, 248, 0.6);
      }

      &--3 {
        background: rgba(249, 115, 22, 0.25);
        color: #fed7aa;
        border: 1px solid rgba(249, 115, 22, 0.6);
      }
    }
  }

  .priority-reason-tip {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    padding: 6px 8px;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.08);
    border: 1px solid rgba(0, 225, 255, 0.2);
    font-size: 13px;
    color: #bae6fd;
    line-height: 1.5;
    text-align: left;

    .reason-icon {
      font-size: 13px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .reason-text {
      text-align: left;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  }
}

.link-flow-row {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(8, 15, 26, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.flow-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px;
  flex: 1;

  .flow-node-icon {
    font-size: 14px;
  }

  .flow-node-name {
    font-size: 10px;
    font-weight: 600;
    color: cyan;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
  }

  .flow-node-layer {
    font-size: 9px;
    color: #64748b;
  }
}

.flow-arrow {
  color: #00e1ff;
  font-size: 13px;
  font-weight: 700;
  line-height: 32px;
}

.link-blocked-tip {
  font-size: 11px;
  color: #94a3b8;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.08);
}

.link-metrics-row {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  flex: 1;
  min-width: 0;
  margin-top: 0;
}

.link-metric-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-width: 0;

  .link-metric-label {
    color: #8494aa;
    font-size: 10px;
    white-space: nowrap;
  }

  strong {
    color: #d2d440;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
  }
}

.link-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 2px;

  .link-meta-label {
    font-size: 11px;
    color: #64748b;
  }

  .link-meta-val {
    font-size: 11px;
    color: #67e8f9;
    text-align: right;
    line-height: 1.4;
  }
}

.empty-sat-box {
  margin: auto 0;
}

.empty-sat-box,
.empty-link-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 12px;
  border-radius: 8px;
  background: rgba(18, 32, 54, 0.4);
  border: 1px dashed rgba(0, 225, 255, 0.2);
  gap: 6px;

  .empty-icon {
    font-size: 24px;
  }

  .empty-text {
    font-size: 13px;
    font-weight: 600;
    color: #e2efff;
    margin: 0;
  }

  .empty-sub {
    font-size: 11px;
    color: #94a3b8;
    margin: 0;
  }
}

.empty-link-box {
  padding: 16px 12px;
  font-size: 12px;
  color: #94a3b8;
}
</style>
