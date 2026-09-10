import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/chat', () => ({
  streamChat: vi.fn(),
}))

import { streamChat } from '@/api/chat'
import type { StreamEvent } from '@/types/stream'
import { useChatStore } from './chat'
import { useSessionsStore } from './sessions'

describe('useChatStore session switching', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionsStore.setState({ sessions: [] })
    useChatStore.setState({ sessionId: null, messages: [], streaming: false, lastInterrupt: null, error: null })
    vi.mocked(streamChat).mockReset()
  })

  it('restores a session transcript instead of clearing it when navigating back', async () => {
    vi.mocked(streamChat).mockImplementation(async (_body, onEvent) => {
      onEvent({ type: 'final_answer', text: '来自会话一的回答' } as StreamEvent)
    })

    useChatStore.getState().loadSession('session-1')
    await useChatStore.getState().send('session-1', '第一个问题')

    expect(useChatStore.getState().messages).toHaveLength(2)
    expect(useChatStore.getState().messages[1]?.content).toBe('来自会话一的回答')

    // Simulate: user clicks "新建会话" then goes back to the previous chat.
    useChatStore.getState().loadSession('session-2')
    expect(useChatStore.getState().messages).toEqual([])

    useChatStore.getState().loadSession('session-1')
    expect(useChatStore.getState().messages).toHaveLength(2)
    expect(useChatStore.getState().messages[0]?.content).toBe('第一个问题')
    expect(useChatStore.getState().messages[1]?.content).toBe('来自会话一的回答')
  })

  it('does not leak an in-flight response from the previous session into the newly opened one', async () => {
    let resolveStream!: () => void
    vi.mocked(streamChat).mockImplementation(
      (_body, onEvent) =>
        new Promise<void>((resolve) => {
          resolveStream = () => {
            onEvent({ type: 'final_answer', text: '延迟到达的回答' } as StreamEvent)
            resolve()
          }
        }),
    )

    useChatStore.getState().loadSession('session-1')
    const sendPromise = useChatStore.getState().send('session-1', '问题一')

    // Switch away before the stream resolves (aborts the in-flight request).
    useChatStore.getState().loadSession('session-2')
    expect(useChatStore.getState().messages).toEqual([])

    resolveStream()
    await sendPromise

    // The currently displayed session (session-2) must remain untouched.
    expect(useChatStore.getState().sessionId).toBe('session-2')
    expect(useChatStore.getState().messages).toEqual([])

    // But session-1's own history should still have been persisted.
    expect(useSessionsStore.getState().getMessages('session-1')).toHaveLength(2)
  })
})
