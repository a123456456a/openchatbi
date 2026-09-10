import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ChatMessage, ChatStep } from '@/types/stream'
import MessageList from './MessageList'

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
  it('shows full tool results in the answer body and collapses the tool panel', () => {
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

    expect(screen.getByText('订单总数是 1234')).toBeVisible()
    expect(screen.getByText("[{'total': 1234}]")).toBeVisible()
    expect(screen.getByText('SELECT COUNT(*)')).toBeVisible()
    expect(screen.queryByText('Using tool: text2sql')).not.toBeInTheDocument()

    expect(screen.getByRole('button', { name: /生成 SQL/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^text2sql$/ })).toHaveAttribute('aria-expanded', 'false')
  })
})
