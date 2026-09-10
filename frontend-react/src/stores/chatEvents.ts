import type { ChatMessage, ChatStep, StreamEvent } from '@/types/stream'

function uid() {
  return crypto.randomUUID()
}

/**
 * Mutates `assistant` in place with the effect of `event` (mirrors the
 * mutable-update pattern used by the Vue store's reactive array entry).
 * `interrupt` is handled separately by the store (it targets top-level
 * store state, not the assistant message).
 */
export function applyStreamEvent(assistant: ChatMessage, event: StreamEvent): void {
  if (event.type === 'step') {
    const step: ChatStep = {
      id: uid(),
      kind: String(event.kind ?? ''),
      level: Number(event.level ?? 0),
      label: String(event.label ?? ''),
      text: String(event.text ?? ''),
      data:
        event.data && typeof event.data === 'object' ? (event.data as Record<string, unknown>) : undefined,
    }
    assistant.steps.push(step)
  } else if (event.type === 'token') {
    const text = String(event.text ?? '')
    if (event.is_final === false) {
      assistant.thinking += text
    } else {
      assistant.content += text
    }
  } else if (event.type === 'final_answer') {
    const text = String(event.text ?? '')
    if (text) assistant.content = text
  }
}
