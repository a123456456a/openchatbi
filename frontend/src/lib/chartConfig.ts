import type { ChartConfiguration, ChartOptions } from 'chart.js'

import { toNumber, type ParsedCsv } from './csv'

export const CHART_PALETTE = [
  '#1e40af',
  '#d97706',
  '#0f766e',
  '#db2777',
  '#7c3aed',
  '#059669',
  '#dc2626',
  '#0891b2',
]

export function colorAt(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length]
}

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`
}

function baseOptions(xTitle?: string, yTitle?: string, showLegend?: boolean): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: !!showLegend, position: 'top' },
    },
    scales: {
      x: { title: { display: !!xTitle, text: xTitle ?? '' } },
      y: { title: { display: !!yTitle, text: yTitle ?? '' } },
    },
  }
}

/**
 * Build a Chart.js configuration from the backend's `visualization_dsl`
 * (see `openchatbi/text2sql/visualization.py`) plus the parsed CSV rows for
 * the chart types Chart.js can render natively. Returns `null` for chart
 * types that need a different presentation (e.g. `table`, `box`) so callers
 * can fall back to a data table.
 */
export function buildChartConfig(
  chartType: string,
  config: Record<string, unknown>,
  layout: Record<string, unknown>,
  parsed: ParsedCsv,
): ChartConfiguration | null {
  const xTitle = typeof layout.xaxis_title === 'string' ? layout.xaxis_title : undefined
  const yTitle = typeof layout.yaxis_title === 'string' ? layout.yaxis_title : undefined

  if (parsed.rows.length === 0) return null

  switch (chartType) {
    case 'line':
    case 'bar': {
      const xCol = String(config.x ?? parsed.columns[0] ?? '')
      const yRaw = config.y
      const yCols = Array.isArray(yRaw) ? yRaw.map(String) : yRaw != null ? [String(yRaw)] : []
      if (!xCol || yCols.length === 0) return null
      const labels = parsed.rows.map((r) => r[xCol] ?? '')
      const datasets = yCols.map((col, i) => ({
        label: col,
        data: parsed.rows.map((r) => toNumber(r[col])),
        borderColor: colorAt(i),
        backgroundColor: chartType === 'line' ? withAlpha(colorAt(i), '33') : withAlpha(colorAt(i), 'cc'),
        tension: chartType === 'line' ? 0.3 : 0,
        fill: false,
      }))
      return {
        type: chartType,
        data: { labels, datasets },
        options: baseOptions(xTitle ?? xCol, yTitle, yCols.length > 1),
      }
    }

    case 'pie': {
      const labelsCol = String(config.labels ?? parsed.columns[0] ?? '')
      const valuesCol = String(config.values ?? parsed.columns[1] ?? '')
      if (!labelsCol || !valuesCol) return null
      const labels = parsed.rows.map((r) => r[labelsCol] ?? '')
      const data = parsed.rows.map((r) => toNumber(r[valuesCol]))
      return {
        type: 'pie',
        data: {
          labels,
          datasets: [{ data, backgroundColor: labels.map((_, i) => colorAt(i)) }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: true, position: 'right' } },
        },
      }
    }

    case 'scatter': {
      const xCol = String(config.x ?? parsed.columns[0] ?? '')
      const yCol = String(config.y ?? parsed.columns[1] ?? '')
      if (!xCol || !yCol) return null
      const points = parsed.rows
        .map((r) => ({ x: toNumber(r[xCol]), y: toNumber(r[yCol]) }))
        .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y))
      if (points.length === 0) return null
      return {
        type: 'scatter',
        data: {
          datasets: [{ label: `${yCol} vs ${xCol}`, data: points, backgroundColor: colorAt(0) }],
        },
        options: baseOptions(xTitle ?? xCol, yTitle ?? yCol, false),
      }
    }

    case 'histogram': {
      const col = String(config.x ?? parsed.columns[0] ?? '')
      if (!col) return null
      const nbins = typeof config.nbins === 'number' && config.nbins > 0 ? config.nbins : 20
      const values = parsed.rows.map((r) => toNumber(r[col])).filter((v) => !Number.isNaN(v))
      if (values.length === 0) return null
      const min = Math.min(...values)
      const max = Math.max(...values)
      const binWidth = (max - min) / nbins || 1
      const counts = new Array(nbins).fill(0)
      values.forEach((v) => {
        let idx = Math.floor((v - min) / binWidth)
        if (idx >= nbins) idx = nbins - 1
        if (idx < 0) idx = 0
        counts[idx] += 1
      })
      const labels = counts.map((_, i) => {
        const from = min + i * binWidth
        const to = min + (i + 1) * binWidth
        return `${from.toFixed(1)}–${to.toFixed(1)}`
      })
      return {
        type: 'bar',
        data: { labels, datasets: [{ label: `${col} 频次`, data: counts, backgroundColor: colorAt(0) }] },
        options: baseOptions(xTitle ?? col, yTitle ?? '频次', false),
      }
    }

    default:
      return null
  }
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  }
  return sorted[base]
}

function formatStat(n: number): string {
  if (Number.isNaN(n)) return '-'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/**
 * Chart.js has no first-party box-plot chart type; render box-chart DSLs as
 * a summary-statistics table (min / Q1 / median / Q3 / max per group) instead
 * of faking a box plot with mismatched primitives.
 */
export function computeBoxStats(
  config: Record<string, unknown>,
  parsed: ParsedCsv,
): { columns: string[]; rows: Record<string, string>[] } {
  const yCol = String(config.y ?? parsed.columns[parsed.columns.length - 1] ?? '')
  const xCol = config.x ? String(config.x) : undefined
  if (!yCol) return { columns: [], rows: [] }

  const groupCol = xCol ?? '分组'
  const groups = new Map<string, number[]>()
  parsed.rows.forEach((r) => {
    const key = xCol ? r[xCol] ?? '' : '全部'
    const v = toNumber(r[yCol])
    if (Number.isNaN(v)) return
    const bucket = groups.get(key)
    if (bucket) bucket.push(v)
    else groups.set(key, [v])
  })

  const columns = [groupCol, '样本数', '最小值', 'Q1', '中位数', 'Q3', '最大值']
  const rows: Record<string, string>[] = []
  for (const [key, rawValues] of groups) {
    const values = [...rawValues].sort((a, b) => a - b)
    rows.push({
      [groupCol]: key,
      样本数: String(values.length),
      最小值: formatStat(quantile(values, 0)),
      Q1: formatStat(quantile(values, 0.25)),
      中位数: formatStat(quantile(values, 0.5)),
      Q3: formatStat(quantile(values, 0.75)),
      最大值: formatStat(quantile(values, 1)),
    })
  }
  return { columns, rows }
}
