<script setup lang="ts">
import { computed } from 'vue'

import ChartView from './ChartView.vue'
import Markdown from '../common/Markdown.vue'
import type { ChatStep } from '../../types/stream'

const props = defineProps<{
  steps: ChatStep[]
}>()

function visualizationDsl(step: ChatStep): Record<string, unknown> | null {
  if (step.kind !== 'visualization') return null
  const dsl = step.data?.visualization_dsl
  return dsl && typeof dsl === 'object' ? (dsl as Record<string, unknown>) : null
}

function csvData(step: ChatStep): string | undefined {
  if (step.kind !== 'visualization') return undefined
  const data = step.data?.data
  return typeof data === 'string' ? data : undefined
}

const visible = computed(() => props.steps.length > 0)
</script>

<template>
  <div v-if="visible" class="mt-3 space-y-1 border-t border-slate-100 pt-2">
    <el-collapse class="step-collapse">
      <el-collapse-item
        v-for="s in steps"
        :key="s.id"
        :title="s.label || s.kind || '步骤'"
        :name="s.id"
      >
        <div class="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <Markdown :text="s.text" class="text-xs leading-relaxed" />
        </div>
        <ChartView v-if="visualizationDsl(s)" :visualization-dsl="visualizationDsl(s)!" :csv-data="csvData(s)" />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.step-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-muted-foreground);
  background: transparent;
  border: none;
  line-height: 1.4;
  padding: 4px 0;
}

.step-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.step-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 8px;
}

.step-collapse :deep(.el-collapse) {
  border: none;
}
</style>
