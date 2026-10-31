<template>
  <div class="satellite-card" :class="[variant, { struck: sat.satelliteStatus === 1 }]">
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
      <button
        type="button"
        class="block-title block-title--clickable"
        :class="{ expanded: isWindowExpanded }"
        @click="handleToggleWindows"
      >
        接收站过境窗口 ({{ sat.stationWindows?.length || 0 }})
        <span class="expand-icon">{{ isWindowExpanded ? '▲' : '▼' }}</span>
      </button>
      <template v-if="!windowsCollapsible || isWindowExpanded">
        <div v-if="sat.stationWindows?.length" class="window-list">
          <div
            v-for="win in sat.stationWindows"
            :key="win.receiveId + win.peakWindow"
            class="window-item"
            :class="{ struck: win.strikeStatus === 1 }"
          >
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanSatelliteMatrix } from '@/api/electronic'
import { formatPassWindowTime } from '@/utils/tools/dateFormat'
import { orbitTypeLabel } from '@/utils/strikePlanDisplayText'

const props = defineProps<{
  /** 单颗卫星矩阵数据 */
  sat: ZhchPlanSatelliteMatrix
  /** 面板标识，用于展开状态 key */
  panelKey: string
  /** 对比侧样式：基准 / 方案 */
  variant?: 'baseline' | 'actual'
  /** 是否可折叠过境窗口 */
  windowsCollapsible?: boolean
  /** 已展开的窗口 key 集合（panelKey-norad） */
  expandedWindowKeys: Set<string>
}>()

const emit = defineEmits<{
  (e: 'toggle-windows', panelKey: string, norad: number): void
}>()

/** 当前卡片过境窗口是否展开 */
const isWindowExpanded = computed(
  () => !props.windowsCollapsible || props.expandedWindowKeys.has(`${props.panelKey}-${props.sat.norad}`)
)

/**
 * 切换过境窗口展开
 */
const handleToggleWindows = () => {
  if (props.windowsCollapsible) {
    emit('toggle-windows', props.panelKey, props.sat.norad)
  }
}
</script>

<style lang="scss" scoped>
.satellite-card {
  box-sizing: border-box;
  padding: 12px;
  border-radius: 8px;
  background: var(--swatch-rgba-18-32-54-0_85);
  border: 1px solid var(--swatch-rgba-79-147-221-0_35);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  width: 100%;
  overflow: hidden;

  &.baseline {
    border-color: var(--swatch-rgba-34-197-94-0_35);
  }

  &.actual {
    border-color: var(--color-danger-glow);
  }

  &.struck {
    border-color: var(--swatch-rgba-239-68-68-0_5);
    background: var(--swatch-rgba-36-18-24-0_45);
  }

  .sat-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;

    .sat-title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      min-width: 0;
      flex: 1;

      .sat-name {
        font-size: var(--font-size-md);
        font-weight: var(--font-weight-bold);
        color: var(--color-white);
        word-break: break-word;
        overflow-wrap: break-word;
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
      flex-shrink: 0;

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
        word-break: break-word;
        overflow-wrap: break-word;
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
      background: var(--swatch-rgba-8-15-26-0_45);
      border: 1px solid var(--accent-bg);
      cursor: pointer;
      text-align: left;
      user-select: none;

      &:hover {
        border-color: rgba(var(--accent-cyan-rgb), 0.4);
      }

      &.expanded {
        border-color: rgba(var(--accent-cyan-rgb), 0.45);
        margin-bottom: 6px;
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
      word-break: break-word;
      overflow-wrap: break-word;
      max-width: 100%;

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
      align-items: flex-start;
      gap: 8px;
      min-width: 0;

      .receive-name {
        font-size: var(--font-size-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--text-color-soft);
        word-break: break-word;
        overflow-wrap: break-word;
        min-width: 0;
      }

      .strike-tag {
        font-size: var(--font-size-caption);
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: var(--font-weight-bold);
        flex-shrink: 0;

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
    padding: 4px 0;
  }
}
</style>
