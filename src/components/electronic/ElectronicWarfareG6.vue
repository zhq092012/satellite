<template>
  <div class="cema-g6-dashboard dark-theme">
    <!-- 顶部导航与控制栏 Header -->
    <div class="cema-header">
      <div class="header-left">
        <span class="header-title glow-text">三层链路拓扑毁伤分析 (AntV G6)</span>
      </div>

      <!-- 烈度与视图模式切换选项 -->
      <div class="header-center">
        <!-- 1. 交战烈度切换按钮组 -->
        <div class="intensity-group">
          <button
            v-for="level in intensityOptions"
            :key="level"
            class="nav-tab-btn"
            :class="{ active: currentIntensity === level }"
            @click="handleIntensityChange(level)"
          >
            {{ level }}
          </button>
        </div>

        <div class="v-divider"></div>

        <!-- 2. 拓扑显示模式切换 -->
        <div class="matrix-tab-group">
          <button
            v-for="mode in viewModeOptions"
            :key="mode.key"
            class="nav-tab-btn tab-matrix"
            :class="{ active: currentViewMode === mode.key }"
            @click="currentViewMode = mode.key"
          >
            {{ mode.name }}
          </button>
        </div>
      </div>

      <!-- 右侧信息栏 -->
      <div class="header-right">
        <div class="header-right-item" v-if="matrixData?.series">
          <span class="label-text">卫星系列:</span>
          <span class="digital-font time-value glow-text-cyan">{{ matrixData.series }}</span>
        </div>
        <div class="header-right-item">
          <span class="label-text">当前任务:</span>
          <span class="digital-font time-value glow-text-cyan">{{ store.activedTask?.name || '实时推演场景' }}</span>
        </div>
      </div>
    </div>

    <!-- 中间主视图与拓扑画布区域 -->
    <div class="cema-workspace">
      <!-- 状态与统计看板小条 -->
      <div class="topo-summary-bar">
        <div class="stat-badge">
          <span class="stat-dot dot-sat"></span>
          <span
            >卫星节点: <strong>{{ satNodeCount }}</strong> 颗</span
          >
        </div>
        <div class="stat-badge">
          <span class="stat-dot dot-rec"></span>
          <span
            >地面站节点: <strong>{{ receiveNodeCount }}</strong> 个</span
          >
        </div>
        <div class="stat-badge">
          <span class="stat-dot dot-station"></span>
          <span
            >数据中心: <strong>{{ stationNodeCount }}</strong> 个</span
          >
        </div>
        <div class="stat-badge">
          <span class="stat-dot dot-normal-link"></span>
          <span
            >正常链路: <strong>{{ normalLinkCount }}</strong> 条</span
          >
        </div>
        <div class="stat-badge alert-stat">
          <span class="stat-dot dot-struck-link"></span>
          <span
            >打压/中断链路: <strong>{{ struckLinkCount }}</strong> 条 (红色 ✖ 标识)</span
          >
        </div>
      </div>

      <!-- 左右分栏主体区域 -->
      <div class="topo-main-body">
        <!-- 左侧：图层标注独立一栏 -->
        <div class="layer-sidebar">
          <div class="layer-sidebar-item layer-1-item">
            <span class="layer-icon">🛰️</span>
            <div class="layer-text">
              <span class="layer-title">第一层：卫星层</span>
              <span class="layer-sub">Satellites Layer</span>
            </div>
          </div>

          <div class="layer-sidebar-item layer-2-item">
            <span class="layer-icon">📡</span>
            <div class="layer-text">
              <span class="layer-title">第二层：接收站</span>
              <span class="layer-sub">Ground Stations Layer</span>
            </div>
          </div>

          <div class="layer-sidebar-item layer-3-item">
            <span class="layer-icon">🏢</span>
            <div class="layer-text">
              <span class="layer-title">第三层：数据中心层</span>
              <span class="layer-sub">Data Centers Layer</span>
            </div>
          </div>
        </div>

        <!-- 右侧：G6 画布容器 (独立分栏，节点绝对不会重叠左侧) -->
        <div ref="g6Container" class="g6-chart-container" v-loading="loading"></div>
      </div>
    </div>

    <!-- 底部时间轴控制与过境窗口面板 -->
    <div class="cema-timeline-footer" v-if="allWindowsList.length > 0">
      <div class="timeline-ctrl-bar">
        <div class="ctrl-left">
          <span class="timeline-title"> <i class="el-icon-timer"></i> 打击/过境时间轴 </span>
          <span class="time-range-text"> [{{ timeRangeText.start }} ~ {{ timeRangeText.end }}] </span>
        </div>

        <div class="ctrl-center">
          <el-button-group>
            <el-button type="primary" size="small" :icon="DArrowLeft" @click="jumpToStart" title="跳转至起始窗口" />
            <el-button type="primary" size="small" :icon="isPlaying ? VideoPause : VideoPlay" @click="togglePlay">
              {{ isPlaying ? '暂停' : '播放推演' }}
            </el-button>
            <el-button type="primary" size="small" :icon="RefreshRight" @click="resetTimeline" title="重置" />
            <el-button type="primary" size="small" :icon="DArrowRight" @click="jumpToEnd" title="跳转至结束窗口" />
          </el-button-group>

          <!-- 播放倍速切换 -->
          <el-select v-model="playSpeed" size="small" style="width: 85px; margin-left: 10px">
            <el-option label="1x 速度" :value="1" />
            <el-option label="2x 速度" :value="2" />
            <el-option label="5x 速度" :value="5" />
            <el-option label="10x 速度" :value="10" />
          </el-select>
        </div>

        <div class="ctrl-right">
          <span class="current-time-display">
            当前推演时刻: <strong class="digital-font time-value">{{ formattedCurrentTime }}</strong>
          </span>
        </div>
      </div>

      <!-- 时间轴进度滑块 -->
      <div class="timeline-slider-box">
        <el-slider
          v-model="currentTimeProgress"
          :min="0"
          :max="100"
          :step="0.1"
          :format-tooltip="formatSliderTooltip"
          @input="handleSliderChange"
        />
      </div>

      <!-- 排序过境/打击窗口列表条 -->
      <div ref="windowsScrollRef" class="windows-cards-scroll">
        <div
          v-for="(win, idx) in allWindowsList"
          :key="win.id || idx"
          :ref="(el) => setCardRef(el, win.id)"
          class="window-card"
          :class="{
            'card-struck': win.strikeStatus === 1,
            'card-active': isWindowActiveAtCurrentTime(win),
            'card-selected': selectedWindowId === win.id,
          }"
          @click="selectWindowItem(win)"
        >
          <div class="card-header">
            <span class="win-time">{{ win.startTimeShort }} ~ {{ win.endTimeShort }}</span>
            <span class="win-status-badge" :class="win.strikeStatus === 1 ? 'badge-danger' : 'badge-success'">
              {{ win.strikeStatus === 1 ? '受毁伤打压' : '正常过境' }}
            </span>
          </div>

          <div class="card-body">
            <div class="win-link-info">
              <span class="sat-name" :title="win.satName">🛰️ {{ win.satName }}</span>
              <span class="arrow-icon">➔</span>
              <span class="rec-name" :title="win.receiveName">📡 {{ win.receiveName }}</span>
            </div>

            <div class="win-meta-info" v-if="win.strikeStatus === 1">
              <span class="delay-tag" v-if="win.delayMin">延时: +{{ win.delayMin }}m</span>
              <span class="weapon-tag" v-if="win.weapons && win.weapons.length > 0" :title="win.weapons[0].name">
                🎯 {{ win.weapons[0].name }} ({{ win.weapons[0].type }})
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import G6 from '@antv/g6'
import { VideoPlay, VideoPause, RefreshRight, DArrowLeft, DArrowRight } from '@element-plus/icons-vue'
import { useLayoutStore } from '@/store/modules/layout'
import { getMatrixList } from '@/api/electronic'
import type { MatrixResult, Weapon } from '@/api/electronic'

const store = useLayoutStore()

// [类型用途]
// 交战烈度选项类型定义
type IntensityLevelType = '高烈度' | '中烈度' | '低烈度'
const intensityOptions: IntensityLevelType[] = ['高烈度', '中烈度', '低烈度']

// [变量用途]
// 当前选中的交战烈度
const currentIntensity = ref<IntensityLevelType>('高烈度')

// [类型用途]
// 拓扑视图显示模式选项
type ViewModeType = 'COMBINED' | 'PRE_STRIKE' | 'POST_STRIKE'

// [变量用途]
// 拓扑视图切换选项列表
const viewModeOptions: { key: ViewModeType; name: string }[] = [
  { key: 'COMBINED', name: '打击前后全景对比' },
  { key: 'PRE_STRIKE', name: '打击前拓扑(未打击)' },
  { key: 'POST_STRIKE', name: '打击后拓扑(毁伤分析)' },
]

// [变量用途]
// 当前选中的拓扑视图模式
const currentViewMode = ref<ViewModeType>('COMBINED')

// [变量用途]
// 后端算法接口返回的矩阵数据对象
const matrixData = ref<MatrixResult | null>(null)

// [变量用途]
// 数据加载状态标记
const loading = ref(false)

// [变量用途]
// G6 图形 Canvas 容器 DOM ref
const g6Container = ref<HTMLDivElement | null>(null)

// [变量用途]
// AntV G6 Graph 实例引用
let graph: any = null

// ==================== 时间轴相关变量定义 ====================

// [类型用途]
// 时间轴过境/打击窗口统一包装结构
interface WindowItemWrapper {
  id: string
  satName: string
  satNorad: number
  receiveName: string
  receiveId: string
  startTime: string
  endTime: string
  startTimeShort: string
  endTimeShort: string
  startTimestamp: number
  endTimestamp: number
  strikeStatus: number
  delayMin?: number
  weapons?: Weapon[] | null
}

// [变量用途]
// 选中的时间窗口 ID
const selectedWindowId = ref<string | null>(null)

// [变量用途]
// 是否正在自动播放推演
const isPlaying = ref(false)

// [变量用途]
// 播放倍速 (1x, 2x, 5x, 10x)
const playSpeed = ref<number>(1)

// [变量用途]
// 自动播放 Timer 定时器句柄
let playTimer: any = null

// [变量用途]
// 当前时间轴推演时刻的 Unix 毫秒时间戳
const currentTimestamp = ref<number>(0)

// [变量用途]
// 时间轴进度条 0 - 100 百分比
const currentTimeProgress = ref<number>(0)

// [变量用途]
// 时间轴下方过境/打击窗口列表条 DOM ref
const windowsScrollRef = ref<HTMLDivElement | null>(null)

// [变量用途]
// 存储每个过境窗口卡片的 DOM ref 映射
const cardRefs = ref<Map<string, HTMLElement>>(new Map())

// [变量用途]
// 记录上一次已自动滚动的窗口卡片 ID，防止重复触发滚动动画抖动
let lastAutoScrolledId: string | null = null

/**
 * [功能说明]
 * 动态记录过境窗口卡片的 DOM 引用。
 *
 * @param el DOM 节点
 * @param id 窗口卡片 ID
 */
const setCardRef = (el: any, id: string) => {
  if (el) {
    cardRefs.value.set(id, el as HTMLElement)
  }
}

/**
 * [功能说明]
 * 时间轴推进或高亮变动时，同步向右平滑滚动窗口卡片列表，保持当前正在打击/过境的窗口卡片在屏幕可视区域内居中显示。
 *
 * [修改约束]
 * - 当活跃卡片未改变时不做重复 scrollIntoView 避免界面频繁动画抖动。
 * - 支持用户手动点击卡片或跳转时通过 force 参数强制滚动定位。
 *
 * @param force 是否强制执行滚动
 */
const scrollToActiveCard = (force = false) => {
  if (!windowsScrollRef.value || allWindowsList.value.length === 0) return

  // 1. 优先获取当前时间戳处于活跃 (正在打击/过境) 状态的窗口卡片
  let targetWin = allWindowsList.value.find((w) => isWindowActiveAtCurrentTime(w))

  // 2. 若当前没有活跃窗口，则获取与当前推演时刻时间间隔最近的窗口卡片
  if (!targetWin) {
    targetWin = allWindowsList.value.reduce((prev, curr) => {
      return Math.abs(curr.startTimestamp - currentTimestamp.value) < Math.abs(prev.startTimestamp - currentTimestamp.value)
        ? curr
        : prev
    })
  }

  if (targetWin && (force || lastAutoScrolledId !== targetWin.id)) {
    lastAutoScrolledId = targetWin.id
    const cardEl = cardRefs.value.get(targetWin.id)
    if (cardEl) {
      cardEl.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }
}

// [数据来源]
// 接口真实参考数据（当 API 无响应或本地调试时作为兜底使用）
const demoMatrixData: MatrixResult = {
  series: 'Capella',
  initMatrixList: [
    {
      norad: 60419,
      name: 'CAPELLA-13',
      satType: '地球观测',
      line1: '',
      line2: '',
      initWindows: [
        {
          receiveId: '6a66cf9e1ce9af52c9cd82b2',
          receiveName: '爱尔兰Ireland',
          receiveLat: 53.3,
          receiveLon: 8.15,
          peakWindow: '2026-07-28 00:23:41',
          endWindow: '2026-07-28 00:32:39',
        },
      ],
    },
    {
      norad: 48643,
      name: 'STARLINK-V1-0-L28-6',
      satType: '通信',
      line1: '',
      line2: '',
      initWindows: [
        {
          receiveId: '6a66cf0f1ce9af52c9cd82b1',
          receiveName: '夏威夷Kapolei',
          receiveLat: 21.3368,
          receiveLon: 158.09,
          peakWindow: '2026-07-28 05:40:48',
          endWindow: '2026-07-28 05:47:38',
        },
      ],
    },
    {
      norad: 59444,
      name: 'CAPELLA-14',
      satType: '地球观测',
      line1: '',
      line2: '',
      initWindows: [
        {
          receiveId: '6a6037d76a3f9e9695ef4716',
          receiveName: '俄勒冈Oregon',
          receiveLat: 45.21,
          receiveLon: 123.11,
          peakWindow: '2026-07-28 01:32:57',
          endWindow: '2026-07-28 01:40:27',
        },
      ],
    },
    {
      norad: 58136,
      name: 'STARLINK-30776',
      satType: '地球观测',
      line1: '',
      line2: '',
      initWindows: [
        {
          receiveId: '6a66d00a1ce9af52c9cd82b3',
          receiveName: '澳大利亚达博',
          receiveLat: 32.25,
          receiveLon: 148.61,
          peakWindow: '2026-07-28 00:43:24',
          endWindow: '2026-07-28 00:49:36',
        },
      ],
    },
    {
      norad: 57693,
      name: 'CAPELLA-11',
      satType: '地球观测',
      line1: '',
      line2: '',
      initWindows: [
        {
          receiveId: '6a6037d76a3f9e9695ef4716',
          receiveName: '俄勒冈Oregon',
          receiveLat: 45.21,
          receiveLon: 123.11,
          peakWindow: '2026-07-28 01:30:18',
          endWindow: '2026-07-28 01:38:27',
        },
      ],
    },
  ],
  initRelationList: {
    receiveObjList: [
      {
        receiveId: '6a66d27f1ce9af52c9cd82b9',
        receiveName: '加拿大伊努维克',
        receiveLatLon: '68.350,133.500',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d48f1ce9af52c9cd82bb',
        receiveName: '加州特拉西',
        receiveLatLon: '37.760,121.430',
        receiveStatus: 0,
      },
      {
        receiveId: '6a6037d76a3f9e9695ef4716',
        receiveName: '俄勒冈Oregon',
        receiveLatLon: '45.210,123.110',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d1e61ce9af52c9cd82b7',
        receiveName: '新西兰阿瓦鲁阿',
        receiveLatLon: '46.540,168.220',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66cf9e1ce9af52c9cd82b2',
        receiveName: '爱尔兰Ireland',
        receiveLatLon: '53.300,8.150',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d1971ce9af52c9cd82b6',
        receiveName: '智利蓬塔阿雷纳斯',
        receiveLatLon: '53.160,70.910',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d00a1ce9af52c9cd82b3',
        receiveName: '澳大利亚达博',
        receiveLatLon: '32.250,148.610',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d0dd1ce9af52c9cd82b4',
        receiveName: '斯瓦尔巴SvalSat',
        receiveLatLon: '78.223,15.620',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66cf0f1ce9af52c9cd82b1',
        receiveName: '夏威夷Kapolei',
        receiveLatLon: '21.3368,158.0900',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d2391ce9af52c9cd82b8',
        receiveName: '南非开普敦',
        receiveLatLon: '33.970,18.420',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d4011ce9af52c9cd82ba',
        receiveName: '美国蒙大拿',
        receiveLatLon: '45.680,111.040',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d13d1ce9af52c9cd82b5',
        receiveName: '南极TrollSat',
        receiveLatLon: '72.010,2.530',
        receiveStatus: 0,
      },
    ],
    stationObjList: [
      {
        stationId: '6a66d7d71ce9af52c9cd82bc',
        stationName: '亚马逊AWS北美云集群',
        stationLatLon: '37.7751,122.4194',
        stationStatus: 0,
      },
    ],
    relations: [
      { from: '6a6037d76a3f9e9695ef4716', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66cf0f1ce9af52c9cd82b1', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66cf9e1ce9af52c9cd82b2', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d00a1ce9af52c9cd82b3', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d0dd1ce9af52c9cd82b4', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d13d1ce9af52c9cd82b5', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d1971ce9af52c9cd82b6', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d1e61ce9af52c9cd82b7', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d2391ce9af52c9cd82b8', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d27f1ce9af52c9cd82b9', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d4011ce9af52c9cd82ba', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d48f1ce9af52c9cd82bb', to: '6a66d7d71ce9af52c9cd82bc' },
    ],
  },
  satelliteMatrixList: [
    {
      norad: 60419,
      name: 'CAPELLA-13',
      satType: '地球观测',
      delayMin: 0.0,
      satelliteStatus: 0,
      weapons: [],
      stationWindows: [
        {
          receiveId: '6a66cf9e1ce9af52c9cd82b2',
          receiveName: '爱尔兰Ireland',
          peakWindow: '2026-07-28 00:23:41',
          endWindow: '2026-07-28 00:32:39',
          strikeStatus: 0,
          weapons: null as any,
        },
      ],
    },
    {
      norad: 48643,
      name: 'STARLINK-V1-0-L28-6',
      satType: '通信',
      delayMin: 0.0,
      satelliteStatus: 0,
      weapons: [],
      stationWindows: [
        {
          receiveId: '6a66cf0f1ce9af52c9cd82b1',
          receiveName: '夏威夷Kapolei',
          peakWindow: '2026-07-28 05:40:48',
          endWindow: '2026-07-28 05:47:38',
          strikeStatus: 0,
          weapons: null as any,
        },
      ],
    },
    {
      norad: 59444,
      name: 'CAPELLA-14',
      satType: '地球观测',
      delayMin: 0.0,
      satelliteStatus: 0,
      weapons: [],
      stationWindows: [
        {
          receiveId: '6a6037d76a3f9e9695ef4716',
          receiveName: '俄勒冈Oregon',
          peakWindow: '2026-07-28 01:32:57',
          endWindow: '2026-07-28 01:40:27',
          strikeStatus: 0,
          weapons: null as any,
        },
      ],
    },
    {
      norad: 58136,
      name: 'STARLINK-30776',
      satType: '地球观测',
      delayMin: 2835.6,
      satelliteStatus: 1,
      weapons: [
        {
          id: '2',
          name: 'ASAT导弹基地',
          country: '中国',
          type: '动能',
          latitude: 20.017,
          longitude: 110.349,
          range: 1500.0,
        },
      ],
      stationWindows: [
        {
          receiveId: '6a66d00a1ce9af52c9cd82b3',
          receiveName: '澳大利亚达博',
          peakWindow: '2026-07-28 00:43:24',
          endWindow: '2026-07-28 00:49:36',
          strikeStatus: 1,
          weapons: null as any,
        },
        {
          receiveId: '6a6037d76a3f9e9695ef4716',
          receiveName: '俄勒冈Oregon',
          peakWindow: '2026-07-28 02:17:28',
          endWindow: '2026-07-28 02:23:20',
          strikeStatus: 1,
          weapons: null as any,
        },
        {
          receiveId: '6a66cf0f1ce9af52c9cd82b1',
          receiveName: '夏威夷Kapolei',
          peakWindow: '2026-07-28 05:41:52',
          endWindow: '2026-07-28 05:47:46',
          strikeStatus: 1,
          weapons: null as any,
        },
        {
          receiveId: '6a66cf9e1ce9af52c9cd82b2',
          receiveName: '爱尔兰Ireland',
          peakWindow: '2026-07-28 11:40:48',
          endWindow: '2026-07-28 11:44:57',
          strikeStatus: 1,
          weapons: null as any,
        },
      ],
    },
    {
      norad: 57693,
      name: 'CAPELLA-11',
      satType: '地球观测',
      delayMin: 2788.7,
      satelliteStatus: 1,
      weapons: [
        {
          id: '2',
          name: 'ASAT导弹基地',
          country: '中国',
          type: '动能',
          latitude: 20.017,
          longitude: 110.349,
          range: 1500.0,
        },
      ],
      stationWindows: [
        {
          receiveId: '6a6037d76a3f9e9695ef4716',
          receiveName: '俄勒冈Oregon',
          peakWindow: '2026-07-28 01:30:18',
          endWindow: '2026-07-28 01:38:27',
          strikeStatus: 1,
          weapons: null as any,
        },
        {
          receiveId: '6a66d00a1ce9af52c9cd82b3',
          receiveName: '澳大利亚达博',
          peakWindow: '2026-07-28 03:19:06',
          endWindow: '2026-07-28 03:27:09',
          strikeStatus: 1,
          weapons: null as any,
        },
        {
          receiveId: '6a66cf0f1ce9af52c9cd82b1',
          receiveName: '夏威夷Kapolei',
          peakWindow: '2026-07-28 03:23:28',
          endWindow: '2026-07-28 03:30:37',
          strikeStatus: 1,
          weapons: null as any,
        },
        {
          receiveId: '6a66cf9e1ce9af52c9cd82b2',
          receiveName: '爱尔兰Ireland',
          peakWindow: '2026-07-28 06:15:47',
          endWindow: '2026-07-28 06:23:15',
          strikeStatus: 1,
          weapons: null as any,
        },
      ],
    },
  ],
  stationRelationList: {
    receiveObjList: [
      {
        receiveId: '6a66d27f1ce9af52c9cd82b9',
        receiveName: '加拿大伊努维克',
        receiveLatLon: '68.350,133.500',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d48f1ce9af52c9cd82bb',
        receiveName: '加州特拉西',
        receiveLatLon: '37.760,121.430',
        receiveStatus: 0,
      },
      {
        receiveId: '6a6037d76a3f9e9695ef4716',
        receiveName: '俄勒冈Oregon',
        receiveLatLon: '45.210,123.110',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d1e61ce9af52c9cd82b7',
        receiveName: '新西兰阿瓦鲁阿',
        receiveLatLon: '46.540,168.220',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66cf9e1ce9af52c9cd82b2',
        receiveName: '爱尔兰Ireland',
        receiveLatLon: '53.300,8.150',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d1971ce9af52c9cd82b6',
        receiveName: '智利蓬塔阿雷纳斯',
        receiveLatLon: '53.160,70.910',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d00a1ce9af52c9cd82b3',
        receiveName: '澳大利亚达博',
        receiveLatLon: '32.250,148.610',
        receiveStatus: 1,
      },
      {
        receiveId: '6a66d0dd1ce9af52c9cd82b4',
        receiveName: '斯瓦尔巴SvalSat',
        receiveLatLon: '78.223,15.620',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66cf0f1ce9af52c9cd82b1',
        receiveName: '夏威夷Kapolei',
        receiveLatLon: '21.3368,158.0900',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d2391ce9af52c9cd82b8',
        receiveName: '南非开普敦',
        receiveLatLon: '33.970,18.420',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d4011ce9af52c9cd82ba',
        receiveName: '美国蒙大拿',
        receiveLatLon: '45.680,111.040',
        receiveStatus: 0,
      },
      {
        receiveId: '6a66d13d1ce9af52c9cd82b5',
        receiveName: '南极TrollSat',
        receiveLatLon: '72.010,2.530',
        receiveStatus: 0,
      },
    ],
    stationObjList: [
      {
        stationId: '6a66d7d71ce9af52c9cd82bc',
        stationName: '亚马逊AWS北美云集群',
        stationLatLon: '37.7751,122.4194',
        stationStatus: 0,
      },
    ],
    relations: [
      { from: '6a6037d76a3f9e9695ef4716', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66cf0f1ce9af52c9cd82b1', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66cf9e1ce9af52c9cd82b2', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d00a1ce9af52c9cd82b3', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d0dd1ce9af52c9cd82b4', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d13d1ce9af52c9cd82b5', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d1971ce9af52c9cd82b6', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d1e61ce9af52c9cd82b7', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d2391ce9af52c9cd82b8', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d27f1ce9af52c9cd82b9', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d4011ce9af52c9cd82ba', to: '6a66d7d71ce9af52c9cd82bc' },
      { from: '6a66d48f1ce9af52c9cd82bb', to: '6a66d7d71ce9af52c9cd82bc' },
    ],
  },
  battleMatrixList: [],
}

/**
 * 注册 AntV G6 自定义边 `struck-cubic`
 *
 * 功能：
 * - 绘制 Layer 1 -> Layer 2 -> Layer 3 的平滑平滑三层连接曲线。
 * - 当边处于打击/毁伤状态 (isStruck === true) 时，自动在连线中点位置绘制红色 ✖ 徽章。
 */
const registerCustomG6Edge = () => {
  try {
    G6.registerEdge(
      'struck-cubic',
      {
        draw(cfg: any, group: any) {
          const startPoint = cfg.startPoint
          const endPoint = cfg.endPoint
          const hgap = Math.abs(endPoint.y - startPoint.y) * 0.5
          const path = [
            ['M', startPoint.x, startPoint.y],
            ['C', startPoint.x, startPoint.y + hgap, endPoint.x, endPoint.y - hgap, endPoint.x, endPoint.y],
          ]

          const stroke = cfg.style?.stroke || '#00e1ff'
          const lineDash = cfg.style?.lineDash

          const shape = group.addShape('path', {
            attrs: {
              path,
              stroke,
              lineWidth: cfg.style?.lineWidth || 2,
              lineDash,
              endArrow: cfg.style?.endArrow,
            },
            name: 'path-shape',
          })

          // 打击/毁伤连线，在中点绘制红色 ✖ 徽章
          if (cfg.isStruck) {
            const midX = (startPoint.x + endPoint.x) / 2
            const midY = (startPoint.y + endPoint.y) / 2

            // 红色圆形底图
            group.addShape('circle', {
              attrs: {
                x: midX,
                y: midY,
                r: 9,
                fill: '#ff4d4f',
                stroke: '#ffffff',
                lineWidth: 1.5,
                shadowColor: 'rgba(255, 77, 79, 0.6)',
                shadowBlur: 8,
              },
              name: 'x-bg',
            })

            // ❌ 文本符
            group.addShape('text', {
              attrs: {
                x: midX,
                y: midY,
                text: '✖',
                fontSize: 10,
                fontWeight: 'bold',
                fill: '#ffffff',
                textAlign: 'center',
                textBaseline: 'middle',
              },
              name: 'x-text',
            })
          }

          return shape
        },
      },
      'cubic-vertical'
    )
  } catch (err) {
    // 允许重复注册场景吃掉注册警告
  }
}

/**
 * [功能说明]
 * 调用后端 API 获取算法矩阵数据，失败时使用 demoMatrixData 兜底。
 */
const fetchMatrixData = async () => {
  loading.value = true
  try {
    const currentTaskIdStr = String(store.activedTask?.id || 'scen-001')
    const matrixRes = await getMatrixList({
      norad: 57693,
      taskId: currentTaskIdStr,
      intensityLevel: currentIntensity.value,
    })

    if (matrixRes && matrixRes.code === 200 && matrixRes.data) {
      matrixData.value = matrixRes.data
    } else {
      matrixData.value = demoMatrixData
    }
  } catch (err: any) {
    console.warn('调用后端算法矩阵接口提示，改用兜底展示数据:', err)
    matrixData.value = demoMatrixData
  } finally {
    loading.value = false
    nextTick(() => {
      initOrUpdateGraph()
      initTimelineBounds()
    })
  }
}

/**
 * [功能说明]
 * 切换交战烈度
 */
const handleIntensityChange = (level: IntensityLevelType) => {
  if (currentIntensity.value === level) return
  currentIntensity.value = level
  fetchMatrixData()
}

// ==================== 时间轴算法与转换函数 ====================

/**
 * 解析时间字符串为 Unix 毫秒时间戳
 */
const parseToTimestamp = (timeStr: string): number => {
  if (!timeStr) return Date.now()
  const d = new Date(timeStr.replace(/-/g, '/'))
  return isNaN(d.getTime()) ? Date.now() : d.getTime()
}

/**
 * 格式化时间戳为 YY-MM-DD HH:mm:ss
 */
const formatTimeStr = (ts: number): string => {
  if (!ts) return ''
  const d = new Date(ts)
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * [功能说明]
 * 提取所有过境/打击窗口，按照开始时间由早到晚升序排列。
 *
 * 需求 6：时间轴的开始和结束时间分别是 第一个卫星过境地面站的开始时间 ---》最后一个卫星过境地面站结束时间。
 */
const allWindowsList = computed<WindowItemWrapper[]>(() => {
  if (!matrixData.value) return []
  const data = matrixData.value
  const list: WindowItemWrapper[] = []
  const satMap = new Map<number, string>()

  ;(data.initMatrixList || []).forEach((s) => satMap.set(s.norad, s.name))
  ;(data.satelliteMatrixList || []).forEach((s) => satMap.set(s.norad, s.name))

  // 1. 从 satelliteMatrixList 提取 (包含打击状态 strikeStatus)
  const satMatrixList = data.satelliteMatrixList || []
  satMatrixList.forEach((sat) => {
    const windows = sat.stationWindows || []
    windows.forEach((win, index) => {
      const startTs = parseToTimestamp(win.peakWindow)
      const endTs = parseToTimestamp(win.endWindow)
      list.push({
        id: `win-sat-${sat.norad}-${win.receiveId}-${index}`,
        satName: sat.name || satMap.get(sat.norad) || `Sat-${sat.norad}`,
        satNorad: sat.norad,
        receiveName: win.receiveName || win.receiveId,
        receiveId: win.receiveId,
        startTime: win.peakWindow,
        endTime: win.endWindow,
        startTimeShort: win.peakWindow ? win.peakWindow.split(' ')[1] || win.peakWindow : '',
        endTimeShort: win.endWindow ? win.endWindow.split(' ')[1] || win.endWindow : '',
        startTimestamp: startTs,
        endTimestamp: endTs,
        strikeStatus: win.strikeStatus === 1 || sat.satelliteStatus === 1 ? 1 : 0,
        delayMin: win.delayMin || sat.delayMin,
        weapons: win.weapons || sat.weapons,
      })
    })
  })

  // 2. 补充 initMatrixList 中独有的过境窗口
  const initMatrixList = data.initMatrixList || []
  initMatrixList.forEach((sat) => {
    const windows = sat.initWindows || []
    windows.forEach((win, index) => {
      const winId = `win-init-${sat.norad}-${win.receiveId}-${index}`
      const exists = list.some(
        (item) => item.satNorad === sat.norad && item.receiveId === win.receiveId && item.startTime === win.peakWindow
      )
      if (!exists) {
        const startTs = parseToTimestamp(win.peakWindow)
        const endTs = parseToTimestamp(win.endWindow)
        list.push({
          id: winId,
          satName: sat.name,
          satNorad: sat.norad,
          receiveName: win.receiveName || win.receiveId,
          receiveId: win.receiveId,
          startTime: win.peakWindow,
          endTime: win.endWindow,
          startTimeShort: win.peakWindow ? win.peakWindow.split(' ')[1] || win.peakWindow : '',
          endTimeShort: win.endWindow ? win.endWindow.split(' ')[1] || win.endWindow : '',
          startTimestamp: startTs,
          endTimestamp: endTs,
          strikeStatus: 0,
        })
      }
    })
  })

  // 按过境开始时间从早到晚进行升序排序
  list.sort((a, b) => a.startTimestamp - b.startTimestamp)
  return list
})

/**
 * 时间轴边界 (起始时间戳与结束时间戳)
 */
const minTimestamp = computed(() => {
  if (allWindowsList.value.length === 0) return Date.now()
  return Math.min(...allWindowsList.value.map((w) => w.startTimestamp))
})

const maxTimestamp = computed(() => {
  if (allWindowsList.value.length === 0) return Date.now() + 3600 * 1000
  return Math.max(...allWindowsList.value.map((w) => w.endTimestamp))
})

const timeRangeText = computed(() => {
  return {
    start: formatTimeStr(minTimestamp.value),
    end: formatTimeStr(maxTimestamp.value),
  }
})

const formattedCurrentTime = computed(() => {
  return formatTimeStr(currentTimestamp.value)
})

/**
 * 初始化时间轴当前时间为最小值
 */
const initTimelineBounds = () => {
  currentTimestamp.value = minTimestamp.value
  currentTimeProgress.value = 0
}

/**
 * 判断窗口在当前推演时刻是否处于活跃过境状态
 */
const isWindowActiveAtCurrentTime = (win: WindowItemWrapper) => {
  return currentTimestamp.value >= win.startTimestamp && currentTimestamp.value <= win.endTimestamp
}

/**
 * 时间轴 Slider 变动处理
 */
const handleSliderChange = (val: number) => {
  const range = maxTimestamp.value - minTimestamp.value
  if (range > 0) {
    currentTimestamp.value = minTimestamp.value + (val / 100) * range
    highlightActiveElements()
  }
}

const formatSliderTooltip = (val: number) => {
  const range = maxTimestamp.value - minTimestamp.value
  const ts = minTimestamp.value + (val / 100) * range
  return formatTimeStr(ts)
}

/**
 * 播放 / 暂停推演
 */
const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (currentTimestamp.value >= maxTimestamp.value) {
      currentTimestamp.value = minTimestamp.value
    }
    startPlaybackTimer()
  } else {
    stopPlaybackTimer()
  }
}

const startPlaybackTimer = () => {
  stopPlaybackTimer()
  playTimer = setInterval(() => {
    const totalSpan = maxTimestamp.value - minTimestamp.value
    if (totalSpan <= 0) return

    // 每次递增 0.5% 的时间跨度，乘以倍速
    const step = (totalSpan / 200) * playSpeed.value
    currentTimestamp.value += step

    if (currentTimestamp.value >= maxTimestamp.value) {
      currentTimestamp.value = maxTimestamp.value
      currentTimeProgress.value = 100
      isPlaying.value = false
      stopPlaybackTimer()
    } else {
      currentTimeProgress.value = ((currentTimestamp.value - minTimestamp.value) / totalSpan) * 100
    }
    highlightActiveElements()
  }, 300)
}

const stopPlaybackTimer = () => {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

const resetTimeline = () => {
  isPlaying.value = false
  stopPlaybackTimer()
  initTimelineBounds()
  selectedWindowId.value = null
  highlightActiveElements()
}

const jumpToStart = () => {
  currentTimestamp.value = minTimestamp.value
  currentTimeProgress.value = 0
  highlightActiveElements()
}

const jumpToEnd = () => {
  currentTimestamp.value = maxTimestamp.value
  currentTimeProgress.value = 100
  highlightActiveElements()
}

/**
 * 点击单个时间轴窗口卡片，高亮 G6 画布中对应的节点与边
 */
const selectWindowItem = (win: WindowItemWrapper) => {
  selectedWindowId.value = win.id
  currentTimestamp.value = win.startTimestamp
  const totalSpan = maxTimestamp.value - minTimestamp.value
  if (totalSpan > 0) {
    currentTimeProgress.value = ((win.startTimestamp - minTimestamp.value) / totalSpan) * 100
  }

  if (!graph) return

  // 高亮对应的 Satellite 节点、Ground Station 节点及 Edge
  const satId = `sat-${win.satNorad}`
  const recId = win.receiveId

  graph.getNodes().forEach((node: any) => {
    const id = node.get('id')
    if (id === satId || id === recId) {
      graph.setItemState(node, 'highlight', true)
    } else {
      graph.setItemState(node, 'highlight', false)
    }
  })

  graph.getEdges().forEach((edge: any) => {
    const edgeId = edge.get('id')
    if (edgeId.includes(satId) && edgeId.includes(recId)) {
      graph.setItemState(edge, 'highlight', true)
    } else {
      graph.setItemState(edge, 'highlight', false)
    }
  })

  // 强制滚动居中当前点击选中的窗口卡片
  scrollToActiveCard(true)
}

/**
 * 根据当前推演时刻高亮活跃通信与毁伤链路
 */
const highlightActiveElements = () => {
  if (!graph) return
  const activeWins = allWindowsList.value.filter((w) => isWindowActiveAtCurrentTime(w))
  const activeEdgeKeys = new Set<string>()
  const activeNodeIds = new Set<string>()

  activeWins.forEach((w) => {
    const satId = `sat-${w.satNorad}`
    activeNodeIds.add(satId)
    activeNodeIds.add(w.receiveId)
    activeEdgeKeys.add(`${satId}::${w.receiveId}`)
  })

  graph.getEdges().forEach((edge: any) => {
    const model = edge.getModel()
    const key = `${model.source}::${model.target}`
    if (activeEdgeKeys.has(key)) {
      graph.setItemState(edge, 'active', true)
    } else {
      graph.setItemState(edge, 'active', false)
    }
  })

  graph.getNodes().forEach((node: any) => {
    const id = node.get('id')
    if (activeNodeIds.has(id)) {
      graph.setItemState(node, 'active', true)
    } else {
      graph.setItemState(node, 'active', false)
    }
  })

  // 时间轴推进时自动向右平滑滚动卡片列表条
  scrollToActiveCard()
}

// ==================== G6 拓扑构建与布局算法 ====================

// 统计看板计算属性
const satNodeCount = ref(0)
const receiveNodeCount = ref(0)
const stationNodeCount = ref(0)
const normalLinkCount = ref(0)
const struckLinkCount = ref(0)

/**
 * 构建 3 层 AntV G6 图数据 (Layer 1 卫星 -> Layer 2 地面站 -> Layer 3 数据中心)
 */
const buildG6GraphData = () => {
  if (!matrixData.value) return { nodes: [], edges: [] }
  const data = matrixData.value

  const nodes: any[] = []
  const edges: any[] = []
  const nodeSet = new Set<string>()

  // 1. Layer 1: 卫星层 (Satellites)
  const satMap = new Map<number, { norad: number; name: string; satType: string; status: number }>()
  ;(data.initMatrixList || []).forEach((s) => {
    satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: 0 })
  })
  ;(data.satelliteMatrixList || []).forEach((s) => {
    satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: s.satelliteStatus || 0 })
  })

  const satList = Array.from(satMap.values())
  satNodeCount.value = satList.length

  // 2. Layer 2: 地面接收站层 (Ground Stations)
  // 当 receiveStatus === 1 时表示接收站受毁伤/打击，根据视图模式汇总状态
  const receiveMap = new Map<string, { receiveId: string; receiveName: string; status: number }>()
  const relLists = currentViewMode.value === 'PRE_STRIKE'
    ? [data.initRelationList].filter(Boolean)
    : [data.stationRelationList, data.initRelationList].filter(Boolean)

  relLists.forEach((rl) => {
    ;(rl.receiveObjList || []).forEach((rec) => {
      const recStatus = currentViewMode.value === 'PRE_STRIKE' ? 0 : (rec.receiveStatus || 0)
      if (!receiveMap.has(rec.receiveId)) {
        receiveMap.set(rec.receiveId, {
          receiveId: rec.receiveId,
          receiveName: rec.receiveName || rec.receiveId,
          status: recStatus,
        })
      } else {
        const existing = receiveMap.get(rec.receiveId)!
        if (recStatus === 1) {
          existing.status = 1
        }
      }
    })
  })
  const receiveList = Array.from(receiveMap.values())
  receiveNodeCount.value = receiveList.length

  // 3. Layer 3: 中心云数据中心层 (Data Centers)
  // 当 stationStatus === 1 时表示数据中心受毁伤/打击，根据视图模式汇总状态
  const stationMap = new Map<string, { stationId: string; stationName: string; status: number }>()
  relLists.forEach((rl) => {
    ;(rl.stationObjList || []).forEach((st) => {
      const stStatus = currentViewMode.value === 'PRE_STRIKE' ? 0 : (st.stationStatus || 0)
      if (!stationMap.has(st.stationId)) {
        stationMap.set(st.stationId, {
          stationId: st.stationId,
          stationName: st.stationName || st.stationId,
          status: stStatus,
        })
      } else {
        const existing = stationMap.get(st.stationId)!
        if (stStatus === 1) {
          existing.status = 1
        }
      }
    })
  })
  const stationList = Array.from(stationMap.values())
  stationNodeCount.value = stationList.length

  // 计算节点在 3 层的坐标布局 (Layer 1: y=60, Layer 2: y=200, Layer 3: y=340)
  const containerW = g6Container.value ? g6Container.value.clientWidth : 950
  const startX = 30
  const availableW = Math.max(containerW - startX - 30, 400)

  // 排布 Layer 1 卫星
  satList.forEach((sat, i) => {
    const id = `sat-${sat.norad}`
    nodeSet.add(id)
    const x = startX + (availableW / (satList.length + 1)) * (i + 1)
    const isStruck = sat.status === 1
    const bgFill = isStruck ? '#2d1215' : '#092638'
    const strokeColor = isStruck ? '#ff4d4f' : '#00e1ff'
    const textColor = isStruck ? '#ff7875' : '#e6f7ff'

    nodes.push({
      id,
      label: `${sat.name}\n[${sat.satType}]`,
      layer: 1,
      x,
      y: 90,
      type: 'rect',
      size: [130, 42],
      anchorPoints: [
        [0.5, 0], // 0: 上边中心
        [0.5, 1], // 1: 下边中心
      ],
      style: {
        fill: bgFill,
        stroke: strokeColor,
        lineWidth: 2,
        radius: 6,
        shadowColor: isStruck ? 'rgba(255, 77, 79, 0.4)' : 'rgba(0, 225, 255, 0.3)',
        shadowBlur: 10,
      },
      labelCfg: {
        style: {
          fill: textColor,
          fontSize: 12,
          fontWeight: 600,
        },
      },
      stateStyles: {
        active: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
          shadowColor: strokeColor,
          shadowBlur: 16,
        },
        highlight: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
          shadowColor: strokeColor,
          shadowBlur: 20,
        },
        hover: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 2.5,
        },
        selected: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
        },
        inactive: {
          fill: bgFill,
          stroke: strokeColor,
          opacity: 0.6,
        },
      },
    })
  })

  // 排布 Layer 2 地面站
  receiveList.forEach((rec, i) => {
    nodeSet.add(rec.receiveId)
    const x = startX + (availableW / (receiveList.length + 1)) * (i + 1)
    // [逻辑说明] receiveStatus = 1 时，把接收站的边框颜色改为红色 (#ff4d4f)
    const isStruck = rec.status === 1
    const bgFill = isStruck ? '#2d1215' : '#0a2e2b'
    const strokeColor = isStruck ? '#ff4d4f' : '#00f2fe'
    const textColor = isStruck ? '#ff7875' : '#e6f7ff'

    nodes.push({
      id: rec.receiveId,
      label: rec.receiveName,
      layer: 2,
      x,
      y: 280,
      type: 'rect',
      size: [120, 38],
      anchorPoints: [
        [0.5, 0], // 0: 上边中心
        [0.5, 1], // 1: 下边中心
      ],
      style: {
        fill: bgFill,
        stroke: strokeColor,
        lineWidth: isStruck ? 2.2 : 1.8,
        radius: 6,
        shadowColor: isStruck ? 'rgba(255, 77, 79, 0.4)' : undefined,
        shadowBlur: 10,
      },
      labelCfg: {
        style: {
          fill: textColor,
          fontSize: 11,
          fontWeight: 500,
        },
      },
      stateStyles: {
        active: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
          shadowColor: strokeColor,
          shadowBlur: 16,
        },
        highlight: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
          shadowColor: strokeColor,
          shadowBlur: 20,
        },
        hover: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 2.5,
        },
        selected: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
        },
        inactive: {
          fill: bgFill,
          stroke: strokeColor,
          opacity: 0.6,
        },
      },
    })
  })

  // 排布 Layer 3 数据中心
  stationList.forEach((st, i) => {
    nodeSet.add(st.stationId)
    const x = startX + (availableW / (stationList.length + 1)) * (i + 1)
    // [逻辑说明] stationStatus = 1 时，把数据中心的边框颜色改为红色 (#ff4d4f)
    const isStruck = st.status === 1
    const bgFill = isStruck ? '#2d1215' : '#10244c'
    const strokeColor = isStruck ? '#ff4d4f' : '#3b82f6'
    const textColor = isStruck ? '#ff7875' : '#93c5fd'

    nodes.push({
      id: st.stationId,
      label: st.stationName,
      layer: 3,
      x,
      y: 470,
      type: 'rect',
      size: [170, 44],
      anchorPoints: [
        [0.5, 0], // 0: 上边中心
        [0.5, 1], // 1: 下边中心
      ],
      style: {
        fill: bgFill,
        stroke: strokeColor,
        lineWidth: isStruck ? 2.2 : 2,
        radius: 8,
        shadowColor: isStruck ? 'rgba(255, 77, 79, 0.4)' : 'rgba(59, 130, 246, 0.3)',
        shadowBlur: 10,
      },
      labelCfg: {
        style: {
          fill: textColor,
          fontSize: 12,
          fontWeight: 600,
        },
      },
      stateStyles: {
        active: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
          shadowColor: strokeColor,
          shadowBlur: 16,
        },
        highlight: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
          shadowColor: strokeColor,
          shadowBlur: 20,
        },
        hover: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 2.5,
        },
        selected: {
          fill: bgFill,
          stroke: strokeColor,
          lineWidth: 3,
        },
        inactive: {
          fill: bgFill,
          stroke: strokeColor,
          opacity: 0.6,
        },
      },
    })
  })

  // ==================== 构建边 Edges (Layer 1->2 & Layer 2->3) ====================
  const edgeSet = new Set<string>()
  let normalCount = 0
  let struckCount = 0

  // 1. Layer 1 -> Layer 2 边 (卫星 -> 地面站)
  if (currentViewMode.value === 'PRE_STRIKE') {
    // 打击前: 取 initMatrixList
    ;(data.initMatrixList || []).forEach((sat) => {
      const satId = `sat-${sat.norad}`
      ;(sat.initWindows || []).forEach((win) => {
        const edgeId = `edge-${satId}-${win.receiveId}`
        if (!edgeSet.has(edgeId) && nodeSet.has(satId) && nodeSet.has(win.receiveId)) {
          edgeSet.add(edgeId)
          normalCount++
          edges.push({
            id: edgeId,
            source: satId,
            target: win.receiveId,
            sourceAnchor: 1, // 源节点下边中心
            targetAnchor: 0, // 目标节点上边中心
            type: 'struck-cubic',
            isStruck: false,
            style: {
              stroke: '#00e1ff',
              lineWidth: 2,
            },
            label: `过境: ${win.peakWindow.split(' ')[1] || ''}`,
            labelCfg: {
              style: { fill: '#7dd3fc', fontSize: 10, background: { fill: '#081325', padding: [2, 4], radius: 3 } },
            },
          })
        }
      })
    })
  } else {
    // 全景对比 / 打击后: 取 satelliteMatrixList
    ;(data.satelliteMatrixList || []).forEach((sat) => {
      const satId = `sat-${sat.norad}`
      ;(sat.stationWindows || []).forEach((win) => {
        const edgeId = `edge-${satId}-${win.receiveId}`
        if (!edgeSet.has(edgeId) && nodeSet.has(satId) && nodeSet.has(win.receiveId)) {
          edgeSet.add(edgeId)
          const isStruck = win.strikeStatus === 1 || sat.satelliteStatus === 1
          if (isStruck) struckCount++
          else normalCount++

          edges.push({
            id: edgeId,
            source: satId,
            target: win.receiveId,
            sourceAnchor: 1, // 源节点下边中心
            targetAnchor: 0, // 目标节点上边中心
            type: 'struck-cubic',
            isStruck,
            style: {
              stroke: isStruck ? '#ff4d4f' : '#00e1ff',
              lineWidth: isStruck ? 2.2 : 2,
              lineDash: isStruck ? [6, 4] : undefined,
            },
            label: isStruck ? `✖ 打击中断 (延时+${sat.delayMin || 45}m)` : `正常通信`,
            labelCfg: {
              style: {
                fill: isStruck ? '#ff4d4f' : '#38bdf8',
                fontSize: 10,
                fontWeight: isStruck ? 600 : 400,
                background: { fill: isStruck ? '#300a0e' : '#081325', padding: [2, 4], radius: 3 },
              },
            },
          })
        }
      })
    })
  }

  // 2. Layer 2 -> Layer 3 边 (地面站 -> 数据中心)
  const initRels = data.initRelationList?.relations || []
  const postRels = data.stationRelationList?.relations || []
  const postRelSet = new Set(postRels.map((r) => `${r.from}::${r.to}`))

  initRels.forEach((rel) => {
    const edgeId = `edge-${rel.from}-${rel.to}`
    if (!edgeSet.has(edgeId) && nodeSet.has(rel.from) && nodeSet.has(rel.to)) {
      edgeSet.add(edgeId)

      // 判断该链路在打击后是否丢失中断
      const isSevered = currentViewMode.value !== 'PRE_STRIKE' && !postRelSet.has(`${rel.from}::${rel.to}`)
      if (isSevered) struckCount++
      else normalCount++

      edges.push({
        id: edgeId,
        source: rel.from,
        target: rel.to,
        sourceAnchor: 1, // 源节点下边中心
        targetAnchor: 0, // 目标节点上边中心
        type: 'struck-cubic',
        isStruck: isSevered,
        style: {
          stroke: isSevered ? '#ff4d4f' : '#3b82f6',
          lineWidth: isSevered ? 2.2 : 2,
          lineDash: isSevered ? [6, 4] : undefined,
        },
        label: isSevered ? `✖ 骨干链路打压切断` : `骨干传输`,
        labelCfg: {
          style: {
            fill: isSevered ? '#ff4d4f' : '#60a5fa',
            fontSize: 10,
            background: { fill: isSevered ? '#300a0e' : '#061938', padding: [2, 4], radius: 3 },
          },
        },
      })
    }
  })

  normalLinkCount.value = normalCount
  struckLinkCount.value = struckCount

  return { nodes, edges }
}

/**
 * 初始化或更新 AntV G6 画布
 */
const initOrUpdateGraph = () => {
  if (!g6Container.value) return

  registerCustomG6Edge()
  const width = g6Container.value.clientWidth || 1100
  const height = g6Container.value.clientHeight || 560

  const data = buildG6GraphData()

  if (!graph) {
    graph = new G6.Graph({
      container: g6Container.value,
      width,
      height,
      fitView: true,
      fitViewPadding: [20, 40, 20, 40],
      modes: {
        default: ['activate-relations'],
      },
      defaultNode: {
        type: 'rect',
      },
      defaultEdge: {
        type: 'struck-cubic',
      },
      nodeStateStyles: {
        active: {
          lineWidth: 3,
          shadowBlur: 15,
        },
        highlight: {
          lineWidth: 3,
          shadowBlur: 18,
        },
        hover: {
          lineWidth: 2.5,
        },
        selected: {
          lineWidth: 3,
        },
        inactive: {
          opacity: 0.75,
        },
      },
      edgeStateStyles: {
        active: {
          lineWidth: 3.5,
          shadowColor: '#00e1ff',
          shadowBlur: 10,
        },
        highlight: {
          lineWidth: 3.5,
          shadowColor: '#00e1ff',
          shadowBlur: 12,
        },
        inactive: {
          opacity: 0.35,
        },
      },
    })
  }

  graph.data(data)
  graph.render()
}

// 监听视图模式改变重新渲染图
watch(currentViewMode, () => {
  initOrUpdateGraph()
})

onMounted(() => {
  fetchMatrixData()
  window.addEventListener('resize', initOrUpdateGraph)
})

onUnmounted(() => {
  stopPlaybackTimer()
  window.removeEventListener('resize', initOrUpdateGraph)
  if (graph) {
    graph.destroy()
    graph = null
  }
})
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.cema-g6-dashboard {
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 45px);
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.cema-header {
  height: 52px;
  background: rgba(10, 18, 34, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;

  .header-title {
    font-size: 17px;
    font-weight: 700;
    color: #00e1ff;
    letter-spacing: 1px;
  }
}

.header-center {
  display: flex;
  align-items: center;
  gap: 15px;
}

.intensity-group,
.matrix-tab-group {
  display: flex;
  align-items: center;
  background: rgba(8, 14, 26, 0.7);
  padding: 3px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.18);
}

.nav-tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 5px 13px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.25s ease;

  &:hover {
    color: #00e1ff;
  }

  &.active {
    background: linear-gradient(135deg, rgba(0, 225, 255, 0.35), rgba(0, 102, 255, 0.45));
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 0 8px rgba(0, 225, 255, 0.3);
  }

  &.tab-matrix.active {
    background: linear-gradient(135deg, rgba(255, 77, 79, 0.35), rgba(255, 120, 117, 0.45));
    box-shadow: 0 0 8px rgba(255, 77, 79, 0.3);
  }
}

.v-divider {
  width: 1px;
  height: 22px;
  background: rgba(0, 225, 255, 0.2);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #94a3b8;
  .label-text {
    margin-right: 5px;
  }
  .time-value {
    color: #00e1ff;
    font-weight: 600;
  }
}

.cema-workspace {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at 50% 50%, #0a1326 0%, #050811 100%);
}

.topo-summary-bar {
  height: 36px;
  background: rgba(13, 22, 40, 0.6);
  border-bottom: 1px solid rgba(0, 225, 255, 0.1);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 20px;
  font-size: 12px;
  color: #cbd5e1;

  .stat-badge {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot-sat {
    background: #00e1ff;
    box-shadow: 0 0 6px #00e1ff;
  }
  .dot-rec {
    background: #00f2fe;
  }
  .dot-station {
    background: #3b82f6;
  }
  .dot-normal-link {
    background: #38bdf8;
  }
  .dot-struck-link {
    background: #ff4d4f;
    box-shadow: 0 0 6px #ff4d4f;
  }

  .alert-stat {
    color: #ff7875;
  }
}

.topo-main-body {
  flex: 1;
  width: 100%;
  display: flex;
  position: relative;
  overflow: hidden;
}

.layer-sidebar {
  width: 175px;
  min-width: 175px;
  background: rgba(8, 14, 28, 0.95);
  border-right: 1px solid rgba(0, 225, 255, 0.18);
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 15px 12px;
  z-index: 20;

  .layer-sidebar-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    background: rgba(13, 24, 46, 0.85);
    border: 1px solid rgba(0, 225, 255, 0.25);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

    .layer-icon {
      font-size: 20px;
    }

    .layer-text {
      display: flex;
      flex-direction: column;
      .layer-title {
        font-size: 13px;
        font-weight: 700;
        color: #00e1ff;
      }
      .layer-sub {
        font-size: 10px;
        color: #64748b;
      }
    }

    &.layer-2-item {
      border-color: rgba(0, 242, 254, 0.3);
      .layer-title {
        color: #00f2fe;
      }
    }

    &.layer-3-item {
      border-color: rgba(59, 130, 246, 0.3);
      .layer-title {
        color: #60a5fa;
      }
    }
  }
}

.g6-chart-container {
  flex: 1;
  height: 100%;
  position: relative;
}

/* 底部时间轴样式 */
.cema-timeline-footer {
  height: 215px;
  background: rgba(9, 16, 30, 0.95);
  border-top: 1px solid rgba(0, 225, 255, 0.2);
  display: flex;
  flex-direction: column;
  padding: 10px 16px;
  gap: 8px;
}

.timeline-ctrl-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .timeline-title {
    font-size: 13px;
    font-weight: 700;
    color: #00e1ff;
    margin-right: 8px;
  }
  .time-range-text {
    font-size: 11px;
    color: #64748b;
  }

  .current-time-display {
    font-size: 12px;
    color: #94a3b8;
    .time-value {
      color: #00e1ff;
      font-weight: 700;
      font-size: 13px;
    }
  }
}

.timeline-slider-box {
  padding: 0 10px;
  :deep(.el-slider__bar) {
    background-color: #00e1ff;
  }
  :deep(.el-slider__button) {
    border-color: #00e1ff;
  }
}

.windows-cards-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 8px;
  flex: 1;
  align-items: stretch;

  &::-webkit-scrollbar {
    height: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 3px;
  }
}

.window-card {
  min-width: 260px;
  max-width: 280px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.2s ease;

  &.card-active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.14);
    box-shadow: 0 0 10px rgba(0, 225, 255, 0.25);
  }

  &.card-selected {
    border-color: #ff4d4f;
    box-shadow: 0 0 12px rgba(255, 77, 79, 0.45);
  }

  &.card-struck {
    border-color: rgba(255, 77, 79, 0.45);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;

    .win-time {
      font-size: 11px;
      color: #94a3b8;
      font-family: monospace;
    }

    .win-status-badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;

      &.badge-success {
        background: rgba(16, 185, 129, 0.2);
        color: #34d399;
      }
      &.badge-danger {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
      }
    }
  }

  .win-link-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    margin: 3px 0;

    .sat-name {
      color: #38bdf8;
      font-weight: 600;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .arrow-icon {
      color: #64748b;
    }
    .rec-name {
      color: #34d399;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .win-meta-info {
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    flex-wrap: wrap;

    .delay-tag {
      color: #fbbf24;
      background: rgba(251, 191, 36, 0.15);
      border: 1px solid rgba(251, 191, 36, 0.3);
      padding: 2px 6px;
      border-radius: 3px;
      white-space: nowrap;
      font-weight: 500;
    }

    .weapon-tag {
      color: #f87171;
      background: rgba(248, 113, 113, 0.15);
      border: 1px solid rgba(248, 113, 113, 0.3);
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 500;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
