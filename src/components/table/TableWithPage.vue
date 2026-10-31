<template>
  <el-card class="table-card-content">
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
  </el-card>
</template>
<script setup lang="ts">
/**
 * 带分页的表格卡片：默认前端分页；`count > 0` 时视为服务端分页，翻页触发 `loadPageData`。
 * 通过 slot 注入 `el-table-column`，对外暴露 `clearSelection` / `getSelectionRows`。
 */
import { getPageData } from '@/utils/tools/sliceListPage'
import type { TableInstance } from 'element-plus'
import { computed, ref } from 'vue'

/** 表格与分页配置 */
interface Props {
  /** 表格数据源；服务端分页时当前页数据由父组件传入 */
  tableData: any[]
  /** 服务端总条数；大于 0 启用服务端分页 */
  count?: number
  /** 是否显示边框 */
  border?: boolean
  /** 是否斑马纹 */
  stripe?: boolean
  /** 行唯一键字段名 */
  rowKey?: string
  /** 表格高度（预留） */
  tableHeight?: number
  /** 卡片标题；空则不显示标题区 */
  tableTitle?: string
  /** 是否显示底部分页器 */
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
  /** 服务端分页：页码或每页条数变化 */
  (e: 'loadPageData', page: number, page_size: number): void
  /** 多选变化 */
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
defineExpose({ clearSelection, getSelectionRows })
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
.table-card-content {
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
}
</style>
