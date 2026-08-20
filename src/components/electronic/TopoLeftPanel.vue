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
          :class="{ active: selectedLinkId === item.id, struck: item.struck }"
          @click="handleSelect(item)"
        >
          <div class="link-card-top">
            <span class="link-path">{{ item.pathText }}</span>
            <span class="status-badge" :class="item.struck ? 'struck' : 'ok'">
              {{ item.struck ? '被打击' : '正常' }}
            </span>
          </div>
          <div class="link-time">{{ item.transmitTime }}</div>
          <div v-if="item.weaponNames" class="link-weapon">武器：{{ item.weaponNames }}</div>
          <div v-if="item.delayMin > 0" class="link-delay">延迟 +{{ item.delayMin }} 分钟</div>
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

/** 左侧链路列表项 */
interface LinkListItem {
  /** 链路唯一标识 */
  id: string
  /** 路径展示文本 */
  pathText: string
  /** 传输时间区间 */
  transmitTime: string
  /** 是否被打击 */
  struck: boolean
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
 * 将传输链路转换为列表项
 * @param link 原始链路数据
 * @returns 列表展示项
 */
const toLinkListItem = (link: SatelliteTransmissionLink): LinkListItem => ({
  id: link.id,
  pathText: link.nodes.map((n) => n.name).join(' → '),
  transmitTime: link.transmitTime,
  struck: link.struck,
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
  padding: 8px 10px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.35);
  }

  &.active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.12);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.15);
  }

  &.struck {
    border-color: rgba(148, 163, 184, 0.35);
  }

  .link-card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }

  .link-path {
    font-size: 12px;
    font-weight: 600;
    color: #fff;
    line-height: 1.4;
    word-break: break-all;
  }

  .link-time {
    margin-top: 4px;
    font-size: 11px;
    color: #94a3b8;
  }

  .link-weapon,
  .link-delay {
    margin-top: 2px;
    font-size: 10px;
    color: #64748b;
  }
}

.status-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 700;

  &.ok {
    color: #67e8f9;
    background: rgba(0, 225, 255, 0.12);
  }

  &.struck {
    color: #cbd5e1;
    background: rgba(148, 163, 184, 0.18);
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
