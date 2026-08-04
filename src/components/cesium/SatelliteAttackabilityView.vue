<template>
  <div class="strike-view">
    <section class="hero-card panel-card">
      <div class="hero-card__content">
        <h1 class="hero-card__title">可打击度计算展示页</h1>
        <p class="hero-card__desc">
          页面上方用于展示可打击度规则，下方用于展示调用接口后的结果。 当前任务为{{
            activeTaskName
          }}，结果以接口返回值为准。
        </p>
      </div>
    </section>

    <div class="toolbar">
      <el-button type="primary" round @click="loadStrikeInfo" :loading="isStrikeLoading">计算可打击度</el-button>
      <span class="toolbar__status" :class="statusClass">{{ requestStatus }}</span>
    </div>

    <div class="content-grid">
      <section class="rule-panel panel-card">
        <div class="section-header">
          <h2>计算规则展示</h2>
        </div>
        <div class="formula-chip">strikeability_score = x1 * x2 * x3 * x4 * x5 * x6 * x7</div>

        <article v-for="card in ruleCards" :key="card.key" class="rule-card">
          <h3>{{ card.title }}</h3>
          <ul>
            <li v-for="item in card.items" :key="item">{{ item }}</li>
          </ul>
        </article>
      </section>

      <section class="result-panel panel-card">
        <div class="section-header">
          <h2>结果展示</h2>
        </div>

        <div class="result-explain">
          <h3>展示说明</h3>
          <p>
            页面会使用内置说明展示数据，并直接调用接口。为了让结果区更易读，统计卡片与结果表格均由返回数据实时生成。
          </p>
          <ul>
            <li>展示项：卫星名称、国家、类型、轨道、x1 到 x7、可打击度。</li>
            <li>统计项：返回卫星数、最高值、平均值、高轨数量、中低轨数量。</li>
          </ul>
        </div>

        <div class="metric-grid">
          <div v-for="item in metricCards" :key="item.label" class="metric-card">
            <span class="metric-card__label">{{ item.label }}</span>
            <strong class="metric-card__value">{{ item.value }}</strong>
          </div>
        </div>

        <div class="table-shell">
          <el-table :data="strikeRows" stripe border v-loading="isStrikeLoading" empty-text="暂无可打击度结果">
            <el-table-column prop="norad_id" label="NORAD" min-width="92" />
            <el-table-column prop="name" label="名称" min-width="150" show-overflow-tooltip />
            <el-table-column prop="country" label="国家" min-width="86" />
            <el-table-column prop="sat_type" label="卫星类型" min-width="110" show-overflow-tooltip />
            <el-table-column prop="orbit_type" label="轨道类型" min-width="90" />
            <el-table-column label="x1" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x1) }}</template>
            </el-table-column>
            <el-table-column label="x2" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x2) }}</template>
            </el-table-column>
            <el-table-column label="x3" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x3) }}</template>
            </el-table-column>
            <el-table-column label="x4" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x4) }}</template>
            </el-table-column>
            <el-table-column label="x5" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x5) }}</template>
            </el-table-column>
            <el-table-column label="x6" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x6) }}</template>
            </el-table-column>
            <el-table-column label="x7" min-width="86">
              <template #default="scope">{{ formatScore(scope.row.x7) }}</template>
            </el-table-column>
            <el-table-column label="可打击度" min-width="110" fixed="right">
              <template #default="scope">
                <span class="score-text score-text--strong">{{ formatScore(scope.row.strikeability_score) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </section>
    </div>

    <el-dialog title="权重配置" v-model="dialogSceneVisible" width="600px">
      <div class="weight-explain">
        <h4>权重配置说明</h4>
        <ul>
          <li><strong>情报评分：</strong>范围 0-100；分值越高表示我方对该卫星的信息掌握越全面。</li>
          <li><strong>可见性评分：</strong>范围 0-100；表示在任务时间窗内卫星的可见时长或可观测性。</li>
          <li><strong>武器打击评分：</strong>范围 0-100；表示适配用于打击该卫星的武器数量与效果。</li>
        </ul>
      </div>
      <el-form :model="formWeapon" label-width="120px">
        <el-form-item label="可见性评分" prop="W_VIS">
          <el-input-number v-model.number="formWeapon.W_VIS" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="情报评分" prop="W_INFO">
          <el-input-number v-model.number="formWeapon.W_INFO" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="武器打击评分" prop="W_WEAPON">
          <el-input-number v-model.number="formWeapon.W_WEAPON" :min="0" :max="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogSceneVisible = false">取消</el-button>
          <el-button type="primary" @click="setWeight">确定</el-button>
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
defineProps<{
  tabKey?: string
  hasNav?: boolean
  hasLegend?: boolean
  showSatMsg?: boolean
  showTimeLine?: boolean
  showAnimation?: boolean
}>()

defineEmits(['threatAnalysis', 'changeEffectModel'])

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
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 100%;
  padding: 18px;
  background:
    radial-gradient(circle at top left, rgba(48, 117, 214, 0.24), transparent 28%),
    radial-gradient(circle at right center, rgba(33, 80, 166, 0.22), transparent 24%),
    linear-gradient(180deg, #06111f 0%, #0a1830 55%, #0b1d37 100%);
}

.panel-card {
  background: linear-gradient(180deg, rgba(12, 28, 52, 0.92) 0%, rgba(8, 20, 38, 0.94) 100%);
  border: 1px solid rgba(112, 170, 255, 0.18);
  border-radius: 26px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
}

.hero-card {
  padding: 28px 30px;
}

.hero-card__content {
  max-width: 920px;
  text-align: left;
}

.hero-card__eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  margin-bottom: 16px;
  border-radius: 999px;
  background: rgba(65, 125, 223, 0.18);
  color: #8dc3ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.hero-card__title {
  margin: 0;
  color: #f2f7ff;
  font-size: 52px;
  line-height: 1.1;
  font-weight: 800;
}

.hero-card__desc {
  max-width: 1040px;
  margin: 18px 0 24px;
  color: #b7c9e7;
  font-size: 15px;
  line-height: 1.8;
}

.hero-card__formula {
  padding: 18px 20px;
  border-radius: 18px;
  background: linear-gradient(90deg, rgba(18, 52, 99, 0.92), rgba(16, 68, 138, 0.86));
  color: #dbeaff;
  border: 1px solid rgba(110, 170, 255, 0.18);
}

.hero-card__formula-title {
  margin-bottom: 6px;
  font-size: 19px;
  font-weight: 700;
}

.hero-card__formula p {
  margin: 0;
  font-size: 14px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.toolbar :deep(.el-button--primary) {
  --el-button-bg-color: #1f5fb8;
  --el-button-border-color: #1f5fb8;
  --el-button-hover-bg-color: #2f74d3;
  --el-button-hover-border-color: #2f74d3;
}

.toolbar :deep(.el-button:not(.el-button--primary)) {
  --el-button-bg-color: rgba(14, 37, 71, 0.92);
  --el-button-border-color: rgba(101, 155, 233, 0.26);
  --el-button-text-color: #d8e8ff;
  --el-button-hover-bg-color: rgba(22, 51, 93, 0.96);
  --el-button-hover-border-color: rgba(124, 181, 255, 0.38);
  --el-button-hover-text-color: #ffffff;
}

.toolbar__status {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
}

.toolbar__status.is-success {
  color: #78d6a3;
}

.toolbar__status.is-error {
  color: #ff8c8c;
}

.toolbar__status.is-pending {
  color: #9ec3f7;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(340px, 0.95fr) minmax(420px, 1.35fr);
  gap: 20px;
  align-items: start;
  text-align: left;
  // AI: 改为 min-height，允许超出浏览器高度时自然延伸并进行外层滚动
  min-height: calc(100vh - 260px);
}

.section-header {
  margin-bottom: 18px;
}

.section-header h2 {
  margin: 0;
  color: #f0f6ff;
  font-size: 22px;
  font-weight: 800;
}

.rule-panel,
.result-panel {
  padding: 22px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.formula-chip {
  display: inline-flex;
  align-items: center;
  padding: 10px 18px;
  margin-bottom: 16px;
  border-radius: 14px;
  background: linear-gradient(90deg, #12345d, #19457f);
  color: #edf5ff;
  font-size: 18px;
  font-weight: 700;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.rule-card {
  padding: 18px 20px;
  margin-bottom: 16px;
  border: 1px solid rgba(116, 169, 245, 0.16);
  border-radius: 18px;
  background: rgba(10, 27, 50, 0.78);
}

.rule-card h3 {
  margin: 0 0 12px;
  color: #8cc8ff;
  font-size: 18px;
  font-weight: 800;
}

.rule-card ul,
.result-explain ul,
.weight-explain ul {
  margin: 0;
  padding-left: 20px;
  color: #bdd0ec;
  line-height: 1.85;
}

.result-explain {
  padding: 18px 20px;
  border: 1px solid rgba(116, 169, 245, 0.16);
  border-radius: 18px;
  background: rgba(9, 25, 48, 0.8);
}

.result-explain h3,
.weight-explain h4 {
  margin: 0 0 10px;
  color: #f0f6ff;
  font-size: 18px;
  font-weight: 800;
}

.result-explain p {
  margin: 0 0 12px;
  color: #bdd0ec;
  line-height: 1.8;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(120px, 1fr));
  gap: 12px;
  margin: 18px 0;
}

.metric-card {
  padding: 16px 18px;
  border: 1px solid rgba(116, 169, 245, 0.16);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(13, 35, 66, 0.92), rgba(8, 24, 47, 0.92));
}

.metric-card__label {
  display: block;
  margin-bottom: 10px;
  color: #8eafd8;
  font-size: 13px;
}

.metric-card__value {
  color: #f1f7ff;
  font-size: 22px;
  font-weight: 800;
}

.table-shell {
  padding: 10px;
  border: 1px solid rgba(116, 169, 245, 0.16);
  border-radius: 22px;
  background: rgba(8, 22, 42, 0.94);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
}

.table-shell :deep(.el-table) {
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

.weight-explain {
  margin-bottom: 18px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
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
