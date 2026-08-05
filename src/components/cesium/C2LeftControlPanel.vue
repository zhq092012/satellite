<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">🛰️</span>
        <span class="header-title glow-text-cyan">战术控制与资产态势</span>
      </div>
      <span class="panel-badge">即时推演</span>
    </div>

    <!-- 1. 战术方案与交战烈度控制模块 -->
    <div class="panel-section">
      <div class="section-title">
        <span class="title-icon">⚙️</span>
        <span>推演方案与烈度控制</span>
      </div>

      <!-- 交战烈度切换按钮组 -->
      <div class="control-row">
        <span class="ctrl-label">交战烈度:</span>
        <div class="intensity-btn-group">
          <button
            v-for="level in intensityOptions"
            :key="level"
            class="c2-btn intensity-btn"
            :class="{ active: currentIntensity === level }"
            @click="handleIntensityChange(level)"
          >
            {{ level }}
          </button>
        </div>
      </div>

      <!-- 视觉渲染与视椎 Toggle 选项 -->
      <div class="toggle-grid">
        <label class="toggle-item">
          <input type="checkbox" v-model="showRadarFrustum" @change="$emit('toggle-radar-frustum', showRadarFrustum)" />
          <span class="checkbox-custom"></span>
          <span class="toggle-text">📡 3D 雷达探测包络视椎</span>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="showOrbitTrails" @change="$emit('toggle-orbit-trails', showOrbitTrails)" />
          <span class="checkbox-custom"></span>
          <span class="toggle-text">🛰️ 卫星运行真实轨道轨迹</span>
        </label>
        <label class="toggle-item">
          <input
            type="checkbox"
            v-model="showRedSatellites"
            @change="$emit('toggle-red-satellites', showRedSatellites)"
          />
          <span class="checkbox-custom"></span>
          <span class="toggle-text">🇨🇳 显示我方(红方)天基卫星</span>
        </label>
      </div>

      <!-- 视角快速定位按钮 -->
      <div class="camera-actions">
        <button class="c2-btn action-btn" @click="$emit('fly-to-view', 'GLOBAL')">🌐 全景视口</button>
        <button class="c2-btn action-btn" @click="$emit('fly-to-view', 'SPACE')">🛰️ 天基集群</button>
        <button class="c2-btn action-btn" @click="$emit('fly-to-view', 'GROUND')">🏢 地基节点</button>
      </div>
    </div>

    <!-- 2. 敌方天基空间节点资产清单 (Space Layer) -->
    <div class="panel-section section-space">
      <div class="section-title">
        <span class="title-icon">🌌</span>
        <span>天基空间节点资产</span>
        <span class="count-tag">{{ satList.length }} 颗</span>
      </div>

      <div class="asset-scroll-list">
        <div
          v-for="sat in satList"
          :key="sat.norad"
          class="asset-card"
          :class="{ 'card-struck': sat.status === 1, 'card-relay': sat.isRelay }"
        >
          <div class="card-top">
            <span class="sat-name">
              {{ sat.isRelay ? '📡' : '🛰️' }} <strong>{{ sat.name }}</strong>
            </span>
            <span class="status-badge" :class="sat.status === 1 ? 'badge-danger' : 'badge-success'">
              {{ sat.status === 1 ? '受压制毁伤' : '正常在轨' }}
            </span>
          </div>

          <div class="card-details">
            <span class="detail-tag">NORAD: {{ sat.norad }}</span>
            <span class="detail-tag tag-type">{{ sat.satType }}</span>
            <span class="detail-tag tag-role" v-if="sat.isRelay">中继节点</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 敌方地基网络设施清单与物理防线 (Ground Layer) -->
    <div class="panel-section">
      <div class="section-title">
        <span class="title-icon">🏢</span>
        <span>地基网络设施与物理参数</span>
        <span class="count-tag">{{ groundNodes.length }} 个</span>
      </div>

      <div class="ground-nodes-grid">
        <div
          v-for="node in groundNodes.slice(0, 6)"
          :key="node.id"
          class="ground-node-pill"
          :class="{ 'node-struck': node.status === 1, 'node-center': node.type === 'STATION' }"
        >
          <span class="node-icon">{{ node.type === 'STATION' ? '🏢' : '📡' }}</span>
          <span class="node-name" :title="node.name">{{ node.name }}</span>
          <span class="node-status-dot" :class="node.status === 1 ? 'dot-red' : 'dot-green'"></span>
        </div>
      </div>

      <div class="defense-baseline-box">
        <div class="baseline-item">
          <span class="label">接收机抗干扰解扩门槛:</span>
          <span class="value digital-font glow-cyan">50.0 dB</span>
        </div>
        <div class="baseline-item">
          <span class="label">地平线地形掩蔽角门槛:</span>
          <span class="value digital-font">10.0°</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { getDefaultMatrixData, type MatrixResult, type SatelliteMatrix, type InitMatrix } from '@/api/electronic'

const props = defineProps<{
  matrixData?: MatrixResult | null
}>()

const emit = defineEmits<{
  (e: 'intensity-change', level: '高烈度' | '中烈度' | '低烈度'): void
  (e: 'toggle-radar-frustum', show: boolean): void
  (e: 'toggle-orbit-trails', show: boolean): void
  (e: 'toggle-red-satellites', show: boolean): void
  (e: 'fly-to-view', target: 'GLOBAL' | 'SPACE' | 'GROUND'): void
}>()

// 烈度选项
type IntensityLevelType = '高烈度' | '中烈度' | '低烈度'
const intensityOptions: IntensityLevelType[] = ['高烈度', '中烈度', '低烈度']
const currentIntensity = ref<IntensityLevelType>('高烈度')

const showRadarFrustum = ref(true)
const showOrbitTrails = ref(false)
const showRedSatellites = ref(false)

const handleIntensityChange = (level: IntensityLevelType) => {
  if (currentIntensity.value === level) return
  currentIntensity.value = level
  emit('intensity-change', level)
}

const activeMatrix = computed<MatrixResult>(() => props.matrixData || getDefaultMatrixData())

// 提取卫星列表 (包含普通卫星与中继卫星)
const satList = computed(() => {
  const data = activeMatrix.value
  const map = new Map<number, { norad: number; name: string; satType: string; status: number; isRelay: boolean }>()

  const relayList = data.relayRelation?.relayList || []

  ;(data.initMatrixList || []).forEach((s: InitMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: 0, isRelay })
  })
  ;(data.satelliteMatrixList || []).forEach((s: SatelliteMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      status: s.satelliteStatus || 0,
      isRelay,
    })
  })

  return Array.from(map.values())
})

// 提取地面节点列表
const groundNodes = computed(() => {
  const data = activeMatrix.value
  const nodes: { id: string; name: string; type: 'RECEIVE' | 'STATION'; status: number }[] = []
  const relationData = data.stationRelationList || data.initRelationList

  if (relationData?.receiveObjList) {
    relationData.receiveObjList.forEach((rec) => {
      nodes.push({
        id: rec.receiveId,
        name: rec.receiveName,
        type: 'RECEIVE',
        status: rec.receiveStatus ?? 0,
      })
    })
  }

  if (relationData?.stationObjList) {
    relationData.stationObjList.forEach((st) => {
      nodes.push({
        id: st.stationId,
        name: st.stationName,
        type: 'STATION',
        status: st.stationStatus ?? 0,
      })
    })
  }

  return nodes
})
</script>

<style lang="scss" scoped>
.c2-panel {
  width: 100%;
  height: 100%;
  max-height: 100%;
  box-sizing: border-box;
  background: rgba(8, 14, 28, 0.94);
  border: 1px solid rgba(0, 225, 255, 0.25);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  padding: 10px;
  gap: 8px;
  backdrop-filter: blur(10px);
  color: #e2e8f0;
  font-family: inherit;
  overflow: hidden;

  * {
    box-sizing: border-box;
  }
}

.panel-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  width: 100%;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;

    .header-icon {
      font-size: 15px;
      flex-shrink: 0;
    }
    .header-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .panel-badge {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 9px;
    padding: 1px 4px;
    background: rgba(0, 225, 255, 0.15);
    border: 1px solid rgba(0, 225, 255, 0.4);
    color: #00e1ff;
    border-radius: 3px;
  }
}

.glow-text-cyan {
  color: #00e1ff;
  text-shadow: 0 0 8px rgba(0, 225, 255, 0.4);
}

.glow-cyan {
  color: #00e1ff;
  text-shadow: 0 0 6px rgba(0, 225, 255, 0.5);
}

.digital-font {
  font-family: inherit;
  font-weight: 700;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(13, 23, 42, 0.6);
  border: 1px solid rgba(0, 225, 255, 0.12);
  border-radius: 6px;
  padding: 8px;
  min-height: 0;

  &.section-controls {
    flex: 0 0 auto;
  }

  &.section-space {
    flex: 1 1 45%;
  }

  &.section-ground {
    flex: 1 1 55%;
  }

  .section-title {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    color: #38bdf8;
    border-bottom: 1px dashed rgba(56, 189, 248, 0.2);
    padding-bottom: 3px;

    .title-icon {
      font-size: 13px;
    }

    .count-tag {
      margin-left: auto;
      font-size: 9px;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.06);
      padding: 1px 4px;
      border-radius: 3px;
    }
  }
}

.control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .ctrl-label {
    font-size: 11px;
    color: #94a3b8;
  }

  .intensity-btn-group {
    display: flex;
    gap: 4px;
  }
}

.c2-btn {
  background: rgba(15, 28, 54, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.25);
  color: #94a3b8;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #00e1ff;
    color: #e2e8f0;
  }

  &.active {
    background: rgba(0, 225, 255, 0.2);
    border-color: #00e1ff;
    color: #00e1ff;
    font-weight: 700;
    box-shadow: 0 0 8px rgba(0, 225, 255, 0.3);
  }
}

.toggle-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 10px;
    color: #cbd5e1;

    input[type='checkbox'] {
      cursor: pointer;
      accent-color: #00e1ff;
    }
  }
}

.camera-actions {
  display: flex;
  gap: 4px;

  .action-btn {
    flex: 1;
    text-align: center;
    padding: 3px 2px;
  }
}

.asset-scroll-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 2px;
  }
}

.asset-card {
  background: rgba(15, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 4px;
  padding: 5px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;

  &.card-relay {
    border-color: rgba(168, 85, 247, 0.4);
    background: rgba(30, 17, 42, 0.8);
  }

  &.card-struck {
    border-color: rgba(255, 77, 79, 0.4);
    background: rgba(45, 18, 21, 0.8);
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .sat-name {
      font-size: 10px;
      color: #e2e8f0;
    }
  }

  .card-details {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;

    .detail-tag {
      font-size: 9px;
      color: #64748b;
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 3px;
      border-radius: 2px;

      &.tag-type {
        color: #38bdf8;
      }
      &.tag-role {
        color: #c084fc;
        background: rgba(168, 85, 247, 0.15);
      }
    }
  }
}

.status-badge {
  font-size: 9px;
  padding: 1px 3px;
  border-radius: 2px;

  &.badge-success {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  &.badge-danger {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
}

.ground-nodes-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 2px;
  }
}

.ground-node-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(15, 27, 49, 0.8);
  border: 1px solid rgba(0, 242, 254, 0.2);
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 9px;

  &.node-center {
    border-color: rgba(59, 130, 246, 0.4);
    background: rgba(16, 36, 76, 0.8);
  }
  &.node-struck {
    border-color: rgba(255, 77, 79, 0.4);
    background: rgba(45, 18, 21, 0.8);
  }

  .node-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #cbd5e1;
  }

  .node-status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;

    &.dot-green {
      background: #4ade80;
      box-shadow: 0 0 4px #4ade80;
    }
    &.dot-red {
      background: #f87171;
      box-shadow: 0 0 4px #f87171;
    }
  }
}

.defense-baseline-box {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 2px;
  background: rgba(0, 0, 0, 0.3);
  padding: 5px;
  border-radius: 4px;

  .baseline-item {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;

    .value {
      color: #e2e8f0;
    }
  }
}
</style>
