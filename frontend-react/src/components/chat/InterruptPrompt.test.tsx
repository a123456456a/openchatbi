import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/chat', () => ({
  streamChat: vi.fn(),
}))

import { streamChat } from '@/api/chat'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'
import InterruptPrompt from './InterruptPrompt'

describe('InterruptPrompt', () => {
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

  it('renders nothing when there is no interrupt', () => {
    const { container } = render(<InterruptPrompt />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders option buttons the user can click instead of a modal dialog', async () => {
    useChatStore.setState({
      lastInterrupt: { text: 'Approve this SQL?', buttons: ['approve', 'reject', 'edit'] },
    })
    render(<InterruptPrompt />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: '需要你的确认' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'approve' }))
    await Promise.resolve()

    expect(useChatStore.getState().lastInterrupt).toBeNull()
    expect(streamChat).toHaveBeenCalledWith(
      expect.objectContaining({ input: 'approve', session_id: 'session-1' }),
      expect.any(Function),
      expect.anything(),
      expect.anything(),
    )
  })

  it('lets the user submit a custom free-text reply', async () => {
    useChatStore.setState({
      lastInterrupt: { text: '请问是哪个业务对象？', buttons: ['A', 'B'] },
    })
    render(<InterruptPrompt />)

    const input = screen.getByRole('textbox', { name: '手动填写回复' })
    fireEvent.change(input, { target: { value: '自定义对象' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    await Promise.resolve()

    expect(useChatStore.getState().lastInterrupt).toBeNull()
    expect(streamChat).toHaveBeenCalledWith(
      expect.objectContaining({ input: '自定义对象', session_id: 'session-1' }),
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
    render(<InterruptPrompt />)

    expect(screen.queryByText(rawDump)).not.toBeInTheDocument()
    expect(screen.queryByText(/candidates/)).not.toBeInTheDocument()
    expect(screen.getByText('请输入你的回复以继续对话')).toBeVisible()
  })

  it('still shows a natural-language question as-is', () => {
    useChatStore.setState({ lastInterrupt: { text: '请问是哪个门店？', buttons: [] } })
    render(<InterruptPrompt />)

    expect(screen.getByText('请问是哪个门店？')).toBeVisible()
  })
})
