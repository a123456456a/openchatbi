import type { EChartsOption } from '@/lib/echartsSetup'
import { toNumber, type ParsedCsv } from '@/lib/csv'

export const CHART_PALETTE = ['#1e40af', '#d97706', '#0f766e', '#db2777', '#7c3aed', '#059669', '#dc2626', '#0891b2']

export function colorAt(i: number): string {
  return CHART_PALETTE[i % CHART_PALETTE.length]
}

function baseGrid() {
  return { left: 48, right: 24, top: 48, bottom: 40, containLabel: true }
}

function axisTitleOpt(title?: string) {
  return title ? { name: title, nameLocation: 'middle' as const, nameGap: 28 } : {}
}

/**
 * Build an ECharts `option` from the backend's `visualization_dsl`
 * (see `openchatbi/text2sql/visualization.py`) plus the parsed CSV rows for
 * the chart types ECharts can render natively. Returns `null` for chart
 * types that need a different presentation (currently only `table`) so
 * callers can fall back to a data table.
 */
export function buildChartConfig(
  chartType: string,
  config: Record<string, unknown>,
  layout: Record<string, unknown>,
  parsed: ParsedCsv,
): EChartsOption | null {
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
      const categories = parsed.rows.map((r) => r[xCol] ?? '')
      return {
        color: CHART_PALETTE,
        grid: baseGrid(),
        tooltip: { trigger: 'axis' },
        legend: yCols.length > 1 ? { top: 0 } : undefined,
        xAxis: { type: 'category', data: categories, ...axisTitleOpt(xTitle ?? xCol) },
        yAxis: { type: 'value', ...axisTitleOpt(yTitle) },
        series: yCols.map((col) => ({
          name: col,
          type: chartType,
          data: parsed.rows.map((r) => toNumber(r[col])),
          smooth: chartType === 'line',
          areaStyle: chartType === 'line' ? { opacity: 0.12 } : undefined,
        })),
      }
    }

    case 'pie': {
      const labelsCol = String(config.labels ?? parsed.columns[0] ?? '')
      const valuesCol = String(config.values ?? parsed.columns[1] ?? '')
      if (!labelsCol || !valuesCol) return null
      return {
        color: CHART_PALETTE,
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', right: 8, top: 'middle' },
        series: [
          {
            type: 'pie',
            radius: ['35%', '70%'],
            center: ['40%', '50%'],
            data: parsed.rows.map((r) => ({ name: r[labelsCol] ?? '', value: toNumber(r[valuesCol]) })),
            label: { formatter: '{b}: {d}%' },
          },
        ],
      }
    }

    case 'scatter': {
      const xCol = String(config.x ?? parsed.columns[0] ?? '')
      const yCol = String(config.y ?? parsed.columns[1] ?? '')
      if (!xCol || !yCol) return null
      const points = parsed.rows
        .map((r) => [toNumber(r[xCol]), toNumber(r[yCol])])
        .filter(([x, y]) => !Number.isNaN(x) && !Number.isNaN(y))
      if (points.length === 0) return null
      return {
        color: CHART_PALETTE,
        grid: baseGrid(),
        tooltip: { trigger: 'item' },
        xAxis: { type: 'value', ...axisTitleOpt(xTitle ?? xCol) },
        yAxis: { type: 'value', ...axisTitleOpt(yTitle ?? yCol) },
        series: [{ name: `${yCol} vs ${xCol}`, type: 'scatter', data: points, symbolSize: 8 }],
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
        color: CHART_PALETTE,
        grid: baseGrid(),
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: labels, ...axisTitleOpt(xTitle ?? col) },
        yAxis: { type: 'value', ...axisTitleOpt(yTitle ?? '频次') },
        series: [{ name: `${col} 频次`, type: 'bar', data: counts }],
      }
    }

    case 'box': {
      const yCol = String(config.y ?? parsed.columns[parsed.columns.length - 1] ?? '')
      const xCol = config.x ? String(config.x) : undefined
      if (!yCol) return null
      const groups = new Map<string, number[]>()
      parsed.rows.forEach((r) => {
        const key = xCol ? r[xCol] ?? '' : '全部'
        const v = toNumber(r[yCol])
        if (Number.isNaN(v)) return
        const bucket = groups.get(key)
        if (bucket) bucket.push(v)
        else groups.set(key, [v])
      })
      if (groups.size === 0) return null
      const categories = [...groups.keys()]
      const data = categories.map((key) => boxplotStats([...(groups.get(key) ?? [])].sort((a, b) => a - b)))
      return {
        color: CHART_PALETTE,
        grid: baseGrid(),
        tooltip: { trigger: 'item' },
        xAxis: { type: 'category', data: categories, ...axisTitleOpt(xTitle ?? xCol) },
        yAxis: { type: 'value', ...axisTitleOpt(yTitle ?? yCol) },
        series: [{ name: yCol, type: 'boxplot', data }],
      }
    }

    case 'heatmap': {
      const xCol = String(config.x ?? parsed.columns[0] ?? '')
      const yCol = String(config.y ?? parsed.columns[1] ?? '')
      const valueCol = String(config.z ?? config.value ?? parsed.columns[2] ?? '')
      if (!xCol || !yCol || !valueCol) return null
      const xCats = [...new Set(parsed.rows.map((r) => r[xCol] ?? ''))]
      const yCats = [...new Set(parsed.rows.map((r) => r[yCol] ?? ''))]
      const data = parsed.rows.map((r) => [
        xCats.indexOf(r[xCol] ?? ''),
        yCats.indexOf(r[yCol] ?? ''),
        toNumber(r[valueCol]),
      ])
      const values = data.map((d) => d[2]).filter((v) => !Number.isNaN(v))
      return {
        grid: baseGrid(),
        tooltip: { position: 'top' },
        xAxis: { type: 'category', data: xCats, splitArea: { show: true }, ...axisTitleOpt(xTitle ?? xCol) },
        yAxis: { type: 'category', data: yCats, splitArea: { show: true }, ...axisTitleOpt(yTitle ?? yCol) },
        visualMap: {
          min: values.length ? Math.min(...values) : 0,
          max: values.length ? Math.max(...values) : 1,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
        },
        series: [{ name: valueCol, type: 'heatmap', data, label: { show: true } }],
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

/** `[min, Q1, median, Q3, max]` — the shape ECharts' `boxplot` series expects per category. */
function boxplotStats(sortedValues: number[]): [number, number, number, number, number] {
  return [
    quantile(sortedValues, 0),
    quantile(sortedValues, 0.25),
    quantile(sortedValues, 0.5),
    quantile(sortedValues, 0.75),
    quantile(sortedValues, 1),
  ]
}

function formatStat(n: number): string {
  if (Number.isNaN(n)) return '-'
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

/** Summary-statistics table (min / Q1 / median / Q3 / max per group) — used as a "view as table" fallback. */
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
