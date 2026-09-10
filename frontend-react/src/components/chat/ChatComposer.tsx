import { Send, Square } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export default function ChatComposer({
  streaming,
  onSend,
  onStop,
}: {
  streaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [input, setInput] = useState('')

  function handleSend() {
    if (!input.trim() || streaming) return
    onSend(input)
    setInput('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 shadow-[var(--shadow-card)] transition-shadow duration-200 focus-within:border-[var(--color-primary)] focus-within:shadow-md">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="输入数据分析问题，例如：上周销售额按品类汇总…"
            disabled={streaming}
            className="resize-none border-none bg-transparent px-1 py-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--color-muted-foreground)]">Enter 发送 · Shift+Enter 换行</p>
            <div className="flex items-center gap-2">
              {streaming && (
                <Button variant="outline" className="h-10 min-w-[5.5rem] rounded-xl" onClick={onStop}>
                  <Square className="mr-1" size={16} />
                  停止
                </Button>
              )}
              <Button
                className="h-10 min-w-[5.5rem] rounded-xl"
                disabled={!input.trim() || streaming}
                onClick={handleSend}
              >
                {!streaming && <Send className="mr-1" size={16} />}
                发送
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
