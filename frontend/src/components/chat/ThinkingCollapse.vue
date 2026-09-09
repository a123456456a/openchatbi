<script setup lang="ts">
import { computed, ref, watch } from 'vue'

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
</script>

<template>
  <div v-if="visible" class="mt-3 space-y-1 border-t border-slate-100 pt-2">
    <el-collapse v-model="activeNames" class="thinking-collapse">
      <el-collapse-item title="思考过程" name="thinking">
        <pre
          class="m-0 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600"
          >{{ thinking }}</pre
        >
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.thinking-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 36px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-muted-foreground);
  background: transparent;
  border: none;
  line-height: 1.4;
  padding: 4px 0;
}

.thinking-collapse :deep(.el-collapse-item__wrap) {
  border: none;
  background: transparent;
}

.thinking-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 8px;
}

.thinking-collapse :deep(.el-collapse) {
  border: none;
}
</style>
