import { nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** Distance from the bottom (px) that still counts as "stuck to bottom". */
export const NEAR_BOTTOM_PX = 80

/**
 * Stick-to-bottom for a scrollable chat transcript (Vue).
 * Mirrors frontend-react/src/hooks/useStickToBottom.ts behavior.
 */
export function useStickToBottom(watchSource: Ref<unknown> | (() => unknown)) {
  const containerRef = ref<HTMLElement | null>(null)
  const contentRef = ref<HTMLElement | null>(null)
  const stickToBottom = ref(true)
  let resizeObserver: ResizeObserver | null = null

  function scrollToBottom() {
    const el = containerRef.value
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  function onScroll() {
    const el = containerRef.value
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottom.value = distance <= NEAR_BOTTOM_PX
  }

  function pinToBottom() {
    stickToBottom.value = true
    void nextTick(() => scrollToBottom())
  }

  watch(
    watchSource,
    async () => {
      if (!stickToBottom.value) return
      await nextTick()
      scrollToBottom()
    },
    { flush: 'post' },
  )

  onMounted(() => {
    const content = contentRef.value
    if (!content || typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(() => {
      if (stickToBottom.value) scrollToBottom()
    })
    resizeObserver.observe(content)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  return { containerRef, contentRef, onScroll, stickToBottom, pinToBottom }
}
