import { parseNdjsonChunk } from '@/lib/ndjson'
import type { StreamEvent } from '@/types/stream'

export type AbortInterruptResponse = {
  aborted: boolean
  had_interrupt: boolean
}

export type CancelRunResponse = {
  cancelled: boolean
  had_running_run: boolean
  thread_cleared: boolean
}

export type ChatStreamBody = {
  input: string
  session_id: string
  provider: string | null
  mode: 'events' | 'text'
}

export type ChatStreamDeps = {
  getAccessToken: () => string | null
  getStoredRefresh: () => string | null
  /** Store-level single-flight refresh. */
  refresh: () => Promise<boolean>
}

async function authHeaders(deps: ChatStreamDeps): Promise<HeadersInit> {
  if (!deps.getAccessToken() && deps.getStoredRefresh()) {
    await deps.refresh()
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/x-ndjson',
  }
  const token = deps.getAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function abortChatInterrupt(
  sessionId: string,
  deps: ChatStreamDeps,
): Promise<AbortInterruptResponse> {
  const attempt = async () => {
    const headers = await authHeaders(deps)
    return fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/abort-interrupt`, {
      method: 'POST',
      headers,
    })
  }

  let res = await attempt()
  if (res.status === 401) {
    const ok = await deps.refresh()
    if (!ok) throw new Error('未登录或登录已过期')
    res = await attempt()
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = (await res.json()) as { detail?: string }
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  return (await res.json()) as AbortInterruptResponse
}

export async function cancelChatRun(
  sessionId: string,
  deps: ChatStreamDeps,
): Promise<CancelRunResponse> {
  const attempt = async () => {
    const headers = await authHeaders(deps)
    return fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      headers,
    })
  }

  let res = await attempt()
  if (res.status === 401) {
    const ok = await deps.refresh()
    if (!ok) throw new Error('未登录或登录已过期')
    res = await attempt()
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = (await res.json()) as { detail?: string }
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  return (await res.json()) as CancelRunResponse
}

export async function streamChat(
  body: ChatStreamBody,
  onEvent: (event: StreamEvent) => void,
  signal: AbortSignal | undefined,
  deps: ChatStreamDeps,
): Promise<void> {
  const attempt = async () => {
    const headers = await authHeaders(deps)
    return fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
  }

  let res = await attempt()
  if (res.status === 401) {
    const ok = await deps.refresh()
    if (!ok) throw new Error('未登录或登录已过期')
    res = await attempt()
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const j = (await res.json()) as { detail?: string }
      if (typeof j.detail === 'string') detail = j.detail
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }

  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    buffer = parseNdjsonChunk(buffer, chunk, (line) => onEvent(JSON.parse(line) as StreamEvent))
  }
  const last = buffer.trim()
  if (last) onEvent(JSON.parse(last) as StreamEvent)
}
