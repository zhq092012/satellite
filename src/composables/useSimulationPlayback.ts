/**
 * 仿真播放控制
 * 管理 Cesium 时钟、播放进度条、阶段同步、打击运行时状态同步
 */
import { computed, ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import { ElMessage } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'
import type { StrikePlanV2MissionWindowItem } from '@/api/strike-plan/satellite-strike-plan-api'
import type { Weapon } from '@/types/dashboard'
import type { ActiveStrikeQueueItem, BlueSatelliteRecord, MetricCard, StageItem } from '@/types/strike'
import { formatClock, formatDateTime, formatFullDateTime, parseMissionWindowDate } from '@/utils/tools/dateFormat'
import type { TaskSteps } from '@/types/cesium/satellite'

/**
 * 历史方案仿真播放：Cesium 时钟、阶段条、打击队列与指标卡片同步。
 *
 * @returns 播放状态、进度控制与阶段切换方法（参数见函数签名，由方案页注入 Viewer 与方案数据）
 */
export function useSimulationPlayback(
  viewer: ShallowRef<Cesium.Viewer | null>,
  taskSteps: { value: TaskSteps[] },
  selectedHistoricalPlan: { value: any | null },
  selectedHistoricalPlanDetail: { value: any | null },
  selectedPlanMissionWindows: { value: StrikePlanV2MissionWindowItem[] },
  selectedPlanInputCount: { value: number | null },
  _selectedHistoricalPlanWeaponIds: { value: Set<string> },
  taskWeapons: { value: Weapon[] },
  blueSatellites: { value: BlueSatelliteRecord[] },
  selectedHistoricalPlanLabel: { value: string },
  refreshCompareViewers: () => void
) {
  /** 布局 Store，读取任务起止时间 */
  const store = useLayoutStore()

  // ─── 播放控制状态 ───
  /** Cesium 时钟倍率 */
  const playSpeed = ref(1000)
  /** 是否正在播放 */
  const isPlaying = ref(false)
  /** 播放进度条位置，0–100，相对任务时钟窗口 */
  const playbackCursor = ref(0)
  /** 任务时间进度百分比，相对任务开始/结束 */
  const taskProgressPercent = ref(0)

  // ─── 打击运行时状态 ───
  /** 当前时刻落在窗口内的打击 ID */
  const activeStrikeWindowIds = ref<Set<string>>(new Set())
  /** 当前时刻已结束的打击窗口 ID */
  const completedStrikeWindowIds = ref<Set<string>>(new Set())
  /** 已进入过的打击队列，供侧栏按进行中/已完成排序 */
  const activeStrikeQueue = ref<ActiveStrikeQueueItem[]>([])
  /** 打击状态文案 */
  const strikeValidationStatus = ref('未加载打击方案')
  /** 是否已弹出「打击已完成」，避免时钟重复触发提示 */
  let hasAnnouncedStrikeCompletion = false

  // ─── 阶段状态 ───
  /** 当前时钟所在任务阶段名 */
  const activeStageName = ref('')
  /** 阶段变化来自时钟推进而非用户点击，供外部消费后清掉 */
  let stageChangeFromClock = false

  // ─── 打击窗口工具函数 ───

  /**
   * 获取打击窗口ID
   * @param mission 任务
   * @returns 打击窗口ID
   */
  const getStrikeWindowId = (mission: StrikePlanV2MissionWindowItem) =>
    `${mission.weapon_id}-${mission.satellite_id}-${mission.window_start}`

  /**
   * 获取打击武器类型
   * @param mission 任务
   * @returns 打击武器类型
   */
  const getStrikeWeaponType = (mission: StrikePlanV2MissionWindowItem): string => {
    /** 优先任务武器表，其次方案资产配置中的武器类型 */
    const weaponType =
      taskWeapons.value.find((weapon) => String(weapon.id) === String(mission.weapon_id))?.type ??
      selectedHistoricalPlanDetail.value?.plan_summary.asset_config.find(
        (asset: any) => asset.weapon_id === mission.weapon_id
      )?.weapon_type
    return weaponType || '未知类型'
  }
  /**
   * 获取打击卫星名称 如果未找到，则返回 NORAD + 卫星ID
   * @param mission 任务
   * @returns 打击卫星名称
   */
  const getStrikeSatelliteName = (mission: StrikePlanV2MissionWindowItem): string =>
    blueSatellites.value.find((satellite) => satellite.noradId === String(mission.satellite_id))?.name ??
    `NORAD ${mission.satellite_id}`

  /**
   * 创建活跃打击队列项
   * @param mission 任务
   * @returns 活跃打击队列项
   */
  const createActiveStrikeQueueItem = (mission: StrikePlanV2MissionWindowItem): ActiveStrikeQueueItem => {
    /** 队列摘要中的武器类型、卫星名与窗口起止 */
    const weaponType = getStrikeWeaponType(mission)
    const satelliteName = getStrikeSatelliteName(mission)
    const startTime = formatFullDateTime(mission.window_start)
    const endTime = formatFullDateTime(mission.window_end)

    return {
      id: getStrikeWindowId(mission),
      summary: `${mission.weapon_name}（${weaponType}）- ${satelliteName}`,
      timeWindow: `${startTime} - ${endTime}`,
    }
  }

  // ─── 运行时状态管理 ───

  /**
   * 重置打击运行时状态
   * @param status 状态
   */
  const resetStrikeRuntimeState = (status: string) => {
    activeStrikeWindowIds.value = new Set()
    completedStrikeWindowIds.value = new Set()
    activeStrikeQueue.value = []
    strikeValidationStatus.value = status
    hasAnnouncedStrikeCompletion = false
  }

  /**
   * 停止打击动画并显示通知
   */
  const stopStrikeAnimationWithNotice = () => {
    if (!viewer.value || hasAnnouncedStrikeCompletion) return
    hasAnnouncedStrikeCompletion = true
    isPlaying.value = false
    viewer.value.clock.shouldAnimate = false
    viewer.value.scene.requestRender()
    ElMessage.success('打击已完成')
  }
  /**
   * 根据任务的开始时间和结束时间来计算时钟的开始结束时间
   */
  const clockWindow = computed(() => {
    /** 任务起止；合法时优先于步骤时间作为时钟范围 */
    const taskStartDate = new Date(store.activedTask?.beginDate ?? '')
    const taskStopDate = new Date(store.activedTask?.endDate ?? '')
    if (
      !Number.isNaN(taskStartDate.getTime()) &&
      !Number.isNaN(taskStopDate.getTime()) &&
      taskStartDate < taskStopDate
    ) {
      return {
        start: Cesium.JulianDate.fromDate(taskStartDate),
        stop: Cesium.JulianDate.fromDate(taskStopDate),
      }
    }

    /** 任务时间无效时，用步骤首尾作为时钟范围 */
    const steps = taskSteps.value
    if (!steps.length) return null

    /** 第一步开始与最后一步结束 */
    const startDate = new Date(steps[0].startTime)
    const stopDate = new Date(steps[steps.length - 1].endTime)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(stopDate.getTime())) return null

    return {
      start: Cesium.JulianDate.fromDate(startDate),
      stop: Cesium.JulianDate.fromDate(stopDate),
    }
  })

  // ─── 阶段列表 ───

  /**
   * 阶段列表
   * @returns 阶段列表
   */
  const stageList = computed<StageItem[]>(() => {
    if (!taskSteps.value.length) return []
    return taskSteps.value.map((step) => ({
      name: step.name,
      window: `${formatClock(step.startTime)} - ${formatClock(step.endTime)}`,
      startTime: step.startTime,
      endTime: step.endTime,
    }))
  })

  // ─── 打击列表排序 ───

  /**
   * 打击列表
   * @returns 打击列表
   */
  const strikeList = computed(() =>
    activeStrikeQueue.value
      .map((item, index) => ({
        item,
        index,
        priority: activeStrikeWindowIds.value.has(item.id) ? 0 : completedStrikeWindowIds.value.has(item.id) ? 1 : 2,
      }))
      .sort((left, right) => left.priority - right.priority || left.index - right.index)
      .map(({ item }) => item)
  )

  // ─── 派生指标 ───

  /**
   * 已打击卫星ID集合
   * @returns 已打击卫星ID集合
   */
  const completedTargetSatelliteIds = computed(
    () =>
      new Set(
        selectedPlanMissionWindows.value
          .filter((item) => completedStrikeWindowIds.value.has(`${item.weapon_id}-${item.satellite_id}`))
          .map((item) => String(item.satellite_id))
      )
  )

  /**
   * 选择计划目标卫星数量
   * @returns 选择计划目标卫星数量
   */
  const selectedPlanTargetSatelliteCount = computed(
    () => new Set(selectedPlanMissionWindows.value.map((item) => String(item.satellite_id))).size
  )

  /**
   * 选择计划武器数量
   * @returns 选择计划武器数量
   */
  const selectedPlanWeaponCount = computed(
    () => new Set(selectedPlanMissionWindows.value.map((item) => String(item.weapon_id))).size
  )

  /**
   * 已打击卫星数量
   * @returns 已打击卫星数量
   */
  const completedTargetSatelliteCount = computed(
    () =>
      new Set(
        selectedPlanMissionWindows.value
          .filter((item) => completedStrikeWindowIds.value.has(`${item.weapon_id}-${item.satellite_id}`))
          .map((item) => String(item.satellite_id))
      ).size
  )

  /**
   * 已打击武器数量
   * @returns 已打击武器数量
   */
  const completedWeaponCount = computed(
    () =>
      new Set(
        selectedPlanMissionWindows.value
          .filter((item) => completedStrikeWindowIds.value.has(`${item.weapon_id}-${item.satellite_id}`))
          .map((item) => String(item.weapon_id))
      ).size
  )

  /**
   * 完成比例
   * @returns 完成比例
   */
  const completionRatio = computed(() => {
    /** 方案输入威胁总数；缺失或非正数时覆盖率为 0 */
    const total = selectedPlanInputCount.value
    if (total == null || total <= 0) return 0
    return completedTargetSatelliteCount.value / total
  })

  /**
   * 武器利用率
   * @returns 武器利用率
   */
  const weaponUtilizationRatio = computed(() =>
    selectedPlanWeaponCount.value > 0 ? completedWeaponCount.value / selectedPlanWeaponCount.value : 0
  )

  // ─── UI 数据 ───

  /** 仿真页头部展示的任务与方案摘要 */
  const simulationScenario = computed(() => ({
    taskId: `T-${store.activedTask?.id ?? '--'}`,
    selectedPlanKey: selectedHistoricalPlanLabel.value,
    startTime: formatDateTime(store.activedTask?.beginDate),
    endTime: formatDateTime(store.activedTask?.endDate),
    stageCount: stageList.value.length,
    missionCount: 0,
    satelliteCount: blueSatellites.value.length,
  }))

  /** 场景概览键值行 */
  const scenarioOverview = computed(() => [
    { label: '任务编号', value: simulationScenario.value.taskId },
    { label: '任务名称', value: store.activedTask?.name ?? '未选择任务' },
    { label: '开始时间', value: simulationScenario.value.startTime },
    { label: '结束时间', value: simulationScenario.value.endTime },
    { label: '阶段数量', value: `${simulationScenario.value.stageCount}` },
  ])

  /** 效果窗口：已打击数 / 方案输入威胁数 */
  const effectWindows = computed(() => [
    {
      id: 'e2',
      label: '已打击/总威胁',
      window:
        selectedHistoricalPlanDetail.value && selectedPlanInputCount.value != null
          ? `${completedTargetSatelliteCount.value} / ${selectedPlanInputCount.value}`
          : '-- / --',
    },
  ])

  /** 实体状态摘要，当前只展示打击目标数量 */
  const entityStateList = computed(() => [{ label: '打击目标', value: `${selectedPlanTargetSatelliteCount.value}` }])

  /** 进度、剩余威胁、武器利用率、效果覆盖率四张指标卡 */
  const metricCards = computed<MetricCard[]>(() => [
    {
      label: '任务进度',
      value: `${taskProgressPercent.value}%`,
      percent: taskProgressPercent.value,
      hint: '((当前时间-任务开始时间)/任务总时长)*100%',
    },
    {
      label: '剩余威胁',
      value:
        selectedPlanInputCount.value != null
          ? `${Math.max(0, selectedPlanInputCount.value - completedTargetSatelliteCount.value)} 枚`
          : '-- 枚',
      percent:
        selectedPlanInputCount.value != null && selectedPlanInputCount.value > 0
          ? Math.round((1 - completionRatio.value) * 100)
          : 0,
      hint: '总过境卫星-已打击卫星',
    },
    {
      label: '武器利用率',
      value: `${Math.round(weaponUtilizationRatio.value * 100)}%`,
      percent: Math.round(weaponUtilizationRatio.value * 100),
      hint: '(已使用武器/打击方案总武器)*100%',
    },
    {
      label: '效果覆盖率',
      value: `${Math.round(completionRatio.value * 100)}%`,
      percent: Math.round(completionRatio.value * 100),
      hint: '(已打击卫星 / 过境总卫星)*100%',
    },
  ])

  // ─── 同步函数 ───

  /**
   * 同步打击运行到当前时间
   * @returns 
   */
  const syncStrikeRuntimeFromClock = () => {
    if (!viewer.value || !selectedHistoricalPlanDetail.value || !selectedPlanMissionWindows.value.length) {
      resetStrikeRuntimeState(selectedHistoricalPlan.value ? '方案已加载，等待时间推进' : '未加载打击方案')
      return
    }

    /** 时钟当前时刻，用于判断窗口进行中或已结束 */
    const currentTime = Cesium.JulianDate.toDate(viewer.value.clock.currentTime)
    /** 本帧进行中、已结束的窗口 ID */
    const activeIds = new Set<string>()
    const completedIds = new Set<string>()

    for (const mission of selectedPlanMissionWindows.value) {
      /** 窗口起止；无法解析的窗口不参与状态判断 */
      const start = parseMissionWindowDate(mission.window_start)
      const end = parseMissionWindowDate(mission.window_end)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue

      /** 武器 + 卫星 + 开始时间组成的窗口键 */
      const key = getStrikeWindowId(mission)
      if (currentTime >= start && currentTime <= end) activeIds.add(key)
      if (currentTime >= end) completedIds.add(key)
    }

    activeStrikeWindowIds.value = activeIds
    completedStrikeWindowIds.value = completedIds

    /** 已在队列中的窗口，避免重复入队 */
    const queueById = new Map(activeStrikeQueue.value.map((item) => [item.id, item]))
    /** 追加本帧新进入窗口后的队列 */
    const nextQueue = [...activeStrikeQueue.value]

    for (const mission of selectedPlanMissionWindows.value) {
      /** 仅把刚进入进行中、且尚未入队的窗口追加进去 */
      const id = getStrikeWindowId(mission)
      if (!activeIds.has(id) || queueById.has(id)) continue
      const newItem = createActiveStrikeQueueItem(mission)
      nextQueue.push(newItem)
      queueById.set(id, newItem)
    }

    activeStrikeQueue.value = nextQueue
    refreshCompareViewers()

    /** 全部窗口都已结束且没有进行中窗口时判定打击完成 */
    const totalWindows = selectedPlanMissionWindows.value.length
    const allWindowsCompleted = totalWindows > 0 && completedIds.size >= totalWindows && activeIds.size === 0
    if (allWindowsCompleted) {
      strikeValidationStatus.value = '打击完成'
      stopStrikeAnimationWithNotice()
      return
    }

    hasAnnouncedStrikeCompletion = false

    strikeValidationStatus.value =
      activeIds.size > 0
        ? '打击进行中'
        : completedIds.size > 0
          ? '当前无正在执行的打击窗口'
          : '等待卫星进入打击时间窗口'
  }
  /**
   * 同步播放进度条到当前时间
   */
  const syncPlaybackCursorFromClock = () => {
    if (!viewer.value) return
    /** 任务或步骤决定的时钟起止 */
    const window = clockWindow.value
    if (!window) return

    /** 时钟总时长（秒） */
    const totalSeconds = Cesium.JulianDate.secondsDifference(window.stop, window.start)
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return

    /** 已播放秒数与对应的 0–100 进度 */
    const elapsedSeconds = Cesium.JulianDate.secondsDifference(viewer.value.clock.currentTime, window.start)
    const nextCursor = Math.min(100, Math.max(0, (elapsedSeconds / totalSeconds) * 100))
    playbackCursor.value = nextCursor
    syncStrikeRuntimeFromClock()
  }
  /**
   * 同步当前阶段到当前时间
   * @returns 
   */
  const syncActiveStageFromClock = () => {
    if (!viewer.value || !taskSteps.value.length) return

    /** 时钟对应的绝对时间 */
    const currentDate = Cesium.JulianDate.toDate(viewer.value.clock.currentTime)
    if (Number.isNaN(currentDate.getTime())) return

    /** 已开始且开始时间最晚的阶段，即当前阶段 */
    const nextStage = [...taskSteps.value]
      .filter((step) => {
        /** 阶段开始时刻 */
        const startDate = new Date(step.startTime)
        return !Number.isNaN(startDate.getTime()) && currentDate >= startDate
      })
      .sort((left, right) => new Date(right.startTime ?? 0).getTime() - new Date(left.startTime ?? 0).getTime())[0]

    /** 命中的阶段名；没有任何已开始阶段时回落到第一步 */
    const nextStageName = nextStage?.name ?? taskSteps.value[0]?.name
    if (nextStageName && nextStageName !== activeStageName.value) {
      stageChangeFromClock = true
      activeStageName.value = nextStageName
    }
  }

  /**
   * 按任务起止时间把当前时钟换算成 0–100 的任务进度。
   * 起止无效或开始不早于结束时保持原进度。
   */
  const syncTaskProgressFromClock = () => {
    /** 任务开始、结束时刻 */
    const startDate = new Date(store.activedTask?.beginDate ?? '')
    const endDate = new Date(store.activedTask?.endDate ?? '')
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      return
    }

    /** 有 Viewer 时用时钟，否则用当前墙钟 */
    const currentTime = viewer.value ? Cesium.JulianDate.toDate(viewer.value.clock.currentTime) : new Date()
    if (Number.isNaN(currentTime.getTime())) return

    /** 任务总时长与已过时长（毫秒） */
    const totalMilliseconds = endDate.getTime() - startDate.getTime()
    const elapsedMilliseconds = currentTime.getTime() - startDate.getTime()
    taskProgressPercent.value = Math.round(Math.min(1, Math.max(0, elapsedMilliseconds / totalMilliseconds)) * 100)
  }

  /**
   * 按进度条百分比回写 Cesium 时钟，并刷新打击运行时状态。
   */
  const syncClockFromPlaybackCursor = () => {
    if (!viewer.value) return
    /** 时钟窗口 */
    const window = clockWindow.value
    if (!window) return

    /** 窗口总秒数 */
    const totalSeconds = Cesium.JulianDate.secondsDifference(window.stop, window.start)
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return

    /** 进度条对应的相对起点偏移（秒） */
    const offsetSeconds = (playbackCursor.value / 100) * totalSeconds
    viewer.value.clock.currentTime = Cesium.JulianDate.addSeconds(window.start, offsetSeconds, new Cesium.JulianDate())
    viewer.value.scene.requestRender()
    syncStrikeRuntimeFromClock()
  }

  /**
   * 应用时钟窗口
   * @param resetCurrentTime 是否重置当前时间
   */
  const applyClockWindow = (resetCurrentTime = false) => {
    if (!viewer.value) return
    /** 要写入 Viewer 的起止窗口 */
    const window = clockWindow.value
    if (!window) return

    viewer.value.clock.startTime = Cesium.JulianDate.clone(window.start)
    viewer.value.clock.stopTime = Cesium.JulianDate.clone(window.stop)
    if (resetCurrentTime || !Cesium.JulianDate.equals(viewer.value.clock.currentTime, window.start)) {
      viewer.value.clock.currentTime = Cesium.JulianDate.clone(window.start)
    }
    viewer.value.clock.clockRange = Cesium.ClockRange.CLAMPED
    viewer.value.clock.multiplier = playSpeed.value
    viewer.value.clock.shouldAnimate = isPlaying.value
    viewer.value.timeline?.zoomTo(window.start, window.stop)
    syncPlaybackCursorFromClock()
    syncTaskProgressFromClock()
  }

  /** 消费 stageChangeFromClock 标志位 */
  const consumeStageChangeFromClock = (): boolean => {
    if (stageChangeFromClock) {
      stageChangeFromClock = false
      return true
    }
    return false
  }

  /** 获取任务运行状态(武器打击状态)
   * @param mission 任务窗口
   * @param currentDate 当前时间
   * @returns { active: boolean, completed: boolean } -- active: 是否在时间窗口内, completed: 是否在时间窗口之后
   */
  const getMissionRuntimeState = (mission: StrikePlanV2MissionWindowItem, currentDate: Date) => {
    /** 窗口起止；无法解析时视为既未进行也未完成 */
    const start = parseMissionWindowDate(mission.window_start)
    const end = parseMissionWindowDate(mission.window_end)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { active: false, completed: false }
    }
    return {
      active: currentDate >= start && currentDate <= end,
      completed: currentDate > end,
    }
  }

  return {
    // 状态
    playSpeed,
    isPlaying,
    playbackCursor,
    taskProgressPercent,
    activeStrikeWindowIds,
    completedStrikeWindowIds,
    activeStrikeQueue,
    strikeValidationStatus,
    activeStageName,
    // 计算
    clockWindow,
    stageList,
    strikeList,
    completedTargetSatelliteIds,
    selectedPlanTargetSatelliteCount,
    selectedPlanWeaponCount,
    completedTargetSatelliteCount,
    completedWeaponCount,
    completionRatio,
    weaponUtilizationRatio,
    simulationScenario,
    scenarioOverview,
    effectWindows,
    entityStateList,
    metricCards,
    // 方法
    getStrikeWindowId,
    getStrikeWeaponType,
    getStrikeSatelliteName,
    resetStrikeRuntimeState,
    syncStrikeRuntimeFromClock,
    syncPlaybackCursorFromClock,
    syncActiveStageFromClock,
    syncTaskProgressFromClock,
    syncClockFromPlaybackCursor,
    applyClockWindow,
    consumeStageChangeFromClock,
    getMissionRuntimeState,
  }
}
