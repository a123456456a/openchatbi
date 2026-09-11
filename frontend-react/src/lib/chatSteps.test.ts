import { describe, expect, it } from 'vitest'

import type { ChatStep } from '@/types/stream'
import {
  assistantCopyText,
  formatToolBody,
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

  describe('formatToolBody', () => {
    it('pretty-prints and fences JSON-object tool results as a code block', () => {
      const step: ChatStep = {
        id: 't',
        kind: 'tool_result',
        level: 0,
        label: 'main',
        text: 'preview',
        data: { tool: 'search_schema', result: '{"candidates":[{"table":"orders","match_reason":"x_y"}]}' },
      }
      const body = formatToolBody(step)
      expect(body.startsWith('```json\n')).toBe(true)
      expect(body.endsWith('\n```')).toBe(true)
      // Pretty-printed (multi-line), and underscores in field values are preserved verbatim
      // instead of being interpreted as markdown emphasis.
      expect(body).toContain('"match_reason": "x_y"')
      expect(body.split('\n').length).toBeGreaterThan(3)
    })

    it('still fences JSON-looking payloads that are not strictly valid JSON (e.g. Python repr)', () => {
      const body = formatToolBody(mixed[4])
      expect(body).toBe("```json\n[{'total': 1234}]\n```")
    })

    it('leaves non-JSON tool text (e.g. business knowledge prose) as plain markdown', () => {
      const step: ChatStep = {
        id: 't',
        kind: 'tool_result',
        level: 0,
        label: 'main',
        text: 'preview',
        data: { tool: 'search_knowledge', result: '# Business glossary\n- GMV: gross merchandise value' },
      }
      expect(formatToolBody(step)).toBe('# Business glossary\n- GMV: gross merchandise value')
    })

    it('truncates very large tool results so a single payload cannot bloat the page', () => {
      const huge = JSON.stringify({ candidates: Array.from({ length: 500 }, (_, i) => ({ table: `t${i}` })) })
      const step: ChatStep = {
        id: 't',
        kind: 'tool_result',
        level: 0,
        label: 'main',
        text: 'preview',
        data: { tool: 'search_schema', result: huge },
      }
      const body = formatToolBody(step)
      expect(body.length).toBeLessThan(huge.length)
      expect(body).toContain('已截断')
    })
  })
})
