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
      <div class="detail-card">
        <div class="detail-head">
          <span class="detail-icon">{{ detail.icon }}</span>
          <div>
            <div class="detail-name">{{ detail.name }}</div>
            <div class="detail-type">{{ detail.typeLabel }}</div>
          </div>
          <span class="status-badge" :class="detail.struck ? 'struck' : 'ok'">
            {{ detail.struck ? '被打击' : '正常' }}
          </span>
        </div>

        <div class="meta-grid">
          <div v-for="row in detail.metaRows" :key="row.label" class="meta-row">
            <span class="meta-label">{{ row.label }}</span>
            <strong class="meta-val">{{ row.value }}</strong>
          </div>
        </div>
      </div>

      <div v-if="detail.windows?.length" class="section-block">
        <div class="section-title">过境时间窗口 ({{ detail.windows.length }})</div>
        <div v-for="(win, idx) in detail.windows" :key="idx" class="window-item" :class="{ struck: win.struck }">
          <div class="window-top">
            <span>{{ win.receiveName }}</span>
            <span class="strike-tag">{{ win.struck ? '已打击' : '正常' }}</span>
          </div>
          <div class="window-time">{{ win.timeText }}</div>
          <div v-if="win.delayMin > 0" class="window-delay">延迟 +{{ win.delayMin }} 分钟</div>
          <div v-if="win.weapons?.length" class="window-weapons">
            武器：{{ win.weapons.join('、') }}
          </div>
        </div>
      </div>

      <div v-if="detail.weapons?.length" class="section-block">
        <div class="section-title">关联武器</div>
        <div class="weapon-chips">
          <span v-for="weapon in detail.weapons" :key="weapon" class="weapon-chip">{{ weapon }}</span>
        </div>
      </div>

      <div v-if="detail.connections?.length" class="section-block">
        <div class="section-title">拓扑关联</div>
        <div v-for="(conn, idx) in detail.connections" :key="idx" class="conn-item">{{ conn }}</div>
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatrixResult } from '@/api/electronic'
import { collectSatelliteTransmissionLinks } from '@/utils/satelliteFullChainAnalysis'

/** 节点详情窗口项 */
interface DetailWindowItem {
  receiveName: string
  timeText: string
  struck: boolean
  delayMin: number
  weapons: string[]
}

/** 节点详情展示模型 */
interface NodeDetailView {
  icon: string
  name: string
  typeLabel: string
  struck: boolean
  metaRows: { label: string; value: string }[]
  windows?: DetailWindowItem[]
  weapons?: string[]
  connections?: string[]
}

const props = defineProps<{
  matrixData: MatrixResult | null
  selectedNorad?: number | null
  /** 当前选中的链路 ID */
  selectedLinkId?: string | null
  selectedNodeId?: string | null
  selectedNodeLayer?: 'sat' | 'receive' | 'station' | 'relay' | null
}>()

const getWindowStart = (win: Record<string, string | undefined>) =>
  win.peakWindow || win.startWindow || win.beginWindow || ''
const getWindowEnd = (win: Record<string, string | undefined>) => win.endWindow || ''

const detail = computed<NodeDetailView | null>(() => {
  const data = props.matrixData
  if (!data) return null

  if (props.selectedLinkId && props.selectedNorad) {
    const link = collectSatelliteTransmissionLinks(data, props.selectedNorad).find(
      (item) => item.id === props.selectedLinkId
    )
    if (!link) return null
    return {
      icon: '🔗',
      name: link.nodes.map((n) => n.name).join(' → '),
      typeLabel: '传输链路',
      struck: link.struck,
      metaRows: [
        { label: '传输时间', value: link.transmitTime },
        { label: '完成时间', value: link.finishTime },
        { label: '延迟', value: link.delayText },
        { label: '武器', value: link.weaponNames || '无' },
      ],
      connections: link.nodes.map((n) => `${n.icon} ${n.name}`),
    }
  }

  if (props.selectedNorad != null && !props.selectedNodeId) {
    const norad = props.selectedNorad
    const postSat = data.satelliteMatrixList?.find((s) => s.norad === norad)
    const initSat = data.initMatrixList?.find((s) => s.norad === norad)
    const sat = postSat || initSat
    if (!sat) return null

    const windows = (postSat?.stationWindows || []).map((win) => ({
      receiveName: win.receiveName || win.receiveId,
      timeText: `${getWindowStart(win as Record<string, string>)} ~ ${getWindowEnd(win as Record<string, string>) || getWindowStart(win as Record<string, string>)}`,
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

  const relLists = [data.stationRelationList, data.initRelationList].filter(Boolean)
  const receive = relLists.flatMap((r) => r?.receiveObjList || []).find((rec) => rec.receiveId === nodeId)
  if (receive || props.selectedNodeLayer === 'receive') {
    const recObj = receive || relLists.flatMap((r) => r?.receiveObjList || []).find((r) => r.receiveId === nodeId)
    const windows: DetailWindowItem[] = []
    ;(data.satelliteMatrixList || []).forEach((sat) => {
      ;(sat.stationWindows || []).forEach((win) => {
        if (win.receiveId !== nodeId && win.receiveName !== recObj?.receiveName) return
        windows.push({
          receiveName: sat.name,
          timeText: `${getWindowStart(win as Record<string, string>)} ~ ${getWindowEnd(win as Record<string, string>) || getWindowStart(win as Record<string, string>)}`,
          struck: win.strikeStatus === 1,
          delayMin: Number(win.delayMin) || 0,
          weapons: (win.weapons || []).map((w) => w.name).filter(Boolean),
        })
      })
    })

    const connections = relLists
      .flatMap((r) => r?.relations || [])
      .filter((rel) => rel.from === nodeId)
      .map((rel) => {
        const st = relLists.flatMap((r) => r?.stationObjList || []).find((s) => s.stationId === rel.to)
        return `→ 数据中心 ${st?.stationName || rel.to}`
      })

    return {
      icon: '📡',
      name: recObj?.receiveName || nodeId,
      typeLabel: '地面接收站',
      struck: recObj?.receiveStatus === 1,
      metaRows: [
        { label: '站点 ID', value: nodeId },
        { label: '关联卫星窗口', value: `${windows.length} 个` },
      ],
      windows,
      connections,
    }
  }

  const station = relLists.flatMap((r) => r?.stationObjList || []).find((st) => st.stationId === nodeId)
  if (station || props.selectedNodeLayer === 'station') {
    const stObj = station || relLists.flatMap((r) => r?.stationObjList || []).find((s) => s.stationId === nodeId)
    const connections = relLists
      .flatMap((r) => r?.relations || [])
      .filter((rel) => rel.to === nodeId)
      .map((rel) => {
        const rec = relLists.flatMap((r) => r?.receiveObjList || []).find((r) => r.receiveId === rel.from)
        return `← 地面站 ${rec?.receiveName || rel.from}`
      })

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
  padding: 10px;
  border-radius: 8px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(79, 147, 221, 0.2);
  margin-bottom: 12px;
}

.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .detail-icon {
    font-size: 24px;
  }

  .detail-name {
    font-size: 15px;
    font-weight: 700;
    color: #fff;
  }

  .detail-type {
    font-size: 11px;
    color: #7dd3fc;
    margin-top: 2px;
  }

  .status-badge {
    margin-left: auto;
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 700;

    &.ok {
      color: #86efac;
      background: rgba(34, 197, 94, 0.14);
    }

    &.struck {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.15);
    }
  }
}

.meta-grid {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(148, 163, 184, 0.15);

  .meta-label {
    color: #94a3b8;
  }

  .meta-val {
    color: #e2efff;
  }
}

.section-block {
  margin-bottom: 12px;

  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #7dd3fc;
    margin-bottom: 8px;
  }
}

.window-item {
  padding: 8px;
  margin-bottom: 6px;
  border-radius: 6px;
  background: rgba(12, 22, 38, 0.7);
  border: 1px solid rgba(79, 147, 221, 0.15);
  font-size: 11px;

  &.struck {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .window-top {
    display: flex;
    justify-content: space-between;
    font-weight: 600;
  }

  .window-time,
  .window-delay,
  .window-weapons {
    margin-top: 4px;
    color: #94a3b8;
  }

  .strike-tag {
    color: #fca5a5;
    font-size: 10px;
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
  font-size: 12px;
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 4px;
  background: rgba(8, 15, 26, 0.55);
  color: #cbd5e1;
}
</style>
