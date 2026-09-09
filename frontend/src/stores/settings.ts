import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  deleteLlmProvider,
  fetchLlmSettings,
  saveLlmSettings,
  type LlmCatalogItem,
  type LlmConfigRow,
  type LlmSettingsResponse,
} from '../api/llmSettings'
import { LLM_PROVIDER_CATALOG } from '../constants/llmProviders'

export type SettingsForm = {
  provider: string
  api_key: string
  model: string
  base_url: string
}

export const useSettingsStore = defineStore('settings', () => {
  const activeProvider = ref<string | null>(null)
  const configs = ref<LlmConfigRow[]>([])
  const catalog = ref<LlmCatalogItem[]>([...LLM_PROVIDER_CATALOG])
  const settingsOpen = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  function applyResponse(data: LlmSettingsResponse) {
    activeProvider.value = data.active_provider
    configs.value = data.configs
    catalog.value = data.catalog
  }

  async function load() {
    loading.value = true
    error.value = null
    try {
      const data = await fetchLlmSettings()
      applyResponse(data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function save(form: SettingsForm) {
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
    applyResponse(data)
  }

  async function removeProvider(provider: string) {
    await deleteLlmProvider(provider)
    await load()
  }

  function openSettings() {
    settingsOpen.value = true
    void load()
  }

  function closeSettings() {
    settingsOpen.value = false
  }

  /** Value to send on chat requests (`null` means backend default / active_provider). */
  function chatProvider(): string | null {
    return activeProvider.value
  }

  return {
    activeProvider,
    configs,
    catalog,
    settingsOpen,
    loading,
    error,
    load,
    save,
    removeProvider,
    openSettings,
    closeSettings,
    chatProvider,
  }
})
