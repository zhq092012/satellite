/**
 * 打击方案状态管理
 * 负责历史方案的选择/过滤/对比，以及杀伤链方案的加载和转换
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deleteStrikePlanByName,
  getKillChainStrikePlanList,
  type KillChainPlanListResp,
  type RespKillChainPlanHigh,
  type RespKillChainPlanLow,
  type RespKillChainPlanMiddle,
  type StrikePlanV2Extended,
  type StrikePlanV2MissionWindowItem,
  type StrikePlanV2PlanDetail,
} from '@/api/strikePlan/satellite-strikeplan-api'
import { useLayoutStore } from '@/store/modules/layout'
import type { HistoricalPlanCard } from '@/types/strike'
import { buildHistoricalPlanFromKillChainPlan } from '@/utils/tools/killChainAdapter'

export function useStrikePlan(
  historicalPlans: { value: StrikePlanV2Extended[] },
  preloadHistoricalPlans: (taskId?: number, forceReload?: boolean) => Promise<void>
) {
  const store = useLayoutStore()

  // ─── 方案选择状态 ───
  const historicalPlanDialogVisible = ref(false)
  const historicalPlanDialogMode = ref<'single' | 'compare'>('single')
  const selectedHistoricalPlan = ref<StrikePlanV2Extended | null>(null)
  const selectedHistoricalPlanMode = ref<'threat_first' | 'max_targets'>('threat_first')
  const selectedHistoricalPlanDetail = ref<StrikePlanV2PlanDetail | null>(null)
  const loadedKillChainPlan = ref<RespKillChainPlanLow | RespKillChainPlanMiddle | RespKillChainPlanHigh | null>(null)

  // ─── 过滤状态 ───
  const historicalPlanNameQuery = ref('')
  const historicalPlanIntensityFilter = ref<'all' | 'high' | 'medium' | 'low'>('all')
  const historicalPlanSatelliteTypeFilter = ref('')
  const historicalPlanModeFilter = ref<'all' | 'threat_first' | 'max_targets'>('all')
  const selectedHistoricalPlanKeys = ref<string[]>([])

  // ─── 杀伤链状态 ───
  const killChainDialogVisible = ref(false)
  const strikeIntensity = ['低烈度', '中烈度', '高烈度'] as const
  const activeStrikeIntensity = ref<(typeof strikeIntensity)[number] | null>('低烈度')
  const lowKillChainPlans = ref<RespKillChainPlanLow[]>([])
  const middleKillChainPlans = ref<RespKillChainPlanMiddle[]>([])
  const highKillChainPlans = ref<RespKillChainPlanHigh[]>([])
  const allKillChainPlans = ref<KillChainPlanListResp[]>([])

  // ─── 判断当前方案是否为低/中烈度（影响渲染模式） ───
  const isCurrentPlanLowOrMid = computed(() => {
    const intensity = loadedKillChainPlan.value?.intensityLevel
    return intensity === '低烈度' || intensity === '中烈度'
  })

  // ─── 判断当前方案是否为2D模式（低烈度保持二维） ───
  const isCurrentPlan2D = computed(() => {
    const intensity = loadedKillChainPlan.value?.intensityLevel
    return intensity === '低烈度'
  })

  // ─── 方案详情提取 ───

  const getHistoricalPlanLevelDetail = (
    plan?: StrikePlanV2Extended | null,
    mode: 'threat_first' | 'max_targets' = selectedHistoricalPlanMode.value
  ): StrikePlanV2PlanDetail | null => {
    if (!plan?.plans) return null
    const levelPlans = plan.plans[plan.intensityLevel as keyof typeof plan.plans] ?? Object.values(plan.plans)[0]
    if (!levelPlans) return null
    return levelPlans[mode] ?? levelPlans.threat_first ?? levelPlans.max_targets ?? null
  }

  const getHistoricalPlanMissionWindows = (plan?: StrikePlanV2Extended | null): StrikePlanV2MissionWindowItem[] =>
    getHistoricalPlanLevelDetail(plan)?.plan_summary.mission_windows ?? []

  const getHistoricalPlanModeLabel = (mode: 'threat_first' | 'max_targets'): string =>
    mode === 'threat_first' ? '威胁优先' : '数量优先'

  const syncSelectedHistoricalPlanDetail = () => {
    selectedHistoricalPlanDetail.value = getHistoricalPlanLevelDetail(
      selectedHistoricalPlan.value,
      selectedHistoricalPlanMode.value
    )
  }

  // ─── 烈度标准化/格式化 ───

  const normalizeHistoricalPlanIntensity = (value?: string): string => {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
    if (!normalized) return ''
    if (normalized.includes('high') || normalized.includes('hight') || normalized.includes('高')) return 'high'
    if (normalized.includes('medium') || normalized.includes('mid') || normalized.includes('中')) return 'medium'
    if (normalized.includes('low') || normalized.includes('低')) return 'low'
    return normalized
  }

  const formatHistoricalPlanIntensity = (value?: string): string => {
    const normalized = normalizeHistoricalPlanIntensity(value)
    if (normalized === 'high') return '高'
    if (normalized === 'medium') return '中'
    if (normalized === 'low') return '低'
    return value || '--'
  }

  // ─── 卫星类型选项 ───
  const historicalPlanSatelliteTypeOptions = computed(() =>
    Array.from(new Set(historicalPlans.value.flatMap((plan) => plan.types ?? []).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, 'zh-Hans-CN')
    )
  )

  // ─── 方案卡片计算 ───

  const allHistoricalPlanCards = computed<HistoricalPlanCard[]>(() =>
    historicalPlans.value.flatMap((plan) => {
      const modes: Array<'threat_first' | 'max_targets'> = ['threat_first', 'max_targets']
      return modes
        .map((mode) => {
          const detail = getHistoricalPlanLevelDetail(plan, mode)
          if (!detail) return null
          return {
            key: `${plan.taskId}-${plan.name}-${plan.version}-${mode}`,
            plan,
            mode,
            detail,
          }
        })
        .filter((item): item is HistoricalPlanCard => Boolean(item))
    })
  )

  const selectedComparePlanCards = computed<HistoricalPlanCard[]>(() => {
    const cardMap = new Map(allHistoricalPlanCards.value.map((card) => [card.key, card]))
    return selectedHistoricalPlanKeys.value
      .map((key) => cardMap.get(key) ?? null)
      .filter((card): card is HistoricalPlanCard => Boolean(card))
      .slice(0, 4)
  })

  const isCompareSelectionMode = computed(() => historicalPlanDialogMode.value === 'compare')

  const filteredHistoricalPlanCards = computed<HistoricalPlanCard[]>(() => {
    const keyword = historicalPlanNameQuery.value.trim().toLowerCase()
    const intensityFilter = historicalPlanIntensityFilter.value
    const satelliteTypeFilter = historicalPlanSatelliteTypeFilter.value
    const modeFilter = historicalPlanModeFilter.value

    return allHistoricalPlanCards.value.filter((card) => {
      const { plan, mode } = card
      const matchesKeyword = !keyword || plan.name?.toLowerCase().includes(keyword)
      const matchesIntensity =
        !intensityFilter ||
        intensityFilter === 'all' ||
        normalizeHistoricalPlanIntensity(plan.intensityLevel) === intensityFilter
      const matchesSatelliteType = !satelliteTypeFilter || (plan.types ?? []).includes(satelliteTypeFilter)
      const matchesMode = modeFilter === 'all' || mode === modeFilter
      return matchesKeyword && matchesIntensity && matchesSatelliteType && matchesMode
    })
  })

  // ─── 打击窗口派生 ───

  const selectedPlanMissionWindows = computed<StrikePlanV2MissionWindowItem[]>(() =>
    getHistoricalPlanMissionWindows(selectedHistoricalPlan.value)
  )

  const selectedPlanInputCount = computed(
    () => selectedHistoricalPlanDetail.value?.plan_summary.overview.input_count ?? 0
  )

  const selectedHistoricalPlanWeaponIds = computed(
    () => new Set(selectedPlanMissionWindows.value.map((item) => item.weapon_id))
  )

  // ─── 方案标签 ───

  const selectedHistoricalPlanLabel = computed(() => {
    if (!selectedHistoricalPlan.value) return '威胁优先'
    return `${selectedHistoricalPlan.value.name} · ${selectedHistoricalPlan.value.version} · ${selectedHistoricalPlanMode.value === 'threat_first' ? '威胁优先' : '数量优先'}`
  })

  // ─── 方案操作 ───

  const isHistoricalPlanChecked = (key: string) => selectedHistoricalPlanKeys.value.includes(key)

  const toggleHistoricalPlanSelection = (key: string) => {
    if (isHistoricalPlanChecked(key)) {
      selectedHistoricalPlanKeys.value = selectedHistoricalPlanKeys.value.filter((item) => item !== key)
      return
    }
    if (selectedHistoricalPlanKeys.value.length >= 4) {
      ElMessage.warning('最多只能选择 4 个打击方案进行对比')
      return
    }
    selectedHistoricalPlanKeys.value = [...selectedHistoricalPlanKeys.value, key]
  }

  const openHistoricalPlanDialog = (mode: 'single' | 'compare') => {
    historicalPlanDialogMode.value = mode
    selectedHistoricalPlanKeys.value = []
    historicalPlanDialogVisible.value = true
  }

  const deleteHistoricalPlan = async (planId: string) => {
    try {
      await ElMessageBox.confirm(`确定要删除方案 "${planId}" 吗？`, '删除方案', {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      })
      await deleteStrikePlanByName([planId])
      ElMessage.success(`方案 "${planId}" 已删除`)
      await preloadHistoricalPlans(store.activedTask?.id, true)
    } catch (error) {
      if (error !== 'cancel') {
        ElMessage.error(`删除方案失败: ${error}`)
      }
    }
  }

  // ─── 杀伤链方案 ───

  const loadAllKillChainPlan = async () => {
    if (allKillChainPlans.value.length > 0 || !store.activedTask?.id) return

    const res = await getKillChainStrikePlanList(store.activedTask?.id)
    if (res.code === 200 && res.data) {
      allKillChainPlans.value = res.data

      const groupedPlans = allKillChainPlans.value.reduce(
        (result, item) => {
          if (item.intensityLevel === '低烈度') {
            result.low.push(item as RespKillChainPlanLow)
          } else if (item.intensityLevel === '中烈度') {
            result.middle.push(item as RespKillChainPlanMiddle)
          } else if (item.intensityLevel === '高烈度') {
            result.high.push(item as RespKillChainPlanHigh)
          }
          return result
        },
        {
          low: [] as RespKillChainPlanLow[],
          middle: [] as RespKillChainPlanMiddle[],
          high: [] as RespKillChainPlanHigh[],
        }
      )

      lowKillChainPlans.value = groupedPlans.low
      middleKillChainPlans.value = groupedPlans.middle
      highKillChainPlans.value = groupedPlans.high
    }
  }

  const handleLoadKillChainPlan = (
    plan: RespKillChainPlanLow | RespKillChainPlanMiddle | RespKillChainPlanHigh,
    mode: 'threat_first' | 'max_targets' = 'threat_first',
    onPlanSelect: (plan: StrikePlanV2Extended, mode: 'threat_first' | 'max_targets') => void
  ) => {
    const mappedPlan = buildHistoricalPlanFromKillChainPlan(plan)
    if (!mappedPlan) return

    loadedKillChainPlan.value = plan
    onPlanSelect(mappedPlan, mode)
    killChainDialogVisible.value = false
  }

  return {
    // 方案选择状态
    historicalPlanDialogVisible,
    historicalPlanDialogMode,
    selectedHistoricalPlan,
    selectedHistoricalPlanMode,
    selectedHistoricalPlanDetail,
    loadedKillChainPlan,
    isCurrentPlanLowOrMid,
    isCurrentPlan2D,
    // 过滤状态
    historicalPlanNameQuery,
    historicalPlanIntensityFilter,
    historicalPlanSatelliteTypeFilter,
    historicalPlanModeFilter,
    selectedHistoricalPlanKeys,
    // 杀伤链
    killChainDialogVisible,
    strikeIntensity,
    activeStrikeIntensity,
    lowKillChainPlans,
    middleKillChainPlans,
    highKillChainPlans,
    allKillChainPlans,
    // 派生计算
    allHistoricalPlanCards,
    selectedComparePlanCards,
    isCompareSelectionMode,
    filteredHistoricalPlanCards,
    selectedPlanMissionWindows,
    selectedPlanInputCount,
    selectedHistoricalPlanWeaponIds,
    selectedHistoricalPlanLabel,
    historicalPlanSatelliteTypeOptions,
    // 方法
    getHistoricalPlanLevelDetail,
    getHistoricalPlanModeLabel,
    syncSelectedHistoricalPlanDetail,
    formatHistoricalPlanIntensity,
    isHistoricalPlanChecked,
    toggleHistoricalPlanSelection,
    openHistoricalPlanDialog,
    deleteHistoricalPlan,
    loadAllKillChainPlan,
    handleLoadKillChainPlan,
  }
}
