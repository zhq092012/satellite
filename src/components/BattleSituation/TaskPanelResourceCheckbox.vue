<template>
  <div class="task-config-checkbox" :class="{ 'task-config-checkbox--selected': selected }">
    <label class="task-config-checkbox__select">
      <el-checkbox :model-value="selected" size="small" @change="emit('change', $event)" />
      <span class="task-config-checkbox__label" @click.stop="emit('label-click')">{{ item.label }}</span>
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
  /** 点击系列/资源名称（不含勾选框） */
  (e: 'label-click'): void
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
  border: 1px solid var(--swatch-rgba-100-116-139-0_35);
  background: var(--swatch-rgba-15-23-42-0_65);
  user-select: none;
  transition: border-color 0.18s ease, background 0.18s ease;

  &.task-config-checkbox--selected {
    border-color: rgba(var(--accent-cyan-rgb), 0.55);
    background: rgba(var(--accent-cyan-rgb), 0.1);
  }

  &.task-config-checkbox--analysis-focus {
    border-color: var(--swatch-rgba-250-204-21-0_75);
    box-shadow: inset 0 0 0 1px var(--swatch-rgba-250-204-21-0_35);
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
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-color-muted);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.task-config-checkbox--selected .task-config-checkbox__label {
  color: var(--swatch-e0f2fe);
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
  color: var(--text-color-subtle);
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    color: var(--color-info-soft);
    background: rgba(var(--accent-cyan-rgb), 0.1);
  }

  .el-icon {
    font-size: var(--font-size-base);
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
