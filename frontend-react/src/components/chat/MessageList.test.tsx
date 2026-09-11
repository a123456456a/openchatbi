import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ChatMessage, ChatStep } from '@/types/stream'
import MessageList from './MessageList'

// jsdom has no canvas 2D context, so ECharts can't actually paint in tests; stub the chart
// widget here (chart building/rendering logic itself is covered by chartConfig.test.ts).
vi.mock('./ChartView', () => ({
  default: ({ visualizationDsl }: { visualizationDsl: Record<string, unknown> }) => (
    <div data-testid="chart-view">{(visualizationDsl.layout as { title?: string } | undefined)?.title}</div>
  ),
}))

function step(partial: Partial<ChatStep> & Pick<ChatStep, 'id' | 'kind'>): ChatStep {
  return {
    id: partial.id,
    kind: partial.kind,
    level: partial.level ?? 0,
    label: partial.label ?? partial.kind,
    text: partial.text ?? '',
    data: partial.data,
  }
}

describe('MessageList tool body', () => {
  it('shows only the final answer body: no thinking, no process/tool-call panels', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: '订单总数是 1234',
        thinking: '先查一下',
        steps: [
          step({ id: 'call', kind: 'tool_call', text: 'Using tool: text2sql' }),
          step({ id: 'sql1', kind: 'sql', label: '生成 SQL', text: 'SELECT COUNT(*)' }),
          step({
            id: 't1',
            kind: 'tool_result',
            text: '📤 truncated …(truncated)',
            data: { tool: 'text2sql', result: "[{'total': 1234}]" },
          }),
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    // Final answer body is shown.
    expect(screen.getByText('订单总数是 1234')).toBeVisible()

    // Thinking, intermediate process steps (SQL, tool-call invocations), and the raw
    // text2sql tool payload are not rendered — the query results are already shown
    // via the dedicated visualization/chart step, and the raw dump is just clutter.
    expect(screen.queryByText('先查一下')).not.toBeInTheDocument()
    expect(screen.queryByText('SELECT COUNT(*)')).not.toBeInTheDocument()
    expect(screen.queryByText('Using tool: text2sql')).not.toBeInTheDocument()
    expect(screen.queryByText("[{'total': 1234}]")).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /生成 SQL/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^text2sql$/ })).not.toBeInTheDocument()
  })

  it('still shows a non-text2sql tool result inline (not suppressed)', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a4',
        role: 'assistant',
        content: '已完成分析',
        thinking: '',
        steps: [
          step({
            id: 't3',
            kind: 'tool_result',
            text: 'preview',
            data: { tool: 'search_knowledge', result: '{"columns": []}' },
          }),
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('{"columns": []}')).toBeVisible()
  })

  it('still shows a text2sql tool error inline (only the successful raw result is suppressed)', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a5',
        role: 'assistant',
        content: '出错了',
        thinking: '',
        steps: [
          step({
            id: 't4',
            kind: 'tool_error',
            text: 'preview',
            data: { tool: 'text2sql', error: 'Error occurred when calling Text2SQL tool.' },
          }),
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('Error occurred when calling Text2SQL tool.')).toBeVisible()
  })

  it('renders a visualization step as an inline chart, not inside the collapsed process panel', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a2',
        role: 'assistant',
        content: '这是按地区的销售额',
        thinking: '',
        steps: [
          step({
            id: 'v1',
            kind: 'visualization',
            text: '📊 Generated visualization',
            data: {
              visualization_dsl: { chart_type: 'bar', config: { x: 'region', y: 'revenue' }, layout: { title: '销售额' } },
              data: 'region,revenue\nEast,10\nWest,20',
            },
          }),
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('这是按地区的销售额')).toBeVisible()
    expect(screen.getByText('销售额')).toBeVisible()
    // The chart is inline in the body, not tucked away inside a "过程" collapse trigger.
    expect(screen.queryByRole('button', { name: /Generated visualization/ })).not.toBeInTheDocument()
  })

  it('renders a save_report tool result as an inline download card, not a raw link', () => {
    const messages: ChatMessage[] = [
      {
        id: 'a3',
        role: 'assistant',
        content: '报告已生成',
        thinking: '',
        steps: [
          step({
            id: 't2',
            kind: 'tool_result',
            text: 'preview',
            data: {
              tool: 'save_report',
              result: 'Report saved successfully! Download link: /api/download/report/20260101_Sales.docx',
            },
          }),
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    expect(screen.getByText('20260101_Sales.docx')).toBeVisible()
    expect(screen.getByText(/Word 文档/)).toBeVisible()
    expect(screen.getByRole('button', { name: /下载/ })).toBeVisible()
    expect(screen.queryByText(/Download link:/)).not.toBeInTheDocument()
    // Already shown as a card in the body, so it shouldn't be duplicated in the bottom tool panel.
    expect(screen.queryByRole('button', { name: /save_report/ })).not.toBeInTheDocument()
  })
})
