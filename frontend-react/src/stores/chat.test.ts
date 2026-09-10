import { describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/types/stream'
import { applyStreamEvent } from './chatEvents'

function makeAssistant(): ChatMessage {
  return { id: 'a1', role: 'assistant', content: '', thinking: '', steps: [] }
}

describe('applyStreamEvent', () => {
  it('appends step events to steps', () => {
    const assistant = makeAssistant()
    applyStreamEvent(assistant, { type: 'step', kind: 'sql', level: 1, label: '查询', text: 'SELECT 1' })
    expect(assistant.steps).toHaveLength(1)
    expect(assistant.steps[0]).toMatchObject({ kind: 'sql', level: 1, label: '查询', text: 'SELECT 1' })
  })

  it('captures the step data payload (e.g. visualization_dsl)', () => {
    const assistant = makeAssistant()
    applyStreamEvent(assistant, {
      type: 'step',
      kind: 'visualization',
      level: 1,
      label: '图表',
      text: '📊 Generated visualization',
      data: { visualization_dsl: { chart_type: 'bar' }, data: 'a,b\n1,2' },
    })
    expect(assistant.steps[0].data).toEqual({ visualization_dsl: { chart_type: 'bar' }, data: 'a,b\n1,2' })
  })

  it('routes token with is_final=false to thinking', () => {
    const assistant = makeAssistant()
    applyStreamEvent(assistant, { type: 'token', level: 0, label: '', is_final: false, text: 'reasoning…' })
    expect(assistant.thinking).toBe('reasoning…')
    expect(assistant.content).toBe('')
  })

  it('routes token with is_final missing/true to content', () => {
    const assistant = makeAssistant()
    applyStreamEvent(assistant, { type: 'token', level: 0, label: '', is_final: true, text: 'hello ' })
    applyStreamEvent(assistant, { type: 'token', level: 0, label: '', is_final: true, text: 'world' })
    expect(assistant.content).toBe('hello world')
    expect(assistant.thinking).toBe('')
  })

  it('final_answer overwrites content when non-empty', () => {
    const assistant = makeAssistant()
    assistant.content = 'partial'
    applyStreamEvent(assistant, { type: 'final_answer', text: '最终答案' })
    expect(assistant.content).toBe('最终答案')
  })

  it('final_answer with empty text does not clear existing content', () => {
    const assistant = makeAssistant()
    assistant.content = 'kept'
    applyStreamEvent(assistant, { type: 'final_answer', text: '' })
    expect(assistant.content).toBe('kept')
  })
})
