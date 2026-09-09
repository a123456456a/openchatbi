<script setup lang="ts">
import { UserFilled, Setting } from '@element-plus/icons-vue'
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
    class="h-14 px-3 border-t border-slate-200 bg-white flex items-center justify-between gap-2 shrink-0"
  >
    <!-- 侧栏底栏左侧：头像 + 登录人 -->
    <el-dropdown trigger="click" @command="onMenuCommand">
      <button
        type="button"
        class="flex items-center gap-2 min-w-0 rounded-md px-1.5 py-1 hover:bg-slate-100 text-left"
      >
        <el-avatar :size="28" class="shrink-0 bg-slate-600">
          <el-icon><UserFilled /></el-icon>
        </el-avatar>
        <span class="truncate text-sm text-slate-800 max-w-[7rem]">{{ auth.username || '用户' }}</span>
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item disabled>资料（占位）</el-dropdown-item>
          <el-dropdown-item v-if="auth.role === 'admin'" command="admin">用户管理</el-dropdown-item>
          <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- 侧栏底栏右侧：设置齿轮 -->
    <el-button
      text
      circle
      aria-label="设置"
      @click="settings.openSettings()"
    >
      <el-icon :size="18"><Setting /></el-icon>
    </el-button>
  </div>
</template>
