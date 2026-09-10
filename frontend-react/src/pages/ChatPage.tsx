import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'

import AppShell from '@/components/layout/AppShell'
import { useSessionsStore } from '@/stores/sessions'

export default function ChatPage() {
  const navigate = useNavigate()
  const { sessionId } = useParams()
  const ensure = useSessionsStore((s) => s.ensure)

  useEffect(() => {
    if (!sessionId) {
      const id = crypto.randomUUID()
      ensure(id)
      navigate(`/chat/${id}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        会话：{sessionId ?? '…'}
      </div>
    </AppShell>
  )
}
