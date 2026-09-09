<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import SettingsDrawer from './SettingsDrawer.vue'
import SidebarFooter from './SidebarFooter.vue'

const route = useRoute()
const router = useRouter()

const sessions = computed(() => {
  // Local placeholder list until Task 11 sessions store
  const id = typeof route.params.sessionId === 'string' ? route.params.sessionId : null
  return id ? [{ id, title: '当前会话' }] : []
})

function newChat() {
  void router.push({ name: 'chat' })
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
        <div v-if="sessions.length === 0" class="text-xs text-slate-400 px-2 py-3">暂无会话</div>
        <button
          v-for="s in sessions"
          :key="s.id"
          type="button"
          class="w-full text-left text-sm px-2 py-2 rounded hover:bg-slate-100 truncate"
          @click="router.push({ name: 'chat-session', params: { sessionId: s.id } })"
        >
          {{ s.title }}
        </button>
      </div>
      <SidebarFooter />
    </aside>

    <section class="flex-1 min-w-0 flex flex-col">
      <slot />
    </section>

    <SettingsDrawer />
  </div>
</template>
