<template>
  <div class="satellite-gantt-dashboard dark-theme">
    <!-- 顶部控制与全景 Header -->
    <div class="gantt-header">
      <div class="header-left">
        <span class="header-icon">
          <!-- Lucide Satellite Icon SVG -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-satellite"
          >
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
        <!-- 矩阵系列信息与干扰烈度 -->
        <span class="badge-item" v-if="props.matrixData?.series">
          <span class="label">卫星系列:</span>
          <span class="value">{{ props.matrixData.series }}</span>
        </span>
        <span class="badge-item">
          <span class="label">卫星总数:</span>
          <span class="value">{{ filteredSatellites.length }} 颗</span>
        </span>
        <span class="badge-item alert-badge">
          <span class="label">被干扰卫星:</span>
          <span class="value danger">{{ struckSatCount }} 颗</span>
        </span>
      </div>

      <div class="header-right">
        <!-- 放大与缩小刻度控制 -->
        <div class="zoom-controls">
          <span class="zoom-label">时间刻度:</span>
          <el-button-group>
            <el-button size="small" type="primary" :disabled="timeScaleFactor <= 0.5" @click="changeScale(0.75)">
              缩小 -
            </el-button>
            <el-button size="small" type="primary" @click="resetScale"> 100% </el-button>
            <el-button size="small" type="primary" :disabled="timeScaleFactor >= 3.0" @click="changeScale(1.25)">
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="lucide lucide-search"
              >
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
          <div class="tree-header">卫星与接收站节点 ({{ filteredSatellites.length }})</div>
          <div
            v-for="sat in filteredSatellites"
            :key="sat.norad"
            class="sat-tree-item"
            :class="{
              'is-sat-struck': sat.satelliteStatus === 1,
              'is-selected': selectedSatNorad === sat.norad,
            }"
            @click="selectSatelliteRow(sat)"
          >
            <div class="sat-item-header">
              <span class="sat-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-satellite"
                >
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
              <div
                v-for="win in sat.stationWindows"
                :key="win.receiveId + '-' + win.peakWindow"
                class="win-sub-item"
                :class="{ 'is-win-struck': win.strikeStatus === 1 }"
              >
                <span class="sub-rec-name">📡 {{ win.receiveName }}</span>
                <span class="sub-win-time">{{
                  win.peakWindow.length >= 16 ? win.peakWindow.substring(11, 16) : win.peakWindow
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 中间栏 (Center Workspace): 可上下左右二维滚动的甘特图 Canvas 区域 -->
      <div class="gantt-workspace-center" ref="scrollContainerRef">
        <div class="gantt-chart-inner" :style="{ width: ganttCanvasWidth + 'px' }">
          <!-- 甘特图顶部时间轴 Header -->
          <div class="gantt-timeline-header">
            <div class="left-row-label-header">
              <span>卫星 / 干扰排道</span>
            </div>
            <div class="timeline-ticks-container">
              <div
                v-for="tick in timelineTicks"
                :key="tick.timeStr"
                class="time-tick-item"
                :style="{ left: tick.leftPx + 'px' }"
              >
                <span class="tick-line"></span>
                <span class="tick-text">{{ tick.label }}</span>
              </div>
            </div>
          </div>

          <!-- 甘特图行 (Rows) 区域 -->
          <div class="gantt-rows-container">
            <div
              v-for="satRow in processedGanttRows"
              :key="satRow.norad"
              class="gantt-sat-row-group"
              :class="{ 'row-sat-struck': satRow.satelliteStatus === 1 }"
            >
              <!-- 卫星行左侧固定 Label 块 -->
              <div class="row-label-col">
                <div class="sat-main-label">
                  <span class="icon-sat">🛰️</span>
                  <span class="sat-title">{{ satRow.name }}</span>
                </div>
                <div class="sat-meta-sub">
                  <span>NORAD: {{ satRow.norad }}</span>
                  <span class="lane-count-tag" v-if="satRow.maxLanes > 1">分道: {{ satRow.maxLanes }}层</span>
                </div>
              </div>

              <!-- 卫星行右侧 Timeline 轨道 (支持 Chrome Timer 式排道展示) -->
              <div class="row-timeline-track" :style="{ height: satRow.maxLanes * 32 + 12 + 'px' }">
                <!-- 时间刻度网格线条 -->
                <div
                  v-for="tick in timelineTicks"
                  :key="'grid-' + tick.timeStr"
                  class="track-grid-line"
                  :style="{ left: tick.leftPx + 'px' }"
                ></div>

                <!-- 具体的干扰/过境甘特块 (Gantt Bar Items) -->
                <div
                  v-for="bar in satRow.bars"
                  :key="bar.id"
                  class="gantt-bar-item"
                  :class="[bar.colorStatusClass, { 'is-bar-active': selectedBarId === bar.id }]"
                  :style="{
                    left: bar.leftPx + 'px',
                    width: bar.widthPx + 'px',
                    top: bar.laneIndex * 32 + 6 + 'px',
                  }"
                  @click.stop="handleSelectBar(bar)"
                >
                  <div
                    class="bar-content"
                    :title="`${bar.receiveName} (${bar.peakWindowShort} ~ ${bar.endWindowShort})`"
                  >
                    <!-- 绿色表示未被干扰，紫色表示被干扰 -->
                    <span class="bar-icon-only"> 📡 </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 右侧栏 (Right Detail Panel): 选中的干扰武器与交战分析明细 -->
      <div class="gantt-sidebar-right">
        <div class="panel-header">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-crosshair"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="22" x2="18" y1="12" y2="12" />
            <line x1="6" x2="2" y1="12" y2="12" />
            <line x1="12" x2="12" y1="6" y2="2" />
            <line x1="12" x2="12" y1="22" y2="18" />
          </svg>
          <span class="panel-title">干扰与武器明细</span>
        </div>

        <div class="panel-content-body" v-if="selectedBar">
          <!-- 干扰状态卡片 Banner -->
          <div class="status-banner-card" :class="selectedBar.colorStatusClass">
            <div class="banner-title">
              <span class="banner-icon">
                <template v-if="selectedBar.satStatus === 1 && selectedBar.strikeStatus === 1">💥⚡</template>
                <template v-else-if="selectedBar.satStatus === 1">🛰️💥</template>
                <template v-else-if="selectedBar.strikeStatus === 1">📡🎯</template>
                <template v-else>🟢</template>
              </span>
              <span class="banner-status-text">
                <template v-if="selectedBar.satStatus === 1 && selectedBar.strikeStatus === 1"
                  >双重毁伤状态 (卫星与接收站均被击毁)</template
                >
                <template v-else-if="selectedBar.satStatus === 1">卫星受打压/毁伤 </template>
                <template v-else-if="selectedBar.strikeStatus === 1">接收站受打压/毁伤 </template>
                <template v-else>正常过境窗口 (未受干扰)</template>
              </span>
            </div>
          </div>

          <!-- 基本信息 Section -->
          <div class="info-section">
            <div class="section-title">🛰️ 卫星与接收站信息</div>
            <div class="info-grid">
              <!-- 目标卫星 (突出显示) -->
              <div class="info-row vertical-stack">
                <span class="label">目标卫星:</span>
                <div class="highlight-box sat-highlight-box">
                  <span class="highlight-name">🛰️ {{ selectedBar.satName }}</span>
                  <span class="highlight-sub">NORAD: {{ selectedBar.satNorad }}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="label">卫星状态:</span>
                <span class="val" :class="selectedBar.satStatus === 1 ? 'danger-text' : 'success-text'">
                  {{ selectedBar.satStatus === 1 ? '已被干扰' : '正常可用' }}
                </span>
              </div>

              <!-- 关联接收站 (突出显示) -->
              <div class="info-row vertical-stack">
                <span class="label">关联接收站:</span>
                <div class="highlight-box rec-highlight-box">
                  <span class="highlight-name">📡 {{ selectedBar.receiveName }}</span>
                  <span class="highlight-sub">ID: {{ selectedBar.receiveId }}</span>
                </div>
              </div>
              <div class="info-row">
                <span class="label">接收站状态:</span>
                <span class="val" :class="selectedBar.strikeStatus === 1 ? 'danger-text' : 'success-text'">
                  {{ selectedBar.strikeStatus === 1 ? '已被干扰' : '正常可用' }}
                </span>
              </div>
            </div>
          </div>

          <!-- 时间窗口 Section (整块高亮包覆 Label + 数值) -->
          <div class="info-section">
            <div class="section-title">⏱️ 过境 / 干扰时间窗口</div>
            <div class="info-grid">
              <!-- 开始时间 peakWindow (整块高亮包覆) -->
              <div class="info-row vertical-stack">
                <div class="highlight-box time-highlight-card">
                  <span class="highlight-label">开始过境时间:</span>
                  <span class="highlight-time-val">{{ selectedBar.peakWindow }}</span>
                </div>
              </div>
              <!-- 结束时间 endWindow (整块高亮包覆) -->
              <div class="info-row vertical-stack">
                <div class="highlight-box time-highlight-card">
                  <span class="highlight-label">结束过境时间:</span>
                  <span class="highlight-time-val">{{ selectedBar.endWindow }}</span>
                </div>
              </div>
              <div class="info-row" v-if="selectedBar.delayMin">
                <span class="label">窗口干扰延时:</span>
                <span class="val warning-text">+{{ selectedBar.delayMin }} 分钟</span>
              </div>
            </div>
          </div>

          <!-- 武器参数与干扰系统配置 Section -->
          <div class="info-section">
            <div class="section-title">🎯 执行干扰的武器系统配置</div>
            <div v-if="selectedBar.weapons && selectedBar.weapons.length > 0" class="weapons-list">
              <div v-for="w in selectedBar.weapons" :key="w.id" class="weapon-detail-card">
                <div class="w-card-header">
                  <span class="w-name">🎯 {{ w.name }}</span>
                  <span class="w-country">{{ w.country }}</span>
                </div>
                <div class="w-card-body">
                  <div class="w-prop">
                    <span class="p-lbl">武器类型:</span>
                    <span class="p-val">{{ w.type }}</span>
                  </div>
                  <div class="w-prop">
                    <span class="p-lbl">武器射程:</span>
                    <span class="p-val warning-text">{{ w.range }} km</span>
                  </div>
                  <div class="w-prop" v-if="w.latitude && w.longitude">
                    <span class="p-lbl">部署经纬度:</span>
                    <span class="p-val">({{ w.latitude.toFixed(2) }}, {{ w.longitude.toFixed(2) }})</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="empty-weapon-tip">暂无配置干扰武器（该时间段为正常过境窗口或未指派武器）。</div>
          </div>
        </div>

        <!-- 缺省提示 -->
        <div class="empty-panel-tip" v-else>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lucide lucide-mouse-pointer-click"
          >
            <path d="m9 9 5 12 1.8-5.2L21 14Z" />
            <path d="M7.2 2.2 8 5.1" />
            <path d="m5.1 8-2.9-.8" />
            <path d="M14 4.1 12 6" />
            <path d="m6 12-1.9 2" />
          </svg>
          <div class="tip-text">请在中间甘特图中点击任意干扰/过境时间块，查看卫星与干扰武器详细参数。</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getMatrixList } from '@/api/electronic'
import type { MatrixResult, SatelliteMatrix, Weapon } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
const store = useLayoutStore()
// [类型定义]
// 组件接收的 Props 参数类型
interface SatelliteGanttProps {
  /** 算法矩阵根接口返回数据 MatrixResult (可选) */
  matrixData?: MatrixResult | null
}

// [变量声明]
// 组件定义 Props 属性，若外层未提供则组件自主发起网络请求获取
const props = withDefaults(defineProps<SatelliteGanttProps>(), {
  matrixData: null,
})

// [变量用途]
// 组件内部自主管理的 MatrixResult 矩阵数据引用
const internalMatrixData = ref<MatrixResult | null>(null)

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

// [变量用途]
// 时间刻度缩放倍率 (0.5x ~ 3.0x)
const timeScaleFactor = ref<number>(1.0)

// [变量用途]
// 甘特图 Canvas 滚动容器 ref
const scrollContainerRef = ref<HTMLDivElement | null>(null)

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
  /** 甘特 Bar 左侧 Px 偏移 */
  leftPx: number
  /** 甘特 Bar 宽度 Px */
  widthPx: number
}

// [类型用途]
// 卫星甘特图行渲染对象
interface ProcessedSatRow {
  norad: number
  name: string
  satType: string
  satelliteStatus: number
  weapons: Weapon[]
  bars: ProcessedGanttBar[]
  maxLanes: number
}

/**
 * [功能说明]
 * 获取当前生效的 MatrixResult 矩阵数据。
 *
 * [数据来源]
 * 优先使用外部传入的 props.matrixData，若未传则使用组件内部拉取的 internalMatrixData。
 */
const currentData = computed<MatrixResult | null>(() => {
  return props.matrixData || internalMatrixData.value
})

/**
 * [功能说明]
 * 自主异步拉取后端矩阵数据 (当 props.matrixData 为空时自动调用)。
 */
const loadMatrixData = async () => {
  if (props.matrixData) return
  loading.value = true
  try {
    const res = await getMatrixList({
      norad: 57693,
      taskId: store.activedTask?.id || 0,
      intensityLevel: '高烈度',
    })
    if (res.code === 200 && res.data) {
      internalMatrixData.value = res.data
    } else {
      ElMessage.error(`获取甘特图矩阵数据失败: ${res.msg || '网络错误'}`)
    }
  } catch (err: any) {
    console.error('获取甘特图矩阵数据异常:', err)
    ElMessage.error(`获取甘特图矩阵数据失败: ${err.message || '网络错误'}`)
  } finally {
    loading.value = false
  }
}

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
 * 计算所有时间窗口的全局起始与结束时间边界。
 */
const timeBounds = computed<{ minTs: number; maxTs: number }>(() => {
  let minTs = Infinity
  let maxTs = -Infinity

  filteredSatellites.value.forEach((sat) => {
    ;(sat.stationWindows || []).forEach((win) => {
      const start = parseToTimestamp(win.peakWindow)
      const end = parseToTimestamp(win.endWindow)
      if (start < minTs) minTs = start
      if (end > maxTs) maxTs = end
    })
  })

  if (minTs === Infinity || maxTs === -Infinity || minTs >= maxTs) {
    const now = Math.floor(Date.now() / 1000)
    minTs = now
    maxTs = now + 86400
  }

  // 前补充10分钟 后补充2小时
  minTs -= 10 * 60
  maxTs += 2 * 3600
  return { minTs, maxTs }
})

/**
 * [功能说明]
 * 甘特图总画布基准像素宽度。
 */
const ganttCanvasWidth = computed<number>(() => {
  const durationSec = timeBounds.value.maxTs - timeBounds.value.minTs
  // 基准: 每小时 300px * timeScaleFactor 最少4小时
  const hours = Math.max(durationSec / 3600, 4)
  return Math.max(Math.floor(hours * 300 * timeScaleFactor.value), 1200)
})

/**
 * [功能说明]
 * 计算生成顶部时间轴刻度列表。
 */
const timelineTicks = computed<{ label: string; timeStr: string; leftPx: number }[]>(() => {
  const { minTs, maxTs } = timeBounds.value
  const totalSec = maxTs - minTs
  if (totalSec <= 0) return []

  const ticks: { label: string; timeStr: string; leftPx: number }[] = []
  // 每 1 小时产生一个 Tick 刻度
  const stepSec = 3600
  const startHourTs = Math.ceil(minTs / stepSec) * stepSec

  for (let ts = startHourTs; ts <= maxTs; ts += stepSec) {
    const date = new Date(ts * 1000)
    const hoursStr = String(date.getHours()).padStart(2, '0') + ':00'
    const ratio = (ts - minTs) / totalSec
    const leftPx = ratio * ganttCanvasWidth.value

    ticks.push({
      label: hoursStr,
      timeStr: date.toISOString(),
      leftPx,
    })
  }

  return ticks
})

/**
 * [功能说明]
 * 核心多层排道 (Multi-tier Lane) 算法：
 * 计算并格式化每一颗卫星及其所属窗口甘特条 (ProcessedSatRow 与 ProcessedGanttBar)。
 * 解决同一卫星/接收站有多个过境时间窗口时的纵向错开排道展示，防止甘特块重叠。
 */
const processedGanttRows = computed<ProcessedSatRow[]>(() => {
  const { minTs, maxTs } = timeBounds.value
  const totalSec = maxTs - minTs
  const canvasWidth = ganttCanvasWidth.value

  return filteredSatellites.value.map((sat) => {
    const rawWindows = sat.stationWindows || []

    // 1. 按照开始时间戳升序排序
    const sortedWindows = rawWindows
      .map((win, idx) => {
        const start = parseToTimestamp(win.peakWindow)
        const end = parseToTimestamp(win.endWindow)
        return { win, start, end, idx }
      })
      .sort((a, b) => a.start - b.start)

    // 2. 多层排道 Lane 分配算法 (类似 Chrome Network Timing / Timer Timeline，防止任何视觉与物理碰撞)
    const laneEndTimes: number[] = [] // 记录每个 lane 当前最后一个块的结束时间戳
    const laneRightPx: number[] = [] // 记录每个 lane 当前最后一个块的最右侧物理像素位置
    const bars: ProcessedGanttBar[] = []

    sortedWindows.forEach(({ win, start, end, idx }) => {
      // 计算位置像素
      const startRatio = (start - minTs) / totalSec
      const endRatio = (end - minTs) / totalSec
      const leftPx = Math.floor(startRatio * canvasWidth)

      // 时间跨度像素 (最小 22px，无文字仅图标)
      const rawWidthPx = Math.floor((endRatio - startRatio) * canvasWidth)
      const widthPx = Math.max(rawWidthPx, 22)
      const rightPx = leftPx + widthPx

      let assignedLane = -1

      // 寻找可容纳该窗口的现有 lane (需同时满足时间戳不重叠且物理像素留有空隙 4px)
      for (let l = 0; l < laneRightPx.length; l++) {
        if (laneEndTimes[l] <= start && laneRightPx[l] + 4 <= leftPx) {
          assignedLane = l
          laneEndTimes[l] = end
          laneRightPx[l] = rightPx
          break
        }
      }

      // 若在已有 lane 发生视觉或时间遮挡，开辟新 lane 纵向分道
      if (assignedLane === -1) {
        assignedLane = laneRightPx.length
        laneEndTimes.push(end)
        laneRightPx.push(rightPx)
      }

      // 合并武器列表 (去重)
      const weaponMap = new Map<string, Weapon>()
      ;(sat.weapons || []).forEach((w) => weaponMap.set(w.id, w))
      ;(win.weapons || []).forEach((w) => weaponMap.set(w.id, w))
      const combinedWeapons = Array.from(weaponMap.values())

      // 4色击毁状态判定名
      let colorStatusClass: 'status-normal' | 'status-sat-struck' | 'status-rec-struck' | 'status-both-struck' =
        'status-normal'
      if (sat.satelliteStatus === 1 && win.strikeStatus === 1) {
        colorStatusClass = 'status-both-struck'
      } else if (sat.satelliteStatus === 1) {
        colorStatusClass = 'status-sat-struck'
      } else if (win.strikeStatus === 1) {
        colorStatusClass = 'status-rec-struck'
      }

      const peakWindowShort = win.peakWindow.length >= 16 ? win.peakWindow.substring(11, 16) : win.peakWindow
      const endWindowShort = win.endWindow.length >= 16 ? win.endWindow.substring(11, 16) : win.endWindow

      bars.push({
        id: `bar-${sat.norad}-${win.receiveId}-${idx}`,
        satNorad: sat.norad,
        satName: sat.name,
        satStatus: sat.satelliteStatus,
        receiveId: win.receiveId,
        receiveName: win.receiveName,
        strikeStatus: win.strikeStatus,
        peakWindow: win.peakWindow,
        endWindow: win.endWindow,
        peakWindowShort,
        endWindowShort,
        startTimestamp: start,
        endTimestamp: end,
        delayMin: win.delayMin,
        weapons: combinedWeapons,
        colorStatusClass,
        laneIndex: assignedLane,
        leftPx,
        widthPx,
      })
    })

    return {
      norad: sat.norad,
      name: sat.name,
      satType: sat.satType,
      satelliteStatus: sat.satelliteStatus,
      weapons: sat.weapons || [],
      bars,
      maxLanes: Math.max(laneEndTimes.length, 1),
    }
  })
})

/**
 * [功能说明]
 * 当前选中的甘特块对象引用。
 */
const selectedBar = computed<ProcessedGanttBar | null>(() => {
  if (!selectedBarId.value) return null
  for (const row of processedGanttRows.value) {
    const found = row.bars.find((b) => b.id === selectedBarId.value)
    if (found) return found
  }
  return null
})

/**
 * 点击甘特块选择事件 handlers
 */
const handleSelectBar = (bar: ProcessedGanttBar) => {
  selectedBarId.value = bar.id
  selectedSatNorad.value = bar.satNorad
}

/**
 * 选中卫星行时高亮
 */
const selectSatelliteRow = (sat: SatelliteMatrix) => {
  selectedSatNorad.value = sat.norad
  const row = processedGanttRows.value.find((r) => r.norad === sat.norad)
  if (row && row.bars.length > 0) {
    selectedBarId.value = row.bars[0].id
  }
}

/**
 * 调整刻度倍率
 */
const changeScale = (delta: number) => {
  timeScaleFactor.value = Math.min(Math.max(timeScaleFactor.value * delta, 0.5), 3.0)
}

const resetScale = () => {
  timeScaleFactor.value = 1.0
}

// 监听生命周期与Props变动
onMounted(() => {
  loadMatrixData()
})

watch(
  () => props.matrixData,
  () => {
    if (props.matrixData) {
      internalMatrixData.value = props.matrixData
    }
  }
)
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
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
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
      }
    }
  }

  /* 2. 主体左-中-右三栏结构 */
  .gantt-main-body {
    display: flex;
    flex: 1;
    overflow: hidden;
    position: relative;

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
      overflow: auto; /* 支持上下左右二维滚动 */
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
                font-family: monospace;
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

              .sat-meta-sub {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-top: 4px;
                font-size: 10px;
                color: #64748b;

                .lane-count-tag {
                  color: #38bdf8;
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
              }

              /* 具体的甘特块 Gantt Bar */
              .gantt-bar-item {
                position: absolute;
                height: 25px;
                border-radius: 4px;
                padding: 0 6px;
                cursor: pointer;
                box-sizing: border-box;
                display: flex;
                align-items: center;
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
                  outline: 2px solid #ffffff;
                  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
                  z-index: 5;
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
                  align-items: center;
                  justify-content: center;
                  font-size: 11px;
                  width: 100%;
                  height: 100%;

                  .bar-icon-only {
                    font-size: 12px;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    user-select: none;
                  }
                }
              }
            }
          }
        }
      }
    }

    /* 2.3 右侧栏 Right Detail Panel (选中的干扰武器与交战分析明细) */
    .gantt-sidebar-right {
      width: 320px;
      min-width: 300px;
      background-color: #0f172a;
      border-left: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      padding: 12px;
      overflow-y: auto;

      .panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #38bdf8;
        font-size: 14px;
        font-weight: 700;
        padding-bottom: 10px;
        border-bottom: 1px solid #1e293b;
        margin-bottom: 12px;
      }

      .panel-content-body {
        display: flex;
        flex-direction: column;
        gap: 12px;

        .status-banner-card {
          padding: 10px;
          border-radius: 6px;
          font-size: 12px;

          .banner-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-weight: 600;
          }

          &.status-normal {
            background-color: rgba(16, 185, 129, 0.15);
            border: 1px solid #10b981;
            color: #34d399;
          }
          &.status-sat-struck {
            background-color: rgba(239, 68, 68, 0.15);
            border: 1px solid #ef4444;
            color: #f87171;
          }
          &.status-rec-struck {
            background-color: rgba(245, 158, 11, 0.15);
            border: 1px solid #f59e0b;
            color: #fbbf24;
          }
          &.status-both-struck {
            background-color: rgba(147, 51, 234, 0.2);
            border: 1px solid #9333ea;
            color: #c084fc;
          }
        }

        .info-section {
          background-color: #162032;
          border: 1px solid #233148;
          border-radius: 6px;
          padding: 10px;

          .section-title {
            font-size: 12px;
            font-weight: 600;
            color: #94a3b8;
            margin-bottom: 8px;
          }

          .info-grid {
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: 12px;

            .info-row {
              display: flex;
              justify-content: space-between;

              &.align-center {
                align-items: center;
              }

              &.vertical-stack {
                flex-direction: column;
                align-items: flex-start;
                gap: 4px;
                margin-bottom: 4px;
              }

              .label {
                color: #64748b;
              }

              .val {
                color: #cbd5e1;
                font-weight: 500;

                &.highlight-cyan {
                  color: #38bdf8;
                }
                &.danger-text {
                  color: #f87171;
                }
                &.success-text {
                  color: #34d399;
                }
                &.warning-text {
                  color: #fbbf24;
                }
                &.time-font {
                  font-family: monospace;
                }
              }

              /* 突出显示时间的专门发光数码框 */
              .highlight-time-box {
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid #f59e0b;
                box-shadow: 0 0 10px rgba(245, 158, 11, 0.35);
                color: #fbbf24 !important;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                font-weight: 700;
                padding: 4px 8px;
                border-radius: 4px;
                letter-spacing: 0.5px;
              }

              /* 目标卫星与关联接收站的突出高亮 Badge 卡片 */
              .highlight-box {
                width: 100%;
                padding: 8px 10px;
                border-radius: 6px;
                display: flex;
                flex-direction: column;
                gap: 3px;
                box-sizing: border-box;
                transition: all 0.2s ease;

                .highlight-name {
                  font-size: 13px;
                  font-weight: 700;
                  letter-spacing: 0.3px;
                }

                .highlight-sub {
                  font-size: 11px;
                  opacity: 0.85;
                  font-family: monospace;
                  word-break: break-all;
                }

                &.sat-highlight-box {
                  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.08) 100%);
                  border: 1px dashed #38bdf8;
                  box-shadow: 0 0 12px rgba(56, 189, 248, 0.3);
                  color: #7dd3fc;

                  .highlight-name {
                    color: #38bdf8;
                    text-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
                  }
                }

                &.rec-highlight-box {
                  background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(147, 51, 234, 0.08) 100%);
                  border: 1px dashed #a855f7;
                  box-shadow: 0 0 12px rgba(168, 85, 247, 0.3);
                  color: #e9d5ff;

                  .highlight-name {
                    color: #c084fc;
                    text-shadow: 0 0 8px rgba(168, 85, 247, 0.6);
                  }
                }

                /* 时间窗口整块包覆高亮 Card */
                &.time-highlight-card {
                  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.08) 100%);
                  border: 1px dashed #f59e0b;
                  box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
                  color: #fef08a;

                  .highlight-label {
                    font-size: 11px;
                    color: #fcd34d;
                    opacity: 0.9;
                  }

                  .highlight-time-val {
                    font-size: 13px;
                    font-weight: 700;
                    color: #fbbf24;
                    font-family: 'Consolas', 'Monaco', monospace;
                    letter-spacing: 0.5px;
                    text-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
                    margin-top: 2px;
                  }
                }
              }
            }
          }

          .weapons-list {
            display: flex;
            flex-direction: column;
            gap: 8px;

            .weapon-detail-card {
              background-color: #1e2942;
              border: 1px solid #334155;
              border-radius: 4px;
              padding: 8px;

              .w-card-header {
                display: flex;
                justify-content: space-between;
                font-size: 12px;
                font-weight: 600;
                color: #f8fafc;
                margin-bottom: 4px;

                .w-country {
                  font-size: 10px;
                  color: #38bdf8;
                  background-color: rgba(56, 189, 248, 0.1);
                  padding: 1px 4px;
                  border-radius: 3px;
                }
              }

              .w-card-body {
                display: flex;
                flex-direction: column;
                gap: 4px;
                font-size: 11px;
                color: #94a3b8;

                .w-prop {
                  display: flex;
                  justify-content: space-between;
                }
              }
            }
          }

          .empty-weapon-tip {
            font-size: 11px;
            color: #64748b;
            font-style: italic;
          }
        }
      }

      .empty-panel-tip {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 60px;
        color: #475569;
        gap: 12px;
        text-align: center;
        padding: 20px;

        .tip-text {
          font-size: 12px;
          line-height: 1.5;
        }
      }
    }
  }
}
</style>
