import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/llmSettings', () => ({
  fetchLlmSettings: vi.fn(),
  saveLlmSettings: vi.fn(),
  deleteLlmProvider: vi.fn(),
}))

import { fetchLlmSettings } from '@/api/llmSettings'
import { useSettingsStore } from '@/stores/settings'
import { useAuthStore } from '@/stores/auth'
import { VIEWER_READONLY_DETAIL } from '@/lib/roles'
import SettingsDialog from './SettingsDialog'

describe('SettingsDialog', () => {
  beforeEach(() => {
    useAuthStore.setState({ role: 'admin', isAuthenticated: true })
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
    cleanup()
    useSettingsStore.setState({ settingsOpen: false })
    useAuthStore.setState({ role: 'admin', isAuthenticated: true })
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


  it('viewer cannot edit LLM settings', async () => {
    useAuthStore.setState({ role: 'viewer', isAuthenticated: true })
    render(<SettingsDialog />)
    useSettingsStore.getState().openSettings()
    expect((await screen.findAllByText(VIEWER_READONLY_DETAIL))[0]).toBeVisible()
    expect(screen.queryByLabelText('API Key')).toBeNull()
    expect(screen.queryByRole('button', { name: /保存并使用/ })).toBeNull()
  })
})
