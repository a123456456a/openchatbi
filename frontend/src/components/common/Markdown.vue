<script setup lang="ts">
import { computed } from 'vue'

import { renderMarkdown } from '../../lib/markdown'

const props = defineProps<{
  text: string
}>()

const html = computed(() => renderMarkdown(props.text))
</script>

<template>
  <div v-if="text" class="prose prose-sm prose-chat max-w-none break-words" v-html="html" />
</template>
