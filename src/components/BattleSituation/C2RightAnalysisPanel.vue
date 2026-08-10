<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">📊</span>
        <span class="header-title glow-text-cyan">敌方数据传输与链路效能</span>
      </div>
      <span class="panel-badge badge-blue">正常传输分析</span>
    </div>

    <!-- 全面板纵向滚动容器 -->
    <el-scrollbar class="panel-body-scroll">
      <!-- 1. 敌方全网传输资产与拓扑概览 -->
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

      <!-- 2. 当前选中卫星的数据传输链路与窗口分析 -->
      <div class="panel-section selected-sat-analysis">
        <div class="section-title">
          <span class="title-icon">🔗</span>
          <span>目标卫星数据传输链路与窗口</span>
          <span class="active-badge" v-if="selectedSatelliteNorad"> NORAD: #{{ selectedSatelliteNorad }} </span>
        </div>

        <!-- A. 未点击/未选择任何卫星时的静态提示 -->
        <div v-if="!selectedSatelliteNorad" class="empty-sat-box">
          <span class="empty-icon">🛰️</span>
          <p class="empty-text">当前处于全网静态展示模式</p>
          <small class="empty-sub"
            >点击左侧列表或地图上的敌方卫星，系统将自动加载其专属传输矩阵，并推进时间轴至过境窗口</small
          >
        </div>

        <!-- B. 已选中某颗敌方卫星时的传输分析 -->
        <div v-else class="sat-analysis-box">
          <!-- 卫星核心标示 -->
          <div class="sat-header-row">
            <div class="sat-title-group">
              <span class="sat-name-large">{{ currentSatName }}</span>
              <span class="sat-type-tag">{{ currentSatType }}</span>
            </div>
            <button class="clear-btn" @click="handleClearSelection" title="重置回到静态视图">重置静态</button>
          </div>

          <!-- 传输路径 Flow Diagram -->
          <div class="link-flow-card">
            <div class="flow-step">
              <span class="step-icon">🛰️</span>
              <span class="step-text">{{ currentSatName }}</span>
              <span class="step-sub">天基感知</span>
            </div>
            <span class="flow-arrow">➔</span>
            <div class="flow-step">
              <span class="step-icon">{{ hasRelayNode ? '📡' : '🏢' }}</span>
              <span class="step-text">{{ targetRelayOrStation }}</span>
              <span class="step-sub">{{ hasRelayNode ? '中继/接收站' : '接收站' }}</span>
            </div>
            <span class="flow-arrow">➔</span>
            <div class="flow-step">
              <span class="step-icon">💻</span>
              <span class="step-text">{{ targetDataCenter }}</span>
              <span class="step-sub">数据中心</span>
            </div>
          </div>

          <!-- 过境传输时间窗口 -->
          <div class="window-detail-card" v-if="latestTransmissionWindow">
            <div class="card-subtitle">
              <span>⏱️ 下一个有效传输窗口 (自动连通推演)</span>
            </div>
            <div class="window-time-box">
              <div class="time-row">
                <span class="time-label">窗口开始:</span>
                <span class="time-val digital-font glow-cyan">{{ latestTransmissionWindow.startTime }}</span>
              </div>
              <div class="time-row">
                <span class="time-label">窗口结束:</span>
                <span class="time-val digital-font">{{ latestTransmissionWindow.endTime }}</span>
              </div>
              <div class="time-row">
                <span class="time-label">持续时长:</span>
                <span class="time-val digital-font glow-amber">{{ windowDurationText }}</span>
              </div>
            </div>
          </div>

          <!-- 传输效能与延迟指标 -->
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="m-label">过境频次 (gjNum):</span>
              <span class="m-val digital-font glow-cyan">{{ passFrequency }} 次/24h</span>
            </div>
            <div class="metric-item">
              <span class="m-label">估算传输延时:</span>
              <span class="m-val digital-font glow-green">{{ estimatedLatency }}</span>
            </div>
            <div class="metric-item">
              <span class="m-label">通信余量:</span>
              <span class="m-val digital-font glow-cyan">+18.5 dB</span>
            </div>
            <div class="metric-item">
              <span class="m-label">最短用时:</span>
              <span class="m-val digital-font glow-amber">{{ minTimeText }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 选中 3D 节点/资产详情 (Node & Asset Detail) -->
      <transition name="el-zoom-in-top">
        <div v-if="selectedNode" class="panel-section selected-node-section">
          <div class="section-title title-highlight">
            <div class="title-left">
              <span class="title-icon">{{ selectedNode.type === 'RECEIVE' ? '📡' : '💻' }}</span>
              <span>{{ selectedNode.type === 'RECEIVE' ? '地面接收站详情' : '数据中心详情' }}</span>
            </div>
            <button class="close-node-btn" @click="clearSelectedNode" title="关闭详情">✕</button>
          </div>

          <div class="selected-node-card">
            <div class="node-main-header">
              <span class="node-name-text">{{ selectedNode.name }}</span>
              <span class="node-id-tag">ID: {{ selectedNode.id }}</span>
            </div>

            <div class="node-grid">
              <div class="grid-item">
                <span class="item-label">节点类别:</span>
                <span class="item-val glow-cyan">{{
                  selectedNode.type === 'RECEIVE' ? '地基相控阵接收站' : '中心云数据处理中心'
                }}</span>
              </div>
              <div class="grid-item">
                <span class="item-label">地理坐标:</span>
                <span class="item-val digital-font"
                  >{{ selectedNode.latitude.toFixed(2) }}°N, {{ selectedNode.longitude.toFixed(2) }}°E</span
                >
              </div>
              <div class="grid-item">
                <span class="item-label">部署海拔:</span>
                <span class="item-val digital-font">{{ selectedNode.altitude }} m</span>
              </div>
              <div class="grid-item">
                <span class="item-label">解扩通信余量:</span>
                <span class="item-val digital-font glow-green">+18.5 dB (良好)</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
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
import { computed } from 'vue'
import { useLayoutStore } from '@/store/modules/layout'
import { type MatrixResult, type SatelliteMatrix, type InitMatrix, type BattleWindow } from '@/api/electronic'

const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD */
  selectedSatelliteNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'clear-satellite-selection'): void
}>()

const store = useLayoutStore()

/**
 * 算法矩阵数据
 */
const activeMatrix = computed<MatrixResult | null>(() => props.matrixData)

// 选中的地面节点
const selectedNode = computed(() => store.selectedInfrastructureNode)
const clearSelectedNode = () => {
  store.setSelectedInfrastructureNode(null)
}

// 清除选择
const handleClearSelection = () => {
  emit('clear-satellite-selection')
}

// 全网资产统计
const transitSatCount = computed(() => {
  const data = activeMatrix.value
  if (!data) {
    return
  }
  const list = data.initMatrixList
  return list.filter((s) => !s.satType?.includes('中继')).length
})
/**
 * 中继卫星数量
 */
const relaySatCount = computed(() => {
  const data = activeMatrix.value
  if (!data) {
    return
  }
  return data.relayRelation?.relayList?.length
})
/**
 *
 */
const receiveStationCount = computed(() => {
  const relationData = activeMatrix.value?.stationRelationList || activeMatrix.value?.initRelationList
  return relationData?.receiveObjList?.length
})

const dataCenterCount = computed(() => {
  const relationData = activeMatrix.value?.stationRelationList || activeMatrix.value?.initRelationList
  return relationData?.stationObjList?.length
})

// 当前选中卫星信息
const currentSatItem = computed(() => {
  if (!props.selectedSatelliteNorad) return null
  const norad = props.selectedSatelliteNorad
  const data = activeMatrix.value
  if (!data) return null
  const matchInit = (data.initMatrixList || []).find((item: InitMatrix) => item.norad === norad)
  if (matchInit) return matchInit

  const matchSat = (data.satelliteMatrixList || []).find((item: SatelliteMatrix) => item.norad === norad)
  if (matchSat) return matchSat

  const matchBattle = (data.battleMatrixList || []).find((item) => item.norad === norad)
  if (matchBattle) return matchBattle

  return null
})

const currentSatName = computed(() => {
  return currentSatItem.value?.name || (props.selectedSatelliteNorad ? `SAT-#${props.selectedSatelliteNorad}` : '')
})

const currentSatType = computed(() => {
  return (currentSatItem.value as any)?.satType || '过境观测卫星'
})

// 解析传输路径 (中继/接收站 & 数据中心)
const hasRelayNode = computed(() => {
  const data = activeMatrix.value
  if (!data) return false
  return (data.relayRelation?.relayList?.length || 0) > 0
})
/**
 * 计算目标中继卫星或者接收站的名称
 */
const targetRelayOrStation = computed(() => {
  if (!activeMatrix.value) return
  const relationData = activeMatrix.value.stationRelationList || activeMatrix.value.initRelationList
  const rec = relationData?.receiveObjList?.[0]
  if (hasRelayNode.value) {
    const relayNodeId = activeMatrix.value.relayRelation?.relayList?.[0]
    return relayNodeId
  }
  return rec ? rec.receiveName : ''
})

/**
 * 计算数据中心的名称
 */
const targetDataCenter = computed(() => {
  if (!activeMatrix.value) return
  const relationData = activeMatrix.value.stationRelationList || activeMatrix.value.initRelationList
  const st = relationData?.stationObjList?.[0]
  return st ? st.stationName : ''
})

// 最新/最早的过境传输窗口
const latestTransmissionWindow = computed<BattleWindow | null>(() => {
  if (!props.selectedSatelliteNorad) return null
  const data = activeMatrix.value
  if (!data) return null
  // 查 battleMatrixList
  const battleMatch = (data.battleMatrixList || []).find((b) => b.norad === props.selectedSatelliteNorad)
  if (battleMatch?.windows?.length) {
    return battleMatch.windows[0]
  }

  // 查 initMatrixList
  // [业务目的] 当战场过境矩阵匹配不到时，从初始过境时间窗口列表中读取该卫星的时间窗口
  // [实现原因] InitMatrix 接口类型定义的过境窗口数组字段为 initWindows，单项时间窗口为 InitWindow (包含 peakWindow 和 endWindow 字段)
  // [关键规则] 使用 initMatch.initWindows[0].peakWindow 作为 startTime，endWindow 作为 endTime
  const initMatch = (data.initMatrixList || []).find((i) => i.norad === props.selectedSatelliteNorad)
  if (initMatch?.initWindows?.length) {
    return {
      startTime: initMatch.initWindows[0].peakWindow,
      endTime: initMatch.initWindows[0].endWindow,
    }
  }
  return null
})

// 计算窗口持续时长
const windowDurationText = computed(() => {
  const win = latestTransmissionWindow.value
  if (!win?.startTime || !win?.endTime) return '--'
  try {
    const start = new Date(win.startTime.replace(/-/g, '/')).getTime()
    const end = new Date(win.endTime.replace(/-/g, '/')).getTime()
    const diffSec = Math.max(0, Math.floor((end - start) / 1000))
    const min = Math.floor(diffSec / 60)
    const sec = diffSec % 60
    return `${min} 分 ${sec} 秒`
  } catch (e) {
    return '--'
  }
})

// 过境频次 (gjNum)
const passFrequency = computed(() => {
  const item = currentSatItem.value as any
  return item?.gjNum || item?.windows?.length || 4
})

// 延迟估算
const estimatedLatency = computed(() => {
  return hasRelayNode.value ? '18.2 ms (含高轨中继)' : '8.6 ms (直连地面站)'
})

// 最短用时
const minTimeText = computed(() => {
  return windowDurationText.value !== '--' ? windowDurationText.value : '18 分钟 30 秒'
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
  justify-content: space-between;
  padding: 10px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.2);
  border-radius: 6px;

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
</style>
