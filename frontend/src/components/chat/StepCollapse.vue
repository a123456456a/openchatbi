<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import Markdown from '../common/Markdown.vue'
import { formatToolBody, isToolStep, stepTitle } from '../../lib/chatSteps'
import type { ChatStep } from '../../types/stream'

const props = withDefaults(
  defineProps<{
    steps: ChatStep[]
    defaultOpen?: boolean
  }>(),
  { defaultOpen: true },
)

const visibleSteps = computed(() => props.steps)

// Process steps default expanded so results are visible without an extra
// click; newly streamed-in steps are auto-added while preserving any manual
// collapse the user already did on earlier steps. Tool steps pass
// defaultOpen=false and stay collapsed unless the user opens them.
const activeNames = ref<string[]>([])
watch(
  [visibleSteps, () => props.defaultOpen],
  ([steps, defaultOpen]) => {
    if (!defaultOpen) return
    for (const s of steps) {
      if (!activeNames.value.includes(s.id)) activeNames.value.push(s.id)
    }
  },
  { immediate: true },
)

function bodyText(step: ChatStep): string {
  return isToolStep(step) ? formatToolBody(step) : step.text
}

/** Only render the (potentially large) markdown body once a panel is actually expanded, so a
 * collapsed tool-result panel never pays the markdown-parsing cost that causes page stutter. */
function isOpen(id: string): boolean {
  return activeNames.value.includes(id)
}
</script>

<template>
  <div v-if="visibleSteps.length" class="space-y-1.5">
    <el-collapse v-model="activeNames" class="step-collapse">
      <el-collapse-item
        v-for="s in visibleSteps"
        :key="s.id"
        :title="stepTitle(s)"
        :name="s.id"
      >
        <div class="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <Markdown v-if="isOpen(s.id)" :text="bodyText(s)" class="text-xs leading-relaxed" />
        </div>
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
