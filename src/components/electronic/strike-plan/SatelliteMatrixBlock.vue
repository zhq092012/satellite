<template>
  <div class="satellite-section">
    <div v-if="showSectionTitle" class="section-title">
      卫星打击矩阵
      <span class="count-tag">{{ plan.satelliteMatrixList?.length || 0 }} 颗</span>
    </div>

    <div v-if="!plan.satelliteMatrixList?.length" class="empty-tip">暂无卫星打击数据</div>

    <div v-else class="satellite-grid">
      <div
        v-for="sat in plan.satelliteMatrixList"
        :key="`${panelKey}-${sat.norad}`"
        class="satellite-card"
        :class="{ struck: sat.satelliteStatus === 1 }"
      >
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
            :class="{ expanded: isWindowExpanded(sat.norad) }"
            @click="emit('toggle-windows', panelKey, sat.norad)"
          >
            接收站过境窗口 ({{ sat.stationWindows?.length || 0 }})
            <span class="expand-icon">{{ isWindowExpanded(sat.norad) ? '▲' : '▼' }}</span>
          </button>
          <template v-if="!windowsCollapsible || isWindowExpanded(sat.norad)">
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
                <div class="window-time">过境时间：{{ formatWindowTime(win.peakWindow) }}</div>
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
import type { ZhchPlanResp } from '@/api/electronic'

const props = defineProps<{
  plan: ZhchPlanResp
  panelKey: string
  expandedWindows: Set<string>
  windowsCollapsible?: boolean
  showSectionTitle?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-windows', panelKey: string, norad: number): void
}>()

/**
 * 判断过境窗口是否展开
 * @param norad 卫星 NORAD
 */
const isWindowExpanded = (norad: number) => props.expandedWindows.has(`${props.panelKey}-${norad}`)

/**
 * 格式化过境窗口时间
 * @param timeStr 原始时间
 */
const formatWindowTime = (timeStr?: string): string => {
  if (!timeStr) return '--'
  const normalized = timeStr.replace('T', ' ').replace('Z', '')
  const date = new Date(normalized.includes('-') ? normalized.replace(/-/g, '/') : normalized)
  if (Number.isNaN(date.getTime())) return timeStr
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * 轨道类型转中文
 * @param orbitType 轨道类型枚举
 */
const orbitTypeLabel = (orbitType: number): string => {
  const map: Record<number, string> = { 1: '低轨', 2: '中轨', 3: '高轨' }
  return map[orbitType] || `类型${orbitType}`
}
</script>

<style lang="scss" scoped>
.satellite-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #b5d5ff;
    margin-bottom: 12px;

    .count-tag {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 10px;
      background: rgba(56, 189, 248, 0.15);
      color: #7dd3fc;
    }
  }
}

.empty-tip {
  font-size: 12px;
  color: #64748b;
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
  background: rgba(18, 32, 54, 0.85);
  border: 1px solid rgba(79, 147, 221, 0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;

  &.struck {
    border-color: rgba(239, 68, 68, 0.35);
    background: rgba(36, 18, 24, 0.45);
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
        font-size: 14px;
        font-weight: 700;
        color: #fff;
      }

      .sat-type-tag,
      .usage-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(0, 225, 255, 0.12);
        color: #7dd3fc;
      }

      .usage-tag {
        background: rgba(251, 191, 36, 0.12);
        color: #fbbf24;
      }
    }

    .sat-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      font-size: 11px;
      color: #94a3b8;

      .status-tag {
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;

        &.ok {
          color: #86efac;
          background: rgba(34, 197, 94, 0.15);
        }

        &.struck {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.15);
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
      background: rgba(8, 15, 26, 0.55);

      .metric-label {
        display: block;
        font-size: 10px;
        color: #64748b;
      }

      .metric-val {
        font-size: 12px;
        font-weight: 700;
        color: #e2e8f0;
      }
    }
  }

  .weapon-block,
  .window-block {
    .block-title {
      font-size: 12px;
      font-weight: 600;
      color: #7dd3fc;
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
      background: rgba(0, 225, 255, 0.06);
      border: 1px solid rgba(0, 225, 255, 0.15);
      cursor: pointer;
      text-align: left;

      &:hover {
        background: rgba(0, 225, 255, 0.12);
      }

      &.expanded {
        border-color: rgba(0, 225, 255, 0.35);
      }

      .expand-icon {
        font-size: 10px;
        color: #94a3b8;
      }
    }
  }

  .weapon-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .weapon-chip {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.25);

      em {
        font-style: normal;
        color: #94a3b8;
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
    background: rgba(8, 15, 26, 0.55);
    border: 1px solid rgba(79, 147, 221, 0.15);

    &.struck {
      border-color: rgba(239, 68, 68, 0.3);
    }

    .window-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;

      .receive-name {
        font-size: 12px;
        font-weight: 600;
        color: #e2e8f0;
      }

      .strike-tag {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;

        &.ok {
          color: #86efac;
          background: rgba(34, 197, 94, 0.12);
        }

        &.struck {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.12);
        }
      }
    }

    .window-time {
      margin-top: 4px;
      font-size: 11px;
      color: #94a3b8;
    }

    .window-weapons {
      margin-top: 4px;
      font-size: 11px;
      color: #cbd5e1;

      .weapon-label {
        color: #64748b;
      }

      .mini-weapon {
        margin-right: 6px;
        color: #fca5a5;
      }
    }
  }

  .no-window-tip {
    font-size: 11px;
    color: #64748b;
    margin-top: 6px;
  }
}
</style>
