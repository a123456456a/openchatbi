import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore, type SettingsForm } from '@/stores/settings'
import type { LlmCatalogItem, LlmConfigRow } from '@/api/llmSettings'

const emptyForm: SettingsForm = { provider: '', api_key: '', model: '', base_url: '' }

export default function SettingsDialog() {
  const settingsOpen = useSettingsStore((s) => s.settingsOpen)
  const closeSettings = useSettingsStore((s) => s.closeSettings)
  const load = useSettingsStore((s) => s.load)
  const save = useSettingsStore((s) => s.save)
  const catalog = useSettingsStore((s) => s.catalog)
  const configs = useSettingsStore((s) => s.configs)
  const loading = useSettingsStore((s) => s.loading)

  const [form, setForm] = useState<SettingsForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function findCatalog(provider: string) {
    return catalog.find((item) => item.id === provider)
  }

  function findConfig(provider: string) {
    return configs.find((row) => row.provider === provider)
  }

  function applyProvider(
    provider: string,
    catalogList: LlmCatalogItem[] = catalog,
    configList: LlmConfigRow[] = configs,
  ) {
    const meta = catalogList.find((item) => item.id === provider)
    const existing = configList.find((row) => row.provider === provider)
    setForm({
      provider,
      api_key: '',
      model: existing?.model || meta?.default_model || '',
      base_url: existing?.base_url || meta?.default_base_url || '',
    })
  }

  useEffect(() => {
    if (!settingsOpen) return
    setError(null)
    setNotice(null)
    let active = true
    load()
      .then(() => {
        if (!active) return
        // Read the freshly loaded state directly instead of relying on the
        // `catalog`/`configs` closed over by this effect, which still hold
        // the values from before `load()` resolved (often empty on first
        // open) and would otherwise make the form fall back to provider
        // defaults even when a config was already saved.
        const state = useSettingsStore.getState()
        const firstId = state.catalog[0]?.id ?? ''
        applyProvider(state.activeProvider || firstId, state.catalog, state.configs)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : '加载设置失败')
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])

  const requiresBaseUrl = Boolean(findCatalog(form.provider)?.requires_base_url)
  const hasSavedKey = Boolean(findConfig(form.provider)?.has_key)

  const keyPlaceholder = (() => {
    const row = findConfig(form.provider)
    if (row?.has_key && row.api_key_masked) return row.api_key_masked
    return '请输入 API Key'
  })()

  const basePlaceholder = (() => {
    const meta = findCatalog(form.provider)
    if (meta?.requires_base_url) return '必填，例如 https://api.example.com/v1'
    return meta?.default_base_url || '可选'
  })()

  const canSave = (() => {
    if (!form.provider || !form.model.trim()) return false
    if (requiresBaseUrl && !form.base_url.trim()) return false
    const row = findConfig(form.provider)
    if (!form.api_key.trim() && !row?.has_key) return false
    return true
  })()

  const saveHint = (() => {
    if (requiresBaseUrl && !form.base_url.trim()) return 'OpenAI Compatible 必须填写 Base URL'
    const row = findConfig(form.provider)
    if (!form.api_key.trim() && !row?.has_key) return '请填写 API Key'
    if (!form.model.trim()) return '请填写模型名称'
    return ''
  })()

  async function onSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await save({
        provider: form.provider,
        api_key: form.api_key,
        model: form.model.trim(),
        base_url: form.base_url.trim(),
      })
      setNotice('已保存并设为当前模型')
      closeSettings()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={(open) => {
        if (!open) closeSettings()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>模型设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>供应商</Label>
            <Select value={form.provider} onValueChange={applyProvider} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择供应商" />
              </SelectTrigger>
              <SelectContent>
                {catalog.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-api-key">API Key</Label>
            <Input
              id="settings-api-key"
              type="password"
              autoComplete="off"
              placeholder={keyPlaceholder}
              disabled={loading}
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
            />
            {hasSavedKey && <p className="text-xs text-slate-500">留空则保留已保存的密钥</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-model">模型</Label>
            <Input
              id="settings-model"
              disabled={loading}
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="settings-base-url">Base URL</Label>
            <Input
              id="settings-base-url"
              placeholder={basePlaceholder}
              disabled={loading}
              value={form.base_url}
              onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
            />
            {requiresBaseUrl && !form.base_url.trim() && (
              <p className="text-xs text-amber-600">OpenAI Compatible 必须填写 Base URL</p>
            )}
          </div>

          {error && <p className="text-sm text-[var(--color-destructive)]">{error}</p>}
          {notice && !error && <p className="text-sm text-[var(--color-primary)]">{notice}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={closeSettings}>
            取消
          </Button>
          <div className="flex flex-col items-end gap-1">
            <Button disabled={!canSave || loading || saving} onClick={onSave}>
              {saving ? '保存中…' : '保存并使用'}
            </Button>
            {saveHint && !canSave && <p className="text-xs text-slate-500">{saveHint}</p>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
