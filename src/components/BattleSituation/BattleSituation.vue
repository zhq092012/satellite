<template>
  <div class="battle-situation-container">
    <!-- 1. 地球底图 + 当前场景区域标记 -->
    <div class="map-globe-layer">
      <BattleSituationGlobe ref="globeRef" :satellites="globeSatellites" :weapons="globeWeapons"
        :ground-targets="globeGroundTargets" :current-time-ms="currentTimeMs" :selected-norad="selectedNorad"
        :highlighted-series="globeSeriesHighlight"
        :selected-weapon-id="selectedWeaponId" :selected-ground-target-key="selectedGroundTargetKey"
        :selected-resource-detail-text="selectedResourceDetailText"
        :selected-satellite-detail-view="selectedSatelliteDetailView"
        :selected-ground-detail-view="selectedGroundDetailView"
        :selected-weapon-detail-view="selectedWeaponDetailView"
        :task-start-ms="taskStartMs" :task-end-ms="taskEndMs"         :follow-selected-satellite="!isDeductionPlaying"
        :follow-deduction-satellite="followDeductionSatellite"
        :is-deduction-playing="isDeductionPlaying" :is-timeline-playing="isTimelinePlaying"
        :deduction-visual-plan="deductionVisualPlan" />

      <div v-if="selectedNorad" class="globe-selected-bar globe-selected-bar--satellite">
        <div class="globe-selected-bar__info">
          <span class="globe-selected-label">选中卫星：</span>
          <span class="globe-selected-name">{{ selectedSatelliteName }}</span>
          <span v-if="selectedSatelliteMetaInline" class="globe-selected-meta">{{ selectedSatelliteMetaInline }}</span>
        </div>
        <div class="globe-selected-bar__actions">
          <button type="button" class="globe-deduction-btn" :disabled="!selectedNorad || isDeductionPlaying"
            @click="handleStartSatelliteDeduction">
            播放推演
          </button>
          <button type="button" class="globe-deduction-btn globe-deduction-btn--pause" :disabled="!isDeductionPlaying"
            @click="handleStopSatelliteDeduction">
            暂停推演
          </button>
          <label class="globe-follow-check">
            <input v-model="followDeductionSatellite" type="checkbox" />
            跟随卫星
          </label>
          <button type="button" class="globe-clear-btn" @click="handleClearSelectedSatellite">清除</button>
        </div>
      </div>

      <div v-if="selectedWeaponId" class="globe-selected-bar globe-selected-bar--weapon">
        <span class="globe-selected-label">选中武器：</span>
        <span class="globe-selected-name globe-selected-name--weapon">{{ selectedWeaponName }}</span>
        <button type="button" class="globe-clear-btn" @click="handleClearSelectedWeapon">清除</button>
      </div>

      <div v-if="selectedGroundTargetKey" class="globe-selected-bar globe-selected-bar--ground">
        <span class="globe-selected-label">{{ selectedGroundTargetBarLabel }}：</span>
        <span class="globe-selected-name globe-selected-name--ground">{{ selectedGroundTargetName }}</span>
        <button type="button" class="globe-clear-btn" @click="handleClearSelectedGroundTarget">清除</button>
      </div>
    </div>

    <!-- 2. 悬浮左侧控制面板 -->
    <div class="floating-panel floating-panel--left" :class="{ 'is-collapsed': isLeftCollapsed }">
      <div class="panel-inner">
        <C2LeftControlPanel :matrix-data="matrixData" :selected-norad="selectedNorad"
          @select-satellite="handleSelectSatellite" @task-recalculated="handleTaskRecalculated"
          @focus-resource-detail="handleFocusResourceDetail" @focus-task-series="handleFocusTaskSeries" />
      </div>
      <button type="button" class="toggle-btn toggle-btn--left" :title="isLeftCollapsed ? '展开左侧面板' : '收起左侧面板'"
        @click="isLeftCollapsed = !isLeftCollapsed">
        <el-icon class="toggle-icon">
          <DArrowLeft v-if="!isLeftCollapsed" />
          <DArrowRight v-else />
        </el-icon>
      </button>
    </div>

    <!-- 3. 悬浮右侧分析面板 -->
    <div class="floating-panel floating-panel--right" :class="{ 'is-collapsed': isRightCollapsed }">
      <div class="panel-inner">
        <C2RightAnalysisPanel :analysis-data="taskAnalysisData" :algorithm-complete="algorithmComplete"
          :analysis-loading="taskAnalysisLoading" :selected-norad="selectedNorad"
          @select-satellite="handleSelectSatellite" />
      </div>
      <button type="button" class="toggle-btn toggle-btn--right" :title="isRightCollapsed ? '展开右侧面板' : '收起右侧面板'"
        @click="isRightCollapsed = !isRightCollapsed">
        <el-icon class="toggle-icon">
          <DArrowRight v-if="!isRightCollapsed" />
          <DArrowLeft v-else />
        </el-icon>
      </button>
    </div>

    <!-- 4. 任务时间轴 -->
    <div class="floating-timeline-wrapper" :class="{
      'is-collapsed': isTimelineCollapsed,
      'timeline--left-collapsed': isLeftCollapsed,
      'timeline--right-collapsed': isRightCollapsed,
    }" v-if="taskTimeRange">
      <button type="button" class="timeline-toggle-btn" :title="isTimelineCollapsed ? '展开时间轴' : '收起时间轴'"
        @click="isTimelineCollapsed = !isTimelineCollapsed">
        <el-icon class="toggle-icon">
          <ArrowUp v-if="isTimelineCollapsed" />
          <ArrowDown v-else />
        </el-icon>
        <span class="btn-text">{{ isTimelineCollapsed ? '展开时间轴' : '收起时间轴' }}</span>
      </button>

      <BattleGlobeDeductionToast v-if="selectedNorad && deductionToastHighlightLines.length"
        :lines="deductionToastHighlightLines" />

      <div class="timeline-inner">
        <BattleGlobeTimeline :task-start="taskTimeRange.start" :task-end="taskTimeRange.end"
          :current-time-ms="currentTimeMs" :is-playing="isTimelinePlaying" :playback-speed="playbackSpeed"
          @time-change="handleTimelineTimeChange" @toggle-play="handleToggleTimelinePlay"
          @speed-change="handlePlaybackSpeedChange" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  buildBattleGlobeSatellitesWithValidation,
  notifyBattleGlobeSatelliteValidationErrors,
} from '@/utils/buildBattleGlobeSatellites'
import { buildBattleGlobeWeapons } from '@/utils/buildBattleGlobeWeapons'
import { buildBattleGlobeGroundTargets, buildGroundTargetKey, parseGroundTargetKey } from '@/utils/buildBattleGlobeGroundTargets'
import type { TaskPanelResourceDetailPayload } from '@/utils/c2TaskPanelEditor'
import {
  buildGroundStationGlobeDetailViewModel,
  buildSatelliteGlobeDetailViewModel,
  buildWeaponGlobeDetailViewModel,
  formatResourceGridDetailTooltipText,
  formatSatelliteGlobeDetailLines,
  formatSatelliteGlobeDetailTooltipText,
  resolveGlobeResourceDetailText,
  type GlobeGroundDetailLabelViewModel,
  type GlobeResourceDetailRequest,
  type GlobeSatelliteDetailLabelViewModel,
  type GlobeWeaponDetailLabelViewModel,
} from '@/utils/formatTaskPanelResourceDetail'
import { useBattleGlobeResourceRecords } from '@/composables/useBattleGlobeResourceRecords'
import { useSatelliteGlobeLabelMetricsPrecompute } from '@/composables/useSatelliteGlobeLabelMetricsPrecompute'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import C2LeftControlPanel from '@/components/BattleSituation/C2LeftControlPanel.vue'
import C2RightAnalysisPanel from '@/components/BattleSituation/C2RightAnalysisPanel.vue'
import BattleGlobeTimeline from '@/components/BattleSituation/BattleGlobeTimeline.vue'
import BattleSituationGlobe from '@/components/BattleSituation/BattleSituationGlobe.vue'
import BattleGlobeDeductionToast from '@/components/BattleSituation/BattleGlobeDeductionToast.vue'
import { taskProgressMap } from '@/composables/useTaskProgressPolling'
import { useLayoutStore } from '@/store/modules/layout'
import type { MatrixResult } from '@/api/electronic'
import type { BaseStationInfo } from '@/api/system/satellite-system-api'
import type { Weapon } from '@/types/dashboard'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { useSatelliteDeductionPlayback } from '@/composables/useSatelliteDeductionPlayback'
import {
  formatSatelliteMetaInline,
  resolveSatelliteDisplayMetaFromAnalysis,
} from '@/utils/buildSatelliteAnalysisTable'

/** 全局布局 Store */
const store = useLayoutStore()

/** 卫星档案弹窗 */
useSatelliteProfileDialog()

/** 左侧控制面板是否收起 */
const isLeftCollapsed = ref(false)
/** 右侧分析面板是否收起 */
const isRightCollapsed = ref(false)
/** 底部任务时间轴是否收起 */
const isTimelineCollapsed = ref(false)

/** 当前选中卫星 NORAD；同时驱动地球高亮、顶部选中条和右侧面板 */
const selectedNorad = ref<number | null>(null)
/**
 * 地图黄色高亮的系列。仅在用户点击系列后写入，且不显示名称/系列/类型/用途标签。
 * 初始化自动选中的分析系列不写入，地图上不出现这组标签。
 */
const globeSeriesHighlight = ref<string | null>(null)

/** 当前选中的武器 ID */
const selectedWeaponId = ref<string | null>(null)

/** 当前选中的地面目标键（receive: / station:） */
const selectedGroundTargetKey = ref<string | null>(null)

/** 当前选中目标在地球 Label 上展示的详情（多行） */
const selectedResourceDetailText = ref<string | null>(null)

/** 选中卫星时的 Grid Label 视图（轨道指标两列布局） */
const selectedSatelliteDetailView = ref<GlobeSatelliteDetailLabelViewModel | null>(null)

/** 选中地面站 / 数据中心时的 Grid Label 视图 */
const selectedGroundDetailView = ref<GlobeGroundDetailLabelViewModel | null>(null)

/** 选中武器时的 Grid Label 视图 */
const selectedWeaponDetailView = ref<GlobeWeaponDetailLabelViewModel | null>(null)

/** 武器/地面站库记录（右侧面板选中时与左侧详情字段对齐） */
const { weaponRecordById, groundStationRecordById, ensureResourceRecordsLoaded } =
  useBattleGlobeResourceRecords()

onMounted(() => {
  void ensureResourceRecordsLoaded()
})

/** 时间轴当前时刻（毫秒） */
const currentTimeMs = ref(0)

/** 选中卫星推演播放 */
const {
  isDeductionPlaying,
  toastHighlightLines: deductionToastHighlightLines,
  deductionVisualPlan,
  startDeduction,
  stopDeduction,
  resetDeductionUi,
} = useSatelliteDeductionPlayback(currentTimeMs)

/** 推演时是否让相机跟随卫星 */
const followDeductionSatellite = ref(true)

/** 时间轴是否正在播放 */
const isTimelinePlaying = ref(false)

/** 时间轴播放倍速 */
const playbackSpeed = ref(10)

/** 任务加载完成后自动播放使用的倍速 */
const AUTO_TIMELINE_PLAYBACK_SPEED = 10

/** 已对某任务触发过「加载完成自动播放」，避免重复启动 */
let autoTimelinePlaybackTaskId: number | null = null

/** 播放循环句柄 */
let playbackRafId: number | null = null

/** 上一帧播放时间戳 */
let lastPlaybackFrameMs = 0

/** 选中卫星前是否正在播放（清除后用于恢复） */
let wasPlayingBeforeSelection = false

/** 算法矩阵数据 */
const matrixData = computed<MatrixResult | null>(() => store.matrixData)

/** 任务算法分析结果 */
const taskAnalysisData = computed(() => store.taskAnalysisData)

/** 任务分析结果加载状态 */
const taskAnalysisLoading = computed(() => store.taskAnalysisLoading)

/** 当前任务算法是否已完成 */
const algorithmComplete = computed(() => store.isTaskAlgorithmComplete(store.activedTask))

/** 当前任务时间范围 */
const taskTimeRange = computed(() => {
  /** 当前激活任务；缺少起止时间时不渲染时间轴 */
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  return { start: task.beginDate, end: task.endDate }
})

/** 任务开始时间（毫秒） */
const taskStartMs = computed(() => parseTaskTimeMs(taskTimeRange.value?.start))

/** 任务结束时间（毫秒） */
const taskEndMs = computed(() => parseTaskTimeMs(taskTimeRange.value?.end))

/** 任务分析汇总卫星（含 TLE/名称校验错误，不静默跳过） */
const globeSatellitesBuild = computed(() => {
  if (!algorithmComplete.value || !taskAnalysisData.value) {
    return { satellites: [] as ReturnType<typeof buildBattleGlobeSatellitesWithValidation>['satellites'], errors: [] as ReturnType<typeof buildBattleGlobeSatellitesWithValidation>['errors'] }
  }
  return buildBattleGlobeSatellitesWithValidation(taskAnalysisData.value)
})

/** 地球渲染卫星列表（仅任务分析全量数据，禁止矩阵兜底） */
const globeSatellites = computed(() => globeSatellitesBuild.value.satellites)

/** 地球渲染武器列表（仅任务分析全量数据） */
const globeWeapons = computed(() => buildBattleGlobeWeapons(taskAnalysisData.value))

/** 地球渲染接收站/数据中心列表（仅任务分析全量数据） */
const globeGroundTargets = computed(() => buildBattleGlobeGroundTargets(taskAnalysisData.value))

/** 选中卫星 Label 轨道指标预计算（Worker + 关键节点） */
const {
  schedulePrecomputeForNorad,
  resolveDisplayMetricsAtPlayhead,
  clearSatelliteLabelMetricsCache,
} = useSatelliteGlobeLabelMetricsPrecompute(
  taskAnalysisData,
  globeSatellites,
  taskStartMs,
  taskEndMs,
)

/** 已提示过的卫星 TLE 校验错误签名，避免 watch 重复弹窗 */
let lastGlobeSatelliteValidationKey = ''

/** 任务分析卫星 TLE/名称校验失败时弹出错误，同一批错误只提示一次 */
watch(
  () =>
    [
      store.activedTask?.id,
      algorithmComplete.value,
      taskAnalysisLoading.value,
      globeSatellitesBuild.value.errors.map((err) => err.message).join('\n'),
    ] as const,
  ([taskId, complete, loading, errorKey]) => {
    /** 无任务、算法未完成、仍在加载或没有校验错误时不弹窗 */
    if (!taskId || !complete || loading || !errorKey) return
    if (errorKey === lastGlobeSatelliteValidationKey) return
    lastGlobeSatelliteValidationKey = errorKey
    notifyBattleGlobeSatelliteValidationErrors(globeSatellitesBuild.value.errors, (message) => {
      ElMessage.error(message)
    })
  },
)

/**
 * 地球组件实例。
 * 父组件通过它恢复战场俯视，以及把相机飞到某一卫星系列。
 */
const globeRef = ref<{
  /** 相机回到战场初始俯视 */
  restoreOverviewView: () => void
  /** 飞到指定系列全部在轨卫星的包围球；系列为空时不飞行 */
  flyToSatelliteSeries?: (series: string | null) => void
} | null>(null)

/** 当前选中卫星名称 */
const selectedSatelliteName = computed(() => {
  if (!selectedNorad.value) return ''
  /** 分析结果中的展示名，优先于地球列表和矩阵名 */
  const meta = resolveSatelliteDisplayMetaFromAnalysis(taskAnalysisData.value, selectedNorad.value)
  if (meta?.name) return meta.name
  /** 地球渲染列表中的名称 */
  const fromGlobe = globeSatellites.value.find((sat) => sat.norad === selectedNorad.value)
  if (fromGlobe?.name) return fromGlobe.name
  /** 矩阵初始列表中的名称；都没有时用 NORAD 占位 */
  const fromMatrix = matrixData.value?.initMatrixList?.find((sat) => sat.norad === selectedNorad.value)
  return fromMatrix?.name || `Sat-${selectedNorad.value}`
})

/** 选中卫星的类型、用途等单行摘要（地球顶部条） */
const selectedSatelliteMetaInline = computed(() => {
  if (!selectedNorad.value) return ''
  /** 地球列表与分析结果，分析结果优先 */
  const fromGlobe = globeSatellites.value.find((sat) => sat.norad === selectedNorad.value)
  const fromAnalysis = resolveSatelliteDisplayMetaFromAnalysis(taskAnalysisData.value, selectedNorad.value)
  /** 系列、系统类型、用途，拼成顶部条的一行摘要 */
  const series = fromAnalysis?.series || fromGlobe?.series || ''
  const sysType = fromAnalysis?.sysType || fromGlobe?.sysType || ''
  const usage = fromAnalysis?.usage || fromGlobe?.usage || ''
  return formatSatelliteMetaInline(series, sysType, usage)
})

/**
 * 开始选中卫星 Cesium 推演（暂停底部时间轴播放）。
 */
const handleStartSatelliteDeduction = () => {
  /** 没有选中星时不启动推演 */
  const norad = selectedNorad.value
  if (!norad) return
  stopTimelinePlayback()
  startDeduction(norad, taskAnalysisData.value)
}

/** 暂停选中卫星推演 */
const handleStopSatelliteDeduction = () => {
  stopDeduction()
}

/** 当前选中武器名称 */
const selectedWeaponName = computed(() => {
  if (!selectedWeaponId.value) return ''
  /** 地球武器列表中的名称；列表尚未包含该 ID 时回退显示 ID */
  const fromGlobe = globeWeapons.value.find((weapon) => weapon.id === selectedWeaponId.value)
  return fromGlobe?.name || selectedWeaponId.value
})

/** 当前选中地面目标名称 */
const selectedGroundTargetName = computed(() => {
  if (!selectedGroundTargetKey.value) return ''
  /** 从 receive: / station: 键中拆出类型与资源 ID */
  const parsed = parseGroundTargetKey(selectedGroundTargetKey.value)
  if (!parsed) return selectedGroundTargetKey.value
  /** 地球地面目标列表中的展示名 */
  const fromGlobe = globeGroundTargets.value.find(
    (target) => target.kind === parsed.kind && target.id === parsed.id
  )
  return fromGlobe?.name || parsed.id
})

/** 地图顶部选中条标签（接收站/数据中心） */
const selectedGroundTargetBarLabel = computed(() => {
  /** 数据中心与接收站使用不同的顶部条文案 */
  const parsed = parseGroundTargetKey(selectedGroundTargetKey.value)
  if (parsed?.kind === 'station') return '选中数据中心'
  return '选中接收站'
})

/**
 * 当前是否存在任意地图选中目标。
 *
 * @returns 是否已有选中项
 */
const hasGlobeSelection = (): boolean =>
  selectedNorad.value != null ||
  selectedWeaponId.value != null ||
  selectedGroundTargetKey.value != null

/**
 * 解析任务时间为毫秒。
 *
 * @param value 时间字符串
 * @returns 毫秒时间戳
 */
const parseTaskTimeMs = (value?: string): number => {
  if (!value) return 0
  /** 把 `YYYY-MM-DD` 换成斜杠，避免部分环境把连字符日期解析成 Invalid Date */
  const ts = new Date(value.replace(/-/g, '/')).getTime()
  return Number.isFinite(ts) ? ts : 0
}

/**
 * 时间轴点击跳转：仅更新游标，不联动地图播放。
 *
 * @param ms 目标时刻
 */
const handleTimelineTimeChange = (ms: number) => {
  stopTimelinePlayback()
  currentTimeMs.value = ms
}

/**
 * 停止时间轴播放循环。
 */
const stopTimelinePlayback = () => {
  isTimelinePlaying.value = false
  if (playbackRafId != null) {
    cancelAnimationFrame(playbackRafId)
    playbackRafId = null
  }
}

/**
 * 启动时间轴播放循环，并将地球相机恢复到战场初始俯视视角。
 */
const startTimelinePlayback = () => {
  /** 任务起止毫秒；无效区间不启动播放 */
  const start = taskStartMs.value
  const end = taskEndMs.value
  if (!start || !end || end <= start) return

  if (currentTimeMs.value >= end) {
    currentTimeMs.value = start
  }

  globeRef.value?.restoreOverviewView()

  isTimelinePlaying.value = true
  lastPlaybackFrameMs = performance.now()

  /**
   * 按墙钟间隔和倍速推进仿真时刻。
   *
   * @param now `requestAnimationFrame` 传入的墙钟毫秒
   */
  const tick = (now: number) => {
    if (!isTimelinePlaying.value) return

    /** 距上一帧的墙钟毫秒，乘倍速后加到仿真时刻上 */
    const delta = now - lastPlaybackFrameMs
    lastPlaybackFrameMs = now
    /** 下一帧仿真时刻；到达任务结束即停止 */
    const next = currentTimeMs.value + delta * playbackSpeed.value

    if (next >= end) {
      currentTimeMs.value = end
      stopTimelinePlayback()
      return
    }

    currentTimeMs.value = next
    playbackRafId = requestAnimationFrame(tick)
  }

  playbackRafId = requestAnimationFrame(tick)
}

/**
 * 切换时间轴播放/暂停。
 */
const handleToggleTimelinePlay = () => {
  if (isTimelinePlaying.value) {
    stopTimelinePlayback()
    return
  }
  startTimelinePlayback()
}

/**
 * 更新时间轴播放倍速。
 *
 * @param speed 播放倍速
 */
const handlePlaybackSpeedChange = (speed: number) => {
  playbackSpeed.value = speed
}

/**
 * 任务算法与态势数据就绪后，以 10 倍速自动播放 Cesium 时间轴（每任务仅一次，重算或换任务后重置）。
 */
const tryStartAutoTimelinePlayback = () => {
  /** 当前任务；无任务、算法未完成或本任务已自动播过则跳过 */
  const taskId = store.activedTask?.id
  if (!taskId || !algorithmComplete.value) return
  if (autoTimelinePlaybackTaskId === taskId) return
  if (taskAnalysisLoading.value) return
  if (hasGlobeSelection()) return

  /** 至少有分析数据、卫星、武器、地面目标或矩阵之一，才自动开播 */
  const hasGlobeData =
    Boolean(taskAnalysisData.value) ||
    globeSatellites.value.length > 0 ||
    globeWeapons.value.length > 0 ||
    globeGroundTargets.value.length > 0 ||
    Boolean(matrixData.value)
  if (!hasGlobeData) return

  /** 任务起止必须构成正时长区间 */
  const start = taskStartMs.value
  const end = taskEndMs.value
  if (!start || !end || end <= start) return

  autoTimelinePlaybackTaskId = taskId
  playbackSpeed.value = AUTO_TIMELINE_PLAYBACK_SPEED
  stopTimelinePlayback()
  currentTimeMs.value = start
  nextTick(() => startTimelinePlayback())
}

/**
 * 处理选中目标时的播放暂停逻辑。
 *
 * @param hadSelection 选中前是否已有卫星/武器选中
 * @param hasNewSelection 是否正在选中新目标
 */
const handleSelectionPlayback = (hadSelection: boolean, hasNewSelection: boolean) => {
  if (hasNewSelection && !hadSelection) {
    wasPlayingBeforeSelection = isTimelinePlaying.value
    if (isTimelinePlaying.value) {
      stopTimelinePlayback()
    }
    return
  }
  if (hasNewSelection && isTimelinePlaying.value) {
    stopTimelinePlayback()
  }
}

/**
 * 清空地球 HTML 详情浮层的文案和 Grid 视图。
 * 切换选中目标或取消选中时调用，避免上一目标的 Label 残留。
 */
const clearGlobeResourceDetail = () => {
  selectedResourceDetailText.value = null
  selectedSatelliteDetailView.value = null
  selectedGroundDetailView.value = null
  selectedWeaponDetailView.value = null
}

/**
 * 构建地图 Label 详情上下文（地球数据 + 库记录）。
 */
const buildGlobeResourceDetailContext = () => ({
  satellites: globeSatellites.value,
  weapons: globeWeapons.value,
  groundTargets: globeGroundTargets.value,
  weaponRecords: weaponRecordById.value,
  groundRecords: groundStationRecordById.value,
  satelliteLabelMetrics:
    selectedNorad.value != null
      ? resolveDisplayMetricsAtPlayhead(selectedNorad.value, currentTimeMs.value)
      : null,
})

/**
 * 根据当前选中资源统一写入地球 Label 详情文案。
 *
 * @param request 资源类型与标识
 */
const applyGlobeResourceDetail = (request: GlobeResourceDetailRequest) => {
  /** 地球列表、库记录和当前播放头轨道指标 */
  const ctx = buildGlobeResourceDetailContext()
  if (request.kind === 'satellite') {
    /** 地球上的目标卫星；不在列表中则清空浮层，不使用矩阵坐标兜底 */
    const sat = ctx.satellites.find((item) => item.norad === request.norad)
    if (!sat) {
      selectedResourceDetailText.value = null
      selectedSatelliteDetailView.value = null
      selectedGroundDetailView.value = null
      selectedWeaponDetailView.value = null
      return
    }
    /** 卫星 Grid 视图；指标尚未预计算完成时退回纯文本行 */
    const viewModel = buildSatelliteGlobeDetailViewModel(sat, ctx.satelliteLabelMetrics)
    selectedSatelliteDetailView.value = viewModel
    selectedGroundDetailView.value = null
    selectedWeaponDetailView.value = null
    selectedResourceDetailText.value = viewModel
      ? formatSatelliteGlobeDetailTooltipText(viewModel)
      : formatSatelliteGlobeDetailLines(sat)
    return
  }
  if (request.kind === 'weapon') {
    selectedSatelliteDetailView.value = null
    selectedGroundDetailView.value = null
    /** 地球坐标记录；库记录用于补齐左侧面板已有、地球列表没有的字段 */
    const fromGlobe = ctx.weapons.find((item) => item.id === request.weaponId)
    const fallback = request.weaponFallback ?? ctx.weaponRecords.get(request.weaponId) ?? null
    if (!fromGlobe && !fallback) {
      selectedResourceDetailText.value = null
      selectedWeaponDetailView.value = null
      return
    }
    /** 武器 Grid 视图，同时生成浮层纯文本 */
    const weaponView = buildWeaponGlobeDetailViewModel(fromGlobe ?? null, fallback)
    selectedWeaponDetailView.value = weaponView
    selectedResourceDetailText.value = formatResourceGridDetailTooltipText(weaponView)
    return
  }
  if (request.kind === 'ground') {
    selectedSatelliteDetailView.value = null
    selectedWeaponDetailView.value = null
    /** 地面目标键解析结果；格式非法时清空浮层 */
    const parsed = parseGroundTargetKey(request.targetKey)
    if (!parsed) {
      selectedResourceDetailText.value = null
      selectedGroundDetailView.value = null
      return
    }
    /** 地球上的地面目标；库记录补齐右侧面板点击时缺失的字段 */
    const fromGlobe = ctx.groundTargets.find(
      (target) => target.kind === parsed.kind && target.id === parsed.id,
    )
    const fallback =
      request.groundFallback ?? ctx.groundRecords.get(parsed.id) ?? null
    if (!fromGlobe && !fallback) {
      selectedResourceDetailText.value = null
      selectedGroundDetailView.value = null
      return
    }
    /** 接收站或数据中心的 Grid 视图 */
    const groundView = buildGroundStationGlobeDetailViewModel(
      parsed.kind,
      fromGlobe ?? null,
      fallback,
    )
    selectedGroundDetailView.value = groundView
    selectedResourceDetailText.value = formatResourceGridDetailTooltipText(groundView)
    return
  }
  selectedSatelliteDetailView.value = null
  selectedGroundDetailView.value = null
  selectedWeaponDetailView.value = null
  selectedResourceDetailText.value = resolveGlobeResourceDetailText(request, ctx)
}

/** 播放头或预计算完成后，刷新当前选中卫星的 Label（仅查表，不传播 TLE） */
const refreshSelectedSatelliteGlobeDetail = () => {
  /** 当前选中星；已改选武器或地面目标时不覆盖它们的浮层 */
  const norad = selectedNorad.value
  if (norad == null || selectedWeaponId.value || selectedGroundTargetKey.value) return
  applyGlobeResourceDetail({ kind: 'satellite', norad })
}

/** 调度选中卫星的关键节点指标预计算 */
const scheduleSelectedSatelliteLabelMetrics = () => {
  /** 要预计算的 NORAD；返回时若用户已换星则丢弃这次刷新 */
  const norad = selectedNorad.value
  if (norad == null) return
  void schedulePrecomputeForNorad(norad, currentTimeMs.value).then(() => {
    if (selectedNorad.value === norad) {
      refreshSelectedSatelliteGlobeDetail()
    }
  })
}

/** 库记录异步加载完成后，刷新当前选中武器/地面目标的 Label 详情 */
watch([weaponRecordById, groundStationRecordById], () => {
  if (selectedWeaponId.value) {
    applyGlobeResourceDetail({ kind: 'weapon', weaponId: selectedWeaponId.value })
  } else if (selectedGroundTargetKey.value) {
    applyGlobeResourceDetail({ kind: 'ground', targetKey: selectedGroundTargetKey.value })
  }
})

/**
 * 左侧面板选中卫星系列：同步 Store 分析系列，并在地球上高亮该系列卫星点，不显示 Label。
 *
 * @param series 系列名
 */
const handleFocusTaskSeries = (series: string) => {
  /** 去掉首尾空白后的系列名 */
  const trimmed = series.trim()
  if (!trimmed) return
  /** 地球上属于该系列的卫星；一颗都没有则不能高亮或飞行 */
  const inSeries = globeSatellites.value.filter((sat) => sat.series === trimmed)
  if (!inSeries.length) {
    ElMessage.warning(`地图上暂无系列「${trimmed}」的卫星，请等待任务算法完成并拉取分析结果`)
    return
  }
  selectedWeaponId.value = null
  selectedGroundTargetKey.value = null
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  clearGlobeResourceDetail()
  globeSeriesHighlight.value = trimmed
  store.setSelectedSatSeries(trimmed)
  void nextTick(() => {
    globeRef.value?.flyToSatelliteSeries?.(trimmed)
  })
}

/**
 * 左侧面板资源详情：地图定位 + 目标 Label 展示当前已有字段。
 *
 * @param payload 资源类型、候选项及已加载的接口记录
 */
const handleFocusResourceDetail = (payload: TaskPanelResourceDetailPayload) => {
  /** 资源种类、候选项，以及面板已加载的武器/地面站库记录 */
  const { kind, item, weapon: weaponRecord, groundStation } = payload
  clearGlobeResourceDetail()

  if (kind === 'series') {
    handleFocusTaskSeries(item.id)
    return
  }

  if (kind === 'satellite') {
    /** 面板传入的 NORAD；非有限数不能定位 */
    const norad = payload.norad
    if (norad == null || !Number.isFinite(norad)) {
      ElMessage.warning('卫星 NORAD 无效，无法定位')
      return
    }
    /** 地球渲染列表中的卫星；分析未完成时列表里没有，不能飞过去 */
    const onGlobe = globeSatellites.value.find((sat) => sat.norad === norad)
    if (!onGlobe) {
      ElMessage.warning(
        `地图上暂无 NORAD ${norad} 的卫星，请等待任务算法完成并拉取分析结果`,
      )
      return
    }
    void handleSelectSatellite(norad, { detailRequest: { kind: 'satellite', norad } })
    return
  }

  if (kind === 'weapon') {
    /** 地球上的武器点；没有坐标则无法定位 */
    const fromGlobe = globeWeapons.value.find((w) => w.id === item.id)
    if (!fromGlobe) {
      ElMessage.warning(
        `地图上暂无武器「${item.label}」。任务分析结果未包含该武器坐标时无法定位，请确认已保存并重算。`,
      )
      return
    }
    handleSelectWeapon(fromGlobe.id, { weaponFallback: weaponRecord ?? null })
    return
  }

  if (kind === 'receive' || kind === 'center') {
    /** 面板的 center 对应地球上的 station 键 */
    const targetKind = kind === 'center' ? 'station' : 'receive'
    /** 地球上的接收站或数据中心 */
    const fromGlobe = globeGroundTargets.value.find((t) => t.kind === targetKind && t.id === item.id)
    if (!fromGlobe) {
      ElMessage.warning(
        `地图上暂无${kind === 'center' ? '数据中心' : '地面站'}「${item.label}」。请等待任务分析完成或确认任务已装配该目标。`,
      )
      return
    }
    handleSelectGroundTarget(buildGroundTargetKey(targetKind, fromGlobe.id), {
      groundFallback: groundStation ?? null,
    })
  }
}

/**
 * 选中或取消选中卫星，并同步 Store 与地球详情浮层。
 * 再次点中同一颗星时先清空再写回，迫使地球的选中监听重新飞相机。
 *
 * @param norad 卫星 NORAD；null 表示取消选中
 * @param options 可选的详情请求；缺省时按该 NORAD 生成卫星浮层
 */
const handleSelectSatellite = async (
  norad: number | null,
  options?: { detailRequest?: GlobeResourceDetailRequest },
) => {
  /** 写入前的选中星，用于判断是重复点击还是换星 */
  const previousNorad = selectedNorad.value
  /** 选中前地图上是否已有卫星、武器或地面目标，用于决定是否暂停时间轴 */
  const hadSelection = hasGlobeSelection()

  if (norad != null && previousNorad === norad) {
    selectedNorad.value = null
    store.setSelectedAnalysisNorad(null)
    await nextTick()
    selectedNorad.value = norad
    store.setSelectedAnalysisNorad(norad)
    if (options?.detailRequest) {
      applyGlobeResourceDetail(options.detailRequest)
    } else if (norad != null) {
      applyGlobeResourceDetail({ kind: 'satellite', norad })
    }
    return
  }

  if (norad != null) {
    handleSelectionPlayback(hadSelection, true)
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    clearGlobeResourceDetail()
    if (options?.detailRequest) {
      applyGlobeResourceDetail(options.detailRequest)
    } else {
      applyGlobeResourceDetail({ kind: 'satellite', norad })
    }
  } else {
    clearGlobeResourceDetail()
  }

  selectedNorad.value = norad
  store.setSelectedAnalysisNorad(norad)
}

/**
 * 选中武器并定位地球。
 *
 * @param weaponId 武器 ID
 */
const handleSelectWeapon = (
  weaponId: string | null,
  options?: { weaponFallback?: Weapon | null },
) => {
  if (!weaponId) return

  /** 选中前是否已有地图目标，用于暂停正在播放的时间轴 */
  const hadSelection = hasGlobeSelection()
  if (selectedWeaponId.value === weaponId) return

  handleSelectionPlayback(hadSelection, true)
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  selectedGroundTargetKey.value = null
  selectedWeaponId.value = weaponId
  applyGlobeResourceDetail({
    kind: 'weapon',
    weaponId,
    weaponFallback: options?.weaponFallback ?? null,
  })
}

/**
 * 选中接收站/数据中心并定位地球。
 *
 * @param targetKey 目标键 receive: / station:
 */
const handleSelectGroundTarget = (
  targetKey: string | null,
  options?: { groundFallback?: BaseStationInfo | null },
) => {
  if (!targetKey) return

  /** 选中前是否已有地图目标，用于暂停正在播放的时间轴 */
  const hadSelection = hasGlobeSelection()
  if (selectedGroundTargetKey.value === targetKey) return

  handleSelectionPlayback(hadSelection, true)
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  selectedWeaponId.value = null
  selectedGroundTargetKey.value = targetKey
  applyGlobeResourceDetail({
    kind: 'ground',
    targetKey,
    groundFallback: options?.groundFallback ?? null,
  })
}

/**
 * 清除选中卫星并恢复战场初始俯视视角。
 */
const handleClearSelectedSatellite = () => {
  selectedNorad.value = null
  store.setSelectedAnalysisNorad(null)
  clearGlobeResourceDetail()
  resetDeductionUi()
  globeRef.value?.restoreOverviewView()

  if (wasPlayingBeforeSelection) {
    wasPlayingBeforeSelection = false
    startTimelinePlayback()
  }
}

/**
 * 清除选中武器并恢复战场初始俯视视角。
 */
const handleClearSelectedWeapon = () => {
  selectedWeaponId.value = null
  clearGlobeResourceDetail()
  globeRef.value?.restoreOverviewView()

  if (wasPlayingBeforeSelection) {
    wasPlayingBeforeSelection = false
    startTimelinePlayback()
  }
}

/**
 * 清除选中地面目标并恢复战场初始俯视视角。
 */
const handleClearSelectedGroundTarget = () => {
  selectedGroundTargetKey.value = null
  clearGlobeResourceDetail()
  globeRef.value?.restoreOverviewView()

  if (wasPlayingBeforeSelection) {
    wasPlayingBeforeSelection = false
    startTimelinePlayback()
  }
}

/**
 * 左侧面板保存并重算后：清空矩阵缓存并等待进度完成后由既有 watch 拉取分析。
 */
const handleTaskRecalculated = () => {
  autoTimelinePlaybackTaskId = null
  stopTimelinePlayback()
  resetDeductionUi()
  void loadMatrixForCurrentScope()
}

/** 矩阵加载序号，用于丢弃过期响应 */
let matrixLoadToken = 0

/** 任务分析加载序号，用于丢弃过期响应 */
let taskAnalysisLoadToken = 0

/**
 * 按当前任务算法进度拉取分析结果。
 */
const loadTaskAnalysis = async () => {
  /** 本次请求代际；返回时若已发起更新的请求则丢弃结果 */
  const loadToken = ++taskAnalysisLoadToken
  try {
    await store.fetchTaskAnalysis()
    if (loadToken !== taskAnalysisLoadToken) return
  } catch (err) {
    console.error('获取任务算法分析结果失败:', err)
  }
}

/**
 * 按当前系列筛选范围加载矩阵数据。
 */
const loadMatrixForCurrentScope = async () => {
  /** 当前任务；没有任务时清空矩阵和地图选中 */
  const taskId = store.activedTask?.id
  if (!taskId) {
    store.clearMatrixData()
    selectedNorad.value = null
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    store.setSelectedAnalysisNorad(null)
    return
  }

  /** 本次矩阵请求代际，换系列或换任务后旧响应不再写选中态 */
  const loadToken = ++matrixLoadToken
  try {
    /** 按当前系列、类型和用途拉到的矩阵；失败时为假值 */
    const data = await store.fetchMatrixForCurrentScope()
    if (loadToken !== matrixLoadToken) return
    selectedNorad.value = null
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    store.setSelectedAnalysisNorad(null)
    if (!data) {
      console.warn('当前系列矩阵加载失败')
    }
  } catch (err) {
    console.error('获取算法传输矩阵失败:', err)
  }
}

/** 任务时间变化时，游标重置到任务开始 */
watch(
  taskTimeRange,
  (range) => {
    stopTimelinePlayback()
    resetDeductionUi()
    wasPlayingBeforeSelection = false
    selectedWeaponId.value = null
    selectedGroundTargetKey.value = null
    currentTimeMs.value = range ? parseTaskTimeMs(range.start) : 0
  },
  { immediate: true }
)

/** 换星时清掉上一次推演，并为新选中星调度 Label 指标预计算 */
watch(selectedNorad, (norad, prevNorad) => {
  if (norad !== prevNorad) {
    resetDeductionUi()
  }
  if (norad != null) {
    scheduleSelectedSatelliteLabelMetrics()
  }
})

/** 播放头移动后，用已预计算的采样刷新选中卫星浮层，不在这里传播 TLE */
watch(currentTimeMs, () => {
  refreshSelectedSatelliteGlobeDetail()
})

/** 分析数据、卫星数量或任务时段变化后，重新预计算当前选中星的 Label 指标 */
watch(
  () =>
    [
      taskAnalysisData.value,
      globeSatellites.value.length,
      taskStartMs.value,
      taskEndMs.value,
    ] as const,
  () => {
    scheduleSelectedSatelliteLabelMetrics()
  },
)

/** 离开页面时停掉时间轴和推演，避免卸载后仍推进时钟 */
onBeforeUnmount(() => {
  stopTimelinePlayback()
  resetDeductionUi()
})

/** 任务装配系列变化时校正分析系列（默认第一项，保留左侧面板已选且仍在列表中的系列） */
watch(
  () => store.taskSelectedSeriesList,
  (options) => {
    /** 装配系列变化后，保留仍在列表中的分析系列，否则回到第一项 */
    store.resolveSelectedSatSeriesForTaskOptions(options)
  },
  { immediate: true },
)

/**
 * 分析系列被清空或切到其他系列时，取消地图黄色高亮。
 * 初始化自动选中第一项不会写入 globeSeriesHighlight，因此不显示卫星标签。
 */
watch(
  () => store.selectedSatSeries,
  (series) => {
    /** Store 系列已不是用户点过的地图高亮系列时，去掉黄点 */
    if (globeSeriesHighlight.value && globeSeriesHighlight.value !== series) {
      globeSeriesHighlight.value = null
    }
  },
)

/** 系列/任务变化时重新加载矩阵 */
watch(
  () => [store.selectedSatSeries, store.selectedSatType, store.activeZhchUsageType] as const,
  () => {
    void loadMatrixForCurrentScope()
  },
  { immediate: true }
)

/** 切换任务时作废自动播放标记和 Label 缓存，并重新加载矩阵与分析结果 */
watch(
  () => store.activedTask?.id,
  (taskId, prevTaskId) => {
    if (taskId !== prevTaskId) {
      autoTimelinePlaybackTaskId = null
      lastGlobeSatelliteValidationKey = ''
      clearSatelliteLabelMetricsCache()
    }
    if (!taskId) {
      store.clearTaskAnalysisData()
      return
    }
    if (taskId === prevTaskId) return
    void loadMatrixForCurrentScope()
    void loadTaskAnalysis()
  },
  { immediate: true }
)

/** 任务加载完成后 10x 自动播放时间轴 */
watch(
  () =>
    [
      store.activedTask?.id,
      algorithmComplete.value,
      taskAnalysisLoading.value,
      taskAnalysisData.value,
      matrixData.value,
      globeSatellites.value.length,
      globeWeapons.value.length,
      globeGroundTargets.value.length,
    ] as const,
  () => {
    tryStartAutoTimelinePlayback()
  }
)

/** 算法进度完成后自动拉取分析结果 */
watch(
  () => {
    /** 当前任务 ID；无任务时不监听进度 */
    const taskId = store.activedTask?.id
    if (!taskId) return ''
    /** 内存进度优先，否则用任务上自带的算法进度 */
    const progress = taskProgressMap[taskId] ?? store.activedTask?.algorithmProgressEntity
    return `${taskId}:${progress?.totalStatus}:${progress?.transitStatus}:${progress?.threatAndStrikeStatus}`
  },
  () => {
    if (!algorithmComplete.value) return
    void loadTaskAnalysis()
  }
)

/**
 * 从缓存页回到态势页时，对齐 Store 里的选中星，并补拉缺失的矩阵或分析结果。
 */
onActivated(() => {
  if (store.selectedAnalysisNorad && selectedNorad.value !== store.selectedAnalysisNorad) {
    selectedNorad.value = store.selectedAnalysisNorad
  }
  if (!store.matrixData) {
    void loadMatrixForCurrentScope()
  }
  if (!store.taskAnalysisData && algorithmComplete.value) {
    void loadTaskAnalysis()
  }
})
</script>

<style lang="scss" scoped>
.battle-situation-container {
  --c2-left-panel-width: 440px;
  --c2-right-panel-width: 500px;
  --c2-timeline-side-gap: 24px;

  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: #0b1528;

  .map-globe-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    background: #020617;
  }

  .globe-selected-bar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 12;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: min(860px, calc(100% - 32px));
    flex-wrap: wrap;
    justify-content: center;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(8, 20, 36, 0.88);
    border: 1px solid rgba(0, 225, 255, 0.35);
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    pointer-events: auto;

    &--satellite {
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
    }
  }

  .globe-selected-bar__info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-width: 0;
  }

  .globe-selected-bar__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .globe-selected-label {
    font-size: 13px;
    color: #94a3b8;
    white-space: nowrap;
  }

  .globe-selected-name {
    font-size: 13px;
    font-weight: 700;
    color: #fbbf24;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .globe-selected-meta {
    font-size: 12px;
    font-weight: 600;
    color: #7dd3fc;
    line-height: 1.35;
    max-width: min(520px, 100%);
    word-break: break-word;
  }

  .globe-selected-bar--weapon {
    border-color: rgba(248, 113, 113, 0.45);
  }

  .globe-selected-bar--ground {
    border-color: rgba(34, 211, 238, 0.45);
  }

  .globe-selected-name--weapon {
    color: #f87171;
  }

  .globe-selected-name--ground {
    color: #22d3ee;
  }

  .globe-follow-check {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid rgba(0, 225, 255, 0.28);
    background: rgba(0, 225, 255, 0.08);
    color: #7dd3fc;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;

    input {
      margin: 0;
      accent-color: #22d3ee;
      cursor: pointer;
    }
  }

  .globe-deduction-btn {
    flex-shrink: 0;
    height: 26px;
    padding: 0 10px;
    border-radius: 4px;
    border: 1px solid rgba(52, 211, 153, 0.45);
    background: rgba(52, 211, 153, 0.12);
    color: #6ee7b7;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      background: rgba(52, 211, 153, 0.24);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &--pause {
      border-color: rgba(251, 191, 36, 0.45);
      background: rgba(251, 191, 36, 0.12);
      color: #fcd34d;

      &:hover:not(:disabled) {
        background: rgba(251, 191, 36, 0.24);
      }
    }
  }

  .globe-clear-btn {
    flex-shrink: 0;
    height: 26px;
    padding: 0 12px;
    border-radius: 4px;
    border: 1px solid rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(248, 113, 113, 0.24);
      color: #ffffff;
      border-color: #f87171;
    }
  }

  .floating-panel {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 10;
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    .panel-inner {
      height: 100%;
      overflow: hidden;
      border-radius: 0;
      backdrop-filter: blur(16px);
      background: rgba(8, 20, 36, 0.88);
      border: 1px solid rgba(0, 225, 255, 0.28);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 16px rgba(0, 225, 255, 0.1);
    }

    .toggle-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 20px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(10, 28, 52, 0.92);
      border: 1px solid rgba(0, 225, 255, 0.35);
      color: #00e1ff;
      cursor: pointer;
      z-index: 20;
      transition: all 0.25s ease;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
      outline: none;

      .toggle-icon {
        font-size: 13px;
      }

      &:hover {
        background: rgba(0, 225, 255, 0.25);
        border-color: #00e1ff;
        color: #ffffff;
      }
    }

    &--left {
      left: 0;
      width: var(--c2-left-panel-width);

      .panel-inner {
        border-left: none;
        border-top: none;
        border-bottom: none;
      }

      .toggle-btn--left {
        right: -21px;
        border-left: none;
        border-radius: 0 6px 6px 0;
      }

      &.is-collapsed {
        transform: translateX(-100%);
      }
    }

    &--right {
      right: 0;
      width: var(--c2-right-panel-width);

      .panel-inner {
        border-right: none;
        border-top: none;
        border-bottom: none;
      }

      .toggle-btn--right {
        left: -21px;
        border-right: none;
        border-radius: 6px 0 0 6px;
      }

      &.is-collapsed {
        transform: translateX(100%);
      }
    }
  }

  .floating-timeline-wrapper {
    position: absolute;
    left: calc(var(--c2-left-panel-width) + var(--c2-timeline-side-gap));
    right: calc(var(--c2-right-panel-width) + var(--c2-timeline-side-gap));
    bottom: 12px;
    z-index: 15;
    max-width: calc(100% - var(--c2-left-panel-width) - var(--c2-right-panel-width) - 2 * var(--c2-timeline-side-gap));
    display: flex;
    flex-direction: column;
    align-items: stretch;
    transition:
      transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
      right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;

    &.timeline--left-collapsed {
      left: var(--c2-timeline-side-gap);
      max-width: calc(100% - var(--c2-right-panel-width) - 2 * var(--c2-timeline-side-gap));
    }

    &.timeline--right-collapsed {
      right: var(--c2-timeline-side-gap);
      max-width: calc(100% - var(--c2-left-panel-width) - 2 * var(--c2-timeline-side-gap));
    }

    &.timeline--left-collapsed.timeline--right-collapsed {
      left: var(--c2-timeline-side-gap);
      right: var(--c2-timeline-side-gap);
      max-width: calc(100% - 2 * var(--c2-timeline-side-gap));
    }

    .timeline-toggle-btn {
      position: absolute;
      top: -20px;
      left: 50%;
      transform: translateX(-50%);
      height: 20px;
      padding: 0 10px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(10, 28, 52, 0.92);
      border: 1px solid rgba(0, 225, 255, 0.35);
      border-bottom: none;
      border-radius: 5px 5px 0 0;
      color: #00e1ff;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      outline: none;
      z-index: 20;

      &:hover {
        background: rgba(0, 225, 255, 0.22);
        color: #ffffff;
      }
    }

    .timeline-inner {
      border-radius: 8px;
      overflow: hidden;
      backdrop-filter: blur(14px);
      background: rgba(8, 20, 36, 0.85);
      border: 1px solid rgba(0, 225, 255, 0.28);
      box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.6),
        0 0 16px rgba(0, 225, 255, 0.1);
    }

    &.is-collapsed {
      transform: translateY(calc(100% + 14px));
    }
  }
}
</style>
