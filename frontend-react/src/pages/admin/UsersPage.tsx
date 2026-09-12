import { Plus, User } from 'lucide-react'
import { useEffect, useState } from 'react'

import { deleteUser, listUsers, patchUser, type UserOut } from '@/api/users'
import { useAuthStore } from '@/stores/auth'
import AppShell from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import CreateUserDialog from './CreateUserDialog'

const ROLES = ['admin', 'analyst', 'viewer']

export default function UsersPage() {
  const currentUserId = useAuthStore((s) => s.userId)
  const [users, setUsers] = useState<UserOut[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<UserOut | null>(null)

  function isSelf(row: UserOut) {
    return !!currentUserId && row.id === currentUserId
  }

  function isLastAdmin(row: UserOut) {
    if (row.role !== 'admin') return false
    return users.filter((u) => u.role === 'admin').length <= 1
  }

  function deleteDisabledReason(row: UserOut): string | undefined {
    if (isSelf(row)) return '不能删除当前登录账号'
    if (isLastAdmin(row)) return '必须保留至少一名管理员'
    return undefined
  }

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      setUsers(await listUsers())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function toggleActive(row: UserOut) {
    setError(null)
    try {
      await patchUser(row.id, { is_active: !row.is_active })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败')
    }
  }

  async function changeRole(row: UserOut, role: string) {
    setError(null)
    try {
      await patchUser(row.id, { role })
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败')
    }
  }

  function requestDelete(row: UserOut) {
    const reason = deleteDisabledReason(row)
    if (reason) {
      setError(reason)
      return
    }
    setError(null)
    setPendingDelete(row)
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const row = pendingDelete
    setError(null)
    try {
      await deleteUser(row.id)
      setPendingDelete(null)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
      setPendingDelete(null)
    }
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-auto bg-[var(--color-background)] p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-primary)]"
                aria-hidden="true"
              >
                <User size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
                  用户管理
                </h1>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                  管理账号角色、启用状态与删除
                </p>
              </div>
            </div>
            <Button className="h-10 rounded-xl" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1" size={16} />
              创建用户
            </Button>
          </div>

          {error && <p className="mb-3 text-sm text-[var(--color-destructive)]">{error}</p>}

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-slate-400">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-slate-400">
                      暂无用户
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.username}</TableCell>
                      <TableCell>
                        <Select value={row.role} onValueChange={(v) => void changeRole(row, v)}>
                          <SelectTrigger className="h-8 w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? 'default' : 'secondary'}>
                          {row.is_active ? '启用' : '停用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="link" size="sm" onClick={() => void toggleActive(row)}>
                          {row.is_active ? '停用' : '启用'}
                        </Button>
                        <Button
                          variant="link"
                          size="sm"
                          className="text-[var(--color-destructive)]"
                          disabled={!!deleteDisabledReason(row)}
                          title={deleteDisabledReason(row)}
                          onClick={() => requestDelete(row)}
                        >
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refresh} />

        <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除用户</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">
              {pendingDelete
                ? `确认永久删除用户「${pendingDelete.username}」？此操作不可恢复。`
                : null}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                取消
              </Button>
              <Button variant="destructive" onClick={() => void confirmDelete()}>
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  )
}
