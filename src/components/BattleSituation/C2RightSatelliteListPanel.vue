<template>
  <aside class="c2-panel c2-panel--right dark-theme">
    <header class="panel-header">
      <span class="header-title">任务卫星列表</span>
      <span v-if="store.activedTask" class="header-count">
        共 {{ displayRows.length }} 颗
      </span>
    </header>

    <div v-if="!store.activedTask" class="empty-sat-box">
      <span class="empty-icon">📡</span>
      <p class="empty-text">请先选择任务</p>
    </div>

    <div v-else-if="!store.c2TreeCheckedKeys.length" class="empty-sat-box">
      <span class="empty-icon">☑️</span>
      <p class="empty-text">请在左侧资源树勾选国家或系列</p>
    </div>

    <div v-else class="sat-list-body">
      <el-table :data="displayRows" size="small" row-key="rowKey" height="100%"
        class="sat-metric-table c2-sat-list-table" empty-text="无匹配卫星">
        <!-- <el-table-column label="序号" width="48" align="center" fixed>
          <template #default="{ $index }">{{ $index + 1 }}</template>
</el-table-column> -->
        <el-table-column label="卫星名称" min-width="1">
          <template #default="{ row }">
            <button type="button" class="sat-name-wrap"
              :class="{ 'sat-name-wrap--selected': selectedNorad === row.norad }"
              @click="emit('select-satellite', row.norad)">
              {{ row.name }}
            </button>
          </template>
        </el-table-column>
        <el-table-column prop="sysType" label="卫星类型" min-width="1" />
        <el-table-column prop="country" label="所属国家" min-width="1" />
        <el-table-column label="卫星系列" min-width="1">
          <template #default="{ row }">{{ formatSeriesLabel(row.series) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * C2 右侧任务卫星列表面板：按左侧树勾选过滤展示。
 */
import { computed } from 'vue'
import { useLayoutStore } from '@/store/modules/layout'
import {
  C2_RESOURCE_EMPTY_FIELD,
  filterC2SatellitesByTreeSelection,
} from '@/utils/buildC2ResourceCatalog'

defineProps<{
  /** 当前选中 NORAD（高亮） */
  selectedNorad?: number | null
}>()

const emit = defineEmits<{
  (e: 'select-satellite', norad: number | null): void
}>()

const store = useLayoutStore()

/**
 * 计算：右侧列表展示的卫星行。
 * 返回：经资源树勾选过滤后的 `c2ResourceSatelliteRows` 子集。
 * 作用：表格数据源与选中高亮 NORAD 对应行。
 */
const displayRows = computed(() =>
  filterC2SatellitesByTreeSelection(store.c2ResourceSatelliteRows, store.c2TreeCheckedKeys),
)

/**
 * 卫星系列展示文案；无系列时显示 `--`。
 *
 * @param series 系列字段
 */
const formatSeriesLabel = (series: string | undefined): string => {
  const text = series?.trim()
  if (!text || text === C2_RESOURCE_EMPTY_FIELD) return '--'
  return text
}
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 10px 12px 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
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
  gap: 10px;
  min-height: 28px;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.14);
}

.header-title {
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #40f2ff;
  letter-spacing: 0.5px;
  white-space: nowrap;
}

.header-count {
  font-size: battleUi.$battle-ui-font-base;
  font-weight: 600;
  color: #94a3b8;
  white-space: nowrap;
}

.empty-sat-box {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  border: 1px dashed rgba(0, 225, 255, 0.2);
  border-radius: 8px;
  background: rgba(12, 22, 38, 0.5);
}

.empty-icon {
  font-size: 28px;
  opacity: 0.85;
}

.empty-text {
  margin: 0;
  font-size: battleUi.$battle-ui-font-base;
  color: #64748b;
}

.sat-list-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(0, 225, 255, 0.12);
  border-radius: 8px;
  background: rgba(10, 20, 36, 0.55);
}

.c2-sat-list-table {
  width: 100%;
  max-width: 100%;
  height: 100%;
  @include battleUi.battle-ui-el-table-typography;
  @include battleUi.battle-ui-c2-panel-table-fit;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.1);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.96);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.08);
  --atlas-app-text-color-regular: #cbd5e1;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(th.atlas-app-table__cell) {
    padding: 6px 4px;
    color: #00e1ff;
  }

  :deep(td.atlas-app-table__cell) {
    padding: 6px 4px;
    border-bottom: 1px solid rgba(0, 225, 255, 0.06);
  }

  :deep(.atlas-app-table__body-wrapper) {
    overflow-y: auto;
  }
}

.sat-name-wrap {
  display: block;
  width: 100%;
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  background: rgba(30, 41, 59, 0.55);
  font-size: battleUi.$battle-ui-font-base;
  line-height: 1.35;
  color: #e2efff;
  text-align: left;
  white-space: normal;
  word-break: break-word;
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    color: #7dd3fc;
    background: rgba(0, 225, 255, 0.12);
  }

  &--selected {
    color: #fde68a;
    background: rgba(113, 63, 18, 0.45);
    box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.35);
  }
}
</style>
