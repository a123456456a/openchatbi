<script setup lang="ts">
import { ref, watch } from 'vue'

import { fetchWarehouseStatus } from '../../api/warehouseStatus'
import { useAuthStore } from '../../stores/auth'

/** Short hint beside the chat composer when demo warehouse mode is on. */
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
  <p
    v-if="demoMode"
    role="status"
    aria-label="当前为演示数仓"
    class="text-xs font-medium text-amber-800"
  >
    当前为演示数仓
  </p>
</template>
