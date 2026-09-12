import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { ChatMessage } from '../types/stream'

export type SessionMeta = {
  id: string
  title: string
  updatedAt: number
  archived?: boolean
  /**
   * `active_connection_id` from `/api/warehouse/status` when this session was
   * bound. `null` = demo / no active warehouse. `undefined` = not yet observed
   * (legacy sessions); first status check binds silently.
   */
  warehouseConnectionId?: string | null
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

export function scrubLegacySessionKeys() {
  localStorage.removeItem(LEGACY_SESSIONS_KEY)
  localStorage.removeItem(LEGACY_SESSION_MESSAGES_KEY)
}

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

export const useSessionsStore = defineStore('sessions', () => {
  const activeUserId = ref<string | null>(null)
  const sessions = ref<SessionMeta[]>([])

  function bindUser(userId: string | null) {
    if (activeUserId.value === userId) {
      if (userId) sessions.value = loadSessions(userId)
      return
    }
    activeUserId.value = userId
    sessions.value = userId ? loadSessions(userId) : []
  }

  /** Logout path: delete this user's scoped keys and unbind in-memory state. */
  function clearActiveUserLocalData(userIdHint?: string | null) {
    const userId = activeUserId.value ?? userIdHint ?? null
    if (userId) clearSessionLocalStorageForUser(userId)
    scrubLegacySessionKeys()
    activeUserId.value = null
    sessions.value = []
  }

  function upsert(id: string, title?: string) {
    const userId = activeUserId.value
    if (!userId) return
    const now = Date.now()
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx >= 0) {
      sessions.value[idx] = {
        ...sessions.value[idx],
        title: title || sessions.value[idx].title,
        updatedAt: now,
      }
    } else {
      sessions.value.unshift({
        id,
        title: title || '新会话',
        updatedAt: now,
      })
    }
    sessions.value = [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)
    saveSessions(userId, sessions.value)
  }

  function ensure(id: string) {
    if (!sessions.value.some((s) => s.id === id)) upsert(id)
  }

  function getMessages(id: string): ChatMessage[] {
    const userId = activeUserId.value
    if (!userId) return []
    const map = loadMessages(userId)
    return map[id] ?? []
  }

  function setMessages(id: string, messages: ChatMessage[]) {
    const userId = activeUserId.value
    if (!userId) return
    const map = loadMessages(userId)
    map[id] = messages
    saveMessages(userId, map)
  }

  function archive(id: string) {
    const userId = activeUserId.value
    if (!userId) return
    sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, archived: true } : s))
    saveSessions(userId, sessions.value)
  }

  function unarchive(id: string) {
    const userId = activeUserId.value
    if (!userId) return
    sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, archived: false } : s))
    saveSessions(userId, sessions.value)
  }

  function remove(id: string) {
    const userId = activeUserId.value
    if (!userId) return
    sessions.value = sessions.value.filter((s) => s.id !== id)
    saveSessions(userId, sessions.value)

    const map = loadMessages(userId)
    if (id in map) {
      delete map[id]
      saveMessages(userId, map)
    }
  }

  /** Stamp the warehouse identity this session was started / observed under. */
  function setWarehouseConnectionId(id: string, warehouseConnectionId: string | null) {
    const userId = activeUserId.value
    if (!userId) return
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx < 0) {
      sessions.value = [
        { id, title: '新会话', updatedAt: Date.now(), warehouseConnectionId },
        ...sessions.value,
      ]
      saveSessions(userId, sessions.value)
      return
    }
    const existing = sessions.value[idx]
    if (existing.warehouseConnectionId === warehouseConnectionId) return
    sessions.value = sessions.value.map((s) =>
      s.id === id ? { ...s, warehouseConnectionId } : s,
    )
    saveSessions(userId, sessions.value)
  }

  return {
    activeUserId,
    sessions,
    bindUser,
    clearActiveUserLocalData,
    upsert,
    ensure,
    getMessages,
    setMessages,
    archive,
    unarchive,
    remove,
    setWarehouseConnectionId,
  }
})
