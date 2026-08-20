<template>
  <div class="strike-plan-generator dark-theme" v-loading="loading">
    <!-- 顶部：用途类型选择与方案概览 -->
    <div class="plan-header">
      <div class="header-left">
        <span class="header-icon">⚔️</span>
        <span class="header-title glow-text">综合打击方案生成</span>
      </div>

      <div class="header-center">
        <span class="type-label">卫星用途类型</span>
        <div class="type-selector">
          <button
            v-for="item in usageTypeOptions"
            :key="item.value"
            class="type-btn"
            :class="{ active: selectedUsageType === item.value }"
            @click="handleUsageTypeChange(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <el-button type="primary" size="small" :loading="loading" @click="fetchStrikePlan">
          生成方案
        </el-button>
      </div>

      <div class="header-right" v-if="planData">
        <div class="stat-badge-item">
          <span class="label">卫星</span>
          <span class="value glow-text-cyan">{{ planData.satNum }} 颗</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">接收站</span>
          <span class="value glow-text-yellow">{{ planData.receiveNum }} 个</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">武器</span>
          <span class="value glow-text-red">{{ planData.weaponNum }} 套</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">平均延迟</span>
          <span class="value">{{ planData.avgDelayMin }} 分钟</span>
        </div>
      </div>
    </div>

    <!-- 主体内容 -->
    <div class="plan-body">
      <div v-if="!store.activedTask" class="empty-container">
        <div class="empty-icon">📋</div>
        <div class="empty-text">请先在右上角选择战场与任务</div>
      </div>

      <div v-else-if="!planData && !loading" class="empty-container">
        <div class="empty-icon">🎯</div>
        <div class="empty-text">选择用途类型后点击「生成方案」获取综合打击方案</div>
      </div>

      <template v-else-if="planData">
        <!-- 方案概述 -->
        <div class="summary-card">
          <div class="summary-title">方案概述</div>
          <p class="summary-text">{{ planData.summary || '暂无概述' }}</p>
          <div class="weapon-types" v-if="planData.weaponTypes?.length">
            <span class="weapon-types-label">投入武器类型：</span>
            <span v-for="(weaponType, idx) in planData.weaponTypes" :key="weaponType" class="weapon-type-chip">
              {{ weaponType }}<span v-if="idx < planData.weaponTypes.length - 1">、</span>
            </span>
          </div>
        </div>

        <!-- 卫星打击矩阵 -->
        <div class="satellite-section">
          <div class="section-title">
            卫星打击矩阵
            <span class="count-tag">{{ planData.satelliteMatrixList?.length || 0 }} 颗</span>
          </div>

          <div v-if="!planData.satelliteMatrixList?.length" class="empty-container small">
            <div class="empty-text">当前类型下暂无卫星打击数据</div>
          </div>

          <div v-else class="satellite-grid">
            <div
              v-for="sat in planData.satelliteMatrixList"
              :key="sat.norad"
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
                <div class="block-title">接收站过境窗口 ({{ sat.stationWindows?.length || 0 }})</div>
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
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getSatelliteThreatInfoByType, type ZhchPlanResp } from '@/api/electronic'
import { useLayoutStore } from '@/store/modules/layout'

defineOptions({ name: 'StrikePlanGenerator' })

/** 卫星用途类型选项 */
interface UsageTypeOption {
  /** 展示名称 */
  label: string
  /** 传给接口的 type 参数 */
  value: string
}

/** 可选用途类型：军用 / 民用 / 军民混用 */
const usageTypeOptions: UsageTypeOption[] = [
  { label: '军用', value: '军用' },
  { label: '民用', value: '民用' },
  { label: '军民混用', value: '军民混用' },
]

const store = useLayoutStore()

/** 当前选中的用途类型 */
const selectedUsageType = ref<string>('军用')
/** 接口加载状态 */
const loading = ref(false)
/** 综合打击方案响应数据 */
const planData = ref<ZhchPlanResp | null>(null)

/**
 * 拉取综合打击方案
 *
 * @returns Promise<void>
 */
const fetchStrikePlan = async () => {
  const taskId = store.activedTask?.id
  if (!taskId) {
    ElMessage.warning('请先选择战场与任务')
    return
  }

  loading.value = true
  try {
    const res = await getSatelliteThreatInfoByType({
      type: selectedUsageType.value,
      taskId,
    })
    if (res.code === 200 && res.data) {
      planData.value = res.data
    } else {
      planData.value = null
      ElMessage.warning(res.message || '获取打击方案失败')
    }
  } catch (error) {
    planData.value = null
    console.error('获取综合打击方案失败:', error)
    ElMessage.error('获取打击方案失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

/**
 * 切换用途类型并自动重新生成方案
 *
 * @param type 用途类型参数
 */
const handleUsageTypeChange = (type: string) => {
  if (selectedUsageType.value === type) return
  selectedUsageType.value = type
  if (store.activedTask?.id) {
    void fetchStrikePlan()
  }
}

/**
 * 格式化过境窗口时间展示
 *
 * @param timeStr 原始时间字符串
 * @returns 格式化后的时间文本
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
 * 轨道类型枚举转中文标签
 *
 * @param orbitType 轨道类型枚举值
 * @returns 中文轨道类型
 */
const orbitTypeLabel = (orbitType: number): string => {
  const map: Record<number, string> = {
    1: '低轨',
    2: '中轨',
    3: '高轨',
  }
  return map[orbitType] || `类型${orbitType}`
}

/** 任务切换后清空旧方案，若已选类型则自动重新拉取 */
watch(
  () => store.activedTask?.id,
  (taskId) => {
    planData.value = null
    if (taskId) {
      void fetchStrikePlan()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.strike-plan-generator {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(79, 147, 221, 0.25);
  background: linear-gradient(180deg, rgba(12, 28, 48, 0.95) 0%, rgba(8, 20, 36, 0.98) 100%);
  flex-shrink: 0;
  flex-wrap: wrap;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;

    .header-icon {
      font-size: 20px;
    }

    .header-title {
      font-size: 16px;
      font-weight: 700;
    }
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    .type-label {
      font-size: 13px;
      color: #94a3b8;
    }

    .type-selector {
      display: flex;
      gap: 6px;

      .type-btn {
        padding: 5px 14px;
        font-size: 13px;
        color: #8eb3d6;
        background: rgba(16, 36, 62, 0.7);
        border: 1px solid rgba(79, 147, 221, 0.3);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover {
          color: #fff;
          border-color: rgba(0, 225, 255, 0.5);
        }

        &.active {
          color: #fff;
          font-weight: 600;
          background: linear-gradient(135deg, rgba(79, 147, 221, 0.85) 0%, rgba(0, 180, 216, 0.9) 100%);
          border-color: #00e1ff;
          box-shadow: 0 0 10px rgba(0, 225, 255, 0.35);
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .stat-badge-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;

    .label {
      color: #94a3b8;
    }

    .value {
      font-weight: 700;
      color: #e2e8f0;
    }
  }
}

.glow-text {
  color: #eaf3ff;
  text-shadow: 0 0 8px rgba(64, 242, 255, 0.35);
}

.glow-text-cyan {
  color: #38bdf8;
}

.glow-text-yellow {
  color: #fbbf24;
}

.glow-text-red {
  color: #f87171;
}

.plan-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-card {
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(14, 28, 48, 0.75);
  border: 1px solid rgba(79, 147, 221, 0.25);

  .summary-title {
    font-size: 14px;
    font-weight: 700;
    color: #7dd3fc;
    margin-bottom: 8px;
  }

  .summary-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #cbd5e1;
  }

  .weapon-types {
    margin-top: 10px;
    font-size: 12px;
    color: #94a3b8;

    .weapon-type-chip {
      color: #fca5a5;
      font-weight: 600;
    }
  }
}

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

.satellite-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
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
  }
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  gap: 10px;
  color: #94a3b8;

  &.small {
    min-height: 120px;
  }

  .empty-icon {
    font-size: 36px;
  }

  .empty-text {
    font-size: 14px;
  }
}
</style>
