<script setup lang="ts">
import { Top, VideoPause } from '@element-plus/icons-vue'

import DemoWarehouseComposerHint from '../common/DemoWarehouseComposerHint.vue'

const props = defineProps<{
  modelValue: string
  streaming: boolean
  autofocus?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const placeholder = props.placeholder ?? '输入数据分析问题，例如：上周销售额按品类汇总…'

function onSend() {
  if (!props.modelValue.trim() || props.streaming) return
  emit('send')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSend()
  }
}
</script>

<template>
  <div
    class="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-card)] transition-shadow duration-200 focus-within:border-[var(--color-secondary)] focus-within:shadow-md"
  >
    <el-input
      :model-value="modelValue"
      type="textarea"
      :rows="1"
      resize="none"
      :placeholder="placeholder"
      :disabled="streaming"
      :autofocus="autofocus"
      class="chat-composer"
      @update:model-value="(v: string) => emit('update:modelValue', v)"
      @keydown="onKeydown"
    />
    <div class="mt-1 flex items-center justify-between gap-3 px-1">
      <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted-foreground)]">
        <DemoWarehouseComposerHint />
        <p>Enter 发送 · Shift+Enter 换行</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="streaming"
          type="button"
          aria-label="停止生成"
          title="停止生成"
          class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-foreground)] text-white transition-opacity hover:opacity-90"
          @click="emit('stop')"
        >
          <el-icon :size="14"><VideoPause /></el-icon>
        </button>
        <button
          v-else
          type="button"
          aria-label="发送"
          title="发送"
          :disabled="!modelValue.trim()"
          class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-foreground)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          @click="onSend"
        >
          <el-icon :size="18"><Top /></el-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-composer :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  background: transparent;
  padding: 0.35rem 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  line-height: 1.55;
  resize: none;
  max-height: 10rem;
  min-height: 2.5rem;
}

.chat-composer :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}
</style>
