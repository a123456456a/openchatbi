import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/chat', () => ({
  streamChat: vi.fn(),
}))

import { streamChat } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'
import InterruptDialog from './InterruptDialog'

describe('InterruptDialog', () => {
  beforeEach(() => {
    localStorage.clear()
    useSessionsStore.setState({ sessions: [] })
    useChatStore.setState({
      sessionId: 'session-1',
      messages: [],
      streaming: false,
      lastInterrupt: null,
      error: null,
    })
    vi.mocked(streamChat).mockReset()
    vi.mocked(streamChat).mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it('renders option buttons the user can click instead of read-only badges', async () => {
    useChatStore.setState({
      lastInterrupt: { text: 'Approve this SQL?', buttons: ['approve', 'reject', 'edit'] },
    })
    render(<InterruptDialog />)

    const approveButton = screen.getByRole('button', { name: 'approve' })
    fireEvent.click(approveButton)
    await Promise.resolve()

    expect(useChatStore.getState().lastInterrupt).toBeNull()
    expect(streamChat).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'approve', session_id: 'session-1' }),
      expect.any(Function),
      expect.anything(),
      expect.anything(),
    )
  })

  it('hides raw structured-data dumps instead of rendering them verbatim', () => {
    const rawDump = JSON.stringify({
      candidates: [{ table: 'Orders', matched_columns: ['order_id'] }],
    })
    useChatStore.setState({ lastInterrupt: { text: rawDump, buttons: [] } })
    render(<InterruptDialog />)

    expect(screen.queryByText(rawDump)).not.toBeInTheDocument()
    expect(screen.queryByText(/candidates/)).not.toBeInTheDocument()
    expect(screen.getByText('请在下方输入框中回复以继续对话')).toBeVisible()
  })

  it('still shows a natural-language question as-is', () => {
    useChatStore.setState({ lastInterrupt: { text: '请问是哪个门店？', buttons: [] } })
    render(<InterruptDialog />)

    expect(screen.getByText('请问是哪个门店？')).toBeVisible()
  })
})
