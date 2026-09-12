import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/warehouseStatus', () => ({
  fetchWarehouseStatus: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}))

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import DemoWarehouseComposerHint from './DemoWarehouseComposerHint'

describe('DemoWarehouseComposerHint', () => {
  beforeEach(() => {
    vi.mocked(fetchWarehouseStatus).mockReset()
  })

  it('shows 当前为演示数仓 when demo_mode is true', async () => {
    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: false,
      active_connection_id: null,
      demo_allowed: true,
      demo_mode: true,
    })
    render(<DemoWarehouseComposerHint />)
    await waitFor(() => {
      expect(screen.getByRole('status', { name: '当前为演示数仓' })).toBeTruthy()
    })
  })

  it('hides when not in demo mode', async () => {
    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'x',
      demo_allowed: true,
      demo_mode: false,
    })
    const { container } = render(<DemoWarehouseComposerHint />)
    await waitFor(() => {
      expect(fetchWarehouseStatus).toHaveBeenCalled()
    })
    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})
