<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ChartView from './ChartView.vue'
import Markdown from '../common/Markdown.vue'
import type { ChatStep } from '../../types/stream'

const props = defineProps<{
  steps: ChatStep[]
}>()

/**
 * `tool` / `tool_call` / `sub_agent` steps only announce that the model is
 * about to invoke something — they carry no result and just add noise, so
 * the UI never renders them. Everything else (`tool_result`, `sql`,
 * `execute_sql`, `visualization`, `tables`, `confidence`, `tool_error`, ...)
 * is an actual outcome the user should be able to see.
 */
const HIDDEN_STEP_KINDS = new Set(['tool', 'tool_call', 'sub_agent'])

const visibleSteps = computed(() => props.steps.filter((s) => !HIDDEN_STEP_KINDS.has(s.kind)))

// Results are shown expanded by default so they're visible without an extra
// click; newly streamed-in steps are auto-added while preserving any manual
// collapse the user already did on earlier steps.
const activeNames = ref<string[]>([])
watch(
  visibleSteps,
  (steps) => {
    for (const s of steps) {
      if (!activeNames.value.includes(s.id)) activeNames.value.push(s.id)
    }
  },
  { immediate: true },
)

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
</script>

<template>
  <div v-if="visibleSteps.length" class="space-y-1.5">
    <el-collapse v-model="activeNames" class="step-collapse">
      <el-collapse-item
        v-for="s in visibleSteps"
        :key="s.id"
        :title="s.label || s.kind || '结果'"
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
  background: rgb(248 250 252 / 0.7);
  border: none;
  border-radius: 0.75rem;
  line-height: 1.4;
  padding: 8px 12px;
}

.step-collapse :deep(.el-collapse-item) {
  margin-bottom: 6px;
  border: 1px solid rgb(241 245 249);
  border-radius: 0.75rem;
  overflow: hidden;
}

.step-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: rgb(248 250 252 / 0.7);
}

.step-collapse :deep(.el-collapse-item__content) {
  padding: 0 12px 12px;
}

.step-collapse :deep(.el-collapse) {
  border: none;
}
</style>
