import { useNdjsonStream } from '../composables/useNdjsonStream'
import type { StreamEvent } from '../types/stream'
import { useAuthStore } from '../stores/auth'

export type ChatStreamBody = {
  input: string
  session_id: string
  provider: string | null
  mode: 'events' | 'text'
}

async function authHeaders(): Promise<HeadersInit> {
  const auth = useAuthStore()
  if (!auth.accessToken && auth.getStoredRefresh()) {
    await auth.refresh()
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/x-ndjson',
  }
  if (auth.accessToken) headers.Authorization = `Bearer ${auth.accessToken}`
  return headers
}

export async function streamChat(
  body: ChatStreamBody,
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const auth = useAuthStore()

  const attempt = async () => {
    const headers = await authHeaders()
    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
    return res
  }

  let res = await attempt()
  if (res.status === 401) {
    const ok = await auth.refresh()
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

  // Re-parse as NDJSON from the Response we already have
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      onEvent(JSON.parse(trimmed) as StreamEvent)
    }
  }
  const last = buffer.trim()
  if (last) onEvent(JSON.parse(last) as StreamEvent)
}

// Keep composable available for other callers
export { useNdjsonStream }
