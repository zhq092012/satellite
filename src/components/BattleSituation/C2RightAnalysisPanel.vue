<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">分析结果</span>
      </div>

    </div>

    <div v-if="!activeMatrix" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">暂无分析结果</p>
      <p class="empty-sub">请查看当前任务计算进度</p>
    </div>

    <template v-else>
      <div class="asset-scroll">
        <!-- 卫星列表 -->
        <section class="asset-section">
          <div class="asset-section-head">
            <span class="asset-section-title">卫星列表</span>
            <span class="asset-count">共 {{ satelliteRows.length }} 颗</span>
          </div>
          <el-table :data="satelliteRows" size="small" height="100%" highlight-current-row row-key="norad"
            class="asset-table sat-table" :expand-row-keys="expandedSatKeys" :row-class-name="satRowClassName"
            empty-text="暂无卫星" @row-click="handleSatRowClick">
            <el-table-column type="expand" width="1">
              <template #default="{ row }">
                <div class="sat-row-actions" @click.stop>
                  <button type="button" class="sat-action-btn" @click="openSatProfile(row)">查看详情</button>
                  <button type="button" class="sat-action-btn" @click="goTopoAnalysis">拓扑分析</button>
                  <button type="button" class="sat-action-btn" @click="goGanttAnalysis">甘特图分析</button>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip />
            <el-table-column prop="series" label="系列" min-width="96" show-overflow-tooltip />
            <el-table-column prop="threatText" label="威胁度" width="88" sortable :sort-method="sortByThreat" />
            <el-table-column prop="coverageText" label="覆盖率" width="92" sortable :sort-method="sortByCoverage" />
            <el-table-column prop="satType" label="类型" min-width="110" show-overflow-tooltip />
            <el-table-column prop="orbitLabel" label="轨道" width="72" />
            <el-table-column prop="usage" label="用途" width="72" />
            <el-table-column prop="norad" label="NORAD" width="88" />
            <el-table-column prop="heightText" label="高度" width="92" />
          </el-table>
        </section>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
/**
 * 整体态势分析 - 右侧卫星列表面板。
 * 以表格展示卫星；威胁度 / 覆盖率可排序。
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { type MatrixResult } from '@/api/electronic'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import { orbitTypeLabel } from '@/utils/zhchPlanDisplay'

const router = useRouter()
const { openSatelliteProfile } = useSatelliteProfileDialog()

const props = defineProps<{
  /** 算法矩阵数据 */
  matrixData: MatrixResult | null
  /** 当前选中的卫星 NORAD（若有） */
  selectedSatelliteNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'clear-satellite-selection'): void
  /** 选中/取消选中卫星 */
  (e: 'select-satellite', norad: number | null): void
}>()

/** 当前生效矩阵 */
const activeMatrix = computed<MatrixResult | null>(() => props.matrixData)

/**
 * 右侧表格中的卫星行。
 */
interface SituationSatelliteRow {
  /** NORAD 编号 */
  norad: number
  /** 卫星名称 */
  name: string
  /** 卫星系列（接口未返回时使用占位数据） */
  series: string
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

/** 系列接口未就绪时的占位系列，按 NORAD 轮换，便于筛选联调。 */
const MOCK_SAT_SERIES = ['STARLINK', 'starshield', 'ICEYE', 'GPS'] as const

/**
 * 解析卫星系列：有真实值则用真实值，否则按 NORAD 分配占位系列。
 * @param norad 卫星 NORAD
 * @param existing 已有系列
 * @returns 系列名称
 */
const resolveSatSeries = (norad: number, existing?: string): string => {
  const value = (existing || '').trim()
  if (value && value !== '--') return value
  return MOCK_SAT_SERIES[Math.abs(norad) % MOCK_SAT_SERIES.length]
}

/**
 * 当前展开操作栏的卫星行 key，与选中卫星同步。
 * @returns 选中卫星 NORAD 组成的展开 key 列表
 */
const expandedSatKeys = computed<(string | number)[]>(() => {
  return props.selectedSatelliteNorad != null ? [props.selectedSatelliteNorad] : []
})

/** 去重后的卫星列表 */
const satelliteRows = computed<SituationSatelliteRow[]>(() => {
  const matrix = activeMatrix.value
  if (!matrix) return []

  const rowMap = new Map<number, SituationSatelliteRow>()
  const upsert = (item: {
    norad: number
    name?: string
    series?: string
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
      series: resolveSatSeries(item.norad, item.series || exist?.series),
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

/** 卫星威胁度排序 */
const sortByThreat = (a: SituationSatelliteRow, b: SituationSatelliteRow) =>
  compareMetric(a.threatScore, b.threatScore)
/** 卫星覆盖率排序 */
const sortByCoverage = (a: SituationSatelliteRow, b: SituationSatelliteRow) =>
  compareMetric(a.coverageValue, b.coverageValue)

/**
 * 卫星行高亮 class。
 * @param param0 行参数
 */
const satRowClassName = ({ row }: { row: SituationSatelliteRow }): string => {
  return props.selectedSatelliteNorad === row.norad ? 'is-active-row' : ''
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
 * 打开卫星画像弹窗。
 * @param row 卫星行
 */
const openSatProfile = (row: SituationSatelliteRow) => {
  openSatelliteProfile(row.norad)
}

/**
 * 跳转到态势拓扑分析页。
 */
const goTopoAnalysis = () => {
  void router.push('/home/topo')
}

/**
 * 跳转到甘特图分析页。
 */
const goGanttAnalysis = () => {
  void router.push('/home/gantt')
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
  border-radius: 0;
  backdrop-filter: blur(8px);
  color: #e2efff;
  overflow: hidden;

  &--right {
    border-right: none;
    border-top: none;
    border-bottom: none;
  }
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding-right: 2px;
}

.asset-section {
  flex: 1;
  min-height: 0;
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

  :deep(.caret-wrapper) {
    width: 16px;
  }
}

.sat-table {
  flex: 1;
  min-height: 0;

  :deep(.atlas-app-table__expand-column) {
    width: 1px !important;
    min-width: 0 !important;
    padding: 0 !important;
    border: none !important;
  }

  :deep(.atlas-app-table__expand-icon) {
    display: none;
  }

  :deep(.atlas-app-table__expanded-cell) {
    padding: 8px 12px 10px !important;
    background: rgba(0, 225, 255, 0.06) !important;
    cursor: default;
  }

  :deep(.atlas-app-table__expanded-cell .cell) {
    padding: 0 !important;
  }

  :deep(.is-active-row td.atlas-app-table__cell) {
    padding-top: 10px;
    padding-bottom: 10px;
  }
}

.sat-row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sat-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid rgba(64, 242, 255, 0.4);
  background: rgba(0, 225, 255, 0.08);
  color: #7dd3fc;
  font-size: 12px;
  line-height: 1;
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: #40f2ff;
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.18);
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
</style>

<style lang="scss">
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
