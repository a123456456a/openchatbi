<script setup lang="ts">
import { ChatDotRound, Plus } from '@element-plus/icons-vue'
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
  <div class="h-screen flex overflow-hidden bg-[var(--color-background)]">
    <aside
      class="w-64 shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]"
    >
      <div class="p-4 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-2.5 mb-4">
          <div
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm"
            aria-hidden="true"
          >
            <el-icon :size="18"><ChatDotRound /></el-icon>
          </div>
          <div class="min-w-0">
            <div class="text-base font-semibold tracking-tight text-[var(--color-foreground)]">
              OpenChatBI
            </div>
            <div class="text-xs text-[var(--color-muted-foreground)]">智能数据分析对话</div>
          </div>
        </div>
        <el-button type="primary" class="w-full !h-10 !rounded-xl" @click="newChat">
          <el-icon class="mr-1"><Plus /></el-icon>
          新建会话
        </el-button>
      </div>

      <nav class="flex-1 overflow-y-auto p-2" aria-label="会话列表">
        <div
          v-if="sessionsStore.sessions.length === 0"
          class="px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]"
        >
          暂无会话，点击上方开始
        </div>
        <button
          v-for="s in sessionsStore.sessions"
          :key="s.id"
          type="button"
          class="group mb-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200"
          :class="
            route.params.sessionId === s.id
              ? 'bg-[var(--color-muted)] font-medium text-[var(--color-primary)] shadow-[inset_3px_0_0_0_var(--color-primary)]'
              : 'text-slate-600 hover:bg-slate-50'
          "
          @click="openSession(s.id)"
        >
          <span class="truncate">{{ s.title }}</span>
        </button>
      </nav>

      <SidebarFooter />
    </aside>

    <section class="flex min-h-0 min-w-0 flex-1 flex-col">
      <slot />
    </section>

    <SettingsDialog />
  </div>
</template>
