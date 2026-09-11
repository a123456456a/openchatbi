import { beforeEach, describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/types/stream'
import {
  flushSessionMessagesPersist,
  resetSessionMessagesCache,
  SESSION_MESSAGES_KEY,
  SESSIONS_KEY,
  useSessionsStore,
} from './sessions'

function msg(content: string): ChatMessage {
  return { id: content, role: 'user', content, thinking: '', steps: [] }
}

describe('useSessionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSessionMessagesCache()
    useSessionsStore.setState({ sessions: [] })
  })

  it('persists per-session messages independently of the sessions list', () => {
    const store = useSessionsStore.getState()
    store.ensure('s1')
    store.ensure('s2')

    store.setMessages('s1', [msg('hello from s1')])
    store.setMessages('s2', [msg('hello from s2')])

    expect(store.getMessages('s1')).toEqual([msg('hello from s1')])
    expect(store.getMessages('s2')).toEqual([msg('hello from s2')])
    // Regression guard: switching sessions must not wipe the other
    // session's stored transcript.
    expect(store.getMessages('s1')).not.toEqual([])
  })

  it('returns an empty transcript for a session with no stored messages', () => {
    expect(useSessionsStore.getState().getMessages('unknown')).toEqual([])
  })

  it('survives a reload by reading back from localStorage', () => {
    useSessionsStore.getState().setMessages('s1', [msg('persisted')])
    flushSessionMessagesPersist()
    expect(JSON.parse(localStorage.getItem(SESSION_MESSAGES_KEY) ?? '{}')).toEqual({
      s1: [msg('persisted')],
    })
  })

  it('archive moves a session out of the active list and unarchive restores it', () => {
    const store = useSessionsStore.getState()
    store.ensure('s1')

    store.archive('s1')
    expect(useSessionsStore.getState().sessions.find((s) => s.id === 's1')?.archived).toBe(true)

    store.unarchive('s1')
    expect(useSessionsStore.getState().sessions.find((s) => s.id === 's1')?.archived).toBe(false)
  })

  it('remove deletes the session metadata and its stored messages', () => {
    const store = useSessionsStore.getState()
    store.ensure('s1')
    store.setMessages('s1', [msg('to be deleted')])

    store.remove('s1')

    expect(useSessionsStore.getState().sessions.some((s) => s.id === 's1')).toBe(false)
    expect(useSessionsStore.getState().getMessages('s1')).toEqual([])
    expect(JSON.parse(localStorage.getItem(SESSIONS_KEY) ?? '[]')).toEqual([])
  })
})
