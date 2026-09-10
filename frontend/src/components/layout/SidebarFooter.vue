<script setup lang="ts">
import { Setting, UserFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../../stores/auth'
import { useSettingsStore } from '../../stores/settings'

const auth = useAuthStore()
const settings = useSettingsStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  await router.replace({ name: 'login' })
}

function goAdminUsers() {
  void router.push({ name: 'admin-users' })
}

function onMenuCommand(cmd: string) {
  if (cmd === 'logout') void onLogout()
  else if (cmd === 'admin') goAdminUsers()
}
</script>

<template>
  <div
    class="flex h-14 shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-3"
  >
    <el-dropdown trigger="click" @command="onMenuCommand">
      <button
        type="button"
        class="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-200 hover:bg-slate-50"
      >
        <el-avatar :size="30" class="shrink-0 !bg-[var(--color-primary)]">
          <el-icon><UserFilled /></el-icon>
        </el-avatar>
        <span class="max-w-[7rem] truncate text-sm font-medium text-[var(--color-foreground)]">
          {{ auth.username || '用户' }}
        </span>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled>资料（占位）</el-dropdown-item>
          <el-dropdown-item v-if="auth.role === 'admin'" command="admin">用户管理</el-dropdown-item>
          <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-button
      text
      circle
      class="!h-10 !w-10"
      aria-label="设置"
      @click="settings.openSettings()"
    >
      <el-icon :size="18"><Setting /></el-icon>
    </el-button>
  </div>
</template>
