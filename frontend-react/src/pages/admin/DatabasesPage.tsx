import { Database, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  activateDatabaseConnection,
  applyCanonicalActive,
  deleteDatabaseConnection,
  fetchDatabaseConnections,
  type DatabaseConnection,
  type DialectCatalogItem,
} from '@/api/databaseConnections'
import AppShell from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { runtimeApplyNotice } from '@/lib/runtimeApplyMessage'
import DatabaseConnectionDialog from './DatabaseConnectionDialog'

function connectionSummary(row: DatabaseConnection): string {
  if (row.has_uri_override) return '自定义连接串'
  const parts = [row.host, row.port ? `:${row.port}` : '', row.database ? `/${row.database}` : '']
  return parts.join('') || '—'
}

export default function DatabasesPage() {
  const [rows, setRows] = useState<DatabaseConnection[]>([])
  const [catalog, setCatalog] = useState<DialectCatalogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DatabaseConnection | null>(null)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [activateNotice, setActivateNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  )

  async function refresh(opts?: { quiet?: boolean }) {
    if (!opts?.quiet) setLoading(true)
    setError(null)
    try {
      const res = await fetchDatabaseConnections()
      // Canonical active id — not the activate payload alone — drives list badges
      // after sync-failure rollback (#19).
      setRows(applyCanonicalActive(res.connections, res.active_connection_id))
      setCatalog(res.catalog)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      if (!opts?.quiet) setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function openCreateDialog() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEditDialog(row: DatabaseConnection) {
    setEditing(row)
    setDialogOpen(true)
  }

  async function onActivate(row: DatabaseConnection) {
    setActivatingId(row.id)
    setError(null)
    setActivateNotice(null)
    try {
      const updated = await activateDatabaseConnection(row.id)
      if (updated.runtime_apply) {
        setActivateNotice(runtimeApplyNotice(updated.runtime_apply))
      }
      // Always re-list after activate (incl. sync-fail rollback). Do not merge the
      // single activate row into local state — that omits restoring previous active.
      await refresh({ quiet: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : '切换失败')
    } finally {
      setActivatingId(null)
    }
  }

  async function onDelete(row: DatabaseConnection) {
    setError(null)
    try {
      await deleteDatabaseConnection(row.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
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
                <Database size={20} />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-[var(--color-foreground)]">
                  数据库连接管理
                </h1>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                  配置用于问答的数据仓库连接，支持随时切换当前使用的数据库
                </p>
              </div>
            </div>
            <Button className="h-10 rounded-xl" onClick={openCreateDialog}>
              <Plus className="mr-1" size={16} />
              添加数据库连接
            </Button>
          </div>

          {error && <p className="mb-3 text-sm text-[var(--color-destructive)]">{error}</p>}
          {activateNotice && (
            <p
              className={`mb-3 text-sm ${
                activateNotice.tone === 'warning'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
              }`}
              role="status"
            >
              {activateNotice.text}
            </p>
          )}

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>连接地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-slate-400">
                      加载中…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-slate-400">
                      暂无数据库连接，点击右上角添加
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell>
                        {catalog.find((d) => d.id === row.dialect)?.label ?? row.dialect}
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">{connectionSummary(row)}</TableCell>
                      <TableCell>
                        <Badge variant={row.is_active ? 'default' : 'secondary'}>
                          {row.is_active ? '当前使用' : '未启用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!row.is_active && (
                            <Button
                              variant="link"
                              size="sm"
                              disabled={activatingId === row.id}
                              onClick={() => void onActivate(row)}
                            >
                              {activatingId === row.id ? '切换中…' : '设为当前'}
                            </Button>
                          )}
                          <Button variant="link" size="sm" onClick={() => openEditDialog(row)}>
                            编辑
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-[var(--color-destructive)]"
                            disabled={row.is_active}
                            title={row.is_active ? '请先切换到其他数据库再删除' : undefined}
                            onClick={() => void onDelete(row)}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DatabaseConnectionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={editing}
          catalog={catalog}
          onSaved={refresh}
        />
      </div>
    </AppShell>
  )
}
