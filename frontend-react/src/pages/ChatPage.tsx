import { useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'

import AppShell from '@/components/layout/AppShell'
import ChatComposer from '@/components/chat/ChatComposer'
import InterruptDialog from '@/components/chat/InterruptDialog'
import MessageList from '@/components/chat/MessageList'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'

function shortSessionId(id: string): string {
  if (!id) return '…'
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const ensure = useSessionsStore((s) => s.ensure)

  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const error = useChatStore((s) => s.error)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const clear = useChatStore((s) => s.clear)

  const prevSessionId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!sessionId) {
      const id = crypto.randomUUID()
      ensure(id)
      navigate(`/chat/${id}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    if (sessionId !== prevSessionId.current) {
      clear()
      prevSessionId.current = sessionId
    }
  }, [sessionId, clear])

  function onSend(text: string) {
    if (!sessionId) return
    void send(sessionId, text)
  }

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-6 py-3 backdrop-blur-sm">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-foreground)]">当前会话</div>
            <div
              className="truncate font-mono text-xs text-[var(--color-muted-foreground)]"
              title={sessionId || undefined}
            >
              {shortSessionId(sessionId ?? '')}
            </div>
          </div>
          {streaming && (
            <div className="shrink-0 rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
              生成中…
            </div>
          )}
        </header>

        <MessageList messages={messages} />

        {error && (
          <div className="px-6 pb-2">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </div>
        )}

        <ChatComposer streaming={streaming} onSend={onSend} onStop={stop} />
      </div>
      <InterruptDialog />
    </AppShell>
  )
}
