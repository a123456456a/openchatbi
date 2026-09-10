import { create } from 'zustand'

export type SessionMeta = {
  id: string
  title: string
  updatedAt: number
}

export const SESSIONS_KEY = 'ocbi_sessions'

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

type SessionsState = {
  sessions: SessionMeta[]
  upsert: (id: string, title?: string) => void
  ensure: (id: string) => void
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
}))
