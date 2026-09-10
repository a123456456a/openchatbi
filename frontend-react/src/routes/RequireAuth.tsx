import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'

import { useAuthStore } from '@/stores/auth'

type Status = 'checking' | 'ok' | 'fail'

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

  return <Outlet />
}
