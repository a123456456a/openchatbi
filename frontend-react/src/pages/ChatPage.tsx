import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import AppShell from '@/components/layout/AppShell'
import StaleWarehouseSessionBanner from '@/components/common/StaleWarehouseSessionBanner'
import ChatComposer from '@/components/chat/ChatComposer'
import ChatWelcome from '@/components/chat/ChatWelcome'
import InterruptPrompt from '@/components/chat/InterruptPrompt'
import MessageList from '@/components/chat/MessageList'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'
import { useSettingsStore } from '@/stores/settings'
import { canAskData, canManageLlm } from '@/lib/roles'

/** Must match `MISSING_LLM_SETTINGS_DETAIL` in `backend/chat/routes.py`. */
const MISSING_LLM_SETTINGS_DETAIL = '请先在设置中配置模型'
/** Must match `MISSING_WAREHOUSE_DETAIL` in `backend/warehouse/gate.py`. */
const MISSING_WAREHOUSE_DETAIL = '请先在管理端激活数仓'

function ChatErrorBanner() {
  const navigate = useNavigate()
  const error = useChatStore((s) => s.error)
  const openSettings = useSettingsStore((s) => s.openSettings)
  const role = useAuthStore((s) => s.role)
  if (!error) return null

  return (
    <div className="px-6 pb-2">
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
        {error === MISSING_LLM_SETTINGS_DETAIL && canManageLlm(role) && (
          <AlertAction>
            <Button size="sm" variant="outline" onClick={openSettings}>
              去设置
            </Button>
          </AlertAction>
        )}
        {error === MISSING_WAREHOUSE_DETAIL && role === 'admin' && (
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/databases')}>
              去激活数仓
            </Button>
          </AlertAction>
        )}
      </Alert>
    </div>
  )
}

/** Owns the messages subscription so stream paints do not re-render the composer. */
function ChatTranscript() {
  const messages = useChatStore((s) => s.messages)
  return <MessageList messages={messages} />
}

function ChatStreamingBadge() {
  const streaming = useChatStore((s) => s.streaming)
  if (!streaming) return null
  return (
    <div className="shrink-0 rounded-full bg-[var(--color-muted)] px-3 py-1 text-xs font-medium text-[var(--color-primary)]">
      生成中…
    </div>
  )
}

/**
 * Composer input lives here (not in ChatPage) so each keystroke only re-renders this subtree —
 * not the markdown-heavy transcript. That is the main typing INP win once messages exist.
 */
function ActiveChatComposer({
  sessionId,
  sendDisabled = false,
}: {
  sessionId: string
  sendDisabled?: boolean
}) {
  const navigate = useNavigate()
  const ensure = useSessionsStore((s) => s.ensure)
  const streaming = useChatStore((s) => s.streaming)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const role = useAuthStore((s) => s.role)
  const readOnly = !canAskData(role)
  const [input, setInput] = useState('')

  useEffect(() => {
    setInput('')
  }, [sessionId])

  function onSend() {
    if (readOnly || sendDisabled || !input.trim()) return
    const text = input
    setInput('')
    void send(sessionId, text)
  }

  function newChat() {
    const id = crypto.randomUUID()
    ensure(id)
    navigate(`/chat/${id}`)
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mx-auto max-w-3xl">
        {!readOnly && <InterruptPrompt />}
        <ChatComposer
          value={input}
          onChange={setInput}
          streaming={streaming}
          onSend={onSend}
          onStop={stop}
          onNewChat={newChat}
          sendDisabled={sendDisabled}
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}

function WelcomePane({
  sessionId,
  sendDisabled = false,
}: {
  sessionId: string
  sendDisabled?: boolean
}) {
  const navigate = useNavigate()
  const streaming = useChatStore((s) => s.streaming)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const error = useChatStore((s) => s.error)
  const openSettings = useSettingsStore((s) => s.openSettings)
  const role = useAuthStore((s) => s.role)
  const readOnly = !canAskData(role)
  const [input, setInput] = useState('')

  useEffect(() => {
    setInput('')
  }, [sessionId])

  function onSend() {
    if (readOnly || sendDisabled || !input.trim()) return
    const text = input
    setInput('')
    void send(sessionId, text)
  }

  return (
    <>
      <ChatWelcome
        value={input}
        onChange={setInput}
        streaming={streaming}
        onSend={onSend}
        onStop={stop}
        sendDisabled={sendDisabled}
        readOnly={readOnly}
      />
      {error && (
        <div className="px-6 pb-6">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
            {error === MISSING_LLM_SETTINGS_DETAIL && canManageLlm(role) && (
              <AlertAction>
                <Button size="sm" variant="outline" onClick={openSettings}>
                  去设置
                </Button>
              </AlertAction>
            )}
            {error === MISSING_WAREHOUSE_DETAIL && role === 'admin' && (
              <AlertAction>
                <Button size="sm" variant="outline" onClick={() => navigate('/admin/databases')}>
                  去激活数仓
                </Button>
              </AlertAction>
            )}
          </Alert>
        </div>
      )}
    </>
  )
}

export default function ChatPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const ensure = useSessionsStore((s) => s.ensure)
  const loadSession = useChatStore((s) => s.loadSession)
  // Boolean selector: only re-render when empty ↔ non-empty flips, not on every stream token.
  const hasMessages = useChatStore((s) => s.messages.length > 0)
  const [warehouseStale, setWarehouseStale] = useState(false)

  useEffect(() => {
    setWarehouseStale(false)
  }, [sessionId])

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

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--color-background)]">
        {sessionId ? (
          <StaleWarehouseSessionBanner sessionId={sessionId} onStaleChange={setWarehouseStale} />
        ) : null}
        {hasMessages && sessionId ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/90 px-6 py-3 backdrop-blur-sm">
              <div className="min-w-0 text-sm font-semibold text-[var(--color-foreground)]">当前会话</div>
              <ChatStreamingBadge />
            </header>
            <ChatTranscript />
            <ChatErrorBanner />
            <ActiveChatComposer sessionId={sessionId} sendDisabled={warehouseStale} />
          </>
        ) : sessionId ? (
          <WelcomePane sessionId={sessionId} sendDisabled={warehouseStale} />
        ) : null}
      </div>
    </AppShell>
  )
}
