import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/llmSettings', () => ({
  fetchLlmSettings: vi.fn(),
  saveLlmSettings: vi.fn(),
  deleteLlmProvider: vi.fn(),
}))

import { fetchLlmSettings, saveLlmSettings } from '@/api/llmSettings'
import { useSettingsStore } from '@/stores/settings'
import ModelPicker from './ModelPicker'

const baseConfigs = [
  {
    provider: 'deepseek',
    has_key: true,
    api_key_masked: 'sk-***',
    model: 'deepseek-chat',
    base_url: null as string | null,
  },
  {
    provider: 'openai',
    has_key: true,
    api_key_masked: 'sk-***',
    model: 'gpt-4o',
    base_url: null as string | null,
  },
  {
    provider: 'anthropic',
    has_key: false,
    api_key_masked: null as string | null,
    model: 'claude',
    base_url: null as string | null,
  },
]

describe('ModelPicker + setActiveProvider', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeProvider: 'deepseek',
      configs: baseConfigs,
      catalog: [...useSettingsStore.getInitialState().catalog],
      settingsOpen: false,
      loading: false,
      error: null,
    })
    vi.mocked(fetchLlmSettings).mockResolvedValue({
      active_provider: 'deepseek',
      catalog: useSettingsStore.getState().catalog,
      configs: baseConfigs,
    })
    vi.mocked(saveLlmSettings).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the previous selection and records an error when switch fails', async () => {
    vi.mocked(saveLlmSettings).mockRejectedValue(new Error('供应商不可用'))

    await expect(useSettingsStore.getState().setActiveProvider('openai')).rejects.toThrow('供应商不可用')

    expect(useSettingsStore.getState().activeProvider).toBe('deepseek')
    expect(useSettingsStore.getState().error).toBe('供应商不可用')

    render(<ModelPicker />)
    expect(await screen.findByRole('alert')).toHaveTextContent('供应商不可用')
    expect(screen.getByRole('button', { name: /去设置/ })).toBeVisible()
  })

  it('updates activeProvider only after a successful switch', async () => {
    vi.mocked(saveLlmSettings).mockResolvedValue({
      active_provider: 'openai',
      catalog: useSettingsStore.getState().catalog,
      configs: baseConfigs,
    })

    await useSettingsStore.getState().setActiveProvider('openai')
    expect(useSettingsStore.getState().activeProvider).toBe('openai')
    expect(useSettingsStore.getState().error).toBeNull()

    render(<ModelPicker />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /gpt-4o/i })).toBeVisible()
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('only treats providers with a saved key as selectable', () => {
    const usable = useSettingsStore.getState().configs.filter((c) => c.has_key)
    expect(usable.map((c) => c.provider)).toEqual(['deepseek', 'openai'])
    expect(usable.some((c) => c.provider === 'anthropic')).toBe(false)

    // No-key providers still need the settings page (empty picker CTA path).
    useSettingsStore.setState({
      configs: baseConfigs.map((c) => ({ ...c, has_key: false })),
      activeProvider: null,
    })
    render(<ModelPicker />)
    expect(screen.getByRole('button', { name: '未配置模型' })).toBeVisible()
  })
})
