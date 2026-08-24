<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">📊</span>
        <span class="header-title glow-text-cyan">态势统计分析</span>
      </div>
      <span class="panel-badge">{{ overviewStats.scopeLabel }}</span>
    </div>

    <div class="panel-body-scroll">
      <div v-if="!activeMatrix" class="empty-sat-box">
        <span class="empty-icon">📡</span>
        <p class="empty-text">暂无矩阵数据</p>
        <p class="empty-sub">请在左侧选择系列，或选择「全部系列」加载态势</p>
      </div>

      <template v-else>
        <div class="scope-banner">
          <span class="scope-label">统计范围</span>
          <strong class="scope-value">{{ overviewStats.scopeLabel }}</strong>
        </div>

        <div class="stats-strip">
          <div class="stats-strip-item stats-strip-item--sat">
            <strong class="stats-strip-value">{{ overviewStats.satelliteCount }}</strong>
            <span class="stats-strip-label">卫星</span>
            <span class="stats-strip-unit">颗</span>
          </div>
          <div class="stats-strip-divider"></div>
          <div class="stats-strip-item stats-strip-item--receive">
            <strong class="stats-strip-value">{{ overviewStats.receiveCount }}</strong>
            <span class="stats-strip-label">地面站</span>
            <span class="stats-strip-unit">个</span>
          </div>
          <div class="stats-strip-divider"></div>
          <div class="stats-strip-item stats-strip-item--station">
            <strong class="stats-strip-value">{{ overviewStats.stationCount }}</strong>
            <span class="stats-strip-label">数据中心</span>
            <span class="stats-strip-unit">个</span>
          </div>
          <div class="stats-strip-divider"></div>
          <div class="stats-strip-item stats-strip-item--weapon">
            <strong class="stats-strip-value">{{ ourWeaponCount }}</strong>
            <span class="stats-strip-label">我方武器</span>
            <span class="stats-strip-unit">件</span>
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

          <div v-if="transmissionLinks.length" class="transmission-link-list">
            <div
              v-for="(link, idx) in transmissionLinks"
              :key="link.id"
              class="transmission-link-card"
              :class="{
                active: selectedTransmissionLinkId === link.id,
                blocked: link.blocked,
              }"
              role="button"
              tabindex="0"
              @click="handleLinkCardClick(link)"
              @keydown.enter.prevent="handleLinkCardClick(link)"
            >
              <div class="link-card-header">
                <span class="link-index">链路 {{ idx + 1 }}</span>
              </div>

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
            {{ selectedSatelliteNorad != null ? '该卫星暂无关联传输链路' : '当前范围内暂无可枚举链路' }}
          </div>
        </div>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧统计面板
 * 上方展示卫星/地面站/数据中心/我方武器统计，下方列出全部可能传输链路。
 */
import { computed, onMounted, ref } from 'vue'
import { type MatrixResult } from '@/api/electronic'
import { getAllWeapons } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import {
  collectMatrixOverviewStats,
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  type ChainNode,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

const store = useLayoutStore()

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

.panel-body-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 8px;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.28);
    border-radius: 4px;
  }
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
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
  gap: 2px;
  min-width: 0;
  padding: 4px 2px;

  .stats-strip-value {
    font-size: 22px;
    line-height: 1;
    color: #f8fafc;
  }

  .stats-strip-label {
    font-size: 11px;
    color: #94a3b8;
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
  min-height: 0;
}

.link-section-header {
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

.transmission-link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

    .link-index {
      font-size: 11px;
      font-weight: 700;
      color: #7dd3fc;
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
  min-width: 56px;
  max-width: 88px;
  padding: 4px;

  .flow-node-icon {
    font-size: 14px;
  }

  .flow-node-name {
    font-size: 10px;
    font-weight: 600;
    color: #e2efff;
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
