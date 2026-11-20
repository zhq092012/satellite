<template>
  <el-dialog
    :model-value="visible"
    title="卫星资源批量导入"
    width="520px"
    destroy-on-close
    append-to-body
    @update:model-value="emit('update:visible', $event)"
    @closed="resetState"
  >
    <el-upload
      drag
      :auto-upload="false"
      :limit="1"
      :file-list="fileList"
      accept=".xlsx,.xls,.csv"
      :on-change="onFileChange"
      :on-remove="onFileRemove"
    >
      <div class="el-upload__text">将文件拖到此处，或 <em>点击选择</em></div>
      <template #tip>
        <div class="import-tip">支持 .xlsx / .xls / .csv</div>
      </template>
    </el-upload>
    <el-alert
      v-if="summary"
      class="import-result"
      :title="summary.title"
      :type="summary.type"
      :description="summary.description"
      show-icon
      :closable="false"
    />
    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="importing" :disabled="!selectedFile" @click="submitImport">
        开始导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, type UploadFile, type UploadUserFile } from 'element-plus'
import { importSatelliteResources } from '@/api/satellite/satellite'
import { formatResourceImportSummary, isResourceApiSuccess } from '@/utils/resourceApi'

defineProps<{
  /** 是否显示弹窗 */
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  /** 导入成功并完成展示后触发，供父级刷新列表 */
  success: []
}>()

type ImportSummaryView = { title: string; description: string; type: 'success' | 'warning' | 'error' }

const importing = ref(false)
const selectedFile = ref<File | null>(null)
const fileList = ref<UploadUserFile[]>([])
const summary = ref<ImportSummaryView | null>(null)

function resetState() {
  selectedFile.value = null
  fileList.value = []
  summary.value = null
  importing.value = false
}

function onFileChange(uploadFile: UploadFile) {
  selectedFile.value = uploadFile.raw ?? null
  fileList.value = uploadFile.raw ? [uploadFile as UploadUserFile] : []
  summary.value = null
}

function onFileRemove() {
  selectedFile.value = null
  fileList.value = []
}

async function submitImport() {
  if (!selectedFile.value) return
  importing.value = true
  summary.value = null
  try {
    const res = await importSatelliteResources(selectedFile.value)
    if (isResourceApiSuccess(res.code) && res.data) {
      summary.value = formatResourceImportSummary(res.data)
      ElMessage.success('卫星导入已提交')
      emit('success')
    }
  } finally {
    importing.value = false
  }
}
</script>

<style scoped lang="scss">
.import-tip {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.import-result {
  margin-top: 16px;
}
</style>