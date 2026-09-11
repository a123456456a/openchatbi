<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import echarts, { type ECharts } from '../../lib/echartsSetup'

import DataTable from '../common/DataTable.vue'
import { buildChartConfig } from '../../lib/chartConfig'
import { parseCsv } from '../../lib/csv'

const props = defineProps<{
  visualizationDsl: Record<string, unknown>
  csvData?: string
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: ECharts | null = null
let resizeObserver: ResizeObserver | null = null

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

const chartOption = computed(() => {
  if (chartType.value === 'table') return null
  return buildChartConfig(chartType.value, config.value, layout.value, parsed.value)
})

function renderChart() {
  if (!chartOption.value) return
  if (!chartInstance && chartRef.value) {
    chartInstance = echarts.init(chartRef.value)
    resizeObserver = new ResizeObserver(() => chartInstance?.resize())
    resizeObserver.observe(chartRef.value)
  }
  chartInstance?.setOption(chartOption.value, true)
}

onMounted(renderChart)
watch(chartOption, renderChart, { flush: 'post' })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<template>
  <div v-if="errorMsg" class="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    ⚠️ 可视化生成失败：{{ errorMsg }}
  </div>
  <DataTable v-else-if="!chartOption" :title="title" :columns="parsed.columns" :rows="parsed.rows" />
  <div v-else class="mt-2 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-card)]">
    <div v-if="title" class="mb-2 text-xs font-medium text-slate-700">{{ title }}</div>
    <div ref="chartRef" class="h-72 w-full"></div>
  </div>
</template>
