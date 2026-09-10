import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/oauth', () => ({
  passwordGrant: vi.fn(),
  refreshGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
  bootstrapAdmin: vi.fn(),
  revokeToken: vi.fn(),
}))

import { fetchUserInfo, refreshGrant } from '@/api/oauth'
import { REFRESH_KEY, useAuthStore } from './auth'

describe('useAuthStore.refresh', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(REFRESH_KEY, 'rt-1')
    useAuthStore.setState({
      accessToken: null,
      userId: null,
      username: null,
      role: null,
      isAuthenticated: false,
    })
    vi.mocked(refreshGrant).mockReset()
    vi.mocked(fetchUserInfo).mockReset()
  })

  it('is single-flight: concurrent calls only trigger one grant request', async () => {
    let resolveGrant!: (v: Awaited<ReturnType<typeof refreshGrant>>) => void
    vi.mocked(refreshGrant).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGrant = resolve
        }),
    )
    vi.mocked(fetchUserInfo).mockResolvedValue({ user_id: 'u1', username: 'alice', role: 'admin' })

    const p1 = useAuthStore.getState().refresh()
    const p2 = useAuthStore.getState().refresh()

    expect(refreshGrant).toHaveBeenCalledTimes(1)

    resolveGrant({
      access_token: 'at-1',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'rt-2',
      role: 'admin',
      user_id: 'u1',
    })

    const [ok1, ok2] = await Promise.all([p1, p2])
    expect(ok1).toBe(true)
    expect(ok2).toBe(true)
    expect(refreshGrant).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().accessToken).toBe('at-1')
    expect(localStorage.getItem(REFRESH_KEY)).toBe('rt-2')
  })

  it('clears session and returns false when no refresh token is stored', async () => {
    localStorage.clear()
    const ok = await useAuthStore.getState().refresh()
    expect(ok).toBe(false)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('clears session and returns false when the grant fails', async () => {
    vi.mocked(refreshGrant).mockRejectedValue(new Error('expired'))
    const ok = await useAuthStore.getState().refresh()
    expect(ok).toBe(false)
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
  })
})
