<template>
  <div class="strike-scheme-panel" :class="{ 'strike-scheme-panel--align': alignBlocks }">
    <section class="scheme-section scheme-section--meta">
      <div class="scheme-section-scroll scheme-section-scroll--meta">
        <dl class="scheme-meta-list">
          <div v-for="item in metaItems" :key="item.label" class="scheme-meta-row">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="scheme-section scheme-section--satellites">
      <h3 class="scheme-section-title">卫星清单</h3>
      <div class="scheme-table-scroll">
        <table class="scheme-table" cellspacing="0" cellpadding="0">
          <thead>
            <tr>
              <th>国家</th>
              <th>卫星名称</th>
              <th>卫星类型</th>
              <th>卫星系列</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in view.satellites" :key="`sat-${idx}-${row.satelliteName}`">
              <td>{{ row.country }}</td>
              <td class="scheme-cell--left">{{ row.satelliteName }}</td>
              <td>{{ row.satelliteType }}</td>
              <td>{{ row.series }}</td>
            </tr>
            <tr v-if="!view.satellites.length">
              <td colspan="4" class="scheme-empty">暂无卫星数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="scheme-section scheme-section--strike">
      <h3 class="scheme-section-title">打击计划</h3>
      <div class="scheme-table-scroll">
        <table class="scheme-table" cellspacing="0" cellpadding="0">
          <thead>
            <tr>
              <th>国家</th>
              <th>卫星名称</th>
              <th>卫星类型</th>
              <!-- <th>卫星系列</th> -->
              <th>武器名称</th>
              <th>武器类型</th>
              <!-- <th>打击窗口</th> -->
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in view.strikePlans" :key="`strike-${idx}-${row.satelliteName}-${row.weaponName}`">
              <td>{{ row.country }}</td>
              <td class="scheme-cell--left">{{ row.satelliteName }}</td>
              <td>{{ row.satelliteType }}</td>
              <!-- <td>{{ row.series }}</td> -->
              <td class="scheme-cell--left">{{ row.weaponName }}</td>
              <td>{{ row.weaponType }}</td>
              <!-- <td>{{ row.attackWindow }}</td> -->
            </tr>
            <tr v-if="!view.strikePlans.length">
              <td colspan="5" class="scheme-empty">暂无打击计划（演示数据待接口 attackPlanList）</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="scheme-section scheme-section--capability scheme-section--capability-recon">
      <ZhchPlanCapabilityCompareTable :plan="view.plan" kind="recon" :vertical="alignBlocks" />
    </section>

    <section class="scheme-section scheme-section--capability scheme-section--capability-comm">
      <ZhchPlanCapabilityCompareTable :plan="view.plan" kind="comm" :vertical="alignBlocks" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrikePlanSchemeView } from '@/utils/buildStrikePlanSchemeView'
import ZhchPlanCapabilityCompareTable from './ZhchPlanCapabilityCompareTable.vue'

const props = defineProps<{
  /** 单方案视图数据 */
  view: StrikePlanSchemeView
  /** 多方案并排时纵向对齐 */
  alignBlocks?: boolean
}>()

/**
 * 计算：按固定顺序从 props.view.meta 组装方案概要字段行。
 * 返回：{ label: string; value: string }[]。
 * 作用：渲染单方案概要信息列表。
 */
const metaItems = computed(() => {
  const m = props.view.meta
  return [
    { label: '方案名称', value: m.planName },
    { label: '作战背景', value: m.combatBackground },
    { label: '命令来源', value: m.commandSource },
    { label: '作战阶段', value: m.combatPhase },
    { label: '作战预期', value: m.combatExpectation },
    { label: '分析结果', value: m.analysisResult },
    { label: '方案描述', value: m.planDescription },
  ]
})
</script>

<style scoped lang="scss">
/** 表格可见行数 */
$scheme-table-visible-rows: 5;
$scheme-table-head-h: 48px;

/** 卫星清单（列少，行高略低） */
$scheme-sat-table-row-h: 52px;
$scheme-sat-table-body-min-h: $scheme-table-head-h + $scheme-sat-table-row-h * $scheme-table-visible-rows;
$scheme-scroll-sat-max: $scheme-sat-table-body-min-h + 32px;

/** 打击计划（列多 + 长文本换行，行高更高） */
$scheme-strike-table-row-h: 64px;
$scheme-strike-table-body-min-h: $scheme-table-head-h + $scheme-strike-table-row-h * $scheme-table-visible-rows;
$scheme-scroll-strike-max: $scheme-strike-table-body-min-h + 40px;

/** 能力表等指标行（与天基/通信区块共用基准行高） */
$scheme-capability-table-row-h: 42px;
$scheme-table-body-min-h: $scheme-table-head-h + $scheme-capability-table-row-h * $scheme-table-visible-rows;

/** 方案概要 7 个字段，预留换行以尽量完整展示 */
$scheme-meta-field-count: 7;
$scheme-meta-row-est-h: 44px;
$scheme-meta-gap: 10px;
$scheme-meta-block-min-h: 24px + $scheme-meta-field-count * $scheme-meta-row-est-h + ($scheme-meta-field-count - 1) * $scheme-meta-gap;

$scheme-section-title-block: 38px;
$scheme-section-pad-v: 24px;

$scheme-scroll-meta-max: max($scheme-meta-block-min-h, 450px);
$scheme-scroll-capability-recon-max: 44px + $scheme-table-head-h + $scheme-capability-table-row-h * $scheme-table-visible-rows;
/** 通信保障 5 项指标 + 换行留白，略高于天基侦察 */
$scheme-capability-comm-extra-h: 128px;
$scheme-scroll-capability-comm-max: $scheme-scroll-capability-recon-max + $scheme-capability-comm-extra-h;

$scheme-align-meta-h: $scheme-scroll-meta-max;
$scheme-align-sat-h: $scheme-section-pad-v + $scheme-section-title-block + $scheme-scroll-sat-max;
$scheme-align-strike-h: $scheme-section-pad-v + $scheme-section-title-block + $scheme-scroll-strike-max;
$scheme-align-capability-recon-h: $scheme-scroll-capability-recon-max + 8px;
$scheme-align-capability-comm-h: $scheme-scroll-capability-comm-max + 8px;

.strike-scheme-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  font-size: 18px;
  text-align: left;
}

.scheme-section {
  border: 1px solid rgba(79, 147, 221, 0.28);
  border-radius: 8px;
  background: rgba(8, 18, 32, 0.75);
  padding: 12px 14px;
  min-width: 0;
  box-sizing: border-box;

  &--satellites,
  &--strike {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  &--capability {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
    overflow: hidden;
  }
}

.scheme-section-title {
  margin: 0 0 10px;
  font-size: 20px;
  font-weight: 700;
  color: #40f2ff;
  text-align: left;
  flex-shrink: 0;
  min-height: 28px;
  line-height: 28px;
}

.scheme-section-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;

  &--meta {
    max-height: $scheme-scroll-meta-max;
    min-height: min($scheme-meta-block-min-h, $scheme-scroll-meta-max);
  }
}

.scheme-table-scroll {
  overflow-y: auto;
  overflow-x: hidden;
}

.scheme-section--satellites .scheme-table-scroll {
  min-height: $scheme-sat-table-body-min-h;
  max-height: $scheme-scroll-sat-max;
}

.scheme-section--strike .scheme-table-scroll {
  min-height: $scheme-strike-table-body-min-h;
  max-height: $scheme-scroll-strike-max;
}

.scheme-meta-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.scheme-meta-row {
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  text-align: left;

  dt {
    margin: 0;
    color: #94a3b8;
    font-weight: 600;
    text-align: left;
  }

  dd {
    margin: 0;
    color: #e2e8f0;
    line-height: 1.5;
    word-break: break-word;
    text-align: left;
  }
}

.scheme-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 18px;

  th,
  td {
    border: 1px solid rgba(56, 189, 248, 0.35);
    padding: 8px 6px;
    text-align: center;
    vertical-align: middle;
    box-sizing: border-box;
  }

  .scheme-section--satellites & {

    th,
    td {
      min-height: $scheme-sat-table-row-h;
    }
  }

  .scheme-section--strike & {

    th,
    td {
      min-height: $scheme-strike-table-row-h;
    }
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
  }

  th {
    background: rgba(13, 27, 49, 0.98);
    color: #f1f5f9;
    font-weight: 600;
  }

  td {
    color: #cbd5e1;
  }
}

.scheme-cell--left {
  text-align: left;
  word-break: break-word;
}

.scheme-empty {
  color: #64748b;
  padding: 16px;
}

.strike-scheme-panel:not(.strike-scheme-panel--align) {
  .scheme-section--capability-recon {
    max-height: $scheme-scroll-capability-recon-max;
    overflow: hidden;

    :deep(.zhch-metrics-table) {
      display: flex;
      flex-direction: column;
      max-height: $scheme-scroll-capability-recon-max;
      min-height: 0;
    }

    :deep(.zhch-metrics-table__scroll) {
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
  }

  .scheme-section--capability-comm {
    max-height: $scheme-scroll-capability-comm-max;
    overflow: hidden;

    :deep(.zhch-metrics-table) {
      display: flex;
      flex-direction: column;
      max-height: $scheme-scroll-capability-comm-max;
      min-height: 0;
    }

    :deep(.zhch-metrics-table__scroll) {
      overflow-y: auto;
      flex: 1;
      min-height: 0;
    }
  }
}

/** 多方案对比：固定行高网格，保证各列区块标题水平对齐 */
.strike-scheme-panel--align {
  display: grid;
  grid-template-rows:
    $scheme-align-meta-h $scheme-align-sat-h $scheme-align-strike-h $scheme-align-capability-recon-h $scheme-align-capability-comm-h;
  gap: 14px;
  height: 100%;
  min-height: 0;

  .scheme-section {
    height: 100%;
    max-height: 100%;
    overflow: hidden;
  }

  .scheme-section--meta {
    padding: 12px 14px;
  }

  .scheme-section-scroll--meta {
    max-height: none;
    height: 100%;
    min-height: $scheme-meta-block-min-h;
  }

  .scheme-section--satellites .scheme-table-scroll {
    max-height: none;
    flex: 1;
    min-height: $scheme-sat-table-body-min-h;
  }

  .scheme-section--strike .scheme-table-scroll {
    max-height: none;
    flex: 1;
    min-height: $scheme-strike-table-body-min-h;
  }

  .scheme-section--capability {
    :deep(.zhch-metrics-table) {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100%;
      border: none;
      border-radius: 0;
      background: transparent;
    }

    :deep(.zhch-metrics-table__head) {
      flex-shrink: 0;
      min-height: 44px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      font-size: 20px;
      font-weight: 700;
      color: #40f2ff;
      background: transparent;
      border-bottom: 1px solid rgba(79, 147, 221, 0.25);
    }

    :deep(.zhch-metrics-table__scroll) {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
    }

    :deep(.zhch-metrics-table--vertical .zhch-metrics-table__head) {
      font-size: 20px;
      padding: 10px 14px;
    }

    :deep(.zhch-metrics-table--vertical .zhch-metrics-table__grid--vertical) {
      font-size: 16px;
    }
  }
}
</style>
