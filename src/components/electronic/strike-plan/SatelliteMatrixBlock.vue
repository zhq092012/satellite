<template>
  <div class="satellite-section">
    <div v-if="showSectionTitle" class="section-title">
      卫星打击矩阵
      <span class="count-tag">{{ satelliteList.length }} 颗</span>
    </div>

    <div v-if="!satelliteList.length" class="empty-tip">暂无卫星打击数据</div>

    <div v-else class="satellite-grid">
      <div v-for="sat in satelliteList" :key="`${panelKey}-${sat.norad}`" class="satellite-card"
        :class="{ struck: sat.satelliteStatus === 1 }">
        <div class="sat-header">
          <div class="sat-title">
            <span class="sat-name">{{ sat.name }}</span>
            <span class="sat-type-tag">{{ sat.satType }}</span>
            <span class="usage-tag">{{ sat.usage }}</span>
          </div>
          <div class="sat-meta">
            <span>NORAD {{ sat.norad }}</span>
            <span class="status-tag" :class="sat.satelliteStatus === 1 ? 'struck' : 'ok'">
              {{ sat.satelliteStatus === 1 ? '已打击' : '正常' }}
            </span>
          </div>
        </div>

        <div class="sat-metrics">
          <div class="metric-item">
            <span class="metric-label">链路延迟</span>
            <span class="metric-val">{{ sat.delayMin }} 分钟</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">轨道类型</span>
            <span class="metric-val">{{ orbitTypeLabel(sat.orbitType) }}</span>
          </div>
        </div>

        <div class="weapon-block" v-if="sat.weapons?.length">
          <div class="block-title">针对卫星的武器</div>
          <div class="weapon-list">
            <span v-for="weapon in sat.weapons" :key="weapon.id || weapon.name" class="weapon-chip">
              {{ weapon.name }}
              <em v-if="weapon.type">({{ weapon.type }})</em>
            </span>
          </div>
        </div>

        <div class="window-block">
          <button type="button" class="block-title block-title--clickable"
            :class="{ expanded: isWindowExpanded(sat.norad) }" @click="emit('toggle-windows', panelKey, sat.norad)">
            接收站过境窗口 ({{ sat.stationWindows?.length || 0 }})
            <span class="expand-icon">{{ isWindowExpanded(sat.norad) ? '▲' : '▼' }}</span>
          </button>
          <template v-if="!windowsCollapsible || isWindowExpanded(sat.norad)">
            <div v-if="sat.stationWindows?.length" class="window-list">
              <div v-for="win in sat.stationWindows" :key="win.receiveId + win.peakWindow" class="window-item"
                :class="{ struck: win.strikeStatus === 1 }">
                <div class="window-top">
                  <span class="receive-name">📡 {{ win.receiveName }}</span>
                  <span class="strike-tag" :class="win.strikeStatus === 1 ? 'struck' : 'ok'">
                    {{ win.strikeStatus === 1 ? '已打击' : '未打击' }}
                  </span>
                </div>
                <div class="window-time">过境时间：{{ formatPassWindowTime(win.peakWindow) }}</div>
                <div class="window-weapons" v-if="win.weapons?.length">
                  <span class="weapon-label">武器：</span>
                  <span v-for="weapon in win.weapons" :key="weapon.id || weapon.name" class="mini-weapon">
                    {{ weapon.name }}
                  </span>
                </div>
              </div>
            </div>
            <div v-else class="no-window-tip">暂无接收站窗口数据</div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanResp, ZhchPlanSatelliteMatrix } from '@/api/electronic'
import { formatPassWindowTime } from '@/utils/tools/dateFormat'
import { orbitTypeLabel } from '@/utils/strikePlanDisplayText'

const props = defineProps<{
  /** 综合打击方案数据 */
  plan: ZhchPlanResp
  /** 面板标识，用于展开状态 key */
  panelKey: string
  /** 已展开的窗口 key 集合 */
  expandedWindows: Set<string>
  /** 是否可折叠过境窗口 */
  windowsCollapsible?: boolean
  /** 是否显示区块标题 */
  showSectionTitle?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-windows', panelKey: string, norad: number): void
}>()

/**
 * 从各系列实体合并卫星矩阵列表（按 NORAD 去重）
 */
const satelliteList = computed((): ZhchPlanSatelliteMatrix[] => {
  const list: ZhchPlanSatelliteMatrix[] = []
  const seen = new Set<number>()

  for (const entity of props.plan.levelSeriesEntities || []) {
    for (const sat of entity.satelliteMatrixList || []) {
      if (!seen.has(sat.norad)) {
        seen.add(sat.norad)
        list.push(sat)
      }
    }
  }

  return list
})

/**
 * 判断过境窗口是否展开
 * @param norad 卫星 NORAD
 */
const isWindowExpanded = (norad: number) => props.expandedWindows.has(`${props.panelKey}-${norad}`)
</script>

<style lang="scss" scoped>
.satellite-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--swatch-b5d5ff);
    margin-bottom: 12px;

    .count-tag {
      font-size: var(--font-size-xs);
      padding: 1px 8px;
      border-radius: 10px;
      background: var(--swatch-rgba-56-189-248-0_15);
      color: var(--color-info-soft);
    }
  }
}

.empty-tip {
  font-size: var(--font-size-sm);
  color: var(--text-color-subtle);
  text-align: center;
  padding: 16px;
}

.satellite-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
}

.satellite-card {
  padding: 12px;
  border-radius: 8px;
  background: var(--swatch-rgba-18-32-54-0_85);
  border: 1px solid var(--accent-bg);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &.struck {
    border-color: var(--color-danger-glow);
    background: var(--swatch-rgba-36-18-24-0_45);
  }

  .sat-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;

    .sat-title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;

      .sat-name {
        font-size: var(--font-size-base);
        font-weight: var(--font-weight-bold);
        color: var(--color-white);
      }

      .sat-type-tag,
      .usage-tag {
        font-size: var(--font-size-caption);
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(var(--accent-cyan-rgb), 0.12);
        color: var(--color-info-soft);
      }

      .usage-tag {
        background: var(--swatch-rgba-251-191-36-0_12);
        color: var(--color-warning);
      }
    }

    .sat-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      font-size: var(--font-size-xs);
      color: var(--text-color-muted);

      .status-tag {
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: var(--font-weight-bold);

        &.ok {
          color: var(--color-success-soft);
          background: var(--swatch-rgba-34-197-94-0_15);
        }

        &.struck {
          color: var(--color-danger-soft);
          background: var(--swatch-rgba-239-68-68-0_15);
        }
      }
    }
  }

  .sat-metrics {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;

    .metric-item {
      padding: 6px 8px;
      border-radius: 4px;
      background: var(--swatch-rgba-8-15-26-0_55);

      .metric-label {
        display: block;
        font-size: var(--font-size-caption);
        color: var(--text-color-subtle);
      }

      .metric-val {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-bold);
        color: var(--text-color-soft);
      }
    }
  }

  .weapon-block,
  .window-block {
    .block-title {
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-semibold);
      color: var(--color-info-soft);
      margin-bottom: 6px;
    }

    .block-title--clickable {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 6px 8px;
      margin-bottom: 0;
      border-radius: 4px;
      background: rgba(var(--accent-cyan-rgb), 0.06);
      border: 1px solid rgba(var(--accent-cyan-rgb), 0.15);
      cursor: pointer;
      text-align: left;

      &:hover {
        background: rgba(var(--accent-cyan-rgb), 0.12);
      }

      &.expanded {
        border-color: rgba(var(--accent-cyan-rgb), 0.35);
      }

      .expand-icon {
        font-size: var(--font-size-caption);
        color: var(--text-color-muted);
      }
    }
  }

  .weapon-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .weapon-chip {
      font-size: var(--font-size-xs);
      padding: 2px 8px;
      border-radius: 4px;
      color: var(--color-danger-soft);
      background: var(--color-danger-bg);
      border: 1px solid var(--swatch-rgba-239-68-68-0_25);

      em {
        font-style: normal;
        color: var(--text-color-muted);
      }
    }
  }

  .window-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 220px;
    overflow-y: auto;
    margin-top: 6px;
  }

  .window-item {
    padding: 8px;
    border-radius: 6px;
    background: var(--swatch-rgba-8-15-26-0_55);
    border: 1px solid var(--swatch-rgba-79-147-221-0_15);

    &.struck {
      border-color: var(--swatch-rgba-239-68-68-0_3);
    }

    .window-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;

      .receive-name {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-color-soft);
      }

      .strike-tag {
        font-size: var(--font-size-caption);
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: var(--font-weight-bold);

        &.ok {
          color: var(--color-success-soft);
          background: var(--swatch-rgba-34-197-94-0_12);
        }

        &.struck {
          color: var(--color-danger-soft);
          background: var(--color-danger-bg);
        }
      }
    }

    .window-time {
      margin-top: 4px;
      font-size: var(--font-size-xs);
      color: var(--text-color-muted);
    }

    .window-weapons {
      margin-top: 4px;
      font-size: var(--font-size-xs);
      color: var(--text-color-soft);

      .weapon-label {
        color: var(--text-color-subtle);
      }

      .mini-weapon {
        margin-right: 6px;
        color: var(--color-danger-soft);
      }
    }
  }

  .no-window-tip {
    font-size: var(--font-size-xs);
    color: var(--text-color-subtle);
    margin-top: 6px;
  }
}
</style>
