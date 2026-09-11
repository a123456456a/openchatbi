<script setup lang="ts">
import { Grid, Notebook, PieChart, TrendCharts } from '@element-plus/icons-vue'

import ChatComposer from './ChatComposer.vue'
import InterruptDialog from './InterruptDialog.vue'

defineProps<{
  modelValue: string
  streaming: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
}>()

const QUICK_PROMPTS = [
  { icon: TrendCharts, label: '近7天销售趋势', prompt: '帮我分析最近7天的销售趋势' },
  { icon: PieChart, label: '生成图表', prompt: '把上个季度各品类的销售额生成柱状图' },
  { icon: Grid, label: '数据表查询', prompt: '列出销售额最高的10个商品及其分类' },
  { icon: Notebook, label: '生成SQL', prompt: '帮我写一段按月统计订单量的SQL' },
] as const
</script>

<template>
  <div class="flex flex-1 flex-col items-center justify-center px-6 py-10">
    <div class="w-full max-w-2xl text-center">
      <h1 class="text-3xl font-semibold tracking-tight text-[var(--color-primary)]">嗨，需要我帮你分析什么？</h1>
      <p class="mt-2 text-sm text-[var(--color-muted-foreground)]">
        OpenChatBI 是你的智能数据分析助手 —— 随时为你查询数据、生成 SQL 与可视化图表。
      </p>

      <div class="mt-6">
        <InterruptDialog />
        <ChatComposer
          :model-value="modelValue"
          :streaming="streaming"
          autofocus
          @update:model-value="(v: string) => emit('update:modelValue', v)"
          @send="emit('send')"
          @stop="emit('stop')"
        />
      </div>

      <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          v-for="q in QUICK_PROMPTS"
          :key="q.label"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
          @click="emit('update:modelValue', q.prompt)"
        >
          <el-icon :size="14"><component :is="q.icon" /></el-icon>
          {{ q.label }}
        </button>
      </div>
    </div>
  </div>
</template>
