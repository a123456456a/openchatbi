import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
  type UIEventHandler,
} from 'react'

/** Distance from the bottom (px) that still counts as "stuck to bottom". */
export const NEAR_BOTTOM_PX = 80

export type StickToBottom = {
  containerRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  onScroll: UIEventHandler<HTMLDivElement>
  stickToBottom: boolean
  /** Force stick on (e.g. user just sent a message). */
  pinToBottom: () => void
}

/**
 * Stick-to-bottom for a scrollable chat transcript.
 * - While near the bottom, new content keeps the viewport pinned.
 * - Scrolling up releases the pin so the user can read history.
 * - ResizeObserver covers streaming growth (markdown/charts) without a messages change.
 */
export function useStickToBottom(watchKey: unknown): StickToBottom {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const stickRef = useRef(true)
  const [stickToBottom, setStickToBottom] = useState(true)

  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const setStick = useCallback((next: boolean) => {
    stickRef.current = next
    setStickToBottom(next)
  }, [])

  const pinToBottom = useCallback(() => {
    setStick(true)
    scrollToBottom()
  }, [scrollToBottom, setStick])

  const onScroll = useCallback<UIEventHandler<HTMLDivElement>>(() => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    setStick(distance <= NEAR_BOTTOM_PX)
  }, [setStick])

  useLayoutEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [watchKey, scrollToBottom])

  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToBottom()
    })
    ro.observe(content)
    return () => ro.disconnect()
  }, [scrollToBottom])

  return { containerRef, contentRef, onScroll, stickToBottom, pinToBottom }
}
