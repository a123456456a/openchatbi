import { describe, expect, it } from 'vitest'

import { applyCanonicalActive, type DatabaseConnection } from './databaseConnections'

function row(partial: Partial<DatabaseConnection> & Pick<DatabaseConnection, 'id' | 'name'>): DatabaseConnection {
  return {
    dialect: 'mysql',
    host: null,
    port: null,
    database: null,
    username: null,
    has_password: false,
    has_uri_override: false,
    include_tables: null,
    catalog_database_name: null,
    token_service_url: null,
    token_username: null,
    has_token_password: false,
    is_active: false,
    ...partial,
  }
}

describe('applyCanonicalActive', () => {
  it('marks only active_connection_id as active after sync-fail rollback shape', () => {
    const connections = [
      row({ id: 'prev', name: 'prod', is_active: true }),
      // Stale flag as if activate payload had left the failed target looking active
      row({ id: 'failed', name: 'bad', is_active: true }),
    ]

    const normalized = applyCanonicalActive(connections, 'prev')

    expect(normalized.find((c) => c.id === 'prev')?.is_active).toBe(true)
    expect(normalized.find((c) => c.id === 'failed')?.is_active).toBe(false)
  })

  it('clears all active badges when active_connection_id is null', () => {
    const connections = [row({ id: 'a', name: 'a', is_active: true }), row({ id: 'b', name: 'b', is_active: true })]
    const normalized = applyCanonicalActive(connections, null)
    expect(normalized.every((c) => c.is_active === false)).toBe(true)
  })
})
