<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">🏢</span>
        <span class="header-title glow-text-cyan">敌方地面接收站与数据中心</span>
      </div>
      <span class="panel-badge badge-blue">{{ selectedSatInfo ? selectedSatInfo.name : '正常传输分析' }}</span>
    </div>

    <!-- 全面板纵向滚动容器 -->
    <el-scrollbar ref="panelScrollRef" class="panel-body-scroll">
      <!-- 1. 选中卫星全链路分析（点击后置顶展示） -->
      <div class="panel-section panel-section--sat-analysis" v-if="selectedSatelliteNorad">
        <div class="section-title title-highlight">
          <span>
            <span class="title-icon">🛰️</span>
            <span>选中卫星链路分析</span>
          </span>
          <button class="close-node-btn" @click="emit('clear-satellite-selection')">清除</button>
        </div>

        <div v-if="selectedSatInfo" class="sat-analysis-box">
          <div class="sat-header-row">
            <div class="sat-title-group">
              <span class="sat-name-large">{{ selectedSatInfo.name }}</span>
              <span class="sat-type-tag">{{ selectedSatInfo.satType }}</span>
            </div>
            <span class="norad-tag">NORAD {{ selectedSatelliteNorad }}</span>
          </div>

          <!-- 全部传输链路 -->
          <div class="chain-block">
            <div class="chain-block-title">
              传输链路列表
              <span class="weapon-count-tag">{{ transmissionLinks.length }} 条</span>
            </div>
            <div v-if="transmissionLinks.length" class="transmission-link-list">
              <div
                v-for="(link, idx) in transmissionLinks"
                :key="link.id"
                class="transmission-link-card"
                :class="{ struck: link.struck, blocked: link.blocked }"
              >
                <div class="link-card-header">
                  <span class="link-index">链路 {{ idx + 1 }}</span>
                  <span class="link-receive">{{ link.receiveName }}</span>
                </div>
                <div class="link-flow-card compact">
                  <template v-for="(node, nodeIdx) in link.nodes" :key="link.id + '-' + node.layer + node.id">
                    <div class="flow-step">
                      <span class="step-icon">{{ node.icon }}</span>
                      <span class="step-text" :title="node.name">{{ node.name }}</span>
                      <span class="step-sub">{{ chainLayerLabel(node.layer) }}</span>
                    </div>
                    <span v-if="nodeIdx < link.nodes.length - 1" class="flow-arrow">→</span>
                  </template>
                </div>
                <div v-if="link.blocked" class="chain-blocked-tip">{{ link.blockedReason }}</div>
                <div class="link-meta-grid">
                  <div class="link-meta-item">
                    <span class="meta-label">传输时间</span>
                    <strong class="meta-val glow-cyan">{{ link.transmitTime }}</strong>
                  </div>
                  <div class="link-meta-item">
                    <span class="meta-label">完成时间</span>
                    <strong class="meta-val">{{ link.finishTime }}</strong>
                  </div>
                  <div class="link-meta-item">
                    <span class="meta-label">打击武器</span>
                    <strong class="meta-val">
                      {{ link.weaponNames }}
                      <span v-if="link.weaponType" class="weapon-type-tag">{{ link.weaponType }}</span>
                    </strong>
                  </div>
                  <div class="link-meta-item">
                    <span class="meta-label">造成延迟</span>
                    <strong class="meta-val" :class="link.delayMin > 0 || link.struck ? 'glow-red' : 'glow-green'">
                      {{ link.delayText }}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="chain-blocked-tip muted">暂无传输链路数据</div>
          </div>
        </div>

        <div v-else class="empty-sat-box">
          <span class="empty-icon">🛰️</span>
          <p class="empty-text">当前系列下未找到该卫星数据</p>
        </div>
      </div>

      <!-- 2. 敌方地面接收站 -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">📡</span>
          <span>地面接收站</span>
          <span class="count-tag">{{ receiveStations.length }} 个</span>
          <span v-if="selectedReceiveName" class="current-asset" :title="selectedReceiveName">
            当前选择：{{ selectedReceiveName }}
          </span>
        </div>
        <div class="asset-scroll-list">
          <div v-for="node in receiveStations" :key="'rec-' + node.id" class="asset-card" :class="{
            active: isGroundNodeSelected(node),
            struck: node.status === 1,
          }" @click="handleSelectGroundNode(node)">
            <div class="card-top">
              <span class="asset-name">📡 <strong>{{ node.name }}</strong></span>
              <span class="metric-highlight" :class="node.status === 1 ? 'status-struck' : 'status-ok'">
                {{ node.status === 1 ? '被打击' : '可用' }}
              </span>
            </div>
            <div class="card-line" v-if="node.usage">用途 {{ node.usage }}</div>
            <div class="card-line">位置 {{ formatLatLon(node.latitude, node.longitude) }}</div>
          </div>
        </div>
      </div>

      <!-- 3. 敌方数据中心 -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">💻</span>
          <span>数据中心</span>
          <span class="count-tag">{{ dataCenters.length }} 个</span>
          <span v-if="selectedDataCenterName" class="current-asset" :title="selectedDataCenterName">
            当前选择：{{ selectedDataCenterName }}
          </span>
        </div>
        <div class="asset-scroll-list">
          <div v-for="node in dataCenters" :key="'st-' + node.id" class="asset-card" :class="{
            active: isGroundNodeSelected(node),
            struck: node.status === 1,
          }" @click="handleSelectGroundNode(node)">
            <div class="card-top">
              <span class="asset-name">💻 <strong>{{ node.name }}</strong></span>
              <span class="metric-highlight" :class="node.status === 1 ? 'status-struck' : 'status-ok'">
                {{ node.status === 1 ? '被打击' : '可用' }}
              </span>
            </div>
            <div class="card-line">位置 {{ formatLatLon(node.latitude, node.longitude) }}</div>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup lang="ts">
/**
 * [功能]
 * 战场态势 - C2 右侧数据传输与链路效能分析面板
 *
 * [处理规则]
 * - 重点展示敌方传输链路 (敌方卫星 -> 中继/接收站 -> 数据中心)
 * - 展现过境时间窗口、传输延时、最短用时、资产统计与资产详情
 * - 不包含任何攻击/毁伤/打压战果内容
 */
import { computed, ref, watch, nextTick } from 'vue'
import { type MatrixResult } from '@/api/electronic'
import type { InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'
import { useLayoutStore } from '@/store/modules/layout'
import {
  collectSatelliteTransmissionLinks,
  getSatelliteDisplayInfo,
  type ChainNode,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

const store = useLayoutStore()
const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD */
  selectedSatelliteNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'clear-satellite-selection'): void
}>()

const panelScrollRef = ref<{ setScrollTop: (value: number) => void } | null>(null)

watch(
  () => props.selectedSatelliteNorad,
  (norad) => {
    if (!norad) return
    nextTick(() => {
      panelScrollRef.value?.setScrollTop(0)
    })
  }
)


/**
 * 算法矩阵数据
 */
const activeMatrix = computed<MatrixResult | null>(() => props.matrixData)
/**
 * 选中卫星的显示信息 (名称、类型、NORAD)
 */
const selectedSatInfo = computed(() => {
  if (!props.selectedSatelliteNorad) return null
  return getSatelliteDisplayInfo(activeMatrix.value, props.selectedSatelliteNorad)
})
/**
 * 选中卫星的全部传输链路（含传输时间、打击武器、延迟）
 */
const transmissionLinks = computed<SatelliteTransmissionLink[]>(() => {
  if (!props.selectedSatelliteNorad) return []
  return collectSatelliteTransmissionLinks(activeMatrix.value, props.selectedSatelliteNorad)
})
/**
 * 解析链路层的显示标签
 * @param layer 链路层类型
 * @returns 显示标签
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

interface GroundAssetItem extends InfrastructureLocation {
  usage?: string
}

const selectedInfrastructureNode = computed(() => store.selectedInfrastructureNode)

const selectedReceiveName = computed(() => {
  const node = selectedInfrastructureNode.value
  if (!node || node.type !== 'RECEIVE') return ''
  return node.name
})

const selectedDataCenterName = computed(() => {
  const node = selectedInfrastructureNode.value
  if (!node || node.type !== 'STATION') return ''
  return node.name
})

const isGroundNodeSelected = (node: GroundAssetItem): boolean =>
  selectedInfrastructureNode.value?.id === node.id && selectedInfrastructureNode.value?.type === node.type

const parseLatLon = (latLonStr?: string): [number, number] => {
  if (!latLonStr) return [0, 0]
  const parts = latLonStr.split(',').map((val) => parseFloat(val.trim()))
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return [0, 0]
}

const formatLatLon = (lat: number, lon: number): string => {
  if (!lat && !lon) return '--'
  return `${lat.toFixed(2)}, ${lon.toFixed(2)}`
}

const getRelationSource = () => {
  const matrix = props.matrixData
  if (!matrix) return null
  if (matrix.initRelationList?.receiveObjList?.length || matrix.initRelationList?.stationObjList?.length) {
    return matrix.initRelationList
  }
  return matrix.stationRelationList || null
}

const getPostStatusMap = (kind: 'receive' | 'station'): Map<string, number> => {
  const map = new Map<string, number>()
  const post = props.matrixData?.stationRelationList
  if (kind === 'receive') {
    ; (post?.receiveObjList || []).forEach((rec) => map.set(rec.receiveId, rec.receiveStatus ?? 0))
  } else {
    ; (post?.stationObjList || []).forEach((st) => map.set(st.stationId, st.stationStatus ?? 0))
  }
  return map
}

const receiveStations = computed<GroundAssetItem[]>(() => {
  const relationData = getRelationSource()
  if (!relationData?.receiveObjList) return []
  const statusMap = getPostStatusMap('receive')
  return relationData.receiveObjList.map((rec) => {
    const [lat, lon] = parseLatLon(rec.receiveLatLon)
    return {
      id: rec.receiveId,
      name: rec.receiveName,
      type: 'RECEIVE' as const,
      latitude: lat,
      longitude: lon,
      altitude: 0,
      status: statusMap.get(rec.receiveId) ?? rec.receiveStatus ?? 0,
      usage: (rec as { receiveUsage?: string }).receiveUsage,
    }
  })
})

const dataCenters = computed<GroundAssetItem[]>(() => {
  const relationData = getRelationSource()
  if (!relationData?.stationObjList) return []
  const statusMap = getPostStatusMap('station')
  return relationData.stationObjList.map((st) => {
    const [lat, lon] = parseLatLon(st.stationLatLon)
    return {
      id: st.stationId,
      name: st.stationName,
      type: 'STATION' as const,
      latitude: lat,
      longitude: lon,
      altitude: 0,
      status: statusMap.get(st.stationId) ?? st.stationStatus ?? 0,
    }
  })
})

const handleSelectGroundNode = (node: GroundAssetItem) => {
  if (isGroundNodeSelected(node)) {
    store.setSelectedInfrastructureNode(null)
    return
  }
  store.setSelectedInfrastructureNode({
    id: node.id,
    name: node.name,
    type: node.type,
    latitude: node.latitude,
    longitude: node.longitude,
    altitude: node.altitude,
    status: node.status,
  })
}
</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
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

  .panel-body-scroll {
    flex: 1;
    overflow-y: auto;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  margin-bottom: 8px;

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
  }
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  margin-bottom: 10px;
  background: rgba(14, 25, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #b5d5ff;

    .current-asset {
      flex: 1;
      min-width: 0;
      margin-left: auto;
      font-weight: 700;
      color: #40f2ff;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .active-badge {
      margin-left: auto;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: rgba(0, 225, 255, 0.15);
      color: #00e1ff;
    }
  }
}

.asset-scroll-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.asset-card {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;

  &:hover {
    border-color: rgba(0, 225, 255, 0.4);
    background: rgba(22, 42, 70, 0.9);
  }

  &.active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.16);
    box-shadow: 0 0 10px rgba(0, 225, 255, 0.22);
  }

  &.struck {
    border-color: rgba(239, 68, 68, 0.45);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-bottom: 6px;

    .asset-name {
      font-size: 15px;
      color: #ffffff;
      min-width: 0;
      flex: 1;
      text-align: left;
    }
  }

  .metric-highlight {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 4px;
    white-space: nowrap;

    &.status-ok {
      color: #86efac;
      background: rgba(34, 197, 94, 0.14);
      border: 1px solid rgba(34, 197, 94, 0.35);
    }

    &.status-struck {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.18);
      border: 1px solid rgba(239, 68, 68, 0.4);
    }
  }

  .card-line {
    width: 100%;
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.45;
    text-align: left;
  }
}

.empty-sat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px 12px;
  background: rgba(18, 32, 54, 0.4);
  border: 1px dashed rgba(0, 225, 255, 0.2);
  border-radius: 8px;
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
    line-height: 1.4;
  }
}

.sat-analysis-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sat-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .sat-title-group {
    display: flex;
    align-items: center;
    gap: 6px;

    .sat-name-large {
      font-size: 14px;
      font-weight: 700;
      color: #ffffff;
    }

    .sat-type-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(0, 225, 255, 0.15);
      color: #38bdf8;
    }
  }

  .clear-btn {
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #94a3b8;
    cursor: pointer;

    &:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }
  }
}

.link-flow-card {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 4px;
  padding: 10px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.2);
  border-radius: 6px;

  &.post-strike {
    border-color: rgba(249, 115, 22, 0.35);
    background: rgba(30, 25, 20, 0.5);
  }

  .flow-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 2px;

    .step-icon {
      font-size: 16px;
    }

    .step-text {
      font-size: 11px;
      font-weight: 600;
      color: #e2efff;
      max-width: 85px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .step-sub {
      font-size: 9px;
      color: #64748b;
    }
  }

  .flow-arrow {
    color: #00e1ff;
    font-size: 14px;
    font-weight: 700;
  }

  &.compact {
    padding: 8px;
    gap: 2px;
  }
}

.transmission-link-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 420px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 2px;
  }
}

.transmission-link-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.75);
  border: 1px solid rgba(0, 225, 255, 0.15);

  &.struck {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(36, 18, 24, 0.55);
  }

  &.blocked {
    border-style: dashed;
  }

  .link-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;

    .link-index {
      font-size: 11px;
      font-weight: 700;
      color: #7dd3fc;
    }

    .link-receive {
      font-size: 12px;
      font-weight: 700;
      color: #e2efff;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .link-meta-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .link-meta-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    padding: 5px 8px;
    border-radius: 4px;
    background: rgba(8, 15, 26, 0.55);

    .meta-label {
      flex-shrink: 0;
      font-size: 11px;
      color: #94a3b8;
    }

    .meta-val {
      font-size: 11px;
      font-weight: 700;
      color: #e2efff;
      text-align: right;
      line-height: 1.45;
    }

    .weapon-type-tag {
      display: inline-block;
      margin-left: 4px;
      padding: 0 4px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.25);
    }
  }
}

.window-detail-card {
  padding: 8px 10px;
  background: rgba(18, 32, 54, 0.6);
  border-radius: 6px;
  border-left: 3px solid #00e1ff;

  .card-subtitle {
    font-size: 11px;
    color: #94a3b8;
    margin-bottom: 6px;
  }

  .window-time-box {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .time-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;

      .time-label {
        color: #94a3b8;
      }

      .glow-cyan {
        color: #38bdf8;
      }

      .glow-amber {
        color: #fbbf24;
      }
    }
  }
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;

  .metric-item {
    display: flex;
    flex-direction: column;
    padding: 6px 8px;
    background: rgba(18, 32, 54, 0.5);
    border-radius: 4px;

    .m-label {
      font-size: 10px;
      color: #64748b;
    }

    .m-val {
      font-size: 12px;
      margin-top: 2px;
    }

    .glow-cyan {
      color: #38bdf8;
    }

    .glow-green {
      color: #4ade80;
    }

    .glow-amber {
      color: #fbbf24;
    }
  }
}

.selected-node-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: rgba(18, 32, 54, 0.8);
  border-radius: 6px;

  .node-main-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .node-name-text {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
    }

    .node-id-tag {
      font-size: 10px;
      color: #64748b;
    }
  }

  .node-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;

    .grid-item {
      display: flex;
      flex-direction: column;
      font-size: 11px;

      .item-label {
        color: #64748b;
      }

      .item-val {
        color: #e2efff;
      }

      .glow-cyan {
        color: #38bdf8;
      }

      .glow-green {
        color: #4ade80;
      }
    }
  }
}

.title-highlight {
  justify-content: space-between;

  .close-node-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 12px;

    &:hover {
      color: #ffffff;
    }
  }
}

.count-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.norad-tag {
  font-size: 10px;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
}

.chain-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(12, 22, 38, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);

  .chain-block-title {
    font-size: 12px;
    font-weight: 600;
    color: #7dd3fc;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .weapon-count-tag {
    margin-left: auto;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
  }

  &.chain-block--timeline {
    border-color: rgba(56, 189, 248, 0.35);
    background: rgba(8, 18, 36, 0.75);
  }

  .timeline-point-tag {
    margin-left: auto;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.15);
    color: #7dd3fc;
  }

  .timeline-point-time {
    font-size: 11px;
    font-family: monospace;
    color: #67e8f9;
    margin-bottom: 6px;
  }
}

.finish-time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 4px;
  background: rgba(18, 32, 54, 0.6);

  .finish-label {
    font-size: 11px;
    color: #94a3b8;
  }

  .finish-val {
    font-size: 12px;
    font-weight: 700;
  }

  .glow-green {
    color: #4ade80;
  }

  .glow-cyan {
    color: #38bdf8;
  }

  .glow-red {
    color: #f87171;
  }
}

.chain-blocked-tip {
  padding: 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #94a3b8;
  background: rgba(18, 32, 54, 0.5);
  border: 1px dashed rgba(148, 163, 184, 0.25);
  line-height: 1.5;

  &.danger {
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(239, 68, 68, 0.08);
  }

  &.muted {
    color: #64748b;
  }

  .blocked-time {
    display: block;
    margin-top: 4px;
    font-weight: 700;
    color: #f87171;
  }
}

.weapon-jam-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(239, 68, 68, 0.35);
    border-radius: 3px;
  }
}

.weapon-jam-item {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.7);
  border: 1px solid rgba(239, 68, 68, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;

  .weapon-jam-header {
    display: flex;
    align-items: center;
    gap: 6px;

    .weapon-name {
      font-size: 12px;
      font-weight: 600;
      color: #fecaca;
    }

    .weapon-type-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      background: rgba(239, 68, 68, 0.15);
      color: #fca5a5;
    }
  }

  .weapon-jam-target {
    font-size: 11px;
    color: #e2efff;
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;

    .jam-arrow {
      color: #64748b;
    }

    .jam-target {
      flex: 1;
      min-width: 0;
      line-height: 1.45;
      word-break: break-all;
    }

    .jam-target-type {
      color: #94a3b8;
      font-size: 10px;
    }
  }

  .weapon-jam-time {
    font-size: 10px;
    color: #94a3b8;
    font-family: Consolas, monospace;
  }
}
</style>
