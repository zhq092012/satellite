<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">分析结果</span>
      </div>

    </div>

    <div v-if="!activeMatrix" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无矩阵数据</p>
      <p class="empty-sub">请在左侧选择任务以加载态势分析</p>
    </div>

    <template v-else>
      <div class="asset-scroll">
        <!-- 卫星列表 -->
        <section class="asset-section">
          <div class="asset-section-head">
            <span class="asset-section-title">卫星列表</span>
            <span class="asset-count">共 {{ filteredSatellites.length }} / {{ satelliteRows.length }} 颗</span>
          </div>
          <div class="filter-bar">
            <el-input v-model="satFilters.keyword" size="small" clearable placeholder="名称 / NORAD"
              class="filter-control filter-control--grow" />
            <el-select v-model="satFilters.satType" size="small" clearable placeholder="类型" class="filter-control"
              popper-class="c2-filter-popper">
              <el-option v-for="item in satTypeOptions" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="satFilters.orbit" size="small" clearable placeholder="轨道" class="filter-control"
              popper-class="c2-filter-popper">
              <el-option v-for="item in satOrbitOptions" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="satFilters.usage" size="small" clearable placeholder="用途" class="filter-control"
              popper-class="c2-filter-popper">
              <el-option v-for="item in satUsageOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </div>
          <el-table :data="filteredSatellites" size="small" height="240" highlight-current-row row-key="norad"
            class="asset-table" :row-class-name="satRowClassName" empty-text="当前筛选下暂无卫星" @row-click="handleSatRowClick">
            <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="norad" label="NORAD" width="88" />
            <el-table-column prop="satType" label="类型" min-width="110" show-overflow-tooltip />
            <el-table-column prop="orbitLabel" label="轨道" width="72" />
            <el-table-column prop="usage" label="用途" width="72" />
            <el-table-column prop="heightText" label="高度" width="92" />
            <el-table-column prop="threatText" label="威胁度" width="88" sortable :sort-method="sortByThreat" />
            <el-table-column prop="coverageText" label="覆盖率" width="92" sortable :sort-method="sortByCoverage" />
          </el-table>
        </section>

        <!-- 传输链路列表 -->
        <section class="asset-section">
          <div class="asset-section-head">
            <span class="asset-section-title">链路列表</span>
            <span class="asset-count">共 {{ filteredLinks.length }} / {{ linkRows.length }} 条</span>
          </div>
          <div class="filter-bar">
            <el-input v-model="linkFilters.keyword" size="small" clearable placeholder="卫星 / 地面站 / 数据中心"
              class="filter-control filter-control--grow" />
            <el-select v-model="linkFilters.status" size="small" placeholder="状态" class="filter-control"
              popper-class="c2-filter-popper">
              <el-option label="全部状态" value="all" />
              <el-option label="可用" value="ok" />
              <el-option label="阻断" value="blocked" />
            </el-select>
          </div>
          <el-table :data="filteredLinks" size="small" height="240" highlight-current-row row-key="id"
            class="asset-table" :row-class-name="linkRowClassName" empty-text="当前筛选下暂无链路"
            @row-click="handleLinkRowClick">
            <el-table-column prop="pathText" label="链路路径" min-width="200" show-overflow-tooltip />
            <el-table-column prop="threatText" label="威胁度" width="88" sortable :sort-method="sortLinkByThreat" />
            <el-table-column prop="coverageText" label="覆盖率" width="92" sortable :sort-method="sortLinkByCoverage" />
            <el-table-column prop="durationText" label="链路时长" width="100" sortable :sort-method="sortLinkByDuration" />
            <el-table-column prop="transmitTime" label="传输时间" min-width="150" show-overflow-tooltip />
            <el-table-column prop="statusText" label="状态" width="72" />
          </el-table>
        </section>

        <!-- 地面站列表 -->
        <section class="asset-section">
          <div class="asset-section-head">
            <span class="asset-section-title">地面站列表</span>
            <span class="asset-count">共 {{ filteredGroundStations.length }} / {{ groundStations.length }} 个</span>
          </div>
          <div class="filter-bar">
            <el-input v-model="stationFilters.keyword" size="small" clearable placeholder="名称"
              class="filter-control filter-control--grow" />
            <el-select v-model="stationFilters.status" size="small" placeholder="状态" class="filter-control"
              popper-class="c2-filter-popper">
              <el-option label="全部状态" value="all" />
              <el-option label="正常" value="ok" />
              <el-option label="毁伤" value="struck" />
            </el-select>
          </div>
          <el-table :data="filteredGroundStations" size="small" height="180" highlight-current-row row-key="id"
            class="asset-table" :row-class-name="infraRowClassName" empty-text="当前筛选下暂无地面站"
            @row-click="handleSelectInfra">
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column label="状态" width="72">
              <template #default="{ row }">{{ row.status === 1 ? '毁伤' : '正常' }}</template>
            </el-table-column>
            <el-table-column label="纬度" width="110">
              <template #default="{ row }">{{ formatDegree(row.latitude) }}</template>
            </el-table-column>
            <el-table-column label="经度" width="110">
              <template #default="{ row }">{{ formatDegree(row.longitude) }}</template>
            </el-table-column>
          </el-table>
        </section>

        <!-- 数据中心列表 -->
        <section class="asset-section">
          <div class="asset-section-head">
            <span class="asset-section-title">数据中心列表</span>
            <span class="asset-count">共 {{ filteredDataCenters.length }} / {{ dataCenters.length }} 个</span>
          </div>
          <div class="filter-bar">
            <el-input v-model="centerFilters.keyword" size="small" clearable placeholder="名称"
              class="filter-control filter-control--grow" />
            <el-select v-model="centerFilters.status" size="small" placeholder="状态" class="filter-control"
              popper-class="c2-filter-popper">
              <el-option label="全部状态" value="all" />
              <el-option label="正常" value="ok" />
              <el-option label="毁伤" value="struck" />
            </el-select>
          </div>
          <el-table :data="filteredDataCenters" size="small" height="180" highlight-current-row row-key="id"
            class="asset-table" :row-class-name="infraRowClassName" empty-text="当前筛选下暂无数据中心"
            @row-click="handleSelectInfra">
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column label="状态" width="72">
              <template #default="{ row }">{{ row.status === 1 ? '毁伤' : '正常' }}</template>
            </el-table-column>
            <el-table-column label="纬度" width="110">
              <template #default="{ row }">{{ formatDegree(row.latitude) }}</template>
            </el-table-column>
            <el-table-column label="经度" width="110">
              <template #default="{ row }">{{ formatDegree(row.longitude) }}</template>
            </el-table-column>
          </el-table>
        </section>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧资产表格面板。
 * 以表格展示卫星、链路、地面站、数据中心；威胁度 / 覆盖率 / 链路时长可排序，各类列表支持筛选。
 */
import { computed, reactive, toRef } from 'vue'
import { type MatrixResult } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
import {
  useElectronicCesiumBridge,
  type InfrastructureLocation,
} from '@/composables/useElectronicCesiumBridge'
import {
  collectSatelliteTransmissionLinks,
  collectSeriesTransmissionLinks,
  resolveTaskEndMs,
  parseTimeToMs,
  type SatelliteTransmissionLink,
} from '@/utils/satelliteFullChainAnalysis'
import { orbitTypeLabel } from '@/utils/zhchPlanDisplay'

const store = useLayoutStore()

const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD（若有） */
  selectedSatelliteNorad?: number | null
  /** 当前在地图上高亮展示的传输链路 ID */
  selectedTransmissionLinkId?: string | null
}>()

const emit = defineEmits<{
  (e: 'clear-satellite-selection'): void
  /** 选中/取消选中卫星 */
  (e: 'select-satellite', norad: number | null): void
  /** 选中/取消选中传输链路（再次点击同一链路则取消） */
  (e: 'select-transmission-link', link: SatelliteTransmissionLink | null): void
}>()

/** 卫星列表筛选条件。 */
const satFilters = reactive({
  /** 名称或 NORAD 关键字 */
  keyword: '',
  /** 卫星类型 */
  satType: '',
  /** 轨道类型 */
  orbit: '',
  /** 用途 */
  usage: '',
})

/** 链路列表筛选条件。 */
const linkFilters = reactive({
  /** 路径节点关键字 */
  keyword: '',
  /** 可用 / 阻断 */
  status: 'all' as 'all' | 'ok' | 'blocked',
})

/** 地面站筛选条件。 */
const stationFilters = reactive({
  /** 名称关键字 */
  keyword: '',
  /** 正常 / 毁伤 */
  status: 'all' as 'all' | 'ok' | 'struck',
})

/** 数据中心筛选条件。 */
const centerFilters = reactive({
  /** 名称关键字 */
  keyword: '',
  /** 正常 / 毁伤 */
  status: 'all' as 'all' | 'ok' | 'struck',
})

/** 当前任务结束毫秒，用于过站分段延迟。 */
const taskEndMs = computed(() => resolveTaskEndMs(store.activedTask?.endDate))

/** 当前生效矩阵 */
const activeMatrix = computed<MatrixResult | null>(() => props.matrixData)

const { infrastructureNodes } = useElectronicCesiumBridge(toRef(props, 'matrixData'))

/**
 * 右侧表格中的卫星行。
 */
interface SituationSatelliteRow {
  /** NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星类型 */
  satType: string
  /** 轨道类型中文 */
  orbitLabel: string
  /** 用途 */
  usage: string
  /** 高度展示 */
  heightText: string
  /** 威胁度数值（百分制），无效为 null */
  threatScore: number | null
  /** 威胁度展示 */
  threatText: string
  /** 覆盖率数值，无效为 null */
  coverageValue: number | null
  /** 覆盖率展示 */
  coverageText: string
}

/**
 * 右侧表格中的链路行。
 */
interface SituationLinkRow {
  /** 链路 ID */
  id: string
  /** 节点路径文案 */
  pathText: string
  /** 威胁度数值 */
  threatScore: number | null
  /** 威胁度展示 */
  threatText: string
  /** 覆盖率数值 */
  coverageValue: number | null
  /** 覆盖率展示 */
  coverageText: string
  /** 链路时长毫秒 */
  durationMs: number | null
  /** 链路时长展示 */
  durationText: string
  /** 传输时间区间 */
  transmitTime: string
  /** 是否阻断 */
  blocked: boolean
  /** 状态文案 */
  statusText: string
  /** 原始链路对象，供地图选中使用 */
  raw: SatelliteTransmissionLink
}

/**
 * 将威胁度原始值规范为百分制。
 * @param raw 接口威胁分（0-1 或 0-100）
 * @returns 百分制分数；无效时为 null
 */
const normalizeThreat = (raw?: number): number | null => {
  if (raw == null || !Number.isFinite(raw)) return null
  return raw <= 1 ? raw * 100 : raw
}

/**
 * 格式化覆盖率百分比。
 * @param raw 覆盖率数值
 */
const formatCoverage = (raw?: number | null): string => {
  if (raw == null || !Number.isFinite(raw)) return '--'
  return `${Number(raw.toFixed(1))}%`
}

/**
 * 格式化经纬度。
 * @param value 度数
 */
const formatDegree = (value: number): string => {
  if (!Number.isFinite(value)) return '--'
  return `${value.toFixed(4)}°`
}

/**
 * 可排序指标比较：空值排在后面。
 * @param a 左值
 * @param b 右值
 * @returns 排序差值
 */
const compareMetric = (a: number | null | undefined, b: number | null | undefined): number => {
  const leftEmpty = a == null || !Number.isFinite(a)
  const rightEmpty = b == null || !Number.isFinite(b)
  if (leftEmpty && rightEmpty) return 0
  if (leftEmpty) return 1
  if (rightEmpty) return -1
  return (a as number) - (b as number)
}

/**
 * 从离散字段中提取去重后的筛选项。
 * @param rows 数据行
 * @param getter 取值函数
 * @returns 非空去重选项
 */
const uniqueOptions = <T,>(rows: T[], getter: (row: T) => string): string[] => {
  const set = new Set<string>()
  rows.forEach((row) => {
    const value = (getter(row) || '').trim()
    if (value && value !== '--') set.add(value)
  })
  return Array.from(set)
}

/**
 * 文本是否包含关键字（忽略大小写）。
 * @param source 源文本
 * @param keyword 关键字
 */
const includesKeyword = (source: string, keyword: string): boolean => {
  const key = keyword.trim().toLowerCase()
  if (!key) return true
  return source.toLowerCase().includes(key)
}

/** NORAD -> 威胁度映射 */
const threatMap = computed(() => {
  const map = new Map<number, number>()
    ; (activeMatrix.value?.threatSats || []).forEach((item) => {
      const val = normalizeThreat(Number(item.threatScore))
      if (val != null) map.set(item.norad, val)
    })
  return map
})

/** NORAD -> 覆盖率映射 */
const coverageMap = computed(() => {
  const map = new Map<number, number>()
  const matrix = activeMatrix.value
  if (!matrix) return map

    ; (matrix.initMatrixList || []).forEach((item) => {
      if (Number.isFinite(item.coverage)) {
        map.set(item.norad, item.coverage!)
      }
    })
    ; (matrix.satelliteMatrixList || []).forEach((item) => {
      if (Number.isFinite(item.coverage) && !map.has(item.norad)) {
        map.set(item.norad, item.coverage!)
      }
    })
  return map
})

/** 去重后的卫星列表 */
const satelliteRows = computed<SituationSatelliteRow[]>(() => {
  const matrix = activeMatrix.value
  if (!matrix) return []

  const rowMap = new Map<number, SituationSatelliteRow>()
  const upsert = (item: {
    norad: number
    name?: string
    satType?: string | null
    orbitType?: number
    usage?: string
    height?: number
    coverage?: number
  }) => {
    const exist = rowMap.get(item.norad)
    const threat = threatMap.value.get(item.norad) ?? exist?.threatScore ?? null
    const coverage = coverageMap.value.get(item.norad) ?? item.coverage ?? exist?.coverageValue ?? null
    rowMap.set(item.norad, {
      norad: item.norad,
      name: item.name || exist?.name || `Sat-${item.norad}`,
      satType: item.satType || exist?.satType || '--',
      orbitLabel: item.orbitType != null ? orbitTypeLabel(item.orbitType) : exist?.orbitLabel || '--',
      usage: item.usage || exist?.usage || '--',
      heightText:
        item.height != null && Number.isFinite(item.height)
          ? `${Number(item.height.toFixed(1))} km`
          : exist?.heightText || '--',
      threatScore: threat,
      threatText: threat != null ? `${Math.round(threat)}分` : exist?.threatText || '--',
      coverageValue: coverage ?? null,
      coverageText: formatCoverage(coverage),
    })
  }

    ; (matrix.initMatrixList || []).forEach((item) => upsert(item))
    ; (matrix.satelliteMatrixList || []).forEach((item) => upsert(item))
    ; (matrix.threatSats || []).forEach((item) => upsert(item))

  return Array.from(rowMap.values()).sort((a, b) => a.norad - b.norad)
})

/** 地面接收站 */
const groundStations = computed(() => infrastructureNodes.value.filter((node) => node.type === 'RECEIVE'))
/** 数据中心 / 中心云站 */
const dataCenters = computed(() => infrastructureNodes.value.filter((node) => node.type === 'STATION'))

/**
 * 当前展示的传输链路：
 * - 选中卫星时：仅该卫星相关链路，按过境开始时间从早到晚排序
 * - 未选中时：当前系列范围内全部链路
 */
const transmissionLinks = computed<SatelliteTransmissionLink[]>(() => {
  const matrix = activeMatrix.value
  if (!matrix) return []

  const norad = props.selectedSatelliteNorad
  if (norad != null) {
    return collectSatelliteTransmissionLinks(matrix, norad, taskEndMs.value)
  }

  return collectSeriesTransmissionLinks(matrix, taskEndMs.value)
})

/** 获取源卫星 NORAD */
const getLinkSourceNorad = (link: SatelliteTransmissionLink): number | null => {
  const satNode = link.nodes.find((node) => node.layer === 'SAT')
  return satNode ? Number(satNode.id) : null
}

/**
 * 计算链路传输时长（毫秒）。
 * @param link 传输链路
 * @returns 时长毫秒；无效时为 null
 */
const getLinkDurationMs = (link: SatelliteTransmissionLink): number | null => {
  let durationMs = link.transmitEndMs - link.transmitStartMs
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    if (link.transmitTime && link.transmitTime.includes('~')) {
      const parts = link.transmitTime.split('~')
      const start = parseTimeToMs(parts[0]?.trim())
      const end = parseTimeToMs(parts[1]?.trim())
      if (end > start) durationMs = end - start
    }
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null
  return durationMs
}

/**
 * 将毫秒时长格式化为中文展示。
 * @param durationMs 时长毫秒
 */
const formatDurationText = (durationMs: number | null): string => {
  if (durationMs == null) return '--'
  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}时${minutes}分`
  if (minutes > 0) return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分`
  return `${seconds}秒`
}

/** 链路表格行 */
const linkRows = computed<SituationLinkRow[]>(() => {
  return transmissionLinks.value.map((link) => {
    const norad = getLinkSourceNorad(link)
    const threat = norad != null ? threatMap.value.get(norad) ?? null : null
    const coverage = norad != null ? coverageMap.value.get(norad) ?? null : null
    const durationMs = getLinkDurationMs(link)
    const blocked = !!link.blocked
    return {
      id: link.id,
      pathText: link.nodes.map((node) => node.name).join(' → '),
      threatScore: threat,
      threatText: threat != null ? `${Math.round(threat)}分` : '--',
      coverageValue: coverage,
      coverageText: formatCoverage(coverage),
      durationMs,
      durationText: formatDurationText(durationMs),
      transmitTime: link.transmitTime || '--',
      blocked,
      statusText: blocked ? '阻断' : '可用',
      raw: link,
    }
  })
})

/** 卫星类型筛选项 */
const satTypeOptions = computed(() => uniqueOptions(satelliteRows.value, (row) => row.satType))
/** 轨道筛选项 */
const satOrbitOptions = computed(() => uniqueOptions(satelliteRows.value, (row) => row.orbitLabel))
/** 用途筛选项 */
const satUsageOptions = computed(() => uniqueOptions(satelliteRows.value, (row) => row.usage))

/** 筛选后的卫星行 */
const filteredSatellites = computed(() => {
  const keyword = satFilters.keyword
  return satelliteRows.value.filter((row) => {
    if (!includesKeyword(`${row.name} ${row.norad}`, keyword)) return false
    if (satFilters.satType && row.satType !== satFilters.satType) return false
    if (satFilters.orbit && row.orbitLabel !== satFilters.orbit) return false
    if (satFilters.usage && row.usage !== satFilters.usage) return false
    return true
  })
})

/** 筛选后的链路行 */
const filteredLinks = computed(() => {
  const keyword = linkFilters.keyword
  return linkRows.value.filter((row) => {
    if (!includesKeyword(`${row.pathText} ${row.transmitTime}`, keyword)) return false
    if (linkFilters.status === 'blocked' && !row.blocked) return false
    if (linkFilters.status === 'ok' && row.blocked) return false
    return true
  })
})

/**
 * 按名称与状态筛选地面设施。
 * @param list 地面站或数据中心
 * @param keyword 名称关键字
 * @param status 状态筛选
 */
const filterInfra = (
  list: InfrastructureLocation[],
  keyword: string,
  status: 'all' | 'ok' | 'struck'
): InfrastructureLocation[] => {
  return list.filter((node) => {
    if (!includesKeyword(node.name, keyword)) return false
    if (status === 'ok' && node.status === 1) return false
    if (status === 'struck' && node.status !== 1) return false
    return true
  })
}

/** 筛选后的地面站 */
const filteredGroundStations = computed(() =>
  filterInfra(groundStations.value, stationFilters.keyword, stationFilters.status)
)
/** 筛选后的数据中心 */
const filteredDataCenters = computed(() =>
  filterInfra(dataCenters.value, centerFilters.keyword, centerFilters.status)
)

/** 卫星威胁度排序 */
const sortByThreat = (a: SituationSatelliteRow, b: SituationSatelliteRow) =>
  compareMetric(a.threatScore, b.threatScore)
/** 卫星覆盖率排序 */
const sortByCoverage = (a: SituationSatelliteRow, b: SituationSatelliteRow) =>
  compareMetric(a.coverageValue, b.coverageValue)
/** 链路威胁度排序 */
const sortLinkByThreat = (a: SituationLinkRow, b: SituationLinkRow) =>
  compareMetric(a.threatScore, b.threatScore)
/** 链路覆盖率排序 */
const sortLinkByCoverage = (a: SituationLinkRow, b: SituationLinkRow) =>
  compareMetric(a.coverageValue, b.coverageValue)
/** 链路时长排序 */
const sortLinkByDuration = (a: SituationLinkRow, b: SituationLinkRow) =>
  compareMetric(a.durationMs, b.durationMs)

/**
 * 卫星行高亮 class。
 * @param param0 行参数
 */
const satRowClassName = ({ row }: { row: SituationSatelliteRow }): string => {
  return props.selectedSatelliteNorad === row.norad ? 'is-active-row' : ''
}

/**
 * 链路行高亮 class。
 * @param param0 行参数
 */
const linkRowClassName = ({ row }: { row: SituationLinkRow }): string => {
  const classes: string[] = []
  if (props.selectedTransmissionLinkId === row.id) classes.push('is-active-row')
  if (row.blocked) classes.push('is-blocked-row')
  return classes.join(' ')
}

/**
 * 地面设施行高亮 class。
 * @param param0 行参数
 */
const infraRowClassName = ({ row }: { row: InfrastructureLocation }): string => {
  return isInfraActive(row) ? 'is-active-row' : ''
}

/**
 * 点击卫星表格行：选中并定位地球；再次点击取消。
 * @param row 卫星行
 */
const handleSatRowClick = (row: SituationSatelliteRow) => {
  if (props.selectedSatelliteNorad === row.norad) {
    emit('clear-satellite-selection')
    return
  }
  emit('select-satellite', row.norad)
}

/**
 * 当前地面设施是否被选中。
 * @param node 地面站或数据中心
 */
const isInfraActive = (node: InfrastructureLocation): boolean => {
  const selected = store.selectedInfrastructureNode
  return !!selected && selected.id === node.id && selected.type === node.type
}

/**
 * 点击地面站 / 数据中心：同步 Store 以便地球定位；再次点击取消。
 * @param node 基础设施节点
 */
const handleSelectInfra = (node: InfrastructureLocation) => {
  if (isInfraActive(node)) {
    store.setSelectedInfrastructureNode(null)
    return
  }
  store.setSelectedInfrastructureNode(node)
}

/**
 * 点击链路表格行：选中并在地图上绘制连线；再次点击同一链路则取消选中。
 * @param row 链路行
 */
const handleLinkRowClick = (row: SituationLinkRow) => {
  if (props.selectedTransmissionLinkId === row.id) {
    emit('select-transmission-link', null)
    return
  }
  emit('select-transmission-link', row.raw)
}

/** 清除当前选中的传输链路（地图连线与卡片高亮一并取消）。 */
const handleClearSelectedLink = () => {
  if (!props.selectedTransmissionLinkId) return
  emit('select-transmission-link', null)
}
</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  color: #e2efff;
  overflow: hidden;
}

.panel-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }
}

.clear-link-btn {
  flex-shrink: 0;
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(64, 242, 255, 0.35);
  background: rgba(8, 18, 32, 0.85);
  color: #7dd3fc;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: rgba(64, 242, 255, 0.55);
    background: rgba(64, 242, 255, 0.12);
    color: #e0faff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.asset-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 3px;
  }
}

.asset-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(12, 22, 38, 0.55);
  border: 1px solid rgba(0, 225, 255, 0.12);
}

.asset-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.asset-section-title {
  font-size: 13px;
  font-weight: 700;
  color: #7dd3fc;
}

.asset-count {
  font-size: 11px;
  color: #94a3b8;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.filter-control {
  width: 108px;

  &--grow {
    flex: 1;
    min-width: 132px;
    width: auto;
  }
}

.asset-table {
  width: 100%;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.1);
  --atlas-app-text-color-regular: #cbd5e1;
  --atlas-app-text-color-primary: #e2efff;
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  :deep(td.atlas-app-table__cell) {
    font-size: 12px;
    color: #cbd5e1;
    background: transparent !important;
    border-bottom: 1px solid rgba(0, 225, 255, 0.08);
    cursor: pointer;
  }

  :deep(.atlas-app-table__empty-block) {
    background: transparent;
    color: #64748b;
  }

  :deep(.is-active-row td.atlas-app-table__cell) {
    background: rgba(0, 225, 255, 0.14) !important;
    color: #e0faff;
  }

  :deep(.is-blocked-row td.atlas-app-table__cell) {
    color: #fda4af;
  }

  :deep(.caret-wrapper) {
    width: 16px;
  }
}

.empty-sat-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  gap: 6px;

  .empty-icon {
    font-size: 28px;
  }

  .empty-text {
    margin: 0;
    font-size: 14px;
    color: #94a3b8;
  }

  .empty-sub {
    margin: 0;
    font-size: 12px;
  }
}

:deep(.atlas-app-input__wrapper),
:deep(.atlas-app-select__wrapper) {
  background: rgba(8, 20, 36, 0.9) !important;
  box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.28) inset !important;
}

:deep(.atlas-app-input__inner),
:deep(.atlas-app-select__placeholder),
:deep(.atlas-app-select__selected-item) {
  color: #e2efff !important;
  font-size: 12px;
}
</style>

<style lang="scss">
.c2-filter-popper.atlas-app-popper,
.atlas-app-popper.c2-filter-popper {
  background: rgba(8, 15, 26, 0.98) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;

  .atlas-app-select-dropdown__item {
    color: #cbd5e1 !important;

    &:hover,
    &.is-hovering {
      background: rgba(0, 225, 255, 0.12) !important;
      color: #40f2ff !important;
    }

    &.is-selected {
      color: #40f2ff !important;
    }
  }
}

.asset-detail-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.asset-detail-dialog-modal {
  background-color: rgba(4, 10, 20, 0.72) !important;
}

.atlas-app-dialog.asset-detail-dialog,
.asset-detail-dialog .atlas-app-dialog {
  background: rgba(8, 15, 26, 0.96) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;
  border-radius: 10px !important;

  .atlas-app-dialog__header {
    margin-right: 0;
    padding: 14px 20px 12px;
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  .atlas-app-dialog__title {
    color: #40f2ff !important;
    font-size: 15px;
    font-weight: 700;
  }

  .atlas-app-dialog__body {
    padding: 16px 20px 20px;
    background: rgba(12, 22, 38, 0.72);
  }
}

.detail-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 10px;
  align-items: start;

  dt {
    margin: 0;
    font-size: 12px;
    color: #7dd3fc;
    font-weight: 600;
  }

  dd {
    margin: 0;
    font-size: 12px;
    color: #e2efff;
    word-break: break-word;
    line-height: 1.5;
  }
}
</style>
