import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { setHttpAuthBridge } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import App from './App.tsx'
import './index.css'

setHttpAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refresh: () => useAuthStore.getState().refresh(),
  onAuthFailure: () => useAuthStore.getState().clearSession(),
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
