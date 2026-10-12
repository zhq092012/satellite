<template>
  <div class="task-config-checkbox" :class="{ 'task-config-checkbox--selected': selected }">
    <label class="task-config-checkbox__select">
      <el-checkbox :model-value="selected" size="small" @change="emit('change', $event)" />
      <span class="task-config-checkbox__label">{{ item.label }}</span>
    </label>
    <button type="button" class="task-config-checkbox__detail" title="查看详情" aria-label="查看详情"
      @click.stop="emit('detail', { kind: resourceKind, item })">
      <el-icon>
        <InfoFilled />
      </el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { InfoFilled } from '@element-plus/icons-vue'
import type { TaskPanelResourceKind, TaskPanelTagOption } from '@/utils/c2TaskPanelEditor'

export type { TaskPanelResourceKind }

defineProps<{
  /** 候选项 */
  item: TaskPanelTagOption
  /** 是否已选中 */
  selected: boolean
  /** 资源类型，供详情事件区分 */
  resourceKind: TaskPanelResourceKind
}>()

const emit = defineEmits<{
  (e: 'change', checked: boolean | string | number): void
  (e: 'detail', payload: { kind: TaskPanelResourceKind; item: TaskPanelTagOption }): void
}>()
</script>

<style scoped lang="scss">
.task-config-checkbox {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 26px;
  align-items: center;
  column-gap: 2px;
  margin: 0;
  min-height: 30px;
  padding: 4px 4px 4px 8px;
  box-sizing: border-box;
  border-radius: 4px;
  border: 1px solid rgba(100, 116, 139, 0.35);
  background: rgba(15, 23, 42, 0.65);
  user-select: none;
  transition: border-color 0.18s ease, background 0.18s ease;

  &.task-config-checkbox--selected {
    border-color: rgba(0, 225, 255, 0.55);
    background: rgba(0, 225, 255, 0.1);
  }
}

.task-config-checkbox__select {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  column-gap: 8px;
  min-width: 0;
  margin: 0;
  cursor: pointer;
}

.task-config-checkbox__label {
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-config-checkbox--selected .task-config-checkbox__label {
  color: #e0f2fe;
}

.task-config-checkbox__detail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    color: #7dd3fc;
    background: rgba(0, 225, 255, 0.1);
  }

  .el-icon {
    font-size: 14px;
  }
}

:deep(.el-checkbox) {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  margin: 0;
  line-height: 1;
}

:deep(.el-checkbox__input) {
  vertical-align: middle;
}

:deep(.el-checkbox__label) {
  display: none;
}
</style>
