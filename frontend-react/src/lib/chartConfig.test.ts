import { describe, expect, it } from 'vitest'

import { buildChartConfig, computeBoxStats } from './chartConfig'
import { parseCsv } from './csv'

describe('buildChartConfig', () => {
  it('builds a bar chart config from x/y columns', () => {
    const parsed = parseCsv('category,revenue\nA,10\nB,20')
    const cfg = buildChartConfig('bar', { x: 'category', y: 'revenue' }, {}, parsed)
    expect(cfg?.type).toBe('bar')
    expect(cfg?.data.labels).toEqual(['A', 'B'])
    expect(cfg?.data.datasets).toHaveLength(1)
    expect(cfg?.data.datasets[0].data).toEqual([10, 20])
  })

  it('builds a multi-series line chart when y is an array', () => {
    const parsed = parseCsv('month,a,b\nJan,1,2\nFeb,3,4')
    const cfg = buildChartConfig('line', { x: 'month', y: ['a', 'b'] }, {}, parsed)
    expect(cfg?.type).toBe('line')
    expect(cfg?.data.datasets).toHaveLength(2)
    expect(cfg?.data.datasets.map((d) => d.label)).toEqual(['a', 'b'])
  })

  it('builds a pie chart from labels/values config', () => {
    const parsed = parseCsv('channel,share\nOnline,60\nStore,40')
    const cfg = buildChartConfig('pie', { labels: 'channel', values: 'share' }, {}, parsed)
    expect(cfg?.type).toBe('pie')
    expect(cfg?.data.labels).toEqual(['Online', 'Store'])
    expect(cfg?.data.datasets[0].data).toEqual([60, 40])
  })

  it('builds a scatter chart from x/y numeric columns', () => {
    const parsed = parseCsv('x,y\n1,2\n3,4')
    const cfg = buildChartConfig('scatter', { x: 'x', y: 'y' }, {}, parsed)
    expect(cfg?.type).toBe('scatter')
    expect(cfg?.data.datasets[0].data).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
  })

  it('bins a histogram into the requested number of buckets', () => {
    const parsed = parseCsv('v\n1\n2\n3\n4\n5\n6\n7\n8\n9\n10')
    const cfg = buildChartConfig('histogram', { x: 'v', nbins: 5 }, {}, parsed)
    expect(cfg).not.toBeNull()
    expect(cfg?.type).toBe('bar')
    expect(cfg?.data.labels).toHaveLength(5)
    const total = ((cfg?.data.datasets[0].data ?? []) as number[]).reduce((a, b) => a + b, 0)
    expect(total).toBe(10)
  })

  it('returns null for unsupported chart types (e.g. table/box)', () => {
    const parsed = parseCsv('a,b\n1,2')
    expect(buildChartConfig('table', {}, {}, parsed)).toBeNull()
    expect(buildChartConfig('box', {}, {}, parsed)).toBeNull()
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
