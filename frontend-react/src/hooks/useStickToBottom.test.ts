import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NEAR_BOTTOM_PX, useStickToBottom } from './useStickToBottom'

function fakeScrollEl(opts: {
  scrollHeight: number
  clientHeight: number
  scrollTop: number
}): HTMLDivElement {
  const el = document.createElement('div')
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => opts.scrollHeight })
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => opts.clientHeight })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => opts.scrollTop,
    set: (v: number) => {
      opts.scrollTop = v
    },
  })
  return el
}

describe('useStickToBottom', () => {
  it('stays stuck when scrolled within the near-bottom threshold', () => {
    const { result } = renderHook(({ key }) => useStickToBottom(key), {
      initialProps: { key: 'a' },
    })
    const el = fakeScrollEl({ scrollHeight: 1000, clientHeight: 400, scrollTop: 1000 - 400 - 10 })
    ;(result.current.containerRef as { current: HTMLDivElement | null }).current = el

    act(() => {
      result.current.onScroll({} as never)
    })
    expect(result.current.stickToBottom).toBe(true)
  })

  it('releases stick when the user scrolls up past the threshold', () => {
    const { result } = renderHook(({ key }) => useStickToBottom(key), {
      initialProps: { key: 'a' },
    })
    const el = fakeScrollEl({
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 1000 - 400 - (NEAR_BOTTOM_PX + 40),
    })
    ;(result.current.containerRef as { current: HTMLDivElement | null }).current = el

    act(() => {
      result.current.onScroll({} as never)
    })
    expect(result.current.stickToBottom).toBe(false)
  })

  it('scrolls to bottom on watchKey change while stuck', () => {
    const { result, rerender } = renderHook(({ key }) => useStickToBottom(key), {
      initialProps: { key: 'a' },
    })
    const state = { scrollHeight: 800, clientHeight: 400, scrollTop: 0 }
    const el = fakeScrollEl(state)
    ;(result.current.containerRef as { current: HTMLDivElement | null }).current = el

    act(() => {
      rerender({ key: 'b' })
    })
    expect(state.scrollTop).toBe(state.scrollHeight)
  })

  it('does not force scroll when stick is released', () => {
    const { result, rerender } = renderHook(({ key }) => useStickToBottom(key), {
      initialProps: { key: 'a' },
    })
    const state = { scrollHeight: 1000, clientHeight: 400, scrollTop: 100 }
    const el = fakeScrollEl(state)
    ;(result.current.containerRef as { current: HTMLDivElement | null }).current = el

    act(() => {
      result.current.onScroll({} as never)
    })
    expect(result.current.stickToBottom).toBe(false)

    const before = state.scrollTop
    act(() => {
      rerender({ key: 'b' })
    })
    expect(state.scrollTop).toBe(before)
  })

  it('pinToBottom re-enables stick and scrolls', () => {
    const { result } = renderHook(({ key }) => useStickToBottom(key), {
      initialProps: { key: 'a' },
    })
    const state = { scrollHeight: 900, clientHeight: 300, scrollTop: 50 }
    const el = fakeScrollEl(state)
    ;(result.current.containerRef as { current: HTMLDivElement | null }).current = el

    act(() => {
      result.current.onScroll({} as never)
    })
    expect(result.current.stickToBottom).toBe(false)

    act(() => {
      result.current.pinToBottom()
    })
    expect(result.current.stickToBottom).toBe(true)
    expect(state.scrollTop).toBe(state.scrollHeight)
  })
})
