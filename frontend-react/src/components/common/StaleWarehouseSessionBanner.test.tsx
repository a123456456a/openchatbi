import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
}))

vi.mock('@/api/warehouseStatus', () => ({
  fetchWarehouseStatus: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}))

const stop = vi.fn()
vi.mock('@/stores/chat', () => ({
  useChatStore: (sel: (s: { stop: () => void }) => unknown) => sel({ stop }),
}))

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import { STALE_WAREHOUSE_SESSION_MESSAGE } from '@/lib/sessionWarehouse'
import { resetSessionMessagesCache, useSessionsStore } from '@/stores/sessions'
import StaleWarehouseSessionBanner from './StaleWarehouseSessionBanner'

describe('StaleWarehouseSessionBanner', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSessionMessagesCache()
    useSessionsStore.setState({ activeUserId: null, sessions: [] })
    useSessionsStore.getState().bindUser('user-a')
    navigate.mockReset()
    stop.mockReset()
    vi.mocked(fetchWarehouseStatus).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('binds warehouse id silently on first observation', async () => {
    useSessionsStore.getState().ensure('s1')
    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'wh-1',
      demo_allowed: false,
      demo_mode: false,
    })
    const { queryByRole } = render(<StaleWarehouseSessionBanner sessionId="s1" />)
    await waitFor(() => {
      expect(
        useSessionsStore.getState().sessions.find((s) => s.id === 's1')?.warehouseConnectionId,
      ).toBe('wh-1')
    })
    expect(queryByRole('alert')).toBeNull()
  })

  it('shows Chinese prompt and 新开对话 when warehouse changed', async () => {
    useSessionsStore.getState().ensure('s1')
    useSessionsStore.getState().setWarehouseConnectionId('s1', 'wh-old')
    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'wh-new',
      demo_allowed: false,
      demo_mode: false,
    })
    const { getByRole } = render(<StaleWarehouseSessionBanner sessionId="s1" />)
    await waitFor(() => {
      expect(getByRole('alert', { name: STALE_WAREHOUSE_SESSION_MESSAGE })).toBeTruthy()
    })
    expect(getByRole('button', { name: '新开对话' })).toBeTruthy()
    expect(stop).toHaveBeenCalled()
  })

  it('新开对话 creates a session stamped with the live warehouse', async () => {
    useSessionsStore.getState().ensure('s1')
    useSessionsStore.getState().setWarehouseConnectionId('s1', 'wh-old')
    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'wh-new',
      demo_allowed: false,
      demo_mode: false,
    })
    const { getByRole } = render(<StaleWarehouseSessionBanner sessionId="s1" />)
    await waitFor(() => {
      expect(getByRole('button', { name: '新开对话' })).toBeTruthy()
    })
    fireEvent.click(getByRole('button', { name: '新开对话' }))
    expect(navigate).toHaveBeenCalled()
    const path = navigate.mock.calls[0][0] as string
    expect(path).toMatch(/^\/chat\//)
    const newId = path.replace('/chat/', '')
    expect(
      useSessionsStore.getState().sessions.find((s) => s.id === newId)?.warehouseConnectionId,
    ).toBe('wh-new')
  })

  it('notifies onStaleChange when banner becomes visible', async () => {
    const onStaleChange = vi.fn()
    useSessionsStore.getState().ensure('s1')
    useSessionsStore.getState().setWarehouseConnectionId('s1', 'wh-old')
    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'wh-new',
      demo_allowed: false,
      demo_mode: false,
    })
    render(<StaleWarehouseSessionBanner sessionId="s1" onStaleChange={onStaleChange} />)
    await waitFor(() => {
      expect(onStaleChange).toHaveBeenCalledWith(true)
    })
  })

})
