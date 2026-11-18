<template>
  <div class="task-target-relation-tab">
    <header class="relation-head">
      <div>
        <h3 class="relation-title">目标关系配置</h3>
        <p class="relation-desc">
          配置传输链路节点关系。请先在「卫星装配」「地面站装配」中选择资源；中继卫星选项来自已装配的通信类卫星系列。
        </p>
      </div>
    </header>

    <section v-for="section in sections" :key="section.kind" class="relation-section">
      <div class="relation-section-head">
        <strong>{{ section.title }}</strong>
        <el-button type="primary" size="small" plain @click="addRow(section.kind)">新增关系</el-button>
      </div>
      <el-table
        :data="rowsByKind(section.kind)"
        size="small"
        row-key="_key"
        class="relation-table"
        empty-text="暂无关系，点击「新增关系」"
        :max-height="220"
      >
        <el-table-column :label="section.fromLabel" min-width="200">
          <template #default="{ row }">
            <el-select
              v-model="row.fromId"
              filterable
              placeholder="选择起点"
              class="relation-select"
              popper-class="task-edit-select-popper"
              @change="syncRowLabel(row, 'from', section.fromOptions)"
            >
              <el-option v-for="opt in section.fromOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column :label="section.toLabel" min-width="200">
          <template #default="{ row }">
            <el-select
              v-model="row.toId"
              filterable
              placeholder="选择终点"
              class="relation-select"
              popper-class="task-edit-select-popper"
              @change="syncRowLabel(row, 'to', section.toOptions)"
            >
              <el-option v-for="opt in section.toOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="启用" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="72" align="center" fixed="right">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeRow(section.kind, $index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type {
  TaskRelationEndpointOption,
  TaskTargetRelation,
  TaskTargetRelationKind,
} from '@/types/task/task'

/** 表格行（含内部主键） */
interface RelationRow extends TaskTargetRelation {
  /** 行唯一键，仅前端使用 */
  _key: string
}

const props = defineProps<{
  /** 已装配卫星系列选项 */
  satelliteOptions: TaskRelationEndpointOption[]
  /** 中继卫星选项（通常为通信系列） */
  relayOptions: TaskRelationEndpointOption[]
  /** 已装配地面站选项 */
  stationOptions: TaskRelationEndpointOption[]
  /** 弹窗打开时递增，用于清空草稿 */
  resetKey: number
}>()

/** 各关系种类的可编辑行 */
const rows = reactive<RelationRow[]>([])

let rowKeySeq = 0

/**
 * 生成表格行主键。
 *
 * @returns 唯一字符串
 */
function nextRowKey(): string {
  rowKeySeq += 1
  return `rel-${rowKeySeq}`
}

/**
 * 按种类筛选关系行。
 *
 * @param kind 关系种类
 * @returns 该种类的行列表
 */
const rowsByKind = (kind: TaskTargetRelationKind): RelationRow[] =>
  rows.filter((row) => row.kind === kind)

/**
 * 计算：三类关系的分区配置（标题与下拉选项）。
 * 返回：分区数组。
 * 作用：驱动模板中三个关系表格。
 */
const sections = computed(() => [
  {
    kind: 'satellite_station' as const,
    title: '卫星 → 地面站',
    fromLabel: '卫星（系列）',
    toLabel: '地面站',
    fromOptions: props.satelliteOptions,
    toOptions: props.stationOptions,
  },
  {
    kind: 'satellite_relay' as const,
    title: '卫星 → 中继卫星',
    fromLabel: '卫星（系列）',
    toLabel: '中继卫星',
    fromOptions: props.satelliteOptions,
    toOptions: props.relayOptions,
  },
  {
    kind: 'relay_station' as const,
    title: '中继卫星 → 地面站',
    fromLabel: '中继卫星',
    toLabel: '地面站',
    fromOptions: props.relayOptions,
    toOptions: props.stationOptions,
  },
])

/**
 * 根据选项列表回写展示名称。
 *
 * @param row 当前行
 * @param side 起点或终点
 * @param options 候选选项
 */
const syncRowLabel = (
  row: RelationRow,
  side: 'from' | 'to',
  options: TaskRelationEndpointOption[],
) => {
  const id = side === 'from' ? row.fromId : row.toId
  const hit = options.find((opt) => opt.id === id)
  const label = hit?.label ?? id
  if (side === 'from') {
    row.fromLabel = label
  } else {
    row.toLabel = label
  }
}

/**
 * 新增一行关系。
 *
 * @param kind 关系种类
 */
const addRow = (kind: TaskTargetRelationKind) => {
  rows.push({
    _key: nextRowKey(),
    kind,
    fromId: '',
    fromLabel: '',
    toId: '',
    toLabel: '',
    enabled: true,
  })
}

/**
 * 删除指定行。
 *
 * @param kind 关系种类
 * @param index 在该种类表格中的行下标
 */
const removeRow = (kind: TaskTargetRelationKind, index: number) => {
  const kindRows = rowsByKind(kind)
  const target = kindRows[index]
  if (!target) return
  const globalIndex = rows.findIndex((row) => row._key === target._key)
  if (globalIndex >= 0) rows.splice(globalIndex, 1)
}

/**
 * 返回可提交的关系列表（去掉内部字段、过滤未选端点）。
 *
 * @returns 关系配置
 */
const getRelations = (): TaskTargetRelation[] =>
  rows
    .filter((row) => row.fromId && row.toId)
    .map(({ _key, ...rest }) => rest)

/**
 * 从任务数据回显关系。
 *
 * @param list 任务上的关系列表
 */
const setRelations = (list: TaskTargetRelation[] | undefined) => {
  rows.splice(0, rows.length)
  if (!Array.isArray(list)) return
  list.forEach((item) => {
    rows.push({
      ...item,
      _key: nextRowKey(),
    })
  })
}

/**
 * 监听：`resetKey` 变化。
 * 回调不返回清理函数。
 * 作用：弹窗重新打开时清空关系草稿。
 */
watch(
  () => props.resetKey,
  () => {
    rows.splice(0, rows.length)
  },
)

defineExpose({
  getRelations,
  setRelations,
})
</script>

<style scoped lang="scss">
.task-target-relation-tab {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  min-height: 0;
  padding: 4px 8px 12px;
  box-sizing: border-box;
}

.relation-head {
  flex-shrink: 0;
}

.relation-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e2efff;
}

.relation-desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #94a3b8;
}

.relation-section {
  flex-shrink: 0;
  padding: 12px 14px;
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 8px;
  background: rgba(8, 20, 36, 0.45);
}

.relation-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: #7dd3fc;
  font-size: 14px;
}

.relation-table {
  width: 100%;
}

.relation-select {
  width: 100%;
}
</style>