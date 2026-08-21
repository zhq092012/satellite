<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">卫星类型与系列</span>
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
          <span class="series-title">📋 包含系列 {{ seriesOptions.length }} 个</span>
          <span class="series-current" :title="selectedSeries || '未选择系列'">
            当前系列：{{ selectedSeries || '未选择' }}
          </span>
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
      <div class="section-header-block">
        <div class="section-title">
          <span class="title-icon">🛰️</span>
          <span>敌方卫星列表</span>
          <span class="count-tag">{{ satList.length }} 颗</span>
          <span v-if="selectedSatelliteName" class="current-sat" :title="selectedSatelliteName">
            当前选择：{{ selectedSatelliteName }}
          </span>
        </div>
        <div class="sort-toggle-bar">
          <button class="sort-btn" :class="{ active: sortMode === 'threat' }" @click="sortMode = 'threat'">
            按威胁度
          </button>
          <button class="sort-btn" :class="{ active: sortMode === 'transTime' }" @click="sortMode = 'transTime'">
            按链路时长
          </button>
        </div>
      </div>

      <div class="asset-scroll-list">
        <div v-for="(sat, index) in satList" :key="sat.norad" class="asset-card" :class="{
          'card-active': selectedNorad === sat.norad,
          'card-relay': sat.isRelay,
          'card-threat-rank-1': index === 0 && isTopRankEligible(sat),
          'card-threat-rank-2': index === 1 && isTopRankEligible(sat),
          'card-threat-rank-3': index === 2 && isTopRankEligible(sat),
        }" @click="handleSelectSatellite(sat.norad)">
          <div class="card-top">
            <span class="sat-name">
              {{ sat.isRelay ? '📡' : '🛰️' }} <strong>{{ sat.name }}</strong>
              <span v-if="sat.isRelay" class="relay-tag">中继</span>
            </span>
            <span v-if="sortMode === 'threat'" class="metric-highlight"
              :class="sat.threatScore != null ? getThreatLevelClass(sat.threatScore) : 'threat-unknown'">
              威胁度 {{ sat.threatScore != null ? formatThreatScore(sat.threatScore) : '--' }}
            </span>
            <span v-else class="metric-highlight metric-duration">
              链路时长 {{ sat.timeEffect ? formatDuration(sat.timeEffect.duration) : '--' }}
            </span>
          </div>
          <div class="card-station">接收站 {{ sat.timeEffect?.receiveName || '--' }}</div>
          <div class="card-time-row">
            <span>开始 {{ sat.timeEffect ? formatTransTime(sat.timeEffect.beginTime) : '--' }}</span>
            <span>结束 {{ sat.timeEffect ? formatTransTime(sat.timeEffect.endTime) : '--' }}</span>
          </div>
          <div class="card-footer" @click.stop>
            <span class="click-hint" v-if="selectedNorad === sat.norad">✓ 已选择分析</span>
            <el-button v-if="sortMode === 'threat'" class="detail-btn" size="small" link type="primary"
              @click="openThreatDetail(sat)">
              查看详情
            </el-button>
            <el-button v-else class="detail-btn" size="small" link type="primary" @click="openTopoAnalysis(sat)">
              查看详情
            </el-button>
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
                <span class="param-value">{{ threatInfo.satelliteBaseModelResp.countryIndicator }}</span>
              </div>
              <div class="param-item">
                <span class="param-label">用户属性</span>
                <span class="param-value">{{ threatInfo.satelliteBaseModelResp.usageIndicator }}</span>
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
/** 组件接收的矩阵数据及当前选中卫星信息。 */
const props = defineProps<{
  /** 算法矩阵响应式数据 */
  matrixData: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

/** 组件向父级触发的卫星选择事件。 */
const emit = defineEmits<{
  /**
   * [事件说明]
   * 触发选择/取消选择敌方卫星事件
   * @param norad 选中的敌方卫星 NORAD 编号，取消选中时为 null
   */
  (e: 'select-satellite', norad: number | null): void
}>()

/** 布局 Store，用于读取当前任务及持久化卫星筛选状态。 */
const store = useLayoutStore()

/** 从接口获取的卫星类型与对应系列映射。 */
const typeSerialsMap = ref<Record<string, string[]>>({})

/** 当前选中的卫星类型筛选值，优先从 Store 持久化状态中恢复。 */
const selectedType = ref<string>(store.selectedSatType || '')

/** 当前选中的卫星系列筛选值，优先从 Store 持久化状态中恢复。 */
const selectedSeries = ref<string>(store.selectedSatSeries || '')


/**
 * 获取可供选择的卫星类型列表。
 *
 * @returns 卫星类型名称列表
 */
const typeOptions = computed<string[]>(() => {
  return Object.keys(typeSerialsMap.value)
})

/**
 * [计算属性说明]
 * 当前选中的卫星类型下可供选择的系列列表（若选择"全部类型"或未选类型，则汇总合并展示所有类型下的所有系列）
 */
const seriesOptions = computed<string[]>(() => {
  if (!selectedType.value) {
    /** 合并后的全部卫星系列名称。 */
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

  /** 当前类型下可用的卫星系列列表。 */
  const availSeries = typeSerialsMap.value[type] || []
  /** 类型切换后默认选中的卫星系列。 */
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
    /** 当前需要保留或恢复的卫星类型。 */
    let currentType = selectedType.value || store.selectedSatType || ''
    if (!currentType || isTypeDisabled(currentType) || !options.includes(currentType)) {
      /** 第一个未被禁用的卫星类型。 */
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
    /** 当前需要保留或恢复的卫星系列。 */
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
    /** 卫星类型与系列映射接口响应。 */
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

interface SatTimeEffectInfo {
  /** 链路开始时间。 */
  beginTime: string
  /** 链路结束时间。 */
  endTime: string
  /** 链路持续时长，单位为分钟。 */
  duration: number
  /** 链路对应的接收站名称。 */
  receiveName: string
}

/** 展示在卫星资产列表中的卫星信息。 */
interface SatListItem {
  /** 卫星 NORAD 编号。 */
  norad: number
  /** 卫星名称。 */
  name: string
  /** 卫星类型。 */
  satType: string
  /** 是否为中继卫星。 */
  isRelay: boolean
  /** 威胁度分数，未计算时为空。 */
  threatScore: number | null
  /** 过境链路信息，暂无链路时为空。 */
  timeEffect: SatTimeEffectInfo | null
}

/** 卫星资产列表的排序模式。 */
type SatSortMode = 'threat' | 'transTime'

/** 当前卫星资产列表的排序模式。 */
const sortMode = ref<SatSortMode>('threat')

/** 威胁度详情弹窗是否可见。 */
const threatDialogVisible = ref(false)
/** 威胁度详情是否正在加载。 */
const threatLoading = ref(false)
/** 当前加载完成的威胁度详情。 */
const threatInfo = ref<SatelliteThreatInfo | null>(null)
/** 当前查看详情的卫星基本信息。 */
const threatDialogSat = ref<{ norad: number; name: string } | null>(null)

/**
 * 格式化威胁度分数，整数不显示小数部分，其余最多保留两位小数。
 *
 * @param score 威胁度分数
 * @returns 格式化后的威胁度文本
 */
const formatThreatScore = (score: number): string => {
  if (Number.isInteger(score)) return String(score)
  return Number(score.toFixed(2)).toString()
}

/**
 * 将过境时间字符串格式化为本地日期时间文本。
 *
 * @param timeStr 过境时间字符串
 * @returns 格式化后的时间文本，缺失或无法解析时返回原值或占位符
 */
const formatTransTime = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '--'
  /** 解析后的日期对象。 */
  const d = new Date(timeStr)
  if (Number.isNaN(d.getTime())) return timeStr
  /** 将数字补齐为两位字符串。 */
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 将链路时长格式化为分钟文本。
 *
 * @param duration 链路时长，单位为分钟
 * @returns 格式化后的时长文本
 */
const formatDuration = (duration: number | null | undefined): string => {
  if (duration == null || Number.isNaN(duration)) return '--'
  /** 按展示精度处理后的链路时长。 */
  const rounded = Number.isInteger(duration) ? duration : Number(duration.toFixed(1))
  return `${rounded} 分钟`
}

/**
 * 根据威胁度分数返回对应的样式类名。
 * 分数在 0 到 1 之间时按比例转换为百分制。
 *
 * @param score 威胁度分数
 * @returns 威胁等级样式类名
 */
const getThreatLevelClass = (score: number): string => {
  /** 转换为百分制后的威胁度分数。 */
  const normalized = score <= 1 ? score * 100 : score
  if (normalized >= 70) return 'threat-high'
  if (normalized >= 40) return 'threat-medium'
  return 'threat-low'
}

/**
 * 打开卫星威胁度详情弹窗并加载后端计算信息。
 *
 * @param sat 待查看详情的卫星
 */
const openThreatDetail = async (sat: SatListItem) => {
  /** 当前任务 ID，用于请求卫星威胁度详情。 */
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
    /** 卫星威胁度详情接口响应。 */
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
/**
 * [函数说明]
 * 处理威胁度详情弹窗关闭事件，清空相关状态
 */
const handleThreatDialogClosed = () => {
  threatInfo.value = null
  threatDialogSat.value = null
}

/**
 * 跳转至态势拓扑分析页，并聚焦当前卫星的全部传输链路
 *
 * @param sat 待分析的卫星
 */
const openTopoAnalysis = (sat: SatListItem) => {
  emit('select-satellite', sat.norad)
  store.navigateToTopoAnalysis(sat.norad)
}
/**
 * 归一化威胁度分数，将 0-1 的分数转换为百分制
 * @param score 威胁度分数
 * @returns 归一化后的威胁度分数
 */
const normalizeThreatScore = (score: number | null): number => {
  if (score == null) return -Infinity
  return score <= 1 ? score * 100 : score
}
/**
 * 解析过境时间字符串为时间戳
 * @param timeStr 过境时间字符串
 * @returns 时间戳，解析失败返回 Infinity
 */
const parseTransTimeTs = (timeStr: string | null | undefined): number => {
  if (!timeStr) return Infinity
  const ts = new Date(timeStr).getTime()
  return Number.isNaN(ts) ? Infinity : ts
}
/**
 * 判断卫星是否有资格进入排行榜
 * @param sat 卫星信息
 * @returns 是否有资格
 */
const isTopRankEligible = (sat: SatListItem): boolean => {
  if (sortMode.value === 'threat') return sat.threatScore != null
  return sat.timeEffect != null
}

/**
 * 提取当前矩阵中的敌方天基过境与中继卫星列表，支持按威胁度或链路时长排序。
 */
const satList = computed<SatListItem[]>(() => {
  /** 当前算法矩阵响应数据。 */
  const matrixData = props.matrixData
  if (!matrixData) return []
  // 构建 NORAD -> 威胁度映射
  /** 按 NORAD 编号索引的威胁度映射。 */
  const threatMap = new Map<number, number>()
    ; (matrixData.threatSats || []).forEach((item) => {
      threatMap.set(item.norad, item.threatScore)
    })
  // 构建 NORAD -> 过境链路时长映射
  /** 按 NORAD 编号索引的过境链路映射。 */
  const timeEffectMap = new Map<number, SatTimeEffectInfo>()
    ; (matrixData.timeEffects || []).forEach((item) => {
      timeEffectMap.set(item.norad, {
        beginTime: item.beginTime,
        endTime: item.endTime,
        duration: item.duration,
        receiveName: item.receiveName,
      })
    })

  // 使用 Map 来去重并合并 initMatrixList 与 satelliteMatrixList
  /** 按 NORAD 编号去重并合并后的卫星信息映射。 */
  const map = new Map<number, SatListItem>()

  /** 初始算法矩阵中的卫星列表。 */
  const initList = matrixData.initMatrixList?.length ? matrixData.initMatrixList : []
  /** 卫星矩阵中的卫星列表。 */
  const satMatrixList = matrixData.satelliteMatrixList?.length ? matrixData.satelliteMatrixList : []
  /** 中继卫星 NORAD 编号列表。 */
  const relayList = matrixData.relayRelation?.relayList?.length ? matrixData.relayRelation.relayList : []

  // 遍历 initMatrixList 和 satelliteMatrixList，合并卫星信息
  initList.forEach((s: InitMatrix) => {
    /** 根据卫星类型或中继关系判断是否为中继卫星。 */
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      isRelay,
      threatScore: threatMap.get(s.norad) ?? null,
      timeEffect: timeEffectMap.get(s.norad) ?? null,
    })
  })
  satMatrixList.forEach((s: SatelliteMatrix) => {
    /** 根据卫星类型或中继关系判断是否为中继卫星。 */
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      isRelay,
      threatScore: threatMap.get(s.norad) ?? null,
      timeEffect: timeEffectMap.get(s.norad) ?? null,
    })
  })

  /** 去重合并后的卫星资产列表。 */
  const list = Array.from(map.values())

  // 根据当前排序模式进行排序
  if (sortMode.value === 'transTime') {
    return list.sort((a, b) => {
      /** 两颗卫星的链路持续时长。 */
      const durationA = a.timeEffect?.duration ?? Infinity
      const durationB = b.timeEffect?.duration ?? Infinity
      if (durationA !== durationB) return durationA - durationB
      return parseTransTimeTs(a.timeEffect?.beginTime) - parseTransTimeTs(b.timeEffect?.beginTime)
    })
  }

  return list.sort((a, b) => normalizeThreatScore(b.threatScore) - normalizeThreatScore(a.threatScore))
})

const selectedSatelliteName = computed(() => {
  if (props.selectedNorad == null) return ''
  return satList.value.find((sat) => sat.norad === props.selectedNorad)?.name || `Sat-${props.selectedNorad}`
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

  .section-header-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #b5d5ff;

    .current-sat {
      flex: 1;
      min-width: 0;
      margin-left: auto;
      font-weight: 700;
      color: #40f2ff;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .count-tag {
      margin-left: 0;
      flex-shrink: 0;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      background: rgba(64, 242, 255, 0.15);
      color: #7dd3fc;
    }
  }

  .sort-toggle-bar {
    display: flex;
    gap: 6px;

    .sort-btn {
      flex: 1;
      height: 26px;
      padding: 0 8px;
      font-size: 11px;
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
      }

      &.active {
        color: #ffffff;
        font-weight: 600;
        background: linear-gradient(135deg, rgba(0, 180, 216, 0.4) 0%, rgba(0, 225, 255, 0.25) 100%);
        border-color: #00e1ff;
        box-shadow: 0 0 8px rgba(0, 225, 255, 0.3);
      }
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
        flex-shrink: 0;
      }

      .series-current {
        flex: 1;
        min-width: 0;
        margin-left: 8px;
        padding: 1px 8px;
        border-radius: 4px;
        text-align: right;
        font-weight: 700;
        color: #40f2ff;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
  text-align: left;

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

    .metric-highlight {
      color: #fecaca !important;
      background: rgba(239, 68, 68, 0.25) !important;
      border-color: rgba(239, 68, 68, 0.55) !important;
    }
  }

  &.card-threat-rank-2 {
    border-color: rgba(249, 115, 22, 0.75);
    background: rgba(249, 115, 22, 0.12);
    box-shadow: 0 0 8px rgba(249, 115, 22, 0.22);

    .metric-highlight {
      color: #fed7aa !important;
      background: rgba(249, 115, 22, 0.2) !important;
      border-color: rgba(249, 115, 22, 0.45) !important;
    }
  }

  &.card-threat-rank-3 {
    border-color: rgba(250, 204, 21, 0.7);
    background: rgba(250, 204, 21, 0.1);
    box-shadow: 0 0 6px rgba(250, 204, 21, 0.18);

    .metric-highlight {
      color: #fef08a !important;
      background: rgba(250, 204, 21, 0.18) !important;
      border-color: rgba(250, 204, 21, 0.4) !important;
    }
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-bottom: 8px;

    .sat-name {
      font-size: 16px;
      color: #ffffff;
      min-width: 0;
      flex: 1;
      text-align: left;

      .relay-tag {
        margin-left: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #fbbf24;
        background: rgba(245, 158, 11, 0.18);
        border: 1px solid rgba(245, 158, 11, 0.4);
        border-radius: 4px;
        padding: 0 6px;
        vertical-align: middle;
      }
    }

    .metric-highlight {
      flex-shrink: 0;
      font-size: 14px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 4px;
      white-space: nowrap;
      letter-spacing: 0.2px;
      text-shadow: 0 0 8px currentColor;

      &.threat-high {
        color: #fca5a5;
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(239, 68, 68, 0.4);
      }

      &.threat-medium {
        color: #fdba74;
        background: rgba(249, 115, 22, 0.16);
        border: 1px solid rgba(249, 115, 22, 0.38);
      }

      &.threat-low {
        color: #7dd3fc;
        background: rgba(56, 189, 248, 0.14);
        border: 1px solid rgba(56, 189, 248, 0.35);
      }

      &.threat-unknown {
        color: #64748b;
        background: rgba(100, 116, 139, 0.12);
        border: 1px solid rgba(100, 116, 139, 0.2);
      }

      &.metric-duration {
        color: #86efac;
        background: rgba(34, 197, 94, 0.14);
        border: 1px solid rgba(34, 197, 94, 0.35);
      }
    }
  }

  .card-station {
    display: block;
    width: 100%;
    font-size: 14px;
    color: #e2e8f0;
    margin-bottom: 6px;
    line-height: 1.4;
    text-align: left;
  }

  .card-time-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    width: 100%;
    font-size: 13px;
    color: #86efac;
    line-height: 1.4;
    text-align: left;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 4px;

    .click-hint {
      color: #38bdf8;
      font-size: 11px;
      font-weight: 600;
    }

    .detail-btn {
      font-size: 11px;
      padding: 0;
      height: auto;
      margin-left: auto;
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
