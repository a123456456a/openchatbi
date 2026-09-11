import { ArrowUp, Square } from 'lucide-react'
import { type KeyboardEvent } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function ChatComposer({
  value,
  onChange,
  streaming,
  onSend,
  onStop,
  autoFocus,
  placeholder = '输入数据分析问题，例如：上周销售额按品类汇总…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  onSend: () => void
  onStop: () => void
  autoFocus?: boolean
  placeholder?: string
  className?: string
}) {
  function handleSend() {
    if (!value.trim() || streaming) return
    onSend()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={cn(
        'rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-card)] transition-all duration-200 focus-within:border-[var(--color-primary)]/50 focus-within:shadow-[var(--shadow-float)]',
        className,
      )}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={streaming}
        className="max-h-40 min-h-10 resize-none border-none bg-transparent px-2 py-1.5 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="mt-1 flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-[var(--color-muted-foreground)]">Enter 发送 · Shift+Enter 换行</p>
        <div className="flex items-center gap-2">
          {streaming ? (
            <button
              type="button"
              aria-label="停止生成"
              title="停止生成"
              onClick={onStop}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-foreground)] text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              aria-label="发送"
              title="发送"
              disabled={!value.trim()}
              onClick={handleSend}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-all duration-150 enabled:hover:scale-105 enabled:hover:shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-30 active:enabled:scale-95"
              style={{ background: value.trim() ? 'var(--gradient-brand)' : 'var(--color-foreground)' }}
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
