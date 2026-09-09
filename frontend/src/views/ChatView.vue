<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

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

onMounted(() => {
  if (!sessionId.value) {
    const id = crypto.randomUUID()
    sessions.ensure(id)
    void router.replace({ name: 'chat-session', params: { sessionId: id } })
  }
})

watch(
  () => route.params.sessionId,
  (id, prev) => {
    if (id !== prev) chat.clear()
  },
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
    <div class="flex-1 flex flex-col min-h-0 bg-slate-50">
      <div class="px-6 py-3 border-b border-slate-200 bg-white text-sm text-slate-600">
        会话 {{ sessionId || '…' }}
      </div>
      <MessageList :messages="chat.messages" />
      <div v-if="chat.error" class="px-6 pb-2">
        <el-alert type="error" :title="chat.error" show-icon :closable="false" />
      </div>
      <div class="border-t border-slate-200 bg-white p-4">
        <div class="max-w-3xl mx-auto flex gap-2">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            placeholder="输入问题…"
            :disabled="chat.streaming"
            @keydown.enter.exact.prevent="onSend"
          />
          <div class="flex flex-col gap-2">
            <el-button type="primary" :loading="chat.streaming" @click="onSend">发送</el-button>
            <el-button v-if="chat.streaming" @click="chat.stop()">停止</el-button>
          </div>
        </div>
      </div>
    </div>
    <InterruptDialog />
  </AppShell>
</template>
