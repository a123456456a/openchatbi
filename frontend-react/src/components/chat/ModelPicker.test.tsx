import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/llmSettings', () => ({
  fetchLlmSettings: vi.fn(),
  saveLlmSettings: vi.fn(),
  deleteLlmProvider: vi.fn(),
}))

import { fetchLlmSettings, saveLlmSettings } from '@/api/llmSettings'
import { useSettingsStore } from '@/stores/settings'
import ModelPicker from './ModelPicker'

describe('ModelPicker', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeProvider: 'deepseek',
      configs: [
        {
          provider: 'deepseek',
          has_key: true,
          api_key_masked: 'sk-***',
          model: 'deepseek-chat',
          base_url: null,
        },
        {
          provider: 'openai',
          has_key: true,
          api_key_masked: 'sk-***',
          model: 'gpt-4o',
          base_url: null,
        },
        {
          provider: 'anthropic',
          has_key: false,
          api_key_masked: null,
          model: 'claude',
          base_url: null,
        },
      ],
      catalog: [...useSettingsStore.getInitialState().catalog],
      settingsOpen: false,
      loading: false,
      error: null,
    })
    vi.mocked(fetchLlmSettings).mockResolvedValue({
      active_provider: 'deepseek',
      catalog: useSettingsStore.getState().catalog,
      configs: useSettingsStore.getState().configs,
    })
    vi.mocked(saveLlmSettings).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps the previous selection and shows an alert when switch fails', async () => {
    vi.mocked(saveLlmSettings).mockRejectedValue(new Error('供应商不可用'))

    render(<ModelPicker />)

    fireEvent.click(screen.getByRole('button', { name: /deepseek-chat/i }))
    fireEvent.click(await screen.findByText(/gpt-4o/))

    expect(await screen.findByRole('alert')).toHaveTextContent('供应商不可用')
    expect(useSettingsStore.getState().activeProvider).toBe('deepseek')
    expect(screen.getByRole('button', { name: /deepseek-chat/i })).toBeVisible()
  })

  it('updates the checkmark only after a successful switch', async () => {
    vi.mocked(saveLlmSettings).mockResolvedValue({
      active_provider: 'openai',
      catalog: useSettingsStore.getState().catalog,
      configs: useSettingsStore.getState().configs,
    })

    render(<ModelPicker />)

    fireEvent.click(screen.getByRole('button', { name: /deepseek-chat/i }))
    fireEvent.click(await screen.findByText(/gpt-4o/))

    await waitFor(() => {
      expect(useSettingsStore.getState().activeProvider).toBe('openai')
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not list providers without a saved key', async () => {
    render(<ModelPicker />)
    fireEvent.click(screen.getByRole('button', { name: /deepseek-chat/i }))
    expect(await screen.findByText(/管理模型/)).toBeVisible()
    expect(screen.queryByText(/claude/)).toBeNull()
  })
})
