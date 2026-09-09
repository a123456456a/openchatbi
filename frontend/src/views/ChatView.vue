<script setup lang="ts">
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-50">
    <header class="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white">
      <div class="font-semibold text-slate-800">OpenChatBI</div>
      <div class="flex items-center gap-3 text-sm text-slate-600">
        <span>{{ auth.username }} ({{ auth.role }})</span>
        <el-button size="small" @click="onLogout">退出</el-button>
      </div>
    </header>
    <main class="flex-1 flex items-center justify-center p-8">
      <el-empty description="聊天界面占位（Task 10/11 将完善侧栏与流式对话）" />
    </main>
  </div>
</template>
