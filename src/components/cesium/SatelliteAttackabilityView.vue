<template>
  <div class="strike-view">
    <section class="hero-card panel-card">
      <div class="hero-card__content">
        <span class="hero-card__eyebrow">🎯 目标可打击度评估</span>
        <h1 class="hero-card__title">卫星可打击度计算模型</h1>
        <p class="hero-card__desc">
          基于多维参数计算卫星目标的综合可打击度得分。当前评估任务：<span class="highlight-task">{{
            activeTaskName
          }}</span
          >，综合系数基于实测轨道、武器匹配度与目标脆弱度推算。
        </p>
      </div>
    </section>

    <div class="toolbar">
      <button type="button" class="sci-btn btn-primary btn-glow" @click="loadStrikeInfo" :disabled="isStrikeLoading">
        <span class="btn-icon">🚀</span>
        <span>{{ isStrikeLoading ? '计算中...' : '计算可打击度' }}</span>
      </button>
      <button type="button" class="sci-btn btn-config" @click="dialogSceneVisible = true">
        <span class="btn-icon">⚙️</span>
        <span>权重参数配置</span>
      </button>
      <span class="toolbar__status" v-show="requestStatus" :class="statusClass">{{ requestStatus }}</span>
    </div>

    <div class="content-grid">
      <section class="rule-panel panel-card">
        <div class="section-header">
          <h2>📘 计算规则与公式</h2>
        </div>
        <div class="formula-chip">
          <span class="formula-label">综合得分公式：</span>
          <code class="formula-code">strikeability_score = x1 × x2 × x3 × x4 × x5 × x6 × x7</code>
        </div>

        <div class="rule-cards-scroll">
          <article v-for="card in ruleCards" :key="card.key" class="rule-card">
            <h3>
              <span class="rule-key-badge">{{ card.key }}</span> {{ card.title }}
            </h3>
            <ul>
              <li v-for="item in card.items" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </section>

      <section class="result-panel panel-card">
        <div class="section-header">
          <h2>📊 计算结果分析</h2>
        </div>

        <div class="result-explain">
          <h3>💡 展示说明</h3>
          <p>通过多维矩阵接口获取各卫星在当前算力配置下的系数分值，用于辅助决策指挥层制定精准打击预案。</p>
          <div class="explain-tags">
            <span class="exp-tag">🛰️ 包含项：NORAD、卫星名称、国家、类型、轨道、x1~x7 细分得分、综合可打击度</span>
            <span class="exp-tag">📈 统计项：卫星数、最高得分、平均得分、高轨/中低轨占比</span>
          </div>
        </div>

        <div class="metric-grid">
          <div v-for="item in metricCards" :key="item.label" class="metric-card">
            <span class="metric-card__label">{{ item.label }}</span>
            <strong class="metric-card__value">{{ item.value }}</strong>
          </div>
        </div>

        <div class="table-shell">
          <el-table :data="strikeRows" stripe border v-loading="isStrikeLoading" empty-text="暂无可打击度结果数据">
            <el-table-column prop="norad_id" label="NORAD" min-width="92" />
            <el-table-column prop="name" label="卫星名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="country" label="国家" min-width="86" />
            <el-table-column prop="sat_type" label="类型" min-width="100" show-overflow-tooltip />
            <el-table-column prop="orbit_type" label="轨道" min-width="86" />
            <el-table-column label="x1" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x1) }}</template>
            </el-table-column>
            <el-table-column label="x2" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x2) }}</template>
            </el-table-column>
            <el-table-column label="x3" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x3) }}</template>
            </el-table-column>
            <el-table-column label="x4" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x4) }}</template>
            </el-table-column>
            <el-table-column label="x5" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x5) }}</template>
            </el-table-column>
            <el-table-column label="x6" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x6) }}</template>
            </el-table-column>
            <el-table-column label="x7" min-width="70">
              <template #default="scope">{{ formatScore(scope.row.x7) }}</template>
            </el-table-column>
            <el-table-column label="可打击度" min-width="110" fixed="right">
              <template #default="scope">
                <span class="score-tag">{{ formatScore(scope.row.strikeability_score) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </div>

    <el-dialog title="⚙️ 权重参数配置" v-model="dialogSceneVisible" width="620px" class="weight-dialog" align-center>
      <div class="weight-explain">
        <div class="explain-title">
          <span class="explain-icon">💡</span>
          <span>权重配置说明</span>
        </div>
        <ul class="explain-list">
          <li><strong>情报评分（W_INFO）：</strong>范围 0 - 100；分值越高表示我方对该卫星的信息掌握越全面。</li>
          <li><strong>可见性评分（W_VIS）：</strong>范围 0 - 100；表示在任务时间窗内卫星的可见时长或可观测性。</li>
          <li><strong>武器打击评分（W_WEAPON）：</strong>范围 0 - 100；表示适配用于打击该卫星的武器数量与效果。</li>
        </ul>
      </div>
      <el-form :model="formWeapon" label-width="120px" size="default" class="weight-form">
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="可见性评分" prop="W_VIS" class="form-item-no-margin">
              <el-input-number
                v-model.number="formWeapon.W_VIS"
                :min="0"
                :max="100"
                :controls="false"
                class="weight-input"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="情报评分" prop="W_INFO" class="form-item-no-margin">
              <el-input-number
                v-model.number="formWeapon.W_INFO"
                :min="0"
                :max="100"
                :controls="false"
                class="weight-input"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="24">
            <el-form-item label="武器打击评分" prop="W_WEAPON" class="form-item-no-margin">
              <el-input-number
                v-model.number="formWeapon.W_WEAPON"
                :min="0"
                :max="100"
                :controls="false"
                class="weight-input"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogSceneVisible = false">取消</el-button>
          <el-button type="primary" @click="setWeight">保存配置</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { setWeaponsWeight, updateStrikeOfTaskV2 } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import type { StrikeV2 } from '@/types/strike'
defineOptions({
  name: 'SatelliteAttackabilityView',
})

type StrikeRow = StrikeV2['strikeList'][number]

type RuleCard = {
  key: string
  title: string
  items: string[]
}

const store = useLayoutStore()
const dialogSceneVisible = ref(false)
const strikeInfo = ref<StrikeV2 | null>(null)
const isStrikeLoading = ref(false)
const requestStatus = ref('等待计算')

const formWeapon = reactive({
  W_VIS: 0,
  W_INFO: 0,
  W_WEAPON: 0,
})

const ruleCards: RuleCard[] = [
  {
    key: 'x1',
    title: 'x1 轨道相关系数',
    items: [
      '高轨卫星：先计算星下点，经度每命中一个武器覆盖范围，x1 加 0.25，最大值为 1。',
      '动能武器覆盖范围：[东经69°, 东经140°]。',
      '定向能武器覆盖范围：[东经50°, 东经180°]。',
      '电子干扰武器覆盖范围：[东经50°, 东经180°]。',
      '天基武器覆盖范围：[0°, 360°]。',
      '中低轨卫星：计算任务地面过境频次 pass_fre。',
      '当 pass_fre > 6 时，x1 = 1。',
      '当 0 ≤ pass_fre ≤ 6 时，x1 = (1/2)^(6 - pass_fre)。',
    ],
  },
  {
    key: 'x2',
    title: 'x2 可攻击武器种类系数',
    items: [
      '动能、定向能、电子干扰、天基武器均可打击：x2 = 1。',
      '动能、定向能、天基武器可打击：x2 = 0.75。',
      '动能、电子干扰、天基武器可打击：x2 = 0.75。',
      '动能、天基武器可打击：x2 = 0.5。',
    ],
  },
  {
    key: 'x3',
    title: 'x3 打击效果评估系数',
    items: [
      '动能武器打击效果指数：1。',
      '定向能武器打击效果指数：0.8。',
      '电子干扰武器打击效果指数：0.6。',
      '天基武器打击效果指数：1。',
      '若可被多种武器打击，则 x3 为这些武器打击效果指数的平均值。',
      '若只能被一种武器打击，则 x3 为该武器对应的打击效果指数。',
    ],
  },
  {
    key: 'x4-x7',
    title: 'x4 到 x7 其他系数',
    items: [
      'x4：光度模型建模情况。已建模为 1，未建模为 0.5。',
      'x5：姿态指向掌握情况。已掌握为 1，未掌握为 0.5。',
      'x6：工作频点掌握情况。已掌握为 1，未掌握为 0.5。',
      'x7：目标保障精度。满足武器精度要求为 1，不满足为 0。',
    ],
  },
]

const activeTaskName = computed(() => store.activeTask?.name || '当前任务')
const strikeRows = computed<StrikeRow[]>(() => strikeInfo.value?.strikeList ?? [])
const averageStrikeScore = computed(() => {
  if (!strikeRows.value.length) return 0
  const total = strikeRows.value.reduce((sum, item) => sum + item.strikeability_score, 0)
  return total / strikeRows.value.length
})
const middleLowNum = computed(() => {
  const total = strikeInfo.value?.num ?? strikeRows.value.length
  const high = strikeInfo.value?.hightNum ?? 0
  return Math.max(total - high, 0)
})
const metricCards = computed(() => [
  { label: '返回卫星数', value: String(strikeInfo.value?.num ?? strikeRows.value.length) },
  { label: '最高可打击度', value: formatScore(strikeInfo.value?.maxStrikeScore ?? 0) },
  { label: '平均可打击度', value: formatScore(averageStrikeScore.value) },
  { label: '高轨数量', value: String(strikeInfo.value?.hightNum ?? 0) },
  { label: '中低轨数量', value: String(middleLowNum.value) },
])
const statusClass = computed(() => {
  if (requestStatus.value.includes('HTTP 200')) return 'is-success'
  if (requestStatus.value.includes('失败')) return 'is-error'
  return 'is-pending'
})

function formatScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '--'
  return Number(value).toFixed(6)
}

async function setWeight() {
  const res = await setWeaponsWeight(formWeapon)
  if (res.code === 200) {
    ElMessage.success('武器权重设置成功')
    dialogSceneVisible.value = false
    loadStrikeInfo()
  }
}

async function loadStrikeInfo() {
  if (!store.activeTask) {
    requestStatus.value = '未选择任务'
    return
  }

  isStrikeLoading.value = true
  requestStatus.value = '正在计算...'
  try {
    const res = await updateStrikeOfTaskV2(store.activeTask.id!)
    if (res.code === 200) {
      strikeInfo.value = res.data
      requestStatus.value = ''
      return
    }
    requestStatus.value = `请求失败：${res.code}`
  } catch (error) {
    console.error(error)
    requestStatus.value = '请求失败：网络或服务异常'
  } finally {
    isStrikeLoading.value = false
  }
}

onMounted(() => {
  loadStrikeInfo()
})
</script>

<style lang="scss" scoped>
.strike-view {
  padding: 20px;
  background: transparent;
  color: var(--text-color-soft);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-card {
  border-radius: 12px;
  background: linear-gradient(180deg, var(--panel-bg-strong) 0%, var(--panel-bg-strong) 100%);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.22);
  box-shadow: 0 12px 32px var(--mask-color);
  backdrop-filter: blur(12px);
}

.hero-card {
  padding: 20px 24px;
}

.hero-card__content {
  text-align: left;
}

.hero-card__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  background: rgba(var(--accent-cyan-rgb), 0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.hero-card__title {
  margin: 0;
  color: var(--color-white);
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.5px;
}

.hero-card__desc {
  margin: 10px 0 0;
  color: var(--text-color-muted);
  font-size: var(--font-size-md);
  line-height: 1.6;

  .highlight-task {
    color: var(--accent-cyan);
    font-weight: var(--font-weight-bold);
  }
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;

  .sci-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 18px;
    font-size: var(--font-size-md);
    font-weight: var(--font-weight-semibold);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid transparent;
    user-select: none;

    .btn-icon {
      font-size: var(--font-size-base);
    }

    &.btn-primary {
      background: linear-gradient(135deg, var(--swatch-rgba-0-102-255-0_6), rgba(var(--accent-cyan-rgb), 0.4));
      border-color: rgba(var(--accent-cyan-rgb), 0.5);
      color: var(--color-white);

      &:hover {
        background: linear-gradient(135deg, var(--swatch-rgba-0-102-255-0_8), rgba(var(--accent-cyan-rgb), 0.6));
        box-shadow: 0 0 14px rgba(var(--accent-cyan-rgb), 0.5);
      }
    }

    &.btn-config {
      background: var(--swatch-rgba-15-38-68-0_8);
      border-color: rgba(var(--accent-cyan-rgb), 0.3);
      color: var(--color-info);

      &:hover {
        background: rgba(var(--accent-cyan-rgb), 0.2);
        color: var(--color-white);
        box-shadow: 0 0 10px rgba(var(--accent-cyan-rgb), 0.3);
      }
    }

    &.btn-glow {
      box-shadow: 0 0 12px rgba(var(--accent-cyan-rgb), 0.3);
    }
  }
}

.toolbar__status {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  background: var(--swatch-rgba-8-18-33-0_6);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.2);

  &.is-success {
    color: var(--color-success);
    border-color: var(--swatch-rgba-16-185-129-0_4);
    background: var(--swatch-rgba-16-185-129-0_15);
  }

  &.is-error {
    color: var(--color-danger-soft);
    border-color: var(--swatch-rgba-239-68-68-0_4);
    background: var(--swatch-rgba-239-68-68-0_15);
  }

  &.is-pending {
    color: var(--color-info);
    border-color: rgba(var(--accent-cyan-rgb), 0.3);
  }
}

.content-grid {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: start;
  text-align: left;
}

.rule-panel,
.result-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
}

.section-header {
  margin-bottom: 16px;

  h2 {
    margin: 0;
    color: var(--accent-cyan);
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    letter-spacing: 0.5px;
    border-bottom: 1px dashed rgba(var(--accent-cyan-rgb), 0.15);
    padding-bottom: 8px;
  }
}

.formula-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  margin-bottom: 16px;
  border-radius: 6px;
  background: var(--panel-bg);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.25);

  .formula-label {
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
  }

  .formula-code {
    color: var(--accent-cyan);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
  }
}

.rule-cards-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 340px);
  overflow-y: auto;
  padding-right: 6px;
}

.rule-card {
  padding: 14px 16px;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
  border-radius: 8px;
  background: var(--swatch-rgba-10-22-40-0_65);
  border-left: 3px solid var(--accent-cyan);

  h3 {
    margin: 0 0 10px;
    color: var(--text-color-strong);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    display: flex;
    align-items: center;
    gap: 8px;

    .rule-key-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(var(--accent-cyan-rgb), 0.15);
      color: var(--accent-cyan);
      font-size: var(--font-size-xs);
    }
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: var(--text-color-muted);
    line-height: 1.7;
    font-size: var(--font-size-sm);

    li {
      margin-bottom: 4px;
    }
  }
}

.result-explain {
  padding: 14px 16px;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
  border-radius: 8px;
  background: var(--swatch-rgba-10-22-40-0_65);

  h3 {
    margin: 0 0 8px;
    color: var(--color-info);
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
  }

  p {
    margin: 0 0 10px;
    color: var(--text-color-muted);
    font-size: var(--font-size-sm);
    line-height: 1.6;
  }

  .explain-tags {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .exp-tag {
      font-size: var(--font-size-xs);
      color: var(--text-color-soft);
      background: var(--swatch-rgba-13-27-49-0_7);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(var(--accent-cyan-rgb), 0.1);
    }
  }
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  margin: 16px 0;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
  border-radius: 8px;
  background: var(--panel-bg);
}

.metric-card__label {
  color: var(--text-color-muted);
  font-size: var(--font-size-xs);
}

.metric-card__value {
  color: var(--accent-cyan);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  text-shadow: 0 0 8px rgba(var(--accent-cyan-rgb), 0.35);
}

.table-shell {
  --el-table-border-color: var(--swatch-rgba-92-139-208-0_18);
  --el-table-header-bg-color: var(--swatch-0f2b52);
  --el-table-bg-color: var(--swatch-091d39);
  --el-table-tr-bg-color: var(--swatch-091d39);
  --el-table-row-hover-bg-color: var(--swatch-rgba-58-116-198-0_18);
  --el-fill-color-lighter: var(--swatch-rgba-58-116-198-0_14);
  --el-text-color-regular: var(--swatch-d7e6fa);
  --el-text-color-primary: var(--text-color-bright);
  border-radius: 16px;
  overflow: hidden;
  height: 100%;
}

.table-shell :deep(.el-table th.el-table__cell) {
  color: var(--swatch-9dccff);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-heavy);
}

.table-shell :deep(.el-table td.el-table__cell) {
  color: var(--swatch-d0e0f5);
  background: var(--swatch-091d39);
}

.table-shell :deep(.el-table__empty-block) {
  background: var(--swatch-091d39);
}

.table-shell :deep(.el-table__inner-wrapper::before) {
  background-color: var(--swatch-rgba-92-139-208-0_18);
}

.score-text {
  color: var(--swatch-9dd0ff);
}

.score-text--strong {
  font-weight: var(--font-weight-heavy);
}

:deep(.weight-dialog) {
  background: var(--swatch-rgba-10-22-40-0_95) !important;
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.3);
  border-radius: 12px;
  box-shadow:
    0 16px 48px var(--swatch-rgba-0-0-0-0_7),
    0 0 24px rgba(var(--accent-cyan-rgb), 0.2);
  backdrop-filter: blur(12px);
  overflow: hidden;

  .el-dialog__header {
    margin-right: 0;
    padding: 16px 20px;
    background: linear-gradient(90deg, rgba(var(--accent-cyan-rgb), 0.1) 0%, var(--swatch-rgba-10-22-40-0) 100%);
    border-bottom: 1px solid rgba(var(--accent-cyan-rgb), 0.2);

    .el-dialog__title {
      color: var(--text-color-strong);
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .el-dialog__headerbtn .el-dialog__close {
      color: var(--text-color-muted);

      &:hover {
        color: var(--accent-cyan);
      }
    }
  }

  .el-dialog__body {
    padding: 20px;
    color: var(--text-color-soft);
  }

  .el-dialog__footer {
    padding: 14px 20px;
    background: var(--swatch-rgba-6-15-30-0_6);
    border-top: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
  }
}

.weight-explain {
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(var(--accent-cyan-rgb), 0.04);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.18);
  border-left: 4px solid var(--accent-cyan);

  .explain-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--color-info);
    margin-bottom: 8px;
  }

  .explain-list {
    margin: 0;
    padding-left: 18px;
    color: var(--text-color-muted);
    line-height: 1.7;
    font-size: var(--font-size-sm);

    li {
      margin-bottom: 4px;
      text-align: left;

      strong {
        color: var(--text-color-soft);
      }

      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

.weight-form-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.weight-param-card {
  padding: 14px 16px;
  border-radius: 8px;
  background: var(--swatch-rgba-13-27-49-0_7);
  border: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
  transition: all 0.25s ease;

  &:hover {
    border-color: rgba(var(--accent-cyan-rgb), 0.35);
    box-shadow: 0 0 12px rgba(var(--accent-cyan-rgb), 0.1);
  }

  .param-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    .param-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-color-soft);
      font-size: var(--font-size-base);
      font-weight: var(--font-weight-semibold);

      .param-icon {
        font-size: var(--font-size-lg);
      }
    }
  }

  .param-slider-wrapper {
    padding: 0 4px;
  }
}

:deep(.custom-input-number) {
  width: 110px;

  .el-input__wrapper {
    background-color: var(--swatch-rgba-10-20-36-0_8) !important;
    box-shadow: 0 0 0 1px rgba(var(--accent-cyan-rgb), 0.25) inset !important;
    border-radius: 4px;

    &:hover,
    &.is-focus {
      box-shadow: 0 0 0 1px var(--accent-cyan) inset !important;
    }
  }

  .el-input__inner {
    color: var(--accent-cyan) !important;
    font-weight: var(--font-weight-bold);
    text-align: center;
  }

  .el-input-number__decrease,
  .el-input-number__increase {
    background-color: var(--swatch-rgba-15-32-59-0_8) !important;
    color: var(--text-color-muted) !important;
    border-color: rgba(var(--accent-cyan-rgb), 0.2) !important;

    &:hover {
      color: var(--accent-cyan) !important;
      background-color: rgba(var(--accent-cyan-rgb), 0.15) !important;
    }
  }
}

:deep(.custom-slider) {
  --el-slider-main-bg-color: var(--accent-cyan);
  --el-slider-runway-bg-color: rgba(var(--accent-cyan-rgb), 0.12);
  --el-slider-stop-bg-color: rgba(var(--accent-cyan-rgb), 0.2);
  --el-slider-button-size: 14px;
  --el-slider-button-wrapper-size: 32px;

  .el-slider__button {
    border: 2px solid var(--accent-cyan);
    background-color: var(--swatch-0a1628);
    box-shadow: 0 0 8px rgba(var(--accent-cyan-rgb), 0.6);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .sci-btn-cancel {
    background: var(--swatch-rgba-15-32-59-0_8);
    border: 1px solid rgba(var(--accent-cyan-rgb), 0.2);
    color: var(--text-color-muted);

    &:hover {
      background: rgba(var(--accent-cyan-rgb), 0.1);
      color: var(--accent-cyan);
      border-color: rgba(var(--accent-cyan-rgb), 0.4);
    }
  }

  .sci-btn-submit {
    background: linear-gradient(135deg, var(--swatch-0099ff) 0%, var(--accent-cyan) 100%);
    border: none;
    color: var(--swatch-061121);
    font-weight: var(--font-weight-bold);
    box-shadow: 0 0 14px rgba(var(--accent-cyan-rgb), 0.4);
    transition: all 0.25s ease;

    &:hover {
      opacity: 0.9;
      box-shadow: 0 0 20px rgba(var(--accent-cyan-rgb), 0.6);
      transform: translateY(-1px);
    }
  }
}

@media (max-width: 1440px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(120px, 1fr));
  }
}

@media (max-width: 1100px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .toolbar__status {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 768px) {
  .strike-view {
    padding: 12px;
  }

  .hero-card {
    padding: 22px 18px;
  }

  .hero-card__title {
    font-size: var(--font-size-display);
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  .formula-chip {
    width: 100%;
    font-size: var(--font-size-subtitle);
    line-height: 1.5;
  }
}
</style>
