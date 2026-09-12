import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useParams: () => ({ sessionId: 'fresh' }),
}))

vi.mock('@/api/warehouseStatus', () => ({
  fetchWarehouseStatus: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: true }),
}))

vi.mock('@/components/common/DemoWarehouseBanner', () => ({
  default: () => null,
}))

vi.mock('./SettingsDialog', () => ({
  default: () => null,
}))

vi.mock('./SidebarFooter', () => ({
  default: () => null,
}))

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import { STALE_WAREHOUSE_SIDEBAR_BADGE } from '@/lib/sessionWarehouse'
import { resetSessionMessagesCache, useSessionsStore } from '@/stores/sessions'
import AppShell from './AppShell'

describe('AppShell sidebar stale warehouse mark', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSessionMessagesCache()
    useSessionsStore.setState({ activeUserId: null, sessions: [] })
    useSessionsStore.getState().bindUser('user-a')
    navigate.mockReset()
    vi.mocked(fetchWarehouseStatus).mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows 数仓已切换 badge and greys out sessions bound to an old warehouse', async () => {
    useSessionsStore.getState().ensure('stale-s')
    useSessionsStore.getState().setWarehouseConnectionId('stale-s', 'wh-old')
    useSessionsStore.getState().upsert('stale-s', '旧数仓会话')
    useSessionsStore.getState().ensure('fresh')
    useSessionsStore.getState().setWarehouseConnectionId('fresh', 'wh-new')
    useSessionsStore.getState().upsert('fresh', '当前数仓会话')

    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'wh-new',
      demo_allowed: false,
      demo_mode: false,
    })

    const { getByLabelText, queryByLabelText, getAllByText } = render(
      <AppShell>
        <div />
      </AppShell>,
    )

    await waitFor(() => {
      expect(getByLabelText(`旧数仓会话（${STALE_WAREHOUSE_SIDEBAR_BADGE}）`)).toBeTruthy()
    })
    expect(getAllByText(STALE_WAREHOUSE_SIDEBAR_BADGE).length).toBeGreaterThanOrEqual(1)
    expect(queryByLabelText(`当前数仓会话（${STALE_WAREHOUSE_SIDEBAR_BADGE}）`)).toBeNull()
  })

  it('does not mark unbound sessions before they are stamped', async () => {
    useSessionsStore.getState().ensure('legacy')
    useSessionsStore.getState().upsert('legacy', '未绑定会话')

    vi.mocked(fetchWarehouseStatus).mockResolvedValue({
      has_active_connection: true,
      active_connection_id: 'wh-new',
      demo_allowed: false,
      demo_mode: false,
    })

    const { queryByLabelText, queryByText } = render(
      <AppShell>
        <div />
      </AppShell>,
    )

    await waitFor(() => {
      expect(fetchWarehouseStatus).toHaveBeenCalled()
    })
    expect(queryByLabelText(`未绑定会话（${STALE_WAREHOUSE_SIDEBAR_BADGE}）`)).toBeNull()
    expect(queryByText(STALE_WAREHOUSE_SIDEBAR_BADGE)).toBeNull()
  })
})
