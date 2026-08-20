<template>
  <aside class="topo-panel topo-panel--left dark-theme">
    <div class="panel-header">
      <span class="header-icon">🔗</span>
      <span class="header-title">传输链路清单</span>
      <span class="count-tag">{{ linkItems.length }}</span>
    </div>

    <div v-if="!selectedNorad" class="empty-tip top-empty">
      请先在「整体态势分析」中选择一颗卫星，再查看其传输链路
    </div>

    <template v-else>
      <div class="sat-hint">
        <span>🛰️ {{ satelliteName }}</span>
        <span class="norad-tag">NORAD {{ selectedNorad }}</span>
      </div>

      <el-scrollbar class="link-scroll">
        <div
          v-for="item in linkItems"
          :key="item.id"
          class="link-card"
          :class="{ active: selectedLinkId === item.id, struck: item.struck, ok: !item.struck }"
          @click="handleSelect(item)"
        >
          <div class="link-card-top">
            <div class="link-path">
              <template v-for="(node, idx) in item.nodes" :key="`${item.id}-${idx}`">
                <span class="path-node" :class="`path-node--${node.layer}`">
                  <span class="path-icon">{{ node.icon }}</span>
                  <span class="path-name">{{ node.name }}</span>
                </span>
                <span v-if="idx < item.nodes.length - 1" class="path-arrow">→</span>
              </template>
            </div>
            <span class="status-badge" :class="item.struck ? 'struck' : 'ok'">
              {{ item.struck ? '被打击' : '正常' }}
            </span>
          </div>
          <div class="link-meta">
            <span class="meta-line meta-line--time">
              <span class="meta-key">传输</span>
              <span class="meta-val">{{ item.transmitTime }}</span>
            </span>
            <span v-if="item.struck" class="meta-line meta-line--strike-target">
              <span class="meta-key">打击</span>
              <span class="meta-val">{{ item.strikeTargetLabel }}</span>
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
        <div v-if="!linkItems.length" class="empty-tip">该卫星暂无传输链路</div>
      </el-scrollbar>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatrixResult } from '@/api/electronic'
import {
  collectSatelliteTransmissionLinks,
  getSatelliteDisplayInfo,
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
}

/** 左侧链路列表项 */
interface LinkListItem {
  /** 链路唯一标识 */
  id: string
  /** 路径节点序列 */
  nodes: LinkNodeItem[]
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

/** 当前卫星显示名称 */
const satelliteName = computed(() => {
  if (!props.selectedNorad) return '未选择'
  return getSatelliteDisplayInfo(props.matrixData, props.selectedNorad)?.name || `Sat-${props.selectedNorad}`
})

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
 * 将传输链路转换为列表项
 * @param link 原始链路数据
 * @returns 列表展示项
 */
const toLinkListItem = (link: SatelliteTransmissionLink): LinkListItem => ({
  id: link.id,
  nodes: link.nodes.map((n) => ({
    name: n.name,
    layer: mapNodeLayer(n.layer),
    icon: n.icon,
  })),
  transmitTime: link.transmitTime,
  struck: link.struck,
  strikeTargetLabel: link.strikeTargetLabel,
  weaponNames: link.weaponNames,
  delayMin: link.delayMin,
})

/** 当前卫星的全部传输链路（按过站时间升序） */
const linkItems = computed<LinkListItem[]>(() => {
  if (!props.matrixData || !props.selectedNorad) return []
  return collectSatelliteTransmissionLinks(props.matrixData, props.selectedNorad).map(toLinkListItem)
})

/**
 * 选择/取消选择链路
 * @param item 链路列表项
 */
const handleSelect = (item: LinkListItem) => {
  const nextId = props.selectedLinkId === item.id ? null : item.id
  emit('select-link', nextId)
}
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
    font-size: 14px;
    font-weight: 700;
    color: #40f2ff;
  }

  .count-tag {
    margin-left: auto;
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 10px;
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
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
  font-size: 12px;
  color: #bae6fd;

  .norad-tag {
    font-size: 10px;
    color: #94a3b8;
  }
}

.link-scroll {
  flex: 1;
  min-height: 0;
}

.link-card {
  padding: 10px 10px 10px 12px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    border-color: rgba(0, 225, 255, 0.35);
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
    background: rgba(0, 225, 255, 0.1);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.12);

    &.struck {
      border-color: rgba(148, 163, 184, 0.55);
      border-left-color: #94a3b8;
      background: rgba(148, 163, 184, 0.08);
      box-shadow: none;
    }
  }

  .link-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
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
    font-size: 12px;
    font-weight: 600;

    .path-icon {
      font-size: 11px;
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
  }

  .path-arrow {
    color: #475569;
    font-size: 11px;
    flex-shrink: 0;
  }

  .link-meta {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11px;
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
}

.status-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 700;

  &.ok {
    color: #00e1ff;
    background: rgba(0, 225, 255, 0.12);
    border: 1px solid rgba(0, 225, 255, 0.35);
  }

  &.struck {
    color: #cbd5e1;
    background: rgba(148, 163, 184, 0.15);
    border: 1px solid rgba(148, 163, 184, 0.35);
  }
}

.empty-tip {
  padding: 24px 8px;
  text-align: center;
  font-size: 12px;
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
