import { useEffect, useMemo, useRef } from 'react'

import { buildChartConfig } from '@/lib/chartConfig'
import { parseCsv } from '@/lib/csv'
import echarts, { type ECharts } from '@/lib/echartsSetup'
import DataTable from './DataTable'

function EChartsCanvas({ option }: { option: NonNullable<ReturnType<typeof buildChartConfig>> }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    chartRef.current = echarts.init(containerRef.current)
    const resizeObserver = new ResizeObserver(() => chartRef.current?.resize())
    resizeObserver.observe(containerRef.current)
    return () => {
      resizeObserver.disconnect()
      chartRef.current?.dispose()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={containerRef} className="h-72 w-full" />
}

/** Renders a `visualization_dsl` (see `openchatbi/text2sql/visualization.py`) + CSV data as an ECharts chart or data table. */
export default function ChartView({
  visualizationDsl,
  csvData,
}: {
  visualizationDsl: Record<string, unknown>
  csvData?: string
}) {
  const parsed = useMemo(() => parseCsv(csvData ?? ''), [csvData])
  const chartType = String(visualizationDsl.chart_type ?? 'table')
  const config = useMemo(() => (visualizationDsl.config ?? {}) as Record<string, unknown>, [visualizationDsl])
  const layout = useMemo(() => (visualizationDsl.layout ?? {}) as Record<string, unknown>, [visualizationDsl])
  const title = typeof layout.title === 'string' ? layout.title : undefined
  const errorMsg =
    typeof visualizationDsl.error === 'string'
      ? visualizationDsl.error
      : typeof config.error === 'string'
        ? config.error
        : undefined

  const chartOption = useMemo(
    () => (chartType === 'table' ? null : buildChartConfig(chartType, config, layout, parsed)),
    [chartType, config, layout, parsed],
  )

  if (errorMsg) {
    return (
      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        ⚠️ 可视化生成失败：{errorMsg}
      </div>
    )
  }

  if (!chartOption) {
    return <DataTable title={title} columns={parsed.columns} rows={parsed.rows} />
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-white p-3 shadow-[var(--shadow-card)]">
      {title && <div className="mb-2 text-xs font-medium text-slate-700">{title}</div>}
      <EChartsCanvas option={chartOption} />
    </div>
  )
}
