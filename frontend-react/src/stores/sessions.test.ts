import { beforeEach, describe, expect, it } from 'vitest'

import type { ChatMessage } from '@/types/stream'
import {
  flushSessionMessagesPersist,
  resetSessionMessagesCache,
  sessionMessagesKeyForUser,
  sessionsKeyForUser,
  useSessionsStore,
} from './sessions'

const TEST_USER = 'user-a'

function msg(content: string): ChatMessage {
  return { id: content, role: 'user', content, thinking: '', steps: [] }
}

describe('useSessionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSessionMessagesCache()
    useSessionsStore.setState({ activeUserId: null, sessions: [] })
    useSessionsStore.getState().bindUser(TEST_USER)
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

  it('survives a reload by reading back from localStorage under the user-scoped key', () => {
    useSessionsStore.getState().setMessages('s1', [msg('persisted')])
    flushSessionMessagesPersist()
    expect(JSON.parse(localStorage.getItem(sessionMessagesKeyForUser(TEST_USER)) ?? '{}')).toEqual({
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
    expect(JSON.parse(localStorage.getItem(sessionsKeyForUser(TEST_USER)) ?? '[]')).toEqual([])
  })

  it('namespaces localStorage by user_id so accounts do not share sessions', () => {
    const store = useSessionsStore.getState()
    store.ensure('s-a')
    store.setMessages('s-a', [msg('alice only')])
    flushSessionMessagesPersist()

    expect(localStorage.getItem(sessionsKeyForUser('user-a'))).toBeTruthy()
    expect(localStorage.getItem(sessionMessagesKeyForUser('user-a'))).toBeTruthy()
    expect(localStorage.getItem('ocbi_sessions')).toBeNull()
    expect(localStorage.getItem('ocbi_session_messages')).toBeNull()

    store.bindUser('user-b')
    expect(useSessionsStore.getState().sessions).toEqual([])
    expect(useSessionsStore.getState().getMessages('s-a')).toEqual([])

    store.ensure('s-b')
    store.setMessages('s-b', [msg('bob only')])
    flushSessionMessagesPersist()

    // Alice's data remains intact under her keys while Bob is active.
    expect(JSON.parse(localStorage.getItem(sessionsKeyForUser('user-a')) ?? '[]')).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 's-a' })]),
    )
    expect(JSON.parse(localStorage.getItem(sessionMessagesKeyForUser('user-a')) ?? '{}')).toEqual({
      's-a': [msg('alice only')],
    })

    store.bindUser('user-a')
    expect(useSessionsStore.getState().sessions.map((s) => s.id)).toEqual(['s-a'])
    expect(useSessionsStore.getState().getMessages('s-a')).toEqual([msg('alice only')])
    expect(useSessionsStore.getState().getMessages('s-b')).toEqual([])
  })

  it('clearActiveUserLocalData removes that user cache and hides sessions (logout)', () => {
    const store = useSessionsStore.getState()
    store.ensure('s1')
    store.setMessages('s1', [msg('gone on logout')])
    flushSessionMessagesPersist()

    store.clearActiveUserLocalData()

    expect(localStorage.getItem(sessionsKeyForUser(TEST_USER))).toBeNull()
    expect(localStorage.getItem(sessionMessagesKeyForUser(TEST_USER))).toBeNull()
    expect(useSessionsStore.getState().sessions).toEqual([])
    expect(useSessionsStore.getState().getMessages('s1')).toEqual([])
  })

  it('setWarehouseConnectionId stamps active_connection_id onto a session', () => {
    const store = useSessionsStore.getState()
    store.ensure('s1')
    store.setWarehouseConnectionId('s1', 'wh-1')
    expect(useSessionsStore.getState().sessions.find((s) => s.id === 's1')?.warehouseConnectionId).toBe(
      'wh-1',
    )
    store.setWarehouseConnectionId('s1', null)
    expect(useSessionsStore.getState().sessions.find((s) => s.id === 's1')?.warehouseConnectionId).toBe(
      null,
    )
  })

})
