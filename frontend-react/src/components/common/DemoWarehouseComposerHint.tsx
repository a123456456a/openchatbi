import { useEffect, useState } from 'react'

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

/** Short hint beside the chat composer when demo warehouse mode is on. */
export default function DemoWarehouseComposerHint({ className }: { className?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) {
      setDemoMode(false)
      return
    }
    let cancelled = false
    void fetchWarehouseStatus()
      .then((status) => {
        if (!cancelled) setDemoMode(Boolean(status.demo_mode))
      })
      .catch(() => {
        if (!cancelled) setDemoMode(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  if (!demoMode) return null

  return (
    <p
      role="status"
      aria-label="当前为演示数仓"
      className={cn('text-xs font-medium text-amber-800', className)}
    >
      当前为演示数仓
    </p>
  )
}
