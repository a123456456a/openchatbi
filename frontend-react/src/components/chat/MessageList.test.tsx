import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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
  afterEach(() => {
    cleanup()
  })

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

    // Thinking and intermediate process steps (SQL, tool-call invocations) are not rendered.
    expect(screen.queryByText('先查一下')).not.toBeInTheDocument()
    expect(screen.queryByText('SELECT COUNT(*)')).not.toBeInTheDocument()
    expect(screen.queryByText('Using tool: text2sql')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /生成 SQL/ })).not.toBeInTheDocument()

    // The raw tool result is never dumped directly into the page: it's tucked behind a
    // collapsed panel that the user has to explicitly open, and rendered as a code block.
    expect(document.querySelector('pre code')).toBeNull()
    const toolButton = screen.getByRole('button', { name: /^text2sql$/ })
    expect(toolButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toolButton)
    expect(document.querySelector('pre code')?.textContent).toBe("[{'total': 1234}]\n")
  })

  it('formats a JSON-shaped tool result as a fenced, pretty-printed code block instead of raw prose', () => {
    const payload = { candidates: [{ table: 'orders', match_reason: 'orders matches 1 relevant column(s)' }] }
    const messages: ChatMessage[] = [
      {
        id: 'a4',
        role: 'assistant',
        content: '已找到相关表',
        thinking: '',
        steps: [
          step({
            id: 't3',
            kind: 'tool_result',
            text: 'preview',
            data: { tool: 'search_schema', result: JSON.stringify(payload) },
          }),
        ],
      },
    ]

    render(<MessageList messages={messages} />)

    // The raw single-line JSON string is never shown verbatim on the page.
    expect(screen.queryByText(JSON.stringify(payload))).not.toBeInTheDocument()
    expect(document.querySelector('pre code')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /search_schema/ }))

    // Once expanded, it renders as a pretty-printed code block (not mangled markdown prose).
    const codeBlock = document.querySelector('pre code')
    expect(codeBlock).not.toBeNull()
    expect(codeBlock?.textContent).toContain('"match_reason"')
    expect(codeBlock?.textContent).toContain('"orders"')
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
