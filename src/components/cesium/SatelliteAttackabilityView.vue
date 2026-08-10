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

const activeTaskName = computed(() => store.activedTask?.name || '当前任务')
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
  if (!store.activedTask) {
    requestStatus.value = '未选择任务'
    return
  }

  isStrikeLoading.value = true
  requestStatus.value = '正在计算...'
  try {
    const res = await updateStrikeOfTaskV2(store.activedTask.id!)
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
  color: #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.panel-card {
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(8, 20, 38, 0.85) 0%, rgba(12, 28, 52, 0.9) 100%);
  border: 1px solid rgba(0, 225, 255, 0.22);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
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
  background: rgba(0, 225, 255, 0.15);
  color: #00e1ff;
  border: 1px solid rgba(0, 225, 255, 0.3);
  font-size: 12px;
  font-weight: 600;
}

.hero-card__title {
  margin: 0;
  color: #ffffff;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.hero-card__desc {
  margin: 10px 0 0;
  color: #94a3b8;
  font-size: 13px;
  line-height: 1.6;

  .highlight-task {
    color: #00e1ff;
    font-weight: 700;
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
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.25s ease;
    border: 1px solid transparent;
    user-select: none;

    .btn-icon {
      font-size: 14px;
    }

    &.btn-primary {
      background: linear-gradient(135deg, rgba(0, 102, 255, 0.6), rgba(0, 225, 255, 0.4));
      border-color: rgba(0, 225, 255, 0.5);
      color: #ffffff;

      &:hover {
        background: linear-gradient(135deg, rgba(0, 102, 255, 0.8), rgba(0, 225, 255, 0.6));
        box-shadow: 0 0 14px rgba(0, 225, 255, 0.5);
      }
    }

    &.btn-config {
      background: rgba(15, 38, 68, 0.8);
      border-color: rgba(0, 225, 255, 0.3);
      color: #38bdf8;

      &:hover {
        background: rgba(0, 225, 255, 0.2);
        color: #ffffff;
        box-shadow: 0 0 10px rgba(0, 225, 255, 0.3);
      }
    }

    &.btn-glow {
      box-shadow: 0 0 12px rgba(0, 225, 255, 0.3);
    }
  }
}

.toolbar__status {
  margin-left: auto;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(8, 18, 33, 0.6);
  border: 1px solid rgba(0, 225, 255, 0.2);

  &.is-success {
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.15);
  }

  &.is-error {
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.15);
  }

  &.is-pending {
    color: #38bdf8;
    border-color: rgba(0, 225, 255, 0.3);
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
    color: #00e1ff;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
    border-bottom: 1px dashed rgba(0, 225, 255, 0.15);
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
  background: rgba(13, 27, 49, 0.8);
  border: 1px solid rgba(0, 225, 255, 0.25);

  .formula-label {
    color: #94a3b8;
    font-size: 12px;
  }

  .formula-code {
    color: #00e1ff;
    font-size: 14px;
    font-weight: 700;
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
  border: 1px solid rgba(0, 225, 255, 0.15);
  border-radius: 8px;
  background: rgba(10, 22, 40, 0.65);
  border-left: 3px solid #00e1ff;

  h3 {
    margin: 0 0 10px;
    color: #f1f7ff;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;

    .rule-key-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0, 225, 255, 0.15);
      color: #00e1ff;
      font-size: 11px;
    }
  }

  ul {
    margin: 0;
    padding-left: 18px;
    color: #94a3b8;
    line-height: 1.7;
    font-size: 12px;

    li {
      margin-bottom: 4px;
    }
  }
}

.result-explain {
  padding: 14px 16px;
  border: 1px solid rgba(0, 225, 255, 0.15);
  border-radius: 8px;
  background: rgba(10, 22, 40, 0.65);

  h3 {
    margin: 0 0 8px;
    color: #38bdf8;
    font-size: 14px;
    font-weight: 700;
  }

  p {
    margin: 0 0 10px;
    color: #94a3b8;
    font-size: 12px;
    line-height: 1.6;
  }

  .explain-tags {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .exp-tag {
      font-size: 11px;
      color: #cbd5e1;
      background: rgba(13, 27, 49, 0.7);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 225, 255, 0.1);
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
  border: 1px solid rgba(0, 225, 255, 0.15);
  border-radius: 8px;
  background: rgba(13, 27, 49, 0.8);
}

.metric-card__label {
  color: #94a3b8;
  font-size: 11px;
}

.metric-card__value {
  color: #00e1ff;
  font-size: 22px;
  font-weight: 700;
  text-shadow: 0 0 8px rgba(0, 225, 255, 0.35);
}

.table-shell {
  --el-table-border-color: rgba(92, 139, 208, 0.18);
  --el-table-header-bg-color: #0f2b52;
  --el-table-bg-color: #091d39;
  --el-table-tr-bg-color: #091d39;
  --el-table-row-hover-bg-color: rgba(58, 116, 198, 0.18);
  --el-fill-color-lighter: rgba(58, 116, 198, 0.14);
  --el-text-color-regular: #d7e6fa;
  --el-text-color-primary: #eaf3ff;
  border-radius: 16px;
  overflow: hidden;
  height: 100%;
}

.table-shell :deep(.el-table th.el-table__cell) {
  color: #9dccff;
  font-size: 13px;
  font-weight: 800;
}

.table-shell :deep(.el-table td.el-table__cell) {
  color: #d0e0f5;
  background: #091d39;
}

.table-shell :deep(.el-table__empty-block) {
  background: #091d39;
}

.table-shell :deep(.el-table__inner-wrapper::before) {
  background-color: rgba(92, 139, 208, 0.18);
}

.score-text {
  color: #9dd0ff;
}

.score-text--strong {
  font-weight: 800;
}

:deep(.weight-dialog) {
  background: rgba(10, 22, 40, 0.95) !important;
  border: 1px solid rgba(0, 225, 255, 0.3);
  border-radius: 12px;
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.7),
    0 0 24px rgba(0, 225, 255, 0.2);
  backdrop-filter: blur(12px);
  overflow: hidden;

  .el-dialog__header {
    margin-right: 0;
    padding: 16px 20px;
    background: linear-gradient(90deg, rgba(0, 225, 255, 0.1) 0%, rgba(10, 22, 40, 0) 100%);
    border-bottom: 1px solid rgba(0, 225, 255, 0.2);

    .el-dialog__title {
      color: #f1f7ff;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .el-dialog__headerbtn .el-dialog__close {
      color: #94a3b8;

      &:hover {
        color: #00e1ff;
      }
    }
  }

  .el-dialog__body {
    padding: 20px;
    color: #e2e8f0;
  }

  .el-dialog__footer {
    padding: 14px 20px;
    background: rgba(6, 15, 30, 0.6);
    border-top: 1px solid rgba(0, 225, 255, 0.15);
  }
}

.weight-explain {
  margin-bottom: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(0, 225, 255, 0.04);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-left: 4px solid #00e1ff;

  .explain-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 700;
    color: #38bdf8;
    margin-bottom: 8px;
  }

  .explain-list {
    margin: 0;
    padding-left: 18px;
    color: #94a3b8;
    line-height: 1.7;
    font-size: 12px;

    li {
      margin-bottom: 4px;
      text-align: left;

      strong {
        color: #e2e8f0;
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
  background: rgba(13, 27, 49, 0.7);
  border: 1px solid rgba(0, 225, 255, 0.15);
  transition: all 0.25s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.35);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.1);
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
      color: #e2e8f0;
      font-size: 14px;
      font-weight: 600;

      .param-icon {
        font-size: 16px;
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
    background-color: rgba(10, 20, 36, 0.8) !important;
    box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.25) inset !important;
    border-radius: 4px;

    &:hover,
    &.is-focus {
      box-shadow: 0 0 0 1px #00e1ff inset !important;
    }
  }

  .el-input__inner {
    color: #00e1ff !important;
    font-weight: 700;
    text-align: center;
  }

  .el-input-number__decrease,
  .el-input-number__increase {
    background-color: rgba(15, 32, 59, 0.8) !important;
    color: #94a3b8 !important;
    border-color: rgba(0, 225, 255, 0.2) !important;

    &:hover {
      color: #00e1ff !important;
      background-color: rgba(0, 225, 255, 0.15) !important;
    }
  }
}

:deep(.custom-slider) {
  --el-slider-main-bg-color: #00e1ff;
  --el-slider-runway-bg-color: rgba(0, 225, 255, 0.12);
  --el-slider-stop-bg-color: rgba(0, 225, 255, 0.2);
  --el-slider-button-size: 14px;
  --el-slider-button-wrapper-size: 32px;

  .el-slider__button {
    border: 2px solid #00e1ff;
    background-color: #0a1628;
    box-shadow: 0 0 8px rgba(0, 225, 255, 0.6);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  .sci-btn-cancel {
    background: rgba(15, 32, 59, 0.8);
    border: 1px solid rgba(0, 225, 255, 0.2);
    color: #94a3b8;

    &:hover {
      background: rgba(0, 225, 255, 0.1);
      color: #00e1ff;
      border-color: rgba(0, 225, 255, 0.4);
    }
  }

  .sci-btn-submit {
    background: linear-gradient(135deg, #0099ff 0%, #00e1ff 100%);
    border: none;
    color: #061121;
    font-weight: 700;
    box-shadow: 0 0 14px rgba(0, 225, 255, 0.4);
    transition: all 0.25s ease;

    &:hover {
      opacity: 0.9;
      box-shadow: 0 0 20px rgba(0, 225, 255, 0.6);
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
    font-size: 34px;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(120px, 1fr));
  }

  .formula-chip {
    width: 100%;
    font-size: 15px;
    line-height: 1.5;
  }
}
</style>
