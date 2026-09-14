<template>
  <div class="task-link-assemble">
    <div class="link-head">
      <div>
        <h3 class="link-title">链路装配</h3>
        <p class="link-desc">按步骤完成选择，每步确认后进入下一步。</p>
      </div>
    </div>

    <div class="link-type-row">
      <button v-for="item in linkTypeOptions" :key="item.value" type="button" class="link-type-card"
        :class="{ 'is-active': linkMode === item.value }" @click="switchLinkMode(item.value)">
        <span class="link-type-name">{{ item.label }}</span>
        <span class="link-type-path">{{ item.path }}</span>
      </button>
    </div>

    <el-steps :active="currentWizardIndex" align-center finish-status="success" class="link-steps" simple>
      <el-step v-for="step in wizardStepDefs" :key="step.key" :title="step.title" :description="step.description" />
    </el-steps>

    <section class="link-wizard-panel">
      <!-- 步骤：选择卫星 -->
      <div v-if="currentStepKey === 'sat'" class="link-wizard-content">
        <div class="link-wizard-panel-head">
          <h4 class="link-wizard-panel-title">第 {{ currentWizardIndex + 1 }} 步 · 选择卫星</h4>
          <span class="link-wizard-panel-meta">已选 {{ selectedSatIds.length }} 颗，可多选</span>
        </div>
        <div class="link-wizard-filters">
          <el-input v-model="satKeyword" size="small" clearable placeholder="名称 / NORAD" class="link-filter-item"
            @keyup.enter="handleSatelliteSearch" @clear="handleSatelliteSearch" />
          <el-select v-model="seriesFilter" size="small" clearable placeholder="系列" class="link-filter-item"
            popper-class="task-edit-select-popper" @change="handleSatelliteSearch" @clear="handleSatelliteSearch">
            <el-option v-for="item in constellationOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
          <el-select v-model="typeFilter" size="small" clearable placeholder="类型" class="link-filter-item"
            popper-class="task-edit-select-popper" @change="handleSatelliteSearch" @clear="handleSatelliteSearch">
            <el-option v-for="item in satTypes" :key="item" :label="item" :value="item" />
          </el-select>
          <el-button class="task-edit-btn task-edit-btn--ghost" size="small" :loading="satLoading"
            @click="loadSatelliteCandidates">
            刷新
          </el-button>
        </div>
        <div class="link-shuttle">
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>候选卫星</span>
              <span class="link-shuttle-pane-meta">本页 {{ satLeftRows.length }} 项</span>
            </div>
            <el-table ref="satLeftTableRef" v-loading="satLoading" :data="satLeftRows" size="small" height="100%"
              row-key="id" class="link-table" empty-text="暂无候选卫星" @selection-change="onSatLeftChange">
              <el-table-column type="selection" width="42" />
              <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
              <el-table-column prop="norad" label="NORAD" width="88" />
              <el-table-column prop="series" label="系列" min-width="100" show-overflow-tooltip />
              <el-table-column prop="satType" label="类型" width="88" show-overflow-tooltip />
              <el-table-column prop="orbit" label="轨道" width="72" />
            </el-table>
            <el-pagination v-model:current-page="satPage.pageNum" v-model:page-size="satPage.pageSize"
              class="link-pager" :total="satTotalElements" small layout="total, prev, pager, next"
              @current-change="loadSatelliteCandidates" @size-change="handleSatPageSizeChange" />
          </section>
          <div class="link-shuttle-actions">
            <el-button class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
              :disabled="!satLeftPicks.length" @click="addSats">
              加入选中 →
            </el-button>
            <el-button class="task-edit-btn task-edit-btn--ghost" size="small" :disabled="!satRightPicks.length"
              @click="removeSats">
              ← 移除选中
            </el-button>
          </div>
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>已选卫星</span>
              <span class="link-shuttle-pane-meta">{{ satSelection.length }} 颗</span>
            </div>
            <el-table ref="satRightTableRef" :data="satSelection" size="small" height="100%" row-key="id"
              class="link-table" empty-text="从左侧加入卫星" @selection-change="onSatRightChange">
              <el-table-column type="selection" width="42" />
              <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
              <el-table-column prop="norad" label="NORAD" width="88" />
              <el-table-column prop="series" label="系列" min-width="100" show-overflow-tooltip />
              <el-table-column prop="satType" label="类型" width="88" show-overflow-tooltip />
            </el-table>
          </section>
        </div>
      </div>

      <!-- 步骤：选择中继卫星 -->
      <div v-else-if="currentStepKey === 'relay'" class="link-wizard-content">
        <div class="link-wizard-panel-head">
          <h4 class="link-wizard-panel-title">第 {{ currentWizardIndex + 1 }} 步 · 选择中继卫星</h4>
          <span class="link-wizard-panel-meta">请选择 1 颗中继卫星</span>
        </div>
        <div class="link-wizard-filters">
          <el-input v-model="relayKeyword" size="small" clearable placeholder="搜索中继卫星" class="link-filter-item" />
        </div>
        <div v-loading="relayLoading" class="link-shuttle">
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>候选中继星</span>
              <span class="link-shuttle-pane-meta">{{ relayLeftRows.length }} 项</span>
            </div>
            <el-table ref="relayLeftTableRef" :data="relayLeftRows" size="small" height="100%" row-key="id"
              class="link-table link-table--single" empty-text="暂无中继卫星" @selection-change="onRelayLeftChange">
              <el-table-column type="selection" width="42" />
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>
          <div class="link-shuttle-actions">
            <el-button class="task-edit-btn task-edit-btn--primary" type="primary" size="small" :disabled="!relayPickId"
              @click="addRelay">
              加入选中 →
            </el-button>
            <el-button class="task-edit-btn task-edit-btn--ghost" size="small" :disabled="!relayId"
              @click="removeRelay">
              ← 移除选中
            </el-button>
          </div>
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>已选中继星</span>
              <span class="link-shuttle-pane-meta">{{ relayId ? '1 颗' : '未选' }}</span>
            </div>
            <el-table :data="relayRightRows" size="small" height="100%" row-key="id" class="link-table"
              empty-text="从左侧加入 1 颗中继星">
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>
        </div>
      </div>

      <!-- 步骤：选择地面站 -->
      <div v-else-if="currentStepKey === 'station'" class="link-wizard-content">
        <div class="link-wizard-panel-head">
          <h4 class="link-wizard-panel-title">第 {{ currentWizardIndex + 1 }} 步 · 选择地面站</h4>
          <span class="link-wizard-panel-meta">请选择 1 个地面站</span>
        </div>
        <div class="link-wizard-filters">
          <el-input v-model="stationKeyword" size="small" clearable placeholder="搜索地面站" class="link-filter-item" />
        </div>
        <div v-loading="stationLoading" class="link-shuttle">
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>候选地面站</span>
              <span class="link-shuttle-pane-meta">{{ stationLeftRows.length }} 项</span>
            </div>
            <el-table ref="stationLeftTableRef" :data="stationLeftRows" size="small" height="100%" row-key="id"
              class="link-table link-table--single" empty-text="暂无地面站" @selection-change="onStationLeftChange">
              <el-table-column type="selection" width="42" />
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>
          <div class="link-shuttle-actions">
            <el-button class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
              :disabled="!stationPickId" @click="addStation">
              加入选中 →
            </el-button>
            <el-button class="task-edit-btn task-edit-btn--ghost" size="small" :disabled="!stationId"
              @click="removeStation">
              ← 移除选中
            </el-button>
          </div>
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>已选地面站</span>
              <span class="link-shuttle-pane-meta">{{ stationId ? '1 个' : '未选' }}</span>
            </div>
            <el-table :data="stationRightRows" size="small" height="100%" row-key="id" class="link-table"
              empty-text="从左侧加入 1 个地面站">
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>
        </div>
      </div>

      <!-- 步骤：选择数据中心 -->
      <div v-else-if="currentStepKey === 'center'" class="link-wizard-content">
        <div class="link-wizard-panel-head">
          <h4 class="link-wizard-panel-title">第 {{ currentWizardIndex + 1 }} 步 · 选择数据中心</h4>
          <span class="link-wizard-panel-meta">请选择 1 个数据中心，然后批量装配</span>
        </div>
        <p v-if="pathPreview" class="link-path-preview">{{ pathPreview }}</p>
        <div class="link-wizard-filters">
          <el-input v-model="centerKeyword" size="small" clearable placeholder="搜索数据中心" class="link-filter-item" />
        </div>
        <div v-loading="centerLoading" class="link-shuttle">
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>候选数据中心</span>
              <span class="link-shuttle-pane-meta">{{ centerLeftRows.length }} 项</span>
            </div>
            <el-table ref="centerLeftTableRef" :data="centerLeftRows" size="small" height="100%" row-key="id"
              class="link-table link-table--single" empty-text="暂无数据中心" @selection-change="onCenterLeftChange">
              <el-table-column type="selection" width="42" />
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>
          <div class="link-shuttle-actions">
            <el-button class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
              :disabled="!centerPickId" @click="addCenter">
              加入选中 →
            </el-button>
            <el-button class="task-edit-btn task-edit-btn--ghost" size="small" :disabled="!centerId"
              @click="removeCenter">
              ← 移除选中
            </el-button>
          </div>
          <section class="link-shuttle-pane">
            <div class="link-shuttle-pane-head">
              <span>已选数据中心</span>
              <span class="link-shuttle-pane-meta">{{ centerId ? '1 个' : '未选' }}</span>
            </div>
            <el-table :data="centerRightRows" size="small" height="100%" row-key="id" class="link-table"
              empty-text="从左侧加入 1 个数据中心">
              <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
            </el-table>
          </section>
        </div>
      </div>

      <!-- 最后一步：已装配链路 -->
      <div v-else-if="currentStepKey === 'result'" class="link-wizard-content">
        <div class="link-wizard-panel-head">
          <h4 class="link-wizard-panel-title">已装配链路</h4>
          <span class="link-wizard-panel-meta">共 {{ assembledLinks.length }} 条</span>
        </div>
        <div class="link-wizard-table-wrap">
          <el-table :data="assembledLinks" size="small" height="100%" row-key="id" class="link-table"
            empty-text="暂无已装配链路，请返回前面步骤完成配置">
            <el-table-column prop="modeText" label="拓扑" width="72" />
            <el-table-column prop="pathText" label="链路路径" min-width="280" show-overflow-tooltip />
            <el-table-column prop="satSeries" label="系列" width="96" show-overflow-tooltip />
            <el-table-column prop="satType" label="类型" width="80" />
            <el-table-column prop="batchSize" label="批次规模" width="88" />
            <el-table-column label="操作" width="132" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="removeLink(row.id)">移除</el-button>
                <el-button link type="danger" size="small" @click="removeBatch(row.batchId)">删整批</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div class="link-wizard-footer">
        <el-button v-if="canGoPrev" class="task-edit-btn task-edit-btn--ghost" size="small" @click="goPrevStep">
          上一步
        </el-button>
        <div class="link-wizard-footer-spacer" />
        <el-button v-if="showNextButton" class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
          @click="goNextStep">
          下一步
        </el-button>
        <el-button v-if="showAssembleButton" class="task-edit-btn task-edit-btn--primary" type="primary" size="small"
          @click="assembleAndGoResult">
          批量装配本批
        </el-button>
        <el-button v-if="currentStepKey === 'result'" class="task-edit-btn task-edit-btn--primary" type="primary"
          size="small" @click="startNewBatch">
          继续配置新批次
        </el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * 任务弹窗中的链路装配页（向导式）。
 * 每步全宽展示穿梭框，完成当前步后点「下一步」；最后一步展示已装配链路。
 */
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { TableInstance } from 'element-plus'
import {
  getBattleSateTypes,
  getSatelliteConstellations,
  getSatelliteList,
  type SatelliteConstellation,
} from '@/api/dashboard'
import { getGroundStationList, type BaseStationInfo } from '@/api/system/satellite-system-api'
import { getOrbitType } from '@/utils/tools/satellite'

/** 链路拓扑。 */
type LinkAssembleMode = 'direct' | 'relay'

/** 向导步骤 key。 */
type WizardStepKey = 'sat' | 'relay' | 'station' | 'center' | 'result'

/** 向导步骤定义。 */
interface WizardStepDef {
  key: WizardStepKey
  title: string
  description: string
}

/** 卫星候选项。 */
interface LinkSatCandidate {
  id: string
  name: string
  norad: string
  series: string
  satType: string
  orbit: string
}

/** 节点候选项。 */
interface LinkNodeCandidate {
  id: string
  name: string
}

/** 已装配链路行。 */
interface AssembledLinkRow {
  id: string
  batchId: string
  batchSize: number
  mode: LinkAssembleMode
  modeText: string
  pathText: string
  satSeries: string
  satType: string
}

const props = defineProps<{
  resetKey: number
}>()

const linkTypeOptions: { value: LinkAssembleMode; label: string; path: string }[] = [
  { value: 'direct', label: '直达链路', path: '卫星 → 地面站 → 数据中心' },
  { value: 'relay', label: '中继链路', path: '卫星 → 中继卫星 → 地面站 → 数据中心' },
]

const linkMode = ref<LinkAssembleMode>('direct')
/** 当前向导步骤索引。 */
const currentWizardIndex = ref(0)

const satKeyword = ref('')
const seriesFilter = ref('')
const typeFilter = ref('')
const relayKeyword = ref('')
const stationKeyword = ref('')
const centerKeyword = ref('')

const satLeftTableRef = ref<TableInstance>()
const satRightTableRef = ref<TableInstance>()
const relayLeftTableRef = ref<TableInstance>()
const stationLeftTableRef = ref<TableInstance>()
const centerLeftTableRef = ref<TableInstance>()
const satLeftPicks = ref<LinkSatCandidate[]>([])
const satRightPicks = ref<LinkSatCandidate[]>([])
const relayPickId = ref('')
const stationPickId = ref('')
const centerPickId = ref('')
/** 单选勾选同步中，避免 selection-change 递归。 */
const syncingSingleSelection = ref(false)

const selectedSatIds = ref<string[]>([])
const selectedRelayIds = ref<string[]>([])
const selectedStationIds = ref<string[]>([])
const selectedCenterIds = ref<string[]>([])

const satSelectedMap = reactive<Record<string, LinkSatCandidate>>({})
const assembledLinks = ref<AssembledLinkRow[]>([])

const satLoading = ref(false)
const relayLoading = ref(false)
const stationLoading = ref(false)
const centerLoading = ref(false)

const satTypes = ref<string[]>([])
const constellationOptions = ref<{ label: string; value: string }[]>([])
const constellations = ref<SatelliteConstellation[]>([])
const constellationNoradMap = ref<Map<number, string>>(new Map())

const satPage = reactive({ pageNum: 1, pageSize: 20 })
const satTotalElements = ref(0)

const satelliteCandidates = ref<LinkSatCandidate[]>([])
const relayCandidates = ref<LinkNodeCandidate[]>([])
const stationCandidates = ref<LinkNodeCandidate[]>([])
const centerCandidates = ref<LinkNodeCandidate[]>([])

/** 当前拓扑下的步骤 key 序列。 */
const wizardStepKeys = computed<WizardStepKey[]>(() => {
  if (linkMode.value === 'relay') {
    return ['sat', 'relay', 'station', 'center', 'result']
  }
  return ['sat', 'station', 'center', 'result']
})

/** 当前步骤 key。 */
const currentStepKey = computed(() => wizardStepKeys.value[currentWizardIndex.value] || 'sat')

const satSelection = computed(() =>
  selectedSatIds.value.map((id) => satSelectedMap[id]).filter(Boolean) as LinkSatCandidate[]
)

const relayId = computed(() => selectedRelayIds.value[0] || '')
const stationId = computed(() => selectedStationIds.value[0] || '')
const centerId = computed(() => selectedCenterIds.value[0] || '')

const satLeftRows = computed(() => {
  const selected = new Set(selectedSatIds.value)
  return satelliteCandidates.value.filter((item) => !selected.has(item.id))
})

const filterNodes = (list: LinkNodeCandidate[], keyword: string, selectedId: string) => {
  const key = keyword.trim().toLowerCase()
  return list.filter((item) => {
    if (selectedId && item.id === selectedId) return false
    if (!key) return true
    return item.name.toLowerCase().includes(key)
  })
}

const relayLeftRows = computed(() => filterNodes(relayCandidates.value, relayKeyword.value, relayId.value))
const stationLeftRows = computed(() => filterNodes(stationCandidates.value, stationKeyword.value, stationId.value))
const centerLeftRows = computed(() => filterNodes(centerCandidates.value, centerKeyword.value, centerId.value))

const relayRightRows = computed(() => relayCandidates.value.filter((item) => item.id === relayId.value))
const stationRightRows = computed(() => stationCandidates.value.filter((item) => item.id === stationId.value))
const centerRightRows = computed(() => centerCandidates.value.filter((item) => item.id === centerId.value))

/** 步骤条展示项（含动态描述）。 */
const wizardStepDefs = computed<WizardStepDef[]>(() => {
  const descMap: Record<WizardStepKey, string> = {
    sat: selectedSatIds.value.length ? `已选 ${selectedSatIds.value.length} 颗` : '待选择',
    relay: relayId.value ? findNodeName(relayCandidates.value, relayId.value) : '待选择',
    station: stationId.value ? findNodeName(stationCandidates.value, stationId.value) : '待选择',
    center: centerId.value ? findNodeName(centerCandidates.value, centerId.value) : '待选择',
    result: `共 ${assembledLinks.value.length} 条`,
  }
  const titleMap: Record<WizardStepKey, string> = {
    sat: '选择卫星',
    relay: '中继卫星',
    station: '地面站',
    center: '数据中心',
    result: '装配结果',
  }
  return wizardStepKeys.value.map((key) => ({
    key,
    title: titleMap[key],
    description: descMap[key],
  }))
})

const pathPreview = computed(() => {
  if (!stationId.value && !centerId.value && !relayId.value) return ''
  const relayName = findNodeName(relayCandidates.value, relayId.value)
  const stationName = findNodeName(stationCandidates.value, stationId.value)
  const centerName = findNodeName(centerCandidates.value, centerId.value)
  const sampleSat = satSelection.value[0]?.name || '卫星'
  const nodes =
    linkMode.value === 'relay'
      ? [sampleSat, relayName, stationName, centerName]
      : [sampleSat, stationName, centerName]
  const path = nodes.filter(Boolean).join(' → ')
  if (!path) return ''
  const suffix = selectedSatIds.value.length > 1 ? `（本批 ${selectedSatIds.value.length} 颗）` : ''
  return `预览：${path}${suffix}`
})

/** 是否显示「上一步」。 */
const canGoPrev = computed(() => currentWizardIndex.value > 0 && currentStepKey.value !== 'result')

/** 是否显示「下一步」（非最后选择步、非结果步）。 */
const showNextButton = computed(() => {
  const key = currentStepKey.value
  return key !== 'result' && key !== 'center'
})

/** 数据中心步显示「批量装配」。 */
const showAssembleButton = computed(() => currentStepKey.value === 'center')

const toOptionalString = (value: string) => {
  const trimmed = value.trim()
  return trimmed || undefined
}

const toOptionalNorad = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const norad = Number(trimmed)
  return Number.isFinite(norad) && norad > 0 ? norad : undefined
}

const resolveSatelliteNameParam = () => {
  const key = satKeyword.value.trim()
  if (key && !/^\d+$/.test(key)) return key
  if (seriesFilter.value) return seriesFilter.value
  return undefined
}

const isDataCenterType = (type: string) => {
  const value = type || ''
  return value.includes('中心') || value.includes('数据') || value.includes('云')
}

const satelliteToCandidate = (satellite: Satellite): LinkSatCandidate => ({
  id: String(satellite.norad),
  name: satellite.name_en || satellite.name_cn || String(satellite.norad),
  norad: String(satellite.norad),
  series: constellationNoradMap.value.get(satellite.norad) || '--',
  satType: satellite.sat_type || '--',
  orbit: getOrbitType(Number(satellite.orbit_type)),
})

const stationToNode = (station: BaseStationInfo): LinkNodeCandidate => ({
  id: station._id || station.name,
  name: station.name,
})

const findNodeName = (list: LinkNodeCandidate[], id: string) =>
  list.find((item) => item.id === id)?.name || ''

/**
 * 校验当前步骤是否可进入下一步。
 */
const validateCurrentStep = (): boolean => {
  const key = currentStepKey.value
  if (key === 'sat' && !selectedSatIds.value.length) {
    ElMessage.warning('请至少选择一颗卫星')
    return false
  }
  if (key === 'relay' && !relayId.value) {
    ElMessage.warning('请选择一颗中继卫星')
    return false
  }
  if (key === 'station' && !stationId.value) {
    ElMessage.warning('请选择一个地面站')
    return false
  }
  if (key === 'center' && !centerId.value) {
    ElMessage.warning('请选择一个数据中心')
    return false
  }
  return true
}

/** 进入下一步。 */
const goNextStep = () => {
  if (!validateCurrentStep()) return
  if (currentWizardIndex.value < wizardStepKeys.value.length - 1) {
    currentWizardIndex.value += 1
  }
}

/** 返回上一步。 */
const goPrevStep = () => {
  if (currentWizardIndex.value > 0) {
    currentWizardIndex.value -= 1
  }
}

const loadSatTypes = async () => {
  try {
    const res = await getBattleSateTypes()
    satTypes.value = res.code === 200 ? (res.data ?? []) : []
  } catch {
    satTypes.value = []
  }
}

const loadConstellations = async () => {
  try {
    const res = await getSatelliteConstellations()
    const list = res.code === 200 ? (res.data ?? []) : []
    constellations.value = list
    constellationOptions.value = list.map((item) => ({
      label: item.chineseName || item.englishName || item.name,
      value: item.englishName || item.name,
    }))
    const noradMap = new Map<number, string>()
    list.forEach((item) => {
      const label = item.chineseName || item.englishName || item.name
      item.noradIds?.forEach((norad) => noradMap.set(norad, label))
    })
    constellationNoradMap.value = noradMap
  } catch {
    constellations.value = []
    constellationOptions.value = []
    constellationNoradMap.value = new Map()
  }
}

const loadSatelliteCandidates = async () => {
  satLoading.value = true
  try {
    const res = await getSatelliteList(
      satPage.pageNum,
      satPage.pageSize,
      toOptionalNorad(satKeyword.value),
      undefined,
      resolveSatelliteNameParam(),
      undefined,
      undefined,
      undefined,
      undefined,
      toOptionalString(typeFilter.value)
    )
    let list = res.code === 200 ? (res.data?.content ?? []) : []
    if (seriesFilter.value && !toOptionalNorad(satKeyword.value)) {
      const selected = constellations.value.find((item) => (item.englishName || item.name) === seriesFilter.value)
      if (selected?.noradIds?.length) {
        const noradSet = new Set(selected.noradIds)
        list = list.filter((item) => noradSet.has(item.norad))
      }
    }
    satelliteCandidates.value = list.map(satelliteToCandidate)
    satTotalElements.value = res.code === 200 ? (res.data?.totalElements ?? 0) : 0
  } finally {
    satLoading.value = false
  }
}

const loadRelayCandidates = async () => {
  relayLoading.value = true
  try {
    const res = await getSatelliteList(1, 200, undefined, undefined, undefined, undefined, undefined, undefined, undefined, '中继')
    const list = res.code === 200 ? (res.data?.content ?? []) : []
    relayCandidates.value = list.map((item) => ({
      id: String(item.norad),
      name: item.name_en || item.name_cn || String(item.norad),
    }))
  } finally {
    relayLoading.value = false
  }
}

const loadStationAndCenterCandidates = async () => {
  stationLoading.value = true
  centerLoading.value = true
  try {
    const res = await getGroundStationList({ type: '', name: '', country: '' })
    const list = res.code === 200 ? (res.data ?? []) : []
    stationCandidates.value = list.filter((item) => !isDataCenterType(item.type)).map(stationToNode)
    centerCandidates.value = list.filter((item) => isDataCenterType(item.type)).map(stationToNode)
  } finally {
    stationLoading.value = false
    centerLoading.value = false
  }
}

const handleSatelliteSearch = () => {
  satPage.pageNum = 1
  loadSatelliteCandidates()
}

const handleSatPageSizeChange = () => {
  satPage.pageNum = 1
  loadSatelliteCandidates()
}

const onSatLeftChange = (rows: LinkSatCandidate[]) => {
  satLeftPicks.value = rows
}

const onSatRightChange = (rows: LinkSatCandidate[]) => {
  satRightPicks.value = rows
}

const addSats = () => {
  satLeftPicks.value.forEach((row) => {
    satSelectedMap[row.id] = row
    if (!selectedSatIds.value.includes(row.id)) {
      selectedSatIds.value.push(row.id)
    }
  })
  satLeftPicks.value = []
  satLeftTableRef.value?.clearSelection()
}

const removeSats = () => {
  const removeIds = new Set(satRightPicks.value.map((row) => row.id))
  selectedSatIds.value = selectedSatIds.value.filter((id) => !removeIds.has(id))
  removeIds.forEach((id) => delete satSelectedMap[id])
  satRightPicks.value = []
  satRightTableRef.value?.clearSelection()
}

/**
 * 将表格勾选限制为单选：只保留最后勾中的一行。
 * @param tableRef 表格实例
 * @param rows 当前勾选行
 * @param pickId 写入的选中 ID
 */
const keepSingleSelection = (
  tableRef: TableInstance | undefined,
  rows: LinkNodeCandidate[],
  pickId: { value: string }
) => {
  if (syncingSingleSelection.value) return
  if (rows.length <= 1) {
    pickId.value = rows[0]?.id || ''
    return
  }
  const last = rows[rows.length - 1]
  pickId.value = last.id
  syncingSingleSelection.value = true
  nextTick(() => {
    tableRef?.clearSelection()
    tableRef?.toggleRowSelection(last, true)
    syncingSingleSelection.value = false
  })
}

const onRelayLeftChange = (rows: LinkNodeCandidate[]) => {
  keepSingleSelection(relayLeftTableRef.value, rows, relayPickId)
}

const addRelay = () => {
  if (relayPickId.value) selectedRelayIds.value = [relayPickId.value]
}

const removeRelay = () => {
  selectedRelayIds.value = []
  relayPickId.value = ''
}

const onStationLeftChange = (rows: LinkNodeCandidate[]) => {
  keepSingleSelection(stationLeftTableRef.value, rows, stationPickId)
}

const addStation = () => {
  if (stationPickId.value) selectedStationIds.value = [stationPickId.value]
}

const removeStation = () => {
  selectedStationIds.value = []
  stationPickId.value = ''
}

const onCenterLeftChange = (rows: LinkNodeCandidate[]) => {
  keepSingleSelection(centerLeftTableRef.value, rows, centerPickId)
}

const addCenter = () => {
  if (centerPickId.value) selectedCenterIds.value = [centerPickId.value]
}

const removeCenter = () => {
  selectedCenterIds.value = []
  centerPickId.value = ''
}

const clearBatchSelection = () => {
  selectedSatIds.value = []
  selectedRelayIds.value = []
  selectedStationIds.value = []
  selectedCenterIds.value = []
  satLeftPicks.value = []
  satRightPicks.value = []
  relayPickId.value = ''
  stationPickId.value = ''
  centerPickId.value = ''
  Object.keys(satSelectedMap).forEach((id) => delete satSelectedMap[id])
}

const switchLinkMode = (mode: LinkAssembleMode) => {
  linkMode.value = mode
  currentWizardIndex.value = 0
  relayKeyword.value = ''
  stationKeyword.value = ''
  centerKeyword.value = ''
  clearBatchSelection()
}

/** 批量装配并跳转到结果步。 */
const assembleAndGoResult = () => {
  if (!validateCurrentStep()) return
  if (!selectedSatIds.value.length || !stationId.value || !centerId.value) {
    ElMessage.warning('请完成前面各步的选择')
    return
  }
  if (linkMode.value === 'relay' && !relayId.value) {
    ElMessage.warning('请选择中继卫星')
    return
  }

  const relayName = linkMode.value === 'relay' ? findNodeName(relayCandidates.value, relayId.value) : ''
  const stationName = findNodeName(stationCandidates.value, stationId.value)
  const centerName = findNodeName(centerCandidates.value, centerId.value)
  const batchId = `batch-${Date.now()}`
  const batchSize = satSelection.value.length
  const modeText = linkMode.value === 'relay' ? '中继' : '直达'

  const nextRows = satSelection.value.map((sat, index) => {
    const nodes =
      linkMode.value === 'relay'
        ? [sat.name, relayName, stationName, centerName]
        : [sat.name, stationName, centerName]
    return {
      id: `${batchId}-${sat.id || index}`,
      batchId,
      batchSize,
      mode: linkMode.value,
      modeText,
      pathText: nodes.filter(Boolean).join(' → '),
      satSeries: sat.series || '--',
      satType: sat.satType || '--',
    } satisfies AssembledLinkRow
  })

  assembledLinks.value = [...assembledLinks.value, ...nextRows]
  clearBatchSelection()
  currentWizardIndex.value = wizardStepKeys.value.length - 1
  ElMessage.success(`已为本批 ${batchSize} 颗卫星装配${modeText}链路`)
}

/** 从结果步回到第一步，开始新一批配置。 */
const startNewBatch = () => {
  clearBatchSelection()
  currentWizardIndex.value = 0
}

const removeLink = (id: string) => {
  assembledLinks.value = assembledLinks.value.filter((row) => row.id !== id)
}

const removeBatch = (batchId: string) => {
  assembledLinks.value = assembledLinks.value.filter((row) => row.batchId !== batchId)
}

const initPageData = async () => {
  await Promise.all([
    loadSatTypes(),
    loadConstellations(),
    loadSatelliteCandidates(),
    loadStationAndCenterCandidates(),
    loadRelayCandidates(),
  ])
}

watch(
  () => props.resetKey,
  () => {
    linkMode.value = 'direct'
    currentWizardIndex.value = 0
    satKeyword.value = ''
    seriesFilter.value = ''
    typeFilter.value = ''
    satPage.pageNum = 1
    relayKeyword.value = ''
    stationKeyword.value = ''
    centerKeyword.value = ''
    clearBatchSelection()
    assembledLinks.value = []
    initPageData()
  }
)

onMounted(() => {
  initPageData()
})
</script>

<style lang="scss" scoped>
.task-link-assemble {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding-bottom: 8px;
}

.link-head {
  flex-shrink: 0;
}

.link-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: #40f2ff;
}

.link-desc {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.link-type-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  flex-shrink: 0;
}

.link-type-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 8px;
  background: rgba(8, 20, 36, 0.55);
  color: #94a3b8;
  cursor: pointer;
  text-align: left;
  transition: all 0.18s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.4);
    color: #e2efff;
  }

  &.is-active {
    border-color: rgba(0, 225, 255, 0.55);
    background: rgba(0, 225, 255, 0.12);
    box-shadow: inset 3px 0 0 #00e1ff;
    color: #e0faff;
  }
}

.link-type-name {
  font-size: 13px;
  font-weight: 700;
}

.link-type-path {
  font-size: 11px;
  color: #7dd3fc;
}

.link-steps {
  flex-shrink: 0;
  padding: 8px 16px 12px;
  background: rgba(8, 20, 36, 0.45);
  border: 1px solid rgba(0, 225, 255, 0.12);
  border-radius: 8px;

  :deep(.atlas-app-step__title) {
    font-size: 12px;
    color: #94a3b8;
  }

  :deep(.atlas-app-step__title.is-process),
  :deep(.atlas-app-step__title.is-finish) {
    color: #40f2ff;
  }

  :deep(.atlas-app-step__description) {
    font-size: 11px;
    color: #64748b;
  }

  :deep(.atlas-app-step__head.is-process .atlas-app-step__icon),
  :deep(.atlas-app-step__head.is-finish .atlas-app-step__icon) {
    border-color: #00e1ff;
    color: #00e1ff;
  }

  :deep(.atlas-app-step__line) {
    background-color: rgba(0, 225, 255, 0.2);
  }
}

.link-wizard-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(0, 225, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 20, 36, 0.55);
  overflow: hidden;
}

.link-wizard-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 12px 16px 0;
  overflow: hidden;
}

.link-wizard-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.link-wizard-panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #40f2ff;
}

.link-wizard-panel-meta {
  font-size: 12px;
  color: #64748b;
}

.link-wizard-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 10px;
}

.link-filter-item {
  width: 160px !important;
  flex: 0 0 160px;

  :deep(.atlas-app-input__wrapper),
  :deep(.atlas-app-select__wrapper) {
    width: 160px !important;
  }
}

.link-shuttle {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 118px minmax(0, 1fr);
  gap: 10px;
  flex: 1;
  min-height: 0;
  align-items: stretch;
}

.link-shuttle-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(0, 225, 255, 0.16);
  border-radius: 8px;
  background: rgba(8, 20, 36, 0.55);
  overflow: hidden;
}

.link-shuttle-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  color: #7dd3fc;
  border-bottom: 1px solid rgba(0, 225, 255, 0.12);
  flex-shrink: 0;
}

.link-shuttle-pane-meta {
  font-weight: 400;
  color: #64748b;
}

.link-shuttle-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding-top: 28px;

  :deep(.atlas-app-button) {
    width: 100%;
    margin: 0;
    padding-left: 6px;
    padding-right: 6px;
  }
}

.link-wizard-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.link-path-preview {
  margin: 0 0 8px;
  font-size: 12px;
  color: #7dd3fc;
  flex-shrink: 0;
}

.link-pager {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 6px 8px 8px;
  border-top: 1px solid rgba(0, 225, 255, 0.1);

  :deep(.atlas-app-pagination__total),
  :deep(.atlas-app-pagination button),
  :deep(.atlas-app-pager li) {
    color: #94a3b8;
    background: transparent;
  }

  :deep(.atlas-app-pager li.is-active) {
    color: #40f2ff;
  }
}

.link-wizard-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-top: 1px solid rgba(0, 225, 255, 0.14);
  background: rgba(8, 15, 26, 0.88);
  flex-shrink: 0;
}

.link-wizard-footer-spacer {
  flex: 1;
}

.link-table {
  height: 100%;
  width: 100%;
  --atlas-app-table-border-color: rgba(0, 225, 255, 0.12);
  --atlas-app-table-header-bg-color: rgba(13, 27, 49, 0.95);
  --atlas-app-table-bg-color: transparent;
  --atlas-app-table-tr-bg-color: transparent;
  --atlas-app-table-row-hover-bg-color: rgba(0, 225, 255, 0.1);
  --atlas-app-text-color-regular: #cbd5e1;
  background: transparent;

  :deep(.atlas-app-table__inner-wrapper::before) {
    display: none;
  }

  :deep(.atlas-app-table),
  :deep(.atlas-app-table__inner-wrapper) {
    height: 100%;
  }

  :deep(th.atlas-app-table__cell) {
    color: #00e1ff;
    font-size: 12px;
    font-weight: 700;
    background: rgba(13, 27, 49, 0.95) !important;
  }

  :deep(td.atlas-app-table__cell) {
    font-size: 12px;
    color: #cbd5e1;
    background: transparent !important;
  }

  :deep(.atlas-app-table__empty-block) {
    background: transparent;
    color: #64748b;
  }
}

.link-table--single {
  :deep(th.atlas-app-table-column--selection .atlas-app-checkbox) {
    display: none;
  }
}
</style>
