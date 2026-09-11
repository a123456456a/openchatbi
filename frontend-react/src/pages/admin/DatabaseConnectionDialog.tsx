import { useEffect, useMemo, useState } from 'react'

import {
  createDatabaseConnection,
  testDatabaseConnectionDraft,
  testExistingDatabaseConnection,
  updateDatabaseConnection,
  type DatabaseConnection,
  type DatabaseConnectionInput,
  type DialectCatalogItem,
} from '@/api/databaseConnections'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

type FormState = {
  name: string
  dialect: string
  host: string
  port: string
  database: string
  username: string
  password: string
  uri_override: string
  catalog_database_name: string
  token_service_url: string
  token_username: string
  token_password: string
}

const EMPTY_FORM: FormState = {
  name: '',
  dialect: 'mysql',
  host: '',
  port: '',
  database: '',
  username: '',
  password: '',
  uri_override: '',
  catalog_database_name: '',
  token_service_url: '',
  token_username: '',
  token_password: '',
}

function formFromConnection(row: DatabaseConnection): FormState {
  return {
    name: row.name,
    dialect: row.dialect,
    host: row.host ?? '',
    port: row.port ? String(row.port) : '',
    database: row.database ?? '',
    username: row.username ?? '',
    password: '',
    uri_override: '',
    catalog_database_name: row.catalog_database_name ?? '',
    token_service_url: row.token_service_url ?? '',
    token_username: row.token_username ?? '',
    token_password: '',
  }
}

/**
 * Owns form state so keystrokes only re-render this dialog — not AppShell / the connections table.
 */
export default function DatabaseConnectionDialog({
  open,
  onOpenChange,
  editing,
  catalog,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: DatabaseConnection | null
  catalog: DialectCatalogItem[]
  onSaved: () => void | Promise<void>
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm(formFromConnection(editing))
      setShowAdvanced(Boolean(editing.has_uri_override || editing.token_service_url))
    } else {
      setForm(EMPTY_FORM)
      setShowAdvanced(false)
    }
    setFormError(null)
    setTestResult(null)
  }, [open, editing])

  const dialectMeta = useMemo(
    () => catalog.find((d) => d.id === form.dialect) ?? null,
    [catalog, form.dialect],
  )

  function buildPayload(): DatabaseConnectionInput {
    return {
      name: form.name.trim(),
      dialect: form.dialect,
      host: form.host.trim() || null,
      port: form.port.trim() ? Number(form.port.trim()) : null,
      database: form.database.trim() || null,
      username: form.username.trim() || null,
      password: form.password || undefined,
      uri_override: form.uri_override.trim() || null,
      catalog_database_name: form.catalog_database_name.trim() || null,
      token_service_url: form.token_service_url.trim() || null,
      token_username: form.token_username.trim() || null,
      token_password: form.token_password || undefined,
    }
  }

  async function onTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const hasNewSecret = Boolean(form.password || form.token_password)
      const result =
        editing && !hasNewSecret
          ? await testExistingDatabaseConnection(editing.id)
          : await testDatabaseConnectionDraft(buildPayload())
      setTestResult(result)
    } catch (e) {
      setTestResult({ ok: false, detail: e instanceof Error ? e.message : '测试失败' })
    } finally {
      setTesting(false)
    }
  }

  async function onSave() {
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await updateDatabaseConnection(editing.id, buildPayload())
      } else {
        await createDatabaseConnection(buildPayload())
      }
      onOpenChange(false)
      await onSaved()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const canSave = form.name.trim().length > 0 && form.dialect.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑数据库连接' : '添加数据库连接'}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="db-name">连接名称</Label>
            <Input
              id="db-name"
              placeholder="例如：生产环境 MySQL"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>数据库类型</Label>
            <Select value={form.dialect} onValueChange={(v) => setForm((f) => ({ ...f, dialect: v }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dialectMeta?.requires_host && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="db-host">主机地址</Label>
                <Input
                  id="db-host"
                  placeholder="host.example.com"
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="db-port">端口</Label>
                <Input
                  id="db-port"
                  inputMode="numeric"
                  placeholder={dialectMeta.default_port ? String(dialectMeta.default_port) : ''}
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                />
              </div>
            </div>
          )}

          {dialectMeta?.requires_database && (
            <div className="space-y-1.5">
              <Label htmlFor="db-database">{dialectMeta.database_label}</Label>
              <Input
                id="db-database"
                placeholder={dialectMeta.database_placeholder}
                value={form.database}
                onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
              />
            </div>
          )}

          {dialectMeta?.requires_username && (
            <div className="space-y-1.5">
              <Label htmlFor="db-username">用户名</Label>
              <Input
                id="db-username"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              />
            </div>
          )}

          {dialectMeta?.requires_password && (
            <div className="space-y-1.5">
              <Label htmlFor="db-password">密码</Label>
              <Input
                id="db-password"
                type="password"
                placeholder={editing?.has_password ? '留空则保持原密码不变' : ''}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          )}

          <button
            type="button"
            className="text-sm font-medium text-[var(--color-primary)]"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? '隐藏高级选项' : '高级选项（自定义连接串 / Token 认证）'}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-lg border border-[var(--color-border)] p-3">
              <div className="space-y-1.5">
                <Label htmlFor="db-uri-override">自定义连接串（可选）</Label>
                <Textarea
                  id="db-uri-override"
                  placeholder="postgresql+psycopg://user:pass@host:5432/db，填写后忽略以上主机/端口等字段"
                  value={form.uri_override}
                  onChange={(e) => setForm((f) => ({ ...f, uri_override: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="db-catalog-name">Catalog 中的数据库名（可选）</Label>
                <Input
                  id="db-catalog-name"
                  placeholder="用于在数据目录中标识该库，默认沿用上方数据库名"
                  value={form.catalog_database_name}
                  onChange={(e) => setForm((f) => ({ ...f, catalog_database_name: e.target.value }))}
                />
              </div>
              {dialectMeta?.supports_token_service && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="db-token-service">Token 服务地址（可选）</Label>
                    <Input
                      id="db-token-service"
                      placeholder="https://tokens.example.com/v1"
                      value={form.token_service_url}
                      onChange={(e) => setForm((f) => ({ ...f, token_service_url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="db-token-username">Token 服务用户名</Label>
                    <Input
                      id="db-token-username"
                      value={form.token_username}
                      onChange={(e) => setForm((f) => ({ ...f, token_username: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="db-token-password">Token 服务密码</Label>
                    <Input
                      id="db-token-password"
                      type="password"
                      placeholder={editing?.has_token_password ? '留空则保持原密码不变' : ''}
                      value={form.token_password}
                      onChange={(e) => setForm((f) => ({ ...f, token_password: e.target.value }))}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {testResult && (
            <Alert variant={testResult.ok ? 'default' : 'destructive'}>
              <AlertDescription>{testResult.ok ? '连接成功' : testResult.detail}</AlertDescription>
            </Alert>
          )}
          {formError && <p className="text-sm text-[var(--color-destructive)]">{formError}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={testing} onClick={() => void onTest()}>
            {testing ? '测试中…' : '测试连接'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button disabled={saving || !canSave} onClick={() => void onSave()}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
