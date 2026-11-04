<template>
  <div class="home-analysis-page dark-theme">
    <header class="home-analysis-header">
      <h1 class="home-analysis-title">攻击度分析</h1>
      <p class="home-analysis-desc">
        展示攻击度、攻击窗口、武器与作战背景加权（背景加权来自任务本地场景配置，待 generateStrikePlanV2 扩展）。
      </p>
    </header>

    <div v-if="!store.activedTask" class="home-analysis-empty">请先选择场景与任务</div>
    <div v-else-if="analysisLoading" class="home-analysis-empty">正在加载分析数据...</div>
    <div v-else-if="!analysisReady" class="home-analysis-empty">请等待当前任务算法计算完成</div>

    <template v-else>
      <section v-if="scenarioSummary" class="analysis-section panel-card analysis-country-row--priority">
        <h2>作战背景加权</h2>
        <p>{{ scenarioSummary }}</p>
        <p class="formula-note">加权规则：本地保存的作战背景/预期/阶段组合键；后端接入后由 evaluationConfig / strikePlanV2 计算。</p>
      </section>

      <section v-for="country in sortedCountries" :key="country" class="analysis-section panel-card"
        :class="countryRowPriorityClass(country, priorityCountries)">
        <h2>{{ country }} · 打击计划</h2>
        <el-table :data="attackRows" size="small" border empty-text="暂无打击计划">
          <el-table-column prop="target" label="目标" min-width="120" show-overflow-tooltip />
          <el-table-column prop="targetType" label="类型" width="80" />
          <el-table-column prop="weaponName" label="武器" min-width="100" show-overflow-tooltip />
          <el-table-column prop="beginTime" label="攻击窗口开始" width="140" />
          <el-table-column prop="endTime" label="攻击窗口结束" width="140" />
          <el-table-column label="攻击度" width="88">
            <template #default>--</template>
          </el-table-column>
        </el-table>
        <p class="formula-note">
          攻击窗口：attackPlanList 的 beginTime/endTime。攻击度得分待对接可打击度矩阵（/algorithm/attackability 同源接口）。
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useLayoutStore } from '@/store/modules/layout'
import { buildAttackPlanTableRows } from '@/utils/buildAttackPlanTable'
import {
  buildCombatScenarioCompositeKey,
  loadCombatScenarioForTask,
  COMBAT_BACKGROUND_OPTIONS,
  COMBAT_EXPECTATION_PRIMARY_OPTIONS,
  COMBAT_PHASE_OPTIONS,
  COMMAND_SOURCE_OPTIONS,
} from '@/config/combatScenarioOptions'
import {
  countryRowPriorityClass,
  sortCountriesForTaskPhase,
} from '@/components/BattleSituation/analysis/countryAnalysisSort'

defineOptions({ name: 'HomeAttackAnalysisView' })

const store = useLayoutStore()

const analysisLoading = computed(() => store.taskAnalysisLoading)
const analysisData = computed(() => store.taskAnalysisData)
const analysisReady = computed(
  () => Boolean(analysisData.value?.levelSeriesEntities?.length) && store.taskAnalysisTaskId === store.activedTask?.id,
)

const priorityCountries = computed(() => store.activedTask?.enemyCountryShow ?? [])
const sortedCountries = computed(() => {
  const list = priorityCountries.value.length ? priorityCountries.value : ['蓝方目标']
  return sortCountriesForTaskPhase(list, priorityCountries.value)
})

const attackRows = computed(() => buildAttackPlanTableRows(analysisData.value))

const scenarioSummary = computed(() => {
  const taskId = store.activedTask?.id
  if (!taskId) return ''
  const selection = loadCombatScenarioForTask(taskId)
  if (!selection) return '未配置作战场景（请在添加任务时填写作战背景/预期/阶段）'
  const bg = COMBAT_BACKGROUND_OPTIONS.find((o) => o.id === selection.backgroundId)?.label ?? selection.backgroundId
  const cmd = COMMAND_SOURCE_OPTIONS.find((o) => o.id === selection.commandSourceId)?.label ?? selection.commandSourceId
  const phase = COMBAT_PHASE_OPTIONS.find((o) => o.id === selection.combatPhaseId)?.label ?? selection.combatPhaseId
  const expPrimary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.find((o) => o.id === selection.expectationPrimaryId)?.label
  const expSecondary = COMBAT_EXPECTATION_PRIMARY_OPTIONS.flatMap((p) => p.children)
    .find((o) => o.id === selection.expectationSecondaryId)?.label
  const key = buildCombatScenarioCompositeKey(selection)
  return `命令来源=${cmd}；阶段=${phase}；预期=${expPrimary ?? '--'}/${expSecondary ?? '--'}；背景=${bg}（组合键 ${key}）`
})
</script>

<style scoped lang="scss">
.home-analysis-page {
  padding: 16px 20px 32px;
  min-height: 100%;
  background: #0b1220;
  color: #e2e8f0;
}

.home-analysis-header {
  margin-bottom: 16px;
}

.home-analysis-title {
  margin: 0 0 8px;
}

.home-analysis-desc {
  margin: 0;
  color: #94a3b8;
}

.home-analysis-empty {
  padding: 48px;
  text-align: center;
  color: #94a3b8;
}

.analysis-section {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(56, 189, 248, 0.15);
}

.formula-note {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.5;
}

.analysis-country-row--priority {
  border-color: rgba(251, 191, 36, 0.45);
}

.analysis-country-row--default {
  border-color: rgba(56, 189, 248, 0.12);
}
</style>

<style lang="scss">
@use '@/components/BattleSituation/styles/home-analysis-typography.scss';
</style>
