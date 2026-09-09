import { httpJson } from './http'

export type LlmConfigRow = {
  provider: string
  has_key: boolean
  api_key_masked: string | null
  model: string
  base_url: string | null
}

export type LlmCatalogItem = {
  id: string
  label: string
  default_model: string
  default_base_url: string | null
  requires_base_url: boolean
}

export type LlmSettingsResponse = {
  active_provider: string | null
  catalog: LlmCatalogItem[]
  configs: LlmConfigRow[]
}

export function fetchLlmSettings() {
  return httpJson<LlmSettingsResponse>('/api/me/llm-settings')
}

export function saveLlmSettings(body: {
  active_provider?: string | null
  configs?: { provider: string; api_key?: string; model: string; base_url?: string | null }[]
}) {
  return httpJson<LlmSettingsResponse>('/api/me/llm-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteLlmProvider(provider: string) {
  return httpJson<void>(`/api/me/llm-settings/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  })
}
