<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '修改命令' : '添加命令'"
    width="760px"
    append-to-body
    destroy-on-close
    align-center
    class="command-edit-dialog"
    modal-class="command-edit-dialog-modal"
    @closed="handleClosed"
  >
    <CommandUpsertForm ref="commandUpsertFormRef" v-model="commandForm" label-width="96px" />
    <template #footer>
      <el-button class="command-edit-btn command-edit-btn--ghost" @click="visible = false">取 消</el-button>
      <el-button
        class="command-edit-btn command-edit-btn--primary"
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
      >
        保 存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import CommandUpsertForm from '@/components/BattleSituation/CommandUpsertForm.vue'
import { createCommand, getCommandList, updateCommand } from '@/api/command/command'
import type { CommandForm, CommandUpsertPayload } from '@/types/command/command'
import {
  commandFormToUpsertPayload,
  createEmptyCommandUpsertPayload,
  resolveCreatedCommandId,
  serializeCommandUpsertPayload,
} from '@/utils/commandUpsertForm'
import { isSameCommandId } from '@/utils/commandEntity'

const props = defineProps<{
  /** 对话框是否可见 */
  modelValue: boolean
  /** 是否为修改当前命令 */
  isEdit: boolean
  /** 当前正在编辑的命令；添加模式可为 null */
  command: CommandForm | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  /** 保存成功后回传最新命令 */
  (e: 'saved', command: CommandForm): void
}>()

const commandUpsertFormRef = ref<InstanceType<typeof CommandUpsertForm> | null>(null)
const submitting = ref(false)

const commandForm = reactive<CommandUpsertPayload>(createEmptyCommandUpsertPayload())

/**
 * 计算：命令编辑弹窗是否显示。
 * 返回：getter 为 `props.modelValue`；setter 通过 `update:modelValue` 写入父组件。
 * 作用：弹窗 `v-model` 双向绑定。
 */
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const fillForm = () => {
  if (props.isEdit && props.command) {
    Object.assign(commandForm, commandFormToUpsertPayload(props.command))
    return
  }
  Object.assign(commandForm, createEmptyCommandUpsertPayload())
}

const resolveSavedCommand = async (
  payload: CommandUpsertPayload,
  responseData: unknown,
): Promise<CommandForm> => {
  try {
    const listRes = await getCommandList()
    const list = listRes.code === 200 && Array.isArray(listRes.data) ? listRes.data : []
    const newId = resolveCreatedCommandId(responseData)
    if (newId) {
      const byId = list.find((item) => isSameCommandId(item.id, newId))
      if (byId) return byId
    }
    const matched = [...list].reverse().find((item) => item.name === payload.name)
    if (matched) return matched
    return {
      ...payload,
      id: newId ?? payload.id,
      name: payload.name,
      description: payload.description ?? '',
    }
  } catch (error) {
    console.error('刷新命令列表失败:', error)
    return {
      ...payload,
      name: payload.name,
      description: payload.description ?? '',
      id: payload.id,
    }
  }
}

const handleSubmit = async () => {
  const valid = await commandUpsertFormRef.value?.validate()
  if (!valid) {
    ElMessage.warning('请填写完整的命令信息')
    return
  }
  submitting.value = true
  try {
    const payload = serializeCommandUpsertPayload(commandForm)
    const res = payload.id ? await updateCommand(payload) : await createCommand(payload)
    if (res.code === 200) {
      const saved: CommandForm = payload.id
        ? {
            ...(props.command ?? { name: payload.name, description: payload.description ?? '' }),
            ...payload,
          }
        : await resolveSavedCommand(payload, res.data)
      ElMessage.success(payload.id ? '修改命令成功' : '添加命令成功')
      visible.value = false
      emit('saved', saved)
    } else {
      ElMessage.error(res.msg || (payload.id ? '修改命令失败' : '添加命令失败'))
    }
  } catch (error) {
    console.error('保存命令失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存命令失败')
  } finally {
    submitting.value = false
  }
}

const handleClosed = () => {
  commandUpsertFormRef.value?.resetFields()
}

/**
 * 监听弹窗开合；打开时用当前命令或空白表单填充。
 * 回调不返回清理函数。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (open) fillForm()
  },
)
</script>

<style scoped lang="scss">
.command-edit-btn--ghost {
  color: #94a3b8;
}

.command-edit-btn--primary {
  min-width: 88px;
}
</style>