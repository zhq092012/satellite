<template>
  <aside class="topo-panel topo-panel--left dark-theme">
    <div class="panel-header">
      <span class="header-icon">🔗</span>
      <span class="header-title">传输链路清单</span>
      <span class="count-tag">{{ filteredLinkItems.length }}</span>
    </div>

    <!-- 搜索筛选框 -->
    <div class="sidebar-search-box">
      <el-input v-model="searchKeyword" placeholder="搜索卫星/接收站/武器..." size="small" clearable>
        <template #prefix>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-search">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </template>
      </el-input>
    </div>

    <div v-if="!matrixData" class="empty-tip top-empty">
      暂无矩阵数据，请先选择任务与卫星系列
    </div>

    <div v-else-if="!linkItems.length && selectedNorad" class="empty-tip top-empty">
      该卫星暂无传输链路
    </div>

    <div v-else-if="!linkItems.length" class="empty-tip top-empty">
      该系列暂无传输链路
    </div>

    <div v-else-if="!filteredLinkItems.length" class="empty-tip top-empty">
      未搜索到匹配的传输链路
    </div>

    <template v-else>
      <div v-if="selectedNorad" class="sat-hint">
        <span class="norad-tag">NORAD {{ selectedNorad }}</span>
      </div>

      <el-scrollbar class="link-scroll">
        <div v-for="item in filteredLinkItems" :key="item.id" :ref="(el) => setLinkCardRef(item.id, el as HTMLElement | null)"
          class="link-card" :class="[
            { active: selectedLinkId === item.id, struck: item.struck, ok: !item.struck },
            item.rank ? `rank-card--${item.rank}` : ''
          ]" @click="handleSelect(item)">
          <div class="link-card-top">
            <div class="link-path">
              <template v-for="(node, idx) in item.nodes" :key="`${item.id}-${idx}`">
                <span class="path-node" :class="[`path-node--${node.layer}`, { 'path-node--struck': node.struck }]">
                  <span class="path-icon">{{ node.icon }}</span>
                  <span class="path-name">{{ node.name }}</span>
                </span>
                <span v-if="idx < item.nodes.length - 1" class="path-arrow">→</span>
              </template>
            </div>
            <div class="link-card-badges">
              <span v-if="item.rank && item.rank <= 3" class="rank-mini-tag" :class="`rank-mini-tag--${item.rank}`">
                {{ getRankMedal(item.rank) }} TOP {{ item.rank }}
              </span>
              <span class="status-badge" :class="item.struck ? 'struck' : 'ok'">
                {{ item.interferenceStatus }}
              </span>
            </div>
          </div>

          <div class="link-meta">
            <div class="meta-row-two-col">
              <span class="meta-line meta-line--time">
                <span class="meta-key">传输</span>
                <span class="meta-val">{{ item.transmitTime }}</span>
              </span>
              <span v-if="item.totalScore != null" class="score-mini-pill" title="基于威胁度、时效、孤立度与中继计算的优先级得分">
                评分 {{ item.totalScore }}分
              </span>
            </div>
            <span v-if="item.struck" class="meta-line meta-line--strike-target">
              <span class="meta-key">打击</span>
              <span class="meta-val">{{ item.struckDetailText }}</span>
            </span>
            <span v-if="item.weaponNames" class="meta-line meta-line--weapon">
              <span class="meta-key">武器</span>
              <span class="meta-val">{{ item.weaponNames }}</span>
            </span>
            <span v-if="item.delayMin > 0" class="meta-line meta-line--delay">
              <span class="meta-key">延迟</span>
              <span class="meta-val">+{{ item.delayMin }} 分钟</span>
            </span>
          </div>
        </div>
      </el-scrollbar>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { MatrixResult } from '@/api/electronic'
import {
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  rankTransmissionLinksByPriority,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

/** 链路节点展示项 */
interface LinkNodeItem {
  /** 节点名称 */
  name: string
  /** 节点层级（用于颜色区分） */
  layer: 'sat' | 'relay' | 'receive' | 'station'
  /** 节点图标 */
  icon: string
  /** 节点是否被打击/干扰 */
  struck: boolean
}

/** 左侧链路列表项 */
interface LinkListItem {
  /** 链路唯一标识 */
  id: string
  /** 路径节点序列 */
  nodes: LinkNodeItem[]
  /** 干扰状态标签（星扰 / 站扰 / 双扰 / 正常） */
  interferenceStatus: string
  /** 详细打击描述 */
  struckDetailText: string
  /** 传输时间区间 */
  transmitTime: string
  /** 是否被打击 */
  struck: boolean
  /** 打击目标描述 */
  strikeTargetLabel: string
  /** 武器名称 */
  weaponNames: string
  /** 延迟分钟数 */
  delayMin: number
  /** 优先级名次 */
  rank?: number
  /** 优先级评分 */
  totalScore?: number
}

const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD */
  selectedNorad?: number | null
  /** 当前选中的链路 ID */
  selectedLinkId?: string | null
}>()

const emit = defineEmits<{
  (e: 'select-link', linkId: string | null): void
}>()

/** 搜索过滤关键词 */
const searchKeyword = ref<string>('')

const getRankMedal = (rank: number): string => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return ''
}

/**
 * 将链路节点层级映射为样式类名
 * @param layer 原始层级标识
 * @returns 样式类名
 */
const mapNodeLayer = (layer: string): LinkNodeItem['layer'] => {
  if (layer === 'RELAY') return 'relay'
  if (layer === 'RECEIVE') return 'receive'
  if (layer === 'STATION') return 'station'
  return 'sat'
}

/**
 * 计算链路干扰状态标签（星扰 / 站扰 / 双扰 / 正常）
 */
const getLinkInterferenceStatus = (link: SatelliteTransmissionLink): string => {
  const satOrRelayStruck = !!link.satelliteStruck || !!link.relayStruck
  const recStruck = !!link.receiveStruck
  if (satOrRelayStruck && recStruck) return '双扰'
  if (satOrRelayStruck) return '星扰'
  if (recStruck) return '站扰'
  return '正常'
}

/** 当前展示的全部传输链路（单星或全系列，按优先级评分降序排列 TOP 1 ~ N） */
const linkItems = computed<LinkListItem[]>(() => {
  if (!props.matrixData) return []
  const rawLinks = props.selectedNorad
    ? collectSatelliteTransmissionLinks(props.matrixData, props.selectedNorad)
    : collectSeriesTransmissionLinks(props.matrixData)

  const ranked = rankTransmissionLinksByPriority(props.matrixData, rawLinks)

  return ranked.map((r) => {
    const link = r.link
    const priority = r.priority

    const nodes: LinkNodeItem[] = link.nodes.map((n) => {
      let isStruck = false
      if (n.layer === 'SAT') isStruck = !!link.satelliteStruck
      else if (n.layer === 'RELAY') isStruck = !!link.relayStruck
      else if (n.layer === 'RECEIVE') isStruck = !!link.receiveStruck
      return {
        name: n.name,
        layer: mapNodeLayer(n.layer),
        icon: n.icon,
        struck: isStruck,
      }
    })

    const interferenceStatus = getLinkInterferenceStatus(link)
    const struckNodeNames = nodes.filter((n) => n.struck).map((n) => n.name).join('、')
    const struckDetailText = struckNodeNames
      ? `${interferenceStatus}（${struckNodeNames}）`
      : '全链路正常'

    return {
      id: link.id,
      nodes,
      interferenceStatus,
      struckDetailText,
      transmitTime: link.transmitTime,
      struck: link.struck,
      strikeTargetLabel: link.strikeTargetLabel,
      weaponNames: link.weaponNames,
      delayMin: link.delayMin,
      rank: priority.rank,
      totalScore: priority.totalScore,
    }
  })
})

/** 过滤后的传输链路列表（支持根据节点名、武器名、干扰状态、传输时间多维度检索） */
const filteredLinkItems = computed<LinkListItem[]>(() => {
  const list = linkItems.value
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return list

  return list.filter((item) => {
    // 匹配节点名称（卫星、中继、接收站、数据中心）
    const matchNode = item.nodes.some((node) => node.name.toLowerCase().includes(kw))
    // 匹配武器名称
    const matchWeapon = !!item.weaponNames && item.weaponNames.toLowerCase().includes(kw)
    // 匹配干扰/打击状态描述
    const matchStatus =
      item.interferenceStatus.toLowerCase().includes(kw) ||
      (!!item.struckDetailText && item.struckDetailText.toLowerCase().includes(kw))
    // 匹配传输时间
    const matchTime = !!item.transmitTime && item.transmitTime.toLowerCase().includes(kw)
    // 匹配打击目标
    const matchTarget = !!item.strikeTargetLabel && item.strikeTargetLabel.toLowerCase().includes(kw)

    return matchNode || matchWeapon || matchStatus || matchTime || matchTarget
  })
})

/**
 * 选择/取消选择链路
 * @param item 链路列表项
 */
const handleSelect = (item: LinkListItem) => {
  const nextId = props.selectedLinkId === item.id ? null : item.id
  emit('select-link', nextId)
}

/** 链路卡片 DOM 引用，用于选中后滚动定位 */
const linkCardRefs = new Map<string, HTMLElement>()

/**
 * 记录链路卡片 DOM 引用
 * @param linkId 链路 ID
 * @param el 卡片元素
 */
const setLinkCardRef = (linkId: string, el: HTMLElement | null) => {
  if (el) linkCardRefs.set(linkId, el)
  else linkCardRefs.delete(linkId)
}

/** 选中链路时自动滚动到可视区域 */
watch(
  () => props.selectedLinkId,
  (linkId) => {
    if (!linkId) return
    nextTick(() => {
      linkCardRefs.get(linkId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }
)
</script>

<style lang="scss" scoped>
.topo-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 10px;
  color: #e2efff;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  margin-bottom: 10px;

  .header-title {
    font-size: 15px;
    font-weight: 700;
    color: #40f2ff;
  }

  .count-tag {
    font-size: 12px;
    padding: 1px 8px;
    border-radius: 10px;
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
  }
}

.sidebar-search-box {
  margin-bottom: 10px;
  flex-shrink: 0;

  :deep(.el-input__wrapper) {
    background-color: #1e293b;
    box-shadow: 0 0 0 1px #334155 inset;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      box-shadow: 0 0 0 1px #475569 inset;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #00e1ff inset, 0 0 8px rgba(0, 225, 255, 0.25) !important;
    }

    .el-input__inner {
      color: #f8fafc;
      font-size: 12px;

      &::placeholder {
        color: #64748b;
      }
    }

    .el-input__prefix {
      color: #64748b;
      display: flex;
      align-items: center;
    }
  }
}

.sat-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  margin-bottom: 8px;
  border-radius: 6px;
  background: rgba(0, 225, 255, 0.08);
  border: 1px solid rgba(0, 225, 255, 0.2);
  font-size: 13px;
  color: #bae6fd;

  .norad-tag {
    font-size: 11px;
    color: #94a3b8;
  }
}

.link-scroll {
  flex: 1;
  min-height: 0;

  :deep(.el-scrollbar__bar.is-vertical) {
    right: 0;
    width: 6px;
  }

  :deep(.el-scrollbar__thumb) {
    background: rgba(0, 225, 255, 0.28);
    border-radius: 4px;
  }

  :deep(.el-scrollbar__view) {
    padding: 0 10px 4px 0;
    box-sizing: border-box;
  }
}

.link-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: 10px 10px 10px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  text-align: left;
  overflow: hidden;

  &:hover {
    border-color: rgba(0, 225, 255, 0.35);
    background: rgba(22, 42, 70, 0.9);
  }

  &.ok {
    border-left-color: #00e1ff;
  }

  &.struck {
    border-left-color: #94a3b8;
    background: rgba(30, 35, 45, 0.75);
  }

  &.active {
    border-color: #00e1ff;
    border-left-color: #00e1ff;
    background: linear-gradient(135deg, rgba(0, 225, 255, 0.22) 0%, rgba(12, 28, 48, 0.95) 55%);
    box-shadow:
      inset 0 0 0 1px rgba(0, 225, 255, 0.45),
      inset 0 0 20px rgba(0, 225, 255, 0.1);

    &.struck {
      border-color: #38bdf8;
      border-left-color: #f87171;
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(36, 20, 28, 0.92) 55%);
      box-shadow:
        inset 0 0 0 1px rgba(56, 189, 248, 0.55),
        inset 0 0 18px rgba(56, 189, 248, 0.1);
    }

    .path-arrow {
      color: #7dd3fc;
    }
  }

  .link-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .link-card-badges {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .link-path {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 4px;
    line-height: 1.5;
  }

  .path-node {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 13px;
    font-weight: 600;
    padding: 1px 4px;
    border-radius: 3px;
    transition: all 0.2s ease;

    .path-icon {
      font-size: 12px;
      flex-shrink: 0;
    }

    .path-name {
      word-break: break-all;
    }

    &--sat .path-name {
      color: #67e8f9;
    }

    &--relay .path-name {
      color: #c4b5fd;
    }

    &--receive .path-name {
      color: #5eead4;
    }

    &--station .path-name {
      color: #93c5fd;
    }

    &--struck {
      background: rgba(239, 68, 68, 0.22);
      border: 1px solid rgba(248, 113, 113, 0.6);
      box-shadow: 0 0 8px rgba(239, 68, 68, 0.35);

      .path-name {
        color: #f87171 !important;
        font-weight: 800;
        text-shadow: 0 0 6px rgba(239, 68, 68, 0.6);
      }
    }
  }

  .path-arrow {
    color: #475569;
    font-size: 12px;
    flex-shrink: 0;
  }

  .link-meta {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-row-two-col {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;

    .meta-line--time {
      flex: 1;
      min-width: 0;
    }

    .score-mini-pill {
      font-size: 11px;
      font-weight: 700;
      color: #40f2ff;
      background: rgba(0, 225, 255, 0.12);
      border: 1px solid rgba(0, 225, 255, 0.25);
      padding: 0 5px;
      border-radius: 3px;
      white-space: nowrap;
    }
  }

  .meta-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12px;
    line-height: 1.45;

    .meta-key {
      flex-shrink: 0;
      width: 32px;
      color: #64748b;
    }

    .meta-val {
      flex: 1;
      color: #cbd5e1;
      word-break: break-all;
    }

    &--time .meta-val {
      color: #94a3b8;
    }

    &--weapon .meta-val {
      color: #fdba74;
    }

    &--strike-target .meta-val {
      color: #fca5a5;
      font-weight: 600;
    }

    &--delay .meta-val {
      color: #94a3b8;
      font-style: italic;
    }
  }

  &.rank-card--1 {
    border-left-color: #eab308;

    &.active {
      border-color: #facc15;
      box-shadow: 0 0 12px rgba(234, 179, 8, 0.3);
    }
  }

  &.rank-card--2 {
    border-left-color: #38bdf8;

    &.active {
      border-color: #38bdf8;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
    }
  }

  &.rank-card--3 {
    border-left-color: #fb923c;

    &.active {
      border-color: #fb923c;
      box-shadow: 0 0 12px rgba(251, 146, 60, 0.3);
    }
  }
}

.rank-mini-tag {
  font-size: 10px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.3px;

  &--1 {
    background: rgba(234, 179, 8, 0.22);
    color: #fef08a;
    border: 1px solid rgba(234, 179, 8, 0.5);
  }

  &--2 {
    background: rgba(56, 189, 248, 0.22);
    color: #bae6fd;
    border: 1px solid rgba(56, 189, 248, 0.5);
  }

  &--3 {
    background: rgba(249, 115, 22, 0.22);
    color: #fed7aa;
    border: 1px solid rgba(249, 115, 22, 0.5);
  }
}


.status-badge {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;
  max-width: 100%;
  white-space: nowrap;

  &.ok {
    color: #00e1ff;
    background: rgba(0, 225, 255, 0.12);
    border: 1px solid rgba(0, 225, 255, 0.35);
  }

  &.struck {
    color: #fecaca;
    background: rgba(239, 68, 68, 0.18);
    border: 1px solid rgba(248, 113, 113, 0.45);
    text-shadow: 0 0 6px rgba(239, 68, 68, 0.35);
  }
}

.selected-indicator {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
  color: #0f172a;
  background: linear-gradient(135deg, #22d3ee, #38bdf8);
  border: 1px solid #67e8f9;
  box-shadow: inset 0 0 6px rgba(255, 255, 255, 0.25);
}

.empty-tip {
  padding: 24px 8px;
  text-align: center;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;

  &.top-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
