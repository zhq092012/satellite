<template>
  <header v-if="headlineItems.length" class="report-headline">
    <dl class="report-headline__list">
      <div v-for="item in headlineItems" :key="item.label" class="report-kv-row">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReportGenerateResp } from '@/types/report/report'

const props = defineProps<{
  /** 当前任务的完整报告响应 */
  report: ReportGenerateResp | null
}>()

interface HeadlineItem {
  label: string
  value: string
}

/**
 * 计算：报告级综合信息（战役、任务、生成时间）。
 * 返回 HeadlineItem[]。
 * 作用：勾选区下方的报告元信息。
 */
const headlineItems = computed((): HeadlineItem[] => {
  const report = props.report
  if (!report) return []
  const items: HeadlineItem[] = []
  const campaign = report.campaign?.trim()
  if (campaign) items.push({ label: '战役', value: campaign })
  const taskName = report.taskName?.trim()
  if (taskName) items.push({ label: '任务', value: taskName })
  const generatedAt = report.generatedAt?.trim()
  if (generatedAt) items.push({ label: '生成时间', value: generatedAt })
  return items
})
</script>

<style scoped lang="scss">
@use '@/components/BattleSituation/styles/battle-ui-typography.scss' as battleUi;

$report-kv-key-width: 110px;

.report-headline {
  margin-bottom: 14px;
  padding: 14px 18px;
  border-radius: 10px;
  border: 1px solid rgba(79, 147, 221, 0.28);
  background: linear-gradient(135deg, rgba(12, 28, 48, 0.95), rgba(8, 18, 32, 0.98));
  text-align: left;
}

.report-headline__list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.report-kv-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  text-align: left;

  dt {
    flex: 0 0 $report-kv-key-width;
    width: $report-kv-key-width;
    margin: 0;
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    color: #7dd3fc;
    text-align: left;

    &::after {
      content: '：';
    }
  }

  dd {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: battleUi.$battle-ui-font-base;
    font-weight: 600;
    color: #fde68a;
    word-break: break-word;
    text-align: left;
  }
}
</style>