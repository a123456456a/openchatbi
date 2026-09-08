<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'

const healthStatus = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')
const healthBody = ref('')

async function checkHealth() {
  healthStatus.value = 'loading'
  healthBody.value = ''
  try {
    const res = await fetch('/health')
    const text = await res.text()
    healthBody.value = text
    if (!res.ok) {
      healthStatus.value = 'error'
      ElMessage.error(`Health check failed: HTTP ${res.status}`)
      return
    }
    healthStatus.value = 'ok'
    ElMessage.success('Health check OK')
  } catch (err) {
    healthStatus.value = 'error'
    healthBody.value = err instanceof Error ? err.message : String(err)
    ElMessage.error('Health check request failed (is backend on :8000?)')
  }
}

onMounted(() => {
  void checkHealth()
})
</script>

<template>
  <div class="flex min-h-svh flex-col items-center justify-center gap-6 p-8">
    <h1 class="text-4xl font-semibold text-gray-900">Hello</h1>
    <p class="text-base text-gray-600">OpenChatBI Vue3 frontend scaffold</p>

    <el-card class="w-full max-w-md" shadow="hover">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium">Backend /health</span>
          <el-tag
            :type="
              healthStatus === 'ok'
                ? 'success'
                : healthStatus === 'error'
                  ? 'danger'
                  : healthStatus === 'loading'
                    ? 'info'
                    : 'info'
            "
          >
            {{ healthStatus }}
          </el-tag>
        </div>
      </template>
      <pre
        v-if="healthBody"
        class="m-0 overflow-auto rounded bg-gray-50 p-3 text-left text-sm text-gray-800"
        >{{ healthBody }}</pre
      >
      <p v-else class="m-0 text-sm text-gray-500">Waiting for response…</p>
      <div class="mt-4">
        <el-button type="primary" :loading="healthStatus === 'loading'" @click="checkHealth">
          Retry /health
        </el-button>
      </div>
    </el-card>
  </div>
</template>
