<script setup lang="ts">
import StepCollapse from './StepCollapse.vue'
import type { ChatMessage } from '../../types/stream'

defineProps<{
  messages: ChatMessage[]
}>()
</script>

<template>
  <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
    <div
      v-for="m in messages"
      :key="m.id"
      class="max-w-3xl"
      :class="m.role === 'user' ? 'ml-auto' : 'mr-auto'"
    >
      <div
        class="rounded-lg px-4 py-3 text-sm whitespace-pre-wrap"
        :class="m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-800'"
      >
        <div class="text-xs opacity-70 mb-1">{{ m.role === 'user' ? '你' : '助手' }}{{ m.streaming ? ' …' : '' }}</div>
        {{ m.content || (m.streaming ? '思考中…' : '') }}
        <StepCollapse v-if="m.role === 'assistant'" :steps="m.steps" />
      </div>
    </div>
  </div>
</template>
