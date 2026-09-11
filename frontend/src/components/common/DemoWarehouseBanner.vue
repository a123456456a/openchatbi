<script setup lang="ts">
import { ref, watch } from 'vue'

import { fetchWarehouseStatus } from '../../api/warehouseStatus'
import { useAuthStore } from '../../stores/auth'

/** Visible 「演示数据」 watermark when chat is allowed to use the config.yaml demo warehouse. */
const auth = useAuthStore()
const demoMode = ref(false)

watch(
  () => auth.isAuthenticated,
  (authenticated, _prev, onCleanup) => {
    if (!authenticated) {
      demoMode.value = false
      return
    }
    let cancelled = false
    onCleanup(() => {
      cancelled = true
    })
    void fetchWarehouseStatus()
      .then((status) => {
        if (!cancelled) demoMode.value = Boolean(status.demo_mode)
      })
      .catch(() => {
        if (!cancelled) demoMode.value = false
      })
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="demoMode"
    role="status"
    aria-label="演示数据"
    class="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
  >
    <div
      class="mt-2 rounded-full border border-amber-300/80 bg-amber-100/95 px-4 py-1 text-xs font-semibold tracking-wide text-amber-900 shadow-sm backdrop-blur-sm"
    >
      演示数据 · 非生产数仓
    </div>
    <div
      aria-hidden="true"
      class="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
    >
      <span class="select-none text-6xl font-black tracking-[0.35em] text-amber-500/10 rotate-[-24deg]">
        演示数据
      </span>
    </div>
  </div>
</template>
