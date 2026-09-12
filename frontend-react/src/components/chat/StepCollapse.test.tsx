import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ChatStep } from '@/types/stream'
import StepCollapse from './StepCollapse'

function step(partial: Partial<ChatStep> & Pick<ChatStep, 'id' | 'kind'>): ChatStep {
  return {
    id: partial.id,
    kind: partial.kind,
    level: partial.level ?? 0,
    label: partial.label ?? partial.kind,
    text: partial.text ?? `${partial.kind} body`,
    data: partial.data,
  }
}

describe('StepCollapse', () => {
  it('expands process steps by default', async () => {
    render(
      <StepCollapse
        steps={[step({ id: 'sql1', kind: 'sql', label: '生成 SQL', text: 'SELECT 1' })]}
      />,
    )
    expect(await screen.findByText('SELECT 1')).toBeVisible()
    expect(screen.getByRole('button', { name: /生成 SQL/ })).toHaveAttribute('aria-expanded', 'true')
  })

  it('keeps tool steps collapsed when defaultOpen is false, without rendering the body', () => {
    render(
      <StepCollapse
        defaultOpen={false}
        steps={[
          step({
            id: 't1',
            kind: 'tool_result',
            text: 'preview',
            data: { tool: 'text2sql', result: "[{'total': 1234}]" },
          }),
        ]}
      />,
    )
    expect(screen.getByRole('button', { name: /text2sql/ })).toHaveAttribute('aria-expanded', 'false')
    // Collapsed content isn't mounted at all, so the raw payload never hits the DOM (or the
    // markdown pipeline) until the user opens the panel.
    expect(screen.queryByText("[{'total': 1234}]")).not.toBeInTheDocument()
  })
})
