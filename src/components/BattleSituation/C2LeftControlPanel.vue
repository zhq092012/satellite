<template>
  <aside class="c2-panel c2-panel--left dark-theme">
    <!-- 面板标题 Header -->
    <div class="panel-header">
      <div class="header-title-box">
        <span class="header-title glow-text-cyan">敌方网络与资产拓扑</span>
      </div>
      <span class="panel-badge">传输链路</span>
    </div>

    <!-- 卫星类型与系列按钮/列表筛选区 -->
    <div class="filter-section">
      <!-- 卫星类型选择按钮组 (占满一行) -->
      <div class="type-button-bar">
        <button
          v-for="item in typeOptions"
          :key="item"
          class="type-btn"
          :class="{
            active: selectedType === item,
            disabled: isTypeDisabled(item),
          }"
          :disabled="isTypeDisabled(item)"
          @click="selectType(item)"
        >
          {{ item }}
        </button>
      </div>

      <!-- 卫星系列列表 (排成一列 list，全部类型或指定类型下均可展示) -->
      <div class="series-list-box" v-if="seriesOptions.length > 0">
        <div class="series-list-header">
          <span class="series-title">📋 {{ selectedType ? `${selectedType} · 包含系列` : '全部系列列表' }}</span>
          <span class="series-count">{{ seriesOptions.length }} 个</span>
        </div>
        <div class="series-list">
          <div
            v-for="series in seriesOptions"
            :key="series"
            class="series-item"
            :class="{ active: selectedSeries === series }"
            @click="selectSeries(series)"
          >
            <span class="series-icon">🏷️</span>
            <span class="series-name">{{ series }}</span>
            <span class="series-status">{{ selectedSeries === series ? '✓ 已筛选' : '点击筛选' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 敌方天基空间节点资产清单 (Space Layer) -->
    <div class="panel-section section-space">
      <div class="section-title">
        <span class="title-icon">🌌</span>
        <span>敌方天基过境与中继卫星</span>
        <span class="count-tag">{{ satList.length }} 颗</span>
      </div>

      <div class="asset-scroll-list">
        <div
          v-for="sat in satList"
          :key="sat.norad"
          class="asset-card"
          :class="{
            'card-active': selectedNorad === sat.norad,
            'card-relay': sat.isRelay,
          }"
        >
          <div class="card-top">
            <span class="sat-name">
              {{ sat.isRelay ? '📡' : '🛰️' }} <strong>{{ sat.name }}</strong>
            </span>
            <span class="status-badge" :class="sat.isRelay ? 'badge-amber' : 'badge-cyan'">
              {{ sat.isRelay ? '高轨中继' : '过境观测' }}
            </span>
          </div>

          <div class="card-details">
            <span class="detail-tag">NORAD: {{ sat.norad }}</span>
            <span class="detail-tag tag-type">{{ sat.satType || '天基节点' }}</span>
            <span class="detail-tag tag-role" v-if="sat.isRelay">中继节点</span>
            <span class="click-hint" v-if="selectedNorad === sat.norad">✓ 已选择分析</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 敌方地基网络设施清单 (Ground Layer) -->
    <div class="panel-section">
      <div class="section-title">
        <span class="title-icon">🏢</span>
        <span>敌方地基接收站与数据中心</span>
        <span class="count-tag">{{ groundNodes.length }} 个</span>
      </div>

      <div class="ground-nodes-grid">
        <div
          v-for="node in groundNodes"
          :key="`${node.type}-${node.id}`"
          class="ground-node-pill"
          :class="{
            'node-center': node.type === 'STATION',
            active: selectedInfrastructureNode?.id === node.id && selectedInfrastructureNode?.type === node.type,
          }"
          @click="handleSelectGroundNode(node)"
        >
          <span class="node-icon">{{ node.type === 'STATION' ? '💻' : '📡' }}</span>
          <span class="node-name" :title="node.name">{{ node.name }}</span>
          <span class="node-type-label">{{ node.type === 'STATION' ? '数据中心' : '接收站' }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * [功能]
 * 战场态势 - C2 左侧控制与敌方资产清单面板
 *
 * [处理规则]
 * - 重点展示敌方过境卫星、中继卫星、地面接收站及数据中心
 * - 支持根据接口 getSatelliteTypeSerials 获取的类型与系列联动筛选卫星列表
 * - 点击天基卫星卡片时向父组件抛出 select-satellite 事件
 * - 不包含任何攻击/毁伤/打压控制
 *
 * [副作用]
 * - 触发视角切换与控制事件
 */
import { ref, computed, watch } from 'vue'
import { getSatelliteTypeSerials, type MatrixResult, type SatelliteMatrix, type InitMatrix } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'
import type { InfrastructureLocation } from '@/composables/useElectronicCesiumBridge'

const props = defineProps<{
  /** 算法矩阵响应式数据 */
  matrixData: MatrixResult | null
  /** 当前选中的敌方卫星 NORAD */
  selectedNorad?: number | null
}>()

const store = useLayoutStore()

//存储从接口 getSatelliteTypeSerials 获取的卫星类型与对应系列字典数据
const typeSerialsMap = ref<Record<string, string[]>>({})

// 当前选中的卫星类型筛选值，优先从 Store 持久化状态中恢复
const selectedType = ref<string>(store.selectedSatType || '')


// 当前选中的卫星系列筛选值，优先从 Store 持久化状态中恢复
const selectedSeries = ref<string>(store.selectedSatSeries || '')


// 可供选择的卫星类型下拉选项列表
const typeOptions = computed<string[]>(() => {
  return Object.keys(typeSerialsMap.value)
})

/**
 * [计算属性说明]
 * 当前选中的卫星类型下可供选择的系列列表（若选择"全部类型"或未选类型，则汇总合并展示所有类型下的所有系列）
 */
const seriesOptions = computed<string[]>(() => {
  if (!selectedType.value) {
    const allSeries = Object.values(typeSerialsMap.value).flat()
    return Array.from(new Set(allSeries))
  }
  return typeSerialsMap.value[selectedType.value] || []
})

/**
 * [功能说明]
 * 判断当前卫星类型按钮是否需要禁用（禁用“导航”、“通信”、“导弹预警”）
 *
 * @param type 卫星类型名称
 * @returns 是否禁用
 */
const isTypeDisabled = (type: string): boolean => {
  if (!type) return false
  return type.includes('导航') || type.includes('通信') || type.includes('导弹预警')
}

/**
 * [函数说明]
 * 选择并切换选中的卫星类型，并同步保存至 Store，自动联动选中该类型下的首个可用系列
 *
 * @param type 选中的卫星类型名称
 */
const selectType = (type: string) => {
  if (!type || isTypeDisabled(type)) return
  selectedType.value = type
  store.setSelectedSatType(selectedType.value)

  const availSeries = typeSerialsMap.value[type] || []
  const newSeries = availSeries.length > 0 ? availSeries[0] : ''
  selectedSeries.value = newSeries
  store.setSelectedSatSeries(newSeries)
}

/**
 * [监听器说明]
 * 监听卫星类型选项列表，保持现有有效类型或自动选中第一个未禁用的卫星类型 (如 "侦察")
 */
watch(
  typeOptions,
  (options) => {
    if (!options || options.length === 0) return
    let currentType = selectedType.value || store.selectedSatType || ''
    if (!currentType || isTypeDisabled(currentType) || !options.includes(currentType)) {
      const validOption = options.find((opt) => !isTypeDisabled(opt))
      if (validOption) {
        selectType(validOption)
      }
    } else if (selectedType.value !== currentType) {
      selectedType.value = currentType
    }
  },
  { immediate: true }
)

/**
 * [监听器说明]
 * 监听当前可用卫星系列列表，切换 Tab 组件挂载后自动恢复/对齐选中的系列，防止 Store 中系列清空导致敌方天基过境与中继卫星数据为空
 */
watch(
  seriesOptions,
  (sOptions) => {
    if (!sOptions || sOptions.length === 0) return
    let currentSeries = selectedSeries.value || store.selectedSatSeries || ''
    if (!currentSeries || !sOptions.includes(currentSeries)) {
      currentSeries = sOptions[0]
    }
    if (currentSeries && (selectedSeries.value !== currentSeries || store.selectedSatSeries !== currentSeries)) {
      selectedSeries.value = currentSeries
      store.setSelectedSatSeries(currentSeries)
    }
  },
  { immediate: true }
)

/**
 * [函数说明]
 * 选择或切换选中的卫星系列，并同步保存至 Store
 * @param series 选中的卫星系列名称
 */
const selectSeries = (series: string) => {
  if (selectedSeries.value === series) {
    selectedSeries.value = ''
  } else {
    selectedSeries.value = series
  }
  store.setSelectedSatSeries(selectedSeries.value)
}

/**
 * [函数说明]
 * 根据任务 ID 从后端异步加载卫星类型与系列映射数据
 *
 * [处理规则]
 * - 校验 taskId 是否有效，若无效清空 typeSerialsMap 并返回
 * - 调用 getSatelliteTypeSerials(taskId)
 * - 成功后将返回的数据保存至 typeSerialsMap
 *
 * [副作用]
 * - 发送网络 HTTP 请求
 * - 更新 typeSerialsMap 响应式数据
 *
 * [异常处理]
 * 捕获请求异常并在控制台记录 error
 *
 * [修改约束]
 * 保持入参格式与异步更新逻辑一致
 *
 * @param taskId 任务 ID
 */
const fetchTypeSerials = async (taskId?: number) => {
  if (!taskId) {
    typeSerialsMap.value = {}
    return
  }
  try {
    const res = await getSatelliteTypeSerials(taskId)
    if (res.code === 200 && res.data) {
      typeSerialsMap.value = res.data
    }
  } catch (err) {
    console.error('获取卫星类型与系列映射失败:', err)
  }
}

// 监听当前激活的任务 ID 变化，自动查询对应任务的类型与系列列表
watch(
  () => store.activedTask?.id,
  (newTaskId) => {
    if (!newTaskId) {
      selectedType.value = ''
      selectedSeries.value = ''
      store.setSelectedSatType('')
      store.setSelectedSatSeries('')
    }
    void fetchTypeSerials(newTaskId)
  },
  { immediate: true }
)

/**
 * [计算属性说明]
 * 提取当前矩阵中的敌方天基过境与中继卫星列表。
 * 数据源直接来自于后端算法根据 selectedSeries 计算并返回的 matrixData 传输矩阵。
 */
const satList = computed(() => {
  const matrixData = props.matrixData
  if (!matrixData) return []

  const map = new Map<number, { norad: number; name: string; satType: string; isRelay: boolean }>()

  const initList = matrixData.initMatrixList?.length ? matrixData.initMatrixList : []
  const satMatrixList = matrixData.satelliteMatrixList?.length ? matrixData.satelliteMatrixList : []
  const relayList = matrixData.relayRelation?.relayList?.length ? matrixData.relayRelation.relayList : []

  initList.forEach((s: InitMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, { norad: s.norad, name: s.name, satType: s.satType, isRelay })
  })
  satMatrixList.forEach((s: SatelliteMatrix) => {
    const isRelay = (s.satType || '').includes('中继') || relayList.includes(s.norad)
    map.set(s.norad, {
      norad: s.norad,
      name: s.name,
      satType: s.satType,
      isRelay,
    })
  })

  return Array.from(map.values())
})

const selectedInfrastructureNode = computed(() => store.selectedInfrastructureNode)

/**
 * 解析经纬度字符串 (例如 "68.350,133.500") 为 [latitude, longitude]
 */
const parseLatLon = (latLonStr?: string): [number, number] => {
  if (!latLonStr) return [0, 0]
  const parts = latLonStr.split(',').map((val) => parseFloat(val.trim()))
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return [parts[0], parts[1]]
  }
  return [0, 0]
}

// 选择/取消选择敌方地面接收站或数据中心
const handleSelectGroundNode = (node: InfrastructureLocation) => {
  if (selectedInfrastructureNode.value?.id === node.id && selectedInfrastructureNode.value?.type === node.type) {
    store.setSelectedInfrastructureNode(null)
  } else {
    store.setSelectedInfrastructureNode(node)
  }
}

// 提取敌方地面设施列表 (接收站 + 数据中心)
const groundNodes = computed<InfrastructureLocation[]>(() => {
  const matrixData = props.matrixData
  if (!matrixData) return []
  const nodes: InfrastructureLocation[] = []

  let relationData = matrixData.stationRelationList
  if (!relationData?.receiveObjList?.length) {
    relationData = matrixData.initRelationList
  }

  if (relationData?.receiveObjList) {
    relationData.receiveObjList.forEach((rec) => {
      const [lat, lon] = parseLatLon(rec.receiveLatLon)
      nodes.push({
        id: rec.receiveId,
        name: rec.receiveName,
        type: 'RECEIVE',
        latitude: lat,
        longitude: lon,
        altitude: 0,
        status: rec.receiveStatus ?? 0,
      })
    })
  }

  if (relationData?.stationObjList) {
    relationData.stationObjList.forEach((st) => {
      const [lat, lon] = parseLatLon(st.stationLatLon)
      nodes.push({
        id: st.stationId,
        name: st.stationName,
        type: 'STATION',
        latitude: lat,
        longitude: lon,
        altitude: 0,
        status: st.stationStatus ?? 0,
      })
    })
  }

  return nodes
})
</script>

<style lang="scss" scoped>
.c2-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
  background: rgba(8, 15, 26, 0.88);
  border: 1px solid rgba(0, 225, 255, 0.18);
  border-radius: 10px;
  backdrop-filter: blur(8px);
  color: #e2efff;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  overflow-y: auto;
  gap: 12px;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.25);
    border-radius: 4px;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 225, 255, 0.15);

  .header-title-box {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 700;
  }

  .glow-text-cyan {
    color: #40f2ff;
    text-shadow: 0 0 8px rgba(64, 242, 255, 0.4);
  }

  .panel-badge {
    padding: 2px 8px;
    font-size: 11px;
    border-radius: 4px;
    background: rgba(0, 225, 255, 0.12);
    color: #5ce1e6;
    border: 1px solid rgba(0, 225, 255, 0.3);
  }
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: rgba(14, 25, 42, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;

  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #b5d5ff;

    .count-tag {
      margin-left: auto;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      background: rgba(64, 242, 255, 0.15);
      color: #7dd3fc;
    }
  }
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .type-button-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    flex-wrap: wrap;

    .type-btn {
      flex: 1 1 auto;
      min-width: 60px;
      height: 28px;
      padding: 0 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 500;
      color: #9ec5ed;
      background: rgba(18, 32, 54, 0.85);
      border: 1px solid rgba(0, 225, 255, 0.25);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
      white-space: nowrap;

      &:hover {
        color: #ffffff;
        border-color: rgba(0, 225, 255, 0.6);
        background: rgba(24, 48, 80, 0.9);
        box-shadow: 0 0 6px rgba(0, 225, 255, 0.2);
      }

      &.active {
        color: #ffffff;
        font-weight: 600;
        background: linear-gradient(135deg, rgba(0, 180, 216, 0.4) 0%, rgba(0, 225, 255, 0.25) 100%);
        border-color: #00e1ff;
        box-shadow: 0 0 10px rgba(0, 225, 255, 0.35);
      }

      &:disabled,
      &.disabled {
        opacity: 0.45;
        color: #64748b;
        background: rgba(15, 23, 42, 0.6);
        border-color: rgba(100, 116, 139, 0.2);
        cursor: not-allowed;
        pointer-events: none;
        box-shadow: none;

        &:hover {
          color: #64748b;
          background: rgba(15, 23, 42, 0.6);
          border-color: rgba(100, 116, 139, 0.2);
          box-shadow: none;
        }
      }
    }
  }

  .series-list-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    background: rgba(12, 22, 38, 0.75);
    border: 1px dashed rgba(0, 225, 255, 0.25);
    border-radius: 6px;

    .series-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #7dd3fc;
      padding-bottom: 4px;
      border-bottom: 1px rgba(0, 225, 255, 0.15) solid;

      .series-title {
        font-weight: 600;
      }

      .series-count {
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.15);
        padding: 1px 6px;
        border-radius: 8px;
      }
    }

    .series-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 150px;
      overflow-y: auto;

      &::-webkit-scrollbar {
        width: 3px;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(0, 225, 255, 0.3);
        border-radius: 3px;
      }

      .series-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        font-size: 12px;
        color: #c4e0ff;
        background: rgba(18, 36, 62, 0.6);
        border: 1px solid rgba(79, 147, 221, 0.2);
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;

        .series-icon {
          margin-right: 6px;
          font-size: 12px;
        }

        .series-name {
          flex: 1;
          font-weight: 500;
        }

        .series-status {
          font-size: 11px;
          color: #64748b;
        }

        &:hover {
          color: #ffffff;
          border-color: rgba(0, 225, 255, 0.5);
          background: rgba(24, 52, 88, 0.8);

          .series-status {
            color: #38bdf8;
          }
        }

        &.active {
          color: #40f2ff;
          font-weight: 600;
          background: rgba(0, 225, 255, 0.15);
          border-color: #00e1ff;
          box-shadow: 0 0 8px rgba(0, 225, 255, 0.25);

          .series-status {
            color: #00e1ff;
            font-weight: 600;
          }
        }
      }
    }
  }
}

.toggle-grid {
  display: flex;
  gap: 12px;
  align-items: center;

  .toggle-item {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;

    input {
      accent-color: #00e1ff;
    }
  }
}

// [业务目的] 敌方天基过境与中继卫星列表样式定义
// [实现原因] 移除 max-height 与 overflow-y 局部滚动条限制，避免出现嵌套滚动条，统一由外层 .c2-panel 进行整体滚动
// [关键规则] 不设高度上限，内容按 Flex 垂直排列自然展开
.asset-scroll-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.asset-card {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.4);
    background: rgba(22, 42, 70, 0.9);
  }

  &.card-active {
    border-color: #00e1ff;
    background: rgba(0, 225, 255, 0.18);
    box-shadow: 0 0 12px rgba(0, 225, 255, 0.25);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;

    .sat-name {
      font-size: 13px;
      color: #ffffff;
    }

    .status-badge {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 4px;

      &.badge-cyan {
        background: rgba(0, 225, 255, 0.15);
        color: #38bdf8;
      }

      &.badge-amber {
        background: rgba(245, 158, 11, 0.18);
        color: #fbbf24;
      }
    }
  }

  .card-details {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 11px;

    .detail-tag {
      padding: 1px 4px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;

      &.tag-type {
        color: #7dd3fc;
      }

      &.tag-role {
        color: #fcd34d;
      }
    }

    .click-hint {
      margin-left: auto;
      color: #38bdf8;
      font-weight: 600;
    }
  }
}

.ground-nodes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.ground-node-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(18, 32, 54, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: rgba(56, 189, 248, 0.4);
    background: rgba(30, 58, 95, 0.8);
  }

  &.active {
    border-color: #38bdf8;
    background: rgba(14, 165, 233, 0.25);
    box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
    .node-name {
      color: #38bdf8;
      font-weight: bold;
    }
  }

  .node-icon {
    font-size: 12px;
  }

  .node-name {
    font-size: 12px;
    color: #e2efff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 80px;
  }

  .node-type-label {
    margin-left: auto;
    font-size: 10px;
    color: #64748b;
  }

  &.node-center {
    border-color: rgba(168, 85, 247, 0.3);
    .node-type-label {
      color: #c084fc;
    }

    &.active {
      border-color: #a855f7;
      background: rgba(168, 85, 247, 0.25);
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.35);
      .node-name {
        color: #e9d5ff;
      }
    }
  }
}
</style>
