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
import { getPageData } from '@/utils/func/funcs'
import type { TableInstance } from 'element-plus'
import { computed, ref } from 'vue'

interface Props {
  tableData: any[]
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
// 清空选择
const clearSelection = () => {
  tbRef.value?.clearSelection()
}
// 获取选择行
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
