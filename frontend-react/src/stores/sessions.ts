import { create } from 'zustand'

import type { ChatMessage } from '@/types/stream'

export type SessionMeta = {
  id: string
  title: string
  updatedAt: number
  archived?: boolean
}

export const SESSIONS_KEY = 'ocbi_sessions'
export const SESSION_MESSAGES_KEY = 'ocbi_session_messages'

/** Coalesce rapid stream-token writes so localStorage JSON work stays off the interaction path. */
const MESSAGES_PERSIST_MS = 400

type SessionMessagesMap = Record<string, ChatMessage[]>

function load(): SessionMeta[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SessionMeta[]
  } catch {
    return []
  }
}

function save(list: SessionMeta[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
}

function loadMessages(): SessionMessagesMap {
  try {
    const raw = localStorage.getItem(SESSION_MESSAGES_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as SessionMessagesMap
  } catch {
    return {}
  }
}

function saveMessages(map: SessionMessagesMap) {
  localStorage.setItem(SESSION_MESSAGES_KEY, JSON.stringify(map))
}

/** In-memory mirror of SESSION_MESSAGES_KEY — avoids parse/stringify on every stream event. */
let messagesCache: SessionMessagesMap | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

function getMessagesMap(): SessionMessagesMap {
  if (!messagesCache) messagesCache = loadMessages()
  return messagesCache
}

function scheduleMessagesPersist() {
  if (persistTimer != null) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    if (messagesCache) saveMessages(messagesCache)
  }, MESSAGES_PERSIST_MS)
}

/** Flush pending transcript writes immediately (tests, unload, destructive edits). */
export function flushSessionMessagesPersist() {
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  if (messagesCache) saveMessages(messagesCache)
}

/** Drop the in-memory transcript cache (tests). Next read reloads from localStorage. */
export function resetSessionMessagesCache() {
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  messagesCache = null
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSessionMessagesPersist)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSessionMessagesPersist()
  })
}

type SessionsState = {
  sessions: SessionMeta[]
  upsert: (id: string, title?: string) => void
  ensure: (id: string) => void
  getMessages: (id: string) => ChatMessage[]
  setMessages: (id: string, messages: ChatMessage[]) => void
  archive: (id: string) => void
  unarchive: (id: string) => void
  remove: (id: string) => void
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  sessions: load(),

  upsert(id, title) {
    const now = Date.now()
    const current = get().sessions
    const idx = current.findIndex((s) => s.id === id)
    const next = [...current]
    if (idx >= 0) {
      next[idx] = { ...next[idx]!, title: title || next[idx]!.title, updatedAt: now }
    } else {
      next.unshift({ id, title: title || '新会话', updatedAt: now })
    }
    next.sort((a, b) => b.updatedAt - a.updatedAt)
    save(next)
    set({ sessions: next })
  },

  ensure(id) {
    if (!get().sessions.some((s) => s.id === id)) get().upsert(id)
  },

  getMessages(id) {
    return getMessagesMap()[id] ?? []
  },

  setMessages(id, messages) {
    getMessagesMap()[id] = messages
    scheduleMessagesPersist()
  },

  archive(id) {
    const next = get().sessions.map((s) => (s.id === id ? { ...s, archived: true } : s))
    save(next)
    set({ sessions: next })
  },

  unarchive(id) {
    const next = get().sessions.map((s) => (s.id === id ? { ...s, archived: false } : s))
    save(next)
    set({ sessions: next })
  },

  remove(id) {
    const next = get().sessions.filter((s) => s.id !== id)
    save(next)
    set({ sessions: next })

    const map = getMessagesMap()
    if (id in map) {
      delete map[id]
      flushSessionMessagesPersist()
    }
  },
}))
