export type AuthBridge = {
  getAccessToken: () => string | null
  /** Store-level single-flight refresh. */
  refresh: () => Promise<boolean>
  onAuthFailure?: () => void
}

let bridge: AuthBridge | null = null

/** Wired once from the auth store at app startup — avoids a store <-> api import cycle. */
export function setHttpAuthBridge(b: AuthBridge) {
  bridge = b
}

export type HttpOptions = RequestInit & {
  /** Skip Authorization header and 401 refresh retry. */
  skipAuth?: boolean
}

function withAuthHeaders(headersInit: HeadersInit | undefined, accessToken: string | null): Headers {
  const headers = new Headers(headersInit)
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return headers
}

/**
 * Authenticated fetch: attaches Bearer access token; on 401 runs the bridged
 * refresh() (single-flight) then retries the request once.
 */
export async function http(input: string, options: HttpOptions = {}): Promise<Response> {
  const { skipAuth = false, headers, ...rest } = options

  const doFetch = () =>
    fetch(input, {
      ...rest,
      headers: skipAuth ? headers : withAuthHeaders(headers, bridge?.getAccessToken() ?? null),
    })

  const res = await doFetch()
  if (res.status !== 401 || skipAuth || !bridge) {
    return res
  }

  const refreshed = await bridge.refresh()
  if (!refreshed) {
    bridge.onAuthFailure?.()
    return res
  }

  return doFetch()
}

export async function httpJson<T>(input: string, options: HttpOptions = {}): Promise<T> {
  const res = await http(input, options)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}
