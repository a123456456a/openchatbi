<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { enhanceMarkdown } from '../../composables/useMarkdownEnhancements'
import { renderMarkdown } from '../../lib/markdown'

const props = defineProps<{
  text: string
}>()

const html = computed(() => renderMarkdown(props.text))
const containerRef = ref<HTMLElement | null>(null)
let cleanup: () => void = () => {}

watch(
  html,
  async () => {
    await nextTick()
    cleanup()
    cleanup = await enhanceMarkdown(containerRef.value)
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => cleanup())
</script>

<template>
  <div v-if="text" ref="containerRef" class="prose prose-sm prose-chat max-w-none break-words" v-html="html" />
</template>
