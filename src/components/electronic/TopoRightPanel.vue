<template>
  <aside class="topo-panel topo-panel--right dark-theme">
    <!-- 面板标题与视图切换 Tabs -->
    <div class="panel-header">
      <div class="header-left-title">
        <span class="header-icon">📊</span>
        <span class="header-title">链路决策与详情</span>
      </div>
      <div class="tab-switcher">
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'priority' }"
          @click="activeTab = 'priority'"
        >
          <span>🎯 优先推荐</span>
          <span class="tab-count-badge" v-if="top3PriorityLinks.length">TOP 3</span>
        </button>
        <button
          type="button"
          class="tab-btn"
          :class="{ active: activeTab === 'detail' }"
          @click="activeTab = 'detail'"
        >
          <span>🔍 节点/详情</span>
          <span class="tab-dot" v-if="detail"></span>
        </button>
      </div>
    </div>

    <!-- 1. 优先打击链路推荐 (TOP 3) 视图 -->
    <template v-if="activeTab === 'priority'">
      <div v-if="!matrixData" class="empty-box">
        <span class="empty-icon">📡</span>
        <p>暂无矩阵数据，请先选择任务与卫星系列</p>
      </div>

      <div v-else-if="!top3PriorityLinks.length" class="empty-box">
        <span class="empty-icon">📭</span>
        <p>当前范围内未检索到可评估的传输链路</p>
      </div>

      <el-scrollbar v-else class="priority-scroll">
        <!-- 权重配置说明 Banner -->
        <div class="weight-banner">
          <div class="weight-banner-title">
            <span class="banner-icon">⚖️</span>
            <span>多维归一化决策权重</span>
          </div>
          <div class="weight-tags-row">
            <span class="weight-chip chip--threat">
              <span class="chip-dot"></span>威胁度 {{ (DEFAULT_PRIORITY_WEIGHTS.threat * 100).toFixed(0) }}%
            </span>
            <span class="weight-chip chip--time">
              <span class="chip-dot"></span>时效 {{ (DEFAULT_PRIORITY_WEIGHTS.earlyTime * 100).toFixed(0) }}%
            </span>
            <span class="weight-chip chip--iso">
              <span class="chip-dot"></span>孤立度 {{ (DEFAULT_PRIORITY_WEIGHTS.isolation * 100).toFixed(0) }}%
            </span>
            <span class="weight-chip chip--relay">
              <span class="chip-dot"></span>中继 {{ (DEFAULT_PRIORITY_WEIGHTS.relay * 100).toFixed(0) }}%
            </span>
          </div>
        </div>

        <!-- TOP 3 推荐链路列表 -->
        <div class="top-list">
          <div
            v-for="item in top3PriorityLinks"
            :key="item.link.id"
            class="priority-card"
            :class="[
              `rank-${item.priority.rank}`,
              {
                active: selectedLinkId === item.link.id,
                struck: item.link.struck,
              },
            ]"
            role="button"
            tabindex="0"
            @click="handleSelectPriorityLink(item.link.id)"
          >
            <!-- 卡片头部：名次、综合得分、状态 -->
            <div class="card-header-row">
              <div class="rank-badge-wrap">
                <span class="rank-badge" :class="`rank-badge--${item.priority.rank}`">
                  <span class="medal-icon">{{ getRankMedal(item.priority.rank) }}</span>
                  <span class="rank-text">TOP {{ item.priority.rank }}</span>
                </span>
                <span class="priority-score-pill">
                  <span class="score-label">优先级评分</span>
                  <strong class="score-number">{{ item.priority.totalScore }}</strong>
                  <span class="score-unit">分</span>
                </span>
              </div>
              <span class="status-badge" :class="item.link.struck ? 'struck' : 'ok'">
                {{ item.link.struck ? '已打击' : '优先压制' }}
              </span>
            </div>

            <!-- 链路路径流 -->
            <div class="link-path-flow">
              <template v-for="(node, idx) in item.link.nodes" :key="idx">
                <span class="flow-node" :class="`flow-node--${node.layer.toLowerCase()}`">
                  <span class="flow-icon">{{ node.icon }}</span>
                  <span class="flow-name" :title="node.name">{{ node.name }}</span>
                </span>
                <span v-if="idx < item.link.nodes.length - 1" class="flow-arrow">→</span>
              </template>
            </div>

            <!-- 四维归一化得分指示条 -->
            <div class="dimension-grid">
              <div class="dim-item">
                <span class="dim-label">🚨 卫星威胁</span>
                <div class="dim-val-bar">
                  <div
                    class="dim-fill dim-fill--threat"
                    :style="{ width: `${item.priority.threatScoreNorm * 100}%` }"
                  ></div>
                </div>
                <span class="dim-score">{{ item.priority.threatScoreRaw.toFixed(0) }}分</span>
              </div>

              <div class="dim-item">
                <span class="dim-label">⏱️ 传输时效</span>
                <div class="dim-val-bar">
                  <div
                    class="dim-fill dim-fill--time"
                    :style="{ width: `${item.priority.earlyTimeNorm * 100}%` }"
                  ></div>
                </div>
                <span class="dim-score">{{ (item.priority.earlyTimeNorm * 100).toFixed(0) }}%</span>
              </div>

              <div class="dim-item">
                <span class="dim-label">🔗 链路孤立</span>
                <div class="dim-val-bar">
                  <div
                    class="dim-fill dim-fill--iso"
                    :style="{ width: `${item.priority.isolationNorm * 100}%` }"
                  ></div>
                </div>
                <span class="dim-score">{{ item.priority.satelliteLinkCount === 1 ? '独占' : `${item.priority.satelliteLinkCount}条` }}</span>
              </div>

              <div class="dim-item">
                <span class="dim-label">📡 节点类型</span>
                <div class="dim-val-bar">
                  <div
                    class="dim-fill dim-fill--relay"
                    :style="{ width: `${item.priority.relayNorm * 100}%` }"
                  ></div>
                </div>
                <span class="dim-score">{{ item.priority.isRelay ? '中继' : '直连' }}</span>
              </div>
            </div>

            <!-- 详细推荐原因盒子 -->
            <div class="reason-box">
              <div class="reason-title">
                <span class="reason-icon">💡</span>
                <strong>优先级推荐原因</strong>
                <div class="reason-tags-inline">
                  <span v-for="tag in item.priority.reasonTags" :key="tag" class="reason-tag">
                    {{ tag }}
                  </span>
                </div>
              </div>
              <div class="reason-content">
                <ul class="reason-points">
                  <li>
                    <strong class="point-label">目标威胁：</strong>
                    <span>{{ item.priority.reasonDetails.threatText }}</span>
                  </li>
                  <li>
                    <strong class="point-label">传输窗口：</strong>
                    <span>{{ item.priority.reasonDetails.timeText }}</span>
                  </li>
                  <li>
                    <strong class="point-label">拓扑孤立：</strong>
                    <span>{{ item.priority.reasonDetails.isolationText }}</span>
                  </li>
                  <li>
                    <strong class="point-label">节点特性：</strong>
                    <span>{{ item.priority.reasonDetails.relayText }}</span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- 底部操作按钮 -->
            <div class="card-footer-actions">
              <span class="action-hint">
                {{ selectedLinkId === item.link.id ? '✓ 当前已在拓扑中高亮' : '点击在拓扑图中高亮此链路' }}
              </span>
              <el-button
                size="small"
                link
                type="primary"
                class="view-detail-link"
                @click.stop="viewLinkFullDetail(item.link.id)"
              >
                查看完整参数 →
              </el-button>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </template>

    <!-- 2. 选中节点 / 链路详情 视图 -->
    <template v-else>
      <div v-if="!detail" class="empty-box">
        <span class="empty-icon">👆</span>
        <p>请在左侧链路清单或中间拓扑中选择节点/链路查看详细参数</p>
        <el-button size="small" type="primary" class="switch-priority-btn" @click="activeTab = 'priority'">
          返回优先推荐 (TOP 3)
        </el-button>
      </div>

      <el-scrollbar v-else class="detail-scroll">
        <div class="detail-card" :class="{ struck: detail.struck, ok: !detail.struck }">
          <div class="detail-head">
            <span class="detail-icon">{{ detail.icon }}</span>
            <div class="detail-text">
              <div v-if="detail.linkNodes?.length" class="detail-path">
                <template v-for="(node, idx) in detail.linkNodes" :key="idx">
                  <span class="path-node" :class="`path-node--${node.layer}`">
                    <span class="path-icon">{{ node.icon }}</span>
                    <span class="path-name">{{ node.name }}</span>
                  </span>
                  <span v-if="idx < detail.linkNodes.length - 1" class="path-arrow">→</span>
                </template>
              </div>
              <div v-else class="detail-name">{{ detail.name }}</div>
              <div class="detail-type">{{ detail.typeLabel }}</div>
            </div>
            <span class="status-badge" :class="detail.struck ? 'struck' : 'ok'">
              {{ detail.struck ? '被打击' : '正常' }}
            </span>
          </div>

          <div class="meta-grid">
            <div
              v-for="row in detail.metaRows"
              :key="row.label"
              class="meta-row"
              :class="row.tone ? `meta-row--${row.tone}` : ''"
            >
              <span class="meta-label">{{ row.label }}</span>
              <strong class="meta-val">{{ row.value }}</strong>
            </div>
          </div>
        </div>

        <div v-if="detail.windows?.length" class="section-block section-block--windows">
          <div class="section-title">过境时间窗口</div>
          <div v-for="(win, idx) in detail.windows" :key="idx" class="window-item" :class="{ struck: win.struck }">
            <div class="window-top">
              <div class="window-title-wrap">
                <span v-if="win.subjectLabel" class="window-subject">{{ win.subjectLabel }}</span>
                <span class="window-name">{{ win.title }}</span>
              </div>
              <span class="strike-tag" :class="win.struck ? 'struck' : 'ok'">
                {{ win.struck ? '已打击' : '正常' }}
              </span>
            </div>
            <div class="window-time-row">
              <span class="window-field-label">时间</span>
              <span class="window-time">{{ win.timeText }}</span>
            </div>
            <div v-if="win.delayMin > 0" class="window-delay-row">
              <span class="window-field-label">延迟</span>
              <span class="window-delay">+{{ win.delayMin }} 分钟</span>
            </div>
            <div v-if="win.weapons?.length" class="window-weapons-row">
              <span class="window-field-label">武器</span>
              <span class="window-weapons">{{ win.weapons.join('、') }}</span>
            </div>
          </div>
        </div>

        <div v-if="detail.weapons?.length" class="section-block">
          <div class="section-title">关联武器</div>
          <div class="weapon-chips">
            <span v-for="weapon in detail.weapons" :key="weapon" class="weapon-chip">{{ weapon }}</span>
          </div>
        </div>

        <div v-if="detail.linkNodes?.length" class="section-block">
          <div class="section-title">拓扑节点</div>
          <div v-for="(node, idx) in detail.linkNodes" :key="idx" class="conn-item" :class="`conn-item--${node.layer}`">
            <span class="conn-icon">{{ node.icon }}</span>
            <span class="conn-layer">{{ node.layerLabel }}</span>
            <span class="conn-name">{{ node.name }}</span>
          </div>
        </div>

        <div v-else-if="detail.connections?.length" class="section-block">
          <div class="section-title">拓扑关联</div>
          <div v-for="(conn, idx) in detail.connections" :key="idx" class="conn-item" :class="`conn-item--${conn.layer}`">
            <span class="conn-icon">{{ conn.icon }}</span>
            <span class="conn-layer">{{ conn.direction === 'up' ? '←' : '→' }} {{ conn.layerLabel }}</span>
            <span class="conn-name">{{ conn.name }}</span>
          </div>
        </div>
      </el-scrollbar>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { MatrixResult, StationRelationList } from '@/api/electronic'
import {
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  findTransmissionLinkById,
  rankTransmissionLinksByPriority,
  resolveLinkStrikeTarget,
  DEFAULT_PRIORITY_WEIGHTS,
  type PrioritizedTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'

/** 节点详情窗口项 */
interface DetailWindowItem {
  title: string
  subjectLabel?: string
  timeText: string
  struck: boolean
  delayMin: number
  weapons: string[]
}

/** 详情链路节点项 */
interface DetailLinkNode {
  name: string
  icon: string
  layer: 'sat' | 'relay' | 'receive' | 'station'
  layerLabel: string
}

/** 元信息行 */
interface DetailMetaRow {
  label: string
  value: string
  tone?: 'time' | 'delay' | 'weapon' | 'strike' | 'neutral'
}

/** 拓扑关联项 */
interface DetailConnectionItem {
  icon: string
  layerLabel: string
  name: string
  layer: 'receive' | 'station'
  direction: 'up' | 'down'
}

/** 节点详情展示模型 */
interface NodeDetailView {
  icon: string
  name: string
  typeLabel: string
  struck: boolean
  metaRows: DetailMetaRow[]
  linkNodes?: DetailLinkNode[]
  windows?: DetailWindowItem[]
  weapons?: string[]
  connections?: DetailConnectionItem[]
}

const props = defineProps<{
  matrixData: MatrixResult | null
  selectedNorad?: number | null
  /** 当前选中的链路 ID */
  selectedLinkId?: string | null
  selectedNodeId?: string | null
  selectedNodeLayer?: 'sat' | 'receive' | 'station' | 'relay' | null
}>()

const emit = defineEmits<{
  (e: 'select-link', linkId: string | null): void
}>()

/** 当前激活的面板视图：'priority' 为 TOP 3 优先推荐，'detail' 为详细参数 */
const activeTab = ref<'priority' | 'detail'>('priority')

/** 监听选中节点变化：若用户点击了特定节点，则自动切到详情视图 */
watch(
  () => [props.selectedNodeId, props.selectedNodeLayer] as const,
  ([nodeId]) => {
    if (nodeId) {
      activeTab.value = 'detail'
    }
  }
)

/** 提取奖牌 Emoji */
const getRankMedal = (rank: number): string => {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return '🎖️'
}

/** 当前范围内计算出的全部链路按优先级排序结果 */
const prioritizedLinks = computed<PrioritizedTransmissionLink[]>(() => {
  const data = props.matrixData
  if (!data) return []

  const rawLinks = props.selectedNorad
    ? collectSatelliteTransmissionLinks(data, props.selectedNorad)
    : collectSeriesTransmissionLinks(data)

  return rankTransmissionLinksByPriority(data, rawLinks, DEFAULT_PRIORITY_WEIGHTS)
})

/** 前三条优先级最高的推荐链路 */
const top3PriorityLinks = computed<PrioritizedTransmissionLink[]>(() => {
  return prioritizedLinks.value.slice(0, 3)
})

/** 选择某条高优先级推荐链路 */
const handleSelectPriorityLink = (linkId: string) => {
  const nextId = props.selectedLinkId === linkId ? null : linkId
  emit('select-link', nextId)
}

/** 从推荐卡片中跳转查看完整参数详情 */
const viewLinkFullDetail = (linkId: string) => {
  emit('select-link', linkId)
  activeTab.value = 'detail'
}

/** 过境窗口时间字段（兼容 StationWindow / InitWindow 等） */
interface WindowTimeFields {
  peakWindow?: string | null
  startWindow?: string | null
  beginWindow?: string | null
  endWindow?: string | null
}

const getWindowStart = (win: WindowTimeFields): string =>
  win.peakWindow || win.startWindow || win.beginWindow || ''

const getWindowEnd = (win: WindowTimeFields): string => win.endWindow || ''

const layerLabelMap: Record<DetailLinkNode['layer'], string> = {
  sat: '卫星',
  relay: '中继',
  receive: '地面站',
  station: '数据中心',
}

const mapLinkLayer = (layer: string): DetailLinkNode['layer'] => {
  if (layer === 'RELAY') return 'relay'
  if (layer === 'RECEIVE') return 'receive'
  if (layer === 'STATION') return 'station'
  return 'sat'
}

const getPanelRelationData = (data: MatrixResult): StationRelationList => {
  if (data.stationRelationList?.relations?.length) return data.stationRelationList
  return data.initRelationList || { receiveObjList: [], stationObjList: [], relations: [] }
}

const buildUniqueConnections = (
  relations: StationRelationList['relations'],
  relationData: StationRelationList,
  mode: 'receive-down' | 'station-up'
): DetailConnectionItem[] => {
  const seen = new Set<string>()
  const items: DetailConnectionItem[] = []

  relations.forEach((rel) => {
    const key = `${rel.from}->${rel.to}`
    if (seen.has(key)) return
    seen.add(key)

    if (mode === 'receive-down') {
      const st = relationData.stationObjList?.find((s) => s.stationId === rel.to)
      items.push({
        icon: '💻',
        layerLabel: '数据中心',
        name: st?.stationName || rel.to,
        layer: 'station',
        direction: 'down',
      })
      return
    }

    const rec = relationData.receiveObjList?.find((r) => r.receiveId === rel.from)
    items.push({
      icon: '📡',
      layerLabel: '地面站',
      name: rec?.receiveName || rel.from,
      layer: 'receive',
      direction: 'up',
    })
  })

  return items
}

const detail = computed<NodeDetailView | null>(() => {
  const data = props.matrixData
  if (!data) return null

  if (props.selectedLinkId) {
    const link = findTransmissionLinkById(data, props.selectedLinkId, props.selectedNorad)
    if (!link) return null
    const linkNodes: DetailLinkNode[] = link.nodes.map((n) => {
      const layer = mapLinkLayer(n.layer)
      return {
        name: n.name,
        icon: n.icon,
        layer,
        layerLabel: layerLabelMap[layer],
      }
    })
    return {
      icon: '🔗',
      name: link.nodes.map((n) => n.name).join(' → '),
      typeLabel: '传输链路',
      struck: link.struck,
      linkNodes,
      metaRows: [
        { label: '传输时间', value: link.transmitTime, tone: 'time' },
        { label: '完成时间', value: link.finishTime, tone: 'time' },
        { label: '打击目标', value: link.struck ? link.strikeTargetLabel : '无', tone: link.struck ? 'strike' : 'neutral' },
        { label: '延迟', value: link.delayText, tone: 'delay' },
        { label: '武器', value: link.weaponNames || '无', tone: link.weaponNames ? 'weapon' : 'neutral' },
      ],
    }
  }

  if (props.selectedNorad != null && !props.selectedNodeId) {
    const norad = props.selectedNorad
    const postSat = data.satelliteMatrixList?.find((s) => s.norad === norad)
    const initSat = data.initMatrixList?.find((s) => s.norad === norad)
    const sat = postSat || initSat
    if (!sat) return null

    const windows = (postSat?.stationWindows || []).map((win) => ({
      title: win.receiveName || win.receiveId || '地面站',
      timeText: `${getWindowStart(win)} ~ ${getWindowEnd(win) || getWindowStart(win)}`,
      struck: win.strikeStatus === 1,
      delayMin: Number(win.delayMin) || 0,
      weapons: (win.weapons || []).map((w) => w.name).filter(Boolean),
    }))

    const satWeapons = (postSat?.weapons || []).map((w) => w.name).filter(Boolean)

    return {
      icon: '🛰️',
      name: sat.name,
      typeLabel: sat.satType || '敌方卫星',
      struck: postSat?.satelliteStatus === 1,
      metaRows: [
        { label: 'NORAD', value: String(norad) },
        { label: '链路延迟', value: `${postSat?.delayMin ?? 0} 分钟` },
        { label: '过境窗口', value: `${windows.length} 个` },
      ],
      windows,
      weapons: satWeapons,
    }
  }

  const nodeId = props.selectedNodeId
  if (!nodeId) return null

  const relationData = getPanelRelationData(data)
  const receive = relationData.receiveObjList?.find((rec) => rec.receiveId === nodeId)
  if (receive || props.selectedNodeLayer === 'receive') {
    const recObj = receive || relationData.receiveObjList?.find((r) => r.receiveId === nodeId)
    const focusedLinks = props.selectedNorad
      ? collectSatelliteTransmissionLinks(data, props.selectedNorad).filter((link) => link.receiveId === nodeId)
      : []

    const windows: DetailWindowItem[] = focusedLinks.length
      ? focusedLinks.map((link) => ({
        subjectLabel: '关联卫星',
        title: resolveSatName(data, props.selectedNorad!),
        timeText: link.transmitTime,
        struck: link.struck,
        delayMin: link.delayMin,
        weapons: link.weaponNames && link.weaponNames !== '未打击' ? link.weaponNames.split('、') : [],
      }))
      : []
    if (!windows.length) {
      ; (data.satelliteMatrixList || []).forEach((sat) => {
        if (props.selectedNorad && sat.norad !== props.selectedNorad) return
          ; (sat.stationWindows || []).forEach((win) => {
            if (win.receiveId !== nodeId && win.receiveName !== recObj?.receiveName) return
            const strikeTarget = resolveLinkStrikeTarget(win, sat)
            windows.push({
              subjectLabel: '关联卫星',
              title: sat.name,
              timeText: `${getWindowStart(win)} ~ ${getWindowEnd(win) || getWindowStart(win)}`,
              struck: strikeTarget.struck,
              delayMin: Number(win.delayMin) || 0,
              weapons: (win.weapons || []).map((w) => w.name).filter(Boolean),
            })
          })
      })
    }

    const connections = buildUniqueConnections(
      (relationData.relations || []).filter((rel) => rel.from === nodeId),
      relationData,
      'receive-down'
    )

    const linkMeta = focusedLinks[0]
    return {
      icon: '📡',
      name: recObj?.receiveName || nodeId,
      typeLabel: '地面接收站',
      struck: linkMeta ? linkMeta.receiveStruck : recObj?.receiveStatus === 1,
      metaRows: [
        { label: '关联窗口', value: `${windows.length} 个` },
        ...(linkMeta
          ? [
            { label: '打击目标', value: linkMeta.struck ? linkMeta.strikeTargetLabel : '无', tone: linkMeta.struck ? ('strike' as const) : ('neutral' as const) },
            { label: '延迟', value: linkMeta.delayText, tone: 'delay' as const },
          ]
          : []),
      ],
      windows,
      connections,
    }
  }

  const station = relationData.stationObjList?.find((st) => st.stationId === nodeId)
  if (station || props.selectedNodeLayer === 'station') {
    const stObj = station || relationData.stationObjList?.find((s) => s.stationId === nodeId)
    const connections = buildUniqueConnections(
      (relationData.relations || []).filter((rel) => rel.to === nodeId),
      relationData,
      'station-up'
    )

    return {
      icon: '💻',
      name: stObj?.stationName || nodeId,
      typeLabel: '数据中心',
      struck: stObj?.stationStatus === 1,
      metaRows: [
        { label: '中心 ID', value: nodeId },
        { label: '上联地面站', value: `${connections.length} 个` },
      ],
      connections,
    }
  }

  return null
})

const resolveSatName = (data: MatrixResult, norad: number): string => {
  const sat =
    data.satelliteMatrixList?.find((s) => s.norad === norad) ||
    data.initMatrixList?.find((s) => s.norad === norad)
  return sat?.name || `Sat-${norad}`
}
</script>

<style lang="scss" scoped>
.topo-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px 12px;
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
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  margin-bottom: 8px;

  .header-left-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    color: #40f2ff;
    white-space: nowrap;
  }
}

.tab-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(14, 25, 42, 0.9);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgba(0, 225, 255, 0.18);

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      color: #e2efff;
      background: rgba(0, 225, 255, 0.08);
    }

    &.active {
      background: rgba(0, 225, 255, 0.18);
      color: #40f2ff;
      border: 1px solid rgba(0, 225, 255, 0.35);
      box-shadow: 0 0 8px rgba(0, 225, 255, 0.2);
    }

    .tab-count-badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(234, 179, 8, 0.25);
      color: #facc15;
      font-weight: 700;
    }

    .tab-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #40f2ff;
    }
  }
}

.priority-scroll,
.detail-scroll {
  flex: 1;
  min-height: 0;
}

.weight-banner {
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: rgba(14, 25, 42, 0.85);
  border: 1px solid rgba(0, 225, 255, 0.15);

  .weight-banner-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    color: #7dd3fc;
    margin-bottom: 6px;
  }

  .weight-tags-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .weight-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    background: rgba(8, 18, 32, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #cbd5e1;

    .chip-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
    }

    &.chip--threat .chip-dot { background: #f87171; }
    &.chip--time .chip-dot { background: #fbbf24; }
    &.chip--iso .chip-dot { background: #34d399; }
    &.chip--relay .chip-dot { background: #c084fc; }
  }
}

.top-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 8px;
}

.priority-card {
  position: relative;
  box-sizing: border-box;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(14, 25, 42, 0.85);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-left: 4px solid #38bdf8;
  cursor: pointer;
  transition: all 0.25s ease;
  text-align: left;

  &:hover {
    background: rgba(20, 36, 60, 0.92);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(0, 225, 255, 0.15);
  }

  &.active {
    border-color: #00e1ff;
    box-shadow: 0 0 14px rgba(0, 225, 255, 0.3), inset 0 0 12px rgba(0, 225, 255, 0.08);
    background: linear-gradient(135deg, rgba(0, 225, 255, 0.15) 0%, rgba(14, 28, 48, 0.95) 100%);
  }

  &.rank-1 {
    border-left-color: #eab308;
    background: linear-gradient(180deg, rgba(30, 26, 16, 0.85) 0%, rgba(14, 25, 42, 0.85) 100%);
    border-color: rgba(234, 179, 8, 0.35);

    &.active {
      border-color: #facc15;
      box-shadow: 0 0 16px rgba(234, 179, 8, 0.35);
    }
  }

  &.rank-2 {
    border-left-color: #38bdf8;
    background: linear-gradient(180deg, rgba(16, 28, 42, 0.85) 0%, rgba(14, 25, 42, 0.85) 100%);
    border-color: rgba(56, 189, 248, 0.35);

    &.active {
      border-color: #38bdf8;
      box-shadow: 0 0 16px rgba(56, 189, 248, 0.35);
    }
  }

  &.rank-3 {
    border-left-color: #fb923c;
    background: linear-gradient(180deg, rgba(30, 22, 16, 0.85) 0%, rgba(14, 25, 42, 0.85) 100%);
    border-color: rgba(251, 146, 60, 0.35);

    &.active {
      border-color: #fb923c;
      box-shadow: 0 0 16px rgba(251, 146, 60, 0.35);
    }
  }

  .card-header-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .rank-badge-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rank-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.5px;

    &--1 {
      background: linear-gradient(135deg, rgba(234, 179, 8, 0.3) 0%, rgba(180, 83, 9, 0.4) 100%);
      color: #fef08a;
      border: 1px solid rgba(234, 179, 8, 0.6);
      text-shadow: 0 0 6px rgba(234, 179, 8, 0.6);
    }

    &--2 {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(2, 132, 199, 0.4) 100%);
      color: #bae6fd;
      border: 1px solid rgba(56, 189, 248, 0.6);
      text-shadow: 0 0 6px rgba(56, 189, 248, 0.6);
    }

    &--3 {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.3) 0%, rgba(194, 65, 12, 0.4) 100%);
      color: #fed7aa;
      border: 1px solid rgba(249, 115, 22, 0.6);
      text-shadow: 0 0 6px rgba(249, 115, 22, 0.6);
    }
  }

  .priority-score-pill {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.08);
    border: 1px solid rgba(0, 225, 255, 0.25);

    .score-label {
      font-size: 9px;
      color: #94a3b8;
    }

    .score-number {
      font-size: 14px;
      font-weight: 800;
      color: #40f2ff;
      font-family: Consolas, monospace;
    }

    .score-unit {
      font-size: 9px;
      color: #7dd3fc;
    }
  }
}

.link-path-flow {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px 4px;
  padding: 6px 8px;
  margin-bottom: 8px;
  border-radius: 4px;
  background: rgba(8, 15, 26, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.06);

  .flow-node {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 700;

    .flow-icon {
      font-size: 11px;
    }

    &--sat .flow-name { color: #67e8f9; }
    &--relay .flow-name { color: #c4b5fd; }
    &--receive .flow-name { color: #5eead4; }
    &--station .flow-name { color: #93c5fd; }
  }

  .flow-arrow {
    color: #475569;
    font-size: 10px;
  }
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 10px;
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(8, 18, 32, 0.5);

  .dim-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;

    .dim-label {
      color: #94a3b8;
      width: 60px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .dim-val-bar {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 2px;
      overflow: hidden;

      .dim-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;

        &--threat { background: linear-gradient(90deg, #f87171, #ef4444); }
        &--time { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
        &--iso { background: linear-gradient(90deg, #34d399, #10b981); }
        &--relay { background: linear-gradient(90deg, #c084fc, #a855f7); }
      }
    }

    .dim-score {
      font-size: 10px;
      font-weight: 700;
      color: #e2efff;
      width: 28px;
      text-align: right;
      flex-shrink: 0;
    }
  }
}

.reason-box {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(12, 22, 38, 0.95);
  border: 1px solid rgba(0, 225, 255, 0.2);
  margin-bottom: 6px;

  .reason-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 11px;
    color: #40f2ff;
    margin-bottom: 6px;

    strong {
      font-weight: 700;
    }
  }

  .reason-tags-inline {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-left: auto;
  }

  .reason-tag {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(0, 225, 255, 0.12);
    border: 1px solid rgba(0, 225, 255, 0.25);
    color: #7dd3fc;
  }

  .reason-points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    line-height: 1.45;
    color: #cbd5e1;

    li {
      position: relative;
      padding-left: 10px;

      &::before {
        content: '•';
        position: absolute;
        left: 0;
        top: 0;
        color: #00e1ff;
      }
    }

    .point-label {
      color: #93c5fd;
      font-weight: 600;
    }
  }
}

.card-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  font-size: 10px;

  .action-hint {
    color: #64748b;
  }

  .view-detail-link {
    font-size: 10px;
    padding: 0;
    height: auto;
  }
}

.switch-priority-btn {
  margin-top: 10px;
}

.detail-card {
  padding: 12px;
  border-radius: 8px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(79, 147, 221, 0.2);
  border-left: 3px solid #00e1ff;
  margin-bottom: 12px;
  text-align: left;

  &.struck {
    border-left-color: #94a3b8;
    background: rgba(30, 35, 45, 0.75);
  }
}

.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .detail-icon {
    font-size: 22px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .detail-text {
    flex: 1;
    min-width: 0;
    text-align: left;
  }

  .detail-path {
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
    font-weight: 700;

    .path-icon { font-size: 12px; }
    &--sat .path-name { color: #67e8f9; }
    &--relay .path-name { color: #c4b5fd; }
    &--receive .path-name { color: #5eead4; }
    &--station .path-name { color: #93c5fd; }
  }

  .path-arrow {
    color: #475569;
    font-size: 11px;
  }

  .detail-name {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    word-break: break-all;
  }

  .detail-type {
    font-size: 11px;
    color: #7dd3fc;
    margin-top: 4px;
  }
}

.status-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 8px;
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

.meta-grid {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.meta-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 10px;
  align-items: start;
  font-size: 12px;
  padding: 7px 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.15);
  text-align: left;

  &:last-child {
    border-bottom: none;
  }

  .meta-label {
    color: #64748b;
    font-weight: 500;
  }

  .meta-val {
    color: #e2efff;
    font-weight: 600;
    word-break: break-all;
  }

  &--time .meta-val {
    color: #94a3b8;
    font-weight: 500;
  }

  &--delay .meta-val {
    color: #94a3b8;
    font-style: italic;
  }

  &--weapon .meta-val {
    color: #fdba74;
  }

  &--strike .meta-val {
    color: #fca5a5;
    font-weight: 700;
  }

  &--neutral .meta-val {
    color: #64748b;
    font-weight: 500;
  }
}

.section-block {
  margin-bottom: 12px;
  text-align: left;

  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #7dd3fc;
    margin-bottom: 8px;
    border-left: 2px solid rgba(0, 225, 255, 0.5);
    padding-left: 8px;
  }
}

.section-block--windows {
  .section-title {
    margin-bottom: 10px;
  }
}

.window-item {
  padding: 10px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  background: rgba(12, 22, 38, 0.85);
  border: 1px solid rgba(79, 147, 221, 0.18);
  border-left: 3px solid #00e1ff;
  font-size: 11px;
  text-align: left;

  &.struck {
    border-left-color: #f87171;
    border-color: rgba(248, 113, 113, 0.22);
    background: rgba(30, 24, 28, 0.75);
  }

  .window-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed rgba(148, 163, 184, 0.12);
  }

  .window-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .window-subject {
    font-size: 10px;
    color: #64748b;
    font-weight: 500;
  }

  .window-name {
    font-size: 13px;
    font-weight: 700;
    color: #e2efff;
    word-break: break-word;
    line-height: 1.35;
  }

  .window-time-row,
  .window-delay-row,
  .window-weapons-row {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
    margin-top: 6px;
    line-height: 1.45;
  }

  .window-field-label {
    font-size: 10px;
    color: #64748b;
    flex-shrink: 0;
  }

  .window-time {
    color: #94a3b8;
    font-family: Consolas, monospace;
    font-size: 10px;
    word-break: break-all;
  }

  .window-delay {
    color: #fca5a5;
    font-weight: 600;
  }

  .window-weapons {
    color: #fdba74;
    word-break: break-word;
  }

  .strike-tag {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;

    &.ok {
      color: #00e1ff;
      background: rgba(0, 225, 255, 0.1);
      border: 1px solid rgba(0, 225, 255, 0.25);
    }

    &.struck {
      color: #fecaca;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(248, 113, 113, 0.28);
    }
  }
}

.weapon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .weapon-chip {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
  }
}

.conn-item {
  display: grid;
  grid-template-columns: 24px 72px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  font-size: 12px;
  padding: 7px 10px;
  margin-bottom: 4px;
  border-radius: 4px;
  background: rgba(8, 15, 26, 0.55);
  text-align: left;

  .conn-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .conn-layer {
    font-size: 11px;
    color: #64748b;
    font-weight: 600;
  }

  .conn-name {
    color: #e2efff;
    font-weight: 600;
    word-break: break-all;
  }

  &--sat .conn-name { color: #67e8f9; }
  &--relay .conn-name { color: #c4b5fd; }
  &--receive .conn-name { color: #5eead4; }
  &--station .conn-name { color: #93c5fd; }
}

.empty-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #64748b;
  font-size: 13px;
  text-align: center;
  padding: 24px 12px;

  .empty-icon {
    font-size: 28px;
  }
}
</style>

