/**
 * Detect whether a chat session was started under a different warehouse than
 * the one currently active (via `/api/warehouse/status`.active_connection_id).
 */

/** Chinese copy shown on the chat page when the open session is stale. */
export const STALE_WAREHOUSE_SESSION_MESSAGE = '数仓已切换，请新开对话'

/** CTA label for starting a fresh session after a warehouse switch. */
export const STALE_WAREHOUSE_NEW_CHAT_LABEL = '新开对话'

export type SessionWarehouseVerdict = 'bind' | 'ok' | 'stale'

/**
 * Compare the warehouse identity stamped on a session with the live
 * `active_connection_id` from warehouse status.
 *
 * - `undefined` bound id → first observation: bind silently (no prompt).
 * - equal (including both null for demo / no active) → ok.
 * - otherwise → stale; UI should prompt with 「新开对话」.
 */
export function evaluateSessionWarehouse(
  boundWarehouseConnectionId: string | null | undefined,
  currentActiveConnectionId: string | null,
): SessionWarehouseVerdict {
  if (boundWarehouseConnectionId === undefined) return 'bind'
  if (boundWarehouseConnectionId === currentActiveConnectionId) return 'ok'
  return 'stale'
}
