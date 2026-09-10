import { Chart, type ChartConfiguration } from 'chart.js/auto'
import { useEffect, useMemo, useRef } from 'react'

import { buildChartConfig, computeBoxStats } from '@/lib/chartConfig'
import { parseCsv } from '@/lib/csv'
import DataTable from './DataTable'

function CanvasChart({ config }: { config: ChartConfiguration }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current = new Chart(canvasRef.current, config)
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  return (
    <div className="relative h-64 w-full">
      <canvas ref={canvasRef} />
    </div>
  )
}

/** Renders a `visualization_dsl` (see `openchatbi/text2sql/visualization.py`) + CSV data as a chart or data table. */
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

  const chartConfig = useMemo(
    () => (chartType === 'table' || chartType === 'box' ? null : buildChartConfig(chartType, config, layout, parsed)),
    [chartType, config, layout, parsed],
  )

  if (errorMsg) {
    return (
      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
        ⚠️ 可视化生成失败：{errorMsg}
      </div>
    )
  }

  if (chartType === 'box') {
    const stats = computeBoxStats(config, parsed)
    return <DataTable title={title ?? '统计摘要'} columns={stats.columns} rows={stats.rows} />
  }

  if (!chartConfig) {
    return <DataTable title={title} columns={parsed.columns} rows={parsed.rows} />
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-white p-3">
      {title && <div className="mb-2 text-xs font-medium text-slate-700">{title}</div>}
      <CanvasChart config={chartConfig} />
    </div>
  )
}
