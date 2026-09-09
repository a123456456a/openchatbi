<script setup lang="ts">
import type { ChatStep } from '../../types/stream'

defineProps<{
  steps: ChatStep[]
}>()
</script>

<template>
  <div v-if="steps.length" class="mt-2 space-y-1">
    <el-collapse>
      <el-collapse-item
        v-for="s in steps"
        :key="s.id"
        :title="s.label || s.kind || '步骤'"
        :name="s.id"
      >
        <pre class="text-xs whitespace-pre-wrap text-slate-600 m-0">{{ s.text }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>
