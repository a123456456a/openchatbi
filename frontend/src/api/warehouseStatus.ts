import { httpJson } from './http'

export type WarehouseStatus = {
  has_active_connection: boolean
  active_connection_id: string | null
  demo_allowed: boolean
  demo_mode: boolean
}

export function fetchWarehouseStatus(): Promise<WarehouseStatus> {
  return httpJson<WarehouseStatus>('/api/warehouse/status')
}
