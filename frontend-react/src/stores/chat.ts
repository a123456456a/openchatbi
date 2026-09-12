import { create } from 'zustand'

import { cancelChatRun, streamChat } from '@/api/chat'
import type { ChatMessage, StreamEvent } from '@/types/stream'
import { useAuthStore } from './auth'
import { applyStreamEvent } from './chatEvents'
import { useSessionsStore } from './sessions'
import { useSettingsStore } from './settings'
import { canAskData, VIEWER_READONLY_DETAIL } from '@/lib/roles'

function uid() {
  return crypto.randomUUID()
}

/** Must match `MISSING_LLM_SETTINGS_DETAIL` in `backend/chat/routes.py`. */
const MISSING_LLM_SETTINGS_DETAIL = '请先在设置中配置模型'

type ChatState = {
  sessionId: string | null
  messages: ChatMessage[]
  streaming: boolean
  lastInterrupt: { text: string; buttons: unknown[] } | null
  error: string | null
  loadSession: (sessionId: string) => void
  clear: () => void
  send: (sessionId: string, input: string) => Promise<void>
  stop: () => void
}

let abortController: AbortController | null = null
/** Coalesce in-place stream mutations into at most one React commit per animation frame. */
let streamPaintRaf: number | null = null

function cancelStreamPaint() {
  if (streamPaintRaf == null) return
  cancelAnimationFrame(streamPaintRaf)
  streamPaintRaf = null
}

export const useChatStore = create<ChatState>((set, get) => {
  const paintMessages = () => {
    set((state) => ({ messages: [...state.messages] }))
  }

  const scheduleStreamPaint = (isActive: () => boolean) => {
    if (streamPaintRaf != null) return
    streamPaintRaf = requestAnimationFrame(() => {
      streamPaintRaf = null
      if (isActive()) paintMessages()
    })
  }

  return {
  sessionId: null,
  messages: [],
  streaming: false,
  lastInterrupt: null,
  error: null,

  loadSession(sessionId) {
    if (get().sessionId === sessionId) return
    if (get().streaming) get().stop()
    cancelStreamPaint()
    set({
      sessionId,
      messages: useSessionsStore.getState().getMessages(sessionId),
      lastInterrupt: null,
      error: null,
      streaming: false,
    })
  },

  clear() {
    set({ messages: [], lastInterrupt: null, error: null })
  },

  async send(sessionId, input) {
    if (!canAskData(useAuthStore.getState().role)) {
      set({ error: VIEWER_READONLY_DETAIL })
      return
    }
    if (!input.trim() || get().streaming) return

    const sessions = useSessionsStore.getState()
    const provider = useSettingsStore.getState().chatProvider()
    sessions.ensure(sessionId)
    sessions.upsert(sessionId, input.trim().slice(0, 40))

    const isActive = () => get().sessionId === sessionId

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

    // Own reference to this session's transcript, independent of whichever
    // session is currently displayed — so a background send (after the user
    // navigates away) keeps writing into the *right* session's history
    // instead of leaking into (or being overwritten by) the active view.
    const baseMessages = isActive() ? get().messages : sessions.getMessages(sessionId)
    const localMessages = [...baseMessages, userMsg, assistantMsg]
    sessions.setMessages(sessionId, localMessages)

    if (isActive()) {
      cancelStreamPaint()
      set({ messages: localMessages, streaming: true, error: null, lastInterrupt: null })
    }
    abortController = new AbortController()
    const controller = abortController

    const applyEvent = (event: StreamEvent) => {
      if (event.type === 'interrupt') {
        if (isActive()) {
          set({
            lastInterrupt: {
              text: String(event.text ?? ''),
              buttons: Array.isArray(event.buttons) ? event.buttons : [],
            },
          })
        }
        return
      }
      applyStreamEvent(assistantMsg, event)
      sessions.setMessages(sessionId, localMessages)
      if (isActive()) scheduleStreamPaint(isActive)
    }

    try {
      await streamChat(
        { input: input.trim(), session_id: sessionId, provider, mode: 'events' },
        applyEvent,
        controller.signal,
        {
          getAccessToken: () => useAuthStore.getState().accessToken,
          getStoredRefresh: () => useAuthStore.getState().getStoredRefresh(),
          refresh: () => useAuthStore.getState().refresh(),
        },
      )
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      let message = e instanceof Error ? e.message : String(e)
      if (message === 'Forbidden') message = VIEWER_READONLY_DETAIL
      if (isActive()) set({ error: message })
      if (
        message === MISSING_LLM_SETTINGS_DETAIL &&
        canAskData(useAuthStore.getState().role)
      ) {
        // No model provider configured for this account yet: open the settings
        // dialog directly so the user can pick and save a provider inline,
        // instead of only surfacing a dead-end error bubble in the chat.
        useSettingsStore.getState().openSettings()
      }
      if (!assistantMsg.content) {
        assistantMsg.content = `错误：${message}`
      }
    } finally {
      assistantMsg.streaming = false
      sessions.setMessages(sessionId, localMessages)
      if (isActive()) {
        cancelStreamPaint()
        set({ streaming: false, messages: [...get().messages] })
      }
      if (abortController === controller) abortController = null
    }
  },

  stop() {
    const sid = get().sessionId
    abortController?.abort()
    abortController = null
    cancelStreamPaint()
    set({ streaming: false })
    if (sid) {
      void cancelChatRun(sid, {
        getAccessToken: () => useAuthStore.getState().accessToken,
        getStoredRefresh: () => useAuthStore.getState().getStoredRefresh(),
        refresh: () => useAuthStore.getState().refresh(),
      }).catch(() => {
        /* best-effort server cancel; client already aborted the stream */
      })
    }
  },
  }
})
