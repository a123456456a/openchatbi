import { Plus, User } from 'lucide-react'
import { useEffect, useState } from 'react'

import { listUsers, patchUser, type UserOut } from '@/api/users'
import AppShell from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import CreateUserDialog from './CreateUserDialog'

const ROLES = ['admin', 'analyst', 'viewer']

export default function UsersPage() {
  const [users, setUsers] = useState<UserOut[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

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
                  管理账号角色与启用状态
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={refresh} />
      </div>
    </AppShell>
  )
}
