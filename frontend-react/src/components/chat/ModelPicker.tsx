import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { canManageLlm } from '@/lib/roles'

/** Inline model switcher shown at the end of the composer, mirroring the model chip
 * in the reference screenshot — lets the user flip between already-configured
 * providers without opening the full Settings dialog. Providers without a saved
 * API key aren't selectable here; picking one still requires the Settings dialog. */
export default function ModelPicker() {
  const role = useAuthStore((s) => s.role)
  const activeProvider = useSettingsStore((s) => s.activeProvider)
  const configs = useSettingsStore((s) => s.configs)
  const catalog = useSettingsStore((s) => s.catalog)
  const load = useSettingsStore((s) => s.load)
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider)
  const openSettings = useSettingsStore((s) => s.openSettings)

  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    void load().catch(() => {
      /* surfaced elsewhere (Settings dialog); the picker just falls back to "未配置模型" */
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const usable = configs.filter((c) => c.has_key)

  if (!canManageLlm(role)) {
    return null
  }
  const activeConfig = usable.find((c) => c.provider === activeProvider)
  const activeLabel = activeConfig
    ? (catalog.find((m) => m.id === activeConfig.provider)?.label ?? activeConfig.provider)
    : null

  async function choose(provider: string) {
    if (provider === activeProvider || switching) return
    setSwitching(provider)
    try {
      await setActiveProvider(provider)
    } catch {
      /* a stale/invalid provider surfaces as a normal chat error on next send */
    } finally {
      setSwitching(null)
    }
  }

  if (usable.length === 0) {
    return (
      <button
        type="button"
        onClick={openSettings}
        className="shrink-0 rounded-full px-2 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:text-amber-700"
      >
        未配置模型
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] data-open:text-[var(--color-foreground)]"
        >
          <span className="max-w-[8rem] truncate">{activeConfig?.model ?? activeLabel}</span>
          <ChevronDown size={12} className="shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        {usable.map((c) => {
          const label = catalog.find((m) => m.id === c.provider)?.label ?? c.provider
          return (
            <DropdownMenuItem
              key={c.provider}
              onSelect={() => void choose(c.provider)}
              disabled={switching === c.provider}
            >
              <span className="min-w-0 flex-1 truncate">
                {label}
                <span className="ml-1.5 text-[var(--color-muted-foreground)]">{c.model}</span>
              </span>
              {c.provider === activeProvider && <Check size={14} className="text-[var(--color-primary)]" />}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openSettings}>管理模型…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
