<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Promotion, VideoPause } from '@element-plus/icons-vue'

import AppShell from '../components/layout/AppShell.vue'
import MessageList from '../components/chat/MessageList.vue'
import InterruptDialog from '../components/chat/InterruptDialog.vue'
import { useChatStore } from '../stores/chat'
import { useSessionsStore } from '../stores/sessions'

const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const sessions = useSessionsStore()

const input = ref('')
const sessionId = computed(() => {
  const p = route.params.sessionId
  return typeof p === 'string' && p ? p : ''
})

const shortSessionId = computed(() => {
  const id = sessionId.value
  if (!id) return '…'
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
})

onMounted(() => {
  if (!sessionId.value) {
    const id = crypto.randomUUID()
    sessions.ensure(id)
    void router.replace({ name: 'chat-session', params: { sessionId: id } })
  }
})

watch(
  () => route.params.sessionId,
  (id) => {
    if (typeof id === 'string' && id) chat.loadSession(id)
  },
  { immediate: true },
)

async function onSend() {
  const id = sessionId.value
  if (!id || !input.value.trim()) return
  const text = input.value
  input.value = ''
  await chat.send(id, text)
}
</script>

<template>
  <AppShell>
    <div class="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
      <header
        class="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-6 py-3 backdrop-blur-sm"
      >
        <div class="min-w-0">
          <div class="text-sm font-semibold text-[var(--color-foreground)]">当前会话</div>
          <div
            class="truncate font-mono text-xs text-[var(--color-muted-foreground)]"
            :title="sessionId || undefined"
          >
            {{ shortSessionId }}
          </div>
        </div>
        <div
          v-if="chat.streaming"
          class="shrink-0 rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]"
        >
          生成中…
        </div>
      </header>

      <MessageList :messages="chat.messages" />

      <div v-if="chat.error" class="px-6 pb-2">
        <el-alert type="error" :title="chat.error" show-icon :closable="false" />
      </div>

      <div class="border-t border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <div class="mx-auto max-w-3xl">
          <div
            class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 shadow-[var(--shadow-card)] transition-shadow duration-200 focus-within:border-[var(--color-secondary)] focus-within:shadow-md"
          >
            <el-input
              v-model="input"
              type="textarea"
              :rows="2"
              resize="none"
              placeholder="输入数据分析问题，例如：上周销售额按品类汇总…"
              :disabled="chat.streaming"
              class="chat-composer"
              @keydown.enter.exact.prevent="onSend"
            />
            <div class="mt-2 flex items-center justify-between gap-3">
              <p class="text-xs text-[var(--color-muted-foreground)]">
                Enter 发送 · Shift+Enter 换行
              </p>
              <div class="flex items-center gap-2">
                <el-button
                  v-if="chat.streaming"
                  class="!h-10 !min-w-[5.5rem] !rounded-xl"
                  @click="chat.stop()"
                >
                  <el-icon class="mr-1"><VideoPause /></el-icon>
                  停止
                </el-button>
                <el-button
                  type="primary"
                  class="!h-10 !min-w-[5.5rem] !rounded-xl"
                  :loading="chat.streaming"
                  :disabled="!input.trim()"
                  @click="onSend"
                >
                  <el-icon v-if="!chat.streaming" class="mr-1"><Promotion /></el-icon>
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <InterruptDialog />
  </AppShell>
</template>

<style scoped>
.chat-composer :deep(.el-textarea__inner) {
  border: none;
  box-shadow: none;
  background: transparent;
  padding: 0.25rem 0.35rem;
  font-family: var(--font-sans);
  font-size: 0.95rem;
  line-height: 1.55;
  resize: none;
}

.chat-composer :deep(.el-textarea__inner:focus) {
  box-shadow: none;
}
</style>
