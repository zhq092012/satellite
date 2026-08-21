<template>
  <div class="summary-card" :class="{ compact }">
    <div class="summary-title">方案概述</div>
    <p class="summary-text">{{ plan.summary || '暂无概述' }}</p>
    <div class="weapon-types" v-if="plan.weaponTypes?.length">
      <span class="weapon-types-label">投入武器类型：</span>
      <span class="weapon-type-chip">{{ plan.weaponTypes.join('、') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ZhchPlanResp } from '@/api/electronic'

defineProps<{
  /** 方案数据 */
  plan: ZhchPlanResp
  /** 紧凑布局 */
  compact?: boolean
}>()
</script>

<style lang="scss" scoped>
.summary-card {
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 8px;
  background: rgba(14, 28, 48, 0.75);
  border: 1px solid rgba(79, 147, 221, 0.25);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;

  &.compact {
    padding: 10px 12px;
  }

  .summary-title {
    font-size: 14px;
    font-weight: 700;
    color: #7dd3fc;
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .summary-text {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #cbd5e1;
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .weapon-types {
    margin-top: 8px;
    font-size: 12px;
    color: #94a3b8;
    word-break: break-word;
    overflow-wrap: break-word;

    .weapon-type-chip {
      color: #fca5a5;
      font-weight: 600;
    }
  }
}
</style>
