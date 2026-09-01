<template>
  <div ref="graphContainer" class="graph-container">
    <div class="satellite-type">
      <div class="nav-h5">卫星对关系：</div>
      <el-checkbox-group v-model="relationType">
        <el-checkbox value="轨道共面">轨道共面</el-checkbox>
        <el-checkbox value="轨道相似">轨道相似</el-checkbox>
        <el-checkbox value="相位稳定">相位稳定</el-checkbox>
        <el-checkbox value="抵近">抵近</el-checkbox>
      </el-checkbox-group>
      <div class="nav-h5">中心簇类型：</div>
      <el-select v-model="groupType" placeholder="请选择卫星关系类型" style="width: 150px" size="small" class="select">
        <el-option label="同一国家" value="同一国家"> </el-option>
        <el-option label="同一运载火箭" value="同一运载火箭"> </el-option>
        <el-option label="同一发射地点" value="同一发射地点"> </el-option>
        <el-option label="同一制造商" value="同一制造商"> </el-option>
        <el-option label="同一载荷类型" value="同一载荷类型"> </el-option>
        <el-option label="同一测控方" value="同一测控方"> </el-option>
      </el-select>
      <el-switch v-model="showDescPanel" active-action-icon="View" inactive-action-icon="Hide" active-text="显示图谱统计" />
      <!-- <el-switch
        v-if="selectedType !== '抵近'"
        v-model="showTablePanel"
        active-action-icon="View"
        inactive-action-icon="Hide"
        active-text="显示统计表格"
      /> -->
      <div>
        <el-button type="primary" size="small" @click="store.showNetView = false">关闭网络视图</el-button>
      </div>
    </div>
    <el-scrollbar class="scroll-bar-left" v-show="showDescPanel">
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
      <div class="tag-text">
        <div>节点/连线详情</div>
      </div>
      <div class="relation-node-grid" v-if="selectedNode">
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
    <el-scrollbar class="scroll-bar-right" v-show="showDescPanel">
      <div class="title">{{ groupType }}</div>
      <div class="collapse" v-if="groupType === '同一国家'">
        <el-descriptions :column="1" size="small" border style="padding-bottom: 20px">
          <template #title>
            共有 <mark>{{ stats?.country.size }}</mark>组国家
          </template>

          <el-descriptions-item v-for="([country, cout], idx) in stats?.country.entries()">
            <template #label>
              <div class="cell-item">
                <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ country ?? '未知国家'
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
        <el-descriptions :column="1" size="small" border style="padding-bottom: 20px">
          <template #title>
            共有 <mark>{{ stats?.rocket.size }}</mark>组运载火箭
          </template>

          <el-descriptions-item v-for="([rocket, cout], idx) in stats?.rocket.entries()">
            <template #label>
              <div class="cell-item">
                <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ rocket ?? '未知火箭'
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
        <el-descriptions :column="1" size="small" border style="padding-bottom: 20px">
          <template #title>
            共有 <mark>{{ stats?.launch_place.size }}</mark>组发射地点
          </template>

          <el-descriptions-item v-for="([launch_place, cout], idx) in stats?.launch_place.entries()">
            <template #label>
              <div class="cell-item">
                <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ launch_place ??
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
        <el-descriptions :column="1" size="small" border style="padding-bottom: 20px">
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
        <el-descriptions :column="1" size="small" border style="padding-bottom: 20px" label-width="280">
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
        <el-descriptions :column="1" size="small" border style="padding-bottom: 20px" label-width="280">
          <template #title>
            共有 <mark>{{ stats?.contractors.size }}</mark>组测控方
          </template>

          <el-descriptions-item v-for="([contractors, cout], idx) in stats?.contractors.entries()">
            <template #label>
              <div class="cell-item">
                <span :class="{ 'link-label': true, active: idx === activedIndex }">第{{ idx + 1 }}组 {{ contractors ??
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
    </el-scrollbar>
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
import type { SatelliteData, SatelliteNode } from '@/types/dashboard'
import G6, { Graph, type EdgeConfig, type GraphData, type INode, type NodeConfig } from '@antv/g6'
import dayjs from 'dayjs'
import { computed, nextTick, reactive, ref, watch } from 'vue'

const store = useLayoutStore()
const satelliteList = ref<SatelliteData[]>(store.allSatelliteOfTask)
// 其他统计
const activedIndex = ref(-1)
const setActiveIndex = (idx: number, norIds: number[] | Set<string>, cluster: string) => {
  activedIndex.value = idx
  selectedCluster.value = cluster
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
const graphContainer = ref<HTMLElement | null>(null)

async function initGraph() {
  const container = graphContainer.value
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
 * 加载卫星关系
 */
const filterAndRenderGraph = () => {
  if (!graph || !allNodesCache.length) return

  const filteredRelationships = allRelationships.filter((rel) => {
    if (!relationType.value || relationType.value.length === 0) return true
    return relationType.value.includes(rel.relation)
  })

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
      label: relationType.value.includes('抵近')
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
const selectedMode = computed(() => {
  return relationType.value.join('+')
})
// 当前选择的节点
const selectedNode = ref<SatelliteDetail>()
// 选择的关系
const selectedEdge = ref()
// 同一国家等单选
const groupType = ref('')
// 轨道共面、轨道相似、相位稳定、抵近四种组合选择
const relationType = ref<string[]>([])
const showDescPanel = ref(true)
const showTablePanel = ref(false)

watch(
  relationType,
  () => {
    filterAndRenderGraph()
    // 清空中心簇
    groupType.value = ''
    selectedNode.value = undefined
  },
  { deep: true }
)
watch(groupType, () => {
  // 清空索引
  activedIndex.value = -1
  // 去掉高亮
  graph.getNodes().forEach((node) => {
    graph.setItemState(node, 'highlight', false)
  })
  if (groupType.value) {
    syncLeftStats()
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
watch(
  () => store.showNetView,
  (show) => {
    if (show) {
      nextTick(async () => {
        loadGraphData()
        window.addEventListener('resize', () => {
          const container = graphContainer.value
          if (graph && container) {
            graph.changeSize(container.clientWidth, container.clientHeight)
            graph.fitCenter()
          }
        })
      })
    } else {
      graph && graph.destroy()
    }
  },
  { immediate: true }
)
</script>
<style lang="scss" scoped>
.graph-container {
  position: relative;
  height: calc(100vh - 120px);
  width: 100%;

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
    background: #0f3c57;
    width: 350px;
    height: calc(100vh - 60px - 60px - 42px);
    position: absolute;
    top: 44px;
    left: 0;
    z-index: 2;

    .scroll-title {
      font-size: 14px;
      color: #ccc;
      padding: 10px;
      text-align: left;
    }

    .tag-text {
      font-size: 14px;
      text-align: left;
      padding: 10px;
      margin: 10px;
      background: #1d5d86;
      color: #e6f1ff;
      border-radius: 10px;
    }

    .relation-node-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      padding: 10px;

      div {
        display: flex;
        flex-direction: column;
        background: #1d5d86;
        border-radius: 5px;
        padding: 2px;
        color: #e6f1ff;

        &>span:last-child {
          font-weight: bolder;
        }
      }
    }
  }

  .scroll-bar-right {
    background: #0f3c57;
    width: 420px;
    height: calc(100vh - 60px - 60px - 42px);
    position: absolute;
    top: 44px;
    right: 0;
    z-index: 2;

    .title {
      font-weight: bold;
      font-family: inherit;
      color: #d8ecff;
      text-align: center;
      padding: 5px 0;
    }

    .collapse {
      padding: 0 10px;

      .link-label {
        color: #cde4ff;

        &.active {
          color: #ffb0b0;
        }
      }

      .link-number {
        cursor: pointer;
        color: #73f3ff;

        &.active {
          color: #ffb0b0;
        }
      }

      :deep(.atlas-app-descriptions__title) {
        color: #d8ecff;
      }

      :deep(.atlas-app-descriptions__label) {
        color: #cde4ff;
        background: rgba(19, 67, 98, 0.9);
      }

      :deep(.atlas-app-descriptions__content) {
        color: #eef7ff;
        background: rgba(14, 52, 79, 0.85);
      }
    }
  }

  .satellite-type {
    width: 100%;
    background: linear-gradient(135deg, #113053 0%, #0e3861 100%);
    padding: 5px 10px;
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    gap: 10px;
    align-items: center;

    .nav-h5 {
      font-size: 14px;
      color: #d8ecff;
    }

    .select {
      padding: 5px;
      width: 150px;
    }

    :deep(.atlas-app-checkbox__label),
    :deep(.atlas-app-switch__label),
    :deep(.atlas-app-select__placeholder),
    :deep(.atlas-app-input__inner) {
      color: #d8ecff;
    }
  }
}
</style>
