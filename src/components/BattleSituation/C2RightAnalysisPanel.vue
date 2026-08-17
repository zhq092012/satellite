<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">📊</span>
        <span class="header-title glow-text-cyan">敌方数据传输与链路效能</span>
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

          <!-- 打击前最早全链路 -->
          <div class="chain-block">
            <div class="chain-block-title">打击前最早全链路通信</div>
            <template v-if="!preStrikeChain.blocked">
              <div class="link-flow-card">
                <template v-for="(node, idx) in preStrikeChain.nodes" :key="node.layer + node.id">
                  <div class="flow-step">
                    <span class="step-icon">{{ node.icon }}</span>
                    <span class="step-text" :title="node.name">{{ node.name }}</span>
                    <span class="step-sub">{{ chainLayerLabel(node.layer) }}</span>
                  </div>
                  <span v-if="idx < preStrikeChain.nodes.length - 1" class="flow-arrow">→</span>
                </template>
              </div>
              <div class="finish-time-row">
                <span class="finish-label">完成时间</span>
                <strong class="finish-val glow-green">{{ preStrikeChain.finishTime }}</strong>
              </div>
            </template>
            <div v-else class="chain-blocked-tip">{{ preStrikeChain.blockedReason || '无可完成链路' }}</div>
          </div>

          <!-- 打击后最早全链路 -->
          <div class="chain-block">
            <div class="chain-block-title">打击后最早全链路通信</div>
            <template v-if="!postStrikeChain.blocked">
              <div class="link-flow-card post-strike">
                <template v-for="(node, idx) in postStrikeChain.nodes" :key="node.layer + node.id">
                  <div class="flow-step">
                    <span class="step-icon">{{ node.icon }}</span>
                    <span class="step-text" :title="node.name">{{ node.name }}</span>
                    <span class="step-sub">{{ chainLayerLabel(node.layer) }}</span>
                  </div>
                  <span v-if="idx < postStrikeChain.nodes.length - 1" class="flow-arrow">→</span>
                </template>
              </div>
              <div class="finish-time-row">
                <span class="finish-label">完成时间</span>
                <strong class="finish-val glow-cyan">{{ postStrikeChain.finishTime }}</strong>
              </div>
            </template>
            <div v-else class="chain-blocked-tip danger">
              {{ postStrikeChain.blockedReason }}
              <span v-if="postStrikeChain.finishTime" class="blocked-time">{{ postStrikeChain.finishTime }}</span>
            </div>
          </div>

          <!-- 干扰武器列表 -->
          <div class="chain-block">
            <div class="chain-block-title">
              干扰武器列表
              <span class="weapon-count-tag">{{ jamWeaponList.length }} 条</span>
            </div>
            <div v-if="jamWeaponList.length" class="weapon-jam-list">
              <div v-for="(item, idx) in jamWeaponList" :key="idx" class="weapon-jam-item">
                <div class="weapon-jam-header">
                  <span class="weapon-name">🎯 {{ item.weaponName }}</span>
                  <span v-if="item.weaponType" class="weapon-type-tag">{{ item.weaponType }}</span>
                </div>
                <div class="weapon-jam-target">
                  <span class="jam-arrow">→</span>
                  <span class="jam-target">{{ targetTypeIcon(item.targetType) }} {{ item.targetName }}</span>
                  <span class="jam-target-type">[{{ item.targetType }}]</span>
                </div>
                <div class="weapon-jam-time">{{ item.timeRange }}</div>
              </div>
            </div>
            <div v-else class="chain-blocked-tip muted">暂无与该卫星相关的干扰武器记录</div>
          </div>
        </div>

        <div v-else class="empty-sat-box">
          <span class="empty-icon">🛰️</span>
          <p class="empty-text">当前系列下未找到该卫星数据</p>
        </div>
      </div>

      <!-- 2. 敌方全网传输资产与拓扑概览 -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">🌐</span>
          <span>敌方全网传输资产统计</span>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <span class="stat-label">过境卫星</span>
            <strong class="stat-val glow-cyan">{{ transitSatCount }} 颗</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">中继节点</span>
            <strong class="stat-val glow-amber">{{ relaySatCount }} 颗</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">地面接收站</span>
            <strong class="stat-val glow-blue">{{ receiveStationCount }} 个</strong>
          </div>
          <div class="stat-card">
            <span class="stat-label">数据中心</span>
            <strong class="stat-val glow-purple">{{ dataCenterCount }} 个</strong>
          </div>
        </div>
      </div>

      <!-- 3. 敌方地基网络设施清单 (Ground Layer) -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">🏢</span>
          <span>敌方地基接收站与数据中心</span>
          <span class="count-tag">{{ groundNodes.length }} 个</span>
        </div>

        <div class="ground-nodes-grid">
          <div v-for="node in groundNodes" :key="`${node.type}-${node.id}`" class="ground-node-pill" :class="{
            'node-center': node.type === 'STATION',
            active: selectedInfrastructureNode?.id === node.id && selectedInfrastructureNode?.type === node.type,
          }" @click="handleSelectGroundNode(node)">
            <span class="node-icon">{{ node.type === 'STATION' ? '💻' : '📡' }}</span>
            <span class="node-name" :title="node.name">{{ node.name }}</span>
            <span class="node-type-label">{{ node.type === 'STATION' ? '数据中心' : '接收站' }}</span>
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
  analyzeSatelliteFullChain,
  collectSatelliteJamWeapons,
  getSatelliteDisplayInfo,
  type ChainNode,
  type JamWeaponRecord,
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

const selectedSatInfo = computed(() => {
  if (!props.selectedSatelliteNorad) return null
  return getSatelliteDisplayInfo(activeMatrix.value, props.selectedSatelliteNorad)
})

const preStrikeChain = computed(() => {
  if (!props.selectedSatelliteNorad) {
    return analyzeSatelliteFullChain(null, 0, false)
  }
  return analyzeSatelliteFullChain(activeMatrix.value, props.selectedSatelliteNorad, false)
})

const postStrikeChain = computed(() => {
  if (!props.selectedSatelliteNorad) {
    return analyzeSatelliteFullChain(null, 0, true)
  }
  return analyzeSatelliteFullChain(activeMatrix.value, props.selectedSatelliteNorad, true)
})

const jamWeaponList = computed<JamWeaponRecord[]>(() => {
  if (!props.selectedSatelliteNorad) return []
  return collectSatelliteJamWeapons(activeMatrix.value, props.selectedSatelliteNorad)
})

const chainLayerLabel = (layer: ChainNode['layer']): string => {
  const map: Record<ChainNode['layer'], string> = {
    SAT: '卫星',
    RELAY: '中继',
    RECEIVE: '地面站',
    STATION: '数据中心',
  }
  return map[layer]
}

const targetTypeIcon = (type: JamWeaponRecord['targetType']): string => {
  const map: Record<JamWeaponRecord['targetType'], string> = {
    卫星: '🛰️',
    中继卫星: '📡',
    接收站: '📡',
    数据中心: '💻',
  }
  return map[type]
}

// 全网资产统计
const transitSatCount = computed(() => {
  const data = activeMatrix.value
  if (!data) {
    return 0
  }
  const list = data.initMatrixList
  if (!list || list.length === 0) return 0
  return list.filter((s) => !s.satType?.includes('中继')).length
})
/**
 * 中继卫星数量
 */
const relaySatCount = computed(() => {
  const data = activeMatrix.value
  if (!data) {
    return 0
  }
  if (!data.relayRelation || data.relayRelation.relayList.length === 0) return 0
  return data.relayRelation.relayList.length
})
/**
 * 接收站的数量
 */
const receiveStationCount = computed(() => {
  const relationData = activeMatrix.value?.stationRelationList || activeMatrix.value?.initRelationList
  return relationData?.receiveObjList?.length || 0
})
/**
 * 数据中心的数量
 */
const dataCenterCount = computed(() => {
  const relationData = activeMatrix.value?.stationRelationList || activeMatrix.value?.initRelationList
  return relationData?.stationObjList?.length || 0
})

const selectedInfrastructureNode = computed(() => store.selectedInfrastructureNode)

/**
 * 解析经纬度字符串 (例如 "68.350,133.500") 为 [latitude, longitude]
 */
const parseLatLon = (latLonStr?: string): [number, number] => {
  if (!latLonStr) return [0, 0]
  const parts = latLonStr.split(',').map((val) => parseFloat(val.trim()))
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return [0, 0]
}

// 选择/取消选择敌方地面接收站或数据中心
const handleSelectGroundNode = (node: InfrastructureLocation) => {
  if (selectedInfrastructureNode.value?.id === node.id && selectedInfrastructureNode.value?.type === node.type) {
    store.setSelectedInfrastructureNode(null)
  } else {
    store.setSelectedInfrastructureNode(node)
  }
}

// 提取敌方地面设施列表 (接收站 + 数据中心)
const groundNodes = computed<InfrastructureLocation[]>(() => {
  const matrixData = props.matrixData
  if (!matrixData) return []
  const nodes: InfrastructureLocation[] = []

  let relationData = matrixData.stationRelationList
  if (!relationData?.receiveObjList?.length) {
    relationData = matrixData.initRelationList
  }

  if (relationData?.receiveObjList) {
    relationData.receiveObjList.forEach((rec) => {
      const [lat, lon] = parseLatLon(rec.receiveLatLon)
      nodes.push({
        id: rec.receiveId,
        name: rec.receiveName,
        type: 'RECEIVE',
        latitude: lat,
        longitude: lon,
        altitude: 0,
        status: rec.receiveStatus ?? 0,
      })
    })
  }

  if (relationData?.stationObjList) {
    relationData.stationObjList.forEach((st) => {
      const [lat, lon] = parseLatLon(st.stationLatLon)
      nodes.push({
        id: st.stationId,
        name: st.stationName,
        type: 'STATION',
        latitude: lat,
        longitude: lon,
        altitude: 0,
        status: st.stationStatus ?? 0,
      })
    })
  }

  return nodes
})
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;

  .stat-card {
    display: flex;
    flex-direction: column;
    padding: 8px;
    border-radius: 6px;
    background: rgba(18, 32, 54, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);

    .stat-label {
      font-size: 11px;
      color: #94a3b8;
    }

    .stat-val {
      font-size: 14px;
      margin-top: 2px;
    }

    .glow-cyan {
      color: #38bdf8;
    }

    .glow-amber {
      color: #fbbf24;
    }

    .glow-blue {
      color: #60a5fa;
    }

    .glow-purple {
      color: #c084fc;
    }
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

.ground-nodes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.ground-node-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(30, 58, 95, 0.8);
  }

  &.active {
    border-color: #38bdf8;
    background: rgba(14, 165, 233, 0.25);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);

    .node-name {
      color: #38bdf8;
      font-weight: bold;
    }
  }

  .node-icon {
    font-size: 12px;
  }

  .node-name {
    font-size: 12px;
    color: #e2efff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
  }

  .node-type-label {
    margin-left: auto;
    font-size: 10px;
    color: #64748b;
  }

  &.node-center {
    border-color: rgba(168, 85, 247, 0.3);

    .node-type-label {
      color: #c084fc;
    }

    &.active {
      border-color: #a855f7;
      background: rgba(168, 85, 247, 0.25);
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.35);

      .node-name {
        color: #e9d5ff;
      }
    }
  }
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
