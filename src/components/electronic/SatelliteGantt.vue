<template>
  <div class="satellite-gantt-dashboard dark-theme">
    <!-- 1. 顶部 Header 导航与功能控制栏 -->
    <div class="gantt-header">
      <div class="header-left">
        <div class="title-container">
          <span class="header-title glow-text">卫星过境与接收站打击态势甘特图</span>
          <span class="tech-tag">Vue3 + TS</span>
        </div>
        <div class="time-range-sub">
          <span class="label">时间跨度:</span>
          <span class="time-val">{{ chartStart }} ~ {{ chartEnd }} (UTC)</span>
        </div>
      </div>

      <div class="header-right">
        <!-- 搜索输入框 -->
        <el-input
          v-model="searchKeyword"
          placeholder="搜索卫星名称 / NORAD / 接收站..."
          prefix-icon="Search"
          clearable
          size="small"
          class="search-input"
        />

        <!-- 状态下拉筛选 -->
        <el-select v-model="statusFilter" placeholder="状态筛选" size="small" class="status-select">
          <el-option label="全部状态 (全部卫星)" value="ALL" />
          <el-option label="仅受打击卫星 (satelliteStatus=1)" value="STUCK_SAT" />
          <el-option label="仅受打击接收站 (strikeStatus=1)" value="STUCK_STATION" />
          <el-option label="仅正常过境窗口" value="NORMAL" />
        </el-select>

        <!-- 交战烈度按钮 -->
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

        <!-- 重置/刷新按钮 -->
        <el-button type="primary" icon="Refresh" size="small" circle class="refresh-btn" @click="fetchGanttData" />
      </div>
    </div>

    <!-- 2. 统计看板与图例说明 (Stat Bar & Legend) -->
    <div class="gantt-summary-bar">
      <div class="stat-cards">
        <div class="stat-card">
          <span class="stat-label">卫星总数:</span>
          <span class="stat-num glow-cyan">{{ totalSatCount }}</span>
        </div>
        <div class="stat-card alert-card">
          <span class="stat-label">受打击卫星:</span>
          <span class="stat-num alert-badge">{{ struckSatCount }} 颗</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">过境窗口总数:</span>
          <span class="stat-num glow-cyan">{{ totalWindowCount }}</span>
        </div>
        <div class="stat-card warning-card">
          <span class="stat-label">受打击过境窗口:</span>
          <span class="stat-num warning-badge">{{ struckWindowCount }} 个</span>
        </div>
      </div>

      <!-- 图例标识说明 -->
      <div class="gantt-legend">
        <span class="legend-title">图例标识:</span>
        <div class="legend-item">
          <span class="legend-dot normal-dot"></span>
          <span>正常过境窗口 (strikeStatus=0)</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot struck-dot"></span>
          <span>受到打击窗口 (strikeStatus=1)</span>
        </div>
        <div class="legend-item">
          <span class="legend-tag-destroyed">🚫 卫星毁瘫</span>
          <span>卫星被打击 (satelliteStatus=1)</span>
        </div>
      </div>
    </div>

    <!-- 3. 主体区域：左侧卫星目标列表 + 右侧 vue-ganttastic 甘特图 -->
    <div class="gantt-main-body" v-loading="loading">
      <div class="custom-gantt-wrapper">
        <!-- 左侧固定的卫星目标及打击状态专栏 -->
        <div class="satellite-info-column">
          <div class="column-header">
            <span class="title">卫星目标及打击状态</span>
            <span class="sub-title">NORAD / 类型</span>
          </div>
          <div class="column-list">
            <div
              v-for="row in filteredGanttRows"
              :key="row.norad"
              class="sat-row-card"
              :class="{ 'is-destroyed': row.satelliteStatus === 1 }"
            >
              <!-- 第一行：卫星名称与状态 Tag -->
              <div class="sat-card-top">
                <span class="sat-name">{{ row.name }}</span>
                <span v-if="row.satelliteStatus === 1" class="status-tag tag-destroyed">
                  <i class="el-icon-warning"></i> 毁瘫
                </span>
                <span v-else class="status-tag tag-normal"> <i class="el-icon-circle-check"></i> 正常 </span>
              </div>

              <!-- 第二行：NORAD 编号、类型及延迟 -->
              <div class="sat-card-meta">
                <span class="meta-norad">#{{ row.norad }}</span>
                <span class="meta-type">{{ row.satType || '通用通信' }}</span>
                <span v-if="row.delayMin > 0" class="meta-delay"> 延迟: {{ row.delayMin.toFixed(1) }}分 </span>
              </div>

              <!-- 第三行：打击源武器基地卡片 (若被打击或存在武器信息) -->
              <div v-if="row.weapons && row.weapons.length > 0" class="weapon-source-card">
                <div class="weapon-header">
                  <span class="weapon-title"> <i class="fire-icon">🔥</i> 打击源: {{ row.weapons[0].name }} </span>
                  <span class="weapon-type-badge">{{ row.weapons[0].type || '动能' }}</span>
                </div>
                <div class="weapon-coords">
                  位置: {{ row.weapons[0].latitude }}°N, {{ row.weapons[0].longitude }}°E | 射程:
                  {{ row.weapons[0].range }}km
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧 Vue-Ganttastic 甘特图区 -->
        <div class="gantt-chart-container">
          <g-gantt-chart
            :chart-start="chartStart"
            :chart-end="chartEnd"
            precision="day"
            bar-start="myStart"
            bar-end="myEnd"
            date-format="YYYY-MM-DD HH:mm:ss"
            theme="dark"
            :grid="true"
            :row-height="115"
          >
            <g-gantt-row v-for="row in filteredGanttRows" :key="row.norad" :label="''" :bars="row.bars">
              <template #bar-label="{ bar }">
                <div
                  class="custom-gantt-bar-item"
                  :class="bar.customClass"
                  :title="`接收站: ${bar.receiveName} | 窗口: ${bar.myStart} ~ ${bar.myEnd} | 状态: ${bar.strikeStatus === 1 ? '受到打击' : '正常'}`"
                >
                  <div class="bar-top-line">
                    <span class="bar-icon">{{ bar.strikeStatus === 1 ? '⚡' : '📡' }}</span>
                    <span class="bar-name">{{ bar.receiveName }}</span>
                    <span class="bar-time">{{ bar.startTimeShort }}</span>
                  </div>
                  <div class="bar-bottom-line">
                    <span class="bar-purpose">用途: 民 {{ bar.durationMinutes }}分钟</span>
                  </div>
                </div>
              </template>
            </g-gantt-row>
          </g-gantt-chart>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getMatrixList } from '@/api/electronic'
import type { SatelliteMatrix, Weapon } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'

// ==================== 自定义类型定义 ====================

/**
 * [类型用途]
 * 甘特图单条时间窗口（Bar）数据结构定义。
 *
 * [数据来源]
 * 从接口 satelliteMatrixList 中的 stationWindows 转换而来。
 *
 * [字段规则]
 * - myStart: 开始时间（格式为 YYYY-MM-DD HH:mm:ss）
 * - myEnd: 结束时间（格式为 YYYY-MM-DD HH:mm:ss）
 * - receiveId: 接收站 ID
 * - receiveName: 接收站名称
 * - strikeStatus: 接收站打击状态（0-未打击 1-被打击）
 * - durationMinutes: 持续分钟数
 * - ganttBarConfig: vue-ganttastic 所需的 bar 样式配置对象
 */
export interface GanttBarItem {
  myStart: string
  myEnd: string
  receiveId: string
  receiveName: string
  strikeStatus: number
  startTimeShort: string
  durationMinutes: number
  customClass: string
  weapons?: Weapon[] | null
  ganttBarConfig: {
    id: string
    label?: string
    hasHandles?: boolean
    style?: Record<string, string>
  }
}

/**
 * [类型用途]
 * 甘特图单行（对应一颗卫星）数据结构定义。
 *
 * [数据来源]
 * 从接口 satelliteMatrixList 根项转换。
 */
export interface GanttRowData {
  norad: number
  name: string
  satType: string
  delayMin: number
  satelliteStatus: number
  weapons: Weapon[]
  bars: GanttBarItem[]
}

// ==================== 响应式变量声明 ====================

// Pinia 状态树引用
const store = useLayoutStore()

// [变量用途]
// 数据加载状态控制标识
const loading = ref<boolean>(false)

// [变量用途]
// 交战烈度类型
type IntensityLevelType = '高烈度' | '中烈度' | '低烈度'
const intensityOptions: IntensityLevelType[] = ['高烈度', '中烈度', '低烈度']
const currentIntensity = ref<IntensityLevelType>('高烈度')

// [变量用途]
// 顶部搜索过滤关键字
const searchKeyword = ref<string>('')

// [变量用途]
// 状态下拉框筛选值 ('ALL' | 'STUCK_SAT' | 'STUCK_STATION' | 'NORMAL')
const statusFilter = ref<string>('ALL')

// [变量用途]
// 甘特图起止时间跨度
const chartStart = ref<string>('2026-07-28 00:00:00')
const chartEnd = ref<string>('2026-07-28 12:00:00')

// [变量用途]
// 解析生成的全部甘特图行数据集合
const ganttRows = ref<GanttRowData[]>([])

// ==================== 计算属性 ====================

/**
 * 统计总卫星数量
 */
const totalSatCount = computed(() => ganttRows.value.length)

/**
 * 统计受到打击的卫星数量 (satelliteStatus === 1)
 */
const struckSatCount = computed(() => {
  return ganttRows.value.filter((row) => row.satelliteStatus === 1).length
})

/**
 * 统计过境窗口总数
 */
const totalWindowCount = computed(() => {
  return ganttRows.value.reduce((acc, row) => acc + row.bars.length, 0)
})

/**
 * 统计受到打击的过境窗口数量 (strikeStatus === 1)
 */
const struckWindowCount = computed(() => {
  return ganttRows.value.reduce((acc, row) => {
    return acc + row.bars.filter((b) => b.strikeStatus === 1).length
  }, 0)
})

/**
 * 根据搜索关键字与下拉筛选过滤后的甘特图行数据
 */
const filteredGanttRows = computed(() => {
  return ganttRows.value.filter((row) => {
    // 1. 下拉状态筛选逻辑
    if (statusFilter.value === 'STUCK_SAT' && row.satelliteStatus !== 1) {
      return false
    }
    if (statusFilter.value === 'STUCK_STATION') {
      const hasStruckWindow = row.bars.some((b) => b.strikeStatus === 1)
      if (!hasStruckWindow) return false
    }
    if (statusFilter.value === 'NORMAL') {
      if (row.satelliteStatus === 1) return false
      const hasStruckWindow = row.bars.some((b) => b.strikeStatus === 1)
      if (hasStruckWindow) return false
    }

    // 2. 搜索关键字逻辑 (匹配卫星名, NORAD, 接收站名称)
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.trim().toLowerCase()
      const matchSatName = row.name.toLowerCase().includes(kw)
      const matchNorad = String(row.norad).includes(kw)
      const matchStation = row.bars.some((b) => b.receiveName.toLowerCase().includes(kw))

      return matchSatName || matchNorad || matchStation
    }

    return true
  })
})

// ==================== 业务逻辑函数 ====================

/**
 * [功能]
 * 计算两个 YYYY-MM-DD HH:mm:ss 格式字符串之间的耗时（分钟数）。
 *
 * @param startStr 开始时间
 * @param endStr 结束时间
 * @returns 分钟数 (保留1位小数)
 */
const calculateMinutes = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 5
  const s = new Date(startStr.replace(/-/g, '/')).getTime()
  const e = new Date(endStr.replace(/-/g, '/')).getTime()
  if (isNaN(s) || isNaN(e) || e <= s) return 5
  return Math.round(((e - s) / (1000 * 60)) * 10) / 10
}

/**
 * [功能]
 * 获取 Mock 兜底卫星打击矩阵数据。
 */
const getMockSatelliteMatrix = (): SatelliteMatrix[] => {
  return [
    {
      norad: 60419,
      name: 'CAPELLA-13',
      satType: '地球观测',
      delayMin: 0.0,
      satelliteStatus: 0,
      weapons: [],
      stationWindows: [
        {
          receiveId: 'rec_1',
          receiveName: '爱尔兰Ireland',
          peakWindow: '2026-07-28 00:23:41',
          endWindow: '2026-07-28 00:32:41',
          strikeStatus: 0,
          weapons: [],
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
          receiveId: 'rec_2',
          receiveName: '夏威夷Kapolei',
          peakWindow: '2026-07-28 05:40:48',
          endWindow: '2026-07-28 05:47:38',
          strikeStatus: 0,
          weapons: [],
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
          receiveId: 'rec_3',
          receiveName: '俄勒冈Oregon',
          peakWindow: '2026-07-28 01:32:57',
          endWindow: '2026-07-28 01:40:27',
          strikeStatus: 0,
          weapons: [],
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
          id: 'w1',
          name: 'xxxASAT导弹基地',
          country: '中国',
          type: '动能',
          latitude: 20.017,
          longitude: 110.349,
          range: 1500.0,
        },
      ],
      stationWindows: [
        {
          receiveId: 'rec_4',
          receiveName: '澳大利亚达博',
          peakWindow: '2026-07-28 00:43:24',
          endWindow: '2026-07-28 00:49:36',
          strikeStatus: 1,
          weapons: [],
        },
        {
          receiveId: 'rec_3',
          receiveName: '俄勒冈Oregon',
          peakWindow: '2026-07-28 02:17:28',
          endWindow: '2026-07-28 02:23:20',
          strikeStatus: 1,
          weapons: [],
        },
        {
          receiveId: 'rec_2',
          receiveName: '夏威夷Kapolei',
          peakWindow: '2026-07-28 05:41:52',
          endWindow: '2026-07-28 05:47:46',
          strikeStatus: 1,
          weapons: [],
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
          id: 'w2',
          name: 'xxxASAT导弹基地',
          country: '中国',
          type: '动能',
          latitude: 20.017,
          longitude: 110.349,
          range: 1500.0,
        },
      ],
      stationWindows: [
        {
          receiveId: 'rec_1',
          receiveName: '爱尔兰Ireland',
          peakWindow: '2026-07-28 01:30:18',
          endWindow: '2026-07-28 01:38:30',
          strikeStatus: 1,
          weapons: [],
        },
        {
          receiveId: 'rec_4',
          receiveName: '澳大利亚达博',
          peakWindow: '2026-07-28 03:23:28',
          endWindow: '2026-07-28 03:30:40',
          strikeStatus: 1,
          weapons: [],
        },
        {
          receiveId: 'rec_2',
          receiveName: '夏威夷Kapolei',
          peakWindow: '2026-07-28 06:15:47',
          endWindow: '2026-07-28 06:23:17',
          strikeStatus: 1,
          weapons: [],
        },
      ],
    },
  ]
}

/**
 * [功能]
 * 请求 API 并更新甘特图数据。
 *
 * [处理规则]
 * - 调用 getMatrixList 发送 POST 请求
 * - 若无数据或报错，使用 Mock 补全展示
 * - 解析 peakWindow 与 endWindow 格式化为 GanttBarItem
 */
const fetchGanttData = async () => {
  loading.value = true
  try {
    const currentTaskIdStr = String(store.activedTask?.id || 'scen-001')
    const res = await getMatrixList({
      norad: 57693,
      taskId: currentTaskIdStr,
      intensityLevel: currentIntensity.value,
    })

    let matrixList: SatelliteMatrix[] = []
    if (res?.data?.satelliteMatrixList?.length) {
      matrixList = res.data.satelliteMatrixList
    } else {
      matrixList = getMockSatelliteMatrix()
    }

    processMatrixData(matrixList)
  } catch (error) {
    console.warn('获取甘特图矩阵接口数据异常，切换为默认场景数据:', error)
    processMatrixData(getMockSatelliteMatrix())
  } finally {
    loading.value = false
  }
}

/**
 * [功能]
 * 将 SatelliteMatrix 数组转换为甘特图行与 Bar 模型。
 */
const processMatrixData = (matrixList: SatelliteMatrix[]) => {
  const rows: GanttRowData[] = []
  let minTime = '2026-07-28 23:59:59'
  let maxTime = '2026-07-28 00:00:00'

  matrixList.forEach((sat) => {
    const bars: GanttBarItem[] = []

    sat.stationWindows.forEach((win, index) => {
      const pWin = win.peakWindow || '2026-07-28 00:00:00'
      const eWin = win.endWindow || '2026-07-28 00:10:00'

      if (pWin < minTime) minTime = pWin
      if (eWin > maxTime) maxTime = eWin

      const duration = calculateMinutes(pWin, eWin)
      const timeShort = pWin.split(' ')[1] || pWin

      // 颜色根据 strikeStatus 判断: 1 为受到打击（红色发光），0 为正常（青蓝发光）
      const isStruck = win.strikeStatus === 1
      const barStyle = isStruck
        ? {
            background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.4), rgba(255, 77, 79, 0.75))',
            borderRadius: '6px',
            border: '1px solid #ff4d4f',
            boxShadow: '0 0 12px rgba(255, 77, 79, 0.7)',
            color: '#ffffff',
          }
        : {
            background: 'linear-gradient(135deg, rgba(0, 184, 148, 0.35), rgba(0, 206, 201, 0.65))',
            borderRadius: '6px',
            border: '1px solid #00cec9',
            boxShadow: '0 0 10px rgba(0, 206, 201, 0.5)',
            color: '#ffffff',
          }

      bars.push({
        myStart: pWin,
        myEnd: eWin,
        receiveId: win.receiveId,
        receiveName: win.receiveName,
        strikeStatus: win.strikeStatus,
        startTimeShort: timeShort,
        durationMinutes: duration,
        customClass: isStruck ? 'bar-struck' : 'bar-normal',
        weapons: win.weapons,
        ganttBarConfig: {
          id: `bar_${sat.norad}_${index}`,
          hasHandles: false,
          style: barStyle,
        },
      })
    })

    rows.push({
      norad: sat.norad,
      name: sat.name,
      satType: sat.satType || '通用通信',
      delayMin: sat.delayMin || 0,
      satelliteStatus: sat.satelliteStatus || 0,
      weapons: sat.weapons || [],
      bars,
    })
  })

  // 设定图表展示的起止时间范围
  chartStart.value = '2026-07-28 00:00:00'
  chartEnd.value = '2026-07-28 11:30:00'
  ganttRows.value = rows
}

/**
 * [功能]
 * 烈度切换回调处理
 */
const handleIntensityChange = (level: IntensityLevelType) => {
  currentIntensity.value = level
  fetchGanttData()
}

// 页面挂载完成即加载数据
onMounted(() => {
  fetchGanttData()
})
</script>

<style scoped lang="scss">
.satellite-gantt-dashboard {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 100px);
  background: #090d16;
  color: #e6f7ff;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 12px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* 1. Header 导航与功能控制栏 */
  .gantt-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: rgba(15, 23, 42, 0.75);
    border: 1px solid rgba(0, 206, 201, 0.25);
    border-radius: 8px;
    margin-bottom: 10px;

    .header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .title-container {
        display: flex;
        align-items: center;
        gap: 10px;

        .header-title {
          font-size: 18px;
          font-weight: 700;
          color: #00f2fe;
          text-shadow: 0 0 10px rgba(0, 242, 254, 0.5);
        }

        .tech-tag {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(0, 206, 201, 0.15);
          color: #00cec9;
          border: 1px solid rgba(0, 206, 201, 0.4);
        }
      }

      .time-range-sub {
        font-size: 12px;
        color: #8c9ba5;

        .time-val {
          color: #40a9ff;
          margin-left: 6px;
          font-family: monospace;
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;

      .search-input {
        width: 240px;
        :deep(.el-input__wrapper) {
          background: rgba(6, 15, 30, 0.8);
          border: 1px solid rgba(0, 206, 201, 0.3);
          color: #fff;
          box-shadow: none;
        }
      }

      .status-select {
        width: 210px;
        :deep(.el-input__wrapper) {
          background: rgba(6, 15, 30, 0.8);
          border: 1px solid rgba(0, 206, 201, 0.3);
          color: #fff;
          box-shadow: none;
        }
      }

      .intensity-group {
        display: flex;
        gap: 4px;
        background: rgba(6, 15, 30, 0.8);
        padding: 3px;
        border-radius: 6px;
        border: 1px solid rgba(0, 206, 201, 0.3);

        .nav-tab-btn {
          background: transparent;
          border: none;
          color: #8c9ba5;
          padding: 4px 10px;
          font-size: 12px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;

          &.active {
            background: #00cec9;
            color: #000;
            font-weight: bold;
            box-shadow: 0 0 8px rgba(0, 206, 201, 0.6);
          }
        }
      }

      .refresh-btn {
        background: rgba(0, 206, 201, 0.2);
        border: 1px solid #00cec9;
        color: #00cec9;
        &:hover {
          background: #00cec9;
          color: #000;
        }
      }
    }
  }

  /* 2. 统计看板与图例说明 (Stat Bar & Legend) */
  .gantt-summary-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 16px;
    background: rgba(13, 22, 40, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    margin-bottom: 12px;

    .stat-cards {
      display: flex;
      align-items: center;
      gap: 16px;

      .stat-card {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #a0aec0;

        .stat-num {
          font-family: monospace;
          font-size: 15px;
          font-weight: bold;

          &.glow-cyan {
            color: #00f2fe;
          }

          &.alert-badge {
            color: #ff4d4f;
            background: rgba(255, 77, 79, 0.2);
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid rgba(255, 77, 79, 0.5);
            box-shadow: 0 0 6px rgba(255, 77, 79, 0.4);
          }

          &.warning-badge {
            color: #ff9f43;
            background: rgba(255, 159, 67, 0.2);
            padding: 2px 8px;
            border-radius: 4px;
            border: 1px solid rgba(255, 159, 67, 0.5);
          }
        }
      }
    }

    .gantt-legend {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: #cbd5e0;

      .legend-title {
        color: #718096;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;

          &.normal-dot {
            background: #00b894;
            box-shadow: 0 0 6px #00b894;
          }

          &.struck-dot {
            background: #ff4d4f;
            box-shadow: 0 0 6px #ff4d4f;
          }
        }

        .legend-tag-destroyed {
          background: rgba(231, 76, 60, 0.3);
          color: #ff4d4f;
          border: 1px solid #ff4d4f;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: bold;
        }
      }
    }
  }

  /* 3. 甘特图主体结构 (Custom Gantt Layout) */
  .gantt-main-body {
    flex: 1;
    overflow-y: auto;
    background: rgba(10, 17, 30, 0.9);
    border: 1px solid rgba(0, 206, 201, 0.15);
    border-radius: 8px;
    padding: 8px;

    .custom-gantt-wrapper {
      display: flex;
      width: 100%;
      min-height: 500px;

      /* 左侧固定的卫星目标及打击状态专栏 */
      .satellite-info-column {
        width: 300px;
        flex-shrink: 0;
        border-right: 1px solid rgba(255, 255, 255, 0.1);
        background: #0c1424;
        display: flex;
        flex-direction: column;

        .column-header {
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          background: #080d18;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 13px;
          font-weight: bold;
          color: #00f2fe;

          .sub-title {
            font-size: 11px;
            color: #718096;
            font-weight: normal;
          }
        }

        .column-list {
          display: flex;
          flex-direction: column;

          .sat-row-card {
            height: 115px;
            box-sizing: border-box;
            padding: 8px 10px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
            background: rgba(15, 23, 42, 0.5);
            transition: all 0.2s;

            &.is-destroyed {
              background: rgba(231, 76, 60, 0.08);
              border-left: 3px solid #ff4d4f;
            }

            .sat-card-top {
              display: flex;
              justify-content: space-between;
              align-items: center;

              .sat-name {
                font-size: 13px;
                font-weight: bold;
                color: #e2e8f0;
              }

              .status-tag {
                font-size: 11px;
                padding: 1px 6px;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 3px;

                &.tag-destroyed {
                  background: rgba(231, 76, 60, 0.25);
                  color: #ff4d4f;
                  border: 1px solid rgba(255, 77, 79, 0.5);
                }

                &.tag-normal {
                  background: rgba(0, 184, 148, 0.25);
                  color: #00b894;
                  border: 1px solid rgba(0, 184, 148, 0.5);
                }
              }
            }

            .sat-card-meta {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 11px;

              .meta-norad {
                color: #718096;
                font-family: monospace;
              }

              .meta-type {
                background: rgba(0, 206, 201, 0.15);
                color: #00cec9;
                padding: 0 4px;
                border-radius: 3px;
              }

              .meta-delay {
                color: #ff9f43;
                font-weight: bold;
              }
            }

            .weapon-source-card {
              margin-top: 2px;
              padding: 4px 6px;
              background: rgba(183, 28, 28, 0.35);
              border: 1px solid rgba(255, 77, 79, 0.4);
              border-radius: 4px;
              font-size: 10px;

              .weapon-header {
                display: flex;
                justify-content: space-between;
                align-items: center;

                .weapon-title {
                  color: #ff7875;
                  font-weight: bold;
                }

                .weapon-type-badge {
                  background: #ff4d4f;
                  color: #fff;
                  padding: 0 3px;
                  border-radius: 2px;
                  font-size: 9px;
                }
              }

              .weapon-coords {
                color: #ffccc7;
                font-size: 9px;
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            }
          }
        }
      }

      /* 右侧 Vue-Ganttastic 甘特图区 */
      .gantt-chart-container {
        flex: 1;
        overflow-x: auto;
        background: #090e1a;

        :deep(.g-gantt-chart) {
          background: transparent;

          .g-gantt-row {
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);

            .g-gantt-row-label {
              display: none !important; /* 隐藏原生的左侧文本，使用自定义专栏 */
            }
          }
        }

        .custom-gantt-bar-item {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 2px 6px;
          box-sizing: border-box;
          font-size: 11px;
          cursor: pointer;

          .bar-top-line {
            display: flex;
            align-items: center;
            gap: 4px;
            font-weight: bold;

            .bar-name {
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }

            .bar-time {
              font-size: 10px;
              opacity: 0.9;
              font-family: monospace;
              margin-left: auto;
            }
          }

          .bar-bottom-line {
            font-size: 10px;
            opacity: 0.85;
            margin-top: 2px;
          }
        }
      }
    }
  }
}
</style>
