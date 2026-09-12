import { Suspense, useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuthStore } from '@/stores/auth'

type Status = 'checking' | 'ok' | 'fail'

function RouteFallback() {
  return (
    <div className="flex h-full min-h-[40vh] items-center justify-center text-sm text-[var(--color-muted-foreground)]">
      加载中…
    </div>
  )
}

export default function RequireAuth({ roles }: { roles?: string[] }) {
  const location = useLocation()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const role = useAuthStore((s) => s.role)

  const [status, setStatus] = useState<Status>(isAuthenticated ? 'ok' : 'checking')

  useEffect(() => {
    if (isAuthenticated) {
      setStatus('ok')
      return
    }
    const { getStoredRefresh, refresh } = useAuthStore.getState()
    if (!getStoredRefresh()) {
      setStatus('fail')
      return
    }
    let active = true
    setStatus('checking')
    void refresh().then((ok) => {
      if (active) setStatus(ok ? 'ok' : 'fail')
    })
    return () => {
      active = false
    }
  }, [isAuthenticated])

  if (status === 'checking') return null

  if (status === 'fail') {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  if (roles?.length && (!role || !roles.includes(role))) {
    return <Navigate to="/chat" replace />
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  )
}
