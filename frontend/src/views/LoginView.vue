<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ChatDotRound } from '@element-plus/icons-vue'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})
const loading = ref(false)
const bootstrapping = ref(false)

async function onLogin() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    await router.replace(redirect && redirect.startsWith('/') ? redirect : { name: 'chat' })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败')
  } finally {
    loading.value = false
  }
}

async function onBootstrap() {
  if (!form.username || !form.password) {
    ElMessage.warning('请输入首个管理员用户名和密码')
    return
  }
  bootstrapping.value = true
  try {
    await auth.bootstrap(form.username, form.password)
    ElMessage.success('已创建首个管理员，请登录')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '初始化失败')
  } finally {
    bootstrapping.value = false
  }
}
</script>

<template>
  <div class="login-page relative flex min-h-screen items-center justify-center px-4 py-10">
    <div class="relative z-10 w-full max-w-md">
      <div class="mb-8 text-center">
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-lg shadow-blue-900/20"
          aria-hidden="true"
        >
          <el-icon :size="28"><ChatDotRound /></el-icon>
        </div>
        <h1 class="text-3xl font-semibold tracking-tight text-[var(--color-foreground)]">
          OpenChatBI
        </h1>
        <p class="mt-2 text-sm text-[var(--color-muted-foreground)]">
          用对话探索业务数据
        </p>
      </div>

      <div
        class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-card)] sm:p-8"
      >
        <div class="mb-5">
          <h2 class="text-lg font-semibold text-[var(--color-foreground)]">登录</h2>
          <p class="mt-1 text-sm text-[var(--color-muted-foreground)]">使用自建账号继续</p>
        </div>

        <el-form label-position="top" @submit.prevent="onLogin">
          <el-form-item label="用户名">
            <el-input
              v-model="form.username"
              size="large"
              autocomplete="username"
              placeholder="username"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="form.password"
              type="password"
              size="large"
              show-password
              autocomplete="current-password"
              placeholder="password"
              @keyup.enter="onLogin"
            />
          </el-form-item>
          <div class="mt-2 flex flex-col gap-2 sm:flex-row">
            <el-button
              type="primary"
              size="large"
              class="flex-1 !rounded-xl"
              :loading="loading"
              @click="onLogin"
            >
              登录
            </el-button>
            <el-button
              size="large"
              class="!rounded-xl"
              :loading="bootstrapping"
              @click="onBootstrap"
            >
              首次初始化
            </el-button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgb(59 130 246 / 0.18), transparent),
    linear-gradient(180deg, #eff6ff 0%, var(--color-background) 45%, #f1f5f9 100%);
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgb(30 64 175 / 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgb(30 64 175 / 0.04) 1px, transparent 1px);
  background-size: 32px 32px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent);
  pointer-events: none;
}
</style>
