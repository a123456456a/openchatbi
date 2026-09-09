<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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
  <div class="min-h-screen flex items-center justify-center bg-slate-50 px-4">
    <el-card class="w-full max-w-md shadow-sm">
      <template #header>
        <div class="text-lg font-semibold text-slate-800">OpenChatBI 登录</div>
        <div class="text-sm text-slate-500 mt-1">使用自建账号登录</div>
      </template>

      <el-form label-position="top" @submit.prevent="onLogin">
        <el-form-item label="用户名">
          <el-input v-model="form.username" autocomplete="username" placeholder="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="password"
            @keyup.enter="onLogin"
          />
        </el-form-item>
        <div class="flex gap-2">
          <el-button type="primary" class="flex-1" :loading="loading" @click="onLogin">
            登录
          </el-button>
          <el-button :loading="bootstrapping" @click="onBootstrap">首次初始化</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>
