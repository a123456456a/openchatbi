import { httpJson } from './http'

export type DialectCatalogItem = {
  id: string
  label: string
  default_port: number | null
  requires_host: boolean
  requires_database: boolean
  requires_username: boolean
  requires_password: boolean
  supports_token_service: boolean
  database_label: string
  database_placeholder: string
}

export type ConnectionRuntimeApplyStatus = {
  catalog_sync_status: 'success' | 'failed' | 'skipped'
  index_reload_status: 'success' | 'failed' | 'skipped'
  message?: string | null
}

export type DatabaseConnection = {
  id: string
  name: string
  dialect: string
  host: string | null
  port: number | null
  database: string | null
  username: string | null
  has_password: boolean
  has_uri_override: boolean
  include_tables: string[] | null
  catalog_database_name: string | null
  token_service_url: string | null
  token_username: string | null
  has_token_password: boolean
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
  runtime_apply?: ConnectionRuntimeApplyStatus | null
}

export type DatabaseConnectionsResponse = {
  catalog: DialectCatalogItem[]
  connections: DatabaseConnection[]
  active_connection_id: string | null
}

/** Prefer list ``active_connection_id`` over per-row flags so a rolled-back
 * activate target never appears as 「当前使用」 if row.is_active is stale. */
export function applyCanonicalActive(
  connections: DatabaseConnection[],
  activeConnectionId: string | null,
): DatabaseConnection[] {
  return connections.map((row) => ({
    ...row,
    is_active: activeConnectionId !== null && row.id === activeConnectionId,
  }))
}

export type DatabaseConnectionInput = {
  name: string
  dialect: string
  host?: string | null
  port?: number | null
  database?: string | null
  username?: string | null
  password?: string | null
  uri_override?: string | null
  include_tables?: string[] | null
  catalog_database_name?: string | null
  token_service_url?: string | null
  token_username?: string | null
  token_password?: string | null
}

export type TestConnectionResult = {
  ok: boolean
  detail: string
}

export function fetchDatabaseConnections() {
  return httpJson<DatabaseConnectionsResponse>('/api/admin/database-connections')
}

export function createDatabaseConnection(body: DatabaseConnectionInput) {
  return httpJson<DatabaseConnection>('/api/admin/database-connections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updateDatabaseConnection(id: string, body: Partial<DatabaseConnectionInput>) {
  return httpJson<DatabaseConnection>(`/api/admin/database-connections/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteDatabaseConnection(id: string) {
  return httpJson<void>(`/api/admin/database-connections/${id}`, {
    method: 'DELETE',
  })
}

export function activateDatabaseConnection(id: string) {
  return httpJson<DatabaseConnection>(`/api/admin/database-connections/${id}/activate`, {
    method: 'POST',
  })
}

export function testDatabaseConnectionDraft(body: DatabaseConnectionInput) {
  return httpJson<TestConnectionResult>('/api/admin/database-connections/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function testExistingDatabaseConnection(id: string) {
  return httpJson<TestConnectionResult>(`/api/admin/database-connections/${id}/test`, {
    method: 'POST',
  })
}
