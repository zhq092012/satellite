<template>
  <div class="cema-g6-dashboard dark-theme">
    <!-- 顶部导航与控制栏 Header -->
    <div class="cema-header">
      <div class="header-left">
        <span class="header-title glow-text">三层链路拓扑毁伤分析</span>
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
            @click="handleViewModeChange(mode.key)"
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
        <div class="stat-badge" v-if="currentSatCategory === 'RECON'">
          <span class="stat-dot dot-rec"></span>
          <span
            >地面站节点: <strong>{{ receiveNodeCount }}</strong> 个</span
          >
        </div>
        <div class="stat-badge" v-if="currentSatCategory === 'RECON'">
          <span class="stat-dot dot-station"></span>
          <span
            >数据中心: <strong>{{ stationNodeCount }}</strong> 个</span
          >
        </div>
        <div class="stat-badge" v-else>
          <span class="stat-dot dot-rec"></span>
          <span
            >通信目标: <strong>{{ store.battle?.name || '战场目标区域' }}</strong></span
          >
        </div>
        <div class="stat-badge">
          <span class="stat-dot dot-normal-link"></span>
          <span
            >正常通信链路: <strong>{{ normalLinkCount }}</strong> 条</span
          >
        </div>
        <div class="stat-badge alert-stat">
          <span class="stat-dot dot-struck-link"></span>
          <span
            >打压/中断链路: <strong>{{ struckLinkCount }}</strong> 条 (红色虚线标识)</span
          >
        </div>
      </div>

      <!-- 左右分栏主体区域 -->
      <div class="topo-main-body">
        <!-- 左侧：图层标注独立一栏 -->
        <div class="layer-sidebar">
          <template v-if="currentSatCategory === 'RECON'">
            <div class="layer-sidebar-item layer-1-item">
              <span class="layer-icon">🛰️</span>
              <div class="layer-text">
                <span class="layer-title">第一层：普通卫星</span>
                <span class="layer-sub">Ordinary Satellites</span>
              </div>
            </div>

            <div class="layer-sidebar-item layer-2-item">
              <span class="layer-icon">🛰️</span>
              <div class="layer-text">
                <span class="layer-title">第二层：中继卫星</span>
                <span class="layer-sub">Relay Satellites</span>
              </div>
            </div>

            <div class="layer-sidebar-item layer-3-item">
              <span class="layer-icon">📡</span>
              <div class="layer-text">
                <span class="layer-title">第三层：接收站/数据中心</span>
                <span class="layer-sub">Ground & Data Layer</span>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="layer-sidebar-item layer-1-item">
              <span class="layer-icon">🛰️</span>
              <div class="layer-text">
                <span class="layer-title">第一层：通讯卫星</span>
                <span class="layer-sub">Communication Satellites</span>
              </div>
            </div>

            <div class="layer-sidebar-item layer-2-item">
              <span class="layer-icon">🎯</span>
              <div class="layer-text">
                <span class="layer-title">第二层：{{ store.battle?.name || '战场目标区域' }}</span>
                <span class="layer-sub">Target Battle Area</span>
              </div>
            </div>
          </template>
        </div>

        <!-- 右侧：G6 画布容器 (独立分栏，节点绝对不会重叠左侧) -->
        <div ref="g6Container" class="g6-chart-container" v-loading="loading"></div>
      </div>
    </div>

    <!-- 底部时间轴控制与过境窗口面板 -->
    <div class="cema-timeline-footer">
      <div class="timeline-ctrl-bar">
        <div class="ctrl-left">
          <span class="timeline-title"> <i class="el-icon-timer"></i> 打击/过境时间轴 </span>
          <span class="time-range-text"> [{{ timeRangeText.start }} ~ {{ timeRangeText.end }}] </span>
          <!-- AI: 显示当前点击选中的节点提示及重置筛选按钮 -->
          <span class="node-filter-tip" v-if="selectedNodeInfo">
            已选择节点: <strong class="glow-text-cyan">{{ selectedNodeInfo.name }}</strong> (共
            {{ displayedWindowsList.length }} 个过境/可见窗口)
            <el-button type="primary" link size="small" style="margin-left: 8px" @click="clearSelectedNode"
              >重置筛选</el-button
            >
          </span>
          <!-- AI: 通讯卫星矩阵下在底部工具栏展示打击前/打击后服务时长指标 (字段为 serviceDuration) -->
          <span class="service-duration-badge pre-strike-badge" v-if="currentSatCategory === 'COMM'">
            <span class="badge-label">打击前服务时长:</span>
            <strong class="glow-text-cyan badge-val">{{ formattedPreServiceDuration }}</strong>
          </span>
          <span class="service-duration-badge post-strike-badge" v-if="currentSatCategory === 'COMM'">
            <span class="badge-label">打击后服务时长:</span>
            <strong class="glow-text-orange badge-val">{{ formattedPostServiceDuration }}</strong>
          </span>
        </div>
      </div>

      <!-- 排序过境/打击窗口列表条 (即使无关联窗口也常驻保留底部横向滚动轴) -->
      <div ref="windowsScrollRef" class="windows-cards-scroll">
        <div v-if="displayedWindowsList.length === 0" class="empty-window-card">
          <span>暂无相关节点的过境/打击时间窗口数据</span>
        </div>
        <div
          v-else
          v-for="(win, idx) in displayedWindowsList"
          :key="win.id || idx"
          :ref="(el) => setCardRef(el, win.id)"
          class="window-card"
          :class="{
            'card-struck': win.strikeStatus === 1,
            'card-relay': win.isRelayWindow,
            'card-active': isWindowActiveAtCurrentTime(win),
            'card-selected': selectedWindowId === win.id,
          }"
          @click="selectWindowItem(win)"
        >
          <div class="card-header">
            <span class="win-time">{{ win.startTimeShort }} ~ {{ win.endTimeShort }}</span>
            <span
              class="win-status-badge"
              :class="win.isRelayWindow ? 'badge-relay' : win.strikeStatus === 1 ? 'badge-danger' : 'badge-success'"
            >
              {{ win.isRelayWindow ? '中继可见' : win.strikeStatus === 1 ? '受毁伤打压' : '正常过境' }}
            </span>
          </div>

          <div class="card-body">
            <div class="win-link-info">
              <span class="sat-name" :title="win.satName">🛰️ {{ win.satName }}</span>
              <span class="arrow-icon">➔</span>
              <span class="rec-name" :title="win.receiveName"
                >{{ win.isRelayWindow ? '🛰️' : '📡' }} {{ win.receiveName }}</span
              >
            </div>

            <div class="win-meta-info" v-if="win.strikeStatus === 1">
              <span class="delay-tag" v-if="win.delayMin">延时: +{{ win.delayMin }}m</span>
              <span class="weapon-tag" v-if="win.weapons && win.weapons.length > 0" :title="win.weapons[0].name">
                🎯 {{ win.weapons[0].name }} ({{ win.weapons[0].type }})
              </span>
            </div>
            <div class="win-meta-info" v-else-if="win.isRelayWindow">
              <span class="relay-tag">星间中继过境窗口</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, watch, nextTick } from 'vue'
import G6 from '@antv/g6'
import { useLayoutStore } from '@/store/modules/layout'
import { getReconnaissanceAttackMatrix } from '@/api/electronic'
import type { MatrixResult, Weapon } from '@/api/electronic'
import type { FuncType } from '@/types/electronic'

defineOptions({
  name: 'ElectronicWarfareG6',
})
const store = useLayoutStore()

// [类型用途]
// 交战烈度选项类型定义
type IntensityLevelType = '高烈度' | '中烈度' | '低烈度'
const intensityOptions: IntensityLevelType[] = ['低烈度', '中烈度', '高烈度']

// [变量用途]
// 当前选中的交战烈度
const currentIntensity = ref<IntensityLevelType>('低烈度')

// [类型用途]
// 拓扑视图显示模式选项
type ViewModeType = 'COMBINED' | 'PRE_STRIKE' | 'POST_STRIKE'

// [变量用途]
// 拓扑视图切换选项列表
const viewModeOptions: { key: ViewModeType; name: string }[] = [
  { key: 'COMBINED', name: '前后全量对比' },
  { key: 'PRE_STRIKE', name: '打击前拓扑' },
  { key: 'POST_STRIKE', name: '打击后拓扑' },
]

// [变量用途]
// 当前选中的拓扑视图模式
const currentViewMode = ref<ViewModeType>('COMBINED')

// [变量用途]
// 后端算法接口返回的矩阵数据对象
const matrixData = ref<MatrixResult | null>(null)

/**
 * [功能说明]
 * 根据算法矩阵数据或当前选中的卫星系列，自动推导出卫星分类类别 ('COMM' | 'RECON')。
 *
 * [处理规则]
 * 1. 优先提取 matrixData 中携带的 satCategory / category / func_type 属性。
 * 2. 检查 initMatrixList 中首个卫星节点的 satType 是否包含 "通信"/"通讯"/"COMM"。
 * 3. 检查 store.selectedSatSeries 系列名称中是否包含 "通信"/"通讯"/"COMM"。
 * 4. 若以上条件均不满足，默认判定为侦察卫星 'RECON'。
 *
 * @returns FuncType 对应的分类标识 ('COMM' | 'RECON')
 */
const currentSatCategory = computed<FuncType>(() => {
  const data = matrixData.value as
    | (MatrixResult & { satCategory?: string; category?: string; func_type?: string })
    | null
  if (data) {
    if (data.satCategory) return data.satCategory as FuncType
    if (data.category) return data.category as FuncType
    if (data.func_type) return data.func_type as FuncType

    if (Array.isArray(data.initMatrixList) && data.initMatrixList.length > 0) {
      const firstSat = data.initMatrixList[0]
      const satType = firstSat?.satType || ''
      if (satType.includes('通信') || satType.includes('通讯') || satType.toUpperCase().includes('COMM')) {
        return 'COMM'
      }
    }
  }

  const series = store.selectedSatSeries || ''
  if (series.includes('通信') || series.includes('通讯') || series.toUpperCase().includes('COMM')) {
    return 'COMM'
  }

  return 'RECON'
})

// [变量用途]
// 数据加载状态标记
const loading = ref(false)

// [变量用途]
// G6 图形 Canvas 容器 DOM ref
const g6Container = ref<HTMLDivElement | null>(null)

// [变量用途]
// AntV G6 Graph 实例引用
let graph: any = null

/**
 * [类型用途]
 * 拓扑图中点击选中的节点数据描述 (支持普通卫星、中继卫星、地面接收站、中心云数据中心)
 */
interface SelectedNodeMeta {
  id: string
  name: string
  type: 'sat' | 'relay' | 'receive' | 'station'
  norad?: number
  receiveId?: string
  stationId?: string
}

// [变量用途]
// 当前点击选中的拓扑节点
const selectedNodeInfo = ref<SelectedNodeMeta | null>(null)

// ==================== 时间轴相关变量定义 ====================

// [类型用途]
// 时间轴过境/打击/中继窗口统一包装结构
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
  /** 是否为星间中继过境时间窗口 */
  isRelayWindow?: boolean
  /** 星间中继目标中继卫星 NORAD */
  relayNorad?: number
}

// [变量用途]
// 选中的时间窗口 ID
const selectedWindowId = ref<string | null>(null)

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
      return Math.abs(curr.startTimestamp - currentTimestamp.value) <
        Math.abs(prev.startTimestamp - currentTimestamp.value)
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

/**
 * [功能说明]
 * 注册 AntV G6 自定义边 `struck-cubic`
 *
 * [处理规则]
 * - 绘制 Layer 1 -> Layer 2 -> Layer 3 的平滑三层连接曲线。
 * - 当链路处于打击/毁伤状态 (isStruck === true) 时，通过红色虚线 (stroke: '#ff4d4f', lineDash: [6, 4]) 表达打压状态。
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
 * 格式化并去重卫星类型描述字符串
 *
 * [处理规则]
 * 按斜杠 / 拆分字符串，去除两端空白，使用 Set 进行去重，再重新用斜杠拼接。
 * 例: "地球观测/雷达/地球观测" -> "地球观测/雷达"
 *
 * @param typeStr 原始类型字符串
 * @returns 去重后的类型描述字符串
 */
const formatSatType = (typeStr?: string): string => {
  if (!typeStr) return ''
  const parts = typeStr
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
  const uniqueParts = Array.from(new Set(parts))
  return uniqueParts.join('/')
}

/**
 * [功能说明]
 * 调用后端 API 获取算法矩阵数据 (按 store 中的 selectedSatSeries 检索)
 */
const fetchMatrixData = async () => {
  loading.value = true
  try {
    const matrixRes = await getReconnaissanceAttackMatrix({
      taskId: store.activedTask?.id || 0,
      series: store.selectedSatSeries || '',
      intensityLevel: currentIntensity.value,
    })

    if (matrixRes && matrixRes.code === 200 && matrixRes.data) {
      matrixData.value = matrixRes.data
    }
  } catch (err: any) {
    console.warn('调用后端算法矩阵接口提示:', err)
  } finally {
    loading.value = false
    nextTick(() => {
      initOrUpdateGraph()
      initTimelineBounds()
    })
  }
}

/**
 * [监听器说明]
 * 监听 store 中选中的卫星系列和激活的任务改变，自动重新拉取矩阵数据并更新图谱
 */
watch(
  [() => store.selectedSatSeries, () => store.activedTask?.id],
  () => {
    void fetchMatrixData()
  },
  { immediate: true }
)

/**
 * [功能说明]
 * 切换交战烈度
 */
const handleIntensityChange = (level: IntensityLevelType) => {
  if (currentIntensity.value === level) return
  currentIntensity.value = level
  fetchMatrixData()
}

/**
 * [功能说明]
 * 切换拓扑显示模式 (前后全量对比 / 打击前拓扑 / 打击后拓扑)，并重新绘制 G6 拓扑图
 *
 * @param mode 拓扑视图模式 Key
 */
const handleViewModeChange = (mode: ViewModeType) => {
  if (currentViewMode.value === mode) return
  currentViewMode.value = mode
  initOrUpdateGraph()
}

/**
 * [监听器说明]
 * 监听拓扑视图显示模式变更，自动更新 G6 图谱与状态
 */
watch(currentViewMode, () => {
  initOrUpdateGraph()
})

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
 * [功能]
 * 计算打击前服务时长（字段为 serviceDuration）。
 *
 * [处理规则]
 * - 优先从后端 initMatrixList 提取选中节点或整体卫星矩阵的 serviceDuration 字段。
 * - 如果单个节点选中且存在 serviceDuration，直接使用该数值。
 * - 若无直接数值，从 initWindows 计算窗口时间差作为兜底。
 * - 若未选中单节点，累加 initMatrixList 中所有卫星的 serviceDuration。
 *
 * [副作用]
 * 无
 *
 * [异常处理]
 * 当 matrixData 为空或字段不存在时返回 0。
 *
 * [修改约束]
 * 保持字段 serviceDuration 优先，防止逻辑覆盖。
 */
const preStrikeServiceDuration = computed<number | string>(() => {
  if (!matrixData.value) return 0
  const data: any = matrixData.value

  // 如果选中了具体卫星节点
  if (selectedNodeInfo.value?.norad) {
    const norad = selectedNodeInfo.value.norad
    const initSat = (data.initMatrixList || []).find((s: any) => s.norad === norad)
    if (initSat && typeof initSat.serviceDuration !== 'undefined' && initSat.serviceDuration !== null) {
      return initSat.serviceDuration
    }
    if (initSat?.initWindows && Array.isArray(initSat.initWindows) && initSat.initWindows.length > 0) {
      const totalMs = initSat.initWindows.reduce((acc: number, win: any) => {
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return acc + Math.max(0, end - start)
      }, 0)
      return Math.round(totalMs / (1000 * 60))
    }
    return 0
  }

  // 未选中具体节点时，优先读取根节点 preStrikeServiceDuration 或 serviceDuration
  if (typeof data.preStrikeServiceDuration !== 'undefined' && data.preStrikeServiceDuration !== null) {
    return data.preStrikeServiceDuration
  }

  const initList = data.initMatrixList || []
  if (initList.length > 0) {
    let hasField = false
    const totalField = initList.reduce((acc: number, sat: any) => {
      if (typeof sat.serviceDuration !== 'undefined' && sat.serviceDuration !== null) {
        hasField = true
        return acc + Number(sat.serviceDuration)
      }
      return acc
    }, 0)
    if (hasField) return totalField

    const totalMs = initList.reduce((accSat: number, sat: any) => {
      const windows = sat.initWindows || []
      const satMs = windows.reduce((accWin: number, win: any) => {
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return accWin + Math.max(0, end - start)
      }, 0)
      return accSat + satMs
    }, 0)
    return Math.round(totalMs / (1000 * 60))
  }

  return 0
})

/**
 * [功能]
 * 计算打击后服务时长（字段为 serviceDuration）。
 *
 * [处理规则]
 * - 优先从后端 satelliteMatrixList 提取选中节点或整体卫星矩阵的 serviceDuration 字段。
 * - 如果单个节点选中且存在 serviceDuration，直接使用该数值。
 * - 若无直接数值，从 stationWindows 计算非毁伤窗口时间差作为兜底。
 * - 若未选中单节点，累加 satelliteMatrixList 中所有卫星的 serviceDuration。
 *
 * [副作用]
 * 无
 *
 * [异常处理]
 * 当 matrixData 为空或字段不存在时返回 0。
 *
 * [修改约束]
 * 保持字段 serviceDuration 优先。
 */
const postStrikeServiceDuration = computed<number | string>(() => {
  if (!matrixData.value) return 0
  const data: any = matrixData.value

  // 如果选中了具体卫星节点
  if (selectedNodeInfo.value?.norad) {
    const norad = selectedNodeInfo.value.norad
    const sat = (data.satelliteMatrixList || []).find((s: any) => s.norad === norad)
    if (sat && typeof sat.serviceDuration !== 'undefined' && sat.serviceDuration !== null) {
      return sat.serviceDuration
    }
    if (sat?.stationWindows && Array.isArray(sat.stationWindows) && sat.stationWindows.length > 0) {
      const totalMs = sat.stationWindows.reduce((acc: number, win: any) => {
        if (win.strikeStatus === 1) return acc
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return acc + Math.max(0, end - start)
      }, 0)
      return Math.round(totalMs / (1000 * 60))
    }
    return 0
  }

  // 未选中具体节点时，优先读取根节点 postStrikeServiceDuration
  if (typeof data.postStrikeServiceDuration !== 'undefined' && data.postStrikeServiceDuration !== null) {
    return data.postStrikeServiceDuration
  }

  const satList = data.satelliteMatrixList || []
  if (satList.length > 0) {
    let hasField = false
    const totalField = satList.reduce((acc: number, sat: any) => {
      if (typeof sat.serviceDuration !== 'undefined' && sat.serviceDuration !== null) {
        hasField = true
        return acc + Number(sat.serviceDuration)
      }
      return acc
    }, 0)
    if (hasField) return totalField

    const totalMs = satList.reduce((accSat: number, sat: any) => {
      const windows = sat.stationWindows || sat.initWindows || []
      const satMs = windows.reduce((accWin: number, win: any) => {
        if (win.strikeStatus === 1) return accWin
        const start = parseToTimestamp(win.peakWindow || win.startWindow || win.beginWindow || '')
        const end = parseToTimestamp(win.endWindow || '')
        return accWin + Math.max(0, end - start)
      }, 0)
      return accSat + satMs
    }, 0)
    return Math.round(totalMs / (1000 * 60))
  }

  return 0
})

/**
 * [功能]
 * 格式化服务时长数字展示 (追加 "分钟" 单位)
 *
 * @param val 原始时长数值或字符串
 * @returns 格式化后的字符串，如 "120 分钟"
 */
const formatServiceDurationText = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0 分钟'
  const num = typeof val === 'number' ? val : parseFloat(String(val))
  if (isNaN(num)) return '0 分钟'
  const formattedNum = Number.isInteger(num) ? num.toString() : num.toFixed(1)
  return `${formattedNum} 分钟`
}

const formattedPreServiceDuration = computed(() => formatServiceDurationText(preStrikeServiceDuration.value))
const formattedPostServiceDuration = computed(() => formatServiceDurationText(postStrikeServiceDuration.value))

/**
 * [功能说明]
 * 提取所有过境/打击窗口，按照开始时间由早到晚升序排列。
 *
 * 需求 6：时间轴的开始和结束时间分别是 第一个卫星过境地面站的开始时间 ---》最后一个卫星过境地面站结束时间。
 */
const allWindowsList = computed<WindowItemWrapper[]>(() => {
  if (!matrixData.value) return []
  const data: any = matrixData.value
  const list: WindowItemWrapper[] = []
  const satMap = new Map<number, string>()
  const defaultTargetName = store.battle?.name || '战场目标区域'

  ;(data.initMatrixList || []).forEach((s: any) => satMap.set(s.norad, s.name))
  ;(data.satelliteMatrixList || []).forEach((s: any) => satMap.set(s.norad, s.name))

  // 1. 从 satelliteMatrixList 提取 (包含打击状态 strikeStatus)
  const satMatrixList = data.satelliteMatrixList || []
  satMatrixList.forEach((sat: any) => {
    const windows = sat.stationWindows || sat.initWindows || []
    windows.forEach((win: any, index: number) => {
      const startStr = win.peakWindow || win.startWindow || win.beginWindow || ''
      const endStr = win.endWindow || ''
      const startTs = parseToTimestamp(startStr)
      const endTs = parseToTimestamp(endStr)
      const recName = win.receiveName || defaultTargetName
      const recId = win.receiveId || 'target-area'
      const strikeVal = typeof win.strikeStatus === 'number' ? win.strikeStatus : sat.satelliteStatus === 1 ? 1 : 0

      list.push({
        id: `win-sat-${sat.norad}-${recId}-${index}`,
        satName: sat.name || satMap.get(sat.norad) || `Sat-${sat.norad}`,
        satNorad: sat.norad,
        receiveName: recName,
        receiveId: recId,
        startTime: startStr,
        endTime: endStr,
        startTimeShort: startStr ? startStr.split(' ')[1] || startStr : '',
        endTimeShort: endStr ? endStr.split(' ')[1] || endStr : '',
        startTimestamp: startTs,
        endTimestamp: endTs,
        strikeStatus: strikeVal,
        delayMin: win.delayMin || sat.delayMin,
        weapons: win.weapons || sat.weapons,
      })
    })
  })

  // 2. 补充 initMatrixList 中独有的过境窗口
  const initMatrixList = data.initMatrixList || []
  initMatrixList.forEach((sat: any) => {
    const windows = sat.initWindows || []
    windows.forEach((win: any, index: number) => {
      const startStr = win.peakWindow || win.startWindow || win.beginWindow || ''
      const endStr = win.endWindow || ''
      const recName = win.receiveName || defaultTargetName
      const recId = win.receiveId || 'target-area'
      const winId = `win-init-${sat.norad}-${recId}-${index}`

      const exists = list.some(
        (item) => item.satNorad === sat.norad && item.receiveId === recId && item.startTime === startStr
      )
      if (!exists) {
        const startTs = parseToTimestamp(startStr)
        const endTs = parseToTimestamp(endStr)
        list.push({
          id: winId,
          satName: sat.name,
          satNorad: sat.norad,
          receiveName: recName,
          receiveId: recId,
          startTime: startStr,
          endTime: endStr,
          startTimeShort: startStr ? startStr.split(' ')[1] || startStr : '',
          endTimeShort: endStr ? endStr.split(' ')[1] || endStr : '',
          startTimestamp: startTs,
          endTimestamp: endTs,
          strikeStatus: 0,
        })
      }
    })
  })

  // 3. 提取 relayRelation.relations 中的星间中继过境时间窗口 (visibilityWindows)
  const relayRels = data.relayRelation?.relations || []
  relayRels.forEach((rel) => {
    const fromNorad = Number(rel.from)
    const toNorad = Number(rel.to)
    const fromSatName = satMap.get(fromNorad) || `Sat-${fromNorad}`
    const toSatName = satMap.get(toNorad) || `TDRS-${toNorad}`

    const windows = rel.visibilityWindows || []
    windows.forEach((win, index) => {
      const startTs = parseToTimestamp(win.beginWindow)
      const endTs = parseToTimestamp(win.endWindow)
      list.push({
        id: `win-relay-${rel.from}-${rel.to}-${index}`,
        satName: fromSatName,
        satNorad: fromNorad,
        receiveName: toSatName,
        receiveId: `sat-${rel.to}`,
        startTime: win.beginWindow,
        endTime: win.endWindow,
        startTimeShort: win.beginWindow ? win.beginWindow.split(' ')[1] || win.beginWindow : '',
        endTimeShort: win.endWindow ? win.endWindow.split(' ')[1] || win.endWindow : '',
        startTimestamp: startTs,
        endTimestamp: endTs,
        strikeStatus: 0,
        isRelayWindow: true,
        relayNorad: toNorad,
      })
    })
  })

  // 按过境开始时间从早到晚进行升序排序
  list.sort((a, b) => a.startTimestamp - b.startTimestamp)
  return list
})

/**
 * [功能说明]
 * 根据当前选中的节点 (普通卫星 / 中继卫星 / 地面接收站 / 中心云数据中心) 联动过滤展示的时间窗口列表。
 *
 * [处理规则]
 * - 结果严格保持按时间从早到晚 (startTimestamp 升序) 排列。
 * - 当无任何节点被选中时，默认列出全量按时间升序排列的时间窗口。
 */
const displayedWindowsList = computed<WindowItemWrapper[]>(() => {
  const all = allWindowsList.value
  if (!selectedNodeInfo.value) {
    return all
  }

  const node = selectedNodeInfo.value
  let filtered: WindowItemWrapper[] = []

  if (node.type === 'sat') {
    // 1. 普通卫星: 筛选 satNorad 匹配或星间中继 relayNorad 匹配的时间窗口
    filtered = all.filter((w) => w.satNorad === node.norad || w.relayNorad === node.norad)
  } else if (node.type === 'relay') {
    // 2. 中继卫星: 筛选中继卫星自身及所有由其提供转发服务的依赖卫星时间窗口
    const relayRels = matrixData.value?.relayRelation?.relations || []
    const relatedNorads = new Set<number>()
    if (node.norad) relatedNorads.add(node.norad)

    relayRels.forEach((rel) => {
      if (Number(rel.to) === node.norad) {
        relatedNorads.add(Number(rel.from))
      } else if (Number(rel.from) === node.norad) {
        relatedNorads.add(Number(rel.to))
      }
    })

    filtered = all.filter(
      (w) => w.relayNorad === node.norad || w.satNorad === node.norad || relatedNorads.has(w.satNorad)
    )
  } else if (node.type === 'receive') {
    // 3. 地面接收站: 筛选 receiveId 匹配的时间窗口
    filtered = all.filter((w) => w.receiveId === node.receiveId)
  } else if (node.type === 'station') {
    // 4. 中心云数据中心: 筛选相连的所有地面接收站对应的时间窗口
    const initRels = matrixData.value?.initRelationList?.relations || []
    const stationRels = matrixData.value?.stationRelationList?.relations || []
    const allRels = [...initRels, ...stationRels]

    const connectedReceiveIds = new Set<string>()
    allRels.forEach((rel) => {
      if (rel.to === node.stationId) {
        connectedReceiveIds.add(rel.from)
      }
    })

    filtered = all.filter((w) => connectedReceiveIds.has(w.receiveId))
  } else {
    filtered = all
  }

  // 按过境开始时间从早到晚进行升序排序
  return filtered.sort((a, b) => a.startTimestamp - b.startTimestamp)
})

/**
 * [功能说明]
 * 重置拓扑节点选中状态
 */
const clearSelectedNode = () => {
  selectedNodeInfo.value = null
  updateGraphHighlightState()
}

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

  // [逻辑说明] 当关联卫星处于活跃过境状态时，同步保持星间中继拓扑链路与中继卫星的高亮与连接活跃
  const relayRels = matrixData.value?.relayRelation?.relations || []
  relayRels.forEach((rel) => {
    const fromId = `sat-${rel.from}`
    const toId = `sat-${rel.to}`
    if (activeNodeIds.has(fromId)) {
      activeNodeIds.add(toId)
      activeEdgeKeys.add(`${fromId}::${toId}`)
    }
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
  const data: any = matrixData.value

  // ==================== 通讯卫星模式两层拓扑构建 ====================
  if (currentSatCategory.value === 'COMM') {
    const nodes: any[] = []
    const edges: any[] = []
    const satMap = new Map<number, { norad: number; name: string; satType: string; status: number }>()

    ;(data.initMatrixList || []).forEach((s: any) => {
      satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType || '通讯卫星', status: 0 })
    })
    ;(data.satelliteMatrixList || []).forEach((s: any) => {
      const satStatus = currentViewMode.value === 'PRE_STRIKE' ? 0 : s.satelliteStatus || 0
      satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType || '通讯卫星', status: satStatus })
    })

    const satList = Array.from(satMap.values())
    satNodeCount.value = satList.length
    receiveNodeCount.value = 1
    stationNodeCount.value = 0

    const containerW = g6Container.value ? g6Container.value.clientWidth : 0
    if (containerW <= 0) return { nodes: [], edges: [] }
    const startX = 30
    const availableW = Math.max(containerW - startX - 30, 400)

    // 1. 排布第一层 通讯卫星 (y = 90)
    satList.forEach((sat, i) => {
      const id = `sat-${sat.norad}`
      const x = startX + (availableW / (satList.length + 1)) * (i + 1)
      const isStruck = sat.status === 1
      const bgFill = isStruck ? '#2d1215' : '#092638'
      const strokeColor = isStruck ? '#ff4d4f' : '#00e1ff'
      const textColor = isStruck ? '#ff7875' : '#e6f7ff'

      nodes.push({
        id,
        label: `${sat.name}\n[${formatSatType(sat.satType)}]`,
        layer: 1,
        x,
        y: 90,
        type: 'rect',
        size: [140, 44],
        anchorPoints: [
          [0.5, 0],
          [0.5, 1],
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
            shadowColor: strokeColor,
            shadowBlur: 14,
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

    // 2. 排布第二层 战场目标区域节点 (y = 350, 居中)
    const targetNodeId = 'target-area'
    const targetName = store.battle?.name || '战场目标区域'
    nodes.push({
      id: targetNodeId,
      label: `🎯 ${targetName}\n[通信目标区域]`,
      layer: 2,
      x: containerW / 2,
      y: 350,
      type: 'rect',
      size: [220, 50],
      anchorPoints: [
        [0.5, 0],
        [0.5, 1],
      ],
      style: {
        fill: '#0f2742',
        stroke: '#1890ff',
        lineWidth: 2,
        radius: 8,
        shadowColor: 'rgba(24, 144, 255, 0.4)',
        shadowBlur: 12,
      },
      labelCfg: {
        style: {
          fill: '#e6f7ff',
          fontSize: 14,
          fontWeight: 700,
        },
      },
      stateStyles: {
        active: {
          fill: '#0f2742',
          stroke: '#1890ff',
          lineWidth: 3,
          shadowColor: '#1890ff',
          shadowBlur: 18,
        },
        highlight: {
          fill: '#0f2742',
          stroke: '#1890ff',
          lineWidth: 3,
          shadowColor: '#1890ff',
          shadowBlur: 22,
        },
        hover: {
          fill: '#0f2742',
          stroke: '#40a9ff',
          lineWidth: 2.5,
          shadowColor: '#40a9ff',
          shadowBlur: 16,
        },
        selected: {
          fill: '#0f2742',
          stroke: '#1890ff',
          lineWidth: 3,
        },
        inactive: {
          fill: '#0f2742',
          stroke: '#1890ff',
          opacity: 0.6,
        },
      },
    })

    // 3. 构建通讯链路连线 (通讯卫星 -> 战场目标区域)
    let normCount = 0
    let struckCount = 0

    satList.forEach((sat) => {
      const satId = `sat-${sat.norad}`
      const isStruck = sat.status === 1
      if (isStruck) {
        struckCount++
      } else {
        normCount++
      }

      edges.push({
        source: satId,
        target: targetNodeId,
        type: 'struck-cubic',
        style: {
          stroke: isStruck ? '#ff4d4f' : '#00e1ff',
          lineWidth: 2,
          lineDash: isStruck ? [6, 4] : undefined,
          endArrow: {
            path: G6.Arrow.triangle(6, 8, 0),
            fill: isStruck ? '#ff4d4f' : '#00e1ff',
          },
        },
      })
    })

    normalLinkCount.value = normCount
    struckLinkCount.value = struckCount

    return { nodes, edges }
  }

  // ==================== 侦察卫星模式三层拓扑构建 ====================
  const nodes: any[] = []
  const edges: any[] = []
  const nodeSet = new Set<string>()

  // 1. 提取普通卫星 (Layer 1) 与 中继卫星 (Layer 2)
  // [变量用途] 保存节点 NORAD 到卫星详细信息及打击状态的映射
  const satMap = new Map<number, { norad: number; name: string; satType: string; status: number }>()
  ;(data.initMatrixList || []).forEach((s) => {
    satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: 0 })
  })

  // 判断是否有卫星/中继卫星被打击
  ;(data.satelliteMatrixList || []).forEach((s) => {
    // [处理规则]
    // 当处于打击前拓扑 (PRE_STRIKE) 视图模式时，卫星状态强制置为 0 (未打击/正常)；
    // 当处于打击后拓扑 (POST_STRIKE) 或全景对比 (COMBINED) 视图模式时，读取后端返回的 satelliteStatus 确定毁伤打压状态 (0-正常, 1-受打击/毁伤)
    const satStatus = currentViewMode.value === 'PRE_STRIKE' ? 0 : s.satelliteStatus || 0
    satMap.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, status: satStatus })
  })
  // [逻辑说明] 提取星间中继拓扑关系中的中继卫星节点
  if (data.relayRelation) {
    ;(data.relayRelation.relayList || []).forEach((norad) => {
      if (!satMap.has(norad)) {
        satMap.set(norad, { norad, name: `TDRS-${norad}`, satType: '通信/数据中继', status: 0 })
      }
    })
  }

  const satList = Array.from(satMap.values())
  satNodeCount.value = satList.length

  // 判断是否为中继卫星 (satType 包含 "中继" 或在 relayRelation.relayList 中)
  const isRelaySat = (s: { satType?: string; norad: number }) => {
    const isRelayType = (s.satType || '').includes('中继')
    const inRelayList = (data.relayRelation?.relayList || []).includes(s.norad)
    return isRelayType || inRelayList
  }

  const normalSatList = satList.filter((s) => !isRelaySat(s))
  const relaySatList = satList.filter((s) => isRelaySat(s))

  // 2. Layer 3: 地面接收站 (Ground Stations)
  const receiveMap = new Map<string, { receiveId: string; receiveName: string; status: number }>()
  const relLists =
    currentViewMode.value === 'PRE_STRIKE'
      ? [data.initRelationList].filter(Boolean)
      : [data.stationRelationList, data.initRelationList].filter(Boolean)

  relLists.forEach((rl) => {
    ;(rl.receiveObjList || []).forEach((rec) => {
      const recStatus = currentViewMode.value === 'PRE_STRIKE' ? 0 : rec.receiveStatus || 0
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

  // 3. Layer 3: 中心云数据中心 (Data Centers)
  const stationMap = new Map<string, { stationId: string; stationName: string; status: number }>()
  relLists.forEach((rl) => {
    ;(rl.stationObjList || []).forEach((st) => {
      const stStatus = currentViewMode.value === 'PRE_STRIKE' ? 0 : st.stationStatus || 0
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

  // 计算 3 层节点的坐标布局 (Layer 1 普通卫星: y=80, Layer 2 中继卫星: y=230, Layer 3 接收站: y=380, Layer 3 数据中心: y=490)
  const containerW = g6Container.value ? g6Container.value.clientWidth : 0
  if (containerW <= 0) return { nodes: [], edges: [] }
  const startX = 30
  const availableW = Math.max(containerW - startX - 30, 400)

  // 排布 Layer 1 普通卫星 (y = 80)
  normalSatList.forEach((sat, i) => {
    const id = `sat-${sat.norad}`
    nodeSet.add(id)
    const x = startX + (availableW / (normalSatList.length + 1)) * (i + 1)
    const isStruck = sat.status === 1
    const bgFill = isStruck ? '#2d1215' : '#092638'
    const strokeColor = isStruck ? '#ff4d4f' : '#00e1ff'
    const textColor = isStruck ? '#ff7875' : '#e6f7ff'

    nodes.push({
      id,
      label: `${sat.name}\n[${formatSatType(sat.satType)}]`,
      layer: 1,
      x,
      y: 80,
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

  // 排布 Layer 2 中继卫星 (y = 230)
  relaySatList.forEach((sat, i) => {
    const id = `sat-${sat.norad}`
    nodeSet.add(id)
    const x = startX + (availableW / (relaySatList.length + 1)) * (i + 1)
    const isStruck = sat.status === 1
    const bgFill = isStruck ? '#2d1215' : '#1e112a'
    const strokeColor = isStruck ? '#ff4d4f' : '#a855f7'
    const textColor = isStruck ? '#ff7875' : '#e9d5ff'

    nodes.push({
      id,
      label: `${sat.name}\n[${formatSatType(sat.satType)}]`,
      layer: 2,
      x,
      y: 230,
      type: 'rect',
      size: [135, 42],
      anchorPoints: [
        [0.5, 0], // 0: 上边中心
        [0.5, 1], // 1: 下边中心
      ],
      style: {
        fill: bgFill,
        stroke: strokeColor,
        lineWidth: 2,
        radius: 6,
        shadowColor: isStruck ? 'rgba(255, 77, 79, 0.4)' : 'rgba(168, 85, 247, 0.4)',
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

  // 排布 Layer 3 地面站 (y = 380)
  receiveList.forEach((rec, i) => {
    nodeSet.add(rec.receiveId)
    const x = startX + (availableW / (receiveList.length + 1)) * (i + 1)
    const isStruck = rec.status === 1
    const bgFill = isStruck ? '#2d1215' : '#0a2e2b'
    const strokeColor = isStruck ? '#ff4d4f' : '#00f2fe'
    const textColor = isStruck ? '#ff7875' : '#e6f7ff'

    nodes.push({
      id: rec.receiveId,
      label: rec.receiveName,
      layer: 3,
      x,
      y: 380,
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

  // 排布 Layer 3 数据中心 (y = 490)
  stationList.forEach((st, i) => {
    nodeSet.add(st.stationId)
    const x = startX + (availableW / (stationList.length + 1)) * (i + 1)
    const isStruck = st.status === 1
    const bgFill = isStruck ? '#2d1215' : '#10244c'
    const strokeColor = isStruck ? '#ff4d4f' : '#3b82f6'
    const textColor = isStruck ? '#ff7875' : '#93c5fd'

    nodes.push({
      id: st.stationId,
      label: st.stationName,
      layer: 3,
      x,
      y: 490,
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
      })
    }
  })

  // 3. Layer 1 -> Layer 2 边 (星间数据中继拓扑关系: 普通卫星 -> 数据中继卫星)
  const relayRels = data.relayRelation?.relations || []
  relayRels.forEach((rel) => {
    const sourceSatId = `sat-${rel.from}`
    const targetSatId = `sat-${rel.to}`
    const edgeId = `edge-relay-${rel.from}-${rel.to}`

    if (!edgeSet.has(edgeId) && nodeSet.has(sourceSatId) && nodeSet.has(targetSatId)) {
      edgeSet.add(edgeId)
      normalCount++

      edges.push({
        id: edgeId,
        source: sourceSatId,
        target: targetSatId,
        sourceAnchor: 1, // 源节点下边中心 (Layer 1)
        targetAnchor: 0, // 目标节点上边中心 (Layer 2)
        type: 'struck-cubic',
        isStruck: false,
        style: {
          stroke: '#a855f7',
          lineWidth: 2,
          lineDash: [4, 4],
        },
      })
    }
  })

  normalLinkCount.value = normalCount
  struckLinkCount.value = struckCount

  return { nodes, edges }
}

/**
 * [功能说明]
 * 初始化或更新 AntV G6 画布
 *
 * [处理规则]
 * - 当视图切回可见状态时，在 nextTick 后准确获取 DOM 容器宽高度 (clientWidth / clientHeight)。
 * - 若 graph 尚未创建或已销毁，则新建 G6.Graph 实例并 render。
 * - 若 graph 已存在，则调用 changeSize 动态调整画布尺寸，重新装载数据 (changeData) 并自适应全屏 (fitView)。
 */
const initOrUpdateGraph = () => {
  if (!g6Container.value) return

  // 准确获取 DOM 容器宽高度 (clientWidth / clientHeight)
  const width = g6Container.value.clientWidth
  const height = g6Container.value.clientHeight

  // 容器处于 display: none 或尚未渲染（尺寸为 0）时直接返回，避免画布尺寸坍塌
  if (!width || !height || width <= 0 || height <= 0) return

  // 自定义边
  registerCustomG6Edge()

  const data = buildG6GraphData()

  if (!graph || graph.get('destroyed')) {
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
    graph.data(data)
    graph.render()

    // 绑定拓扑图节点点击事件：选中节点并筛选联动时间轴时间窗口列表
    graph.on('node:click', (evt: any) => {
      const nodeItem = evt.item
      if (!nodeItem) return
      const model = nodeItem.getModel()
      const nodeId = String(model.id)

      if (selectedNodeInfo.value?.id === nodeId) {
        selectedNodeInfo.value = null
      } else {
        parseAndSelectNode(model)
      }
      updateGraphHighlightState()
    })

    // 点击空白画布区重置选中节点
    graph.on('canvas:click', () => {
      selectedNodeInfo.value = null
      updateGraphHighlightState()
    })
  } else {
    // 拓扑图已有实例：重新计算画布大小并替换渲染数据
    graph.changeSize(width, height)
    graph.changeData(data)
    graph.fitView([20, 40, 20, 40])
    updateGraphHighlightState()
  }
}

/**
 * [功能说明]
 * 解析 G6 节点 model 并存入 selectedNodeInfo 选中对象
 */
const parseAndSelectNode = (model: any) => {
  const id = String(model.id)
  const data = matrixData.value

  if (id.startsWith('sat-')) {
    const norad = Number(id.replace('sat-', ''))
    const isRelay = (data?.relayRelation?.relayList || []).includes(norad)
    const satObj =
      (data?.satelliteMatrixList || []).find((s) => s.norad === norad) ||
      (data?.initMatrixList || []).find((s) => s.norad === norad)
    const name = satObj?.name || (model.label ? model.label.split('\n')[0] : `Sat-${norad}`)

    selectedNodeInfo.value = {
      id,
      name,
      type: isRelay ? 'relay' : 'sat',
      norad,
    }
  } else {
    // 判断节点是中心云数据中心还是地面接收站
    const isStation =
      (data?.stationRelationList?.stationObjList || []).some((st) => st.stationId === id) ||
      (data?.initRelationList?.stationObjList || []).some((st) => st.stationId === id)

    if (isStation) {
      const stObj =
        (data?.stationRelationList?.stationObjList || []).find((st) => st.stationId === id) ||
        (data?.initRelationList?.stationObjList || []).find((st) => st.stationId === id)
      selectedNodeInfo.value = {
        id,
        name: stObj?.stationName || model.label || id,
        type: 'station',
        stationId: id,
      }
    } else {
      const recObj =
        (data?.stationRelationList?.receiveObjList || []).find((r) => r.receiveId === id) ||
        (data?.initRelationList?.receiveObjList || []).find((r) => r.receiveId === id)
      selectedNodeInfo.value = {
        id,
        name: recObj?.receiveName || model.label || id,
        type: 'receive',
        receiveId: id,
      }
    }
  }
}

/**
 * [功能说明]
 * 更新 G6 图节点的选中与关联高亮样式
 */
const updateGraphHighlightState = () => {
  if (!graph || graph.get('destroyed')) return

  if (!selectedNodeInfo.value) {
    highlightActiveElements()
    return
  }

  const selId = selectedNodeInfo.value.id

  // 查找与当前选中节点相连的所有边和节点 ID 集合
  const connectedNodeIds = new Set<string>([selId])
  const connectedEdgeIds = new Set<string>()

  graph.getEdges().forEach((edge: any) => {
    const model = edge.getModel()
    if (model.source === selId || model.target === selId) {
      connectedEdgeIds.add(edge.get('id'))
      connectedNodeIds.add(model.source)
      connectedNodeIds.add(model.target)
    }
  })

  graph.getNodes().forEach((node: any) => {
    const id = node.get('id')
    if (id === selId) {
      graph.setItemState(node, 'selected', true)
      graph.setItemState(node, 'inactive', false)
      graph.setItemState(node, 'highlight', false)
    } else if (connectedNodeIds.has(id)) {
      graph.setItemState(node, 'selected', false)
      graph.setItemState(node, 'highlight', true)
      graph.setItemState(node, 'inactive', false)
    } else {
      graph.setItemState(node, 'selected', false)
      graph.setItemState(node, 'highlight', false)
      graph.setItemState(node, 'inactive', true)
    }
  })

  graph.getEdges().forEach((edge: any) => {
    const edgeId = edge.get('id')
    if (connectedEdgeIds.has(edgeId)) {
      graph.setItemState(edge, 'highlight', true)
      graph.setItemState(edge, 'inactive', false)
    } else {
      graph.setItemState(edge, 'highlight', false)
      graph.setItemState(edge, 'inactive', true)
    }
  })
}

// [变量用途]
// 容器尺寸观察器与防抖定时器
let resizeObserver: ResizeObserver | null = null
let resizeTimer: number | null = null

/**
 * [函数说明]
 * 监听容器尺寸变化并防抖更新 G6 画布尺寸与布局
 */
const handleResize = () => {
  if (resizeTimer) window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(() => {
    initOrUpdateGraph()
  }, 60)
}

onMounted(() => {
  fetchMatrixData()
  window.addEventListener('resize', handleResize)

  if (g6Container.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        handleResize()
      }
    })
    resizeObserver.observe(g6Container.value)
  }
})

/**
 * [Hook 说明]
 * KeepAlive 缓存组件切回激活状态时重新计算 DOM 尺寸并绘制拓扑
 */
onActivated(() => {
  nextTick(() => {
    setTimeout(() => {
      initOrUpdateGraph()
    }, 50)
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (resizeTimer) {
    window.clearTimeout(resizeTimer)
    resizeTimer = null
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (graph) {
    graph.destroy()
    graph = null
  }
})
</script>

<style lang="scss" scoped>
@use '../styles/theme.scss';

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
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;

  :deep(canvas) {
    display: block;
  }
}

/* 底部时间轴样式 */
.cema-timeline-footer {
  height: 165px;
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

  .ctrl-left {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }

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

  .service-duration-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 4px;
    padding: 2px 10px;
    font-size: 12px;

    .badge-label {
      color: #94a3b8;
    }

    .badge-val {
      font-size: 13px;
      font-weight: 700;
    }

    &.pre-strike-badge {
      border: 1px solid rgba(0, 225, 255, 0.35);
      background: rgba(0, 225, 255, 0.08);

      .badge-val {
        color: #00e1ff;
        text-shadow: 0 0 6px rgba(0, 225, 255, 0.4);
      }
    }

    &.post-strike-badge {
      border: 1px solid rgba(255, 120, 117, 0.35);
      background: rgba(255, 77, 79, 0.08);

      .badge-val {
        color: #ff7875;
        text-shadow: 0 0 6px rgba(255, 120, 117, 0.4);
      }
    }
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

.windows-cards-scroll {
  display: flex;
  gap: 12px;
  // AI: 使用 overflow-x: scroll，即便无数据或数据较少时也始终保留底部滚动轴轨迹
  overflow-x: scroll;
  padding-bottom: 8px;
  flex: 1;
  align-items: stretch;

  &::-webkit-scrollbar {
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.4);
    border-radius: 4px;

    &:hover {
      background: rgba(0, 225, 255, 0.7);
    }
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 225, 255, 0.08);
    border-radius: 4px;
  }
}

.empty-window-card {
  width: 100%;
  min-width: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.5);
  border: 1px dashed rgba(0, 225, 255, 0.25);
  border-radius: 6px;
  color: #94a3b8;
  font-size: 13px;
  padding: 12px;
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

  &.card-relay {
    border-color: rgba(168, 85, 247, 0.45);
    background: rgba(168, 85, 247, 0.08);

    &.card-active {
      border-color: #a855f7;
      background: rgba(168, 85, 247, 0.2);
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.35);
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;

    .win-time {
      font-size: 11px;
      color: #94a3b8;
      font-family: inherit;
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

      &.badge-relay {
        background: rgba(168, 85, 247, 0.2);
        color: #c084fc;
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

    .relay-tag {
      color: #c084fc;
      background: rgba(168, 85, 247, 0.15);
      border: 1px solid rgba(168, 85, 247, 0.3);
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
