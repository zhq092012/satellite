<template>
  <div class="relation-block" v-if="relation">
    <div class="sub-title">接收站（{{ relation.receiveObjList?.length || 0 }}）</div>
    <div v-if="relation.receiveObjList?.length" class="relation-table-wrap">
      <table class="native-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>用途</th>
            <th>经纬度</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in relation.receiveObjList" :key="r.receiveId">
            <td>{{ r.receiveId }}</td>
            <td>{{ r.receiveName }}</td>
            <td>{{ r.receiveUsage || '--' }}</td>
            <td>{{ r.receiveLatLon }}</td>
            <td :class="r.receiveStatus === 1 ? 'num-red' : 'num-green'">
              {{ statusLabel(r.receiveStatus) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-hint">暂无接收站</div>

    <div class="sub-title">中心站（{{ relation.stationObjList?.length || 0 }}）</div>
    <div v-if="relation.stationObjList?.length" class="relation-table-wrap">
      <table class="native-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>名称</th>
            <th>经纬度</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in relation.stationObjList" :key="s.stationId">
            <td>{{ s.stationId }}</td>
            <td>{{ s.stationName }}</td>
            <td>{{ s.stationLatLon }}</td>
            <td :class="s.stationStatus === 1 ? 'num-red' : 'num-green'">
              {{ statusLabel(s.stationStatus) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-hint">暂无中心站</div>

    <div class="sub-title">链路映射（{{ relation.relations?.length || 0 }}）</div>
    <div v-if="relation.relations?.length" class="relation-table-wrap">
      <table class="native-table">
        <thead>
          <tr>
            <th>发起方</th>
            <th>接收方</th>
            <th>可见窗口</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(rel, idx) in relation.relations" :key="idx">
            <td>{{ rel.from }}</td>
            <td>{{ rel.to }}</td>
            <td>
              <span v-if="rel.visibilityWindows?.length">
                <span v-for="(win, wIdx) in rel.visibilityWindows" :key="wIdx" class="inline-tag">
                  {{ win.beginWindow }} ~ {{ win.endWindow }}
                </span>
              </span>
              <span v-else>--</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-hint">暂无链路映射</div>
  </div>
  <div v-else class="empty-hint">暂无拓扑数据</div>
</template>

<script setup lang="ts">
import type { StationRelationList } from '@/api/electronic'
import { stationStatusLabel } from '@/utils/zhchPlanDisplay'

defineProps<{
  /** 站间拓扑关联数据 */
  relation?: StationRelationList | null
}>()

/**
 * 站点状态转中文
 * @param status 状态枚举
 */
const statusLabel = (status?: number) => stationStatusLabel(status)
</script>

<style lang="scss" scoped>
.sub-title {
  font-size: 16px;
  font-weight: 700;
  color: #b5d5ff;
  margin: 14px 0 8px;
}

.relation-table-wrap {
  overflow-x: auto;
  margin-bottom: 12px;
}

.native-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;

  th,
  td {
    padding: 10px 12px;
    border: 1px solid rgba(79, 147, 221, 0.2);
    text-align: left;
    color: #e2e8f0;
  }

  th {
    font-weight: 700;
    color: #7dd3fc;
    background: rgba(14, 28, 48, 0.8);
  }

  tr:nth-child(even) td {
    background: rgba(8, 15, 26, 0.4);
  }
}

.inline-tag {
  display: inline-block;
  margin: 2px 6px 2px 0;
  padding: 2px 8px;
  font-size: 13px;
  color: #7dd3fc;
  border: 1px solid rgba(0, 225, 255, 0.25);
  border-radius: 4px;
  background: rgba(0, 225, 255, 0.06);
}

.num-green {
  color: #4ade80;
  font-weight: 800;
}

.num-red {
  color: #f87171;
  font-weight: 800;
}

.empty-hint {
  font-size: 15px;
  color: #64748b;
  padding: 12px 0;
}
</style>
