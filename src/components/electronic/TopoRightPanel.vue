<template>
  <aside class="topo-panel topo-panel--right dark-theme">
    <!-- 面板标题与视图切换 Tabs -->
    <div class="panel-header">
      <div class="header-left-title">
        <span class="header-icon">📊</span>
        <span class="header-title">链路决策与详情</span>
      </div>
      <div class="tab-switcher">
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'priority' }"
          @click="activeTab = 'priority'">
          <span>🎯 优先推荐</span>
          <span class="tab-count-badge" v-if="top3PriorityLinks.length">TOP 3</span>
        </button>
        <button type="button" class="tab-btn" :class="{ active: activeTab === 'detail' }" @click="activeTab = 'detail'">
          <span>🔍 节点/详情</span>
          <span class="tab-dot" v-if="detail"></span>
        </button>
      </div>
    </div>

    <!-- 1. 优先打击链路推荐 (TOP 3) 视图 -->
    <template v-if="activeTab === 'priority'">
      <div v-if="!matrixData" class="empty-box">
        <span class="empty-icon">📡</span>
        <p>暂无分析数据，请先选择任务与卫星系列</p>
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
              <span class="chip-dot"></span>威胁度 {{ (activePriorityWeights.threat * 100).toFixed(0) }}%
            </span>
            <span v-if="isStarlinkSeries" class="weight-chip chip--coverage">
              <span class="chip-dot"></span>覆盖率 {{ (activePriorityWeights.coverage! * 100).toFixed(0) }}%
            </span>
            <span class="weight-chip chip--time">
              <span class="chip-dot"></span>时效 {{ (activePriorityWeights.earlyTime * 100).toFixed(0) }}%
            </span>
            <span class="weight-chip chip--iso">
              <span class="chip-dot"></span>孤立度 {{ (activePriorityWeights.isolation * 100).toFixed(0) }}%
            </span>
            <span class="weight-chip chip--relay">
              <span class="chip-dot"></span>中继 {{ (activePriorityWeights.relay * 100).toFixed(0) }}%
            </span>
          </div>
        </div>

        <!-- TOP 3 推荐链路列表 -->
        <div class="top-list">
          <div v-for="item in top3PriorityLinks" :key="item.link.id" class="priority-card" :class="[
            `rank-${item.priority.rank}`,
            {
              active: selectedLinkId === item.link.id,
              struck: item.link.struck,
            },
          ]" role="button" tabindex="0" @click="handleSelectPriorityLink(item.link.id)">
            <!-- 卡片头部：名次、综合得分、状态 -->
            <div class="card-header-row">
              <div class="rank-badge-wrap">
                <span class="rank-badge" :class="`rank-badge--${item.priority.rank}`">
                  <span class="medal-icon">{{ getRankMedal(item.priority.rank) }}</span>
                  <span class="rank-text">TOP {{ item.priority.rank }}</span>
                </span>
              </div>
              <div class="card-header-right">
                <span class="priority-score-pill">
                  <span class="score-label">优先级评分</span>
                  <strong class="score-number">{{ item.priority.totalScore }}</strong>
                  <span class="score-unit">分</span>
                </span>
                <span class="status-badge" :class="item.link.struck ? 'struck' : 'ok'">
                  {{ getLinkInterferenceStatusLabel(item.link) }}
                </span>
              </div>
            </div>

            <!-- 链路路径流 -->
            <div class="link-path-flow">
              <template v-for="(node, idx) in getLinkFlowNodes(item.link)" :key="idx">
                <span class="flow-node" :class="[`flow-node--${node.layer}`, { 'flow-node--struck': node.struck }]">
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
                  <div class="dim-fill dim-fill--threat" :style="{ width: `${item.priority.threatScoreNorm * 100}%` }">
                  </div>
                </div>
                <span class="dim-score">{{ item.priority.threatScoreRaw.toFixed(0) }}分</span>
              </div>

              <div v-if="isStarlinkSeries" class="dim-item">
                <span class="dim-label">🌐 卫星覆盖</span>
                <div class="dim-val-bar">
                  <div class="dim-fill dim-fill--coverage" :style="{ width: `${item.priority.coverageNorm * 100}%` }">
                  </div>
                </div>
                <span class="dim-score">{{ item.priority.coverageRaw == null ? '--' :
                  `${Number(item.priority.coverageRaw.toFixed(2))}%` }}</span>
              </div>

              <div class="dim-item">
                <span class="dim-label">⏱️ 传输时效</span>
                <div class="dim-val-bar">
                  <div class="dim-fill dim-fill--time" :style="{ width: `${item.priority.earlyTimeNorm * 100}%` }">
                  </div>
                </div>
                <span class="dim-score">{{ (item.priority.earlyTimeNorm * 100).toFixed(0) }}%</span>
              </div>

              <div class="dim-item">
                <span class="dim-label">🔗 链路孤立</span>
                <div class="dim-val-bar">
                  <div class="dim-fill dim-fill--iso" :style="{ width: `${item.priority.isolationNorm * 100}%` }"></div>
                </div>
                <span class="dim-score">{{ item.priority.satelliteLinkCount === 1 ? '独占' :
                  `${item.priority.satelliteLinkCount}条`
                }}</span>
              </div>

              <div class="dim-item">
                <span class="dim-label">📡 节点类型</span>
                <div class="dim-val-bar">
                  <div class="dim-fill dim-fill--relay" :style="{ width: `${item.priority.relayNorm * 100}%` }"></div>
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
                  <li v-if="isStarlinkSeries && item.priority.reasonDetails.coverageText">
                    <strong class="point-label">卫星覆盖：</strong>
                    <span>{{ item.priority.reasonDetails.coverageText }}</span>
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
              <el-button size="small" link type="primary" class="view-detail-link"
                @click.stop="viewLinkFullDetail(item.link.id)">
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
                  <span class="path-node" :class="[`path-node--${node.layer}`, { 'path-node--struck': node.struck }]">
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
              {{ detail.interferenceStatus || (detail.struck ? '星扰' : '正常') }}
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
                {{ win.struck ? '已干扰' : '正常' }}
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
          <div class="section-title">拓扑节点打击状态</div>
          <div v-for="(node, idx) in detail.linkNodes" :key="idx" class="conn-item conn-item--with-badge"
            :class="[`conn-item--${node.layer}`, node.struck ? 'conn-item--struck' : 'conn-item--ok']">
            <span class="conn-icon">{{ node.icon }}</span>
            <span class="conn-layer">[{{ node.layerLabel }}]</span>
            <span class="conn-name">{{ node.name }}</span>
            <span class="conn-strike-badge" :class="node.struck ? 'struck' : 'ok'">
              {{ node.struck ? (node.layer === 'receive' ? '站扰' : '星扰') : '正常' }}
            </span>
          </div>
        </div>

        <div v-else-if="detail.connections?.length" class="section-block">
          <div class="section-title">拓扑关联</div>
          <div v-for="(conn, idx) in detail.connections" :key="idx" class="conn-item"
            :class="`conn-item--${conn.layer}`">
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
import { useLayoutStore } from '@/store/modules/layout'
import {
  buildSatellitePassDelayMap,
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  findTransmissionLinkById,
  lookupStationPassDelayMin,
  rankTransmissionLinksByPriority,
  resolveLinkStrikeTarget,
  resolveTaskEndMs,
  DEFAULT_PRIORITY_WEIGHTS,
  STARLINK_PRIORITY_WEIGHTS,
  type PrioritizedTransmissionLink,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'
import { parseTimeToMs } from '@/utils/tools/dateFormat'

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
  struck: boolean
}

/** 元信息行 */
interface DetailMetaRow {
  label: string
  value: string
  tone?: 'time' | 'delay' | 'weapon' | 'strike' | 'neutral' | 'coverage-before' | 'coverage-after'
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
  interferenceStatus?: string
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

const store = useLayoutStore()
/** 当前任务结束毫秒，与过站分段延迟算法共用。 */
const taskEndMs = computed(() => resolveTaskEndMs(store.activeTask?.endDate))

/** 当前激活的面板视图：'priority' 为 TOP 3 优先推荐，'detail' 为详细参数 */
const activeTab = ref<'priority' | 'detail'>('priority')

/** STARLINK 拓扑推荐将覆盖率作为最高权重指标。 */
const isStarlinkSeries = computed(() => props.matrixData?.series === 'STARLINK')

/** 当前系列生效的链路推荐权重。 */
const activePriorityWeights = computed(() =>
  isStarlinkSeries.value ? STARLINK_PRIORITY_WEIGHTS : DEFAULT_PRIORITY_WEIGHTS
)

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
    ? collectSatelliteTransmissionLinks(data, props.selectedNorad, taskEndMs.value)
    : collectSeriesTransmissionLinks(data, taskEndMs.value)

  return rankTransmissionLinksByPriority(data, rawLinks, activePriorityWeights.value)
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

/**
 * 将覆盖率格式化为百分比文案。
 *
 * @param coverage initMatrixList / satelliteMatrixList 中的 coverage
 * @returns 如 `88%`，无数据时为 `--`
 */
const formatCoverage = (coverage: number | null | undefined): string => {
  if (coverage == null || !Number.isFinite(coverage)) return '--'
  return `${Number(coverage.toFixed(2))}%`
}

/**
 * 读取指定卫星的打击前、打击后覆盖率。
 *
 * @param data 算法矩阵
 * @param norad 卫星 NORAD
 * @returns 打击前取 initMatrixList.coverage，打击后取 satelliteMatrixList.coverage
 */
const getSatelliteCoveragePair = (
  data: MatrixResult,
  norad: number | null
): { beforeCoverage: number | null; afterCoverage: number | null } => {
  if (norad == null || !Number.isFinite(norad)) {
    return { beforeCoverage: null, afterCoverage: null }
  }
  const initSat = data.initMatrixList?.find((sat) => sat.norad === norad)
  const postSat = data.satelliteMatrixList?.find((sat) => sat.norad === norad)
  return {
    beforeCoverage: initSat?.coverage != null && Number.isFinite(initSat.coverage) ? initSat.coverage : null,
    afterCoverage: postSat?.coverage != null && Number.isFinite(postSat.coverage) ? postSat.coverage : null,
  }
}

/**
 * STARLINK 详情中追加打击前/后覆盖率行。
 *
 * @param data 算法矩阵
 * @param norad 源卫星 NORAD
 * @returns 覆盖率元信息行；非 STARLINK 时返回空数组
 */
const buildStarlinkCoverageRows = (data: MatrixResult, norad: number | null): DetailMetaRow[] => {
  if (data.series !== 'STARLINK') return []
  const { beforeCoverage, afterCoverage } = getSatelliteCoveragePair(data, norad)
  return [
    { label: '打击前覆盖率', value: formatCoverage(beforeCoverage), tone: 'coverage-before' },
    { label: '打击后覆盖率', value: formatCoverage(afterCoverage), tone: 'coverage-after' },
  ]
}

/** attackPlanList 按目标 ID / 名称聚合后的武器索引 */
interface AttackPlanWeaponIndex {
  /** targetId → 武器名 */
  byId: Map<string, Set<string>>
  /** target 名称 → 武器名 */
  byName: Map<string, Set<string>>
}

/**
 * 从矩阵 attackPlanList 建立目标→武器索引。
 *
 * @param data 算法矩阵
 * @returns 按 targetId、target 名称分组的武器集合
 */
const buildAttackPlanWeaponIndex = (data: MatrixResult): AttackPlanWeaponIndex => {
  const byId = new Map<string, Set<string>>()
  const byName = new Map<string, Set<string>>()
  const add = (map: Map<string, Set<string>>, key: string, weaponName: string) => {
    if (!key || !weaponName) return
    const names = map.get(key) ?? new Set<string>()
    names.add(weaponName)
    map.set(key, names)
  }
  ;(data.attackPlanList || []).forEach((plan) => {
    if (!plan.weaponName) return
    if (plan.targetId) add(byId, String(plan.targetId), plan.weaponName)
    if (plan.target) add(byName, plan.target, plan.weaponName)
  })
  return { byId, byName }
}

/**
 * 按目标 ID/名称从 attackPlanList 索引中收集武器名称。
 *
 * @param index attackPlanList 武器索引
 * @param targets 可能被打击的节点（卫星 NORAD、地面站 ID、节点名称）
 * @returns 去重后的武器名称列表
 */
const collectAttackPlanWeapons = (
  index: AttackPlanWeaponIndex,
  targets: Array<{ id?: string | number | null; name?: string | null }>
): string[] => {
  const names = new Set<string>()
  targets.forEach((target) => {
    if (target.id != null && String(target.id) !== '') {
      index.byId.get(String(target.id))?.forEach((name) => names.add(name))
    }
    if (target.name) {
      index.byName.get(target.name)?.forEach((name) => names.add(name))
    }
  })
  return Array.from(names)
}

/**
 * 右侧详情武器展示：优先 attackPlanList；STARLINK 不回退到窗口自带 weapons。
 *
 * @param data 算法矩阵
 * @param index attackPlanList 武器索引
 * @param targets 匹配目标
 * @param fallback 非 STARLINK 时的窗口/链路武器回退
 * @returns 武器名称列表
 */
const resolveDetailWeapons = (
  data: MatrixResult,
  index: AttackPlanWeaponIndex,
  targets: Array<{ id?: string | number | null; name?: string | null }>,
  fallback: string[] = []
): string[] => {
  const fromPlan = collectAttackPlanWeapons(index, targets)
  if (fromPlan.length) return fromPlan
  if (data.series === 'STARLINK') return []
  return fallback.filter(Boolean)
}

/**
 * 将武器列表格式化为详情行文案。
 *
 * @param names 武器名称
 * @returns 顿号拼接，空则「无」
 */
const formatWeaponText = (names: string[]): string => (names.length ? names.join('、') : '无')

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

    ; (relations ?? []).forEach((rel) => {
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

/**
 * 计算链路干扰状态标签（星扰 / 站扰 / 双扰 / 正常）
 */
const getLinkInterferenceStatusLabel = (link: SatelliteTransmissionLink): string => {
  const satOrRelayStruck = !!link.satelliteStruck || !!link.relayStruck
  const recStruck = !!link.receiveStruck
  if (satOrRelayStruck && recStruck) return '双扰'
  if (satOrRelayStruck) return '星扰'
  if (recStruck) return '站扰'
  return '正常'
}

/** 链路流展示节点 */
interface FlowDisplayNode {
  name: string
  icon: string
  layer: string
  struck: boolean
}

const getLinkFlowNodes = (link: SatelliteTransmissionLink): FlowDisplayNode[] => {
  return link.nodes.map((n) => {
    let isStruck = false
    if (n.layer === 'SAT') isStruck = !!link.satelliteStruck
    else if (n.layer === 'RELAY') isStruck = !!link.relayStruck
    else if (n.layer === 'RECEIVE') isStruck = !!link.receiveStruck
    return {
      name: n.name,
      icon: n.icon,
      layer: n.layer.toLowerCase(),
      struck: isStruck,
    }
  })
}

const detail = computed<NodeDetailView | null>(() => {
  const data = props.matrixData
  if (!data) return null
  const weaponIndex = buildAttackPlanWeaponIndex(data)

  if (props.selectedLinkId) {
    const link = findTransmissionLinkById(data, props.selectedLinkId, props.selectedNorad, taskEndMs.value)
    if (!link) return null
    const linkNodes: DetailLinkNode[] = link.nodes.map((n) => {
      const layer = mapLinkLayer(n.layer)
      let struck = false
      if (n.layer === 'SAT') struck = !!link.satelliteStruck
      else if (n.layer === 'RELAY') struck = !!link.relayStruck
      else if (n.layer === 'RECEIVE') struck = !!link.receiveStruck
      return {
        name: n.name,
        icon: n.icon,
        layer,
        layerLabel: layerLabelMap[layer],
        struck,
      }
    })
    const interferenceStatus = getLinkInterferenceStatusLabel(link)
    const struckNodeNames = linkNodes.filter((n) => n.struck).map((n) => n.name).join('、')
    const struckTargetVal = struckNodeNames ? `${interferenceStatus}（${struckNodeNames}）` : '无'
    const satNode = link.nodes.find((n) => n.layer === 'SAT')
    const satNorad = satNode ? Number(satNode.id) : NaN
    const receiveNode = link.nodes.find((n) => n.layer === 'RECEIVE')
    const stationNode = link.nodes.find((n) => n.layer === 'STATION')
    const linkWeapons = resolveDetailWeapons(
      data,
      weaponIndex,
      [
        { id: Number.isFinite(satNorad) ? satNorad : null, name: satNode?.name },
        { id: receiveNode?.id, name: receiveNode?.name },
        { id: stationNode?.id, name: stationNode?.name },
      ],
      link.weaponNames && link.weaponNames !== '未打击' ? link.weaponNames.split('、') : []
    )
    return {
      icon: '🔗',
      name: link.nodes.map((n) => n.name).join(' → '),
      typeLabel: '传输链路',
      struck: link.struck,
      interferenceStatus,
      linkNodes,
      metaRows: [
        { label: '传输时间', value: link.transmitTime, tone: 'time' },
        { label: '完成时间', value: link.finishTime, tone: 'time' },
        ...buildStarlinkCoverageRows(data, Number.isFinite(satNorad) ? satNorad : null),
        { label: '打击目标', value: struckTargetVal, tone: link.struck ? 'strike' : 'neutral' },
        { label: '延迟', value: link.delayText, tone: 'delay' },
        { label: '武器', value: formatWeaponText(linkWeapons), tone: linkWeapons.length ? 'weapon' : 'neutral' },
      ],
    }
  }

  if (props.selectedNorad != null && !props.selectedNodeId) {
    const norad = props.selectedNorad
    const postSat = data.satelliteMatrixList?.find((s) => s.norad === norad)
    const initSat = data.initMatrixList?.find((s) => s.norad === norad)
    const sat = postSat || initSat
    if (!sat) return null

    const delayMap = buildSatellitePassDelayMap(data, norad, taskEndMs.value)
    const windows = (postSat?.stationWindows || []).map((win) => ({
      title: win.receiveName || win.receiveId || '地面站',
      timeText: `${getWindowStart(win)} ~ ${getWindowEnd(win) || getWindowStart(win)}`,
      struck: win.strikeStatus === 1,
      delayMin: lookupStationPassDelayMin(
        delayMap,
        win.receiveId || win.receiveName || '',
        parseTimeToMs(getWindowStart(win)),
        parseTimeToMs(getWindowEnd(win) || '') || undefined
      ),
      weapons: resolveDetailWeapons(
        data,
        weaponIndex,
        [
          { id: norad, name: sat.name },
          { id: win.receiveId, name: win.receiveName },
        ],
        (win.weapons || []).map((w) => w.name).filter(Boolean)
      ),
    }))

    const satWeapons = resolveDetailWeapons(
      data,
      weaponIndex,
      [{ id: norad, name: sat.name }],
      (postSat?.weapons || []).map((w) => w.name).filter(Boolean)
    )

    return {
      icon: '🛰️',
      name: sat.name,
      typeLabel: sat.satType || '敌方卫星',
      struck: postSat?.satelliteStatus === 1,
      metaRows: [
        { label: 'NORAD', value: String(norad) },
        ...buildStarlinkCoverageRows(data, norad),
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
      ? collectSatelliteTransmissionLinks(data, props.selectedNorad, taskEndMs.value).filter(
          (link) => link.receiveId === nodeId
        )
      : []

    const windows: DetailWindowItem[] = focusedLinks.length
      ? focusedLinks.map((link) => {
        const satNode = link.nodes.find((n) => n.layer === 'SAT')
        return {
          subjectLabel: '关联卫星',
          title: resolveSatName(data, props.selectedNorad!),
          timeText: link.transmitTime,
          struck: link.struck,
          delayMin: link.delayMin,
          weapons: resolveDetailWeapons(
            data,
            weaponIndex,
            [
              { id: props.selectedNorad, name: satNode?.name },
              { id: nodeId, name: recObj?.receiveName },
            ],
            link.weaponNames && link.weaponNames !== '未打击' ? link.weaponNames.split('、') : []
          ),
        }
      })
      : []
    if (!windows.length) {
      ; (data.satelliteMatrixList || []).forEach((sat) => {
        if (props.selectedNorad && sat.norad !== props.selectedNorad) return
          ; (sat.stationWindows || []).forEach((win) => {
            if (win.receiveId !== nodeId && win.receiveName !== recObj?.receiveName) return
            const strikeTarget = resolveLinkStrikeTarget(win, sat)
            const passDelayMap = buildSatellitePassDelayMap(data, sat.norad, taskEndMs.value)
            windows.push({
              subjectLabel: '关联卫星',
              title: sat.name,
              timeText: `${getWindowStart(win)} ~ ${getWindowEnd(win) || getWindowStart(win)}`,
              struck: strikeTarget.struck,
              delayMin: lookupStationPassDelayMin(
                passDelayMap,
                win.receiveId || win.receiveName || '',
                parseTimeToMs(getWindowStart(win)),
                parseTimeToMs(getWindowEnd(win) || '') || undefined
              ),
              weapons: resolveDetailWeapons(
                data,
                weaponIndex,
                [
                  { id: sat.norad, name: sat.name },
                  { id: win.receiveId, name: win.receiveName },
                ],
                (win.weapons || []).map((w) => w.name).filter(Boolean)
              ),
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
  background: var(--swatch-rgba-8-15-26-0_88);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  border-radius: 10px;
  color: var(--text-color-bright);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
  margin-bottom: 8px;

  .header-left-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-subtitle);
    font-weight: var(--font-weight-bold);
    color: var(--accent-cyan-hover);
    white-space: nowrap;
  }
}

.tab-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--swatch-rgba-14-25-42-0_9);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.18);

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 8px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      color: var(--text-color-bright);
      background: rgba(var(--accent-cyan-rgb), 0.08);
    }

    &.active {
      background: rgba(var(--accent-cyan-rgb), 0.18);
      color: var(--accent-cyan-hover);
      border: 1px solid rgba(var(--accent-cyan-rgb), 0.35);
      box-shadow: 0 0 8px rgba(var(--accent-cyan-rgb), 0.2);
    }

    .tab-count-badge {
      font-size: var(--font-size-caption);
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--swatch-rgba-234-179-8-0_25);
      color: var(--color-warning);
      font-weight: var(--font-weight-bold);
    }

    .tab-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent-cyan-hover);
    }
  }
}

:deep(.el-scrollbar__view) {
  padding-right: 10px;
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
  background: var(--swatch-rgba-14-25-42-0_85);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.15);

  .weight-banner-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    color: var(--color-info-soft);
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
    font-size: var(--font-size-xs);
    padding: 1px 6px;
    border-radius: 3px;
    background: var(--swatch-rgba-8-18-32-0_7);
    border: 1px solid var(--swatch-rgba-255-255-255-0_08);
    color: var(--text-color-soft);

    .chip-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
    }

    &.chip--threat .chip-dot {
      background: var(--color-danger-soft);
    }

    &.chip--coverage .chip-dot {
      background: var(--color-info-bright);
    }

    &.chip--time .chip-dot {
      background: var(--color-warning);
    }

    &.chip--iso .chip-dot {
      background: var(--color-success);
    }

    &.chip--relay .chip-dot {
      background: var(--swatch-c084fc);
    }
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
  background: var(--swatch-rgba-14-25-42-0_85);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  border-left: 4px solid var(--color-info);
  cursor: pointer;
  transition: all 0.25s ease;
  text-align: left;

  &:hover {
    background: var(--swatch-rgba-20-36-60-0_92);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(var(--accent-cyan-rgb), 0.15);
  }

  &.active {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 14px rgba(var(--accent-cyan-rgb), 0.3), inset 0 0 12px rgba(var(--accent-cyan-rgb), 0.08);
    background: linear-gradient(135deg, rgba(var(--accent-cyan-rgb), 0.15) 0%, var(--swatch-rgba-14-28-48-0_95) 100%);
  }

  &.rank-1 {
    border-left-color: var(--swatch-eab308);
    background: linear-gradient(180deg, var(--swatch-rgba-30-26-16-0_85) 0%, var(--swatch-rgba-14-25-42-0_85) 100%);
    border-color: var(--swatch-rgba-234-179-8-0_35);

    &.active {
      border-color: var(--color-warning);
      box-shadow: 0 0 16px var(--swatch-rgba-234-179-8-0_35);
    }
  }

  &.rank-2 {
    border-left-color: var(--color-info);
    background: linear-gradient(180deg, var(--swatch-rgba-16-28-42-0_85) 0%, var(--swatch-rgba-14-25-42-0_85) 100%);
    border-color: var(--swatch-rgba-56-189-248-0_35);

    &.active {
      border-color: var(--color-info);
      box-shadow: 0 0 16px var(--swatch-rgba-56-189-248-0_35);
    }
  }

  &.rank-3 {
    border-left-color: var(--color-orange);
    background: linear-gradient(180deg, var(--swatch-rgba-30-22-16-0_85) 0%, var(--swatch-rgba-14-25-42-0_85) 100%);
    border-color: var(--swatch-rgba-251-146-60-0_35);

    &.active {
      border-color: var(--color-orange);
      box-shadow: 0 0 16px var(--swatch-rgba-251-146-60-0_35);
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

  .card-header-right {
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
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-heavy);
    letter-spacing: 0.5px;

    &--1 {
      background: linear-gradient(135deg, var(--swatch-rgba-234-179-8-0_3) 0%, var(--swatch-rgba-180-83-9-0_4) 100%);
      color: var(--swatch-fef08a);
      border: 1px solid var(--swatch-rgba-234-179-8-0_6);
      text-shadow: 0 0 6px var(--swatch-rgba-234-179-8-0_6);
    }

    &--2 {
      background: linear-gradient(135deg, var(--swatch-rgba-56-189-248-0_3) 0%, var(--swatch-rgba-2-132-199-0_4) 100%);
      color: var(--swatch-bae6fd);
      border: 1px solid var(--swatch-rgba-56-189-248-0_6);
      text-shadow: 0 0 6px var(--swatch-rgba-56-189-248-0_6);
    }

    &--3 {
      background: linear-gradient(135deg, var(--swatch-rgba-249-115-22-0_3) 0%, var(--swatch-rgba-194-65-12-0_4) 100%);
      color: var(--swatch-fed7aa);
      border: 1px solid var(--swatch-rgba-249-115-22-0_6);
      text-shadow: 0 0 6px var(--swatch-rgba-249-115-22-0_6);
    }
  }

  .priority-score-pill {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(var(--accent-cyan-rgb), 0.08);
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.25);

    .score-label {
      font-size: var(--font-size-caption);
      color: var(--text-color-muted);
    }

    .score-number {
      font-size: var(--font-size-subtitle);
      font-weight: var(--font-weight-heavy);
      color: var(--accent-cyan-hover);
      font-family: var(--font-family-mono);
    }

    .score-unit {
      font-size: var(--font-size-caption);
      color: var(--color-info-soft);
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
  background: var(--swatch-rgba-8-15-26-0_65);
  border: 1px solid var(--swatch-rgba-255-255-255-0_06);

  .flow-node {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-bold);
    padding: 1px 4px;
    border-radius: 3px;
    transition: all 0.2s ease;

    .flow-icon {
      font-size: var(--font-size-sm);
    }

    &--sat .flow-name {
      color: var(--color-info-bright);
    }

    &--relay .flow-name {
      color: var(--swatch-c4b5fd);
    }

    &--receive .flow-name {
      color: var(--swatch-5eead4);
    }

    &--station .flow-name {
      color: var(--swatch-93c5fd);
    }

    &--struck {
      background: var(--swatch-rgba-239-68-68-0_22);
      border: 1px solid var(--swatch-rgba-248-113-113-0_6);
      box-shadow: 0 0 8px var(--color-danger-glow);

      .flow-name {
        color: var(--color-danger-soft) !important;
        font-weight: var(--font-weight-heavy);
        text-shadow: 0 0 6px var(--swatch-rgba-239-68-68-0_6);
      }
    }
  }

  .flow-arrow {
    color: var(--text-color-disabled);
    font-size: var(--font-size-xs);
  }
}

.dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px 10px;
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  background: var(--swatch-rgba-8-18-32-0_5);

  .dim-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-xs);

    .dim-label {
      color: var(--text-color-muted);
      width: 60px;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .dim-val-bar {
      flex: 1;
      height: 4px;
      background: var(--swatch-rgba-255-255-255-0_08);
      border-radius: 2px;
      overflow: hidden;

      .dim-fill {
        height: 100%;
        border-radius: 2px;
        transition: width 0.3s ease;

        &--threat {
          background: linear-gradient(90deg, var(--color-danger-soft), var(--color-danger-strong));
        }

        &--coverage {
          background: linear-gradient(90deg, var(--color-info-bright), var(--swatch-0891b2));
        }

        &--time {
          background: linear-gradient(90deg, var(--color-warning), var(--swatch-f59e0b));
        }

        &--iso {
          background: linear-gradient(90deg, var(--color-success), var(--color-success-strong));
        }

        &--relay {
          background: linear-gradient(90deg, var(--swatch-c084fc), var(--color-purple-deep));
        }
      }
    }

    .dim-score {
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-bold);
      color: var(--text-color-bright);
      width: 28px;
      text-align: right;
      flex-shrink: 0;
    }
  }
}

.reason-box {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--swatch-rgba-12-22-38-0_95);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.2);
  margin-bottom: 6px;

  .reason-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    font-size: var(--font-size-sm);
    color: var(--accent-cyan-hover);
    margin-bottom: 6px;

    strong {
      font-weight: var(--font-weight-bold);
    }
  }

  .reason-tags-inline {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-left: auto;
  }

  .reason-tag {
    font-size: var(--font-size-caption);
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(var(--accent-cyan-rgb), 0.12);
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.25);
    color: var(--color-info-soft);
  }

  .reason-points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: var(--font-size-sm);
    line-height: 1.45;
    color: var(--text-color-soft);

    li {
      position: relative;
      padding-left: 10px;

      &::before {
        content: '•';
        position: absolute;
        left: 0;
        top: 0;
        color: var(--accent-cyan);
      }
    }

    .point-label {
      color: var(--swatch-93c5fd);
      font-weight: var(--font-weight-semibold);
    }
  }
}

.card-footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
  font-size: var(--font-size-xs);

  .action-hint {
    color: var(--text-color-subtle);
  }

  .view-detail-link {
    font-size: var(--font-size-xs);
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
  background: var(--swatch-rgba-18-32-54-0_8);
  border: 1px solid var(--accent-bg);
  border-left: 3px solid var(--accent-cyan);
  margin-bottom: 12px;
  text-align: left;

  &.struck {
    border-left-color: var(--text-color-muted);
    background: var(--swatch-rgba-30-35-45-0_75);
  }
}

.detail-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .detail-icon {
    font-size: var(--font-size-2xl);
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
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    padding: 1px 4px;
    border-radius: 3px;
    transition: all 0.2s ease;

    .path-icon {
      font-size: var(--font-size-md);
    }

    &--sat .path-name {
      color: var(--color-info-bright);
    }

    &--relay .path-name {
      color: var(--swatch-c4b5fd);
    }

    &--receive .path-name {
      color: var(--swatch-5eead4);
    }

    &--station .path-name {
      color: var(--swatch-93c5fd);
    }

    &--struck {
      background: var(--swatch-rgba-239-68-68-0_22);
      border: 1px solid var(--swatch-rgba-248-113-113-0_6);
      box-shadow: 0 0 8px var(--color-danger-glow);

      .path-name {
        color: var(--color-danger-soft) !important;
        font-weight: var(--font-weight-heavy);
        text-shadow: 0 0 6px var(--swatch-rgba-239-68-68-0_6);
      }
    }
  }

  .path-arrow {
    color: var(--text-color-disabled);
    font-size: var(--font-size-sm);
  }

  .detail-name {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-white);
    word-break: break-all;
  }

  .detail-type {
    font-size: var(--font-size-sm);
    color: var(--color-info-soft);
    margin-top: 4px;
  }
}

.status-badge {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: var(--font-weight-bold);
  max-width: 100%;
  white-space: nowrap;

  &.ok {
    color: var(--accent-cyan);
    background: rgba(var(--accent-cyan-rgb), 0.12);
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.35);
  }

  &.struck {
    color: var(--swatch-fecaca);
    background: var(--swatch-rgba-239-68-68-0_18);
    border: 1px solid var(--swatch-rgba-248-113-113-0_45);
    text-shadow: 0 0 6px var(--color-danger-glow);
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
  font-size: var(--font-size-md);
  padding: 7px 0;
  border-bottom: 1px dashed var(--swatch-rgba-148-163-184-0_15);
  text-align: left;

  &:last-child {
    border-bottom: none;
  }

  .meta-label {
    color: var(--text-color-subtle);
    font-weight: var(--font-weight-medium);
  }

  .meta-val {
    color: var(--text-color-bright);
    font-weight: var(--font-weight-semibold);
    word-break: break-all;
  }

  &--time .meta-val {
    color: var(--text-color-muted);
    font-weight: var(--font-weight-medium);
  }

  &--delay .meta-val {
    color: var(--text-color-muted);
    font-style: italic;
  }

  &--weapon .meta-val {
    color: var(--color-warning-soft);
  }

  &--coverage-before .meta-val {
    color: var(--color-success-soft);
    font-weight: var(--font-weight-bold);
  }

  &--coverage-after .meta-val {
    color: var(--color-orange);
    font-weight: var(--font-weight-bold);
  }

  &--strike .meta-val {
    color: var(--color-danger-soft);
    font-weight: var(--font-weight-bold);
  }

  &--neutral .meta-val {
    color: var(--text-color-subtle);
    font-weight: var(--font-weight-medium);
  }
}

.section-block {
  margin-bottom: 12px;
  text-align: left;

  .section-title {
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-bold);
    color: var(--color-info-soft);
    margin-bottom: 8px;
    border-left: 2px solid rgba(var(--accent-cyan-rgb), 0.5);
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
  background: var(--swatch-rgba-12-22-38-0_85);
  border: 1px solid var(--accent-border);
  border-left: 3px solid var(--accent-cyan);
  font-size: var(--font-size-sm);
  text-align: left;

  &.struck {
    border-left-color: var(--color-danger-soft);
    border-color: var(--swatch-rgba-248-113-113-0_22);
    background: var(--swatch-rgba-30-24-28-0_75);
  }

  .window-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed var(--swatch-rgba-148-163-184-0_12);
  }

  .window-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .window-subject {
    font-size: var(--font-size-xs);
    color: var(--text-color-subtle);
    font-weight: var(--font-weight-medium);
  }

  .window-name {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--text-color-bright);
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
    font-size: var(--font-size-xs);
    color: var(--text-color-subtle);
    flex-shrink: 0;
  }

  .window-time {
    color: var(--text-color-muted);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-xs);
    word-break: break-all;
  }

  .window-delay {
    color: var(--color-danger-soft);
    font-weight: var(--font-weight-semibold);
  }

  .window-weapons {
    color: var(--color-warning-soft);
    word-break: break-word;
  }

  .strike-tag {
    flex-shrink: 0;
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    padding: 2px 8px;
    border-radius: 4px;

    &.ok {
      color: var(--accent-cyan);
      background: rgba(var(--accent-cyan-rgb), 0.1);
      border: 1px solid rgba(var(--accent-cyan-rgb), 0.25);
    }

    &.struck {
      color: var(--swatch-fecaca);
      background: var(--color-danger-bg);
      border: 1px solid var(--swatch-rgba-248-113-113-0_28);
    }
  }
}

.weapon-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  .weapon-chip {
    font-size: var(--font-size-sm);
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--color-danger-soft);
    background: var(--color-danger-bg);
    border: 1px solid var(--swatch-rgba-239-68-68-0_25);
  }
}



.conn-item {
  display: grid;
  grid-template-columns: 24px 72px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  font-size: var(--font-size-md);
  padding: 7px 10px;
  margin-bottom: 4px;
  border-radius: 4px;
  background: var(--swatch-rgba-8-15-26-0_55);
  text-align: left;

  &--with-badge {
    grid-template-columns: 24px 72px minmax(0, 1fr) auto;
  }

  .conn-icon {
    font-size: var(--font-size-subtitle);
    flex-shrink: 0;
  }

  .conn-layer {
    font-size: var(--font-size-sm);
    color: var(--text-color-subtle);
    font-weight: var(--font-weight-semibold);
  }

  .conn-name {
    color: var(--text-color-bright);
    font-weight: var(--font-weight-semibold);
    word-break: break-all;
  }

  .conn-strike-badge {
    font-size: var(--font-size-xs);
    font-weight: var(--font-weight-bold);
    padding: 1px 6px;
    border-radius: 3px;

    &.struck {
      color: var(--color-danger-soft);
      background: var(--swatch-rgba-239-68-68-0_18);
      border: 1px solid var(--swatch-rgba-248-113-113-0_45);
    }

    &.ok {
      color: var(--color-info-soft);
      background: var(--swatch-rgba-56-189-248-0_08);
      border: 1px solid var(--swatch-rgba-56-189-248-0_25);
    }
  }

  &--sat .conn-name {
    color: var(--color-info-bright);
  }

  &--relay .conn-name {
    color: var(--swatch-c4b5fd);
  }

  &--receive .conn-name {
    color: var(--swatch-5eead4);
  }

  &--station .conn-name {
    color: var(--swatch-93c5fd);
  }
}

.empty-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-color-subtle);
  font-size: var(--font-size-base);
  text-align: center;
  padding: 24px 12px;

  .empty-icon {
    font-size: var(--font-size-3xl);
  }
}
</style>
