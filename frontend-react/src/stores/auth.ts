import { create } from 'zustand'

import { bootstrapAdmin, fetchUserInfo, passwordGrant, refreshGrant, revokeToken, type TokenResponse } from '@/api/oauth'

import { useChatStore } from './chat'
import { useSessionsStore } from './sessions'

export const REFRESH_KEY = 'ocbi_refresh'

type AuthState = {
  accessToken: string | null
  userId: string | null
  username: string | null
  role: string | null
  isAuthenticated: boolean
  getStoredRefresh: () => string | null
  login: (user: string, password: string) => Promise<void>
  refresh: () => Promise<boolean>
  logout: () => Promise<void>
  bootstrap: (user: string, password: string) => Promise<void>
  clearSession: () => void
}

/** Shared across all callers (router, http, chat) so rotated refresh tokens aren't raced. */
let refreshInFlight: Promise<boolean> | null = null

function resetChatUi() {
  useChatStore.setState({
    sessionId: null,
    messages: [],
    streaming: false,
    lastInterrupt: null,
    error: null,
  })
}

export const useAuthStore = create<AuthState>((set, get) => {
  function getStoredRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  }

  function applyTokens(tok: TokenResponse, nameHint?: string) {
    localStorage.setItem(REFRESH_KEY, tok.refresh_token)
    set((state) => ({
      accessToken: tok.access_token,
      userId: tok.user_id,
      role: tok.role,
      username: nameHint ?? state.username,
      isAuthenticated: true,
    }))
    useSessionsStore.getState().bindUser(tok.user_id)
  }

  function clearSession() {
    // Prefer sessions-store active user (source of truth for scoped keys).
    useSessionsStore.getState().clearActiveUserLocalData(get().userId)
    resetChatUi()
    localStorage.removeItem(REFRESH_KEY)
    set({
      accessToken: null,
      userId: null,
      username: null,
      role: null,
      isAuthenticated: false,
    })
  }

  async function login(user: string, password: string) {
    const tok = await passwordGrant(user, password)
    applyTokens(tok, user)
    try {
      const info = await fetchUserInfo(tok.access_token)
      set({ username: info.username, role: info.role, userId: info.user_id })
      useSessionsStore.getState().bindUser(info.user_id)
    } catch {
      /* token already applied; userinfo is best-effort */
    }
  }

  async function refreshOnce(): Promise<boolean> {
    const rt = getStoredRefresh()
    if (!rt) {
      clearSession()
      return false
    }
    try {
      const tok = await refreshGrant(rt)
      applyTokens(tok, get().username ?? undefined)
      try {
        const info = await fetchUserInfo(tok.access_token)
        set({ username: info.username, role: info.role, userId: info.user_id })
        useSessionsStore.getState().bindUser(info.user_id)
      } catch {
        /* ignore */
      }
      return true
    } catch {
      clearSession()
      return false
    }
  }

  /** Single-flight refresh — safe for concurrent router + http callers. */
  async function refresh(): Promise<boolean> {
    if (!refreshInFlight) {
      refreshInFlight = refreshOnce().finally(() => {
        refreshInFlight = null
      })
    }
    return refreshInFlight
  }

  async function logout() {
    const rt = getStoredRefresh()
    const at = get().accessToken
    try {
      if (rt && at) await revokeToken(rt, at)
    } catch {
      /* still clear local session */
    }
    clearSession()
  }

  async function bootstrap(user: string, password: string) {
    await bootstrapAdmin(user, password)
  }

  return {
    accessToken: null,
    userId: null,
    username: null,
    role: null,
    isAuthenticated: false,
    getStoredRefresh,
    login,
    refresh,
    logout,
    bootstrap,
    clearSession,
  }
})
