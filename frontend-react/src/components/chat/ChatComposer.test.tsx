import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./ModelPicker', () => ({
  default: () => null,
}))

vi.mock('@/components/common/DemoWarehouseComposerHint', () => ({
  default: () => null,
}))

import ChatComposer from './ChatComposer'

describe('ChatComposer', () => {
  afterEach(() => {
    cleanup()
  })

  it('blocks send button and Enter when sendDisabled (stale warehouse)', () => {
    const onSend = vi.fn()
    const { getByRole, getByPlaceholderText } = render(
      <ChatComposer
        value="还想继续问"
        onChange={() => {}}
        streaming={false}
        onSend={onSend}
        onStop={() => {}}
        sendDisabled
      />,
    )
    const send = getByRole('button', { name: '发送' })
    expect(send).toBeDisabled()
    fireEvent.click(send)
    expect(onSend).not.toHaveBeenCalled()

    const textarea = getByPlaceholderText(/输入数据分析问题/)
    expect(textarea).toBeDisabled()
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('keeps new-chat available while send is disabled', () => {
    const onNewChat = vi.fn()
    const { getByRole } = render(
      <ChatComposer
        value="x"
        onChange={() => {}}
        streaming={false}
        onSend={() => {}}
        onStop={() => {}}
        onNewChat={onNewChat}
        sendDisabled
      />,
    )
    fireEvent.click(getByRole('button', { name: '新建会话' }))
    expect(onNewChat).toHaveBeenCalled()
  })
})
