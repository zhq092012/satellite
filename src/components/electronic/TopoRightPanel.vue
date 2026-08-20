<template>
  <aside class="topo-panel topo-panel--right dark-theme">
    <div class="panel-header">
      <span class="header-icon">📋</span>
      <span class="header-title">{{ selectedLinkId ? '链路详情' : '节点详情' }}</span>
    </div>

    <div v-if="!detail" class="empty-box">
      <span class="empty-icon">👆</span>
      <p>请在左侧链路清单中选择一条链路查看详情</p>
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
          <div v-for="row in detail.metaRows" :key="row.label" class="meta-row"
            :class="row.tone ? `meta-row--${row.tone}` : ''">
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
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatrixResult, StationRelationList } from '@/api/electronic'
import { collectSatelliteTransmissionLinks, resolveLinkStrikeTarget } from '@/utils/satelliteFullChainAnalysis'

/** 节点详情窗口项 */
interface DetailWindowItem {
  /** 主标题 */
  title: string
  /** 小标题前缀（如关联卫星） */
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
  /** 节点图标 */
  icon: string
  /** 层级标签 */
  layerLabel: string
  /** 节点名称 */
  name: string
  /** 节点层级 */
  layer: 'receive' | 'station'
  /** 关联方向：上联 / 下联 */
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

/** 过境窗口时间字段（兼容 StationWindow / InitWindow 等） */
interface WindowTimeFields {
  peakWindow?: string | null
  startWindow?: string | null
  beginWindow?: string | null
  endWindow?: string | null
}

/**
 * 提取过境窗口开始时间字符串
 * @param win 含时间字段的窗口对象
 * @returns 开始时间
 */
const getWindowStart = (win: WindowTimeFields): string =>
  win.peakWindow || win.startWindow || win.beginWindow || ''

/**
 * 提取过境窗口结束时间字符串
 * @param win 含时间字段的窗口对象
 * @returns 结束时间
 */
const getWindowEnd = (win: WindowTimeFields): string => win.endWindow || ''

/** 链路层中文标签 */
const layerLabelMap: Record<DetailLinkNode['layer'], string> = {
  sat: '卫星',
  relay: '中继',
  receive: '地面站',
  station: '数据中心',
}

/**
 * 将链路节点转为详情展示项
 * @param layer 原始层级
 * @returns 样式层级
 */
const mapLinkLayer = (layer: string): DetailLinkNode['layer'] => {
  if (layer === 'RELAY') return 'relay'
  if (layer === 'RECEIVE') return 'receive'
  if (layer === 'STATION') return 'station'
  return 'sat'
}

/**
 * 获取拓扑关联数据（优先打击后关系，避免 init 与 post 重复）
 * @param data 矩阵数据
 * @returns 关系列表
 */
const getPanelRelationData = (data: MatrixResult): StationRelationList => {
  if (data.stationRelationList?.relations?.length) return data.stationRelationList
  return data.initRelationList || { receiveObjList: [], stationObjList: [], relations: [] }
}

/**
 * 构建去重后的拓扑关联列表
 * @param relations 原始关系
 * @param relationData 关系数据容器
 * @param mode 关联方向：地面站下联数据中心 / 数据中心上联地面站
 * @returns 去重后的关联项
 */
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

  if (props.selectedLinkId && props.selectedNorad) {
    const link = collectSatelliteTransmissionLinks(data, props.selectedNorad).find(
      (item) => item.id === props.selectedLinkId
    )
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

/**
 * 解析当前选中卫星名称
 * @param data 矩阵数据
 * @param norad 卫星 NORAD
 * @returns 卫星名称
 */
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
}

.detail-scroll {
  flex: 1;
  min-height: 0;
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

  .empty-icon {
    font-size: 28px;
  }
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

    .path-icon {
      font-size: 12px;
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

  .status-badge {
    margin-left: auto;
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
    padding-left: 2px;
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
    font-size: 10px;
    color: #64748b;
    white-space: nowrap;
  }

  .conn-name {
    font-weight: 600;
    word-break: break-word;
    line-height: 1.4;
  }

  &--sat .conn-name {
    color: #67e8f9;
  }

  &--relay .conn-name {
    color: #c4b5fd;
  }

  &--receive .conn-name {
    color: #5eead4;
  }

  &--station .conn-name {
    color: #93c5fd;
  }
}
</style>
