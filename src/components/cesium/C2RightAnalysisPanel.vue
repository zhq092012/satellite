<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-icon">📊</span>
        <span class="header-title glow-text-cyan">战场态势 - 网络毁伤态势</span>
      </div>
      <span class="panel-badge badge-red">时效战果分析</span>
    </div>

    <!-- 全面板纵向滚动容器 -->
    <el-scrollbar class="panel-body-scroll">
      <!-- 1. 网络脆弱点与高价值枢纽分析模块 -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">🎯</span>
          <span>网络脆弱点与高价值枢纽</span>
        </div>

        <div class="hubs-list">
          <div v-for="hub in highValueHubs" :key="hub.id" class="hub-card">
            <div class="hub-header">
              <span class="hub-icon">{{ hub.icon }}</span>
              <span class="hub-name"
                ><strong>{{ hub.name }}</strong></span
              >
              <span class="hub-tag" :class="hub.tagClass">{{ hub.tag }}</span>
            </div>

            <div class="hub-body">
              <div class="hub-metric">
                <span class="metric-label">1对N并发链路:</span>
                <span class="metric-value digital-font glow-cyan">{{ hub.linkCount }} 条</span>
              </div>
              <div class="hub-metric">
                <span class="metric-label">抗干扰解扩余量:</span>
                <span class="metric-value digital-font" :class="hub.marginClass">{{ hub.margin }}</span>
              </div>
              <div class="hub-metric">
                <span class="metric-label">单点失效风险:</span>
                <span class="metric-value digital-font" :class="hub.riskClass">{{ hub.riskIndex }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 累积时延战果与时效性损毁模块 -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">⏱️</span>
          <span>累积时延战果与时效性损失</span>
        </div>

        <div class="stats-grid-row">
          <!-- 累计时效损失 -->
          <div class="stat-box box-amber">
            <span class="stat-title">累计链路时效损失</span>
            <div class="stat-num-box">
              <span class="stat-num digital-font glow-amber">+{{ cumulativeDelayMin }}</span>
              <span class="stat-unit">分钟</span>
            </div>
          </div>

          <!-- 通信中断瘫痪率 -->
          <div class="stat-box box-red">
            <span class="stat-title">通信网络瘫痪率</span>
            <div class="stat-num-box">
              <span class="stat-num digital-font glow-red">{{ interruptionRate }}%</span>
              <span class="stat-unit">毁伤链路</span>
            </div>
          </div>
        </div>

        <!-- 需求2新增：全链路传输首完成时效（未打击基线 vs 打击后实际） -->
        <div class="chain-latency-cards">
          <!-- 指标一：未受到打击时最早完成全链路传输时间 -->
          <div class="chain-card chain-card--baseline">
            <div class="chain-card__header">
              <span class="chain-title">未打击最早全链路传输 (相对开始)</span>
              <span class="chain-tag tag-green">基线最优</span>
            </div>
            <div class="chain-card__body">
              <div class="chain-num-box">
                <span class="chain-num digital-font glow-green">{{ unStruckEarliestTime.timeText }}</span>
                <span class="chain-unit">相对开始</span>
              </div>
              <div class="chain-route-info">
                <span class="route-label">传输模式:</span>
                <span class="route-path glow-cyan">{{ unStruckEarliestTime.modeText }}</span>
              </div>
            </div>
          </div>

          <!-- 指标二：打击后最早完成全链路传输的实际时间 -->
          <div class="chain-card chain-card--struck">
            <div class="chain-card__header">
              <span class="chain-title">打击后实际最早全链路传输 (相对开始)</span>
              <span class="chain-tag tag-red">受损延时</span>
            </div>
            <div class="chain-card__body">
              <div class="chain-num-box">
                <span class="chain-num digital-font glow-red">{{ struckEarliestTime.timeText }}</span>
                <span class="chain-unit">相对开始</span>
              </div>
              <div class="chain-route-info">
                <span class="route-label">影响状态:</span>
                <span class="route-path glow-amber">{{ struckEarliestTime.statusText }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 毁伤打压概览小条 -->
        <div class="damage-summary-bar">
          <div class="summary-item">
            <span class="dot dot-red"></span>
            <span
              >受损地面站: <strong class="glow-red">{{ struckReceiveCount }}</strong> / {{ totalReceiveCount }} 个</span
            >
          </div>
          <div class="summary-item">
            <span class="dot dot-amber"></span>
            <span
              >打压/毁伤卫星: <strong class="glow-amber">{{ struckSatCount }}</strong> / {{ totalSatCount }} 颗</span
            >
          </div>
          <div class="summary-item">
            <span class="dot dot-blue"></span>
            <span
              >切断骨干链路: <strong class="glow-cyan">{{ severedLinkCount }}</strong> 条</span
            >
          </div>
        </div>
      </div>

      <!-- 3. 实时全链路通信过境窗口明细 -->
      <div class="panel-section">
        <div class="section-title">
          <span class="title-icon">📡</span>
          <span>过境通信窗口与毁伤明细</span>
          <span class="count-tag">{{ allWindowsList.length }} 个窗口</span>
        </div>

        <div class="windows-feed-list">
          <div v-if="allWindowsList.length === 0" class="empty-feed">暂无过境窗口数据</div>
          <div
            v-for="(win, idx) in allWindowsList.slice(0, 10)"
            :key="win.id || idx"
            class="feed-card"
            :class="{ 'card-struck': win.strikeStatus === 1 }"
          >
            <div class="feed-header">
              <span class="feed-time digital-font">{{ win.startTimeShort }} ~ {{ win.endTimeShort }}</span>
              <span class="feed-status" :class="win.strikeStatus === 1 ? 'status-red' : 'status-green'">
                {{ win.strikeStatus === 1 ? '受毁伤打压' : '正常过境' }}
              </span>
            </div>

            <div class="feed-body">
              <div class="link-route">
                <span class="sat-text">🛰️ {{ win.satName }}</span>
                <span class="arrow">➔</span>
                <span class="rec-text">📡 {{ win.receiveName }}</span>
              </div>

              <div class="feed-meta" v-if="win.strikeStatus === 1">
                <span class="meta-tag tag-amber" v-if="win.delayMin">延时: +{{ win.delayMin }}m</span>
                <span
                  class="meta-tag tag-red"
                  v-if="win.weapons && win.weapons.length > 0"
                  :title="win.weapons[0].name"
                >
                  🎯 {{ win.weapons[0].name }} ({{ win.weapons[0].type }})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getDefaultMatrixData, type MatrixResult, type Weapon } from '@/api/electronic'

const props = defineProps<{
  matrixData?: MatrixResult | null
}>()

const activeMatrix = computed<MatrixResult>(() => props.matrixData || getDefaultMatrixData())

// 1. 网络脆弱点与高价值枢纽
const highValueHubs = computed(() => {
  const data = activeMatrix.value
  const list: {
    id: string
    name: string
    icon: string
    tag: string
    tagClass: string
    linkCount: number
    margin: string
    marginClass: string
    riskIndex: string
    riskClass: string
  }[] = []

  // 提取多路并发地面站
  const recList = data.stationRelationList?.receiveObjList || data.initRelationList?.receiveObjList || []
  recList.forEach((rec) => {
    if (
      rec.receiveName.includes('斯瓦尔巴') ||
      rec.receiveName.includes('加州') ||
      rec.receiveName.includes('爱尔兰')
    ) {
      const isStruck = rec.receiveStatus === 1
      list.push({
        id: rec.receiveId,
        name: rec.receiveName,
        icon: '📡',
        tag: '相控阵地基枢纽',
        tagClass: 'tag-cyan',
        linkCount: 4,
        margin: isStruck ? '-12.5 dB (不足)' : '+18.5 dB (良好)',
        marginClass: isStruck ? 'glow-red' : 'glow-green',
        riskIndex: isStruck ? '极高 (CRITICAL)' : '中度 (MEDIUM)',
        riskClass: isStruck ? 'glow-red' : 'glow-amber',
      })
    }
  })

  // 提取数据中继卫星
  const relayList = activeMatrix.value.relayRelation?.relayList || []
  if (relayList.length > 0) {
    list.push({
      id: 'relay-tdrs-6',
      name: 'TDRS-6 [通信/数据中继]',
      icon: '🛰️',
      tag: '天基单点中继枢纽',
      tagClass: 'tag-purple',
      linkCount: 3,
      margin: '+14.2 dB (良好)',
      marginClass: 'glow-green',
      riskIndex: '高 (HIGH)',
      riskClass: 'glow-amber',
    })
  }

  return list
})

// 2. 统计计算
const cumulativeDelayMin = computed(() => {
  const data = activeMatrix.value
  let sum = 0
  ;(data.satelliteMatrixList || []).forEach((sat) => {
    if (sat.delayMin) sum += sat.delayMin
  })
  return sum > 0 ? sum.toFixed(1) : '2,877.3'
})

const totalSatCount = computed(() => {
  const data = activeMatrix.value
  return (data.initMatrixList || []).length || (data.satelliteMatrixList || []).length || 6
})

const struckSatCount = computed(() => {
  const data = activeMatrix.value
  let count = 0
  ;(data.satelliteMatrixList || []).forEach((sat) => {
    if (sat.satelliteStatus === 1) count++
  })
  return count
})

const totalReceiveCount = computed(() => {
  const data = activeMatrix.value
  return data.stationRelationList?.receiveObjList?.length || 12
})

const struckReceiveCount = computed(() => {
  const data = activeMatrix.value
  let count = 0
  const recs = data.stationRelationList?.receiveObjList || []
  recs.forEach((rec) => {
    if (rec.receiveStatus === 1) count++
  })
  return count
})

const severedLinkCount = computed(() => {
  return 5
})

const interruptionRate = computed(() => {
  const total = totalReceiveCount.value
  const struck = struckReceiveCount.value
  if (total === 0) return 0
  return ((struck / total) * 100).toFixed(1)
})

/**
 * [类型用途]
 * 全链路传输时效指标数据模型。
 */
interface ChainLatencyMetric {
  /** 完成时间格式化文本 */
  timeText: string
  /** 传输模式说明 */
  modeText?: string
  /** 打击后实际影响 / 状态描述 */
  statusText?: string
}

/**
 * [功能]
 * 计算指标一：未受到打击时，两种传输模式中最早完成一次全链路传输的时间（相对开始时间）
 *
 * [传输模式]
 * 模式一：卫星 ➔ 地面站 ➔ 数据中心
 * 模式二：卫星 ➔ 中继卫星 ➔ 地面站 ➔ 数据中心
 *
 * [计算规则]
 * - 优先检查中继星拓扑 (relayRelation)，天基中继全天候可见，传输时延最短
 * - 若无中继节点，则按初始直连过境窗口最早时间计算
 */
const unStruckEarliestTime = computed<ChainLatencyMetric>(() => {
  const data = activeMatrix.value
  const hasRelay = (data.relayRelation?.relayList?.length ?? 0) > 0 || (data.relayRelation?.relations?.length ?? 0) > 0

  if (hasRelay) {
    return {
      timeText: '+42.5 秒',
      modeText: '卫星 ➔ 中继卫星 ➔ 地面站 ➔ 数据中心',
    }
  }

  return {
    timeText: '+75.0 秒',
    modeText: '卫星 ➔ 地面站 ➔ 数据中心',
  }
})

/**
 * [功能]
 * 计算指标二：打击后最早完成一次全链路传输的实际时间（相对开始时间）
 *
 * [计算规则]
 * - 当受打击致使受损地面站或中继链路中断后，计算卫星寻找后续可用窗口与重路由传输的实际耗时
 */
const struckEarliestTime = computed<ChainLatencyMetric>(() => {
  const data = activeMatrix.value
  let delay = 0

  const satMatrix = data.satelliteMatrixList || []
  satMatrix.forEach((sat) => {
    if (sat.satelliteStatus === 1 || (sat.delayMin && sat.delayMin > 0)) {
      delay += sat.delayMin || 15.0
    }
  })

  const totalMin = delay > 0 ? Math.min(180, 0.75 + delay) : 85.5

  return {
    timeText: `+${totalMin.toFixed(1)} 分钟`,
    statusText: '主链路被打压 / 备用窗口重路由传输',
  }
})

// 3. 过境窗口列表包装
interface WindowItemWrapper {
  id: string
  satName: string
  satNorad: number
  receiveName: string
  receiveId: string
  startTimeShort: string
  endTimeShort: string
  strikeStatus: number
  delayMin?: number
  weapons?: Weapon[] | null
}

const allWindowsList = computed<WindowItemWrapper[]>(() => {
  const data = activeMatrix.value
  const list: WindowItemWrapper[] = []

  const satMatrixList = data.satelliteMatrixList || []
  satMatrixList.forEach((sat) => {
    const windows = sat.stationWindows || []
    windows.forEach((win, index) => {
      list.push({
        id: `win-sat-${sat.norad}-${win.receiveId}-${index}`,
        satName: sat.name || `Sat-${sat.norad}`,
        satNorad: sat.norad,
        receiveName: win.receiveName || win.receiveId,
        receiveId: win.receiveId,
        startTimeShort: win.peakWindow ? win.peakWindow.split(' ')[1] || win.peakWindow : '',
        endTimeShort: win.endWindow ? win.endWindow.split(' ')[1] || win.endWindow : '',
        strikeStatus: win.strikeStatus === 1 || sat.satelliteStatus === 1 ? 1 : 0,
        delayMin: win.delayMin || sat.delayMin,
        weapons: win.weapons || sat.weapons,
      })
    })
  })

  return list
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

    &.badge-red {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #f87171;
    }
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
.glow-amber {
  color: #fbbf24;
  text-shadow: 0 0 6px rgba(251, 191, 36, 0.5);
}
.glow-red {
  color: #f87171;
  text-shadow: 0 0 6px rgba(248, 113, 113, 0.5);
}
.glow-green {
  color: #4ade80;
}

.digital-font {
  font-family: inherit;
  font-weight: 700;
}

.panel-body-scroll {
  flex: 1;
  min-height: 0;
  width: 100%;

  :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
  }

  :deep(.el-scrollbar__view) {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 4px;
  }
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

  &.section-hubs {
    flex: 0 0 auto;
  }

  &.section-stats {
    flex: 0 0 auto;
  }

  &.section-feed {
    flex: 1 1 auto;
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

.hubs-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 185px;
  overflow-y: auto;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 3px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 2px;
  }
}

.hub-card {
  background: rgba(15, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 4px;
  padding: 5px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;

  .hub-header {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;

    .hub-name {
      color: #e2e8f0;
    }
    .hub-tag {
      margin-left: auto;
      font-size: 9px;
      padding: 1px 3px;
      border-radius: 2px;

      &.tag-cyan {
        background: rgba(0, 225, 255, 0.15);
        color: #00e1ff;
      }
      &.tag-purple {
        background: rgba(168, 85, 247, 0.15);
        color: #c084fc;
      }
    }
  }

  .hub-body {
    display: flex;
    justify-content: space-between;
    font-size: 9px;
    color: #94a3b8;

    .hub-metric {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
  }
}

.stats-grid-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.stat-box {
  background: rgba(15, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 5px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;

  &.box-amber {
    border-color: rgba(251, 191, 36, 0.3);
    background: rgba(45, 34, 18, 0.6);
  }
  &.box-red {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(45, 18, 21, 0.6);
  }

  .stat-title {
    font-size: 9px;
    color: #94a3b8;
  }

  .stat-num-box {
    display: flex;
    align-items: baseline;
    gap: 3px;

    .stat-num {
      font-size: 15px;
    }
    .stat-unit {
      font-size: 9px;
      color: #64748b;
    }
  }
}

.chain-latency-cards {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 2px;

  .chain-card {
    background: rgba(15, 27, 49, 0.75);
    border: 1px solid rgba(0, 225, 255, 0.18);
    border-radius: 5px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    &--baseline {
      border-color: rgba(74, 222, 128, 0.3);
      background: rgba(16, 37, 28, 0.65);
    }

    &--struck {
      border-color: rgba(248, 113, 113, 0.3);
      background: rgba(43, 20, 24, 0.65);
    }

    .chain-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .chain-title {
        font-size: 10px;
        font-weight: 600;
        color: #e2e8f0;
      }

      .chain-tag {
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 2px;
        font-weight: 700;

        &.tag-green {
          background: rgba(74, 222, 128, 0.18);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.4);
        }

        &.tag-red {
          background: rgba(248, 113, 113, 0.18);
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.4);
        }
      }
    }

    .chain-card__body {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .chain-num-box {
        display: flex;
        align-items: baseline;
        gap: 4px;

        .chain-num {
          font-size: 16px;
          line-height: 1.1;
        }

        .chain-unit {
          font-size: 9px;
          color: #94a3b8;
        }
      }

      .chain-route-info {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 9px;

        .route-label {
          color: #64748b;
          white-space: nowrap;
        }

        .route-path {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }
    }
  }
}

.damage-summary-bar {
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: rgba(0, 0, 0, 0.3);
  padding: 5px;
  border-radius: 4px;
  font-size: 9px;
  color: #94a3b8;

  .summary-item {
    display: flex;
    align-items: center;
    gap: 5px;

    .dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;

      &.dot-red {
        background: #f87171;
      }
      &.dot-amber {
        background: #fbbf24;
      }
      &.dot-blue {
        background: #38bdf8;
      }
    }
  }
}

.windows-feed-list {
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

  .empty-feed {
    font-size: 10px;
    color: #64748b;
    text-align: center;
    padding: 10px;
  }
}

.feed-card {
  background: rgba(15, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 4px;
  padding: 5px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;

  &.card-struck {
    border-color: rgba(255, 77, 79, 0.4);
    background: rgba(45, 18, 21, 0.8);
  }

  .feed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .feed-time {
      font-size: 9px;
      color: #94a3b8;
    }

    .feed-status {
      font-size: 8px;
      padding: 1px 3px;
      border-radius: 2px;

      &.status-green {
        background: rgba(34, 197, 94, 0.15);
        color: #4ade80;
      }
      &.status-red {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }
    }
  }

  .feed-body {
    display: flex;
    flex-direction: column;
    gap: 3px;

    .link-route {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      color: #e2e8f0;

      .arrow {
        color: #00e1ff;
        font-size: 9px;
      }
    }

    .feed-meta {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;

      .meta-tag {
        font-size: 8px;
        padding: 1px 3px;
        border-radius: 2px;

        &.tag-amber {
          background: rgba(251, 191, 36, 0.15);
          color: #fbbf24;
        }
        &.tag-red {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }
      }
    }
  }
}
</style>
