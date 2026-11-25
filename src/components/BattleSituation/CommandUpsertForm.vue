<template>
  <el-form ref="formRef" :model="formPayload" :rules="rules" :label-width="labelWidth" class="command-upsert-form">
    <el-form-item label="命令名称" prop="name">
      <el-input v-model="formPayload.name" maxlength="80" show-word-limit placeholder="例如：联合登岛作战" />
    </el-form-item>
    <el-form-item label="命令编码" prop="code">
      <el-input v-model="formPayload.code" maxlength="40" placeholder="例如：CMD-001" />
    </el-form-item>
    <el-form-item label="命令来源" prop="source">
      <el-select
        v-model="formPayload.source"
        placeholder="请选择命令来源"
        teleported
        style="width: 100%"
      >
        <el-option
          v-for="item in COMMAND_SOURCE_FORM_OPTIONS"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="作战阶段" prop="stage">
      <el-select
        v-model="formPayload.stage"
        teleported
        filterable
        allow-create
        default-first-option
        placeholder="选择或输入作战阶段"
        style="width: 100%"
      >
        <el-option v-for="item in COMBAT_PHASE_OPTIONS" :key="item.id" :label="item.label" :value="item.label" />
      </el-select>
    </el-form-item>
    <el-form-item label="我方国家" prop="ownCountry">
      <el-select
        :model-value="COMMAND_OWN_COUNTRY_FIXED"
        disabled
        style="width: 100%"
      >
        <el-option :label="COMMAND_OWN_COUNTRY_FIXED" :value="COMMAND_OWN_COUNTRY_FIXED" />
      </el-select>
    </el-form-item>
    <el-form-item label="作战对象" prop="enemyCountry">
      <el-select
        v-model="formPayload.enemyCountry"
        multiple
        teleported
        placeholder="请选择作战对象（可多选）"
        style="width: 100%"
      >
        <el-option
          v-for="item in COMMAND_ENEMY_COUNTRY_OPTIONS"
          :key="item"
          :label="item"
          :value="item"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="作战背景" prop="backGround">
      <el-select
        v-model="formPayload.backGround"
        teleported
        filterable
        allow-create
        clearable
        placeholder="选择或输入作战背景"
        style="width: 100%"
      >
        <el-option
          v-for="item in COMBAT_BACKGROUND_OPTIONS"
          :key="item.id"
          :label="item.label"
          :value="item.label"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="作战预期" prop="expectation">
      <div class="command-expectation-row">
        <el-select
          v-model="formPayload.expectation"
          teleported
          filterable
          allow-create
          clearable
          placeholder="一级预期"
          style="width: 48%"
          @change="handleExpectationPrimaryChange"
        >
          <el-option
            v-for="item in COMBAT_EXPECTATION_PRIMARY_OPTIONS"
            :key="item.id"
            :label="item.label"
            :value="item.label"
          />
        </el-select>
        <el-select
          v-model="formPayload.expectationOption"
          teleported
          filterable
          allow-create
          clearable
          placeholder="预期选项"
          style="width: 48%"
        >
          <el-option
            v-for="item in expectationSecondaryOptions"
            :key="item.id"
            :label="item.label"
            :value="item.label"
          />
        </el-select>
      </div>
    </el-form-item>
    <el-form-item label="描述" prop="description">
      <el-input
        v-model="formPayload.description"
        type="textarea"
        :rows="3"
        maxlength="400"
        show-word-limit
        placeholder="命令补充说明（可选）"
      />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
} from '@/config/combatScenarioOptions'
import {
  COMMAND_ENEMY_COUNTRY_OPTIONS,
  COMMAND_OWN_COUNTRY_FIXED,
  COMMAND_SOURCE_FORM_OPTIONS,
  normalizeCommandEnemyCountries,
} from '@/constants/commandForm'
import type { CommandUpsertPayload } from '@/types/command/command'

withDefaults(
  defineProps<{
    /** 表单项标签宽度 */
    labelWidth?: string
  }>(),
  { labelWidth: '110px' },
)

/** 命令表单（父组件 `reactive` 对象，勿命名为 `model` 以免与 `el-form` 的 `model`  prop 混淆） */
const formPayload = defineModel<CommandUpsertPayload>({ required: true })

const formRef = ref<FormInstance>()

const rules = reactive<FormRules<CommandUpsertPayload>>({
  name: [{ required: true, message: '请输入命令名称', trigger: 'blur' }],
  source: [{ required: true, message: '请选择命令来源', trigger: 'change' }],
  enemyCountry: [{
    validator: (_rule, value, callback) => {
      const list = normalizeCommandEnemyCountries(value)
      if (!list.length) {
        callback(new Error('请至少选择一个作战对象'))
        return
      }
      callback()
    },
    trigger: 'change',
  }],
})

/**
 * 我方国家固定为「中国」：仅在当前值不符合时再写入，避免每次改表单项都替换数组导致下拉无法选中。
 */
const ensureOwnCountryFixed = () => {
  const current = formPayload.value.ownCountry
  if (current?.length === 1 && current[0] === COMMAND_OWN_COUNTRY_FIXED) return
  formPayload.value.ownCountry = [COMMAND_OWN_COUNTRY_FIXED]
}

/**
 * 父组件 `Object.assign` 灌入编辑数据后，再次保证我方国家固定。
 * 回调不返回清理函数。
 */
watch(
  () => formPayload.value.id,
  () => {
    ensureOwnCountryFixed()
  },
)

/**
 * 监听作战对象，将非法项滤除（如历史数据中的「中国」）。
 * 回调不返回清理函数。
 * 作用：编辑旧命令时对齐允许列表，且不监听整表以避免打断 el-select。
 */
watch(
  () => formPayload.value.enemyCountry,
  (val) => {
    const normalized = normalizeCommandEnemyCountries(val)
    if (
      normalized.length !== (val?.length ?? 0)
      || (val ?? []).some((c, i) => c !== normalized[i])
    ) {
      formPayload.value.enemyCountry = normalized
    }
  },
  { deep: true },
)

/**
 * 计算：当前一级作战预期下的二级选项。
 * 返回：二级选项数组。
 * 作用：预期选项下拉数据源。
 */
const expectationSecondaryOptions = computed(() => {
  const label = formPayload.value.expectation?.trim() ?? ''
  const primary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((item) => item.label === label)
  return primary?.children ?? []
})

/** 一级预期变更时校验二级是否仍有效。 */
const handleExpectationPrimaryChange = () => {
  const current = formPayload.value.expectationOption?.trim() ?? ''
  if (!current) return
  const stillValid = expectationSecondaryOptions.value.some((item) => item.label === current)
  if (!stillValid) formPayload.value.expectationOption = ''
}

/**
 * 触发表单校验。
 *
 * @returns 是否通过
 */
const validate = async (): Promise<boolean> => {
  if (!formRef.value) return false
  try {
    await formRef.value.validate()
    return true
  } catch {
    return false
  }
}

const resetFields = () => {
  formRef.value?.resetFields()
  ensureOwnCountryFixed()
}

defineExpose({ validate, resetFields, formRef })
</script>

<style scoped lang="scss">
.command-expectation-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}
</style>