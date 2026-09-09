<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import SettingsDialog from './SettingsDialog.vue'
import SidebarFooter from './SidebarFooter.vue'
import { useSessionsStore } from '../../stores/sessions'

const route = useRoute()
const router = useRouter()
const sessionsStore = useSessionsStore()

function newChat() {
  const id = crypto.randomUUID()
  sessionsStore.ensure(id)
  void router.push({ name: 'chat-session', params: { sessionId: id } })
}

function openSession(id: string) {
  void router.push({ name: 'chat-session', params: { sessionId: id } })
}
</script>

<template>
  <div class="h-screen flex bg-slate-100 overflow-hidden">
    <aside class="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div class="p-3 border-b border-slate-200">
        <div class="font-semibold text-slate-800 mb-2">OpenChatBI</div>
        <el-button type="primary" class="w-full" @click="newChat">新建会话</el-button>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="sessionsStore.sessions.length === 0" class="text-xs text-slate-400 px-2 py-3">
          暂无会话
        </div>
        <button
          v-for="s in sessionsStore.sessions"
          :key="s.id"
          type="button"
          class="w-full text-left text-sm px-2 py-2 rounded hover:bg-slate-100 truncate"
          :class="route.params.sessionId === s.id ? 'bg-slate-100 font-medium' : ''"
          @click="openSession(s.id)"
        >
          {{ s.title }}
        </button>
      </div>
      <SidebarFooter />
    </aside>

    <section class="flex-1 min-w-0 flex flex-col min-h-0">
      <slot />
    </section>

    <SettingsDialog />
  </div>
</template>
