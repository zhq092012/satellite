<template>
  <div class="summary-card" :class="{ compact }">
    <div class="summary-title">方案概述</div>
    <p class="summary-text">{{ plan.summary || '暂无概述' }}</p>
    <div class="weapon-types" v-if="weaponTypes.length">
      <span class="weapon-types-label">投入武器类型：</span>
      <span class="weapon-type-chip">{{ weaponTypes.join('、') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ZhchPlanResp } from '@/api/electronic'

const props = defineProps<{
  /** 综合打击方案数据 */
  plan: ZhchPlanResp
  /** 紧凑布局 */
  compact?: boolean
}>()

/**
 * 从各系列攻击计划中汇总去重后的武器类型列表
 */
const weaponTypes = computed(() => {
  const types = new Set<string>()

  for (const entity of props.plan.levelSeriesEntities || []) {
    for (const attack of entity.attackPlanList || []) {
      if (attack.weaponType) {
        types.add(attack.weaponType)
      }
    }
  }

  return Array.from(types)
})
</script>

<style lang="scss" scoped>
.summary-card {
  box-sizing: border-box;
  padding: 14px 16px;
  border-radius: 8px;
  background: var(--swatch-rgba-14-28-48-0_75);
  border: 1px solid var(--accent-border-strong);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;

  &.compact {
    padding: 10px 12px;
  }

  .summary-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
    color: var(--color-info-soft);
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .summary-text {
    margin: 0;
    font-size: var(--font-size-md);
    line-height: 1.6;
    color: var(--text-color-soft);
    word-break: break-word;
    overflow-wrap: break-word;
  }

  .weapon-types {
    margin-top: 8px;
    font-size: var(--font-size-sm);
    color: var(--text-color-muted);
    word-break: break-word;
    overflow-wrap: break-word;

    .weapon-type-chip {
      color: var(--color-danger-soft);
      font-weight: var(--font-weight-semibold);
    }
  }
}
</style>
