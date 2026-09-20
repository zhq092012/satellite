<template>
  <div class="graph-container" :class="{ 'graph-container--standalone': standalone }">
    <header class="net-toolbar">
      <div class="net-toolbar__row">
        <span class="net-toolbar__label">卫星对关系</span>
        <el-radio-group v-model="relationType" class="net-toolbar__radios">
          <el-radio value="轨道共面">轨道共面</el-radio>
          <el-radio value="轨道相似">轨道相似</el-radio>
          <el-radio value="相位稳定">相位稳定</el-radio>
          <el-radio value="抵近">抵近</el-radio>
        </el-radio-group>
      </div>
      <div class="net-toolbar__row net-toolbar__row--controls">
        <div class="net-toolbar__cell net-toolbar__cell--cluster">
          <div class="net-toolbar__field">
            <span class="net-toolbar__label">中心簇类型</span>
            <el-select
              v-model="groupType"
              clearable
              placeholder="聚类维度"
              size="small"
              class="net-toolbar__select"
            >
              <el-option label="同一国家" value="同一国家" />
              <el-option label="同一运载火箭" value="同一运载火箭" />
              <el-option label="同一发射地点" value="同一发射地点" />
              <el-option label="同一制造商" value="同一制造商" />
              <el-option label="同一载荷类型" value="同一载荷类型" />
              <el-option label="同一测控方" value="同一测控方" />
            </el-select>
          </div>
          <div v-if="relationType === '抵近'" class="net-toolbar__field">
            <span class="net-toolbar__label">抵近日期</span>
            <el-date-picker
              v-model="proximityDate"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="选择日期"
              size="small"
              class="net-toolbar__date"
              @change="handleProximityDateChange"
            />
          </div>
        </div>
        <div class="net-toolbar__cell net-toolbar__cell--search">
          <div class="net-toolbar__field">
            <span class="net-toolbar__label">卫星筛选</span>
            <el-input
              v-model="satelliteSearchQuery"
              size="small"
              clearable
              placeholder="NORAD / 国际编号"
              class="net-toolbar__input"
              @keyup.enter="handleSatelliteSearch"
            />
          </div>
          <el-button type="primary" size="small" class="net-toolbar__search-btn" @click="handleSatelliteSearch">
            搜索
          </el-button>
        </div>
        <div class="net-toolbar__cell net-toolbar__cell--actions">
          <el-switch
            v-model="showDescPanel"
            active-action-icon="View"
            inactive-action-icon="Hide"
            active-text="侧栏统计"
          />
          <el-button v-if="!standalone" type="primary" size="small" plain @click="store.showNetView = false">
            关闭网络视图
          </el-button>
        </div>
      </div>
    </header>
    <div class="graph-layout">
      <el-scrollbar class="scroll-bar-left" v-show="showDescPanel">
        <div class="panel-head">图谱概览</div>
        <div class="scroll-title">选择的中心簇：</div>
        <div class="tag-text">
          <span>{{ selectedCluster.length ? selectedCluster : '暂无选择' }}</span>
        </div>
        <div class="scroll-title">模式：</div>
        <div class="tag-text">
          <div>关系组合：{{ selectedMode }}</div>
        </div>
        <div class="relation-node-grid">
          <div>
            <span>节点</span>
            <span>{{ nodeCount }}</span>
          </div>
          <div>
            <span>边</span> <span>{{ relationCount }}</span>
          </div>
          <div>
            <span>卫星</span> <span>{{ sateCount }}</span>
          </div>
          <div>
            <span>中心簇</span> <span>{{ centerClusterCount }}</span>
          </div>
        </div>
        <div class="tag-text section-label">
          <div>节点 / 连线详情</div>
        </div>
        <div v-if="!selectedNode && !selectedEdge" class="detail-empty">
          在图谱中点击节点/连线，或使用顶部「卫星筛选」搜索后在此查看详情
        </div>
        <div class="relation-node-grid relation-node-grid--detail" v-if="selectedNode">
          <div>
            <span>NOARDID</span>
            <span>{{ selectedNode.norad }}</span>
          </div>
          <div>
            <span>名称</span> <span>{{ selectedNode.name_en }}</span>
          </div>
          <div>
            <span>国家</span> <span>{{ selectedNode.country }}</span>
          </div>
          <div>
            <span>卫星类型</span> <span>{{ selectedNode.sat_type }}</span>
          </div>
          <div>
            <span>近地点高度</span> <span>{{ selectedNode.prg }}</span>
          </div>
          <div>
            <span>远地点高度</span> <span>{{ selectedNode.apg }}</span>
          </div>
          <div>
            <span>倾角</span> <span>{{ selectedNode.i }}</span>
          </div>
          <div>
            <span>偏心率</span> <span>{{ selectedNode.e }}</span>
          </div>
          <div>
            <span>半长轴</span> <span>{{ selectedNode.a }}</span>
          </div>
          <div>
            <span>升交点赤经</span> <span>{{ selectedNode.o }}</span>
          </div>
          <div>
            <span>近地点辐角</span> <span>{{ selectedNode.w }}</span>
          </div>
          <div>
            <span>平近点角</span> <span>{{ selectedNode.m }}</span>
          </div>
          <div v-if="selectedEdge">
            <span>关系名称：</span><span>{{ selectedEdge.label }}</span>
          </div>
          <div v-if="selectedEdge">
            <span>关系时间：</span><span>{{ selectedEdge.time }}</span>
          </div>
        </div>
      </el-scrollbar>
      <div ref="graphCanvas" class="graph-canvas" />
      <el-scrollbar class="scroll-bar-right" v-show="showDescPanel">
        <div class="panel-head">侧栏统计</div>
        <div v-if="!groupType" class="panel-empty">
          <span class="panel-empty__icon" aria-hidden="true">🕸️</span>
          <p class="panel-empty__title">尚未选择中心簇类型</p>
          <p class="panel-empty__hint">在上方下拉框选择「同一国家」等维度后，将在此列出各分组及卫星数量；点击数量可在图谱中高亮对应簇。</p>
        </div>
        <template v-else>
          <section v-if="showCrossPairSection" class="right-panel-section">
            <div class="section-title">{{ crossPairSectionTitle }}</div>
            <div v-if="!crossPairRows.length" class="panel-empty panel-empty--compact">
              当前筛选条件下暂无跨簇关系对
            </div>
            <div v-else class="collapse">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ crossPairRows.length }}</mark> 组关系对
                </template>
                <el-descriptions-item v-for="(row, idx) in crossPairRows" :key="row.label">
                  <template #label>
                    <span :class="{ 'link-label': true, active: idx === crossPairActiveIndex }">{{ row.label }}</span>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === crossPairActiveIndex }"
                    @click="setCrossPairIndex(idx, row)">
                    {{ row.count }} 组
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </section>
          <div v-if="showCrossPairSection" class="right-panel-divider" />
          <section class="right-panel-section">
            <div class="section-title">中心簇列表</div>
            <div class="title">{{ groupType }}</div>
            <div class="collapse" v-if="groupType === '同一国家'">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ stats?.country.size }}</mark>组国家
                </template>

                <el-descriptions-item v-for="([country, cout], idx) in stats?.country.entries()">
                  <template #label>
                    <div class="cell-item">
                      <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ country ??
                        '未知国家'
                        }}</span>
                    </div>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === activedIndex }"
                    @click="setActiveIndex(idx, cout.norIds, country ?? '未知国家')">
                    {{ cout.count ?? 0 }} 颗
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="collapse" v-if="groupType === '同一运载火箭'">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ stats?.rocket.size }}</mark>组运载火箭
                </template>

                <el-descriptions-item v-for="([rocket, cout], idx) in stats?.rocket.entries()">
                  <template #label>
                    <div class="cell-item">
                      <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ rocket ??
                        '未知火箭'
                        }}</span>
                    </div>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === activedIndex }"
                    @click="setActiveIndex(idx, cout.norIds, rocket ?? '未知火箭')">
                    {{ cout.count ?? 0 }} 颗
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="collapse" v-if="groupType === '同一发射地点'">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ stats?.launch_place.size }}</mark>组发射地点
                </template>

                <el-descriptions-item v-for="([launch_place, cout], idx) in stats?.launch_place.entries()">
                  <template #label>
                    <div class="cell-item">
                      <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{
                        launch_place ??
                        '未知地点' }}</span>
                    </div>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === activedIndex }"
                    @click="setActiveIndex(idx, cout.norIds, launch_place ?? '未知地点')">
                    {{ cout.count ?? 0 }} 颗
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="collapse" v-if="groupType === '同一制造商'">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ stats?.operator.size }}</mark>组制造商
                </template>

                <el-descriptions-item v-for="([operator, cout], idx) in stats?.operator.entries()">
                  <template #label>
                    <div class="cell-item">
                      <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ operator ??
                        '未知制造商' }}</span>
                    </div>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === activedIndex }"
                    @click="setActiveIndex(idx, cout.norIds, operator ?? '未知制造商')">
                    {{ cout.count ?? 0 }} 颗
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="collapse" v-if="groupType === '同一载荷类型'">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ stats?.sat_type.size }}</mark>组载荷类型
                </template>

                <el-descriptions-item v-for="([sat_type, cout], idx) in stats?.sat_type.entries()">
                  <template #label>
                    <div class="cell-item">
                      <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ sat_type ??
                        '未知载荷类型' }}</span>
                    </div>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === activedIndex }"
                    @click="setActiveIndex(idx, cout.norIds, sat_type ?? '未知载荷类型')">
                    {{ cout.count ?? 0 }} 颗
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <div class="collapse" v-if="groupType === '同一测控方'">
              <el-descriptions :column="1" size="small" border class="cluster-descriptions">
                <template #title>
                  共有 <mark>{{ stats?.contractors.size }}</mark>组测控方
                </template>

                <el-descriptions-item v-for="([contractors, cout], idx) in stats?.contractors.entries()">
                  <template #label>
                    <div class="cell-item">
                      <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ contractors
                        ??
                        '未知测控方' }}</span>
                    </div>
                  </template>
                  <span :class="{ 'link-number': true, active: idx === activedIndex }"
                    @click="setActiveIndex(idx, cout.norIds, contractors ?? '未知测控方')">
                    {{ cout.count ?? 0 }} 颗
                  </span>
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </section>
        </template>
      </el-scrollbar>
    </div>
    <div>
      <el-dialog v-model="showTablePanel" title="卫星图谱统计数据" width="1500" :draggable="true" :fullscreen="true">
        <el-table :data="satelliteList" style="width: 100%" fit :cell-style="{ fontSize: '12px' }"
          :default-sort="{ prop: 'norad_id', order: 'ascending' }">
          <el-table-column prop="norad_id" label="编号" sortable> </el-table-column>
          <el-table-column prop="int_id" label="国际编号"> </el-table-column>
          <el-table-column prop="name_en" label="英文名称"> </el-table-column>
          <el-table-column prop="country" label="国家/地区"> </el-table-column>
          <el-table-column prop="sat_type" label="卫星类型" width="300"> </el-table-column>
          <el-table-column prop="orbit_status" label="轨道状态">
            <template #default="scope">
              <span v-if="scope.row.orbit_status === 0">未知</span>
              <span v-if="scope.row.orbit_status === 1">在轨</span>
              <span v-if="scope.row.orbit_status === 2">离轨</span>
            </template>
          </el-table-column>
          <el-table-column prop="orbit_type" label="轨道类型">
            <template #default="scope">
              <span v-if="scope.row.orbit_type === 0">未知</span>
              <span v-if="scope.row.orbit_type === 1">低轨</span>
              <span v-if="scope.row.orbit_type === 2">中轨</span>
              <span v-if="scope.row.orbit_type === 3">高轨</span>
              <span v-if="scope.row.orbit_type === 4">大椭圆</span>
            </template>
          </el-table-column>
          <el-table-column prop="payload_status" label="载荷状态">
            <template #default="scope">
              <span v-if="scope.row.payload_status === 0">未知</span>
              <span v-if="scope.row.payload_status === 1">堪用</span>
              <span v-if="scope.row.payload_status === 2">失效</span>
            </template>
          </el-table-column>
          <el-table-column prop="contractors" label="制造商" width="300"> </el-table-column>
        </el-table>
      </el-dialog>
    </div>
  </div>
</template>
<script setup lang="ts">
import { getSatelliteDetail, getSatelliteRelations, getSatelliteRelationsBySatellite } from '@/api/dashboard'
import { useLayoutStore } from '@/store/modules/layout'
import type { SatelliteDetail } from '@/types/cesium/satellite'
import type { SatelliteData, SatelliteNode, SatelliteRelation } from '@/types/dashboard'
import G6, { Graph, type EdgeConfig, type GraphData, type INode, type NodeConfig } from '@antv/g6'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'

/** 中心簇类型与节点属性字段映射，用于跨簇关系统计。 */
const GROUP_TYPE_FIELD: Record<string, keyof SatelliteNode> = {
  同一国家: 'country',
  同一运载火箭: 'rocket',
  同一发射地点: 'launch_place',
  同一制造商: 'operator',
  同一载荷类型: 'sat_type',
  同一测控方: 'contractors',
}

/** 右侧面板顶部：跨簇关系对一行数据。 */
interface CrossClusterPairRow {
  /** 展示标签，如「中国-美国」。 */
  label: string
  /** 该簇对下的关系条数。 */
  count: number
  /** 涉及卫星 NORAD 列表，用于图谱高亮。 */
  norIds: number[]
}

/** 为 true 时表示顶栏「卫星网络管理」独立页，不依赖 store.showNetView 开关。 */
const { standalone = false } = defineProps<{ standalone?: boolean }>()

const store = useLayoutStore()

/** 对抗分析内嵌开关或独立菜单页，任一成立时挂载并加载图谱。 */
const isNetViewActive = computed(() => standalone || store.showNetView)
const satelliteList = ref<SatelliteData[]>(store.allSatelliteOfTask)
// 其他统计
const activedIndex = ref(-1)
/** 右侧面板顶部跨簇列表当前选中行。 */
const crossPairActiveIndex = ref(-1)
const setActiveIndex = (idx: number, norIds: number[] | Set<string>, cluster: string) => {
  crossPairActiveIndex.value = -1
  activedIndex.value = idx
  selectedCluster.value = cluster
  if (!graph) return
  const focus: INode[] = []
  const allIds: string[] = []
  graph.getNodes().forEach((node) => {
    const id = node.getID()
    graph.clearItemStates(node)
    const idN = Number(id.split('Satellite-')[1])

    if (Array.isArray(norIds)) {
      if (norIds.includes(idN)) {
        graph.setItemState(node, 'highlight', true)
        focus.push(node)
      }
    } else {
      if (norIds.has(id)) {
        graph.setItemState(node, 'highlight', true)
        focus.push(node)
      }
    }
  })
  focus.forEach((n) => {
    allIds.push(n.getID().split('Satellite-')[1])
  })
  satelliteList.value = store.allSatelliteOfTask.filter((s) => {
    return allIds.includes(s.norad_id)
  })
  // graph.focusItems(focus, true, true, {
  //   easing: 'easeCubic',
  //   duration: 400,
  // })
}
// 抵近统计
const activeIdx = ref(-1)

let graph: Graph
/** G6 画布挂载节点（仅中间绘图区，不包含工具栏与侧栏）。 */
const graphCanvas = ref<HTMLElement | null>(null)

async function initGraph() {
  const container = graphCanvas.value
  if (container) {
    const width = container.clientWidth || container.scrollWidth || 800
    const height = container.clientHeight || container.scrollHeight || 500
    graph = new G6.Graph({
      container,
      width,
      height,
      fitViewPadding: 100,
      defaultNode: {
        size: 2,
        style: {
          fill: '#C6E5FF',
          stroke: '#5B8FF9',
          lineWidth: 0.3,
        },
        labelCfg: {
          position: 'bottom',
          offset: 1,
          style: {
            fill: '#eee',
          },
        },
      },
      defaultEdge: {
        size: 0.1,
        style: {
          lineWidth: 0.1,
          endArrow: {
            path: G6.Arrow.triangle(1.2, 2, 0.2),
            d: 0,
          },
          stroke: '#ccc',
        },
        type: 'line',
        labelCfg: {
          autoRotate: true,
          refY: 1.5,
          offset: 1,
          style: {
            fill: '#eee',
            fontSize: 1.5,
          },
        },
      },
      nodeStateStyles: {
        selected: {
          fill: '#00ffff',
          stroke: '#ffff00',
          lineWidth: 1,
        },
        highlight: {
          fill: '#ff7043', // 高亮色
          lineWidth: 1,
          stroke: '#d32f2f',
        },
      },
      edgeStateStyles: {
        selected: {
          fill: '#00ffff',
          stroke: '#ffff00',
          lineWidth: 1,
        },
      },
      modes: {
        default: [
          {
            type: 'zoom-canvas',
            enableOptimize: true,
            optimizeZoom: 0.9,
          },
          {
            type: 'drag-canvas',
            enableOptimize: true,
          },
          'drag-node',
          'brush-select',
        ],
      },
      layout: {
        type: 'fruchterman',
        gravity: 10,
        gpuEnabled: true,
      },
      animate: true,
    })
    graph.on('afterrender', () => {
      groups.value = []
      countConnectedGroups(graph.save())
      syncLeftStats()
    })
    graph.on('node:click', async (e) => {
      const node = e.item
      const norad = Number(node?.getModel().norad)
      if (norad && !isNaN(norad)) {
        console.log(norad)
        const res = await getSatelliteDetail({ norad: norad })
        if (res.code === 200) {
          selectedNode.value = res.data
        }
      }
      graph.getNodes().forEach((n) => {
        graph.setItemState(n!, 'selected', false)
      })
      graph.setItemState(node!, 'selected', true)
    })
    graph.on('edge:click', (e) => {
      const edge = e.item
      console.log(edge)
      selectedEdge.value = edge?.getModel()
      graph.getEdges().forEach((e) => {
        graph.setItemState(e!, 'selected', false)
      })

      graph.setItemState(edge!, 'selected', true)
    })
  }
}

let graphData: GraphData = reactive({ nodes: [], edges: [] })
const allRelationships: any[] = []
let allNodesCache: NodeConfig[] = []
/* ------------------ 5. 辅助函数 ------------------ */
// graph 连通分量计算数据
let groups = ref<{ nodeIds: Set<string>; edgeIds: Set<string>; nodeCount: number; edgeCount: number }[]>([])
/**
 * 统计图中所有“有关系”的节点组（连通分量）
 * @param {Object} data  G6 的 data 格式：{ nodes: [...], edges: [...], combos: [...] }
 * @return {Array}       每个元素是一个连通分量的统计对象
 *                       { nodeIds: Set, edgeIds: Set, nodeCount: Number, edgeCount: Number }
 */
function countConnectedGroups(data: GraphData) {
  const { nodes = [], edges = [] } = data
  const nodeSet = new Set(nodes.map((n) => n.id)) // 过滤悬空边
  const adj = new Map() // 邻接表
  nodes.forEach((n) => adj.set(n.id, new Set()))
  edges.forEach((e) => {
    const { source, target } = e
    if (nodeSet.has(source!) && nodeSet.has(target!)) {
      adj.get(source).add(target)
      adj.get(target).add(source)
    }
  })

  const visited = new Set()

  const dfs = (
    id: string,
    group: { nodeIds: Set<string>; edgeIds: Set<string>; nodeCount: number; edgeCount: number }
  ) => {
    if (visited.has(id)) return
    visited.add(id)
    group.nodeIds.add(id)
    adj.get(id).forEach((nei: string) => dfs(nei, group))
  }

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      const group = { nodeIds: new Set<string>(), edgeIds: new Set<string>(), nodeCount: 0, edgeCount: 0 }
      dfs(n.id, group)
      // 再扫一遍边，把两端都在本组的边收进来
      edges.forEach((e) => {
        if (group.nodeIds.has(e.source!) && group.nodeIds.has(e.target!)) {
          group.edgeIds.add(e.id || `${e.source}-${e.target}`)
        }
      })
      group.nodeCount = group.nodeIds.size
      group.edgeCount = group.edgeIds.size
      groups.value.push(group)
    }
  })
}

const syncLeftStats = () => {
  if (!graph) return
  const saved = graph.save() as GraphData
  const nodes = (saved.nodes ?? []) as unknown as SatelliteNode[]
  const edges = saved.edges ?? []
  nodeCount.value = nodes.length
  relationCount.value = edges.length
  sateCount.value = nodes.length
  stats.value = buildStatistics(nodes)

  switch (groupType.value) {
    case '同一国家':
      centerClusterCount.value = stats.value.country.size
      break
    case '同一运载火箭':
      centerClusterCount.value = stats.value.rocket.size
      break
    case '同一发射地点':
      centerClusterCount.value = stats.value.launch_place.size
      break
    case '同一制造商':
      centerClusterCount.value = stats.value.operator.size
      break
    case '同一载荷类型':
      centerClusterCount.value = stats.value.sat_type.size
      break
    case '同一测控方':
      centerClusterCount.value = stats.value.contractors.size
      break
    default:
      centerClusterCount.value = groups.value.length
      break
  }
}
let stats = ref<{
  country: Map<string, { count: number; norIds: number[] }>
  launch_place: Map<string, { count: number; norIds: number[] }>
  rocket: Map<string, { count: number; norIds: number[] }>
  contractors: Map<string, { count: number; norIds: number[] }>
  sat_type: Map<string, { count: number; norIds: number[] }>
  operator: Map<string, { count: number; norIds: number[] }>
}>()
// 计算统计数据
function buildStatistics(data: SatelliteNode[]) {
  // 6 个维度各自独立的频次表
  const stats = data.reduce<{
    country: Map<string, { count: number; norIds: number[] }>
    launch_place: Map<string, { count: number; norIds: number[] }>
    rocket: Map<string, { count: number; norIds: number[] }>
    contractors: Map<string, { count: number; norIds: number[] }>
    sat_type: Map<string, { count: number; norIds: number[] }>
    operator: Map<string, { count: number; norIds: number[] }>
  }>(
    (acc, sat) => {
      // 通用累加小工具
      const inc = (map: Map<string, { count: number; norIds: number[] }>, key: string, norad: number) => {
        if (!key) return
        const existing = map.get(key)
        if (existing) {
          // update count and append norad
          existing.count = (existing.count || 0) + 1
          existing.norIds.push(norad)
          map.set(key, existing)
        } else {
          map.set(key, { count: 1, norIds: [norad] })
        }
      }

      inc(acc.country, sat.country, sat.norad)
      inc(acc.launch_place, sat.launch_place, sat.norad)
      inc(acc.rocket, sat.rocket, sat.norad)
      inc(acc.contractors, sat.contractors, sat.norad)
      inc(acc.sat_type, sat.sat_type, sat.norad)
      inc(acc.operator, sat.operator, sat.norad)

      return acc
    },
    {
      country: new Map(),
      launch_place: new Map(),
      rocket: new Map(),
      contractors: new Map(),
      sat_type: new Map(),
      operator: new Map(),
    }
  )

  return stats
}

/**
 * 按当前关系类型与抵近日期筛选原始关系数据。
 * @returns 满足筛选条件的关系列表
 */
function getRelationshipsForCurrentFilters(): SatelliteRelation[] {
  return allRelationships.filter((rel) => {
    if (relationType.value && rel.relation !== relationType.value) return false
    if (relationType.value === '抵近' && proximityDate.value) {
      if (dayjs(rel.timestamp).format('YYYY-MM-DD') !== proximityDate.value) return false
    }
    return true
  })
}

/**
 * 从抵近关系中取最新日期作为默认筛选日。
 */
function syncProximityDateDefault() {
  const days = allRelationships
    .filter((r) => r.relation === '抵近')
    .map((r) => dayjs(r.timestamp).format('YYYY-MM-DD'))
  proximityDate.value = days.length ? days.sort().reverse()[0]! : dayjs().format('YYYY-MM-DD')
}

/**
 * 构建右侧面板顶部「跨簇关系对」列表（不同中心簇之间的边）。
 */
function rebuildCrossPairRows() {
  const field = groupType.value ? GROUP_TYPE_FIELD[groupType.value] : undefined
  if (!field || !groupType.value) {
    crossPairRows.value = []
    return
  }

  const nodeByNorad = new Map<number, NodeConfig & { norad?: number }>()
  allNodesCache.forEach((node) => {
    const norad = Number(node.norad ?? String(node.id).replace('Satellite-', ''))
    nodeByNorad.set(norad, node)
  })

  const bucketMap = new Map<string, { label: string; count: number; norIdSet: Set<number> }>()

  for (const rel of getRelationshipsForCurrentFilters()) {
    const src = nodeByNorad.get(rel.source)
    const tgt = nodeByNorad.get(rel.target)
    if (!src || !tgt) continue

    const v1 = String((src as Record<string, unknown>)[field] ?? '未知')
    const v2 = String((tgt as Record<string, unknown>)[field] ?? '未知')
    if (v1 === v2) continue

    const sorted = [v1, v2].sort((a, b) => a.localeCompare(b, 'zh-CN'))
    const label = `${sorted[0]}-${sorted[1]}`
    const bucket = bucketMap.get(label)
    if (bucket) {
      bucket.count += 1
      bucket.norIdSet.add(rel.source)
      bucket.norIdSet.add(rel.target)
    } else {
      bucketMap.set(label, {
        label,
        count: 1,
        norIdSet: new Set([rel.source, rel.target]),
      })
    }
  }

  crossPairRows.value = [...bucketMap.values()]
    .map((item) => ({
      label: item.label,
      count: item.count,
      norIds: [...item.norIdSet],
    }))
    .sort((a, b) => b.count - a.count)
}

/**
 * 在图谱上按 NORAD 列表高亮节点。
 * @param norIds 需要高亮的卫星 NORAD
 */
function highlightNodesByNorad(norIds: number[]) {
  if (!graph) return
  const idSet = new Set(norIds)
  graph.getNodes().forEach((node) => {
    graph.clearItemStates(node)
    const idN = Number(node.getID().split('Satellite-')[1])
    if (idSet.has(idN)) {
      graph.setItemState(node, 'highlight', true)
    }
  })
}

/**
 * 选中跨簇关系对并在图谱中高亮相关卫星。
 * @param idx 列表行索引
 * @param row 跨簇关系行数据
 */
function setCrossPairIndex(idx: number, row: CrossClusterPairRow) {
  crossPairActiveIndex.value = idx
  activedIndex.value = -1
  selectedCluster.value = row.label
  highlightNodesByNorad(row.norIds)
  satelliteList.value = store.allSatelliteOfTask.filter((s) => row.norIds.includes(Number(s.norad_id)))
}

/**
 * 抵近日期变更后重绘图谱与跨簇列表。
 */
function handleProximityDateChange() {
  crossPairActiveIndex.value = -1
  activedIndex.value = -1
  filterAndRenderGraph()
}

/**
 * 加载卫星关系
 */
const filterAndRenderGraph = () => {
  if (!graph || !allNodesCache.length) return

  const filteredRelationships = getRelationshipsForCurrentFilters()

  const sortedRelations = [...filteredRelationships].sort((a, b) => {
    return new Date(String(a.timestamp)).getTime() - new Date(String(b.timestamp)).getTime()
  })

  const uniqueEdges: EdgeConfig[] = []
  const edgeKeySet = new Set<string>()
  sortedRelations.forEach((edge, idx) => {
    const sourceId = `Satellite-${edge.source}`
    const targetId = `Satellite-${edge.target}`
    const pairKey = [edge.source, edge.target].sort((a, b) => a - b).join('-')
    const key = `${pairKey}-${edge.relation}`
    if (edgeKeySet.has(key)) return
    edgeKeySet.add(key)
    uniqueEdges.push({
      id: `Satellite-Relation-${idx}`,
      source: sourceId,
      target: targetId,
      label: relationType.value === '抵近'
        ? `最近距离:${edge.min_distance_km}km  时间:${dayjs(edge.timestamp).format('YYYY-MM-DD HH:mm:ss')}`
        : `${edge.relation} `,
      time: edge.timestamp,
    })
  })

  const nodeIds = new Set<string>()
  uniqueEdges.forEach((edge) => {
    if (edge.source) nodeIds.add(edge.source)
    if (edge.target) nodeIds.add(edge.target)
  })

  const nodes = allNodesCache.filter((node) => nodeIds.has(node.id!))

  nodes.forEach((node: any) => {
    node.degree = 0
    uniqueEdges.forEach((edge) => {
      if (edge.source === node.id || edge.target === node.id) {
        node.degree++
      }
    })
  })
  mapNodeSize(nodes, 'degree', [3, 15])

  const offsetDiff = 10
  const multiEdgeType = 'line'
  const singleEdgeType = 'line'
  const loopEdgeType = 'loop'
  G6.Util.processParallelEdges(uniqueEdges, offsetDiff, multiEdgeType, singleEdgeType, loopEdgeType)

  graphData = {
    nodes,
    edges: uniqueEdges,
  }

  graph.changeData(graphData)
  graph.render()
  rebuildCrossPairRows()
}

const loadSatelliteRelations = async (norad?: number) => {
  if (!graph) {
    initGraph()
  }
  nextTick(async () => {
    if (store.activedTask?.id) {
      let res
      if (norad) {
        res = await getSatelliteRelationsBySatellite(norad, store.activedTask.id)
      } else {
        res = await getSatelliteRelations(store.activedTask.id)
      }
      if (res.code === 200) {
        allRelationships.length = 0
        allRelationships.push(...res.data.relationships)

        allNodesCache = res.data.nodes.map((node: any) => ({
          id: `Satellite-${node.norad}`,
          label: node.name_en,
          country: node.country,
          launch_place: node.launch_place,
          rocket: node.rocket,
          contractors: node.contractors,
          sat_type: node.sat_type,
          operator: node.operator,
          norad: node.norad,
        }))

        if (allNodesCache.length === 0) return
        allNodesCache.forEach((node: any) => {
          if (!node.labelCfg) {
            node.labelCfg = {}
          }
          node.labelCfg.style = {
            fontSize: 1.2,
          }
        })

        if (relationType.value === '抵近') {
          syncProximityDateDefault()
        }
        filterAndRenderGraph()
      }
    }
  })
}
const mapNodeSize = (nodes: any, propertyName: any, visualRange: any) => {
  let minp = 9999999999
  let maxp = -9999999999
  nodes.forEach((node: any) => {
    node[propertyName] = Math.pow(node[propertyName], 1 / 3)
    minp = node[propertyName] < minp ? node[propertyName] : minp
    maxp = node[propertyName] > maxp ? node[propertyName] : maxp
  })
  const rangepLength = maxp - minp
  const rangevLength = visualRange[1] - visualRange[0]
  nodes.forEach((node: any) => {
    node.size = ((node[propertyName] - minp) / rangepLength) * rangevLength + visualRange[0]
  })
}
// 选择的右侧中心簇
const selectedCluster = ref('')
// 节点数量
const nodeCount = ref(0)
// 边数量
const relationCount = ref(0)
// 卫星数量
const sateCount = ref(0)
// 中心簇数量
const centerClusterCount = ref(0)
// 选择的模式
const selectedMode = computed(() => relationType.value || '未选择')
// 当前选择的节点
const selectedNode = ref<SatelliteDetail>()
// 选择的关系
const selectedEdge = ref()
/** 中心簇聚类维度，默认按国家分组。 */
const groupType = ref('同一国家')
/** 卫星对关系筛选（单选），默认轨道共面。 */
const relationType = ref('轨道共面')
const showDescPanel = ref(true)
const showTablePanel = ref(false)
/** 抵近关系筛选日期（YYYY-MM-DD）。 */
const proximityDate = ref('')
/** 右侧面板顶部跨簇关系对列表。 */
const crossPairRows = ref<CrossClusterPairRow[]>([])
/** 顶部卫星筛选输入（NORAD 或国际编号等）。 */
const satelliteSearchQuery = ref('')

/**
 * 将搜索关键字解析为 NORAD 编号。
 * @param query 用户输入
 * @returns 匹配到的 NORAD，未匹配返回 null
 */
function resolveSearchNorad(query: string): number | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  const taskList = store.allSatelliteOfTask

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed)
  }

  const lower = trimmed.toLowerCase()
  const byInt = taskList.find((s) => {
    const intId = String((s as SatelliteData & { int_id?: string }).int_id ?? '')
    return intId && intId.toLowerCase() === lower
  })
  if (byInt) return Number(byInt.norad_id)

  const byName = taskList.find((s) => s.name_en?.toLowerCase() === lower)
  if (byName) return Number(byName.norad_id)

  return null
}

/**
 * 在图谱上选中、高亮并聚焦指定节点。
 * @param node G6 节点实例
 */
function focusGraphNode(node: INode) {
  if (!graph) return
  graph.getNodes().forEach((n) => {
    graph.setItemState(n!, 'selected', false)
    graph.clearItemStates(n!)
  })
  graph.setItemState(node, 'highlight', true)
  graph.setItemState(node, 'selected', true)
  graph.focusItem(node, true, { duration: 400, easing: 'easeCubic' })
}

/**
 * 按 NORAD / 编号搜索卫星：定位图谱节点并在左侧展示详情。
 */
async function handleSatelliteSearch() {
  const norad = resolveSearchNorad(satelliteSearchQuery.value)
  if (norad === null || Number.isNaN(norad)) {
    ElMessage.warning('请输入有效的 NORAD 或国际编号')
    return
  }

  if (!graph) {
    ElMessage.warning('图谱尚未加载完成')
    return
  }

  const nodeId = `Satellite-${norad}`
  const node = graph.findById(nodeId) as INode | null
  if (!node) {
    ElMessage.warning('当前图谱中未包含该卫星，请调整关系筛选或确认编号')
    return
  }

  crossPairActiveIndex.value = -1
  activedIndex.value = -1
  selectedEdge.value = undefined
  showDescPanel.value = true

  focusGraphNode(node)

  try {
    const res = await getSatelliteDetail({ norad })
    if (res.code === 200) {
      selectedNode.value = res.data
    } else {
      ElMessage.error('获取卫星详情失败')
    }
  } catch {
    ElMessage.error('获取卫星详情失败')
  }
}

/** 是否展示跨簇关系区块（与当前关系类型、中心簇类型配套）。 */
const showCrossPairSection = computed(() => {
  return Boolean(groupType.value) && Boolean(relationType.value)
})

/** 跨簇关系区块标题。 */
const crossPairSectionTitle = computed(() => {
  if (groupType.value === '同一国家') {
    return `跨国${relationType.value}关系`
  }
  return `跨簇${relationType.value}关系`
})

watch(relationType, () => {
  if (relationType.value === '抵近') {
    syncProximityDateDefault()
  }
  crossPairActiveIndex.value = -1
  filterAndRenderGraph()
  groupType.value = '同一国家'
  selectedNode.value = undefined
})
watch(groupType, () => {
  crossPairActiveIndex.value = -1
  activedIndex.value = -1
  if (graph) {
    graph.getNodes().forEach((node) => {
      graph.setItemState(node, 'highlight', false)
    })
  }
  if (groupType.value) {
    syncLeftStats()
    rebuildCrossPairRows()
  }
})
// 销毁并按照条件重新加载图谱数据
const loadGraphData = async (norad?: number) => {
  graph && graph.destroy()
  activedIndex.value = -1
  activeIdx.value = -1
  await initGraph()
  nextTick(() => {
    loadSatelliteRelations(norad)
  })
}
defineExpose({
  loadGraphData,
})

/**
 * 侧栏显隐或窗口尺寸变化时，同步 G6 画布大小。
 */
function onGraphResize() {
  const container = graphCanvas.value
  if (graph && container) {
    graph.changeSize(container.clientWidth, container.clientHeight)
    graph.fitView(undefined, undefined, true)
  }
}

watch(showDescPanel, () => {
  nextTick(() => onGraphResize())
})

watch(
  isNetViewActive,
  (show) => {
    if (show) {
      nextTick(async () => {
        loadGraphData()
        window.addEventListener('resize', onGraphResize)
      })
    } else {
      window.removeEventListener('resize', onGraphResize)
      graph && graph.destroy()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', onGraphResize)
})
</script>
<style lang="scss" scoped>
.graph-container {
  /* 与中间图谱区域一致的暗色底 */
  --net-chrome-bg: linear-gradient(180deg, #0a2238 0%, #061525 100%);
  --net-chrome-border: rgba(79, 147, 221, 0.14);
  --net-surface-bg: rgba(10, 40, 62, 0.82);
  --net-surface-border: rgba(79, 147, 221, 0.12);

  position: relative;
  height: calc(100vh - 120px);
  width: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;

  &--standalone {
    height: calc(100vh - 88px);
    min-height: 480px;
    border-radius: 12px;
    border: 1px solid var(--surface-border-color, rgba(79, 147, 221, 0.25));
    background: var(--net-chrome-bg);
    overflow: hidden;
  }

  .graph-layout {
    display: flex;
    flex: 1;
    min-height: 0;
    min-width: 0;
    position: relative;
    overflow: hidden;
  }

  .graph-canvas {
    flex: 1;
    min-width: 0;
    min-height: 200px;
    background: radial-gradient(ellipse 80% 70% at 50% 45%, #0d3352 0%, #061525 72%);
    border-left: 1px solid var(--net-chrome-border);
    border-right: 1px solid var(--net-chrome-border);
  }

  .panel-head {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--accent-color-active, #73f3ff);
    padding: 14px 16px 8px;
    border-bottom: 1px solid var(--net-chrome-border);
    background: var(--net-chrome-bg);
  }

  .detail-empty,
  .panel-empty {
    margin: 12px;
    padding: 16px 14px;
    border-radius: 12px;
    border: 1px dashed rgba(115, 243, 255, 0.25);
    background: rgba(19, 67, 98, 0.35);
    color: #a8c8e8;
    font-size: 13px;
    line-height: 1.55;
    text-align: center;
  }

  .panel-empty__icon {
    display: block;
    font-size: 28px;
    margin-bottom: 8px;
    opacity: 0.85;
  }

  .panel-empty__title {
    margin: 0 0 8px;
    font-weight: 700;
    color: #d8ecff;
  }

  .panel-empty__hint {
    margin: 0;
    font-size: 12px;
    color: #8eb4d4;
  }

  .panel-empty--compact {
    margin: 8px 12px;
    padding: 12px;
    font-size: 12px;
    text-align: left;
  }

  .right-panel-section {
    width: 100%;
    box-sizing: border-box;
  }

  .right-panel-divider {
    height: 1px;
    margin: 4px 12px 12px;
    background: rgba(115, 243, 255, 0.22);
  }

  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: #d8ecff;
    text-align: center;
    padding: 10px 8px 4px;
  }

  .section-label {
    margin-top: 4px;
  }

  .legend {
    width: 98%;
    display: flex;
    flex-direction: column-reverse;
    flex-wrap: wrap;
    gap: 10px;
    position: absolute;
    bottom: 5px;
    left: 5px;

    .tag {
      width: 100px;

      &:hover {
        cursor: pointer;
      }
    }
  }

  .scroll-bar-left {
    background: var(--net-chrome-bg);
    width: 300px;
    flex-shrink: 0;
    height: auto;
    z-index: 2;
    border-right: 1px solid var(--net-chrome-border);

    .scroll-title {
      font-size: 12px;
      color: #8eb4d4;
      padding: 8px 16px 4px;
      text-align: left;
    }

    .tag-text {
      font-size: 13px;
      text-align: left;
      padding: 10px 12px;
      margin: 8px 12px;
      background: var(--net-surface-bg);
      color: #e6f1ff;
      border-radius: 12px;
      border: 1px solid var(--net-surface-border);
    }

    .relation-node-grid {
      gap: 8px;
      padding: 8px 12px 12px;

      &:not(.relation-node-grid--detail) {
        display: flex;
        flex-direction: row;
        align-items: stretch;

        div {
          flex: 1 1 0;
          min-width: 0;
        }
      }

      div {
        display: flex;
        flex-direction: column;
        gap: 4px;
        background: var(--net-surface-bg);
        border: 1px solid var(--net-surface-border);
        border-radius: 10px;
        padding: 8px 6px;
        color: #e6f1ff;
        text-align: center;

        &>span:first-child {
          font-size: 11px;
          color: #8eb4d4;
        }

        &>span:last-child {
          font-weight: 700;
          font-size: 15px;
          color: #73f3ff;
        }
      }

      &--detail {
        display: grid;
        grid-template-columns: 1fr 1fr;

        div {
          text-align: left;
          padding: 8px 10px;

          &>span:last-child {
            font-size: 13px;
            color: #e6f1ff;
            word-break: break-all;
          }
        }
      }
    }
  }

  .scroll-bar-left,
  .scroll-bar-right {
    height: 100%;
    max-height: 100%;
    background: var(--net-chrome-bg);

    :deep(.el-scrollbar__wrap) {
      max-width: 100%;
      background: var(--net-chrome-bg);
    }

    :deep(.el-scrollbar__view) {
      background: var(--net-chrome-bg);
    }
  }

  .scroll-bar-right {
    width: 300px;
    max-width: 28%;
    flex-shrink: 0;
    min-width: 0;
    z-index: 2;
    border-left: 1px solid var(--net-chrome-border);
    box-sizing: border-box;

    .title {
      font-weight: bold;
      font-family: inherit;
      color: #d8ecff;
      text-align: center;
      padding: 5px 8px;
    }

    .collapse {
      padding: 0 8px 12px;
      box-sizing: border-box;
      max-width: 100%;

      .cell-item {
        max-width: 100%;
      }

      .link-label {
        color: #cde4ff;
        display: block;
        word-break: break-word;
        white-space: normal;
        line-height: 1.35;
        font-size: 12px;

        &.active {
          color: #ffb0b0;
        }
      }

      .link-number {
        cursor: pointer;
        color: #73f3ff;
        white-space: nowrap;
        flex-shrink: 0;

        &.active {
          color: #ffb0b0;
        }
      }

      :deep(.cluster-descriptions) {
        width: 100%;
        padding-bottom: 12px;
        box-sizing: border-box;
      }

      :deep(.cluster-descriptions .el-descriptions__body) {
        width: 100%;
      }

      :deep(.cluster-descriptions table) {
        width: 100% !important;
        table-layout: fixed;
      }

      :deep(.atlas-app-descriptions__title) {
        color: #d8ecff;
        font-size: 13px;
      }

      :deep(.atlas-app-descriptions__label) {
        color: #cde4ff;
        background: rgba(19, 67, 98, 0.9);
        width: auto !important;
        max-width: 72%;
        word-break: break-word;
        white-space: normal !important;
        vertical-align: middle;
      }

      :deep(.atlas-app-descriptions__content) {
        color: #eef7ff;
        background: rgba(14, 52, 79, 0.85);
        width: auto !important;
        text-align: right;
        vertical-align: middle;
        padding-right: 8px !important;
      }

      :deep(.atlas-app-descriptions__cell) {
        word-break: break-word;
      }
    }
  }

  .net-toolbar {
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 10px 16px 12px;
    background: var(--net-chrome-bg);
    border-bottom: 1px solid var(--net-chrome-border);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .net-toolbar__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 16px;
    width: 100%;
    min-width: 0;
  }

  .net-toolbar__row--controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    column-gap: 24px;
    row-gap: 12px;
    align-items: center;
  }

  .net-toolbar__label {
    font-size: 13px;
    font-weight: 700;
    color: #d8ecff;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .net-toolbar__radios {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 14px;
    min-width: 0;
  }

  .net-toolbar__cell {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px 12px;
    min-width: 0;
  }

  .net-toolbar__cell--cluster {
    justify-content: flex-start;
  }

  .net-toolbar__cell--search {
    flex-wrap: nowrap;
    justify-content: flex-end;
    width: max-content;
    max-width: 100%;
  }

  .net-toolbar__cell--actions {
    flex-wrap: nowrap;
    justify-content: flex-end;
    gap: 14px;
    padding-left: 20px;
    border-left: 1px solid var(--net-chrome-border);
  }

  .net-toolbar__field {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .net-toolbar__select {
    width: 168px;
  }

  .net-toolbar__date {
    width: 140px !important;
    flex-shrink: 0;
  }

  .net-toolbar__input {
    width: 168px;
    flex-shrink: 0;
  }

  .net-toolbar__search-btn {
    flex-shrink: 0;
  }

  .net-toolbar :deep(.atlas-app-radio__label),
  .net-toolbar :deep(.atlas-app-switch__label),
  .net-toolbar :deep(.atlas-app-select__placeholder),
  .net-toolbar :deep(.atlas-app-input__inner) {
    color: #d8ecff;
  }

  .net-toolbar :deep(.atlas-app-radio__inner) {
    border-color: rgba(115, 243, 255, 0.45);
  }

  .net-toolbar :deep(.atlas-app-switch) {
    white-space: nowrap;
  }

  .net-toolbar :deep(.net-toolbar__select.atlas-app-select) {
    width: 168px;
  }
}

@media (max-width: 1280px) {
  .graph-container--standalone {
    height: calc(100vh - 88px);
  }

  .graph-container .scroll-bar-left {
    width: 260px;
  }

  .graph-container .scroll-bar-right {
    width: 260px;
    max-width: 34%;
  }

  .graph-container .net-toolbar__row--controls {
    grid-template-columns: 1fr;
  }

  .graph-container .net-toolbar__cell--search {
    width: 100%;
    justify-content: flex-start;
  }

  .graph-container .net-toolbar__cell--actions {
    border-left: none;
    padding-left: 0;
    justify-content: flex-start;
  }
}
</style>
