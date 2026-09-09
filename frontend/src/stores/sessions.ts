import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SessionMeta = {
  id: string
  title: string
  updatedAt: number
}

const SESSIONS_KEY = 'ocbi_sessions'

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

  return { sessions, upsert, ensure }
})
