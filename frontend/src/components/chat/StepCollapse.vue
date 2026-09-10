<script setup lang="ts">
import type { ChatStep } from '../../types/stream'

defineProps<{
  steps: ChatStep[]
}>()
</script>

<template>
  <div v-if="steps.length" class="mt-3 space-y-1 border-t border-slate-100 pt-2">
    <el-collapse class="step-collapse">
      <el-collapse-item
        v-for="s in steps"
        :key="s.id"
        :title="s.label || s.kind || '步骤'"
        :name="s.id"
      >
        <pre
          class="m-0 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"
          >{{ s.text }}</pre
        >
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
