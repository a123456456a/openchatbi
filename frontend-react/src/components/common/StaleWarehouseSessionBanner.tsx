import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  STALE_WAREHOUSE_NEW_CHAT_LABEL,
  STALE_WAREHOUSE_SESSION_MESSAGE,
  evaluateSessionWarehouse,
} from '@/lib/sessionWarehouse'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useSessionsStore } from '@/stores/sessions'

/**
 * On chat enter / window focus / visibility, compare the open session's stamped
 * warehouse identity with live `active_connection_id`. Prompt to start a new
 * chat when the warehouse was switched underneath a stale thread.
 */
export default function StaleWarehouseSessionBanner({
  sessionId,
  onStaleChange,
}: {
  sessionId: string
  /** Notifies the chat page so the composer can block send while this banner is visible. */
  onStaleChange?: (stale: boolean) => void
}) {
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const sessions = useSessionsStore((s) => s.sessions)
  const ensure = useSessionsStore((s) => s.ensure)
  const setWarehouseConnectionId = useSessionsStore((s) => s.setWarehouseConnectionId)
  const stop = useChatStore((s) => s.stop)

  const [stale, setStale] = useState(false)
  const [currentWarehouseId, setCurrentWarehouseId] = useState<string | null>(null)
  const checkSeq = useRef(0)
  const onStaleChangeRef = useRef(onStaleChange)
  onStaleChangeRef.current = onStaleChange

  const publishStale = useCallback((next: boolean) => {
    setStale(next)
    onStaleChangeRef.current?.(next)
  }, [])

  const boundWarehouseId = sessions.find((s) => s.id === sessionId)?.warehouseConnectionId

  const checkWarehouse = useCallback(() => {
    if (!isAuthenticated || !sessionId) {
      publishStale(false)
      return
    }
    const seq = ++checkSeq.current
    void fetchWarehouseStatus()
      .then((status) => {
        if (seq !== checkSeq.current) return
        const current = status.active_connection_id
        setCurrentWarehouseId(current)
        const bound = useSessionsStore.getState().sessions.find((s) => s.id === sessionId)
          ?.warehouseConnectionId
        const verdict = evaluateSessionWarehouse(bound, current)
        if (verdict === 'bind') {
          setWarehouseConnectionId(sessionId, current)
          publishStale(false)
          return
        }
        if (verdict === 'stale') {
          stop()
          publishStale(true)
          return
        }
        publishStale(false)
      })
      .catch(() => {
        // Soft-fail: do not block chat if status is temporarily unavailable.
        if (seq === checkSeq.current) publishStale(false)
      })
  }, [isAuthenticated, sessionId, setWarehouseConnectionId, stop, publishStale])

  useEffect(() => {
    publishStale(false)
    checkWarehouse()
    return () => {
      publishStale(false)
    }
  }, [checkWarehouse, publishStale])

  useEffect(() => {
    function onFocus() {
      checkWarehouse()
    }
    function onVisibility() {
      if (document.visibilityState === 'visible') checkWarehouse()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkWarehouse])

  // Clear the banner once the open session is re-bound to the live warehouse.
  useEffect(() => {
    if (boundWarehouseId === undefined) return
    if (evaluateSessionWarehouse(boundWarehouseId, currentWarehouseId) === 'ok') {
      publishStale(false)
    }
  }, [boundWarehouseId, currentWarehouseId, publishStale])

  function startNewChat() {
    const id = crypto.randomUUID()
    ensure(id)
    setWarehouseConnectionId(id, currentWarehouseId)
    publishStale(false)
    navigate(`/chat/${id}`)
  }

  if (!stale) return null

  return (
    <div className="px-6 pb-2 pt-2">
      <Alert variant="destructive" role="alert" aria-label={STALE_WAREHOUSE_SESSION_MESSAGE}>
        <AlertDescription>{STALE_WAREHOUSE_SESSION_MESSAGE}</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="outline" onClick={startNewChat}>
            {STALE_WAREHOUSE_NEW_CHAT_LABEL}
          </Button>
        </AlertAction>
      </Alert>
    </div>
  )
}
