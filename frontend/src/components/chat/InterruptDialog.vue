<script setup lang="ts">
import { computed } from 'vue'
import { useChatStore } from '../../stores/chat'

const chat = useChatStore()
const visible = computed({
  get: () => !!chat.lastInterrupt,
  set: (v: boolean) => {
    if (!v) chat.lastInterrupt = null
  },
})
</script>

<template>
  <el-dialog v-model="visible" title="需要你的确认" width="480px">
    <p class="whitespace-pre-wrap text-sm text-slate-700">{{ chat.lastInterrupt?.text }}</p>
    <div v-if="chat.lastInterrupt?.buttons?.length" class="mt-3 flex flex-wrap gap-2">
      <el-tag v-for="(b, i) in chat.lastInterrupt?.buttons" :key="i">{{ String(b) }}</el-tag>
    </div>
    <template #footer>
      <el-button type="primary" @click="visible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>
