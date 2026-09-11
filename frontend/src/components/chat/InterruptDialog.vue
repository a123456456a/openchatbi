<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

import { abortChatInterrupt } from '../../api/chat'
import { sanitizeInterruptText } from '../../lib/interruptText'
import { useChatStore } from '../../stores/chat'

const chat = useChatStore()
const customReply = ref('')

watch(
  () => [chat.lastInterrupt?.text, chat.lastInterrupt?.buttons] as const,
  () => {
    customReply.value = ''
  },
)

const displayText = computed(() => {
  const interrupt = chat.lastInterrupt
  if (!interrupt) return null
  return sanitizeInterruptText(interrupt.text)
})

const buttons = computed(() => (chat.lastInterrupt?.buttons ?? []).map((b) => String(b)))

const fallbackText = computed(() =>
  buttons.value.length ? '请选择以下选项继续' : '请输入你的回复以继续对话',
)

const canSubmitCustom = computed(() => Boolean(customReply.value.trim()))

function clearInterruptUi() {
  chat.lastInterrupt = null
}

async function dismissInterrupt() {
  const sid = chat.sessionId
  clearInterruptUi()
  if (!sid) return
  try {
    await abortChatInterrupt(sid)
  } catch {
    /* UI already dismissed; server abort is best-effort */
  }
}

function choose(option: string) {
  const text = option.trim()
  if (!text) return
  const sid = chat.sessionId
  clearInterruptUi()
  if (sid) void chat.send(sid, text)
}

function submitCustom() {
  choose(customReply.value)
}

function onCustomKeyDown(e: Event) {
  const ke = e as KeyboardEvent
  if (ke.key === 'Enter') {
    ke.preventDefault()
    submitCustom()
  }
}
</script>

<template>
  <div
    v-if="chat.lastInterrupt"
    role="region"
    aria-label="需要你的确认"
    class="mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-3 shadow-sm"
  >
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <div class="text-sm font-medium text-[var(--color-foreground)]">需要你的确认</div>
        <p class="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {{ displayText ?? fallbackText }}
        </p>
      </div>
      <button
        type="button"
        aria-label="关闭确认"
        title="关闭"
        class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        @click="dismissInterrupt"
      >
        <el-icon :size="14"><Close /></el-icon>
      </button>
    </div>

    <div v-if="buttons.length" class="flex flex-col gap-2">
      <el-button
        v-for="(option, i) in buttons"
        :key="i"
        native-type="button"
        class="interrupt-option w-full !ml-0"
        @click="choose(option)"
      >
        {{ option }}
      </el-button>
    </div>

    <div class="flex items-center gap-2" :class="buttons.length ? 'mt-2' : ''">
      <el-input
        v-model="customReply"
        placeholder="其他，请手动填写…"
        aria-label="手动填写回复"
        class="interrupt-custom"
        @keydown="onCustomKeyDown"
      />
      <el-button type="primary" native-type="button" :disabled="!canSubmitCustom" class="shrink-0" @click="submitCustom">
        提交
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.interrupt-option {
  width: 100%;
  height: auto;
  min-height: 2rem;
  margin-left: 0;
  justify-content: flex-start;
  white-space: normal;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 400;
  line-height: 1.4;
  background: var(--color-card);
}

.interrupt-custom :deep(.el-input__wrapper) {
  background: var(--color-card);
}
</style>
