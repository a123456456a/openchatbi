<script setup lang="ts">
import { ref } from 'vue'
import { ChatDotRound, CircleCheck, DocumentCopy } from '@element-plus/icons-vue'

import ChartView from './ChartView.vue'
import FileDownloadCard from './FileDownloadCard.vue'
import Markdown from '../common/Markdown.vue'
import {
  assistantCopyText,
  extractFileDownload,
  fileResultSteps,
  nonFileToolSteps,
  toolBodyText,
  toolSteps,
  visualizationSteps,
} from '../../lib/chatSteps'
import type { ChatMessage, ChatStep } from '../../types/stream'

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

function visualizationDsl(step: ChatStep): Record<string, unknown> {
  const dsl = step.data?.visualization_dsl
  return dsl && typeof dsl === 'object' ? (dsl as Record<string, unknown>) : {}
}

function csvData(step: ChatStep): string | undefined {
  const data = step.data?.data
  return typeof data === 'string' ? data : undefined
}

function hasInlineArtifacts(m: ChatMessage): boolean {
  return Boolean(m.content) || toolSteps(m.steps).length > 0 || visualizationSteps(m.steps).length > 0
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
          <!-- Main answer body: LLM text, then any tool-generated artifacts (charts, files,
               raw tool results) rendered inline and in reading order — not hidden in a
               collapsed "step" panel. -->
          <div v-if="hasInlineArtifacts(m)" class="space-y-3 text-sm text-slate-800">
            <Markdown v-if="m.content" :text="m.content" />

            <ChartView
              v-for="s in visualizationSteps(m.steps)"
              :key="s.id"
              :visualization-dsl="visualizationDsl(s)"
              :csv-data="csvData(s)"
            />

            <FileDownloadCard
              v-for="s in fileResultSteps(m.steps)"
              :key="s.id"
              v-bind="extractFileDownload(s)!"
            />

            <Markdown v-for="s in nonFileToolSteps(m.steps)" :key="s.id" :text="toolBodyText(s)" />
          </div>
          <div
            v-else-if="m.streaming && !m.thinking && m.steps.length === 0"
            class="text-sm text-[var(--color-muted-foreground)]"
          >
            思考中…
          </div>
        </div>

        <div v-if="!m.streaming && hasInlineArtifacts(m)" class="mt-1.5 flex items-center gap-1">
          <button
            type="button"
            aria-label="复制回答"
            title="复制"
            class="inline-flex items-center gap-1 rounded-md p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-slate-100 hover:text-[var(--color-foreground)]"
            @click="copyContent(m.id, assistantCopyText(m.content, m.steps))"
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
