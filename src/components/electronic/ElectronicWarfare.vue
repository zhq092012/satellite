<template>
  <div class="cema-dashboard dark-theme full-screen-cema">
    <!-- 当切换为 G6 视图模式时直接渲染 G6 视图组件 -->
    <ElectronicWarfareG6 v-if="viewMode === 'G6'" />

    <!-- 当切换为甘特图模式时直接渲染甘特图组件 -->
    <SatelliteGantt v-else-if="viewMode === 'GANTT'" :matrix-data="matrixData" />

    <!-- 3D 视图模式 -->
    <template v-else>
      <!-- Top Navigation Header -->
      <div class="cema-header">
        <div class="header-left">
          <span class="header-title glow-text">战术算法矩阵3D拓扑</span>
          <!-- 3D vs G6 vs GANTT 视图模式切换按钮 -->
          <div class="view-mode-toggle" style="margin-left: 15px">
            <el-radio-group v-model="viewMode" size="small">
              <el-radio-button value="3D">3D 矩阵拓扑</el-radio-button>
              <el-radio-button value="G6">G6 三层拓扑</el-radio-button>
              <el-radio-button value="GANTT">卫星击毁甘特图</el-radio-button>
            </el-radio-group>
          </div>
        </div>

        <!-- 烈度控制与四个矩阵Tab控制 -->
        <div class="header-center">
          <!-- 1. 交战烈度切换按钮组 (高中低烈度参数) -->
          <div class="intensity-group">
            <button
              v-for="level in intensityOptions"
              :key="level"
              class="nav-tab-btn"
              :class="{ active: currentIntensity === level }"
              @click="handleIntensityChange(level)"
            >
              {{ level }}
            </button>
          </div>

          <div class="v-divider"></div>

          <!-- 2. 四大矩阵视图切换 Tab 按钮组 -->
          <div class="matrix-tab-group">
            <button
              v-for="tab in matrixTabOptions"
              :key="tab.key"
              class="nav-tab-btn tab-matrix"
              :class="{ active: currentMatrixTab === tab.key }"
              @click="currentMatrixTab = tab.key"
            >
              {{ tab.name }}
            </button>
          </div>
        </div>

        <div class="header-right">
          <!-- 卫星系列 (series) 展示 -->
          <div class="header-right-item" v-if="matrixData?.series">
            <span class="label-text">卫星系列:</span>
            <span class="digital-font time-value glow-text-cyan">{{ matrixData.series }}</span>
          </div>
          <div class="header-right-item">
            <span class="label-text">当前任务:</span>
            <span class="digital-font time-value glow-text-cyan">{{ store.activedTask?.name || '实时推演场景' }}</span>
          </div>
        </div>
      </div>

      <!-- Central Main View: Full-screen 3D 3-Layer Topology -->
      <div class="cema-workspace single-workspace">
        <section class="main-3d-sandbox full-sandbox">
          <Battlefield3D :nodes="activeNodes" :links="activeLinks" />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useLayoutStore } from '@/store/modules/layout'
import { getMatrixList } from '@/api/electronic'
import type { MatrixResult, Weapon } from '@/api/electronic'
import Battlefield3D from '@/components/electronic/Battlefield3D.vue'
import ElectronicWarfareG6 from '@/components/electronic/ElectronicWarfareG6.vue'
import SatelliteGantt from '@/components/electronic/SatelliteGantt.vue'
import { parseLatLon } from '@/db/matrixAdapter'

const store = useLayoutStore()

// [变量用途]
// 拓扑视图类型 (3D 矩阵拓扑 vs G6 三层拓扑 vs 甘特图矩阵)
const viewMode = ref<'3D' | 'G6' | 'GANTT'>('3D')

// 交战烈度类型
type IntensityLevelType = '高烈度' | '中烈度' | '低烈度'
const intensityOptions: IntensityLevelType[] = ['高烈度', '中烈度', '低烈度']
const currentIntensity = ref<IntensityLevelType>('高烈度')

// [类型用途]
// 四大矩阵 Tab 视图类型定义
//
// [数据来源]
// 用于 ElectronicWarfare 顶部 3D 拓扑视图切换 Tab
//
// [取值规则]
// - INIT_PASS: 初始过境窗口
// - INIT_RELATION: 初始拓扑关联
// - SAT_MATRIX: 卫星打压延迟
// - STATION_RELATION: 最终拓扑关联
type MatrixTabType = 'INIT_PASS' | 'INIT_RELATION' | 'SAT_MATRIX' | 'STATION_RELATION'

// [变量用途]
// 四大矩阵 Tab 视图切换选项配置数组
//
// [数据来源]
// 前端 UI 预设四大矩阵选项
//
// [取值规则]
// 包含初始过境窗口、初始拓扑关联、卫星打压延迟、最终拓扑关联
const matrixTabOptions: { key: MatrixTabType; name: string }[] = [
  { key: 'INIT_PASS', name: '初始过境窗口' },
  { key: 'INIT_RELATION', name: '初始拓扑关联' },
  { key: 'SAT_MATRIX', name: '卫星打压延迟' },
  { key: 'STATION_RELATION', name: '最终拓扑关联' },
]

// [变量用途]
// 当前选中的矩阵 Tab key
//
// [数据来源]
// 默认设为 'INIT_PASS'
//
// [取值规则]
// MatrixTabType 枚举值
const currentMatrixTab = ref<MatrixTabType>('INIT_PASS')

// 矩阵数据与加载状态
const matrixData = ref<MatrixResult | null>(null)
const loading = ref(false)

/**
 * 调用后端 API 接口获取算法数据
 */
const fetchMatrixData = async () => {
  loading.value = true
  try {
    const matrixRes = await getMatrixList({
      norad: 57693,
      taskId: store.activedTask?.id || 0,
      intensityLevel: currentIntensity.value,
    })

    if (matrixRes.code !== 200 || !matrixRes.data) {
      ElMessage.error(`获取算法矩阵数据失败: ${matrixRes.msg || '网络异常'}`)
      return
    }

    matrixData.value = matrixRes.data
  } catch (err: any) {
    console.error('获取算法矩阵数据异常:', err)
    ElMessage.error(`获取算法矩阵数据失败: ${err.message || '网络异常'}`)
  } finally {
    loading.value = false
  }
}

/**
 * 切换交战烈度
 */
const handleIntensityChange = (level: IntensityLevelType) => {
  if (currentIntensity.value === level) return
  currentIntensity.value = level
  fetchMatrixData()
}

/**
 * 提取 3D 图所需的 3 层物理实体节点 (Sat, Station, Cmd, Weapons)
 */
/**
 * [功能说明]
 * 提取 3D 图所需的 3 层物理实体节点 (Layer 2: 天基卫星, Layer 1: 地面接收站, Layer 0: 中心云数据中心及红方阵地)
 *
 * [数据来源]
 * 算法接口返回数据中的 initMatrixList, satelliteMatrixList, initRelationList, stationRelationList
 *
 * [修改约束]
 * 确保各图层节点的 fz 高度定位严格遵循：Layer 2 (fz=150), Layer 1 (fz=0), Layer 0 (fz=-150)
 */
const activeNodes = computed(() => {
  if (!matrixData.value) return []
  const data = matrixData.value
  const nodeMap = new Map<string, any>()

  // 1. Layer 1 地面接收站与 Layer 0 中心云站 (从 initRelationList / stationRelationList 提取)
  const relLists = [data.initRelationList, data.stationRelationList].filter(Boolean)
  const stationCoordMap = new Map<string, { lat: number; lng: number; x: number; y: number }>()

  relLists.forEach((relList) => {
    // 地面接收站 (Layer 1, fz = 0)
    ;(relList.receiveObjList || []).forEach((rec) => {
      if (!nodeMap.has(rec.receiveId)) {
        const coord = parseLatLon(rec.receiveLatLon)
        let x = (coord.lng / 180.0) * 170
        let y = (coord.lat / 90.0) * 150
        stationCoordMap.set(rec.receiveId, { ...coord, x, y })

        nodeMap.set(rec.receiveId, {
          id: rec.receiveId,
          name: rec.receiveName || rec.receiveId,
          side: 'BLUE',
          layer: 1,
          asset_class: 'STATION',
          lat: coord.lat,
          lng: coord.lng,
          fx: x,
          fy: y,
          fz: 0,
        })
      }
    })

    // 中心云数据中心 / 指挥中心 (Layer 0, fz = -150)
    ;(relList.stationObjList || []).forEach((st) => {
      if (!nodeMap.has(st.stationId)) {
        const coord = parseLatLon(st.stationLatLon)
        let x = (coord.lng / 180.0) * 170
        let y = (coord.lat / 90.0) * 150

        nodeMap.set(st.stationId, {
          id: st.stationId,
          name: st.stationName || st.stationId,
          side: 'BLUE',
          layer: 0,
          asset_class: 'COMMAND_CENTER',
          lat: coord.lat,
          lng: coord.lng,
          fx: x,
          fy: y,
          fz: -150,
        })
      }
    })
  })

  // 2. Layer 2 天基卫星节点 (从 initMatrixList / satelliteMatrixList 提取)
  const allSatList = [...(data.initMatrixList || []), ...(data.satelliteMatrixList || [])]
  const satProcessed = new Set<number>()

  allSatList.forEach((sat, index) => {
    if (!satProcessed.has(sat.norad)) {
      satProcessed.add(sat.norad)
      const id = `sat-${sat.norad}`

      // 提取关联地面站坐标计算卫星在 Layer 2 的投影位置 (fz = 150)
      let avgX = 0
      let avgY = 0
      let count = 0
      const windows = (sat as any).initWindows || (sat as any).stationWindows || []
      windows.forEach((win: any) => {
        const stInfo = stationCoordMap.get(win.receiveId)
        if (stInfo) {
          avgX += stInfo.x
          avgY += stInfo.y
          count++
        }
      })

      const fx = count > 0 ? avgX / count : (index - 2) * 60
      const fy = count > 0 ? avgY / count + 15 : 60

      nodeMap.set(id, {
        id,
        name: sat.name || id,
        side: 'BLUE',
        layer: 2,
        asset_class: 'SATELLITE',
        tle_data: (sat as any).line1 && (sat as any).line2 ? `${(sat as any).line1}\n${(sat as any).line2}` : null,
        fx,
        fy,
        fz: 150,
      })
    }
  })

  // 3. 红方武器阵地节点 (Layer 0, fz = -150)
  const weaponMap = new Map<string, Weapon>()
  const satMatrixList = data.satelliteMatrixList || []
  satMatrixList.forEach((sm) => {
    ;(sm.weapons || []).forEach((w) => w && weaponMap.set(w.id, w))
    ;(sm.stationWindows || []).forEach((sw) => {
      ;(sw.weapons || []).forEach((w) => w && weaponMap.set(w.id, w))
    })
  })

  Array.from(weaponMap.values()).forEach((w) => {
    if (!nodeMap.has(w.id)) {
      const x = (w.longitude / 180.0) * 170
      const y = (w.latitude / 90.0) * 150
      nodeMap.set(w.id, {
        id: w.id,
        name: w.name || w.id,
        side: 'RED',
        layer: 0,
        asset_class: 'WEAPON',
        fx: x,
        fy: y,
        fz: -150,
      })
    }
  })

  return Array.from(nodeMap.values())
})

/**
 * [功能说明]
 * 根据当前选中的矩阵切换 Tab 提取 3 层（Layer 2 卫星 -> Layer 1 地面站 -> Layer 0 云数据中心）对应的 3D 拓扑连线及打压/干涉状态。
 *
 * [数据来源]
 * 后端算法接口返回数据中的 initMatrixList, satelliteMatrixList, initRelationList, stationRelationList。
 *
 * [修改约束]
 * - 保证卫星至地面站 (Layer 2->1) 以及地面站至云中心 (Layer 1->0) 的完整通路均能呈现。
 * - 正确处理打击中断、打压延时与交战红线展示。
 */
const activeLinks = computed(() => {
  if (!matrixData.value) return []
  const data = matrixData.value
  const linkList: any[] = []
  const linkSet = new Set<string>()

  // 提取地面接收站状态映射 (用于判定 Layer 1 -> Layer 0 是否被打压中断)
  const stationStatusMap = new Map<string, number>()
  const stationLists = [data.initRelationList, data.stationRelationList].filter(Boolean)
  stationLists.forEach((sl) => {
    ;(sl.receiveObjList || []).forEach((rec) => {
      if (rec.receiveStatus !== undefined) {
        stationStatusMap.set(rec.receiveId, rec.receiveStatus)
      }
    })
  })

  // 1. Layer 2 -> Layer 1 连线 (卫星 -> 地面接收站)
  if (currentMatrixTab.value === 'INIT_PASS' || currentMatrixTab.value === 'INIT_RELATION') {
    const initMatrices = data.initMatrixList || []
    initMatrices.forEach((sat) => {
      const satId = `sat-${sat.norad}`
      const windows = sat.initWindows || []
      windows.forEach((win) => {
        const linkId = `${satId}::${win.receiveId}`
        if (!linkSet.has(linkId)) {
          linkSet.add(linkId)
          linkList.push({
            id: linkId,
            source: satId,
            target: win.receiveId,
            delayLabel: `过境窗口: ${win.peakWindow} ~ ${win.endWindow}`,
            link_status: 'TRANSMITTING',
          })
        }
      })
    })
  } else {
    // SAT_MATRIX & STATION_RELATION 电子打击及打压延时场景
    const satList = data.satelliteMatrixList || []
    satList.forEach((sat) => {
      const satId = `sat-${sat.norad}`
      const windows = sat.stationWindows || []
      windows.forEach((win) => {
        const linkId = `${satId}::${win.receiveId}`
        if (!linkSet.has(linkId)) {
          linkSet.add(linkId)
          // [变量用途]
          // 保存当前窗口或卫星是否处于打击/干扰状态的标识。
          //
          // [数据来源]
          // 后端算法接口返回的 stationWindows[].strikeStatus 或 satelliteMatrixList[].satelliteStatus 状态字段。
          //
          // [取值规则]
          // 当 win.strikeStatus === 1 或 sat.satelliteStatus === 1 时为 true，否则为 false。
          //
          // [修改约束]
          // 请勿修改判断 1 的打击状态数值及逻辑关系。
          const isJammed = win.strikeStatus === 1 || sat.satelliteStatus === 1

          // [变量用途] 计算打压延迟提示文本
          // [数据来源] 优先取接收窗口级别的 win.delayMin，若无则退而取卫星级别的 sat.delayMin，默认兜底 45m
          const delayText = isJammed
            ? `受软/硬毁伤打压延时 +${win.delayMin || sat.delayMin || 45}m`
            : `无打击延时 (+0m)`

          linkList.push({
            id: linkId,
            source: satId,
            target: win.receiveId,
            delayLabel: delayText,
            link_status: isJammed ? 'JAMMED' : 'TRANSMITTING',
          })
        }

        // 追加红方武器打击交战红线 (Layer 0 红方武器 -> Layer 1 地面站)
        if (currentMatrixTab.value === 'SAT_MATRIX' && win.strikeStatus === 1 && win.weapons) {
          win.weapons.forEach((w) => {
            if (w && w.id) {
              const engId = `weapon-eng::${w.id}::${win.receiveId}`
              if (!linkSet.has(engId)) {
                linkSet.add(engId)
                linkList.push({
                  id: engId,
                  source: w.id,
                  target: win.receiveId,
                  delayLabel: `火力打击 (${w.name})`,
                  link_status: 'ENGAGEMENT',
                })
              }
            }
          })
        }
      })
    })
  }

  // 2. Layer 1 -> Layer 0 连线 (地面接收站 -> 中心云数据中心)
  const relList = currentMatrixTab.value === 'STATION_RELATION' ? data.stationRelationList : data.initRelationList
  const relations =
    relList && relList.relations && relList.relations.length > 0
      ? relList.relations
      : data.initRelationList
        ? data.initRelationList.relations
        : []

  if (relations) {
    relations.forEach((rel) => {
      const linkId = `${rel.from}::${rel.to}`
      if (!linkSet.has(linkId)) {
        linkSet.add(linkId)
        const isRecStruck = stationStatusMap.get(rel.from) === 1
        const isJammedTab = currentMatrixTab.value === 'SAT_MATRIX' || currentMatrixTab.value === 'STATION_RELATION'
        const linkStatus = isJammedTab && isRecStruck ? 'JAMMED' : 'TRANSMITTING'
        const labelText = isRecStruck && isJammedTab ? '地面站受到打压中断' : '云数据中心骨干传输'

        linkList.push({
          id: linkId,
          source: rel.from,
          target: rel.to,
          delayLabel: labelText,
          link_status: linkStatus,
        })
      }
    })
  }

  // 3. Layer 2 -> Layer 2 连线 (星间数据中继拓扑关系: 卫星 -> 中继卫星)
  if (data.relayRelation && data.relayRelation.relations) {
    data.relayRelation.relations.forEach((rel) => {
      const sourceSatId = `sat-${rel.from}`
      const targetSatId = `sat-${rel.to}`
      const linkId = `${sourceSatId}::${targetSatId}`
      if (!linkSet.has(linkId)) {
        linkSet.add(linkId)
        linkList.push({
          id: linkId,
          source: sourceSatId,
          target: targetSatId,
          delayLabel: '星间数据中继',
          link_status: 'TRANSMITTING',
        })
      }
    })
  }

  return linkList
})

onMounted(() => {
  fetchMatrixData()
})
</script>

<style lang="scss" scoped>
@import '../styles/theme.scss';

.full-screen-cema {
  width: 100%;
  height: 100%;
  max-height: calc(100vh - 45px);
  display: flex;
  flex-direction: column;
  background-color: #080c16;
  overflow: hidden;
}

.cema-header {
  height: 54px;
  background: rgba(13, 22, 38, 0.85);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  .header-title {
    font-size: 18px;
    font-weight: 700;
    color: #00e1ff;
    letter-spacing: 1px;
  }
}

.header-center {
  display: flex;
  align-items: center;
  gap: 15px;
}

.intensity-group,
.matrix-tab-group {
  display: flex;
  align-items: center;
  background: rgba(8, 12, 22, 0.6);
  padding: 3px;
  border-radius: 4px;
  border: 1px solid rgba(0, 225, 255, 0.15);
}

.nav-tab-btn {
  background: transparent;
  border: none;
  color: #a0aec0;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.25s ease;

  &:hover {
    color: #00e1ff;
  }

  &.active {
    background: linear-gradient(135deg, rgba(0, 225, 255, 0.3), rgba(0, 102, 255, 0.4));
    color: #ffffff;
    font-weight: 600;
    box-shadow: 0 0 8px rgba(0, 225, 255, 0.3);
  }

  &.tab-matrix.active {
    background: linear-gradient(135deg, rgba(255, 204, 0, 0.3), rgba(255, 102, 0, 0.4));
    box-shadow: 0 0 8px rgba(255, 204, 0, 0.3);
  }
}

.v-divider {
  width: 1px;
  height: 24px;
  background: rgba(0, 225, 255, 0.2);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
  .header-right-item {
    font-size: 13px;
    color: #a0aec0;
    .label-text {
      margin-right: 6px;
    }
    .time-value {
      color: #00e1ff;
      font-weight: 600;
    }
  }
}

.single-workspace {
  flex: 1;
  width: 100%;
  position: relative;
}

.full-sandbox {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
