<script setup lang="ts">
import { ref } from 'vue'
import { ChatDotRound, CircleCheck, DocumentCopy } from '@element-plus/icons-vue'

import StepCollapse from './StepCollapse.vue'
import ThinkingCollapse from './ThinkingCollapse.vue'
import Markdown from '../common/Markdown.vue'
import type { ChatMessage } from '../../types/stream'

defineProps<{
  messages: ChatMessage[]
}>()

const copiedId = ref<string | null>(null)

async function copyContent(id: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null
    }, 1500)
  } catch {
    // clipboard unavailable — ignore
  }
}
</script>

<template>
  <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6">
    <template v-for="m in messages" :key="m.id">
      <div v-if="m.role === 'user'" class="ml-auto max-w-[75%]">
        <div class="rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-900">
          <Markdown :text="m.content" />
        </div>
      </div>

      <div v-else class="mr-auto max-w-[85%]">
        <div class="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted-foreground)]">
          <el-icon class="text-[var(--color-primary)]"><ChatDotRound /></el-icon>
          OpenChatBI
        </div>

        <div class="space-y-2.5">
          <ThinkingCollapse :thinking="m.thinking" :streaming="m.streaming" />
          <StepCollapse :steps="m.steps" />

          <div v-if="m.content" class="text-sm text-slate-800">
            <Markdown :text="m.content" />
          </div>
          <div
            v-else-if="m.streaming && !m.thinking && m.steps.length === 0"
            class="text-sm text-[var(--color-muted-foreground)]"
          >
            思考中…
          </div>
        </div>

        <div v-if="!m.streaming && m.content" class="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            aria-label="复制回答"
            title="复制"
            class="inline-flex items-center gap-1 rounded-md p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-slate-100 hover:text-[var(--color-foreground)]"
            @click="copyContent(m.id, m.content)"
          >
            <el-icon :size="14">
              <CircleCheck v-if="copiedId === m.id" />
              <DocumentCopy v-else />
            </el-icon>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
