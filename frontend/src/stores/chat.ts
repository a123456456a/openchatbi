import { defineStore } from 'pinia'
import { ref } from 'vue'

import { streamChat } from '../api/chat'
import type { ChatMessage, ChatStep, StreamEvent } from '../types/stream'
import { useSettingsStore } from './settings'
import { useSessionsStore } from './sessions'

function uid() {
  return crypto.randomUUID()
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([])
  const streaming = ref(false)
  const lastInterrupt = ref<{ text: string; buttons: unknown[] } | null>(null)
  const error = ref<string | null>(null)
  let abort: AbortController | null = null

  function clear() {
    messages.value = []
    lastInterrupt.value = null
    error.value = null
  }

  async function send(sessionId: string, input: string) {
    if (!input.trim() || streaming.value) return

    const sessions = useSessionsStore()
    const settings = useSettingsStore()
    const provider = settings.chatProvider()
    sessions.ensure(sessionId)
    sessions.upsert(sessionId, input.trim().slice(0, 40))

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: input.trim(),
      steps: [],
    }
    messages.value.push(userMsg)

    const assistant: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      steps: [],
      streaming: true,
    }
    messages.value.push(assistant)
    streaming.value = true
    error.value = null
    lastInterrupt.value = null
    abort = new AbortController()

    const applyEvent = (event: StreamEvent) => {
      if (event.type === 'step') {
        const step: ChatStep = {
          id: uid(),
          kind: String(event.kind ?? ''),
          level: Number(event.level ?? 0),
          label: String(event.label ?? ''),
          text: String(event.text ?? ''),
        }
        assistant.steps.push(step)
      } else if (event.type === 'token') {
        assistant.content += String(event.text ?? '')
      } else if (event.type === 'final_answer') {
        const text = String(event.text ?? '')
        if (text) assistant.content = text
      } else if (event.type === 'interrupt') {
        lastInterrupt.value = {
          text: String(event.text ?? ''),
          buttons: Array.isArray(event.buttons) ? event.buttons : [],
        }
      }
    }

    try {
      await streamChat(
        {
          input: input.trim(),
          session_id: sessionId,
          provider,
          mode: 'events',
        },
        applyEvent,
        abort.signal,
      )
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      error.value = e instanceof Error ? e.message : String(e)
      if (!assistant.content) {
        assistant.content = `错误：${error.value}`
      }
    } finally {
      assistant.streaming = false
      streaming.value = false
      abort = null
    }
  }

  function stop() {
    abort?.abort()
  }

  return {
    messages,
    streaming,
    lastInterrupt,
    error,
    clear,
    send,
    stop,
  }
})
