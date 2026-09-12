import { type KeyboardEvent, useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { abortChatInterrupt } from '@/api/chat'
import { sanitizeInterruptText } from '@/lib/interruptText'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'

export default function InterruptPrompt() {
  const lastInterrupt = useChatStore((s) => s.lastInterrupt)
  const sessionId = useChatStore((s) => s.sessionId)
  const [customReply, setCustomReply] = useState('')

  useEffect(() => {
    setCustomReply('')
  }, [lastInterrupt?.text, lastInterrupt?.buttons])

  if (!lastInterrupt) return null

  function clearInterruptUi() {
    useChatStore.setState({ lastInterrupt: null })
  }

  async function dismissInterrupt() {
    const sid = sessionId
    clearInterruptUi()
    if (!sid) return
    const auth = useAuthStore.getState()
    try {
      await abortChatInterrupt(sid, {
        getAccessToken: () => auth.accessToken,
        getStoredRefresh: () => auth.getStoredRefresh(),
        refresh: () => auth.refresh(),
      })
    } catch {
      /* UI already dismissed; server abort is best-effort */
    }
  }

  function choose(option: string) {
    const text = option.trim()
    if (!text) return
    const sid = sessionId
    clearInterruptUi()
    if (sid) void useChatStore.getState().send(sid, text)
  }

  function submitCustom() {
    choose(customReply)
  }

  function onCustomKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitCustom()
    }
  }

  const displayText = sanitizeInterruptText(lastInterrupt.text)
  const buttons = (lastInterrupt.buttons ?? []).map((b) => String(b))
  const canSubmitCustom = Boolean(customReply.trim())

  return (
    <div
      role="region"
      aria-label="需要你的确认"
      className="mb-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-3 shadow-sm"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--color-foreground)]">需要你的确认</div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--color-muted-foreground)]">
            {displayText ?? (buttons.length ? '请选择以下选项继续' : '请输入你的回复以继续对话')}
          </p>
        </div>
        <button
          type="button"
          aria-label="关闭确认"
          title="关闭"
          onClick={() => void dismissInterrupt()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <X size={14} />
        </button>
      </div>

      {buttons.length ? (
        <div className="flex flex-col gap-2">
          {buttons.map((option, i) => (
            <Button
              key={i}
              variant="outline"
              className="h-auto min-h-8 justify-start whitespace-normal bg-[var(--color-card)] px-3 py-2 text-left font-normal leading-snug"
              onClick={() => choose(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}

      <div className={`flex items-center gap-2 ${buttons.length ? 'mt-2' : ''}`}>
        <Input
          value={customReply}
          onChange={(e) => setCustomReply(e.target.value)}
          onKeyDown={onCustomKeyDown}
          placeholder="其他，请手动填写…"
          aria-label="手动填写回复"
          className="bg-[var(--color-card)]"
        />
        <Button variant="default" disabled={!canSubmitCustom} onClick={submitCustom} className="shrink-0">
          提交
        </Button>
      </div>
    </div>
  )
}
