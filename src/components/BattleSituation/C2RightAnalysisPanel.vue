<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">打击链路列表</span>
        <span class="link-count-badge" v-if="displayLinkItems.length">
          共 {{ displayLinkItems.length }} 条
        </span>
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
            <div v-for="(link, index) in displayLinkItems" :key="link.id" class="transmission-link-card" :class="[
              {
                active: selectedTransmissionLinkId === link.id,
                blocked: link.blocked,
              },
            ]" role="button" tabindex="0" @click="handleLinkCardClick(link)"
              @keydown.enter.prevent="handleLinkCardClick(link)">
              <!-- 顶部行：左侧为链路序号/名称，右侧平铺展示 威胁度 / 链路时长 / 覆盖率 三大指标 -->
              <div class="link-card-header">
                <div class="link-title-left">
                  <span class="link-index">链路 {{ index + 1 }}</span>
                </div>

                <div class="link-metrics-right">
                  <span class="metric-tag metric-tag--threat" title="卫星威胁度">
                    <span class="metric-icon">🛡️</span>
                    <span class="metric-label">威胁度:</span>
                    <span class="metric-val">{{ getLinkThreatText(link) }}</span>
                  </span>
                  <span class="metric-tag metric-tag--duration" title="链路传输时长">
                    <span class="metric-icon">⏱️</span>
                    <span class="metric-label">时长:</span>
                    <span class="metric-val">{{ getLinkDurationText(link) }}</span>
                  </span>
                  <span class="metric-tag metric-tag--coverage" title="卫星覆盖率">
                    <span class="metric-icon">🌐</span>
                    <span class="metric-label">覆盖率:</span>
                    <span class="metric-val">{{ getLinkCoverageText(link) }}</span>
                  </span>
                </div>
              </div>

              <!-- 链路节点传输链路流 -->
              <div class="link-flow-row">
                <template v-for="(node, nodeIdx) in link.nodes" :key="link.id + '-' + node.layer + node.id">
                  <div class="flow-node">
                    <span class="flow-node-icon">{{ node.icon }}</span>
                    <span class="flow-node-name" :title="node.name">{{ node.name }}</span>
                    <span class="flow-node-layer">{{ chainLayerLabel(node.layer) }}</span>
                  </div>
                  <span v-if="nodeIdx < link.nodes.length - 1" class="flow-arrow">→</span>
                </template>
              </div>

              <div v-if="link.blocked" class="link-blocked-tip">{{ link.blockedReason }}</div>

              <div class="link-meta-row">
                <span class="link-meta-label">传输时间</span>
                <strong class="link-meta-val">{{ link.transmitTime }}</strong>
              </div>
            </div>
          </div>

          <div v-else class="empty-link-box">
            {{ selectedSatelliteNorad != null ? '该卫星暂无可用打击链路' : '当前范围内暂无可用打击链路' }}
          </div>
        </div>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧传输链路面板
 * 展示满足筛选条件的所有传输链路，并在卡片名称右侧呈现 威胁度、链路时长、覆盖率 三大指标。
 */
import { computed } from 'vue'
import { type MatrixResult } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
import {
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  resolveTaskEndMs,
  parseTimeToMs,
  type ChainNode,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

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

/** 展示全部传输链路（无 top 截断） */
const displayLinkItems = computed<SatelliteTransmissionLink[]>(() => {
  return transmissionLinks.value
})

/** NORAD -> 威胁度映射 */
const threatMap = computed(() => {
  const map = new Map<number, number>()
    ; (activeMatrix.value?.threatSats || []).forEach((item) => {
      const raw = Number(item.threatScore)
      if (Number.isFinite(raw)) {
        map.set(item.norad, raw <= 1 ? raw * 100 : raw)
      }
    })
  return map
})

/** NORAD -> 覆盖率映射 */
const coverageMap = computed(() => {
  const map = new Map<number, number>()
  const matrix = activeMatrix.value
  if (!matrix) return map

    ; (matrix.initMatrixList || []).forEach((item) => {
      if (Number.isFinite(item.coverage)) {
        map.set(item.norad, item.coverage!)
      }
    })
    ; (matrix.satelliteMatrixList || []).forEach((item) => {
      if (Number.isFinite(item.coverage) && !map.has(item.norad)) {
        map.set(item.norad, item.coverage!)
      }
    })
  return map
})

/** 获取源卫星 NORAD */
const getLinkSourceNorad = (link: SatelliteTransmissionLink): number | null => {
  const satNode = link.nodes.find((node) => node.layer === 'SAT')
  return satNode ? Number(satNode.id) : null
}

/** 威胁度展示文本 */
const getLinkThreatText = (link: SatelliteTransmissionLink): string => {
  const norad = getLinkSourceNorad(link)
  if (norad == null) return '--'
  const val = threatMap.value.get(norad)
  if (val == null || !Number.isFinite(val)) return '--'
  return `${Math.round(val)}分`
}

/** 链路时长展示文本 */
const getLinkDurationText = (link: SatelliteTransmissionLink): string => {
  let durationMs = link.transmitEndMs - link.transmitStartMs
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    if (link.transmitTime && link.transmitTime.includes('~')) {
      const parts = link.transmitTime.split('~')
      const start = parseTimeToMs(parts[0]?.trim())
      const end = parseTimeToMs(parts[1]?.trim())
      if (end > start) durationMs = end - start
    }
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '--'

  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}时${minutes}分`
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`
  }
  return `${seconds}秒`
}

/** 覆盖率展示文本 */
const getLinkCoverageText = (link: SatelliteTransmissionLink): string => {
  const norad = getLinkSourceNorad(link)
  if (norad == null) return '--'
  const val = coverageMap.value.get(norad)
  if (val == null || !Number.isFinite(val)) return '--'
  return `${Number(val.toFixed(1))}%`
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
    gap: 8px;
  }

  .header-title {
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .link-count-badge {
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.12);
    color: #5ce1e6;
    border: 1px solid rgba(0, 225, 255, 0.3);
  }
}

.clear-link-btn {
  flex-shrink: 0;
  height: 24px;
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

.link-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
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
    border-color: rgba(0, 225, 255, 0.38);
    background: rgba(18, 32, 54, 0.88);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  &.active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.1);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.25);
  }

  &.blocked {
    border-style: dashed;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .link-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;

    .link-title-left {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .link-index {
      font-size: 13px;
      flex-shrink: 0;
      font-weight: 700;
      color: #40f2ff;
      text-shadow: 0 0 6px rgba(64, 242, 255, 0.3);
    }

    .link-metrics-right {
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
      justify-content: flex-end;

      .metric-tag {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 14px;
        line-height: 1.3;
        font-weight: 700;

        .metric-icon {
          font-size: 10px;
        }

        .metric-label {
          opacity: 0.75;
        }

        .metric-val {
          font-family: Consolas, monospace;

        }

        &--threat {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #f87171;

          .metric-val {
            color: #fca5a5;
          }
        }

        &--duration {
          background: rgba(0, 225, 255, 0.12);
          border: 1px solid rgba(0, 225, 255, 0.35);
          color: #38bdf8;

          .metric-val {
            color: #7dd3fc;
          }
        }

        &--coverage {
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: #fbbf24;

          .metric-val {
            color: #fde68a;
          }
        }
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
    color: #f87171;
    padding: 4px 8px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
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
      font-family: Consolas, monospace;
      text-align: right;
      line-height: 1.4;
    }
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
