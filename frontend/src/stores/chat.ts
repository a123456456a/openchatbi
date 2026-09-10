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
  const sessionId = ref<string | null>(null)
  const messages = ref<ChatMessage[]>([])
  const streaming = ref(false)
  const lastInterrupt = ref<{ text: string; buttons: unknown[] } | null>(null)
  const error = ref<string | null>(null)
  let abort: AbortController | null = null

  function stop() {
    abort?.abort()
    abort = null
    streaming.value = false
  }

  function loadSession(id: string) {
    if (sessionId.value === id) return
    if (streaming.value) stop()
    const sessions = useSessionsStore()
    sessionId.value = id
    messages.value = sessions.getMessages(id)
    lastInterrupt.value = null
    error.value = null
    streaming.value = false
  }

  function clear() {
    messages.value = []
    lastInterrupt.value = null
    error.value = null
  }

  async function send(targetSessionId: string, input: string) {
    if (!input.trim() || streaming.value) return

    const sessions = useSessionsStore()
    const settings = useSettingsStore()
    const provider = settings.chatProvider()
    sessions.ensure(targetSessionId)
    sessions.upsert(targetSessionId, input.trim().slice(0, 40))

    const isActive = () => sessionId.value === targetSessionId

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: input.trim(),
      thinking: '',
      steps: [],
    }
    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      thinking: '',
      steps: [],
      streaming: true,
    }

    // Own reference to this session's transcript, independent of whichever
    // session is currently displayed — so a background send (after the user
    // navigates away) keeps writing into the *right* session's history
    // instead of leaking into (or being overwritten by) the active view.
    const baseMessages = isActive() ? messages.value : sessions.getMessages(targetSessionId)
    const localMessages = [...baseMessages, userMsg, assistantMsg]
    sessions.setMessages(targetSessionId, localMessages)

    if (isActive()) {
      messages.value = localMessages
      streaming.value = true
      error.value = null
      lastInterrupt.value = null
    }

    abort = new AbortController()
    const controller = abort

    const applyEvent = (event: StreamEvent) => {
      if (event.type === 'interrupt') {
        if (isActive()) {
          lastInterrupt.value = {
            text: String(event.text ?? ''),
            buttons: Array.isArray(event.buttons) ? event.buttons : [],
          }
        }
        return
      }
      if (event.type === 'step') {
        const step: ChatStep = {
          id: uid(),
          kind: String(event.kind ?? ''),
          level: Number(event.level ?? 0),
          label: String(event.label ?? ''),
          text: String(event.text ?? ''),
        }
        assistantMsg.steps.push(step)
      } else if (event.type === 'token') {
        const text = String(event.text ?? '')
        if (event.is_final === false) {
          assistantMsg.thinking += text
        } else {
          assistantMsg.content += text
        }
      } else if (event.type === 'final_answer') {
        const text = String(event.text ?? '')
        if (text) assistantMsg.content = text
      }
      sessions.setMessages(targetSessionId, localMessages)
      // Must reassign the array (not just mutate an entry) to trigger Vue
      // reactivity when this session is the one currently displayed.
      if (isActive()) messages.value = [...messages.value]
    }

    try {
      await streamChat(
        {
          input: input.trim(),
          session_id: targetSessionId,
          provider,
          mode: 'events',
        },
        applyEvent,
        controller.signal,
      )
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      const message = e instanceof Error ? e.message : String(e)
      if (isActive()) error.value = message
      if (!assistantMsg.content) {
        assistantMsg.content = `错误：${message}`
      }
    } finally {
      assistantMsg.streaming = false
      sessions.setMessages(targetSessionId, localMessages)
      if (isActive()) {
        streaming.value = false
        messages.value = [...messages.value]
      }
      if (abort === controller) abort = null
    }
  }

  return {
    sessionId,
    messages,
    streaming,
    lastInterrupt,
    error,
    loadSession,
    clear,
    send,
    stop,
  }
})
