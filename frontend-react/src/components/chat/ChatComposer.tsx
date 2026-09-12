import { ArrowUp, Plus, Square } from 'lucide-react'
import { type KeyboardEvent, useEffect, useEffectEvent, useRef, useState } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import DemoWarehouseComposerHint from '@/components/common/DemoWarehouseComposerHint'
import ModelPicker from './ModelPicker'

/** Enter multiline when probe exceeds one line by this much. */
const ENTER_MULTILINE_SLACK_PX = 4
/** Approx. chrome width (px) reserved by + / model / send in the single-row layout. */
const SINGLE_ROW_CHROME_PX = {
  plus: 36,
  model: 100,
  send: 36,
  gaps: 14,
  paddingX: 14,
} as const

function singleRowTextWidth(composerWidth: number, hasNewChat: boolean): number {
  const chrome =
    SINGLE_ROW_CHROME_PX.paddingX +
    SINGLE_ROW_CHROME_PX.model +
    SINGLE_ROW_CHROME_PX.send +
    SINGLE_ROW_CHROME_PX.gaps +
    (hasNewChat ? SINGLE_ROW_CHROME_PX.plus : 0)
  return Math.max(80, composerWidth - chrome)
}

export default function ChatComposer({
  value,
  onChange,
  streaming,
  onSend,
  onStop,
  onNewChat,
  sendDisabled = false,
  readOnly = false,
  autoFocus,
  placeholder = '输入数据分析问题，例如：上周销售额按品类汇总…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  onSend: () => void
  onStop: () => void
  /** Optional "+" affordance to jump straight into a fresh session. */
  onNewChat?: () => void
  /** When true (e.g. stale warehouse banner visible), block send / Enter; new-chat stays available. */
  sendDisabled?: boolean
  /** viewer: hide send / model / stop; history stays readable elsewhere. */
  readOnly?: boolean
  autoFocus?: boolean
  placeholder?: string
  className?: string
}) {
  const composerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const probeRef = useRef<HTMLTextAreaElement>(null)
  const [multiline, setMultiline] = useState(false)
  const multilineRef = useRef(false)

  if (readOnly) {
    return (
      <div className={cn('w-full', className)}>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
          当前账号为只读，可查看历史会话，无法提问或修改模型设置。
        </div>
      </div>
    )
  }

  /**
   * Cursor-like sticky multiline: once entered, stay until the input is cleared.
   * Wrap detection uses a probe at single-row width (avoids layout oscillation).
   * Layout reads (getComputedStyle / scrollHeight) run on rAF so they stay off the keystroke path.
   */
  const syncMultiline = useEffectEvent(() => {
    if (value.length === 0) {
      multilineRef.current = false
      setMultiline(false)
      return
    }

    if (multilineRef.current) return

    if (value.includes('\n')) {
      multilineRef.current = true
      setMultiline(true)
      return
    }

    const composer = composerRef.current
    const probe = probeRef.current
    const live = textareaRef.current
    if (!composer || !probe || !live) return

    const liveStyle = getComputedStyle(live)
    probe.style.font = liveStyle.font
    probe.style.letterSpacing = liveStyle.letterSpacing
    probe.style.lineHeight = liveStyle.lineHeight
    probe.style.padding = liveStyle.padding
    probe.style.border = liveStyle.border
    probe.style.boxSizing = liveStyle.boxSizing
    probe.style.width = `${singleRowTextWidth(composer.clientWidth, Boolean(onNewChat))}px`
    probe.value = value

    const lineHeight = Number.parseFloat(liveStyle.lineHeight) || 24
    const paddingY =
      (Number.parseFloat(liveStyle.paddingTop) || 0) + (Number.parseFloat(liveStyle.paddingBottom) || 0)
    const oneLineHeight = lineHeight + paddingY
    if (probe.scrollHeight > oneLineHeight + ENTER_MULTILINE_SLACK_PX) {
      multilineRef.current = true
      setMultiline(true)
    }
  })

  useEffect(() => {
    const id = requestAnimationFrame(() => syncMultiline())
    return () => cancelAnimationFrame(id)
  }, [value, onNewChat])

  useEffect(() => {
    const composer = composerRef.current
    if (!composer || typeof ResizeObserver === 'undefined') return
    let raf = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => syncMultiline())
    })
    observer.observe(composer)
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [])

  function handleSend() {
    if (!value.trim() || streaming || sendDisabled) return
    onSend()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = Boolean(value.trim()) && !streaming && !sendDisabled

  const newChatButton = onNewChat ? (
    <button
      type="button"
      aria-label="新建会话"
      title="新建会话"
      onClick={onNewChat}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)] transition-colors duration-150 hover:bg-[var(--color-border)] hover:text-[var(--color-foreground)]"
    >
      <Plus size={16} />
    </button>
  ) : null

  const actionButton = streaming ? (
    <button
      type="button"
      aria-label="停止生成"
      title="停止生成"
      onClick={onStop}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-foreground)] text-[var(--color-background)] transition-opacity duration-150 hover:opacity-90 active:scale-95"
    >
      <Square size={12} fill="currentColor" />
    </button>
  ) : (
    <button
      type="button"
      aria-label="发送"
      title="发送 (Enter) · 换行 (Shift+Enter)"
      disabled={!canSend}
      onClick={handleSend}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity duration-150 active:enabled:scale-95',
        canSend
          ? 'bg-[var(--color-foreground)] text-[var(--color-background)] hover:opacity-90'
          : 'cursor-not-allowed bg-[var(--color-muted)] text-[var(--color-muted-foreground)] opacity-50',
      )}
    >
      <ArrowUp size={16} />
    </button>
  )

  return (
    <div className={cn('w-full', className)}>
      <DemoWarehouseComposerHint className="mb-1.5 px-1 text-left" />
      <div
        ref={composerRef}
        className={cn(
          'relative border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)] transition-[border-radius] duration-200',
          multiline
            ? 'flex flex-col gap-2 rounded-2xl px-3 pb-2.5 pt-3'
            : 'flex items-center gap-1.5 rounded-full p-1.5 pl-2',
        )}
      >
      {/* Off-screen probe: measures wrap at single-row width so layout flips stay stable. */}
      <textarea
        ref={probeRef}
        aria-hidden
        tabIndex={-1}
        readOnly
        rows={1}
        className="pointer-events-none absolute top-0 left-0 -z-10 h-auto max-h-none min-h-0 overflow-hidden whitespace-pre-wrap break-words opacity-0"
      />

      {!multiline && newChatButton}

      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={streaming || sendDisabled}
        className={cn(
          'max-h-48 min-h-8 resize-none !border-none bg-transparent px-1.5 py-1.5 text-[15px] leading-6 !shadow-none outline-none focus-visible:!border-none focus-visible:!outline-none focus-visible:!ring-0 dark:bg-transparent',
          multiline ? 'w-full' : 'flex-1',
        )}
      />

      {multiline ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            {newChatButton}
            <ModelPicker />
          </div>
          {actionButton}
        </div>
      ) : (
        <>
          <ModelPicker />
          {actionButton}
        </>
      )}
      </div>
    </div>
  )
}
