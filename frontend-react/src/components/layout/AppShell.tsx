import { MessageSquare, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSessionsStore } from '@/stores/sessions'
import SettingsDialog from './SettingsDialog'
import SidebarFooter from './SidebarFooter'

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const params = useParams()
  const sessions = useSessionsStore((s) => s.sessions)
  const ensure = useSessionsStore((s) => s.ensure)

  function newChat() {
    const id = crypto.randomUUID()
    ensure(id)
    navigate(`/chat/${id}`)
  }

  function openSession(id: string) {
    navigate(`/chat/${id}`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="border-b border-[var(--color-border)] p-4">
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-sm"
              aria-hidden="true"
            >
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-tight text-[var(--color-foreground)]">
                OpenChatBI
              </div>
              <div className="text-xs text-[var(--color-muted-foreground)]">智能数据分析对话</div>
            </div>
          </div>
          <Button className="h-10 w-full rounded-xl" onClick={newChat}>
            <Plus className="mr-1" size={16} />
            新建会话
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2" aria-label="会话列表">
          {sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
              暂无会话，点击上方开始
            </div>
          ) : (
            sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={
                  'group mb-0.5 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200 ' +
                  (params.sessionId === s.id
                    ? 'bg-[var(--color-muted)] font-medium text-[var(--color-primary)] shadow-[inset_3px_0_0_0_var(--color-primary)]'
                    : 'text-slate-600 hover:bg-slate-50')
                }
                onClick={() => openSession(s.id)}
              >
                <span className="truncate">{s.title}</span>
              </button>
            ))
          )}
        </nav>

        <SidebarFooter />
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>

      <SettingsDialog />
    </div>
  )
}
