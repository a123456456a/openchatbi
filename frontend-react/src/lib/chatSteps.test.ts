import { describe, expect, it } from 'vitest'

import type { ChatStep } from '@/types/stream'
import {
  assistantCopyText,
  processSteps,
  stepTitle,
  toolBodyText,
  toolSteps,
} from './chatSteps'

function step(partial: Partial<ChatStep> & Pick<ChatStep, 'kind'>): ChatStep {
  return {
    id: partial.id ?? partial.kind,
    kind: partial.kind,
    level: partial.level ?? 0,
    label: partial.label ?? 'main',
    text: partial.text ?? '',
    data: partial.data,
  }
}

describe('chatSteps', () => {
  const mixed: ChatStep[] = [
    step({ kind: 'tool', text: 'Using tools: text2sql' }),
    step({ kind: 'tool_call', text: 'Using tool: search_schema' }),
    step({ kind: 'sub_agent', text: 'Running sub agent' }),
    step({ kind: 'sql', text: 'SELECT 1', label: '查询' }),
    step({
      kind: 'tool_result',
      text: '📤 Tool `text2sql` result：truncated …(truncated)',
      data: { tool: 'text2sql', result: "[{'total': 1234}]" },
    }),
    step({
      kind: 'tool_error',
      text: '❌ Tool `search_schema` failed: boom',
      data: { tool: 'search_schema', error: 'full error payload' },
    }),
  ]

  it('hides invocation-only steps and splits process vs tool outcomes', () => {
    expect(processSteps(mixed).map((s) => s.kind)).toEqual(['sql'])
    expect(toolSteps(mixed).map((s) => s.kind)).toEqual(['tool_result', 'tool_error'])
  })

  it('prefers the full tool payload over the truncated preview', () => {
    expect(toolBodyText(mixed[4])).toBe("[{'total': 1234}]")
    expect(toolBodyText(mixed[5])).toBe('full error payload')
  })

  it('falls back to step.text when data has no result/error', () => {
    expect(toolBodyText(step({ kind: 'tool_result', text: 'preview only' }))).toBe('preview only')
  })

  it('titles tool steps with the tool name', () => {
    expect(stepTitle(mixed[4])).toBe('text2sql')
    expect(stepTitle(mixed[5])).toBe('search_schema 失败')
    expect(stepTitle(mixed[3])).toBe('查询')
  })

  it('includes tool bodies in the copyable answer text', () => {
    expect(assistantCopyText('最终答案', mixed)).toBe(
      "最终答案\n\n[{'total': 1234}]\n\nfull error payload",
    )
    expect(assistantCopyText('', [mixed[4]])).toBe("[{'total': 1234}]")
  })
})
