import { defineStore } from 'pinia'
import { ref } from 'vue'

const PROVIDER_KEY = 'ocbi_provider'

/** Hard-coded providers until GET /api/llm/providers exists. */
export const PROVIDER_OPTIONS = [
  { label: '默认', value: '' },
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
] as const

export const useSettingsStore = defineStore('settings', () => {
  const provider = ref<string>(localStorage.getItem(PROVIDER_KEY) ?? '')
  const settingsOpen = ref(false)

  function setProvider(value: string) {
    provider.value = value
    if (value) localStorage.setItem(PROVIDER_KEY, value)
    else localStorage.removeItem(PROVIDER_KEY)
  }

  function openSettings() {
    settingsOpen.value = true
  }

  function closeSettings() {
    settingsOpen.value = false
  }

  /** Value to send on chat requests (`null` means backend default). */
  function chatProvider(): string | null {
    return provider.value || null
  }

  return {
    provider,
    settingsOpen,
    setProvider,
    openSettings,
    closeSettings,
    chatProvider,
  }
})
