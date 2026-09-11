import { useEffect, useState } from 'react'

import { fetchWarehouseStatus } from '@/api/warehouseStatus'
import { useAuthStore } from '@/stores/auth'

/** Visible 「演示数据」 watermark when chat is allowed to use the config.yaml demo warehouse. */
export default function DemoWarehouseBanner() {
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
    <div
      role="status"
      aria-label="演示数据"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
    >
      <div className="mt-2 rounded-full border border-amber-300/80 bg-amber-100/95 px-4 py-1 text-xs font-semibold tracking-wide text-amber-900 shadow-sm backdrop-blur-sm">
        演示数据 · 非生产数仓
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
      >
        <span className="select-none text-6xl font-black tracking-[0.35em] text-amber-500/10 rotate-[-24deg]">
          演示数据
        </span>
      </div>
    </div>
  )
}
