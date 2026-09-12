<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppShell from '../components/layout/AppShell.vue'
import StaleWarehouseSessionBanner from '../components/common/StaleWarehouseSessionBanner.vue'
import ChatComposer from '../components/chat/ChatComposer.vue'
import ChatWelcome from '../components/chat/ChatWelcome.vue'
import MessageList from '../components/chat/MessageList.vue'
import InterruptPrompt from '../components/chat/InterruptPrompt.vue'
import { useAuthStore } from '../stores/auth'
import { useChatStore } from '../stores/chat'
import { useSessionsStore } from '../stores/sessions'
import { useSettingsStore } from '../stores/settings'

/** Must match `MISSING_LLM_SETTINGS_DETAIL` in `backend/chat/routes.py`. */
const MISSING_LLM_SETTINGS_DETAIL = '请先在设置中配置模型'
/** Must match `MISSING_WAREHOUSE_DETAIL` in `backend/warehouse/gate.py`. */
const MISSING_WAREHOUSE_DETAIL = '请先在管理端激活数仓'

const route = useRoute()
const router = useRouter()
const chat = useChatStore()
const sessions = useSessionsStore()
const settings = useSettingsStore()
const auth = useAuthStore()

const input = ref('')
const sessionId = computed(() => {
  const p = route.params.sessionId
  return typeof p === 'string' && p ? p : ''
})

const hasMessages = computed(() => chat.messages.length > 0)
const showMissingLlmCta = computed(() => chat.error === MISSING_LLM_SETTINGS_DETAIL)
const showMissingWarehouseCta = computed(
  () => chat.error === MISSING_WAREHOUSE_DETAIL && auth.role === 'admin',
)

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

function goActivateWarehouse() {
  void router.push({ name: 'admin-databases' })
}
</script>

<template>
  <AppShell>
    <div class="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
      <StaleWarehouseSessionBanner v-if="sessionId" :session-id="sessionId" />
      <header
        v-if="hasMessages"
        class="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-6 py-3 backdrop-blur-sm"
      >
        <div class="min-w-0 text-sm font-semibold text-[var(--color-foreground)]">当前会话</div>
        <div
          v-if="chat.streaming"
          class="shrink-0 rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]"
        >
          生成中…
        </div>
      </header>

      <template v-if="hasMessages">
        <MessageList :messages="chat.messages" />

        <div v-if="chat.error" class="px-6 pb-2">
          <el-alert type="error" :title="chat.error" show-icon :closable="false">
            <div v-if="showMissingLlmCta || showMissingWarehouseCta" class="mt-2">
              <el-button v-if="showMissingLlmCta" size="small" @click="settings.openSettings()">
                去设置
              </el-button>
              <el-button v-if="showMissingWarehouseCta" size="small" @click="goActivateWarehouse">
                去激活数仓
              </el-button>
            </div>
          </el-alert>
        </div>

        <div class="border-t border-[var(--color-border)] bg-[var(--color-card)] p-4">
          <div class="mx-auto max-w-3xl">
            <InterruptPrompt />
            <ChatComposer v-model="input" :streaming="chat.streaming" @send="onSend" @stop="chat.stop()" />
          </div>
        </div>
      </template>

      <template v-else>
        <ChatWelcome v-model="input" :streaming="chat.streaming" @send="onSend" @stop="chat.stop()" />
        <div v-if="chat.error" class="px-6 pb-6">
          <el-alert type="error" :title="chat.error" show-icon :closable="false">
            <div v-if="showMissingLlmCta || showMissingWarehouseCta" class="mt-2">
              <el-button v-if="showMissingLlmCta" size="small" @click="settings.openSettings()">
                去设置
              </el-button>
              <el-button v-if="showMissingWarehouseCta" size="small" @click="goActivateWarehouse">
                去激活数仓
              </el-button>
            </div>
          </el-alert>
        </div>
      </template>
    </div>
  </AppShell>
</template>
