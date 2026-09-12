import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  STALE_WAREHOUSE_SESSION_MESSAGE,
  STALE_WAREHOUSE_SIDEBAR_BADGE,
  isSessionWarehouseStale,
} from '@/lib/sessionWarehouse'
import { useAuthStore } from '@/stores/auth'
import { useSessionsStore, type SessionMeta } from '@/stores/sessions'
import DemoWarehouseBanner from '@/components/common/DemoWarehouseBanner'
import SettingsDialog from './SettingsDialog'
import SidebarFooter from './SidebarFooter'

/** Groups sessions into 今天/昨天/更早 buckets by `updatedAt`, newest first within each. */
function groupByDay(list: SessionMeta[]): { label: string; sessions: SessionMeta[] }[] {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todayMs = startOfToday.getTime()
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000

  const today: SessionMeta[] = []
  const yesterday: SessionMeta[] = []
  const earlier: SessionMeta[] = []
  for (const s of list) {
    if (s.updatedAt >= todayMs) today.push(s)
    else if (s.updatedAt >= yesterdayMs) yesterday.push(s)
    else earlier.push(s)
  }

  return [
    { label: '今天', sessions: today },
    { label: '昨天', sessions: yesterday },
    { label: '更早', sessions: earlier },
  ].filter((g) => g.sessions.length > 0)
}

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const params = useParams()
  const sessions = useSessionsStore((s) => s.sessions)
  const ensure = useSessionsStore((s) => s.ensure)
  const archive = useSessionsStore((s) => s.archive)
  const unarchive = useSessionsStore((s) => s.unarchive)
  const remove = useSessionsStore((s) => s.remove)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  /** `undefined` until `/api/warehouse/status` resolves; then mirrors `active_connection_id`. */
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | null | undefined>(undefined)

  const refreshWarehouseStatus = useCallback(() => {
    if (!isAuthenticated) {
      setActiveWarehouseId(undefined)
      return
    }
    void fetchWarehouseStatus()
      .then((status) => {
        setActiveWarehouseId(status.active_connection_id)
      })
      .catch(() => {
        // Soft-fail: leave previous known id (or undefined) so we do not flash false positives.
      })
  }, [isAuthenticated])

  useEffect(() => {
    refreshWarehouseStatus()
  }, [refreshWarehouseStatus])

  useEffect(() => {
    function onFocus() {
      refreshWarehouseStatus()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') refreshWarehouseStatus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refreshWarehouseStatus])

  function sessionIsStale(s: SessionMeta) {
    return isSessionWarehouseStale(s.warehouseConnectionId, activeWarehouseId)
  }
  // Keep the search field responsive; defer filtering/re-layout of the session list (INP).
  const deferredQuery = useDeferredValue(query)

  const normalizedQuery = deferredQuery.trim().toLowerCase()
  const matchesQuery = (s: SessionMeta) => !normalizedQuery || s.title.toLowerCase().includes(normalizedQuery)

  const activeSessions = useMemo(
    () => sessions.filter((s) => !s.archived && matchesQuery(s)),
    // matchesQuery closes over normalizedQuery
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, normalizedQuery],
  )
  const archivedSessions = useMemo(
    () => sessions.filter((s) => s.archived && matchesQuery(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, normalizedQuery],
  )
  const groupedActiveSessions = useMemo(() => groupByDay(activeSessions), [activeSessions])

  function newChat() {
    const id = crypto.randomUUID()
    ensure(id)
    navigate(`/chat/${id}`)
  }

  function openSession(id: string) {
    navigate(`/chat/${id}`)
  }

  function confirmDelete() {
    if (!pendingDeleteId) return
    const deletingCurrent = params.sessionId === pendingDeleteId
    remove(pendingDeleteId)
    setPendingDeleteId(null)
    if (deletingCurrent) newChat()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-background)]">
      <DemoWarehouseBanner />
      <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="border-b border-[var(--color-border)] p-4">
          <div className="mb-4 flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-[var(--shadow-glow)]"
              style={{ background: 'var(--gradient-brand)' }}
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
          <Button
            className="h-10 w-full rounded-xl shadow-sm transition-transform duration-150 active:scale-[0.98]"
            onClick={newChat}
          >
            <Plus className="mr-1 transition-transform duration-150 group-hover/button:rotate-90" size={16} />
            新建会话
          </Button>
          <div className="relative mt-2">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-muted-foreground)]"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索会话"
              aria-label="搜索会话"
              className="h-9 rounded-lg border-none bg-[var(--color-muted)] pl-8 text-sm shadow-none focus-visible:ring-1"
            />
          </div>
        </div>

        <nav className="scroll-thin flex-1 overflow-y-auto p-2" aria-label="会话列表">
          {activeSessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--color-muted-foreground)]">
              {query ? '没有匹配的会话' : '暂无会话，点击上方开始'}
            </div>
          ) : (
            groupedActiveSessions.map((group) => (
              <div key={group.label} className="mb-1">
                <div className="px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--color-muted-foreground)] uppercase">
                  {group.label}
                </div>
                {group.sessions.map((s) => {
                  const stale = sessionIsStale(s)
                  return (
                  <div
                    key={s.id}
                    className={
                      'group mb-0.5 flex items-center gap-1 rounded-lg transition-colors duration-200 ' +
                      (params.sessionId === s.id ? 'bg-[var(--color-muted)]' : 'hover:bg-[var(--color-muted)]/60') +
                      (stale ? ' opacity-70' : '')
                    }
                  >
                    <button
                      type="button"
                      title={stale ? STALE_WAREHOUSE_SESSION_MESSAGE : undefined}
                      aria-label={stale ? `${s.title}（${STALE_WAREHOUSE_SIDEBAR_BADGE}）` : undefined}
                      className={
                        'relative flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-200 ' +
                        (stale
                          ? 'text-[var(--color-muted-foreground)]'
                          : params.sessionId === s.id
                            ? 'font-medium text-[var(--color-primary)]'
                            : 'text-slate-600 group-hover:text-[var(--color-foreground)]')
                      }
                      onClick={() => openSession(s.id)}
                    >
                      {params.sessionId === s.id && (
                        <span
                          className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full"
                          style={{ background: 'var(--gradient-brand)' }}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{s.title}</span>
                      {stale ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto shrink-0 border-amber-200/80 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-800"
                        >
                          {STALE_WAREHOUSE_SIDEBAR_BADGE}
                        </Badge>
                      ) : null}
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label="会话操作"
                          className="shrink-0 rounded-md p-1.5 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 data-open:bg-black/5 data-open:opacity-100"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => archive(s.id)}>
                          <Archive size={14} className="mr-1.5" />
                          归档
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => setPendingDeleteId(s.id)}>
                          <Trash2 size={14} className="mr-1.5" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  )
                })}
              </div>
            ))
          )}

          {archivedSessions.length > 0 && (
            <Collapsible className="mt-2 border-t border-[var(--color-border)] pt-2">
              <CollapsibleTrigger className="group/archive-trigger flex w-full items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]/60 hover:text-[var(--color-foreground)]">
                <ChevronRight size={12} className="transition-transform duration-150 data-open:rotate-90" />
                已归档（{archivedSessions.length}）
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-0.5 space-y-0.5">
                {archivedSessions.map((s) => {
                  const stale = sessionIsStale(s)
                  return (
                  <div
                    key={s.id}
                    className={
                      'group flex min-w-0 items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ' +
                      (stale ? 'text-[var(--color-muted-foreground)] opacity-70 ' : 'text-slate-500 ') +
                      (params.sessionId === s.id ? 'bg-[var(--color-muted)]' : 'hover:bg-[var(--color-muted)]/60')
                    }
                  >
                    <button
                      type="button"
                      title={stale ? STALE_WAREHOUSE_SESSION_MESSAGE : undefined}
                      aria-label={stale ? `${s.title}（${STALE_WAREHOUSE_SIDEBAR_BADGE}）` : undefined}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 truncate text-left"
                      onClick={() => openSession(s.id)}
                    >
                      <span className="truncate">{s.title}</span>
                      {stale ? (
                        <Badge
                          variant="secondary"
                          className="ml-auto shrink-0 border-amber-200/80 bg-amber-50 px-1.5 text-[10px] font-medium text-amber-800"
                        >
                          {STALE_WAREHOUSE_SIDEBAR_BADGE}
                        </Badge>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      aria-label="恢复会话"
                      title="恢复"
                      className="shrink-0 rounded-md p-1.5 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5"
                      onClick={() => unarchive(s.id)}
                    >
                      <ArchiveRestore size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label="删除会话"
                      title="删除"
                      className="shrink-0 rounded-md p-1.5 text-[var(--color-destructive)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50"
                      onClick={() => setPendingDeleteId(s.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  )
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </nav>

        <SidebarFooter />
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</section>

      <SettingsDialog />

      <Dialog open={!!pendingDeleteId} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除会话</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">删除后该会话的对话历史将无法恢复，确认删除吗？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
