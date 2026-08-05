<template>
  <div class="simulation-page">
    <section class="workspace-grid">
      <aside class="panel panel--left">
        <div class="panel-card panel-card--overview">
          <div class="panel-card__header header-overview">
            <h2>场景总览</h2>
            <div class="panel-card__actions">
              <span class="panel-badge btn" type="primary" plain size="small" @click="handleViewStrikePlanClick">
                查看打击方案
              </span>
              <span class="panel-badge">{{ simulationScenario.selectedPlanKey }}</span>
            </div>
          </div>

          <div class="plan-mode-switcher">
            <div class="plan-mode-switcher__buttons">
              <el-button
                :type="selectedHistoricalPlanMode === 'threat_first' ? 'primary' : 'default'"
                size="small"
                round
                :disabled="!selectedHistoricalPlan || isCurrentPlanLowOrMid"
                @click="switchHistoricalPlanMode('threat_first')"
              >
                威胁优先
              </el-button>
              <el-button
                :type="selectedHistoricalPlanMode === 'max_targets' ? 'primary' : 'default'"
                size="small"
                round
                :disabled="!selectedHistoricalPlan || isCurrentPlanLowOrMid"
                @click="switchHistoricalPlanMode('max_targets')"
              >
                数量优先
              </el-button>
            </div>
          </div>

          <div class="kv-list kv-list--overview">
            <div v-for="item in scenarioOverview" :key="item.label" class="kv-item">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
        </div>

        <div class="panel-card panel-card--stage">
          <div class="panel-card__header">
            <h2>阶段编排</h2>
            <span class="panel-subtitle">任务切换 · 时间窗口 </span>
          </div>

          <div class="stage-list">
            <button
              v-for="stage in stageList"
              :key="stage.name"
              class="stage-item"
              :class="{ 'is-active': activeStageName === stage.name }"
              type="button"
              @click="setActiveStage(stage.name)"
            >
              <span class="stage-item__dot"></span>
              <span class="stage-item__name">{{ stage.name }}</span>
              <span class="stage-item__time">{{ stage.window }}</span>
            </button>
          </div>
        </div>
      </aside>

      <main class="map-stage">
        <div class="map-stage__viewport">
          <div class="viewport-topbar">
            <div class="viewport-title">
              <strong>3D/4D 地球仿真区</strong>
            </div>

            <div class="layer-tags">
              <span
                v-for="layer in layerOptions"
                :key="layer"
                class="layer-tag"
                :class="{ 'is-active': activeLayerOption === layer }"
                @click="handleLayerOption(layer)"
              >
                {{ layer }}
              </span>
            </div>
          </div>

          <div class="globe-frame">
            <div v-show="!isCompareViewerLayer" ref="cesiumContainer" class="cesium-container">
              <div ref="credits" class="credits"></div>
            </div>
            <div
              v-if="activeLayerOption === '方案对比' || activeLayerOption === '对比视图'"
              class="compare-viewer-grid"
            >
              <div
                v-if="activeLayerOption === '方案对比' && selectedComparePlanCards.length"
                class="compare-viewer-grid__inner"
              >
                <section v-for="(card, index) in selectedComparePlanCards" :key="card.key" class="compare-viewer-card">
                  <header class="compare-viewer-card__header">
                    <strong>{{ card.plan.name }}</strong>
                    <span>{{ card.plan.version }} · {{ getHistoricalPlanModeLabel(card.mode) }}</span>
                  </header>
                  <div
                    :ref="(element) => setCompareViewerContainer(element as Element | null, index)"
                    class="compare-viewer-card__stage"
                  >
                    <div
                      :ref="(element) => setCompareViewerCredit(element as Element | null, index)"
                      class="credits"
                    ></div>
                  </div>
                </section>
              </div>
              <div
                v-else-if="activeLayerOption === '对比视图' && selectedHistoricalPlanDetail"
                class="compare-viewer-grid__inner"
              >
                <section class="compare-viewer-card">
                  <header class="compare-viewer-card__header">
                    <strong>打击前</strong>
                    <span>原始卫星态势视图</span>
                  </header>
                  <div
                    :ref="(element) => setCompareViewerContainer(element as Element | null, 0)"
                    class="compare-viewer-card__stage"
                  >
                    <div :ref="(element) => setCompareViewerCredit(element as Element | null, 0)" class="credits"></div>
                  </div>
                </section>
                <section class="compare-viewer-card">
                  <header class="compare-viewer-card__header">
                    <strong>打击后</strong>
                    <span>隐藏已打击卫星后的态势视图</span>
                  </header>
                  <div
                    :ref="(element) => setCompareViewerContainer(element as Element | null, 1)"
                    class="compare-viewer-card__stage"
                  >
                    <div :ref="(element) => setCompareViewerCredit(element as Element | null, 1)" class="credits"></div>
                  </div>
                </section>
              </div>
              <div v-else class="compare-viewer-grid__empty">
                {{
                  activeLayerOption === '方案对比' ? '请选择 1-4 个打击方案进行对比' : '请先加载打击方案后查看对比视图'
                }}
              </div>
            </div>
            <div v-if="showWeaponLegend" class="viewer-weapon-legend">
              <div class="viewer-weapon-legend__title">武器图例</div>
              <div v-for="item in weaponLegendItems" :key="item.label" class="viewer-weapon-legend__item">
                <i class="viewer-weapon-legend__dot" :style="{ backgroundColor: item.color }"></i>
                <span class="viewer-weapon-legend__label">{{ item.label }}</span>
                <strong class="viewer-weapon-legend__count">{{ item.count }}</strong>
              </div>
            </div>
          </div>
        </div>
      </main>

      <aside class="panel panel--right">
        <div class="panel-card panel-card--metrics">
          <div class="panel-card__header">
            <h2>指标面板</h2>
            <span class="panel-subtitle">任务 · 目标 · 资源</span>
          </div>

          <div class="metric-list">
            <div class="metric-status-grid">
              <div v-for="entity in entityStateList" :key="entity.label" class="entity-item">
                <span class="entity-item__label">{{ entity.label }}</span>
                <strong>{{ entity.value }}</strong>
              </div>
              <div v-for="effect in effectWindows" :key="effect.id" class="metric-status-card">
                <span class="metric-status-card__label">{{ effect.label }}</span>
                <strong class="metric-status-card__value">{{ effect.window }}</strong>
              </div>

              <div v-for="metric in metricCards" :key="metric.label" class="metric-status-card">
                <span class="metric-status-card__label">{{ metric.label }}</span>
                <strong class="metric-status-card__value">{{ metric.value }}</strong>
              </div>
            </div>
            <!-- 打击列表 -->
            <div class="strike-list">
              <ul class="strike-list__items">
                <li v-for="strike in strikeList" :key="strike.id" class="strike-item">
                  <div class="strike-item__info">
                    <strong>{{ strike.summary }}</strong>
                    <span>{{ strike.timeWindow }}</span>
                  </div>
                  <span
                    class="strike-item__status"
                    :class="{
                      'is-active': activeStrikeWindowIds.has(strike.id),
                      'is-completed': completedStrikeWindowIds.has(strike.id),
                    }"
                  >
                    {{
                      activeStrikeWindowIds.has(strike.id)
                        ? '打击中'
                        : completedStrikeWindowIds.has(strike.id)
                          ? '已打击'
                          : '待执行'
                    }}
                  </span>
                </li>
                <li v-if="!strikeList.length" class="strike-item strike-item--empty">
                  <span>{{ strikeValidationStatus }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </aside>
    </section>
    <!-- 打击方案选择对话框 -->
    <el-dialog v-model="historicalPlanDialogVisible" title="打击方案选择" fullscreen class="history-plan-dialog">
      <div class="history-plan-dialog__summary">
        <div>
          <strong>任务 {{ simulationScenario.taskId }}</strong>
        </div>
        <div class="history-plan-dialog__summary-actions">
          <span class="panel-badge">{{ filteredHistoricalPlanCards.length }} 个卡片</span>
          <span v-if="isCompareSelectionMode" class="panel-badge"
            >已勾选 {{ selectedHistoricalPlanKeys.length }}/4</span
          >
          <el-button
            v-if="isCompareSelectionMode"
            type="primary"
            :disabled="!selectedComparePlanCards.length"
            @click="applyComparePlans"
          >
            确认对比
          </el-button>
        </div>
      </div>

      <div class="history-plan-dialog__search-panel">
        <div class="history-plan-dialog__field">
          <span class="history-plan-dialog__field-label">方案名称</span>
          <el-input
            v-model="historicalPlanNameQuery"
            clearable
            placeholder="输入方案名称关键字"
            class="history-plan-dialog__search-input"
          />
        </div>

        <div class="history-plan-dialog__field">
          <span class="history-plan-dialog__field-label">打击烈度</span>
          <el-select v-model="historicalPlanIntensityFilter" clearable class="history-plan-dialog__select">
            <el-option label="全部" value="all" />
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </div>

        <div class="history-plan-dialog__field">
          <span class="history-plan-dialog__field-label">打击卫星类型</span>
          <el-select
            v-model="historicalPlanSatelliteTypeFilter"
            clearable
            filterable
            class="history-plan-dialog__select"
            placeholder="全部类型"
          >
            <el-option v-for="type in historicalPlanSatelliteTypeOptions" :key="type" :label="type" :value="type" />
          </el-select>
        </div>

        <div class="history-plan-dialog__field history-plan-dialog__field--mode">
          <span class="history-plan-dialog__field-label">打击模式</span>
          <el-radio-group v-model="historicalPlanModeFilter" class="history-plan-dialog__mode-group">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="threat_first">威胁优先</el-radio-button>
            <el-radio-button value="max_targets">数量优先</el-radio-button>
          </el-radio-group>
        </div>
      </div>

      <div v-if="filteredHistoricalPlanCards.length" class="history-plan-dialog__card-grid">
        <article v-for="card in filteredHistoricalPlanCards" :key="card.key" class="history-plan-card">
          <div class="history-plan-card__header">
            <div class="history-plan-card__title-block">
              <span class="history-plan-card__eyebrow">方案名称</span>
              <h3 class="history-plan-card__title">{{ card.plan.name }}</h3>
              <p class="history-plan-card__subline">{{ card.plan.version }}</p>
            </div>
            <div
              class="history-plan-card__badges"
              :class="{ 'history-plan-card__badges--selection': isCompareSelectionMode }"
            >
              <button
                v-if="isCompareSelectionMode"
                class="history-plan-card__selector"
                :class="{ 'is-checked': isHistoricalPlanChecked(card.key) }"
                type="button"
                @click.stop="toggleHistoricalPlanSelection(card.key)"
              >
                <span class="history-plan-card__selector-box"></span>
                <span>对比</span>
              </button>
              <span class="history-plan-card__badge history-plan-card__badge--mode" :class="`is-${card.mode}`">
                {{ getHistoricalPlanModeLabel(card.mode) }}
              </span>
              <span class="history-plan-card__badge">{{
                formatHistoricalPlanIntensity(card.plan.intensityLevel)
              }}</span>
            </div>
          </div>

          <div class="history-plan-card__stats">
            <div class="history-plan-card__stat">
              <span>方案打击烈度</span>
              <strong>{{ formatHistoricalPlanIntensity(card.plan.intensityLevel) }}</strong>
            </div>
            <div class="history-plan-card__stat">
              <span>输入卫星数量</span>
              <strong>{{ card.detail?.plan_summary.overview.input_count ?? 0 }}</strong>
            </div>
            <div class="history-plan-card__stat">
              <span>减少卫星数量</span>
              <strong>{{ card.detail?.plan_summary.overview.targets_count ?? 0 }}</strong>
            </div>
            <div class="history-plan-card__stat history-plan-card__stat--wide">
              <span>打击方案时间窗口</span>
              <span>{{ card.detail?.plan_summary.time_window.range || '--' }}</span>
            </div>
          </div>

          <div class="history-plan-card__section">
            <span class="history-plan-card__section-title">方案打击卫星类型</span>
            <div class="history-plan-card__chips" v-if="card.plan.types?.length">
              <span v-for="type in card.plan.types" :key="type" class="history-plan-card__chip">{{ type }}</span>
            </div>
            <div v-else class="history-plan-card__empty-inline">--</div>
          </div>

          <div class="history-plan-card__section">
            <span class="history-plan-card__section-title">重点打击卫星</span>
            <div class="history-plan-card__chips" v-if="card.detail?.plan_summary.target_analysis?.length">
              <span
                v-for="target in card.detail.plan_summary.target_analysis"
                :key="`${card.key}-${target.norad_id}`"
                class="history-plan-card__chip history-plan-card__chip--target"
              >
                NORAD {{ target.norad_id }}
              </span>
            </div>
            <div v-else class="history-plan-card__empty-inline">--</div>
          </div>

          <div class="history-plan-card__footer">
            <span class="history-plan-card__footer-note">{{
              card.detail?.plan_summary.strategy.plan_type_hint || '--'
            }}</span>
            <el-button type="primary" round @click.stop="handleHistoricalPlanSelect(card.plan, card.mode)">
              加载方案
            </el-button>
            <el-button type="danger" round @click.stop="deleteHistoricalPlan(card.plan._id)"> 删除方案 </el-button>
          </div>
        </article>
      </div>

      <el-empty v-else description="未找到符合条件的打击方案" />
    </el-dialog>
    <!-- 杀伤链打击方案选择对话框 -->
    <el-dialog v-model="killChainDialogVisible" title="打击方案选择" fullscreen class="killchain-plan-dialog">
      <div>
        <el-radio-group v-model="activeStrikeIntensity" class="killchain-plan-dialog__radio-group">
          <el-radio-button v-for="label in strikeIntensity" :key="label" :value="label">{{ label }}</el-radio-button>
        </el-radio-group>

        <!-- 渲染 lowKillChainPlans -->
        <div v-if="activeStrikeIntensity === '低烈度'" class="killchain-plan-dialog__grid">
          <template v-for="plan in lowKillChainPlans" :key="plan._id">
            <article v-for="(subPlan, subIdx) in plan.plan" :key="`${plan._id}-${subIdx}`" class="killchain-plan-card">
              <div class="killchain-plan-card__header">
                <div class="killchain-plan-card__title-block">
                  <span class="killchain-plan-card__eyebrow">低烈度杀伤链 - 方案 {{ subIdx + 1 }}</span>
                  <h3 class="killchain-plan-card__title">{{ plan.name }}</h3>
                  <p class="killchain-plan-card__subline">版本: {{ plan.version }}</p>
                </div>
                <div class="killchain-plan-card__badges">
                  <span class="killchain-plan-card__badge">链路: {{ subPlan.actualChainNum }}</span>
                  <span class="killchain-plan-card__badge">卫星: {{ subPlan.actualSatelliteNum }}</span>
                  <span class="killchain-plan-card__badge">地面站: {{ subPlan.actualStationNum }}</span>
                </div>
              </div>

              <div class="killchain-plan-card__stats">
                <div class="killchain-plan-card__stat">
                  <span>目标地面站数</span>
                  <strong>{{ subPlan.targetStationNum }} 个</strong>
                </div>
                <div class="killchain-plan-card__stat">
                  <span>干扰武器数</span>
                  <strong>{{ subPlan.elecWeapons?.length || 0 }} 个</strong>
                </div>
                <div class="killchain-plan-card__stat killchain-plan-card__stat--wide">
                  <span>方案时间窗口</span>
                  <strong>{{ subPlan.planWindowStart || '--' }} 至 {{ subPlan.planWindowEnd || '--' }}</strong>
                </div>
              </div>

              <div class="killchain-plan-card__section" v-if="subPlan.elecWeapons?.length">
                <span class="killchain-plan-card__section-title">使用电子干扰武器</span>
                <div class="killchain-plan-card__chips">
                  <span v-for="w in subPlan.elecWeapons" :key="w.id" class="killchain-plan-card__chip">
                    {{ w.name }} ({{ w.country }})
                  </span>
                </div>
              </div>

              <div class="killchain-plan-card__footer">
                <el-button type="primary" round @click="handleLoadKillChainPlan({ ...plan, plan: [subPlan] })">
                  加载方案
                </el-button>
              </div>
            </article>
          </template>
          <el-empty v-if="!lowKillChainPlans.length" description="暂无低烈度杀伤链方案" />
        </div>

        <!-- 渲染 middleKillChainPlans -->
        <div v-else-if="activeStrikeIntensity === '中烈度'" class="killchain-plan-dialog__grid">
          <template v-for="plan in middleKillChainPlans" :key="plan._id">
            <article v-for="(subPlan, subIdx) in plan.plan" :key="`${plan._id}-${subIdx}`" class="killchain-plan-card">
              <div class="killchain-plan-card__header">
                <div class="killchain-plan-card__title-block">
                  <span class="killchain-plan-card__eyebrow">中烈度杀伤链 - {{ subPlan.planType }}</span>
                  <h3 class="killchain-plan-card__title">{{ plan.name }}</h3>
                  <p class="killchain-plan-card__subline">版本: {{ plan.version }}</p>
                </div>
                <div class="killchain-plan-card__badges">
                  <span class="killchain-plan-card__badge is-type">类型: {{ subPlan.planType }}</span>
                  <span class="killchain-plan-card__badge is-price">总成本: ¥{{ subPlan.totalPrice }}</span>
                </div>
              </div>

              <div class="killchain-plan-card__stats">
                <div class="killchain-plan-card__stat">
                  <span>目标/实际地面站</span>
                  <strong>{{ subPlan.targetStationNum }} / {{ subPlan.actualStationNum }} 个</strong>
                </div>
                <div class="killchain-plan-card__stat">
                  <span>平均/最大打击度</span>
                  <strong>{{ subPlan.avgStrike }} / {{ subPlan.maxStrike }}</strong>
                </div>
                <div class="killchain-plan-card__stat killchain-plan-card__stat--wide">
                  <span>方案时间窗口</span>
                  <strong>{{ subPlan.planWindowStart || '--' }} 至 {{ subPlan.planWindowEnd || '--' }}</strong>
                </div>
              </div>

              <div class="killchain-plan-card__section" v-if="subPlan.missileBases?.length">
                <span class="killchain-plan-card__section-title">导弹基地</span>
                <div class="killchain-plan-card__chips">
                  <span
                    v-for="base in subPlan.missileBases"
                    :key="base.missileBaseId"
                    class="killchain-plan-card__chip"
                  >
                    {{ base.missileBaseName }} ({{ base.country }})
                  </span>
                </div>
              </div>

              <div class="killchain-plan-card__footer">
                <el-button type="primary" round @click="handleLoadKillChainPlan({ ...plan, plan: [subPlan] })">
                  加载方案
                </el-button>
              </div>
            </article>
          </template>
          <el-empty v-if="!middleKillChainPlans.length" description="暂无中烈度杀伤链方案" />
        </div>

        <!-- 渲染 highKillChainPlans -->
        <div v-else-if="activeStrikeIntensity === '高烈度'" class="killchain-plan-dialog__grid">
          <template v-for="plan in highKillChainPlans" :key="plan._id">
            <article v-for="(subPlan, subIdx) in plan.plan" :key="`${plan._id}-${subIdx}`" class="killchain-plan-card">
              <div class="killchain-plan-card__header">
                <div class="killchain-plan-card__title-block">
                  <span class="killchain-plan-card__eyebrow">高烈度杀伤链 - 方案 {{ subIdx + 1 }}</span>
                  <h3 class="killchain-plan-card__title">{{ plan.name }}</h3>
                  <p class="killchain-plan-card__subline">版本: {{ plan.version }}</p>
                </div>
                <div class="killchain-plan-card__badges">
                  <span class="killchain-plan-card__badge is-feasible">可行方案: {{ subPlan.feasible_count }}</span>
                </div>
              </div>

              <div class="killchain-plan-card__stats">
                <div class="killchain-plan-card__stat">
                  <span>可行方案数</span>
                  <strong>{{ subPlan.feasible_count }} 个</strong>
                </div>
                <div class="killchain-plan-card__stat">
                  <span>最大窗口时长</span>
                  <strong>{{ subPlan.max_window_duration_min }} 分钟</strong>
                </div>
                <div class="killchain-plan-card__stat killchain-plan-card__stat--wide" v-if="plan.types?.length">
                  <span>打击卫星类型</span>
                  <div class="killchain-plan-card__chips" style="margin-top: 6px">
                    <span v-for="t in plan.types" :key="t" class="killchain-plan-card__chip">{{ t }}</span>
                  </div>
                </div>
              </div>

              <div class="killchain-plan-card__footer is-high">
                <el-button
                  type="primary"
                  round
                  @click="handleLoadKillChainPlan({ ...plan, plan: [subPlan] }, 'threat_first')"
                >
                  加载 (威胁优先)
                </el-button>
                <el-button
                  type="success"
                  round
                  @click="handleLoadKillChainPlan({ ...plan, plan: [subPlan] }, 'max_targets')"
                >
                  加载 (数量优先)
                </el-button>
              </div>
            </article>
          </template>
          <el-empty v-if="!highKillChainPlans.length" description="暂无高烈度杀伤链方案" />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as Cesium from 'cesium'

import { useLayoutStore } from '@/store/modules/layout'
import { formatTimeLineAndAnimation, markBattleArea } from '@/utils/cesium/functionTool'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { bindInfoBoxButton, unbindInfoBoxButton } from '@/utils/cesium/infoBox'
import { getSatelliteDetail } from '@/api/dashboard'
import type {
  StrikePlanV2Extended,
  RespKillChainPlanLow,
  RespKillChainPlanMiddle,
  RespKillChainPlanHigh,
} from '@/api/strikePlan/satellite-strikeplan-api'
import { parseLatLonToCoords, parseMissionWindowDate } from './helpers/dateFormat'

import { useSceneData } from './composables/useSceneData'
import { useStrikePlan } from './composables/useStrikePlan'
import { useSimulationPlayback } from './composables/useSimulationPlayback'
import { useSatelliteRelation } from './composables/useSatelliteRelation'
import { useCompareViewers } from './composables/useCompareViewers'
import { useBattleEntities } from './composables/useBattleEntities'

const CHINA_OVERVIEW_LON = 107.4
const CHINA_OVERVIEW_LAT = 33.42
const CHINA_OVERVIEW_HEIGHT = 40000000
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL as string | undefined

const store = useLayoutStore()

const cesiumContainer = ref<HTMLDivElement | null>(null)
const credits = ref<Element>()
const viewer = shallowRef<Cesium.Viewer | null>(null)
const isViewerReady = ref(false)
let viewerInitializing = false
let resizeObserver: ResizeObserver | null = null

const activeLayerOption = ref('打击视图')
const selectedSatelliteNoradId = ref('')
const selectedSatelliteDetail = ref<any>(null)
const blueSatellites = ref<any[]>([])
const redWeapons = ref<any[]>([])
let selectedSatelliteDetailRequestSeq = 0
let clockTickListener: (() => void) | null = null

// ─── 组合式逻辑 ───
const {
  taskSatellites,
  taskWeapons,
  missileBases,
  baseStations,
  historicalPlans,
  clearSatelliteTleCache,
  getSatellitePositionAtTime,
  buildSatelliteOrbitPositions,
  preloadHistoricalPlans,
  loadSceneData,
} = useSceneData()

const taskStepsList = computed<TaskSteps[]>(() => {
  try {
    return store.activedTask?.steps ? (JSON.parse(store.activedTask.steps) as TaskSteps[]) : []
  } catch {
    return []
  }
})

const {
  historicalPlanDialogVisible,
  historicalPlanDialogMode,
  selectedHistoricalPlan,
  selectedHistoricalPlanMode,
  selectedHistoricalPlanDetail,
  loadedKillChainPlan,
  isCurrentPlanLowOrMid,
  isCurrentPlan2D,
  historicalPlanNameQuery,
  historicalPlanIntensityFilter,
  historicalPlanSatelliteTypeFilter,
  historicalPlanModeFilter,
  selectedHistoricalPlanKeys,
  killChainDialogVisible,
  strikeIntensity,
  activeStrikeIntensity,
  lowKillChainPlans,
  middleKillChainPlans,
  highKillChainPlans,
  selectedComparePlanCards,
  isCompareSelectionMode,
  filteredHistoricalPlanCards,
  selectedPlanMissionWindows,
  selectedPlanInputCount,
  selectedHistoricalPlanWeaponIds,
  selectedHistoricalPlanLabel,
  historicalPlanSatelliteTypeOptions,
  getHistoricalPlanModeLabel,
  formatHistoricalPlanIntensity,
  isHistoricalPlanChecked,
  toggleHistoricalPlanSelection,
  openHistoricalPlanDialog,
  syncSelectedHistoricalPlanDetail,
  deleteHistoricalPlan,
  loadAllKillChainPlan,
  handleLoadKillChainPlan: loadKillChainPlanAction,
} = useStrikePlan(historicalPlans, preloadHistoricalPlans)

const {
  playSpeed,
  isPlaying,
  activeStrikeWindowIds,
  completedStrikeWindowIds,
  strikeValidationStatus,
  activeStageName,
  clockWindow,
  stageList,
  strikeList,
  completedTargetSatelliteIds,
  simulationScenario,
  scenarioOverview,
  effectWindows,
  entityStateList,
  metricCards,
  resetStrikeRuntimeState,
  syncStrikeRuntimeFromClock,
  syncPlaybackCursorFromClock,
  syncActiveStageFromClock,
  syncTaskProgressFromClock,
  applyClockWindow,
  consumeStageChangeFromClock,
  getMissionRuntimeState,
} = useSimulationPlayback(
  viewer,
  taskStepsList,
  selectedHistoricalPlan,
  selectedHistoricalPlanDetail,
  selectedPlanMissionWindows,
  selectedPlanInputCount,
  selectedHistoricalPlanWeaponIds,
  taskWeapons,
  blueSatellites,
  selectedHistoricalPlanLabel,
  () => refreshCompareViewers()
)

const selectedSatelliteRecord = computed(
  () => blueSatellites.value.find((satellite) => satellite.noradId === selectedSatelliteNoradId.value) ?? null
)

const {
  satelliteRelationEdges,
  satelliteRelationTaskId,
  satelliteRelationSourceNorad,
  getSelectedSatelliteRelations,
  loadSatelliteRelationData,
} = useSatelliteRelation(blueSatellites, viewer, getSatellitePositionAtTime)

const {
  setCompareViewerContainer,
  setCompareViewerCredit,
  initCompareViewers,
  destroyCompareViewers,
  refreshCompareViewers,
} = useCompareViewers(
  viewer,
  blueSatellites,
  selectedComparePlanCards,
  completedTargetSatelliteIds,
  activeLayerOption,
  selectedHistoricalPlanDetail
)

/**
 * 飞行至中国概览视角（俯视全景）
 * @param duration 飞行动画持续时间（秒），默认 1.6s
 */
const flyToChinaOverview = (duration = 1.6) => {
  if (!viewer.value) return
  viewer.value.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(CHINA_OVERVIEW_LON, CHINA_OVERVIEW_LAT, CHINA_OVERVIEW_HEIGHT),
    orientation: { heading: 0.0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0.0 },
    duration,
  })
}
/**
 * 飞到场景
 */
const flyToScene = () => {
  if (!viewer.value) return
  flyToChinaOverview(1.8)
}

/**
 * 重置场景和时钟
 */
const resetOverviewAndClockAfterCompletion = () => {
  if (!viewer.value) return
  isPlaying.value = false
  viewer.value.clock.shouldAnimate = false
  applyClockWindow(true)
  flyToChinaOverview(1.2)
  viewer.value.scene.requestRender()
}

const { renderBattleEntities, clearBattleEntities } = useBattleEntities(
  viewer,
  activeLayerOption,
  selectedPlanMissionWindows,
  selectedSatelliteRecord,
  blueSatellites,
  redWeapons,
  completedStrikeWindowIds,
  selectedSatelliteNoradId,
  selectedSatelliteDetail,
  {
    getSelectedSatelliteRelations: () => getSelectedSatelliteRelations(selectedSatelliteRecord.value),
    getSatellitePositionAtTime,
    buildSatelliteOrbitPositions,
    flyToScene,
    getMissionRuntimeState,
  }
)

const isCompareViewerLayer = computed(
  () => activeLayerOption.value === '方案对比' || activeLayerOption.value === '对比视图'
)
const layerOptions = computed(() => ['标注战场', '打击视图', '杀伤链', '关系卫星', '对比视图', '场景复位', '方案对比'])

/**
 * 判断容器是否初始化完成
 * @param element 容器
 */
const hasValidContainerSize = (element: HTMLElement | null) => {
  if (!element) return false
  return element.clientWidth > 0 && element.clientHeight > 0
}
/**
 * 等待容器准备就绪
 * @param maxFrames 最大等待帧数
 */
const waitForContainerReady = async (maxFrames = 120) => {
  for (let index = 0; index < maxFrames; index += 1) {
    if (hasValidContainerSize(cesiumContainer.value)) return true
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  return false
}
/**
 * 启动ResizeObserver
 */
const startResizeObserver = () => {
  if (!cesiumContainer.value || resizeObserver) return
  resizeObserver = new ResizeObserver(() => {
    if (!viewer.value && hasValidContainerSize(cesiumContainer.value)) {
      void initViewer()
      return
    }
    if (viewer.value) {
      viewer.value.useDefaultRenderLoop = hasValidContainerSize(cesiumContainer.value)
      viewer.value.scene.requestRender()
      ;(viewer.value as any).resize?.()
    }
  })
  resizeObserver.observe(cesiumContainer.value)
}

/**
 * 停止并销毁 ResizeObserver，释放对容器的观察
 */
const stopResizeObserver = () => {
  if (!resizeObserver) return
  resizeObserver.disconnect()
  resizeObserver = null
}
/**
 * 处理图层切换操作，根据选中的图层名称执行不同的场景渲染逻辑
 * @param layer 目标图层名称
 */
const handleLayerOption = async (layer: string) => {
  if (!viewer.value) return
  if (activeLayerOption.value === layer) return

  if (layer === '关系卫星' && !selectedSatelliteRecord.value) {
    ElMessage.warning('请先选中一颗卫星再查看关系卫星')
    return
  }

  const previousLayer = activeLayerOption.value

  // 所有切换 Layer 后动画全部暂停
  viewer.value.clock.shouldAnimate = false

  if (previousLayer === '关系卫星' && layer !== '关系卫星') {
    selectedSatelliteNoradId.value = ''
    selectedSatelliteDetail.value = null
    selectedSatelliteDetailRequestSeq += 1
    satelliteRelationEdges.value = []
    satelliteRelationTaskId.value = null
    satelliteRelationSourceNorad.value = null
  }

  if (previousLayer === '方案对比' && layer !== '方案对比') {
    historicalPlanDialogVisible.value = false
    destroyCompareViewers()
  }

  activeLayerOption.value = layer

  switch (layer) {
    case '标注战场':
      markBattleArea(viewer.value, store.battle, 15000000)
      renderBattleEntities(true)
      break
    case '打击视图':
      if (previousLayer === '关系卫星' && selectedHistoricalPlan.value) {
        // 从关系卫星切回：方案仍在，直接重渲染并恢复时钟
        refreshSceneEntities(true, true)
        viewer.value.clock.shouldAnimate = isPlaying.value
      } else {
        if (loadedKillChainPlan.value) {
          resetLoadedHistoricalPlanScene(true)
        }
        await restoreScene()
      }
      break
    case '关系卫星':
      await loadSatelliteRelationData(Number(selectedSatelliteRecord.value!.noradId))
      renderBattleEntities(true)
      break
    case '对比视图':
      renderBattleEntities(true)
      break
    case '方案对比':
      if (selectedHistoricalPlan.value || activeStrikeWindowIds.value.size || completedStrikeWindowIds.value.size) {
        resetLoadedHistoricalPlanScene(true)
      }
      openHistoricalPlanDialog('compare')
      await nextTick()
      await initCompareViewers()
      break
    case '场景复位':
      await restoreScene()
      resetOverviewAndClockAfterCompletion()
      break
    case '杀伤链':
      if (previousLayer === '关系卫星' && loadedKillChainPlan.value) {
        // 从关系卫星切回：杀伤链方案仍在，借助打击视图渲染实体后恢复图层
        activeLayerOption.value = '打击视图'
        refreshSceneEntities(true, true)
        activeLayerOption.value = '杀伤链'
        viewer.value.clock.shouldAnimate = isPlaying.value
      } else {
        viewer.value.entities.removeAll()
        viewer.value.clock.currentTime = Cesium.JulianDate.fromDate(
          parseMissionWindowDate(store.activedTask?.beginDate)
        )
        viewer.value.clock.multiplier = 1
        await loadAllKillChainPlan()
        resetLoadedHistoricalPlanScene(true)
        activeStrikeIntensity.value = '低烈度'
      }
      break
  }
}

const { openSatelliteProfile } = useSatelliteProfileDialog()

/**
 * 点击“查看打击方案”按钮的处理函数
 * 根据当前图层状态，打开对应的打击方案选择对话框
 */
const handleViewStrikePlanClick = () => {
  if (!store.activedTask?.id) {
    ElMessage.warning('请先选择任务后再查看打击方案')
    return
  }
  if (activeLayerOption.value === '杀伤链') {
    killChainDialogVisible.value = true
    return
  }
  openHistoricalPlanDialog('single')
}

/**
 * 选中并加载一个历史打击方案，切换至打击视图并重新启动仿真
 * @param plan 选中的打击方案扩展对象
 * @param mode 可选打击模式：'threat_first' 威胁优先 / 'max_targets' 数量优先
 */
const handleHistoricalPlanSelect = (plan: StrikePlanV2Extended, mode?: 'threat_first' | 'max_targets') => {
  activeLayerOption.value = '打击视图'
  selectedHistoricalPlan.value = plan
  if (mode) {
    selectedHistoricalPlanMode.value = mode
  }
  syncSelectedHistoricalPlanDetail()
  restartSimulationFromStart(true)
  historicalPlanDialogVisible.value = false
  ElMessage.success(`已加载打击方案：${plan.name} ${plan.version}`)
}

/**
 * 切换当前已加载历史打击方案的打击模式，并重新启动仿真
 * @param mode 目标打击模式：'threat_first' 威胁优先 / 'max_targets' 数量优先
 */
const switchHistoricalPlanMode = (mode: 'threat_first' | 'max_targets') => {
  if (!selectedHistoricalPlan.value || selectedHistoricalPlanMode.value === mode) return
  selectedHistoricalPlanMode.value = mode
  syncSelectedHistoricalPlanDetail()
  restartSimulationFromStart(true)
}

/**
 * 加载杀伤链打击方案（低 / 中 / 高烈度），并触发历史方案选中逻辑
 * @param plan 杀伤链方案对象
 * @param mode 打击模式，默认 'threat_first'（威胁优先）
 */
const handleLoadKillChainPlan = (
  plan: RespKillChainPlanLow | RespKillChainPlanMiddle | RespKillChainPlanHigh,
  mode: 'threat_first' | 'max_targets' = 'threat_first'
) => {
  if (!viewer.value) return
  loadKillChainPlanAction(plan, mode, handleHistoricalPlanSelect)
  // 杀伤链方案加载后保持杀伤链视图，不切换到打击视图
  activeLayerOption.value = '杀伤链'
}

/**
 * 确认并应用已勾选的对比方案，关闭选择对话框后初始化对比视图
 */
const applyComparePlans = async () => {
  if (!selectedComparePlanCards.value.length) {
    ElMessage.warning('请先选择至少 1 个打击方案')
    return
  }
  historicalPlanDialogVisible.value = false
  await nextTick()
  await initCompareViewers()
}

/**
 * 从起始时间重新启动仿真，重置打击运行状态并刷新场景实体
 * @param resetEntities 是否重置场景实体，默认 true
 */
const restartSimulationFromStart = (resetEntities = true) => {
  if (!viewer.value) return
  resetStrikeRuntimeState('方案已加载，等待时间推进')

  isPlaying.value = true
  viewer.value.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER
  viewer.value.clock.shouldAnimate = true
  applyClockWindow(true)
  refreshSceneEntities(true, resetEntities)
}

/**
 * 刷新场景中的战场实体（卫星、武器等），根据当前加载的方案类型
 * （杀伤链低 / 中烈度或高烈度打击方案）重新构建红蓝实体数据
 * @param fitScene 是否调整视角以适应场景，默认 false
 * @param resetEntities 是否重置所有实体，默认 false
 */
const refreshSceneEntities = (fitScene = false, resetEntities = false) => {
  const weaponIds = selectedHistoricalPlanWeaponIds.value

  if (loadedKillChainPlan.value) {
    const intensity = loadedKillChainPlan.value.intensityLevel
    if (intensity === '低烈度') {
      const planLow = loadedKillChainPlan.value as RespKillChainPlanLow
      const plans = Array.isArray(planLow.plan) ? planLow.plan : [planLow.plan]

      const allElecWeapons = plans.flatMap((p) => p.elecWeapons || [])
      const uniqueElecWeaponsMap = new Map(allElecWeapons.map((ew) => [String(ew.id), ew]))
      const uniqueElecWeapons = Array.from(uniqueElecWeaponsMap.values())

      const elecNames = new Set(uniqueElecWeapons.map((ew) => ew.name))
      const elecIds = new Set(uniqueElecWeapons.map((ew) => String(ew.id)))
      const filtered = taskWeapons.value.filter((tw) => elecIds.has(String(tw.id)) || elecNames.has(tw.name))
      redWeapons.value = filtered.length > 0 ? filtered : uniqueElecWeapons

      const allStationDetails = plans.flatMap((p) => p.stationDetails || [])
      const uniqueStationsMap = new Map(allStationDetails.map((sd) => [sd.stationId, sd]))
      const uniqueStations = Array.from(uniqueStationsMap.values())

      const stNames = new Set(uniqueStations.map((sd) => sd.stationName))
      const stIds = new Set(uniqueStations.map((sd) => sd.stationId))
      const filteredStations = baseStations.value.filter((bs) => stIds.has(bs._id || '') || stNames.has(bs.name))
      const stationsToMap =
        filteredStations.length > 0
          ? filteredStations
          : uniqueStations.map((sd) => ({
              _id: sd.stationId,
              name: sd.stationName,
              country: sd.country,
              type: sd.type,
              latLon: sd.latLon,
            }))
      blueSatellites.value = stationsToMap.map((sd) => {
        const coords = parseLatLonToCoords(sd.latLon || '')
        return {
          noradId: sd._id || '',
          name: sd.name,
          country: sd.country || '',
          satType: sd.type || '雷达站',
          longitude: coords.longitude,
          latitude: coords.latitude,
          altitude: 100,
          stageName: '',
        }
      })
    } else if (intensity === '中烈度') {
      const planMiddle = loadedKillChainPlan.value as RespKillChainPlanMiddle
      const plans = Array.isArray(planMiddle.plan) ? planMiddle.plan : [planMiddle.plan]

      const allMissileBases = plans.flatMap((p) => p.missileBases || [])
      const uniqueBasesMap = new Map(allMissileBases.map((mb) => [mb.missileBaseId, mb]))
      const uniqueBases = Array.from(uniqueBasesMap.values())

      const mbNames = new Set(uniqueBases.map((mb) => mb.missileBaseName))
      const mbIds = new Set(uniqueBases.map((mb) => mb.missileBaseId))
      const filteredMissileBases = missileBases.value.filter((mb) => mbIds.has(mb._id || '') || mbNames.has(mb.name))
      const basesToMap =
        filteredMissileBases.length > 0
          ? filteredMissileBases
          : uniqueBases.map((mb) => ({
              _id: mb.missileBaseId,
              name: mb.missileBaseName,
              latLon: mb.latLon,
              country: mb.country,
            }))
      const basesMapped = basesToMap.map((mb) => {
        const coords = parseLatLonToCoords(mb.latLon || '')
        return {
          id: mb._id,
          name: mb.name,
          country: mb.country || '',
          type: '导弹基地',
          latitude: coords.latitude,
          longitude: coords.longitude,
          range: 3000,
        }
      })

      // 加载当前任务下的定向能武器
      const allDirectedWindows = plans.flatMap((p) => p.directedWindows || [])
      const directedWeaponIds = new Set(allDirectedWindows.map((dw) => String(dw.weapon_id)))
      const directedWeaponNames = new Set(allDirectedWindows.map((dw) => dw.weapon_name))
      const filteredDirectedWeapons = taskWeapons.value.filter(
        (tw) => directedWeaponIds.has(String(tw.id)) || directedWeaponNames.has(tw.name)
      )

      redWeapons.value = [...basesMapped, ...filteredDirectedWeapons]

      const allStationDetails = plans.flatMap((p) => p.stationDetails || [])
      const uniqueStationsMap = new Map(allStationDetails.map((sd) => [sd.stationId, sd]))
      const uniqueStations = Array.from(uniqueStationsMap.values())

      const stNames = new Set(uniqueStations.map((sd) => sd.stationName))
      const stIds = new Set(uniqueStations.map((sd) => sd.stationId))
      const filteredStations = baseStations.value.filter((bs) => stIds.has(bs._id || '') || stNames.has(bs.name))
      const stationsToMap =
        filteredStations.length > 0
          ? filteredStations
          : uniqueStations.map((sd) => ({
              _id: sd.stationId,
              name: sd.stationName,
              country: sd.country,
              type: sd.type,
              latLon: sd.latLon,
            }))
      const stationsMapped = stationsToMap.map((sd) => {
        const coords = parseLatLonToCoords(sd.latLon || '')
        return {
          noradId: sd._id || '',
          name: sd.name,
          country: sd.country || '',
          satType: sd.type || '基站',
          longitude: coords.longitude,
          latitude: coords.latitude,
          altitude: 100,
          stageName: '',
        }
      })

      // 同时加载当前任务下的卫星轨迹数据（tle）
      blueSatellites.value = [...stationsMapped, ...taskSatellites.value]
    } else {
      // 高烈度：与普通历史方案相同，使用任务卫星和武器
      if (weaponIds.size) {
        redWeapons.value = taskWeapons.value.filter((weapon) => weaponIds.has(String(weapon.id)))
      } else {
        redWeapons.value = [...taskWeapons.value]
      }
      blueSatellites.value = [...taskSatellites.value]
    }
  } else {
    if (weaponIds.size) {
      redWeapons.value = taskWeapons.value.filter((weapon) => weaponIds.has(String(weapon.id)))
    } else {
      redWeapons.value = [...taskWeapons.value]
    }
    blueSatellites.value = [...taskSatellites.value]
  }

  syncStrikeRuntimeFromClock()
  renderBattleEntities(!fitScene, resetEntities)
}

/**
 * 设置当前激活的任务阶段，并将时钟跳转至该阶段的起始时间
 * @param name 阶段名称（对应 taskStepsList 中的 name 字段）
 */
const setActiveStage = (name: string) => {
  activeStageName.value = name
  if (!viewer.value) return
  const stage = taskStepsList.value.find((item) => item.name === name)
  if (!stage) return
  const startDate = new Date(stage.startTime)
  if (Number.isNaN(startDate.getTime())) return

  isPlaying.value = true
  viewer.value.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER
  viewer.value.clock.shouldAnimate = true
  viewer.value.clock.currentTime = Cesium.JulianDate.addSeconds(
    Cesium.JulianDate.fromDate(startDate),
    1,
    new Cesium.JulianDate()
  )
  viewer.value.scene.requestRender()
  syncPlaybackCursorFromClock()
  syncStrikeRuntimeFromClock()
}

/**
 * 恢复场景至初始状态：清除卫星选中、关系图数据及所有战场实体，重新渲染场景
 */
const restoreScene = async () => {
  if (!viewer.value) return

  selectedSatelliteNoradId.value = ''
  satelliteRelationEdges.value = []
  satelliteRelationTaskId.value = null
  satelliteRelationSourceNorad.value = null

  viewer.value.selectedEntity = undefined
  clearBattleEntities()
  refreshSceneEntities(false, true)
}

/**
 * 重置已加载的历史打击方案及相关场景状态，停止仿真并恢复时钟窗口
 * @param resetEntities 是否同时重置场景实体，默认 true
 */
const resetLoadedHistoricalPlanScene = (resetEntities = true) => {
  selectedHistoricalPlan.value = null
  selectedHistoricalPlanDetail.value = null
  loadedKillChainPlan.value = null
  resetStrikeRuntimeState('未加载打击方案')
  isPlaying.value = false

  if (!viewer.value) return

  viewer.value.clock.shouldAnimate = false
  applyClockWindow(true)
  refreshSceneEntities(true, resetEntities)
}

/**
 * 根据 NORAD ID 异步加载卫星详情，并在加载完成后刷新战场实体
 * 使用请求序列号防止竞态条件（旧请求结果不覆盖新请求）
 * @param noradId 卫星的 NORAD 编号
 */
const loadSelectedSatelliteDetail = async (noradId: number) => {
  if (!Number.isFinite(noradId) || noradId <= 0) {
    selectedSatelliteDetail.value = null
    return
  }

  const requestSeq = ++selectedSatelliteDetailRequestSeq
  const res = await getSatelliteDetail({ norad: noradId })
  if (requestSeq !== selectedSatelliteDetailRequestSeq) return

  if (res.code === 200 && res.data) {
    selectedSatelliteDetail.value = res.data
  } else {
    selectedSatelliteDetail.value = null
  }
}

/**
 * 绑定 Cesium Viewer 的鼠标左键点击拾取事件
 * 点击卫星实体时更新选中的 NORAD ID，点击空白处则清空选中状态
 */
const bindViewerPickEvent = () => {
  const viewerInstance = viewer.value
  if (!viewerInstance) return
  viewerInstance.screenSpaceEventHandler.setInputAction((event: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const pickedObjects = viewerInstance.scene.drillPick(event.position)
    if (!pickedObjects?.length) {
      viewerInstance.selectedEntity = undefined
      if (selectedSatelliteNoradId.value) {
        selectedSatelliteNoradId.value = ''
        if (activeLayerOption.value !== '杀伤链') renderBattleEntities(true)
      }
      return
    }

    const pickedEntity = pickedObjects.find((picked) => {
      const entity = picked?.id
      if (!(entity instanceof Cesium.Entity)) return false
      return (
        !String(entity.id ?? entity.name ?? '').startsWith('strike-effect-') &&
        !String(entity.id ?? entity.name ?? '').startsWith('link-')
      )
    })?.id

    if (pickedEntity instanceof Cesium.Entity) {
      viewerInstance.selectedEntity = pickedEntity
      const pickedEntityId = String(pickedEntity.id ?? '')
      if (pickedEntityId.startsWith('satellite-')) {
        selectedSatelliteNoradId.value = pickedEntityId.replace('satellite-', '')
      } else {
        if (selectedSatelliteNoradId.value) {
          selectedSatelliteNoradId.value = ''
          if (activeLayerOption.value !== '杀伤链') renderBattleEntities(true)
        }
      }
      return
    }

    viewerInstance.selectedEntity = undefined
    if (selectedSatelliteNoradId.value) {
      selectedSatelliteNoradId.value = ''
      if (activeLayerOption.value !== '杀伤链') renderBattleEntities(true)
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

/**
 * 异步初始化 Cesium Viewer 实例
 * 等待容器就绪后创建 Viewer，配置时钟、底图、时间轴格式及事件监听，
 * 并加载初始场景数据和杀伤链方案
 */
const initViewer = async () => {
  if (viewerInitializing || viewer.value) return
  viewerInitializing = true

  try {
    const ready = await waitForContainerReady()
    if (!ready || !cesiumContainer.value || viewer.value) return

    const newViewer = new Cesium.Viewer(cesiumContainer.value, {
      scene3DOnly: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: true,
      timeline: true,
      fullscreenButton: false,
      baseLayerPicker: false,
      infoBox: true,
      selectionIndicator: false,
      creditContainer: credits.value,
      // 不使用 Ion 地形，避免请求 token
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      // 不使用 Ion 默认底图（Bing Maps），避免请求 token
      baseLayer: false,
    })

    newViewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    newViewer.scene.globe.depthTestAgainstTerrain = false
    newViewer.scene.requestRenderMode = true
    newViewer.scene.maximumRenderTimeChange = 0.1
    newViewer.useDefaultRenderLoop = true

    newViewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER
    viewer.value = newViewer
    applyClockWindow(true)
    formatTimeLineAndAnimation(newViewer)
    markBattleArea(newViewer, store.battle)
    // 决定加载二维地图还是三维地图
    if (isCurrentPlan2D.value) {
      newViewer.scene.morphTo2D(0)
    }

    if (MATERIAL_URL) {
      newViewer.imageryLayers.addImageryProvider(
        new Cesium.UrlTemplateImageryProvider({
          url: `${MATERIAL_URL}/{z}/{x}/{y}.png`,
          credit: 'credit',
        })
      )
    }

    isViewerReady.value = true
    startResizeObserver()
    bindViewerPickEvent()
    bindInfoBoxButton(newViewer, {
      handler: ({ button }) => {
        const norad = Number(button.dataset.norad)
        if (!Number.isFinite(norad)) return
        openSatelliteProfile(norad)
      },
    })

    clockTickListener = () => {
      syncPlaybackCursorFromClock()
      syncActiveStageFromClock()
      syncTaskProgressFromClock()
    }
    newViewer.clock.onTick.addEventListener(clockTickListener)

    await loadSceneData(
      [],
      [],
      (resetEntities) => {
        refreshSceneEntities(true, resetEntities)
      },
      true
    )
    void loadAllKillChainPlan()
  } catch (error) {
    console.error('初始化 Cesium Viewer 失败:', error)
  } finally {
    viewerInitializing = false
  }
}

watch(
  () => store.activedTask?.id,
  async (taskId) => {
    selectedSatelliteNoradId.value = ''
    satelliteRelationEdges.value = []
    satelliteRelationTaskId.value = null
    satelliteRelationSourceNorad.value = null
    historicalPlanNameQuery.value = ''
    historicalPlanIntensityFilter.value = 'all'
    historicalPlanSatelliteTypeFilter.value = ''
    historicalPlanModeFilter.value = 'all'
    selectedHistoricalPlanKeys.value = []

    if (!taskId) {
      selectedHistoricalPlan.value = null
      selectedHistoricalPlanDetail.value = null
      loadedKillChainPlan.value = null
      historicalPlanDialogVisible.value = false
      historicalPlans.value = []
      resetStrikeRuntimeState('未加载打击方案')
      taskSatellites.value.splice(0, taskSatellites.value.length)
      taskWeapons.value.splice(0, taskWeapons.value.length)
      blueSatellites.value = []
      redWeapons.value = []
      destroyCompareViewers()
      if (viewer.value) {
        renderBattleEntities(true, true)
      }
      return
    }

    if (!activeStageName.value) {
      activeStageName.value = stageList.value[0]?.name ?? ''
    }

    await preloadHistoricalPlans(taskId)

    if (!viewer.value) {
      await initViewer()
      return
    }

    await loadSceneData(
      [],
      [],
      (resetEntities) => {
        refreshSceneEntities(true, resetEntities)
      },
      true
    )
  },
  { immediate: true }
)

watch(
  stageList,
  (stages) => {
    if (!stages.length) return
    if (!activeStageName.value || !stages.some((item) => item.name === activeStageName.value)) {
      activeStageName.value = stages[0].name
    }
  },
  { immediate: true }
)

watch(
  activeStageName,
  async () => {
    if (consumeStageChangeFromClock()) return
    if (!viewer.value || !store.activedTask?.id || !activeStageName.value) return
    // 杀伤链图层的时钟跳转已由 setActiveStage 完成，无需重新加载场景数据（会清空实体）
    if (activeLayerOption.value === '杀伤链') return
    await loadSceneData(
      [],
      [],
      (resetEntities) => {
        refreshSceneEntities(true, resetEntities)
      },
      false
    )
    viewer.value.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK_MULTIPLIER
    viewer.value.clock.shouldAnimate = isPlaying.value
  },
  { flush: 'post' }
)

watch(selectedSatelliteNoradId, async (noradId) => {
  if (!noradId) {
    selectedSatelliteDetail.value = null
    selectedSatelliteDetailRequestSeq += 1
    return
  }

  const tasks: Promise<any>[] = [loadSelectedSatelliteDetail(Number(noradId))]
  if (activeLayerOption.value === '关系卫星') {
    tasks.push(loadSatelliteRelationData(Number(noradId)))
  }
  await Promise.all(tasks)
  if (activeLayerOption.value !== '杀伤链') renderBattleEntities(true)
})

watch(
  () => activeLayerOption.value,
  (layer) => {
    if (layer === '方案对比') {
      if (!historicalPlanDialogVisible.value || historicalPlanDialogMode.value !== 'compare') {
        openHistoricalPlanDialog('compare')
      }
      return
    }

    if (historicalPlanDialogVisible.value) {
      historicalPlanDialogVisible.value = false
    }

    historicalPlanDialogMode.value = 'single'
  }
)

watch(
  [
    () => activeLayerOption.value,
    () => selectedComparePlanCards.value.map((card) => card.key).join('|'),
    () => Array.from(completedStrikeWindowIds.value).sort().join('|'),
    () => blueSatellites.value.map((satellite) => satellite.noradId).join('|'),
    () => selectedHistoricalPlanDetail.value?.plan_name ?? '',
  ],
  async ([layer]) => {
    if (layer !== '方案对比' && layer !== '对比视图') {
      destroyCompareViewers()
      await nextTick()
      viewer.value?.scene.requestRender()
      ;(viewer.value as any)?.resize?.()
      return
    }

    await nextTick()
    await initCompareViewers()
  },
  { flush: 'post' }
)

watch(playSpeed, () => {
  if (!viewer.value) return
  viewer.value.clock.multiplier = playSpeed.value
  viewer.value.scene.requestRender()
})

watch(isPlaying, () => {
  if (!viewer.value) return
  viewer.value.clock.shouldAnimate = isPlaying.value
  viewer.value.scene.requestRender()
})

watch(isCurrentPlan2D, (is2D) => {
  if (!viewer.value) return
  if (is2D) {
    if (viewer.value.scene.mode !== Cesium.SceneMode.SCENE2D) {
      viewer.value.scene.morphTo2D(0.5)
    }
  } else {
    if (viewer.value.scene.mode !== Cesium.SceneMode.SCENE3D) {
      viewer.value.scene.morphTo3D(0.5)
      // 等 3D 形态稳定后重新渲染实体，避免实体在 2D 态下创建后 3D 不刷新
      setTimeout(() => {
        if (viewer.value && activeLayerOption.value !== '杀伤链') {
          refreshSceneEntities(false, true)
        }
      }, 600)
    }
  }
})

watch(
  clockWindow,
  (window) => {
    if (!viewer.value || !window) return
    applyClockWindow(false)
  },
  { immediate: true }
)

onMounted(() => {
  if (hasValidContainerSize(cesiumContainer.value)) {
    void initViewer()
  } else {
    startResizeObserver()
  }
})

onBeforeUnmount(() => {
  stopResizeObserver()
  destroyCompareViewers()
  if (viewer.value && !viewer.value.isDestroyed()) {
    unbindInfoBoxButton(viewer.value)
  }
  if (viewer.value && clockTickListener) {
    viewer.value.clock.onTick.removeEventListener(clockTickListener)
    clockTickListener = null
  }
  clearSatelliteTleCache()
  if (viewer.value && !viewer.value.isDestroyed()) {
    viewer.value.destroy()
  }
  viewer.value = null
  isViewerReady.value = false
})

const showWeaponLegend = computed(() => {
  return (
    activeLayerOption.value !== '方案对比' &&
    activeLayerOption.value !== '杀伤链' &&
    activeLayerOption.value !== '对比视图'
  )
})
const weaponLegendItems = computed(() => [
  {
    label: '动能武器',
    color: '#ef6b73',
    count: redWeapons.value.filter((weapon) => weapon.type?.includes('动能')).length,
  },
  {
    label: '电子干扰',
    color: '#b15cff',
    count: redWeapons.value.filter((weapon) => weapon.type?.includes('电子干扰')).length,
  },
  {
    label: '定向能',
    color: '#7cd992',
    count: redWeapons.value.filter((weapon) => weapon.type?.includes('定向能')).length,
  },
  {
    label: '天基武器',
    color: '#8cc6ff',
    count: redWeapons.value.filter((weapon) => weapon.type?.includes('天基')).length,
  },
])

defineExpose({
  resetLoadedHistoricalPlanScene,
})
</script>
<style scoped>
.simulation-page {
  --card-bg: rgba(10, 29, 48, 0.92);
  --card-bg-strong: rgba(12, 35, 57, 0.98);
  --card-border: rgba(106, 164, 220, 0.18);
  --card-border-strong: rgba(106, 164, 220, 0.3);
  --accent-cyan: #58c9d1;
  --accent-green: #7cd992;
  --accent-amber: #f0b35b;
  --accent-red: #ef6b73;
  /* [修改说明] 严格锁定页面总高度为 100% 容器高度，禁止页面随内容加载向外无限拉长超出屏幕 */
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 5px;
  box-sizing: border-box;
  color: var(--text-color-primary);
  background:
    radial-gradient(circle at top left, rgba(57, 129, 194, 0.24), transparent 30%),
    radial-gradient(circle at 85% 10%, rgba(88, 201, 209, 0.18), transparent 22%),
    linear-gradient(180deg, rgba(6, 18, 31, 0.96) 0%, rgba(8, 22, 42, 0.98) 55%, rgba(6, 16, 27, 1) 100%);
}

.panel-subtitle,
.viewer-overlay__badge {
  color: var(--text-color-secondary);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.panel-badge.btn {
  cursor: pointer;
}

.layer-tag,
.panel-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  border: 1px solid rgba(116, 168, 225, 0.28);
  background: rgba(15, 42, 67, 0.88);
  color: var(--text-color-primary);
  font-size: 12px;
  padding: 7px 30px;
  white-space: normal;
  word-wrap: break-word;
}

.layer-tag {
  min-height: 34px;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;

  &:hover {
    border-color: var(--card-border-strong);
    background: var(--accent-cyan);
  }

  &.is-active {
    color: var(--text-color-strong);
    border-color: rgba(98, 213, 255, 0.72);
    background: linear-gradient(180deg, rgba(26, 93, 142, 0.98), rgba(14, 58, 92, 0.96));
    box-shadow: 0 8px 18px rgba(14, 58, 92, 0.28);
    transform: translateY(-1px);
  }
}

.panel-card,
.metric-card,
.entity-item {
  border: 1px solid var(--card-border);
  border-radius: 18px;
  background: var(--card-bg);
  backdrop-filter: blur(12px);
}

.panel-card--stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 320px;
  gap: 5px;
  align-items: stretch;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 5px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.panel--right {
  min-height: 0;
}

.panel-card {
  padding: 16px;
}

.panel--right > .panel-card--metrics {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.panel--right .metric-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.header-overview {
  display: flex;
  flex-direction: column;
}

.panel-card__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-wrap: nowrap;
  white-space: nowrap;
  width: 100%;
}

.plan-mode-switcher {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(116, 168, 225, 0.16);
  border-radius: 16px;
  background: rgba(10, 29, 48, 0.72);
}

.plan-mode-switcher__label {
  color: var(--text-color-secondary);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.plan-mode-switcher__buttons {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.panel-card--overview {
  overflow: hidden;
}

.panel-card__header h2 {
  margin: 0;
  font-size: 16px;
  min-width: 65px;
}

.kv-list,
.metric-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.kv-list--overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.entity-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
}

.kv-list--overview .kv-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  text-align: left;
  border-radius: 16px;
  border: 1px solid rgba(116, 168, 225, 0.16);
  background: linear-gradient(180deg, rgba(14, 38, 60, 0.92), rgba(10, 28, 45, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.kv-item span,
.entity-item span,
.metric-card p {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 12px;
}

.kv-list--overview .kv-item span {
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.kv-list--overview .kv-item strong {
  line-height: 1.15;
}

.kv-item strong,
.entity-item strong {
  color: var(--text-color-strong);
  word-break: break-all;
}

.stage-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.stage-item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--card-border);
  background: rgba(11, 31, 50, 0.9);
  color: var(--text-color-primary);
  text-align: left;
  cursor: pointer;
}

.stage-item.is-active {
  border-color: var(--card-border-strong);
  background: linear-gradient(135deg, rgba(22, 64, 96, 0.95), rgba(12, 34, 54, 0.95));
}

.stage-item__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: linear-gradient(180deg, #62d5ff, #2d8cff);
  box-shadow: 0 0 12px rgba(98, 213, 255, 0.45);
}

.stage-item__name {
  font-size: 14px;
}

.stage-item__time {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.metric-card__head,
.viewport-topbar,
.viewer-legend {
  display: flex;
  align-items: center;
  gap: 10px;
}

.viewer-legend {
  flex-wrap: wrap;
}

.map-stage {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  min-height: 0;
}

.map-stage__viewport {
  border: 1px solid var(--card-border);
  border-radius: 22px;
  background: var(--card-bg-strong);
  box-shadow: 0 20px 42px rgba(0, 0, 0, 0.26);
}

.map-stage__viewport {
  padding: 10px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.viewport-topbar {
  justify-content: space-between;
  padding-bottom: 5px;
}

.viewport-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.viewport-title strong {
  font-size: 18px;
}

.layer-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;

  .layer-tag {
    flex-shrink: 0;
    cursor: pointer;

    &:hover {
      border-color: var(--card-border-strong);
      background: var(--accent-cyan);
    }
  }
}

.globe-frame {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 24px 24px 0 0;
  border: 1px solid rgba(116, 168, 225, 0.16);
  background:
    radial-gradient(circle at center, rgba(32, 92, 138, 0.28), transparent 28%),
    radial-gradient(circle at 30% 30%, rgba(88, 201, 209, 0.12), transparent 20%),
    linear-gradient(180deg, rgba(5, 15, 27, 0.9), rgba(7, 22, 38, 0.98));
  overflow: hidden;
}

:deep(.cesium-viewer-animationContainer),
:deep(.cesium-viewer-timelineContainer) {
  z-index: 4;
}

:deep(.cesium-viewer-animationContainer) {
  right: auto;
}

:deep(.cesium-viewer-timelineContainer) {
  left: 220px;
  right: 16px;
}

:deep(.cesium-viewer-timelineContainer .cesium-timeline) {
  background: rgba(9, 25, 42, 0.72);
}

:deep(.cesium-infoBox) {
  width: 25%;
}

.cesium-container {
  position: absolute;
  inset: 0;
  z-index: 0;

  .credits {
    display: none;
  }
}

.viewer-compare-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(360px, 32%);
}

.viewer-weapon-legend {
  position: absolute;
  bottom: 40px;
  right: 16px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: min(360px, 32%);
  padding: 10px 12px;
  border: 1px solid rgba(116, 168, 225, 0.16);
  border-radius: 14px;
  background: rgba(10, 29, 48, 0.72);
}

.viewer-weapon-legend__title {
  color: var(--text-color-secondary);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.viewer-weapon-legend__item {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: var(--text-color-primary);
  font-size: 12px;
}

.compare-viewer-grid {
  position: absolute;
  inset: 0;
  z-index: 2;
  padding: 14px;
}

.compare-viewer-grid__inner {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  height: 100%;
}

.compare-viewer-grid__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 1px dashed rgba(116, 168, 225, 0.28);
  border-radius: 18px;
  background: rgba(10, 29, 48, 0.62);
  color: var(--text-color-secondary);
  font-size: 14px;
}

.compare-viewer-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(116, 168, 225, 0.18);
  border-radius: 18px;
  overflow: hidden;
  background: rgba(10, 29, 48, 0.72);
}

.compare-viewer-card__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(116, 168, 225, 0.14);
  background: rgba(8, 24, 39, 0.92);
}

.compare-viewer-card__header strong {
  color: var(--text-color-primary);
  font-size: 14px;
}

.compare-viewer-card__header span {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.compare-viewer-card__stage {
  position: relative;
  flex: 1;
  min-height: 240px;
}

.history-plan-dialog__summary-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.history-plan-card__badges--selection {
  align-items: flex-start;
}

.history-plan-card__selector {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid rgba(116, 168, 225, 0.22);
  border-radius: 999px;
  background: rgba(15, 42, 67, 0.88);
  color: var(--text-color-primary);
  cursor: pointer;
}

.history-plan-card__selector.is-checked {
  border-color: rgba(88, 201, 209, 0.42);
  background: rgba(88, 201, 209, 0.16);
}

.history-plan-card__selector-box {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  background: transparent;
  position: relative;
}

.history-plan-card__selector.is-checked .history-plan-card__selector-box {
  border-color: rgba(88, 201, 209, 0.92);
  background: rgba(88, 201, 209, 0.92);
}

.history-plan-card__selector.is-checked .history-plan-card__selector-box::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 5px;
  height: 9px;
  border-right: 2px solid #062031;
  border-bottom: 2px solid #062031;
  transform: rotate(40deg);
}

.viewer-weapon-legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.18);
}

.viewer-weapon-legend__label {
  color: var(--text-color-primary);
}

.viewer-weapon-legend__count {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.strike-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  min-height: 0;
  border-radius: 18px;
  background: rgba(10, 29, 48, 0.72);
}

.strike-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.strike-list__header h3 {
  margin: 0;
  font-size: 14px;
  color: var(--text-color-primary);
}

.strike-list__items {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  padding-right: 4px;
}

.strike-list__items::-webkit-scrollbar {
  width: 6px;
}

.strike-list__items::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(116, 168, 225, 0.35);
}

.strike-list__items::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.04);
}

.strike-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(116, 168, 225, 0.14);
  background: rgba(7, 23, 37, 0.88);
}

.strike-item--empty {
  justify-content: center;
  color: var(--text-color-secondary);
  border-style: dashed;
}

.strike-item__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.strike-item__info strong {
  color: var(--text-color-primary);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.strike-item__info span {
  color: var(--text-color-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.strike-item__status {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(88, 201, 209, 0.26);
  background: rgba(88, 201, 209, 0.14);
  color: #86f3ff;
  font-size: 12px;
}

.strike-item__status.is-active {
  box-shadow: 0 0 12px rgba(88, 201, 209, 0.16);
}

.strike-item__status.is-completed {
  border-color: rgba(124, 217, 146, 0.24);
  background: rgba(124, 217, 146, 0.14);
  color: #9ff0b2;
}

.viewer-legend {
  justify-content: flex-start;
  color: var(--text-color-primary);
  font-size: 12px;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 50%;
}

.legend-dot--red {
  background: #ef6b73;
  box-shadow: 0 0 10px rgba(239, 107, 115, 0.45);
}

.legend-dot--blue {
  background: #4ea6ff;
  box-shadow: 0 0 10px rgba(78, 166, 255, 0.45);
}

.history-plan-dialog__summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.history-plan-dialog__summary p {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
}

.history-plan-dialog__search-panel {
  display: grid;
  grid-template-columns: minmax(240px, 1.5fr) repeat(2, minmax(180px, 1fr)) minmax(220px, 1.2fr);
  gap: 12px;
  margin: 10px 0 16px;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid rgba(116, 168, 225, 0.16);
  background: rgba(10, 29, 48, 0.72);
}

.history-plan-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.history-plan-dialog__field-label {
  color: var(--text-color-secondary);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.history-plan-dialog__search-input,
.history-plan-dialog__select {
  width: 100%;
}

.history-plan-dialog__mode-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-plan-dialog__card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}

.history-plan-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(116, 168, 225, 0.18);
  background: linear-gradient(180deg, rgba(11, 31, 50, 0.96), rgba(8, 24, 39, 0.96)), rgba(10, 29, 48, 0.92);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.history-plan-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 1 0 100px;
}

.history-plan-card__title-block {
  min-width: 0;
}

.history-plan-card__eyebrow {
  display: inline-block;
  color: var(--text-color-secondary);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.history-plan-card__title {
  margin: 6px 0 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-word;
}

.history-plan-card__subline {
  margin: 6px 0 0;
  color: var(--text-color-secondary);
  font-size: 12px;
}

.history-plan-card__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex: 0 0 120px;
}

.history-plan-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(116, 168, 225, 0.22);
  background: rgba(15, 42, 67, 0.88);
  color: var(--text-color-primary);
  font-size: 12px;
  white-space: nowrap;
}

.history-plan-card__badge--mode.is-threat_first {
  border-color: rgba(239, 107, 115, 0.32);
  background: rgba(239, 107, 115, 0.14);
}

.history-plan-card__badge--mode.is-max_targets {
  border-color: rgba(88, 201, 209, 0.32);
  background: rgba(88, 201, 209, 0.14);
}

.history-plan-card__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.history-plan-card__stat {
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(116, 168, 225, 0.14);
  background: rgba(10, 29, 48, 0.74);
}

.history-plan-card__stat span,
.history-plan-card__section-title,
.history-plan-card__footer-note {
  display: block;
  color: var(--text-color-secondary);
  font-size: 12px;
}

.history-plan-card__stat strong {
  display: block;
  margin-top: 6px;
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
}

.history-plan-card__stat--wide {
  grid-column: 1 / -1;
}

.history-plan-card__section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1 0 100px;
}

.history-plan-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-plan-card__chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(116, 168, 225, 0.18);
  background: rgba(12, 33, 53, 0.92);
  color: var(--text-color-primary);
  font-size: 10px;
  word-break: break-word;
  flex: 1 1 calc(25%);
  justify-content: center;
}

.history-plan-card__chip--target {
  border-color: rgba(240, 179, 91, 0.28);
  background: rgba(240, 179, 91, 0.12);
}

.history-plan-card__empty-inline {
  color: var(--text-color-secondary);
  font-size: 12px;
}

.history-plan-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 2px;
}

.history-plan-card__footer-note {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-plan-dialog :deep(.el-dialog) {
  overflow: hidden;
}

.history-plan-dialog :deep(.el-dialog__body) {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  padding-top: 10px;
}

.metric-card {
  padding: 12px 14px;
}

.metric-card__head {
  justify-content: space-between;
}

.metric-card strong {
  font-size: 18px;
}

.metric-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-status-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(116, 168, 225, 0.16);
  background: linear-gradient(180deg, rgba(12, 33, 53, 0.96), rgba(8, 24, 39, 0.94));
}

.metric-status-card__label {
  color: var(--text-color-secondary);
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-status-card__value {
  color: var(--text-color-primary);
  font-size: 13px;
  line-height: 1.4;
  word-break: break-word;
}

:deep(.el-progress-bar__outer) {
  background-color: rgba(116, 168, 225, 0.14);
}

@media (max-width: 1480px) {
  .workspace-grid {
    grid-template-columns: 280px minmax(0, 1fr);
  }

  .panel--right {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1200px) {
  .workspace-grid,
  .panel--right {
    grid-template-columns: 1fr;
  }

  .history-plan-dialog__search-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .compare-viewer-grid__inner {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .simulation-page {
    padding: 12px;
  }

  .map-stage__viewport,
  .panel-card {
    border-radius: 16px;
  }

  .history-plan-dialog__search-panel,
  .history-plan-card__stats {
    grid-template-columns: 1fr;
  }

  .history-plan-dialog__summary,
  .history-plan-card__header,
  .history-plan-card__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .history-plan-card__badges {
    justify-content: flex-start;
  }
}

/* 杀伤链方案对话框样式 */
.killchain-plan-dialog :deep(.el-dialog) {
  background: var(--card-bg-strong);
  border: 1px solid var(--card-border-strong);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  border-radius: 24px;
  overflow: hidden;
}

.killchain-plan-dialog :deep(.el-dialog__header) {
  border-bottom: 1px solid rgba(116, 168, 225, 0.16);
  padding: 20px 24px;
}

.killchain-plan-dialog :deep(.el-dialog__title) {
  color: var(--text-color-primary);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.killchain-plan-dialog :deep(.el-dialog__body) {
  padding: 24px;
  overflow-y: auto;
}

.killchain-plan-dialog__radio-group {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}

.killchain-plan-dialog__radio-group :deep(.el-radio-button__inner) {
  background: rgba(15, 42, 67, 0.88);
  border-color: rgba(116, 168, 225, 0.28);
  color: var(--text-color-secondary);
  font-size: 14px;
  padding: 10px 24px;
}

.killchain-plan-dialog__radio-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(180deg, rgba(26, 93, 142, 0.98), rgba(14, 58, 92, 0.96));
  border-color: rgba(98, 213, 255, 0.72);
  color: var(--text-color-strong);
  box-shadow: -1px 0 0 0 rgba(98, 213, 255, 0.72);
}

/* 杀伤链方案卡片列表容器：采用 Flex 垂直单列布局 */
.killchain-plan-dialog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
  margin-top: 10px;
}

.killchain-plan-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid rgba(116, 168, 225, 0.18);
  background: linear-gradient(180deg, rgba(11, 31, 50, 0.96), rgba(8, 24, 39, 0.96));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.03),
    0 8px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.killchain-plan-card:hover {
  transform: translateY(-4px);
  border-color: rgba(98, 213, 255, 0.45);
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.35),
    0 0 15px rgba(98, 213, 255, 0.1);
}

.killchain-plan-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.killchain-plan-card__title-block {
  min-width: 0;
}

.killchain-plan-card__eyebrow {
  display: inline-block;
  color: var(--accent-cyan);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.killchain-plan-card__title {
  margin: 6px 0 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-color-primary);
  word-break: break-word;
}

.killchain-plan-card__subline {
  margin: 4px 0 0;
  color: var(--text-color-secondary);
  font-size: 12px;
}

.killchain-plan-card__badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  flex-shrink: 0;
}

.killchain-plan-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(116, 168, 225, 0.15);
  background: rgba(15, 42, 67, 0.6);
  color: var(--text-color-secondary);
  font-size: 11px;
  white-space: nowrap;
}

.killchain-plan-card__badge.is-type {
  border-color: rgba(124, 217, 146, 0.2);
  background: rgba(124, 217, 146, 0.08);
  color: var(--accent-green);
}

.killchain-plan-card__badge.is-price {
  border-color: rgba(240, 179, 91, 0.2);
  background: rgba(240, 179, 91, 0.08);
  color: var(--accent-amber);
}

.killchain-plan-card__badge.is-feasible {
  border-color: rgba(98, 213, 255, 0.2);
  background: rgba(98, 213, 255, 0.08);
  color: var(--accent-cyan);
}

.killchain-plan-card__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 4px;
}

.killchain-plan-card__stat {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(116, 168, 225, 0.12);
  background: rgba(10, 29, 48, 0.6);
}

.killchain-plan-card__stat span {
  display: block;
  color: var(--text-color-secondary);
  font-size: 11px;
  margin-bottom: 4px;
}

.killchain-plan-card__stat strong {
  display: block;
  color: var(--text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.killchain-plan-card__stat--wide {
  grid-column: 1 / -1;
}

.killchain-plan-card__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.killchain-plan-card__section-title {
  color: var(--text-color-secondary);
  font-size: 11px;
  font-weight: 500;
}

.killchain-plan-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.killchain-plan-card__chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(116, 168, 225, 0.12);
  background: rgba(12, 33, 53, 0.6);
  color: var(--text-color-primary);
  font-size: 10px;
}

.killchain-plan-card__footer {
  display: flex;
  justify-content: flex-end;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid rgba(116, 168, 225, 0.1);
}

.killchain-plan-card__footer.is-high {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.killchain-plan-card__footer .el-button {
  width: 100%;
}
</style>
