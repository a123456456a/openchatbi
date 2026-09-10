<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'

import Markdown from '../common/Markdown.vue'

const props = defineProps<{
  thinking: string
  streaming?: boolean
}>()

const activeNames = ref<string[]>([])

watch(
  () => [props.thinking, props.streaming] as const,
  ([text, streaming]) => {
    if (!text) {
      activeNames.value = []
      return
    }
    if (streaming) {
      activeNames.value = ['thinking']
    } else if (activeNames.value.includes('thinking') && !streaming) {
      // 流式进行中自动展开；流结束后默认折叠
      activeNames.value = []
    }
  },
  { immediate: true },
)

const visible = computed(() => Boolean(props.thinking))
const title = computed(() => `思考过程${props.streaming ? '…' : ''}`)
</script>

<template>
  <div v-if="visible" class="thinking-wrap">
    <el-collapse v-model="activeNames" class="thinking-collapse">
      <el-collapse-item :title="title" name="thinking">
        <template #title>
          <el-icon class="mr-1.5 shrink-0"><MagicStick /></el-icon>
          <span class="flex-1 text-left">{{ title }}</span>
        </template>
        <div class="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          <Markdown :text="thinking" class="text-xs leading-relaxed" />
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.thinking-wrap {
  border-radius: 0.75rem;
  border: 1px solid rgb(241 245 249);
  overflow: hidden;
}

.thinking-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-muted-foreground);
  background: rgb(248 250 252 / 0.7);
  border: none;
  line-height: 1.4;
  padding: 8px 12px;
}

.thinking-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: rgb(248 250 252 / 0.7);
}

.thinking-collapse :deep(.el-collapse-item__content) {
  padding: 0 12px 12px;
}

.thinking-collapse :deep(.el-collapse) {
  border: none;
}
</style>
