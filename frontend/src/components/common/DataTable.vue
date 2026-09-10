<script setup lang="ts">
defineProps<{
  title?: string
  columns: string[]
  rows: Record<string, string>[]
}>()
</script>

<template>
  <div v-if="columns.length === 0" class="mt-2 text-xs text-[var(--color-muted-foreground)]">暂无数据</div>
  <div v-else class="mt-2 max-h-80 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-white">
    <div v-if="title" class="border-b border-[var(--color-border)] px-3 py-2 text-xs font-medium text-slate-700">
      {{ title }}
    </div>
    <table class="w-full text-left text-xs">
      <thead>
        <tr class="border-b border-[var(--color-border)]">
          <th v-for="col in columns" :key="col" class="px-2 py-2 font-medium text-slate-700">
            {{ col }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i" class="border-b border-[var(--color-border)] last:border-0">
          <td v-for="col in columns" :key="col" class="px-2 py-2 text-slate-600">
            {{ row[col] ?? '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
