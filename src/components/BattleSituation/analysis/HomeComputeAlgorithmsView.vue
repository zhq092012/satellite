<template>
  <div class="home-compute-algorithms home-analysis-page dark-theme">
    <section class="analysis-panel">
      <header class="analysis-panel-head">
        <h2 class="analysis-panel-title">已注册算法列表</h2>
        <el-button :loading="loading" @click="loadAlgorithms">刷新</el-button>
      </header>

      <p v-if="errorMessage" class="analysis-error">{{ errorMessage }}</p>
      <div class="analysis-table-scroll">
        <el-table v-loading="loading" :data="tableRows" class="analysis-algorithms-table" border stripe height="100%"
          row-key="rowKey">
          <el-table-column prop="kindLabel" label="算法种类" min-width="140" show-overflow-tooltip />
          <el-table-column prop="code" label="算法编码" min-width="160" show-overflow-tooltip />
          <el-table-column prop="name" label="算法名称" min-width="200" show-overflow-tooltip />
          <el-table-column label="默认生效" width="108" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.active" type="success">是</el-tag>
              <el-tag v-else type="danger">否</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listRegisteredComputeAlgorithms } from '@/api/threat/threat'
import type { AlgorithmInfo } from '@/types/threat'
import { isComputeApiSuccess } from '@/utils/computeApi'

defineOptions({ name: 'HomeComputeAlgorithmsView' })

const loading = ref(false)
const errorMessage = ref('')
const algorithms = ref<AlgorithmInfo[]>([])

interface AlgorithmTableRow extends AlgorithmInfo {
  rowKey: string
}

/**
 * 计算：算法列表表格行（稳定 rowKey）。
 * 返回排序后的行。
 * 作用：列表展示与刷新绑定。
 */
const tableRows = computed((): AlgorithmTableRow[] =>
  [...algorithms.value]
    .map((item, index) => ({
      ...item,
      rowKey: `${item.kind ?? 'kind'}-${item.code ?? index}`,
    }))
    .sort((a, b) => {
      const kind = (a.kindLabel || a.kind || '').localeCompare(b.kindLabel || b.kind || '', 'zh-CN')
      if (kind !== 0) return kind
      if (Boolean(a.active) !== Boolean(b.active)) return a.active ? -1 : 1
      return (a.code || '').localeCompare(b.code || '', 'zh-CN')
    }),
)

/**
 * 拉取已注册算法列表。
 */
const loadAlgorithms = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const res = await listRegisteredComputeAlgorithms()
    if (!isComputeApiSuccess(res.code)) {
      throw new Error(res.msg || `获取算法列表失败（code=${res.code}）`)
    }
    if (!Array.isArray(res.data)) {
      throw new Error('算法列表 data 不是数组')
    }
    algorithms.value = res.data
  } catch (error) {
    algorithms.value = []
    errorMessage.value = error instanceof Error ? error.message : String(error)
    ElMessage.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadAlgorithms()
})
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

$panel-border: rgba(56, 189, 248, 0.55);

.home-compute-algorithms {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px 20px;
  overflow: hidden;
  background: #0b1220;
  color: #e2e8f0;
}

.analysis-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  border: 2px solid $panel-border;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  overflow: hidden;
}

.analysis-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 12px 16px;
  border-bottom: 1px solid $panel-border;
  background: rgba(13, 27, 49, 0.6);
}

.analysis-panel-title {
  margin: 0;
  font-size: battleUi.$battle-ui-font-emphasis;
  font-weight: 700;
  color: #7dd3fc;
}


.analysis-error {
  flex-shrink: 0;
  margin: 0;
  padding: 8px 16px;
  color: #f87171;
  font-size: battleUi.$battle-ui-font-base;
}

.analysis-table-scroll {
  flex: 1;
  min-height: 0;
  padding: 10px 12px 12px;
  overflow: hidden;
}

.analysis-tag-muted {
  font-size: battleUi.$battle-ui-font-base;
  color: #64748b;
}

.analysis-algorithms-table {
  @include battleUi.battle-ui-el-table-typography;
}
</style>