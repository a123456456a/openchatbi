<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchWarehouseStatus } from '../../api/warehouseStatus'
import {
  STALE_WAREHOUSE_NEW_CHAT_LABEL,
  STALE_WAREHOUSE_SESSION_MESSAGE,
  evaluateSessionWarehouse,
} from '../../lib/sessionWarehouse'
import { useAuthStore } from '../../stores/auth'
import { useChatStore } from '../../stores/chat'
import { useSessionsStore } from '../../stores/sessions'

const props = defineProps<{ sessionId: string }>()

const router = useRouter()
const auth = useAuthStore()
const chat = useChatStore()
const sessions = useSessionsStore()

const stale = ref(false)
const currentWarehouseId = ref<string | null>(null)
const message = STALE_WAREHOUSE_SESSION_MESSAGE
const ctaLabel = STALE_WAREHOUSE_NEW_CHAT_LABEL

const boundWarehouseId = computed(
  () => sessions.sessions.find((s) => s.id === props.sessionId)?.warehouseConnectionId,
)

let checkSeq = 0

async function checkWarehouse() {
  if (!auth.isAuthenticated || !props.sessionId) {
    stale.value = false
    return
  }
  const seq = ++checkSeq
  try {
    const status = await fetchWarehouseStatus()
    if (seq !== checkSeq) return
    const current = status.active_connection_id
    currentWarehouseId.value = current
    const bound = sessions.sessions.find((s) => s.id === props.sessionId)?.warehouseConnectionId
    const verdict = evaluateSessionWarehouse(bound, current)
    if (verdict === 'bind') {
      sessions.setWarehouseConnectionId(props.sessionId, current)
      stale.value = false
      return
    }
    if (verdict === 'stale') {
      chat.stop()
      stale.value = true
      return
    }
    stale.value = false
  } catch {
    if (seq === checkSeq) stale.value = false
  }
}

function onFocus() {
  void checkWarehouse()
}

function onVisibility() {
  if (document.visibilityState === 'visible') void checkWarehouse()
}

onMounted(() => {
  void checkWarehouse()
  window.addEventListener('focus', onFocus)
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  window.removeEventListener('focus', onFocus)
  document.removeEventListener('visibilitychange', onVisibility)
})

watch(
  () => props.sessionId,
  () => {
    stale.value = false
    void checkWarehouse()
  },
)

watch(boundWarehouseId, (bound) => {
  if (bound === undefined) return
  if (evaluateSessionWarehouse(bound, currentWarehouseId.value) === 'ok') {
    stale.value = false
  }
})

function startNewChat() {
  const id = crypto.randomUUID()
  sessions.ensure(id)
  sessions.setWarehouseConnectionId(id, currentWarehouseId.value)
  stale.value = false
  void router.push({ name: 'chat-session', params: { sessionId: id } })
}
</script>

<template>
  <div v-if="stale" class="px-6 pb-2 pt-2">
    <el-alert type="warning" :title="message" show-icon :closable="false" role="alert" :aria-label="message">
      <div class="mt-2">
        <el-button size="small" type="primary" @click="startNewChat">{{ ctaLabel }}</el-button>
      </div>
    </el-alert>
  </div>
</template>
