<template>
  <el-dialog
    :model-value="modelValue"
    title="卫星威胁度算法参数"
    width="680px"
    append-to-body
    destroy-on-close
    align-center
    class="satellite-threat-info-dialog"
    modal-class="satellite-threat-info-dialog-modal"
    @update:model-value="emit('update:modelValue', $event)">
    <div v-loading="loading" class="satellite-threat-info-body">
      <p v-if="subtitle" class="satellite-threat-info-subtitle">{{ subtitle }}</p>
      <dl class="satellite-threat-info-grid">
        <div v-for="field in fieldRows" :key="field.label" class="satellite-threat-info-row">
          <dt class="satellite-threat-info-label">{{ field.label }}</dt>
          <dd class="satellite-threat-info-value" :class="{ 'is-formula': field.label === '威胁度计算公式' }">
            {{ field.value }}
          </dd>
        </div>
      </dl>
      <p v-if="!loading && emptyHint" class="satellite-threat-info-empty">{{ emptyHint }}</p>
    </div>
    <template #footer>
      <el-button class="satellite-threat-info-close-btn" @click="emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SatelliteThreatInfo } from '@/api/electronic'
import { buildSatelliteThreatInfoFieldRows } from '@/utils/satelliteThreatInfoDisplay'

const props = withDefaults(
  defineProps<{
    /** 弹窗是否可见 */
    modelValue: boolean
    /** 是否正在加载接口数据 */
    loading?: boolean
    /** 威胁度算法参数 */
    threatInfo?: SatelliteThreatInfo | null
    /** 副标题（卫星名称 / 系列） */
    subtitle?: string
    /** 无数据时的提示 */
    emptyHint?: string
  }>(),
  {
    loading: false,
    threatInfo: null,
    subtitle: '',
    emptyHint: '',
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

/** 弹窗字段行 */
const fieldRows = computed(() => buildSatelliteThreatInfoFieldRows(props.threatInfo))
</script>

<style scoped lang="scss">
.satellite-threat-info-body {
  min-height: 120px;
}

.satellite-threat-info-subtitle {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
}

.satellite-threat-info-grid {
  margin: 0;
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 8px 16px;
  align-items: start;
}

.satellite-threat-info-row {
  display: contents;
}

.satellite-threat-info-label {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.satellite-threat-info-value {
  margin: 0;
  font-size: 12px;
  color: #e2e8f0;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;

  &.is-formula {
    color: #7dd3fc;
    font-family: Consolas, 'Courier New', monospace;
  }
}

.satellite-threat-info-empty {
  margin: 12px 0 0;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.satellite-threat-info-close-btn {
  min-width: 88px;
}
</style>

<style lang="scss">
.satellite-threat-info-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.satellite-threat-info-dialog-modal {
  backdrop-filter: blur(4px);
}

.atlas-app-dialog.satellite-threat-info-dialog,
.satellite-threat-info-dialog .atlas-app-dialog {
  --el-dialog-bg-color: rgba(8, 15, 26, 0.96);
  --el-dialog-title-font-size: 16px;
  border: 1px solid rgba(0, 225, 255, 0.25);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.55);
}

.satellite-threat-info-dialog .atlas-app-dialog__header {
  border-bottom: 1px solid rgba(148, 163, 184, 0.15);
  margin-right: 0;
  padding-bottom: 12px;
}

.satellite-threat-info-dialog .atlas-app-dialog__title {
  color: #e2e8f0;
  font-weight: 700;
}

.satellite-threat-info-dialog .atlas-app-dialog__body {
  padding-top: 16px;
  color: #e2e8f0;
}

.satellite-threat-info-dialog .atlas-app-dialog__footer {
  border-top: 1px solid rgba(148, 163, 184, 0.12);
  padding-top: 12px;
}
</style>
