import { create } from 'zustand'

import { streamChat } from '@/api/chat'
import type { ChatMessage, StreamEvent } from '@/types/stream'
import { useAuthStore } from './auth'
import { applyStreamEvent } from './chatEvents'
import { useSessionsStore } from './sessions'
import { useSettingsStore } from './settings'

function uid() {
  return crypto.randomUUID()
}

type ChatState = {
  messages: ChatMessage[]
  streaming: boolean
  lastInterrupt: { text: string; buttons: unknown[] } | null
  error: string | null
  clear: () => void
  send: (sessionId: string, input: string) => Promise<void>
  stop: () => void
}

let abortController: AbortController | null = null

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  lastInterrupt: null,
  error: null,

  clear() {
    set({ messages: [], lastInterrupt: null, error: null })
  },

  async send(sessionId, input) {
    if (!input.trim() || get().streaming) return

    const sessions = useSessionsStore.getState()
    const provider = useSettingsStore.getState().chatProvider()
    sessions.ensure(sessionId)
    sessions.upsert(sessionId, input.trim().slice(0, 40))

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: input.trim(),
      thinking: '',
      steps: [],
    }
    // Kept as a stable object reference so in-place mutation from applyEvent
    // is visible on the next `set({ messages: [...] })` re-render.
    const assistantMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      thinking: '',
      steps: [],
      streaming: true,
    }

    set((state) => ({ messages: [...state.messages, userMsg, assistantMsg] }))
    set({ streaming: true, error: null, lastInterrupt: null })
    abortController = new AbortController()

    const applyEvent = (event: StreamEvent) => {
      if (event.type === 'interrupt') {
        set({
          lastInterrupt: {
            text: String(event.text ?? ''),
            buttons: Array.isArray(event.buttons) ? event.buttons : [],
          },
        })
        return
      }
      applyStreamEvent(assistantMsg, event)
      set((state) => ({ messages: [...state.messages] }))
    }

    try {
      await streamChat(
        { input: input.trim(), session_id: sessionId, provider, mode: 'events' },
        applyEvent,
        abortController.signal,
        {
          getAccessToken: () => useAuthStore.getState().accessToken,
          getStoredRefresh: () => useAuthStore.getState().getStoredRefresh(),
          refresh: () => useAuthStore.getState().refresh(),
        },
      )
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      const message = e instanceof Error ? e.message : String(e)
      set({ error: message })
      if (!assistantMsg.content) {
        assistantMsg.content = `错误：${message}`
      }
    } finally {
      assistantMsg.streaming = false
      set((state) => ({ streaming: false, messages: [...state.messages] }))
      abortController = null
    }
  },

  stop() {
    abortController?.abort()
  },
}))
