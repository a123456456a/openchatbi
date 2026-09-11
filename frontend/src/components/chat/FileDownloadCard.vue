<script setup lang="ts">
import { ref } from 'vue'
import { Document, Download, Loading } from '@element-plus/icons-vue'

import { downloadFile, fileTypeLabel } from '../../lib/download'

const props = defineProps<{
  url: string
  filename: string
  ext: string
}>()

const state = ref<'idle' | 'downloading' | 'error'>('idle')

async function onDownload() {
  state.value = 'downloading'
  try {
    await downloadFile(props.url, props.filename)
    state.value = 'idle'
  } catch {
    state.value = 'error'
  }
}
</script>

<template>
  <div
    class="mt-2 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2.5 shadow-[var(--shadow-card)]"
  >
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-muted)] text-[var(--color-primary)]">
      <el-icon :size="18"><Document /></el-icon>
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium text-slate-800">{{ filename }}</div>
      <div class="text-xs text-[var(--color-muted-foreground)]">{{ fileTypeLabel(ext) }} · 报告已生成</div>
    </div>
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-on-primary)] transition-opacity hover:opacity-90 disabled:opacity-60"
      :disabled="state === 'downloading'"
      @click="onDownload"
    >
      <el-icon :size="14"><Loading v-if="state === 'downloading'" class="animate-spin" /><Download v-else /></el-icon>
      {{ state === 'downloading' ? '下载中…' : '下载' }}
    </button>
  </div>
  <div v-if="state === 'error'" class="mt-1 text-xs text-red-600">下载失败，请重试。</div>
</template>
