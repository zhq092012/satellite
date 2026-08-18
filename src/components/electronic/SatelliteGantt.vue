<template>
  <div class="satellite-gantt-dashboard dark-theme">
    <!-- 顶部控制与全景 Header -->
    <div class="gantt-header">
      <div class="header-left">
        <span class="header-icon">
          <!-- Lucide Satellite Icon SVG -->
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-satellite">
            <path d="M13 7 9 3 5 7l4 4" />
            <path d="m17 11 4 4-4 4-4-4" />
            <path d="m8 12 4 4" />
            <path d="m13 17 3 3" />
            <path d="M4 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
            <path d="M24 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
          </svg>
        </span>
        <span class="header-title glow-text">卫星-接收站 电磁信号干扰甘特图矩阵</span>
      </div>

      <div class="header-center">
        <!-- 矩阵系列信息与状态统计看板 -->
        <span class="badge-item" v-if="props.matrixData?.series">
          <span class="label">卫星系列:</span>
          <span class="value">{{ props.matrixData.series }}</span>
        </span>
        <span class="badge-item">
          <span class="label">卫星总数:</span>
          <span class="value">{{ filteredSatellites.length }} 颗</span>
        </span>
        <span class="badge-item">
          <span class="label">地面站总数:</span>
          <span class="value">{{ totalReceiveCount }} 个</span>
        </span>
        <span class="badge-item alert-badge">
          <span class="label">{{ ganttLabel }}卫星:</span>
          <span class="value danger">{{ struckSatCount }} 颗</span>
        </span>
        <span class="badge-item alert-badge">
          <span class="label">{{ ganttLabel }}地面站:</span>
          <span class="value danger">{{ struckReceiveCount }} 个</span>
        </span>
      </div>

      <div class="header-right">
        <!-- 放大与缩小刻度控制 -->
        <div class="zoom-controls">
          <span class="time-span-display">{{ currentTickSpanLabel }}</span>
          <span class="zoom-label">时间刻度:</span>
          <el-button-group>
            <el-button size="small" type="primary" :disabled="tickStepIndex >= TICK_STEP_OPTIONS.length - 1"
              @click="zoomOut">
              缩小 -
            </el-button>
            <el-button size="small" type="primary" @click="resetScale">
              {{ currentTickSpanShort }}
            </el-button>
            <el-button size="small" type="primary" :disabled="tickStepIndex <= 0" @click="zoomIn">
              放大 +
            </el-button>
          </el-button-group>
        </div>
      </div>
    </div>

    <!-- 左-中-右 三栏主容器布局 -->
    <div class="gantt-main-body" v-loading="loading">
      <!-- 1. 左侧栏 (Left Sidebar): 列表索引、图例 Legend、统计 -->
      <div class="gantt-sidebar-left">
        <!-- 搜索筛选框 -->
        <div class="sidebar-search-box">
          <el-input v-model="searchKeyword" placeholder="搜索卫星/接收站/武器..." size="small" clearable>
            <template #prefix>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                class="lucide lucide-search">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </template>
          </el-input>
        </div>

        <!-- 4色状态图例说明 (Legend) -->
        <div class="legend-panel">
          <div class="legend-title">干扰状态图例指引</div>
          <div class="legend-items">
            <div class="legend-item item-normal">
              <span class="color-dot dot-normal"></span>
              <span class="legend-text">正常过境 (未被干扰)</span>
            </div>
            <div class="legend-item item-sat-struck">
              <span class="color-dot dot-sat-struck"></span>
              <span class="legend-text">卫星被干扰 </span>
            </div>
            <div class="legend-item item-rec-struck">
              <span class="color-dot dot-rec-struck"></span>
              <span class="legend-text">接收站被干扰 </span>
            </div>
            <div class="legend-item item-both-struck">
              <span class="color-dot dot-both-struck"></span>
              <span class="legend-text">双重干扰 (卫星与接收站均被干扰)</span>
            </div>
          </div>
        </div>

        <!-- 卫星与接收站层次索引树/列表 -->
        <div class="sat-tree-list">
          <div class="tree-header">卫星节点 ({{ filteredSatellites.length }})</div>
          <div v-for="sat in filteredSatellites" :key="sat.norad" class="sat-tree-item" :class="{
            'is-sat-struck': sat.satelliteStatus === 1,
            'is-selected': selectedSatNorad === sat.norad,
          }" :ref="(el) => setSatTreeItemRef(sat.norad, el as Element | null)" @click="selectSatelliteRow(sat)">
            <div class="sat-item-header">
              <span class="sat-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  class="lucide lucide-satellite">
                  <path d="M13 7 9 3 5 7l4 4" />
                  <path d="m17 11 4 4-4 4-4-4" />
                  <path d="m8 12 4 4" />
                  <path d="m13 17 3 3" />
                  <path d="M4 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                  <path d="M24 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                </svg>
              </span>
              <span class="sat-name-text" :title="sat.name">{{ sat.name }}</span>
              <span class="sat-status-tag" :class="sat.satelliteStatus === 1 ? 'tag-danger' : 'tag-success'">
                {{ sat.satelliteStatus === 1 ? '卫星被干扰' : '正常' }}
              </span>
            </div>

            <!-- 关联接收站过境窗口摘要列表 -->
            <div class="sat-windows-sublist">
              <div v-for="win in sat.stationWindows" :key="win.receiveId + '-' + win.peakWindow" class="win-sub-item"
                :class="{
                  'is-win-struck': win.strikeStatus === 1,
                  'is-win-selected': isStationWindowSelected(sat.norad, win),
                }" @click.stop="selectStationWindow(sat, win)">
                <span class="sub-rec-name">📡 {{ win.receiveName }}</span>
                <span class="sub-win-time">{{
                  win.peakWindow.length >= 16 ? win.peakWindow.substring(11, 16) : win.peakWindow
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 中间栏：甘特图 + 底部播放时间轴 -->
      <div class="gantt-center-column">
        <div class="gantt-workspace-center" ref="scrollContainerRef">
          <div class="gantt-chart-inner" :style="{ width: ganttCanvasWidth + 180 + 'px' }">
            <div class="gantt-timeline-header">
              <div class="left-row-label-header">
                <span>卫星 / 干扰排道</span>
              </div>
              <div class="timeline-ticks-container">
                <div v-for="tick in timelineTicks" :key="tick.timeStr" class="time-tick-item"
                  :class="{ 'is-current-tick': tick.isCurrent }" :style="{ left: tick.leftPx + 'px' }">
                  <span class="tick-line"></span>
                  <span class="tick-text">{{ tick.label }}</span>
                </div>
                <div class="gantt-playhead-line" :style="{ left: playheadLeftPx + 'px' }"></div>
              </div>
            </div>

            <div class="gantt-rows-container">
              <div v-for="ganttRow in processedGanttRows" :key="ganttRow.rowKey" class="gantt-sat-row-group" :class="{
                'row-sat-struck': ganttRow.satelliteStatus === 1,
                'is-row-selected': selectedSatNorad === ganttRow.norad,
              }" :ref="(el) => setGanttRowRef(ganttRow.norad, el as Element | null)">
                <div class="row-label-col">
                  <div class="sat-main-label">
                    <span class="icon-sat">🛰️</span>
                    <span class="sat-title">{{ ganttRow.name }}</span>
                  </div>
                </div>

                <div class="row-timeline-track" :style="{ height: ganttRow.trackHeight + 'px' }">
                  <div v-for="tick in timelineTicks" :key="'grid-' + ganttRow.rowKey + tick.timeStr"
                    class="track-grid-line" :class="{ 'is-current-grid': tick.isCurrent }"
                    :style="{ left: tick.leftPx + 'px' }"></div>
                  <div class="gantt-playhead-line" :style="{ left: playheadLeftPx + 'px' }"></div>

                  <div v-for="bar in ganttRow.bars" :key="bar.id" class="gantt-bar-item" :class="[
                    bar.colorStatusClass,
                    {
                      'is-bar-active': selectedBarId === bar.id,
                      'is-bar-at-playhead': isBarAtPlayhead(bar),
                    },
                  ]" :style="{
                    left: bar.leftPx + 'px',
                    width: bar.widthPx + 'px',
                    top: bar.topPx + 'px',
                    height: bar.barHeight + 'px',
                  }" @click.stop="handleSelectBar(bar)">
                    <div class="bar-content" :title="bar.barTooltip">
                      <span v-for="(line, lineIdx) in bar.barLabelLines" :key="lineIdx" class="bar-label-line">{{
                        line
                      }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="gantt-playback-footer" v-if="taskTimeBounds">
          <div class="playback-controls">
            <el-button size="small" type="primary" @click="jumpToTaskStart">起点</el-button>
            <el-button size="small" type="primary" :disabled="!canJumpPrevWindow"
              :title="selectedSatNorad ? '跳转到上一个过境窗口' : '请先选择卫星'" @click="jumpToAdjacentWindow(-1)">
              上一窗口
            </el-button>
            <el-button size="small" type="primary" :disabled="!canStepPrev" @click="jumpPlayheadByGrid(-1)">
              上一格
            </el-button>

            <el-button size="small" type="primary" :disabled="!selectedSatNorad"
              :title="selectedSatNorad ? '' : '请先选择卫星'" @click="togglePlayback">
              {{ isPlaying ? '暂停' : '播放' }}
            </el-button>
            <el-button size="small" type="primary" :disabled="!canStepNext" @click="jumpPlayheadByGrid(1)">
              下一格
            </el-button>
            <el-button size="small" type="primary" :disabled="!canJumpNextWindow"
              :title="selectedSatNorad ? '跳转到下一个过境窗口' : '请先选择卫星'" @click="jumpToAdjacentWindow(1)">
              下一窗口
            </el-button>
            <el-button size="small" type="primary" @click="jumpToTaskEnd">终点</el-button>
            <span class="playback-divider"></span>
            <span class="playback-label">速度</span>
            <el-select v-model="gridsPerSecond" size="small" class="speed-select" @change="onSpeedChange">
              <el-option v-for="opt in GRIDS_PER_SECOND_OPTIONS" :key="opt" :label="`${opt} 格/秒`" :value="opt" />
            </el-select>
            <span class="playback-time">{{ currentPlayTimeText }}</span>
          </div>
          <div class="playback-track" :class="{ 'is-dragging': isDraggingPlayhead }" ref="playbackTrackRef"
            @pointerdown="handlePlaybackPointerDown" @pointermove="handlePlaybackPointerMove"
            @pointerup="handlePlaybackPointerUp" @pointercancel="handlePlaybackPointerUp">
            <div class="playback-track-bg"></div>
            <div v-for="tick in timelineTicks" :key="'pb-' + tick.timeStr" class="playback-tick"
              :style="{ left: tick.percent + '%' }"></div>
            <div class="playback-cursor" :style="{ left: playheadPercent + '%' }"></div>
          </div>
          <div class="playback-scale">
            <span>{{ formatPlayTime(taskTimeBounds.minTs) }}</span>
            <span>{{ formatPlayTime(taskTimeBounds.maxTs) }}</span>
          </div>
        </div>
      </div>

      <!-- 3. 右侧栏 (Right Detail Panel): 选中的干扰武器与交战分析明细 -->
      <div class="gantt-sidebar-right">
        <div class="panel-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-crosshair">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" x2="18" y1="12" y2="12" />
            <line x1="6" x2="2" y1="12" y2="12" />
            <line x1="12" x2="12" y1="6" y2="2" />
            <line x1="12" x2="12" y1="22" y2="18" />
          </svg>
          <span class="panel-title">干扰与武器明细</span>
          <span v-if="barsAtPlayhead.length > 0" class="panel-subtitle">{{ barsAtPlayhead.length }} 条链路</span>
        </div>

        <div class="panel-content-body" v-if="barsAtPlayhead.length > 0">
          <div class="playhead-summary-header">
            <span class="playhead-time-label">当前时刻</span>
            <span class="playhead-time-val">{{ currentPlayTimeText }}</span>
          </div>

          <div v-for="bar in barsAtPlayhead" :key="bar.id" class="playhead-link-block"
            :class="[bar.colorStatusClass, { 'is-click-selected': selectedBarId === bar.id }]"
            @click="handleSelectBar(bar)">
            <div class="compact-link-header" :class="bar.colorStatusClass">
              <span class="compact-status-tag">{{ bar.statusLabel }}</span>
              <span class="compact-link-line" :title="`${bar.satName} → ${bar.receiveName}`">
                🛰️ {{ bar.satName }} → 📡 {{ bar.receiveName }}
              </span>
            </div>

            <div class="compact-detail-grid">
              <div class="compact-row">
                <span class="compact-key">卫星</span>
                <span class="compact-val" :title="`NORAD: ${bar.satNorad}`">{{ bar.satName }}</span>
                <span class="compact-tag" :class="bar.satStatus === 1 ? 'is-danger' : 'is-success'">
                  {{ bar.satStatus === 1 ? '被干扰' : '正常' }}
                </span>
              </div>
              <div class="compact-row">
                <span class="compact-key">地面站</span>
                <span class="compact-val" :title="bar.receiveId">{{ bar.receiveName }}</span>
                <span class="compact-tag" :class="bar.strikeStatus === 1 ? 'is-danger' : 'is-success'">
                  {{ bar.strikeStatus === 1 ? '被干扰' : '正常' }}
                </span>
              </div>
              <div class="compact-row compact-time-row">
                <span class="compact-key">过境</span>
                <span class="compact-val compact-time" :title="`${bar.peakWindow} ~ ${bar.endWindow}`">
                  {{ bar.peakWindowShort }} ~ {{ bar.endWindowShort }}
                </span>
              </div>
              <div class="compact-row" v-if="bar.delayMin">
                <span class="compact-key">延时</span>
                <span class="compact-val is-warning">+{{ bar.delayMin }} 分钟</span>
              </div>
            </div>

            <div class="compact-weapons" v-if="bar.weapons && bar.weapons.length > 0">
              <div v-for="w in bar.weapons" :key="w.id" class="compact-weapon-row">
                <span class="weapon-name">🎯 {{ w.name }}</span>
                <span class="weapon-meta">{{ w.country }} · {{ w.type }} · {{ w.range }}km</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 缺省提示 -->
        <div class="empty-panel-tip" v-else>
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
            class="lucide lucide-mouse-pointer-click">
            <path d="m9 9 5 12 1.8-5.2L21 14Z" />
            <path d="M7.2 2.2 8 5.1" />
            <path d="m5.1 8-2.9-.8" />
            <path d="M14 4.1 12 6" />
            <path d="m6 12-1.9 2" />
          </svg>
          <div class="tip-text">
            当前时刻 <strong>{{ currentPlayTimeText }}</strong> 无过境链路。点击左侧接收站，或拖动底部时间轴使标线穿过甘特条块，即可查看链路详情。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import type { MatrixResult, SatelliteMatrix, StationWindow, Weapon, CommucationMatrix } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
const store = useLayoutStore()
// [类型定义]
// 组件接收的 Props 参数类型
interface SatelliteGanttProps {
  /** 算法矩阵根接口返回数据 MatrixResult 或 CommucationMatrix (可选) */
  matrixData?: MatrixResult | CommucationMatrix | any
  /** 烈度 */
  intensity?: string
}

// [变量声明]
// 组件定义 Props 属性，若外层未提供则组件自主发起网络请求获取
const props = withDefaults(defineProps<SatelliteGanttProps>(), {
  matrixData: null,
  intensity: '低烈度',
})

// [变量用途]
// 组件内部自主管理的 MatrixResult 矩阵数据引用
const internalMatrixData = ref<MatrixResult | CommucationMatrix | any>(null)

// [变量用途]
// 数据加载 Loading 状态
const loading = ref<boolean>(false)

// [变量用途]
// 左侧栏搜索关键词 (按卫星/接收站/武器名称过滤)
const searchKeyword = ref<string>('')

// [变量用途]
// 当前选中的卫星 NORAD 编号
const selectedSatNorad = ref<number | null>(null)

// [变量用途]
// 当前选中的甘特条 Item ID
const selectedBarId = ref<string | null>(null)
const selectedStationKey = ref<string | null>(null)

const scrollContainerRef = ref<HTMLDivElement | null>(null)
const playbackTrackRef = ref<HTMLDivElement | null>(null)
const isDraggingPlayhead = ref(false)
const ganttRowRefs = new Map<number, HTMLElement>()
const satTreeItemRefs = new Map<number, HTMLElement>()

const setGanttRowRef = (norad: number, el: Element | null) => {
  if (el) ganttRowRefs.set(norad, el as HTMLElement)
  else ganttRowRefs.delete(norad)
}

const setSatTreeItemRef = (norad: number, el: Element | null) => {
  if (el) satTreeItemRefs.set(norad, el as HTMLElement)
  else satTreeItemRefs.delete(norad)
}

const scrollToSatRow = (norad: number) => {
  nextTick(() => {
    const rowEl = ganttRowRefs.get(norad)
    rowEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

const scrollToSatTreeItem = (norad: number) => {
  nextTick(() => {
    const itemEl = satTreeItemRefs.get(norad)
    itemEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
}

// 时间刻度步长档位（默认 10 分钟/格）
const TICK_STEP_OPTIONS = [15, 30, 60, 300, 600] as const
const DEFAULT_TICK_STEP_INDEX = 4
const PIXELS_PER_TICK = 80
const BAR_LINE_HEIGHT = 13
const BAR_PADDING_Y = 10
const BAR_PADDING_X = 16
const LANE_GAP = 4
const LANE_BAR_GAP_PX = 4
const LANE_TOP_OFFSET = 6
const TRACK_PADDING = 12

const estimateWrappedLines = (text: string, widthPx: number): number => {
  const available = Math.max(widthPx - BAR_PADDING_X, 48)
  const charsPerLine = Math.max(5, Math.floor(available / 8.5))
  return Math.max(1, Math.ceil(text.length / charsPerLine))
}

const computeBarHeight = (labelLines: string[], widthPx: number): number => {
  const firstLineWraps = estimateWrappedLines(labelLines[0] || '', widthPx)
  const otherLines = Math.max(0, labelLines.length - 1)
  const visualLines = firstLineWraps + otherLines
  const gapTotal = Math.max(0, visualLines - 1) * 2
  return Math.max(50, visualLines * BAR_LINE_HEIGHT + BAR_PADDING_Y + gapTotal)
}
const GRIDS_PER_SECOND_OPTIONS = [0.5, 1, 2, 5] as const

const tickStepIndex = ref<number>(DEFAULT_TICK_STEP_INDEX)
const gridsPerSecond = ref<number>(1)
const currentPlayTs = ref<number>(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// [类型用途]
// 甘特图 Bar 元素计算后的封装结构
interface ProcessedGanttBar {
  /** 甘特 Bar 唯一标识 ID */
  id: string
  /** 卫星 NORAD 编号 */
  satNorad: number
  /** 卫星名称 */
  satName: string
  /** 卫星干扰状态 (0-未干扰，1-被干扰) */
  satStatus: number
  /** 地面接收站 ID */
  receiveId: string
  /** 地面接收站名称 */
  receiveName: string
  /** 接收站干扰状态 (0-未干扰，1-被干扰) */
  strikeStatus: number
  /** 开始时间字符串 (peakWindow) */
  peakWindow: string
  /** 结束时间字符串 (endWindow) */
  endWindow: string
  /** 简写开始时间 (HH:mm) */
  peakWindowShort: string
  /** 简写结束时间 (HH:mm) */
  endWindowShort: string
  /** 开始 Unix 时间戳 (秒) */
  startTimestamp: number
  /** 结束 Unix 时间戳 (秒) */
  endTimestamp: number
  /** 干扰延时 (分钟) */
  delayMin?: number
  /** 武器列表 */
  weapons: Weapon[]
  /** 4色干扰状态样式类名 */
  colorStatusClass: 'status-normal' | 'status-sat-struck' | 'status-rec-struck' | 'status-both-struck'
  /** 多层排道索引号 (0, 1, 2...) */
  laneIndex: number
  /** 甘特 Bar 顶部 Px 偏移 */
  topPx: number
  /** 甘特 Bar 高度 Px */
  barHeight: number
  /** 甘特 Bar 左侧 Px 偏移 */
  leftPx: number
  /** 甘特 Bar 宽度 Px */
  widthPx: number
  /** 条块展示文字（多行） */
  barLabelLines: string[]
  /** tooltip 全文 */
  barTooltip: string
  /** 干扰状态简写 */
  statusLabel: string
}

interface ProcessedGanttRow {
  rowKey: string
  norad: number
  name: string
  satType: string
  satelliteStatus: number
  weapons: Weapon[]
  bars: ProcessedGanttBar[]
  maxLanes: number
  trackHeight: number
}

/**
 * [功能说明]
 * 获取当前生效的 MatrixResult 矩阵数据。
 *
 * [数据来源]
 * 优先使用外部传入的 props.matrixData，若未传则使用组件内部拉取的 internalMatrixData。
 */
const currentData = computed<MatrixResult | null>(() => {
  return props.matrixData || store.matrixData || internalMatrixData.value
})

/**
 * [功能说明]
 * 自主异步拉取后端矩阵数据 (优先使用 store 中已查询的共享矩阵数据)。
 */
const loadMatrixData = async () => {
  if (props.matrixData || store.matrixData) return
  loading.value = true
  try {
    const data = await store.fetchReconnaissanceAttackMatrix({
      taskId: store.activedTask?.id || 0,
      intensityLevel: props.intensity || '低烈度',
      series: store.selectedSatSeries || '',
    })
    if (data) {
      internalMatrixData.value = data
    }
  } catch (err: any) {
    console.error('获取甘特图矩阵数据异常:', err)
  } finally {
    loading.value = false
  }
}

/**
 * [监听器说明]
 * 监听 store 中选中的卫星系列和激活的任务改变，自动同步矩阵数据
 */
watch(
  [() => store.matrixData, () => store.selectedSatSeries, () => store.activedTask?.id],
  () => {
    if (!props.matrixData && !store.matrixData) {
      void loadMatrixData()
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (!props.matrixData && !store.matrixData) {
    void loadMatrixData()
  }
})

/**
 * [功能说明]
 * 过滤搜索卫星列表。
 */
const filteredSatellites = computed<SatelliteMatrix[]>(() => {
  if (!currentData.value?.satelliteMatrixList) return []
  const list = currentData.value.satelliteMatrixList
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return list

  return list.filter((sat) => {
    const matchSatName = sat.name.toLowerCase().includes(kw) || String(sat.norad).includes(kw)
    const matchRec = sat.stationWindows?.some((w) => w.receiveName.toLowerCase().includes(kw))
    const matchWeapon =
      sat.weapons?.some((w) => w.name.toLowerCase().includes(kw)) ||
      sat.stationWindows?.some((win) => win.weapons?.some((w) => w.name.toLowerCase().includes(kw)))
    return matchSatName || matchRec || matchWeapon
  })
})

/**
 * [功能说明]
 * 任务时间边界（严格使用 beginDate ~ endDate）
 */
const taskTimeBounds = computed<{ minTs: number; maxTs: number } | null>(() => {
  const task = store.activedTask
  if (!task?.beginDate || !task?.endDate) return null
  const minTs = parseToTimestamp(task.beginDate)
  const maxTs = parseToTimestamp(task.endDate)
  if (minTs >= maxTs) return null
  return { minTs, maxTs }
})

/**
 * [功能说明]
 * 定义甘特图动词 Label (高烈度为“被摧毁”，中/低烈度为“被干扰”)
 */
const ganttLabel = computed<string>(() => {
  return props.intensity === '高烈度' ? '被摧毁' : '被干扰'
})

/**
 * [功能说明]
 * 提炼当前矩阵数据中所有不重复的地面站对象列表
 */
const totalReceiveList = computed(() => {
  const map = new Map<string, { receiveId: string; receiveName: string; status: number }>()

  const relLists = [currentData.value?.stationRelationList, currentData.value?.initRelationList].filter(Boolean)

  relLists.forEach((rl) => {
    ; (rl?.receiveObjList || []).forEach((rec) => {
      if (!map.has(rec.receiveId)) {
        map.set(rec.receiveId, {
          receiveId: rec.receiveId,
          receiveName: rec.receiveName || rec.receiveId,
          status: rec.receiveStatus || 0,
        })
      } else {
        if (rec.receiveStatus === 1) {
          map.get(rec.receiveId)!.status = 1
        }
      }
    })
  })

  // 若关联列表无数据，从卫星过境窗口中兜底提炼
  if (map.size === 0 && currentData.value?.satelliteMatrixList) {
    currentData.value.satelliteMatrixList.forEach((sat) => {
      ; (sat.stationWindows || []).forEach((win) => {
        if (!map.has(win.receiveId)) {
          map.set(win.receiveId, {
            receiveId: win.receiveId,
            receiveName: win.receiveName || win.receiveId,
            status: win.strikeStatus || 0,
          })
        } else {
          if (win.strikeStatus === 1) {
            map.get(win.receiveId)!.status = 1
          }
        }
      })
    })
  }

  return Array.from(map.values())
})

/**
 * [功能说明]
 * 计算地面站总数量统计。
 */
const totalReceiveCount = computed<number>(() => {
  return totalReceiveList.value.length
})

/**
 * [功能说明]
 * 计算被干扰/摧毁的地面站数量统计。
 */
const struckReceiveCount = computed<number>(() => {
  return totalReceiveList.value.filter((rec) => rec.status === 1).length
})

/**
 * [功能说明]
 * 计算被干扰的卫星数量统计。
 */
const struckSatCount = computed<number>(() => {
  return filteredSatellites.value.filter((sat) => sat.satelliteStatus === 1).length
})

/**
 * [功能说明]
 * 解析时间窗字符串为 Unix 秒时间戳 (例 "2026-07-30 08:00:00" 或 "08:00:00")。
 *
 * @param timeStr 时间字符串
 * @returns Unix 秒时间戳
 */
const parseToTimestamp = (timeStr: string): number => {
  if (!timeStr) return Date.now() / 1000
  const d = new Date(timeStr)
  if (!isNaN(d.getTime())) {
    return Math.floor(d.getTime() / 1000)
  }
  // 若包含 HH:mm:ss 简写
  const parts = timeStr.split(':').map(Number)
  if (parts.length >= 2) {
    const now = new Date()
    now.setHours(parts[0], parts[1], parts[2] || 0, 0)
    return Math.floor(now.getTime() / 1000)
  }
  return Math.floor(Date.now() / 1000)
}

/**
 * [功能说明]
 * 甘特图时间边界（严格限定任务 beginDate ~ endDate）
 */
const timeBounds = computed<{ minTs: number; maxTs: number }>(() => {
  const bounds = taskTimeBounds.value
  if (bounds) return bounds

  const now = Math.floor(Date.now() / 1000)
  return { minTs: now, maxTs: now + 86400 }
})

/**
 * [功能说明]
 * 甘特图总画布基准像素宽度。
 */
const ganttCanvasWidth = computed<number>(() => {
  const durationSec = timeBounds.value.maxTs - timeBounds.value.minTs
  const tickCount = Math.max(Math.ceil(durationSec / tickStepSec.value), 1)
  return Math.max(tickCount * PIXELS_PER_TICK, 1200)
})

/**
 * [功能说明]
 * 当前时间轴刻度步长（秒）。
 */
const tickStepSec = computed<number>(() => TICK_STEP_OPTIONS[tickStepIndex.value] ?? 60)

const formatTickStepLabel = (sec: number): string => {
  if (sec < 60) return `${sec} 秒/格`
  return `${sec / 60} 分钟/格`
}

/**
 * [功能说明]
 * 当前时间轴刻度跨度文案（放大/缩小时展示）。
 */
const currentTickSpanLabel = computed<string>(() => `刻度跨度: ${formatTickStepLabel(tickStepSec.value)}`)

const currentTickSpanShort = computed<string>(() => formatTickStepLabel(tickStepSec.value))

const formatTimelineTickLabel = (ts: number, stepSec: number): string => {
  const date = new Date(ts * 1000)
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  if (stepSec < 60) return `${h}:${m}:${s}`
  return `${h}:${m}`
}

const getInterferenceStatusLabel = (satStatus: number, strikeStatus: number): string => {
  if (satStatus === 1 && strikeStatus === 1) return '双扰'
  if (satStatus === 1) return '星扰'
  if (strikeStatus === 1) return '站扰'
  return '正常'
}

const buildBarLabelLines = (
  satName: string,
  recName: string,
  statusLabel: string,
  peakWindowShort: string,
  endWindowShort: string,
  delayMin?: number
): string[] => {
  const lines = [
    `${satName} → ${recName}`,
    statusLabel,
    `${peakWindowShort} ~ ${endWindowShort}`,
  ]
  if (delayMin !== undefined && delayMin !== null && Number(delayMin) > 0) {
    lines.push(`延时 +${delayMin}分钟`)
  }
  return lines
}

const tsToLeftPx = (ts: number): number => {
  const { minTs, maxTs } = timeBounds.value
  const totalSec = maxTs - minTs
  if (totalSec <= 0) return 0
  return Math.floor(((ts - minTs) / totalSec) * ganttCanvasWidth.value)
}

const tsToPercent = (ts: number): number => {
  const { minTs, maxTs } = timeBounds.value
  const totalSec = maxTs - minTs
  if (totalSec <= 0) return 0
  return Math.min(Math.max(((ts - minTs) / totalSec) * 100, 0), 100)
}

const playheadLeftPx = computed(() => tsToLeftPx(currentPlayTs.value))
const playheadPercent = computed(() => tsToPercent(currentPlayTs.value))

const formatPlayTime = (ts: number): string => {
  const date = new Date(ts * 1000)
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${mo}-${d} ${h}:${m}:${s}`
}

const currentPlayTimeText = computed(() => formatPlayTime(currentPlayTs.value))

const snapToGrid = (ts: number): number => {
  const { minTs, maxTs } = timeBounds.value
  const step = tickStepSec.value
  const snapped = minTs + Math.round((ts - minTs) / step) * step
  return Math.min(Math.max(snapped, minTs), maxTs)
}

/** 定位到事件发生时刻所在格的前一格起点 */
const seekToPrevGrid = (eventTs: number) => {
  const { minTs, maxTs } = timeBounds.value
  const step = tickStepSec.value
  if (step <= 0) {
    currentPlayTs.value = Math.min(Math.max(eventTs, minTs), maxTs)
    return
  }
  const prevGridTs = minTs + Math.floor((eventTs - minTs - 1) / step) * step
  currentPlayTs.value = Math.min(Math.max(prevGridTs, minTs), maxTs)
}

const getWindowStartTs = (win: any): number | null => {
  const startStr = win?.peakWindow || win?.startWindow || win?.beginWindow || win?.startTime || ''
  if (!startStr) return null
  return parseToTimestamp(startStr)
}

const getFirstStationStartTs = (sat: any): number | null => {
  const windows = sat?.stationWindows || sat?.initWindows || []
  let earliest: number | null = null
  windows.forEach((win: any) => {
    const ts = getWindowStartTs(win)
    if (ts == null) return
    if (earliest == null || ts < earliest) earliest = ts
  })
  return earliest
}

const stationWindowKey = (norad: number, win: any) =>
  `${norad}-${win?.receiveId || ''}-${win?.peakWindow || win?.startWindow || ''}`

const isStationWindowSelected = (norad: number, win: StationWindow) =>
  selectedStationKey.value === stationWindowKey(norad, win)

const findBarForWindow = (norad: number, win: any): ProcessedGanttBar | undefined => {
  const row = processedGanttRows.value.find((item) => item.norad === norad)
  if (!row) return undefined
  const startStr = win?.peakWindow || win?.startWindow || win?.beginWindow || ''
  const receiveId = win?.receiveId || 'target-area'
  return (
    row.bars.find((bar) => bar.receiveId === receiveId && bar.peakWindow === startStr) ||
    row.bars.find((bar) => bar.receiveId === receiveId && bar.receiveName === win?.receiveName)
  )
}

const seekPlayheadIntoBar = (bar: ProcessedGanttBar) => {
  const { minTs, maxTs } = timeBounds.value
  const step = tickStepSec.value
  const clampedStart = Math.min(Math.max(bar.startTimestamp, minTs), maxTs)
  const clampedEnd = Math.min(Math.max(bar.endTimestamp, minTs), maxTs)
  if (step <= 0) {
    currentPlayTs.value = clampedStart
    return
  }
  const gridInWindow = minTs + Math.ceil((clampedStart - minTs) / step) * step
  if (gridInWindow >= clampedStart && gridInWindow <= clampedEnd) {
    currentPlayTs.value = Math.min(Math.max(gridInWindow, minTs), maxTs)
    return
  }
  currentPlayTs.value = snapToGrid(clampedStart)
}

const buildBarsForWindows = (
  windows: Array<{
    win: any
    sat: any
    start: number
    end: number
    idx: number
    startStr: string
    endStr: string
  }>,
  options: {
    defaultTargetName: string
    minTs: number
    totalSec: number
    canvasWidth: number
  }
): { bars: ProcessedGanttBar[]; maxLanes: number; trackHeight: number } => {
  const bars: ProcessedGanttBar[] = []
  const laneRightPx: number[] = []

  windows.forEach(({ win, sat, start, end, idx, startStr, endStr }) => {
    const startRatio = (start - options.minTs) / options.totalSec
    const endRatio = (end - options.minTs) / options.totalSec
    const leftPx = Math.floor(startRatio * options.canvasWidth)
    const rawWidthPx = Math.floor((endRatio - startRatio) * options.canvasWidth)
    const widthPx = Math.max(rawWidthPx, 72)

    const satStatus = sat?.satelliteStatus || 0
    const strikeStatusVal =
      typeof win.strikeStatus === 'number' ? win.strikeStatus : satStatus === 1 ? 1 : 0
    let colorStatusClass: ProcessedGanttBar['colorStatusClass'] = 'status-normal'
    if (satStatus === 1 && strikeStatusVal === 1) {
      colorStatusClass = 'status-both-struck'
    } else if (satStatus === 1) {
      colorStatusClass = 'status-sat-struck'
    } else if (strikeStatusVal === 1) {
      colorStatusClass = 'status-rec-struck'
    }

    const peakWindowShort = startStr.length >= 16 ? startStr.substring(11, 19) : startStr
    const endWindowShort = endStr.length >= 16 ? endStr.substring(11, 19) : endStr
    const recName = win.receiveName || options.defaultTargetName
    const recId = win.receiveId || 'target-area'
    const satName = sat?.name || `Sat-${sat?.norad || ''}`
    const satNorad = sat?.norad || 0
    const statusLabel = getInterferenceStatusLabel(satStatus, strikeStatusVal)
    const barLabelLines = buildBarLabelLines(
      satName,
      recName,
      statusLabel,
      peakWindowShort,
      endWindowShort,
      win.delayMin
    )
    const barTooltip = barLabelLines.join('\n')
    const barHeight = computeBarHeight(barLabelLines, widthPx)
    const rightPx = leftPx + widthPx

    // 时间未重叠也可能因最小条宽在像素上重叠，需同时按像素右边界排道
    let laneIndex = laneRightPx.findIndex((laneRight) => laneRight + LANE_BAR_GAP_PX <= leftPx)
    if (laneIndex === -1) {
      laneIndex = laneRightPx.length
      laneRightPx.push(rightPx)
    } else {
      laneRightPx[laneIndex] = rightPx
    }

    const weaponMap = new Map<string, Weapon>()
      ; (sat?.weapons || []).forEach((w: Weapon) => weaponMap.set(w.id, w))
      ; (win.weapons || []).forEach((w: Weapon) => weaponMap.set(w.id, w))

    bars.push({
      id: `bar-sat-${satNorad}-${recId}-${idx}`,
      satNorad,
      satName,
      satStatus,
      receiveId: recId,
      receiveName: recName,
      strikeStatus: strikeStatusVal,
      peakWindow: startStr,
      endWindow: endStr,
      peakWindowShort,
      endWindowShort,
      startTimestamp: start,
      endTimestamp: end,
      delayMin: win.delayMin,
      weapons: Array.from(weaponMap.values()),
      colorStatusClass,
      laneIndex,
      topPx: 0,
      barHeight,
      leftPx,
      widthPx,
      barLabelLines,
      barTooltip,
      statusLabel,
    })
  })

  const maxLanes = Math.max(laneRightPx.length, 1)
  const laneMaxHeights = new Array<number>(maxLanes).fill(0)
  bars.forEach((bar) => {
    laneMaxHeights[bar.laneIndex] = Math.max(laneMaxHeights[bar.laneIndex], bar.barHeight)
  })

  const laneTops: number[] = []
  let trackBottom = LANE_TOP_OFFSET
  for (let i = 0; i < maxLanes; i++) {
    laneTops[i] = trackBottom
    trackBottom += laneMaxHeights[i] + LANE_GAP
  }

  bars.forEach((bar) => {
    bar.topPx = laneTops[bar.laneIndex]
  })

  const trackHeight =
    bars.length === 0
      ? LANE_TOP_OFFSET + computeBarHeight(['占位', '占位'], 120) + TRACK_PADDING
      : trackBottom + TRACK_PADDING - LANE_GAP

  return { bars, maxLanes, trackHeight }
}

/**
 * [功能说明]
 * 计算生成顶部时间轴刻度列表。
 */
const timelineTicks = computed<
  { label: string; timeStr: string; leftPx: number; percent: number; isCurrent: boolean }[]
>(() => {
  const { minTs, maxTs } = timeBounds.value
  const totalSec = maxTs - minTs
  if (totalSec <= 0) return []

  const ticks: { label: string; timeStr: string; leftPx: number; percent: number; isCurrent: boolean }[] =
    []
  const stepSec = tickStepSec.value
  const startTs = Math.ceil(minTs / stepSec) * stepSec
  const currentSnapped = snapToGrid(currentPlayTs.value)

  for (let ts = startTs; ts <= maxTs; ts += stepSec) {
    const label = formatTimelineTickLabel(ts, stepSec)
    const leftPx = tsToLeftPx(ts)
    const percent = tsToPercent(ts)

    ticks.push({
      label,
      timeStr: new Date(ts * 1000).toISOString(),
      leftPx,
      percent,
      isCurrent: ts === currentSnapped,
    })
  }

  return ticks
})

/**
 * [功能说明]
 * 核心多层排道 (Multi-tier Lane) 算法：
 * 计算卫星行与地面站行及其甘特条。
 */
const processedGanttRows = computed<ProcessedGanttRow[]>(() => {
  const { minTs, maxTs } = timeBounds.value
  const totalSec = maxTs - minTs
  const canvasWidth = ganttCanvasWidth.value
  const defaultTargetName = store.battle?.name || '战场目标区域'

  return filteredSatellites.value.map((sat: any) => {
    const rawWindows = sat.stationWindows || sat.initWindows || []
    const sortedWindows = rawWindows
      .map((win: any, idx: number) => {
        const startStr = win.peakWindow || win.startWindow || win.beginWindow || ''
        const endStr = win.endWindow || ''
        const start = parseToTimestamp(startStr)
        const end = parseToTimestamp(endStr)
        return { win, sat, start, end, idx, startStr, endStr }
      })
      .sort((a: any, b: any) => a.start - b.start)

    const { bars, maxLanes, trackHeight } = buildBarsForWindows(sortedWindows, {
      defaultTargetName,
      minTs,
      totalSec,
      canvasWidth,
    })

    return {
      rowKey: `sat-${sat.norad}`,
      norad: sat.norad,
      name: sat.name,
      satType: sat.satType,
      satelliteStatus: sat.satelliteStatus || 0,
      weapons: sat.weapons || [],
      bars,
      maxLanes,
      trackHeight,
    }
  })
})

/**
 * 当前时刻标线穿过的所有过境链路
 */
const barsAtPlayhead = computed<ProcessedGanttBar[]>(() => {
  const ts = currentPlayTs.value
  const result: ProcessedGanttBar[] = []
  for (const row of processedGanttRows.value) {
    for (const bar of row.bars) {
      if (ts >= bar.startTimestamp && ts <= bar.endTimestamp) {
        result.push(bar)
      }
    }
  }
  return result
})

const playheadBarIdSet = computed(() => new Set(barsAtPlayhead.value.map((bar) => bar.id)))

const isBarAtPlayhead = (bar: ProcessedGanttBar) => playheadBarIdSet.value.has(bar.id)

/**
 * 点击甘特块选择事件 handlers
 */
const handleSelectBar = (bar: ProcessedGanttBar) => {
  selectedBarId.value = bar.id
  selectedSatNorad.value = bar.satNorad
  selectedStationKey.value = stationWindowKey(bar.satNorad, {
    receiveId: bar.receiveId,
    peakWindow: bar.peakWindow,
  })
  scrollToSatRow(bar.satNorad)
  scrollToSatTreeItem(bar.satNorad)
  if (currentPlayTs.value < bar.startTimestamp || currentPlayTs.value > bar.endTimestamp) {
    seekPlayheadIntoBar(bar)
  }
}

const selectSatelliteRow = (sat: SatelliteMatrix) => {
  selectedSatNorad.value = sat.norad
  selectedBarId.value = null
  selectedStationKey.value = null
  stopPlayback()
  scrollToSatRow(sat.norad)
  const firstTs = getFirstStationStartTs(sat)
  if (firstTs != null) seekToPrevGrid(firstTs)
}

const selectStationWindow = (sat: SatelliteMatrix, win: StationWindow) => {
  selectedSatNorad.value = sat.norad
  selectedStationKey.value = stationWindowKey(sat.norad, win)
  stopPlayback()
  scrollToSatRow(sat.norad)

  const bar = findBarForWindow(sat.norad, win)
  if (bar) {
    selectedBarId.value = bar.id
    seekPlayheadIntoBar(bar)
    return
  }

  selectedBarId.value = null
  const startTs = getWindowStartTs(win)
  if (startTs != null) currentPlayTs.value = snapToGrid(startTs)
}

const getSelectedSatWindowBounds = (): { firstStart: number; lastEnd: number } | null => {
  if (selectedSatNorad.value == null) return null
  const row = processedGanttRows.value.find((item) => item.norad === selectedSatNorad.value)
  if (!row?.bars.length) return null
  let firstStart = Number.POSITIVE_INFINITY
  let lastEnd = Number.NEGATIVE_INFINITY
  row.bars.forEach((bar) => {
    firstStart = Math.min(firstStart, bar.startTimestamp)
    lastEnd = Math.max(lastEnd, bar.endTimestamp)
  })
  if (!Number.isFinite(firstStart) || !Number.isFinite(lastEnd)) return null
  return { firstStart, lastEnd }
}

const rewindToSelectedSatStart = () => {
  const bounds = getSelectedSatWindowBounds()
  if (!bounds) return
  seekToPrevGrid(bounds.firstStart)
}

const stopPlayback = () => {
  isPlaying.value = false
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

const startPlayback = () => {
  if (selectedSatNorad.value == null) return
  const windowBounds = getSelectedSatWindowBounds()
  if (!windowBounds) return

  stopPlayback()
  if (currentPlayTs.value >= windowBounds.lastEnd) {
    rewindToSelectedSatStart()
  }

  isPlaying.value = true
  const intervalMs = Math.max(200, 1000 / gridsPerSecond.value)
  playTimer = setInterval(() => {
    const satBounds = getSelectedSatWindowBounds()
    const stopAt = satBounds?.lastEnd ?? timeBounds.value.maxTs
    let next = currentPlayTs.value + tickStepSec.value
    if (next > stopAt || next >= timeBounds.value.maxTs) {
      if (next >= timeBounds.value.maxTs) {
        currentPlayTs.value = snapToGrid(timeBounds.value.maxTs)
      }
      stopPlayback()
      return
    }
    currentPlayTs.value = snapToGrid(next)
  }, intervalMs)
}

const togglePlayback = () => {
  if (isPlaying.value) {
    stopPlayback()
    return
  }
  if (selectedSatNorad.value == null) return
  const satBounds = getSelectedSatWindowBounds()
  if (satBounds && currentPlayTs.value >= satBounds.lastEnd) {
    rewindToSelectedSatStart()
  }
  startPlayback()
}

const jumpToTaskStart = () => {
  stopPlayback()
  currentPlayTs.value = timeBounds.value.minTs
}

const jumpToTaskEnd = () => {
  stopPlayback()
  currentPlayTs.value = timeBounds.value.maxTs
}

const getSelectedSatBarsSorted = (): ProcessedGanttBar[] => {
  if (selectedSatNorad.value == null) return []
  const row = processedGanttRows.value.find((item) => item.norad === selectedSatNorad.value)
  if (!row?.bars.length) return []
  return [...row.bars].sort((a, b) => a.startTimestamp - b.startTimestamp || a.endTimestamp - b.endTimestamp)
}

const resolveCurrentWindowIndex = (bars: ProcessedGanttBar[], ts: number): number => {
  if (!bars.length) return -1
  const selectedIdx = selectedBarId.value ? bars.findIndex((bar) => bar.id === selectedBarId.value) : -1
  if (
    selectedIdx >= 0 &&
    ts >= bars[selectedIdx].startTimestamp &&
    ts <= bars[selectedIdx].endTimestamp
  ) {
    return selectedIdx
  }
  return bars.findIndex((bar) => ts >= bar.startTimestamp && ts <= bar.endTimestamp)
}

const resolveAdjacentWindow = (dir: -1 | 1): ProcessedGanttBar | null => {
  const bars = getSelectedSatBarsSorted()
  if (!bars.length) return null
  const ts = currentPlayTs.value
  const currentIdx = resolveCurrentWindowIndex(bars, ts)

  if (currentIdx >= 0) {
    const targetIdx = currentIdx + dir
    return targetIdx >= 0 && targetIdx < bars.length ? bars[targetIdx] : null
  }

  if (dir > 0) {
    return bars.find((bar) => bar.startTimestamp > ts) || null
  }

  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].endTimestamp < ts || bars[i].startTimestamp < ts) return bars[i]
  }
  return null
}

const canJumpPrevWindow = computed(() => resolveAdjacentWindow(-1) != null)
const canJumpNextWindow = computed(() => resolveAdjacentWindow(1) != null)
const canStepPrev = computed(() => currentPlayTs.value > timeBounds.value.minTs)
const canStepNext = computed(() => currentPlayTs.value < timeBounds.value.maxTs)

const jumpToAdjacentWindow = (dir: -1 | 1) => {
  const bar = resolveAdjacentWindow(dir)
  if (!bar) return
  stopPlayback()
  selectedSatNorad.value = bar.satNorad
  selectedBarId.value = bar.id
  selectedStationKey.value = stationWindowKey(bar.satNorad, {
    receiveId: bar.receiveId,
    peakWindow: bar.peakWindow,
  })
  scrollToSatRow(bar.satNorad)
  scrollToSatTreeItem(bar.satNorad)
  seekPlayheadIntoBar(bar)
}

const jumpPlayheadByGrid = (dir: -1 | 1) => {
  stopPlayback()
  const { minTs, maxTs } = timeBounds.value
  const step = tickStepSec.value
  if (step <= 0) return
  const next =
    dir < 0
      ? minTs + Math.floor((currentPlayTs.value - minTs - 1) / step) * step
      : minTs + Math.ceil((currentPlayTs.value - minTs + 1) / step) * step
  currentPlayTs.value = Math.min(Math.max(next, minTs), maxTs)
}

const onSpeedChange = () => {
  if (isPlaying.value) startPlayback()
}

const seekPlayheadFromClientX = (clientX: number) => {
  const track = playbackTrackRef.value
  if (!track) return
  const rect = track.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
  const { minTs, maxTs } = timeBounds.value
  const ts = minTs + ratio * (maxTs - minTs)
  const snapped = snapToGrid(ts)
  if (snapped !== currentPlayTs.value) currentPlayTs.value = snapped
}

const handlePlaybackPointerDown = (evt: PointerEvent) => {
  if (evt.button !== 0) return
  const track = playbackTrackRef.value
  if (!track) return
  evt.preventDefault()
  stopPlayback()
  isDraggingPlayhead.value = true
  track.setPointerCapture(evt.pointerId)
  seekPlayheadFromClientX(evt.clientX)
}

const handlePlaybackPointerMove = (evt: PointerEvent) => {
  if (!isDraggingPlayhead.value) return
  seekPlayheadFromClientX(evt.clientX)
}

const handlePlaybackPointerUp = (evt: PointerEvent) => {
  if (!isDraggingPlayhead.value) return
  isDraggingPlayhead.value = false
  const track = playbackTrackRef.value
  if (track?.hasPointerCapture(evt.pointerId)) {
    track.releasePointerCapture(evt.pointerId)
  }
}

const zoomIn = () => {
  if (tickStepIndex.value > 0) tickStepIndex.value -= 1
}

/**
 * 缩小：切换到更粗的时间刻度
 */
const zoomOut = () => {
  if (tickStepIndex.value < TICK_STEP_OPTIONS.length - 1) tickStepIndex.value += 1
}

const resetScale = () => {
  tickStepIndex.value = DEFAULT_TICK_STEP_INDEX
}

// 监听生命周期与Props变动
onMounted(() => {
  loadMatrixData()
  if (taskTimeBounds.value) {
    currentPlayTs.value = taskTimeBounds.value.minTs
  }
})

onBeforeUnmount(() => {
  stopPlayback()
  isDraggingPlayhead.value = false
})

watch(
  () => timeBounds.value.minTs,
  (minTs) => {
    if (minTs) currentPlayTs.value = minTs
  }
)

watch(
  () => props.matrixData,
  () => {
    if (props.matrixData) {
      internalMatrixData.value = props.matrixData
    }
  }
)

watch(playheadLeftPx, (left) => {
  const container = scrollContainerRef.value
  if (!container) return
  const target = 180 + left
  const viewLeft = container.scrollLeft
  const viewRight = viewLeft + container.clientWidth
  if (target < viewLeft + 100 || target > viewRight - 100) {
    container.scrollLeft = Math.max(target - container.clientWidth * 0.4, 0)
  }
})
</script>

<style scoped lang="scss">
.satellite-gantt-dashboard {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 650px;
  background-color: #0b1120;
  color: #e2e8f0;
  font-family: inherit;
  overflow: hidden;

  /* 1. Header 顶部栏 */
  .gantt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 20px;
    background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
    border-bottom: 1px solid #334155;

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;

      .header-icon {
        color: #38bdf8;
        display: flex;
        align-items: center;
      }

      .header-title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: #f8fafc;
      }
    }

    .header-center {
      display: flex;
      align-items: center;
      gap: 16px;

      .badge-item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        background-color: rgba(30, 41, 59, 0.7);
        border: 1px solid #334155;
        border-radius: 4px;
        font-size: 12px;

        .label {
          color: #94a3b8;
        }

        .value {
          color: #38bdf8;
          font-weight: 600;

          &.danger {
            color: #ef4444;
          }
        }

        &.alert-badge {
          border-color: rgba(239, 68, 68, 0.3);
        }
      }
    }

    .header-right {
      .zoom-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;

        .zoom-label {
          color: #94a3b8;
        }

        .time-span-display {
          min-width: 120px;
          color: #38bdf8;
          font-weight: 600;
        }
      }
    }
  }

  /* 2. 主体左-中-右三栏结构 */
  .gantt-main-body {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;

    .gantt-center-column {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .gantt-playback-footer {
      flex-shrink: 0;
      padding: 10px 14px 12px;
      background: #0f172a;
      border-top: 1px solid #1e293b;

      .playback-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
        font-size: 12px;

        .playback-divider {
          width: 1px;
          height: 16px;
          background: #334155;
        }

        .playback-label {
          color: #94a3b8;
        }

        .speed-select {
          width: 100px;
        }

        .playback-time {
          margin-left: auto;
          color: #38bdf8;
          font-family: Consolas, monospace;
          font-weight: 600;
        }
      }

      .playback-track {
        position: relative;
        height: 28px;
        border-radius: 4px;
        cursor: grab;
        overflow: hidden;
        touch-action: none;
        user-select: none;

        &.is-dragging {
          cursor: grabbing;
        }

        .playback-track-bg {
          position: absolute;
          inset: 0;
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid #334155;
          border-radius: 4px;
        }

        .playback-tick {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(148, 163, 184, 0.25);
          transform: translateX(-50%);
          pointer-events: none;
        }

        .playback-cursor {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #00e1ff;
          box-shadow: 0 0 8px rgba(0, 225, 255, 0.8);
          transform: translateX(-50%);
          z-index: 2;
          pointer-events: none;
        }
      }

      .playback-scale {
        display: flex;
        justify-content: space-between;
        margin-top: 4px;
        font-size: 10px;
        color: #64748b;
        font-family: Consolas, monospace;
      }
    }

    .gantt-playhead-line {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #00e1ff;
      box-shadow: 0 0 10px rgba(0, 225, 255, 0.75);
      transform: translateX(-50%);
      z-index: 6;
      pointer-events: none;
    }

    /* 2.1 左侧栏 Sidebar */
    .gantt-sidebar-left {
      width: 310px;
      min-width: 280px;
      background-color: #0f172a;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      padding: 12px;
      gap: 12px;

      .sidebar-search-box {
        :deep(.el-input__wrapper) {
          background-color: #1e293b;
          box-shadow: 0 0 0 1px #334155 inset;

          .el-input__inner {
            color: #f8fafc;
          }
        }
      }

      .legend-panel {
        background-color: #1a2336;
        border: 1px solid #2a364f;
        border-radius: 6px;
        padding: 10px;

        .legend-title {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          margin-bottom: 8px;
        }

        .legend-items {
          display: flex;
          flex-direction: column;
          gap: 6px;

          .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: #cbd5e1;

            .color-dot {
              width: 10px;
              height: 10px;
              border-radius: 2px;

              &.dot-normal {
                background: linear-gradient(135deg, #10b981, #059669);
              }

              &.dot-sat-struck {
                background: linear-gradient(135deg, #ef4444, #dc2626);
              }

              &.dot-rec-struck {
                background: linear-gradient(135deg, #f59e0b, #d97706);
              }

              &.dot-both-struck {
                background: linear-gradient(135deg, #9333ea, #7e22ce);
                box-shadow: 0 0 6px rgba(147, 51, 234, 0.8);
              }
            }
          }
        }
      }

      .sat-tree-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-height: 0;

        .tree-header {
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }

        .sat-tree-item {
          background-color: #1a2336;
          border: 1px solid #27354e;
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          transition: all 0.2s ease;

          &:hover {
            border-color: #38bdf8;
          }

          &.is-selected {
            border-color: #38bdf8;
            background-color: #1e2942;
          }

          &.is-sat-struck {
            border-left: 3px solid #ef4444;
          }

          .sat-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .sat-icon {
              color: #38bdf8;
            }

            .sat-name-text {
              font-size: 13px;
              font-weight: 600;
              color: #f1f5f9;
              flex: 1;
              margin-left: 6px;
            }

            .sat-status-tag {
              font-size: 10px;
              padding: 2px 6px;
              border-radius: 3px;

              &.tag-success {
                background-color: rgba(16, 185, 129, 0.15);
                color: #10b981;
              }

              &.tag-danger {
                background-color: rgba(239, 68, 68, 0.2);
                color: #f87171;
              }
            }
          }

          .sat-windows-sublist {
            margin-top: 6px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-left: 12px;

            .win-sub-item {
              display: flex;
              align-items: center;
              justify-content: space-between;
              font-size: 11px;
              color: #94a3b8;
              padding: 3px 6px;
              border-radius: 4px;
              cursor: pointer;
              border: 1px solid transparent;

              &:hover {
                color: #e2e8f0;
                background: rgba(56, 189, 248, 0.08);
              }

              &.is-win-selected {
                color: #e0f2fe;
                background: rgba(56, 189, 248, 0.16);
                border-color: rgba(56, 189, 248, 0.45);
              }

              &.is-win-struck {
                color: #fbbf24;
              }
            }
          }
        }
      }
    }

    /* 2.2 中间栏 Center Workspace (甘特图上下左右滚动区) */
    .gantt-workspace-center {
      flex: 1;
      min-height: 0;
      overflow: auto;
      background-color: #080d1a;
      position: relative;

      .gantt-chart-inner {
        min-width: 100%;
        display: flex;
        flex-direction: column;

        /* 时间轴顶部 Header */
        .gantt-timeline-header {
          display: flex;
          height: 40px;
          background-color: #0f172a;
          border-bottom: 1px solid #1e293b;
          position: sticky;
          top: 0;
          z-index: 10;

          .left-row-label-header {
            width: 180px;
            min-width: 180px;
            background-color: #0f172a;
            border-right: 1px solid #1e293b;
            display: flex;
            align-items: center;
            padding: 0 12px;
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
            position: sticky;
            left: 0;
            z-index: 11;
          }

          .timeline-ticks-container {
            flex: 1;
            position: relative;
            height: 100%;

            .time-tick-item {
              position: absolute;
              top: 0;
              bottom: 0;
              display: flex;
              flex-direction: column;

              .tick-line {
                width: 1px;
                height: 100%;
                background-color: #334155;
              }

              .tick-text {
                position: absolute;
                top: 8px;
                left: 4px;
                font-size: 11px;
                color: #94a3b8;
                font-family: inherit;
              }

              &.is-current-tick .tick-line {
                background-color: #00e1ff;
                box-shadow: 0 0 6px rgba(0, 225, 255, 0.6);
              }
            }
          }
        }

        /* 甘特行 Rows 容器 */
        .gantt-rows-container {
          display: flex;
          flex-direction: column;

          .gantt-sat-row-group {
            display: flex;
            border-bottom: 1px solid #1e293b;
            background-color: #0b1120;
            position: relative;

            &.row-sat-struck {
              box-shadow: inset 3px 0 0 #ef4444;
            }

            &.is-row-selected {
              background-color: rgba(56, 189, 248, 0.1);
              box-shadow: inset 3px 0 0 #38bdf8;

              .row-label-col {
                background-color: #16324a;
              }

              .sat-title {
                color: #7dd3fc;
              }
            }

            &.row-sat-struck.is-row-selected {
              box-shadow: inset 3px 0 0 #38bdf8;
            }

            &:nth-child(even) {
              background-color: #0d1527;
            }

            .row-label-col {
              width: 180px;
              min-width: 180px;
              background-color: #0f172a;
              border-right: 1px solid #1e293b;
              padding: 10px 12px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              position: sticky;
              left: 0;
              z-index: 8;
              isolation: isolate;

              .sat-main-label {
                display: flex;
                align-items: center;
                gap: 6px;

                .sat-title {
                  font-size: 13px;
                  font-weight: 600;
                  color: #f1f5f9;
                }
              }
            }

            /* Timeline Track 轨道 (支持多排道) */
            .row-timeline-track {
              flex: 1;
              position: relative;
              min-height: 52px;

              .track-grid-line {
                position: absolute;
                top: 0;
                bottom: 0;
                width: 1px;
                background-color: rgba(51, 65, 85, 0.25);
                pointer-events: none;

                &.is-current-grid {
                  width: 2px;
                  background-color: rgba(0, 225, 255, 0.45);
                  box-shadow: 0 0 6px rgba(0, 225, 255, 0.35);
                }
              }

              /* 具体的甘特块 Gantt Bar */
              .gantt-bar-item {
                position: absolute;
                border-radius: 4px;
                padding: 0;
                cursor: pointer;
                box-sizing: border-box;
                display: flex;
                align-items: stretch;
                overflow: hidden;
                transition:
                  transform 0.15s ease,
                  box-shadow 0.15s ease;
                user-select: none;

                &:hover {
                  transform: translateY(-1px);
                  z-index: 4;
                  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                }

                &.is-bar-active {
                  outline: 2px solid #00e1ff;
                  box-shadow: 0 0 12px rgba(0, 225, 255, 0.7);
                  z-index: 6;
                }

                &.is-bar-at-playhead {
                  z-index: 4;
                }

                &.is-bar-active.is-bar-at-playhead {
                  outline: 2px solid #00e1ff;
                  box-shadow: 0 0 14px rgba(0, 225, 255, 0.8);
                }

                /* 4色干扰状态样式定义 */
                &.status-normal {
                  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                  border: 1px solid #34d399;
                  color: #ffffff;
                }

                &.status-sat-struck {
                  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                  border: 1px solid #f87171;
                  color: #ffffff;
                }

                &.status-rec-struck {
                  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                  border: 1px solid #fbbf24;
                  color: #ffffff;
                }

                &.status-both-struck {
                  background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
                  border: 1px solid #c084fc;
                  color: #ffffff;
                  box-shadow: 0 0 8px rgba(147, 51, 234, 0.7);
                }

                .bar-content {
                  display: flex;
                  flex-direction: column;
                  align-items: flex-start;
                  justify-content: flex-start;
                  gap: 2px;
                  font-size: 10px;
                  width: 100%;
                  height: 100%;
                  padding: 5px 8px;
                  box-sizing: border-box;
                  overflow: hidden;

                  .bar-label-line {
                    font-size: 9px;
                    font-weight: 600;
                    line-height: 1.35;
                    white-space: normal;
                    word-break: break-all;
                    width: 100%;
                    text-align: left;
                  }
                }
              }
            }
          }
        }
      }
    }

    /* 2.3 右侧栏 Right Detail Panel */
    .gantt-sidebar-right {
      width: 300px;
      min-width: 280px;
      background-color: #0f172a;
      border-left: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      padding: 8px;
      overflow-y: auto;

      .panel-header {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #38bdf8;
        font-size: 13px;
        font-weight: 700;
        padding-bottom: 6px;
        border-bottom: 1px solid #1e293b;
        margin-bottom: 8px;

        .panel-subtitle {
          margin-left: auto;
          font-size: 10px;
          font-weight: 600;
          color: #7dd3fc;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 999px;
          padding: 1px 6px;
        }
      }

      .panel-content-body {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .playhead-summary-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(0, 225, 255, 0.08);
          border: 1px solid rgba(0, 225, 255, 0.2);

          .playhead-time-label {
            font-size: 10px;
            color: #94a3b8;
          }

          .playhead-time-val {
            font-size: 11px;
            font-weight: 700;
            color: #67e8f9;
            font-family: monospace;
          }
        }

        .playhead-link-block {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 6px;
          border-radius: 6px;
          border: 1px solid #233148;
          background: rgba(12, 20, 36, 0.9);
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;

          &:hover {
            border-color: rgba(56, 189, 248, 0.35);
          }

          &.is-click-selected {
            border-color: rgba(0, 225, 255, 0.85);
            box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.45), 0 0 12px rgba(0, 225, 255, 0.25);
          }

          .compact-link-header {
            display: flex;
            align-items: flex-start;
            gap: 6px;
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid transparent;

            &.status-normal {
              background: rgba(16, 185, 129, 0.12);
              border-color: rgba(16, 185, 129, 0.35);
            }

            &.status-sat-struck {
              background: rgba(239, 68, 68, 0.12);
              border-color: rgba(239, 68, 68, 0.35);
            }

            &.status-rec-struck {
              background: rgba(245, 158, 11, 0.12);
              border-color: rgba(245, 158, 11, 0.35);
            }

            &.status-both-struck {
              background: rgba(147, 51, 234, 0.14);
              border-color: rgba(147, 51, 234, 0.35);
            }

            .compact-status-tag {
              flex-shrink: 0;
              font-size: 10px;
              font-weight: 700;
              line-height: 1.2;
              padding: 1px 5px;
              border-radius: 3px;
              background: rgba(0, 0, 0, 0.25);
              color: #e2e8f0;
            }

            .compact-link-line {
              font-size: 11px;
              font-weight: 600;
              line-height: 1.3;
              color: #e2e8f0;
              word-break: break-all;
            }
          }

          .compact-detail-grid {
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 2px 0;

            .compact-row {
              display: grid;
              grid-template-columns: 42px 1fr auto;
              align-items: center;
              gap: 4px;
              min-height: 18px;
              font-size: 10px;

              &.compact-time-row {
                grid-template-columns: 42px 1fr;
              }

              .compact-key {
                color: #64748b;
                white-space: nowrap;
              }

              .compact-val {
                color: #cbd5e1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;

                &.compact-time {
                  color: #fbbf24;
                  font-family: monospace;
                  font-weight: 600;
                }

                &.is-warning {
                  color: #fbbf24;
                  font-weight: 600;
                }
              }

              .compact-tag {
                font-size: 9px;
                font-weight: 600;
                padding: 0 4px;
                border-radius: 2px;
                white-space: nowrap;

                &.is-success {
                  color: #34d399;
                  background: rgba(16, 185, 129, 0.15);
                }

                &.is-danger {
                  color: #f87171;
                  background: rgba(239, 68, 68, 0.15);
                }
              }
            }
          }

          .compact-weapons {
            display: flex;
            flex-direction: column;
            gap: 2px;
            margin-top: 2px;
            padding-top: 4px;
            border-top: 1px dashed rgba(51, 65, 85, 0.8);

            .compact-weapon-row {
              display: flex;
              flex-direction: column;
              gap: 1px;
              font-size: 10px;
              line-height: 1.25;

              .weapon-name {
                color: #e2e8f0;
                font-weight: 600;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .weapon-meta {
                color: #94a3b8;
                font-size: 9px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }
          }
        }
      }

      .empty-panel-tip {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 40px;
        color: #475569;
        gap: 8px;
        text-align: center;
        padding: 12px;

        .tip-text {
          font-size: 11px;
          line-height: 1.4;
        }
      }
    }
  }
}
</style>
