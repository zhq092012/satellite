<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">🛰️</span>
        <span class="header-title glow-text-cyan">敌方网络与资产拓扑</span>
      </div>
      <span class="panel-badge">传输链路</span>
    </div>

    <!-- 1. 视图与控件模块 -->
    <div class="panel-section">
      <div class="section-title">
        <span class="title-icon">⚙️</span>
        <span>视图控件与图层控制</span>
      </div>

      <!-- 视觉渲染 Toggle 选项 -->
      <div class="toggle-grid">
        <label class="toggle-item">
          <input type="checkbox" v-model="showRadarFrustum" @change="$emit('toggle-radar-frustum', showRadarFrustum)" />
          <span class="checkbox-custom"></span>
          <span class="toggle-text">📡 接收站包络</span>
        </label>
        <label class="toggle-item">
          <input type="checkbox" v-model="showOrbitTrails" @change="$emit('toggle-orbit-trails', showOrbitTrails)" />
          <span class="checkbox-custom"></span>
          <span class="toggle-text">🛰️ 卫星运行轨迹</span>
        </label>
      </div>


    </div>

    <!-- 2. 敌方天基空间节点资产清单 (Space Layer) -->
    <div class="panel-section section-space">
      <div class="section-title">
        <span class="title-icon">🌌</span>
        <span>敌方天基过境与中继卫星</span>
        <span class="count-tag">{{ satList.length }} 颗</span>
      </div>

      <div class="asset-scroll-list">
        <div
          v-for="sat in satList"
          :key="sat.norad"
          class="asset-card"
          :class="{
            'card-active': selectedNorad === sat.norad,
            'card-relay': sat.isRelay,
          }"
          @click="handleSelectSatellite(sat.norad)"
        >
          <div class="card-top">
            <span class="sat-name">
              {{ sat.isRelay ? '📡' : '🛰️' }} <strong>{{ sat.name }}</strong>
            </span>
            <span class="status-badge" :class="sat.isRelay ? 'badge-amber' : 'badge-cyan'">
              {{ sat.isRelay ? '高轨中继' : '过境观测' }}
            </span>
          </div>

          <div class="card-details">
            <span class="detail-tag">NORAD: {{ sat.norad }}</span>
            <span class="detail-tag tag-type">{{ sat.satType || '天基节点' }}</span>
            <span class="detail-tag tag-role" v-if="sat.isRelay">中继节点</span>
            <span class="click-hint" v-if="selectedNorad === sat.norad">✓ 已选择分析</span>
          </div>
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
        <div
          v-for="node in groundNodes"
          :key="node.id"
          class="ground-node-pill"
          :class="{ 'node-center': node.type === 'STATION' }"
        >
          <span class="node-icon">{{ node.type === 'STATION' ? '💻' : '📡' }}</span>
          <span class="node-name" :title="node.name">{{ node.name }}</span>
          <span class="node-type-label">{{ node.type === 'STATION' ? '数据中心' : '接收站' }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * [功能]
 * 战场态势 - C2 左侧控制与敌方资产清单面板
 *
 * [处理规则]
 * - 重点展示敌方过境卫星、中继卫星、地面接收站及数据中心
 * - 点击天基卫星卡片时向父组件抛出 select-satellite 事件
 * - 不包含任何攻击/毁伤/打压控制
 *
 * [副作用]
 * - 触发视角切换与控制事件
 */
import { ref, computed } from 'vue'
import { getDefaultMatrixData, type MatrixResult, type SatelliteMatrix, type InitMatrix } from '@/api/electronic'

const props = defineProps<{
  /** 算法矩阵响应式数据 */
  matrixData?: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'select-satellite', norad: number | null): void
  (e: 'toggle-radar-frustum', show: boolean): void
  (e: 'toggle-orbit-trails', show: boolean): void
  (e: 'fly-to-view', target: 'GLOBAL' | 'SPACE' | 'GROUND'): void
}>()

const showRadarFrustum = ref(true)
const showOrbitTrails = ref(false)

const activeMatrix = computed<MatrixResult>(() => props.matrixData || getDefaultMatrixData())

// 触发选择卫星事件 (再次点击已选中的卫星可取消选择)
const handleSelectSatellite = (norad: number) => {
  if (props.selectedNorad === norad) {
    emit('select-satellite', null)
  } else {
    emit('select-satellite', norad)
  }
}

// 提取敌方卫星列表 (包含过境卫星与中继卫星)
const satList = computed(() => {
  const data = activeMatrix.value
  const map = new Map<number, { norad: number; name: string; satType: string; isRelay: boolean }>()
  const defaultData = getDefaultMatrixData()

  const initList = data.initMatrixList?.length ? data.initMatrixList : defaultData.initMatrixList
  const satMatrixList = data.satelliteMatrixList?.length ? data.satelliteMatrixList : defaultData.satelliteMatrixList
  const relayList = data.relayRelation?.relayList?.length ? data.relayRelation.relayList : defaultData.relayRelation?.relayList || []

  initList.forEach((s: InitMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, isRelay })
  })
  satMatrixList.forEach((s: SatelliteMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      isRelay,
    })
  })

  return Array.from(map.values())
})

// 提取敌方地面设施列表 (接收站 + 数据中心)
const groundNodes = computed(() => {
  const data = activeMatrix.value
  const nodes: { id: string; name: string; type: 'RECEIVE' | 'STATION' }[] = []
  const defaultData = getDefaultMatrixData()

  let relationData = data.stationRelationList
  if (!relationData?.receiveObjList?.length) {
    relationData = data.initRelationList
  }
  if (!relationData?.receiveObjList?.length) {
    relationData = defaultData.stationRelationList
  }

  if (relationData?.receiveObjList) {
    relationData.receiveObjList.forEach((rec) => {
      nodes.push({
        id: rec.receiveId,
        name: rec.receiveName,
        type: 'RECEIVE',
      })
    })
  }

  if (relationData?.stationObjList) {
    relationData.stationObjList.forEach((st) => {
      nodes.push({
        id: st.stationId,
        name: st.stationName,
        type: 'STATION',
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
  font-family: system-ui, -apple-system, sans-serif;
  overflow-y: auto;
  gap: 12px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 4px;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);

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
    background: rgba(0, 225, 255, 0.12);
    color: #5ce1e6;
    border: 1px solid rgba(0, 225, 255, 0.3);
  }
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
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

    .count-tag {
      margin-left: auto;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      background: rgba(64, 242, 255, 0.15);
      color: #7dd3fc;
    }
  }
}

.toggle-grid {
  display: flex;
  gap: 12px;
  align-items: center;

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;

    input {
      accent-color: #00e1ff;
    }
  }
}



// [业务目的] 敌方天基过境与中继卫星列表样式定义
// [实现原因] 移除 max-height 与 overflow-y 局部滚动条限制，避免出现嵌套滚动条，统一由外层 .c2-panel 进行整体滚动
// [关键规则] 不设高度上限，内容按 Flex 垂直排列自然展开
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

  &:hover {
    border-color: rgba(0, 225, 255, 0.4);
    background: rgba(22, 42, 70, 0.9);
  }

  &.card-active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.18);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.25);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;

    .sat-name {
      font-size: 13px;
      color: #ffffff;
    }

    .status-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;

      &.badge-cyan {
        background: rgba(0, 225, 255, 0.15);
        color: #38bdf8;
      }

      &.badge-amber {
        background: rgba(245, 158, 11, 0.18);
        color: #fbbf24;
      }
    }
  }

  .card-details {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;

    .detail-tag {
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;

      &.tag-type {
        color: #7dd3fc;
      }

      &.tag-role {
        color: #fcd34d;
      }
    }

    .click-hint {
      margin-left: auto;
      color: #38bdf8;
      font-weight: 600;
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
  }
}
</style>
