import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import AppShell from '@/components/layout/AppShell'
import ChatComposer from '@/components/chat/ChatComposer'
import ChatWelcome from '@/components/chat/ChatWelcome'
import InterruptDialog from '@/components/chat/InterruptDialog'
import MessageList from '@/components/chat/MessageList'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'

/** Must match `MISSING_LLM_SETTINGS_DETAIL` in `backend/chat/routes.py`. */
const MISSING_LLM_SETTINGS_DETAIL = '请先在设置中配置模型'

export default function ChatPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const ensure = useSessionsStore((s) => s.ensure)

  const messages = useChatStore((s) => s.messages)
  const streaming = useChatStore((s) => s.streaming)
  const error = useChatStore((s) => s.error)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const loadSession = useChatStore((s) => s.loadSession)
  const openSettings = useSettingsStore((s) => s.openSettings)

  const [input, setInput] = useState('')

  useEffect(() => {
    if (!sessionId) {
      const id = crypto.randomUUID()
      ensure(id)
      navigate(`/chat/${id}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    if (sessionId) loadSession(sessionId)
  }, [sessionId, loadSession])

  function onSend() {
    if (!sessionId || !input.trim()) return
    const text = input
    setInput('')
    void send(sessionId, text)
  }

  const hasMessages = messages.length > 0

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
        {hasMessages && (
          <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-6 py-3 backdrop-blur-sm">
            <div className="min-w-0 text-sm font-semibold text-[var(--color-foreground)]">当前会话</div>
            {streaming && (
              <div className="shrink-0 rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
                生成中…
              </div>
            )}
          </header>
        )}

        {hasMessages ? (
          <>
            <MessageList messages={messages} />

            {error && (
              <div className="px-6 pb-2">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                  {error === MISSING_LLM_SETTINGS_DETAIL && (
                    <AlertAction>
                      <Button size="sm" variant="outline" onClick={openSettings}>
                        去设置
                      </Button>
                    </AlertAction>
                  )}
                </Alert>
              </div>
            )}

            <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="mx-auto max-w-3xl">
                <ChatComposer value={input} onChange={setInput} streaming={streaming} onSend={onSend} onStop={stop} />
              </div>
            </div>
          </>
        ) : (
          <>
            <ChatWelcome value={input} onChange={setInput} streaming={streaming} onSend={onSend} onStop={stop} />
            {error && (
              <div className="px-6 pb-6">
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                  {error === MISSING_LLM_SETTINGS_DETAIL && (
                    <AlertAction>
                      <Button size="sm" variant="outline" onClick={openSettings}>
                        去设置
                      </Button>
                    </AlertAction>
                  )}
                </Alert>
              </div>
            )}
          </>
        )}
      </div>
      <InterruptDialog />
    </AppShell>
  )
}
