import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  bootstrapAdmin,
  fetchUserInfo,
  passwordGrant,
  refreshGrant,
  revokeToken,
  type TokenResponse,
} from '../api/oauth'

const REFRESH_KEY = 'ocbi_refresh'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const userId = ref<string | null>(null)
  const username = ref<string | null>(null)
  const role = ref<string | null>(null)

  const isAuthenticated = computed(() => !!accessToken.value)

  function getStoredRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  }

  function applyTokens(tok: TokenResponse, nameHint?: string) {
    accessToken.value = tok.access_token
    userId.value = tok.user_id
    role.value = tok.role
    if (nameHint) username.value = nameHint
    localStorage.setItem(REFRESH_KEY, tok.refresh_token)
  }

  function clearSession() {
    accessToken.value = null
    userId.value = null
    username.value = null
    role.value = null
    localStorage.removeItem(REFRESH_KEY)
  }

  async function login(user: string, password: string) {
    const tok = await passwordGrant(user, password)
    applyTokens(tok, user)
    try {
      const info = await fetchUserInfo(tok.access_token)
      username.value = info.username
      role.value = info.role
      userId.value = info.user_id
    } catch {
      /* token already applied; userinfo is best-effort */
    }
  }

  async function refresh(): Promise<boolean> {
    const rt = getStoredRefresh()
    if (!rt) {
      clearSession()
      return false
    }
    try {
      const tok = await refreshGrant(rt)
      applyTokens(tok, username.value ?? undefined)
      try {
        const info = await fetchUserInfo(tok.access_token)
        username.value = info.username
        role.value = info.role
        userId.value = info.user_id
      } catch {
        /* ignore */
      }
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function logout() {
    const rt = getStoredRefresh()
    const at = accessToken.value
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
    accessToken,
    userId,
    username,
    role,
    isAuthenticated,
    login,
    refresh,
    logout,
    bootstrap,
    clearSession,
    getStoredRefresh,
  }
})
