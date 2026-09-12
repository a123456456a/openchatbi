import { create } from 'zustand'

import {
  deleteLlmProvider,
  fetchLlmSettings,
  saveLlmSettings,
  type LlmCatalogItem,
  type LlmConfigRow,
} from '@/api/llmSettings'
import { LLM_PROVIDER_CATALOG } from '@/constants/llmProviders'

export type SettingsForm = {
  provider: string
  api_key: string
  model: string
  base_url: string
}

type SettingsState = {
  activeProvider: string | null
  configs: LlmConfigRow[]
  catalog: LlmCatalogItem[]
  settingsOpen: boolean
  loading: boolean
  error: string | null
  load: () => Promise<void>
  save: (form: SettingsForm) => Promise<void>
  removeProvider: (provider: string) => Promise<void>
  /** Switch the active provider among already-configured ones (no key resend needed). */
  setActiveProvider: (provider: string) => Promise<void>
  clearError: () => void
  openSettings: () => void
  closeSettings: () => void
  chatProvider: () => string | null
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  activeProvider: null,
  configs: [],
  catalog: [...LLM_PROVIDER_CATALOG],
  settingsOpen: false,
  loading: false,
  error: null,

  async load() {
    set({ loading: true, error: null })
    try {
      const data = await fetchLlmSettings()
      set({ activeProvider: data.active_provider, configs: data.configs, catalog: data.catalog })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
      throw e
    } finally {
      set({ loading: false })
    }
  },

  async save(form) {
    const data = await saveLlmSettings({
      active_provider: form.provider || null,
      configs: [
        {
          provider: form.provider,
          ...(form.api_key ? { api_key: form.api_key } : {}),
          model: form.model,
          base_url: form.base_url || null,
        },
      ],
    })
    set({ activeProvider: data.active_provider, configs: data.configs, catalog: data.catalog, error: null })
  },

  async removeProvider(provider) {
    await deleteLlmProvider(provider)
    await get().load()
  },

  async setActiveProvider(provider) {
    set({ error: null })
    try {
      const data = await saveLlmSettings({ active_provider: provider })
      // Only commit selection after the server acknowledges — avoids a fake success checkmark.
      set({
        activeProvider: data.active_provider,
        configs: data.configs,
        catalog: data.catalog,
        error: null,
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      set({ error: message })
      throw e
    }
  },

  clearError: () => set({ error: null }),
  openSettings: () => set({ settingsOpen: true, error: null }),
  closeSettings: () => set({ settingsOpen: false }),
  /** Value to send on chat requests (`null` means backend default / active_provider). */
  chatProvider: () => get().activeProvider,
}))
