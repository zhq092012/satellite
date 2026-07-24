<template>
  <el-drawer
    v-model="visible"
    title="📐 战术决策算力矩阵面板 (Tactical Computation Matrices)"
    direction="rtl"
    size="70%"
    custom-class="tactical-matrix-drawer"
    :destroy-on-close="false"
  >
    <div class="drawer-header-actions">
      <el-button type="primary" size="small" icon="Download" @click="exportJson"> 导出全量矩阵 JSON </el-button>
      <el-button type="success" size="small" icon="Refresh" :loading="loading" @click="loadMatrices">
        刷新算力矩阵
      </el-button>
    </div>

    <div v-loading="loading" class="matrix-content-wrap">
      <el-tabs v-model="activeTab" class="matrix-tabs">
        <!-- 1. passMatrix 卫星过境战场矩阵 -->
        <el-tab-pane label="🛰️ 卫星过境战场矩阵 (passMatrix)" name="pass">
          <div class="tab-desc">
            记录全推演周期内，天基低轨卫星 (Layer 2) 轨迹过境战区边界
            <code>(min_lat, max_lat, min_lng, max_lng)</code> 的时间窗口序列。
          </div>
          <el-table :data="passMatrixData" border stripe style="width: 100%" class="dark-table">
            <el-table-column prop="sat_id" label="卫星ID" width="160" />
            <el-table-column prop="sat_name" label="卫星名称" width="180" />
            <el-table-column label="战区过境时间窗口序列">
              <template #default="{ row }">
                <div v-if="row.windows && row.windows.length > 0" class="window-chips">
                  <el-tag
                    v-for="(w, idx) in row.windows"
                    :key="idx"
                    type="info"
                    size="small"
                    effect="dark"
                    class="window-tag"
                  >
                    T+{{ formatMin(w.window_start) }}m ~ T+{{ formatMin(w.window_end) }}m
                  </el-tag>
                </div>
                <span v-else class="text-gray">全推演时段内未过境战区</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 2. visibleMatrix 卫星过境地面站矩阵 -->
        <el-tab-pane label="📡 卫星过境地面站矩阵 (visibleMatrix)" name="visible">
          <div class="tab-desc">
            记录天基卫星 (Layer 2) 与地面/海峡接收站 (Layer 1) 满足仰角遮蔽角 <= 10° 的视线通视窗口序列。
          </div>
          <el-table :data="visibleMatrixData" border stripe style="width: 100%" class="dark-table">
            <el-table-column prop="source_name" label="空间卫星 (源节点)" width="180" />
            <el-table-column prop="target_name" label="链路/接收站 (目标节点)" width="200" />
            <el-table-column label="星地通视时间窗口">
              <template #default="{ row }">
                <div v-if="row.windows && row.windows.length > 0" class="window-chips">
                  <el-tag
                    v-for="(w, idx) in row.windows"
                    :key="idx"
                    type="success"
                    size="small"
                    effect="dark"
                    class="window-tag"
                  >
                    T+{{ formatMin(w.window_start) }}m ~ T+{{ formatMin(w.window_end) }}m
                  </el-tag>
                </div>
                <span v-else class="text-gray">无有效通视窗口</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 3. overheadMatrix 时间开销矩阵 -->
        <el-tab-pane label="⏱️ 处理延时开销矩阵 (overheadMatrix)" name="overhead">
          <div class="tab-desc">
            解算从推演开始 (T+0m) 至结束全时间轴范围内每一个时间 Tick 的动态链路延时演化轨迹，包含网络传输、硬件解包及打击/干扰叠加延时。点击行左侧箭头展开图标可查看全量 Tick 明细。
          </div>
          <el-table :data="overheadMatrixData" border stripe style="width: 100%" class="dark-table">
            <!-- 行展开子表格：显示每个 Tick 的详细延时 -->
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="tick-expand-box">
                  <div class="tick-expand-title">
                    ⏱️ 链路 [{{ row.source_name }} ➔ {{ row.target_name }}] 从 T+0m 至 T+60m 全 Tick 延时明细序列
                  </div>
                  <el-table :data="row.ticks" border size="small" style="width: 100%" class="dark-subtable">
                    <el-table-column label="Tick 时钟" width="110" align="center">
                      <template #default="{ row: tick }">
                        <span class="text-cyan font-bold">T+{{ tick.tick_min }}m</span>
                      </template>
                    </el-table-column>
                    <el-table-column prop="trans_delay" label="网络传输延时 (s)" width="140" align="center" />
                    <el-table-column prop="proc_delay" label="硬件解包延时 (s)" width="140" align="center" />
                    <el-table-column label="打击/干扰叠加 (s)" width="160" align="center">
                      <template #default="{ row: tick }">
                        <span v-if="tick.extra_delay > 0" :class="tick.status === 'DESTROYED' ? 'text-danger font-bold' : 'text-orange font-bold'">
                          +{{ tick.extra_delay }}s
                        </span>
                        <span v-else class="text-gray">0s</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="该 Tick 综合延时 (s)" width="170" align="center">
                      <template #default="{ row: tick }">
                        <span :class="tick.extra_delay > 0 ? 'text-danger font-bold' : 'text-cyan font-bold'">
                          {{ tick.total_overhead }}s
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column label="该 Tick 链路状态" align="center">
                      <template #default="{ row: tick }">
                        <el-tag :type="getStatusType(tick.status)" size="small" effect="dark">
                          {{ getStatusText(tick.status) }}
                        </el-tag>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="链路视角" width="160" align="center">
              <template #default="{ row }">
                <el-tag :type="getLinkTypeTag(row.link_type)" size="small" effect="plain">
                  {{ getLinkTypeText(row.link_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="source_name" label="起点节点 (Source)" width="150" />
            <el-table-column prop="target_name" label="终点节点 (Target)" width="150" />
            <el-table-column label="基础 ➔ 峰值 (s)" width="140" align="center">
              <template #default="{ row }">
                <span>{{ row.min_overhead }}s ➔ </span>
                <span :class="row.max_overhead > row.min_overhead ? 'text-danger font-bold' : 'text-cyan'">{{ row.max_overhead }}s</span>
              </template>
            </el-table-column>
            <el-table-column prop="avg_overhead" label="全周期均值 (s)" width="130" align="center">
              <template #default="{ row }">
                <span class="text-cyan font-bold">{{ row.avg_overhead }}s</span>
              </template>
            </el-table-column>
            <el-table-column label="全推演 Tick 延时演化分段" min-width="260">
              <template #default="{ row }">
                <div v-if="row.segments && row.segments.length > 0" class="segment-chips">
                  <el-tag
                    v-for="(seg, idx) in row.segments"
                    :key="idx"
                    :type="seg.extra_delay > 0 ? (seg.status === 'DESTROYED' ? 'danger' : 'warning') : 'info'"
                    size="small"
                    effect="dark"
                    class="segment-tag"
                  >
                    T+{{ seg.start_min }}m~{{ seg.end_min }}m: {{ seg.total_overhead }}s 
                    <template v-if="seg.extra_delay > 0">
                      (+{{ seg.extra_delay }}s {{ seg.status === 'DESTROYED' ? '摧毁' : '干扰' }})
                    </template>
                  </el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="link_status" label="当前最终状态" width="115" align="center">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.link_status)" size="small" effect="dark">
                  {{ getStatusText(row.link_status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <!-- 4. attackMatrix 可打击矩阵 -->
        <el-tab-pane label="⚔️ 武器可打击矩阵 (attackMatrix)" name="attack">
          <div class="tab-desc">
            解算红方武器对蓝方全域节点的可打击时间窗口，明确区分武器【理论能力可造成的延时】与实时推演中【实际开火执行后叠加的实际延时】。
          </div>
          <el-table :data="attackMatrixData" border stripe style="width: 100%" class="dark-table">
            <el-table-column prop="weapon_name" label="红方武器名称" width="160" />
            <el-table-column prop="category" label="武器类别" width="95" align="center">
              <template #default="{ row }">
                <el-tag :type="getWeaponTagType(row.category)" size="small" effect="plain">
                  {{ row.category }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="kill_type" label="毁伤性质" width="105" align="center">
              <template #default="{ row }">
                <el-tag :type="row.kill_type === 'HARD' ? 'danger' : 'warning'" size="small" effect="dark">
                  {{ row.kill_type === 'HARD' ? '💥 硬摧毁' : '⚡ 软干扰' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target_name" label="蓝方目标节点" width="140" />
            <el-table-column prop="target_layer" label="目标层级" width="125" align="center">
              <template #default="{ row }">
                <span>{{ getLayerName(row.target_layer) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="theoretical_delay" label="理论可造成延时 (s)" width="155" align="center">
              <template #default="{ row }">
                <span class="text-orange">
                  +{{ row.theoretical_delay }}s
                </span>
                <span class="text-gray" style="margin-left: 3px;">
                  ({{ row.kill_type === 'HARD' ? '摧毁致瘫' : '干扰重传' }})
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="is_executed" label="实际交战状态" width="125" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.is_executed" type="danger" size="small" effect="dark">
                  🎯 已开火打击
                </el-tag>
                <el-tag v-else type="info" size="small" effect="plain">
                  ⚪ 待命未开火
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="actual_delay" label="实际已叠加延时 (s)" width="160" align="center">
              <template #default="{ row }">
                <span v-if="row.is_executed" class="text-danger font-bold">
                  +{{ row.actual_delay }}s
                </span>
                <span v-else class="text-gray">
                  0s (未触发)
                </span>
              </template>
            </el-table-column>
            <el-table-column label="可打击窗口序列" min-width="160">
              <template #default="{ row }">
                <div v-if="row.windows && row.windows.length > 0" class="window-chips">
                  <el-tag
                    v-for="(w, idx) in row.windows"
                    :key="idx"
                    type="danger"
                    size="small"
                    effect="dark"
                    class="window-tag"
                  >
                    T+{{ formatMin(w.window_start) }}m ~ T+{{ formatMin(w.window_end) }}m
                  </el-tag>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { sqliteClient } from '@/db/sqlite-client'
import { ElMessage } from 'element-plus'

const visible = ref(false)
const loading = ref(false)
const activeTab = ref('pass')
const baseStartTime = ref(1781683200)

const passMatrixData = ref<any[]>([])
const visibleMatrixData = ref<any[]>([])
const overheadMatrixData = ref<any[]>([])
const attackMatrixData = ref<any[]>([])

const openDrawer = (startTime?: number) => {
  if (startTime) baseStartTime.value = startTime
  visible.value = true
  loadMatrices()
}

const loadMatrices = async () => {
  loading.value = true
  try {
    const res = await sqliteClient.generateMatrices('scen-001')
    passMatrixData.value = res.passMatrix || []
    visibleMatrixData.value = res.visibleMatrix || []
    overheadMatrixData.value = res.overheadMatrix || []
    attackMatrixData.value = res.attackMatrix || []
  } catch (err: any) {
    console.error('加载算力矩阵失败:', err)
    ElMessage.error(`加载算力矩阵失败: ${err.message}`)
  } finally {
    loading.value = false
  }
}

const formatMin = (ts: number) => {
  const diff = ts - baseStartTime.value
  return Math.max(0, Math.floor(diff / 60))
}

const getStatusType = (status: string) => {
  if (status === 'TRANSMITTING') return 'success'
  if (status === 'JAMMED') return 'warning'
  if (status === 'DESTROYED') return 'danger'
  return 'info'
}

const getStatusText = (status: string) => {
  if (status === 'TRANSMITTING') return '正常传输'
  if (status === 'JAMMED') return '受干扰'
  if (status === 'DESTROYED') return '已摧毁'
  return '未连接'
}

const getWeaponTagType = (cat: string) => {
  if (cat === 'KINETIC') return 'danger'
  if (cat === 'DEW') return 'warning'
  if (cat === 'EW') return 'info'
  return 'primary'
}

const getLayerName = (layer: number) => {
  if (layer === 2) return '空间层 (Satellite)'
  if (layer === 1) return '链路层 (Station)'
  if (layer === 0) return '地面层 (Command)'
  return '未知'
}

const getLinkTypeTag = (linkType: string) => {
  if (linkType === 'SAT_TO_STATION') return 'primary'
  return 'success'
}

const getLinkTypeText = (linkType: string) => {
  if (linkType === 'SAT_TO_STATION') return '🛰️ 卫星 ➔ 📡 地面站'
  return '📡 地面站 ➔ 🏢 指挥中心'
}

const exportJson = () => {
  const data = {
    passMatrix: passMatrixData.value,
    visibleMatrix: visibleMatrixData.value,
    overheadMatrix: overheadMatrixData.value,
    attackMatrix: attackMatrixData.value,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Tactical_Matrices_${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('四大战术算力矩阵 JSON 导出一成功！')
}

defineExpose({
  openDrawer,
})
</script>

<style scoped>
.drawer-header-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}
.matrix-content-wrap {
  min-height: 400px;
}
.tab-desc {
  font-size: 13px;
  color: #9ca3af;
  margin-bottom: 14px;
  background: rgba(17, 24, 39, 0.6);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid #00e1ff;
}
.window-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.window-tag {
  font-family: monospace;
}
.text-cyan {
  color: #00e1ff;
}
.text-danger {
  color: #ff4d4f;
}
.text-orange {
  color: #ff9300;
}
.text-gray {
  color: #6b7280;
  font-size: 12px;
}
.font-bold {
  font-weight: bold;
}
.tick-expand-box {
  padding: 12px 16px;
  background: rgba(15, 23, 42, 0.9);
  border-radius: 6px;
  margin: 6px 0;
  border: 1px solid rgba(0, 225, 255, 0.2);
}
.tick-expand-title {
  font-size: 13px;
  font-weight: bold;
  color: #00e1ff;
  margin-bottom: 10px;
}
.segment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.segment-tag {
  font-family: monospace;
}
</style>
