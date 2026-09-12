import { describe, expect, it } from 'vitest'

import {
  STALE_WAREHOUSE_NEW_CHAT_LABEL,
  STALE_WAREHOUSE_SESSION_MESSAGE,
  STALE_WAREHOUSE_SIDEBAR_BADGE,
  evaluateSessionWarehouse,
  isSessionWarehouseStale,
} from './sessionWarehouse'

describe('evaluateSessionWarehouse', () => {
  it('binds on first observation when session has no warehouse stamp', () => {
    expect(evaluateSessionWarehouse(undefined, 'wh-1')).toBe('bind')
    expect(evaluateSessionWarehouse(undefined, null)).toBe('bind')
  })

  it('is ok when bound id matches current active_connection_id', () => {
    expect(evaluateSessionWarehouse('wh-1', 'wh-1')).toBe('ok')
    expect(evaluateSessionWarehouse(null, null)).toBe('ok')
  })

  it('is stale when active warehouse identity changed', () => {
    expect(evaluateSessionWarehouse('wh-1', 'wh-2')).toBe('stale')
    expect(evaluateSessionWarehouse('wh-1', null)).toBe('stale')
    expect(evaluateSessionWarehouse(null, 'wh-1')).toBe('stale')
  })

  it('exposes Chinese copy and CTA label', () => {
    expect(STALE_WAREHOUSE_SESSION_MESSAGE).toBe('数仓已切换，请新开对话')
    expect(STALE_WAREHOUSE_NEW_CHAT_LABEL).toBe('新开对话')
    expect(STALE_WAREHOUSE_SIDEBAR_BADGE).toBe('数仓已切换')
  })
})

describe('isSessionWarehouseStale', () => {
  it('is false while warehouse status is still unknown', () => {
    expect(isSessionWarehouseStale('wh-1', undefined)).toBe(false)
    expect(isSessionWarehouseStale(undefined, undefined)).toBe(false)
  })

  it('is false for unbound sessions (bind happens on open)', () => {
    expect(isSessionWarehouseStale(undefined, 'wh-1')).toBe(false)
    expect(isSessionWarehouseStale(undefined, null)).toBe(false)
  })

  it('is true only when bound id differs from live active_connection_id', () => {
    expect(isSessionWarehouseStale('wh-1', 'wh-2')).toBe(true)
    expect(isSessionWarehouseStale('wh-1', null)).toBe(true)
    expect(isSessionWarehouseStale(null, 'wh-1')).toBe(true)
    expect(isSessionWarehouseStale('wh-1', 'wh-1')).toBe(false)
    expect(isSessionWarehouseStale(null, null)).toBe(false)
  })
})
