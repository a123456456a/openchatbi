<script setup lang="ts">
import { Chart, type ChartConfiguration } from 'chart.js/auto'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import DataTable from '../common/DataTable.vue'
import { buildChartConfig, computeBoxStats } from '../../lib/chartConfig'
import { parseCsv } from '../../lib/csv'

const props = defineProps<{
  visualizationDsl: Record<string, unknown>
  csvData?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const parsed = computed(() => parseCsv(props.csvData ?? ''))
const chartType = computed(() => String(props.visualizationDsl.chart_type ?? 'table'))
const config = computed(() => (props.visualizationDsl.config ?? {}) as Record<string, unknown>)
const layout = computed(() => (props.visualizationDsl.layout ?? {}) as Record<string, unknown>)
const title = computed(() => (typeof layout.value.title === 'string' ? layout.value.title : undefined))
const errorMsg = computed(() => {
  const dslError = props.visualizationDsl.error
  if (typeof dslError === 'string') return dslError
  const cfgError = config.value.error
  return typeof cfgError === 'string' ? cfgError : undefined
})

const boxStats = computed(() =>
  chartType.value === 'box' ? computeBoxStats(config.value, parsed.value) : null,
)

const chartConfig = computed<ChartConfiguration | null>(() => {
  if (chartType.value === 'table' || chartType.value === 'box') return null
  return buildChartConfig(chartType.value, config.value, layout.value, parsed.value)
})

function renderChart() {
  chartInstance?.destroy()
  chartInstance = null
  if (chartConfig.value && canvasRef.value) {
    chartInstance = new Chart(canvasRef.value, chartConfig.value)
  }
}

// The template ref isn't bound yet when an `immediate` watcher's callback
// would first run, so render once on mount and re-render on later changes.
onMounted(renderChart)
watch(chartConfig, renderChart, { flush: 'post' })

onBeforeUnmount(() => {
  chartInstance?.destroy()
  chartInstance = null
})
</script>

<template>
  <div v-if="errorMsg" class="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    ⚠️ 可视化生成失败：{{ errorMsg }}
  </div>
  <DataTable v-else-if="chartType === 'box'" :title="title ?? '统计摘要'" :columns="boxStats?.columns ?? []" :rows="boxStats?.rows ?? []" />
  <DataTable v-else-if="!chartConfig" :title="title" :columns="parsed.columns" :rows="parsed.rows" />
  <div v-else class="mt-2 rounded-lg border border-[var(--color-border)] bg-white p-3">
    <div v-if="title" class="mb-2 text-xs font-medium text-slate-700">{{ title }}</div>
    <div class="relative h-64 w-full">
      <canvas ref="canvasRef"></canvas>
    </div>
  </div>
</template>
