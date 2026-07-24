/**
 * 仿真播放控制
 * 管理 Cesium 时钟、播放进度条、阶段同步、打击运行时状态同步
 */
import { computed, ref, type ShallowRef } from 'vue'
import * as Cesium from 'cesium'
import { ElMessage } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'
import type { StrikePlanV2MissionWindowItem } from '@/api/strikePlan/satellite-strikeplan-api'
import type { ActiveStrikeQueueItem, BlueSatelliteRecord, MetricCard, StageItem } from '../types'
import { formatClock, formatDateTime, formatFullDateTime, parseMissionWindowDate } from '../helpers/dateFormat'

export function useSimulationPlayback(
  viewer: ShallowRef<Cesium.Viewer | null>,
  taskSteps: { value: TaskSteps[] },
  selectedHistoricalPlan: { value: any | null },
  selectedHistoricalPlanDetail: { value: any | null },
  selectedPlanMissionWindows: { value: StrikePlanV2MissionWindowItem[] },
  selectedPlanInputCount: { value: number },
  _selectedHistoricalPlanWeaponIds: { value: Set<string> },
  taskWeapons: { value: Weapon[] },
  blueSatellites: { value: BlueSatelliteRecord[] },
  selectedHistoricalPlanLabel: { value: string },
  refreshCompareViewers: () => void
) {
  const store = useLayoutStore()

  // ─── 播放控制状态 ───
  const playSpeed = ref(1000)
  const isPlaying = ref(false)
  const playbackCursor = ref(0)
  const taskProgressPercent = ref(0)

  // ─── 打击运行时状态 ───
  const activeStrikeWindowIds = ref<Set<string>>(new Set())
  const completedStrikeWindowIds = ref<Set<string>>(new Set())
  const activeStrikeQueue = ref<ActiveStrikeQueueItem[]>([])
  const strikeValidationStatus = ref('未加载打击方案')
  let hasAnnouncedStrikeCompletion = false

  // ─── 阶段状态 ───
  const activeStageName = ref('')
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

    const steps = taskSteps.value
    if (!steps.length) return null

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
  const completionRatio = computed(() =>
    selectedPlanInputCount.value > 0 ? completedTargetSatelliteCount.value / selectedPlanInputCount.value : 0
  )

  /**
   * 武器利用率
   * @returns 武器利用率
   */
  const weaponUtilizationRatio = computed(() =>
    selectedPlanWeaponCount.value > 0 ? completedWeaponCount.value / selectedPlanWeaponCount.value : 0
  )

  // ─── UI 数据 ───

  const simulationScenario = computed(() => ({
    taskId: `T-${store.activedTask?.id ?? '--'}`,
    selectedPlanKey: selectedHistoricalPlanLabel.value,
    startTime: formatDateTime(store.activedTask?.beginDate),
    endTime: formatDateTime(store.activedTask?.endDate),
    stageCount: stageList.value.length,
    missionCount: 0,
    satelliteCount: blueSatellites.value.length,
  }))

  const scenarioOverview = computed(() => [
    { label: '任务编号', value: simulationScenario.value.taskId },
    { label: '任务名称', value: store.activedTask?.name ?? '未选择任务' },
    { label: '开始时间', value: simulationScenario.value.startTime },
    { label: '结束时间', value: simulationScenario.value.endTime },
    { label: '阶段数量', value: `${simulationScenario.value.stageCount}` },
  ])

  const effectWindows = computed(() => [
    {
      id: 'e2',
      label: '已打击/总威胁',
      window:
        selectedHistoricalPlanDetail.value && selectedPlanInputCount.value > 0
          ? `${completedTargetSatelliteCount.value} / ${selectedPlanInputCount.value}`
          : '0 / 0',
    },
  ])

  const entityStateList = computed(() => [{ label: '打击目标', value: `${selectedPlanTargetSatelliteCount.value}` }])

  const metricCards = computed<MetricCard[]>(() => [
    {
      label: '任务进度',
      value: `${taskProgressPercent.value}%`,
      percent: taskProgressPercent.value,
      hint: '((当前时间-任务开始时间)/任务总时长)*100%',
    },
    {
      label: '剩余威胁',
      value: `${Math.max(0, selectedPlanInputCount.value - completedTargetSatelliteCount.value)} 枚`,
      percent: selectedPlanInputCount.value > 0 ? Math.round((1 - completionRatio.value) * 100) : 0,
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

    const currentTime = Cesium.JulianDate.toDate(viewer.value.clock.currentTime)
    const activeIds = new Set<string>()
    const completedIds = new Set<string>()

    for (const mission of selectedPlanMissionWindows.value) {
      const start = parseMissionWindowDate(mission.window_start)
      const end = parseMissionWindowDate(mission.window_end)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue

      const key = getStrikeWindowId(mission)
      if (currentTime >= start && currentTime <= end) activeIds.add(key)
      if (currentTime >= end) completedIds.add(key)
    }

    activeStrikeWindowIds.value = activeIds
    completedStrikeWindowIds.value = completedIds

    const queueById = new Map(activeStrikeQueue.value.map((item) => [item.id, item]))
    const nextQueue = [...activeStrikeQueue.value]

    for (const mission of selectedPlanMissionWindows.value) {
      const id = getStrikeWindowId(mission)
      if (!activeIds.has(id) || queueById.has(id)) continue
      const newItem = createActiveStrikeQueueItem(mission)
      nextQueue.push(newItem)
      queueById.set(id, newItem)
    }

    activeStrikeQueue.value = nextQueue
    refreshCompareViewers()

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
    const window = clockWindow.value
    if (!window) return

    const totalSeconds = Cesium.JulianDate.secondsDifference(window.stop, window.start)
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return

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

    const currentDate = Cesium.JulianDate.toDate(viewer.value.clock.currentTime)
    if (Number.isNaN(currentDate.getTime())) return

    const nextStage = [...taskSteps.value]
      .filter((step) => {
        const startDate = new Date(step.startTime)
        return !Number.isNaN(startDate.getTime()) && currentDate >= startDate
      })
      .sort((left, right) => new Date(right.startTime ?? 0).getTime() - new Date(left.startTime ?? 0).getTime())[0]

    const nextStageName = nextStage?.name ?? taskSteps.value[0]?.name
    if (nextStageName && nextStageName !== activeStageName.value) {
      stageChangeFromClock = true
      activeStageName.value = nextStageName
    }
  }

  const syncTaskProgressFromClock = () => {
    const startDate = new Date(store.activedTask?.beginDate ?? '')
    const endDate = new Date(store.activedTask?.endDate ?? '')
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
      return
    }

    const currentTime = viewer.value ? Cesium.JulianDate.toDate(viewer.value.clock.currentTime) : new Date()
    if (Number.isNaN(currentTime.getTime())) return

    const totalMilliseconds = endDate.getTime() - startDate.getTime()
    const elapsedMilliseconds = currentTime.getTime() - startDate.getTime()
    taskProgressPercent.value = Math.round(Math.min(1, Math.max(0, elapsedMilliseconds / totalMilliseconds)) * 100)
  }

  const syncClockFromPlaybackCursor = () => {
    if (!viewer.value) return
    const window = clockWindow.value
    if (!window) return

    const totalSeconds = Cesium.JulianDate.secondsDifference(window.stop, window.start)
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return

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
