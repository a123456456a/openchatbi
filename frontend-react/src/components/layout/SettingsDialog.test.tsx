import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/llmSettings', () => ({
  fetchLlmSettings: vi.fn(),
  saveLlmSettings: vi.fn(),
  deleteLlmProvider: vi.fn(),
}))

import { fetchLlmSettings } from '@/api/llmSettings'
import { useSettingsStore } from '@/stores/settings'
import SettingsDialog from './SettingsDialog'

describe('SettingsDialog', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeProvider: null,
      configs: [],
      catalog: [...useSettingsStore.getInitialState().catalog],
      settingsOpen: false,
      loading: false,
      error: null,
    })
    vi.mocked(fetchLlmSettings).mockReset()
  })

  afterEach(() => {
    useSettingsStore.setState({ settingsOpen: false })
  })

  it('shows the previously saved model and base_url instead of provider defaults on open', async () => {
    vi.mocked(fetchLlmSettings).mockResolvedValue({
      active_provider: 'deepseek',
      catalog: useSettingsStore.getInitialState().catalog,
      configs: [
        {
          provider: 'deepseek',
          has_key: true,
          api_key_masked: 'sk-***abcd',
          model: 'my-saved-model',
          base_url: 'https://saved.example.com/v1',
        },
      ],
    })

    render(<SettingsDialog />)

    useSettingsStore.getState().openSettings()

    await waitFor(() => expect(fetchLlmSettings).toHaveBeenCalledTimes(1))

    const modelInput = await screen.findByLabelText('模型')
    const baseUrlInput = await screen.findByLabelText('Base URL')

    await waitFor(() => {
      expect((modelInput as HTMLInputElement).value).toBe('my-saved-model')
    })
    expect((baseUrlInput as HTMLInputElement).value).toBe('https://saved.example.com/v1')
  })
})
