<template>
  <div class="app-container grid-bg">
    <!-- Top Sci-Fi Header -->
    <header class="app-header tech-panel">
      <div class="header-left">
        <div class="header-logo glow-text-cyan">电子对抗推演模拟</div>

        <!-- View Switcher Tabs -->
        <nav class="nav-tabs">
          <button class="tab-btn" :class="{ active: currentView === 'SANDBOX' }" @click="currentView = 'SANDBOX'">
            🖥️ 推演主沙盘
          </button>
          <button class="tab-btn" :class="{ active: currentView === 'AAR' }" @click="currentView = 'AAR'">
            📊 战后效能复盘
          </button>
        </nav>
      </div>

      <!-- Simulation Status Indicators -->
      <div class="header-right">
        <div class="header-right-item">
          <span class="label-text">推演时钟:</span>
          <span class="digital-font time-value glow-text-cyan">{{ formatTime(simTime) }}</span>
        </div>
        <div class="header-right-item">
          <span class="label-text">红方预算消耗:</span>
          <span class="digital-font budget-value glow-text-red"
            >${{ formatNumber(budgetSpent) }} / ${{ formatNumber(maxBudget) }}</span
          >
        </div>
        <div class="header-right-item">
          <span class="label-text">数据库状态:</span>
          <span class="db-status-container">
            <span :class="['status-dot', isDbInitialized ? 'status-green' : 'status-red']"></span>
            <span class="status-text digital-font">{{ isDbInitialized ? 'SQLite-Wasm (OPFS)' : '连接中...' }}</span>
          </span>
        </div>
        <el-button size="small" type="success" plain @click="openTacticalMatrix"> 📐 战术决策矩阵 </el-button>
        <el-button size="small" type="primary" plain @click="openSqlSandbox"> 🗄️ SQL 数据沙箱 </el-button>
      </div>
    </header>

    <!-- Main Workspace Grid -->
    <div v-if="currentView === 'SANDBOX'" class="sandbox-workspace">
      <!-- Left Panel: Control Panel (25%) -->
      <section class="left-sidebar">
        <!-- Controls Panel -->
        <div class="tech-panel config-panel">
          <div class="panel-header">
            <span>战术参数设定</span>
          </div>
          <el-form label-position="left" label-width="90px" class="config-form">
            <el-form-item label="交战烈度:" class="form-item-intensity">
              <el-select v-model="conflictIntensity" size="small" class="form-input-full">
                <el-option label="低烈度 (软杀伤)" value="LOW" />
                <el-option label="中烈度 (软/定向能)" value="MEDIUM" />
                <el-option label="高烈度 (动能全开)" value="HIGH" />
              </el-select>
            </el-form-item>
            <el-form-item label="压制时长:" class="form-item-suppression">
              <el-input-number v-model="suppressionTime" size="small" :min="10" class="form-input-full">
                <template #suffix>
                  <span>分钟</span>
                </template>
              </el-input-number>
            </el-form-item>
            <el-form-item label="代价上限:" class="form-item-budget">
              <el-input v-model="maxBudget" size="small" class="form-input-full" placeholder="输入预算">
                <template #prefix>$</template>
              </el-input>
            </el-form-item>
            <el-form-item label="目标卫星:" class="form-item-redline">
              <el-select v-model="politicalRedline" size="small" class="form-input-full">
                <el-option label="军用(严格)" value="STRICT" />
                <el-option label="军用(有限民用)" value="LOCAL" />
                <el-option label="全部(不计代价)" value="TOTAL" />
              </el-select>
            </el-form-item>
            <el-form-item label="步长跨幅:" class="form-item-step">
              <el-select v-model="stepMode" size="small" class="form-input-full">
                <el-option :label="`自适应 (${autoCalculatedStep}min/步)`" value="AUTO" />
                <el-option label="1 分钟/步" :value="1" />
                <el-option label="5 分钟/步" :value="5" />
                <el-option label="15 分钟/步" :value="15" />
                <el-option label="30 分钟/步" :value="30" />
                <el-option label="60 分钟/步" :value="60" />
              </el-select>
            </el-form-item>
            <div class="action-btn-row">
              <el-button type="primary" size="small" class="flex-btn" @click="loadMockScenario">
                ⚡ 初始化数据
              </el-button>
              <el-button
                type="success"
                size="small"
                class="flex-btn"
                :disabled="!isScenarioLoaded"
                @click="runOrbitCalculation"
              >
                🛰️ 轨道视算
              </el-button>
            </div>

            <el-tooltip
              :disabled="!isScenarioLoaded || hasOrbitData"
              content="缺少卫星轨道视算数据，请先点击【🛰️ 轨道视算】"
              placement="top"
            >
              <div style="width: 100%">
                <el-button
                  :type="isPlaying ? 'warning' : 'danger'"
                  size="small"
                  class="submit-btn font-bold-btn"
                  :disabled="!isScenarioLoaded || !hasOrbitData"
                  @click="togglePlay"
                >
                  {{ isPlaying ? '⏸ 暂停自动推演' : '▶ 开始交战推演' }}
                </el-button>
              </div>
            </el-tooltip>

            <el-button
              type="success"
              size="small"
              class="submit-btn font-bold-btn"
              :disabled="simMinutes < suppressionTime"
              @click="savePlan"
            >
              💾 保存方案用于复盘
            </el-button>
          </el-form>

          <!-- Slider representing minutes of the simulation -->
          <div class="time-slider-container">
            <div class="slider-header">
              <span class="label-text">推演步长演进:</span>
              <span class="time-progress digital-font"
                >{{ simMinutes }} / {{ suppressionTime }} min ({{ effectiveStep }}m/步)</span
              >
            </div>
            <el-slider
              v-model="simMinutes"
              :min="0"
              :max="suppressionTime"
              :step="effectiveStep"
              :disabled="!isScenarioLoaded || !hasOrbitData"
              @change="onTimeStepChange"
            />
          </div>
        </div>

        <!-- Real-time Overhead Matrix Panel -->
        <div class="tech-panel overhead-panel">
          <div class="panel-header">
            <span>⏱️ 延时开销矩阵 (T+{{ simMinutes }}m)</span>
            <el-button size="small" type="primary" link @click="openTacticalMatrix"> 查看全量矩阵 ➔ </el-button>
          </div>
          <div class="overhead-panel-content">
            <el-table
              v-if="overheadRealtimeData.length > 0"
              :data="overheadRealtimeData"
              size="small"
              border
              stripe
              style="width: 100%"
              class="dark-subtable mini-overhead-table"
            >
              <el-table-column prop="source_name" label="起点" width="95" show-overflow-tooltip />
              <el-table-column prop="target_name" label="终点" width="95" show-overflow-tooltip />
              <el-table-column label="叠加(s)" width="75" align="center">
                <template #default="{ row }">
                  <span
                    v-if="row.extra_delay > 0"
                    :class="row.link_status === 'DESTROYED' ? 'text-danger font-bold' : 'text-orange font-bold'"
                  >
                    +{{ row.extra_delay }}s
                  </span>
                  <span v-else class="text-gray">0s</span>
                </template>
              </el-table-column>
              <el-table-column label="总开销" width="75" align="center">
                <template #default="{ row }">
                  <span :class="row.extra_delay > 0 ? 'text-danger font-bold' : 'text-cyan font-bold'">
                    {{ row.total_overhead }}s
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="状态" align="center" min-width="85">
                <template #default="{ row }">
                  <el-tag :type="getStatusType(row.link_status)" size="small" effect="dark">
                    {{ getStatusText(row.link_status) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
            <div v-else class="empty-overhead-message">
              <span>暂无链路开销数据</span>
              <span class="text-gray" style="font-size: 11px; margin-top: 4px">点击“初始化数据”解算算力矩阵</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Center Panel: Wargaming 3D/2D Topology (50%) -->
      <section class="center-viewport tech-panel">
        <div class="panel-header">
          <span>空天地立体对抗网络拓扑视口</span>
          <div class="side-tags-row">
            <span class="side-tag blue-side">蓝方全链路</span>
            <span class="side-tag red-side">红方干扰阵地</span>
          </div>
        </div>

        <!-- Network Topology Canvas (3D Force Graph) -->
        <div class="canvas-container">
          <Battlefield3D v-if="isScenarioLoaded" :nodes="assets" :links="links" @select-node="selectEntity" />
          <div v-else class="empty-canvas-message">请在左侧点击“初始化数据”载入推演场景</div>
        </div>
      </section>

      <!-- Right Panel: BDA Dashboard (25%) -->
      <section class="right-sidebar">
        <!-- Radar Chart -->
        <div class="tech-panel radar-card">
          <div class="panel-header">
            <span>综合效能动态评估</span>
          </div>
          <div ref="smallRadarChartRef" class="small-radar-container"></div>
        </div>

        <!-- Weapon Assignment Table -->
        <div class="tech-panel weapon-assignment-card">
          <WeaponAssignmentTable :currentTime="simTime" />
        </div>

        <!-- Inspector Panel -->
        <div class="tech-panel inspector-panel">
          <div class="panel-header probe-tabs-header">
            <span class="probe-tab-title" :class="{ active: probeTab === 'MATRIX' }" @click="probeTab = 'MATRIX'">
              📐 矩阵微型探针 (T+{{ simMinutes }}m)
            </span>
            <span class="tab-divider">|</span>
            <span class="probe-tab-title" :class="{ active: probeTab === 'PROBE' }" @click="probeTab = 'PROBE'">
              🔍 实体信息探针
            </span>
          </div>

          <div v-if="probeTab === 'PROBE'" class="probe-content">
            <div v-if="selectedEntity" class="entity-detail">
              <div class="detail-header">
                <span class="entity-name glow-text-cyan">{{ selectedEntity.name || selectedEntity.id }}</span>
                <span :class="['entity-badge', selectedEntity.side === 'RED' ? 'badge-red' : 'badge-blue']">
                  {{ selectedEntity.side === 'RED' ? '红方攻击阵地' : '蓝方立体资产' }}
                </span>
              </div>

              <!-- Asset Detail Table -->
              <div v-if="selectedType === 'ASSET'" class="info-grid">
                <div>
                  <span class="label-dim">装备类型:</span>
                  <span class="digital-font">{{ selectedEntity.asset_class }}</span>
                </div>
                <div>
                  <span class="label-dim">功能定位:</span>
                  <span class="digital-font">{{ selectedEntity.func_type }}</span>
                </div>
                <div>
                  <span class="label-dim">所属层级:</span>
                  <span class="digital-font">{{ getLayerLabel(selectedEntity.layer) }}</span>
                </div>
                <div>
                  <span class="label-dim">抗干扰级:</span>
                  <span class="digital-font value-yellow">{{ selectedEntity.anti_jam_level }}</span>
                </div>
                <div>
                  <span class="label-dim">目标价值:</span>
                  <span class="digital-font value-cyan">{{ selectedEntity.base_priority }}</span>
                </div>
                <div class="grid-col-full">
                  <span class="label-dim">三维坐标:</span>
                  <span class="digital-font"
                    >L:{{ selectedEntity.lat ? selectedEntity.lat.toFixed(2) : '计算中' }},{{
                      selectedEntity.lng ? selectedEntity.lng.toFixed(2) : '计算中'
                    }}
                    A:{{ selectedEntity.alt || 0 }}km</span
                  >
                </div>
                <div class="grid-col-full">
                  <span class="label-dim">雷达发现:</span>
                  <span :class="['digital-font', selectedEntity.is_detected_by_red ? 'detected-red' : 'hidden-green']">
                    {{ selectedEntity.is_detected_by_red ? '已被锁定' : '隐蔽中' }}
                  </span>
                </div>
              </div>

              <!-- Weapon Detail Table -->
              <div v-if="selectedType === 'WEAPON'" class="info-grid">
                <div>
                  <span class="label-dim">杀伤分类:</span>
                  <span class="digital-font">{{ selectedEntity.category }}</span>
                </div>
                <div>
                  <span class="label-dim">毁伤机制:</span>
                  <span class="digital-font">{{ selectedEntity.kill_type }}</span>
                </div>
                <div>
                  <span class="label-dim">打击范围:</span>
                  <span class="digital-font">{{
                    selectedEntity.max_range === -1 ? '全球' : selectedEntity.max_range + ' km'
                  }}</span>
                </div>
                <div>
                  <span class="label-dim">库存弹药:</span>
                  <span class="digital-font">{{
                    selectedEntity.inventory === -1 ? '无限次' : selectedEntity.inventory
                  }}</span>
                </div>
                <div>
                  <span class="label-dim">单次耗费:</span>
                  <span class="digital-font value-green">${{ formatNumber(selectedEntity.action_cost) }}</span>
                </div>
                <div>
                  <span class="label-dim">升级红线:</span>
                  <span class="digital-font value-red">{{ selectedEntity.political_risk }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-inspector">点击 3D 拓扑节点，在此查看探针参数</div>
          </div>

          <div v-else-if="probeTab === 'MATRIX'" class="matrix-probe-content">
            <div v-if="matrixProbeAttacks.length > 0" class="matrix-micro-list">
              <div v-for="(item, index) in matrixProbeAttacks" :key="index" class="matrix-micro-item">
                <span class="weapon-name">{{ item.weapon_name }}</span>
                <span class="arrow">➔</span>
                <span class="target-name">{{ item.target_name }}</span>
                <span :class="['status-badge', item.is_successful ? 'badge-success' : 'badge-warning']">
                  {{ item.is_successful ? '击毁/压制' : '干扰中' }}
                </span>
              </div>
            </div>
            <div v-else class="empty-inspector">当前 Tick 暂无活动战术打击</div>
          </div>
        </div>
      </section>
    </div>

    <!-- AAR View -->
    <AfterActionReview v-else />

    <SqlSandboxDialog ref="sqlSandboxRef" />
    <TacticalMatrixDrawer ref="tacticalMatrixDrawerRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import { sqliteClient } from '@/db/sqlite-client'
import { seedMockData } from '@/db/seeder'
import Battlefield3D from '@/components/electronic/Battlefield3D.vue'
import WeaponAssignmentTable from '@/components/electronic/WeaponAssignmentTable.vue'
import AfterActionReview from '@/components/electronic/AfterActionReview.vue'
import SqlSandboxDialog from '@/components/electronic/SqlSandboxDialog.vue'
import TacticalMatrixDrawer from '@/components/electronic/TacticalMatrixDrawer.vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'
const store = useLayoutStore()
// App state variables
const isDbInitialized = ref(false)
const isScenarioLoaded = ref(false)
const hasOrbitData = ref(false)
const currentView = ref<'SANDBOX' | 'AAR'>('SANDBOX')
const sqlSandboxRef = ref<any>(null)
const tacticalMatrixDrawerRef = ref<any>(null)

// 实时延时开销矩阵数据
const overheadRealtimeData = ref<any[]>([])

// Probe Tab state (方案二)
const probeTab = ref<'PROBE' | 'MATRIX'>('MATRIX')
const matrixProbeAttacks = ref<any[]>([])

const openTacticalMatrix = () => {
  if (tacticalMatrixDrawerRef.value) {
    tacticalMatrixDrawerRef.value.openDrawer(baseStartTime.value)
  }
}

// Forms
const conflictIntensity = ref<'LOW' | 'MEDIUM' | 'HIGH'>('LOW') //推演烈度
const suppressionTime = ref(50) //压制总时长(分钟)
const maxBudget = ref(600000) //最大预算
const politicalRedline = ref<'STRICT' | 'LOCAL' | 'TOTAL'>('STRICT') //政治红线
const playSpeedMs = ref(1000) //播放速度
const stepMode = ref<'AUTO' | number>('AUTO') // 步长计算模式

const autoCalculatedStep = computed(() => {
  const dur = suppressionTime.value
  if (dur <= 60) return 1
  if (dur <= 300) return 5
  if (dur <= 1440) return 30
  return 60
})

const effectiveStep = computed(() => {
  if (stepMode.value === 'AUTO') return autoCalculatedStep.value
  return Number(stepMode.value) || 1
})

// Simulator state
const baseStartTime = ref(1781683200) // 基准开始时间戳
const simTime = ref(baseStartTime.value) // 当前时间
const budgetSpent = ref(0) //已消耗预算
const totalDelay = ref(30) // 总延迟
const simMinutes = ref(0) //推演分钟数

// Lists
const assets = ref<any[]>([]) //资产列表
const links = ref<any[]>([]) //链路列表

// Logs & Timeline
const logs = ref<any[]>([]) //日志
const filteredLogs = ref<any[]>([]) //过滤日志
const timelineContainer = ref<HTMLElement | null>(null) //时间线容器

// Selected element detail
const selectedEntity = ref<any>(null) //当前选中实体
const selectedType = ref<'ASSET' | 'WEAPON' | null>(null) //当前选中实体类型

// Time Engine Event Loop State
const isPlaying = ref(false) // 是否正在播放
const playIntervalId = ref<any>(null) // 播放定时器

// Small Radar Chart
const smallRadarChartRef = ref<HTMLDivElement | null>(null) //小雷达图容器

onMounted(async () => {
  addLog('CEMA 推演引擎启动...', 'info')
  try {
    await sqliteClient.init()
    isDbInitialized.value = true
    addLog('SQLite Wasm (OPFS) 线程初始化成功！', 'success')
    // 获取压制时长和战场范围
    const taskStartTime = store.activedTask?.beginDate
    const taskEndDate = store.activedTask?.endDate
    if (taskStartTime) {
      const startTime = Math.floor(new Date(taskStartTime).getTime() / 1000)
      if (!isNaN(startTime) && startTime > 0) {
        baseStartTime.value = startTime
        simTime.value = startTime
      }
    }
    if (taskStartTime && taskEndDate) {
      const startTime = Math.floor(new Date(taskStartTime).getTime() / 1000)
      const endTime = Math.floor(new Date(taskEndDate).getTime() / 1000)
      if (!isNaN(startTime) && !isNaN(endTime) && endTime > startTime) {
        const duration = endTime - startTime
        suppressionTime.value = Math.floor(duration / 60)
      }
    }

    // 更新数据库中场景的 start_time 和 end_time 为当前任务配置的时间
    const scen = await sqliteClient.query<any>("SELECT * FROM scenarios WHERE id = 'scen-001'")
    if (scen.length > 0) {
      const newEndTime = baseStartTime.value + suppressionTime.value * 60
      await sqliteClient.execute("UPDATE scenarios SET start_time = ?, end_time = ? WHERE id = 'scen-001'", [
        baseStartTime.value,
        newEndTime,
      ])
    }

    await refreshData()
  } catch (err: any) {
    addLog(`数据库加载失败: ${err.message}`, 'error')
  }
})

// Helper formatted methods (使用本地时区格式化)
const formatTime = (ts: number) => {
  const date = new Date(ts * 1000)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const formatNumber = (num: number | null | undefined) => {
  if (num === null || num === undefined) return '0'
  return num.toLocaleString()
}

const getLayerLabel = (layer: number) => {
  if (layer === 0) return '地基指挥层 (Ground)'
  if (layer === 1) return '雷达接收层 (Station)'
  if (layer === 2) return '天基卫星层 (Space)'
  return '未知'
}

const addLog = (message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const time = `T+${simMinutes.value}m`
  const logItem = { time, message, level, minute: simMinutes.value }
  logs.value.push(logItem)
  filterLogs()
}

const filterLogs = () => {
  // Show logs up to current simulated minute
  filteredLogs.value = logs.value.filter((l) => l.minute <= simMinutes.value)
  nextTick(() => {
    if (timelineContainer.value) {
      timelineContainer.value.scrollTop = timelineContainer.value.scrollHeight
    }
  })
}

watch(simMinutes, filterLogs)

const openSqlSandbox = () => {
  if (sqlSandboxRef.value) {
    sqlSandboxRef.value.openDialog()
  }
}

const refreshData = async () => {
  try {
    const scen = await sqliteClient.query<any>("SELECT * FROM scenarios WHERE id = 'scen-001'")
    if (scen.length > 0) {
      isScenarioLoaded.value = true
      baseStartTime.value = scen[0].start_time || baseStartTime.value
      simTime.value = baseStartTime.value + simMinutes.value * 60

      // 1. Calculate and update satellite positions for this time tick
      await sqliteClient.updateSatellitePositions(simTime.value)

      // 2. Fetch assets and weapons to merge as node objects
      const assetsList = await sqliteClient.query<any>('SELECT * FROM assets')
      const weaponsList = await sqliteClient.query<any>('SELECT * FROM weapons')

      const mappedAssets = assetsList.map((a) => {
        let x = undefined
        let y = undefined
        if (
          a.lat !== null &&
          a.lat !== undefined &&
          a.lat !== 0 &&
          a.lng !== null &&
          a.lng !== undefined &&
          a.lng !== 0
        ) {
          const CLAMP_BOUND = 190
          if (a.layer === 2) {
            // Global mapping for satellites: [-180, 180] -> [-190, 190] and [-90, 90] -> [-190, 190]
            x = (a.lng / 180.0) * CLAMP_BOUND
            y = (a.lat / 90.0) * CLAMP_BOUND
          } else {
            // Ground / Station layer mapping
            if (a.lng >= 118.0 && a.lng <= 124.0 && a.lat >= 21.0 && a.lat <= 27.0) {
              // 海峡局部主战区高精放大映射
              x = ((a.lng - 121.0) / 3.0) * 100
              y = ((a.lat - 24.0) / 3.0) * 100
            } else if (a.lng >= 70.0 && a.lng < 118.0) {
              // 大陆中西部红方大本营阵地
              x = -110 - ((118.0 - a.lng) / 48.0) * 60
              y = ((a.lat - 35.0) / 20.0) * 70
            } else {
              // 全球/同盟接收站 (North America, Europe, Australia 等)
              x = (a.lng / 180.0) * 170
              y = (a.lat / 90.0) * 150
            }
          }

          x = Math.max(-CLAMP_BOUND, Math.min(CLAMP_BOUND, x))
          y = Math.max(-CLAMP_BOUND, Math.min(CLAMP_BOUND, y))
        }
        return {
          ...a,
          fx: x,
          fy: y,
          fz: a.layer * 150 - 150,
        }
      })

      const weaponNodes = weaponsList.map((w) => {
        let lat = w.base_lat
        let lng = w.base_lng
        // If it's a cyber weapon with 0 coordinates, give it a default red side position
        if (lat === 0 || lng === 0) {
          lat = 39.9
          lng = 116.4
        }

        let x = undefined
        let y = undefined
        if (lat !== null && lat !== undefined && lat !== 0 && lng !== null && lng !== undefined && lng !== 0) {
          if (lng >= 118.0 && lng <= 124.0 && lat >= 21.0 && lat <= 27.0) {
            x = ((lng - 121.0) / 3.0) * 100
            y = ((lat - 24.0) / 3.0) * 100
          } else if (lng >= 70.0 && lng < 118.0) {
            x = -110 - ((118.0 - lng) / 48.0) * 60
            y = ((lat - 35.0) / 20.0) * 70
          } else {
            x = (lng / 180.0) * 170
            y = (lat / 90.0) * 150
          }

          const CLAMP_BOUND = 190
          x = Math.max(-CLAMP_BOUND, Math.min(CLAMP_BOUND, x))
          y = Math.max(-CLAMP_BOUND, Math.min(CLAMP_BOUND, y))
        }
        return {
          id: w.id,
          name: w.name,
          side: 'RED',
          layer: 0, // Ground
          asset_class: 'WEAPON',
          category: w.category,
          kill_type: w.kill_type,
          action_cost: w.action_cost,
          max_range: w.max_range,
          inventory: w.inventory,
          political_risk: w.political_risk,
          lat: lat,
          lng: lng,
          fx: x,
          fy: y,
          fz: -150,
        }
      })

      assets.value = [...mappedAssets, ...weaponNodes]

      // 3. Fetch active communication windows at this tick
      const linksList = await sqliteClient.query<any>(
        `
        SELECT * FROM communication_windows 
        WHERE ? BETWEEN window_start AND window_end
      `,
        [simTime.value]
      )

      const mappedLinks = linksList.map((l) => ({
        id: l.id,
        scenario_id: l.scenario_id,
        source: l.source_id,
        target: l.target_id,
        window_start: l.window_start,
        window_end: l.window_end,
        routing_converge_delay: l.routing_converge_delay,
        link_status: l.link_status,
      }))

      // 4. Fetch active engagements at this tick to draw links from weapons to targets
      const engagementLinks = await sqliteClient.query<any>(
        `
        SELECT e.weapon_id as source, a.id as target, 
               'ENGAGEMENT' as link_status
        FROM engagements e
        JOIN communication_windows cw ON e.target_window_id = cw.id
        JOIN assets a ON cw.target_id = a.id OR cw.source_id = a.id
        WHERE e.action_time = ?
        GROUP BY e.id
      `,
        [simTime.value]
      )

      links.value = [...mappedLinks, ...engagementLinks]

      const plans = await sqliteClient.query<any>("SELECT * FROM tactical_plans WHERE id = 'plan-001'")
      if (plans.length > 0) {
        budgetSpent.value = plans[0].total_cost
        totalDelay.value = plans[0].total_delay_achieved
      }

      updateSmallRadar()

      // 更新实时延时开销矩阵数据 (用于左侧 overhead-panel 实时监控展示)
      try {
        const matrixRes = await sqliteClient.generateMatrices('scen-001')
        overheadRealtimeData.value = matrixRes.overheadMatrix || []
      } catch (err) {
        console.error('实时解算延时开销矩阵失败:', err)
      }

      // 检查是否存在通过轨道视算生成的动态通信窗口数据
      const orbitCountRes = await sqliteClient.query<any>(
        "SELECT COUNT(*) as cnt FROM communication_windows WHERE id NOT LIKE 'link-static-%'"
      )
      hasOrbitData.value = (orbitCountRes[0]?.cnt || 0) > 0

      // 更新方案二右下角微型探针数据
      const activeAttacks = await sqliteClient.query<any>(
        `
        SELECT e.action_time, w.name as weapon_name, a.id as target_name, e.is_successful
        FROM engagements e
        JOIN weapons w ON e.weapon_id = w.id
        JOIN communication_windows cw ON e.target_window_id = cw.id
        JOIN assets a ON (cw.target_id = a.id OR cw.source_id = a.id)
        WHERE e.action_time = ?
        GROUP BY e.id
      `,
        [simTime.value]
      )
      matrixProbeAttacks.value = activeAttacks
    } else {
      isScenarioLoaded.value = false
      hasOrbitData.value = false
    }
  } catch (error) {
    console.error('Error refreshing data:', error)
  }
}

// Actions
const loadMockScenario = async () => {
  // 需求2：推演过程中如果点击初始化数据，立即停止推演，并将时间轴重置到初始时间
  if (isPlaying.value) {
    stopSimulationLoop()
    addLog('接收到重置操作，已停止正在运行的交战推演', 'warning')
  }

  // 重置时间轴到初始 0 分钟
  simMinutes.value = 0
  simTime.value = baseStartTime.value

  addLog('初始化数据...', 'info')
  try {
    const areaBounds = store.battleAreaBounds
    await seedMockData(sqliteClient, suppressionTime.value, baseStartTime.value, areaBounds)
    addLog('导入基础场景数据完成！正在进行初始轨道视算...', 'info')
    await sqliteClient.calculateWindows('scen-001')
    addLog('初始轨道视算完成！星地链路已生成。', 'success')
    logs.value = []
    await refreshData()

    ElNotification({
      title: '⚡ 战术场景初始化成功',
      message: '战场实体拓扑与基准星地链路视算解析完成！',
      type: 'success',
      duration: 3500,
    })
  } catch (error: any) {
    addLog(`场景初始化出错: ${error.message}`, 'error')
  }
}

const runOrbitCalculation = async () => {
  addLog('正在启动 satellite.js 轨道视算...', 'info')
  try {
    await sqliteClient.calculateWindows('scen-001')
    addLog('轨道计算视算完成！星地拓扑链路已生成。', 'success')
    await refreshData()

    ElNotification({
      title: '🛰️ SGP4 轨道视算完成',
      message: '全域天基低轨卫星过境视角与掩蔽角视线重新算毕！',
      type: 'info',
      duration: 3500,
    })
  } catch (error: any) {
    addLog(`轨道视算失败: ${error.message}`, 'error')
  }
}

const savePlan = async () => {
  if (!isScenarioLoaded.value) {
    ElMessage.warning('请先加载场景并进行交战推演！')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('请输入保存方案的名称:', '保存对抗方案', {
      confirmButtonText: '保存',
      cancelButtonText: '取消',
      inputPattern: /\S+/,
      inputErrorMessage: '方案名称不能为空',
    })

    if (!value) return

    // 1. 获取物理摧毁节点数
    const destroyedRes = await sqliteClient.query<any>(
      "SELECT COUNT(*) as cnt FROM assets WHERE anti_jam_level = 0 AND side = 'BLUE'"
    )
    const nodes_destroyed = destroyedRes[0]?.cnt || 0

    // 2. 获取最终链路阻断率
    const totalLinks = await sqliteClient.query<any>('SELECT COUNT(*) as cnt FROM communication_windows')
    const blockedLinks = await sqliteClient.query<any>(
      "SELECT COUNT(*) as cnt FROM communication_windows WHERE link_status IN ('JAMMED', 'DESTROYED')"
    )
    const tot = totalLinks[0]?.cnt || 0
    const blk = blockedLinks[0]?.cnt || 0
    const blockRate = tot > 0 ? Math.round((blk / tot) * 100) : 0

    // 3. 计算最终效能评估得分
    const blockScore = blockRate
    const controlScore = Math.max(30, Math.round(100 - (budgetSpent.value / maxBudget.value) * 50))
    const costEfficiency = Math.min(95, Math.round((totalDelay.value / (budgetSpent.value + 100)) * 6000))
    const selfInterference = Math.max(20, Math.round(100 - (budgetSpent.value > 50000 ? 40 : 15)))
    const final_score = Math.round((blockScore + controlScore + costEfficiency + selfInterference) / 4)

    // 4. 计算时序曲线数据 (与 AAR 取样计算一致)
    const timelineCollapseRatios: number[] = []
    const timelineCumulativeCosts: number[] = []
    const step = Math.max(1, Math.floor(suppressionTime.value / 25))
    for (let m = 0; m <= suppressionTime.value; m += step) {
      const t = baseStartTime.value + m * 60

      const linksRes = await sqliteClient.query<any>(
        `
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN link_status IN ('JAMMED', 'DESTROYED') THEN 1 ELSE 0 END) as blocked 
        FROM communication_windows 
        WHERE ? BETWEEN window_start AND window_end
      `,
        [t]
      )
      const totalCount = linksRes[0]?.total || 0
      const blockedCount = linksRes[0]?.blocked || 0
      const ratio = totalCount > 0 ? Math.round((blockedCount / totalCount) * 100) : 0
      timelineCollapseRatios.push(ratio)

      const costRes = await sqliteClient.query<any>(
        `
        SELECT SUM(w.action_cost) as total_cost 
        FROM engagements e
        JOIN weapons w ON e.weapon_id = w.id
        WHERE e.action_time <= ?
      `,
        [t]
      )
      const cost = costRes[0]?.total_cost || 0
      timelineCumulativeCosts.push(cost)
    }

    const planId = `plan-${Date.now()}`
    await sqliteClient.execute(
      `
      INSERT INTO tactical_plans (id, scenario_id, name, intensity_level, total_cost, total_delay_achieved, nodes_destroyed, final_score, timeline_collapse_ratios, timeline_cumulative_costs)
      VALUES (?, 'scen-001', ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        planId,
        value,
        conflictIntensity.value,
        budgetSpent.value,
        totalDelay.value,
        nodes_destroyed,
        final_score,
        JSON.stringify(timelineCollapseRatios),
        JSON.stringify(timelineCumulativeCosts),
      ]
    )

    ElMessage.success(`方案“${value}”已成功保存！请进入战后效能复盘大屏对比查看。`)
  } catch (err: any) {
    if (err !== 'cancel') {
      console.error(err)
      ElMessage.error(`方案保存失败: ${err.message || err}`)
    }
  }
}

const onTimeStepChange = async (val: any) => {
  simMinutes.value = val
  simTime.value = baseStartTime.value + val * 60

  if (isScenarioLoaded.value) {
    try {
      const SCENARIO_END_TIME = baseStartTime.value + suppressionTime.value * 60 // 与动态压制时长保持一致
      const res = await sqliteClient.allocateWeapons(
        conflictIntensity.value,
        simTime.value,
        'scen-001',
        SCENARIO_END_TIME
      )
      if (res && res.engagements_created > 0) {
        addLog(`进行交战解算：成功匹配 ${res.engagements_created} 次火力压制`, 'warning')
      }
      await refreshData()
    } catch (e: any) {
      addLog(`战术交战计算出错: ${e.message}`, 'error')
    }
  }
}

const togglePlay = () => {
  // 需求1：如果没有卫星的轨道视算数据 不能开始交战推演
  if (!isPlaying.value && !hasOrbitData.value) {
    ElMessage.warning('缺少卫星轨道视算数据，不能开始交战推演！请先进行【🛰️ 轨道视算】。')
    return
  }
  if (isPlaying.value) {
    stopSimulationLoop()
    ElNotification({
      title: '⏸ 交战推演已暂停',
      message: '已暂停自动推演步进，可随时手动拖动调控。',
      type: 'info',
      duration: 3000,
    })
  } else {
    startSimulationLoop()
    ElNotification({
      title: '▶ 交战推演已启动',
      message: `进入 ${conflictIntensity.value} 烈度电子对抗，实时解算全域时延开销与阻断响应。`,
      type: 'warning',
      duration: 3500,
    })
  }
}

const getStatusType = (status: string) => {
  if (status === 'TRANSMITTING') return 'success'
  if (status === 'JAMMED') return 'warning'
  if (status === 'DESTROYED') return 'danger'
  return 'info'
}

const getStatusText = (status: string) => {
  if (status === 'TRANSMITTING') return '正常'
  if (status === 'JAMMED') return '干扰'
  if (status === 'DESTROYED') return '摧毁'
  return '未连'
}

const startSimulationLoop = () => {
  if (simMinutes.value >= suppressionTime.value) {
    simMinutes.value = 0 // 重头循环
  }
  isPlaying.value = true
  addLog(`推演开始 (烈度: ${conflictIntensity.value}, 步长: ${effectiveStep.value}min/步)`, 'success')

  playIntervalId.value = setInterval(async () => {
    if (simMinutes.value >= suppressionTime.value) {
      addLog(`已达到设定的 ${suppressionTime.value} 分钟压制时长，推演结束。`, 'success')
      stopSimulationLoop()
      return
    }
    const nextVal = Math.min(suppressionTime.value, simMinutes.value + effectiveStep.value)
    await onTimeStepChange(nextVal)
  }, playSpeedMs.value)
}

const stopSimulationLoop = () => {
  isPlaying.value = false
  if (playIntervalId.value) {
    clearInterval(playIntervalId.value)
    playIntervalId.value = null
  }
}

onBeforeUnmount(() => {
  stopSimulationLoop()
})

const selectEntity = async (id: string, type: 'ASSET' | 'WEAPON') => {
  selectedEntity.value = null // Clear old entity to avoid asynchronous UI rendering race conditions
  selectedType.value = type
  try {
    if (type === 'ASSET') {
      const rows = await sqliteClient.query<any>(`SELECT * FROM assets WHERE id = ?`, [id])
      if (rows.length > 0) selectedEntity.value = rows[0]
    } else if (type === 'WEAPON') {
      const rows = await sqliteClient.query<any>(`SELECT * FROM weapons WHERE id = ?`, [id])
      if (rows.length > 0) selectedEntity.value = rows[0]
    }
  } catch (error) {
    console.error('Error selecting entity:', error)
  }
}

const updateSmallRadar = async () => {
  if (!smallRadarChartRef.value) return
  if (currentView.value !== 'SANDBOX') return

  let chartInstance = echarts.getInstanceByDom(smallRadarChartRef.value)
  if (!chartInstance) {
    chartInstance = echarts.init(smallRadarChartRef.value, 'dark')
  }

  // Same logic as AAR
  const totalLinks = await sqliteClient.query<any>('SELECT COUNT(*) as cnt FROM communication_windows')
  const blockedLinks = await sqliteClient.query<any>(
    "SELECT COUNT(*) as cnt FROM communication_windows WHERE link_status IN ('JAMMED', 'DESTROYED')"
  )
  const tot = totalLinks[0]?.cnt || 0
  const blk = blockedLinks[0]?.cnt || 0
  const blockRate = tot > 0 ? Math.round((blk / tot) * 100) : 0

  const blockScore = blockRate
  const controlScore = Math.max(30, Math.round(100 - (budgetSpent.value / maxBudget.value) * 50))
  const costEfficiency = Math.min(95, Math.round((totalDelay.value / (budgetSpent.value + 100)) * 6000))
  const selfInterference = Math.max(20, Math.round(100 - (budgetSpent.value > 50000 ? 40 : 15)))

  const option = {
    backgroundColor: 'transparent',
    color: ['#00e1ff'],
    radar: {
      indicator: [
        { name: '阻断成功率', max: 100 },
        { name: '冲突控制', max: 100 },
        { name: '效费比', max: 100 },
        { name: '己方生存', max: 100 },
      ],
      splitArea: { areaStyle: { color: ['rgba(0, 225, 255, 0.05)', 'rgba(0, 225, 255, 0.1)'] } },
      axisLine: { lineStyle: { color: 'rgba(0, 225, 255, 0.3)' } },
      splitLine: { lineStyle: { color: 'rgba(0, 225, 255, 0.3)' } },
      axisName: { color: '#a0aec0', fontSize: 10 },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: [blockScore, controlScore, costEfficiency, selfInterference],
            name: '当前推演方案',
            areaStyle: { color: 'rgba(0, 225, 255, 0.3)' },
            lineStyle: { width: 2 },
          },
        ],
      },
    ],
  }
  chartInstance.setOption(option)
}

watch(currentView, () => {
  nextTick(() => {
    if (currentView.value === 'SANDBOX' && smallRadarChartRef.value) {
      updateSmallRadar()
    }
  })
})
</script>

<style lang="scss">
@import '../styles/theme.scss';

.app-container {
  height: 100vh;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 12px 24px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 24px;

    .header-logo {
      font-size: 20px;
      font-weight: bold;
    }
  }

  .nav-tabs {
    display: flex;
    gap: 8px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 24px;

    .header-right-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .db-status-container {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

.tab-btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.15);
  background-color: transparent;
  color: $text-dim;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    color: #00e1ff;
  }

  &.active {
    background-color: rgba(0, 225, 255, 0.2);
    border-color: #00e1ff;
    color: #00e1ff;
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;

  &.status-green {
    background-color: #10b981;
    box-shadow: 0 0 8px #10b981;
  }

  &.status-red {
    background-color: #ef4444;
    box-shadow: 0 0 8px #ef4444;
  }
}

.sandbox-workspace {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 20px;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.left-sidebar {
  width: 25%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;

  .config-panel {
    flex: none;
  }

  .config-form {
    font-size: 12px;
    margin-top: 12px;
    padding-left: 8px;
    padding-right: 8px;
  }

  .form-input-full {
    width: 100% !important;
  }

  .action-btn-row {
    display: flex;
    gap: 8px;

    .flex-btn {
      flex: 1;
    }
  }

  .submit-btn {
    width: 100% !important;
    font-weight: bold;
    margin-top: 8px !important;
    margin-left: 0 !important;
  }

  .time-slider-container {
    margin-top: 16px;
    padding-left: 8px;
    padding-right: 8px;

    .slider-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;

      .time-progress {
        color: #00e1ff;
      }
    }
  }

  .overhead-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;

    .overhead-panel-content {
      flex: 1;
      overflow-y: auto;
      background-color: rgba(0, 0, 0, 0.4);
      padding: 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 225, 255, 0.15);
      display: flex;
      flex-direction: column;
    }

    .mini-overhead-table {
      font-size: 11px;
    }

    .empty-overhead-message {
      color: $text-dim;
      text-align: center;
      margin-top: 40px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
  }
}

.center-viewport {
  width: 50%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;

  .side-tags-row {
    display: flex;
    gap: 8px;
  }

  .canvas-container {
    flex: 1;
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    border: 1px solid rgba(0, 225, 255, 0.15);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 0;

    .empty-canvas-message {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: $text-dim;
      font-size: 12px;
    }
  }
}

.right-sidebar {
  width: 25%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;

  .radar-card {
    height: 250px;
    display: flex;
    flex-direction: column;
    min-height: 0;

    .small-radar-container {
      flex: 1;
      width: 100%;
      min-height: 150px;
    }
  }

  .weapon-assignment-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .inspector-panel {
    flex: none;
    height: 230px;
    display: flex;
    flex-direction: column;

    .probe-content {
      flex: 1;
      padding: 10px 12px;
      overflow-y: auto;
      font-size: 12px;

      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .entity-name {
          font-size: 14px;
          font-weight: bold;
          color: #67e8f9;
        }

        .entity-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          line-height: 1.4;

          &.badge-red {
            background: rgba(239, 68, 68, 0.2);
            color: #f87171;
            border: 1px solid rgba(239, 68, 68, 0.4);
          }

          &.badge-blue {
            background: rgba(59, 130, 246, 0.2);
            color: #60a5fa;
            border: 1px solid rgba(59, 130, 246, 0.4);
          }
        }
      }

      .info-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        column-gap: 12px;
        row-gap: 8px;
        justify-items: start;
        align-items: center;

        > div {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .grid-col-full {
          grid-column: span 2 / span 2;
        }
      }

      .label-dim {
        color: $text-dim;
      }

      .value-yellow {
        color: #facc15;
      }

      .value-cyan {
        color: #22d3ee;
      }

      .value-green {
        color: #4ade80;
      }

      .value-red {
        color: #f87171;
      }

      .detected-red {
        color: #f87171;
      }

      .hidden-green {
        color: #4ade80;
      }

      .empty-inspector {
        color: $text-dim;
        text-align: center;
        margin-top: 20px;
      }
    }
  }
}

// el-timeline customization
.el-timeline {
  padding-left: 0;
}

.el-timeline-item__content {
  color: #a0aec0;
}

// Element Plus Dark Theme Overrides
.left-sidebar {
  .el-select,
  .el-input,
  .el-input-number {
    --el-fill-color-blank: #0a1128 !important;
    --el-border-color: rgba(0, 225, 255, 0.25) !important;
    --el-border-color-hover: #00e1ff !important;
    --el-text-color-regular: #cbd5e1 !important;
    --el-text-color-placeholder: #475569 !important;
  }

  .el-input__wrapper,
  .el-select__wrapper {
    background-color: #0a1128 !important;
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.25) inset !important;

    .el-input__inner,
    .el-select__placeholder,
    .el-select__selected-item {
      color: #cbd5e1 !important;
    }
  }

  .el-input__wrapper.is-focus,
  .el-select__wrapper.is-focus {
    box-shadow: 0 0 0 1px #00e1ff inset !important;
  }

  .el-input-number {
    .el-input-number__increase,
    .el-input-number__decrease {
      background-color: #0b1836 !important;
      border-color: rgba(0, 225, 255, 0.25) !important;
      color: #cbd5e1 !important;

      &:hover {
        color: #00e1ff !important;
      }
    }
  }
}

.el-select__dropdown,
.el-select-dropdown {
  background-color: #0a1128 !important;
  border: 1px solid rgba(0, 225, 255, 0.25) !important;

  .el-select-dropdown__item {
    color: #cbd5e1 !important;
    background-color: transparent !important;

    &.hover,
    &:hover {
      background-color: #0d1b40 !important;
      color: #00e1ff !important;
    }

    &.is-selected {
      color: #00e1ff !important;
      font-weight: bold;
      background-color: #102a5c !important;
    }
  }
}

.probe-tabs-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.probe-tab-title {
  cursor: pointer;
  color: #64748b;
  font-size: 12px;
  transition: all 0.2s ease;
  user-select: none;
  &:hover {
    color: #94a3b8;
  }
  &.active {
    color: #00e1ff;
    font-weight: bold;
  }
}
.tab-divider {
  color: rgba(255, 255, 255, 0.2);
  font-size: 10px;
}

.matrix-probe-content {
  padding: 10px;
  font-size: 12px;
  color: #cbd5e1;
}
.probe-sub-title {
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 8px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
  padding-bottom: 4px;
}
.matrix-micro-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 140px;
  overflow-y: auto;
}
.matrix-micro-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(15, 23, 42, 0.6);
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.15);
  font-size: 11px;
}
.weapon-name {
  color: #ff2a5f;
  font-weight: 500;
}
.arrow {
  color: #64748b;
  font-size: 10px;
}
.target-name {
  color: #38bdf8;
  flex: 1;
}
.status-badge {
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  &.badge-success {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  &.badge-warning {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
}
</style>
