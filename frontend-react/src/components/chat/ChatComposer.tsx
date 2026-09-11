import { ArrowUp, Plus, Square } from 'lucide-react'
import { type KeyboardEvent } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import ModelPicker from './ModelPicker'

export default function ChatComposer({
  value,
  onChange,
  streaming,
  onSend,
  onStop,
  onNewChat,
  autoFocus,
  placeholder = '输入数据分析问题，例如：上周销售额按品类汇总…',
  className,
}: {
  value: string
  onChange: (value: string) => void
  streaming: boolean
  onSend: () => void
  onStop: () => void
  /** Optional "+" affordance (single-row pill layout) to jump straight into a fresh session. */
  onNewChat?: () => void
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
        'flex items-end gap-1 rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-1.5 pl-2 shadow-[var(--shadow-card)] transition-all duration-200 focus-within:border-[var(--color-primary)]/50 focus-within:shadow-[var(--shadow-float)]',
        className,
      )}
    >
      {onNewChat && (
        <button
          type="button"
          aria-label="新建会话"
          title="新建会话"
          onClick={onNewChat}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors duration-150 hover:bg-[var(--color-muted)] hover:text-[var(--color-primary)]"
        >
          <Plus size={18} />
        </button>
      )}

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        autoFocus={autoFocus}
        placeholder={placeholder}
        disabled={streaming}
        className="max-h-40 min-h-9 flex-1 resize-none border-none bg-transparent px-1.5 py-1.5 text-[15px] shadow-none focus-visible:ring-0 dark:bg-transparent"
      />

      <ModelPicker />

      {streaming ? (
        <button
          type="button"
          aria-label="停止生成"
          title="停止生成"
          onClick={onStop}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-foreground)] text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95"
        >
          <Square size={14} fill="currentColor" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="发送"
          title="发送 (Enter) · 换行 (Shift+Enter)"
          disabled={!value.trim()}
          onClick={handleSend}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-all duration-150 enabled:hover:scale-105 enabled:hover:shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-30 active:enabled:scale-95"
          style={{ background: value.trim() ? 'var(--gradient-brand)' : 'var(--color-foreground)' }}
        >
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  )
}
