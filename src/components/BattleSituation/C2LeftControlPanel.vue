<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">敌方网络与资产拓扑</span>
      </div>
      <span class="panel-badge">传输链路</span>
    </div>

    <!-- 卫星类型与系列按钮/列表筛选区 -->
    <div class="filter-section">
      <!-- 卫星类型选择按钮组 (占满一行) -->
      <div class="type-button-bar">
        <button v-for="item in typeOptions" :key="item" class="type-btn" :class="{
          active: selectedType === item,
          disabled: isTypeDisabled(item),
        }" :disabled="isTypeDisabled(item)" @click="selectType(item)">
          {{ item }}
        </button>
      </div>

      <!-- 卫星系列列表 (排成一列 list，全部类型或指定类型下均可展示) -->
      <div class="series-list-box" v-if="seriesOptions.length > 0">
        <div class="series-list-header">
          <span class="series-title">📋 {{ selectedType ? `${selectedType} · 包含系列` : '全部系列列表' }}</span>
          <span class="series-count">{{ seriesOptions.length }} 个</span>
        </div>
        <div class="series-list">
          <div v-for="series in seriesOptions" :key="series" class="series-item"
            :class="{ active: selectedSeries === series }" @click="selectSeries(series)">
            <span class="series-icon">🏷️</span>
            <span class="series-name">{{ series }}</span>
            <span class="series-status">{{ selectedSeries === series ? '✓ 已筛选' : '点击筛选' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 敌方天基空间节点资产清单 (Space Layer) -->
    <div class="panel-section section-space">
      <div class="section-title">
        <span class="title-icon">🌌</span>
        <span>敌方天基过境与中继卫星</span>
        <span class="count-tag">{{ satList.length }} 颗</span>
      </div>

      <div class="asset-scroll-list">
        <div v-for="(sat, index) in satList" :key="sat.norad" class="asset-card" :class="{
          'card-active': selectedNorad === sat.norad,
          'card-relay': sat.isRelay,
          'card-threat-rank-1': index === 0 && sat.threatScore != null,
          'card-threat-rank-2': index === 1 && sat.threatScore != null,
          'card-threat-rank-3': index === 2 && sat.threatScore != null,
        }" @click="handleSelectSatellite(sat.norad)">
          <div class="card-top">
            <span class="sat-name">
              {{ sat.isRelay ? '📡' : '🛰️' }} <strong>{{ sat.name }}</strong>
            </span>
            <span class="status-badge" :class="sat.isRelay ? 'badge-amber' : 'badge-cyan'">
              {{ sat.isRelay ? '高轨中继' : '过境观测' }}
            </span>
          </div>

          <div class="card-body-row">
            <div class="card-details">
              <span class="detail-tag">NORAD: {{ sat.norad }}</span>
              <span class="detail-tag tag-type">{{ sat.satType || '天基节点' }}</span>
              <span class="detail-tag tag-role" v-if="sat.isRelay">中继节点</span>
              <span class="click-hint" v-if="selectedNorad === sat.norad">✓ 已选择分析</span>
            </div>
            <div class="card-side-actions" @click.stop>
              <span v-if="sat.threatScore != null" class="threat-score" :class="getThreatLevelClass(sat.threatScore)">
                威胁度 {{ formatThreatScore(sat.threatScore) }}
              </span>
              <span v-else class="threat-score threat-unknown">威胁度 --</span>
              <el-button class="detail-btn" size="small" link type="primary" @click="openThreatDetail(sat)">
                查看详情
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="threatDialogVisible" :title="`威胁度计算过程 · ${threatDialogSat?.name || ''}`" width="640px"
      class="threat-detail-dialog" align-center destroy-on-close @closed="handleThreatDialogClosed">
      <div v-loading="threatLoading" class="threat-dialog-body">
        <template v-if="threatInfo">
          <div class="threat-summary-card">
            <div class="summary-item">
              <span class="summary-label">NORAD</span>
              <strong>{{ threatInfo.satelliteBaseModelResp.norad }}</strong>
            </div>
            <div class="summary-item">
              <span class="summary-label">卫星名称</span>
              <strong>{{ threatInfo.satelliteBaseModelResp.name_en }}</strong>
            </div>
            <div class="summary-item highlight">
              <span class="summary-label">威胁度评分</span>
              <strong class="threat-value" :class="getThreatLevelClass(threatInfo.threatScore)">
                {{ formatThreatScore(threatInfo.threatScore) }}
              </strong>
            </div>
          </div>

          <div class="threat-section">
            <div class="section-label">威胁度计算公式</div>
            <pre class="formula-box">{{ threatInfo.formula || '暂无公式说明' }}</pre>
          </div>

          <div class="threat-section">
            <div class="section-label">卫星能力指标</div>
            <div class="param-grid">
              <div class="param-item">
                <span class="param-label">载荷类型</span>
                <span class="param-value">{{ threatInfo.satelliteBaseModelResp.sat_type || '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">成像分辨率</span>
                <span class="param-value">{{ threatInfo.zhchResolution ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">成像幅宽</span>
                <span class="param-value">{{ threatInfo.zhchSwathWidth ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">重访周期</span>
                <span class="param-value">{{ threatInfo.zhchCycle ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">降交点地方时</span>
                <span class="param-value">{{ threatInfo.zhchLtdn ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">定点位置（高轨卫星）</span>
                <span class="param-value">{{ threatInfo.zhchFixedPosition ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">在轨状态</span>
                <span class="param-value">{{ threatInfo.satelliteBaseModelResp.orbitStatusIndicator ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">剩余工作寿命</span>
                <span class="param-value">{{ threatInfo.satelliteBaseModelResp.remainLifetimeIndicator ?? '--' }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">国别</span>
                <span class="param-value">{{ threatInfo.satelliteBaseModelResp.countryIndicator === 1 ? '敌方卫星' : '我方卫星'
                }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">用户属性</span>
                <span class="param-value">{{ formatUsageIndicator(threatInfo.satelliteBaseModelResp.usageIndicator)
                }}</span>
              </div>
            </div>
          </div>
        </template>
        <div v-else-if="!threatLoading" class="threat-empty">暂无威胁度计算数据</div>
      </div>
    </el-dialog>

  </aside>
</template>

<script setup lang="ts">
/**
 * [功能]
 * 战场态势 - C2 左侧控制与敌方资产清单面板
 *
 * [处理规则]
 * - 重点展示敌方过境卫星、中继卫星、地面接收站及数据中心
 * - 支持根据接口 getSatelliteTypeSerials 获取的类型与系列联动筛选卫星列表
 * - 点击天基卫星卡片时向父组件抛出 select-satellite 事件
 * - 不包含任何攻击/毁伤/打压控制
 *
 * [副作用]
 * - 触发视角切换与控制事件
 */
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getSatelliteTypeSerials,
  getSatelliteThreatInfo,
  type MatrixResult,
  type SatelliteMatrix,
  type InitMatrix,
  type SatelliteThreatInfo,
} from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
const props = defineProps<{
  /** 算法矩阵响应式数据 */
  matrixData: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

const emit = defineEmits<{
  /**
   * [事件说明]
   * 触发选择/取消选择敌方卫星事件
   * @param norad 选中的敌方卫星 NORAD 编号，取消选中时为 null
   */
  (e: 'select-satellite', norad: number | null): void
}>()

const store = useLayoutStore()

//存储从接口 getSatelliteTypeSerials 获取的卫星类型与对应系列字典数据
const typeSerialsMap = ref<Record<string, string[]>>({})

// 当前选中的卫星类型筛选值，优先从 Store 持久化状态中恢复
const selectedType = ref<string>(store.selectedSatType || '')


// 当前选中的卫星系列筛选值，优先从 Store 持久化状态中恢复
const selectedSeries = ref<string>(store.selectedSatSeries || '')


// 可供选择的卫星类型下拉选项列表
const typeOptions = computed<string[]>(() => {
  return Object.keys(typeSerialsMap.value)
})

/**
 * [计算属性说明]
 * 当前选中的卫星类型下可供选择的系列列表（若选择"全部类型"或未选类型，则汇总合并展示所有类型下的所有系列）
 */
const seriesOptions = computed<string[]>(() => {
  if (!selectedType.value) {
    const allSeries = Object.values(typeSerialsMap.value).flat()
    return Array.from(new Set(allSeries))
  }
  return typeSerialsMap.value[selectedType.value] || []
})

/**
 * [功能说明]
 * 判断当前卫星类型按钮是否需要禁用（禁用“导航”、“通信”、“导弹预警”）
 *
 * @param type 卫星类型名称
 * @returns 是否禁用
 */
const isTypeDisabled = (type: string): boolean => {
  if (!type) return false
  return type.includes('导航') || type.includes('通信') || type.includes('导弹预警')
}

/**
 * [函数说明]
 * 选择并切换选中的卫星类型，并同步保存至 Store，自动联动选中该类型下的首个可用系列
 *
 * @param type 选中的卫星类型名称
 */
const selectType = (type: string) => {
  if (!type || isTypeDisabled(type)) return
  selectedType.value = type
  store.setSelectedSatType(selectedType.value)

  const availSeries = typeSerialsMap.value[type] || []
  const newSeries = availSeries.length > 0 ? availSeries[0] : ''
  selectedSeries.value = newSeries
  store.setSelectedSatSeries(newSeries)
}

/**
 * [监听器说明]
 * 监听卫星类型选项列表，保持现有有效类型或自动选中第一个未禁用的卫星类型 (如 "侦察")
 */
watch(
  typeOptions,
  (options) => {
    if (!options || options.length === 0) return
    let currentType = selectedType.value || store.selectedSatType || ''
    if (!currentType || isTypeDisabled(currentType) || !options.includes(currentType)) {
      const validOption = options.find((opt) => !isTypeDisabled(opt))
      if (validOption) {
        selectType(validOption)
      }
    } else if (selectedType.value !== currentType) {
      selectedType.value = currentType
    }
  },
  { immediate: true }
)

/**
 * [监听器说明]
 * 监听当前可用卫星系列列表，切换 Tab 组件挂载后自动恢复/对齐选中的系列，防止 Store 中系列清空导致敌方天基过境与中继卫星数据为空
 */
watch(
  seriesOptions,
  (sOptions) => {
    if (!sOptions || sOptions.length === 0) return
    let currentSeries = selectedSeries.value || store.selectedSatSeries || ''
    if (!currentSeries || !sOptions.includes(currentSeries)) {
      currentSeries = sOptions[0]
    }
    if (currentSeries && (selectedSeries.value !== currentSeries || store.selectedSatSeries !== currentSeries)) {
      selectedSeries.value = currentSeries
      store.setSelectedSatSeries(currentSeries)
    }
  },
  { immediate: true }
)

/**
 * [函数说明]
 * 选择或切换选中的卫星系列，并同步保存至 Store
 * @param series 选中的卫星系列名称
 */
const selectSeries = (series: string) => {
  if (selectedSeries.value === series) {
    selectedSeries.value = ''
  } else {
    selectedSeries.value = series
  }
  store.setSelectedSatSeries(selectedSeries.value)
}

/**
 * [函数说明]
 * 根据任务 ID 从后端异步加载卫星类型与系列映射数据
 *
 * [处理规则]
 * - 校验 taskId 是否有效，若无效清空 typeSerialsMap 并返回
 * - 调用 getSatelliteTypeSerials(taskId)
 * - 成功后将返回的数据保存至 typeSerialsMap
 *
 * [副作用]
 * - 发送网络 HTTP 请求
 * - 更新 typeSerialsMap 响应式数据
 *
 * [异常处理]
 * 捕获请求异常并在控制台记录 error
 *
 * [修改约束]
 * 保持入参格式与异步更新逻辑一致
 *
 * @param taskId 任务 ID
 */
const fetchTypeSerials = async (taskId?: number) => {
  if (!taskId) {
    typeSerialsMap.value = {}
    return
  }
  try {
    const res = await getSatelliteTypeSerials(taskId)
    if (res.code === 200 && res.data) {
      typeSerialsMap.value = res.data
    }
  } catch (err) {
    console.error('获取卫星类型与系列映射失败:', err)
  }
}

// 监听当前激活的任务 ID 变化，自动查询对应任务的类型与系列列表
watch(
  () => store.activedTask?.id,
  (newTaskId) => {
    if (!newTaskId) {
      selectedType.value = ''
      selectedSeries.value = ''
      store.setSelectedSatType('')
      store.setSelectedSatSeries('')
    }
    void fetchTypeSerials(newTaskId)
  },
  { immediate: true }
)

/**
 * [函数说明]
 * 触发选择卫星事件 (再次点击已选中的卫星可取消选择)
 * @param norad 选中的敌方卫星 NORAD 编号
 */
const handleSelectSatellite = (norad: number) => {
  if (props.selectedNorad === norad) {
    emit('select-satellite', null)
  } else {
    emit('select-satellite', norad)
  }
}

interface SatListItem {
  norad: number
  name: string
  satType: string
  isRelay: boolean
  threatScore: number | null
}

const threatDialogVisible = ref(false)
const threatLoading = ref(false)
const threatInfo = ref<SatelliteThreatInfo | null>(null)
const threatDialogSat = ref<{ norad: number; name: string } | null>(null)

const formatThreatScore = (score: number): string => {
  if (Number.isInteger(score)) return String(score)
  return Number(score.toFixed(2)).toString()
}

const formatUsageIndicator = (val?: number | null): string => {
  if (val == null) return '--'
  if (val === 1) return '军用'
  if (val === 0.6) return '商用'
  if (val === 0.3) return '民用'
  return String(val)
}

const getThreatLevelClass = (score: number): string => {
  const normalized = score <= 1 ? score * 100 : score
  if (normalized >= 70) return 'threat-high'
  if (normalized >= 40) return 'threat-medium'
  return 'threat-low'
}

const openThreatDetail = async (sat: SatListItem) => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    ElMessage.warning('请先选择任务')
    return
  }

  threatDialogSat.value = { norad: sat.norad, name: sat.name }
  threatDialogVisible.value = true
  threatLoading.value = true
  threatInfo.value = null

  try {
    const res = await getSatelliteThreatInfo({
      norad: sat.norad,
      series: selectedType.value || '侦察',
      taskId,
    })
    if (res.code === 200 && res.data?.length) {
      threatInfo.value = res.data[0]
    }
  } catch (err) {
    console.error('获取卫星威胁度详情失败:', err)
    ElMessage.error('获取威胁度详情失败')
  } finally {
    threatLoading.value = false
  }
}

const handleThreatDialogClosed = () => {
  threatInfo.value = null
  threatDialogSat.value = null
}

const normalizeThreatScore = (score: number | null): number => {
  if (score == null) return -Infinity
  return score <= 1 ? score * 100 : score
}

/**
 * [计算属性说明]
 * 提取当前矩阵中的敌方天基过境与中继卫星列表，按威胁度从高到低排序。
 */
const satList = computed<SatListItem[]>(() => {
  const matrixData = props.matrixData
  if (!matrixData) return []

  const threatMap = new Map<number, number>()
    ; (matrixData.threatSats || []).forEach((item) => {
      threatMap.set(item.norad, item.threatScore)
    })

  const map = new Map<number, SatListItem>()

  const initList = matrixData.initMatrixList?.length ? matrixData.initMatrixList : []
  const satMatrixList = matrixData.satelliteMatrixList?.length ? matrixData.satelliteMatrixList : []
  const relayList = matrixData.relayRelation?.relayList?.length ? matrixData.relayRelation.relayList : []

  initList.forEach((s: InitMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      isRelay,
      threatScore: threatMap.get(s.norad) ?? null,
    })
  })
  satMatrixList.forEach((s: SatelliteMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      isRelay,
      threatScore: threatMap.get(s.norad) ?? null,
    })
  })

  return Array.from(map.values()).sort(
    (a, b) => normalizeThreatScore(b.threatScore) - normalizeThreatScore(a.threatScore)
  )
})




</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  color: #e2efff;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  overflow: hidden;
  gap: 12px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);
  flex-shrink: 0;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .panel-badge {
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.12);
    color: #5ce1e6;
    border: 1px solid rgba(0, 225, 255, 0.3);
  }
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(14, 25, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  &.section-space {
    flex: 1;
    min-height: 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #b5d5ff;

    .count-tag {
      margin-left: auto;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      background: rgba(64, 242, 255, 0.15);
      color: #7dd3fc;
    }
  }
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;

  .type-button-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    flex-wrap: wrap;

    .type-btn {
      flex: 1 1 auto;
      min-width: 60px;
      height: 28px;
      padding: 0 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 500;
      color: #9ec5ed;
      background: rgba(18, 32, 54, 0.85);
      border: 1px solid rgba(0, 225, 255, 0.25);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      white-space: nowrap;

      &:hover {
        color: #ffffff;
        border-color: rgba(0, 225, 255, 0.6);
        background: rgba(24, 48, 80, 0.9);
        box-shadow: 0 0 6px rgba(0, 225, 255, 0.2);
      }

      &.active {
        color: #ffffff;
        font-weight: 600;
        background: linear-gradient(135deg, rgba(0, 180, 216, 0.4) 0%, rgba(0, 225, 255, 0.25) 100%);
        border-color: #00e1ff;
        box-shadow: 0 0 10px rgba(0, 225, 255, 0.35);
      }

      &:disabled,
      &.disabled {
        opacity: 0.45;
        color: #64748b;
        background: rgba(15, 23, 42, 0.6);
        border-color: rgba(100, 116, 139, 0.2);
        cursor: not-allowed;
        pointer-events: none;
        box-shadow: none;

        &:hover {
          color: #64748b;
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(100, 116, 139, 0.2);
          box-shadow: none;
        }
      }
    }
  }

  .series-list-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(12, 22, 38, 0.75);
    border: 1px dashed rgba(0, 225, 255, 0.25);
    border-radius: 6px;

    .series-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #7dd3fc;
      padding-bottom: 4px;
      border-bottom: 1px rgba(0, 225, 255, 0.15) solid;

      .series-title {
        font-weight: 600;
      }

      .series-count {
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.15);
        padding: 1px 6px;
        border-radius: 8px;
      }
    }

    .series-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 150px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 3px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(0, 225, 255, 0.3);
        border-radius: 3px;
      }

      .series-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        font-size: 12px;
        color: #c4e0ff;
        background: rgba(18, 36, 62, 0.6);
        border: 1px solid rgba(79, 147, 221, 0.2);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;

        .series-icon {
          margin-right: 6px;
          font-size: 12px;
        }

        .series-name {
          flex: 1;
          font-weight: 500;
        }

        .series-status {
          font-size: 11px;
          color: #64748b;
        }

        &:hover {
          color: #ffffff;
          border-color: rgba(0, 225, 255, 0.5);
          background: rgba(24, 52, 88, 0.8);

          .series-status {
            color: #38bdf8;
          }
        }

        &.active {
          color: #40f2ff;
          font-weight: 600;
          background: rgba(0, 225, 255, 0.15);
          border-color: #00e1ff;
          box-shadow: 0 0 8px rgba(0, 225, 255, 0.25);

          .series-status {
            color: #00e1ff;
            font-weight: 600;
          }
        }
      }
    }
  }
}

.toggle-grid {
  display: flex;
  gap: 12px;
  align-items: center;

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;

    input {
      accent-color: #00e1ff;
    }
  }
}

.asset-scroll-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 4px;
  }
}

.asset-card {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.4);
    background: rgba(22, 42, 70, 0.9);
  }

  &.card-active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.18);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.25);
  }

  &.card-threat-rank-1 {
    border-color: rgba(239, 68, 68, 0.85);
    background: rgba(239, 68, 68, 0.14);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);

    .threat-score {
      color: #fecaca !important;
      background: rgba(239, 68, 68, 0.25) !important;
      border-color: rgba(239, 68, 68, 0.55) !important;
    }
  }

  &.card-threat-rank-2 {
    border-color: rgba(249, 115, 22, 0.75);
    background: rgba(249, 115, 22, 0.12);
    box-shadow: 0 0 8px rgba(249, 115, 22, 0.22);

    .threat-score {
      color: #fed7aa !important;
      background: rgba(249, 115, 22, 0.2) !important;
      border-color: rgba(249, 115, 22, 0.45) !important;
    }
  }

  &.card-threat-rank-3 {
    border-color: rgba(250, 204, 21, 0.7);
    background: rgba(250, 204, 21, 0.1);
    box-shadow: 0 0 6px rgba(250, 204, 21, 0.18);

    .threat-score {
      color: #fef08a !important;
      background: rgba(250, 204, 21, 0.18) !important;
      border-color: rgba(250, 204, 21, 0.4) !important;
    }
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;

    .sat-name {
      font-size: 13px;
      color: #ffffff;
    }

    .status-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;
      flex-shrink: 0;

      &.badge-cyan {
        background: rgba(0, 225, 255, 0.15);
        color: #38bdf8;
      }

      &.badge-amber {
        background: rgba(245, 158, 11, 0.18);
        color: #fbbf24;
      }
    }
  }

  .card-body-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 8px;
  }

  .card-details {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: 11px;
    flex: 1;
    min-width: 0;

    .detail-tag {
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;

      &.tag-type {
        color: #7dd3fc;
      }

      &.tag-role {
        color: #fcd34d;
      }
    }

    .click-hint {
      color: #38bdf8;
      font-weight: 600;
    }
  }

  .card-side-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    flex-shrink: 0;

    .threat-score {
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;

      &.threat-high {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.35);
      }

      &.threat-medium {
        color: #fdba74;
        background: rgba(249, 115, 22, 0.15);
        border: 1px solid rgba(249, 115, 22, 0.35);
      }

      &.threat-low {
        color: #7dd3fc;
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.3);
      }

      &.threat-unknown {
        color: #64748b;
        background: rgba(100, 116, 139, 0.12);
        border: 1px solid rgba(100, 116, 139, 0.2);
      }
    }

    .detail-btn {
      font-size: 11px;
      padding: 0;
      height: auto;
    }
  }
}

:deep(.threat-detail-dialog) {
  .el-dialog {
    background: rgba(8, 15, 26, 0.98);
    border: 1px solid rgba(0, 225, 255, 0.25);
    border-radius: 10px;
  }

  .el-dialog__header {
    border-bottom: 1px solid rgba(0, 225, 255, 0.15);
    margin-right: 0;
    padding: 14px 18px 10px;
  }

  .el-dialog__title {
    color: #40f2ff;
    font-size: 15px;
    font-weight: 700;
  }

  .el-dialog__body {
    padding: 14px 18px 18px;
    color: #e2efff;
  }
}

.threat-dialog-body {
  min-height: 180px;
}

.threat-summary-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 14px;

  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px;
    border-radius: 6px;
    background: rgba(14, 25, 42, 0.8);
    border: 1px solid rgba(0, 225, 255, 0.12);

    &.highlight {
      border-color: rgba(255, 140, 0, 0.3);
      background: rgba(255, 140, 0, 0.06);
    }

    .summary-label {
      font-size: 11px;
      color: #94a3b8;
    }

    strong {
      font-size: 14px;
      color: #e2efff;
      word-break: break-all;
    }

    .threat-value {
      font-size: 20px;
      font-weight: 700;
    }
  }
}

.threat-section {
  margin-bottom: 14px;

  .section-label {
    font-size: 12px;
    font-weight: 600;
    color: #7dd3fc;
    margin-bottom: 8px;
  }

  .formula-box {
    margin: 0;
    padding: 12px;
    border-radius: 6px;
    background: rgba(10, 18, 32, 0.9);
    border: 1px solid rgba(0, 225, 255, 0.15);
    color: #cbd5e1;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: Consolas, 'Courier New', monospace;
  }
}

.param-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;

  .param-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px 10px;
    border-radius: 6px;
    background: rgba(14, 25, 42, 0.65);
    border: 1px solid rgba(255, 255, 255, 0.06);

    .param-label {
      font-size: 11px;
      color: #94a3b8;
    }

    .param-value {
      font-size: 13px;
      color: #e2efff;
      font-weight: 600;
    }
  }
}

.threat-empty {
  text-align: center;
  color: #64748b;
  padding: 40px 0;
  font-size: 13px;
}

.threat-high {
  color: #fca5a5 !important;
}

.threat-medium {
  color: #fdba74 !important;
}

.threat-low {
  color: #7dd3fc !important;
}
</style>
