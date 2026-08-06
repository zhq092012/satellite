<template>
  <div class="container" v-show="!store.showNetView">
    <div class="nav">
      <div class="nav-left">
        <span class="title">模式选择：</span>
        <el-radio-group v-model="selectedMode">
          <el-radio value="地对天">地对天</el-radio>
          <el-radio value="天对天">天对天</el-radio>
          <el-radio value="天对地">天对地</el-radio>
        </el-radio-group>

        <span class="title">当前作战阶段:</span>
        <div style="display: flex; gap: 10px">
          <el-tag style="cursor: pointer" type="primary" v-for="tag in segments"
            :effect="currentSegment === tag ? 'dark' : 'plain'" @click="syncClockAndStep(tag, view3D.clock)">{{ tag
            }}</el-tag>
        </div>

        <div class="switch-bars">
          <!-- <el-switch
            v-model="showAnimate"
            active-color="#13ce66"
            inactive-color="#ff4949"
            active-text="开启阶段动画"
            size="small"
            :disabled="selectedMode == '天对天'"
          ></el-switch> -->
          <el-switch v-model="showView2D" active-color="#13ce66" inactive-color="#ff4949" active-text="开启二维视图"
            size="small" :disabled="selectedMode == '天对天'"></el-switch>
        </div>
      </div>
      <div class="nav-right">
        <el-switch v-model="store.showNetView" active-color="#13ce66" inactive-color="#ff4949"
          active-text="开启网络视图"></el-switch>
      </div>
    </div>
    <div id="cesiumContainer" :class="[{ animating: showView2D, 'not-animating': !showView2D }, selectedModeClass]"
      class="fullSize">
      <div class="left-top-bar" v-show="selectedMode !== '天对天'">
        <div>
          <span>{{ statistics?.weaponNum || 0 }}</span><span>武器总数</span>
        </div>
        <div style="display: flex; flex-direction: row">
          <div v-for="[type, count] in Object.entries(statistics?.weaponTypeMap || {})" :key="type">
            <span>{{ count }}</span>
            <span> {{ type }} ({{ selectedWeaponTypeMap[type] || 0 }})</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: row">
          <div v-for="[country, count] in Object.entries(statistics?.weaponAreaMap || {})" :key="country">
            <span>{{ count }}</span>
            <span> {{ country }}</span>
          </div>
        </div>
      </div>
      <div class="left-workbench">
        <el-splitter class="workbench-splitter" layout="horizontal">
          <el-splitter-panel v-if="selectedMode !== '天对天'" collapsible size="300px" min="220px" class="sidebar-panel">
            <div class="left-side-bar">
              <div class="panel-title">武器信息列表</div>

              <el-tree ref="weaponTreeRef" node-key="id" show-checkbox :data="weaponsTreeData" :props="treeProps"
                :default-expand-all="true" @check-change="handleWeaponTreeCheckChange"></el-tree>
            </div>
          </el-splitter-panel>
          <el-splitter-panel class="main-panel">
            <div id="view3D" class="left-panel">
              <div ref="creditEl3D" class="credit"></div>
              <!-- <div class="animation-box" v-show="selectedMode !== '天对天' && showAnimate">
                <BattleScene v-model:phase="phase" :durations="phaseDurations" />
              </div> -->
            </div>
          </el-splitter-panel>
        </el-splitter>
      </div>

      <div class="right-top-bar" v-show="selectedMode !== '天对天'">
        <div>
          <span>{{ statistics?.satelliteNum || 0 }}</span>
          <span>卫星总数</span>
        </div>
        <div>
          <span>{{ statistics?.satelliteTypeNum || 0 }}</span>
          <span>卫星类型</span>
        </div>
        <div>
          <span>{{ statistics?.avgThreat || 0 }}</span>
          <span>平均威胁度</span>
        </div>
      </div>
      <div class="right-workbench">
        <el-splitter class="workbench-splitter" layout="horizontal">
          <el-splitter-panel class="main-panel">
            <div class="right-panel">
              <div id="view4D" class="view4">
                <div ref="creditEl4D" class="credit"></div>
                <!-- 浮动 2D 鹰眼图：固定在右侧面板左下角 -->
                <div ref="view2DWrapper" class="floating-view2d" v-show="showView2D && selectedMode !== '天对天'">
                  <div id="view2D">
                    <div ref="creditEl2D" class="credit"></div>
                  </div>
                </div>
              </div>
            </div>
          </el-splitter-panel>
          <el-splitter-panel v-if="selectedMode !== '天对天'" collapsible size="300px" min="220px" class="sidebar-panel">
            <div class="right-side-bar">
              <div class="panel-title">可打击卫星列表</div>
              <div class="satellite-list">
                <div v-if="selectedWeapons.length === 0" class="no-data">请选择一个或多个武器</div>
                <div v-else-if="satelliteStrike.length === 0" class="no-data">暂无可打击卫星</div>
                <ul v-else>
                  <li v-for="sat in satelliteStrike" :key="sat.norad_id">
                    <div>
                      <strong>{{ sat.name_en }}</strong>（{{ sat.country }}）
                    </div>
                    <div>NORAD：{{ sat.norad_id }}</div>
                    <div>卫星类型：{{ sat.sat_type || '未知' }}</div>
                    <div v-if="sat.weapons_window?.length" class="strike-window-list">
                      <details>
                        <summary>打击窗口信息</summary>
                        <div class="weapon-window-list">
                          <div v-for="(w, idx) in sat.weapons_window" :key="`${sat.norad_id}-${idx}-${w.id}`">
                            {{ w.name || '未知武器' }}：{{ w.strike_window || '未知窗口' }}
                          </div>
                        </div>
                      </details>
                    </div>
                    <div v-else>时间窗口：无</div>
                  </li>
                </ul>
              </div>
            </div>
          </el-splitter-panel>
        </el-splitter>
      </div>
    </div>
  </div>
  <div v-show="store.showNetView">
    <SatelliteNetView ref="sateNetViewRef" />
  </div>
</template>
<script setup lang="ts">
import {
  getBattleSegmentSatellites,
  getRedBlueStatistics,
  getSatelliteRelationsBySatellite,
  getSatelliteTLEData,
  getStrikeSatellites,
  getTaskWeapons,
  getTLEDataByTaskId,
  type RedBlueStatistics,
} from '@/api/dashboard'
import { onMounted, ref, watch, computed, onBeforeUnmount } from 'vue'
import { useLayoutStore } from '@/store/modules/layout'
import * as Cesium from 'cesium'
import * as satellitejs from 'satellite.js'
import { ElMessage } from 'element-plus'
import { formatTimeLineAndAnimation, markBattleArea } from '@/utils/tools/functionTool'
import SatelliteNetView from './SatelliteNetView.vue'
import { EarthRotationController } from '@/utils/tools/earthRotaion'
import { bindInfoBoxButton, createInfoBoxActionButton, unbindInfoBoxButton } from '@/utils/tools/infoBox'
import { useSatelliteProfileDialog } from '@/composables/useSatelliteProfileDialog'
import type { SatelliteStrike, Weapon } from '@/types/dashboard/index.js'
const { openSatelliteProfile } = useSatelliteProfileDialog()
// 接收父组件传入的展示控制属性，避免非 props 属性警告
const props = defineProps<{
  tabKey?: string
  hasNav?: boolean
  hasLegend?: boolean
  showSatMsg?: boolean
  showTimeLine?: boolean
  showAnimation?: boolean
}>()

// 声明父组件可能监听的自定义事件
const emit = defineEmits(['threatAnalysis', 'changeEffectModel'])

const creditEl3D = ref<HTMLElement | null>(null)
const creditEl2D = ref<HTMLElement | null>(null)
const creditEl4D = ref<HTMLElement | null>(null)

const taskSteps = ref<TaskSteps[]>([])
const store = useLayoutStore()
const MATERIAL_URL = import.meta.env.VITE_MATERIAL_URL

// 根据当前的step 更新Clock当前时间为step阶段的开始时间
const syncClockAndStep = (stepName: string, clock: Cesium.Clock) => {
  try {
    // 优先使用已缓存的 taskSteps，否则从 store 中解析
    let steps = taskSteps.value
    if ((!steps || steps.length === 0) && store.activedTask?.steps) {
      steps = JSON.parse(store.activedTask.steps) as TaskSteps[]
      taskSteps.value = steps
    }
    if (!steps || steps.length === 0) return

    const step = steps.find((s) => s.name === stepName)
    if (!step) return

    const targetDate = new Date(step.startTime)
    const targetJD = Cesium.JulianDate.fromDate(targetDate)

    // 暂停动画，避免其它 onTick 覆盖
    const prevAnimate = clock.shouldAnimate
    clock.shouldAnimate = false

    // 设置全局时钟
    clock.currentTime = targetJD.clone()

    // 保持暂停状态，避免被其它逻辑立即覆盖（如需恢复播放可手动恢复）
    clock.shouldAnimate = prevAnimate
  } catch (e) {
    console.warn('updateClock failed', e)
  }
}
// 将国家列表字符串规范化为数组，支持逗号分隔的多国家输入
const normalizeCountries = (raw?: string) =>
  (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

const ourCountries = ref<string[]>(normalizeCountries(store.activedTask?.meCountry))
const enemyCountries = ref<string[]>(normalizeCountries(store.activedTask?.enemyCountry))
const currentSegment = ref('')
// 每个 viewer 独立保存一份阶段卫星数据，避免后加载的 viewer 覆盖先加载的 viewer
const viewerStepSatellites = new WeakMap<Cesium.Viewer, StepSatellite[]>()
// 当前阶段卫星
const currentStepSatellites = ref<StepSatellite>()
const satelliteStepCache = new Map<string, StepSatellite[]>()
const satelliteStepLoading = new Map<string, Promise<StepSatellite[]>>()

const buildSatelliteStepCacheKey = (countries: string[], camp: string) => {
  return `${camp}:${[...countries]
    .map((s) => s.trim())
    .filter(Boolean)
    .sort()
    .join('|')}`
}
// 获取当前阶段的卫星数据对象
const getCurrentStepSatellite = (steps: StepSatellite[], stepName: string) => {
  return steps.find((s) => s.taskStepResp.name === stepName)
}
// 获取当前阶段的卫星 NORAD ID 列表，供后续加载使用
const getCurrentStepNoradIds = (steps: StepSatellite[], stepName: string) => {
  const stepSatellite = getCurrentStepSatellite(steps, stepName)
  if (!stepSatellite) return []

  return stepSatellite.structureList.flatMap((s) => s.gjList.map((g) => g.norad_id)).filter((id) => !!id)
}
// 获取任务内所有阶段的卫星 NORAD ID 列表，用于组件初始化时一次性渲染
const getAllStepNoradIds = (steps: StepSatellite[]) => {
  return Array.from(
    new Set(steps.flatMap((step) => step.structureList.flatMap((s) => s.gjList.map((g) => g.norad_id))))
  ).filter((id) => !!id)
}
// 根据当前阶段控制卫星实体显示/隐藏，不重新创建实体
const syncSatelliteVisibility = (viewer: Cesium.Viewer, stepName: string) => {
  if (!viewer || !viewer.entities || !Array.isArray(viewer.entities.values)) return

  const steps = viewerStepSatellites.get(viewer) || []
  currentStepSatellites.value = getCurrentStepSatellite(steps, stepName)
  const visibleIds = new Set(stepName ? getCurrentStepNoradIds(steps, stepName) : [])

  viewer.entities.values.forEach((entity) => {
    if (typeof entity.id !== 'string' || !entity.id.startsWith('satellite-')) return

    const noradId = entity.id.replace(/^satellite-/, '')
    entity.show = visibleIds.size > 0 && visibleIds.has(noradId)
  })

  try {
    viewer.scene.requestRender()
  } catch (e) {
    // ignore
  }
}
/**
 * 确保获取到指定国家和阵营的战斗段卫星数据
 * @param countries 国家列表
 * @param camp 阵营
 */
const ensureBattleSegmentSatellites = async (countries: string[], camp: string) => {
  const cacheKey = buildSatelliteStepCacheKey(countries, camp)
  const cached = satelliteStepCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const loading = satelliteStepLoading.get(cacheKey)
  if (loading) {
    const data = await loading
    return data
  }

  const promise = (async () => {
    const res = await getBattleSegmentSatellites(store.activedTask?.id, undefined, countries)
    if (res.code === 200 && res.data) {
      return res.data
    }
    return [] as StepSatellite[]
  })()

  satelliteStepLoading.set(cacheKey, promise)

  try {
    const data = await promise
    satelliteStepCache.set(cacheKey, data)
    return data
  } finally {
    satelliteStepLoading.delete(cacheKey)
  }
}
// 恢复高亮（对可能不存在的属性做保护）
const resetHighlightSatellites = (viewer: Cesium.Viewer) => {
  if (!viewer || !viewer.entities || !Array.isArray(viewer.entities.values)) return
  const allEntities = viewer.entities.values.filter((e) => typeof e.id === 'string' && e.id.startsWith('satellite-'))
  allEntities.forEach((s) => {
    try {
      if (s.point) {
        s.point.pixelSize = new Cesium.ConstantProperty(8)
        s.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE)
      }
      if (s.path) {
        s.path.show = new Cesium.CallbackProperty(() => false, false)
      }
    } catch (e) {
      // 忽略单个实体设置错误，继续处理其他实体
    }
  })
}
// 可以打击且在当前4D视图中显示的卫星Id集合
const strikeSateIds = ref<Set<string> | null>(null)
// 卫星请求ID自增计数器，每次发起新的卫星数据加载请求时递增，确保每个请求都有唯一的 ID
let satelliteLoadRequestId = 0
// 使用 WeakMap 存储每个 viewer 的最新加载请求 ID，避免全局变量冲突和内存泄漏
const satelliteLoadTokens = new WeakMap<Cesium.Viewer, number>()
// 判断当前加载的卫星数据是否是最新的请求，避免过时数据覆盖
const isLatestSatelliteLoad = (view: Cesium.Viewer, requestId: number) => {
  return satelliteLoadTokens.get(view) === requestId
}

// 高亮卫星（仅针对传入的 viewer）
const setCanStrikeSateIds = (viewer: Cesium.Viewer, sates: Partial<SatelliteStrike>[] | undefined) => {
  if (!viewer) return
  // 只重置当前 viewer 的卫星高亮
  resetHighlightSatellites(viewer)

  if (!sates || sates.length === 0) return

  // 规范化要高亮的 norad id 列表为字符串形式
  const norads = sates.map((s) => String(s.norad_id))

  if (!viewer.entities || !Array.isArray(viewer.entities.values)) return
  const allEntities = viewer.entities.values.filter((e) => typeof e.id === 'string' && e.id.startsWith('satellite-'))

  //直接计算 传入的 norad 是否在当前 entity 中，避免多层循环
  const noradSet = new Set(norads)
  const noradView4DSet = new Set(
    viewer === view4D ? allEntities.map((ent) => String(ent.id).replace(/^satellite-/, '')) : [] // 只有在 view4D 中才构建这个 Set，优化性能
  )
  // 计算 noradSet 和 noradView4DSet的交集
  const intersectionSet = new Set([...noradSet].filter((id) => noradView4DSet.has(id)))
  if (intersectionSet.size === 0) {
    ElMessage.warning('没有监测到蓝方有抵近、轨道共面、轨道相似的卫星')
    return
  } else {
    strikeSateIds.value = intersectionSet
    // 天对天模式直接高亮该卫星
    if (selectedMode.value === '天对天') {
      strikeSateIds.value.forEach((sid) => {
        highlightSatellite(viewer, sates?.find((s) => String(s.norad_id) === sid) as SatelliteStrike)
      })
      return
    }
  }
}
// 获取任务内过境卫星并首次渲染到地图，后续只通过阶段切换控制显隐
const loadSatellites = async (view: Cesium.Viewer, countries: string[], camp: string) => {
  const requestId = ++satelliteLoadRequestId
  satelliteLoadTokens.set(view, requestId)
  // 获取当前阶段过境卫星数据（优先使用缓存）
  const stepsSatellites = await ensureBattleSegmentSatellites(countries, camp)
  if (!isLatestSatelliteLoad(view, requestId)) return
  // 保存当前 viewer 自己的阶段卫星数据，避免互相覆盖
  viewerStepSatellites.set(view, stepsSatellites)
  // 提取任务内全部过境卫星的 NORAD ID 列表
  const norIds = getAllStepNoradIds(stepsSatellites)
  if (norIds.length === 0) {
    ElMessage.warning('当前任务没有过境卫星')
    return
  }

  // 首次渲染时创建全部卫星实体
  await renderSateliiteOfTask(view, store.activedTask!.id!, camp, norIds, requestId)
  if (!isLatestSatelliteLoad(view, requestId)) return
  syncSatelliteVisibility(view, currentSegment.value)
}

// 渲染卫星（根据任务ID和筛选条件获取卫星数据，并在地图上显示）
const renderSateliiteOfTask = async (
  view: Cesium.Viewer,
  taskId: number,
  namespace?: string,
  norIds?: string[],
  requestId?: number
) => {
  if (!view) return
  if (taskId) {
    const res = await getTLEDataByTaskId(taskId)
    if (requestId !== undefined && !isLatestSatelliteLoad(view, requestId)) return

    if (res.code === 200 && res.data) {
      let satelliteList = res.data.results.filter((s) => {
        return norIds!.includes(s.norad_id)
      })
      let norads: number[] = []
      if (satelliteList) {
        // 保存任务相关的所有卫星，网络安全使用
        store.saveTaskSatellite(satelliteList)
        norads = satelliteList.map((s) => Number(s.norad_id))
        // 获取TLE真实数据
        const tleDataRes = await getSatelliteTLEData({ norads })
        if (requestId !== undefined && !isLatestSatelliteLoad(view, requestId)) return

        if (tleDataRes.code === 200) {
          for (let index = 0; index < satelliteList.length; index++) {
            if (requestId !== undefined && !isLatestSatelliteLoad(view, requestId)) return

            const satel = satelliteList[index]
            if (!satel) {
              continue
            } else {
              //检测satellite.js库是否可用
              if (!satellitejs) {
                continue
              }
              const { name_en, norad_id, orbit_type } = satel

              let tleData = tleDataRes.data.find((s) => s.noradId === Number(norad_id))?.satelliteTleResp

              // 缺少TLE数据
              if (!tleData || !tleData.line1 || !tleData.line2) {
                continue
              }
              const satrec = satellitejs.twoline2satrec(tleData.line1, tleData.line2)
              // TLE数据解析失败
              if (!satrec) {
                continue
              }

              // 生成多个周期的轨道数据，支持周期小于一天的卫星持续显示
              const positionProperty = new Cesium.SampledPositionProperty()

              const startTime = view4D.clock.currentTime
              // 2分钟步长（原来1分钟），大幅减少采样点数量
              const timeStep = 120
              //低轨90分钟 中轨12小时 其他（高轨|大椭圆）24小时
              const singleOrbitPeriod = orbit_type === 1 ? 90 * 60 : orbit_type === 2 ? 12 * 3600 : 24 * 3600

              // 计算需要生成多少个完整周期来覆盖24小时（最小2个周期）
              const totalPeriods = Math.max(2, Math.ceil((24 * 3600) / singleOrbitPeriod))
              // 生成轨道模拟数据
              for (let period = 0; period < totalPeriods; period++) {
                const periodStartTime = Cesium.JulianDate.addSeconds(
                  startTime,
                  period * singleOrbitPeriod,
                  new Cesium.JulianDate()
                )
                for (let i = 0; i <= singleOrbitPeriod; i += timeStep) {
                  const time = Cesium.JulianDate.addSeconds(periodStartTime, i, new Cesium.JulianDate())
                  try {
                    const positionAndVelocity = satellitejs.propagate(satrec, Cesium.JulianDate.toDate(time))
                    if (positionAndVelocity && positionAndVelocity.position) {
                      const positionEci = positionAndVelocity.position
                      // 判断当前视图是否处于惯性系
                      const useInertial = isInertialView(view)
                      if (useInertial) {
                        // 如果是惯性系，直接使用ECI坐标（转换为米）
                        positionProperty.addSample(
                          time,
                          new Cesium.Cartesian3(positionEci.x * 1000, positionEci.y * 1000, positionEci.z * 1000)
                        )
                      } else {
                        // 如果是固定地球的视图，需要将ECI坐标转换为ECEF坐标
                        const gmst = satellitejs.gstime(Cesium.JulianDate.toDate(time)) // 计算格林威治恒星时
                        let positionEcf = satellitejs.eciToEcf(positionEci, gmst) // 转换为ECEF坐标
                        if (positionEcf) {
                          positionProperty.addSample(
                            time,
                            new Cesium.Cartesian3(
                              positionEcf.x * 1000, // 转换为米
                              positionEcf.y * 1000,
                              positionEcf.z * 1000
                            )
                          )
                        }
                      }
                    }
                  } catch (error) {
                    console.log(error)
                  }
                }
              }

              // 检查实体是否已存在（带前缀）
              const existingEntity = view.entities.getById(`satellite-${norad_id}`)
              if (existingEntity) {
                continue
              }
              // 创建卫星实体（id 带前缀）
              view.entities.add({
                id: `satellite-${norad_id}`,
                name: name_en,
                availability: new Cesium.TimeIntervalCollection([
                  new Cesium.TimeInterval({ start: view.clock.startTime, stop: view.clock.stopTime }), // 可用时间区间
                ]),

                position: positionProperty,
                show: true, // 默认显示，后续通过筛选控制可见性

                point: {
                  pixelSize: 8,
                  color: (() => {
                    const country = String(satel.country || '')
                    const isOur = namespace === 'our' || ourCountries.value.includes(country)
                    return isOur ? Cesium.Color.RED : Cesium.Color.BLUE
                  })(),
                  outlineColor: Cesium.Color.WHITE,
                  outlineWidth: 2,
                  heightReference: Cesium.HeightReference.NONE,
                  show: true, // 点的可见性
                },
                label: {
                  text: name_en,
                  font: '12px sans-serif',
                  fillColor: Cesium.Color.WHITE,
                  outlineColor: Cesium.Color.BLACK,
                  outlineWidth: 2,
                  style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                  pixelOffset: new Cesium.Cartesian2(0, -20),
                  showBackground: true,
                  backgroundColor: new Cesium.Color(0, 0, 0, 0.3),
                  show: true, // 标签的可见性
                },
                // 卫星轨迹线
                path: {
                  show: false, // 2D视图默认显示轨迹，3D/4D视图默认隐藏轨迹
                  leadTime: singleOrbitPeriod * 2,
                  trailTime: 0,
                  width: 1,
                  material: new Cesium.PolylineGlowMaterialProperty({
                    glowPower: 0.2, // 发光强度
                    color: Cesium.Color.YELLOW, // 黄色轨迹
                  }),
                },
                description: `<div style="padding: 10px; font-family: inherit;background-color:white; color:  rgba(0, 0, 0, 0.7); border-radius: 8px;">
      <h3 style="color: #1890ff; margin: 0 0 10px 0;display:flex; justify-content: space-between; align-items:center;"><span>🛰️ ${satel.name_en}</span> ${createInfoBoxActionButton('详情', { norad: satel.norad_id })}</h3>
      <p><strong>NORAD:</strong> ${satel.norad_id} </p>
      <p><strong>卫星类型:</strong> ${satel.sat_type}</p>
      <p><strong>所属国家:</strong> ${satel.country}</p>
      <p><strong>威胁度:</strong> ${satel.strikeListResp?.threat_score.toFixed(4)}</p>
      <p><strong>可打击度:</strong> ${satel.strikeListResp?.kedaji_score.toFixed(4)}</p>
      <p><strong>综合评分:</strong> ${satel.strikeListResp?.overallScore?.toFixed(4)}</p>

      </div>
     `,
              })
            }
          }
        }
      }
    }
  }
}
// 根据选中的模式同步主视图的显示状态和惯性旋转控制
const syncMainViewMode = (mode: string) => {
  if (!view3D) return

  const targetMode = mode === '地对天' || mode === '天对地' ? Cesium.SceneMode.SCENE2D : Cesium.SceneMode.SCENE3D
  if (view3D.scene.mode !== targetMode) {
    if (targetMode === Cesium.SceneMode.SCENE2D) {
      view3D.scene.morphTo2D(0)
      window.setTimeout(() => {
        fitMainView2D()
      }, 0)
    } else {
      view3D.scene.morphTo3D(0)
    }
  }

  const enableView3D = mode === '天对天'
  const enableView4D = mode === '天对天' || mode === '地对天' || mode === '天对地'

  if (enableView3D) {
    rotationControl3D.value?.enable()
  } else {
    rotationControl3D.value?.disable()
  }

  if (enableView4D) {
    rotationControl4D.value?.enable()
  } else {
    rotationControl4D.value?.disable()
  }

  const view3DState = rotationControl3D.value?.isEnabled() ? '开启' : '关闭'
  const view4DState = rotationControl4D.value?.isEnabled() ? '开启' : '关闭'
  console.log(`当前惯性系状态 => view3D: ${view3DState}, view4D: ${view4DState}`)
}
// 适配2D视图的缩放和中心点，使其更好地展示卫星分布
const fitMainView2D = () => {
  if (!view3D || view3D.scene.mode !== Cesium.SceneMode.SCENE2D) return

  const viewCenter = new Cesium.Cartesian2(
    Math.floor(view3D.canvas.clientWidth / 2),
    Math.floor(view3D.canvas.clientHeight / 2)
  )
  const focusPoint = view3D.scene.camera.pickEllipsoid(viewCenter) || worldPosition
  if (!focusPoint) return

  const cameraDistance = Cesium.Cartesian3.distance(focusPoint, view3D.scene.camera.positionWC)
  const adjustedDistance = Math.max(500000, cameraDistance * 0.45)

  view3D.scene.camera.lookAtTransform(Cesium.Matrix4.IDENTITY, new Cesium.Cartesian3(0.0, 0.0, adjustedDistance))
  view3D.scene.requestRender()
}
//***********************************鹰眼图*********************************************************/
let view3D: Cesium.Viewer
let view2D: Cesium.Viewer
let view4D: Cesium.Viewer
const selectedMode = ref('地对天')
const isSceneReady = ref(false)

const loadAssetsByMode = async (mode: string) => {
  if (!view3D || !view4D) return

  if (mode === '地对天') {
    if (ourCountries.value.length) {
      view3D.entities.removeAll()
      await loadWeaponList(view3D, ourCountries.value, 'our')
      markBattleArea(view3D, store.battle, 4000000)
    }
    if (enemyCountries.value.length) {
      view4D.entities.removeAll()
      await loadSatellites(view4D, enemyCountries.value, 'enemy')
      markBattleArea(view4D, store.battle, 15000000)
    }
    if (view2D && enemyCountries.value.length) {
      view2D.entities.removeAll()
      await loadSatellites(view2D, enemyCountries.value, 'enemy')
    }
  } else if (mode === '天对地') {
    if (enemyCountries.value.length) {
      view3D.entities.removeAll()
      await loadWeaponList(view3D, enemyCountries.value, 'enemy')
      markBattleArea(view3D, store.battle, 4000000)
    }
    if (ourCountries.value.length) {
      view4D.entities.removeAll()
      await loadSatellites(view4D, ourCountries.value, 'our')
      markBattleArea(view4D, store.battle, 15000000)
    }
    if (view2D && ourCountries.value.length) {
      view2D.entities.removeAll()
      await loadSatellites(view2D, ourCountries.value, 'our')
    }
  } else {
    if (ourCountries.value.length) {
      view3D.entities.removeAll()
      await loadSatellites(view3D, ourCountries.value, 'our')
      markBattleArea(view3D, store.battle, 15000000)
    }
    if (enemyCountries.value.length) {
      view4D.entities.removeAll()
      await loadSatellites(view4D, enemyCountries.value, 'enemy')
      markBattleArea(view4D, store.battle, 15000000)
    }
    if (view2D) {
      view2D.entities.removeAll()
    }
  }
}

watch(selectedMode, async (newVal) => {
  // 场景未初始化完成时，不响应立即触发的模式监听，避免和 onMounted 初始加载互相覆盖
  if (!isSceneReady.value) return

  if (view3D && view4D) {
    // 重置时间控制器为当前阶段的开始时间
    syncClockAndStep('集结', view3D.clock)
    syncClockAndStep('集结', view4D.clock)
  }
  // 同步主视图模式和惯性旋转控制
  syncMainViewMode(newVal)
  // 获取统计信息
  getStatisticsOfTask()

  await loadAssetsByMode(newVal)

  if (view3D) syncSatelliteVisibility(view3D, currentSegment.value)
  if (view4D) syncSatelliteVisibility(view4D, currentSegment.value)
  if (view2D) syncSatelliteVisibility(view2D, currentSegment.value)
})
// 根据选中的模式动态计算 CSS 类名，用于调整不同模式下的配色方案
const selectedModeClass = computed(() => {
  if (selectedMode.value === '天对地') {
    return 'mode-air-to-ground'
  } else if (selectedMode.value === '天对天') {
    return 'mode-air-to-air'
  } else {
    // 地对天和天对天保持默认配色（地对天/天对天可以视为左红右蓝）
    return 'mode-ground-to-air'
  }
})

// 3D 视图惯性旋转控制（用于天对天模式）
const rotationControl3D = ref<EarthRotationController | null>(null)
const rotationControl4D = ref<EarthRotationController | null>(null)
// 判断当前视图是否处于惯性旋转模式（即天对天模式下的旋转状态）
const isInertialView = (viewer: Cesium.Viewer) => {
  if (viewer === view3D) {
    return rotationControl3D.value?.isEnabled() ?? false
  }
  if (viewer === view4D) {
    return rotationControl4D.value?.isEnabled() ?? false
  }
  return false
}

// 时间控制变量
const playbackSpeed = ref(100.0)
// 是否开启动画
const showView2D = ref(false)
// 监听当前阶段变化，更新动画阶段，并同步时钟和卫星显示状态
watch(currentSegment, async (newVal: string) => {
  if (!newVal) return

  // 同步时钟到当前阶段开始时间
  if (view3D) syncClockAndStep(newVal, view3D.clock)
  if (view4D) syncClockAndStep(newVal, view4D.clock)
  if (view2D) syncClockAndStep(newVal, view2D.clock)

  try {
    if (view3D) syncSatelliteVisibility(view3D, newVal)
    if (view4D) syncSatelliteVisibility(view4D, newVal)
    if (view2D) syncSatelliteVisibility(view2D, newVal)
    if (view3D) view3D.scene.requestRender()
    if (view4D) view4D.scene.requestRender()
    if (view2D) view2D.scene.requestRender()
  } catch (e) {
    console.warn('sync satellites on segment change failed', e)
  }
})

const weapons = ref<Weapon[]>([])
const weaponsTreeData = ref<any[]>([])
const weaponTreeRef = ref<any>(null)
const selectedWeapons = ref<Weapon[]>([])
const selectedWeaponTypeMap = computed<Record<string, number>>(() => {
  return selectedWeapons.value.reduce<Record<string, number>>((acc, weapon) => {
    const weaponType = weapon.type || '未知'
    acc[weaponType] = (acc[weaponType] || 0) + 1
    return acc
  }, {})
})
const treeProps = {
  children: 'children',
  label: 'label',
}
// 构建武器树数据结构，按照类型和国家分层，最终叶子节点为具体武器
const buildWeaponsTree = () => {
  const typeCountryMap: Record<string, Record<string, Weapon[]>> = {}
  for (const w of weapons.value) {
    if (!w.type || !w.country) continue
    if (!typeCountryMap[w.type]) typeCountryMap[w.type] = {}
    if (!typeCountryMap[w.type][w.country]) typeCountryMap[w.type][w.country] = []
    typeCountryMap[w.type][w.country].push(w)
  }

  const tree: any[] = []
  for (const [type, countryMap] of Object.entries(typeCountryMap)) {
    const typeNode: any = {
      id: `type-${type}`,
      label: type,
      children: [],
    }
    for (const [country, list] of Object.entries(countryMap)) {
      typeNode.children.push({
        id: `type-${type}-country-${country}`,
        label: country,
        children: list.map((weapon) => ({
          id: `weapon-${weapon.id}`,
          label: `${weapon.name}(${weapon.country})`,
          kind: 'weapon',
          weapon,
        })),
      })
    }
    tree.push(typeNode)
  }

  weaponsTreeData.value = tree
}

const loadWeaponList = async (view: Cesium.Viewer, countries: string[], camp: string) => {
  const res = await getTaskWeapons(store.activedTask?.id!, countries)
  if (res.code === 200) {
    weapons.value = res.data.weapons
    buildWeaponsTree()
    if (weapons.value && weapons.value.length) {
      loadWeapons(view, weapons.value, camp)
    }
  }
}

// 选中的武器
const selectedWeapon = ref<Weapon | null>()

const getWeaponsForSatellite = (sat: SatelliteStrike) => {
  if (!sat.weapons_window || !sat.weapons_window.length) {
    return selectedWeapons.value.map((w) => w.name).join(', ')
  }
  return sat.weapons_window.map((w) => w.name).join(', ')
}
/**
 * 高亮地图上对应的武器实体（仅针对传入的 weaponIds）
 * @param weaponIds 武器ID数组
 */
const highlightWeaponsOnMap = (weaponIds: (string | undefined)[]) => {
  const realIds = weaponIds.filter((id): id is string => !!id)
  const viewers = [view3D, view4D, view2D].filter((v): v is Cesium.Viewer => !!v)
  viewers.forEach((viewer) => {
    resetHighlightWeapons(viewer)
    realIds.forEach((weaponId) => {
      const ent = viewer.entities.getById(`weapon-${weaponId}`)
      if (ent && ent.point) {
        ent.point.pixelSize = new Cesium.ConstantProperty(20)
        ent.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.YELLOW)
      }
    })
  })
}
/**
 * 只处理叶子节点（武器节点）的选中状态，父节点（类型/国家）不直接对应武器实体，不进行高亮处理
 * 这样可以避免父节点选中时引起的子节点多次触发
 */
const selectWeaponsFromTree = () => {
  const checkedNodes = weaponTreeRef.value?.getCheckedNodes?.() || []
  selectedWeapons.value = (checkedNodes as any[]).filter((n) => n.kind === 'weapon' && n.weapon).map((n) => n.weapon)
  selectedWeapon.value = selectedWeapons.value[0] || null
  const selectedIds = selectedWeapons.value.map((w) => w.id)
  highlightWeaponsOnMap(selectedIds)
}
/**
 * 同步树组件的选中状态到地图高亮，避免父节点选中引起的多次触发（只处理最终选中的武器ID）
 * @param weaponIds 武器ID数组
 */
const syncTreeSelection = (weaponIds: (string | undefined)[]) => {
  const realIds = weaponIds.filter((id): id is string => !!id)
  if (weaponTreeRef.value?.setCheckedKeys) {
    const keys = realIds.map((id) => `weapon-${id}`)
    // 标记为程序化更新，避免随后触发的 check-change 防抖回调重复调用接口
    programmaticCheckChange = true
    weaponTreeRef.value.setCheckedKeys(keys)
  }
  selectWeaponsFromTree()
}

// 防抖：聚合 el-tree 多次触发（父节点触发会引起子节点多次触发）
let checkChangeTimer: ReturnType<typeof setTimeout> | null = null
// 标记是否为程序化（代码）触发的树节点更新，用以避免重复触发接口调用
let programmaticCheckChange = false
const handleWeaponTreeCheckChange = () => {
  if (checkChangeTimer) {
    clearTimeout(checkChangeTimer)
    checkChangeTimer = null
  }
  // 等待 150ms 聚合可能的连续触发，再统一处理一次
  checkChangeTimer = setTimeout(async () => {
    // 只处理叶子节点（selectWeaponsFromTree 内部已过滤 kind==='weapon'）
    selectWeaponsFromTree()
    const selectedIds = selectedWeapons.value.map((w) => w.id)
    highlightWeaponsOnMap(selectedIds)
    const names = selectedWeapons.value.map((w) => w.name).filter(Boolean)

    // 如果本次变更是由代码（如地图点击时通过 syncTreeSelection）触发的程序化更新，
    // 则跳过本次由防抖触发的接口调用（点击处理会主动调用一次）。
    if (programmaticCheckChange) {
      programmaticCheckChange = false
      checkChangeTimer = null
      return
    }

    await loadSelectedWeaponStrike(names.length ? names : undefined)
    checkChangeTimer = null
  }, 150)
}
/**
 * 根据选中的武器名称加载可打击卫星数据，并更新地图高亮和右侧列表展示
 * @param weaponNames 武器名称数组
 */
const loadSelectedWeaponStrike = async (weaponNames?: string[]) => {
  const taskId = store.activedTask?.id
  if (!taskId) return

  const names = weaponNames?.filter(Boolean) || selectedWeapons.value.map((w) => w.name).filter(Boolean)
  if (!names.length) {
    satelliteStrike.value = []
    total.value = 0
    strikeSateIds.value = new Set<string>()
    satelliteStrikeInfo.value = []
    resetHighlightSatellites(view4D)
    return
  }
  const namesParam = names.join(',')
  const results = await getStrikeSatellites(taskId, 1, 10000, namesParam)

  const merged = new Map<string, SatelliteStrike>()

  if (results.code !== 200 || !results.data?.content) return
  results.data.content.forEach((item: SatelliteStrike) => {
    if (!item.norad_id) return
    if (!merged.has(item.norad_id)) {
      merged.set(item.norad_id, item)
    } else {
      const existing = merged.get(item.norad_id)
      if (existing) {
        existing.weapons_window = [...(existing.weapons_window || []), ...(item.weapons_window || [])]
      }
    }
  })

  satelliteStrike.value = Array.from(merged.values())
  total.value = satelliteStrike.value.length
  strikeSateIds.value = new Set(satelliteStrike.value.map((s) => s.norad_id))

  // 更新可打击信息列表（右侧展示）
  satelliteStrikeInfo.value = satelliteStrike.value.map((sat) => ({
    weapon: getWeaponsForSatellite(sat),
    satellite: sat.name_en,
    timeWindow: sat.optimal_time_window || '',
  }))

  // 高亮选中可打击卫星
  setCanStrikeSateIds(view4D, satelliteStrike.value)
}

const getSelectedWeaponNames = () => {
  const names = selectedWeapons.value.map((w) => w.name).filter(Boolean)
  return names.length ? names : selectedWeapon.value?.name ? [selectedWeapon.value.name] : []
}

// 监听鼠标左键点击事件并处理实体选择
function handleViewerClickEvent(viewer: Cesium.Viewer) {
  viewer.screenSpaceEventHandler.setInputAction(async function (event: Cesium.ScreenSpaceEventHandler.PositionedEvent) {
    const picked = viewer.scene.pick(event.position)
    if (!Cesium.defined(picked)) {
      return
    }

    const entity = picked.id
    if (!entity || !entity._id) return

    // 设置选中的实体，触发 Cesium 的默认选中行为（如显示信息框）
    viewer.selectedEntity = entity
    if (entity._id.startsWith('satellite-')) {
      const noradId = entity._id.split('satellite-')[1]
      const res = await getSatelliteRelationsBySatellite(noradId, store.activedTask?.id!)
      if (res.code === 200 && res.data) {
        const satelliteIds = res.data.nodes.map((n) => ({ norad_id: String(n.norad) }))
        if (satelliteIds.length) {
          resetHighlightSatellites(viewer)
          // 高亮点击的卫星
          highlightSatellite(viewer, {
            norad_id: noradId,
            name_en: entity.name || '',
          } as SatelliteStrike)
          // 在敌方视图中高亮可打击卫星
          setCanStrikeSateIds(view4D, satelliteIds)
        } else {
          ElMessage.warning('未找到对应卫星信息')
        }
      } else {
        ElMessage.warning('获取卫星关系数据失败')
      }
      return
    }

    if (entity._id.startsWith('weapon-')) {
      const _id = entity._id.split('weapon-')[1]
      const weapon = weapons.value.find((s) => s.id === _id)
      if (weapon) {
        const alreadySelected = selectedWeapons.value.some((s) => s.id === weapon.id)
        if (alreadySelected) {
          // 取消选中
          selectedWeapons.value = []
          selectedWeapon.value = null
          if (weaponTreeRef.value?.setCheckedKeys) {
            weaponTreeRef.value.setCheckedKeys([])
          }
          resetHighlightWeapons(view3D)
          resetHighlightWeapons(view4D)
          satelliteStrike.value = []
          total.value = 0
          strikeSateIds.value = new Set<string>()
          satelliteStrikeInfo.value = []
        } else {
          selectedWeapon.value = weapon
          selectedWeapons.value = [weapon]
          const weaponId = weapon.id
          if (weaponId) {
            // 同步左侧武器树组件的选中状态，避免重复接口调用（check-change 内部已防抖处理）
            syncTreeSelection([weaponId])
            highlightWeaponsOnMap([weaponId])
          } else {
            highlightWeaponsOnMap([])
          }
          await loadSelectedWeaponStrike([weapon.name])
        }
      } else {
        ElMessage.warning('未找到对应武器信息')
      }
      return
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}
// 可打击卫星
const satelliteStrike = ref<SatelliteStrike[]>([])
const total = ref(0)
/**
 * 重置地图上所有武器实体的高亮状态（仅针对传入的 viewer），避免直接修改实体属性引起的性能问题
 * @param viewer
 */
const resetHighlightWeapons = (viewer: Cesium.Viewer) => {
  if (!viewer || !viewer.entities || !Array.isArray(viewer.entities.values)) return
  const allEntities = viewer.entities.values.filter((e) => typeof e.id === 'string' && e.id.startsWith('weapon-'))
  allEntities.forEach((s) => {
    try {
      if (s.point) {
        s.point.pixelSize = new Cesium.ConstantProperty(8)
        s.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE)
      }
    } catch (e) {
      // 忽略单个实体设置错误，继续处理其他实体
    }
  })
}

// 在地图上加载武器实体
function loadWeapons(view: Cesium.Viewer, weapons: Weapon[], camp: string) {
  for (const weapon of weapons) {
    // 创建武器实体。使用小高度偏移并设置为 NONE，避免异步地形 clamp 导致标签位置计算错误
    const ALT_OFFSET = 1000 // 高度偏移（米）
    const position = Cesium.Cartesian3.fromDegrees(weapon.longitude!, weapon.latitude!, ALT_OFFSET)
    const hpr = new Cesium.HeadingPitchRoll(
      Cesium.Math.toRadians(0),
      Cesium.Math.toRadians(90),
      Cesium.Math.toRadians(-90)
    )
    // 如果实体已存在，更新其信息并跳过添加，避免重复添加同 id 实体导致错误
    try {
      const existing = view.entities.getById(`weapon-${weapon.id}`)
      if (existing) {
        try {
          ; (existing as any).position = position
            ; (existing as any).orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr)
            ; (existing as any).point = {
              pixelSize: 8,
              outlineWidth: 2,
              outlineColor: Cesium.Color.WHITE,
              color: camp === 'our' ? Cesium.Color.RED.withAlpha(0.5) : Cesium.Color.BLUE.withAlpha(0.5),
              heightReference: Cesium.HeightReference.NONE,
            }
            ; (existing as any).label = {
              text: weapon.name,
              font: '12px sans-serif',
              fillColor: Cesium.Color.WHITE,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, 20),
              heightReference: Cesium.HeightReference.NONE,
            }
            ; (existing as any).description =
              `<div style="padding: 10px; font-family: inherit;background-color:white; color:  rgba(0, 0, 0, 0.7); border-radius: 8px;">
      <h3 style="color: #1890ff; margin: 0 0 10px 0;">🛰️ ${weapon.name}</h3>
      <p><strong>武器类型:</strong> ${weapon.type}</p>
      <p><strong>所属国家:</strong> ${weapon.country}</p>
      <p><strong>打击高度:</strong> ${weapon.range} km</p>
      </div>
     `
        } catch (e) {
          // ignore single entity update error
        }
        continue
      }
    } catch (e) {
      // ignore getById errors and proceed to add
    }

    view.entities.add({
      id: `weapon-${weapon.id}`,
      name: weapon.name,
      position: position,
      orientation: Cesium.Transforms.headingPitchRollQuaternion(position, hpr),
      point: {
        pixelSize: 8,
        outlineWidth: 2,
        outlineColor: Cesium.Color.WHITE,
        color: camp === 'our' ? Cesium.Color.RED.withAlpha(0.5) : Cesium.Color.BLUE.withAlpha(0.5),
        heightReference: Cesium.HeightReference.NONE,
      },
      label: {
        text: weapon.name,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, 20),
        heightReference: Cesium.HeightReference.NONE, // 使用绝对高度，避免地形异步 clamp 导致位置错位
      },
      description: `<div style="padding: 10px; font-family: inherit;background-color:white; color:  rgba(0, 0, 0, 0.7); border-radius: 8px;">
      <h3 style="color: #1890ff; margin: 0 0 10px 0;">🛰️ ${weapon.name}</h3>
      <p><strong>武器类型:</strong> ${weapon.type}</p>
      <p><strong>所属国家:</strong> ${weapon.country}</p>
      <p><strong>打击高度:</strong> ${weapon.range} km</p>
      </div>
     `,
    })
  }
  // 请求一次场景重绘，避免标签/点因延迟计算出现错位
  try {
    view.scene.requestRender()
  } catch (e) {
    // ignore
  }
}
function showDetail(norad: number) {
  if (isFinite(norad)) {
    openSatelliteProfile(norad)
  }
}
const segments = ref<string[]>([])
onMounted(() => {
  const clockViewModel = new Cesium.ClockViewModel()

  const options3D = {
    homeButton: false,
    geocoder: false,
    fullscreenButton: false,
    baseLayerPicker: false, // 关闭底图选择器
    navigationHelpButton: false, // 关闭帮助按钮
    sceneModePicker: false,
    clockViewModel: clockViewModel,
    creditContainer: creditEl3D.value || undefined,
    imageryProvider: false, // ✅ 禁用默认底图
    animation: true,
    timeline: true,
    infoBox: true, //打开信息框
  }
  const options2D = {
    homeButton: false,
    fullscreenButton: false,
    sceneModePicker: false,
    baseLayerPicker: false, // 关闭底图选择器
    clockViewModel: clockViewModel,
    infoBox: false,
    geocoder: false,
    sceneMode: Cesium.SceneMode.SCENE2D,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    creditContainer: creditEl2D.value || undefined,
    imageryProvider: false, // ✅ 禁用默认底图
  }
  const options4D = {
    homeButton: false,
    geocoder: false,
    fullscreenButton: false,
    baseLayerPicker: false, // 关闭底图选择器
    navigationHelpButton: false, // 关闭帮助按钮
    sceneModePicker: false,
    clockViewModel: clockViewModel,
    creditContainer: creditEl4D.value || undefined,
    imageryProvider: false, // ✅ 禁用默认底图
    animation: true,
    timeline: true,
  }

  const view3DEl = document.getElementById('view3D')
  const view2DEl = document.getElementById('view2D')
  const view4DEl = document.getElementById('view4D')
  if (!view3DEl || !view2DEl || !view4DEl) {
    console.error('Cesium container is missing, skip viewer initialization')
    return
  }

  // 确保容器相对定位，以便浮动 2D 视图定位在右下角
  const cesiumContainer = document.getElementById('cesiumContainer')
  if (cesiumContainer) {
    cesiumContainer.style.position = 'relative'
  }

  view3D = new Cesium.Viewer(view3DEl, options3D)
  view2D = new Cesium.Viewer(view2DEl, options2D)
  view4D = new Cesium.Viewer(view4DEl, options4D)

  // 关闭默认双击追踪（保持相机不动）
  view3D.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  view2D.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  view4D.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  syncMainViewMode(selectedMode.value)

  // 添加底图
  view2D.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: `${MATERIAL_URL}/{z}/{x}/{y}.png`, // 瓦片 URL 模板
      credit: 'credit', // 版权信息
    })
  )
  // 添加底图
  view3D.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: `${MATERIAL_URL}/{z}/{x}/{y}.png`, // 瓦片 URL 模板
      credit: 'credit', // 版权信息,
    })
  )
  // 添加底图
  view4D.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: `${MATERIAL_URL}/{z}/{x}/{y}.png`, // 瓦片 URL 模板
      credit: 'credit', // 版权信息,
    })
  )
  // 时间控制
  if (store.activedTask == null) return
  formatTimeLine(view3D)
  formatTimeLine(view4D)

  sync2DView()
  // Apply our sync function every time the 4D camera view changes
  view4D.camera.changed.addEventListener(sync2DView)
  // By default, the `camera.changed` event will trigger when the camera has changed by 50%
  // To make it more sensitive, we can bring down this sensitivity
  view4D.camera.percentageChanged = 0.01

  // 转换参考系
  rotationControl4D.value = new EarthRotationController(view4D)
  rotationControl4D.value.enable()
  // 3d 只初始化
  rotationControl3D.value = new EarthRotationController(view3D)
  rotationControl3D.value.enable()
  syncMainViewMode(selectedMode.value)
  // Since the 2D view follows the 3D view, we disable any
  // camera movement on the 2D view
  view2D.scene.screenSpaceCameraController.enableRotate = false
  view2D.scene.screenSpaceCameraController.enableTranslate = false
  view2D.scene.screenSpaceCameraController.enableZoom = false
  view2D.scene.screenSpaceCameraController.enableTilt = false
  view2D.scene.screenSpaceCameraController.enableLook = false

  // 开始加载资源
  // 监听3D视图鼠标点击
  handleViewerClickEvent(view3D)

  // 绑定信息框按钮事件（使用事件委托方式，避免每个实体都绑定一次）
  bindInfoBoxButton(view4D, {
    handler: ({ button }) => {
      const norad = Number(button.dataset.norad)
      if (!Number.isFinite(norad)) return
      showDetail(norad)
    },
  })
  // 获取统计信息
  getStatisticsOfTask()
  if (store.activedTask) {
    // 加载作战阶段和当前时间
    const steps = JSON.parse(store.activedTask.steps) as TaskSteps[]
    if (steps && steps.length) {
      // 作战阶段
      segments.value = steps.map((s) => s.name)
      currentSegment.value = segments.value[0]
    }
  }

  isSceneReady.value = true
  void loadAssetsByMode(selectedMode.value)

  // 默认开启动画
  showView2D.value = true
})

const statistics = ref<RedBlueStatistics>()
// 获取当前作战阶段的统计信息
async function getStatisticsOfTask() {
  if (!store.activedTask) return
  const res = await getRedBlueStatistics({ model: selectedMode.value, taskId: store.activedTask.id ?? 0 })
  if (res.code === 200 && res.data) {
    statistics.value = res.data
  }
}

// 设置动画和时间轴
function formatTimeLine(view: Cesium.Viewer = view3D) {
  const beginTime = new Date(store.activedTask!.beginDate)
  const endTime = new Date(store.activedTask!.endDate)

  const isoUTCStartTime = beginTime.toISOString() // 已经减 8 h 转成 UTC 字符串
  const startTime = Cesium.JulianDate.fromIso8601(isoUTCStartTime)
  const isoUTCStopTime = endTime.toISOString() // 已经减 8 h 转成 UTC 字符串
  const stopTime = Cesium.JulianDate.fromIso8601(isoUTCStopTime)

  // 设置时间轴的显示范围
  view.timeline.zoomTo(startTime, stopTime)
  view.clock.startTime = startTime.clone()
  view.clock.stopTime = stopTime.clone()
  view.clock.currentTime = startTime.clone()
  view.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  // 监听时间变化
  view.clock.onTick.addEventListener(() => {
    updateCurrentTimeInfo(view)
  })
  view.clock.multiplier = playbackSpeed.value
  view.clock.shouldAnimate = true
  // 格式化时间轴和动画控件显示
  formatTimeLineAndAnimation(view)
}
let worldPosition: Cesium.Cartesian3 | undefined
let distance = 0
// 同步 2D 视角到 4D 视角的焦点位置
function sync2DView() {
  if (!view2D || !view4D) return
  // 获取 4D 视图的中心像素位置
  const viewCenter = new Cesium.Cartesian2(
    Math.floor(view4D.canvas.clientWidth / 2),
    Math.floor(view4D.canvas.clientHeight / 2)
  )
  // 将中心像素位置转换为地球表面的世界坐标
  const newWorldPosition = view4D.scene.camera.pickEllipsoid(viewCenter)
  if (Cesium.defined(newWorldPosition)) {
    // 更新全局焦点位置
    worldPosition = newWorldPosition
  }
  if (!worldPosition) return
  // 获取焦点位置与相机位置之间的距离
  distance = Cesium.Cartesian3.distance(worldPosition, view4D.scene.camera.positionWC)
  // 调整距离以适应 2D 视图的缩放需求（根据实际情况调整这个系数）
  const adjustedDistance = distance
  // 将 2D 视图的相机位置设置在焦点位置上方一定距离处，并让相机朝向焦点位置
  view2D.scene.camera.lookAt(worldPosition, new Cesium.Cartesian3(0.0, 0.0, adjustedDistance))
}
onBeforeUnmount(() => {
  if (view3D) {
    // 移除点击监听
    view3D.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN)
  }
  if (view4D) {
    // 移除监听
    view4D.camera.changed.removeEventListener(sync2DView)
    view4D.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOWN)
    unbindInfoBoxButton(view4D)
  }

  // 清理防抖定时器
  if (checkChangeTimer) {
    clearTimeout(checkChangeTimer)
    checkChangeTimer = null
  }

  // 销毁旋转控制器
  if (rotationControl3D.value) {
    rotationControl3D.value.disable()
    rotationControl3D.value = null
  }
  if (rotationControl4D.value) {
    rotationControl4D.value.disable()
    rotationControl4D.value = null
  }
  // 停止动画
  view3D.clock.shouldAnimate = false
  if (view3D) {
    view3D.destroy()
  }
  if (view2D) {
    view2D.destroy()
  }
  if (view4D) {
    view4D.destroy()
  }

  // 清理程序化标记和防抖定时器
  programmaticCheckChange = false
  if (checkChangeTimer) {
    clearTimeout(checkChangeTimer)
    checkChangeTimer = null
  }
})
// 组织当前阶段可打击的卫星数据，并高亮显示 {当前武器}-{可打击卫星}-{时间窗口：开始时间-结束时间}
const satelliteStrikeInfo = ref<{ weapon: string; satellite: string; timeWindow: string }[]>([])

// 计算当前武器在当前时间是否可打击，并高亮显示可打击的卫星
function highlightStrikeableSatellites(viewer: Cesium.Viewer, currentTime: Date) {
  if (!satelliteStrike.value || satelliteStrike.value.length === 0) return
  if (!strikeSateIds.value || strikeSateIds.value.size === 0) return
  const selectedNames = new Set(getSelectedWeaponNames())
  if (selectedNames.size === 0) return
  const satelliteCanStrike = satelliteStrike.value.filter((s) => {
    return strikeSateIds.value?.has(s.norad_id)
  })
  if (satelliteCanStrike.length === 0) return

  for (const sat of satelliteCanStrike) {
    const strikeWindows = sat.weapons_window.filter((s) => selectedNames.has(s.name))
    if (!strikeWindows || strikeWindows.length === 0) continue
    // "strike_window": "2025-12-03T08:21:48.471265Z 至 2025-12-03T08:33:24.547352Z"
    const canStrike = strikeWindows.some((w) => {
      const [startStr, endStr] = w.strike_window.split('至').map((s) => s.trim())
      const start = new Date(startStr)
      const end = new Date(endStr)
      return currentTime >= start && currentTime <= end
    })
    if (canStrike) {
      highlightSatellite(viewer, sat)
      highlightSatellite(view2D!, sat)

      // 判断如果已经存在该卫星的打击信息，则不重复添加
      const exists = satelliteStrikeInfo.value.some(
        (info) => info.satellite === sat.name_en && info.weapon === strikeWindows.map((w) => w.name).join(', ')
      )
      if (exists) continue
      satelliteStrikeInfo.value.push({
        weapon: strikeWindows.map((w) => w.name).join(', '),
        satellite: sat.name_en || '',
        timeWindow: strikeWindows.map((w) => w.strike_window).join(', '),
      })
    } else {
      resetHighlightSatellite(viewer, sat)
      resetHighlightSatellite(view2D!, sat)
      satelliteStrikeInfo.value = satelliteStrikeInfo.value.filter((info) => info.satellite !== sat.name_en)
    }
  }
}
function highlightSatellite(viewer: Cesium.Viewer, sat: SatelliteStrike) {
  const entity = viewer.entities.getById(`satellite-${sat.norad_id}`)
  if (entity) {
    try {
      if (entity.point) {
        entity.point.pixelSize = new Cesium.ConstantProperty(20)
        entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.YELLOW)
      }
      if (entity.path) {
        entity.path.show = new Cesium.CallbackProperty(() => true, false)
      }
    } catch (e) {
      // 忽略单个实体设置错误
    }
  }
}

function resetHighlightSatellite(viewer: Cesium.Viewer, sat: SatelliteStrike) {
  const entity = viewer.entities.getById(`satellite-${sat.norad_id}`)
  if (entity) {
    try {
      if (entity.point) {
        entity.point.pixelSize = new Cesium.ConstantProperty(8)
        entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE)
      }
      if (entity.path) {
        entity.path.show = new Cesium.CallbackProperty(() => false, false)
      }
    } catch (e) {
      // 忽略单个实体设置错误，继续处理其他实体
    }
  }
}
// 根据当前时间实时更新阶段显示
const updateCurrentTimeInfo = (viewer?: Cesium.Viewer) => {
  if (viewer) {
    // 取出steps
    const stepsJSON = store.activedTask?.steps
    if (stepsJSON) {
      const steps = JSON.parse(stepsJSON) as TaskSteps[]
      taskSteps.value = steps
      if (steps && steps.length) {
        // 当前时间
        const currentTime = Cesium.JulianDate.toDate(viewer.clock.currentTime)
        // 高亮可打击的卫星
        highlightStrikeableSatellites(view4D, currentTime)
        // 根据 steps中的开始和结束时间判断当前是那个step
        try {
          const nowMs = currentTime.getTime()
          const stepFound = steps.find((s) => {
            const st = new Date(s.startTime)
            const et = new Date(s.endTime)
            return nowMs >= st.getTime() && nowMs <= et.getTime()
          })
          if (stepFound) {
            currentSegment.value = stepFound.name
          } else {
            const first = steps[0]
            const last = steps[steps.length - 1]
            if (first && nowMs < new Date(first.startTime).getTime()) {
              currentSegment.value = first.name
            } else if (last && nowMs > new Date(last.endTime).getTime()) {
              currentSegment.value = last.name
            } else {
              currentSegment.value = ''
            }
          }
        } catch (e) {
          console.warn('determine current step failed', e)
        }
      }
    }
  }
}
</script>
<style lang="scss" scoped>
.container {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 14px;

  .nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #06223d;
    padding: 10px;

    .nav-left {
      gap: 10px;
      display: flex;
      align-items: center;

      .title {
        color: #ccc;
      }

      .switch-bars {
        display: flex;
        gap: 10px;
        justify-content: space-between;
      }

      .timeline-panel {
        padding: 10px;
        border-radius: 5px;

        .timeline-controls {
          display: flex;
          gap: 2px;
          justify-content: center;
        }
      }
    }

    .select-box {
      display: flex;
      align-items: center;
      gap: 10px;
    }
  }

  #cesiumContainer {
    :deep(.atlas-app-splitter-bar__dragger::before, .atlas-app-splitter-bar__dragger::after) {
      background-color: transparent;
    }

    display: grid;
    grid-template-columns: 300px 1fr 1fr 300px;
    grid-template-rows: 60px 1fr;
    gap: 5px;
    // AI:
    // - 锁定在固定的视口高度范围内，避免 Cesium Canvas 和 CSS Grid 循环触发 Resize 导致页面无限向下滚动
    // - 内部侧边栏带有独立 overflow: auto 供列表滚动
    height: calc(100vh - 152px);
    overflow: hidden;

    &.not-animating {

      /* 动画关闭时：隐藏 view2D，仅显示 view3D + view4D 对半分 */
      #view2D {
        display: none !important;
      }

      #view4D {
        height: 100% !important;
      }
    }

    .left-top-bar {
      grid-column: 1/3;
      grid-row: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;

      div {
        height: 100%;
        background: linear-gradient(to bottom, #f75e61, #f16f71);
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        span:first-child {
          font-size: 18px;
          font-weight: bolder;
          margin-bottom: 5px;
        }
      }
    }

    .left-workbench {
      grid-column: 1/3;
      grid-row: 2;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }

    .right-workbench {
      grid-column: 3/5;
      grid-row: 2;
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }

    .workbench-splitter {
      width: 100%;
      height: 100%;
      min-width: 0;
      min-height: 0;
    }

    .sidebar-panel,
    .main-panel {
      min-width: 0;
      min-height: 0;
      height: 100%;
      overflow: hidden;
    }

    .left-side-bar {
      height: 100%;
      overflow: auto;
      box-sizing: border-box;
      padding: 8px;

      .panel-title {
        font-size: 16px;
        font-weight: bold;
        color: #f75e61;
        margin-bottom: 8px;
        padding: 5px 0;
        background: rgba(247, 94, 97, 0.15);
      }

      :deep(.atlas-app-tree) {
        background-color: transparent;
      }
    }

    /* 天对地模式时，左红右蓝互换 */
    &.mode-air-to-ground {
      .left-top-bar div {
        background: linear-gradient(to bottom, #2ca6ff, #53aff1);
      }

      .left-side-bar .panel-title {
        color: #2ca6ff;
        background: rgba(44, 166, 255, 0.15);
      }

      .right-top-bar div {
        background: linear-gradient(to bottom, #f75e61, #f16f71);
      }

      .right-side-bar .panel-title {
        color: #f75e61;
        background: rgba(247, 94, 97, 0.15);
      }

      .right-side-bar .weapon-window-list {
        border-left: 2px solid rgba(247, 94, 97, 0.38);
      }
    }

    &.mode-air-to-air {
      grid-template-rows: 0px 1fr;
    }

    .left-panel {
      box-sizing: border-box;
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      height: 100%;
      padding: 5px 0 0 5px;
    }

    #view3D {
      flex: 1;
      min-width: 0;
      min-height: 0;
      height: 100%;

      .credit {
        display: none;
      }

      .animation-box {
        position: absolute;
        width: 200px;
        height: 200px;
        bottom: 30px;
        right: 3px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.2);
        z-index: 2000;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      }
    }

    .right-top-bar {
      grid-column: 3/5;
      grid-row: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;

      div {
        height: 100%;
        background: linear-gradient(to bottom, #2ca6ff, #53aff1);
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;

        span:first-child {
          font-size: 18px;
          font-weight: bolder;
          margin-bottom: 5px;
        }
      }
    }

    .right-side-bar {
      height: 100%;
      padding: 8px;
      overflow: auto;
      box-sizing: border-box;

      .panel-title {
        font-size: 16px;
        font-weight: bold;
        color: #2ca6ff;
        background: rgba(44, 166, 255, 0.15);
        margin-bottom: 8px;
        padding: 5px 0;
      }

      .satellite-list {
        max-height: calc(100vh - 165px - 110px - 35px);
        overflow-y: auto;
        text-align: left;

        .strike-window-list {
          margin-top: 4px;
          padding: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
      }

      .satellite-list ul {
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .satellite-list li {
        border-bottom: 1px solid rgba(255, 255, 255, 0.15);
        margin-bottom: 8px;
        padding-bottom: 8px;
        color: #eef3ff;
        font-size: 12px;
      }

      .satellite-list li>div {
        margin-bottom: 3px;
      }

      .weapon-window-list {
        margin-left: 6px;
        padding-left: 8px;
        border-left: 2px solid rgba(44, 166, 255, 0.38);
      }

      .weapon-window-list>div {
        margin-bottom: 2px;
        font-size: 12px;
        color: #c6d8ff;
      }

      .weapon-window-list>div .weapon-name {
        font-weight: bold;
        color: #a9cfff;
      }

      .weapon-window-list>div .strike-window {
        color: #ffffff;
      }
    }

    .right-panel {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      height: 100%;
    }

    #view4D {
      flex: 1;
      min-width: 0;
      min-height: 0;
      height: 100%;
      padding-top: 5px;
      box-sizing: border-box;
      position: relative;

      .credit {
        display: none;
      }

      .floating-view2d {
        position: absolute;
        width: 200px;
        height: 200px;
        bottom: 30px;
        right: 3px;
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.2);
        z-index: 2000;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
      }
    }

    #view2D {
      height: 100%;
      width: 100%;
      box-sizing: border-box;

      .credit {
        display: none;
      }
    }
  }
}
</style>
