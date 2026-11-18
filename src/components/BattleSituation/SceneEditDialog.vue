<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '修改场景' : '添加场景'"
    width="680px"
    append-to-body
    destroy-on-close
    align-center
    class="scene-edit-dialog"
    modal-class="scene-edit-dialog-modal"
    @closed="handleClosed"
  >
    <el-form ref="formRef" :model="sceneForm" :rules="formRules" label-width="96px" class="scene-edit-form">
      <el-form-item label="场景名称" prop="name">
        <el-input v-model="sceneForm.name" maxlength="80" show-word-limit placeholder="请输入场景名称" />
      </el-form-item>
      <el-form-item label="场景概述" prop="description">
        <el-input
          v-model="sceneForm.description"
          type="textarea"
          :rows="3"
          maxlength="400"
          show-word-limit
          placeholder="请输入场景概述"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button class="scene-edit-btn scene-edit-btn--ghost" @click="visible = false">取 消</el-button>
      <el-button
        class="scene-edit-btn scene-edit-btn--primary"
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
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { createBattle, getBattleList, updateBattle } from '@/api/battle/battle'
import type { BattleForm, BattleUpsertPayload } from '@/types/battle/battle'

const props = defineProps<{
  /** 对话框是否可见。 */
  modelValue: boolean
  /** 是否为修改当前场景；false 表示添加新场景。 */
  isEdit: boolean
  /** 当前正在编辑的场景（战场）；添加模式可为 null。 */
  scene: BattleForm | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  /** 保存成功后回传最新场景数据。 */
  (e: 'saved', scene: BattleForm): void
}>()

/** 表单实例。 */
const formRef = ref<FormInstance>()
/** 提交中状态。 */
const submitting = ref(false)

/** 场景（战场）表单，仅名称与描述。 */
const sceneForm = reactive<BattleUpsertPayload>({
  name: '',
  description: '',
})

/** 场景名称与概述必填。 */
const formRules = reactive<FormRules<BattleUpsertPayload>>({
  name: [{ required: true, message: '请输入场景名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入场景概述', trigger: 'blur' }],
})

/**
 * 计算：场景编辑弹窗是否显示。
 * 返回：getter 为 `props.modelValue`；setter 通过 `update:modelValue` 写入父组件。
 * 作用：`v-model` 双向绑定弹窗开合。
 */
const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

/**
 * 用当前场景填充表单；添加模式则重置为空表单。
 */
const fillForm = () => {
  if (props.isEdit && props.scene) {
    sceneForm.id = props.scene.id
    sceneForm.name = props.scene.name
    sceneForm.description = props.scene.description
    return
  }
  sceneForm.id = undefined
  sceneForm.name = ''
  sceneForm.description = ''
}

/**
 * 从战场列表中解析刚保存的场景（优先按返回 ID，其次按名称匹配最新一条）。
 *
 * @param payload 本次提交的表单
 * @param responseData 保存接口返回的 data
 * @returns 列表中的完整场景对象；找不到时回退为 payload
 */
const resolveSavedScene = async (
  payload: BattleUpsertPayload,
  responseData: unknown,
): Promise<BattleForm> => {
  try {
    const listRes = await getBattleList()
    const list = listRes.code === 200 && Array.isArray(listRes.data) ? listRes.data : []
    const newId = Number(responseData)
    if (Number.isFinite(newId) && newId > 0) {
      const byId = list.find((item) => item.id === newId)
      if (byId) return byId
    }
    const matched = [...list].reverse().find((item) => item.name === payload.name)
    if (matched) return matched
    return { name: payload.name, description: payload.description, id: payload.id }
  } catch (error) {
    console.error('刷新场景列表失败:', error)
    return { name: payload.name, description: payload.description, id: payload.id }
  }
}

/**
 * 校验并提交场景新增 / 修改。
 */
const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.warning('请填写完整的场景信息')
      return
    }
    submitting.value = true
    try {
      const payload: BattleUpsertPayload = {
        id: sceneForm.id,
        name: sceneForm.name.trim(),
        description: sceneForm.description.trim(),
      }
      const res = payload.id ? await updateBattle(payload) : await createBattle(payload)
      if (res.code === 200) {
        const saved: BattleForm = payload.id
          ? {
              ...(props.scene ?? { name: payload.name, description: payload.description }),
              ...payload,
            }
          : await resolveSavedScene(payload, res.data)
        ElMessage.success(payload.id ? '修改场景成功' : '添加场景成功')
        visible.value = false
        emit('saved', saved)
      } else {
        ElMessage.error(res.msg || (payload.id ? '修改场景失败' : '添加场景失败'))
      }
    } catch (error) {
      console.error('保存场景失败:', error)
      ElMessage.error('保存场景失败')
    } finally {
      submitting.value = false
    }
  })
}

/** 关闭弹窗时重置表单。 */
const handleClosed = () => {
  formRef.value?.resetFields()
}

/**
 * 监听：弹窗 `modelValue` 开合。
 * 回调不返回清理函数。
 * 作用：打开弹窗时用当前场景或空白模板填充表单。
 */
watch(
  () => props.modelValue,
  (open) => {
    if (open) fillForm()
  },
)
</script>

<style lang="scss">
.scene-edit-dialog-modal.atlas-app-overlay,
.atlas-app-overlay.scene-edit-dialog-modal {
  background-color: rgba(4, 10, 20, 0.72) !important;
}

.atlas-app-dialog.scene-edit-dialog,
.scene-edit-dialog .atlas-app-dialog {
  --el-dialog-bg-color: rgba(8, 15, 26, 0.96);
  --el-color-primary: #00e1ff;
  background: rgba(8, 15, 26, 0.96) !important;
  border: 1px solid rgba(0, 225, 255, 0.28) !important;
  border-radius: 10px !important;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.55),
    0 0 18px rgba(0, 225, 255, 0.12) !important;

  .atlas-app-dialog__header {
    margin-right: 0;
    padding: 14px 20px 12px;
    background: linear-gradient(90deg, rgba(0, 225, 255, 0.12) 0%, rgba(8, 15, 26, 0) 100%);
    border-bottom: 1px solid rgba(0, 225, 255, 0.18);
  }

  .atlas-app-dialog__title {
    color: #40f2ff !important;
    font-size: 15px;
    font-weight: 700;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .atlas-app-dialog__headerbtn .atlas-app-dialog__close {
    color: #94a3b8 !important;

    &:hover {
      color: #00e1ff !important;
    }
  }

  .atlas-app-dialog__body {
    padding: 16px 20px 8px;
    background: rgba(12, 22, 38, 0.72);
    color: #e2efff;
    max-height: 62vh;
    overflow-y: auto;
  }

  .atlas-app-dialog__footer {
    padding: 12px 20px 16px;
    background: rgba(8, 15, 26, 0.92);
    border-top: 1px solid rgba(0, 225, 255, 0.18);
  }

  .atlas-app-form-item__label {
    color: #7dd3fc !important;
    font-size: 13px;
  }

  .atlas-app-input__wrapper,
  .atlas-app-textarea__wrapper {
    background-color: rgba(8, 20, 36, 0.9) !important;
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.32) inset !important;
  }

  .atlas-app-textarea__inner,
  .atlas-app-input__inner {
    color: #e2efff !important;
    background-color: transparent !important;
  }

  .scene-edit-btn--ghost.atlas-app-button {
    color: #cbd5e1 !important;
    background: rgba(15, 23, 42, 0.85) !important;
    border: 1px solid rgba(148, 163, 184, 0.4) !important;
  }

  .scene-edit-btn--primary.atlas-app-button {
    color: #08202c !important;
    background: linear-gradient(135deg, #40f2ff, #00b8d4) !important;
    border: 1px solid #00e1ff !important;
  }
}
</style>