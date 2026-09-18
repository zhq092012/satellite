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

/**
 * 打击方案面板状态与操作集合。
 *
 * 方案数据由外部（页面）持有并预加载，本组合式函数只负责：
 * 1. 维护弹窗、筛选、对比勾选等 UI 状态；
 * 2. 从方案原始结构中派生卡片列表、任务窗口等展示数据；
 * 3. 拉取杀伤链方案并按烈度分组，转换为历史方案结构后交给调用方。
 *
 * @param historicalPlans 外部持有的历史方案列表引用（ref 或等价的 `{ value }` 容器）
 * @param preloadHistoricalPlans 重新拉取历史方案的回调，删除方案后用于刷新列表
 * @returns 方案状态、派生计算属性与操作方法
 */
export function useStrikePlan(
  historicalPlans: { value: StrikePlanV2Extended[] },
  preloadHistoricalPlans: (taskId?: number, forceReload?: boolean) => Promise<void>
) {
  /** 全局布局 Store（提供当前选中任务） */
  const store = useLayoutStore()

  // ─── 方案选择状态 ───

  /** 历史方案弹窗是否可见 */
  const historicalPlanDialogVisible = ref(false)
  /** 历史方案弹窗模式：single 单选加载，compare 多选对比 */
  const historicalPlanDialogMode = ref<'single' | 'compare'>('single')
  /** 当前选中的历史方案原始数据 */
  const selectedHistoricalPlan = ref<StrikePlanV2Extended | null>(null)
  /** 当前选中方案的排序模式：威胁优先 / 数量优先 */
  const selectedHistoricalPlanMode = ref<'threat_first' | 'max_targets'>('threat_first')
  /** 当前选中方案在所选烈度 + 模式下的详情 */
  const selectedHistoricalPlanDetail = ref<StrikePlanV2PlanDetail | null>(null)
  /** 已加载的杀伤链方案（决定地图渲染走 2D 还是 3D 模式） */
  const loadedKillChainPlan = ref<RespKillChainPlanLow | RespKillChainPlanMiddle | RespKillChainPlanHigh | null>(null)

  // ─── 过滤状态 ───

  /** 方案名称搜索关键词 */
  const historicalPlanNameQuery = ref('')
  /** 烈度筛选；all 表示不筛选 */
  const historicalPlanIntensityFilter = ref<'all' | 'high' | 'medium' | 'low'>('all')
  /** 卫星类型筛选；空串表示不筛选 */
  const historicalPlanSatelliteTypeFilter = ref('')
  /** 排序模式筛选；all 表示不筛选 */
  const historicalPlanModeFilter = ref<'all' | 'threat_first' | 'max_targets'>('all')
  /** 对比模式下已勾选的方案卡片 key 列表（最多 4 个） */
  const selectedHistoricalPlanKeys = ref<string[]>([])

  // ─── 杀伤链状态 ───

  /** 杀伤链方案弹窗是否可见 */
  const killChainDialogVisible = ref(false)
  /** 杀伤链烈度分档（用于渲染 Tab） */
  const strikeIntensity = ['低烈度', '中烈度', '高烈度'] as const
  /** 当前激活的杀伤链烈度 Tab */
  const activeStrikeIntensity = ref<(typeof strikeIntensity)[number] | null>('低烈度')
  /** 低烈度杀伤链方案列表 */
  const lowKillChainPlans = ref<RespKillChainPlanLow[]>([])
  /** 中烈度杀伤链方案列表 */
  const middleKillChainPlans = ref<RespKillChainPlanMiddle[]>([])
  /** 高烈度杀伤链方案列表 */
  const highKillChainPlans = ref<RespKillChainPlanHigh[]>([])
  /** 杀伤链方案原始列表（未按烈度分组，同时用作「是否已加载」标记） */
  const allKillChainPlans = ref<KillChainPlanListResp[]>([])

  /** 当前方案是否为低/中烈度（影响链路与图标的渲染方式） */
  const isCurrentPlanLowOrMid = computed(() => {
    const intensity = loadedKillChainPlan.value?.intensityLevel
    return intensity === '低烈度' || intensity === '中烈度'
  })

  /** 当前方案是否走 2D 模式（仅低烈度保持二维） */
  const isCurrentPlan2D = computed(() => {
    const intensity = loadedKillChainPlan.value?.intensityLevel
    return intensity === '低烈度'
  })

  // ─── 方案详情提取 ───

  /**
   * 取出方案在「自身烈度 + 指定模式」下的详情。
   *
   * 方案结构为 `plans[烈度][模式]`，实际数据中烈度键可能与 `intensityLevel` 不一致，
   * 因此按 烈度键 → 首个烈度 → 指定模式 → threat_first → max_targets 的顺序逐级兜底。
   *
   * @param plan 历史方案；为空时返回 null
   * @param mode 排序模式，默认取当前选中模式
   * @returns 方案详情，全部兜底均落空时为 null
   */
  const getHistoricalPlanLevelDetail = (
    plan?: StrikePlanV2Extended | null,
    mode: 'threat_first' | 'max_targets' = selectedHistoricalPlanMode.value
  ): StrikePlanV2PlanDetail | null => {
    if (!plan?.plans) return null
    const levelPlans = plan.plans[plan.intensityLevel as keyof typeof plan.plans] ?? Object.values(plan.plans)[0]
    if (!levelPlans) return null
    return levelPlans[mode] ?? levelPlans.threat_first ?? levelPlans.max_targets ?? null
  }

  /**
   * 取出方案的打击任务窗口列表。
   *
   * @param plan 历史方案
   * @returns 任务窗口列表；无详情时为空数组
   */
  const getHistoricalPlanMissionWindows = (plan?: StrikePlanV2Extended | null): StrikePlanV2MissionWindowItem[] =>
    getHistoricalPlanLevelDetail(plan)?.plan_summary.mission_windows ?? []

  /**
   * 将排序模式转为中文标签。
   *
   * @param mode 排序模式
   * @returns 「威胁优先」或「数量优先」
   */
  const getHistoricalPlanModeLabel = (mode: 'threat_first' | 'max_targets'): string =>
    mode === 'threat_first' ? '威胁优先' : '数量优先'

  /**
   * 依据当前选中方案与模式刷新方案详情缓存。
   * 切换方案或模式后需手动调用，保证详情与选中项一致。
   */
  const syncSelectedHistoricalPlanDetail = () => {
    selectedHistoricalPlanDetail.value = getHistoricalPlanLevelDetail(
      selectedHistoricalPlan.value,
      selectedHistoricalPlanMode.value
    )
  }

  // ─── 烈度标准化/格式化 ───

  /**
   * 将后端可能返回的多种烈度写法归一为 high / medium / low。
   * 兼容中英文与历史拼写错误（如 `hight`）；无法识别时原样返回小写值。
   *
   * @param value 原始烈度文案
   * @returns 归一化烈度标识；入参为空时返回空串
   */
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

  /**
   * 将烈度格式化为单字中文标签，用于卡片与表格展示。
   *
   * @param value 原始烈度文案
   * @returns 「高」「中」「低」；无法识别时返回原值或 `--`
   */
  const formatHistoricalPlanIntensity = (value?: string): string => {
    const normalized = normalizeHistoricalPlanIntensity(value)
    if (normalized === 'high') return '高'
    if (normalized === 'medium') return '中'
    if (normalized === 'low') return '低'
    return value || '--'
  }

  /** 全部方案中出现过的卫星类型（去重后按中文排序，供筛选下拉使用） */
  const historicalPlanSatelliteTypeOptions = computed(() =>
    Array.from(new Set(historicalPlans.value.flatMap((plan) => plan.types ?? []).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right, 'zh-Hans-CN')
    )
  )

  // ─── 方案卡片计算 ───

  /**
   * 全部方案卡片：每个方案按两种排序模式各展开一张卡片，缺少详情的组合会被丢弃。
   * key 由 任务 + 名称 + 版本 + 模式 组成，保证对比勾选时唯一。
   */
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

  /** 对比模式下已勾选的方案卡片（按勾选顺序，最多 4 个） */
  const selectedComparePlanCards = computed<HistoricalPlanCard[]>(() => {
    const cardMap = new Map(allHistoricalPlanCards.value.map((card) => [card.key, card]))
    return selectedHistoricalPlanKeys.value
      .map((key) => cardMap.get(key) ?? null)
      .filter((card): card is HistoricalPlanCard => Boolean(card))
      .slice(0, 4)
  })

  /** 弹窗当前是否处于多选对比模式 */
  const isCompareSelectionMode = computed(() => historicalPlanDialogMode.value === 'compare')

  /** 应用名称、烈度、卫星类型、排序模式四项筛选后的方案卡片 */
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

  /** 当前选中方案的打击任务窗口列表 */
  const selectedPlanMissionWindows = computed<StrikePlanV2MissionWindowItem[]>(() =>
    getHistoricalPlanMissionWindows(selectedHistoricalPlan.value)
  )

  /** 当前选中方案的输入目标数量 */
  const selectedPlanInputCount = computed(
    () => selectedHistoricalPlanDetail.value?.plan_summary.overview.input_count ?? 0
  )

  /** 当前选中方案涉及的武器 ID 集合（地图高亮参战武器用） */
  const selectedHistoricalPlanWeaponIds = computed(
    () => new Set(selectedPlanMissionWindows.value.map((item) => item.weapon_id))
  )

  // ─── 方案标签 ───

  /** 当前选中方案的展示标签：名称 · 版本 · 模式；未选中时回落为默认模式名 */
  const selectedHistoricalPlanLabel = computed(() => {
    if (!selectedHistoricalPlan.value) return '威胁优先'
    return `${selectedHistoricalPlan.value.name} · ${selectedHistoricalPlan.value.version} · ${selectedHistoricalPlanMode.value === 'threat_first' ? '威胁优先' : '数量优先'}`
  })

  // ─── 方案操作 ───

  /**
   * 判断方案卡片是否已被勾选对比。
   *
   * @param key 方案卡片 key
   * @returns 已勾选时为 true
   */
  const isHistoricalPlanChecked = (key: string) => selectedHistoricalPlanKeys.value.includes(key)

  /**
   * 切换方案卡片的对比勾选状态；超过 4 个时提示并忽略本次勾选。
   *
   * @param key 方案卡片 key
   */
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

  /**
   * 打开历史方案弹窗，并清空上一次的对比勾选。
   *
   * @param mode 打开模式：single 单选加载，compare 多选对比
   */
  const openHistoricalPlanDialog = (mode: 'single' | 'compare') => {
    historicalPlanDialogMode.value = mode
    selectedHistoricalPlanKeys.value = []
    historicalPlanDialogVisible.value = true
  }

  /**
   * 二次确认后删除历史方案，并强制刷新当前任务的方案列表。
   * 用户点击取消时静默返回，其余异常以消息提示形式反馈。
   *
   * @param planId 方案名称（后端以名称为删除标识）
   */
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

  /**
   * 拉取当前任务的杀伤链方案并按烈度分组。
   * 已加载过或无选中任务时直接返回，避免重复请求。
   */
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

  /**
   * 将杀伤链方案转换为历史方案结构并交给调用方加载，随后关闭弹窗。
   * 转换失败（方案结构不完整）时不改变任何状态。
   *
   * @param plan 选中的杀伤链方案
   * @param mode 排序模式，默认威胁优先
   * @param onPlanSelect 方案转换成功后的回调，由页面负责真正的加载与渲染
   */
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
