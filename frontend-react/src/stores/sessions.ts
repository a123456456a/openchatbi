import { create } from 'zustand'

import type { ChatMessage } from '@/types/stream'

export type SessionMeta = {
  id: string
  title: string
  updatedAt: number
  archived?: boolean
}

/** Base prefixes; actual localStorage keys are scoped as `${prefix}:${userId}`. */
export const SESSIONS_KEY_PREFIX = 'ocbi_sessions'
export const SESSION_MESSAGES_KEY_PREFIX = 'ocbi_session_messages'

/** Pre-isolation shared keys — scrubbed on logout so they cannot leak across accounts. */
export const LEGACY_SESSIONS_KEY = 'ocbi_sessions'
export const LEGACY_SESSION_MESSAGES_KEY = 'ocbi_session_messages'

export function sessionsKeyForUser(userId: string): string {
  return `${SESSIONS_KEY_PREFIX}:${userId}`
}

export function sessionMessagesKeyForUser(userId: string): string {
  return `${SESSION_MESSAGES_KEY_PREFIX}:${userId}`
}

export function clearSessionLocalStorageForUser(userId: string) {
  localStorage.removeItem(sessionsKeyForUser(userId))
  localStorage.removeItem(sessionMessagesKeyForUser(userId))
}

function scrubLegacySessionKeys() {
  localStorage.removeItem(LEGACY_SESSIONS_KEY)
  localStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY)
}

/** Coalesce rapid stream-token writes so localStorage JSON work stays off the interaction path. */
const MESSAGES_PERSIST_MS = 400

type SessionMessagesMap = Record<string, ChatMessage[]>

function loadSessions(userId: string): SessionMeta[] {
  try {
    const raw = localStorage.getItem(sessionsKeyForUser(userId))
    if (!raw) return []
    return JSON.parse(raw) as SessionMeta[]
  } catch {
    return []
  }
}

function saveSessions(userId: string, list: SessionMeta[]) {
  localStorage.setItem(sessionsKeyForUser(userId), JSON.stringify(list))
}

function loadMessages(userId: string): SessionMessagesMap {
  try {
    const raw = localStorage.getItem(sessionMessagesKeyForUser(userId))
    if (!raw) return {}
    return JSON.parse(raw) as SessionMessagesMap
  } catch {
    return {}
  }
}

function saveMessages(userId: string, map: SessionMessagesMap) {
  localStorage.setItem(sessionMessagesKeyForUser(userId), JSON.stringify(map))
}

/** In-memory mirror of the active user's SESSION_MESSAGES key — avoids parse/stringify on every stream event. */
let messagesCache: SessionMessagesMap | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null

function getMessagesMap(userId: string): SessionMessagesMap {
  if (!messagesCache) messagesCache = loadMessages(userId)
  return messagesCache
}

function scheduleMessagesPersist(userId: string) {
  if (persistTimer != null) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    if (messagesCache) saveMessages(userId, messagesCache)
  }, MESSAGES_PERSIST_MS)
}

/** Flush pending transcript writes immediately (tests, unload, destructive edits). */
export function flushSessionMessagesPersist() {
  if (persistTimer != null) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const userId = useSessionsStore.getState().activeUserId
  if (userId && messagesCache) saveMessages(userId, messagesCache)
}

/** Drop the in-memory transcript cache (tests / user switch). Next read reloads from localStorage. */
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
  /** User whose localStorage namespace is currently bound; null when logged out. */
  activeUserId: string | null
  sessions: SessionMeta[]
  /** Bind read/write to this user's scoped keys (or clear in-memory state when null). */
  bindUser: (userId: string | null) => void
  /**
   * Logout path: drop in-memory cache without flushing, delete this user's
   * scoped localStorage keys, and unbind so another account cannot see the data.
   */
  clearActiveUserLocalData: (userIdHint?: string | null) => void
  upsert: (id: string, title?: string) => void
  ensure: (id: string) => void
  getMessages: (id: string) => ChatMessage[]
  setMessages: (id: string, messages: ChatMessage[]) => void
  archive: (id: string) => void
  unarchive: (id: string) => void
  remove: (id: string) => void
}

export const useSessionsStore = create<SessionsState>((set, get) => ({
  activeUserId: null,
  sessions: [],

  bindUser(userId) {
    const prev = get().activeUserId
    if (prev === userId) {
      if (userId) set({ sessions: loadSessions(userId) })
      return
    }
    // Persist previous user's pending transcript writes before switching namespace.
    if (prev && messagesCache) {
      if (persistTimer != null) {
        clearTimeout(persistTimer)
        persistTimer = null
      }
      saveMessages(prev, messagesCache)
    }
    resetSessionMessagesCache()
    if (!userId) {
      set({ activeUserId: null, sessions: [] })
      return
    }
    set({ activeUserId: userId, sessions: loadSessions(userId) })
  },

  clearActiveUserLocalData(userIdHint) {
    const userId = get().activeUserId ?? userIdHint ?? null
    // Discard pending writes so we do not recreate keys after delete.
    resetSessionMessagesCache()
    if (userId) clearSessionLocalStorageForUser(userId)
    scrubLegacySessionKeys()
    set({ activeUserId: null, sessions: [] })
  },

  upsert(id, title) {
    const userId = get().activeUserId
    if (!userId) return
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
    saveSessions(userId, next)
    set({ sessions: next })
  },

  ensure(id) {
    if (!get().sessions.some((s) => s.id === id)) get().upsert(id)
  },

  getMessages(id) {
    const userId = get().activeUserId
    if (!userId) return []
    return getMessagesMap(userId)[id] ?? []
  },

  setMessages(id, messages) {
    const userId = get().activeUserId
    if (!userId) return
    getMessagesMap(userId)[id] = messages
    scheduleMessagesPersist(userId)
  },

  archive(id) {
    const userId = get().activeUserId
    if (!userId) return
    const next = get().sessions.map((s) => (s.id === id ? { ...s, archived: true } : s))
    saveSessions(userId, next)
    set({ sessions: next })
  },

  unarchive(id) {
    const userId = get().activeUserId
    if (!userId) return
    const next = get().sessions.map((s) => (s.id === id ? { ...s, archived: false } : s))
    saveSessions(userId, next)
    set({ sessions: next })
  },

  remove(id) {
    const userId = get().activeUserId
    if (!userId) return
    const next = get().sessions.filter((s) => s.id !== id)
    saveSessions(userId, next)
    set({ sessions: next })

    const map = getMessagesMap(userId)
    if (id in map) {
      delete map[id]
      flushSessionMessagesPersist()
    }
  },
}))

export { scrubLegacySessionKeys }
