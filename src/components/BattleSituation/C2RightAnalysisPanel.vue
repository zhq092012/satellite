<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">推荐打击链路</span>
      </div>
      <button type="button" class="clear-link-btn" :disabled="!selectedTransmissionLinkId"
        @click.stop="handleClearSelectedLink">
        清除选择的链路
      </button>
    </div>

    <div v-if="!activeMatrix" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无矩阵数据</p>
      <p class="empty-sub">请在左侧选择任务以加载态势分析</p>
    </div>

    <template v-else>
      <div class="link-section">

        <div class="link-section-scroll">
          <div v-if="displayLinkItems.length" class="link-cards-list">
            <div v-for="item in displayLinkItems" :key="item.id" class="transmission-link-card" :class="[
              {
                active: selectedTransmissionLinkId === item.link.id,
                blocked: item.link.blocked,
              },
              item.priority ? `priority-rank-${item.priority.rank}` : '',
            ]" role="button" tabindex="0" @click="handleLinkCardClick(item.link)"
              @keydown.enter.prevent="handleLinkCardClick(item.link)">
              <div class="link-card-header">
                <div class="link-title-left">
                  <span class="link-index">链路 {{ item.displayIndex }}</span>
                  <span v-if="item.priority" class="rank-badge" :class="`rank-badge--${item.priority.rank}`">
                    {{ getRankMedal(item.priority.rank) }} TOP {{ item.priority.rank }}
                    ({{ item.priority.totalScore }}分)
                  </span>
                </div>
                <div class="link-metrics-row">
                  <div class="link-metric-card">
                    <span class="link-metric-label">{{ linkPrimaryMetricLabel(item.link) }}</span>
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
                <el-tooltip placement="left" :show-after="200" trigger="hover"
                  popper-class="c2-priority-reason-tooltip">
                  <template #content>
                    <div class="reason-tooltip-body">{{ item.priority.reason }}</div>
                  </template>
                  <span class="reason-text">{{ item.priority.reason }}</span>
                </el-tooltip>
              </div>

              <div v-if="item.link.blocked" class="link-blocked-tip">{{ item.link.blockedReason }}</div>

              <div class="link-meta-row">
                <span class="link-meta-label">传输时间</span>
                <strong class="link-meta-val">{{ item.link.transmitTime }}</strong>
              </div>
            </div>
          </div>

          <div v-else class="empty-link-box">
            {{ selectedSatelliteNorad != null ? '该卫星暂无推荐打击链路' : '当前范围内暂无推荐打击链路' }}
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧推荐传输链路面板
 * 集中展示经算法多维优先级评估推荐的 TOP 1~3 传输链路。
 */
import { computed } from 'vue'
import { type MatrixResult } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
import {
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  rankTransmissionLinksByPriority,
  resolveTaskEndMs,
  STARLINK_PRIORITY_WEIGHTS,
  type ChainNode,
  type LinkPriorityMetrics,
  type SatelliteTransmissionLink,
  type PrioritizedTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

/**
 * 右侧面板统一链路列表项：TOP 1~3 推荐链路。
 */
interface DisplayTransmissionLinkItem {
  id: string
  link: SatelliteTransmissionLink
  displayIndex: number
  priority: LinkPriorityMetrics | null
}

const store = useLayoutStore()

const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD（若有） */
  selectedSatelliteNorad?: number | null
  /** 当前在地图上高亮展示的传输链路 ID */
  selectedTransmissionLinkId?: string | null
}>()

const emit = defineEmits<{
  (e: 'clear-satellite-selection'): void
  /** 选中/取消选中传输链路（再次点击同一链路则取消） */
  (e: 'select-transmission-link', link: SatelliteTransmissionLink | null): void
}>()

/** 当前任务结束毫秒，用于过站分段延迟。 */
const taskEndMs = computed(() => resolveTaskEndMs(store.activedTask?.endDate))

/** 当前生效矩阵 */
const activeMatrix = computed<MatrixResult | null>(() => props.matrixData)

/** STARLINK 系列的链路首要指标使用打击前覆盖率。 */
const isStarlinkSeries = computed(() => store.selectedSatSeries === 'STARLINK')

/**
 * 判断链路源卫星是否属于 STARLINK（当前筛选为 STARLINK，或卫星名以 STARLINK 开头）。
 *
 * @param link 传输链路
 * @returns 是否按 STARLINK 展示打击前覆盖率
 */
const isStarlinkLink = (link: SatelliteTransmissionLink): boolean => {
  if (isStarlinkSeries.value) return true
  const sourceSatellite = link.nodes.find((node) => node.layer === 'SAT')
  return !!sourceSatellite?.name && sourceSatellite.name.toUpperCase().startsWith('STARLINK')
}

/**
 * 链路卡片右上角指标名称。
 *
 * @param link 传输链路
 * @returns STARLINK 为打击前覆盖率，其余为过站时间
 */
const linkPrimaryMetricLabel = (link: SatelliteTransmissionLink): string =>
  isStarlinkLink(link) ? '打击前覆盖率' : '过站时长'

/** 按 NORAD 编号索引的打击前卫星覆盖率（initMatrixList.coverage）。 */
const beforeCoverageByNorad = computed(() =>
  new Map(
    (activeMatrix.value?.initMatrixList || [])
      .filter((satellite) => Number.isFinite(satellite.coverage))
      .map((satellite) => [satellite.norad, satellite.coverage!])
  )
)

/** 将毫秒时长格式化为小时和分钟。 */
const formatElapsedTime = (durationMs: number): string => {
  if (!Number.isFinite(durationMs) || durationMs < 0) return '--'
  const totalMinutes = Math.floor(durationMs / 60000)
  return `${Math.floor(totalMinutes / 60)}时${totalMinutes % 60}分`
}

/** 格式化卫星覆盖率。 */
const formatCoverage = (coverage: number | undefined): string => {
  if (coverage == null || !Number.isFinite(coverage)) return '--'
  return `${Number(coverage.toFixed(2))}%`
}

/** 根据当前系列格式化链路卡片首个指标。 */
const formatPrimaryLinkMetric = (link: SatelliteTransmissionLink): string => {
  if (!isStarlinkLink(link)) {
    return formatElapsedTime(link.transmitEndMs - link.transmitStartMs)
  }
  const sourceSatellite = link.nodes.find((node) => node.layer === 'SAT')
  const norad = Number(sourceSatellite?.id)
  return formatCoverage(beforeCoverageByNorad.value.get(norad))
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
    return collectSatelliteTransmissionLinks(matrix, norad, taskEndMs.value)
  }

  return collectSeriesTransmissionLinks(matrix, taskEndMs.value)
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
 * 仅展示经算法多维评估推荐的 TOP 3 传输链路。
 */
const displayLinkItems = computed<DisplayTransmissionLinkItem[]>(() => {
  const top3 = prioritizedLinks.value.slice(0, 3)
  return top3.map((item, index) => ({
    id: item.link.id,
    link: item.link,
    displayIndex: index + 1,
    priority: item.priority,
  }))
})

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

/** 清除当前选中的传输链路（地图连线与卡片高亮一并取消）。 */
const handleClearSelectedLink = () => {
  if (!props.selectedTransmissionLinkId) return
  emit('select-transmission-link', null)
}
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

.link-section {
  display: flex;
  flex-direction: column;
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

.clear-link-btn {
  flex-shrink: 0;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(64, 242, 255, 0.35);
  background: rgba(8, 18, 32, 0.85);
  color: #7dd3fc;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: rgba(64, 242, 255, 0.55);
    background: rgba(64, 242, 255, 0.12);
    color: #e0faff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.link-section-scroll {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 3px;
  }

  .link-cards-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
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

    :deep(.el-tooltip__trigger) {
      flex: 1;
      min-width: 0;
      display: block;
    }

    .reason-text {
      text-align: left;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      cursor: help;
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

<style lang="scss">
.c2-priority-reason-tooltip {
  max-width: 360px !important;
  padding: 10px 12px !important;
  background: rgba(10, 18, 32, 0.96) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;

  .reason-tooltip-body {
    font-size: 12px;
    line-height: 1.65;
    color: #e2efff;
    text-align: left;
    white-space: normal;
    word-break: break-word;
  }
}
</style>
