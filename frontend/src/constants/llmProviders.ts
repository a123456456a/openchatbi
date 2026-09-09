/** Mirror of backend/llm/providers.py — keep ids/labels/defaults aligned. */
export type LlmProviderCatalogEntry = {
  id: string
  label: string
  default_model: string
  default_base_url: string | null
  requires_base_url: boolean
}

export const LLM_PROVIDER_CATALOG: LlmProviderCatalogEntry[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    default_base_url: 'https://api.deepseek.com/v1',
    default_model: 'deepseek-chat',
    requires_base_url: false,
  },
  {
    id: 'zhipu',
    label: '智谱 AI',
    default_base_url: 'https://open.bigmodel.cn/api/paas/v4/',
    default_model: 'glm-4-flash',
    requires_base_url: false,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    default_base_url: null,
    default_model: 'gpt-4o-mini',
    requires_base_url: false,
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    default_base_url: null,
    default_model: 'claude-sonnet-4-20250514',
    requires_base_url: false,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    default_base_url: null,
    default_model: 'gemini-2.0-flash',
    requires_base_url: false,
  },
  {
    id: 'openai_compatible',
    label: 'OpenAI Compatible',
    default_base_url: null,
    default_model: 'gpt-4o-mini',
    requires_base_url: true,
  },
]

/** Temporary for SettingsDrawer until Task 8 replaces it with SettingsDialog. */
export const PROVIDER_OPTIONS = [
  { label: '默认', value: '' },
  ...LLM_PROVIDER_CATALOG.map((p) => ({ label: p.label, value: p.id })),
] as const
