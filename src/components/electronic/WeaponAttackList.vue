<template>
  <div class="weapon-attack-dashboard dark-theme">
    <!-- 顶部概览 Header -->
    <div class="attack-header">
      <div class="header-left">
        <span class="header-icon">🎯</span>
        <span class="header-title glow-text">武器打击时间窗口与计划矩阵</span>
      </div>

      <!-- 统计指标与搜索 -->
      <div class="header-center">
        <div class="stat-badge-item">
          <span class="label">打击计划总数:</span>
          <span class="value glow-text-cyan">{{ attackPlans.length }} 项</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">攻击武器种类:</span>
          <span class="value glow-text-yellow">{{ weaponTypeCount }} 种</span>
        </div>
        <div class="stat-badge-item">
          <span class="label">受打击目标数:</span>
          <span class="value glow-text-red">{{ targetCount }} 个</span>
        </div>
      </div>

      <div class="header-right">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索武器名称/类型/打击目标..."
          prefix-icon="Search"
          clearable
          size="small"
          class="search-input"
        />
      </div>
    </div>

    <!-- 主体区域：打击计划卡片/表格展示 -->
    <div class="attack-body">
      <div v-if="filteredPlans.length === 0" class="empty-container">
        <div class="empty-icon">🛡️</div>
        <div class="empty-text">当前暂无匹配的武器打击计划与时间窗口数据</div>
      </div>

      <div v-else class="plans-grid">
        <div
          v-for="(plan, index) in filteredPlans"
          :key="plan.weaponName + plan.target + index"
          class="plan-card"
          :class="getCardClass(plan.weaponType)"
        >
          <!-- 卡片头部：武器信息与打击目标 -->
          <div class="card-header">
            <div class="weapon-info">
              <span class="type-badge" :class="getBadgeClass(plan.weaponType)">
                {{ plan.weaponType || '通用打击' }}
              </span>
              <span class="weapon-name">{{ plan.weaponName }}</span>
            </div>

            <div class="target-info">
              <span class="target-label">打击目标:</span>
              <span class="target-name glow-text-red">🎯 {{ plan.target }}</span>
              <span class="target-type-tag" v-if="plan.targetType">[{{ plan.targetType }}]</span>
            </div>
          </div>

          <!-- 卡片元数据：整体时间与方位角度 -->
          <div class="card-meta">
            <div class="meta-item">
              <span class="meta-label">📅 打击窗口全程:</span>
              <span class="meta-value time-font">{{ plan.beginTime }} ~ {{ plan.endTime }}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">📐 攻击角度:</span>
              <span class="meta-value angle-tag">{{ plan.angle }}°</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">⏱️ 总持续时长:</span>
              <span class="meta-value duration-tag">{{ formatDuration(plan.beginTime, plan.endTime) }}</span>
            </div>
          </div>

          <!-- 详细打击窗口列表 (Windows) -->
          <div class="windows-section">
            <div class="section-title">
              <span>🕒 详细打击时间窗口列表 (共 {{ plan.windows?.length || 0 }} 个窗口)</span>
            </div>

            <div class="windows-list" v-if="plan.windows && plan.windows.length > 0">
              <div v-for="(win, wIdx) in plan.windows" :key="wIdx" class="window-item">
                <div class="win-index">窗口 #{{ wIdx + 1 }}</div>
                <div class="win-time-span">
                  <span class="time-start">{{ win.beginWindow }}</span>
                  <span class="time-arrow">➔</span>
                  <span class="time-end">{{ win.endWindow }}</span>
                </div>
                <div class="win-span-length">时长: {{ formatDuration(win.beginWindow, win.endWindow) }}</div>
              </div>
            </div>
            <div v-else class="no-windows-tip">暂无独立子时间窗口数据</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import type { MatrixResult, WeaponAttackRecord } from '@/api/electronic'

/**
 * [组件属性定义]
 * 接收来自父组件 ElectronicWarfareG6 的 matrixData 矩阵数据结构
 */
interface Props {
  matrixData?: MatrixResult | null
}

const props = withDefaults(defineProps<Props>(), {
  matrixData: null,
})

// [变量用途]
// 用户在顶部输入的搜索关键字
const searchKeyword = ref('')

// [数据来源]
// 提取打击计划列表数据
const attackPlans = computed<WeaponAttackRecord[]>(() => {
  return props.matrixData?.attackPlanList || []
})

// [数据来源]
// 统计不同攻击武器种类数量
const weaponTypeCount = computed(() => {
  const types = new Set(attackPlans.value.map((p) => p.weaponType).filter(Boolean))
  return types.size
})

// [数据来源]
// 统计涉及打击的目标数量
const targetCount = computed(() => {
  const targets = new Set(attackPlans.value.map((p) => p.target).filter(Boolean))
  return targets.size
})

// [数据来源]
// 结合关键字检索过滤打击计划列表
const filteredPlans = computed<WeaponAttackRecord[]>(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return attackPlans.value

  return attackPlans.value.filter((plan) => {
    const nameMatch = (plan.weaponName || '').toLowerCase().includes(kw)
    const typeMatch = (plan.weaponType || '').toLowerCase().includes(kw)
    const targetMatch = (plan.target || '').toLowerCase().includes(kw)
    const targetTypeMatch = (plan.targetType || '').toLowerCase().includes(kw)
    return nameMatch || typeMatch || targetMatch || targetTypeMatch
  })
})

/**
 * [功能说明]
 * 根据武器类型返回对应卡片的修饰 Class
 *
 * @param type 武器类型字符串
 */
const getCardClass = (type: string) => {
  if (!type) return ''
  if (type.includes('网络') || type.includes('病毒')) return 'card-cyber'
  if (type.includes('干扰') || type.includes('电磁')) return 'card-jamming'
  if (type.includes('导弹') || type.includes('动能') || type.includes('物理')) return 'card-kinetic'
  return ''
}

/**
 * [功能说明]
 * 根据武器类型返回对应 Badge 的修饰 Class
 *
 * @param type 武器类型字符串
 */
const getBadgeClass = (type: string) => {
  if (!type) return 'badge-default'
  if (type.includes('网络') || type.includes('病毒')) return 'badge-purple'
  if (type.includes('干扰') || type.includes('电磁')) return 'badge-yellow'
  if (type.includes('导弹') || type.includes('动能') || type.includes('物理')) return 'badge-red'
  return 'badge-cyan'
}

/**
 * [功能说明]
 * 计算两个时间字符串之间的持续时长描述（如：30分钟、1小时15分钟）
 *
 * @param startStr 开始时间字符串
 * @param endStr 结束时间字符串
 */
const formatDuration = (startStr: string, endStr: string): string => {
  if (!startStr || !endStr) return '未知'
  const t1 = new Date(startStr.replace(/-/g, '/')).getTime()
  const t2 = new Date(endStr.replace(/-/g, '/')).getTime()

  if (isNaN(t1) || isNaN(t2) || t2 <= t1) return '即时/未知'

  const diffSec = Math.floor((t2 - t1) / 1000)
  const hours = Math.floor(diffSec / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)
  const secs = diffSec % 60

  if (hours > 0) {
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}分${secs}秒` : `${mins}分钟`
  }
  return `${secs}秒`
}
</script>

<style lang="scss" scoped>
.weapon-attack-dashboard {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #060913;
  color: #e2e8f0;
  overflow: hidden;
}

.attack-header {
  height: 52px;
  background: rgba(10, 18, 34, 0.9);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0, 225, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 10;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .header-icon {
      font-size: 20px;
    }
    .header-title {
      font-size: 16px;
      font-weight: 700;
      color: #00e1ff;
      letter-spacing: 0.5px;
    }
  }

  .header-center {
    display: flex;
    align-items: center;
    gap: 20px;

    .stat-badge-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      background: rgba(8, 14, 26, 0.6);
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid rgba(0, 225, 255, 0.15);

      .label {
        color: #94a3b8;
      }
      .value {
        font-weight: 700;
      }
    }
  }

  .search-input {
    width: 240px;

    :deep(.el-input__wrapper) {
      background-color: rgba(8, 14, 26, 0.8);
      box-shadow: 0 0 0 1px rgba(0, 225, 255, 0.25) inset;
      color: #e2e8f0;

      &.is-focus {
        box-shadow: 0 0 0 1px #00e1ff inset;
      }
    }

    :deep(.el-input__inner) {
      color: #e2e8f0;
      font-size: 12px;
    }
  }
}

.attack-body {
  flex: 1;
  width: 100%;
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 225, 255, 0.3);
    border-radius: 3px;
  }
}

.empty-container {
  height: 100%;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(10, 18, 34, 0.4);
  border: 1px dashed rgba(0, 225, 255, 0.2);
  border-radius: 8px;
  color: #64748b;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }
  .empty-text {
    font-size: 14px;
  }
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(460px, 1fr));
  gap: 20px;
}

.plan-card {
  background: rgba(13, 22, 42, 0.85);
  border: 1px solid rgba(0, 225, 255, 0.2);
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transition: all 0.25s ease;

  &:hover {
    border-color: rgba(0, 225, 255, 0.5);
    box-shadow: 0 6px 20px rgba(0, 225, 255, 0.15);
    transform: translateY(-2px);
  }

  &.card-cyber {
    border-left: 4px solid #a855f7;
  }
  &.card-jamming {
    border-left: 4px solid #eab308;
  }
  &.card-kinetic {
    border-left: 4px solid #ef4444;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);

  .weapon-info {
    display: flex;
    align-items: center;
    gap: 8px;

    .weapon-name {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
    }
  }

  .target-info {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;

    .target-label {
      color: #94a3b8;
    }
    .target-name {
      font-weight: 700;
    }
    .target-type-tag {
      color: #64748b;
      font-size: 11px;
    }
  }
}

.type-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;

  &.badge-purple {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }
  &.badge-yellow {
    background: rgba(234, 179, 8, 0.2);
    color: #fde047;
    border: 1px solid rgba(234, 179, 8, 0.4);
  }
  &.badge-red {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }
  &.badge-cyan {
    background: rgba(0, 225, 255, 0.2);
    color: #38bdf8;
    border: 1px solid rgba(0, 225, 255, 0.4);
  }
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  background: rgba(8, 14, 26, 0.6);
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;

  .meta-item {
    display: flex;
    align-items: center;
    gap: 6px;

    .meta-label {
      color: #94a3b8;
    }

    .time-font {
      font-family: monospace;
      color: #38bdf8;
      font-weight: 600;
    }

    .angle-tag {
      color: #fbbf24;
      font-weight: 700;
    }

    .duration-tag {
      color: #34d399;
      font-weight: 600;
    }
  }
}

.windows-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #94a3b8;
  }

  .windows-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .window-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(18, 30, 56, 0.6);
    border: 1px solid rgba(0, 225, 255, 0.12);
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;

    .win-index {
      color: #00e1ff;
      font-weight: 600;
      font-size: 11px;
    }

    .win-time-span {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: monospace;

      .time-start,
      .time-end {
        color: #e2e8f0;
      }
      .time-arrow {
        color: #64748b;
      }
    }

    .win-span-length {
      color: #a7f3d0;
      font-size: 11px;
    }
  }

  .no-windows-tip {
    font-size: 12px;
    color: #64748b;
    font-style: italic;
    padding: 4px 0;
  }
}

.glow-text-cyan {
  color: #00e1ff;
  text-shadow: 0 0 6px rgba(0, 225, 255, 0.4);
}
.glow-text-yellow {
  color: #fde047;
  text-shadow: 0 0 6px rgba(253, 224, 71, 0.4);
}
.glow-text-red {
  color: #f87171;
  text-shadow: 0 0 6px rgba(248, 113, 113, 0.4);
}
</style>
