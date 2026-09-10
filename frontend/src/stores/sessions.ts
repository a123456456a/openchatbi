import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { ChatMessage } from '../types/stream'

export type SessionMeta = {
  id: string
  title: string
  updatedAt: number
  archived?: boolean
}

export const SESSIONS_KEY = 'ocbi_sessions'
export const SESSION_MESSAGES_KEY = 'ocbi_session_messages'

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

export const useSessionsStore = defineStore('sessions', () => {
  const sessions = ref<SessionMeta[]>(load())

  function upsert(id: string, title?: string) {
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
    save(sessions.value)
  }

  function ensure(id: string) {
    if (!sessions.value.some((s) => s.id === id)) upsert(id)
  }

  function getMessages(id: string): ChatMessage[] {
    const map = loadMessages()
    return map[id] ?? []
  }

  function setMessages(id: string, messages: ChatMessage[]) {
    const map = loadMessages()
    map[id] = messages
    saveMessages(map)
  }

  function archive(id: string) {
    sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, archived: true } : s))
    save(sessions.value)
  }

  function unarchive(id: string) {
    sessions.value = sessions.value.map((s) => (s.id === id ? { ...s, archived: false } : s))
    save(sessions.value)
  }

  function remove(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id)
    save(sessions.value)

    const map = loadMessages()
    if (id in map) {
      delete map[id]
      saveMessages(map)
    }
  }

  return { sessions, upsert, ensure, getMessages, setMessages, archive, unarchive, remove }
})
