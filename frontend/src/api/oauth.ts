export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  role: string
  user_id: string
}

export interface UserInfo {
  user_id: string
  username: string
  role: string
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string }
    if (typeof body.detail === 'string') return body.detail
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`
}

/** Password grant — raw fetch (no auth interceptor). */
export async function passwordGrant(username: string, password: string): Promise<TokenResponse> {
  const res = await fetch('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'password', username, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<TokenResponse>
}

/** Refresh grant — raw fetch (no auth interceptor). */
export async function refreshGrant(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<TokenResponse>
}

/** Revoke refresh token (requires Bearer access). */
export async function revokeToken(refreshToken: string, accessToken: string): Promise<void> {
  const res = await fetch('/oauth/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!res.ok && res.status !== 204) throw new Error(await readError(res))
}

export async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch('/oauth/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<UserInfo>
}

export async function bootstrapAdmin(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
}
