<template>
  <div v-bind="$attrs" class="table-with-page-no-card">
    <div class="title-box" v-if="tableTitle">
      <el-text class="title" size="large" tag="b">{{ tableTitle }}</el-text>
    </div>
    <div class="table-box">
      <el-table
        :data="tableDataByPage"
        style="width: 100%"
        :border="border"
        :stripe="stripe"
        :row-key="rowKey"
        @selection-change="handleSelectionChange"
        @dragover.prevent
        ref="tbRef"
      >
        <slot></slot>
      </el-table>
    </div>
    <div class="page-box" v-if="hasPage">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="page_size"
        :page-sizes="[10, 15, 20, 25, 30]"
        layout="total,sizes,prev, pager, next,jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      >
      </el-pagination>
    </div>
  </div>
</template>
<script setup lang="ts">
/**
 * 无 el-card 外壳的分页表格，行为与 `TableWithPage` 一致，额外支持 `toggleRowSelection`。
 * 适用于嵌入对话框或嵌套布局，避免双层卡片样式。
 */
import { getPageData } from '@/utils/tools/sliceListPage'
import type { TableInstance } from 'element-plus'
import { computed, nextTick, ref } from 'vue'

/** 表格与分页配置（同 TableWithPage） */
interface Props {
  /** 表格数据源 */
  tableData: any[]
  /** 服务端总条数；大于 0 启用服务端分页 */
  count?: number
  border?: boolean
  stripe?: boolean
  rowKey?: string
  tableHeight?: number
  tableTitle?: string
  hasPage?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  border: true,
  stripe: true,
  count: 0,
  tableData: () => [],
  rowKey: 'id',
  tableHeight: 480,
  tableTitle: '',
  hasPage: true,
})

interface Emits {
  (e: 'loadPageData', page: number, page_size: number): void
  (e: 'handleSelectionChange', rows: any[]): void
}
const emit = defineEmits<Emits>()
const tbRef = ref<TableInstance>()

/** 清空表格多选 */
const clearSelection = () => {
  tbRef.value?.clearSelection()
}

/** @returns 当前选中的行数据 */
const getSelectionRows = () => {
  return tbRef.value?.getSelectionRows()
}

/**
 * 切换指定行的选中状态（nextTick 后执行，确保表格已渲染）。
 *
 * @param row 行数据
 * @param selected 目标选中状态
 * @param ignoreSelectable 是否忽略 selectable 限制（预留，与 Element Plus API 对齐）
 */
const toggleRowSelection = (row: any, selected?: boolean, _ignoreSelectable: boolean = true) => {
  nextTick(() => {
    tbRef.value?.toggleRowSelection(row, selected)
  })
}
defineExpose({ clearSelection, getSelectionRows, toggleRowSelection })
const tableDataByPage = computed(() => {
  return props.count > 0 ? props.tableData : caculateTable.value
})
const page = ref(1)
const page_size = ref(10)
const total = computed(() => {
  return props.count > 0 ? props.count : props.tableData.length
})
const caculateTable = computed(() => {
  return getPageData(props.tableData, page.value, page_size.value)
})
const handleSizeChange = (val: number) => {
  page_size.value = val
  if (props.count > 0) {
    emit('loadPageData', page.value, page_size.value)
  }
}
const handleCurrentChange = (val: number) => {
  page.value = val
  if (props.count > 0) {
    emit('loadPageData', page.value, page_size.value)
  }
}
const handleSelectionChange = (rows: any[]) => {
  emit('handleSelectionChange', rows)
}
</script>
<style lang="scss" scoped>
.title-box {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
}
.table-box {
  padding-top: 10px;
}
.page-box {
  padding-bottom: 10px;
  display: flex;
  align-items: center;
  height: 45px;
  justify-content: flex-start;
  padding: 5px;

  background: var(--nav-bar-background);
}
</style>
