<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">分析结果</span>
      </div>
    </div>

    <div v-if="analysisLoading" class="empty-sat-box">
      <span class="task-loading-spinner" aria-hidden="true" />
      <p class="empty-text">正在加载分析结果...</p>
    </div>

    <div v-else-if="!algorithmComplete || !analysisData" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无分析结果</p>
      <p class="empty-sub">请等待当前任务算法计算完成</p>
    </div>

    <div v-else class="analysis-scroll">
      <!-- 1. 首次回传时间与延迟 -->
      <section class="analysis-section">
        <div class="section-head">
          <span class="section-title">首次回传时间</span>
        </div>

        <div class="feedback-kpi-grid">
          <div class="feedback-cell">
            <span class="analysis-kpi-label">打击前</span>
          </div>
          <div class="feedback-cell">
            <span class="analysis-kpi-label">打击后</span>
          </div>
          <div class="feedback-cell">
            <span class="analysis-kpi-label">造成延迟</span>
          </div>

          <div class="feedback-cell">
            <span class="feedback-link">{{ beforeFeedback.link }}</span>
          </div>
          <div class="feedback-cell">
            <span class="feedback-link">{{ afterFeedback.link }}</span>
          </div>
          <div class="feedback-cell feedback-cell--empty" />

          <div class="feedback-cell">
            <span class="feedback-time">{{ beforeFeedback.time }}</span>
          </div>
          <div class="feedback-cell">
            <span class="feedback-time">{{ afterFeedback.time }}</span>
          </div>
          <div class="feedback-cell">
            <span class="analysis-kpi-value analysis-kpi-value--delay">{{ strikeDelayText }}</span>
          </div>
        </div>
      </section>

      <!-- 2. 平均覆盖率对比 -->
      <section class="analysis-section">
        <div class="section-head">
          <span class="section-title">平均覆盖率</span>
        </div>

        <div class="analysis-kpi-row">
          <div class="analysis-kpi-item">
            <span class="analysis-kpi-label">打击前</span>
            <span class="analysis-kpi-value analysis-kpi-value--before">{{ beforeCoverageText }}</span>
          </div>

          <div class="analysis-kpi-item">
            <span class="analysis-kpi-label">打击后</span>
            <span class="analysis-kpi-value analysis-kpi-value--after">{{ afterCoverageText }}</span>
          </div>

          <div class="analysis-kpi-item">
            <span class="analysis-kpi-label">覆盖率减少</span>
            <span class="analysis-kpi-value analysis-kpi-value--reduce">{{ coverageReductionText }}</span>
          </div>
        </div>
      </section>

      <!-- 3. 卫星指标表格 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">卫星指标</span>
          <span class="section-count">
            展示 {{ displayedSatelliteTableRows.length }} / 共 {{ rankedSatelliteTableRows.length }} 颗
          </span>
        </div>

        <el-table :data="displayedSatelliteTableRows" size="small" row-key="rowKey" class="sat-metric-table"
          empty-text="暂无卫星数据">
          <el-table-column label="卫星" width="112" class-name="sat-name-column">
            <template #default="{ row }">
              <el-tooltip
                :content="`${row.name}\n${formatSatelliteSeriesTypeMeta(row.series, row.sysType)}`"
                placement="left"
                :show-after="200">
                <div class="sat-name-cell">
                  <button type="button" class="sat-name-wrap"
                    :class="{ 'sat-name-wrap--selected': selectedNorad === row.norad }"
                    @click="emit('select-satellite', row.norad)">
                    {{ row.name }}
                  </button>
                  <div class="sat-name-meta">
                    <div v-if="row.series && row.series !== '--'" class="sat-name-meta__line">
                      <span class="sat-name-meta__label">系列：</span>
                      <span class="sat-name-meta__series">{{ row.series }}</span>
                    </div>
                    <div v-if="row.sysType && row.sysType !== '--'" class="sat-name-meta__line">
                      <span class="sat-name-meta__label">类型：</span>
                      <span class="sat-name-meta__type">{{ row.sysType }}</span>
                    </div>
                  </div>
                </div>
              </el-tooltip>
            </template>
          </el-table-column>

          <el-table-column label="覆盖率" width="96" sortable :sort-method="sortByCoverageBefore">
            <template #default="{ row }">
              <div class="metric-cell metric-cell--clickable-metric" role="button" tabindex="0"
                @click.stop="handleCoverageMetricClick(row)"
                @keydown.enter.stop="handleCoverageMetricClick(row)">
                <div class="metric-line">
                  <span class="metric-line-label">打击前</span>
                  <span class="metric-line-value">{{ row.coverageBeforeText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">打击后</span>
                  <span class="metric-line-value">{{ row.coverageAfterText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">覆盖率减少</span>
                  <span class="metric-line-delta metric-line-delta--green">{{ row.coverageReduceText }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="链路时延" width="96" sortable :sort-method="sortByDelayBefore">
            <template #default="{ row }">
              <div class="metric-cell metric-cell--clickable-metric" role="button" tabindex="0"
                @click.stop="handleDelayMetricClick(row)"
                @keydown.enter.stop="handleDelayMetricClick(row)">
                <div class="metric-line">
                  <span class="metric-line-label">打击前</span>
                  <span class="metric-line-value">{{ row.delayBeforeText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">打击后</span>
                  <span class="metric-line-value">{{ row.delayAfterText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">增加时延</span>
                  <span class="metric-line-delta metric-line-delta--yellow">{{ row.delayIncreaseText }}</span>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="威胁度" width="96" sortable :sort-method="sortByThreatBefore"
            class-name="sat-threat-column">
            <template #default="{ row }">
              <div class="metric-cell metric-cell--clickable-threat" role="button" tabindex="0"
                @click.stop="handleThreatMetricClick(row)"
                @keydown.enter.stop="handleThreatMetricClick(row)">
                <div class="metric-line">
                  <span class="metric-line-label">打击前</span>
                  <span class="metric-line-value">{{ row.threatBeforeText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">打击后</span>
                  <span class="metric-line-value">{{ row.threatAfterText }}</span>
                </div>
                <div class="metric-line">
                  <span class="metric-line-label">威胁度降低</span>
                  <span class="metric-line-delta metric-line-delta--green">{{ row.threatReduceText }}</span>
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-if="rankedSatelliteTableRows.length > SATELLITE_TABLE_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllSatellites" type="button" class="table-more-btn" @click="showAllSatellites = true">
            查看更多（{{ rankedSatelliteTableRows.length - SATELLITE_TABLE_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllSatellites = false">
            收起
          </button>
        </div>
      </section>

      <!-- 4. 打击计划 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">打击计划</span>
          <span class="section-count">
            展示 {{ displayedAttackPlanTableRows.length }} / 共 {{ attackPlanTableRows.length }} 条
          </span>
        </div>

        <div class="attack-plan-table-wrap">
          <el-table :data="displayedAttackPlanTableRows" size="small" row-key="id"
            class="sat-metric-table attack-plan-table" empty-text="暂无打击计划">
            <el-table-column label="卫星/站" min-width="0" show-overflow-tooltip>
              <template #default="{ row }">
                <el-tooltip :content="row.targetType ? `${row.target}（${row.targetType}）` : row.target" placement="left"
                  :show-after="200">
                  <span class="plan-target-text">{{ row.target }}</span>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="武器" min-width="0" show-overflow-tooltip>
              <template #default="{ row }">
                <span v-if="row.weaponId" class="plan-weapon-text plan-weapon-text--clickable"
                  :class="{ 'plan-weapon-text--selected': selectedWeaponId === row.weaponId }"
                  @click="emit('select-weapon', row.weaponId)">
                  {{ row.weaponName }}
                </span>
                <span v-else class="plan-weapon-text">{{ row.weaponName }}</span>
              </template>
            </el-table-column>

            <el-table-column label="开始时间" min-width="0" sortable :sort-method="sortAttackPlanByBeginTime">
              <template #default="{ row }">
                <el-tooltip :content="row.beginTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.beginTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.beginTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.beginTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="结束时间" min-width="0" sortable :sort-method="sortAttackPlanByEndTime">
              <template #default="{ row }">
                <el-tooltip :content="row.endTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.endTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.endTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.endTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="attackPlanTableRows.length > ATTACK_PLAN_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllAttackPlans" type="button" class="table-more-btn" @click="showAllAttackPlans = true">
            查看更多（{{ attackPlanTableRows.length - ATTACK_PLAN_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllAttackPlans = false">
            收起
          </button>
        </div>
      </section>

      <!-- 5. 通信链路 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">通信链路</span>
          <span class="section-count">
            展示 {{ displayedLinkChainTableRows.length }} / 共 {{ linkChainTableRows.length }} 条
          </span>
        </div>

        <div class="link-chain-table-wrap">
          <el-table :data="displayedLinkChainTableRows" size="small" row-key="id"
            class="sat-metric-table link-chain-table" empty-text="暂无通信链路">
            <el-table-column label="链路" min-width="0">
              <template #default="{ row }">
                <el-tooltip :content="row.chainText" placement="left" :show-after="200">
                  <span class="link-chain-text" :class="{ 'link-chain-text--relay': row.hasRelay }">
                    {{ row.chainText }}
                  </span>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="开始时间" min-width="0" sortable :sort-method="sortLinkChainByBeginTime">
              <template #default="{ row }">
                <el-tooltip :content="row.beginTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.beginTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.beginTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.beginTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>

            <el-table-column label="结束时间" min-width="0" sortable :sort-method="sortLinkChainByEndTime">
              <template #default="{ row }">
                <el-tooltip :content="row.endTime" placement="top" :show-after="200">
                  <div class="plan-time-text">
                    <span class="plan-time-date">{{ getPlanTimeParts(row.endTime).date }}</span>
                    <span v-if="getPlanTimeParts(row.endTime).time" class="plan-time-clock">
                      {{ getPlanTimeParts(row.endTime).time }}
                    </span>
                  </div>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="linkChainTableRows.length > LINK_CHAIN_TOP_COUNT" class="table-more-actions">
          <button v-if="!showAllLinkChains" type="button" class="table-more-btn" @click="showAllLinkChains = true">
            查看更多（{{ linkChainTableRows.length - LINK_CHAIN_TOP_COUNT }}）
          </button>
          <button v-else type="button" class="table-more-btn" @click="showAllLinkChains = false">
            收起
          </button>
        </div>
      </section>

      <!-- 6. 接收站 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">接收站</span>
          <span class="section-count">共 {{ receiveStationTableRows.length }} 个</span>
        </div>

        <el-table :data="receiveStationTableRows" size="small" row-key="key"
          class="sat-metric-table ground-station-table" empty-text="暂无接收站数据">
          <el-table-column label="名称" min-width="0" show-overflow-tooltip>
            <template #default="{ row }">
              <button type="button" class="ground-target-name"
                :class="{
                  'ground-target-name--struck': row.struck,
                  'ground-target-name--selected': selectedGroundTargetKey === row.key,
                }"
                @click="emit('select-ground-target', row.key)">
                {{ row.name }}
              </button>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="64">
            <template #default="{ row }">
              <span :class="{ 'ground-target-status--struck': row.struck }">{{ row.statusText }}</span>
            </template>
          </el-table-column>
          <el-table-column label="经纬度" min-width="0" show-overflow-tooltip prop="latLonText" />
          <el-table-column label="用途" min-width="0" show-overflow-tooltip prop="usage" />
        </el-table>
      </section>

      <!-- 7. 数据中心 -->
      <section class="analysis-section analysis-section--table">
        <div class="section-head">
          <span class="section-title">数据中心</span>
          <span class="section-count">共 {{ dataCenterTableRows.length }} 个</span>
        </div>

        <el-table :data="dataCenterTableRows" size="small" row-key="key"
          class="sat-metric-table ground-station-table" empty-text="暂无数据中心数据">
          <el-table-column label="名称" min-width="0" show-overflow-tooltip>
            <template #default="{ row }">
              <button type="button" class="ground-target-name"
                :class="{
                  'ground-target-name--struck': row.struck,
                  'ground-target-name--selected': selectedGroundTargetKey === row.key,
                }"
                @click="emit('select-ground-target', row.key)">
                {{ row.name }}
              </button>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="64">
            <template #default="{ row }">
              <span :class="{ 'ground-target-status--struck': row.struck }">{{ row.statusText }}</span>
            </template>
          </el-table-column>
          <el-table-column label="经纬度" min-width="0" show-overflow-tooltip prop="latLonText" />
        </el-table>
      </section>
    </div>
  </aside>

  <SatelliteThreatInfoDialog v-model="threatInfoDialogVisible" :loading="threatInfoLoading"
    :threat-info="threatInfoData" :subtitle="threatInfoSubtitle" :empty-hint="threatInfoEmptyHint" />

  <BattleSatelliteCoverageDialog v-model="coverageDialogVisible" :matrix="chartMatrix" :norad="chartNorad"
    :task-begin="taskBeginDate" :task-end="taskEndDate" :subtitle="chartDialogSubtitle" />

  <BattleSatelliteLinkDelayDialog v-model="linkDelayDialogVisible" :matrix="chartMatrix" :norad="chartNorad"
    :task-end="taskEndDate" :subtitle="chartDialogSubtitle" />
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧面板。
 * 根据任务算法进度展示 getTaskMatrix 返回的分析摘要。
 */
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getSatelliteThreatInfo, type MatrixResult, type SatelliteThreatInfo } from '@/api/electronic'
import type { LevelSeriesEntity, SatelliteAnalysisData } from '@/api/task/task'
import BattleSatelliteCoverageDialog from '@/components/BattleSituation/BattleSatelliteCoverageDialog.vue'
import BattleSatelliteLinkDelayDialog from '@/components/BattleSituation/BattleSatelliteLinkDelayDialog.vue'
import SatelliteThreatInfoDialog from '@/components/BattleSituation/SatelliteThreatInfoDialog.vue'
import { levelSeriesEntityToMatrix } from '@/utils/seriesLinkTimeline'
import { useLayoutStore } from '@/store/modules/layout'
import {
  ATTACK_PLAN_TOP_COUNT,
  buildAttackPlanTableRows,
  type AttackPlanTableRow,
} from '@/utils/buildAttackPlanTable'
import {
  buildDataCenterTableRows,
  buildReceiveStationTableRows,
} from '@/utils/buildGroundStationTable'
import {
  buildLinkChainTableRows,
  LINK_CHAIN_TOP_COUNT,
  type LinkChainTableRow,
} from '@/utils/buildLinkChainTable'
import {
  buildSatelliteAnalysisTableRows,
  compareNullableMetric,
  formatSatelliteSeriesTypeMeta,
  rankSatellitesByCompositeBeforeMetrics,
  SATELLITE_TABLE_TOP_COUNT,
  type SatelliteMetricTableRow,
} from '@/utils/buildSatelliteAnalysisTable'
import {
  formatCoveragePercent,
  formatCoverageReduction,
  formatStrikeDelayDuration,
  parseFeedbackTimeAndLink,
  splitDateTimeDisplay,
} from '@/utils/zhchPlanDisplay'

/** 打击计划时间拆分为日期/时分秒两行展示 */
const getPlanTimeParts = splitDateTimeDisplay

/** 全局布局 Store（当前任务 ID） */
const store = useLayoutStore()

/** 威胁度算法参数弹窗可见性 */
const threatInfoDialogVisible = ref(false)

/** 威胁度算法参数加载状态 */
const threatInfoLoading = ref(false)

/** 威胁度算法参数数据 */
const threatInfoData = ref<SatelliteThreatInfo | null>(null)

/** 威胁度弹窗副标题 */
const threatInfoSubtitle = ref('')

/** 威胁度弹窗无数据提示 */
const threatInfoEmptyHint = ref('')

/** 覆盖率 / 链路时延图表弹窗可见性 */
const coverageDialogVisible = ref(false)
const linkDelayDialogVisible = ref(false)

/** 图表弹窗使用的系列矩阵与 NORAD */
const chartMatrix = ref<MatrixResult | null>(null)
const chartNorad = ref<number | null>(null)
const chartDialogSubtitle = ref('')

/** 当前任务时间范围（图表用） */
const taskBeginDate = computed(() => store.activedTask?.beginDate ?? '')
const taskEndDate = computed(() => store.activedTask?.endDate ?? '')

/**
 * 按系列与系统类型查找 levelSeriesEntities 中的矩阵实体。
 *
 * @param row 卫星表格行
 * @returns 系列实体或 null
 */
const findLevelSeriesEntityForRow = (row: SatelliteMetricTableRow): LevelSeriesEntity | null => {
  const entities = props.analysisData?.levelSeriesEntities
  if (!entities?.length) return null
  if (row.series && row.series !== '--') {
    const matched = entities.find((entity) => entity.series === row.series && entity.sysType === row.sysType)
    if (matched) return matched
  }
  return entities.find((entity) => entity.sysType === row.sysType) ?? null
}

/**
 * 打开图表弹窗前的公共校验与矩阵解析。
 *
 * @param row 卫星行
 * @returns 是否可继续
 */
const prepareChartDialogContext = (row: SatelliteMetricTableRow): boolean => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择任务')
    return false
  }
  if (!props.algorithmComplete || !props.analysisData) {
    ElMessage.warning('请等待任务算法分析完成')
    return false
  }
  const entity = findLevelSeriesEntityForRow(row)
  if (!entity) {
    ElMessage.warning('未找到该卫星对应的系列分析数据')
    return false
  }
  chartMatrix.value = levelSeriesEntityToMatrix(entity)
  chartNorad.value = row.norad
  chartDialogSubtitle.value = `${row.name}${row.series && row.series !== '--' ? ` · 系列：${row.series}` : ''}${row.sysType && row.sysType !== '--' ? ` · 类型：${row.sysType}` : ''}`
  return true
}

/**
 * 点击覆盖率单元格，打击前覆盖率有效且大于 0 时打开热力图。
 *
 * @param row 卫星指标行
 */
const handleCoverageMetricClick = (row: SatelliteMetricTableRow) => {
  const before = row.coverageBefore
  if (before == null || !Number.isFinite(before) || before <= 0) {
    ElMessage.info('当前卫星没有覆盖率信息')
    return
  }
  if (!prepareChartDialogContext(row)) return
  linkDelayDialogVisible.value = false
  coverageDialogVisible.value = true
}

/**
 * 点击链路时延单元格，打击前时延有效且大于 0 分钟时打开 G6 拓扑。
 *
 * @param row 卫星指标行
 */
const handleDelayMetricClick = (row: SatelliteMetricTableRow) => {
  const before = row.delayBefore
  if (before == null || !Number.isFinite(before) || before <= 0) {
    ElMessage.info('当前卫星没有链路时延信息')
    return
  }
  if (!prepareChartDialogContext(row)) return
  coverageDialogVisible.value = false
  linkDelayDialogVisible.value = true
}

/**
 * 从接口列表中解析与 NORAD 匹配的威胁度参数。
 *
 * @param list 接口返回列表
 * @param norad 目标 NORAD
 * @returns 匹配项或首项
 */
const resolveThreatInfoFromResponse = (
  list: SatelliteThreatInfo[] | null | undefined,
  norad: number
): SatelliteThreatInfo | null => {
  if (!list?.length) return null
  return list.find((item) => item.satelliteBaseModelResp?.norad === norad) ?? list[0] ?? null
}

/**
 * 点击威胁度单元格，拉取并展示威胁度算法参数。
 *
 * @param row 卫星指标行
 */
const handleThreatMetricClick = async (row: SatelliteMetricTableRow) => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    ElMessage.warning('请先选择任务')
    return
  }
  if (!row.sysType || row.sysType === '--') {
    ElMessage.warning('缺少卫星类型，无法查询威胁度算法参数')
    return
  }

  threatInfoDialogVisible.value = true
  threatInfoLoading.value = true
  threatInfoData.value = null
  threatInfoEmptyHint.value = ''
  threatInfoSubtitle.value = `${row.name}${row.series && row.series !== '--' ? ` · 系列：${row.series}` : ''} · 类型：${row.sysType}`

  try {
    const res = await getSatelliteThreatInfo({
      norad: row.norad,
      sysType: row.sysType,
      taskId,
    })
    if (res?.code !== 200) {
      threatInfoEmptyHint.value = res?.msg || '未查询到威胁度算法参数'
      return
    }
    const info = resolveThreatInfoFromResponse(res.data, row.norad)
    threatInfoData.value = info
    if (!info) {
      threatInfoEmptyHint.value = '未查询到威胁度算法参数'
    }
  } catch (error) {
    console.error('获取卫星威胁度算法参数失败:', error)
    threatInfoEmptyHint.value = '加载失败，请稍后重试'
    ElMessage.error('获取卫星威胁度算法参数失败')
  } finally {
    threatInfoLoading.value = false
  }
}

const props = defineProps<{
  /** 任务算法分析结果 */
  analysisData: SatelliteAnalysisData | null
  /** 当前任务算法是否已完成 */
  algorithmComplete: boolean
  /** 分析结果是否正在加载 */
  analysisLoading?: boolean
  /** 当前选中的卫星 NORAD */
  selectedNorad?: number | null
  /** 当前选中的武器 ID */
  selectedWeaponId?: string | null
  /** 当前选中的地面目标键 */
  selectedGroundTargetKey?: string | null
}>()

/** 选中右侧卫星/武器/地面站时通知父组件定位地球 */
const emit = defineEmits<{
  (e: 'select-satellite', norad: number): void
  (e: 'select-weapon', weaponId: string): void
  (e: 'select-ground-target', targetKey: string): void
}>()

/**
 * 从系列矩阵中推算打击前平均覆盖率（接口未返回时兜底）。
 *
 * @param data 任务分析数据
 * @returns 打击前平均覆盖率；无法计算时返回 null
 */
const resolveBeforeAvgCoverage = (data: SatelliteAnalysisData | null): number | null => {
  if (!data) return null
  if (Number.isFinite(data.beforeAvgCoverage)) {
    return Number(data.beforeAvgCoverage)
  }

  const coverages: number[] = []
    ; (data.levelSeriesEntities || []).forEach((entity) => {
      ; (entity.initMatrixList || []).forEach((sat) => {
        if (Number.isFinite(sat.coverage)) {
          coverages.push(sat.coverage)
        }
      })
    })

  if (!coverages.length) return null
  return coverages.reduce((sum, value) => sum + value, 0) / coverages.length
}

/** 打击前首次回传时间与链路 */
const beforeFeedback = computed(() =>
  parseFeedbackTimeAndLink(props.analysisData?.beforeFirstFeedbackTime)
)

/** 打击后首次回传时间与链路 */
const afterFeedback = computed(() =>
  parseFeedbackTimeAndLink(props.analysisData?.afterFirstFeedbackTime)
)

/** 打击造成的回传延迟 */
const strikeDelayText = computed(() =>
  formatStrikeDelayDuration(
    props.analysisData?.beforeFirstFeedbackTime,
    props.analysisData?.afterFirstFeedbackTime
  )
)

/** 打击前平均覆盖率展示 */
const beforeCoverageText = computed(() =>
  formatCoveragePercent(resolveBeforeAvgCoverage(props.analysisData))
)

/** 打击后平均覆盖率展示 */
const afterCoverageText = computed(() =>
  formatCoveragePercent(props.analysisData?.afterAvgCoverage)
)

/** 覆盖率减少量展示 */
const coverageReductionText = computed(() =>
  formatCoverageReduction(
    resolveBeforeAvgCoverage(props.analysisData),
    props.analysisData?.afterAvgCoverage
  )
)

/** 是否展示全部卫星（默认仅展示综合排序前 10 条） */
const showAllSatellites = ref(false)

/** 卫星指标表格全量行 */
const satelliteTableRows = computed(() => buildSatelliteAnalysisTableRows(props.analysisData))

/** 按打击前覆盖率、链路时延、威胁度综合排序后的卫星列表 */
const rankedSatelliteTableRows = computed(() =>
  rankSatellitesByCompositeBeforeMetrics(satelliteTableRows.value)
)

/** 当前表格展示的卫星行 */
const displayedSatelliteTableRows = computed(() => {
  if (showAllSatellites.value) return rankedSatelliteTableRows.value
  return rankedSatelliteTableRows.value.slice(0, SATELLITE_TABLE_TOP_COUNT)
})

/** 任务分析数据变化时重置「查看更多」状态 */
watch(
  () => props.analysisData,
  () => {
    showAllSatellites.value = false
    showAllAttackPlans.value = false
    showAllLinkChains.value = false
  }
)

/** 按打击前覆盖率排序 */
const sortByCoverageBefore = (a: SatelliteMetricTableRow, b: SatelliteMetricTableRow) =>
  compareNullableMetric(a.coverageBefore, b.coverageBefore)

/** 按打击前链路时延排序 */
const sortByDelayBefore = (a: SatelliteMetricTableRow, b: SatelliteMetricTableRow) =>
  compareNullableMetric(a.delayBefore, b.delayBefore)

/** 按打击前威胁度排序 */
const sortByThreatBefore = (a: SatelliteMetricTableRow, b: SatelliteMetricTableRow) =>
  compareNullableMetric(a.threatBefore, b.threatBefore)

/** 打击计划按开始时间排序 */
const sortAttackPlanByBeginTime = (a: AttackPlanTableRow, b: AttackPlanTableRow) =>
  compareNullableMetric(a.beginTimeMs, b.beginTimeMs)

/** 打击计划按结束时间排序 */
const sortAttackPlanByEndTime = (a: AttackPlanTableRow, b: AttackPlanTableRow) =>
  compareNullableMetric(a.endTimeMs, b.endTimeMs)

/** 通信链路按开始时间排序 */
const sortLinkChainByBeginTime = (a: LinkChainTableRow, b: LinkChainTableRow) =>
  compareNullableMetric(a.beginTimeMs, b.beginTimeMs)

/** 通信链路按结束时间排序 */
const sortLinkChainByEndTime = (a: LinkChainTableRow, b: LinkChainTableRow) =>
  compareNullableMetric(a.endTimeMs, b.endTimeMs)

/** 是否展示全部打击计划（默认仅展示前 10 条） */
const showAllAttackPlans = ref(false)

/** 打击计划表格全量行（按开始时间升序） */
const attackPlanTableRows = computed(() => buildAttackPlanTableRows(props.analysisData))

/** 接收站表格行 */
const receiveStationTableRows = computed(() => buildReceiveStationTableRows(props.analysisData))

/** 数据中心表格行 */
const dataCenterTableRows = computed(() => buildDataCenterTableRows(props.analysisData))

/** 当前表格展示的打击计划行 */
const displayedAttackPlanTableRows = computed(() => {
  if (showAllAttackPlans.value) return attackPlanTableRows.value
  return attackPlanTableRows.value.slice(0, ATTACK_PLAN_TOP_COUNT)
})

/** 是否展示全部通信链路（默认仅展示前 10 条） */
const showAllLinkChains = ref(false)

/** 通信链路表格全量行（按开始时间升序） */
const linkChainTableRows = computed(() => buildLinkChainTableRows(props.analysisData))

/** 当前表格展示的通信链路行 */
const displayedLinkChainTableRows = computed(() => {
  if (showAllLinkChains.value) return linkChainTableRows.value
  return linkChainTableRows.value.slice(0, LINK_CHAIN_TOP_COUNT)
})
</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 0;
  backdrop-filter: blur(8px);
  color: #e2efff;
  overflow: hidden;

  &--right {
    border-right: none;
    border-top: none;
    border-bottom: none;
  }
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }
}

.analysis-scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 2px;
  }
}

.analysis-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 8px;
  background: rgba(12, 22, 38, 0.55);
  border: 1px solid rgba(0, 225, 255, 0.12);
  min-width: 0;
  overflow: hidden;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #7dd3fc;
}

.section-count {
  font-size: 11px;
  color: #94a3b8;
}

.analysis-section--table {
  padding-bottom: 8px;
  overflow: hidden;
}

.sat-metric-table {
  width: 100%;
  table-layout: fixed;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.08);
  --atlas-app-text-color-regular: #cbd5e1;
  --atlas-app-text-color-primary: #e2efff;
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    table-layout: fixed;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  :deep(td.atlas-app-table__cell) {
    font-size: 12px;
    color: #cbd5e1;
    background: transparent !important;
    border-bottom: 1px solid rgba(0, 225, 255, 0.08);
    padding-top: 10px;
    padding-bottom: 10px;
    padding-left: 4px;
    padding-right: 4px;
    vertical-align: top;
    overflow: hidden;
  }

  :deep(th.atlas-app-table__cell .cell),
  :deep(td.atlas-app-table__cell .cell) {
    padding-left: 0;
    padding-right: 0;
    overflow: hidden;
  }

  :deep(.atlas-app-table__empty-block) {
    background: transparent;
    color: #64748b;
  }

  :deep(.caret-wrapper) {
    width: 14px;
  }

  :deep(td.sat-name-column) {
    padding-left: 4px;
    padding-right: 4px;
    vertical-align: middle;
  }
}

.sat-name-wrap {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 11px;
  line-height: 1.35;
  color: #e2efff;
  word-break: break-all;
  white-space: normal;
  text-align: left;
  cursor: pointer;
  transition: color 0.2s ease, text-shadow 0.2s ease;

  &:hover {
    color: #7dd3fc;
  }

  &--selected {
    color: #fbbf24;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.45);
  }
}

.sat-name-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.sat-name-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  font-size: 10px;
  line-height: 1.35;
  word-break: break-all;
  white-space: normal;
}

.sat-name-meta__line {
  display: block;
  width: 100%;
}

.sat-name-meta__label {
  color: #94a3b8;
  font-weight: 500;
}

.sat-name-meta__series {
  color: #fbbf24;
  font-weight: 600;
}

.sat-name-meta__type {
  color: #22d3ee;
  font-weight: 600;
}

.table-more-actions {
  display: flex;
  justify-content: center;
  padding-top: 8px;
}

.table-more-btn {
  height: 28px;
  padding: 0 14px;
  border-radius: 4px;
  border: 1px solid rgba(64, 242, 255, 0.35);
  background: rgba(0, 225, 255, 0.08);
  color: #7dd3fc;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: #40f2ff;
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.16);
  }
}

.metric-cell {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.metric-cell--clickable-threat,
.metric-cell--clickable-metric {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  margin: -2px -4px;
  transition: background 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    background: rgba(0, 225, 255, 0.08);
    box-shadow: inset 0 0 0 1px rgba(0, 225, 255, 0.22);
  }

  &:focus-visible {
    outline: 1px solid rgba(0, 225, 255, 0.45);
    outline-offset: 1px;
  }
}

.metric-line {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  line-height: 1.35;
}

.metric-line-label {
  font-size: 10px;
  color: #64748b;
}

.metric-line-value {
  font-size: 12px;
  color: #e2efff;
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-word;
}

.metric-line-delta {
  font-size: 12px;
  font-weight: 700;
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-word;

  &--green {
    color: #4ade80;
  }

  &--yellow {
    color: #fbbf24;
  }
}

.attack-plan-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.attack-plan-table {
  width: 100%;
  max-width: 100%;

  :deep(.atlas-app-table__inner-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__wrap) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__bar.is-horizontal) {
    display: none !important;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(1)),
  :deep(.atlas-app-table__body colgroup col:nth-child(1)) {
    width: 35% !important;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(2)),
  :deep(.atlas-app-table__body colgroup col:nth-child(2)) {
    width: 15% !important;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(3)),
  :deep(.atlas-app-table__body colgroup col:nth-child(3)),
  :deep(.atlas-app-table__header colgroup col:nth-child(4)),
  :deep(.atlas-app-table__body colgroup col:nth-child(4)) {
    width: 25% !important;
  }

  :deep(col[name='gutter']) {
    width: 0 !important;
  }

  :deep(td.atlas-app-table__cell) {
    padding-top: 6px;
    padding-bottom: 6px;
    vertical-align: middle;
  }

  :deep(td.atlas-app-table__cell .cell) {
    display: flex;
    align-items: center;
    min-height: 100%;
  }
}

.plan-target-text {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #4ade80;
  word-break: break-all;
  white-space: normal;
  line-height: 1.35;
  overflow: hidden;
}

.plan-weapon-text {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #fbbf24;
  word-break: break-all;
  white-space: normal;
  line-height: 1.35;
  overflow: hidden;
}

.plan-weapon-text--clickable {
  cursor: pointer;
  transition: color 0.2s ease, text-shadow 0.2s ease;

  &:hover {
    color: #fde68a;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.45);
  }
}

.plan-weapon-text--selected {
  color: #f87171;
  text-shadow: 0 0 10px rgba(248, 113, 113, 0.5);
}

.ground-station-table {
  width: 100%;
}

.ground-target-name {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #7dd3fc;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s ease, text-shadow 0.2s ease;

  &:hover {
    color: #bae6fd;
    text-shadow: 0 0 8px rgba(125, 211, 252, 0.45);
  }
}

.ground-target-name--struck {
  color: #f87171;
  text-shadow: 0 0 8px rgba(248, 113, 113, 0.35);
}

.ground-target-name--selected {
  color: #22d3ee;
  text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
}

.ground-target-status--struck {
  color: #f87171;
  font-weight: 700;
}

.plan-time-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  font-size: 10px;
  color: #7dd3fc;
  font-family: Consolas, 'Courier New', monospace;
  line-height: 1.35;
  overflow: hidden;
  white-space: normal;
}

.plan-time-date,
.plan-time-clock {
  display: block;
}

.link-chain-table-wrap {
  width: 100%;
  max-width: 100%;
  overflow: hidden;
}

.link-chain-table {
  width: 100%;
  max-width: 100%;

  :deep(.atlas-app-table__inner-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-table__header-wrapper),
  :deep(.atlas-app-table__body-wrapper) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__wrap) {
    overflow-x: hidden !important;
  }

  :deep(.atlas-app-scrollbar__bar.is-horizontal) {
    display: none !important;
  }

  :deep(.atlas-app-table__body),
  :deep(.atlas-app-table__header) {
    width: 100% !important;
    min-width: 0 !important;
    table-layout: fixed;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(1)),
  :deep(.atlas-app-table__body colgroup col:nth-child(1)) {
    width: 46% !important;
  }

  :deep(.atlas-app-table__header colgroup col:nth-child(2)),
  :deep(.atlas-app-table__body colgroup col:nth-child(2)),
  :deep(.atlas-app-table__header colgroup col:nth-child(3)),
  :deep(.atlas-app-table__body colgroup col:nth-child(3)) {
    width: 27% !important;
  }

  :deep(col[name='gutter']) {
    width: 0 !important;
  }

  :deep(td.atlas-app-table__cell) {
    padding-top: 6px;
    padding-bottom: 6px;
    vertical-align: middle;
  }

  :deep(td.atlas-app-table__cell .cell) {
    display: flex;
    align-items: center;
    min-height: 100%;
  }
}

.link-chain-text {
  display: block;
  font-size: 10px;
  font-weight: 600;
  color: #7dd3fc;
  word-break: break-all;
  white-space: normal;
  line-height: 1.4;
  overflow: hidden;

  &--relay {
    color: #c4b5fd;
  }
}

.feedback-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: auto auto auto;
  gap: 8px 8px;
  padding: 10px 8px;
  border-radius: 6px;
  background: rgba(0, 225, 255, 0.04);
  border: 1px solid rgba(0, 225, 255, 0.1);
}

.feedback-cell {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;

  &--empty {
    min-height: 0;
  }
}

.feedback-link {
  font-size: 13px;
  font-weight: 600;
  color: #7dd3fc;
  word-break: break-word;
  line-height: 1.45;
  text-shadow: 0 0 6px rgba(125, 211, 252, 0.35);
}

.feedback-time {
  font-size: 13px;
  font-weight: 700;
  color: #40f2ff;
  font-family: Consolas, 'Courier New', monospace;
  word-break: break-word;
  line-height: 1.3;
  text-shadow: 0 0 8px rgba(64, 242, 255, 0.5);
}

.analysis-kpi-row {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 8px;
  padding-top: 4px;
}

.analysis-kpi-item {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 6px;
  background: rgba(0, 225, 255, 0.04);
  border: 1px solid rgba(0, 225, 255, 0.1);
}

.analysis-kpi-label {
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.3;
  white-space: nowrap;
}

.analysis-kpi-value {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  word-break: break-word;

  &--before {
    color: #4ade80;
  }

  &--after {
    color: #fb923c;
  }

  &--reduce {
    color: #f87171;
  }

  &--delay {
    color: #fbbf24;
    font-size: 16px;
    text-shadow: 0 0 8px rgba(251, 191, 36, 0.45);
  }
}

.empty-sat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  gap: 8px;

  .empty-icon {
    font-size: 28px;
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    color: #94a3b8;
  }

  .empty-sub {
    margin: 0;
    font-size: 12px;
  }
}

.task-loading-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(64, 242, 255, 0.2);
  border-top-color: #40f2ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
