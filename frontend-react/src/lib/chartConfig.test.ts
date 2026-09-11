import { describe, expect, it } from 'vitest'

import { buildChartConfig, computeBoxStats } from './chartConfig'
import { parseCsv } from './csv'

// EChartsOption shapes: `series` items carry `type`/`data`; category axes carry `data` as labels.
describe('buildChartConfig', () => {
  it('builds a bar chart config from x/y columns', () => {
    const parsed = parseCsv('category,revenue\nA,10\nB,20')
    const cfg = buildChartConfig('bar', { x: 'category', y: 'revenue' }, {}, parsed)
    const series = cfg?.series as Array<{ type: string; data: number[] }>
    expect(series).toHaveLength(1)
    expect(series[0].type).toBe('bar')
    expect(series[0].data).toEqual([10, 20])
    expect((cfg!.xAxis as { data: string[] }).data).toEqual(['A', 'B'])
  })

  it('builds a multi-series line chart when y is an array', () => {
    const parsed = parseCsv('month,a,b\nJan,1,2\nFeb,3,4')
    const cfg = buildChartConfig('line', { x: 'month', y: ['a', 'b'] }, {}, parsed)
    const series = cfg?.series as Array<{ type: string; name: string }>
    expect(series).toHaveLength(2)
    expect(series.map((s) => s.type)).toEqual(['line', 'line'])
    expect(series.map((s) => s.name)).toEqual(['a', 'b'])
  })

  it('builds a pie chart from labels/values config', () => {
    const parsed = parseCsv('channel,share\nOnline,60\nStore,40')
    const cfg = buildChartConfig('pie', { labels: 'channel', values: 'share' }, {}, parsed)
    const series = cfg?.series as Array<{ type: string; data: Array<{ name: string; value: number }> }>
    expect(series[0].type).toBe('pie')
    expect(series[0].data).toEqual([
      { name: 'Online', value: 60 },
      { name: 'Store', value: 40 },
    ])
  })

  it('builds a scatter chart from x/y numeric columns', () => {
    const parsed = parseCsv('x,y\n1,2\n3,4')
    const cfg = buildChartConfig('scatter', { x: 'x', y: 'y' }, {}, parsed)
    const series = cfg?.series as Array<{ type: string; data: number[][] }>
    expect(series[0].type).toBe('scatter')
    expect(series[0].data).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('bins a histogram into the requested number of buckets', () => {
    const parsed = parseCsv('v\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10')
    const cfg = buildChartConfig('histogram', { x: 'v', nbins: 5 }, {}, parsed)
    expect(cfg).not.toBeNull()
    const series = cfg?.series as Array<{ type: string; data: number[] }>
    expect(series[0].type).toBe('bar')
    expect((cfg!.xAxis as { data: string[] }).data).toHaveLength(5)
    const total = series[0].data.reduce((a, b) => a + b, 0)
    expect(total).toBe(10)
  })

  it('builds a native boxplot series for the "box" chart type', () => {
    const parsed = parseCsv('group,value\nA,1\nA,2\nA,3\nA,4\nB,10\nB,20')
    const cfg = buildChartConfig('box', { x: 'group', y: 'value' }, {}, parsed)
    const series = cfg?.series as Array<{ type: string; data: number[][] }>
    expect(series[0].type).toBe('boxplot')
    expect((cfg!.xAxis as { data: string[] }).data).toEqual(['A', 'B'])
    // [min, Q1, median, Q3, max] for group A
    expect(series[0].data[0]).toEqual([1, 1.75, 2.5, 3.25, 4])
  })

  it('returns null for unsupported chart types (e.g. table)', () => {
    const parsed = parseCsv('a,b\n1,2')
    expect(buildChartConfig('table', {}, {}, parsed)).toBeNull()
  })

  it('returns null when there is no row data', () => {
    const parsed = parseCsv('a,b')
    expect(buildChartConfig('bar', { x: 'a', y: 'b' }, {}, parsed)).toBeNull()
  })
})

describe('computeBoxStats', () => {
  it('computes min/q1/median/q3/max per group', () => {
    const parsed = parseCsv('group,value\nA,1\nA,2\nA,3\nA,4\nB,10\nB,20')
    const stats = computeBoxStats({ x: 'group', y: 'value' }, parsed)
    expect(stats.columns).toEqual(['group', '样本数', '最小值', 'Q1', '中位数', 'Q3', '最大值'])
    const groupA = stats.rows.find((r) => r.group === 'A')
    expect(groupA).toMatchObject({ 样本数: '4', 最小值: '1', 最大值: '4' })
  })

  it('groups everything under "全部" when there is no x column', () => {
    const parsed = parseCsv('value\n1\n2\n3')
    const stats = computeBoxStats({ y: 'value' }, parsed)
    expect(stats.rows).toHaveLength(1)
    expect(stats.rows[0]['分组']).toBe('全部')
  })
})
